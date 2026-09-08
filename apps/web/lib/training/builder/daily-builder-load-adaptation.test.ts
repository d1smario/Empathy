import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectUnwantedSupercompensation,
  resolveDailyBuilderLoadAdaptation,
} from "@/lib/training/builder/daily-builder-load-adaptation";
import type { AdaptationGuidance } from "@/lib/empathy/schemas/adaptation";

const greenGuidance: AdaptationGuidance = {
  scorePct: 88,
  trafficLight: "green",
  expectedAdaptation: 70,
  observedAdaptation: 62,
  reductionMinPct: 0,
  reductionMaxPct: 0,
  keepProgramUnchanged: true,
  guidance: "Ok",
  likelyDrivers: [],
};

const redGuidance: AdaptationGuidance = {
  scorePct: 40,
  trafficLight: "red",
  expectedAdaptation: 70,
  observedAdaptation: 28,
  reductionMinPct: 50,
  reductionMaxPct: 75,
  keepProgramUnchanged: false,
  guidance: "Riduci",
  likelyDrivers: ["sleep_circadian"],
};

describe("resolveDailyBuilderLoadAdaptation", () => {
  it("reduces on red score", () => {
    const out = resolveDailyBuilderLoadAdaptation({
      adaptationGuidance: redGuidance,
      operationalContext: {
        mode: "protective",
        loadScale: 0.65,
        loadScalePct: 65,
        headline: "Protettivo",
        guidance: "Recovery bassa",
      },
      bioenergeticModulation: null,
    });
    assert.equal(out.direction, "reduce");
    assert.ok(out.loadScale < 0.7, `loadScale ${out.loadScale} atteso < 0.7`);
  });

  it("can increase slightly on high score without unwanted supercompensation", () => {
    const out = resolveDailyBuilderLoadAdaptation({
      adaptationGuidance: { ...greenGuidance, scorePct: 102 },
      operationalContext: {
        mode: "normal",
        loadScale: 1,
        loadScalePct: 100,
        headline: "Standard",
        guidance: "Ok",
      },
      bioenergeticModulation: null,
      recoveryStatus: "good",
    });
    assert.equal(out.unwantedSupercompensation, false);
    assert.ok(out.loadScale > 1, `loadScale ${out.loadScale} atteso > 1`);
    assert.ok(out.loadScale <= 1.08, `loadScale ${out.loadScale} atteso <= 1.08`);
  });

  it("flags unwanted supercompensation when protective and executed above plan", () => {
    assert.equal(
      detectUnwantedSupercompensation({
        adaptationGuidance: greenGuidance,
        operationalContext: {
          mode: "protective",
          loadScale: 0.7,
          loadScalePct: 70,
          headline: "Protettivo",
          guidance: "",
        },
        adaptationLoop: {
          status: "watch",
          executionDeltaTss: 25,
          divergenceScore: 20,
          executionCompliancePct: 110,
        },
        recoveryStatus: "poor",
      }),
      true,
    );
  });
});
