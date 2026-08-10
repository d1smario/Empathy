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

import {
  AROUND_TRAINING_TOTAL,
  computeNutritionDailyEnergyModel,
  fuelingAroundTrainingSplit,
  MEAL_TRAINING_FRACTION_DEFAULT,
} from "@/lib/nutrition/daily-energy-solver";

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

/* ── Confine fueling↔pasti: regola Mario 8 ago (50 intra / 40 pasti / 10 pre+post) ───────── */

const RECOVERY_TIERS = ["good", "moderate", "poor", "unknown", null] as const;

test("fueling split: pasti 40% + attorno alla seduta 60% (regola Mario 8 ago)", () => {
  assert.equal(MEAL_TRAINING_FRACTION_DEFAULT, 0.4);
  assert.equal(AROUND_TRAINING_TOTAL, 0.6);
  assert.equal(MEAL_TRAINING_FRACTION_DEFAULT + AROUND_TRAINING_TOTAL, 1);
  // Recupero buono = regola di Mario alla lettera: intra 50% del training, pre+post 10%.
  const good = fuelingAroundTrainingSplit("good");
  assert.equal(good.intra, 0.5);
  assert.ok(Math.abs(good.pre + good.post - 0.1) < 1e-12, `pre+post ${good.pre + good.post} ≠ 0.10`);
});

test("fueling split: in OGNI tier la somma è 0.60 e il post è il doppio del pre (invariante)", () => {
  for (const tier of RECOVERY_TIERS) {
    const split = fuelingAroundTrainingSplit(tier);
    assert.ok(
      Math.abs(split.pre + split.intra + split.post - AROUND_TRAINING_TOTAL) < 1e-12,
      `tier ${tier}: somma ${split.pre + split.intra + split.post} ≠ ${AROUND_TRAINING_TOTAL}`,
    );
    assert.ok(
      Math.abs(split.post - 2 * split.pre) < 1e-12,
      `tier ${tier}: post ${split.post} dovrebbe essere 2 × pre ${split.pre}`,
    );
  }
});

test("fueling split: la modulazione da recupero conserva direzione e ampiezza (good→poor: 5 punti intra→pre/post)", () => {
  const good = fuelingAroundTrainingSplit("good");
  const moderate = fuelingAroundTrainingSplit("moderate");
  const poor = fuelingAroundTrainingSplit("poor");
  assert.ok(good.intra > moderate.intra && moderate.intra > poor.intra);
  assert.ok(good.pre < moderate.pre && moderate.pre < poor.pre);
  assert.ok(Math.abs(good.intra - poor.intra - 0.05) < 1e-12);
  // I NUOVI valori del tier "poor" (5/45/10) coincidono con i VECCHI valori del tier
  // good/unknown, non con il vecchio "poor" (che era 8/40/12): tutta la banda si è alzata
  // di ~5 punti di intra. Nessun tier resta fermo — vedi la tabella nel solver.
  assert.ok(Math.abs(poor.pre - 0.05) < 1e-12, `poor.pre ${poor.pre} ≠ 0.05`);
  assert.equal(poor.intra, 0.45);
  assert.ok(Math.abs(poor.post - 0.1) < 1e-12, `poor.post ${poor.post} ≠ 0.10`);
  // Recupero ignoto/assente → baseline Mario (come "good"), non la taratura protettiva.
  assert.deepEqual(fuelingAroundTrainingSplit("unknown"), good);
  assert.deepEqual(fuelingAroundTrainingSplit(null), good);
});

test("daily-energy-solver: anche il recupero 'poor' cambia (1000 kcal: era 80/400/120, ora 50/450/100)", () => {
  const poor = computeNutritionDailyEnergyModel({
    ...ATHLETE_INPUT,
    recoveryStatus: "poor",
    plannedTraining: [{ durationMinutes: 120, kcalTarget: 1000, tssTarget: 100, avgPowerW: 200 }],
  });
  // Nessun atleta resta sui valori di prima: il tier più protettivo perde 30 kcal di pre e
  // 20 di post a favore dell'intra (+50). Test di consapevolezza, non solo di somma.
  assert.equal(poor.fueling.preKcal, 50);
  assert.equal(poor.fueling.intraKcal, 450);
  assert.equal(poor.fueling.postKcal, 100);
  assert.equal(poor.totals.fuelingKcal, 600);
});

test("daily-energy-solver: caso base 1000 kcal training → intra 500, pre 33, post 67, pasti 400", () => {
  const model = computeNutritionDailyEnergyModel({
    ...ATHLETE_INPUT,
    recoveryStatus: "good",
    plannedTraining: [{ durationMinutes: 120, kcalTarget: 1000, tssTarget: 100, avgPowerW: 200 }],
  });
  assert.equal(model.training.kcal, 1000);
  assert.equal(model.fueling.intraKcal, 500); // 50% del training (regola Mario)
  assert.equal(model.fueling.preKcal, 33); // 1/3 del 10% pre+post → 33,3 kcal
  assert.equal(model.fueling.postKcal, 67); // 2/3 del 10% pre+post → 66,7 kcal
  assert.equal(model.totals.fuelingKcal, 600); // 60% attorno alla seduta
  // Ai pasti va il 40% del training (sopra BMR + lifestyle).
  assert.equal(model.totals.dailyKcal - model.totals.fuelingKcal, model.totals.mealsKcal);
  assert.equal(
    model.totals.mealsKcal - model.bmrKcal - model.lifestyle.kcal,
    400,
  );
});

