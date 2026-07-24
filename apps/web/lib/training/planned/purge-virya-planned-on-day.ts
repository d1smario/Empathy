import type { SupabaseClient } from "@supabase/supabase-js";
import { VIRYA_NOTES_ILIKE_MARKER } from "@/lib/training/virya/virya-planned-notes";

/**
 * Builder domina VIRYA: rimuove tutte le sedute generate dal motore sul giorno prima di
 * materializzare Builder. Evita doppio conteggio in nutrition / meal plan.
 * Due criteri (regola convivenza F2, blueprint D.2): il marker legacy nelle notes
 * ([VIRYA:...]) E il plan_id delle righe L2 materializzate — le sedute salvate a mano
 * dal Builder hanno sempre plan_id null, quindi non vengono mai toccate.
 */
export async function purgeViryaPlannedWorkoutsOnDay(
  db: SupabaseClient,
  athleteId: string,
  date: string,
): Promise<{ purgedCount: number }> {
  const dateKey = date.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return { purgedCount: 0 };
  }
  const { data, error } = await db
    .from("planned_workouts")
    .delete()
    .eq("athlete_id", athleteId)
    .eq("date", dateKey)
    .or(`notes.ilike.${VIRYA_NOTES_ILIKE_MARKER},plan_id.not.is.null`)
    .select("id");
  if (error) throw new Error(error.message);
  return { purgedCount: data?.length ?? 0 };
}
