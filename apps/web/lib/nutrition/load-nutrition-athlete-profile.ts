import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Profilo atleta per il dominio NUTRIZIONE — fonte unica dei 5 percorsi server
 * (route-prep, headless V2, reintegro, riduzione, correzione TDEE settimanale).
 *
 * Perché esiste: `athlete_profiles` NON ha le colonne `ftp_watts` né
 * `lifestyle_activity_class`; chiederle a PostgREST faceva fallire l'INTERA
 * select (42703) e i chiamanti, destrutturando solo `{ data }`, giravano con
 * profilo vuoto (bmrKcal 0, ftp 250, peso 70 — loop adattivo inerte). Qui:
 *   - solo colonne REALI di athlete_profiles (superset dei 5 call site);
 *   - FTP dalla riga corrente di `physiological_profiles` (versionata);
 *   - lifestyle da `routine_config.lifestyle_activity_class` (scritto dal Profilo).
 *
 * VINCOLO DURO: questo file finisce nel bundle esbuild→Deno della Edge Function
 * `generate-meal-plan`: niente import Next (next/*, headers, cookies), nessuna
 * dipendenza nuova — solo il client ricevuto come parametro e tipi.
 *
 * Gli errori delle query NON si ingoiano: `{ data, error }` destrutturati,
 * console.error (athleteId + tabella + message) e campo a null — il chiamante
 * mantiene i suoi fallback di ultima spiaggia, ma il fallimento resta visibile.
 */

/** Colonne REALI di athlete_profiles (verificate su prod; superset dei 5 call site). */
export const NUTRITION_ATHLETE_PROFILE_SELECT =
  "birth_date, sex, height_cm, weight_kg, body_fat_pct, timezone, routine_config, nutrition_config, " +
  "preferred_meal_count, diet_type, supplement_config, intolerances, allergies, food_exclusions, " +
  "food_preferences, supplements";

/** Numerici PostgREST possono arrivare come stringhe (colonne `numeric`). */
export type NutritionAthleteProfileRow = {
  birth_date: string | null;
  sex: string | null;
  height_cm: number | string | null;
  weight_kg: number | string | null;
  body_fat_pct: number | string | null;
  timezone: string | null;
  routine_config: Record<string, unknown> | null;
  nutrition_config: Record<string, unknown> | null;
  preferred_meal_count: number | string | null;
  diet_type: string | null;
  supplement_config: Record<string, unknown> | null;
  intolerances: string[] | null;
  allergies: string[] | null;
  food_exclusions: string[] | null;
  food_preferences: string[] | null;
  supplements: string[] | null;
};

export type NutritionAthleteProfile = {
  /** Riga athlete_profiles; null se il profilo non esiste O la query è fallita. */
  profile: NutritionAthleteProfileRow | null;
  /**
   * FTP dalla riga CORRENTE di physiological_profiles (tabella versionata
   * valid_from/valid_to): più recente per updated_at, stesso criterio del
   * training L2 (`lib/training/l2/athlete-render-profile.ts`). Null se
   * assente, non positiva o query fallita.
   */
  ftpWatts: number | null;
  /** `routine_config.lifestyle_activity_class` (stringa nel JSON); null se assente. */
  lifestyleActivityClass: string | null;
};

export async function loadNutritionAthleteProfile(
  db: SupabaseClient,
  athleteId: string,
): Promise<NutritionAthleteProfile> {
  const [profileRes, physRes] = await Promise.all([
    db
      .from("athlete_profiles")
      .select(NUTRITION_ATHLETE_PROFILE_SELECT)
      .eq("id", athleteId)
      .maybeSingle(),
    db
      .from("physiological_profiles")
      .select("ftp_watts")
      .eq("athlete_id", athleteId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let profile: NutritionAthleteProfileRow | null = null;
  if (profileRes.error) {
    console.error(
      `[nutrition] athlete_profiles select fallita (athleteId=${athleteId}): ${profileRes.error.message}`,
    );
  } else {
    profile = (profileRes.data ?? null) as NutritionAthleteProfileRow | null;
  }

  let ftpWatts: number | null = null;
  if (physRes.error) {
    console.error(
      `[nutrition] physiological_profiles select fallita (athleteId=${athleteId}): ${physRes.error.message}`,
    );
  } else {
    const raw = (physRes.data as { ftp_watts?: unknown } | null)?.ftp_watts;
    const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
    if (Number.isFinite(n) && n > 0) ftpWatts = n;
  }

  const routine =
    profile?.routine_config && typeof profile.routine_config === "object" && !Array.isArray(profile.routine_config)
      ? (profile.routine_config as Record<string, unknown>)
      : null;
  const rawLifestyle = routine?.lifestyle_activity_class;
  const lifestyleActivityClass =
    typeof rawLifestyle === "string" && rawLifestyle.trim() !== "" ? rawLifestyle : null;

  return { profile, ftpWatts, lifestyleActivityClass };
}
