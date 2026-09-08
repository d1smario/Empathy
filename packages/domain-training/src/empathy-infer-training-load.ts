export const EMPATHY_LOAD_METHOD_VERSION = "EMPATHY_LOAD_V5_2026_09" as const;

const MAX_TRAINING_LOAD = 999;
/** Cap prudente su IF da FC (oltre soglia la relazione FC↔carico satura). */
const HR_IF_CAP = 1.15;
/** LTHR ≈ 0.9 × FC max **dell'atleta** quando la soglia non è misurata (approssimazione di letteratura). */
const LTHR_FROM_HRMAX = 0.9;

/**
 * Range di plausibilità per i campi FC dell'anagrafica: sono compilati a mano, e un
 * valore fuori scala (95, 12, 400) non è una soglia — è un dato sbagliato. Accettarlo
 * produce un hrTSS plausibile ma falso (con LTHR 95 un'uscita facile passa da 48 a 187).
 * Fuori range il valore viene scartato, non «aggiustato».
 */
const LTHR_MIN_BPM = 120;
const LTHR_MAX_BPM = 210;
const ATHLETE_HR_MAX_MIN_BPM = 140;
const ATHLETE_HR_MAX_MAX_BPM = 230;

/**
 * Come è stato ottenuto il carico della seduta.
 * `stored` = valore già presente in `executed_workouts.tss` (non ricalcolato).
 * `none`   = **non calcolabile**: nessun segnale di intensità utilizzabile.
 * Non esiste più un ramo «durata»: vedi `inferEmpathyTrainingLoadDetailForSession`.
 */
export type EmpathyTrainingLoadMethod = "vendor" | "power" | "hr" | "stored" | "none";

export type EmpathyTrainingLoadDetail = {
  /**
   * `null` = carico **assente**, non zero e non un ripiego. Chi legge deve mostrare «—»
   * ed escludere la seduta dalle somme, non sostituire un numero di comodo.
   */
  trainingLoad: number | null;
  method: EmpathyTrainingLoadMethod;
};

declare const ATHLETE_HR_THRESHOLDS_BRAND: unique symbol;

/**
 * Riferimenti di FC **dell'atleta** (anagrafica/profilo fisiologico), mai della seduta.
 *
 * Tipo opaco di proposito: il brand non è esportato, quindi un valore di questo tipo si
 * può ottenere **solo** da `athleteHrThresholdsFromProfile` (che ha parametri con il nome
 * delle colonne di anagrafica) o da `ATHLETE_HR_THRESHOLDS_UNAVAILABLE`. Non è più
 * possibile passare per errore `trace_summary.hr_max_bpm` — il picco di FC della singola
 * attività non è una soglia: su un'uscita facile la soglia stimata crolla e l'hrTSS si
 * gonfia (fino a +150% misurato su dati reali).
 *
 * Fonti valide, in ordine:
 *   1. `physiological_profiles.lt2_heart_rate` → `lt2HeartRate`
 *   2. `athlete_profiles.threshold_hr_bpm`     → `thresholdHrBpm`
 *   3. `athlete_profiles.max_hr_bpm`           → `maxHrBpm`
 */
export type AthleteHrThresholds = {
  readonly [ATHLETE_HR_THRESHOLDS_BRAND]: "athlete_profile";
  readonly lthrBpm: number | null;
  readonly athleteHrMaxBpm: number | null;
};

function plausibleBpm(value: unknown, minBpm: number, maxBpm: number): number | null {
  const n = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  if (n < minBpm || n > maxBpm) return null;
  return n;
}

function brandThresholds(lthrBpm: number | null, athleteHrMaxBpm: number | null): AthleteHrThresholds {
  return { lthrBpm, athleteHrMaxBpm } as unknown as AthleteHrThresholds;
}

/**
 * Unica costruzione lecita delle soglie: dai campi di anagrafica dell'atleta.
 * I valori fuori dai range di plausibilità vengono scartati (→ `null`), non corretti.
 */
export function athleteHrThresholdsFromProfile(input: {
  /** `physiological_profiles.lt2_heart_rate` (soglia misurata). */
  lt2HeartRate?: unknown;
  /** `athlete_profiles.threshold_hr_bpm` (soglia dichiarata). */
  thresholdHrBpm?: unknown;
  /** `athlete_profiles.max_hr_bpm` — FC max **dell'atleta**, mai il picco di una seduta. */
  maxHrBpm?: unknown;
}): AthleteHrThresholds {
  const lt2 = plausibleBpm(input.lt2HeartRate, LTHR_MIN_BPM, LTHR_MAX_BPM);
  const declared = plausibleBpm(input.thresholdHrBpm, LTHR_MIN_BPM, LTHR_MAX_BPM);
  const hrMax = plausibleBpm(input.maxHrBpm, ATHLETE_HR_MAX_MIN_BPM, ATHLETE_HR_MAX_MAX_BPM);
  return brandThresholds(lt2 ?? declared, hrMax);
}