test("daily-energy-solver: pre+intra+post esauriscono il bucket fueling anche con mealTrainingFraction ≠ 0.40", () => {
  for (const mealTrainingFraction of [0.4, 0.44, 0.48]) {
    for (const recoveryStatus of RECOVERY_TIERS) {
      const model = computeNutritionDailyEnergyModel({
        ...ATHLETE_INPUT,
        recoveryStatus,
        plannedTraining: [{ durationMinutes: 120, kcalTarget: 1000, tssTarget: 100, avgPowerW: 200 }],
        performanceIntegration: { ...protectiveIntegration(), mealTrainingFraction },
      });
      const { preKcal, intraKcal, postKcal } = model.fueling;
      const sum = preKcal + intraKcal + postKcal;
      // ±2 kcal = solo arrotondamento a kcal intere delle quattro grandezze.
      assert.ok(
        Math.abs(sum - model.totals.fuelingKcal) <= 2,
        `quota pasti ${mealTrainingFraction} / recupero ${recoveryStatus}: pre+intra+post ${sum} ≠ bucket ${model.totals.fuelingKcal}`,
      );
      assert.ok(
        Math.abs(postKcal - 2 * preKcal) <= 1,
        `quota pasti ${mealTrainingFraction} / recupero ${recoveryStatus}: post ${postKcal} ≠ 2 × pre ${preKcal}`,
      );
    }
  }
  // Caso citato dall'integrazione performance: quota pasti 0.48 → bucket 520 kcal su 1000.
  const protective = computeNutritionDailyEnergyModel({
    ...ATHLETE_INPUT,
    recoveryStatus: "good",
    plannedTraining: [{ durationMinutes: 120, kcalTarget: 1000, tssTarget: 100, avgPowerW: 200 }],
    performanceIntegration: { ...protectiveIntegration(), mealTrainingFraction: 0.48 },
  });
  assert.equal(protective.totals.fuelingKcal, 520);
  assert.equal(protective.fueling.intraKcal, 433); // 520 × (0.50/0.60)
  assert.equal(protective.fueling.preKcal, 29);
  assert.equal(protective.fueling.postKcal, 58);
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

/**
 * Tetto CHO/h della fascia ELITE — decisione Mario 8 ago 2026: «120/130 era un esempio,
 * alza quel limite fino a 200 e stiamo tranquilli». Il tetto è una GUARDIA, non un
 * obiettivo: a decidere i grammi è il consumo. Il test fissa il tetto EFFETTIVO nei tre
 * stati di recupero (poor→target, moderate→target+5, good→max), non la sola costante:
 * è lì che il freno morde davvero.
 */
test("fascia elite: il tetto CHO/h arriva a 200 e la modulazione da recupero resta proporzionata", () => {
  // Seduta lunga e intensa di un atleta elite: 4h a 320 W medi (≈5,3 W/kg su 60 kg),
  // kcal alte quanto basta perché la domanda di CHO sfondi qualunque tetto.
  const base = {
    weightKg: 60,
    heightCm: 178,
    birthDate: "1995-01-01",
    sex: "male" as const,
    bodyFatPct: 8,
    ftpWatts: 320,
    vo2maxMlMinKg: 70,
    plannedTraining: [{ durationMinutes: 240, avgPowerW: 320, kcalTarget: 4000, tssTarget: null }],
  };

  const good = computeNutritionDailyEnergyModel({ ...base, recoveryStatus: "good" });
  const moderate = computeNutritionDailyEnergyModel({ ...base, recoveryStatus: "moderate" });
  const poor = computeNutritionDailyEnergyModel({ ...base, recoveryStatus: "poor" });

  assert.equal(good.fueling.evidenceMaxChoGPerHour, 200, "il tetto della fascia elite deve essere 200");
  assert.equal(good.fueling.evidenceTargetChoGPerHour, 160, "il target elite deve essere 160 (i triathleti citati da Mario)");
  assert.equal(good.fueling.capabilityTier, "elite");

  // Con domanda che sfonda, ogni stato di recupero si ferma al PROPRIO tetto.
  assert.ok(good.fueling.adjustedChoGPerHour <= 200, "recupero buono non supera il tetto");
  assert.ok(moderate.fueling.adjustedChoGPerHour <= 165, "recupero moderato si ferma a target+5");
  assert.ok(poor.fueling.adjustedChoGPerHour <= 160, "recupero scarso si ferma al target");

  // La protezione da recupero resta un ORDINE, non un gradino: buono >= moderato >= scarso.
  assert.ok(good.fueling.adjustedChoGPerHour >= moderate.fueling.adjustedChoGPerHour);
  assert.ok(moderate.fueling.adjustedChoGPerHour >= poor.fueling.adjustedChoGPerHour);
});
