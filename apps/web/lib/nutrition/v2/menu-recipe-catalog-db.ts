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

/** v9: tier di scelta della ricetta (rank CORE < ROTATION < OCCASIONAL; fallback frequency). */
export type MenuRecipeTier = "CORE" | "ROTATION" | "OCCASIONAL";

/** v9: slot in cui la ricetta è candidabile (colonna `meals`, jsonb). */
export type MenuRecipeMeal = "breakfast" | "snack" | "lunch" | "dinner";

/**
 * v11: metadati del TEMPLATE di colazione/spuntino (colonna `template_meta` jsonb,
 * migrazione 20260822090000). I 4 family descrivono cosa il template porta già con sé
 * (V10_B02: il template occupa gli slot che copre — il compositore aggiunge la linea
 * grassi/frutta SOLO quando il campo è null); `variantGroup` è la chiave di rotazione
 * di famiglia del template (D3); `standardServingG` la porzione standard del foglio.
 * `NONE` del foglio → null (la migrazione lo fa già; il parser lo ridifende).
 */
export type MenuRecipeTemplateMeta = {
  primaryCarbFamily: string | null;
  proteinBaseFamily: string | null;
  fruitFamily: string | null;
  fatAddonFamily: string | null;
  variantGroup: string | null;
  standardServingG: number | null;
};

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
  // Colonne v9 (migrazione 20260821090000) — OPZIONALI: assenti quando la select è
  // ricaduta sugli stadi precedenti o su una fixture legacy. `meals` assente ≠ default:
  // per le righe senza colonna l'eleggibilità resta la deduzione dagli ingredienti
  // (recipeEligibleForMeal), MAI un lunch+dinner esplicito inventato dal parser.
  /** v9: famiglia (PASTA, FISH_DISH, PROTEIN_SHAKE_*…) — base dei tetti per famiglia. */
  family?: string | null;
  /** v9: tier di scelta (fallback: frequency). */
  tier?: MenuRecipeTier | null;
  /** v9: peso di selezione del file. Persistito, NON consumato dal motore (dormiente). */
  selectionWeight?: number | null;
  /** v9: slot ammessi espliciti; presente solo quando la colonna esiste. */
  meals?: MenuRecipeMeal[];
  /**
   * v11: metadati template (colonna `template_meta`). Presente solo quando la colonna
   * esiste nella select; null per le ricette non-template (lasagne, shake v9…) — il
   * compositore tratta null/assente allo stesso modo (percorso non-template).
   */
  templateMeta?: MenuRecipeTemplateMeta | null;
};

const RECIPE_FREQUENCIES: ReadonlySet<string> = new Set<MenuRecipeFrequency>(["COMMON", "ROTATION", "OCCASIONAL"]);
const RECIPE_TIERS: ReadonlySet<string> = new Set<MenuRecipeTier>(["CORE", "ROTATION", "OCCASIONAL"]);
const RECIPE_MEALS: ReadonlySet<string> = new Set<MenuRecipeMeal>(["breakfast", "snack", "lunch", "dinner"]);

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

/**
 * v11: parse difensivo di `template_meta`. Le famiglie sono stringhe libere del foglio
 * ('OATS', 'BREAD'…): 'NONE'/vuoto → null (il motore testa `!= null`, mai i letterali).
 * Un jsonb malformato o tutto-null → null: la ricetta si comporta da non-template.
 */