/**
 * Atleta senza nessuna soglia nota (o profilo non leggibile).
 * Dichiararlo è una scelta esplicita: con questo valore il carico da FC **non si calcola**
 * e la seduta resta senza carico. Non usarlo per «saltare» il caricamento del profilo.
 */
export const ATHLETE_HR_THRESHOLDS_UNAVAILABLE: AthleteHrThresholds = brandThresholds(null, null);

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

/**
 * FC di soglia (LTHR) dell'atleta: esplicita (LT2/threshold) oppure stimata da FC max
 * anagrafica (~0.9×HRmax). `null` quando l'atleta non ha nessuno dei due dati.
 *
 * Nessun default di popolazione: una soglia inventata produce un carico plausibile ma
 * falso, che poi alimenta nutrizione e dashboard. Meglio non calcolare l'hrTSS.
 */
export function resolveAthleteLthrBpm(athlete: AthleteHrThresholds): number | null {
  if (athlete.lthrBpm != null) return athlete.lthrBpm;
  if (athlete.athleteHrMaxBpm != null) return athlete.athleteHrMaxBpm * LTHR_FROM_HRMAX;
  return null;
}

/**
 * hrTSS: analogo del TSS quando manca la potenza (TrainingPeaks/Coggan).
 * ore × IF² × 100, con IF = FC_media / LTHR. Steady-state: preciso; per sessioni
 * molto variabili è una stima (l'avg FC appiattisce i picchi).
 *
 * `null` quando l'atleta non ha una soglia nota: senza soglia l'hrTSS non è calcolabile.
 */
export function trainingLoadFromHrSession(input: {
  durationMinutes: number;
  hrAvgBpm: number;
  athlete: AthleteHrThresholds;
}): number | null {
  const lthr = resolveAthleteLthrBpm(input.athlete);
  if (lthr == null) return null;
  const hours = Math.max(0, input.durationMinutes) / 60;
  const ifHr = Math.max(0, Math.min(HR_IF_CAP, Math.max(0, input.hrAvgBpm) / Math.max(1, lthr)));
  return Math.round(Math.min(MAX_TRAINING_LOAD, hours * ifHr * ifHr * 100));
}

export type EmpathyTrainingLoadSessionInput = {
  vendorLoad?: number | null;
  durationMinutes: number;
  hrAvgBpm?: number | null;
  avgPowerW?: number | null;
  ftpW?: number | null;
  /**
   * Soglie FC **dell'atleta**. Parametro obbligatorio: dimenticarlo non compila, così
   * nessun chiamante può finire in silenzio sul ramo peggiore (è il buco che ha prodotto
   * la regressione Strava).
   */
  athlete: AthleteHrThresholds;
};

/**
 * Carico di lavoro per singola seduta (label prodotto: Training load / TSS), con il
 * metodo effettivamente usato.
 * Ordine: vendor → potenza/FTP (TSS) → FC/LTHR atleta (hrTSS) → **niente**.
 *
 * NON esiste un ripiego per durata. `ore × 0,45` con tetto 40 dava lo stesso numero a
 * 90' a 105 bpm e a 364' a 158 bpm: un valore plausibile ma falso, indistinguibile a
 * valle da un carico misurato. Senza un segnale di intensità utilizzabile il carico è
 * **assente** (`null`) e chi legge mostra «—».
 */
export function inferEmpathyTrainingLoadDetailForSession(
  input: EmpathyTrainingLoadSessionInput,
): EmpathyTrainingLoadDetail {
  const vendor = Number(input.vendorLoad ?? 0);
  if (Number.isFinite(vendor) && vendor > 0) {
    return { trainingLoad: Math.round(Math.min(MAX_TRAINING_LOAD, vendor)), method: "vendor" };
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
    return {
      trainingLoad: trainingLoadFromPowerSession({
        durationMinutes: dur,
        avgPowerW: power,
        ftpW: ftp,
      }),
      method: "power",
    };
  }

  const hr = input.hrAvgBpm;
  if (hr != null && Number.isFinite(hr) && hr > 0 && dur > 0) {
    const hrTss = trainingLoadFromHrSession({
      durationMinutes: dur,
      hrAvgBpm: hr,
      athlete: input.athlete,
    });
    if (hrTss != null) return { trainingLoad: hrTss, method: "hr" };
  }

  return { trainingLoad: null, method: "none" };
}

/**
 * Carico di lavoro per singola seduta (label prodotto: Training load / TSS).
 * `null` quando non è calcolabile: vedi `inferEmpathyTrainingLoadDetailForSession`.
 */
export function inferEmpathyTrainingLoadForSession(
  input: EmpathyTrainingLoadSessionInput,
): number | null {
  return inferEmpathyTrainingLoadDetailForSession(input).trainingLoad;
}
