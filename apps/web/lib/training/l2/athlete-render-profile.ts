import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pro2RenderProfile } from "@/lib/training/builder/pro2-session-contract";
import { isUsableAthleteFtpWatts } from "@/lib/training/physiology/resolve-athlete-ftp-watts";

/**
 * Profilo render + disponibilità REALI dell'atleta per il motore L2 (blueprint C):
 * FTP/soglie da `physiological_profiles`, FC max e routine da `athlete_profiles`.
 * «MAI più FTP fisso 250 nelle kcal»: qui si carica il dato misurato; il default
 * scatta SOLO se il profilo fisiologico non esiste, ed è dichiarato in `ftpSource`
 * così QA e log distinguono un atleta profilato da uno in fallback.
 *
 * Bundle-abile: client iniettato, zero import server-only — condiviso tra il ramo
 * in-process di `materializeTrainingMacro` e la futura EF `materialize-training-week`.
 */

export type AthleteRenderContext = {
  athleteId: string;
  /** Profilo render per i contratti Pro2 (ftpW/hrMax reali quando disponibili). */
  renderProfile: Pro2RenderProfile;
  ftpSource: "measured" | "fallback";
  /** Soglie reali (per lettori futuri: zone HR, ramo potenza); null se non misurate. */
  lt1W: number | null;
  lt2W: number | null;
  lt1Hr: number | null;
  lt2Hr: number | null;
  /** `athlete_profiles.training_max_session_minutes` — cap durata seduta (finalmente consumato). */
  maxSessionMinutes: number | null;
  /** Giorni allenabili dichiarati in `routine_config.week_plan` (offset 0..6, 0=lunedì). */
  availableDays: number[];
  /** Orario preferito per giorno (HH:MM) da `week_plan[day].training1_start_time`, con fallback root `training_1.start_time`. */
  preferredTimeByOffset: Record<number, string>;
};

const DEFAULT_RENDER: Pro2RenderProfile = {
  intensityUnit: "watt",
  ftpW: 250,
  hrMax: 185,
  lengthMode: "time",
  speedRefKmh: 32,
};

/** Stesse chiavi giorno della UI Profilo/routine (lunedì-first, come weekStart L1). */
const WEEK_PLAN_DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function normalizeHhMm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^\d{1,2}:\d{2}/.exec(value.trim());
  return m ? m[0] : null;
}

function isUsableHrMax(value: number | null): value is number {
  return value != null && value >= 100 && value <= 240;
}

/**
 * Disponibilità + orari dalla routine (pura, testabile): stessa coercizione
 * `has_training` della UI Profilo (assente = true). week_plan assente → array
 * vuoto: NON è «zero allenamenti» ma «routine non compilata», e il motore
 * ripiega sul pattern config.
 */
export function availabilityFromRoutineConfig(routineConfig: unknown): {
  availableDays: number[];
  preferredTimeByOffset: Record<number, string>;
} {
  const rc = asRecord(routineConfig);
  const weekPlan = asRecord(rc?.week_plan);
  const rootTime = normalizeHhMm(asRecord(rc?.training_1)?.start_time);

  const availableDays: number[] = [];
  const preferredTimeByOffset: Record<number, string> = {};
  if (weekPlan) {
    WEEK_PLAN_DAY_KEYS.forEach((key, offset) => {
      const day = asRecord(weekPlan[key]);
      if (!day) return;
      if (String(day.has_training ?? true) === "true") availableDays.push(offset);
      const t = normalizeHhMm(day.training1_start_time) ?? rootTime;
      if (t) preferredTimeByOffset[offset] = t;
    });
  } else if (rootTime) {
    for (let offset = 0; offset < 7; offset += 1) preferredTimeByOffset[offset] = rootTime;
  }
  return { availableDays, preferredTimeByOffset };
}

export async function loadAthleteRenderProfile(
  client: SupabaseClient,
  athleteId: string,
): Promise<AthleteRenderContext> {
  const [physRes, athleteRes] = await Promise.all([
    // physiological_profiles NON è versionata: UNIQUE (athlete_id) garantisce una riga
    // sola per atleta, quindi l'order-by qui sotto è ridondante (vedi profile-resolver.ts).
    client
      .from("physiological_profiles")
      .select("ftp_watts, lt1_watts, lt1_heart_rate, lt2_watts, lt2_heart_rate, updated_at")
      .eq("athlete_id", athleteId)
      .order("updated_at", { ascending: false })
      .limit(1),
    client
      .from("athlete_profiles")
      .select("max_hr_bpm, training_max_session_minutes, routine_config")
      .eq("id", athleteId)
      .maybeSingle(),
  ]);

  if (physRes.error) throw new Error(`physiological_profiles: ${physRes.error.message}`);
  if (athleteRes.error) throw new Error(`athlete_profiles: ${athleteRes.error.message}`);

  const phys = ((physRes.data ?? []) as Array<Record<string, unknown>>)[0] ?? null;
  const athlete = (athleteRes.data ?? null) as Record<string, unknown> | null;

  const ftpMeasured = asNum(phys?.ftp_watts);
  const ftpUsable = isUsableAthleteFtpWatts(ftpMeasured ?? undefined);
  const hrMax = asNum(athlete?.max_hr_bpm);

  const maxSessionRaw = asNum(athlete?.training_max_session_minutes);
  const maxSessionMinutes =
    maxSessionRaw != null && maxSessionRaw >= 20 && maxSessionRaw <= 480
      ? Math.round(maxSessionRaw)
      : null;

  const { availableDays, preferredTimeByOffset } = availabilityFromRoutineConfig(
    athlete?.routine_config,
  );

  return {
    athleteId,
    renderProfile: {
      ...DEFAULT_RENDER,
      ftpW: ftpUsable ? Math.round(ftpMeasured as number) : DEFAULT_RENDER.ftpW,
      hrMax: isUsableHrMax(hrMax) ? Math.round(hrMax) : DEFAULT_RENDER.hrMax,
    },
    ftpSource: ftpUsable ? "measured" : "fallback",
    lt1W: asNum(phys?.lt1_watts),
    lt2W: asNum(phys?.lt2_watts),
    lt1Hr: asNum(phys?.lt1_heart_rate),
    lt2Hr: asNum(phys?.lt2_heart_rate),
    maxSessionMinutes,
    availableDays,
    preferredTimeByOffset,
  };
}
