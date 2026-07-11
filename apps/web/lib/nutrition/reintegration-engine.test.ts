import test from "node:test";
import assert from "node:assert/strict";
import {
  REINTEGRATION_MIN_DELTA_KCAL,
  computeReintegration,
} from "./reintegration-engine";

test("delta sotto soglia: nessun reintegro", () => {
  const r = computeReintegration({ estimatedMealsKcal: 2500, observedMealsKcal: 2600 }); // +100
  assert.equal(r.triggered, false);
  assert.equal(r.extraKcal, 0);
  assert.equal(r.extraWaterMl, 0);
});

test("delta sopra soglia: reintegro con carbo e acqua", () => {
  const r = computeReintegration({ estimatedMealsKcal: 2500, observedMealsKcal: 3100, trainingDurationMin: 90 }); // +600
  assert.equal(r.triggered, true);
  assert.equal(r.extraKcal, 600);
  assert.equal(r.extraCarbsG, 90); // 600*0.6/4
  assert.equal(r.extraWaterMl, 700); // 1h * 700
  assert.match(r.reason ?? "", /allenamento/);
});

test("delta grande: acqua scala col surplus", () => {
  const r = computeReintegration({ estimatedMealsKcal: 2500, observedMealsKcal: 3600 }); // +1100
  assert.equal(r.extraKcal, 1100);
  assert.equal(r.extraWaterMl, 1300); // 1100/600*700 ≈ 1283 → 1300
});

test("integratori: sudore alto → elettroliti; sforzo → proteine", () => {
  const r = computeReintegration({ estimatedMealsKcal: 2500, observedMealsKcal: 3600, trainingDurationMin: 120 }); // +1100, water 1300
  assert.ok(r.supplements.some((s) => /Elettroliti/i.test(s)));
  assert.ok(r.supplements.some((s) => /Proteine/i.test(s)));
});

test("integratori: reintegro piccolo senza allenamento → nessun integratore", () => {
  const r = computeReintegration({ estimatedMealsKcal: 2500, observedMealsKcal: 2680 }); // +180, water ~200, no training
  assert.deepEqual(r.supplements, []);
});

test("delta negativo (fatto meno): nessun reintegro (lo gestisce la riduzione)", () => {
  const r = computeReintegration({ estimatedMealsKcal: 2500, observedMealsKcal: 2200 });
  assert.equal(r.triggered, false);
});

test("soglia esatta", () => {
  const r = computeReintegration({ estimatedMealsKcal: 2000, observedMealsKcal: 2000 + REINTEGRATION_MIN_DELTA_KCAL });
  assert.equal(r.triggered, true);
});
