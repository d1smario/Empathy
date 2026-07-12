import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMacroPhases } from "@/lib/training/build-macro-phases";
import { generateAndPublishTrainingMacro } from "@/lib/training/generate-training-macro";

/**
 * Continuità del training: se all'atleta resta poca «pista» futura di allenamenti pianificati,
 * materializza il BLOCCO periodizzato successivo (accodato dopo l'ultimo pianificato, senza
 * sovrapposizioni), così il piano non si secca — come la nutrizione che si rigenera. Idempotente
 * (publish dedupe). Chiamato dal cron settimanale del martedì.
 */
export type EnsureContinuityResult =
  | { ok: true; extended: false; maxFuture: string | null }
  | { ok: true; extended: true; startMonday: string; workoutCount: number }
  | { ok: false; error: string };

const MIN_FUTURE_WEEKS = 3;

function isoUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function addDaysUTC(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoUTC(d);
}
function daysBetween(aIso: string, bIso: string): number {
  return Math.round((new Date(`${bIso}T00:00:00Z`).getTime() - new Date(`${aIso}T00:00:00Z`).getTime()) / 86_400_000);
}
function mondayOnOrAfter(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=dom
  const delta = day === 1 ? 0 : day === 0 ? 1 : 8 - day;
  d.setUTCDate(d.getUTCDate() + delta);
  return isoUTC(d);
}

export async function ensureTrainingContinuity(
  db: SupabaseClient,
  athleteId: string,
  opts?: { minFutureWeeks?: number; todayIso?: string },
): Promise<EnsureContinuityResult> {
  const minFuture = opts?.minFutureWeeks ?? MIN_FUTURE_WEEKS;
  const today = opts?.todayIso ?? isoUTC(new Date());

  const { data: rows, error } = await db
    .from("planned_workouts")
    .select("date")
    .eq("athlete_id", athleteId)
    .gte("date", today)
    .order("date", { ascending: false })
    .limit(1);
  if (error) return { ok: false, error: error.message };

  const maxFuture = ((rows ?? []) as Array<Record<string, unknown>>)[0]?.date;
  const maxFutureIso = typeof maxFuture === "string" ? maxFuture.slice(0, 10) : null;

  if (maxFutureIso && daysBetween(today, maxFutureIso) >= minFuture * 7) {
    return { ok: true, extended: false, maxFuture: maxFutureIso };
  }

  // Accoda il blocco successivo dopo l'ultimo pianificato (o dal prossimo lunedì).
  const startMonday = mondayOnOrAfter(maxFutureIso ? addDaysUTC(maxFutureIso, 1) : today);
  const phases = buildMacroPhases({ startDate: startMonday, goalEventDate: null });
  const res = await generateAndPublishTrainingMacro(db, {
    athleteId,
    startDate: startMonday,
    phases,
    discipline: "cycling",
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, extended: true, startMonday, workoutCount: res.workoutCount };
}
