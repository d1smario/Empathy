import type { SupabaseClient } from "@supabase/supabase-js";
import {
  serializePro2BuilderSessionContract,
  type Pro2BuilderSessionContract,
} from "@/lib/training/builder/pro2-session-contract";
import {
  buildStarterContractFromPreset,
  type AerobicStarterBlockSpec,
  type AerobicStarterPreset,
} from "@/lib/training/library/starter-pack-aerobic-helpers";
import type { PlannedWorkoutInsertPayload } from "@/lib/training/planned/clamp-planned-row";
import { insertPlannedWorkoutRows } from "@/lib/training/planned/insert-planned-workout";

/**
 * Bridge motore allenamenti **Postgres** (`public.workout` + blocchi) → calendario operativo
 * (`planned_workouts`). Unico punto di mapping: le route `/api/training/db/generate-week` e
 * `/api/training/db/generate-plan` devono passare da qui (niente `.insert()` diretto: la
 * pubblicazione usa il percorso canonico `insertPlannedWorkoutRows` con dedupe + clamp).
 */

export const DB_ENGINE_NOTES_TAG = "[EMPATHY_DB_ENGINE";

export type DbEngineWorkoutRow = {
  id: string;
  athlete_id: string;
  date: string;
  discipline: string | null;
  family: string;
  session_role: string | null;
  adaptation_target: string | null;
  phase: string | null;
  session_name: string | null;
  preset_id: string | null;
  duration_minutes: number | null;
  tss_target: number | null;
  kcal_target: number | null;
  plan_id: string | null;
};

export type DbEngineBlockExercise = {
  exercise_order: number;
  exercise_name: string;
  sets: number | null;
  reps: string | null;
  load_hint: string | null;
};

export type DbEngineBlockRow = {
  id: string;
  workout_id: string;
  block_order: number;
  label: string | null;
  kind: string;
  duration_minutes: number;
  intensity_cue: string | null;
  params: Record<string, unknown>;
  exercises: DbEngineBlockExercise[];
};

export type DbEngineWorkoutDetail = {
  workout: DbEngineWorkoutRow;
  blocks: DbEngineBlockRow[];
};

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

