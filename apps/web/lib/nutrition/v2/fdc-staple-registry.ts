/**
 * Registry staple sportivi — allowlist canonica per ruolo assembly V2.
 * Fonte primaria: CANONICAL_FOOD_TABLE + CANONICAL_FOOD_TO_FDC_ID (allineato V1 Mediterranean).
 */

import type { MealPlanV2ServingBasis } from "@empathy/contracts";
import {
  CANONICAL_FOOD_TABLE,
  type CanonicalFoodNutrients,
} from "@/lib/nutrition/canonical-food-composition";
import { fdcIdForCanonicalKey } from "@/lib/nutrition/canonical-food-fdc-aliases";
import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import { isPlausiblePer100gMacros } from "@/lib/nutrition/macro-plausibility";
import {
  ROTATION_MAX_WEEK_USES,
  ROTATION_TARGET_WEEK_USES,
} from "@/lib/nutrition/meal-composition-rules";
import type { MediterraneanDayContext, MediterraneanDietType } from "@/lib/nutrition/mediterranean-meal-composer";
import { isCanonicalKeyUsedToday } from "@/lib/nutrition/meal-rotation-guard";

export type StapleRegistryEntry = {
  canonicalKey: string;
  labelIt: string;
  servingBasis: MealPlanV2ServingBasis;
  /** Chiave rotazione settimanale (es. carb:pasta). */
  rotationKey?: string;
  /** Famiglia carb — no duplicato pranzo+cena stesso giorno. */
  carbFamily?: string;
};

const LABEL_IT: Record<string, string> = {
  oat_dry: "Fiocchi d'avena",
  bread_white: "Pane",
  pasta_dry: "Pasta di semola",
  rice_dry: "Riso",
  potato_cooked: "Patate",
  farro_dry: "Farro",
  quinoa_dry: "Quinoa",
  egg_whole: "Uova",
  yogurt_plain: "Yogurt bianco",
  chicken_breast: "Petto di pollo",
  fish_white: "Salmone",
  beef_lean: "Manzo magro",
  legumes_cooked: "Legumi",
  tofu_firm: "Tofu",
  tempeh: "Tempeh",
  seitan: "Seitan",
  ricotta_cheese: "Ricotta",
  cottage_cheese: "Ricotta magra",
  milk_2pct: "Latte",
  milk_goat: "Latte di capra",
  olive_oil: "Olio EVO",
  almonds_raw: "Mandorle",
  avocado: "Avocado",
  spinach_raw: "Spinaci",
  broccoli_raw: "Broccoli",
  zucchini_raw: "Zucchine",
  mixed_veg: "Insalata mista",
  tomato_raw: "Pomodori",
  carrot_raw: "Carote",
  banana: "Banana",
  apple_raw: "Mela",
  orange_raw: "Arancia",
  blueberries_raw: "Mirtilli",
  mixed_fruit: "Frutta mista",
  cheese_hard: "Grana Padano",
  // --- Espansione pool staple V2 (lug 2026) ---
  bread_whole_wheat: "Pane integrale",
  bread_rye: "Pane di segale",
  rusk_toast: "Fette biscottate",
  corn_flakes: "Corn flakes",
  granola: "Granola",
  rice_cakes: "Gallette di riso",
  bagel_plain: "Bagel",
  pancakes_plain: "Pancake",
  honey: "Miele",
  jam_fruit: "Marmellata",
  yogurt_greek: "Yogurt greco",
  milk_whole: "Latte",
  kefir: "Kefir",
  soymilk: "Latte di soia",
  egg_white: "Albume d'uovo",
  walnuts: "Noci",
  hazelnuts: "Nocciole",
  pistachios: "Pistacchi",
  cashews: "Anacardi",
  peanut_butter: "Burro di arachidi",
  chia_seeds: "Semi di chia",
  flaxseed: "Semi di lino",
  pumpkin_seeds_raw: "Semi di zucca",
  dark_chocolate_70: "Cioccolato fondente",
  pasta_whole: "Pasta integrale",
  rice_brown: "Riso integrale",
  couscous: "Cous cous",
  barley_pearled: "Orzo perlato",
  bulgur: "Bulgur",
  millet: "Miglio",
  cornmeal_polenta: "Polenta (farina di mais)",
  sweet_potato: "Patata dolce",
  turkey_breast: "Petto di tacchino",
  tuna_canned: "Tonno in scatola",
  mackerel_atlantic: "Sgombro",
  sardines: "Sardine",
  shrimp: "Gamberi",
  octopus: "Polpo",
  squid: "Calamari",
  veal_loin: "Vitello magro",
  rabbit: "Coniglio",
  lamb_leg: "Agnello (coscia)",
  pork_loin: "Lonza di maiale",
  cod_raw: "Merluzzo",
  chickpeas_cooked: "Ceci",
  beans_white: "Fagioli cannellini",
  beans_kidney: "Fagioli rossi",
  peas_green: "Piselli",
  edamame: "Edamame",
  mozzarella: "Mozzarella",
  feta: "Feta",
  bell_pepper_red: "Peperoni",
  eggplant: "Melanzane",
  cauliflower: "Cavolfiore",
  green_beans: "Fagiolini",
  mushrooms_white: "Funghi champignon",
  lettuce_romaine: "Lattuga romana",
  arugula_raw: "Rucola",
  asparagus_raw: "Asparagi",
  cucumber: "Cetrioli",
  fennel: "Finocchio",
  kale_raw: "Cavolo riccio",
  onion: "Cipolla",
  leek: "Porro",
  swiss_chard: "Bietole",
  brussels_sprouts: "Cavolini di Bruxelles",
  butternut_squash: "Zucca",
  pear_raw: "Pera",
  kiwi_raw: "Kiwi",
  strawberries_raw: "Fragole",
  raspberries: "Lamponi",
  grapes: "Uva",
  peach: "Pesca",
  apricot: "Albicocche",
  pineapple: "Ananas",
  melon_cantaloupe: "Melone",
  watermelon: "Anguria",
  cherries: "Ciliegie",
  figs: "Fichi",
  dates_medjool: "Datteri",
  tangerine: "Mandarino",
  raisins: "Uvetta",
  hummus: "Hummus",
  ham_cooked: "Prosciutto cotto",
};

