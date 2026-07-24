import assert from "node:assert/strict";
import test from "node:test";

import type {
  TrainingPlanMesocycleRow,
  TrainingPlanRow,
  TrainingPlanWeekRow,
} from "./plan-skeleton-mappers";
import {
  PHASE_DEFAULT_STIMULUS,
  WEEK_OBJECTIVE_KEY_TO_TARGET,
  coercePhase,
  coerceStatus,
  familyMixFromJson,
  isAdaptationTarget,
  planSkeletonFromRows,
  weekObjectivesFromJson,
} from "./plan-skeleton-mappers";
import { ADAPTATION_TARGETS } from "./plan-skeleton-types";

// --- round-trip righe → skeleton ---------------------------------------------

test("planSkeletonFromRows: round-trip righe → skeleton ordinato e agganciato", () => {
  const planRow: TrainingPlanRow = {
    id: "plan-1",
    athlete_id: "ath-1",
    name: "Stagione 2026",
    status: "approved",
    approved_by: "coach-1",
    approved_at: "2026-01-10T09:00:00Z",
    discipline: "cycling",
    start_date: "2026-01-05",
    end_date: "2026-03-29",
    goal_event_date: "2026-03-29",
  };
  const mesocycleRows: TrainingPlanMesocycleRow[] = [
    // volutamente fuori ordine per verificare il sort per seq
    { id: "m2", seq: 2, phase: "build", weeks: 4, label: "Costruzione" },
    { id: "m1", seq: 1, phase: "base", weeks: 4, weekly_tss_target: 300, sessions_target: 4 },
  ];
  const weekRows: TrainingPlanWeekRow[] = [
    // fuori ordine per verificare il sort per week_start
    {
      id: "w2",
      week_start: "2026-01-12",
      phase: "base",
      week_in_phase: 2,
      budget_tss: 320,
      sessions: 4,
      objectives: { primary: "mitochondrial_density", secondary: null, maintenance: [], avoid: [] },
      family_mix: { aerobic_pct: 80, gym_pct: 20 },
      mesocycle_id: "m1",
      coach_notes: "richiamo tecnica",
      hours_target: 8.5,
    },
    {
      id: "w1",
      week_start: "2026-01-05",
      phase: "base",
      week_in_phase: 1,
      budget_tss: 300,
      sessions: 4,
      objectives: {},
      family_mix: {},
      mesocycle_id: "m1",
    },
  ];

  const skeleton = planSkeletonFromRows(planRow, mesocycleRows, weekRows);

  // testata
  assert.equal(skeleton.id, "plan-1");
  assert.equal(skeleton.athleteId, "ath-1");
  assert.equal(skeleton.status, "approved");
  assert.equal(skeleton.discipline, "cycling");
  assert.equal(skeleton.goalEventDate, "2026-03-29");

  // mesocicli ordinati per seq
  assert.deepEqual(
    skeleton.mesocycles.map((m) => m.seq),
    [1, 2],
  );
  assert.equal(skeleton.mesocycles[0].weeklyTssTarget, 300);
  assert.equal(skeleton.mesocycles[0].sessionsTarget, 4);
  assert.equal(skeleton.mesocycles[0].loadWeeks, 3); // default
  assert.equal(skeleton.mesocycles[0].deloadWeeks, 1); // default

  // settimane ordinate per week_start
  assert.deepEqual(
    skeleton.weeks.map((w) => w.weekStart),
    ["2026-01-05", "2026-01-12"],
  );
  // join mesocycle_id → seq
  assert.equal(skeleton.weeks[0].mesocycleSeq, 1);
  assert.equal(skeleton.weeks[1].mesocycleSeq, 1);
  assert.equal(skeleton.weeks[0].loadTarget, 300);
  assert.equal(skeleton.weeks[1].hoursTarget, 8.5);
  assert.equal(skeleton.weeks[1].coachNotes, "richiamo tecnica");

  // family_mix esplicito vs default
  assert.deepEqual(skeleton.weeks[1].familyMix, { aerobicPct: 80, gymPct: 20 });
  assert.deepEqual(skeleton.weeks[0].familyMix, { aerobicPct: 100, gymPct: 0 });

  // objectives '{}' → default fase base
  assert.deepEqual(skeleton.weeks[0].stimulus, PHASE_DEFAULT_STIMULUS.base);
  // objectives esplicito preservato
  assert.equal(skeleton.weeks[1].stimulus.primary, "mitochondrial_density");
});

