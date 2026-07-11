import test from "node:test";
import assert from "node:assert/strict";
import { REDUCTION_MIN_KCAL, computeReduction } from "./reduction-engine";

test("riduzione normale: capata dallo skip quando i pasti bastano", () => {
  const r = computeReduction({ skippedMealKcal: 300, remainingMealsCapacityKcal: 1200 });
  assert.equal(r.triggered, true);
  assert.equal(r.reductionKcal, 300);
  assert.match(r.reason ?? "", /alleggerisco/);
});

test("cap dai pasti rimanenti: non riduce più di quanto resta", () => {
  const r = computeReduction({ skippedMealKcal: 800, remainingMealsCapacityKcal: 250 });
  assert.equal(r.reductionKcal, 250); // capata
});

test("troppo tardi (nessun pasto rimane): niente riduzione", () => {
  const r = computeReduction({ skippedMealKcal: 500, remainingMealsCapacityKcal: 0 });
  assert.equal(r.triggered, false);
  assert.equal(r.reductionKcal, 0);
});

test("skip trascurabile: sotto soglia niente", () => {
  const r = computeReduction({ skippedMealKcal: 80, remainingMealsCapacityKcal: 1000 });
  assert.equal(r.triggered, false);
});

test("soglia esatta", () => {
  const r = computeReduction({ skippedMealKcal: REDUCTION_MIN_KCAL, remainingMealsCapacityKcal: 1000 });
  assert.equal(r.triggered, true);
});
