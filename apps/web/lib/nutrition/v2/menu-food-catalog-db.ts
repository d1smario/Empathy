import type { SupabaseClient } from "@supabase/supabase-js";
import type { MealPlanV2ServingBasis } from "@empathy/contracts";

/**
 * Catalogo curato dei cibi del menù (tabella `nutrition_menu_foods`) → pool per il
 * motore meal-plan V2. Sostituisce la costante hardcoded STAPLE_ALLOWLIST_BY_POOL come
 * fonte primaria: la costante resta SOLO come fallback quando la tabella è vuota o
 * irraggiungibile (loader → null, MAI throw: la generazione non deve rompersi).
 *
 * Le macro per 100 g arrivano da `nutrition_fdc_foods` via `fdc_id`: tra le due tabelle
 * NON esiste una foreign key dichiarata, quindi l'embedded join PostgREST non è
 * disponibile → seconda query batched `.in()` (chunk per stare sotto i limiti URL).
 */

export type MenuFoodEntry = {
  canonicalKey: string;
  labelIt: string;
  servingBasis: MealPlanV2ServingBasis;
  /** Chiave rotazione settimanale (es. carb:pasta) — stessa semantica del registry. */
  rotationKey?: string;
  /** Famiglia carb — no duplicato pranzo+cena stesso giorno. */
  carbFamily?: string;
  fdcId: number;
  kcalPer100g: number;
  carbsPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  /** Flag dieta ESPLICITI dal catalogo (niente liste hardcoded per i cibi nuovi). */
  isMeat: boolean;
  isFish: boolean;
  isAnimalProduct: boolean;
};

export type MenuFoodPoolMap = Map<string, MenuFoodEntry[]>;

const SERVING_BASES: ReadonlySet<string> = new Set(["dry_grams", "cooked_grams", "ml"]);

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

type MacroRow = { kcal: number; carbs: number; protein: number; fat: number };

/**
 * Mapping puro righe DB → pool ordinati. Esportato per i test (mock righe, niente client).
 * Ordinamento DETERMINISTICO: sort_priority ASC poi canonical_key ASC (confronto byte-wise,
 * non localeCompare: l'esito non deve dipendere dal locale del runtime Node/Deno).
 * Righe senza macro utilizzabili sono escluse: senza macro il pick non potrebbe mai
 * costruire l'hit, tenerle nel pool sprecherebbe solo slot di rotazione.
 */
export function mapMenuFoodRows(menuRows: unknown[], macroRows: unknown[]): MenuFoodPoolMap | null {
  const macroByFdc = new Map<number, MacroRow>();
  for (const raw of macroRows) {
    const r = raw as Record<string, unknown>;
    const fdcId = num(r?.fdc_id);
    const kcal = num(r?.kcal_100g);
    if (fdcId == null || fdcId <= 0 || kcal == null || kcal <= 0) continue;
    macroByFdc.set(fdcId, {
      kcal,
      carbs: num(r?.carbs_100g) ?? 0,
      protein: num(r?.protein_100g) ?? 0,
      fat: num(r?.fat_100g) ?? 0,
    });
  }

  type Parsed = { entry: MenuFoodEntry; poolKeys: string[]; sortPriority: number };
  const parsed: Parsed[] = [];
  for (const raw of menuRows) {
    const r = raw as Record<string, unknown>;
    const canonicalKey = str(r?.canonical_key);
    const fdcId = num(r?.fdc_id);
    const poolKeys = Array.isArray(r?.pool_keys)
      ? (r.pool_keys as unknown[]).filter((k): k is string => typeof k === "string" && k.trim().length > 0)
      : [];
    if (!canonicalKey || fdcId == null || fdcId <= 0 || poolKeys.length === 0) continue;
    const macro = macroByFdc.get(fdcId);
    if (!macro) continue;
    const servingBasisRaw = str(r?.serving_basis) ?? "";
    parsed.push({
      entry: {
        canonicalKey,
        labelIt: str(r?.label_it) ?? canonicalKey.replace(/_/g, " "),
        servingBasis: (SERVING_BASES.has(servingBasisRaw) ? servingBasisRaw : "dry_grams") as MealPlanV2ServingBasis,
        rotationKey: str(r?.rotation_key) ?? undefined,
        carbFamily: str(r?.carb_family) ?? undefined,
        fdcId,
        kcalPer100g: macro.kcal,
        carbsPer100g: macro.carbs,
        proteinPer100g: macro.protein,
        fatPer100g: macro.fat,
        isMeat: r?.is_meat === true,
        isFish: r?.is_fish === true,
        isAnimalProduct: r?.is_animal_product === true,
      },
      poolKeys,
      sortPriority: num(r?.sort_priority) ?? 999,
    });
  }
  if (parsed.length === 0) return null;

  parsed.sort((a, b) => {
    if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
    return a.entry.canonicalKey < b.entry.canonicalKey ? -1 : a.entry.canonicalKey > b.entry.canonicalKey ? 1 : 0;
  });

  const pools: MenuFoodPoolMap = new Map();
  for (const p of parsed) {
    for (const poolKey of p.poolKeys) {
      const list = pools.get(poolKey) ?? [];
      list.push(p.entry);
      pools.set(poolKey, list);
    }
  }
  return pools.size > 0 ? pools : null;
}

