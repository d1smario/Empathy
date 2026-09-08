import assert from "node:assert/strict";
import test from "node:test";
import type { DailyNutritionRequirementsV2, MealPlanV2DietSlotBudget } from "@empathy/contracts";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import { buildMealPlanFoodDenyFragments } from "@/lib/nutrition/meal-plan-profile-food-filter";
import { buildRacePreLunchDayContext } from "@/lib/nutrition/race-day-pre-race-lunch";
import { composeMealPlanV2, type FdcPoolMap } from "@/lib/nutrition/v2/compose-meal-plan-v2";
import type { MenuFoodEntry, MenuFoodPoolMap } from "@/lib/nutrition/v2/menu-food-catalog-db";

/**
 * DUE BUCHI del filtro allergeni per classi, entrambi sulla stessa famiglia: strade che
 * NON passano il contesto allergeni al pick.
 *
 *  (a) `applyRegola7Cho` (Regola 7 dei carboidrati): i suoi due `pickStapleForPool`
 *      costruiscono l'argomento a mano e omettono `allergen`, quindi lo SWAP del pane
 *      può rimettere nel piatto un alimento che il filtro aveva escluso.
 *  (b) `composeRaceSlot` (giorno gara): delega al protocollo pre-gara/recovery, che
 *      compone item hardcoded (Grana Padano, crostata/torta) senza vedere le classi.
 *
 * In entrambi i casi la rete secondaria per SOTTOSTRINGHE non salva: i frammenti
 * generati da «Lattosio» sono ["latte","yogurt","formaggio","burro","panna","parmigiano",
 * "pecorino",…] e nessuno compare in «Brioche», «Grana Padano» o «Torta semplice»;
 * quelli generati da «Noci» sono ["noci","nocciole","mandorl",…] e nessuno compare in
 * «Pane ai semi e frutta secca».
 */

/** Profilo atleta: allergia frutta a guscio + intolleranza al lattosio. */
const ALLERGIES = ["Noci"];
const INTOLERANCES = ["Lattosio"];

const requirements = { energy: { mealsKcal: 2600 } } as DailyNutritionRequirementsV2;

/** Due settimane: la rotazione per (atleta, data) deve girare su tutto il pool. */
const PLAN_DATES = Array.from({ length: 14 }, (_, i) => `2026-09-${String(7 + i).padStart(2, "0")}`);

// ── (a) Regola 7: lo swap del pane ───────────────────────────────────────────────────

type Fixture = {
  canonicalKey: string;
  labelIt: string;
  fdcId: number;
  kcal: number;
  cho: number;
  pro: number;
  fat: number;
  allergenClasses: string[];
  animal?: boolean;
};

/**
 * Pool `lunch_carb`: il pane bianco è l'unico sicuro per questo atleta, gli altri due
 * portano una classe vietata. Con il filtro attivo la linea CHO è SEMPRE «Pane bianco»
 * (gli altri non esistono) — e la Regola 7 (CHO > 100 g) prova a sostituirlo: è lì che
 * il buco si vede.
 */
const LUNCH_CARB: Fixture[] = [
  { canonicalKey: "bread_white", labelIt: "Pane bianco", fdcId: 172686,
    kcal: 266, cho: 49, pro: 8, fat: 3.3, allergenClasses: ["glutine"] },
  { canonicalKey: "brioche", labelIt: "Brioche", fdcId: 174987,
    kcal: 350, cho: 47, pro: 8, fat: 15, allergenClasses: ["glutine", "latte", "uova"], animal: true },
  { canonicalKey: "bread_nuts_seeds", labelIt: "Pane ai semi e frutta secca", fdcId: 175040,
    kcal: 300, cho: 45, pro: 10, fat: 8, allergenClasses: ["glutine", "frutta_a_guscio"] },
];

function lunchCarbPools(): MenuFoodPoolMap {
  const pools: MenuFoodPoolMap = new Map();
  const entries: MenuFoodEntry[] = LUNCH_CARB.map((f) => ({
    canonicalKey: f.canonicalKey,
    labelIt: f.labelIt,
    servingBasis: "dry_grams",
    fdcId: f.fdcId,
    kcalPer100g: f.kcal,
    carbsPer100g: f.cho,
    proteinPer100g: f.pro,
    fatPer100g: f.fat,
    isMeat: false,
    isFish: false,
    isAnimalProduct: f.animal === true,
    allergenClasses: f.allergenClasses as MenuFoodEntry["allergenClasses"],
    allergensReviewed: true,
  }));
  pools.set("lunch_carb", entries);
  return pools;
}

/** CHO 120 g → sopra la soglia della Regola 7 (>100), sotto quella del pane fisso (130). */
const lunchSlot: MealPlanV2DietSlotBudget = {
  key: "lunch",
  label: "Pranzo",
  pct: 35,
  kcal: 780,
  carbs: 120,
  protein: 40,
  fat: 22,
};

