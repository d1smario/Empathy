import assert from "node:assert/strict";
import test from "node:test";

import {
  isoWeekStart,
  rebuildPlanTimeline,
  type ReshapeMesocycle,
  type ReshapeWeek,
} from "@/lib/training/plan/reshape-plan-timeline";

/* Piano di riferimento: 2 mesocicli (base 2 sett., build 2 sett.) da lunedì 2026-09-07. */
const MESOS: ReshapeMesocycle[] = [
  { id: "m1", seq: 1, phase: "base", weeks: 2, weeklyTssTarget: 300, sessionsTarget: 4 },
  { id: "m2", seq: 2, phase: "build", weeks: 2, weeklyTssTarget: 400, sessionsTarget: 5 },
];

function wk(over: Partial<ReshapeWeek> & { id: string; weekStart: string }): ReshapeWeek {
  return {
    mesocycleSeq: 1,
    weekInPhase: 1,
    budgetTss: 300,
    sessions: 4,
    hoursTarget: null,
    objectives: {},
    coachNotes: null,
    familyMix: { aerobic_pct: 100, gym_pct: 0 },
    ...over,
  };
}

const WEEKS: ReshapeWeek[] = [
  wk({ id: "w1", weekStart: "2026-09-07", mesocycleSeq: 1, weekInPhase: 1 }),
  wk({ id: "w2", weekStart: "2026-09-14", mesocycleSeq: 1, weekInPhase: 2, hoursTarget: 8, coachNotes: "richiamo" }),
  wk({ id: "w3", weekStart: "2026-09-21", mesocycleSeq: 2, weekInPhase: 1, budgetTss: 420, sessions: 5 }),
  wk({ id: "w4", weekStart: "2026-09-28", mesocycleSeq: 2, weekInPhase: 2, budgetTss: 440, sessions: 5 }),
];

const TODAY = "2026-09-01"; // tutto il piano è futuro

test("isoWeekStart: riporta al lunedì della settimana", () => {
  assert.equal(isoWeekStart("2026-09-09"), "2026-09-07"); // mercoledì → lunedì
  assert.equal(isoWeekStart("2026-09-07"), "2026-09-07"); // lunedì → sé stesso
  assert.equal(isoWeekStart("2026-09-13"), "2026-09-07"); // domenica → lunedì precedente
});

test("allungare il primo mesociclo sposta in avanti tutte le settimane successive", () => {
  const mesos = [{ ...MESOS[0]!, weeks: 4 }, MESOS[1]!];
  const res = rebuildPlanTimeline({ mesocycles: mesos, weeks: WEEKS, fromSeq: 1, todayIso: TODAY });
  assert.ok(res.ok);
  if (!res.ok) return;

  const emitted = res.ops.filter((o) => o.kind !== "delete");
  assert.equal(emitted.length, 6, "4 base + 2 build");
  assert.equal(res.totalWeeks, 6);
  // La build parte 2 settimane più tardi di prima (era 09-21).
  const buildFirst = emitted.find((o) => o.kind !== "delete" && o.mesocycleId === "m2" && o.weekInPhase === 1);
  assert.ok(buildFirst && buildFirst.kind !== "delete");
  assert.equal(buildFirst.weekStart, "2026-10-05");
  // Date consecutive di 7 giorni, senza buchi.
  const starts = emitted.filter((o) => o.kind !== "delete").map((o) => (o.kind === "delete" ? "" : o.weekStart));
  assert.deepEqual(starts, [
    "2026-09-07",
    "2026-09-14",
    "2026-09-21",
    "2026-09-28",
    "2026-10-05",
    "2026-10-12",
  ]);
  assert.equal(res.endDate, "2026-10-18");
});

test("gli edit del coach seguono la POSIZIONE logica, non la data", () => {
  const mesos = [{ ...MESOS[0]!, weeks: 4 }, MESOS[1]!];
  const res = rebuildPlanTimeline({ mesocycles: mesos, weeks: WEEKS, fromSeq: 1, todayIso: TODAY });
  assert.ok(res.ok);
  if (!res.ok) return;

  // w2 = 2ª settimana della base con ore 8 e nota: resta la 2ª della base.
  const second = res.ops.find((o) => o.kind === "update" && o.id === "w2");
  assert.ok(second && second.kind === "update");
  assert.equal(second.weekInPhase, 2);
  assert.equal(second.hoursTarget, 8);
  assert.equal(second.coachNotes, "richiamo");
  assert.equal(second.weekStart, "2026-09-14", "posizione invariata → data invariata");

  // w3 = 1ª della build, carico 420 editato: segue la fase anche se slitta.
  const buildFirst = res.ops.find((o) => o.kind === "update" && o.id === "w3");
  assert.ok(buildFirst && buildFirst.kind === "update");
  assert.equal(buildFirst.budgetTss, 420);
  assert.equal(buildFirst.weekStart, "2026-10-05", "slittata di 2 settimane");
});

