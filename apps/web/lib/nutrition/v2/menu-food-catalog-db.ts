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
  /**
   * Grammatica di Mario (tabella 1:1 `nutrition_menu_food_meal_roles`): score e ruoli per
   * pasto. `undefined` = alimento senza riga di score (es. inserito da admin dopo l'import):
   * il compositore decide il fallback, il loader NON inventa valori.
   */
  mealRoles?: MenuFoodMealRoles;
};

/** Ruolo dell'alimento DENTRO un pasto (quota che copre). EXCLUDE = vietato in quel pasto. */
export type MenuFoodMealRole =
  | "CHO_PRIMARY"
  | "CHO_SECONDARY"
  | "PRO_PRIMARY"
  | "PRO_SECONDARY"
  | "FAT_COMPLEMENT"
  | "FIBER_VEG"
  | "FIBER_MICRO_PRIMARY"
  | "MIXED"
  | "COMPOSITE_MAIN"
  | "EXCLUDE"
  | "NONE";

/** Ruolo macro dominante dell'alimento, indipendente dal pasto. */
export type MenuFoodMacroRole =
  | "CHO_PRIMARY"
  | "CHO_SECONDARY"
  | "PRO_PRIMARY"
  | "PRO_SECONDARY"
  | "FAT_PRIMARY"
  | "FIBER_MICRO"
  | "MIXED"
  | "PRO_FAT_MIXED";

export type MenuFoodFrequency = "COMMON" | "ROTATION" | "OCCASIONAL";

// ── Sistema ruoli v6 (file EMPATHY_FOOD_KNOWLEDGE_BASE_v6) ───────────────────────────
// La v6 SOSTITUISCE i ruoli per-pasto v5: a colazione tre assi separati (CHO/proteine/
// grassi), un ruolo unico per pranzo+cena (main), un ruolo spuntino, più la gerarchia
// mediterranea (ordinamento SOFT) e il gruppo di sostituzione (R01). I campi sono
// OPZIONALI sul tipo: una riga letta con la select v5 (colonne non ancora migrate) o una
// fixture v5 non li ha, e la grammatica ricade sul vocabolario v5 per QUELLA entry.

/** v6, colazione asse CHO: PRIMARY_COMPLEX = base glucidica (B01), SECONDARY_SIMPLE = quota semplice (B02), SECONDARY_MIXED = dolci occasionali (B04/B05). */
export type MenuFoodBreakfastChoRole = "PRIMARY_COMPLEX" | "SECONDARY_SIMPLE" | "SECONDARY_MIXED" | "NONE";
/** v6, colazione asse proteico (B06): PRIMARY = latte/yogurt/kefir/uova; SECONDARY_SAVOURY = affettati (ripiego salato). */
export type MenuFoodBreakfastProteinRole = "PRIMARY" | "SECONDARY" | "SECONDARY_SAVOURY" | "NONE";
/** v6, colazione asse lipidico (B07): PRIMARY = frutta oleosa/creme; SECONDARY = semi/grassi animali. */
export type MenuFoodBreakfastFatRole = "PRIMARY" | "SECONDARY" | "NONE";
/** v6, ruolo unico a pranzo E cena (M01-M04). FAT_CONDIMENT = condimento grasso (quarta riga del pasto). */
export type MenuFoodMainMealRole =
  | "PRIMARY_PROTEIN"
  | "SECONDARY_PROTEIN"
  | "PRIMARY_OR_SECONDARY_PROTEIN"
  | "PRIMARY_COMPLEX_CARB"
  | "SECONDARY_CARB"
  | "FIBER_SIDE"
  | "SECONDARY_FAT"
  | "FAT_CONDIMENT"
  | "COMPOSITE_MAIN"
  | "NONE";
/** v6, idoneità spuntino (S01/S03): FAST_* = pronto; MEDIUM = ripiego (uova); LOW/NONE = fuori. */
export type MenuFoodSnackRole = "FAST_CARB" | "FAST_PROTEIN" | "FAST_FAT_PRO" | "MEDIUM" | "LOW" | "NONE";
/** v6, gerarchia mediterranea: ORDINAMENTO (B03/M04), mai peso fine né esclusione. */
export type MenuFoodMediterraneanPriority =
  | "PRIMARY"
  | "COMMON"
  | "ROTATION"
  | "SECOND_CHOICE"
  | "LIMITED"
  | "OCCASIONAL";

// ── Sistema tier v9 (file EMPATHY_FOOD_KNOWLEDGE_BASE_v9, CORE-first) ────────────────

