import assert from "node:assert/strict";
import test from "node:test";
import { ATHLETE_HR_THRESHOLDS_UNAVAILABLE, athleteHrThresholdsFromProfile } from "@empathy/domain-training";
import { computeDailyLoadSeries, type ExecutedWorkoutLoadRow } from "./load-series";

const ROW: ExecutedWorkoutLoadRow = {
  date: "2026-05-16",
  tss: 0,
  duration_minutes: 85,
  trace_summary: { hr_avg_bpm: 110 },
  lactate_mmoll: null,
  glucose_mmol: null,
  smo2: null,
};

/**
 * R-carico #3 — `load-series.ts` chiamava il motore senza nessuna soglia dell'atleta:
 * la serie giornaliera (carico esterno, fitness, form) veniva alimentata dal ripiego
 * per durata. Caso del revisore: 85' a FC 110, atleta con soglia 188 → 48, non 38.
 */
test("computeDailyLoadSeries: con la soglia dell'atleta la giornata vale 48 (era 38)", () => {
  const series = computeDailyLoadSeries([ROW], {
    athlete: athleteHrThresholdsFromProfile({ thresholdHrBpm: 188, maxHrBpm: 202 }),
  });
  assert.equal(series.length, 1);
  assert.equal(series[0]!.trainingLoadDaily, 48);
});

test("computeDailyLoadSeries: senza soglie la seduta non entra con un carico inventato", () => {
  const series = computeDailyLoadSeries([ROW], { athlete: ATHLETE_HR_THRESHOLDS_UNAVAILABLE });
  assert.equal(series.length, 1);
  assert.equal(series[0]!.trainingLoadDaily, 0);
});

test("computeDailyLoadSeries: un `tss` già scritto resta la fonte di verità", () => {
  const series = computeDailyLoadSeries([{ ...ROW, tss: 91 }], {
    athlete: ATHLETE_HR_THRESHOLDS_UNAVAILABLE,
  });
  assert.equal(series[0]!.trainingLoadDaily, 91);
});
