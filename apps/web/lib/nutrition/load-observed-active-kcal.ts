import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPhysiologyDailyPanel } from "@/lib/physiology/daily-wellness-panel";

/**
 * kcal ATTIVE osservate dal device per (atleta, data) — input della Decisione B.
 * Riusa l'estrazione del pannello wellness (device_sync_exports → activity.activeCaloriesKcal).
 * Ritorna null se il device non ha dato per quel giorno (→ il solver usa la stima pianificata).
 *
 * NB: per una data FUTURA non c'è dato → null → stima. L'osservato conta nel loop adattivo
 * (reintegro/ricalcolo su giorni già vissuti).
 */
export async function loadObservedActiveKcal(
  db: SupabaseClient,
  athleteId: string,
  date: string,
): Promise<number | null> {
  try {
    const panel = await buildPhysiologyDailyPanel({ db, athleteId, date });
    const v = panel?.activity?.activeCaloriesKcal;
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  } catch {
    return null;
  }
}
