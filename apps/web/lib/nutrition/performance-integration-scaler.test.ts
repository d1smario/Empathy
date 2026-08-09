/**
 * Guardia sulla QUOTA PASTI decisa dall'integrazione performance.
 *
 * Perché esiste: il solver applica `MEAL_TRAINING_FRACTION_DEFAULT` solo quando
 * `performanceIntegration` è null. Per ogni atleta con integrazione attiva (percorso
 * browser: `resolveNutritionDayModel` passa sempre i dials) la quota pasti arriva da
 * questo scaler — se qui il 40% di Mario fosse un letterale duplicato, un ritocco della
 * costante nel solver non raggiungerebbe quegli atleti. Questi test falliscono se le due
 * fonti divergono.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { AdaptationGuidance } from "@/lib/empathy/schemas/adaptation";
import type { TrainingDayOperationalContext } from "@/lib/training/day-operational-context";
import { MEAL_TRAINING_FRACTION_DEFAULT } from "@/lib/nutrition/daily-energy-solver";
import { buildNutritionPerformanceIntegration } from "@/lib/nutrition/performance-integration-scaler";

const GREEN_GUIDANCE: AdaptationGuidance = {
  scorePct: 100,
  trafficLight: "green",
  expectedAdaptation: 1,
  observedAdaptation: 1,
  reductionMinPct: 0,
  reductionMaxPct: 0,
  keepProgramUnchanged: true,
  guidance: "test",
  likelyDrivers: [],
};

function operationalContext(mode: TrainingDayOperationalContext["mode"]): TrainingDayOperationalContext {
  return { mode, loadScale: 1, loadScalePct: 100, headline: "test", guidance: "test" };
}

function build(context: TrainingDayOperationalContext | null) {
  return buildNutritionPerformanceIntegration({
    bioenergeticModulation: null,
    adaptationGuidance: GREEN_GUIDANCE,
    adaptationLoop: null,
    operationalContext: context,
  });
}

test("performance-integration-scaler: il baseline della quota pasti È la costante del solver (regola Mario 40%)", () => {
  const dials = build(null);
  assert.equal(dials.mealTrainingFraction, MEAL_TRAINING_FRACTION_DEFAULT);
});

test("performance-integration-scaler: cauta +4 punti, protettiva +8, derivati dal baseline (no letterali)", () => {
  const cautious = build(operationalContext("cautious"));
  const protective = build(operationalContext("protective"));

  assert.equal(cautious.mealTrainingFraction, 0.44);
  assert.equal(protective.mealTrainingFraction, 0.48);
  // La forma della regola, non il valore: le due modalità restano a distanza fissa dal
  // baseline anche se domani Mario ritocca il 40%.
  assert.ok(
    Math.abs(cautious.mealTrainingFraction - MEAL_TRAINING_FRACTION_DEFAULT - 0.04) < 1e-12,
    `cauta ${cautious.mealTrainingFraction} ≠ baseline ${MEAL_TRAINING_FRACTION_DEFAULT} + 0.04`,
  );
  assert.ok(
    Math.abs(protective.mealTrainingFraction - MEAL_TRAINING_FRACTION_DEFAULT - 0.08) < 1e-12,
    `protettiva ${protective.mealTrainingFraction} ≠ baseline ${MEAL_TRAINING_FRACTION_DEFAULT} + 0.08`,
  );
  // Nessuna modalità può portare la quota pasti fuori dal dominio sensato.
  for (const fraction of [cautious.mealTrainingFraction, protective.mealTrainingFraction]) {
    assert.ok(fraction > 0 && fraction < 1, `quota pasti fuori range: ${fraction}`);
  }
});