/**
 * Cache di processo con TTL — stesso pattern di loadFdcPools (build production): il
 * catalogo è globale (nessuna dipendenza da atleta/data), rileggerlo a ogni generazione
 * sarebbe solo round-trip inutile. Cachiamo anche il null: se il DB è irraggiungibile
 * non vogliamo ritentare a raffica, il fallback allowlist copre la finestra di TTL.
 */
let menuFoodPoolsCache: { at: number; pools: MenuFoodPoolMap | null } | null = null;
const MENU_FOOD_CACHE_TTL_MS = 5 * 60_000;
const FDC_IN_CHUNK = 200;

export function resetMenuFoodPoolsCacheForTests(): void {
  menuFoodPoolsCache = null;
}

export async function loadMenuFoodPools(admin: SupabaseClient): Promise<MenuFoodPoolMap | null> {
  if (menuFoodPoolsCache && Date.now() - menuFoodPoolsCache.at < MENU_FOOD_CACHE_TTL_MS) {
    return menuFoodPoolsCache.pools;
  }
  try {
    const { data: menuRows, error } = await admin
      .from("nutrition_menu_foods")
      .select(
        "canonical_key, fdc_id, label_it, serving_basis, pool_keys, rotation_key, carb_family, is_meat, is_fish, is_animal_product, sort_priority",
      )
      .eq("is_active", true);
    if (error || !Array.isArray(menuRows) || menuRows.length === 0) {
      menuFoodPoolsCache = { at: Date.now(), pools: null };
      return null;
    }

    const fdcIds = [
      ...new Set(
        menuRows
          .map((r) => num((r as Record<string, unknown>)?.fdc_id))
          .filter((n): n is number => n != null && n > 0),
      ),
    ];
    const macroRows: unknown[] = [];
    for (let i = 0; i < fdcIds.length; i += FDC_IN_CHUNK) {
      const { data, error: macroError } = await admin
        .from("nutrition_fdc_foods")
        .select("fdc_id, kcal_100g, carbs_100g, protein_100g, fat_100g")
        .in("fdc_id", fdcIds.slice(i, i + FDC_IN_CHUNK));
      if (macroError) {
        menuFoodPoolsCache = { at: Date.now(), pools: null };
        return null;
      }
      if (Array.isArray(data)) macroRows.push(...data);
    }

    const pools = mapMenuFoodRows(menuRows, macroRows);
    menuFoodPoolsCache = { at: Date.now(), pools };
    return pools;
  } catch {
    // MAI throw: qualunque problema DB → null → il motore usa l'allowlist hardcoded.
    menuFoodPoolsCache = { at: Date.now(), pools: null };
    return null;
  }
}

/**
 * Resolver canonical_key → rotation_key dal catalogo caricato: serve alla memoria
 * settimanale (righe `meal_item` dal DB hanno solo canonical_key) per far contare la
 * FAMIGLIA anche sui cibi nuovi che la costante hardcoded non conosce.
 */
export function menuRotationKeyResolver(pools: MenuFoodPoolMap): (canonicalKey: string) => string | undefined {
  const byCanonical = new Map<string, string>();
  for (const entries of pools.values()) {
    for (const e of entries) {
      if (e.rotationKey && !byCanonical.has(e.canonicalKey)) byCanonical.set(e.canonicalKey, e.rotationKey);
    }
  }
  return (canonicalKey) => byCanonical.get(canonicalKey);
}
