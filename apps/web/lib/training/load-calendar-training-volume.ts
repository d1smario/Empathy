import type { SupabaseClient } from "@supabase/supabase-js";
import { addIsoDays, mondayOfIsoWeek } from "@/lib/dates/iso-day-arithmetic";
import {
  CALENDAR_VOLUME_WINDOW_WEEKS,
  observeCalendarTrainingVolume,
  type CalendarTrainingVolume,
  type PlannedWorkoutVolumeRow,
} from "@/lib/training/calendar-training-volume";

/**
 * Unico punto di LETTURA della fonte 3 (sedute del coach in `planned_workouts`).
 * La REGOLA sta tutta in `observeCalendarTrainingVolume` (pura, testata senza DB): qui
 * c'è solo la query, ristretta alla finestra così da non tirare su anni di calendario.
 *
 * Errore di lettura → `null` (calendario muto): il chiamante ricade sulle fonti dichiarate.
 * Un DB che non risponde non deve mai far peggiorare il piano né rimandare l'atleta in
 * sala d'attesa in modo diverso da prima di questa modifica.
 */
export async function loadCalendarTrainingVolume(
  db: SupabaseClient,
  athleteId: string,
  anchorIsoDay: string,
): Promise<CalendarTrainingVolume | null> {
  const windowStart = mondayOfIsoWeek(anchorIsoDay);
  const windowEndExclusive = addIsoDays(windowStart, CALENDAR_VOLUME_WINDOW_WEEKS * 7);

  const { data, error } = await db
    .from("planned_workouts")
    .select("date, duration_minutes")
    .eq("athlete_id", athleteId)
    .gte("date", windowStart)
    .lt("date", windowEndExclusive);
  if (error) return null;

  return observeCalendarTrainingVolume((data ?? []) as PlannedWorkoutVolumeRow[], anchorIsoDay);
}
