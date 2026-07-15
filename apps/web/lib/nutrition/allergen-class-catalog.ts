import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Catalogo CLASSI allergeniche/intolleranze — esclude intere FAMIGLIE di cibi dal
 * meal-plan riusando i due meccanismi già esistenti degli incrementi precedenti:
 *   - `excludedFdcIds`  → risolti da `nutrition_fdc_food_tags` (family/diet_exclude) e
 *                          usati dal filtro opzioni per fdcId (1b, meal-plan-profile-food-filter).
 *   - `foodExclusions`  → i `denyFragments` bilingui confluiscono nel deny testuale
 *                          (1c, buildMealPlanFoodDenyFragments → composizione/arricchimento).
 *
 * FONTE DATI (unica autorevole): tabella `nutrition_fdc_food_tags` keyed `fdc_id`, con
 * array `food_family` (valori IT: latticino, pesce, oleaginoso, uova, legume, cereale,
 * pane, pasta_riso, carne, frutta, verdura, tuberi, olio, bevanda_vegetale) e
 * `diet_exclude` (gluten, lactose, grain, legume, nightshade, high_histamine, animal).
 * NB: `fdc_food.food_category` è grossolana e `nutrition_fdc_foods.food_category` è ROTTA
 * ("[object Object]") → NON usarle. Solo `nutrition_fdc_food_tags`.
 *
 * Additivo/retro-compat: nessuna classe selezionata → set vuoto → comportamento invariato.
 */
export type AllergenClass = {
  /** Chiave stabile salvata in `nutrition_config.excluded_food_classes` (string[]). */
  key: string;
  labelIt: string;
  labelEn: string;
  /** Valori `nutrition_fdc_food_tags.food_family` da escludere per intero. */
  foodFamily: string[];
  /** Valori `nutrition_fdc_food_tags.diet_exclude` da escludere per intero. */
  dietExclude: string[];
  /** Sottostringhe BILINGUI IT+EN (lowercase) per il deny testuale su label/rationale. */
  denyFragments: string[];
};

export const ALLERGEN_CLASS_CATALOG: AllergenClass[] = [
  {
    key: "glutine",
    labelIt: "Glutine",
    labelEn: "Gluten",
    foodFamily: [],
    dietExclude: ["gluten"],
    denyFragments: [
      "glutine", "gluten", "frumento", "wheat", "grano", "orzo", "barley", "segale", "rye",
      "farro", "spelt", "kamut", "triticale", "semola", "couscous", "cous cous", "bulgur",
      "seitan", "malto", "malt",
    ],
  },
  {
    key: "latticini",
    labelIt: "Latticini",
    labelEn: "Dairy",
    foodFamily: ["latticino"],
    dietExclude: ["lactose"],
    denyFragments: [
      "latte", "latticino", "formaggio", "cheese", "yogurt", "yoghurt", "burro", "butter",
      "panna", "cream", "milk", "dairy", "lactose", "lattosio", "ricotta", "mozzarella",
      "parmigiano", "pecorino", "mascarpone", "whey", "siero", "kefir", "cottage", "casein",
      "caseina",
    ],
  },
  {
    key: "uova",
    labelIt: "Uova",
    labelEn: "Eggs",
    foodFamily: ["uova"],
    dietExclude: [],
    denyFragments: [
      "uovo", "uova", "ovo", "albume", "album", "egg", "tuorlo", "frittata", "omelette",
      "maionese", "mayo", "mayonnaise",
    ],
  },
  {
    key: "pesce",
    labelIt: "Pesce",
    labelEn: "Fish",
    foodFamily: ["pesce"],
    dietExclude: [],
    denyFragments: [
      "pesce", "fish", "tonno", "tuna", "salmone", "salmon", "merluzz", "cod", "sgombro",
      "mackerel", "acciug", "anchovy", "sardin", "trota", "trout", "branzino", "orata",
      "spigola", "aringa", "herring", "nasello", "platessa",
    ],
  },
  {
    key: "fruttaGuscio",
    labelIt: "Frutta a guscio",
    labelEn: "Tree nuts",
    foodFamily: ["oleaginoso"],
    dietExclude: [],
    denyFragments: [
      "noci", "noce", "nocciol", "mandorl", "anacard", "pistacch", "pinol", "macadamia",
      "pecan", "nut", "almond", "hazelnut", "cashew", "walnut", "pistachio", "brazil nut",
    ],
  },
  {
    key: "legumi",
    labelIt: "Legumi",
    labelEn: "Legumes",
    foodFamily: ["legume"],
    dietExclude: ["legume"],
    denyFragments: [
      "legum", "fagiol", "bean", "lenticchi", "lentil", "ceci", "chickpea", "pisell", "pea",
      "soia", "soy", "soja", "tofu", "edamame", "fava", "fave", "lupin", "arachid", "peanut",
    ],
  },
  {
    key: "solanacee",
    labelIt: "Solanacee",
    labelEn: "Nightshades",
    foodFamily: [],
    dietExclude: ["nightshade"],
    denyFragments: [
      "solanace", "nightshade", "pomodor", "tomato", "melanzan", "eggplant", "aubergine",
      "peperon", "peperoncin", "chili", "chilli", "paprika", "cayenn", "patata", "potato",
    ],
  },
  {
    key: "istamina",
    labelIt: "Istamina",
    labelEn: "Histamine",
    foodFamily: [],
    dietExclude: ["high_histamine"],
    denyFragments: [
      "istamina", "histamine", "fermentat", "fermented", "stagionat", "aged", "cured",
    ],
  },
];

