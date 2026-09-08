import assert from "node:assert/strict";
import test from "node:test";
import type { DailyNutritionRequirementsV2, MealPlanV2DietSlotBudget } from "@empathy/contracts";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import { buildMealPlanFoodDenyFragments } from "@/lib/nutrition/meal-plan-profile-food-filter";
import { composeMealPlanV2, type FdcPoolMap } from "@/lib/nutrition/v2/compose-meal-plan-v2";
import type { MenuFoodEntry, MenuFoodPoolMap } from "@/lib/nutrition/v2/menu-food-catalog-db";

/**
 * DIFETTO riprodotto qui: il filtro allergeni decide sulle sottostringhe della
 * descrizione, quindi chi non viene riconosciuto passa. Con il profilo REALE di
 * produzione c2bd27ec-3261-45fb-a9ff-a6dc7e9bc908 (allergie "Noci"/"nocciole"/"sedano",
 * intolleranza "Lattosio") i frammenti generati sono ["noci","nocciole","mandorl",…,
 * "latte","lactose","yogurt","latticino",…]: NESSUNO compare in «Pinoli», «Latticello» o
 * «Frutta secca mista tostata», che quindi finiscono nel piano.
 *
 * Alimenti e fdcId sono quelli veri di `nutrition_menu_foods` (prod ggmpegwnzbrjkeiydwqu).
 */

const REAL_ALLERGIES = ["Noci", "nocciole", "pesca", "mela", "paprika", "sedano", "kiwi"];
const REAL_INTOLERANCES = ["Lattosio"];

type Fixture = {
  canonicalKey: string;
  labelIt: string;
  fdcId: number;
  poolKeys: string[];
  kcal: number;
  cho: number;
  pro: number;
  fat: number;
  allergenClasses?: string[];
  allergensReviewed?: boolean;
};

const CATALOG: Fixture[] = [
  // breakfast_cho — glutine: l'atleta lo tollera, deve restare pescabile.
  { canonicalKey: "oat_dry", labelIt: "Fiocchi d'avena", fdcId: 169705, poolKeys: ["breakfast_cho"],
    kcal: 389, cho: 66, pro: 17, fat: 7, allergenClasses: ["glutine"], allergensReviewed: true },
  { canonicalKey: "rice_flakes", labelIt: "Fiocchi di riso", fdcId: 169711, poolKeys: ["breakfast_cho"],
    kcal: 370, cho: 80, pro: 7, fat: 1, allergenClasses: [], allergensReviewed: true },
  // breakfast_pro — «Latticello» NON contiene "latte"/"latticino": oggi passa.
  { canonicalKey: "buttermilk", labelIt: "Latticello", fdcId: 2259792, poolKeys: ["breakfast_pro"],
    kcal: 40, cho: 4.8, pro: 3.3, fat: 0.9, allergenClasses: ["latte"], allergensReviewed: true },
  { canonicalKey: "egg_whole", labelIt: "Uova", fdcId: 172183, poolKeys: ["breakfast_pro"],
    kcal: 143, cho: 0.7, pro: 12.6, fat: 9.5, allergenClasses: ["uova"], allergensReviewed: true },
  // breakfast_fat — i due casi veri + un alimento MAI esaminato (fail-closed) + l'EVO sicuro.
  { canonicalKey: "mixed_nuts_roasted", labelIt: "Frutta secca mista tostata", fdcId: 170585,
    poolKeys: ["breakfast_fat"], kcal: 607, cho: 21, pro: 20, fat: 54,
    allergenClasses: ["frutta_a_guscio"], allergensReviewed: true },
  { canonicalKey: "pine_nuts", labelIt: "Pinoli", fdcId: 2346392, poolKeys: ["breakfast_fat"],
    kcal: 673, cho: 13, pro: 14, fat: 68, allergenClasses: ["frutta_a_guscio"], allergensReviewed: true },
  // Riga NON classificata: allergen_classes NULL + allergens_reviewed false.
  { canonicalKey: "sunflower_seed_spread", labelIt: "Crema di semi di girasole", fdcId: 999001,
    poolKeys: ["breakfast_fat"], kcal: 617, cho: 18, pro: 19, fat: 55 },
  { canonicalKey: "olive_oil", labelIt: "Olio extravergine d'oliva", fdcId: 171413,
    poolKeys: ["breakfast_fat"], kcal: 884, cho: 0, pro: 0, fat: 100,
    allergenClasses: [], allergensReviewed: true },
];

