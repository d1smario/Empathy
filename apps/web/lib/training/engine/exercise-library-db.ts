import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { TRAINING_EXERCISE_LIBRARY } from "@/lib/training/engine/exercise-library";
import type { ExerciseLibraryItem } from "@/lib/training/engine/types";

const TABLE = "training_exercise_library";

/**
 * Libreria esercizi motore letta da `public.training_exercise_library` (DB-first).
 * Dato pubblico non per-utente: RLS consente SELECT a anon/authenticated.
 * Stessa shape di `TRAINING_EXERCISE_LIBRARY` (versione statica) → i consumer non
 * cambiano contratto. Ogni riga conserva il record completo in `data` (jsonb).
 *
 * Fallback statico: finché la tabella non è seedata (o se il DB è irraggiungibile)
 * si usa l'array in-memory, così la route non rompe. Una volta seedata, il path DB
 * prevale automaticamente.
 */
export async function loadTrainingExerciseLibraryFromDb(): Promise<ExerciseLibraryItem[]> {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("data")
      .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<{ data: ExerciseLibraryItem }>;
    if (rows.length === 0) return TRAINING_EXERCISE_LIBRARY;
    return rows.map((row) => row.data);
  } catch {
    return TRAINING_EXERCISE_LIBRARY;
  }
}
