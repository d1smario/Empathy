import assert from "node:assert/strict";
import test from "node:test";
import type { DailyNutritionRequirementsV2, MealPlanV2DietSlotBudget } from "@empathy/contracts";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import { composeMealPlanV2, type FdcPoolMap } from "@/lib/nutrition/v2/compose-meal-plan-v2";
import {
  buildMenuFoodFiberFermentedIndex,
  type MenuFoodEntry,
  type MenuFoodPoolMap,
} from "@/lib/nutrition/v2/menu-food-catalog-db";
import {
  MENU_FOOD_HIGH_FIBER_THRESHOLD_AS_EATEN_G,
  MENU_FOOD_HIGH_FIBER_THRESHOLD_DRY_G,
} from "@/lib/nutrition/v2/menu-food-fiber-fermented";
import {
  isPreEffortExcludedFood,
  isPreEffortIntenseDay,
  preEffortSlotsFromTimes,
} from "@/lib/nutrition/v2/pre-effort-food-filter";

/**
 * REGOLA 2 di Mario, parte motore: nei giorni di CARICO INTENSO e di GARA i pasti che
 * cadono prima dello sforzo non devono contenere fermentati né alimenti ricchi di fibre
 * (restano cereali classici, latte e bevande vegetali).
 *
 * Alimenti, fdcId e fibre sono quelli VERI di `nutrition_menu_foods` + `nutrition_fdc_foods`
 * (prod ggmpegwnzbrjkeiydwqu, letti il 2026-09-08).
 */

type Fixture = {
  canonicalKey: string;
  labelIt: string;
  fdcId: number;
  poolKeys: string[];
  kcal: number;
  cho: number;
  pro: number;
  fat: number;
  /** `nutrition_menu_foods.is_fermented` */
  isFermented?: boolean;
  /** `nutrition_menu_foods.is_wholegrain` */
  isWholegrain?: boolean;
  /** `nutrition_menu_foods.serving_basis` (la base su cui la fibra è misurata) */
  servingBasis?: "dry_grams" | "cooked_grams" | "ml";
  /** `nutrition_fdc_foods.fiber_100g` (null = ignota nel catalogo prod) */
  fiberPer100g?: number | null;
};

const CATALOG: Fixture[] = [
  // breakfast_cho — integrali/crusche (fibra alta) vs cereali classici.
  { canonicalKey: "oat_dry", labelIt: "Fiocchi d'avena", fdcId: 169705, poolKeys: ["breakfast_cho"],
    kcal: 389, cho: 68.2, pro: 16.9, fat: 6.9, isFermented: false, fiberPer100g: 9.4 },
  { canonicalKey: "bread_whole_wheat", labelIt: "Pane integrale", fdcId: 172686, poolKeys: ["breakfast_cho"],
    kcal: 254, cho: 51.4, pro: 12.3, fat: 3.5, isFermented: false, fiberPer100g: 6.0 },
  { canonicalKey: "muesli", labelIt: "Muesli", fdcId: 173003, poolKeys: ["breakfast_cho"],
    kcal: 340, cho: 60.9, pro: 9.7, fat: 5.9, isFermented: false, fiberPer100g: 9.8 },
  // Farro soffiato: 3,9 g di fibra SOTTO la soglia del secco. Lo prende solo la colonna
  // `is_wholegrain` — è il caso che il proxy sulla fibra lasciava passare.
  { canonicalKey: "farro_puffed", labelIt: "Farro soffiato", fdcId: 168917, poolKeys: ["breakfast_cho"],
    kcal: 340, cho: 26.4, pro: 14.6, fat: 2.4, isFermented: false, isWholegrain: true, fiberPer100g: 3.9 },
  { canonicalKey: "corn_flakes", labelIt: "Corn flakes", fdcId: 173029, poolKeys: ["breakfast_cho"],
    kcal: 357, cho: 88.0, pro: 7.5, fat: 0.4, isFermented: false, fiberPer100g: 2.7 },
  { canonicalKey: "puffed_rice", labelIt: "Riso soffiato", fdcId: 173032, poolKeys: ["breakfast_cho"],
    kcal: 392, cho: 89.8, pro: 6.3, fat: 1.4, isFermented: false, fiberPer100g: 1.7 },
  { canonicalKey: "rusk_toast", labelIt: "Fette biscottate", fdcId: 174928, poolKeys: ["breakfast_cho"],
    kcal: 407, cho: 72.3, pro: 13.5, fat: 7.0, isFermented: false, fiberPer100g: null },
  // breakfast_pro — fermentati vs latte/uova.
  { canonicalKey: "yogurt_greek", labelIt: "Yogurt greco", fdcId: 170903, poolKeys: ["breakfast_pro"],
    kcal: 97, cho: 3.9, pro: 9.0, fat: 5.0, isFermented: true, fiberPer100g: 0 },
  { canonicalKey: "kefir", labelIt: "Kefir", fdcId: 2259793, poolKeys: ["breakfast_pro"],
    kcal: 63, cho: 4.5, pro: 3.8, fat: 3.3, isFermented: true, fiberPer100g: 0 },
  { canonicalKey: "milk_semi_skimmed", labelIt: "Latte parzialmente scremato", fdcId: 746773,
    poolKeys: ["breakfast_pro"], kcal: 50, cho: 4.8, pro: 3.3, fat: 2.0, isFermented: false, fiberPer100g: null },
  { canonicalKey: "egg_whole", labelIt: "Uova", fdcId: 172183, poolKeys: ["breakfast_pro"],
    kcal: 143, cho: 0.7, pro: 12.6, fat: 9.5, isFermented: false, fiberPer100g: 0 },
  // breakfast_fat — un grasso sicuro (nessun fermentato, fibra bassa).
  { canonicalKey: "olive_oil", labelIt: "Olio extravergine d'oliva", fdcId: 171413,
    poolKeys: ["breakfast_fat"], kcal: 884, cho: 0, pro: 0, fat: 100, isFermented: false, fiberPer100g: 0 },
];