function entry(
  canonicalKey: string,
  servingBasis: MealPlanV2ServingBasis,
  opts?: { rotationKey?: string; carbFamily?: string; labelIt?: string },
): StapleRegistryEntry {
  return {
    canonicalKey,
    labelIt: opts?.labelIt ?? LABEL_IT[canonicalKey] ?? canonicalKey.replace(/_/g, " "),
    servingBasis,
    rotationKey: opts?.rotationKey,
    carbFamily: opts?.carbFamily,
  };
}

/**
 * Espansioni condivise pranzo/cena (lug 2026): i nuovi alimenti vanno DOPO gli
 * esistenti — l'ordine è il ranking di preferenza, i classici restano in testa
 * e la rotazione settimanale fa girare il resto.
 */
const MAIN_CARB_EXPANSION = (): StapleRegistryEntry[] => [
  entry("pasta_whole", "dry_grams", { rotationKey: "carb:pasta", carbFamily: "carb_starch" }),
  entry("rice_brown", "cooked_grams", { rotationKey: "carb:riso", carbFamily: "carb_starch" }),
  entry("couscous", "cooked_grams", { rotationKey: "carb:couscous", carbFamily: "carb_starch" }),
  entry("barley_pearled", "cooked_grams", { rotationKey: "carb:orzo", carbFamily: "carb_starch" }),
  entry("bulgur", "cooked_grams", { rotationKey: "carb:bulgur", carbFamily: "carb_starch" }),
  entry("millet", "cooked_grams", { rotationKey: "carb:miglio", carbFamily: "carb_starch" }),
  entry("cornmeal_polenta", "dry_grams", { rotationKey: "carb:polenta", carbFamily: "carb_starch" }),
  entry("sweet_potato", "dry_grams", { rotationKey: "carb:patate", carbFamily: "carb_starch" }),
];

