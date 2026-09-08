import assert from "node:assert/strict";
import test from "node:test";
import {
  ATHLETE_HR_THRESHOLDS_UNAVAILABLE,
  athleteHrThresholdsFromProfile,
  inferEmpathyTrainingLoadDetailForSession,
  inferEmpathyTrainingLoadForSession,
  resolveAthleteLthrBpm,
  trainingLoadFromHrSession,
  trainingLoadFromPowerSession,
} from "./empathy-infer-training-load";

/** Atleta reale di produzione: `threshold_hr_bpm` 188, `max_hr_bpm` 202. */
const ATHLETE_188 = athleteHrThresholdsFromProfile({ thresholdHrBpm: 188, maxHrBpm: 202 });
const ATHLETE_168 = athleteHrThresholdsFromProfile({ lt2HeartRate: 168 });
const ATHLETE_170 = athleteHrThresholdsFromProfile({ thresholdHrBpm: 170 });
const NO_THRESHOLDS = ATHLETE_HR_THRESHOLDS_UNAVAILABLE;

test("trainingLoadFromPowerSession: 1h at FTP ≈ 100", () => {
  const tl = trainingLoadFromPowerSession({ durationMinutes: 60, avgPowerW: 250, ftpW: 250 });
  assert.equal(tl, 100);
});

test("trainingLoadFromHrSession: 1h a LTHR ≈ 100 (hrTSS parity col TSS potenza)", () => {
  const tl = trainingLoadFromHrSession({ durationMinutes: 60, hrAvgBpm: 168, athlete: ATHLETE_168 });
  assert.equal(tl, 100);
});

test("trainingLoadFromHrSession: 81min @119bpm, LTHR 168 ≈ 68 (caso reale, era 19)", () => {
  const tl = trainingLoadFromHrSession({ durationMinutes: 81, hrAvgBpm: 119, athlete: ATHLETE_168 });
  assert.equal(tl, 68);
});

test("inferEmpathyTrainingLoadForSession: vendor wins", () => {
  assert.equal(
    inferEmpathyTrainingLoadForSession({
      vendorLoad: 85,
      durationMinutes: 60,
      hrAvgBpm: 150,
      athlete: NO_THRESHOLDS,
    }),
    85,
  );
});

test("inferEmpathyTrainingLoadForSession: hrTSS quando c'è FC + LTHR, no potenza", () => {
  const tl = inferEmpathyTrainingLoadForSession({
    vendorLoad: 0,
    durationMinutes: 81,
    hrAvgBpm: 119,
    athlete: ATHLETE_168,
  });
  assert.equal(tl, 68);
});

test("inferEmpathyTrainingLoadForSession: HR senza LTHR stima da FC max dell'atleta", () => {
  const tl = inferEmpathyTrainingLoadForSession({
    durationMinutes: 60,
    hrAvgBpm: 140,
    athlete: athleteHrThresholdsFromProfile({ maxHrBpm: 190 }),
  });
  // LTHR ≈ 0.9×190 = 171 → IF 0.819 → ~67
  assert.ok(tl != null && tl >= 60 && tl <= 75);
});

/**
 * Regressione S4-hrtss — la soglia dell'hrTSS deve venire dall'ATLETA, mai dalla seduta.
 * Caso reale (Garmin, 2026-08-14, ROAD_BIKING): 85', FC media 110, picco di seduta 132.
 * L'atleta ha threshold_hr_bpm 188 (max_hr_bpm 202) → carico corretto 48.
 * Usando il picco della seduta come «FC max atleta» (0,9×132 = 118,8) usciva 121: +152%.
 */
test("hrTSS: uscita facile reale con soglia dell'atleta (188) → 48", () => {
  const tl = inferEmpathyTrainingLoadForSession({
    durationMinutes: 85,
    hrAvgBpm: 110,
    athlete: ATHLETE_188,
  });
  assert.equal(tl, 48);
});

/**
 * R-carico #2 — il ripiego per durata era esso stesso un numero finto.
 * `min(40, minuti × 0,45)` dava 40 a QUALSIASI seduta oltre ~89': 90' a 105 bpm e 364'
 * a 158 bpm ricevevano lo stesso carico, indistinguibile a valle da uno misurato.
 * Ora senza soglia il carico è ASSENTE (`null`, method `none`).
 */
test("nessuna soglia atleta ⇒ carico assente, non un 40 saturo", () => {
  const easy90 = inferEmpathyTrainingLoadDetailForSession({
    durationMinutes: 90,
    hrAvgBpm: 105,
    athlete: NO_THRESHOLDS,
  });
  const long364 = inferEmpathyTrainingLoadDetailForSession({
    durationMinutes: 364,
    hrAvgBpm: 158,
    athlete: NO_THRESHOLDS,
  });
  assert.deepEqual(easy90, { trainingLoad: null, method: "none" });
  assert.deepEqual(long364, { trainingLoad: null, method: "none" });
});

test("con la soglia dell'atleta le stesse due sedute NON collassano sullo stesso numero", () => {
  const easy90 = inferEmpathyTrainingLoadForSession({
    durationMinutes: 90,
    hrAvgBpm: 105,
    athlete: ATHLETE_170,
  });
  const long364 = inferEmpathyTrainingLoadForSession({
    durationMinutes: 364,
    hrAvgBpm: 158,
    athlete: ATHLETE_170,
  });
  assert.equal(easy90, 57);
  assert.equal(long364, 524);
});

