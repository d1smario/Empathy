import test from "node:test";
import assert from "node:assert/strict";
import { selectWeekStartsToMaterialize } from "./materialize-training-macro";
import {
  archiveSupersededPlans,
  buildPlanWeekSeeds,
  pickGoalRace,
  proposeTrainingMacro,
} from "./propose-training-macro";

/**
 * Test dei punti PURI dello split proponi/materializza (VIRYA F2, blueprint D):
 * scelta gara A, supersessione, doppio ramo con/senza coach, selezione settimane.
 * Il client Supabase è un mock a chain thenable (stesso pattern di
 * reduction-run.test.ts) che REGISTRA le scritture: si asserisce sul cosa viene
 * scritto, non su un DB vero.
 */

type Call = { table: string; op: "select" | "insert" | "update" | "delete"; payload?: unknown; filters: unknown[][] };

function makeDb(canned: Record<string, unknown[]>) {
  const calls: Call[] = [];
  function chain(table: string): unknown {
    const call: Call = { table, op: "select", filters: [] };
    calls.push(call);
    const rows = () => (canned[table] ?? []) as unknown[];
    const c: Record<string, unknown> = {};
    const record =
      (name: string) =>
      (...args: unknown[]) => {
        call.filters.push([name, ...args]);
        return c;
      };
    // `lt`/`gt` servono da quando proposeTrainingMacro legge anche il calendario del
    // coach (`loadCalendarTrainingVolume` filtra la finestra con .gte().lt()): senza,
    // la catena finta si spezzava con «.lt is not a function».
    for (const m of ["select", "eq", "neq", "in", "is", "gt", "gte", "lt", "lte", "ilike", "order", "limit"]) {
      c[m] = record(m);
    }
    c.insert = (payload: unknown) => {
      call.op = "insert";
      call.payload = payload;
      return c;
    };
    c.update = (payload: unknown) => {
      call.op = "update";
      call.payload = payload;
      return c;
    };
    c.delete = () => {
      call.op = "delete";
      return c;
    };
    c.maybeSingle = () => Promise.resolve({ data: rows()[0] ?? null, error: null });
    c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ data: call.op === "select" ? rows() : null, error: null }).then(res, rej);
    return c;
  }
  return { db: { from: (t: string) => chain(t) } as never, calls };
}

const ATHLETE = "athlete-1";
const MONDAY = "2026-07-27";

function planInsert(calls: Call[]): Record<string, unknown> {
  const call = calls.find((c) => c.table === "training_plan" && c.op === "insert");
  assert.ok(call, "manca l'insert training_plan");
  return call!.payload as Record<string, unknown>;
}

/* ── scelta gara A ── */

test("pickGoalRace: prossima gara A futura per race_date asc; B/C e passato ignorati", () => {
  const picked = pickGoalRace(
    [
      { name: "Gara B vicina", race_date: "2026-08-01", priority: "B" },
      { name: "Gara A passata", race_date: "2026-07-20", priority: "A" },
      { name: "Gara A lontana", race_date: "2026-11-15", priority: "A" },
      { name: "Gara A vicina", race_date: "2026-10-19", priority: "A" },
    ],
    MONDAY,
  );
  assert.deepEqual(picked, { name: "Gara A vicina", raceDate: "2026-10-19" });
});

test("pickGoalRace: nessuna A futura → null; due gare stesso giorno legittime", () => {
  assert.equal(pickGoalRace([{ name: "x", race_date: "2026-07-01", priority: "A" }], MONDAY), null);
  assert.equal(pickGoalRace([{ name: "x", race_date: "2026-09-01", priority: "C" }], MONDAY), null);
  // batteria + finale lo stesso giorno: vince la prima in ordinamento stabile
  const sameDay = pickGoalRace(
    [
      { name: "Batteria", race_date: "2026-09-05", priority: "A" },
      { name: "Finale", race_date: "2026-09-05", priority: "A" },
    ],
    MONDAY,
  );
  assert.equal(sameDay?.raceDate, "2026-09-05");
});

/* ── doppio ramo con/senza coach ── */

