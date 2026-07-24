import type { SupabaseClient } from "@supabase/supabase-js";
import { AEROBIC_STARTER_PRESETS, type AerobicStarterPreset } from "@/lib/training/library/starter-pack-aerobic";

const TABLE = "aerobic_starter_presets";

/**
 * CORE bundle-abile di `starter-pack-aerobic-db.ts` (estratto per il motore L2,
 * blueprint F3): il wrapper storico è `server-only` + client da cookie Next.
 * Qui il client è INIETTATO — stessa logica una volta sola, il wrapper reimporta.
 *
 * Fallback statico `AEROBIC_STARTER_PRESETS` se la tabella è vuota o
 * irraggiungibile: shape e comportamento identici finché il DB non viene curato.
 */
export async function loadAerobicStarterPresetsWithClient(
  client: SupabaseClient,
): Promise<AerobicStarterPreset[]> {
  try {
    const { data, error } = await client
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