/** Workout + blocchi (ordinati per `block_order`) + esercizi gym (nome da `public.exercise`). */
export async function readDbEngineWorkouts(
  db: SupabaseClient,
  workoutIds: string[],
): Promise<DbEngineWorkoutDetail[]> {
  const ids = [...new Set(workoutIds.map((id) => String(id).trim()).filter(Boolean))];
  if (ids.length === 0) return [];

  const { data: workoutRows, error: workoutErr } = await db
    .from("workout")
    .select(
      "id,athlete_id,date,discipline,family,session_role,adaptation_target,phase,session_name,preset_id,duration_minutes,tss_target,kcal_target,plan_id",
    )
    .in("id", ids)
    .order("date", { ascending: true });
  if (workoutErr) throw new Error(`Lettura workout fallita: ${workoutErr.message}`);

  const { data: blockRows, error: blockErr } = await db
    .from("workout_block")
    .select("id,workout_id,block_order,label,kind,duration_minutes,intensity_cue,params")
    .in("workout_id", ids)
    .order("block_order", { ascending: true });
  if (blockErr) throw new Error(`Lettura workout_block fallita: ${blockErr.message}`);

  const blockIds = (blockRows ?? []).map((b) => String((b as { id?: unknown }).id ?? "")).filter(Boolean);
  type WbeRow = {
    block_id: string;
    exercise_id: string;
    exercise_order: number;
    sets: number | null;
    reps: string | null;
    load_hint: string | null;
  };
  let wbeRows: WbeRow[] = [];
  const exerciseNameById = new Map<string, string>();
  if (blockIds.length > 0) {
    const { data, error } = await db
      .from("workout_block_exercise")
      .select("block_id,exercise_id,exercise_order,sets,reps,load_hint")
      .in("block_id", blockIds)
      .order("exercise_order", { ascending: true });
    if (error) throw new Error(`Lettura workout_block_exercise fallita: ${error.message}`);
    wbeRows = (data ?? []) as WbeRow[];
    const exerciseIds = [...new Set(wbeRows.map((r) => String(r.exercise_id)))];
    if (exerciseIds.length > 0) {
      const { data: exRows, error: exErr } = await db.from("exercise").select("id,name").in("id", exerciseIds);
      if (exErr) throw new Error(`Lettura exercise fallita: ${exErr.message}`);
      for (const ex of (exRows ?? []) as Array<{ id: string; name: string }>) {
        exerciseNameById.set(String(ex.id), String(ex.name ?? "").trim() || String(ex.id));
      }
    }
  }

  const exercisesByBlockId = new Map<string, DbEngineBlockExercise[]>();
  for (const r of wbeRows) {
    const list = exercisesByBlockId.get(String(r.block_id)) ?? [];
    list.push({
      exercise_order: Math.round(asFiniteNumber(r.exercise_order) ?? 0),
      exercise_name: exerciseNameById.get(String(r.exercise_id)) ?? String(r.exercise_id),
      sets: asFiniteNumber(r.sets),
      reps: asTrimmedString(r.reps),
      load_hint: asTrimmedString(r.load_hint),
    });
    exercisesByBlockId.set(String(r.block_id), list);
  }

  const blocksByWorkoutId = new Map<string, DbEngineBlockRow[]>();
  for (const raw of blockRows ?? []) {
    const b = raw as Record<string, unknown>;
    const blockId = String(b.id ?? "");
    const workoutId = String(b.workout_id ?? "");
    const list = blocksByWorkoutId.get(workoutId) ?? [];
    list.push({
      id: blockId,
      workout_id: workoutId,
      block_order: Math.round(asFiniteNumber(b.block_order) ?? list.length),
      label: asTrimmedString(b.label),
      kind: String(b.kind ?? "").trim() || "free",
      duration_minutes: Math.max(0, asFiniteNumber(b.duration_minutes) ?? 0),
      intensity_cue: asTrimmedString(b.intensity_cue),
      params:
        b.params && typeof b.params === "object" && !Array.isArray(b.params)
          ? (b.params as Record<string, unknown>)
          : {},
      exercises: exercisesByBlockId.get(blockId) ?? [],
    });
    blocksByWorkoutId.set(workoutId, list);
  }

  return (workoutRows ?? []).map((raw) => {
    const w = raw as Record<string, unknown>;
    const workout: DbEngineWorkoutRow = {
      id: String(w.id ?? ""),
      athlete_id: String(w.athlete_id ?? ""),
      date: String(w.date ?? "").slice(0, 10),
      discipline: asTrimmedString(w.discipline),
      family: String(w.family ?? "").trim() || "aerobic",
      session_role: asTrimmedString(w.session_role),
      adaptation_target: asTrimmedString(w.adaptation_target),
      phase: asTrimmedString(w.phase),
      session_name: asTrimmedString(w.session_name),
      preset_id: asTrimmedString(w.preset_id),
      duration_minutes: asFiniteNumber(w.duration_minutes),
      tss_target: asFiniteNumber(w.tss_target),
      kcal_target: asFiniteNumber(w.kcal_target),
      plan_id: asTrimmedString(w.plan_id),
    };
    const blocks = (blocksByWorkoutId.get(workout.id) ?? []).sort((a, b2) => a.block_order - b2.block_order);
    return { workout, blocks };
  });
}

/** Tipo riga calendario: aerobico → disciplina lower (es. `cycling`), strength → `gym`, altrimenti family. */
export function plannedTypeForDbWorkout(workout: DbEngineWorkoutRow): string {
  if (workout.family === "aerobic") return (workout.discipline ?? "cycling").toLowerCase();
  if (workout.family === "strength") return "gym";
  return workout.family;
}

const AEROBIC_CONTRACT_KINDS = ["steady", "ramp", "interval2", "interval3", "pyramid"] as const;
type AerobicContractKind = (typeof AEROBIC_CONTRACT_KINDS)[number];

