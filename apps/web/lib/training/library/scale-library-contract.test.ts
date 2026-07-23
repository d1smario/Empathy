import test from "node:test";
import assert from "node:assert/strict";
import { scaleLibraryContract } from "./scale-library-contract";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";

function contract(): Pro2BuilderSessionContract {
  return {
    version: 1,
    source: "builder",
    family: "aerobic",
    discipline: "Run",
    sessionName: "Scale test",
    summary: { durationSec: 3600, tss: 100, kcal: 500, kj: 2000, avgPowerW: 200 },
    renderProfile: { intensityUnit: "watt", ftpW: 250, hrMax: 190, lengthMode: "time", speedRefKmh: 35 },
    blocks: [
      {
        id: "b1",
        label: "Main",
        kind: "steady",
        durationMinutes: 60,
        intensityCue: "Z3",
        chart: {
          minutes: 60,
          seconds: 0,
          intensity: "Z3",
          startIntensity: "Z3",
          endIntensity: "Z3",
          intensity2: "Z1",
          intensity3: "Z5",
          repeats: 1,
          workSeconds: 300,
          recoverSeconds: 120,
          step1Seconds: 120,
          step2Seconds: 90,
          step3Seconds: 60,
          pyramidSteps: 5,
          pyramidStepSeconds: 180,
          pyramidStartTarget: 100,
          pyramidEndTarget: 200,
          distanceKm: 0,
          gradePercent: 0,
          elevationMeters: 0,
          cadence: "",
          frequencyHint: "",
          loadFactor: 1,
        },
      },
    ],
  };
}

test("scaleLibraryContract: 0.8 reduces tss and duration", () => {
  const scaled = scaleLibraryContract(contract(), 0.8);
  assert.equal(scaled.summary?.tss, 80);
  assert.equal(scaled.blocks[0]?.durationMinutes, 48);
});

test("scaleLibraryContract: 1.0 is identity", () => {
  const base = contract();
  const scaled = scaleLibraryContract(base, 1);
  assert.equal(scaled.summary?.tss, base.summary?.tss);
});

/* B6 — blocco governato dalla distanza: lo scaling passa da distanceKm (la durata deriva da lì). */
test("scaleLibraryContract: distance-mode block scales distanceKm, time-mode keeps it", () => {
  const base = contract();
  const b1 = base.blocks?.[0];
  assert.ok(b1?.chart);
  b1.chart.lengthMode = "distance";
  b1.chart.distanceKm = 4;
  const scaled = scaleLibraryContract(base, 0.5);
  assert.equal(scaled.blocks?.[0]?.chart?.distanceKm, 2);

  const timeBase = contract();
  const t1 = timeBase.blocks?.[0];
  assert.ok(t1?.chart);
  t1.chart.lengthMode = "time";
  t1.chart.distanceKm = 4;
  const timeScaled = scaleLibraryContract(timeBase, 0.5);
  /* Blocco a tempo: distanceKm è informativo, resta invariato. */
  assert.equal(timeScaled.blocks?.[0]?.chart?.distanceKm, 4);
});
