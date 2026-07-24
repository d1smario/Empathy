import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { AerobicStarterPreset } from "@/lib/training/library/starter-pack-aerobic";
import { loadAerobicStarterPresetsWithClient } from "@/lib/training/library/starter-pack-aerobic-db-core";

/**
 * Catalogo preset workout aerobici letto da `public.aerobic_starter_presets` (DB-first).
 * Dato pubblico non per-utente: RLS consente SELECT a anon/authenticated. Ogni riga conserva
 * il preset completo in `data` (jsonb); `sort_order` preserva l'ordine dell'array statico
 * (rilevante per la rotazione del resolver e l'ordine di import).
 *
 * Wrapper `server-only`: il core con client iniettato vive in
 * `starter-pack-aerobic-db-core.ts` (bundle-abile nella Edge Function del motore L2,
 * blueprint F3 — zero duplicazione: la logica e il fallback statico vivono nel core).
 */
export async function loadAerobicStarterPresetsFromDb(): Promise<AerobicStarterPreset[]> {
  return loadAerobicStarterPresetsWithClient(createServerSupabaseClient());
}
