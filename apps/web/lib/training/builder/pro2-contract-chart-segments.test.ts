import assert from "node:assert/strict";
import test from "node:test";
import { pro2BuilderContractToExpandedChartSegments } from "./pro2-contract-chart-segments";
import type { Pro2BuilderSessionContract, Pro2RenderProfile } from "./pro2-session-contract";
import {
  buildPro2BuilderSessionContract,
  defaultManualPlanBlock,
  manualPlanBlocksToChartSegments,
  resolveBlockDurationSeconds,
  type ManualPlanBlock,
  type PlanExpandOpts,
} from "./manual-plan-block";

function minimalContract(blocks: Pro2BuilderSessionContract["blocks"]): Pro2BuilderSessionContract {
  return {
    version: 1,
    source: "builder",
    family: "aerobic",
    discipline: "cycling",
    sessionName: "Test",
    summary: { durationSec: 3600, tss: 80, kcal: 0, kj: 0, avgPowerW: 200 },
    renderProfile: { intensityUnit: "watt", ftpW: 250, hrMax: 185, lengthMode: "time", speedRefKmh: 32 },
    blocks,
  };
}

test("expanded chart: interval2 yields work + recovery segments per repeat", () => {
  const contract = minimalContract([
    {
      id: "w",
      label: "Riscaldamento",
      kind: "ramp",
      durationMinutes: 12,
      chart: {
        minutes: 12,
        seconds: 0,
        intensity: "Z1",
        startIntensity: "Z1",
        endIntensity: "Z2",
        intensity2: "Z1",
        intensity3: "Z5",
        repeats: 1,
        workSeconds: 0,
        recoverSeconds: 0,
        step1Seconds: 0,
        step2Seconds: 0,
        step3Seconds: 0,
        pyramidSteps: 1,
        pyramidStepSeconds: 0,
        pyramidStartTarget: 0,
        pyramidEndTarget: 0,
        distanceKm: 0,
        gradePercent: 0,
        elevationMeters: 0,
        cadence: "",
        frequencyHint: "",
        loadFactor: 1,
      },
    },
    {
      id: "m",
      label: "Serie principali",
      kind: "interval2",
      durationMinutes: 45,
      intensityCue: "PRESET_VO2_Z5",
      chart: {
        minutes: 45,
        seconds: 0,
        intensity: "Z5",
        startIntensity: "Z5",
        endIntensity: "Z5",
        intensity2: "Z1",
        intensity3: "Z5",
        repeats: 3,
        workSeconds: 120,
        recoverSeconds: 90,
        step1Seconds: 0,
        step2Seconds: 0,
        step3Seconds: 0,
        pyramidSteps: 1,
        pyramidStepSeconds: 0,
        pyramidStartTarget: 0,
        pyramidEndTarget: 0,
        distanceKm: 0,
        gradePercent: 0,
        elevationMeters: 0,
        cadence: "",
        frequencyHint: "",
        loadFactor: 1,
      },
    },
    {
      id: "c",
      label: "Defaticamento",
      kind: "ramp",
      durationMinutes: 10,
      chart: {
        minutes: 10,
        seconds: 0,
        intensity: "Z2",
        startIntensity: "Z2",
        endIntensity: "Z1",
        intensity2: "Z1",
        intensity3: "Z5",
        repeats: 1,
        workSeconds: 0,
        recoverSeconds: 0,
        step1Seconds: 0,
        step2Seconds: 0,
        step3Seconds: 0,
        pyramidSteps: 1,
        pyramidStepSeconds: 0,
        pyramidStartTarget: 0,
        pyramidEndTarget: 0,
        distanceKm: 0,
        gradePercent: 0,
        elevationMeters: 0,
        cadence: "",
        frequencyHint: "",
        loadFactor: 1,
      },
    },
  ]);

  const segs = pro2BuilderContractToExpandedChartSegments(contract);
  assert.ok(segs.length >= 7, `expected warm + 3×(work+rec) + cool, got ${segs.length}`);
  assert.ok(segs.some((s) => /lavoro/i.test(s.label)));
  assert.ok(segs.some((s) => /recupero/i.test(s.label)));
  assert.ok(segs[0]!.label.includes("Riscaldamento"));
  assert.ok(segs[segs.length - 1]!.label.includes("Defaticamento"));
});

