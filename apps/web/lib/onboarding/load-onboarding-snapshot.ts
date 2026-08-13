import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCalendarTrainingVolume } from "@/lib/training/load-calendar-training-volume";
import {
  computeOnboardingCompleteness,
  type OnboardingCompleteness,
  type OnboardingProfileFields,
  type OnboardingSnapshot,
} from "./onboarding-completeness";

/** Finestra entro cui il device è considerato «alimentato» (righe recenti in device_sync_exports). */
const DEVICE_FED_WINDOW_DAYS = 7;

/**
 * Giorno corrente `YYYY-MM-DD` in UTC. UTC e non fuso locale per una ragione precisa:
 * `proposeTrainingMacro` osserva la STESSA finestra di calendario con la stessa ancora,
 * e le due devono coincidere — altrimenti «sono pronto?» e «quanto è grande il mio piano»
 * risponderebbero su settimane diverse su una macchina non-UTC. Su Vercel girano
 * entrambe in UTC; questo rende la coincidenza una proprietà del codice, non della
 * configurazione. Uno scarto di poche ore sposta comunque la finestra solo a cavallo
 * della mezzanotte fra domenica e lunedì, perché si osservano settimane ISO intere.
 */
function todayIsoDay(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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

  const [profileRes, linkRes, fedRes, ftpRes, bloodRes, calendarVolume] = await Promise.all([
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
    // FONTE 3 del volume: le sedute che il coach ha già messo in calendario. Ancorata a
    // OGGI (qui non si sta dimensionando una settimana specifica, si sta guardando se il
    // sistema conosce già il volume dell'atleta).
    loadCalendarTrainingVolume(db, athleteId, todayIsoDay()),
  ]);

  return {
    profile: (profileRes.data as OnboardingProfileFields | null) ?? null,
    deviceConnected: (linkRes.count ?? 0) > 0,
    deviceFed: (fedRes.count ?? 0) > 0,
    hasFtp: (ftpRes.count ?? 0) > 0,
    hasBloodPanel: (bloodRes.count ?? 0) > 0,
    calendarVolume,
  };
}

/** Comodità: carica lo snapshot e calcola la completezza in un colpo (UI + mail). */
export async function loadOnboardingCompleteness(
  db: SupabaseClient,
  athleteId: string,
): Promise<OnboardingCompleteness> {
  return computeOnboardingCompleteness(await loadOnboardingSnapshot(db, athleteId));
}