/**
 * I campi del contratto (`is_fermented` sul catalogo, fibra da `fdc_food.fiber_100g`)
 * arrivano al compositore insieme al candidato: qui sono montati sull'entry come li
 * consegna il loader del catalogo.
 */
function buildPools(withFacts: boolean): MenuFoodPoolMap {
  const pools: MenuFoodPoolMap = new Map();
  for (const f of CATALOG) {
    const entry = {
      canonicalKey: f.canonicalKey,
      labelIt: f.labelIt,
      servingBasis: f.servingBasis ?? "dry_grams",
      fdcId: f.fdcId,
      kcalPer100g: f.kcal,
      carbsPer100g: f.cho,
      proteinPer100g: f.pro,
      fatPer100g: f.fat,
      isMeat: false,
      isFish: false,
      isAnimalProduct: ["yogurt_greek", "kefir", "milk_semi_skimmed", "egg_whole"].includes(f.canonicalKey),
      ...(withFacts
        ? {
            isFermented: f.isFermented ?? false,
            isWholegrain: f.isWholegrain ?? false,
            fiberPer100g: f.fiberPer100g ?? null,
          }
        : {}),
    } as unknown as MenuFoodEntry;
    for (const key of f.poolKeys) {
      pools.set(key, [...(pools.get(key) ?? []), entry]);
    }
  }
  return pools;
}

/** Giornata PESANTE di Mario: ratio (bmr+lifestyle+training)/bmr = (1700+600+2600)/1700 ≈ 2.9. */
const REQUIREMENTS_INTENSO = {
  energy: { bmrKcal: 1700, lifestyleKcal: 600, trainingKcal: 2600, mealsKcal: 3800 },
} as DailyNutritionRequirementsV2;

/** Giornata normale (recupero): nessuna seduta → ratio ≈ 1.35. */
const REQUIREMENTS_NORMALE = {
  energy: { bmrKcal: 1700, lifestyleKcal: 600, trainingKcal: 0, mealsKcal: 2200 },
} as DailyNutritionRequirementsV2;

const breakfast: MealPlanV2DietSlotBudget = {
  key: "breakfast",
  label: "Colazione",
  pct: 25,
  kcal: 700,
  carbs: 100,
  protein: 30,
  fat: 18,
};

/** Una settimana: la rotazione (seed atleta+data) deve girare su tutto il pool. */
const PLAN_DATES = Array.from({ length: 7 }, (_, i) => `2026-09-${String(7 + i).padStart(2, "0")}`);

function request(planDate: string): IntelligentMealPlanRequest {
  return {
    athleteId: "04968274-b796-4dd7-a992-69994d516c61",
    planDate,
    dietType: "omnivore",
    allergies: [],
    intolerances: [],
    foodExclusions: null,
    slots: [
      { slot: "breakfast", labelIt: "Colazione", scheduledTimeLocal: "08:00" },
      { slot: "lunch", labelIt: "Pranzo", scheduledTimeLocal: "13:00" },
      { slot: "dinner", labelIt: "Cena", scheduledTimeLocal: "20:00" },
    ],
  } as unknown as IntelligentMealPlanRequest;
}

