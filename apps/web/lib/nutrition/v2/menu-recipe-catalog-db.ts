import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ricette del nutrizionista (tabelle `nutrition_recipes` + `nutrition_recipe_components`)
 * → regole di combinazione su ingredienti del catalogo `nutrition_menu_foods`.
 *
 * Una ricetta NON ha macro proprie: i suoi nutrienti si calcolano al momento dai
 * componenti (canonical_key → catalogo → fdc). Qui si carica e si valida solo la
 * STRUTTURA (chi c'è dentro e in che proporzione per 100 g di piatto cotto); come usarla
 * nel piatto è compito del compositore.
 *
 * Stesso patto del catalogo (menu-food-catalog-db.ts): loader → null, MAI throw; cache di
 * processo con TTL; mapping puro esportato per i test.
 */

export type MenuRecipeComponent = {
  position: number;
  /** null solo per il componente neutro (acqua/brodo: sposta il peso, zero nutrienti). */
  canonicalKey: string | null;
  /** Snapshot dell'fdc_id al momento dell'import (i nutrienti si leggono via canonical_key). */
  fdcId: number | null;
  labelIt: string;
  /** Grammi di questo ingrediente per 100 g di piatto cotto. */
  gramsPer100g: number;
  isNeutral: boolean;
};

export type MenuRecipeFrequency = "COMMON" | "ROTATION" | "OCCASIONAL";

export type MenuRecipe = {
  id: string;
  recipeKey: string;
  labelIt: string;
  note: string | null;
  /**
   * Quanto spesso la ricetta può comparire — stessa semantica di
   * nutrition_menu_food_meal_roles.frequency sugli alimenti: non esclude, abbassa la
   * priorità. Default COMMON quando la colonna manca o il valore è ignoto.
   */
  frequency: MenuRecipeFrequency;
  /** Tetto di comparse a settimana (1-7), null = nessun tetto esplicito (resta quello di famiglia). */
  maxWeek: number | null;
  components: MenuRecipeComponent[];
};

const RECIPE_FREQUENCIES: ReadonlySet<string> = new Set<MenuRecipeFrequency>(["COMMON", "ROTATION", "OCCASIONAL"]);

function parseRecipeFrequency(raw: unknown): MenuRecipeFrequency {
  const v = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  return RECIPE_FREQUENCIES.has(v) ? (v as MenuRecipeFrequency) : "COMMON";
}

function parseRecipeMaxWeek(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i >= 1 && i <= 7 ? i : null;
}

/** Tolleranza sulla somma dei grammi per ricetta (stessa della funzione SQL nutrition_recipe_grams_ok). */
export const RECIPE_GRAMS_TOLERANCE = { min: 99, max: 101 } as const;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Log su console: il motore gira anche in Edge Function (Deno), niente logger di app. */
type RecipeLogger = (message: string) => void;
const defaultLogger: RecipeLogger = (m) => console.warn(m);

/**
 * Mapping puro righe DB → ricette valide. Esportato per i test.
 * Una ricetta viene SCARTATA (con log, mai throw) se:
 *  - non ha componenti;
 *  - un componente non neutro è senza canonical_key o con grammi non positivi;
 *  - la somma dei grams_per_100g è fuori [99, 101] (il DB non può imporlo per riga).
 * I componenti sono ordinati per position; ricette in ordine di recipe_key (byte-wise,
 * deterministico come il catalogo).
 */
export function mapMenuRecipeRows(
  recipeRows: unknown[],
  componentRows: unknown[],
  log: RecipeLogger = defaultLogger,
): MenuRecipe[] {
  const componentsByRecipe = new Map<string, MenuRecipeComponent[]>();
  const invalidRecipeIds = new Set<string>();
  for (const raw of componentRows) {
    const r = raw as Record<string, unknown>;
    const recipeId = str(r?.recipe_id);
    if (!recipeId) continue;
    const isNeutral = r?.is_neutral === true;
    const canonicalKey = str(r?.canonical_key);
    const grams = num(r?.grams_per_100g);
    if (grams == null || grams <= 0 || (!isNeutral && !canonicalKey)) {
      // Un solo componente rotto rende la ricetta non calcolabile: la scartiamo tutta,
      // meglio nessun piatto che un piatto con un ingrediente fantasma.
      invalidRecipeIds.add(recipeId);
      continue;
    }
    const list = componentsByRecipe.get(recipeId) ?? [];
    list.push({
      position: num(r?.position) ?? list.length + 1,
      canonicalKey: isNeutral ? null : canonicalKey,
      fdcId: isNeutral ? null : num(r?.fdc_id),
      labelIt: str(r?.label_it) ?? canonicalKey ?? "Acqua / brodo neutro",
      gramsPer100g: grams,
      isNeutral,
    });
    componentsByRecipe.set(recipeId, list);
  }

  const recipes: MenuRecipe[] = [];
  for (const raw of recipeRows) {
    const r = raw as Record<string, unknown>;
    const id = str(r?.id);
    const recipeKey = str(r?.recipe_key);
    if (!id || !recipeKey) continue;
    if (invalidRecipeIds.has(id)) {
      log(`[menu-recipes] ricetta ${recipeKey} scartata: componente senza canonical_key o grammi non validi`);
      continue;
    }
    const components = componentsByRecipe.get(id);
    if (!components || components.length === 0) {
      log(`[menu-recipes] ricetta ${recipeKey} scartata: nessun componente`);
      continue;
    }
    const total = components.reduce((acc, c) => acc + c.gramsPer100g, 0);
    if (total < RECIPE_GRAMS_TOLERANCE.min || total > RECIPE_GRAMS_TOLERANCE.max) {
      log(`[menu-recipes] ricetta ${recipeKey} scartata: somma grammi ${total.toFixed(2)} fuori [${RECIPE_GRAMS_TOLERANCE.min}, ${RECIPE_GRAMS_TOLERANCE.max}]`);
      continue;
    }
    components.sort((a, b) => a.position - b.position);
    recipes.push({
      id,
      recipeKey,
      labelIt: str(r?.label_it) ?? recipeKey.replace(/_/g, " "),
      note: str(r?.note),
      frequency: parseRecipeFrequency(r?.frequency),
      maxWeek: parseRecipeMaxWeek(r?.max_week),
      components,
    });
  }
  recipes.sort((a, b) => (a.recipeKey < b.recipeKey ? -1 : a.recipeKey > b.recipeKey ? 1 : 0));
  return recipes;
}

let menuRecipesCache: { at: number; recipes: MenuRecipe[] | null } | null = null;
const MENU_RECIPE_CACHE_TTL_MS = 5 * 60_000;

export function resetMenuRecipesCacheForTests(): void {
  menuRecipesCache = null;
}

/**
 * Carica le ricette attive con i loro componenti. null se la tabella è vuota o
 * irraggiungibile (il compositore continua senza ricette, come prima dell'import).
 * Cachiamo anche il null per non ritentare a raffica.
 */
export async function loadMenuRecipes(admin: SupabaseClient): Promise<MenuRecipe[] | null> {
  if (menuRecipesCache && Date.now() - menuRecipesCache.at < MENU_RECIPE_CACHE_TTL_MS) {
    return menuRecipesCache.recipes;
  }
  try {
    // frequency/max_week: colonne della migration 20260819110000 (applicata). Se mancassero
    // (ambiente non allineato) PostgREST torna 42703 e si ricade sulla select minima: la
    // ricetta resta COMMON senza tetto, cioè il comportamento di prima — MAI «nessuna ricetta»
    // per una colonna in meno.
    const full = await admin
      .from("nutrition_recipes")
      .select("id, recipe_key, label_it, note, frequency, max_week")
      .eq("is_active", true);
    const missingColumns =
      full.error != null &&
      (full.error.code === "42703" || /column .* does not exist|could not find the .* column/i.test(full.error.message ?? ""));
    const { data: recipeRows, error }: { data: unknown[] | null; error: { code?: string; message?: string } | null } =
      missingColumns
        ? await admin.from("nutrition_recipes").select("id, recipe_key, label_it, note").eq("is_active", true)
        : full;
    if (error || !Array.isArray(recipeRows) || recipeRows.length === 0) {
      menuRecipesCache = { at: Date.now(), recipes: null };
      return null;
    }
    const recipeIds = recipeRows.map((r) => str((r as Record<string, unknown>)?.id)).filter((s): s is string => s != null);
    const { data: componentRows, error: componentError } = await admin
      .from("nutrition_recipe_components")
      .select("recipe_id, position, canonical_key, fdc_id, label_it, grams_per_100g, is_neutral")
      .in("recipe_id", recipeIds);
    if (componentError || !Array.isArray(componentRows)) {
      menuRecipesCache = { at: Date.now(), recipes: null };
      return null;
    }
    const recipes = mapMenuRecipeRows(recipeRows, componentRows);
    const result = recipes.length > 0 ? recipes : null;
    menuRecipesCache = { at: Date.now(), recipes: result };
    return result;
  } catch {
    // MAI throw: il piano si genera anche senza ricette.
    menuRecipesCache = { at: Date.now(), recipes: null };
    return null;
  }
}
