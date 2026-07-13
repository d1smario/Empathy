export const EMPATHY_LOAD_METHOD_VERSION = "EMPATHY_LOAD_V3_2026_07" as const;

const MAX_TRAINING_LOAD = 999;
const DURATION_ONLY_CAP = 40;
/** Cap prudente su IF da FC (oltre soglia la relazione FC↔carico satura). */
const HR_IF_CAP = 1.15;
const DEFAULT_HR_MAX_BPM = 190;
/** LTHR ≈ 0.9 × FC max quando la soglia non è misurata (approssimazione di letteratura). */
const LTHR_FROM_HRMAX = 0.9;

/** Coggan semplificato: ore × (P/FTP)² × 100. */
export function trainingLoadFromPowerSession(input: {
  durationMinutes: number;
  avgPowerW: number;
  ftpW: number;
}): number {
  const ftp = Math.max(1, input.ftpW);
  const hours = Math.max(0, input.durationMinutes) / 60;
  const ifN = Math.max(0, input.avgPowerW) / ftp;
  return Math.round(Math.min(MAX_TRAINING_LOAD, Math.max(0, hours * ifN * ifN * 100)));
}

/** FC di soglia (LTHR): esplicita (LT2), o stimata da FC max (~0.9×HRmax), o default popolazione. */
export function resolveLthrBpm(input: { lthrBpm?: number | null; hrMaxBpm?: number | null }): number {
  const lthr = Number(input.lthrBpm);
  if (Number.isFinite(lthr) && lthr > 0) return lthr;
  const hrMax = Number(input.hrMaxBpm);
  if (Number.isFinite(hrMax) && hrMax > 0) return hrMax * LTHR_FROM_HRMAX;
  return DEFAULT_HR_MAX_BPM * LTHR_FROM_HRMAX;
}

/**
 * hrTSS: analogo del TSS quando manca la potenza (TrainingPeaks/Coggan).
 * ore × IF² × 100, con IF = FC_media / LTHR. Steady-state: preciso; per sessioni
 * molto variabili è una stima (l'avg FC appiattisce i picchi).
 */
export function trainingLoadFromHrSession(input: {
  durationMinutes: number;
  hrAvgBpm: number;
  lthrBpm?: number | null;
  hrMaxBpm?: number | null;
}): number {
  const lthr = resolveLthrBpm({ lthrBpm: input.lthrBpm, hrMaxBpm: input.hrMaxBpm });
  const hours = Math.max(0, input.durationMinutes) / 60;
  const ifHr = Math.max(0, Math.min(HR_IF_CAP, Math.max(0, input.hrAvgBpm) / Math.max(1, lthr)));
  return Math.round(Math.min(MAX_TRAINING_LOAD, hours * ifHr * ifHr * 100));
}

/**
 * Carico di lavoro per singola seduta (label prodotto: Training load / TSS).
 * Ordine: vendor → potenza/FTP (TSS) → FC/LTHR (hrTSS) → durata conservativa.
 */
export function inferEmpathyTrainingLoadForSession(input: {
  vendorLoad?: number | null;
  durationMinutes: number;
  hrAvgBpm?: number | null;
  avgPowerW?: number | null;
  ftpW?: number | null;
  lthrBpm?: number | null;
  hrMaxBpm?: number | null;
}): number {
  const vendor = Number(input.vendorLoad ?? 0);
  if (Number.isFinite(vendor) && vendor > 0) {
    return Math.round(Math.min(MAX_TRAINING_LOAD, vendor));
  }

  const dur = Math.max(0, input.durationMinutes);
  const ftp = input.ftpW;
  const power = input.avgPowerW;
  if (
    ftp != null &&
    Number.isFinite(ftp) &&
    ftp > 0 &&
    power != null &&
    Number.isFinite(power) &&
    power > 0 &&
    dur > 0
  ) {
    return trainingLoadFromPowerSession({ durationMinutes: dur, avgPowerW: power, ftpW: ftp });
  }

  const hr = input.hrAvgBpm;
  if (hr != null && Number.isFinite(hr) && hr > 0 && dur > 0) {
    return trainingLoadFromHrSession({
      durationMinutes: dur,
      hrAvgBpm: hr,
      lthrBpm: input.lthrBpm,
      hrMaxBpm: input.hrMaxBpm,
    });
  }

  if (dur > 0) {
    return Math.round(Math.min(DURATION_ONLY_CAP, dur * 0.45));
  }
  return 0;
}