const MAIN_PRO_EXPANSION = (): StapleRegistryEntry[] => [
  entry("turkey_breast", "dry_grams", { rotationKey: "prot:tacchino" }),
  entry("cod_raw", "dry_grams", { rotationKey: "prot:merluzzo" }),
  entry("tuna_canned", "cooked_grams", { rotationKey: "prot:tonno" }),
  entry("mackerel_atlantic", "dry_grams", { rotationKey: "prot:sgombro" }),
  entry("sardines", "cooked_grams", { rotationKey: "prot:sardine" }),
  entry("shrimp", "cooked_grams", { rotationKey: "prot:gamberi" }),
  entry("octopus", "dry_grams", { rotationKey: "prot:polpo" }),
  entry("squid", "dry_grams", { rotationKey: "prot:calamari" }),
  entry("veal_loin", "dry_grams", { rotationKey: "prot:vitello" }),
  entry("rabbit", "dry_grams", { rotationKey: "prot:coniglio" }),
  entry("lamb_leg", "dry_grams", { rotationKey: "prot:agnello" }),
  entry("pork_loin", "dry_grams", { rotationKey: "prot:maiale" }),
  entry("chickpeas_cooked", "cooked_grams", { rotationKey: "prot:ceci" }),
  entry("beans_white", "cooked_grams", { rotationKey: "prot:fagioli" }),
  entry("beans_kidney", "cooked_grams", { rotationKey: "prot:fagioli" }),
  entry("peas_green", "dry_grams", { rotationKey: "prot:piselli" }),
  entry("edamame", "cooked_grams", { rotationKey: "prot:edamame" }),
  entry("mozzarella", "dry_grams", { rotationKey: "prot:mozzarella" }),
  entry("feta", "dry_grams", { rotationKey: "prot:feta" }),
];

const MAIN_VEG_EXPANSION = (): StapleRegistryEntry[] => [
  entry("bell_pepper_red", "dry_grams"),
  entry("eggplant", "dry_grams"),
  entry("cauliflower", "dry_grams"),
  entry("green_beans", "dry_grams"),
  entry("mushrooms_white", "dry_grams"),
  entry("lettuce_romaine", "dry_grams"),
  entry("arugula_raw", "dry_grams"),
  entry("asparagus_raw", "dry_grams"),
  entry("cucumber", "dry_grams"),
  entry("fennel", "dry_grams"),
  entry("kale_raw", "dry_grams"),
  entry("onion", "dry_grams"),
  entry("leek", "dry_grams"),
  entry("swiss_chard", "dry_grams"),
  entry("brussels_sprouts", "dry_grams"),
  entry("butternut_squash", "dry_grams"),
];

