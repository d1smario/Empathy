import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlannedWorkoutDbRow } from "@empathy/domain-training";
import { computeNutritionDailyEnergyModel } from "@/lib/nutrition/daily-energy-solver";
import { computeReduction, type Reduction } from "@/lib/nutrition/reduction-engine";
import { getScheduledTimeFromPlannedRow, parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";

export type ReductionRunResult =
  | { ok: true; reduction: Reduction; skippedCount: number; persisted: "upsert" | "cleared" | "noop" }
  | { ok: false; error: string };

/** Margine dopo la fine finestra prima di dichiarare «saltato» (tolleranza ingestion device). */
const SKIP_MARGIN_MIN = 90;

const DEFAULT_SLOT_MIN: Record<string, number> = {
  breakfast: 7 * 60 + 30,
  snack_am: 10 * 60 + 30,
  lunch: 13 * 60,
  snack_pm: 16 * 60 + 30,
  dinner: 20 * 60,
  snack_evening: 22 * 60,
};

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
function hhmmToMin(s: string | null): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(s.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
/** Minuti dell'ora corrente nel fuso dell'atleta (fallback UTC). */
function nowLocalMinutes(tz: string | null): number {
  const now = new Date();
  try {
    const s = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz ?? "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);
    const m = /^(\d{1,2}):(\d{2})/.exec(s);
    return m ? Number(m[1]) * 60 + Number(m[2]) : now.getUTCHours() * 60 + now.getUTCMinutes();
  } catch {
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}
function slotTimeMinutes(slot: string, routineConfig: Record<string, unknown> | null): number {
  const mt = routineConfig && typeof routineConfig === "object" ? (routineConfig as Record<string, unknown>).meal_times : null;
  const flat = mt && typeof mt === "object" && !Array.isArray(mt) ? (mt as Record<string, unknown>) : {};
  const raw = typeof flat[slot] === "string" ? (flat[slot] as string) : null;
  return hhmmToMin(raw) ?? DEFAULT_SLOT_MIN[slot] ?? 12 * 60;
}
function toPlannedTraining(rows: Array<Record<string, unknown>>) {
  return rows.map((rr) => {
    const bs = parsePro2BuilderSessionFromNotes(typeof rr.notes === "string" ? rr.notes : null);
    return {
      durationMinutes: num(rr.duration_minutes) ?? 0,
      tssTarget: num(rr.tss_target) ?? undefined,
      kcalTarget: num(rr.kcal_target) ?? undefined,
      avgPowerW: bs?.summary?.avgPowerW ?? null,
    };
  });
}

/**
 * Riduzione del giorno corrente: se allenamenti programmati NON risultano fatti (finestra passata,
 * nessun executed collegato), alleggerisce i pasti RIMANENTI. Reversibile: ricalcolo azzera se
 * l'attività compare. Persiste kind='reduction' (extra_kcal negativo) in nutrition_daily_adjustment.
 */
export async function runDailyReduction(
  db: SupabaseClient,
  athleteId: string,
  date: string,
  opts?: { nowLocalMin?: number },
): Promise<ReductionRunResult> {
  const [{ data: profile }, { data: plannedRows }, { data: executedRows }, { data: planRow }] = await Promise.all([
    db
      .from("athlete_profiles")
      .select("birth_date, sex, height_cm, weight_kg, body_fat_pct, ftp_watts, lifestyle_activity_class, timezone, routine_config")
      .eq("id", athleteId)
      .maybeSingle(),
    db
      .from("planned_workouts")
      .select("id, date, type, duration_minutes, tss_target, kcal_target, notes")
      .eq("athlete_id", athleteId)
      .eq("date", date),
    db.from("executed_workouts").select("planned_workout_id").eq("athlete_id", athleteId).eq("date", date),
    db
      .from("nutrition_plan")
      .select("id, meal(slot, kcal_target)")
      .eq("athlete_id", athleteId)
      .eq("plan_date", date)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const planned = (Array.isArray(plannedRows) ? plannedRows : []) as Array<Record<string, unknown>>;
  const clearReduction = async () => {
    await db.from("nutrition_daily_adjustment").delete().eq("athlete_id", athleteId).eq("date", date).eq("kind", "reduction");
  };
  if (planned.length === 0) {
    await clearReduction();
    return { ok: true, reduction: { triggered: false, reductionKcal: 0, reason: null }, skippedCount: 0, persisted: "noop" };
  }

  const p = (profile ?? {}) as Record<string, unknown>;
  const routineConfig = p.routine_config && typeof p.routine_config === "object" && !Array.isArray(p.routine_config) ? (p.routine_config as Record<string, unknown>) : null;
  const tz = typeof p.timezone === "string" ? p.timezone : null;
  const nowMin = opts?.nowLocalMin ?? nowLocalMinutes(tz);

  const executedPlannedIds = new Set(
    ((executedRows ?? []) as Array<Record<string, unknown>>).map((e) => String(e.planned_workout_id ?? "")).filter(Boolean),
  );

  // Skip = finestra passata (orario + durata + margine) e nessun executed collegato.
  const skippedIds = new Set<string>();
  for (const row of planned) {
    const sched = getScheduledTimeFromPlannedRow(row as unknown as PlannedWorkoutDbRow, routineConfig);
    const schedMin = hhmmToMin(sched);
    if (schedMin == null) continue; // senza orario non dichiariamo skip
    const dur = num(row.duration_minutes) ?? 60;
    if (schedMin + dur + SKIP_MARGIN_MIN < nowMin && !executedPlannedIds.has(String(row.id ?? ""))) {
      skippedIds.add(String(row.id ?? ""));
    }
  }

  if (skippedIds.size === 0) {
    await clearReduction();
    return { ok: true, reduction: { triggered: false, reductionKcal: 0, reason: null }, skippedCount: 0, persisted: "cleared" };
  }

  const solverBase = {
    athleteId,
    date,
    birthDate: typeof p.birth_date === "string" ? p.birth_date : null,
    sex: typeof p.sex === "string" ? p.sex : null,
    heightCm: num(p.height_cm),
    weightKg: num(p.weight_kg),
    bodyFatPct: num(p.body_fat_pct),
    ftpWatts: num(p.ftp_watts),
    vo2maxMlMinKg: null,
    lifestyleActivityClass: typeof p.lifestyle_activity_class === "string" ? p.lifestyle_activity_class : "moderate",
    recoveryStatus: "unknown" as const,
  };
  const all = computeNutritionDailyEnergyModel({ ...solverBase, plannedTraining: toPlannedTraining(planned) });
  const remaining = computeNutritionDailyEnergyModel({
    ...solverBase,
    plannedTraining: toPlannedTraining(planned.filter((r) => !skippedIds.has(String(r.id ?? "")))),
  });
  const skippedMealKcal = all.totals.mealsKcal - remaining.totals.mealsKcal;

  // Capacità dei pasti ancora davanti (dal piano persistito).
  const meals = ((planRow as { meal?: Array<Record<string, unknown>> } | null)?.meal ?? []) as Array<Record<string, unknown>>;
  let remainingMealsCapacityKcal = 0;
  for (const m of meals) {
    const slot = typeof m.slot === "string" ? m.slot : "";
    if (slotTimeMinutes(slot, routineConfig) > nowMin) remainingMealsCapacityKcal += num(m.kcal_target) ?? 0;
  }

  const reduction = computeReduction({ skippedMealKcal, remainingMealsCapacityKcal });
  if (!reduction.triggered) {
    await clearReduction();
    return { ok: true, reduction, skippedCount: skippedIds.size, persisted: "cleared" };
  }

  const { error } = await db.from("nutrition_daily_adjustment").upsert(
    {
      athlete_id: athleteId,
      date,
      kind: "reduction",
      extra_kcal: -reduction.reductionKcal,
      extra_carbs_g: 0,
      extra_water_ml: 0,
      reason: reduction.reason,
      source: "skipped_workout",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "athlete_id,date,kind" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, reduction, skippedCount: skippedIds.size, persisted: "upsert" };
}
