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

const PROFILE = {
  birth_date: "1990-05-01", sex: "male", height_cm: 180, weight_kg: 74, body_fat_pct: 12,
  ftp_watts: 280, lifestyle_activity_class: "moderate", timezone: "Europe/Rome",
  routine_config: { training_1: { start_time: "06:00" }, meal_times: { dinner: "20:00", snack_evening: "22:30" } },
};
const PLANNED = [{ id: "w1", date: "2026-07-12", type: "cycling", duration_minutes: 90, tss_target: 120, kcal_target: 900, notes: null }];
const PLAN = { id: "p1", meal: [{ slot: "dinner", kcal_target: 900 }, { slot: "snack_evening", kcal_target: 200 }] };

test("skip rilevato: riduzione capata sui pasti rimanenti", async () => {
  const db = makeDb({ athlete_profiles: PROFILE, planned_workouts: PLANNED, executed_workouts: [], nutrition_plan: PLAN });
  const r = await runDailyReduction(db, "a1", "2026-07-12", { nowLocalMin: 600 }); // 10:00
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.skippedCount, 1);
    assert.equal(r.reduction.triggered, true);
    assert.ok(r.reduction.reductionKcal > 0);
  }
});

test("executed collegato: nessuno skip (reversibile)", async () => {
  const db = makeDb({ athlete_profiles: PROFILE, planned_workouts: PLANNED, executed_workouts: [{ planned_workout_id: "w1" }], nutrition_plan: PLAN });
  const r = await runDailyReduction(db, "a1", "2026-07-12", { nowLocalMin: 600 });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.skippedCount, 0);
    assert.equal(r.reduction.triggered, false);
  }
});

test("troppo tardi: skip ma nessun pasto rimane → niente", async () => {
  const db = makeDb({ athlete_profiles: PROFILE, planned_workouts: PLANNED, executed_workouts: [], nutrition_plan: PLAN });
  const r = await runDailyReduction(db, "a1", "2026-07-12", { nowLocalMin: 23 * 60 + 30 }); // 23:30
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.skippedCount, 1);
    assert.equal(r.reduction.triggered, false); // cap 0 → niente
  }
});