test("senza coach → status approved con auto-approve (approval=auto_no_coach)", async () => {
  const { db, calls } = makeDb({ coach_athletes: [] });
  const res = await proposeTrainingMacro(db, { athleteId: ATHLETE, startDate: MONDAY, source: "onboarding_d3" });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.status, "approved");

  const inserted = planInsert(calls);
  assert.equal(inserted.status, "approved");
  assert.ok(inserted.approved_at, "auto-approve deve settare approved_at");
  assert.equal(inserted.approved_by, null, "auto-approve: approved_by resta null (non è un umano)");
  const provenance = inserted.inputs_provenance as Record<string, unknown>;
  assert.equal(provenance.approval, "auto_no_coach");
});

test("con coach → status draft, nessun approved_at e NESSUNA seduta scritta", async () => {
  const { db, calls } = makeDb({ coach_athletes: [{ athlete_id: ATHLETE }] });
  const res = await proposeTrainingMacro(db, { athleteId: ATHLETE, startDate: MONDAY, source: "continuity" });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.status, "draft");

  const inserted = planInsert(calls);
  assert.equal(inserted.status, "draft");
  assert.equal(inserted.approved_at, null);
  assert.equal((inserted.inputs_provenance as Record<string, unknown>).approval, "pending_coach");

  // proponi NON materializza: zero insert su planned_workouts (blueprint D: STOP al draft)
  const plannedInserts = calls.filter((c) => c.table === "planned_workouts" && c.op === "insert");
  assert.equal(plannedInserts.length, 0);
});

/* ── gara A → ramo goal-driven di buildMacroPhases ── */

test("gara A collegata: goal_event_date sul piano e fasi refine+peak nello scheletro", async () => {
  const { db, calls } = makeDb({
    coach_athletes: [],
    athlete_races: [
      { name: "Granfondo", race_date: "2026-10-19", priority: "A" },
      { name: "Allenamento test", race_date: "2026-08-10", priority: "B" },
    ],
  });
  const res = await proposeTrainingMacro(db, { athleteId: ATHLETE, startDate: MONDAY, source: "onboarding_d3" });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.goalEventDate, "2026-10-19");

  const inserted = planInsert(calls);
  assert.equal(inserted.goal_event_date, "2026-10-19");
  assert.equal(inserted.name, "Preparazione Granfondo");

  const mesoCall = calls.find((c) => c.table === "training_plan_mesocycle" && c.op === "insert");
  assert.ok(mesoCall);
  const phases = (mesoCall!.payload as Array<{ phase: string }>).map((m) => m.phase);
  assert.ok(phases.includes("refine") && phases.includes("peak"), "ramo goal-driven acceso: refine+peak presenti");
});

test("senza gara: open-ended (niente peak), settimane deload a budget ridotto", async () => {
  const { db, calls } = makeDb({ coach_athletes: [] });
  const res = await proposeTrainingMacro(db, { athleteId: ATHLETE, startDate: MONDAY, source: "onboarding_d3" });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.goalEventDate, null);
  assert.equal(res.weekCount, 8, "orizzonte open-ended default: 8 settimane");

  const mesoCall = calls.find((c) => c.table === "training_plan_mesocycle" && c.op === "insert");
  const phases = (mesoCall!.payload as Array<{ phase: string }>).map((m) => m.phase);
  assert.ok(!phases.includes("peak") && !phases.includes("refine"));

  // Profilo assente → default: 4 sedute, 380 TSS; deload = 60% (seed che il coach rifinisce)
  const weekCall = calls.find((c) => c.table === "training_plan_week" && c.op === "insert");
  const weeks = weekCall!.payload as Array<Record<string, unknown>>;
  assert.equal(weeks.length, 8);
  const deload = weeks.find((w) => w.phase === "deload");
  assert.ok(deload);
  assert.equal(deload!.budget_tss, Math.round(380 * 0.6));
  const base = weeks.find((w) => w.phase === "base");
  assert.equal(base!.budget_tss, 380);
  assert.equal((base!.objectives as Record<string, unknown>).primary, "mitochondrial_density");
  assert.equal(base!.workout_count, 0, "le settimane nascono non-materializzate");
});

/* ── FONTE 3: il calendario del coach arriva davvero fino ai seed delle settimane ── */

