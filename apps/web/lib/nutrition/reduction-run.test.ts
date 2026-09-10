import test from "node:test";
import assert from "node:assert/strict";
import { runDailyReduction } from "./reduction-run";

/** Mock minimale del client Supabase: dati canned per tabella, chain thenable. */
function makeDb(data: Record<string, unknown>) {
  function chain(table: string): unknown {
    const raw = data[table];
    const single = Array.isArray(raw) ? (raw[0] ?? null) : raw ?? null;
    const arr = { data: Array.isArray(raw) ? raw : raw ? [raw] : [], error: null };
    const c: Record<string, unknown> = {
      select: () => c,
      eq: () => c,
      order: () => c,
      limit: () => c,
      maybeSingle: () => Promise.resolve({ data: single, error: null }),
      upsert: () => Promise.resolve({ data: null, error: null }),
      delete: () => c,
      then: (res: (v: unknown) => unknown) => Promise.resolve(arr).then(res),
    };
    return c;
  }
  return { from: (t: string) => chain(t) } as never;
}

// Schema reale: athlete_profiles NON ha ftp_watts/lifestyle_activity_class —
// l'FTP vive in physiological_profiles e il lifestyle in routine_config.
const PROFILE = {
  birth_date: "1990-05-01", sex: "male", height_cm: 180, weight_kg: 74, body_fat_pct: 12,
  timezone: "Europe/Rome",
  routine_config: { lifestyle_activity_class: "moderate", training_1: { start_time: "06:00" }, meal_times: { dinner: "20:00", snack_evening: "22:30" } },
};
const PHYSIO = { ftp_watts: 280 };
const PLANNED = [{ id: "w1", date: "2026-07-12", type: "cycling", duration_minutes: 90, tss_target: 120, kcal_target: 900, notes: null }];
const PLAN = { id: "p1", meal: [{ slot: "dinner", kcal_target: 900 }, { slot: "snack_evening", kcal_target: 200 }] };

test("skip rilevato: riduzione capata sui pasti rimanenti", async () => {
  const db = makeDb({ athlete_profiles: PROFILE, physiological_profiles: PHYSIO, planned_workouts: PLANNED, executed_workouts: [], nutrition_plan: PLAN });
  const r = await runDailyReduction(db, "a1", "2026-07-12", { nowLocalMin: 600 }); // 10:00
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.skippedCount, 1);
    assert.equal(r.reduction.triggered, true);
    assert.ok(r.reduction.reductionKcal > 0);
  }
});

test("executed collegato: nessuno skip (reversibile)", async () => {
  const db = makeDb({ athlete_profiles: PROFILE, physiological_profiles: PHYSIO, planned_workouts: PLANNED, executed_workouts: [{ planned_workout_id: "w1" }], nutrition_plan: PLAN });
  const r = await runDailyReduction(db, "a1", "2026-07-12", { nowLocalMin: 600 });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.skippedCount, 0);
    assert.equal(r.reduction.triggered, false);
  }
});

test("troppo tardi: skip ma nessun pasto rimane → niente", async () => {
  const db = makeDb({ athlete_profiles: PROFILE, physiological_profiles: PHYSIO, planned_workouts: PLANNED, executed_workouts: [], nutrition_plan: PLAN });
  const r = await runDailyReduction(db, "a1", "2026-07-12", { nowLocalMin: 23 * 60 + 30 }); // 23:30
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.skippedCount, 1);
    assert.equal(r.reduction.triggered, false); // cap 0 → niente
  }
});

/**
 * I due casi che in produzione hanno tagliato i pasti a un atleta che si era allenato
 * (16 e 30 agosto 2026): esecuzione registrata da Garmin, quindi SENZA `planned_workout_id`,
 * perché quel campo lo scrive solo l'import manuale.
 */
test("Garmin non collega mai: un'esecuzione nella finestra non è più uno skip", async () => {
  const db = makeDb({
    athlete_profiles: PROFILE,
    physiological_profiles: PHYSIO,
    planned_workouts: PLANNED,
    // Seduta prevista alle 06:00; partita alle 06:15 (04:15Z, ora di Roma d'estate).
    executed_workouts: [{ planned_workout_id: null, started_at: "2026-07-12T04:15:00.000Z", duration_minutes: 95 }],
    nutrition_plan: PLAN,
  });
  const r = await runDailyReduction(db, "a1", "2026-07-12", { nowLocalMin: 600 });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.skippedCount, 0, "l'atleta si era allenato: nessun pasto va tagliato");
    assert.equal(r.reduction.triggered, false);
  }
});

test("attività lontana dalla finestra: lo skip resta, com'è giusto", async () => {
  const db = makeDb({
    athlete_profiles: PROFILE,
    physiological_profiles: PHYSIO,
    planned_workouts: PLANNED,
    // Camminata delle 14:00 (12:00Z): non è la seduta delle 06:00.
    executed_workouts: [{ planned_workout_id: null, started_at: "2026-07-12T12:00:00.000Z", duration_minutes: 30 }],
    nutrition_plan: PLAN,
  });
  const r = await runDailyReduction(db, "a1", "2026-07-12", {
    nowLocalMin: 20 * 60,
    loadObservedActiveKcal: async () => null, // nessun dato dal dispositivo
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.skippedCount, 1);
});

test("il dispositivo smentisce lo skip: consumo misurato ≥ energia della seduta", async () => {
  const db = makeDb({
    athlete_profiles: PROFILE,
    physiological_profiles: PHYSIO,
    planned_workouts: PLANNED,
    executed_workouts: [],
    nutrition_plan: PLAN,
  });
  const r = await runDailyReduction(db, "a1", "2026-07-12", {
    nowLocalMin: 600,
    loadObservedActiveKcal: async () => 5000, // ha speso più di quanto la seduta valesse
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.reduction.triggered, false, "l'energia l'ha spesa: non si toglie cibo");
    assert.equal(r.skippedCount, 0);
  }
});

test("consumo misurato basso: la riduzione resta", async () => {
  const db = makeDb({
    athlete_profiles: PROFILE,
    physiological_profiles: PHYSIO,
    planned_workouts: PLANNED,
    executed_workouts: [],
    nutrition_plan: PLAN,
  });
  const r = await runDailyReduction(db, "a1", "2026-07-12", {
    nowLocalMin: 600,
    loadObservedActiveKcal: async () => 50,
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.reduction.triggered, true);
});
