/**
 * Mapper righe DB → modello L1 `PlanSkeleton` (VIRYA rework F1, blueprint sezione B).
 *
 * PRINCIPIO DIFENSIVO: nessuna funzione qui lancia MAI. Un jsonb malformato
 * (`objectives`, `family_mix`), uno status/fase fuori CHECK, un numero mancante →
 * si degrada a un default sensato, non a un throw. Il motore e la UI leggono
 * scheletri anche da righe legacy/sporche senza esplodere.
 *
 * DERIVAZIONE DEFAULT (blueprint B): `objectives = '{}'` significa «derivare gli
 * stimoli dalla fase alla lettura» — così le 20 settimane esistenti restano valide
 * senza backfill. La mappa fase→stimoli vive qui (`PHASE_DEFAULT_STIMULUS`).
 */

import type { WeekObjectiveKey } from "@/lib/training/virya/virya-annual-plan-kit";
import {
  ADAPTATION_TARGETS,
  PLAN_PHASES,
  PLAN_STATUSES,
  type AdaptationTarget,
  type PlanPhase,
  type PlanSkeleton,
  type PlanSkeletonMesocycle,
  type PlanSkeletonWeek,
  type PlanStatus,
  type WeekFamilyMix,
  type WeekStimulus,
} from "./plan-skeleton-types";

// ---------------------------------------------------------------------------
// Righe DB grezze — forma "as read" da Supabase (snake_case). I campi jsonb sono
// `unknown`: il loro parsing difensivo è il cuore di questo modulo.
// ---------------------------------------------------------------------------

export type TrainingPlanRow = {
  id: string;
  athlete_id: string;
  name?: string | null;
  status?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  discipline?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  goal_event_date?: string | null;
};

export type TrainingPlanMesocycleRow = {
  id: string;
  seq?: number | null;
  phase?: string | null;
  label?: string | null;
  weeks?: number | null;
  load_weeks?: number | null;
  deload_weeks?: number | null;
  weekly_tss_target?: number | null;
  sessions_target?: number | null;
  objective?: string | null;
  notes?: string | null;
};

export type TrainingPlanWeekRow = {
  id: string;
  week_start?: string | null;
  phase?: string | null;
  week_in_phase?: number | null;
  budget_tss?: number | null;
  sessions?: number | null;
  objectives?: unknown;
  coach_notes?: string | null;
  hours_target?: number | string | null;
  family_mix?: unknown;
  mesocycle_id?: string | null;
};

// ---------------------------------------------------------------------------
// Mappa di presentazione: 8 chip UI `WeekObjectiveKey` → `AdaptationTarget`.
// Blueprint B ancora esplicitamente 5 coppie; le altre 3 sono derivate per
// semantica e commentate. Ogni chip mappa a un target DISTINTO.
// ---------------------------------------------------------------------------

export const WEEK_OBJECTIVE_KEY_TO_TARGET: Record<WeekObjectiveKey, AdaptationTarget> = {
  forza: "max_strength", // blueprint B (forza→max_strength)
  aerobico: "mitochondrial_density", // blueprint B (aerobico→mitochondrial_density)
  anaerobico: "vo2_max_support", // lavoro anaerobico/VO2 (lattato ha già lactate_tolerance)
  lattato: "lactate_tolerance", // blueprint B (lattato→lactate_tolerance)
  sprint_agilita: "neuromuscular_adaptation", // blueprint B (sprint_agilita→neuromuscular_adaptation)
  neuromotorio: "movement_quality", // controllo/qualità del movimento
  tecnico_tattico: "skill_transfer", // trasferimento tecnico-tattico
  recupero: "recovery", // blueprint B (recupero→recovery)
};

/**
 * Mappa fase→stimoli di default (blueprint B: base→aerobic_base, build→threshold, …
 * tradotti nell'enum REALE `AdaptationTarget`, che non ha token "aerobic_base"/
 * "threshold"). Usata quando `objectives = '{}'`. Motivazioni sintetiche:
 *  - base: costruzione aerobica (mitochondrial_density) + fondamenta di movimento;
 *    si EVITA il lavoro di tolleranza al lattato, prematuro in questa fase.
 *  - build: soglia/clearance del lattato come stimolo primario, VO2 secondario;
 *    mantiene aerobico e forza.
 *  - refine: enfasi VO2/tolleranza, mantiene la base aerobica.
 *  - peak: affilatura neuromuscolare + potenza; si evita l'ipertrofia (massa fuori tempo).
 *  - deload: recupero puro, richiamo mobilità; si evitano forza max e lattato.
 *  - second_peak: come peak (secondo picco gara).
 */