/** Sedute finte in `planned_workouts`, tutte nella settimana del 2026-07-27. */
function sedute(giorni: readonly string[], minuti: number) {
  return giorni.map((date) => ({ date, duration_minutes: minuti }));
}

test("il calendario del coach allarga i seed di TUTTE le settimane del macro", async () => {
  const { db, calls } = makeDb({
    coach_athletes: [],
    // 6 giorni da 120′ nella settimana di partenza: profilo assente (default 4 × 75′).
    planned_workouts: sedute(
      ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31", "2026-08-01"],
      120,
    ),
  });
  const res = await proposeTrainingMacro(db, {
    athleteId: ATHLETE,
    startDate: MONDAY,
    source: "onboarding_d3",
    todayIso: MONDAY,
  });
  assert.equal(res.ok, true);

  const weeks = calls.find((c) => c.table === "training_plan_week" && c.op === "insert")!
    .payload as Array<Record<string, unknown>>;
  const base = weeks.find((w) => w.phase === "base")!;
  // 6 giorni osservati > 4 di default → 6 sedute, 570 TSS (contro 4 e 380 senza calendario).
  assert.equal(base.workout_count, 0);
  assert.equal(base.budget_tss, 570);
  // Monte-ore dal calendario VERO: 6 × 120′ = 12,0 h. Con `sessions × picco` sarebbero
  // state le stesse ore qui, ma su durate disomogenee il picco gonfia (vedi il test puro).
  assert.equal(base.hours_target, 12);
});

test("una seduta sparsa NON detta il macrociclo: restano i default dichiarati", async () => {
  // Il caso reale che faceva collassare il piano: un solo giorno programmato in 4 settimane.
  const { db, calls } = makeDb({
    coach_athletes: [],
    planned_workouts: sedute(["2026-08-10"], 65),
  });
  const res = await proposeTrainingMacro(db, {
    athleteId: ATHLETE,
    startDate: MONDAY,
    source: "onboarding_d3",
    todayIso: MONDAY,
  });
  assert.equal(res.ok, true);

  const weeks = calls.find((c) => c.table === "training_plan_week" && c.op === "insert")!
    .payload as Array<Record<string, unknown>>;
  const base = weeks.find((w) => w.phase === "base")!;
  assert.equal(base.budget_tss, 380, "4 sedute di default, non 1");
  assert.equal(base.hours_target, 5, "4 × 75′, non 1 × 65′");
});

test("il calendario si osserva da OGGI, non dalla settimana di partenza del macro", async () => {
  // Ramo continuità: startDate è il lunedì DOPO l'ultima seduta pianificata, quindi una
  // finestra ancorata lì sarebbe vuota per costruzione e la fonte 3 morirebbe sul nascere.
  const { db, calls } = makeDb({
    coach_athletes: [],
    planned_workouts: sedute(["2026-07-27", "2026-07-29", "2026-07-31", "2026-08-02", "2026-08-04"], 100),
  });
  const res = await proposeTrainingMacro(db, {
    athleteId: ATHLETE,
    startDate: "2026-09-28", // ben oltre le 4 settimane osservate da oggi
    source: "continuity",
    todayIso: MONDAY,
  });
  assert.equal(res.ok, true);

  const finestra = calls.find((c) => c.table === "planned_workouts" && c.op === "select")!;
  assert.deepEqual(finestra.filters.find((f) => f[0] === "gte"), ["gte", "date", "2026-07-27"]);
  assert.deepEqual(finestra.filters.find((f) => f[0] === "lt"), ["lt", "date", "2026-08-24"]);

  const weeks = calls.find((c) => c.table === "training_plan_week" && c.op === "insert")!
    .payload as Array<Record<string, unknown>>;
  assert.equal(weeks.find((w) => w.phase === "base")!.budget_tss, 4 * 95);
});

/* ── supersessione ── */

