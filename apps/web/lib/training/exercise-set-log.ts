/**
 * Registro di ciò che è stato fatto in palestra, serie per serie.
 *
 * Prima la scheda arrivava all'atleta e lì finiva: nessuna tabella per dire «questa l'ho
 * fatta, con questo carico». Da qui passano lettura e scrittura di `executed_exercise_sets`,
 * direttamente dal browser (la RLS è il perimetro, non c'è una rotta di mezzo).
 *
 * L'aggancio alla prescrizione è `blockId`, l'identificatore del blocco dentro il contratto
 * Builder: stabile, e indipendente dal nome dell'esercizio, che può essere tradotto.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Chi ha registrato la serie. Il carico scritto qui diventa lo storico su cui il coach
 * prescriverà la volta dopo: se a scriverlo è stato lui, chi legge deve poterlo sapere.
 * Il ruolo non è una dichiarazione del client — la policy lo confronta con quello vero.
 */
export type SetLogRecorder = "athlete" | "coach" | "admin";

export type ExerciseSetLogRow = {
  blockId: string;
  setIndex: number;
  reps: number | null;
  weightKg: number | null;
  done: boolean;
  recordedByRole: SetLogRecorder;
};

export type ExerciseSetLogKey = {
  athleteId: string;
  date: string;
  blockId: string;
  setIndex: number;
};

/** Limiti allineati ai vincoli della tabella: un refuso non deve diventare un dato. */
export const SET_LOG_LIMITS = {
  setIndexMax: 50,
  repsMax: 1000,
  weightKgMax: 1000,
} as const;

export type SetLogFieldError = "set_index" | "reps" | "weight_kg";

/**
 * Valida una riga prima di scriverla. Ritorna il campo che non va, oppure `null`.
 * Vive qui e non nel componente perché la stessa regola serve a chi salva in blocco.
 */
export function validateSetLogRow(row: {
  setIndex: number;
  reps?: number | null;
  weightKg?: number | null;
}): SetLogFieldError | null {
  if (!Number.isInteger(row.setIndex) || row.setIndex < 1 || row.setIndex > SET_LOG_LIMITS.setIndexMax) {
    return "set_index";
  }
  if (row.reps != null) {
    if (!Number.isFinite(row.reps) || row.reps < 0 || row.reps > SET_LOG_LIMITS.repsMax) return "reps";
  }
  if (row.weightKg != null) {
    if (!Number.isFinite(row.weightKg) || row.weightKg < 0 || row.weightKg > SET_LOG_LIMITS.weightKgMax) {
      return "weight_kg";
    }
  }
  return null;
}

/** Chiave stabile per indicizzare le righe in memoria: blocco + numero di serie. */
export function setLogKey(blockId: string, setIndex: number): string {
  return `${blockId}#${setIndex}`;
}

/**
 * Quante serie mostrare per un esercizio: quelle prescritte, ma mai meno di quelle già
 * registrate — se l'atleta ne ha fatta una in più, non deve sparire dalla schermata.
 */
export function visibleSetCount(prescribedSets: number | null | undefined, loggedMaxIndex: number): number {
  const prescribed = Number.isFinite(prescribedSets) && (prescribedSets ?? 0) > 0 ? Math.floor(prescribedSets!) : 0;
  return Math.min(SET_LOG_LIMITS.setIndexMax, Math.max(prescribed, loggedMaxIndex, 1));
}

type DbRow = {
  block_id?: unknown;
  set_index?: unknown;
  reps?: unknown;
  weight_kg?: unknown;
  done?: unknown;
  recorded_by_role?: unknown;
};

/** Un valore ignoto non diventa «atleta»: nel dubbio si dice che l'ha scritto il coach. */
function asRecorder(v: unknown): SetLogRecorder {
  return v === "coach" || v === "admin" ? v : v === "athlete" ? "athlete" : "athlete";
}

function asNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function mapDbRows(rows: readonly DbRow[]): ExerciseSetLogRow[] {
  const out: ExerciseSetLogRow[] = [];
  for (const r of rows) {
    const blockId = typeof r.block_id === "string" ? r.block_id : "";
    const setIndex = asNum(r.set_index);
    if (!blockId || setIndex == null) continue;
    out.push({
      blockId,
      setIndex: Math.round(setIndex),
      reps: asNum(r.reps),
      weightKg: asNum(r.weight_kg),
      done: r.done !== false,
      recordedByRole: asRecorder(r.recorded_by_role),
    });
  }
  return out;
}

/** Le serie già registrate per (atleta, giorno). Errore o assenza → lista vuota. */
export async function loadExerciseSetLog(
  db: SupabaseClient,
  athleteId: string,
  date: string,
): Promise<ExerciseSetLogRow[]> {
  const { data, error } = await db
    .from("executed_exercise_sets")
    .select("block_id, set_index, reps, weight_kg, done, recorded_by_role")
    .eq("athlete_id", athleteId)
    .eq("date", date);
  if (error || !Array.isArray(data)) return [];
  return mapDbRows(data as DbRow[]);
}

export type SaveSetLogInput = ExerciseSetLogKey & {
  plannedWorkoutId?: string | null;
  catalogExerciseId?: string | null;
  exerciseName: string;
  reps?: number | null;
  weightKg?: number | null;
  done?: boolean;
  /** Chi sta scrivendo: deve combaciare con l'identità reale, o la policy rifiuta. */
  recordedByUserId: string;
  recordedByRole: SetLogRecorder;
};

export type SaveSetLogResult = { ok: true } | { ok: false; error: string };

/**
 * Scrive (o riscrive) una serie. `onConflict` sulla chiave naturale: risalvare la stessa
 * serie aggiorna, non duplica.
 */
export async function saveExerciseSet(db: SupabaseClient, input: SaveSetLogInput): Promise<SaveSetLogResult> {
  const invalid = validateSetLogRow(input);
  if (invalid) return { ok: false, error: invalid };
  const name = input.exerciseName.trim();
  if (!name) return { ok: false, error: "exercise_name" };

  const { error } = await db.from("executed_exercise_sets").upsert(
    {
      athlete_id: input.athleteId,
      date: input.date,
      planned_workout_id: input.plannedWorkoutId ?? null,
      block_id: input.blockId,
      catalog_exercise_id: input.catalogExerciseId ?? null,
      exercise_name: name,
      set_index: input.setIndex,
      reps: input.reps ?? null,
      weight_kg: input.weightKg ?? null,
      done: input.done ?? true,
      recorded_by_user_id: input.recordedByUserId,
      recorded_by_role: input.recordedByRole,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "athlete_id,date,block_id,set_index" },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Cancella la registrazione di una serie: «non risposto» torna diverso da «non fatta». */
export async function clearExerciseSet(db: SupabaseClient, key: ExerciseSetLogKey): Promise<SaveSetLogResult> {
  const { error } = await db
    .from("executed_exercise_sets")
    .delete()
    .eq("athlete_id", key.athleteId)
    .eq("date", key.date)
    .eq("block_id", key.blockId)
    .eq("set_index", key.setIndex);
  return error ? { ok: false, error: error.message } : { ok: true };
}