// --- default per fase ---------------------------------------------------------

test("weekObjectivesFromJson: '{}' deriva lo stimolo dalla fase", () => {
  for (const phase of ["base", "build", "refine", "peak", "deload", "second_peak"] as const) {
    assert.deepEqual(weekObjectivesFromJson({}, phase), PHASE_DEFAULT_STIMULUS[phase]);
    // stringa jsonb "{}" trattata come il default
    assert.deepEqual(weekObjectivesFromJson("{}", phase), PHASE_DEFAULT_STIMULUS[phase]);
  }
});

test("weekObjectivesFromJson: il default è una copia, non muta la costante", () => {
  const stim = weekObjectivesFromJson({}, "build");
  stim.maintenance.push("recovery");
  // la costante di fase non deve essere stata mutata
  assert.deepEqual(PHASE_DEFAULT_STIMULUS.build.maintenance, [
    "mitochondrial_density",
    "max_strength",
  ]);
});

test("weekObjectivesFromJson: primary valido → costruisce dai campi puliti", () => {
  const stim = weekObjectivesFromJson(
    {
      primary: "max_strength",
      secondary: "power_output",
      maintenance: ["mitochondrial_density", "recovery", "vo2_max_support"],
      avoid: ["lactate_tolerance"],
    },
    "build",
  );
  assert.equal(stim.primary, "max_strength");
  assert.equal(stim.secondary, "power_output");
  // maintenance cappata a 2
  assert.deepEqual(stim.maintenance, ["mitochondrial_density", "recovery"]);
  assert.deepEqual(stim.avoid, ["lactate_tolerance"]);
});

// --- malformati non lanciano --------------------------------------------------

test("weekObjectivesFromJson: input malformati → default fase, mai throw", () => {
  const cases: unknown[] = [
    null,
    undefined,
    42,
    "non-json",
    "[1,2,3]",
    [],
    { primary: "not_a_target" },
    { primary: 123 },
    { secondary: "max_strength" }, // manca primary valido
  ];
  for (const c of cases) {
    assert.doesNotThrow(() => weekObjectivesFromJson(c, "refine"));
    assert.deepEqual(weekObjectivesFromJson(c, "refine"), PHASE_DEFAULT_STIMULUS.refine);
  }
});

test("weekObjectivesFromJson: secondary/maintenance/avoid sporchi vengono ripuliti", () => {
  const stim = weekObjectivesFromJson(
    {
      primary: "max_strength",
      secondary: "garbage",
      maintenance: ["recovery", "garbage", 7, "recovery"], // dedup + filtro
      avoid: "not-an-array",
    },
    "peak",
  );
  assert.equal(stim.primary, "max_strength");
  assert.equal(stim.secondary, null);
  assert.deepEqual(stim.maintenance, ["recovery"]);
  assert.deepEqual(stim.avoid, []);
});

test("familyMixFromJson: malformati → default 100/0, mai throw", () => {
  assert.deepEqual(familyMixFromJson(null), { aerobicPct: 100, gymPct: 0 });
  assert.deepEqual(familyMixFromJson("garbage"), { aerobicPct: 100, gymPct: 0 });
  assert.deepEqual(familyMixFromJson([]), { aerobicPct: 100, gymPct: 0 });
  assert.deepEqual(familyMixFromJson({ aerobic_pct: 60, gym_pct: 40 }), {
    aerobicPct: 60,
    gymPct: 40,
  });
  // jsonb serializzato come stringa
  assert.deepEqual(familyMixFromJson('{"aerobic_pct":50,"gym_pct":50}'), {
    aerobicPct: 50,
    gymPct: 50,
  });
});

