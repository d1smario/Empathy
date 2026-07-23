import type { SupabaseClient } from "@supabase/supabase-js";
import { recordTrainingAlertAfterExecutedUpsert } from "@/lib/alerts/athlete-alerts-writers";

export type ExecutedWorkoutUpsertPayload = {
  athlete_id: string;
  date: string;
  /** Ora reale inizio seduta (import vendor / FIT); guida timeline bioenergetica e curve training. */
  started_at?: string | null;
  ended_at?: string | null;
  duration_minutes: number;
  tss: number;
  kcal: number | null;
  kj: number | null;
  source: string;
  external_id: string;
  trace_summary: Record<string, unknown>;
  subjective_notes: string | null;
};

/**
 * Canonical upsert-by-external-id for executed workouts.
 * Keeps one row per `(athlete_id, external_id)` and updates payload on re-sync.
 */
export async function upsertExecutedWorkoutByExternalId(
  db: SupabaseClient,
  payload: ExecutedWorkoutUpsertPayload,
): Promise<{ id: string | null; status: "inserted" | "updated" }> {
  const existing = await db
    .from("executed_workouts")
    .select("id")
    .eq("athlete_id", payload.athlete_id)
    .eq("external_id", payload.external_id)
    .limit(1)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  if (existing.data?.id) {
    const upd = await db.from("executed_workouts").update(payload).eq("id", existing.data.id);
    if (upd.error) throw new Error(upd.error.message);
    await fireTrainingAlert(db, payload);
    return { id: existing.data.id, status: "updated" };
  }

  const ins = await db.from("executed_workouts").insert(payload).select("id").maybeSingle();
  if (ins.error) throw new Error(ins.error.message);
  const id = ins.data && typeof (ins.data as { id?: unknown }).id === "string" ? (ins.data as { id: string }).id : null;
  await fireTrainingAlert(db, payload);
  return { id, status: "inserted" };
}

/**
 * Alert event-driven eseguito vs pianificato del giorno (training_over/under) — FAIL-SAFE:
 * il writer non lancia mai, ma il try/catch protegge comunque il sync dal punto alert.
 */
async function fireTrainingAlert(db: SupabaseClient, payload: ExecutedWorkoutUpsertPayload): Promise<void> {
  try {
    await recordTrainingAlertAfterExecutedUpsert(db, { athleteId: payload.athlete_id, date: payload.date });
  } catch {
    /* alert best-effort */
  }
}
