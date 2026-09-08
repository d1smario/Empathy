import assert from "node:assert/strict";
import test from "node:test";
import { ATHLETE_HR_THRESHOLDS_UNAVAILABLE, athleteHrThresholdsFromProfile } from "@empathy/domain-training";
import { dailyMetricMap, refKpisLastNDays } from "./executed-metric-aggregates";

const ROW = {
  date: "2026-05-16",
  tss: 0,
  duration_minutes: 116,
  kcal: 0,
  trace_summary: { hr_avg_bpm: 140 },
  lactate_mmoll: null,
  glucose_mmol: null,
  smo2: null,
};

const ATHLETE_168 = athleteHrThresholdsFromProfile({ thresholdHrBpm: 168 });

test("refKpisLastNDays: con la soglia dell'atleta stima il carico anche se tss = 0", () => {
  const kpis = refKpisLastNDays([ROW], 7, "2026-05-17", ATHLETE_168);
  assert.ok(kpis.tss > 0, `atteso carico > 0, ottenuto ${kpis.tss}`);
});

/**
 * R-carico #2/#3 — senza soglie il carico NON si inventa: la seduta non entra nella
 * somma (limite inferiore) invece di portarci dentro il ripiego per durata (40).
 */
test("refKpisLastNDays: senza soglie dell'atleta la seduta non porta carico finto", () => {
  const kpis = refKpisLastNDays([ROW], 7, "2026-05-17", ATHLETE_HR_THRESHOLDS_UNAVAILABLE);
  assert.equal(kpis.tss, 0);
  // I minuti restano: la seduta esiste, è il CARICO a non essere misurabile.
  assert.equal(kpis.totalMinutes, 116);
});

test("dailyMetricMap: stessa regola sull'aggregato giornaliero", () => {
  const conSoglia = dailyMetricMap([ROW], ATHLETE_168).get("2026-05-16");
  const senzaSoglia = dailyMetricMap([ROW], ATHLETE_HR_THRESHOLDS_UNAVAILABLE).get("2026-05-16");
  assert.ok((conSoglia?.tss ?? 0) > 0);
  assert.equal(senzaSoglia?.tss, 0);
  assert.equal(senzaSoglia?.minutes, 116);
});

/** Caso del revisore: 85' a FC 110, atleta con soglia 188 → 48, non 38. */
test("refKpisLastNDays: 85'@110bpm con soglia 188 → 48 (era 38)", () => {
  const kpis = refKpisLastNDays(
    [{ ...ROW, duration_minutes: 85, trace_summary: { hr_avg_bpm: 110 } }],
    7,
    "2026-05-17",
    athleteHrThresholdsFromProfile({ thresholdHrBpm: 188, maxHrBpm: 202 }),
  );
  assert.equal(kpis.tss, 48);
});
