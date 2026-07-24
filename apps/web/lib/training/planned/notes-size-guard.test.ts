import test from "node:test";
import assert from "node:assert/strict";
import {
  PLANNED_NOTES_MAX_CHARS,
  buildPlannedNotesWithSizeGuard,
  compressPro2ContractForNotes,
} from "./notes-size-guard";
import { contractToPlannedWorkoutRow } from "@/lib/training/library/contract-to-planned-row";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import {
  BUILDER_SESSION_JSON_TAG,
  type Pro2BuilderBlockContract,
  type Pro2BuilderSessionContract,
} from "@/lib/training/builder/pro2-session-contract";

const META_LINE = '[PRO2_BUILDER_LIBRARY]{"v":1,"family":"aerobic"}';

function baseBlock(id: string): Pro2BuilderBlockContract {
  return {
    id,
    label: "Steady",
    kind: "steady",
    durationMinutes: 10,
    intensityCue: "Z2",
    chart: {
      minutes: 10,
      seconds: 0,
      intensity: "Z2",
      startIntensity: "Z2",
      endIntensity: "Z2",
      intensity2: "Z1",
      intensity3: "Z3",
      repeats: 1,
      workSeconds: 180,
      recoverSeconds: 90,
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
  };
}

function makeContract(blocks: Pro2BuilderBlockContract[]): Pro2BuilderSessionContract {
  return {
    version: 1,
    source: "builder",
    family: "aerobic",
    discipline: "Cycling",
    sessionName: "Guard test",
    summary: { durationSec: 3600, tss: 55, kcal: 400, kj: 1670, avgPowerW: 180 },
    renderProfile: { intensityUnit: "watt", ftpW: 250, hrMax: 190, lengthMode: "time", speedRefKmh: 35 },
    blocks,
  };
}

/** Contratto gonfiato oltre 32k su campi COMPRIMIBILI (blocks[].notes + mediaUrl). */
function bloatedCompressibleContract(): Pro2BuilderSessionContract {
  const blocks = Array.from({ length: 12 }, (_, i) => ({
    ...baseBlock(`b${i}`),
    notes: "nota libera ridondante ".repeat(200), // ~4.6k per blocco → >50k totali
    mediaUrl: "https://example.com/video-lunghissimo",
  }));
  return makeContract(blocks);
}

/** Contratto gonfiato su campi STRUTTURALI (label): la compressione non può salvarlo. */
function bloatedIncompressibleContract(): Pro2BuilderSessionContract {
  const blocks = Array.from({ length: 12 }, (_, i) => ({
    ...baseBlock(`b${i}`),
    label: `Blocco ${i} ${"x".repeat(4000)}`,
  }));
  return makeContract(blocks);
}

test("guard: contratto piccolo passa intatto (non compresso, round-trip valido)", () => {
  const contract = makeContract([{ ...baseBlock("b1"), notes: "tecnica: gambe sciolte" }]);
  const result = buildPlannedNotesWithSizeGuard({ metaLine: META_LINE, contract });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.compressed, false);
  assert.ok(result.notes.length <= PLANNED_NOTES_MAX_CHARS);
  const parsed = parsePro2BuilderSessionFromNotes(result.notes);
  assert.equal(parsed?.sessionName, "Guard test");
  // Non compresso: le note libere del blocco sopravvivono.
  assert.equal(parsed?.blocks?.[0]?.notes, "tecnica: gambe sciolte");
});

test("guard: contratto oltre 32k su campi opzionali → compresso VALIDO, blocchi integri", () => {
  const contract = bloatedCompressibleContract();
  const result = buildPlannedNotesWithSizeGuard({ metaLine: META_LINE, contract });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.compressed, true);
  assert.ok(result.notes.length <= PLANNED_NOTES_MAX_CHARS);
  const parsed = parsePro2BuilderSessionFromNotes(result.notes);
  assert.ok(parsed, "il contratto compresso deve restare parsabile");
  assert.equal(parsed?.sessionName, "Guard test");
  // MAI i blocchi: la struttura della seduta resta integra, cadono solo note/media.
  assert.equal(parsed?.blocks?.length, 12);
  assert.equal(parsed?.blocks?.[0]?.notes, undefined);
  assert.equal(parsed?.blocks?.[0]?.mediaUrl, undefined);
  assert.equal(parsed?.blocks?.[0]?.chart?.minutes, 10);
});