function parseTemplateMeta(raw: unknown): MenuRecipeTemplateMeta | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const fam = (v: unknown): string | null => {
    const s = str(v);
    return s && s.toUpperCase() !== "NONE" ? s : null;
  };
  const meta: MenuRecipeTemplateMeta = {
    primaryCarbFamily: fam(o.primary_carb_family),
    proteinBaseFamily: fam(o.protein_base_family),
    fruitFamily: fam(o.fruit_family),
    fatAddonFamily: fam(o.fat_addon_family),
    variantGroup: fam(o.variant_group),
    standardServingG: num(o.standard_serving_g),
  };
  return Object.values(meta).some((v) => v != null) ? meta : null;
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
    // v9 `meals`: SOLO quando la colonna è presente sulla riga; array malformato/vuoto →
    // default lunch+dinner (coerente col default DB della DDL). Riga senza colonna →
    // campo assente → eleggibilità dedotta dagli ingredienti come prima (bit-identico).
    const hasMealsColumn = r != null && typeof r === "object" && "meals" in r;
    const mealsParsed = Array.isArray(r?.meals)
      ? (r.meals as unknown[]).filter((m): m is MenuRecipeMeal => typeof m === "string" && RECIPE_MEALS.has(m))
      : [];
    const tierRaw = str(r?.tier)?.toUpperCase();
    recipes.push({
      id,
      recipeKey,
      labelIt: str(r?.label_it) ?? recipeKey.replace(/_/g, " "),
      note: str(r?.note),
      frequency: parseRecipeFrequency(r?.frequency),
      maxWeek: parseRecipeMaxWeek(r?.max_week),
      components,
      ...(r != null && typeof r === "object" && "family" in r ? { family: str(r.family) } : {}),
      ...(tierRaw && RECIPE_TIERS.has(tierRaw) ? { tier: tierRaw as MenuRecipeTier } : {}),
      ...(r != null && typeof r === "object" && "selection_weight" in r
        ? { selectionWeight: num(r.selection_weight) }
        : {}),
      ...(hasMealsColumn ? { meals: mealsParsed.length > 0 ? mealsParsed : ["lunch", "dinner"] } : {}),
      // v11: solo quando la colonna è presente (stessa semantica di meals/family) — su
      // uno stadio di select senza template_meta il campo resta assente, mai inventato.
      ...(r != null && typeof r === "object" && "template_meta" in r
        ? { templateMeta: parseTemplateMeta(r.template_meta) }
        : {}),
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
 * Legge TUTTE le righe di una query, una pagina per volta.
 *
 * PostgREST tronca ogni risposta al proprio tetto di righe (1.000 su questo progetto,
 * misurato) e NON lo segnala: restituisce mille righe e nessun errore. Finché i
 * componenti delle ricette erano 984 la cosa non si vedeva; il 25 ago 2026, arrivati a
 * 1.239, la select ne riportava 1.000 e **59 ricette su 308 restavano senza ingredienti**
 * — scartate con un warning nei log e sparite dal menù, mentre i piani continuavano a
 * generarsi come se niente fosse. Un guasto silenzioso che cresce col catalogo, e il
 * catalogo di Mario cresce a ogni file che ci manda.
 *
 * Si avanza di QUANTO SI È RICEVUTO e ci si ferma solo su una pagina vuota. La tentazione
 * è fermarsi appena una pagina è più corta di quella chiesta, ma il tetto del server può
 * essere più basso di `PAGE` (è configurabile e non vive nel repo): in quel caso la prima
 * pagina tornerebbe già "corta" e il ciclo si fermerebbe subito — lo stesso guasto con un
 * giro in più. Così invece il numero di andate e ritorni si adatta al tetto vero.
 */
const PAGE = 1000;
const MAX_PAGES = 50;

async function fetchAllPages(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { code?: string; message?: string } | null }>,
): Promise<{ data: unknown[] | null; error: { code?: string; message?: string } | null }> {
  const rows: unknown[] = [];
  // Il tetto VERO si impara dalla prima risposta: se il server ne dà meno di quante ne
  // chiediamo, quello è il suo tetto (o i dati sono finiti, e infatti ci si ferma). Da lì
  // in poi una pagina più corta del tetto significa «ultima», senza dover sempre pagare
  // un giro a vuoto per scoprirlo.
  let step = PAGE;
  for (let from = 0, guard = 0; guard < MAX_PAGES; guard += 1) {
    const res = await page(from, from + PAGE - 1);
    // L'errore torna al chiamante COM'È: è così che il degrado a stadi riconosce il
    // 42703 di una colonna mancante e riprova con la select più corta.
    if (res.error || !Array.isArray(res.data)) return res;
    if (res.data.length === 0) break;
    rows.push(...res.data);
    if (guard === 0) step = res.data.length;
    if (res.data.length < step) break;
    from += res.data.length;
  }
  return { data: rows, error: null };
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
    // Select a STADI PROGRESSIVI su 42703 (stesso pattern del loader alimenti):
    // v11 (template_meta, migration 20260822090000) → v9 (family/tier/selection_weight/
    // meals, migration 20260821090000) → frequency/max_week (20260819110000) → minima.
    // Su un ambiente senza una colonna si perde SOLO quella famiglia di colonne — MAI
    // «nessuna ricetta» per una colonna in meno.
    const missingColumns = (res: { error: { code?: string; message?: string } | null }) =>
      res.error != null &&
      (res.error.code === "42703" || /column .* does not exist|could not find the .* column/i.test(res.error.message ?? ""));
    const recipeSelect = (cols: string) =>
      fetchAllPages((from, to) =>
        admin.from("nutrition_recipes").select(cols).eq("is_active", true).order("id", { ascending: true }).range(from, to),
      );
    let full = await recipeSelect(
      "id, recipe_key, label_it, note, frequency, max_week, family, tier, selection_weight, meals, template_meta",
    );
    if (missingColumns(full)) {
      full = await recipeSelect("id, recipe_key, label_it, note, frequency, max_week, family, tier, selection_weight, meals");
    }
    if (missingColumns(full)) {
      full = await recipeSelect("id, recipe_key, label_it, note, frequency, max_week");
    }
    const { data: recipeRows, error }: { data: unknown[] | null; error: { code?: string; message?: string } | null } =
      missingColumns(full) ? await recipeSelect("id, recipe_key, label_it, note") : full;
    if (error || !Array.isArray(recipeRows) || recipeRows.length === 0) {
      menuRecipesCache = { at: Date.now(), recipes: null };
      return null;
    }
    const recipeIds = recipeRows.map((r) => str((r as Record<string, unknown>)?.id)).filter((s): s is string => s != null);
    const { data: componentRows, error: componentError } = await fetchAllPages((from, to) =>
      admin
        .from("nutrition_recipe_components")
        .select("recipe_id, position, canonical_key, fdc_id, label_it, grams_per_100g, is_neutral")
        .in("recipe_id", recipeIds)
        // L'ordine esplicito rende le pagine disgiunte e stabili: senza, due pagine
        // possono ripetere o saltare righe.
        .order("recipe_id", { ascending: true })
        .order("position", { ascending: true })
        .range(from, to),
    );
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
