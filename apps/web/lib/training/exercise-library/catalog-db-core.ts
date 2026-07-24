import type { SupabaseClient } from "@supabase/supabase-js";
import { rowsToCatalogFile, type ExerciseCatalogRow } from "./catalog-row";
import { loadUnifiedExerciseCatalog } from "./catalog-loader";
import type { ExerciseCatalogFile } from "./types";

/**
 * CORE bundle-abile di `catalog-db.ts` (estratto per il motore L2, blueprint F3):
 * il wrapper storico è `server-only` + client da cookie Next, quindi non entra in
 * un bundle Edge Function. Qui il client Supabase è INIETTATO dal chiamante
 * (server Next O Edge Function) e la logica vive una volta sola — zero duplicazione:
 * `loadUnifiedExerciseCatalogFromDb` reimporta questo core.
 */

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
 * Catalogo unificato da `public.exercise_catalog` (DB-first) con client iniettato.
 * Fallback statico in-memory se la tabella è vuota o irraggiungibile: stessa
 * semantica del wrapper server, i consumer non cambiano contratto.
 */
export async function loadUnifiedExerciseCatalogWithClient(
  client: SupabaseClient,
): Promise<ExerciseCatalogFile> {
  try {
    const { data, error } = await client
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
