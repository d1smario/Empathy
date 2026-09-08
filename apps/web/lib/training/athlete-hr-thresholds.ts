import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ATHLETE_HR_THRESHOLDS_UNAVAILABLE,
  athleteHrThresholdsFromProfile,
  type AthleteHrThresholds,
} from "@empathy/domain-training";

/**
 * Esito della lettura delle soglie FC dell'atleta.
 *
 * Distinguere «l'atleta non ha soglie» da «non sono riuscito a leggerle» è il punto:
 * supabase-js NON lancia, ritorna `{ data: null, error }`. Trattare l'errore come
 * «nessuna soglia» faceva finire in silenzio TUTTE le sedute di un giro sul ramo
 * peggiore, senza un log e senza traccia in DB.
 */
export type AthleteHrThresholdsRead =
  | { ok: true; thresholds: AthleteHrThresholds }
  | { ok: false; thresholds: AthleteHrThresholds; error: string };

const HR_THRESHOLDS_READ_FAILED = "athlete_hr_thresholds_read_failed" as const;

/** Motivo, da scrivere accanto al carico assente, quando il profilo non è leggibile. */
export const ATHLETE_HR_THRESHOLDS_READ_FAILED_REASON = HR_THRESHOLDS_READ_FAILED;

/**
 * Soglie FC dell'atleta per l'hrTSS, dalle uniche fonti di anagrafica valide:
 *   1. `physiological_profiles.lt2_heart_rate` (soglia misurata)
 *   2. `athlete_profiles.threshold_hr_bpm`     (soglia dichiarata)
 *   3. `athlete_profiles.max_hr_bpm`           (→ LTHR ≈ 0,9×FCmax nel motore)
 *
 * Nessun fallback sulla seduta: il picco di FC di una singola attività non è la FC max
 * dell'atleta.
 */
export async function readAthleteHrThresholds(
  db: SupabaseClient,
  athleteId: string,
): Promise<AthleteHrThresholdsRead> {
  const [physRes, profileRes] = await Promise.all([
    db
      .from("physiological_profiles")
      .select("lt2_heart_rate")
      .eq("athlete_id", athleteId)
      .order("valid_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("athlete_profiles").select("threshold_hr_bpm, max_hr_bpm").eq("id", athleteId).maybeSingle(),
  ]);

  // supabase-js non lancia: l'errore va letto, non ignorato.
  const failures = [physRes.error?.message, profileRes.error?.message].filter(
    (m): m is string => typeof m === "string" && m.length > 0,
  );
  if (failures.length > 0) {
    return {
      ok: false,
      thresholds: ATHLETE_HR_THRESHOLDS_UNAVAILABLE,
      error: `${HR_THRESHOLDS_READ_FAILED}: ${failures.join(" | ")}`,
    };
  }

  const phys = physRes.data as { lt2_heart_rate?: unknown } | null;
  const profile = profileRes.data as { threshold_hr_bpm?: unknown; max_hr_bpm?: unknown } | null;
  return {
    ok: true,
    thresholds: athleteHrThresholdsFromProfile({
      lt2HeartRate: phys?.lt2_heart_rate,
      thresholdHrBpm: profile?.threshold_hr_bpm,
      maxHrBpm: profile?.max_hr_bpm,
    }),
  };
}

/**
 * Variante per i path di sola lettura (analytics, calendario, dettaglio seduta): se il
 * profilo non risponde le soglie restano assenti e il carico da FC non viene stimato,
 * ma l'errore finisce comunque a log invece di sparire.
 */
export async function loadAthleteHrThresholdsForRead(
  db: SupabaseClient,
  athleteId: string,
  context: string,
): Promise<AthleteHrThresholds> {
  const read = await readAthleteHrThresholds(db, athleteId);
  if (!read.ok) {
    console.error(`[${context}] soglie FC atleta non leggibili`, { athleteId, error: read.error });
  }
  return read.thresholds;
}