function isAerobicContractKind(kind: string): kind is AerobicContractKind {
  return (AEROBIC_CONTRACT_KINDS as readonly string[]).includes(kind);
}

function specFromDbBlock(block: DbEngineBlockRow, index: number): AerobicStarterBlockSpec | null {
  if (!isAerobicContractKind(block.kind)) return null;
  const p = block.params;
  return {
    label: block.label ?? `Blocco ${index + 1}`,
    kind: block.kind,
    durationMinutes: Math.max(1, Math.round(block.duration_minutes || 1)),
    intensityCue: block.intensity_cue ?? "Z2",
    startIntensity: asTrimmedString(p.startIntensity) ?? undefined,
    endIntensity: asTrimmedString(p.endIntensity) ?? undefined,
    intensity2: asTrimmedString(p.intensity2) ?? undefined,
    intensity3: asTrimmedString(p.intensity3) ?? undefined,
    repeats: asFiniteNumber(p.repeats) ?? undefined,
    workSeconds: asFiniteNumber(p.workSeconds) ?? undefined,
    recoverSeconds: asFiniteNumber(p.recoverSeconds) ?? undefined,
    step1Seconds: asFiniteNumber(p.step1Seconds) ?? undefined,
    step2Seconds: asFiniteNumber(p.step2Seconds) ?? undefined,
    step3Seconds: asFiniteNumber(p.step3Seconds) ?? undefined,
    pyramidSteps: asFiniteNumber(p.pyramidSteps) ?? undefined,
    pyramidStepSeconds: asFiniteNumber(p.pyramidStepSeconds) ?? undefined,
    pyramidStartTarget: asFiniteNumber(p.pyramidStartTarget) ?? undefined,
    pyramidEndTarget: asFiniteNumber(p.pyramidEndTarget) ?? undefined,
    notes: asTrimmedString(p.notes) ?? undefined,
  };
}

function displayDiscipline(discipline: string | null): string {
  const d = (discipline ?? "cycling").trim() || "cycling";
  return d.charAt(0).toUpperCase() + d.slice(1);
}

/**
 * Contratto builder Pro 2 da workout DB **aerobico** con soli kind canonici
 * (steady/ramp/interval2/interval3/pyramid). I `params` jsonb del motore Postgres usano le stesse
 * chiavi di `AerobicStarterBlockSpec` (startIntensity, workSeconds, …) — riuso del percorso starter
 * pack (`buildStarterContractFromPreset`: chart + metriche + persist-prepare), nessuna forzatura.
 * Ritorna `null` (notes solo descrittive) se la famiglia non è aerobic o c'è un kind non mappabile.
 */
export function tryBuildDbAerobicContract(detail: DbEngineWorkoutDetail): Pro2BuilderSessionContract | null {
  const { workout, blocks } = detail;
  if (workout.family !== "aerobic" || blocks.length === 0) return null;

  const specs: AerobicStarterBlockSpec[] = [];
  for (const [index, block] of blocks.entries()) {
    const spec = specFromDbBlock(block, index);
    if (!spec) return null;
    specs.push(spec);
  }

  const minutesFromBlocks = specs.reduce((sum, s) => sum + s.durationMinutes, 0);
  const plannedMinutes = Math.max(1, Math.round(workout.duration_minutes ?? minutesFromBlocks));
  const preset: AerobicStarterPreset = {
    presetId: workout.preset_id ?? `db_engine_${workout.id}`,
    title: workout.session_name ?? "Seduta motore DB",
    description: "Seduta generata dal motore allenamenti Postgres (bridge calendario).",
    discipline: displayDiscipline(workout.discipline),
    adaptationTarget: workout.adaptation_target ?? "",
    phase: workout.phase ?? "base",
    tags: [],
    plannedMinutes,
    tss: Math.max(0, Math.round(workout.tss_target ?? 0)),
    blocks: specs,
  };
  try {
    return buildStarterContractFromPreset(preset);
  } catch {
    return null;
  }
}

