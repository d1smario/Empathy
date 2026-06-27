import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { AEROBIC_STARTER_PRESETS, type AerobicStarterPreset } from "@/lib/training/library/starter-pack-aerobic";

const TABLE = "aerobic_starter_presets";

/**
 * Catalogo preset workout aerobici letto da `public.aerobic_starter_presets` (DB-first).
 * Dato pubblico non per-utente: RLS consente SELECT a anon/authenticated. Ogni riga conserva
 * il preset completo in `data` (jsonb); `sort_order` preserva l'ordine dell'array statico
 * (rilevante per la rotazione del resolver e l'ordine di import).
 *
 * Fallback statico `AEROBIC_STARTER_PRESETS` se la tabella è vuota o irraggiungibile → i
 * consumer mantengono shape e comportamento identici finché il DB non viene editato.
 */
export async function loadAerobicStarterPresetsFromDb(): Promise<AerobicStarterPreset[]> {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("data")
      .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<{ data: AerobicStarterPreset }>;
    if (rows.length === 0) return AEROBIC_STARTER_PRESETS;
    return rows.map((row) => row.data);
  } catch {
    return AEROBIC_STARTER_PRESETS;
  }
}
