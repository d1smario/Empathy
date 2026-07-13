import assert from "node:assert/strict";
import test from "node:test";
import {
  inferEmpathyTrainingLoadForSession,
  trainingLoadFromHrSession,
  trainingLoadFromPowerSession,
} from "./empathy-infer-training-load";

test("trainingLoadFromPowerSession: 1h at FTP ≈ 100", () => {
  const tl = trainingLoadFromPowerSession({ durationMinutes: 60, avgPowerW: 250, ftpW: 250 });
  assert.equal(tl, 100);
});

test("trainingLoadFromHrSession: 1h a LTHR ≈ 100 (hrTSS parity col TSS potenza)", () => {
  const tl = trainingLoadFromHrSession({ durationMinutes: 60, hrAvgBpm: 168, lthrBpm: 168 });
  assert.equal(tl, 100);
});

test("trainingLoadFromHrSession: 81min @119bpm, LTHR 168 ≈ 68 (caso reale, era 19)", () => {
  const tl = trainingLoadFromHrSession({ durationMinutes: 81, hrAvgBpm: 119, lthrBpm: 168 });
  assert.equal(tl, 68);
});

test("inferEmpathyTrainingLoadForSession: vendor wins", () => {
  assert.equal(
    inferEmpathyTrainingLoadForSession({
      vendorLoad: 85,
      durationMinutes: 60,
      hrAvgBpm: 150,
    }),
    85,
  );
});

test("inferEmpathyTrainingLoadForSession: hrTSS quando c'è FC + LTHR, no potenza", () => {
  const tl = inferEmpathyTrainingLoadForSession({
    vendorLoad: 0,
    durationMinutes: 81,
    hrAvgBpm: 119,
    lthrBpm: 168,
  });
  assert.equal(tl, 68);
});

test("inferEmpathyTrainingLoadForSession: HR senza LTHR stima da HRmax", () => {
  const tl = inferEmpathyTrainingLoadForSession({
    durationMinutes: 60,
    hrAvgBpm: 140,
    hrMaxBpm: 190,
  });
  // LTHR ≈ 0.9×190 = 171 → IF 0.819 → ~67
  assert.ok(tl >= 60 && tl <= 75);
});

test("inferEmpathyTrainingLoadForSession: duration-only fallback", () => {
  const tl = inferEmpathyTrainingLoadForSession({
    durationMinutes: 30,
    hrAvgBpm: null,
  });
  assert.ok(tl > 0 && tl <= 40);
});
