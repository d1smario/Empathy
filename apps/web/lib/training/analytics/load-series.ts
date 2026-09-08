import {
  computeEmpathyLoadMetricsV2,
  inferEmpathyTrainingLoadForSession,
  type AthleteHrThresholds,
  type EmpathyLoadMetricsDayInput,
  type EmpathyLoadWellnessInput,
} from "@empathy/domain-training";
import { wellnessSignalsByDateFromLoadRows } from "@/lib/training/analytics/wellness-signals-from-load-rows";

export type ExecutedWorkoutLoadRow = {
  date: string | null;
  tss: number | null;
  duration_minutes: number | null;
  kcal?: number | null;
  trace_summary: Record<string, unknown> | null;
  lactate_mmoll: number | null;
  glucose_mmol: number | null;
  smo2: number | null;
};

export type DailyLoadPoint = {
  date: string;
  /** Somma carico giornaliero (training load). */
  external: number;
  /** Stress core giornaliero (ramo interno V2). */
  internal: number;
  /** @deprecated Alias → fitness4 */
  ctl: number;
  /** @deprecated Alias → strain */
  atl: number;
  /** @deprecated Alias → form */
  tsb: number;
  /** @deprecated Alias → conditioningInt4 */
  iCtl: number;
  /** @deprecated Alias → fatigueInt */
  iAtl: number;
  /** @deprecated Alias → conditioningInt4 − fatigueInt */
  iTsb: number;
  trainingLoadDaily: number;
  strain: number;
  fitness4: number;
  fitness8: number;
  form: number;
  stressCore: number;
  fatigueInt: number;
  conditioningInt4: number;
  conditioningInt8: number;
  formInt: number;
};

const HR_KEYS = [
  "hr_avg_bpm",
  "avg_hr",
  "heart_rate_avg",
  "avg_heart_rate",
  "averageHeartRateInBeatsPerMinute",
];

const POWER_KEYS = ["power_avg_w", "avg_power_w", "avg_power", "normalized_power_w", "np_w"];

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickMetric(trace: Record<string, unknown> | null, keys: string[]): number | null {
  if (!trace) return null;
  for (const key of keys) {
    const value = asNum(trace[key]);
    if (value != null) return value;
  }
  return null;
}

/**
 * Carico della singola seduta. `null` = non calcolabile: la seduta NON entra nelle
 * serie giornaliere invece di entrarci con un numero di ripiego.
 */
function sessionTrainingLoad(
  row: ExecutedWorkoutLoadRow,
  athlete: AthleteHrThresholds,
): number | null {
  const stored = Number(row.tss ?? 0);
  if (stored > 0) return stored;
  const hrAvg = pickMetric(row.trace_summary, HR_KEYS);
  return inferEmpathyTrainingLoadForSession({
    durationMinutes: Math.max(0, Number(row.duration_minutes ?? 0)),
    hrAvgBpm: hrAvg,
    avgPowerW: pickMetric(row.trace_summary, POWER_KEYS),
    athlete,
  });
}

function rowsToV2Input(
  rows: ExecutedWorkoutLoadRow[],
  athlete: AthleteHrThresholds,
  wellnessByDate?: Map<string, EmpathyLoadWellnessInput>,
): EmpathyLoadMetricsDayInput[] {
  const wellness = wellnessByDate ?? wellnessSignalsByDateFromLoadRows(rows);
  const byDate = new Map<string, EmpathyLoadMetricsDayInput>();
  for (const row of rows) {
    if (typeof row.date !== "string" || row.date.length < 10) continue;
    const prev = byDate.get(row.date) ?? {
      date: row.date,
      sessions: [],
      wellness: wellness.get(row.date),
    };
    const trainingLoad =
      row.duration_minutes != null && Number(row.duration_minutes) > 0
        ? sessionTrainingLoad(row, athlete)
        : null;
    // Carico assente ⇒ la seduta non contribuisce: meglio una serie più bassa che una
    // serie alimentata da un numero inventato.
    if (trainingLoad != null) {
      prev.sessions.push({
        trainingLoad,
        durationMinutes: Math.max(0, Number(row.duration_minutes ?? 0)),
        hrAvgBpm: pickMetric(row.trace_summary, HR_KEYS),
      });
    }
    byDate.set(row.date, prev);
  }
  for (const [date, w] of wellness) {
    if (!byDate.has(date)) {
      byDate.set(date, { date, sessions: [], wellness: w });
    } else {
      const day = byDate.get(date)!;
      day.wellness = w;
    }
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** @deprecated Usare serie V2; mantiene firma per caller esistenti. */
export function internalLoadScore(row: ExecutedWorkoutLoadRow, athlete: AthleteHrThresholds): number | null {
  const load = sessionTrainingLoad(row, athlete);
  return load == null ? null : load * 0.72;
}

export function computeDailyLoadSeries(
  rows: ExecutedWorkoutLoadRow[],
  options: {
    /** Soglie FC dell'atleta (`readAthleteHrThresholds`) — obbligatorie: senza, l'hrTSS non si calcola. */
    athlete: AthleteHrThresholds;
    wellnessByDate?: Map<string, EmpathyLoadWellnessInput>;
  },
): DailyLoadPoint[] {
  const v2 = computeEmpathyLoadMetricsV2(rowsToV2Input(rows, options.athlete, options.wellnessByDate));
  return v2.map((p) => ({
    date: p.date,
    external: p.trainingLoadDaily,
    internal: p.stressCore,
    ctl: p.fitness4,
    atl: p.strain,
    tsb: p.form,
    iCtl: p.conditioningInt4,
    iAtl: p.fatigueInt,
    iTsb: p.conditioningInt4 - p.fatigueInt,
    trainingLoadDaily: p.trainingLoadDaily,
    strain: p.strain,
    fitness4: p.fitness4,
    fitness8: p.fitness8,
    form: p.form,
    stressCore: p.stressCore,
    fatigueInt: p.fatigueInt,
    conditioningInt4: p.conditioningInt4,
    conditioningInt8: p.conditioningInt8,
    formInt: p.formInt,
  }));
}