/**
 * v9, tier generativo: PRIMA chiave d'ordinamento del pick (CORE < ROTATION <
 * OCCASIONAL < VARIETY); EXCLUDE_DEFAULT = verdetto (mai generato di default).
 */
export type MenuFoodGenerativeTier = "CORE" | "ROTATION" | "OCCASIONAL" | "VARIETY" | "EXCLUDE_DEFAULT";

/** v9, modalità di sostituzione: PORTION = stessi grammi (verdure), ENERGY = kcal-equivalenza (macro). */
export type MenuFoodSubstitutionMode = "ENERGY_EQUIVALENT" | "PORTION_EQUIVALENT";

/** Momenti della giornata con uno score di idoneità (0-10). */
export type MenuFoodScoreSlot = "breakfast" | "snack" | "lunch" | "dinner" | "preWorkout" | "postWorkout";
/** Pasti con un ruolo di composizione (pre/post workout hanno solo lo score). */
export type MenuFoodRoleMeal = "breakfast" | "snack" | "lunch" | "dinner";

export type MenuFoodMealRoles = {
  /** Idoneità 0-10 per momento; score mancante nel DB → 0 (nessuna idoneità), mai NaN. */
  scores: Record<MenuFoodScoreSlot, number>;
  /** Ruolo per pasto; valore sconosciuto/mancante nel DB → NONE (non lo si propone lì). */
  roles: Record<MenuFoodRoleMeal, MenuFoodMealRole>;
  macroRole: MenuFoodMacroRole | null;
  frequency: MenuFoodFrequency;
  /** Tetto settimanale di apparizioni; null = nessun tetto esplicito. */
  maxWeek: number | null;
  /** Velocità di preparazione 0-10; null se non valorizzata. */
  prepSpeed: number | null;
  // Colonne v6 — opzionali: assenti quando la riga viene dalla select v5 (colonne non
  // ancora migrate) o da una fixture v5. La grammatica usa `mealRolesHasV6` per decidere
  // per-entry se applicare il vocabolario v6 o ricadere sul v5.
  breakfastChoRole?: MenuFoodBreakfastChoRole;
  breakfastProteinRole?: MenuFoodBreakfastProteinRole;
  breakfastFatRole?: MenuFoodBreakfastFatRole;
  mainMealRole?: MenuFoodMainMealRole;
  snackRole?: MenuFoodSnackRole;
  mediterraneanPriority?: MenuFoodMediterraneanPriority;
  /** Gruppo di sostituzione v6 (R01): si scambia solo dentro lo stesso gruppo. */
  substitutionGroup?: string | null;
  /** Sostituti espliciti in ordine di preferenza (canonical_key), v6. */
  substitutes?: string[];
  // Colonne v9 (migrazione 20260821090000) — opzionali come le v6: assenti quando la
  // select è ricaduta su v5/v6 o su una fixture senza dati v9. NESSUN default inventato
  // dal parser: colonna assente → undefined (il default DB 'VARIETY'/true vive nel DB).
  /** v9: tier generativo CORE-first (prima chiave d'ordinamento; EXCLUDE_DEFAULT = verdetto). */
  generativeTier?: MenuFoodGenerativeTier;
  /** v9, P01: false = mai pescabile da solo (polveri proteiche, oli di semi, verdure rare). */
  defaultEnabled?: boolean;
  /** v9: peso di selezione del file. Persistito, NON consumato dal motore (dormiente). */
  selectionWeight?: number | null;
  /** v9: modalità di sostituzione (null = default energy). */
  substitutionMode?: MenuFoodSubstitutionMode | null;
  /** v9: pool di sostituzione del file (preferenza SOFT nei re-pick). */
  substitutePool?: string | null;
};

/**
 * True se la riga porta DATI v6 reali (un ruolo v6 non-NONE o un substitution_group):
 * il default 'NONE'/'COMMON' delle colonne appena aggiunte NON è un dato — con dati v5
 * e codice v6 un filtro che chiedesse PRIMARY_COMPLEX su colonne tutte NONE svuoterebbe
 * la colazione. Nei 492 alimenti migrati ogni riga ha substitution_group → true.
 */
export function mealRolesHasV6(mr: MenuFoodMealRoles): boolean {
  return (
    (mr.breakfastChoRole != null && mr.breakfastChoRole !== "NONE") ||
    (mr.breakfastProteinRole != null && mr.breakfastProteinRole !== "NONE") ||
    (mr.breakfastFatRole != null && mr.breakfastFatRole !== "NONE") ||
    (mr.mainMealRole != null && mr.mainMealRole !== "NONE") ||
    (mr.snackRole != null && mr.snackRole !== "NONE") ||
    mr.substitutionGroup != null
  );
}

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