test("supersessione: i piani non-archived precedenti si archiviano e il loro futuro sparisce", async () => {
  const { db, calls } = makeDb({
    coach_athletes: [],
    training_plan: [{ id: "old-1" }, { id: "old-2" }],
  });
  const res = await proposeTrainingMacro(db, { athleteId: ATHLETE, startDate: MONDAY, source: "continuity" });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.deepEqual(res.archivedPlanIds, ["old-1", "old-2"]);

  const archive = calls.find((c) => c.table === "training_plan" && c.op === "update");
  assert.ok(archive, "manca l'update di archiviazione");
  assert.deepEqual(archive!.payload, { status: "archived" });
  assert.deepEqual(
    archive!.filters.find((f) => f[0] === "in"),
    ["in", "id", ["old-1", "old-2"]],
  );

  const purge = calls.find((c) => c.table === "planned_workouts" && c.op === "delete");
  assert.ok(purge, "manca il delete del futuro dei piani archiviati");
  assert.deepEqual(purge!.filters.find((f) => f[0] === "in"), ["in", "plan_id", ["old-1", "old-2"]]);
  assert.deepEqual(purge!.filters.find((f) => f[0] === "gte"), ["gte", "date", MONDAY]);
});

test("archiveSupersededPlans: keepPlanId escluso; nessun piano → nessuna scrittura", async () => {
  const { db, calls } = makeDb({ training_plan: [] });
  const res = await archiveSupersededPlans(db, ATHLETE, { keepPlanId: "keep-1", fromDateIso: MONDAY });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.deepEqual(res.archivedPlanIds, []);
  assert.equal(calls.filter((c) => c.op !== "select").length, 0, "senza piani da archiviare non si scrive nulla");
  const select = calls.find((c) => c.table === "training_plan" && c.op === "select");
  const neqFilters = select!.filters.filter((f) => f[0] === "neq");
  assert.deepEqual(neqFilters, [
    ["neq", "status", "archived"],
    ["neq", "id", "keep-1"],
  ]);
});

/* ── seed settimane (espansione fasi) ── */

test("buildPlanWeekSeeds: date contigue, week_in_phase e aggancio mesociclo per fase", () => {
  const seeds = buildPlanWeekSeeds(
    [
      { phase: "base", weeks: 2 },
      { phase: "deload", weeks: 1 },
    ],
    MONDAY,
    { weeklyTss: 400, sessions: 5, hoursTarget: 6 },
  );
  assert.equal(seeds.length, 3);
  assert.deepEqual(
    seeds.map((s) => s.weekStart),
    ["2026-07-27", "2026-08-03", "2026-08-10"],
  );
  assert.deepEqual(seeds.map((s) => s.weekInPhase), [1, 2, 1]);
  assert.deepEqual(seeds.map((s) => s.mesocycleSeq), [1, 1, 2]);
  assert.deepEqual(seeds.map((s) => s.budgetTss), [400, 400, 240]);
  assert.deepEqual(seeds.map((s) => s.hoursTarget), [6, 6, 3.6]);
});

/* ── selezione settimane della materializzazione ── */

test("selectWeekStartsToMaterialize: runway copre solo l'orizzonte futuro", () => {
  const all = ["2026-07-20", "2026-07-27", "2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"];
  // oggi = mercoledì 2026-07-29: la settimana in corso (27/7) è dentro, la 20/7 è conclusa
  const { selected, skipped } = selectWeekStartsToMaterialize(all, { mode: "runway", minFutureWeeks: 3 }, "2026-07-29");
  assert.deepEqual(selected, ["2026-07-27", "2026-08-03", "2026-08-10", "2026-08-17"]);
  assert.deepEqual(skipped, ["2026-07-20", "2026-08-24"]);
});

test("selectWeekStartsToMaterialize: explicit interseca con lo scheletro, all prende tutto", () => {
  const all = ["2026-07-27", "2026-08-03"];
  const explicit = selectWeekStartsToMaterialize(
    all,
    { mode: "explicit", weekStarts: ["2026-08-03", "2026-09-07"] },
    "2026-07-29",
  );
  assert.deepEqual(explicit.selected, ["2026-08-03"]);
  assert.deepEqual(explicit.skipped, ["2026-07-27"]);

  const everything = selectWeekStartsToMaterialize(all, { mode: "all" }, "2026-07-29");
  assert.deepEqual(everything.selected, all);
  assert.deepEqual(everything.skipped, []);
});