function buildPools(withAllergenColumns: boolean): MenuFoodPoolMap {
  const pools: MenuFoodPoolMap = new Map();
  for (const f of CATALOG) {
    const entry: MenuFoodEntry = {
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
      isAnimalProduct: f.canonicalKey === "buttermilk" || f.canonicalKey === "egg_whole",
      ...(withAllergenColumns && f.allergenClasses
        ? { allergenClasses: f.allergenClasses as MenuFoodEntry["allergenClasses"] }
        : {}),
      ...(withAllergenColumns && f.allergensReviewed != null
        ? { allergensReviewed: f.allergensReviewed }
        : {}),
    };
    for (const key of f.poolKeys) {
      pools.set(key, [...(pools.get(key) ?? []), entry]);
    }
  }
  return pools;
}

const requirements = { energy: { mealsKcal: 2200 } } as DailyNutritionRequirementsV2;

const breakfast: MealPlanV2DietSlotBudget = {
  key: "breakfast",
  label: "Colazione",
  pct: 25,
  kcal: 600,
  carbs: 72,
  protein: 30,
  fat: 20,
};

/** Due settimane: la rotazione del pool (seed per atleta+data) deve girare su tutti i cibi. */
const PLAN_DATES = Array.from({ length: 14 }, (_, i) => `2026-09-${String(7 + i).padStart(2, "0")}`);

function request(planDate: string, allergic: boolean): IntelligentMealPlanRequest {
  return {
    athleteId: "c2bd27ec-3261-45fb-a9ff-a6dc7e9bc908",
    planDate,
    dietType: "omnivore",
    allergies: allergic ? REAL_ALLERGIES : [],
    intolerances: allergic ? REAL_INTOLERANCES : [],
    foodExclusions: null,
    slots: [],
  } as unknown as IntelligentMealPlanRequest;
}

/** Etichette servite nelle due settimane, come le vedrebbe l'atleta. */
function weekLabels(allergic: boolean, withAllergenColumns: boolean): string[] {
  const menuFoodPools = buildPools(withAllergenColumns);
  const out: string[] = [];
  for (const planDate of PLAN_DATES) {
    const req = request(planDate, allergic);
    const composed = composeMealPlanV2(requirements, [breakfast], new Map() as FdcPoolMap, {
      denyFragments: buildMealPlanFoodDenyFragments(req),
      request: req,
      menuFoodPools,
    });
    for (const item of composed[0]!.items) out.push(item.description);
  }
  return out;
}

test("allergeni: «Frutta secca mista tostata», «Pinoli» e «Latticello» mai serviti", () => {
  const served = weekLabels(true, true);
  assert.ok(served.length > 0, "la colazione deve comunque essere composta");
  for (const forbidden of ["Frutta secca mista tostata", "Pinoli", "Latticello"]) {
    assert.ok(
      !served.includes(forbidden),
      `«${forbidden}» servito all'atleta c2bd27ec: ${[...new Set(served)].join(", ")}`,
    );
  }
});

test("fail-closed: alimento NON classificato mai servito a chi ha allergie dichiarate", () => {
  const served = weekLabels(true, true);
  assert.ok(
    !served.includes("Crema di semi di girasole"),
    `alimento non classificato servito: ${[...new Set(served)].join(", ")}`,
  );
  // ...e resta comunque un piano vero: il pool sicuro viene usato.
  assert.ok(served.includes("Olio extravergine d'oliva"), [...new Set(served)].join(", "));
  assert.ok(served.includes("Uova"), [...new Set(served)].join(", "));
});

test("nessuna regressione: atleta senza allergie → STESSO pool di prima", () => {
  const conColonne = weekLabels(false, true);
  const senzaColonne = weekLabels(false, false);
  assert.deepEqual(conColonne, senzaColonne);
  // Il catalogo non filtrato offre davvero anche i cibi «rischiosi» e quello non esaminato.
  const distinte = new Set(conColonne);
  assert.ok(distinte.has("Crema di semi di girasole"), [...distinte].join(", "));
  assert.ok(distinte.has("Latticello"), [...distinte].join(", "));
});

test("rollout: catalogo senza colonne allergeni → piano invariato, mai vuoto", () => {
  const served = weekLabels(true, false);
  assert.equal(served.length, weekLabels(false, false).length);
  assert.ok(served.length > 0);
});