test("le settimane NUOVE nascono dai default del mesociclo", () => {
  const mesos = [{ ...MESOS[0]!, weeks: 4 }, MESOS[1]!];
  const res = rebuildPlanTimeline({ mesocycles: mesos, weeks: WEEKS, fromSeq: 1, todayIso: TODAY });
  assert.ok(res.ok);
  if (!res.ok) return;

  const inserted = res.ops.filter((o) => o.kind === "insert");
  assert.equal(inserted.length, 2, "base 2→4 = 2 settimane nuove");
  for (const op of inserted) {
    if (op.kind !== "insert") continue;
    assert.equal(op.mesocycleId, "m1");
    assert.equal(op.budgetTss, 300, "default weeklyTssTarget del mesociclo");
    assert.equal(op.sessions, 4);
    assert.equal(op.hoursTarget, null);
    assert.deepEqual(op.objectives, {}, "objectives vuoto → il mapper deriva lo stimolo di fase");
  }
});

test("accorciare un mesociclo cancella le settimane in eccesso", () => {
  const mesos = [{ ...MESOS[0]!, weeks: 1 }, MESOS[1]!];
  const res = rebuildPlanTimeline({ mesocycles: mesos, weeks: WEEKS, fromSeq: 1, todayIso: TODAY });
  assert.ok(res.ok);
  if (!res.ok) return;

  const deleted = res.ops.filter((o) => o.kind === "delete");
  assert.equal(deleted.length, 1, "una posizione (base:2) non esiste più");
  assert.equal(deleted[0]!.kind === "delete" ? deleted[0]!.id : "", "w2");
  assert.equal(res.totalWeeks, 3);
});

test("mesociclo già iniziato: rifiutato, nessuna data del passato viene toccata", () => {
  const mesos = [{ ...MESOS[0]!, weeks: 4 }, MESOS[1]!];
  const res = rebuildPlanTimeline({
    mesocycles: mesos,
    weeks: WEEKS,
    fromSeq: 1,
    todayIso: "2026-09-16", // il mesociclo 1 è già partito
  });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.error, "mesocycle_already_started");
});

test("ricalcolo da un mesociclo futuro: le settimane precedenti non compaiono nelle ops", () => {
  const mesos = [MESOS[0]!, { ...MESOS[1]!, weeks: 3 }];
  const res = rebuildPlanTimeline({
    mesocycles: mesos,
    weeks: WEEKS,
    fromSeq: 2,
    todayIso: "2026-09-16", // mesociclo 1 in corso, mesociclo 2 ancora futuro
  });
  assert.ok(res.ok);
  if (!res.ok) return;

  const touchedIds = new Set(res.ops.map((o) => (o.kind === "delete" ? o.id : o.kind === "update" ? o.id : "")));
  assert.ok(!touchedIds.has("w1"), "settimana passata intatta");
  assert.ok(!touchedIds.has("w2"), "settimana in corso intatta");
  assert.equal(res.totalWeeks, 5, "2 base intatte + 3 build");
  const inserted = res.ops.filter((o) => o.kind === "insert");
  assert.equal(inserted.length, 1);
});

test("nessun cambio di durata → ops idempotenti (stesse date, stessi valori)", () => {
  const res = rebuildPlanTimeline({ mesocycles: MESOS, weeks: WEEKS, fromSeq: 1, todayIso: TODAY });
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(res.ops.filter((o) => o.kind === "insert").length, 0);
  assert.equal(res.ops.filter((o) => o.kind === "delete").length, 0);
  for (const op of res.ops) {
    if (op.kind !== "update") continue;
    const before = WEEKS.find((w) => w.id === op.id)!;
    assert.equal(op.weekStart, before.weekStart);
    assert.equal(op.weekInPhase, before.weekInPhase);
    assert.equal(op.budgetTss, before.budgetTss);
  }
});