function descriptiveNotesLines(detail: DbEngineWorkoutDetail): string[] {
  const { workout, blocks } = detail;
  const title = workout.session_name ?? `Seduta ${workout.family}`;
  const lines: string[] = [
    `${DB_ENGINE_NOTES_TAG} workout=${workout.id}] ${title} · ${workout.phase ?? "base"}/${workout.session_role ?? workout.family}`,
  ];
  for (const block of blocks) {
    const minutes = Math.max(1, Math.round(block.duration_minutes || 1));
    const cue = block.intensity_cue ? ` ${block.intensity_cue}` : "";
    lines.push(`— ${block.label ?? "Blocco"} ${block.kind} ${minutes}′${cue}`);
    for (const ex of block.exercises) {
      const setsReps =
        ex.sets != null && ex.reps ? ` ${ex.sets}x${ex.reps}` : ex.sets != null ? ` ${ex.sets} serie` : "";
      const load = ex.load_hint ? ` (${ex.load_hint})` : "";
      lines.push(`· ${ex.exercise_name}${setsReps}${load}`);
    }
  }
  return lines;
}

export type DbWorkoutPlannedMapping = {
  row: PlannedWorkoutInsertPayload;
  hasBuilderContract: boolean;
};

/** Riga `planned_workouts` da workout DB: contratto builder (se aerobico canonico) + notes descrittive. */
export function mapDbWorkoutToPlannedRow(detail: DbEngineWorkoutDetail): DbWorkoutPlannedMapping {
  const { workout, blocks } = detail;
  const contract = tryBuildDbAerobicContract(detail);
  const lines = descriptiveNotesLines(detail);
  if (contract) lines.unshift(serializePro2BuilderSessionContract(contract));

  const minutesFromBlocks = blocks.reduce((sum, b) => sum + (Number(b.duration_minutes) || 0), 0);
  const durationMinutes = Math.max(1, Math.round(workout.duration_minutes ?? (minutesFromBlocks || 30)));

  return {
    row: {
      athlete_id: workout.athlete_id,
      date: workout.date,
      type: plannedTypeForDbWorkout(workout),
      duration_minutes: durationMinutes,
      tss_target: Math.max(0, Math.round(workout.tss_target ?? 0)),
      kcal_target: workout.kcal_target != null ? Math.round(workout.kcal_target) : null,
      notes: lines.join("\n"),
    },
    hasBuilderContract: contract != null,
  };
}

export type PublishDbWorkoutsResult = {
  publishedIds: string[];
  insertedCount: number;
  dedupeSkippedCount: number;
  replacedSameTypeCount: number;
  builderContractCount: number;
};

/** Pubblica i workout DB sul calendario via percorso canonico (dedupe fingerprint + clamp). */
export async function publishDbWorkoutsToCalendar(
  db: SupabaseClient,
  details: DbEngineWorkoutDetail[],
): Promise<PublishDbWorkoutsResult> {
  const mappings = details.map((detail) => mapDbWorkoutToPlannedRow(detail));
  const { ids, dedupeSkippedCount, replacedSameTypeCount } = await insertPlannedWorkoutRows(
    db,
    mappings.map((m) => m.row),
  );
  return {
    publishedIds: ids,
    insertedCount: Math.max(0, ids.length - dedupeSkippedCount),
    dedupeSkippedCount,
    replacedSameTypeCount,
    builderContractCount: mappings.filter((m) => m.hasBuilderContract).length,
  };
}

export type DbPlanSummaryEntry = { date: string; name: string; minutes: number; tss: number };

/** Riepilogo compatto per risposta API. */
export function planSummaryFromDetails(details: DbEngineWorkoutDetail[]): DbPlanSummaryEntry[] {
  return details.map(({ workout, blocks }) => {
    const minutesFromBlocks = blocks.reduce((sum, b) => sum + (Number(b.duration_minutes) || 0), 0);
    return {
      date: workout.date,
      name: workout.session_name ?? `Seduta ${workout.family}`,
      minutes: Math.max(1, Math.round(workout.duration_minutes ?? (minutesFromBlocks || 30))),
      tss: Math.max(0, Math.round(workout.tss_target ?? 0)),
    };
  });
}
