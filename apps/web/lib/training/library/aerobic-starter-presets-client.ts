"use client";

import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { AEROBIC_STARTER_PRESETS, type AerobicStarterPreset } from "@/lib/training/library/starter-pack-aerobic";

const TABLE = "aerobic_starter_presets";

let cache: Promise<AerobicStarterPreset[]> | null = null;

/**
 * Catalogo preset aerobici lato client (browser→Supabase diretto, RLS anon-read).
 * Memoizzato a livello di modulo: una sola read per sessione, riusata da tutte le
 * materializzazioni VIRYA. Fallback su `AEROBIC_STARTER_PRESETS` se il client browser
 * non è disponibile, la tabella è vuota o la query fallisce → comportamento invariato.
 */
export function loadAerobicStarterPresetsClient(): Promise<AerobicStarterPreset[]> {
  if (cache) return cache;
  cache = (async () => {
    try {
      const supabase = createEmpathyBrowserSupabase();
      if (!supabase) return AEROBIC_STARTER_PRESETS;
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
  })();
  return cache;
}