test("guard: incomprimibile oltre il limite → errore esplicito, MAI slice", () => {
  const contract = bloatedIncompressibleContract();
  const result = buildPlannedNotesWithSizeGuard({ metaLine: META_LINE, contract });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error, "contract_too_large");
  assert.ok(result.length > PLANNED_NOTES_MAX_CHARS);
});

test("compressPro2ContractForNotes: strip chirurgico, il resto non si tocca", () => {
  const contract = makeContract([
    {
      ...baseBlock("b1"),
      notes: "via",
      mediaUrl: "https://example.com/x",
      lifestyleRx: { practiceCategory: "yoga", rounds: 3, mediaUrl: "https://example.com/y" },
    },
  ]);
  contract.sessionInterpretation = {
    modelVersion: 1,
    layer: "deterministic_session_facet_template",
    coachPrompts: ["domanda"],
    facilitationHints: ["aiuto"],
    sectors: [],
    generatedAt: "2026-07-24T00:00:00.000Z",
  };
  const compressed = compressPro2ContractForNotes(contract);
  assert.equal(compressed.blocks?.[0]?.notes, undefined);
  assert.equal(compressed.blocks?.[0]?.mediaUrl, undefined);
  assert.equal(compressed.blocks?.[0]?.lifestyleRx?.mediaUrl, undefined);
  assert.equal(compressed.blocks?.[0]?.lifestyleRx?.practiceCategory, "yoga");
  assert.deepEqual(compressed.sessionInterpretation?.coachPrompts, []);
  assert.deepEqual(compressed.sessionInterpretation?.facilitationHints, []);
  // I settori (dati di render) e il timestamp restano.
  assert.equal(compressed.sessionInterpretation?.generatedAt, "2026-07-24T00:00:00.000Z");
  assert.equal(compressed.blocks?.[0]?.chart?.repeats, 1);
});

test("contractToPlannedWorkoutRow: contratto gonfiato → notes compresse e parsabili", () => {
  const row = contractToPlannedWorkoutRow({
    athleteId: "athlete-1",
    date: "2026-07-24",
    contract: bloatedCompressibleContract(),
  });
  assert.ok(row.notes);
  assert.ok(row.notes!.length <= PLANNED_NOTES_MAX_CHARS, "mai oltre il limite guard");
  const parsed = parsePro2BuilderSessionFromNotes(row.notes);
  assert.ok(parsed, "MAI un JSON troncato imparsabile in notes");
  assert.equal(parsed?.blocks?.length, 12);
});

test("contractToPlannedWorkoutRow: incomprimibile → solo riga meta, nessun JSON troncato", () => {
  const row = contractToPlannedWorkoutRow({
    athleteId: "athlete-1",
    date: "2026-07-24",
    contract: bloatedIncompressibleContract(),
    libraryItemId: "lib-item-1",
  });
  assert.ok(row.notes);
  // Degrado esplicito: resta la meta (parsabile, marca la riga come builder)…
  assert.ok(row.notes!.startsWith("[PRO2_BUILDER_LIBRARY]"));
  assert.ok(row.notes!.includes("lib-item-1"));
  // …ma NESSUN frammento di contratto: o intero o assente, mai a metà.
  assert.ok(!row.notes!.includes(BUILDER_SESSION_JSON_TAG));
  assert.equal(parsePro2BuilderSessionFromNotes(row.notes), null);
  assert.ok(row.notes!.length <= PLANNED_NOTES_MAX_CHARS);
});