test("seduta senza nessun segnale di intensità (solo durata) ⇒ carico assente", () => {
  // Era `60 × 0,45 = 27`: un numero che a schermo sembrava una misura.
  assert.deepEqual(
    inferEmpathyTrainingLoadDetailForSession({
      durationMinutes: 60,
      hrAvgBpm: null,
      athlete: ATHLETE_188,
    }),
    { trainingLoad: null, method: "none" },
  );
});

/**
 * R-carico #5 — guardia di plausibilità: `threshold_hr_bpm` è compilato a mano.
 * Con LTHR 95 l'uscita facile 85'@110 tornava a 187 (IF sopra il cap 1,15).
 */
test("soglia non plausibile (95 bpm) viene scartata: carico assente, non 187", () => {
  const athlete = athleteHrThresholdsFromProfile({ thresholdHrBpm: 95 });
  assert.equal(athlete.lthrBpm, null);
  assert.deepEqual(
    inferEmpathyTrainingLoadDetailForSession({ durationMinutes: 85, hrAvgBpm: 110, athlete }),
    { trainingLoad: null, method: "none" },
  );
});

test("guardia di plausibilità: range accettati e valori scartati", () => {
  // Range reali in produzione: threshold 150–190, max 170–221.
  assert.equal(athleteHrThresholdsFromProfile({ thresholdHrBpm: 150 }).lthrBpm, 150);
  assert.equal(athleteHrThresholdsFromProfile({ thresholdHrBpm: 190 }).lthrBpm, 190);
  assert.equal(athleteHrThresholdsFromProfile({ maxHrBpm: 170 }).athleteHrMaxBpm, 170);
  assert.equal(athleteHrThresholdsFromProfile({ maxHrBpm: 221 }).athleteHrMaxBpm, 221);
  // Fuori scala / non numerici: scartati, mai «aggiustati».
  assert.equal(athleteHrThresholdsFromProfile({ thresholdHrBpm: 0 }).lthrBpm, null);
  assert.equal(athleteHrThresholdsFromProfile({ thresholdHrBpm: -1 }).lthrBpm, null);
  assert.equal(athleteHrThresholdsFromProfile({ thresholdHrBpm: 119 }).lthrBpm, null);
  assert.equal(athleteHrThresholdsFromProfile({ thresholdHrBpm: 400 }).lthrBpm, null);
  assert.equal(athleteHrThresholdsFromProfile({ maxHrBpm: 132 }).athleteHrMaxBpm, null);
  assert.equal(athleteHrThresholdsFromProfile({ maxHrBpm: 231 }).athleteHrMaxBpm, null);
  assert.equal(athleteHrThresholdsFromProfile({ thresholdHrBpm: "non-un-numero" }).lthrBpm, null);
});

test("athleteHrThresholdsFromProfile: priorità lt2_heart_rate → threshold_hr_bpm → max_hr_bpm", () => {
  assert.equal(
    athleteHrThresholdsFromProfile({ lt2HeartRate: 175, thresholdHrBpm: 188, maxHrBpm: 202 }).lthrBpm,
    175,
  );
  assert.equal(athleteHrThresholdsFromProfile({ thresholdHrBpm: 188, maxHrBpm: 202 }).lthrBpm, 188);
  assert.equal(athleteHrThresholdsFromProfile({ maxHrBpm: 202 }).lthrBpm, null);
  assert.equal(athleteHrThresholdsFromProfile({ maxHrBpm: 202 }).athleteHrMaxBpm, 202);
});

test("resolveAthleteLthrBpm: senza dati atleta restituisce null (nessuna soglia di popolazione)", () => {
  assert.equal(resolveAthleteLthrBpm(NO_THRESHOLDS), null);
  assert.equal(resolveAthleteLthrBpm(athleteHrThresholdsFromProfile({ thresholdHrBpm: 188 })), 188);
  assert.equal(resolveAthleteLthrBpm(athleteHrThresholdsFromProfile({ maxHrBpm: 202 })), 202 * 0.9);
});

test("trainingLoadFromHrSession: null senza soglia dell'atleta", () => {
  assert.equal(
    trainingLoadFromHrSession({ durationMinutes: 85, hrAvgBpm: 110, athlete: NO_THRESHOLDS }),
    null,
  );
});

test("inferEmpathyTrainingLoadDetailForSession: dichiara il metodo usato", () => {
  assert.equal(
    inferEmpathyTrainingLoadDetailForSession({
      durationMinutes: 85,
      hrAvgBpm: 110,
      athlete: ATHLETE_188,
    }).method,
    "hr",
  );
  assert.equal(
    inferEmpathyTrainingLoadDetailForSession({
      durationMinutes: 85,
      hrAvgBpm: 110,
      athlete: NO_THRESHOLDS,
    }).method,
    "none",
  );
  assert.equal(
    inferEmpathyTrainingLoadDetailForSession({
      durationMinutes: 60,
      avgPowerW: 250,
      ftpW: 250,
      athlete: NO_THRESHOLDS,
    }).method,
    "power",
  );
  assert.equal(
    inferEmpathyTrainingLoadDetailForSession({
      durationMinutes: 60,
      vendorLoad: 85,
      athlete: NO_THRESHOLDS,
    }).method,
    "vendor",
  );
});
