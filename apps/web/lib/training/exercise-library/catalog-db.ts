import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { loadUnifiedExerciseCatalogWithClient } from "./catalog-db-core";
import type { ExerciseCatalogFile } from "./types";

/**
 * Catalogo unificato letto da `public.exercise_catalog` (DB-first).
 * Dato pubblico non per-utente: RLS consente SELECT a anon/authenticated.
 * Mantiene la stessa shape di `loadUnifiedExerciseCatalog()` (versione statica),
 * così i consumer non cambiano contratto.
 *
 * Wrapper `server-only`: il core con client iniettato vive in `catalog-db-core.ts`
 * (bundle-abile nella Edge Function del motore L2 — blueprint F3, zero duplicazione).
 */
export async function loadUnifiedExerciseCatalogFromDb(): Promise<ExerciseCatalogFile> {
  return loadUnifiedExerciseCatalogWithClient(createServerSupabaseClient());
}