/** Etichette servite a colazione nella settimana, come le vedrebbe l'atleta. */
function breakfastLabels(opts: {
  requirements: DailyNutritionRequirementsV2;
  trainingStartMinutes: number | null;
  withFacts?: boolean;
}): string[] {
  const menuFoodPools = buildPools(opts.withFacts ?? true);
  const out: string[] = [];
  for (const planDate of PLAN_DATES) {
    const req = request(planDate);
    const composed = composeMealPlanV2(opts.requirements, [breakfast], new Map() as FdcPoolMap, {
      request: req,
      menuFoodPools,
      trainingStartMinutes: opts.trainingStartMinutes,
    });
    for (const item of composed[0]!.items) out.push(item.description);
  }
  return out;
}

const FERMENTATI = ["Yogurt greco", "Kefir"];
const INTEGRALI = ["Fiocchi d'avena", "Pane integrale", "Muesli", "Farro soffiato"];
const CLASSICI = ["Corn flakes", "Riso soffiato", "Fette biscottate"];

test("giorno intenso + seduta alle 7:00: colazione senza fermentati né integrali", () => {
  // 07:00 = 420 min; colazione alle 08:00 è DOPO l'inizio? no: la seduta è alle 7, la
  // colazione delle 8 non è pre-sforzo. Qui l'atleta si alza prima: colazione 06:30.
  const menuFoodPools = buildPools(true);
  const served: string[] = [];
  const perGiorno: string[][] = [];
  for (const planDate of PLAN_DATES) {
    const req = {
      ...request(planDate),
      slots: [
        { slot: "breakfast", labelIt: "Colazione", scheduledTimeLocal: "06:30" },
        { slot: "lunch", labelIt: "Pranzo", scheduledTimeLocal: "13:00" },
      ],
    } as unknown as IntelligentMealPlanRequest;
    const composed = composeMealPlanV2(REQUIREMENTS_INTENSO, [breakfast], new Map() as FdcPoolMap, {
      request: req,
      menuFoodPools,
      trainingStartMinutes: 7 * 60,
    });
    perGiorno.push(composed[0]!.items.map((i) => i.description));
    for (const item of composed[0]!.items) served.push(item.description);
  }
  assert.ok(served.length > 0, "la colazione deve comunque essere composta");
  // Punto 4: togliere fermentati e integrali NON deve lasciare l'atleta senza colazione —
  // il pool dei cereali classici che Mario lascia disponibili copre tutte e tre le righe.
  for (const [i, giorno] of perGiorno.entries()) {
    assert.ok(giorno.length >= 3, `colazione incompleta il giorno ${i + 1}: ${giorno.join(", ")}`);
  }
  for (const forbidden of [...FERMENTATI, ...INTEGRALI]) {
    assert.ok(
      !served.includes(forbidden),
      `«${forbidden}» servito prima di una seduta intensa: ${[...new Set(served)].join(", ")}`,
    );
  }
  assert.ok(
    CLASSICI.some((c) => served.includes(c)),
    `nessun cereale classico nella settimana: ${[...new Set(served)].join(", ")}`,
  );
});

test("giorno intenso + seduta alle 10:00: la colazione delle 08:00 è pre-sforzo", () => {
  const served = breakfastLabels({ requirements: REQUIREMENTS_INTENSO, trainingStartMinutes: 10 * 60 });
  for (const forbidden of [...FERMENTATI, ...INTEGRALI]) {
    assert.ok(!served.includes(forbidden), `«${forbidden}» servito a 2 h dalla seduta intensa`);
  }
});

test("giorno intenso ma seduta alle 18:00: la colazione resta invariata (yogurt compreso)", () => {
  const conRegola = breakfastLabels({ requirements: REQUIREMENTS_INTENSO, trainingStartMinutes: 18 * 60 });
  const senzaFatti = breakfastLabels({
    requirements: REQUIREMENTS_INTENSO,
    trainingStartMinutes: 18 * 60,
    withFacts: false,
  });
  assert.deepEqual(conRegola, senzaFatti, "colazione a 10 h dallo sforzo: nessun cambiamento");
  assert.ok(
    FERMENTATI.some((f) => conRegola.includes(f)) || INTEGRALI.some((f) => conRegola.includes(f)),
    `chi si allena alle 18 non deve perdere yogurt/integrali: ${[...new Set(conRegola)].join(", ")}`,
  );
});

