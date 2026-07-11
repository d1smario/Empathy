import type { SupabaseClient } from "@supabase/supabase-js";
import { computeNutritionDailyEnergyModel } from "@/lib/nutrition/daily-energy-solver";
import { loadObservedActiveKcal } from "@/lib/nutrition/load-observed-active-kcal";
import { computeReintegration, type Reintegration } from "@/lib/nutrition/reintegration-engine";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";

export type ReintegrationRunResult =
  | { ok: true; reintegration: Reintegration; observedActiveKcal: number | null; persisted: "upsert" | "cleared" | "noop" }
  | { ok: false; error: string };

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Reintegro post-allenamento per (atleta, giorno). Gira il solver DUE volte — stima (pianificato)
 * vs osservato (device, Decisione B) — e persiste il delta come EXTRA additivo in
 * nutrition_daily_adjustment (kind='reintegration'). Reversibile: se il surplus non c'è più,
 * rimuove la riga. Senza dato device osservato non fa nulla (non sa quanto hai speso davvero).
 */
export async function runPostWorkoutReintegration(
  db: SupabaseClient,
  athleteId: string,
  date: string,
): Promise<ReintegrationRunResult> {
  const [{ data: profile }, { data: plannedRows }, observedActiveKcal] = await Promise.all([
    db
      .from("athlete_profiles")
      .select("birth_date, sex, height_cm, weight_kg, body_fat_pct, ftp_watts, lifestyle_activity_class")
      .eq("id", athleteId)
      .maybeSingle(),
    db
      .from("planned_workouts")
      .select("duration_minutes, tss_target, kcal_target, notes")
      .eq("athlete_id", athleteId)
      .eq("date", date),
    loadObservedActiveKcal(db, athleteId, date),
  ]);

  // Senza consumo osservato non possiamo sapere il delta reale → non tocchiamo nulla.
  if (observedActiveKcal == null) {
    return { ok: true, reintegration: { triggered: false, extraKcal: 0, extraCarbsG: 0, extraWaterMl: 0, supplements: [], reason: null }, observedActiveKcal: null, persisted: "noop" };
  }

  const p = (profile ?? {}) as Record<string, unknown>;
  const plannedTraining = (Array.isArray(plannedRows) ? plannedRows : []).map((r) => {
    const rr = r as Record<string, unknown>;
    const bs = parsePro2BuilderSessionFromNotes(typeof rr.notes === "string" ? rr.notes : null);
    return {
      durationMinutes: num(rr.duration_minutes) ?? 0,
      tssTarget: num(rr.tss_target) ?? undefined,
      kcalTarget: num(rr.kcal_target) ?? undefined,
      avgPowerW: bs?.summary?.avgPowerW ?? null,
    };
  });

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
    plannedTraining,
    recoveryStatus: "unknown" as const,
  };

  const estimated = computeNutritionDailyEnergyModel({ ...solverBase, observedActiveKcal: null });
  const observed = computeNutritionDailyEnergyModel({ ...solverBase, observedActiveKcal });

  const reintegration = computeReintegration({
    estimatedMealsKcal: estimated.totals.mealsKcal,
    observedMealsKcal: observed.totals.mealsKcal,
    trainingDurationMin: estimated.training.durationMin,
  });

  if (reintegration.triggered) {
    const { error } = await db.from("nutrition_daily_adjustment").upsert(
      {
        athlete_id: athleteId,
        date,
        kind: "reintegration",
        extra_kcal: reintegration.extraKcal,
        extra_carbs_g: reintegration.extraCarbsG,
        extra_water_ml: reintegration.extraWaterMl,
        extra_supplements: reintegration.supplements,
        reason: reintegration.reason,
        source: "device_active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "athlete_id,date,kind" },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true, reintegration, observedActiveKcal, persisted: "upsert" };
  }

  // Reversibile: niente surplus → rimuovi un eventuale reintegro precedente del giorno.
  await db
    .from("nutrition_daily_adjustment")
    .delete()
    .eq("athlete_id", athleteId)
    .eq("date", date)
    .eq("kind", "reintegration");
  return { ok: true, reintegration, observedActiveKcal, persisted: "cleared" };
}