function lunchRequest(planDate: string, allergic: boolean): IntelligentMealPlanRequest {
  return {
    athleteId: "c2bd27ec-3261-45fb-a9ff-a6dc7e9bc908",
    planDate,
    dietType: "omnivore",
    allergies: allergic ? ALLERGIES : [],
    intolerances: allergic ? INTOLERANCES : [],
    foodExclusions: null,
    slots: [],
  } as unknown as IntelligentMealPlanRequest;
}

function lunchLabels(allergic: boolean): string[] {
  const menuFoodPools = lunchCarbPools();
  const out: string[] = [];
  for (const planDate of PLAN_DATES) {
    const req = lunchRequest(planDate, allergic);
    const composed = composeMealPlanV2(requirements, [lunchSlot], new Map() as FdcPoolMap, {
      denyFragments: buildMealPlanFoodDenyFragments(req),
      request: req,
      menuFoodPools,
    });
    for (const item of composed[0]!.items) out.push(item.description);
  }
  return out;
}

test("Regola 7 (swap CHO): lo scambio del pane non può servire un alimento vietato per classe", () => {
  const served = lunchLabels(true);
  assert.ok(served.length > 0, "il pranzo deve comunque essere composto");
  for (const forbidden of ["Brioche", "Pane ai semi e frutta secca"]) {
    assert.ok(
      !served.includes(forbidden),
      `«${forbidden}» servito dallo swap della Regola 7: ${[...new Set(served)].join(", ")}`,
    );
  }
  assert.ok(served.includes("Pane bianco"), `pranzo senza CHO: ${[...new Set(served)].join(", ")}`);
});

test("Regola 7: senza allergie lo swap resta quello di oggi (nessuna regressione)", () => {
  const served = new Set(lunchLabels(false));
  assert.ok(
    served.has("Brioche") || served.has("Pane ai semi e frutta secca"),
    `lo swap della Regola 7 non gira più: ${[...served].join(", ")}`,
  );
});

// ── (b) Giorno gara ──────────────────────────────────────────────────────────────────

function raceContext() {
  const raceCtx = buildRacePreLunchDayContext({
    weightKg: 70,
    planDate: "2026-06-15",
    routineConfig: { week_plan: { sun: { day_mode: "race", race_start: "13:00" } } },
    plannedSessions: [{ duration_minutes: 180, type: "race", notes: "Gran fondo" }],
    activeMealSlots: ["breakfast", "snack_am", "lunch", "snack_pm", "dinner"],
  });
  assert.ok(raceCtx);
  return raceCtx!;
}

function raceDayDescriptions(allergic: boolean): string[] {
  const raceCtx = raceContext();
  const slot: MealPlanV2DietSlotBudget = {
    key: raceCtx.mealSlot,
    label: "Pre-gara",
    pct: 40,
    kcal: 1700,
    carbs: 240,
    protein: 50,
    fat: 30,
  };
  const req = {
    athleteId: "c2bd27ec-3261-45fb-a9ff-a6dc7e9bc908",
    planDate: "2026-06-15",
    dietType: "omnivore",
    allergies: allergic ? ALLERGIES : [],
    intolerances: allergic ? INTOLERANCES : [],
    foodExclusions: null,
    slots: [],
    racePreLunch: raceCtx,
  } as unknown as IntelligentMealPlanRequest;

  const out = composeMealPlanV2(requirements, [slot], new Map() as FdcPoolMap, {
    denyFragments: buildMealPlanFoodDenyFragments(req),
    request: req,
  });
  return out[0]!.items.map((i) => i.description);
}

test("giorno gara: chi non tollera il latte non riceve grana né dolce da top-up", () => {
  const served = raceDayDescriptions(true);
  assert.ok(served.length > 0, "il pasto pre-gara deve comunque esistere");
  assert.ok(
    served.some((d) => /pasta|riso/i.test(d)),
    `pre-gara senza amido: ${served.join(", ")}`,
  );
  assert.ok(
    !served.some((d) => /grana|padano/i.test(d)),
    `Grana Padano servito nel giorno gara a un intollerante al lattosio: ${served.join(", ")}`,
  );
  assert.ok(
    !served.some((d) => /crostata|torta/i.test(d)),
    `dolce con latte/uova servito nel giorno gara: ${served.join(", ")}`,
  );
});

test("giorno gara: senza allergie il protocollo resta intatto (nessuna regressione)", () => {
  const served = raceDayDescriptions(false);
  assert.ok(served.some((d) => /grana/i.test(d)), served.join(", "));
  assert.ok(served.some((d) => /crostata|torta/i.test(d)), served.join(", "));
});