export const PHASE_DEFAULT_STIMULUS: Record<PlanPhase, WeekStimulus> = {
  base: {
    primary: "mitochondrial_density",
    secondary: "movement_quality",
    maintenance: ["max_strength"],
    avoid: ["lactate_tolerance"],
  },
  build: {
    primary: "lactate_clearance",
    secondary: "vo2_max_support",
    maintenance: ["mitochondrial_density", "max_strength"],
    avoid: [],
  },
  refine: {
    primary: "vo2_max_support",
    secondary: "lactate_tolerance",
    maintenance: ["mitochondrial_density"],
    avoid: [],
  },
  peak: {
    primary: "neuromuscular_adaptation",
    secondary: "power_output",
    maintenance: ["vo2_max_support"],
    avoid: ["hypertrophy_mixed"],
  },
  deload: {
    primary: "recovery",
    secondary: null,
    maintenance: ["mobility_capacity"],
    avoid: ["max_strength", "lactate_tolerance"],
  },
  second_peak: {
    primary: "neuromuscular_adaptation",
    secondary: "power_output",
    maintenance: ["vo2_max_support"],
    avoid: ["hypertrophy_mixed"],
  },
};

// ---------------------------------------------------------------------------
// Guard/coercizioni difensive (mai throw).
// ---------------------------------------------------------------------------

const ADAPTATION_TARGET_SET = new Set<string>(ADAPTATION_TARGETS);
const PLAN_PHASE_SET = new Set<string>(PLAN_PHASES);
const PLAN_STATUS_SET = new Set<string>(PLAN_STATUSES);

export function isAdaptationTarget(value: unknown): value is AdaptationTarget {
  return typeof value === "string" && ADAPTATION_TARGET_SET.has(value);
}

/** Fase valida, altrimenti default `base` (fase più conservativa/iniziale). */
export function coercePhase(value: unknown): PlanPhase {
  return typeof value === "string" && PLAN_PHASE_SET.has(value)
    ? (value as PlanPhase)
    : "base";
}

/**
 * Status valido, altrimenti default `draft`: uno status ignoto è il caso più
 * insicuro, e `draft` è il più protettivo (per policy F5 l'atleta non lo vede).
 */