const MEAL_ROLES: ReadonlySet<string> = new Set<MenuFoodMealRole>([
  "CHO_PRIMARY",
  "CHO_SECONDARY",
  "PRO_PRIMARY",
  "PRO_SECONDARY",
  "FAT_COMPLEMENT",
  "FIBER_VEG",
  "FIBER_MICRO_PRIMARY",
  "MIXED",
  "COMPOSITE_MAIN",
  "EXCLUDE",
  "NONE",
]);
const MACRO_ROLES: ReadonlySet<string> = new Set<MenuFoodMacroRole>([
  "CHO_PRIMARY",
  "CHO_SECONDARY",
  "PRO_PRIMARY",
  "PRO_SECONDARY",
  "FAT_PRIMARY",
  "FIBER_MICRO",
  "MIXED",
  "PRO_FAT_MIXED",
]);
const FREQUENCIES: ReadonlySet<string> = new Set<MenuFoodFrequency>(["COMMON", "ROTATION", "OCCASIONAL"]);

// Set v6 (stessi valori dei CHECK della migrazione 20260820090000).
const BREAKFAST_CHO_ROLES: ReadonlySet<string> = new Set<MenuFoodBreakfastChoRole>([
  "PRIMARY_COMPLEX",
  "SECONDARY_SIMPLE",
  "SECONDARY_MIXED",
  "NONE",
]);
const BREAKFAST_PROTEIN_ROLES: ReadonlySet<string> = new Set<MenuFoodBreakfastProteinRole>([
  "PRIMARY",
  "SECONDARY",
  "SECONDARY_SAVOURY",
  "NONE",
]);
const BREAKFAST_FAT_ROLES: ReadonlySet<string> = new Set<MenuFoodBreakfastFatRole>(["PRIMARY", "SECONDARY", "NONE"]);
const MAIN_MEAL_ROLES: ReadonlySet<string> = new Set<MenuFoodMainMealRole>([
  "PRIMARY_PROTEIN",
  "SECONDARY_PROTEIN",
  "PRIMARY_OR_SECONDARY_PROTEIN",
  "PRIMARY_COMPLEX_CARB",
  "SECONDARY_CARB",
  "FIBER_SIDE",
  "SECONDARY_FAT",
  "FAT_CONDIMENT",
  "COMPOSITE_MAIN",
  "NONE",
]);
const SNACK_ROLES: ReadonlySet<string> = new Set<MenuFoodSnackRole>([
  "FAST_CARB",
  "FAST_PROTEIN",
  "FAST_FAT_PRO",
  "MEDIUM",
  "LOW",
  "NONE",
]);
const MEDITERRANEAN_PRIORITIES: ReadonlySet<string> = new Set<MenuFoodMediterraneanPriority>([
  "PRIMARY",
  "COMMON",
  "ROTATION",
  "SECOND_CHOICE",
  "LIMITED",
  "OCCASIONAL",
]);

// Set v9 (stessi valori dei CHECK della migrazione 20260821090000).
const GENERATIVE_TIERS: ReadonlySet<string> = new Set<MenuFoodGenerativeTier>([
  "CORE",
  "ROTATION",
  "OCCASIONAL",
  "VARIETY",
  "EXCLUDE_DEFAULT",
]);
const SUBSTITUTION_MODES: ReadonlySet<string> = new Set<MenuFoodSubstitutionMode>([
  "ENERGY_EQUIVALENT",
  "PORTION_EQUIVALENT",
]);

/** Parser tollerante generico per un enum v6: valore ignoto/null → fallback (mai throw). */
function v6Enum<T extends string>(v: unknown, set: ReadonlySet<string>, fallback: T): T {
  const s = str(v)?.toUpperCase();
  return s && set.has(s) ? (s as T) : fallback;
}

/** substitutes jsonb → array di canonical_key; qualunque forma non-array → []. */
function parseSubstitutes(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((k): k is string => typeof k === "string" && k.trim().length > 0);
}

/** Score 0-10: null/NaN/fuori range → clamp, mancante → 0. Numeric PostgREST arriva come stringa. */
function score(v: unknown): number {
  const n = num(v);
  if (n == null) return 0;
  return Math.min(10, Math.max(0, n));
}

function mealRole(v: unknown): MenuFoodMealRole {
  const s = str(v)?.toUpperCase();
  return s && MEAL_ROLES.has(s) ? (s as MenuFoodMealRole) : "NONE";
}