test("giorno normale (recupero) con seduta al mattino: nessuna regressione", () => {
  const normale = breakfastLabels({ requirements: REQUIREMENTS_NORMALE, trainingStartMinutes: 7 * 60 });
  const senzaFatti = breakfastLabels({
    requirements: REQUIREMENTS_NORMALE,
    trainingStartMinutes: 7 * 60,
    withFacts: false,
  });
  assert.deepEqual(normale, senzaFatti, "giorno non intenso: composizione identica a oggi");
});

test("giorno senza orario seduta noto: no-op esplicito", () => {
  const conRegola = breakfastLabels({ requirements: REQUIREMENTS_INTENSO, trainingStartMinutes: null });
  const senzaFatti = breakfastLabels({
    requirements: REQUIREMENTS_INTENSO,
    trainingStartMinutes: null,
    withFacts: false,
  });
  assert.deepEqual(conRegola, senzaFatti);
});

test("classificazione giorno: «pesante» e gara sì, leggero/recupero no", () => {
  assert.equal(isPreEffortIntenseDay({ dayClass: "pesante" }).intense, true);
  assert.equal(isPreEffortIntenseDay({ dayClass: "leggero" }).intense, false);
  assert.equal(isPreEffortIntenseDay({ dayClass: "recupero" }).intense, false);
  assert.equal(isPreEffortIntenseDay({ dayClass: "recupero", raceDay: true }).intense, true);
  // Senza classe: ratio consumo/BMR ≥ 2,15 (banda «pesante» di Mario).
  assert.equal(
    isPreEffortIntenseDay({ energy: { bmrKcal: 1700, lifestyleKcal: 600, trainingKcal: 2600 } }).intense,
    true,
  );
  assert.equal(
    isPreEffortIntenseDay({ energy: { bmrKcal: 1700, lifestyleKcal: 600, trainingKcal: 0 } }).intense,
    false,
  );
  assert.equal(isPreEffortIntenseDay({ energy: null }).intense, false);
});

test("finestra pre-sforzo: 3 h prima, mai dopo l'inizio", () => {
  const times = {
    breakfast: "07:30",
    snack_am: "10:30",
    lunch: "13:00",
    snack_pm: "16:30",
    dinner: "20:00",
  } as const;
  const mattino = preEffortSlotsFromTimes({ effortStartMinutes: 9 * 60, mealTimesBySlot: { ...times } });
  assert.deepEqual([...mattino], ["breakfast"]);
  const sera = preEffortSlotsFromTimes({ effortStartMinutes: 18 * 60, mealTimesBySlot: { ...times } });
  assert.deepEqual([...sera], ["snack_pm"], "a 18:00 la colazione è a 10 h: fuori finestra");
  assert.equal(
    preEffortSlotsFromTimes({ effortStartMinutes: null, mealTimesBySlot: { ...times } }).size,
    0,
  );
});

test("soglie fibra: quelle del catalogo, una per base (menu-food-fiber-fermented)", () => {
  // Il motore NON tiene una soglia propria: usa quelle calibrate sui dati veri del catalogo,
  // una per base di porzione. Sotto la soglia del secco stanno i cereali classici (pasta di
  // semola 3,2), sopra gli integrali; il farro soffiato (3,9) esce per DICHIARAZIONE.
  const menuFoodPools = buildPools(true);
  const sopra = MENU_FOOD_HIGH_FIBER_THRESHOLD_DRY_G;
  assert.ok(sopra > 3.2 && sopra <= 6, `soglia secco fuori banda: ${sopra}`);
  assert.ok(
    MENU_FOOD_HIGH_FIBER_THRESHOLD_AS_EATEN_G < sopra,
    "la soglia sul prodotto come si mangia deve restare sotto quella sul secco",
  );
  const preSforzo = { foodIndex: buildMenuFoodFiberFermentedIndex(menuFoodPools), why: "test" };
  const cho = menuFoodPools.get("breakfast_cho") ?? [];
  const esclusi = cho.filter((e) => isPreEffortExcludedFood(e, preSforzo, e.fdcId)).map((e) => e.labelIt);
  const ammessi = cho.filter((e) => !isPreEffortExcludedFood(e, preSforzo, e.fdcId)).map((e) => e.labelIt);
  assert.deepEqual(esclusi.sort(), [...INTEGRALI].sort());
  assert.deepEqual(ammessi.sort(), [...CLASSICI].sort());
});