export function coerceStatus(value: unknown): PlanStatus {
  return typeof value === "string" && PLAN_STATUS_SET.has(value)
    ? (value as PlanStatus)
    : "draft";
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asRequiredString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Numero finito, altrimenti fallback. Accetta stringhe numeriche (numeric DB). */
function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** Numero finito o null (per colonne nullable). */
function asNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** jsonb potenzialmente serializzato come stringa → oggetto, mai throw. */
function asObject(value: unknown): Record<string, unknown> | null {
  if (isPlainObject(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    try {
      const parsed = JSON.parse(value);
      return isPlainObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Filtra un array a soli AdaptationTarget validi, deduplicato, con cap opzionale. */
function coerceTargetList(value: unknown, cap?: number): AdaptationTarget[] {
  if (!Array.isArray(value)) return [];
  const out: AdaptationTarget[] = [];
  for (const item of value) {
    if (isAdaptationTarget(item) && !out.includes(item)) out.push(item);
  }
  return typeof cap === "number" ? out.slice(0, cap) : out;
}

// ---------------------------------------------------------------------------
// Mapper pubblici.
// ---------------------------------------------------------------------------

/**
 * `objectives` jsonb → `WeekStimulus`. Se manca un `primary` valido (incluso il
 * default DB `'{}'` o jsonb malformato) si deriva l'intero stimolo dalla fase.
 * Con `primary` valido si costruisce lo stimolo dai campi validi presenti,
 * ignorando in silenzio i pezzi sporchi. `maintenance` è cappata a 2 (contratto B).
 */
export function weekObjectivesFromJson(raw: unknown, phase: PlanPhase): WeekStimulus {
  const fallback = PHASE_DEFAULT_STIMULUS[phase];
  const obj = asObject(raw);
  if (!obj || !isAdaptationTarget(obj.primary)) {
    // Copia difensiva del default: il chiamante non deve poter mutare la costante.
    return {
      primary: fallback.primary,
      secondary: fallback.secondary,
      maintenance: [...fallback.maintenance],
      avoid: [...fallback.avoid],
    };
  }
  return {
    primary: obj.primary,
    secondary: isAdaptationTarget(obj.secondary) ? obj.secondary : null,
    maintenance: coerceTargetList(obj.maintenance, 2),
    avoid: coerceTargetList(obj.avoid),
  };
}

/** `family_mix` jsonb → `WeekFamilyMix`. Default 100/0 (aerobico puro) se malformato. */
export function familyMixFromJson(raw: unknown): WeekFamilyMix {
  const obj = asObject(raw);
  if (!obj) return { aerobicPct: 100, gymPct: 0 };
  return {
    aerobicPct: asNumber(obj.aerobic_pct, 100),
    gymPct: asNumber(obj.gym_pct, 0),
  };
}

function mesocycleFromRow(row: TrainingPlanMesocycleRow): PlanSkeletonMesocycle {
  return {
    id: asRequiredString(row.id),
    seq: asNumber(row.seq, 0),
    phase: coercePhase(row.phase),
    label: asStringOrNull(row.label),
    weeks: asNumber(row.weeks, 0),
    loadWeeks: asNumber(row.load_weeks, 3),
    deloadWeeks: asNumber(row.deload_weeks, 1),
    weeklyTssTarget: asNumberOrNull(row.weekly_tss_target),
    sessionsTarget: asNumberOrNull(row.sessions_target),
    objective: asStringOrNull(row.objective),
    notes: asStringOrNull(row.notes),
  };
}

function weekFromRow(
  row: TrainingPlanWeekRow,
  seqByMesocycleId: Map<string, number>,
): PlanSkeletonWeek {
  const phase = coercePhase(row.phase);
  const mesocycleId = asStringOrNull(row.mesocycle_id);
  const mesocycleSeq =
    mesocycleId !== null && seqByMesocycleId.has(mesocycleId)
      ? (seqByMesocycleId.get(mesocycleId) as number)
      : null;
  return {
    id: asRequiredString(row.id),
    weekStart: asRequiredString(row.week_start),
    phase,
    weekInPhase: asNumber(row.week_in_phase, 0),
    mesocycleSeq,
    hoursTarget: asNumberOrNull(row.hours_target),
    loadTarget: asNumber(row.budget_tss, 0),
    sessionsTarget: asNumber(row.sessions, 0),
    stimulus: weekObjectivesFromJson(row.objectives, phase),
    familyMix: familyMixFromJson(row.family_mix),
    coachNotes: asStringOrNull(row.coach_notes),
  };
}

/**
 * Righe DB → `PlanSkeleton`. Difensivo: input malformati non lanciano.
 * I mesocicli sono ordinati per `seq`, le settimane per `week_start`; il `seq`
 * del mesociclo è risolto per join `mesocycle_id` (null se orfana).
 */
export function planSkeletonFromRows(
  planRow: TrainingPlanRow,
  mesocycleRows: readonly TrainingPlanMesocycleRow[] = [],
  weekRows: readonly TrainingPlanWeekRow[] = [],
): PlanSkeleton {
  const mesocycles = (Array.isArray(mesocycleRows) ? [...mesocycleRows] : [])
    .map(mesocycleFromRow)
    .sort((a, b) => a.seq - b.seq);

  const seqByMesocycleId = new Map<string, number>();
  for (const meso of mesocycles) {
    if (meso.id.length > 0) seqByMesocycleId.set(meso.id, meso.seq);
  }

  const weeks = (Array.isArray(weekRows) ? [...weekRows] : [])
    .map((row) => weekFromRow(row, seqByMesocycleId))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  return {
    id: asRequiredString(planRow.id),
    athleteId: asRequiredString(planRow.athlete_id),
    name: asStringOrNull(planRow.name),
    status: coerceStatus(planRow.status),
    approvedBy: asStringOrNull(planRow.approved_by),
    approvedAt: asStringOrNull(planRow.approved_at),
    discipline: asRequiredString(planRow.discipline),
    startDate: asRequiredString(planRow.start_date),
    endDate: asRequiredString(planRow.end_date),
    goalEventDate: asStringOrNull(planRow.goal_event_date),
    mesocycles,
    weeks,
  };
}