/**
 * Parsing puro di una riga `nutrition_menu_food_meal_roles`. Esportato per i test.
 * Ritorna null solo senza canonical_key (riga inutilizzabile); per il resto è tollerante:
 * score null → 0, ruolo ignoto → NONE, frequenza ignota → COMMON, macro_role ignoto → null.
 * PERCHÉ tollerante: un refresh parziale di Mario non deve far cadere il catalogo intero,
 * e la CHECK del DB rende comunque impossibili i valori fuori enum in produzione.
 */
export function parseMenuFoodMealRoleRow(raw: unknown): { canonicalKey: string; mealRoles: MenuFoodMealRoles } | null {
  const r = raw as Record<string, unknown>;
  const canonicalKey = str(r?.canonical_key);
  if (!canonicalKey) return null;
  const macroRaw = str(r?.macro_role)?.toUpperCase();
  const freqRaw = str(r?.frequency)?.toUpperCase();
  const maxWeek = num(r?.max_week);
  const prepSpeed = num(r?.prep_speed);
  return {
    canonicalKey,
    mealRoles: {
      scores: {
        breakfast: score(r?.score_breakfast),
        snack: score(r?.score_snack),
        lunch: score(r?.score_lunch),
        dinner: score(r?.score_dinner),
        preWorkout: score(r?.score_pre_workout),
        postWorkout: score(r?.score_post_workout),
      },
      roles: {
        breakfast: mealRole(r?.role_breakfast),
        snack: mealRole(r?.role_snack),
        lunch: mealRole(r?.role_lunch),
        dinner: mealRole(r?.role_dinner),
      },
      macroRole: macroRaw && MACRO_ROLES.has(macroRaw) ? (macroRaw as MenuFoodMacroRole) : null,
      frequency: freqRaw && FREQUENCIES.has(freqRaw) ? (freqRaw as MenuFoodFrequency) : "COMMON",
      maxWeek: maxWeek != null && maxWeek >= 1 ? Math.trunc(maxWeek) : null,
      prepSpeed: prepSpeed != null && prepSpeed >= 0 ? Math.min(10, Math.trunc(prepSpeed)) : null,
      // v6: valore ignoto/mancante → default DB (NONE/COMMON), come per i ruoli v5. Se la
      // select è ricaduta sul set v5 (colonne assenti) i default rendono `mealRolesHasV6`
      // false e la grammatica resta sul vocabolario v5 per la riga.
      breakfastChoRole: v6Enum<MenuFoodBreakfastChoRole>(r?.breakfast_cho_role, BREAKFAST_CHO_ROLES, "NONE"),
      breakfastProteinRole: v6Enum<MenuFoodBreakfastProteinRole>(
        r?.breakfast_protein_role,
        BREAKFAST_PROTEIN_ROLES,
        "NONE",
      ),
      breakfastFatRole: v6Enum<MenuFoodBreakfastFatRole>(r?.breakfast_fat_role, BREAKFAST_FAT_ROLES, "NONE"),
      mainMealRole: v6Enum<MenuFoodMainMealRole>(r?.main_meal_role, MAIN_MEAL_ROLES, "NONE"),
      snackRole: v6Enum<MenuFoodSnackRole>(r?.snack_role, SNACK_ROLES, "NONE"),
      mediterraneanPriority: v6Enum<MenuFoodMediterraneanPriority>(
        r?.mediterranean_priority,
        MEDITERRANEAN_PRIORITIES,
        "COMMON",
      ),
      substitutionGroup: str(r?.substitution_group),
      substitutes: parseSubstitutes(r?.substitutes),
      // v9: parsing TOLLERANTE ma senza default inventati — la chiave assente nella riga
      // (select degradata a v5/v6, fixture senza dati v9) lascia il campo undefined, così
      // la grammatica degrada al vocabolario v6/v5 per QUELLA entry. Dopo la migrazione
      // ogni riga porta il default DB ('VARIETY'/true) e i campi sono sempre presenti.
      ...(GENERATIVE_TIERS.has(str(r?.generative_tier)?.toUpperCase() ?? "")
        ? { generativeTier: str(r?.generative_tier)!.toUpperCase() as MenuFoodGenerativeTier }
        : {}),
      ...(r?.default_enabled === true || r?.default_enabled === false
        ? { defaultEnabled: r.default_enabled === true }
        : {}),
      ...(r != null && typeof r === "object" && "selection_weight" in r
        ? { selectionWeight: num(r.selection_weight) }
        : {}),
      ...(SUBSTITUTION_MODES.has(str(r?.substitution_mode)?.toUpperCase() ?? "")
        ? { substitutionMode: str(r?.substitution_mode)!.toUpperCase() as MenuFoodSubstitutionMode }
        : {}),
      ...(str(r?.substitute_pool) ? { substitutePool: str(r?.substitute_pool) } : {}),
    },
  };
}

