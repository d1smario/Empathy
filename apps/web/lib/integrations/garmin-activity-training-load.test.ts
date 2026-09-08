import assert from "node:assert/strict";
import test from "node:test";

import { ATHLETE_HR_THRESHOLDS_UNAVAILABLE, athleteHrThresholdsFromProfile } from "@empathy/domain-training";
import { inferGarminTrainingLoad, inferGarminTrainingLoadDetail } from "@/lib/integrations/garmin-activity-materialize";

/**
 * S4-hrtss — il carico delle sedute Garmin senza potenza (hrTSS) deve usare la FC di
 * soglia dell'ATLETA, mai il picco di FC della singola seduta.
 *
 * Caso reale in produzione (executed_workouts, source `api_sync:garmin:activities`,
 * 2026-08-14, ROAD_BIKING): 85 minuti, FC media 110, picco di seduta 132.
 * L'atleta ha `athlete_profiles.threshold_hr_bpm` 188 e `max_hr_bpm` 202.
 *   - carico corretto (LTHR 188)                        →  48
 *   - carico scritto in DB (LTHR = 0,9 × 132 = 118,8)    → 121  (+152%)
 */
const EASY_RIDE: Record<string, unknown> = {
  activityId: 987654321,
  activityType: "ROAD_BIKING",
  startTimeInSeconds: 1786_000_000,
  durationInSeconds: 85 * 60,
  averageHeartRateInBeatsPerMinute: 110,
  maxHeartRateInBeatsPerMinute: 132,
};

const ATHLETE_188 = athleteHrThresholdsFromProfile({ thresholdHrBpm: 188, maxHrBpm: 202 });

test("hrTSS Garmin: uscita facile reale con soglia dell'atleta → 48, non 121", () => {
  assert.equal(inferGarminTrainingLoad(EASY_RIDE, 85, ATHLETE_188), 48);
});

/**
 * R-carico #2 — senza soglie dell'atleta il carico è ASSENTE.
 * Prima: 121 (soglia dal picco di seduta), poi 38 (ripiego per durata). Entrambi numeri
 * plausibili ma falsi, scritti su `executed_workouts.tss` dove nessuno a valle li
 * distingueva da una misura.
 */
test("hrTSS Garmin: senza soglie dell'atleta il carico è assente, non 121 e non 38", () => {
  const detail = inferGarminTrainingLoadDetail(EASY_RIDE, 85, ATHLETE_HR_THRESHOLDS_UNAVAILABLE);
  assert.deepEqual(detail, { trainingLoad: null, method: "none" });
});

/**
 * R-carico #2 — la saturazione del ripiego per durata: sopra ~89' TUTTE le sedute
 * ricevevano 40. In produzione sono 70 sedute Garmin con FC, senza potenza, di atleti
 * senza nessuna soglia (34 oltre gli 89 minuti, la più lunga 364').
 */
test("carico Garmin: 90'@105bpm e 364'@158bpm non collassano più sullo stesso 40", () => {
  const easy90 = { ...EASY_RIDE, durationInSeconds: 90 * 60, averageHeartRateInBeatsPerMinute: 105 };
  const long364 = { ...EASY_RIDE, durationInSeconds: 364 * 60, averageHeartRateInBeatsPerMinute: 158 };
  // Senza soglie: assente, non 40.
  assert.equal(inferGarminTrainingLoad(easy90, 90, ATHLETE_HR_THRESHOLDS_UNAVAILABLE), null);
  assert.equal(inferGarminTrainingLoad(long364, 364, ATHLETE_HR_THRESHOLDS_UNAVAILABLE), null);
  // Con la soglia dell'atleta: due carichi diversi, come dev'essere.
  const athlete170 = athleteHrThresholdsFromProfile({ thresholdHrBpm: 170 });
  assert.equal(inferGarminTrainingLoad(easy90, 90, athlete170), 57);
  assert.equal(inferGarminTrainingLoad(long364, 364, athlete170), 524);
});

test("hrTSS Garmin: con sola FC max atleta la soglia è 0,9 × FCmax", () => {
  const tl = inferGarminTrainingLoad(EASY_RIDE, 85, athleteHrThresholdsFromProfile({ maxHrBpm: 202 }));
  assert.equal(tl, 52);
});

test("carico Garmin: il valore del vendor vince comunque", () => {
  const tl = inferGarminTrainingLoad(
    { ...EASY_RIDE, trainingLoadScore: 64 },
    85,
    ATHLETE_HR_THRESHOLDS_UNAVAILABLE,
  );
  assert.equal(tl, 64);
});
