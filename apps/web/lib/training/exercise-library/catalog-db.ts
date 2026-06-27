import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { rowsToCatalogFile, type ExerciseCatalogRow } from "./catalog-row";
import { loadUnifiedExerciseCatalog } from "./catalog-loader";
import type { ExerciseCatalogFile } from "./types";

const CATALOG_TABLE = "exercise_catalog";

const SELECT_COLUMNS = [
  "id",
  "slug",
  "name",
  "category",
  "sport_tags",
  "movement_pattern",
  "muscle_groups",
  "equipment",
  "difficulty",
  "primary_system",
  "energy_system",
  "physiology",
  "skills",
  "purpose",
  "provenance",
  "media",
].join(", ");

/**
 * Catalogo unificato letto da `public.exercise_catalog` (DB-first).
 * Dato pubblico non per-utente: RLS consente SELECT a anon/authenticated.
 * Mantiene la stessa shape di `loadUnifiedExerciseCatalog()` (versione statica),
 * così i consumer non cambiano contratto.
 */
export async function loadUnifiedExerciseCatalogFromDb(): Promise<ExerciseCatalogFile> {
  // DB-first con fallback statico: finché la tabella non è seedata (o se il DB
  // non è raggiungibile) si usa il catalogo in-memory, così la route non rompe.
  // Una volta seedato `exercise_catalog`, il path DB prevale automaticamente.
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from(CATALOG_TABLE)
      .select(SELECT_COLUMNS)
      .order("id", { ascending: true });

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as ExerciseCatalogRow[];
    if (rows.length === 0) return loadUnifiedExerciseCatalog();
    return rowsToCatalogFile(rows);
  } catch {
    return loadUnifiedExerciseCatalog();
  }
}