/**
 * Mapping puro righe DB → pool ordinati. Esportato per i test (mock righe, niente client).
 * Ordinamento DETERMINISTICO: sort_priority ASC poi canonical_key ASC (confronto byte-wise,
 * non localeCompare: l'esito non deve dipendere dal locale del runtime Node/Deno).
 * Righe senza macro utilizzabili sono escluse: senza macro il pick non potrebbe mai
 * costruire l'hit, tenerle nel pool sprecherebbe solo slot di rotazione.
 */
export function mapMenuFoodRows(
  menuRows: unknown[],
  macroRows: unknown[],
  mealRoleRows: unknown[] = [],
): MenuFoodPoolMap | null {
  // Score/ruoli di Mario per canonical_key: opzionali, l'alimento entra nel pool anche
  // senza (è il compositore a decidere come trattare l'assenza).
  const mealRolesByKey = new Map<string, MenuFoodMealRoles>();
  for (const raw of mealRoleRows) {
    const parsed = parseMenuFoodMealRoleRow(raw);
    if (parsed) mealRolesByKey.set(parsed.canonicalKey, parsed.mealRoles);
  }

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
        mealRoles: mealRolesByKey.get(canonicalKey),
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

/** Colonne v5 di nutrition_menu_food_meal_roles (select minima, sempre presente). */
const MEAL_ROLES_V5_SELECT =
  "canonical_key, score_breakfast, score_snack, score_lunch, score_dinner, score_pre_workout, score_post_workout, role_breakfast, role_snack, role_lunch, role_dinner, macro_role, frequency, max_week, prep_speed";
/** Colonne v6 (migrazione 20260820090000): la select le tenta, con retry v5 su 42703. */
const MEAL_ROLES_V6_EXTRA_SELECT =
  "breakfast_cho_role, breakfast_protein_role, breakfast_fat_role, main_meal_role, snack_role, mediterranean_priority, substitution_group, substitutes";
/** Colonne v9 (migrazione 20260821090000): terzo stadio della select, retry v6 su 42703. */
const MEAL_ROLES_V9_EXTRA_SELECT =
  "generative_tier, default_enabled, selection_weight, substitution_mode, substitute_pool";

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

    // Score/ruoli di Mario: tabella 1:1 separata (nessun embed PostgREST: una query in
    // più è più semplice del join dichiarato e non cambia se la tabella manca). Un errore
    // qui NON annulla il catalogo: si prosegue senza mealRoles, come prima dell'import.
    // Le colonne v6/v9 hanno retry ESPLICITO su 42703 a TRE STADI PROGRESSIVI
    // (v5+v6+v9 → v5+v6 → v5): su un ambiente senza colonne v9 si perdono SOLO le v9,
    // mai anche la v6 — MAI grammatica azzerata in silenzio per una colonna in meno.
    // `generative_note` non si carica: è solo admin, il motore non la usa.
    const rolesMissingColumns = (res: { error: { code?: string; message?: string } | null }) =>
      res.error != null &&
      (res.error.code === "42703" ||
        /column .* does not exist|could not find the .* column/i.test(res.error.message ?? ""));
    let rolesRes = await admin
      .from("nutrition_menu_food_meal_roles")
      .select(`${MEAL_ROLES_V5_SELECT}, ${MEAL_ROLES_V6_EXTRA_SELECT}, ${MEAL_ROLES_V9_EXTRA_SELECT}`);
    if (rolesMissingColumns(rolesRes)) {
      rolesRes = await admin
        .from("nutrition_menu_food_meal_roles")
        .select(`${MEAL_ROLES_V5_SELECT}, ${MEAL_ROLES_V6_EXTRA_SELECT}`);
    }
    if (rolesMissingColumns(rolesRes)) {
      rolesRes = await admin.from("nutrition_menu_food_meal_roles").select(MEAL_ROLES_V5_SELECT);
    }
    const { data: mealRoleRows, error: mealRoleError } = rolesRes;

    const pools = mapMenuFoodRows(menuRows, macroRows, !mealRoleError && Array.isArray(mealRoleRows) ? mealRoleRows : []);
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