const CLASS_BY_KEY: Map<string, AllergenClass> = new Map(
  ALLERGEN_CLASS_CATALOG.map((c) => [c.key, c]),
);

/** Ritorna la classe per key (o undefined). */
export function findAllergenClass(key: string): AllergenClass | undefined {
  return CLASS_BY_KEY.get(key);
}

/**
 * Legge/normalizza `nutrition_config.excluded_food_classes` (string[] di key) in modo
 * difensivo: tollera valore mancante / JSON malformato / chiavi sconosciute, tiene solo le
 * key presenti nel catalogo e deduplica. Con input assente/vuoto → `[]` (nessun effetto).
 */
export function parseExcludedFoodClasses(value: unknown): string[] {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>).excluded_food_classes
      : value;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const key = typeof item === "string" ? item.trim() : "";
    if (!key || seen.has(key) || !CLASS_BY_KEY.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/**
 * Legge le classi escluse da un `nutrition_config` (o dal suo campo). Alias esplicito di
 * {@link parseExcludedFoodClasses} per il path server, parallelo a `readExcludedFdcIds`.
 */
export function readExcludedFoodClasses(nutritionConfig: unknown): string[] {
  return parseExcludedFoodClasses(nutritionConfig);
}

/** Unione dedup di family + diet_exclude tag dalle classi selezionate (helper puro). */
export function collectClassFamiliesAndTags(
  classKeys: string[] | null | undefined,
): { families: string[]; tags: string[] } {
  const families = new Set<string>();
  const tags = new Set<string>();
  for (const key of parseExcludedFoodClasses(classKeys ?? [])) {
    const cls = CLASS_BY_KEY.get(key);
    if (!cls) continue;
    for (const f of cls.foodFamily) families.add(f);
    for (const t of cls.dietExclude) tags.add(t);
  }
  return { families: [...families], tags: [...tags] };
}

/** Sottostringhe deny bilingui (lowercase) dalle classi selezionate (helper puro). */
export function classDenyFragments(classKeys: string[] | null | undefined): string[] {
  const out = new Set<string>();
  for (const key of parseExcludedFoodClasses(classKeys ?? [])) {
    const cls = CLASS_BY_KEY.get(key);
    if (!cls) continue;
    for (const f of cls.denyFragments) {
      const s = f.trim().toLowerCase();
      if (s.length >= 2) out.add(s);
    }
  }
  return [...out];
}

function pgArrayLiteral(values: string[]): string {
  // Valori del catalogo (statici, [a-z_]) → nessun escaping necessario.
  return `{${values.join(",")}}`;
}

/**
 * RISOLUZIONE SERVER: dai classKeys → family+diet_exclude dal catalogo → UNA query
 * (paginata) su `nutrition_fdc_food_tags` con overlap array
 * `food_family && <families> OR diet_exclude && <tags>` → array `fdc_id` dedup.
 *
 * Paginazione: alcune classi superano il cap PostgREST di 1000 righe (es. `gluten` ≈ 1004),
 * quindi si scorre a range fino a esaurire i risultati. Con nessuna classe (o solo classi
 * senza family/tag) → `[]` (nessuna query, nessun effetto).
 */
export async function resolveExcludedFdcIdsFromClasses(
  db: SupabaseClient,
  classKeys: string[] | null | undefined,
): Promise<number[]> {
  const { families, tags } = collectClassFamiliesAndTags(classKeys);
  if (families.length === 0 && tags.length === 0) return [];

  const orParts: string[] = [];
  if (families.length) orParts.push(`food_family.ov.${pgArrayLiteral(families)}`);
  if (tags.length) orParts.push(`diet_exclude.ov.${pgArrayLiteral(tags)}`);
  const orFilter = orParts.join(",");

  const pageSize = 1000;
  const seen = new Set<number>();
  const out: number[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("nutrition_fdc_food_tags")
      .select("fdc_id")
      .or(orFilter)
      .range(from, from + pageSize - 1);
    if (error || !Array.isArray(data) || data.length === 0) break;
    for (const r of data) {
      const id = Number((r as Record<string, unknown>).fdc_id);
      if (!Number.isFinite(id) || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    if (data.length < pageSize) break;
  }
  return out;
}
