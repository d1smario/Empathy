import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeOnboardingCompleteness,
  type OnboardingCompleteness,
  type OnboardingProfileFields,
  type OnboardingSnapshot,
} from "./onboarding-completeness";

/** Finestra entro cui il device è considerato «alimentato» (righe recenti in device_sync_exports). */
const DEVICE_FED_WINDOW_DAYS = 7;

const PROFILE_COLUMNS =
  "sex, birth_date, timezone, height_cm, weight_kg, body_fat_pct, muscle_mass_kg, " +
  "resting_hr_bpm, max_hr_bpm, threshold_hr_bpm, goals, training_days_per_week, " +
  "training_max_session_minutes, diet_type, preferred_meal_count, intolerances, " +
  "allergies, food_exclusions, food_preferences";

/**
 * Assembla la fotografia onboarding dal DB per un atleta. Il client decide lo scope:
 * user-client per la UI dell'atleta (RLS sulla propria riga), service-role per la cron mail.
 *
 * Due segnali device distinti: `deviceConnected` = link OAuth presente (vendor_oauth_links),
 * `deviceFed` = dati davvero arrivati di recente (device_sync_exports) — «collegato» ≠ «alimentato».
 */
export async function loadOnboardingSnapshot(
  db: SupabaseClient,
  athleteId: string,
): Promise<OnboardingSnapshot> {
  const sinceIso = new Date(Date.now() - DEVICE_FED_WINDOW_DAYS * 86_400_000).toISOString();

  const [profileRes, linkRes, fedRes, ftpRes, bloodRes] = await Promise.all([
    db.from("athlete_profiles").select(PROFILE_COLUMNS).eq("id", athleteId).maybeSingle(),
    db.from("vendor_oauth_links").select("id", { count: "exact", head: true }).eq("athlete_id", athleteId),
    db
      .from("device_sync_exports")
      .select("id", { count: "exact", head: true })
      .eq("athlete_id", athleteId)
      .gte("created_at", sinceIso),
    db
      .from("physiological_profiles")
      .select("id", { count: "exact", head: true })
      .eq("athlete_id", athleteId)
      .not("ftp_watts", "is", null),
    db.from("biomarker_panels").select("id", { count: "exact", head: true }).eq("athlete_id", athleteId),
  ]);

  return {
    profile: (profileRes.data as OnboardingProfileFields | null) ?? null,
    deviceConnected: (linkRes.count ?? 0) > 0,
    deviceFed: (fedRes.count ?? 0) > 0,
    hasFtp: (ftpRes.count ?? 0) > 0,
    hasBloodPanel: (bloodRes.count ?? 0) > 0,
  };
}

/** Comodità: carica lo snapshot e calcola la completezza in un colpo (UI + mail). */
export async function loadOnboardingCompleteness(
  db: SupabaseClient,
  athleteId: string,
): Promise<OnboardingCompleteness> {
  return computeOnboardingCompleteness(await loadOnboardingSnapshot(db, athleteId));
}
