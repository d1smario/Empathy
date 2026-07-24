import assert from "node:assert/strict";
import test from "node:test";

import { BUILDER_SESSION_JSON_TAG, type Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { PHASE_DEFAULT_STIMULUS } from "@/lib/training/plan/plan-skeleton-mappers";
import type { PlannedWorkoutInsertPayload } from "@/lib/training/planned/clamp-planned-row";
import type { BuilderCatalogExerciseRow } from "@/modules/training/services/training-builder-catalog-api";
import { AEROBIC_STARTER_PRESETS } from "@/lib/training/library/starter-pack-aerobic";
import type { AthleteRenderContext } from "./athlete-render-profile";
import {
  PRO2_BUILDER_PLAN_NOTES_PREFIX,
  materializeWeekWithBuilderEngine,
  planBuilderWeekSlots,
  type BuilderEngineSkeletonWeek,
  type MaterializeWeekBuilderEngineInput,
} from "./materialize-week-builder-engine";
import type { ViryaDbConfig } from "./virya-db-config";

/* ── fixture: config identica alle righe reali delle tabelle virya_* ── */

const CONFIG: ViryaDbConfig = {
  weekdayPatterns: {
    "3d": [0, 2, 4],
    "4d": [0, 2, 4, 6],
    "5d": [0, 1, 3, 4, 6],
    "6d": [0, 1, 2, 3, 4, 5],
  },
  roleSequences: {
    1: ["quality"],
    2: ["quality", "volume"],
    3: ["quality", "volume", "quality"],
    4: ["quality", "volume", "volume", "quality"],
    5: ["quality", "volume", "quality", "volume", "quality"],
    6: ["quality", "volume", "quality", "volume", "volume", "quality"],
    7: ["quality", "volume", "quality", "volume", "quality", "volume", "quality"],
  },
  roleWeights: {
    "quality|base": 1.22,
    "quality|build": 1.32,
    "quality|deload": 0.85,
    "quality|peak": 1.32,
    "quality|refine": 1.22,
    "quality|second_peak": 1.22,
    "volume|base": 0.58,
    "volume|build": 0.58,
    "volume|deload": 0.5,
    "volume|peak": 0.58,
    "volume|refine": 0.58,
    "volume|second_peak": 0.58,
    "recovery|base": 0.45,
    "recovery|build": 0.45,
    "recovery|deload": 0.35,
    "recovery|peak": 0.45,
    "recovery|refine": 0.45,
    "recovery|second_peak": 0.45,
  },
  archetypeRules: null,
  disciplineMap: null,
};

const PROFILE: AthleteRenderContext = {
  athleteId: "ath-1",
  renderProfile: { intensityUnit: "watt", ftpW: 320, hrMax: 178, lengthMode: "time", speedRefKmh: 32 },
  ftpSource: "measured",
  lt1W: 230,
  lt2W: 300,
  lt1Hr: 148,
  lt2Hr: 168,
  maxSessionMinutes: 90,
  availableDays: [0, 2, 4],
  preferredTimeByOffset: { 0: "07:15", 5: "09:00" },
};

function gymRow(partial: Partial<BuilderCatalogExerciseRow> & { id: string; name: string }): BuilderCatalogExerciseRow {
  return {
    muscleGroup: "Gambe",
    catalogCategory: "strength_foundation",
    primaryDistrict: "Gambe",
    equipmentClass: "barbell",
    exerciseKind: "compound",
    equipment: "barbell",
    difficulty: "intermediate",
    mediaUrl: "",
    movementPattern: "squat",
    sportTags: ["gym"],
    ...partial,
  };
}

const GYM_ROWS: BuilderCatalogExerciseRow[] = [
  gymRow({ id: "ex-1", name: "Back Squat" }),
  gymRow({ id: "ex-2", name: "Deadlift", primaryDistrict: "Femorali", movementPattern: "hinge" }),
  gymRow({ id: "ex-3", name: "Bench Press", primaryDistrict: "Petto", movementPattern: "press", muscleGroup: "Petto" }),
  gymRow({ id: "ex-4", name: "Row", primaryDistrict: "Schiena", movementPattern: "pull", muscleGroup: "Schiena" }),
  gymRow({ id: "ex-5", name: "Overhead Press", primaryDistrict: "Spalle", movementPattern: "press", muscleGroup: "Spalle" }),
  gymRow({ id: "ex-6", name: "Plank", primaryDistrict: "Addominali", catalogCategory: "trunk_stability", exerciseKind: "isolation", muscleGroup: "Core" }),
];

function makeWeek(overrides?: Partial<BuilderEngineSkeletonWeek>): BuilderEngineSkeletonWeek {
  return {
    weekStart: "2026-08-03", // lunedì
    phase: "base",
    loadTarget: 300,
    sessionsTarget: 3,
    hoursTarget: 6,
    stimulus: {
      primary: PHASE_DEFAULT_STIMULUS.base.primary,
      secondary: PHASE_DEFAULT_STIMULUS.base.secondary,
      maintenance: [...PHASE_DEFAULT_STIMULUS.base.maintenance],
      avoid: [...PHASE_DEFAULT_STIMULUS.base.avoid],
    },
    familyMix: { aerobicPct: 100, gymPct: 0 },
    availableDays: [0, 2, 4],
    ...overrides,
  };
}

function makeInput(overrides?: {
  week?: Partial<BuilderEngineSkeletonWeek>;
  profile?: Partial<AthleteRenderContext>;
}): MaterializeWeekBuilderEngineInput {
  return {
    planId: "plan-1",
    athleteId: "ath-1",
    discipline: "cycling",
    week: makeWeek(overrides?.week),
    profile: { ...PROFILE, ...(overrides?.profile ?? {}) },
    config: CONFIG,
    catalogs: { aerobicPresets: AEROBIC_STARTER_PRESETS, gymCatalogRows: GYM_ROWS },
  };
}

/** Estrae il contratto Pro2 dalle notes (metaLine + riga BUILDER_SESSION_JSON). */
function contractFromNotes(notes: string | null): Pro2BuilderSessionContract {
  assert.ok(notes, "notes assenti");
  const line = notes.split("\n").find((l) => l.startsWith(BUILDER_SESSION_JSON_TAG));
  assert.ok(line, "riga BUILDER_SESSION_JSON assente");
  return JSON.parse(decodeURIComponent(line.slice(BUILDER_SESSION_JSON_TAG.length))) as Pro2BuilderSessionContract;
}

/** Riga confrontabile tra run: contratto parsato SENZA generatedAt (unico campo volatile). */
function comparableRow(row: PlannedWorkoutInsertPayload): Record<string, unknown> {
  const contract = contractFromNotes(row.notes);
  if (contract.sessionInterpretation) delete contract.sessionInterpretation.generatedAt;
  const { notes: _notes, ...rest } = row;
  const metaLine = (row.notes ?? "").split("\n")[0];
  return { ...rest, metaLine, contract };
}

/* ── distribuzione settimanale ── */

test("planBuilderWeekSlots: i giorni disponibili vincono sul pattern (5 chieste, 3 dichiarati)", () => {
  const { slots, errors } = planBuilderWeekSlots({
    week: makeWeek({ sessionsTarget: 5, availableDays: [1, 3, 5] }),
    config: CONFIG,
  });
  assert.equal(errors.length, 0);
  assert.equal(slots.length, 3); // mai più sedute dei giorni dichiarati
  assert.deepEqual(slots.map((s) => s.dayOffset), [1, 3, 5]);
  // un solo slot per giorno, sempre
  assert.equal(new Set(slots.map((s) => s.dayOffset)).size, slots.length);
});

test("planBuilderWeekSlots: routine non compilata → pattern config", () => {
  const { slots } = planBuilderWeekSlots({
    week: makeWeek({ sessionsTarget: 4, availableDays: [] }),
    config: CONFIG,
  });
  assert.deepEqual(slots.map((s) => s.dayOffset), CONFIG.weekdayPatterns["4d"]);
});

test("planBuilderWeekSlots: mai due quality in giorni consecutivi", () => {
  const { slots } = planBuilderWeekSlots({
    week: makeWeek({ sessionsTarget: 5, availableDays: [0, 1, 2, 3, 4], loadTarget: 400 }),
    config: CONFIG,
  });
  for (let i = 1; i < slots.length; i += 1) {
    const adjacent = slots[i]!.dayOffset - slots[i - 1]!.dayOffset === 1;
    const bothQuality = slots[i]!.role === "quality" && slots[i - 1]!.role === "quality";
    assert.ok(!(adjacent && bothQuality), `quality consecutive ai giorni ${slots[i - 1]!.dayOffset},${slots[i]!.dayOffset}`);
  }
});

test("planBuilderWeekSlots: il lungo (volume più carico) va nel weekend se disponibile", () => {
  const { slots } = planBuilderWeekSlots({
    week: makeWeek({ sessionsTarget: 3, availableDays: [0, 2, 5] }),
    config: CONFIG,
  });
  const weekend = slots.find((s) => s.dayOffset === 5);
  assert.ok(weekend);
  assert.equal(weekend.role, "volume");
  const volumeLoads = slots.filter((s) => s.role === "volume").map((s) => s.loadTarget);
  assert.equal(weekend.loadTarget, Math.max(...volumeLoads));
});

test("planBuilderWeekSlots: carichi riconciliati sul budget settimana (±3%)", () => {
  const week = makeWeek({ sessionsTarget: 4, availableDays: [0, 2, 4, 6], loadTarget: 320 });
  const { slots } = planBuilderWeekSlots({ week, config: CONFIG });
  const sum = slots.reduce((a, s) => a + s.loadTarget, 0);
  const tolerance = Math.max(3, Math.round(320 * 0.03));
  assert.ok(Math.abs(sum - 320) <= tolerance, `somma ${sum} fuori tolleranza dal budget 320`);
});

/* ── materializzazione aerobica ── */

test("aerobic: type stabile, plan_id, contratto con FTP reale e blocchi non vuoti", () => {
  const input = makeInput();
  const { rows, slots, errors } = materializeWeekWithBuilderEngine(input);

  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.equal(rows.length, slots.length);
  for (const row of rows) {
    assert.equal(row.type, "pro2_builder_aerobic"); // blueprint C: MAI pro2_builder_${target}
    assert.equal(row.plan_id, "plan-1");
    assert.ok(row.date >= "2026-08-03" && row.date <= "2026-08-09");
    assert.ok(row.notes?.startsWith(PRO2_BUILDER_PLAN_NOTES_PREFIX));
    assert.ok(row.tss_target > 0);
    assert.ok((row.kcal_target ?? 0) > 0);

    const contract = contractFromNotes(row.notes);
    assert.equal(contract.renderProfile?.ftpW, 320); // FTP REALE, mai il 250 del preset
    assert.equal(contract.renderProfile?.hrMax, 178);
    assert.equal(contract.family, "aerobic");
    assert.equal(contract.source, "builder");
    assert.ok((contract.blocks ?? []).length > 0, "blocchi aerobici vuoti");
    assert.ok((contract.summary?.kcal ?? 0) > 0);
  }
});

test("aerobic: metaLine [PRO2_BUILDER_PLAN] con identità piano/settimana/slot", () => {
  const { rows } = materializeWeekWithBuilderEngine(makeInput());
  const meta = JSON.parse((rows[0]!.notes ?? "").split("\n")[0]!.slice(PRO2_BUILDER_PLAN_NOTES_PREFIX.length)) as Record<string, unknown>;
  assert.equal(meta.v, 1);
  assert.equal(meta.family, "aerobic");
  assert.equal(meta.planId, "plan-1");
  assert.equal(meta.weekStart, "2026-08-03");
  assert.equal(meta.slotSeq, 0);
});

test("aerobic: cap training_max_session_minutes rispettato (e orario dalla routine)", () => {
  const input = makeInput({
    week: { loadTarget: 500 },
    profile: { maxSessionMinutes: 60 },
  });
  const { rows, errors } = materializeWeekWithBuilderEngine(input);
  assert.equal(errors.length, 0, JSON.stringify(errors));
  for (const row of rows) {
    assert.ok(row.duration_minutes <= 60, `durata ${row.duration_minutes} oltre il cap 60`);
  }
  const monday = rows.find((r) => r.date === "2026-08-03");
  assert.ok(monday);
  assert.equal(contractFromNotes(monday.notes).scheduledTime, "07:15");
});

/* ── materializzazione gym ── */

test("gym: family_mix 50/50 produce sedute strength con gymRx non vuoto", () => {
  const input = makeInput({
    week: { sessionsTarget: 4, availableDays: [0, 2, 4, 6], familyMix: { aerobicPct: 50, gymPct: 50 } },
  });
  const { rows, errors } = materializeWeekWithBuilderEngine(input);
  assert.equal(errors.length, 0, JSON.stringify(errors));

  const strength = rows.filter((r) => r.type === "pro2_builder_strength");
  const aerobic = rows.filter((r) => r.type === "pro2_builder_aerobic");
  assert.equal(strength.length, 2);
  assert.equal(aerobic.length, 2);

  for (const row of strength) {
    const contract = contractFromNotes(row.notes);
    assert.equal(contract.family, "strength");
    const gymBlocks = (contract.blocks ?? []).filter((b) => b.gymRx?.exerciseName);
    assert.ok(gymBlocks.length > 0, "gymRx vuoto nella seduta palestra");
    assert.ok(gymBlocks.every((b) => (b.gymRx?.sets ?? 0) > 0));
    assert.equal(contract.renderProfile?.ftpW, 320);
  }
});

test("gym: catalogo vuoto → errore esplicito per lo slot, le altre sedute procedono", () => {
  const input = makeInput({
    week: { sessionsTarget: 4, availableDays: [0, 2, 4, 6], familyMix: { aerobicPct: 50, gymPct: 50 } },
  });
  input.catalogs = { ...input.catalogs, gymCatalogRows: [] };
  const { rows, errors } = materializeWeekWithBuilderEngine(input);
  assert.equal(errors.length, 2);
  assert.ok(errors.every((e) => e.error === "gym_catalog_empty"));
  assert.equal(rows.length, 2); // le aerobiche restano
  assert.ok(rows.every((r) => r.type === "pro2_builder_aerobic"));
});

/* ── idempotenza ── */

test("re-run stessa settimana = stesse righe (al netto di generatedAt)", () => {
  const first = materializeWeekWithBuilderEngine(makeInput({ week: { familyMix: { aerobicPct: 67, gymPct: 33 } } }));
  const second = materializeWeekWithBuilderEngine(makeInput({ week: { familyMix: { aerobicPct: 67, gymPct: 33 } } }));
  assert.equal(first.errors.length, 0, JSON.stringify(first.errors));
  assert.deepEqual(first.rows.map(comparableRow), second.rows.map(comparableRow));
});

/* ── monte-ore coach (hours_target) ── */

test("hoursTarget: 6→12 ore cambia le durate (scala sul monte-ore) e il TSS segue", () => {
  const base = makeInput({ week: { hoursTarget: 6 } });
  const doubled = makeInput({ week: { hoursTarget: 12 } });
  const rowsBase = materializeWeekWithBuilderEngine(base).rows;
  const rowsDoubled = materializeWeekWithBuilderEngine(doubled).rows;
  const totalMin = (rows: typeof rowsBase) => rows.reduce((s, r) => s + (r.duration_minutes ?? 0), 0);
  assert.ok(rowsBase.length > 0 && rowsDoubled.length > 0);
  // Il monte-ore maggiore DEVE produrre una settimana più lunga (clamp 1.6 permettendo).
  assert.ok(
    totalMin(rowsDoubled) > totalMin(rowsBase),
    `atteso più minuti con 12h: ${totalMin(rowsDoubled)} vs ${totalMin(rowsBase)}`,
  );
  // E il TSS aerobico segue le durate: nessuna riga con durata scalata e TSS invariato.
  const tssTotal = (rows: typeof rowsBase) => rows.reduce((s, r) => s + (r.tss_target ?? 0), 0);
  assert.ok(tssTotal(rowsDoubled) > tssTotal(rowsBase));
});

test("hoursTarget null: durate naturali della catena (nessuna scala)", () => {
  const nullHours = materializeWeekWithBuilderEngine(makeInput({ week: { hoursTarget: null } }));
  const again = materializeWeekWithBuilderEngine(makeInput({ week: { hoursTarget: null } }));
  assert.equal(nullHours.errors.length, 0);
  assert.deepEqual(nullHours.rows.map(comparableRow), again.rows.map(comparableRow));
});

/* ── avoid dallo scheletro ── */

test("stimulus.avoid: nessuna seduta aerobica atterra su un target escluso", () => {
  const input = makeInput({
    week: {
      sessionsTarget: 5,
      availableDays: [0, 1, 2, 4, 5],
      loadTarget: 420,
      phase: "build",
      stimulus: {
        primary: "lactate_clearance",
        secondary: "vo2_max_support",
        maintenance: ["mitochondrial_density"],
        avoid: ["lactate_tolerance"],
      },
    },
  });
  const { rows, errors } = materializeWeekWithBuilderEngine(input);
  assert.equal(errors.length, 0, JSON.stringify(errors));
  for (const row of rows) {
    const contract = contractFromNotes(row.notes);
    assert.notEqual(contract.adaptationTarget, "lactate_tolerance");
  }
});