/* ───────────────────────── B6 — blocchi governati dalla DISTANZA (km) ─────────────────────────
 * SPECULARE O NIENTE: la stessa seduta deve produrre gli stessi secondi sia
 * nell'espansione builder (manual-plan-block) sia in quella calendario/export (ladder). */

const RENDER_PROFILE: Pro2RenderProfile = {
  intensityUnit: "watt",
  ftpW: 250,
  hrMax: 185,
  lengthMode: "time",
  speedRefKmh: 32,
};

const PLAN_OPTS: PlanExpandOpts = {
  unit: "watt",
  ftpW: 250,
  hrMax: 185,
  lengthMode: "time",
  speedRefKmh: 32,
};

function distanceBlock(kind: "steady" | "ramp", distanceKm: number, label: string): ManualPlanBlock {
  return { ...defaultManualPlanBlock(kind, label), lengthMode: "distance", distanceKm };
}

test("B6 distance: 4 km @ 32 km/h = 450 s in entrambe le espansioni", () => {
  const blocks = [distanceBlock("steady", 4, "Fondo su km")];
  assert.equal(resolveBlockDurationSeconds(blocks[0]!, PLAN_OPTS), 450);

  const builderSegs = manualPlanBlocksToChartSegments(blocks, PLAN_OPTS);
  const builderTotal = builderSegs.reduce((s, x) => s + x.durationSeconds, 0);
  assert.equal(builderTotal, 450);

  const contract = buildPro2BuilderSessionContract({
    blocks,
    renderProfile: RENDER_PROFILE,
    discipline: "cycling",
    sessionName: "B6 distance",
  });
  assert.equal(contract.blocks?.[0]?.chart?.lengthMode, "distance");
  const ladderSegs = pro2BuilderContractToExpandedChartSegments(contract);
  const ladderTotal = ladderSegs.reduce((s, x) => s + x.durationSeconds, 0);
  assert.equal(ladderTotal, builderTotal);
});

test("B6 distance: mix steady km + ramp km + intervalli a tempo resta speculare", () => {
  const blocks = [
    distanceBlock("steady", 4, "Fondo"),
    distanceBlock("ramp", 2, "Progressivo"),
    { ...defaultManualPlanBlock("interval2", "Serie"), repeats: 2, workSeconds: 120, recoverSeconds: 60 },
  ];
  const builderTotal = manualPlanBlocksToChartSegments(blocks, PLAN_OPTS).reduce(
    (s, x) => s + x.durationSeconds,
    0,
  );
  /* 450 + 225 + 2×(120+60) = 1035 */
  assert.equal(builderTotal, 1035);

  const contract = buildPro2BuilderSessionContract({
    blocks,
    renderProfile: RENDER_PROFILE,
    discipline: "cycling",
    sessionName: "B6 mix",
  });
  const ladderTotal = pro2BuilderContractToExpandedChartSegments(contract).reduce(
    (s, x) => s + x.durationSeconds,
    0,
  );
  assert.equal(ladderTotal, builderTotal);
});

test("B6 retro-compat: blocco senza lengthMode segue il modo legacy di sessione", () => {
  const legacyOpts: PlanExpandOpts = { ...PLAN_OPTS, lengthMode: "distance" };
  const legacyBlock = { ...defaultManualPlanBlock("steady", "Legacy"), distanceKm: 4 };
  assert.equal(legacyBlock.lengthMode, undefined);
  assert.equal(resolveBlockDurationSeconds(legacyBlock, legacyOpts), 450);
  /* Modo esplicito "time" vince sul legacy di sessione "distance". */
  const explicitTime = { ...legacyBlock, lengthMode: "time" as const, minutes: 10, seconds: 0 };
  assert.equal(resolveBlockDurationSeconds(explicitTime, legacyOpts), 600);
});
