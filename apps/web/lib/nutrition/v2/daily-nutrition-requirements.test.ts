import assert from "node:assert/strict";
import test from "node:test";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import { buildDailyNutritionRequirementsV2 } from "@/lib/nutrition/v2/daily-nutrition-requirements";

function minimalRequest(overrides?: Partial<IntelligentMealPlanRequest>): IntelligentMealPlanRequest {
  return {
    athleteId: "athlete-test",
    planDate: "2026-06-05",
    dietType: "omnivore",
    intolerances: null,
    allergies: null,
    foodExclusions: null,
    foodPreferences: null,
    supplements: null,
    aggregateInhibitors: null,
    pathwayTimingLines: [],
    trainingDayLines: ["Long ride 4h @ 270w threshold"],
    routineDigest: null,
    contextLines: [],
    mealPlanSolverMeta: { dailyMealsKcalTotal: 3800, integrationLeverLines: [] },
    slots: [],
    ...overrides,
  };
}

test("load day 70kg: CHO totale > 400g con 4h 270W", () => {
  const req = minimalRequest();
  const r = buildDailyNutritionRequirementsV2({
    request: req,
    weightKg: 70,
    ftpWatts: 313,
    plannedSessions: [{ label: "Ride", avgPowerW: 270, durationMin: 240 }],
    strategyKind: "load",
  });
  assert.equal(r.strategyKind, "load");
  assert.ok(r.macros.total.choG >= 400, `CHO totale ${r.macros.total.choG}`);
  assert.equal(r.dietProfileActive, "omnivore");
  assert.ok(r.substrateRates.length === 1);
  assert.ok(r.substrateFueling != null);
  assert.ok(r.dailyMacroTargetsGPerKg.choMinGPerKg === 8);
  assert.ok(r.energy.mealsKcal + r.energy.fuelingKcal === r.energy.dailyKcal);
  assert.ok(r.energy.fuelingKcal < r.energy.trainingKcal, "fueling CHO-based < training kcal totale");
});

test("lifestyle unificato: energy.lifestyleKcal = solver V1 (niente più scala PAL parallela)", () => {
  const r = buildDailyNutritionRequirementsV2({
    request: minimalRequest(),
    weightKg: 70,
    ftpWatts: 313,
    lifestyleActivityClass: "moderate",
    plannedSessions: [{ label: "Ride", avgPowerW: 270, durationMin: 240 }],
    strategyKind: "load",
  });
  // Solver V1: moderate = +20% BMR (il vecchio PAL 1.40 avrebbe dato +40%).
  assert.equal(r.energy.lifestyleKcal, Math.round(r.energy.bmrKcal * 0.2), "lifestyle = 20% BMR (V1)");
  assert.equal(r.energy.palMultiplier, 1.2, "palMultiplier = moltiplicatore effettivo V1 (1 + pct)");
  assert.ok(
    !r.provenance.some((line) => /\bPAL\b/.test(line)),
    "provenance non cita più il modello PAL rimosso",
  );
  assert.ok(
    r.provenance.some((line) => line.includes("solver V1")),
    "provenance dichiara il solver V1 come fonte lifestyle",
  );
});

test("vegan diet_type → profilo dieta vegan", () => {
  const r = buildDailyNutritionRequirementsV2({
    request: minimalRequest({ dietType: "vegan" }),
    weightKg: 68,
    ftpWatts: 280,
    plannedSessions: [],
    strategyKind: "maintenance",
  });
  assert.equal(r.dietProfileActive, "vegan");
});
