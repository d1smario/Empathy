/**
 * Validazione e calcolo PURI per le ricette admin (`nutrition_recipes` +
 * `nutrition_recipe_components`). Nessun import server/Supabase: lo usano la API
 * (POST/PATCH) e il modale (anteprima live), così UI e server rifiutano le STESSE cose
 * che il loader del motore (`mapMenuRecipeRows`) scarterebbe in silenzio.
 *
 * Principio «grammatica di Mario, numeri nostri»: la ricetta NON ha macro proprie; qui
 * si sommano quelle degli ingredienti del catalogo pesate per grams_per_100g.
 */
import { RECIPE_GRAMS_TOLERANCE } from "@/lib/nutrition/v2/menu-recipe-catalog-db";

export const RECIPE_FREQUENCIES = ["COMMON", "ROTATION", "OCCASIONAL"] as const;
export type RecipeFrequency = (typeof RECIPE_FREQUENCIES)[number];
export const RECIPE_FREQUENCY_SET: ReadonlySet<string> = new Set(RECIPE_FREQUENCIES);

/** recipe_key snake_case: stesso pattern di canonical_key del catalogo. */
export const RECIPE_KEY_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

/** Minimo di ingredienti VERI (non neutri): una ricetta di un solo alimento è un alimento. */
export const RECIPE_MIN_REAL_COMPONENTS = 2;

/** Macro per 100 g di un alimento del catalogo (null = valore assente a DB). */
export type FoodMacroPer100g = {
  kcal: number | null;
  carbs: number | null;
  protein: number | null;
  fat: number | null;
};

/** Ciò che il validatore deve sapere di un alimento del catalogo. */
export type RecipeCatalogFood = {
  canonical_key: string;
  fdc_id: number;
  label_it: string;
  is_active: boolean;
  is_meat: boolean;
  is_fish: boolean;
  is_animal_product: boolean;
  macro: FoodMacroPer100g;
};

/** Componente in ingresso (body API o riga del form). */
export type RecipeComponentInput = {
  position?: unknown;
  canonical_key?: unknown;
  label_it?: unknown;
  grams_per_100g?: unknown;
  is_neutral?: unknown;
};

/** Componente normalizzato, pronto per l'INSERT. */
export type RecipeComponentClean = {
  position: number;
  canonical_key: string | null;
  fdc_id: number | null;
  label_it: string;
  grams_per_100g: number;
  is_neutral: boolean;
};

export type RecipeInput = {
  recipe_key?: unknown;
  label_it?: unknown;
  note?: unknown;
  is_active?: unknown;
  frequency?: unknown;
  max_week?: unknown;
  components?: unknown;
};

export type RecipeInputClean = {
  recipe_key: string;
  label_it: string;
  note: string | null;
  is_active: boolean;
  frequency: RecipeFrequency;
  max_week: number | null;
  components: RecipeComponentClean[];
};

export type RecipeValidation =
  | { ok: true; value: RecipeInputClean }
  | { ok: false; error: string };

export type RecipeCatalogLookup = (canonicalKey: string) => RecipeCatalogFood | null | undefined;

function toNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Somma dei grammi dei componenti (neutri compresi: spostano il peso del piatto). */
export function sumRecipeGrams(components: ReadonlyArray<{ grams_per_100g: unknown }>): number {
  return components.reduce((acc, c) => acc + (toNum(c.grams_per_100g) ?? 0), 0);
}

/**
 * Messaggio UMANO sulla somma dei grammi: null se in tolleranza [99, 101], altrimenti
 * dice quanti grammi mancano o avanzano (lo stesso testo serve a UI e API).
 */
export function recipeGramsSumMessage(total: number): string | null {
  if (total >= RECIPE_GRAMS_TOLERANCE.min && total <= RECIPE_GRAMS_TOLERANCE.max) return null;
  const rounded = (n: number) => Number(n.toFixed(2)).toLocaleString("it-IT");
  if (total < RECIPE_GRAMS_TOLERANCE.min) {
    return `la somma dei grammi deve fare 100 g: mancano ${rounded(100 - total)} g (ora ${rounded(total)} g).`;
  }
  return `la somma dei grammi deve fare 100 g: ci sono ${rounded(total - 100)} g di troppo (ora ${rounded(total)} g).`;
}