test("planSkeletonFromRows: piano vuoto e righe assenti non lanciano", () => {
  assert.doesNotThrow(() => planSkeletonFromRows({ id: "p", athlete_id: "a" }));
  const skeleton = planSkeletonFromRows({ id: "p", athlete_id: "a" });
  assert.equal(skeleton.status, "draft"); // status assente → default protettivo
  assert.equal(skeleton.discipline, "");
  assert.deepEqual(skeleton.mesocycles, []);
  assert.deepEqual(skeleton.weeks, []);
});

test("planSkeletonFromRows: mesocycle_id orfano → mesocycleSeq null", () => {
  const skeleton = planSkeletonFromRows(
    { id: "p", athlete_id: "a", status: "active" },
    [{ id: "m1", seq: 1, phase: "base", weeks: 4 }],
    [{ id: "w1", week_start: "2026-01-05", phase: "base", budget_tss: 100, sessions: 3, mesocycle_id: "ghost" }],
  );
  assert.equal(skeleton.weeks[0].mesocycleSeq, null);
});

test("planSkeletonFromRows: fase/status fuori CHECK → default, mai throw", () => {
  const skeleton = planSkeletonFromRows(
    { id: "p", athlete_id: "a", status: "weird" },
    [{ id: "m1", seq: 1, phase: "nonsense", weeks: 2 }],
    [{ id: "w1", week_start: "2026-01-05", phase: "nonsense", budget_tss: 100, sessions: 3 }],
  );
  assert.equal(skeleton.status, "draft");
  assert.equal(skeleton.mesocycles[0].phase, "base");
  assert.equal(skeleton.weeks[0].phase, "base");
  // stimolo derivato dalla fase-default base
  assert.deepEqual(skeleton.weeks[0].stimulus, PHASE_DEFAULT_STIMULUS.base);
});

// --- coercitori e mappe -------------------------------------------------------

test("coercePhase / coerceStatus: default sensati", () => {
  assert.equal(coercePhase("peak"), "peak");
  assert.equal(coercePhase("xxx"), "base");
  assert.equal(coercePhase(null), "base");
  assert.equal(coerceStatus("archived"), "archived");
  assert.equal(coerceStatus("xxx"), "draft");
  assert.equal(coerceStatus(undefined), "draft");
});

test("isAdaptationTarget: riconosce i 14 valori reali", () => {
  for (const t of ADAPTATION_TARGETS) assert.ok(isAdaptationTarget(t));
  assert.equal(isAdaptationTarget("threshold"), false);
  assert.equal(isAdaptationTarget(null), false);
});

test("WEEK_OBJECTIVE_KEY_TO_TARGET: 8 chip → target validi e distinti", () => {
  const values = Object.values(WEEK_OBJECTIVE_KEY_TO_TARGET);
  assert.equal(values.length, 8);
  for (const v of values) assert.ok(isAdaptationTarget(v));
  // ancore esplicite del blueprint B
  assert.equal(WEEK_OBJECTIVE_KEY_TO_TARGET.forza, "max_strength");
  assert.equal(WEEK_OBJECTIVE_KEY_TO_TARGET.aerobico, "mitochondrial_density");
  assert.equal(WEEK_OBJECTIVE_KEY_TO_TARGET.lattato, "lactate_tolerance");
  assert.equal(WEEK_OBJECTIVE_KEY_TO_TARGET.sprint_agilita, "neuromuscular_adaptation");
  assert.equal(WEEK_OBJECTIVE_KEY_TO_TARGET.recupero, "recovery");
  // distinti
  assert.equal(new Set(values).size, values.length);
});