/** Allowlist ordinata per poolKey — mirror CARB_ORDER / stapleProt V1. */
export const STAPLE_ALLOWLIST_BY_POOL: Record<string, StapleRegistryEntry[]> = {
  breakfast_cho: [
    entry("oat_dry", "dry_grams", { rotationKey: "breakfast:oat" }),
    entry("bread_white", "dry_grams", { rotationKey: "breakfast:bread" }),
    entry("crackers_whole", "dry_grams", { rotationKey: "breakfast:crackers" }),
    entry("bread_whole_wheat", "dry_grams", { rotationKey: "breakfast:bread" }),
    entry("bread_rye", "dry_grams", { rotationKey: "breakfast:bread" }),
    entry("rusk_toast", "dry_grams", { rotationKey: "breakfast:fette" }),
    entry("corn_flakes", "dry_grams", { rotationKey: "breakfast:cereali" }),
    entry("granola", "dry_grams", { rotationKey: "breakfast:granola" }),
    entry("rice_cakes", "dry_grams", { rotationKey: "breakfast:gallette" }),
    entry("bagel_plain", "dry_grams", { rotationKey: "breakfast:bagel" }),
    entry("pancakes_plain", "dry_grams", { rotationKey: "breakfast:pancake" }),
    // honey/jam_fruit RIMOSSI dal pool primario: sono CONDIMENTI, non fonti carbo —
    // con la rotazione per data vincevano il ruolo cho («Miele 85g» come tutta la
    // quota carbo della colazione). Alias/label restano per usi futuri da topping.
  ],
  breakfast_pro: [
    entry("yogurt_plain", "dry_grams", { rotationKey: "breakfast:yogurt" }),
    entry("egg_whole", "dry_grams", { rotationKey: "breakfast:egg" }),
    entry("ricotta_cheese", "dry_grams"),
    entry("cottage_cheese", "dry_grams"),
    entry("yogurt_greek", "dry_grams", { rotationKey: "breakfast:yogurt" }),
    entry("milk_whole", "ml", { rotationKey: "breakfast:latte" }),
    entry("kefir", "ml", { rotationKey: "breakfast:kefir" }),
    entry("soymilk", "ml", { rotationKey: "breakfast:latte" }),
    entry("egg_white", "dry_grams", { rotationKey: "breakfast:egg" }),
  ],
  breakfast_fat: [
    entry("almonds_raw", "dry_grams"),
    entry("olive_oil", "ml"),
    entry("avocado", "dry_grams"),
    entry("walnuts", "dry_grams"),
    entry("hazelnuts", "dry_grams"),
    entry("pistachios", "dry_grams"),
    entry("cashews", "dry_grams"),
    entry("peanut_butter", "dry_grams"),
    entry("chia_seeds", "dry_grams"),
    entry("flaxseed", "dry_grams"),
    entry("pumpkin_seeds_raw", "dry_grams"),
    entry("dark_chocolate_70", "dry_grams"),
  ],
  lunch_carb: [
    entry("pasta_dry", "dry_grams", { rotationKey: "carb:pasta", carbFamily: "carb_starch" }),
    entry("rice_dry", "dry_grams", { rotationKey: "carb:riso", carbFamily: "carb_starch" }),
    entry("potato_cooked", "cooked_grams", { rotationKey: "carb:patate", carbFamily: "carb_starch" }),
    entry("farro_dry", "dry_grams", { rotationKey: "carb:farro", carbFamily: "carb_starch" }),
    entry("quinoa_dry", "dry_grams", { rotationKey: "carb:quinoa", carbFamily: "carb_starch" }),
    ...MAIN_CARB_EXPANSION(),
  ],
  dinner_carb: [
    entry("rice_dry", "dry_grams", { rotationKey: "carb:riso", carbFamily: "carb_starch" }),
    entry("pasta_dry", "dry_grams", { rotationKey: "carb:pasta", carbFamily: "carb_starch" }),
    entry("potato_cooked", "cooked_grams", { rotationKey: "carb:patate", carbFamily: "carb_starch" }),
    entry("farro_dry", "dry_grams", { rotationKey: "carb:farro", carbFamily: "carb_starch" }),
    entry("quinoa_dry", "dry_grams", { rotationKey: "carb:quinoa", carbFamily: "carb_starch" }),
    ...MAIN_CARB_EXPANSION(),
  ],
  lunch_pro: [
    entry("chicken_breast", "dry_grams", { rotationKey: "prot:pollo" }),
    entry("fish_white", "dry_grams", { rotationKey: "prot:pesce" }),
    entry("beef_lean", "dry_grams", { rotationKey: "prot:manzo" }),
    entry("legumes_cooked", "cooked_grams", { rotationKey: "prot:legumi" }),
    entry("egg_whole", "dry_grams"),
    entry("tofu_firm", "dry_grams"),
    ...MAIN_PRO_EXPANSION(),
  ],
  dinner_pro: [
    entry("fish_white", "dry_grams", { rotationKey: "prot:pesce" }),
    entry("chicken_breast", "dry_grams", { rotationKey: "prot:pollo" }),
    entry("beef_lean", "dry_grams", { rotationKey: "prot:manzo" }),
    entry("legumes_cooked", "cooked_grams", { rotationKey: "prot:legumi" }),
    entry("tofu_firm", "dry_grams"),
    entry("tempeh", "dry_grams"),
    ...MAIN_PRO_EXPANSION(),
  ],
  lunch_veg: [
    entry("mixed_veg", "dry_grams"),
    entry("spinach_raw", "dry_grams"),
    entry("broccoli_raw", "dry_grams"),
    entry("zucchini_raw", "dry_grams"),
    entry("tomato_raw", "dry_grams"),
    ...MAIN_VEG_EXPANSION(),
  ],
  dinner_veg: [
    entry("spinach_raw", "dry_grams"),
    entry("broccoli_raw", "dry_grams"),
    entry("zucchini_raw", "dry_grams"),
    entry("mixed_veg", "dry_grams"),
    entry("carrot_raw", "dry_grams"),
    ...MAIN_VEG_EXPANSION(),
  ],
  snack_cho: [
    entry("banana", "dry_grams"),
    entry("apple_raw", "dry_grams"),
    entry("orange_raw", "dry_grams"),
    entry("blueberries_raw", "dry_grams"),
    entry("mixed_fruit", "dry_grams"),
    entry("pear_raw", "dry_grams"),
    entry("kiwi_raw", "dry_grams"),
    entry("strawberries_raw", "dry_grams"),
    entry("raspberries", "dry_grams"),
    entry("grapes", "dry_grams"),
    entry("peach", "dry_grams"),
    entry("apricot", "dry_grams"),
    entry("pineapple", "dry_grams"),
    entry("melon_cantaloupe", "dry_grams"),
    entry("watermelon", "dry_grams"),
    entry("cherries", "dry_grams"),
    entry("figs", "dry_grams"),
    entry("dates_medjool", "dry_grams"),
    entry("tangerine", "dry_grams"),
    entry("raisins", "dry_grams"),
  ],
  snack_pro: [
    entry("yogurt_plain", "dry_grams"),
    entry("cottage_cheese", "dry_grams"),
    entry("almonds_raw", "dry_grams"),
    entry("egg_whole", "dry_grams"),
    entry("yogurt_greek", "dry_grams"),
    entry("cheese_hard", "dry_grams"),
    entry("mozzarella", "dry_grams"),
    entry("hummus", "dry_grams"),
    entry("ham_cooked", "dry_grams"),
  ],
};

