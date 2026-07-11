import type { SupabaseClient } from "@supabase/supabase-js";
import {
  publishDbWorkoutsToCalendar,
  readDbEngineWorkouts,
  type PublishDbWorkoutsResult,
} from "@/lib/training/db-engine/publish-db-workouts";

/**
 * Generatore training HEADLESS (Decisione A: Empathy genera in automatico).
 *
 * Compone i pezzi già esistenti — nessun port di Virya client-side:
 *   1. RPC Postgres `generate_training_week` → crea i workout db-engine (tabella `workout`)
 *   2. `readDbEngineWorkouts` → dettagli (blocchi + esercizi)
 *   3. `publishDbWorkoutsToCalendar` → materializza in `planned_workouts` (percorso canonico
 *      con dedupe-fingerprint + clamp → IDEMPOTENTE: ri-eseguire non duplica).
 *
 * Così la generazione training vive nel DB (RPC) esattamente come la nutrizione (Edge V2).
 */

export type GenerateTrainingWeekParams = {
  athleteId: string;
  /** Lunedì (o primo giorno) della settimana da generare, YYYY-MM-DD. */
  weekStart: string;
  discipline: string;
  sessions: number;
  weeklyTss: number;
  phase: string;
  family?: string;
  chips?: string[];
  goalText?: string;
};

export type GenerateTrainingWeekResult = {
  ok: true;
  workoutIds: string[];
  publish: PublishDbWorkoutsResult;
};

/** Normalizza il ritorno SETOF uuid della RPC (array di stringhe o di oggetti). */
function extractWorkoutIds(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  const out: string[] = [];
  for (const el of data) {
    if (typeof el === "string") {
      out.push(el);
    } else if (el && typeof el === "object") {
      const v = (el as Record<string, unknown>).generate_training_week ?? Object.values(el)[0];
      if (typeof v === "string") out.push(v);
    }
  }
  return out.filter(Boolean);
}

export async function generateAndPublishTrainingWeek(
  db: SupabaseClient,
  params: GenerateTrainingWeekParams,
): Promise<GenerateTrainingWeekResult | { ok: false; error: string }> {
  // 1. Genera i workout nel DB (overload a 9 argomenti → disambiguato dai nomi).
  const { data, error } = await db.rpc("generate_training_week", {
    p_athlete_id: params.athleteId,
    p_week_start: params.weekStart,
    p_discipline: params.discipline,
    p_sessions: params.sessions,
    p_weekly_tss: params.weeklyTss,
    p_phase: params.phase,
    p_family: params.family ?? "aerobic",
    p_chips: params.chips ?? [],
    p_goal_text: params.goalText ?? "",
  });
  if (error) return { ok: false, error: `generate_training_week: ${error.message}` };

  const workoutIds = extractWorkoutIds(data);
  if (workoutIds.length === 0) {
    return { ok: false, error: "generate_training_week non ha restituito workout" };
  }

  // 2. Leggi i dettagli db-engine e 3. pubblica su planned_workouts (idempotente).
  const details = await readDbEngineWorkouts(db, workoutIds);
  const publish = await publishDbWorkoutsToCalendar(db, details);

  return { ok: true, workoutIds, publish };
}

/* ── Derivazione dei parametri dal profilo atleta (onboarding completato) ── */

export type AthleteTrainingParamsInput = {
  training_days_per_week?: number | null;
  training_max_session_minutes?: number | null;
  goals?: unknown;
};

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * Dai dati di routine dell'atleta ai parametri della RPC. Deterministico.
 * - sessions = giorni/settimana (1..7, default 4)
 * - weeklyTss = ~95 TSS per seduta (proxy di carico base; il coach potrà rifinire)
 * - discipline default "cycling" (finché non esiste un campo sport dedicato)
 */
export function deriveTrainingWeekParams(
  profile: AthleteTrainingParamsInput | null,
  weekStart: string,
  opts?: { discipline?: string; phase?: string },
): Omit<GenerateTrainingWeekParams, "athleteId"> {
  const sessions = clampInt(profile?.training_days_per_week, 1, 7, 4);
  const goals = Array.isArray(profile?.goals)
    ? (profile?.goals as unknown[]).filter((g): g is string => typeof g === "string")
    : [];
  return {
    weekStart,
    discipline: opts?.discipline ?? "cycling",
    sessions,
    weeklyTss: sessions * 95,
    phase: opts?.phase ?? "base",
    family: "aerobic",
    chips: [],
    goalText: goals.join(", "),
  };
}
