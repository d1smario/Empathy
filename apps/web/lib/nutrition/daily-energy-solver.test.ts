/**
 * Regressioni del solver fabbisogno energetico (Pro 2).
 *
 * Invariante fissata (vedi `.cursor/rules/empathy_nutrition_diet_meal_plan_generative.mdc` Regola 5):
 * - `totals.dailyKcal` = BMR + lifestyle + training pianificato (no scaling con `trainingEnergyScale`)
 * - `totals.mealsKcal + totals.fuelingKcal` = `totals.dailyKcal`
 * - `trainingEnergyScale` resta esposto come indicatore recovery/bio, non riduce il fabbisogno.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { computeNutritionDailyEnergyModel } from "@/lib/nutrition/daily-energy-solver";

const ATHLETE_INPUT = {
  athleteId: "test-athlete-id",
  date: "2026-05-28",
  birthDate: "2008-08-14",
  sex: "male" as const,
  heightCm: 187,
  weightKg: 70,
  bodyFatPct: 9,
  ftpWatts: 313,
  vo2maxMlMinKg: 63,
  lifestyleActivityClass: "moderate" as const,
  recoveryStatus: "unknown" as const,
  plannedTraining: [
    {
      durationMinutes: 300,
      kcalTarget: 4179,
      tssTarget: 334,
      avgPowerW: 233,
    },
  ],
};

function protectiveIntegration() {
  return {
    trainingEnergyScale: 0.57,
    mealTrainingFraction: 0.48,
    fuelingChoScale: 0.92,
    proteinBiasPctPoints: 2,
    hydrationFloorMultiplier: 1.05,
    sessionFluidMultiplier: 1.03,
    rationale: ["scala protective applicata, non riduce fabbisogno"],
    diaryInsight: null,
    acuteMealEstimate: null,
  };
}

test("daily-energy-solver: BMR massa magra = Katch-McArdle 370 + 21.6 × FFM (decisione Mario 6 ago, sostituisce Cunningham)", () => {
  const model = computeNutritionDailyEnergyModel(ATHLETE_INPUT);
  assert.equal(model.bmrMethod, "katch_mcardle_ffm");
  assert.equal(model.leanMassKg, 63.7); // 70 kg × (1 − 9%)
  assert.equal(model.bmrKcal, 1746); // round(370 + 21.6 × 63.7)

  // Caso di riferimento di Mario: 62 kg di massa magra → 1709 kcal
  // (Cunningham dava 1864: −8,3%, cambio VOLUTO — le soglie del modello sono tarate qui).
  const mario = computeNutritionDailyEnergyModel({
    ...ATHLETE_INPUT,
    weightKg: 77.5,
    bodyFatPct: 20,
  });
  assert.equal(mario.leanMassKg, 62);
  assert.equal(mario.bmrKcal, 1709);
});

test("daily-energy-solver: dailyKcal = BMR + lifestyle + training pianificato (no scaling con trainingEnergyScale)", () => {
  const noIntegration = computeNutritionDailyEnergyModel(ATHLETE_INPUT);
  const withIntegration = computeNutritionDailyEnergyModel({
    ...ATHLETE_INPUT,
    performanceIntegration: protectiveIntegration(),
  });

  assert.equal(noIntegration.totals.dailyKcal, withIntegration.totals.dailyKcal);
  assert.equal(noIntegration.training.kcal, 4179);
  assert.equal(withIntegration.training.kcal, 4179);
  assert.ok(
    noIntegration.totals.dailyKcal >= 6000,
    `dailyKcal atteso ≥ 6000 con seduta 4179 kcal, trovato ${noIntegration.totals.dailyKcal}`,
  );
});

test("daily-energy-solver: mealsKcal + fuelingKcal = dailyKcal (con e senza scaler)", () => {
  const base = computeNutritionDailyEnergyModel(ATHLETE_INPUT);
  const prot = computeNutritionDailyEnergyModel({
    ...ATHLETE_INPUT,
    performanceIntegration: protectiveIntegration(),
  });
  assert.equal(base.totals.mealsKcal + base.totals.fuelingKcal, base.totals.dailyKcal);
  assert.equal(prot.totals.mealsKcal + prot.totals.fuelingKcal, prot.totals.dailyKcal);
});

test("daily-energy-solver: protective sposta energia training→pasti, ma dailyKcal invariato", () => {
  const base = computeNutritionDailyEnergyModel(ATHLETE_INPUT);
  const prot = computeNutritionDailyEnergyModel({
    ...ATHLETE_INPUT,
    performanceIntegration: protectiveIntegration(),
  });
  assert.equal(prot.totals.dailyKcal, base.totals.dailyKcal);
  assert.ok(
    prot.totals.mealsKcal > base.totals.mealsKcal,
    `mealsKcal protective ${prot.totals.mealsKcal} dovrebbe essere > base ${base.totals.mealsKcal}`,
  );
  assert.ok(
    prot.totals.fuelingKcal < base.totals.fuelingKcal,
    `fuelingKcal protective ${prot.totals.fuelingKcal} dovrebbe essere < base ${base.totals.fuelingKcal}`,
  );
});

test("daily-energy-solver: dietDayMealsScalePct è l'unico moltiplicatore consentito sul fabbisogno", () => {
  const normo = computeNutritionDailyEnergyModel({
    ...ATHLETE_INPUT,
    dietDayMealsScalePct: 100,
  });
  const deficit = computeNutritionDailyEnergyModel({
    ...ATHLETE_INPUT,
    dietDayMealsScalePct: 80,
  });
  assert.ok(
    deficit.totals.dailyKcal < normo.totals.dailyKcal,
    `dailyKcal deficit ${deficit.totals.dailyKcal} < normo ${normo.totals.dailyKcal}`,
  );
  assert.ok(
    deficit.totals.mealsKcal < normo.totals.mealsKcal,
    `mealsKcal deficit ${deficit.totals.mealsKcal} < normo ${normo.totals.mealsKcal}`,
  );
  /** fuelingKcal non è scalato da day_type_pct (è composizione pre/intra/post, non quota giornaliera). */
  assert.equal(deficit.totals.fuelingKcal, normo.totals.fuelingKcal);
});

test("daily-energy-solver: TSS fallback when kcal_target null (builder row senza kcal in DB)", () => {
  const model = computeNutritionDailyEnergyModel({
    ...ATHLETE_INPUT,
    plannedTraining: [{ durationMinutes: 100, kcalTarget: 0, tssTarget: 106 }],
  });
  assert.ok(model.training.kcal >= 800, `training kcal from TSS, got ${model.training.kcal}`);
  /** Soglia ricalibrata su BMR Katch-McArdle (1746 + 349 lifestyle + ~40% training ≈ 2455; era >2500 con Cunningham). */
  assert.ok(model.totals.mealsKcal > 2400, `meals budget should include training, got ${model.totals.mealsKcal}`);
});