/**
 * Valida e normalizza SOLO i componenti. Regole (identiche a ciò che il loader scarta,
 * più i vincoli del DB):
 *  - array con almeno RECIPE_MIN_REAL_COMPONENTS componenti non neutri;
 *  - position intera ≥ 1, univoca; se assente si assegna dall'ordine dell'array;
 *  - grams_per_100g numero in (0, 100];
 *  - neutro ⇔ senza canonical_key; non neutro → canonical_key ESISTENTE e ATTIVO nel catalogo;
 *  - somma in [99, 101].
 */
export function validateRecipeComponents(
  raw: unknown,
  lookup: RecipeCatalogLookup,
): { ok: true; value: RecipeComponentClean[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "components deve essere un array non vuoto." };
  }
  const clean: RecipeComponentClean[] = [];
  const positions = new Set<number>();
  let realCount = 0;
  for (let i = 0; i < raw.length; i += 1) {
    const c = (raw[i] ?? {}) as RecipeComponentInput;
    const idx = i + 1;
    const isNeutral = c.is_neutral === true;
    const posRaw = c.position == null || c.position === "" ? idx : toNum(c.position);
    if (posRaw == null || !Number.isInteger(posRaw) || posRaw < 1) {
      return { ok: false, error: `componente #${idx}: position deve essere un intero ≥ 1.` };
    }
    if (positions.has(posRaw)) {
      return { ok: false, error: `componente #${idx}: position ${posRaw} duplicata.` };
    }
    positions.add(posRaw);

    const grams = toNum(c.grams_per_100g);
    if (grams == null || grams <= 0 || grams > 100) {
      return { ok: false, error: `componente #${idx}: grams_per_100g deve essere > 0 e ≤ 100.` };
    }

    const canonicalKey = typeof c.canonical_key === "string" && c.canonical_key.trim() ? c.canonical_key.trim() : null;
    const labelRaw = typeof c.label_it === "string" ? c.label_it.trim() : "";

    if (isNeutral) {
      if (canonicalKey) {
        return { ok: false, error: `componente #${idx}: un componente neutro non può avere un alimento.` };
      }
      clean.push({
        position: posRaw,
        canonical_key: null,
        fdc_id: null,
        label_it: labelRaw || "Acqua / brodo neutro",
        grams_per_100g: grams,
        is_neutral: true,
      });
      continue;
    }

    if (!canonicalKey) {
      return { ok: false, error: `componente #${idx}: manca l'alimento (canonical_key) e non è neutro.` };
    }
    const food = lookup(canonicalKey);
    if (!food) {
      return { ok: false, error: `componente #${idx}: "${canonicalKey}" non esiste nel catalogo menù.` };
    }
    if (!food.is_active) {
      return { ok: false, error: `componente #${idx}: "${canonicalKey}" è disattivato nel catalogo menù.` };
    }
    realCount += 1;
    clean.push({
      position: posRaw,
      canonical_key: canonicalKey,
      // Snapshot dell'fdc_id del catalogo al momento del salvataggio (come la migration dati).
      fdc_id: food.fdc_id,
      label_it: labelRaw || food.label_it,
      grams_per_100g: grams,
      is_neutral: false,
    });
  }

  if (realCount < RECIPE_MIN_REAL_COMPONENTS) {
    return {
      ok: false,
      error: `servono almeno ${RECIPE_MIN_REAL_COMPONENTS} ingredienti del catalogo (i componenti neutri non contano).`,
    };
  }
  const sumMsg = recipeGramsSumMessage(sumRecipeGrams(clean));
  if (sumMsg) return { ok: false, error: sumMsg };

  clean.sort((a, b) => a.position - b.position);
  return { ok: true, value: clean };
}

/** Valida frequency/max_week (usati da POST/PATCH e dal form). */
export function validateRecipeFrequency(
  frequencyRaw: unknown,
  maxWeekRaw: unknown,
): { ok: true; frequency: RecipeFrequency; max_week: number | null } | { ok: false; error: string } {
  const frequency = frequencyRaw == null || frequencyRaw === "" ? "COMMON" : frequencyRaw;
  if (typeof frequency !== "string" || !RECIPE_FREQUENCY_SET.has(frequency)) {
    return { ok: false, error: "frequency non valida (COMMON|ROTATION|OCCASIONAL)." };
  }
  let maxWeek: number | null = null;
  if (maxWeekRaw != null && maxWeekRaw !== "") {
    const n = toNum(maxWeekRaw);
    if (n == null || !Number.isInteger(n) || n < 1 || n > 7) {
      return { ok: false, error: "max_week deve essere un intero fra 1 e 7 (o vuoto)." };
    }
    maxWeek = n;
  }
  return { ok: true, frequency: frequency as RecipeFrequency, max_week: maxWeek };
}

