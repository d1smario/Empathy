import {
  inferEmpathyTrainingLoadDetailForSession,
  type AthleteHrThresholds,
  type EmpathyTrainingLoadDetail,
} from "@empathy/domain-training";

const HR_KEYS = [
  "hr_avg_bpm",
  "avg_hr",
  "heart_rate_avg",
  "avg_heart_rate",
  "averageHeartRateInBeatsPerMinute",
];

const POWER_KEYS = ["power_avg_w", "avg_power_w", "avg_power", "normalized_power_w", "np_w"];

function pickNum(trace: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!trace) return null;
  for (const key of keys) {
    const v = trace[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export type ExecutedTrainingLoadInput = {
  storedTss?: number | null;
  durationMinutes: number;
  traceSummary?: Record<string, unknown> | null;
  vendorLoad?: number | null;
  ftpW?: number | null;
  /**
   * Soglie FC **dell'atleta** (`readAthleteHrThresholds`), obbligatorie.
   * Non sono derivabili dalla seduta: il picco di FC dell'attività
   * (`trace_summary.hr_max_bpm`) non è una soglia, e usarlo gonfiava l'hrTSS delle
   * uscite facili fino a +150%.
   */
  athlete: AthleteHrThresholds;
};

/**
 * Training load per display: colonna `tss` se > 0, altrimenti inferenza Empathy.
 *
 * `null` = carico **assente** (non zero): la seduta non ha nessun segnale di intensità
 * utilizzabile — o l'atleta non ha soglie. Chi legge deve mostrare «—» ed escluderla
 * dalle somme, mai sostituire un numero di comodo.
 */
export function resolveExecutedTrainingLoad(input: ExecutedTrainingLoadInput): number | null {
  return resolveExecutedTrainingLoadDetail(input).trainingLoad;
}

/** Come `resolveExecutedTrainingLoad`, ma dichiara anche il metodo usato (QA / ricalcoli). */
export function resolveExecutedTrainingLoadDetail(
  input: ExecutedTrainingLoadInput,
): EmpathyTrainingLoadDetail {
  const stored = Number(input.storedTss ?? 0);
  if (Number.isFinite(stored) && stored > 0) {
    // `stored`: valore già in colonna, non ricalcolato — non spacciarlo per «vendor».
    return { trainingLoad: Math.round(stored), method: "stored" };
  }

  return inferEmpathyTrainingLoadDetailForSession({
    vendorLoad: input.vendorLoad,
    durationMinutes: Math.max(0, input.durationMinutes),
    hrAvgBpm: pickNum(input.traceSummary ?? null, HR_KEYS),
    avgPowerW: pickNum(input.traceSummary ?? null, POWER_KEYS),
    ftpW: input.ftpW ?? null,
    athlete: input.athlete,
  });
}

/**
 * Valore da scrivere su `executed_workouts.tss` in materialize/import.
 *
 * Ritorna il **dettaglio**, non un numero: `trainingLoad: null` significa «carico non
 * calcolabile» e la colonna (NOT NULL) va scritta a 0 — che i lettori riconoscono come
 * «non misurato» e re-inferiscono. `method` va in `trace_summary.training_load_method`.
 */
export function trainingLoadForExecutedPersist(input: {
  vendorLoad?: number | null;
  durationMinutes: number;
  traceSummary?: Record<string, unknown> | null;
  ftpW?: number | null;
  athlete: AthleteHrThresholds;
}): EmpathyTrainingLoadDetail {
  return resolveExecutedTrainingLoadDetail({
    storedTss: 0,
    durationMinutes: input.durationMinutes,
    traceSummary: input.traceSummary,
    vendorLoad: input.vendorLoad,
    ftpW: input.ftpW,
    athlete: input.athlete,
  });
}