/** Carni (incl. salumi): escluse per pescatarian, vegetarian e vegan. */
const MEAT_KEYS = [
  "chicken_breast",
  "beef_lean",
  "turkey_breast",
  "veal_loin",
  "rabbit",
  "lamb_leg",
  "pork_loin",
  "ham_cooked",
  "deli_lean",
];

/** Pesci, molluschi e crostacei: esclusi per vegetarian e vegan. */
const FISH_KEYS = [
  "fish_white",
  "cod_raw",
  "tuna_canned",
  "mackerel_atlantic",
  "sardines",
  "shrimp",
  "octopus",
  "squid",
];

/** Latticini, uova e miele: esclusi solo per vegan. */
const ANIMAL_PRODUCT_KEYS = [
  "egg_whole",
  "egg_white",
  "yogurt_plain",
  "yogurt_greek",
  "kefir",
  "milk_whole",
  "milk_2pct",
  "milk_goat",
  "ricotta_cheese",
  "cottage_cheese",
  "cheese_hard",
  "mozzarella",
  "feta",
  "honey",
  // Compositi a base cereali con ingredienti animali nella ricetta USDA
  // (uova/latte/miele): non sono «cibi animali» ma per un vegan non vanno proposti.
  "pancakes_plain",
  "rusk_toast",
  "granola",
];

function filterByDiet(entries: StapleRegistryEntry[], dietType?: MediterraneanDietType): StapleRegistryEntry[] {
  if (dietType === "pescatarian") {
    return entries.filter((e) => !MEAT_KEYS.includes(e.canonicalKey));
  }
  if (dietType === "vegetarian") {
    return entries.filter((e) => !MEAT_KEYS.includes(e.canonicalKey) && !FISH_KEYS.includes(e.canonicalKey));
  }
  if (dietType === "vegan") {
    return entries.filter(
      (e) =>
        !MEAT_KEYS.includes(e.canonicalKey) &&
        !FISH_KEYS.includes(e.canonicalKey) &&
        !ANIMAL_PRODUCT_KEYS.includes(e.canonicalKey),
    );
  }
  return entries;
}

function canonicalToHit(entry: StapleRegistryEntry): FdcFoodBrowseHit | null {
  const row: CanonicalFoodNutrients | undefined = CANONICAL_FOOD_TABLE[entry.canonicalKey];
  if (!row?.kcalPer100g) return null;
  const fdcId = fdcIdForCanonicalKey(entry.canonicalKey) ?? 0;
  if (
    !isPlausiblePer100gMacros({
      kcal_100: row.kcalPer100g,
      carbs_100: row.carbsG,
      protein_100: row.proteinG,
      fat_100: row.fatG,
    })
  ) {
    return null;
  }
  return {
    fdcId,
    description: entry.labelIt,
    kcalPer100g: row.kcalPer100g,
    proteinPer100g: row.proteinG,
    carbsPer100g: row.carbsG,
    fatPer100g: row.fatG,
    tags: {
      mealCourse: [],
      foodFamily: [],
      macroDominant: [],
      slotFit: [],
      dietProfile: ["omnivore"],
      dietExclude: [],
      mealRole: [],
      aminoProfile: [],
      nutrientDensity: [],
      classifierVersion: "staple_registry",
    },
    tagSource: "db",
  };
}

export type StaplePickContext = {
  poolKey: string;
  seed: number;
  dietType?: MediterraneanDietType;
  denyFragments?: string[];
  dayCtx?: Pick<MediterraneanDayContext, "weekStapleCounts" | "dayUsedCanonicalKeys">;
  usedCarbFamilies?: Set<string>;
  usedFdcIds?: Set<number>;
};

function denyHit(key: string, denyFragments: string[]): boolean {
  const d = key.toLowerCase();
  return denyFragments.some((f) => f && d.includes(f.toLowerCase()));
}