/** Validazione completa del body di POST (ricetta + componenti). */
export function validateRecipeInput(body: RecipeInput, lookup: RecipeCatalogLookup): RecipeValidation {
  const recipeKey = typeof body.recipe_key === "string" ? body.recipe_key.trim() : "";
  if (!recipeKey || !RECIPE_KEY_RE.test(recipeKey)) {
    return { ok: false, error: "recipe_key mancante o non snake_case (minuscole, cifre, underscore)." };
  }
  const labelIt = typeof body.label_it === "string" ? body.label_it.trim() : "";
  if (!labelIt) return { ok: false, error: "label_it mancante." };
  if (body.note != null && typeof body.note !== "string") {
    return { ok: false, error: "note deve essere testo o null." };
  }
  if (body.is_active != null && typeof body.is_active !== "boolean") {
    return { ok: false, error: "is_active deve essere booleano." };
  }
  const freq = validateRecipeFrequency(body.frequency, body.max_week);
  if (!freq.ok) return freq;
  const comps = validateRecipeComponents(body.components, lookup);
  if (!comps.ok) return comps;
  return {
    ok: true,
    value: {
      recipe_key: recipeKey,
      label_it: labelIt,
      note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
      is_active: body.is_active !== false,
      frequency: freq.frequency,
      max_week: freq.max_week,
      components: comps.value,
    },
  };
}

export type RecipeMacroPer100g = {
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  /** canonical_key degli ingredienti senza macro a DB (il totale li conta a zero). */
  missing: string[];
};

/**
 * Macro per 100 g di RICETTA = Σ (macro alimento per 100 g × grams_per_100g / 100).
 * I componenti neutri valgono zero; un alimento senza macro conta zero ed è elencato
 * in `missing` così la UI lo segnala invece di mostrare un numero falso.
 */
export function computeRecipeMacrosPer100g(
  components: ReadonlyArray<{ canonical_key: string | null; grams_per_100g: unknown; is_neutral: boolean }>,
  lookup: (canonicalKey: string) => FoodMacroPer100g | null | undefined,
): RecipeMacroPer100g {
  const out: RecipeMacroPer100g = { kcal: 0, carbs: 0, protein: 0, fat: 0, missing: [] };
  for (const c of components) {
    if (c.is_neutral || !c.canonical_key) continue;
    const grams = toNum(c.grams_per_100g);
    if (grams == null || grams <= 0) continue;
    const m = lookup(c.canonical_key);
    if (!m || m.kcal == null) {
      out.missing.push(c.canonical_key);
      continue;
    }
    const f = grams / 100;
    out.kcal += m.kcal * f;
    out.carbs += (m.carbs ?? 0) * f;
    out.protein += (m.protein ?? 0) * f;
    out.fat += (m.fat ?? 0) * f;
  }
  return out;
}

export type RecipeDietFlags = { is_meat: boolean; is_fish: boolean; is_animal_product: boolean };

/** Flag dieta EREDITATI: basta un ingrediente con il flag perché la ricetta lo abbia. */
export function inheritRecipeDietFlags(
  components: ReadonlyArray<{ canonical_key: string | null; is_neutral: boolean }>,
  lookup: (canonicalKey: string) => RecipeDietFlags | null | undefined,
): RecipeDietFlags {
  const out: RecipeDietFlags = { is_meat: false, is_fish: false, is_animal_product: false };
  for (const c of components) {
    if (c.is_neutral || !c.canonical_key) continue;
    const f = lookup(c.canonical_key);
    if (!f) continue;
    out.is_meat ||= f.is_meat;
    out.is_fish ||= f.is_fish;
    out.is_animal_product ||= f.is_animal_product;
  }
  return out;
}

/** Slug snake_case da un nome (per precompilare recipe_key nel modale). */
export function recipeKeyFromLabel(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 60);
}
