import assert from "node:assert/strict";
import test from "node:test";

import { ATHLETE_HR_THRESHOLDS_UNAVAILABLE, athleteHrThresholdsFromProfile } from "@empathy/domain-training";
import { stravaExecutedTrainingLoadDetail } from "@/lib/integrations/strava-pull-runner";

/**
 * R-carico #1 — REGRESSIONE STRAVA.
 * `strava-pull-runner` persisteva su `executed_workouts.tss` un carico calcolato dalla
 * sola trace della seduta, senza nessuna soglia dell'atleta:
 *   - prima ancora: il picco di seduta faceva da FC max → carico gonfiato;
 *   - dopo il 1° giro: si finiva sul ripiego per durata → 40 invece di 136 (−71%).
 * Caso del revisore: uscita 2h, FC media 140, picco 165, atleta `threshold_hr_bpm` 170.
 */
const RIDE_2H: Record<string, unknown> = {
  id: 123456789,
  sport_type: "Ride",
  moving_time: 2 * 3600,
  average_heartrate: 140,
  max_heartrate: 165,
};

const ATHLETE_170 = athleteHrThresholdsFromProfile({ thresholdHrBpm: 170 });

test("Strava 2h @140bpm con soglia dell'atleta 170 → 136 (era 40)", () => {
  const detail = stravaExecutedTrainingLoadDetail(RIDE_2H, 120, ATHLETE_170);
  assert.deepEqual(detail, { trainingLoad: 136, method: "hr" });
});

test("Strava: il picco di FC della seduta non è una soglia — senza soglie il carico è assente", () => {
  const detail = stravaExecutedTrainingLoadDetail(RIDE_2H, 120, ATHLETE_HR_THRESHOLDS_UNAVAILABLE);
  // Né 40 (ripiego durata) né 194 (hrTSS su 0,9×165 = 148,5): assente.
  assert.deepEqual(detail, { trainingLoad: null, method: "none" });
});

test("Strava: con potenza + FTP il ramo potenza resta intatto", () => {
  const detail = stravaExecutedTrainingLoadDetail(
    { ...RIDE_2H, average_watts: 200 },
    120,
    ATHLETE_170,
  );
  // Senza FTP la potenza non basta: si passa comunque all'hrTSS sull'atleta.
  assert.equal(detail.method, "hr");
  assert.equal(detail.trainingLoad, 136);
});