export function pickStapleForPool(ctx: StaplePickContext): { entry: StapleRegistryEntry; hit: FdcFoodBrowseHit } | null {
  const raw = STAPLE_ALLOWLIST_BY_POOL[ctx.poolKey] ?? [];
  const entries = filterByDiet(raw, ctx.dietType);
  const deny = ctx.denyFragments ?? [];

  // Rotazione vera per (atleta, data): il seed sposta l'ORDINE di preferenza del pool,
  // così a contatori settimanali vuoti giorni diversi partono da indici diversi.
  // Le penalità settimanali restano e dominano la rotazione.
  const poolSize = entries.length;
  const dayOffset = poolSize > 0 ? ((Math.floor(Math.abs(ctx.seed)) % poolSize) + poolSize) % poolSize : 0;

  const scored = entries
    .map((e, idx) => {
      if (denyHit(e.labelIt, deny) || denyHit(e.canonicalKey, deny)) return { e, score: -10_000, idx };
      const weekCount = weekStapleCountForEntry(e, ctx.dayCtx?.weekStapleCounts);
      if (weekCount >= ROTATION_MAX_WEEK_USES) return { e, score: -5000, idx };
      if (ctx.dayCtx && isCanonicalKeyUsedToday(ctx.dayCtx as MediterraneanDayContext, e.canonicalKey)) {
        return { e, score: -5000, idx };
      }
      if (e.rotationKey && ctx.usedCarbFamilies?.has(e.rotationKey)) return { e, score: -3000, idx };
      else if (!e.rotationKey && e.carbFamily && ctx.usedCarbFamilies?.has(e.carbFamily)) {
        return { e, score: -3000, idx };
      }
      const hit = canonicalToHit(e);
      if (!hit) return { e, score: -8000, idx };
      if (ctx.usedFdcIds?.has(hit.fdcId) && hit.fdcId > 0) return { e, score: -4000, idx };
      let score = 1000 - ((idx + poolSize - dayOffset) % poolSize) * 10;
      if (weekCount >= ROTATION_TARGET_WEEK_USES) score -= 120;
      else if (weekCount > 0) score -= weekCount * 80;
      return { e, score, idx, hit };
    })
    .filter((x) => x.score > 0 && "hit" in x && x.hit)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || !("hit" in best) || !best.hit) return null;
  return { entry: best.e, hit: best.hit as FdcFoodBrowseHit };
}

export function rotationKeyForCanonical(canonicalKey: string): string | undefined {
  for (const list of Object.values(STAPLE_ALLOWLIST_BY_POOL)) {
    const found = list.find((e) => e.canonicalKey === canonicalKey);
    if (found?.rotationKey) return found.rotationKey;
  }
  return undefined;
}

/** Conteggio settimanale: accetta chiavi rotation (`carb:pasta`) o canonical (`pasta_dry`). */
export function weekStapleCountForEntry(
  entry: Pick<StapleRegistryEntry, "canonicalKey" | "rotationKey">,
  week?: Record<string, number>,
): number {
  if (!week) return 0;
  return Math.max(
    week[entry.canonicalKey] ?? 0,
    entry.rotationKey ? week[entry.rotationKey] ?? 0 : 0,
  );
}

export function mealRotationStaplesFromComposedItems(
  items: Array<{ canonicalKey?: string | null }>,
): string[] {
  const keys = new Set<string>();
  for (const item of items) {
    const ck = item.canonicalKey?.trim();
    if (!ck) continue;
    const rk = rotationKeyForCanonical(ck);
    keys.add(rk ?? ck);
  }
  return [...keys].slice(0, 24);
}

export function stapleRegistryKeysForPool(poolKey: string): string[] {
  return (STAPLE_ALLOWLIST_BY_POOL[poolKey] ?? []).map((e) => e.canonicalKey);
}

export function labelItForStaple(canonicalKey: string): string {
  return LABEL_IT[canonicalKey] ?? canonicalKey.replace(/_/g, " ");
}

export function servingBasisForCanonical(canonicalKey: string): MealPlanV2ServingBasis {
  for (const list of Object.values(STAPLE_ALLOWLIST_BY_POOL)) {
    const found = list.find((e) => e.canonicalKey === canonicalKey);
    if (found) return found.servingBasis;
  }
  if (/_cooked$/.test(canonicalKey)) return "cooked_grams";
  if (/oil|milk|drink/.test(canonicalKey)) return "ml";
  return "dry_grams";
}
