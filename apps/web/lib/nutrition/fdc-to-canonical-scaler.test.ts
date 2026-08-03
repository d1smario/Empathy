/**
 * ATTENZIONE: questo file importa `fdc-to-canonical-scaler`, che ha `import "server-only"`.
 * Va eseguito con la condition React Server, altrimenti il marker package lancia:
 *   npm run test:fdc-scaler        (= tsx --conditions=react-server --test …)
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFdcCanonicalSnapshotFromFdcIds,
  buildFdcCanonicalSnapshotFromFoods,
  fdcCachedFoodToCanonical,
} from "./fdc-canonical-map";
import { nutrientsForMealPlanItemFromCache } from "./fdc-to-canonical-scaler";
import type { FdcCachedFood } from "./fdc-food-cache";

function mockFdcFood(overrides: Partial<FdcCachedFood> = {}): FdcCachedFood {
  return {
    fdcId: 171077,
    description: "Chicken, breast, meat only, raw",
    dataType: "SR Legacy",
    publicationDate: null,
    foodCategory: null,
    kcalPer100g: 120,
    carbsPer100g: 0,
    proteinPer100g: 22.5,
    fatPer100g: 2.6,
    fiberPer100g: 0,
    sugarsPer100g: 0,
    sodiumMgPer100g: 77,
    glycemicIndexEstimate: 30,
    insulinIndexEstimate: 35,
    glycemicLoadPer100g: 0,
    insulinLoadPer100g: 0,
    metabolicIndices: {},
    vitamins: [{ nutrientId: 1162, name: "Vitamin C, total ascorbic acid", amountPer100g: 0, unit: "mg" }],
    minerals: [{ nutrientId: 1087, name: "Calcium, Ca", amountPer100g: 11, unit: "mg" }],
    aminoAcids: [{ nutrientId: 1213, name: "Leucine", amountPer100g: 1.9, unit: "g" }],
    fattyAcids: [],
    otherNutrients: [],
    ...overrides,
  };
}

test("fdcCachedFoodToCanonical maps macros and micro buckets", () => {
  const canonical = fdcCachedFoodToCanonical(mockFdcFood());
  assert.equal(canonical.kcalPer100g, 120);
  assert.equal(canonical.proteinG, 22.5);
  assert.equal(canonical.ca_mg, 11);
  assert.equal(canonical.eaa_leu, 1.9);
});

test("buildFdcCanonicalSnapshotFromFoods: una query logica, skip key senza cache", () => {
  const food = mockFdcFood();
  const map = new Map<number, FdcCachedFood>([[171077, food]]);
  const snap = buildFdcCanonicalSnapshotFromFoods(["chicken_breast", "bread_white"], map);
  assert.ok(snap.chicken_breast);
  assert.equal(snap.chicken_breast.fdcId, 171077);
  assert.equal(snap.chicken_breast.canonical.proteinG, 22.5);
  assert.equal(snap.bread_white, undefined);
});

/** Riga USDA reale dei pistacchi (fdc_id 2515379), quella scelta dal compositore V2. */
function mockPistachios(): FdcCachedFood {
  return mockFdcFood({
    fdcId: 2515379,
    description: "Nuts, pistachio nuts, raw",
    kcalPer100g: 598,
    carbsPer100g: 27.7,
    proteinPer100g: 20.5,
    fatPer100g: 45,
    vitamins: [],
    minerals: [],
    aminoAcids: [],
  });
}

test("compositionKey `fdc:NNN`: i macro escono dalla riga USDA scalata sui grammi, non dall'inferenza sul nome", () => {
  // «Pistacchi» non ha regola in INFER_RULES: senza il compositionKey l'item finiva unresolved.
  const snapshot = buildFdcCanonicalSnapshotFromFdcIds([2515379], new Map([[2515379, mockPistachios()]]));
  const res = nutrientsForMealPlanItemFromCache(
    { name: "Pistacchi", portionHint: "6 g Pistacchi", approxKcal: 36, compositionKey: "fdc:2515379" },
    snapshot,
  );
  assert.equal(res.compositionStatus, "fdc_cache");
  assert.ok(res.nutrients);
  assert.equal(Math.round(res.nutrients.kcal), 36);
  assert.equal(Math.round(res.nutrients.fatG * 10) / 10, 2.7);
  assert.equal(Math.round(res.nutrients.carbsG * 10) / 10, 1.7);
});

test("lookup fallito: `nutrients` ASSENTE, mai un oggetto tutto-zero", () => {
  // Stesso item ma senza compositionKey e senza snapshot → inferenza sul nome → generic_mixed.
  const res = nutrientsForMealPlanItemFromCache(
    { name: "Pistacchi", portionHint: "6 g Pistacchi", approxKcal: 36 },
    {},
  );
  assert.equal(res.compositionStatus, "unresolved");
  assert.equal(res.nutrients, undefined);
  assert.equal("nutrients" in res, false);
});

test("porzioni in ml con compositionKey `fdc:NNN`: olio ed EVO restano scalati sui grammi", () => {
  const oil = mockFdcFood({
    fdcId: 171413,
    description: "Oil, olive, salad or cooking",
    kcalPer100g: 884,
    carbsPer100g: 0,
    proteinPer100g: 0,
    fatPer100g: 100,
    vitamins: [],
    minerals: [],
    aminoAcids: [],
  });
  const snapshot = buildFdcCanonicalSnapshotFromFdcIds([171413], new Map([[171413, oil]]));
  const res = nutrientsForMealPlanItemFromCache(
    { name: "Olio extra vergine di oliva", portionHint: "12 ml olio EVO", approxKcal: 98, compositionKey: "fdc:171413" },
    snapshot,
  );
  assert.ok(res.nutrients);
  // 12 ml × 0.92 g/ml = 11.04 g → ~97.6 kcal, ~11 g di grassi.
  assert.equal(Math.round(res.nutrients.kcal), 98);
  assert.equal(Math.round(res.nutrients.fatG), 11);
});
