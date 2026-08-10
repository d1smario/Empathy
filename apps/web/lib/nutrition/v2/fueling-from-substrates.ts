/**
 * Fueling V2 — intra da consumo CHO in seduta (substrati), non da % kcal training.
 * Z1/Z2: CHO minoritario → integrazione orale più bassa; alta intensità: CHO dominante → integrazione alta.
 */

import { substrateTotalsForSession } from "@/lib/nutrition/v2/substrate-rates";

export type SubstrateFuelingSession = {
  sessionLabel: string;
  avgPowerW: number;
  durationH: number;
  choBurnedG: number;
  fatBurnedG: number;
  proBurnedG: number;
  /** Quota energetica della seduta coperta da CHO (0–1). */
  choEnergyShare: number;
  /** Frazione del CHO bruciato da sostituire oralmente in intra. */
  intraChoReplaceFraction: number;
  preChoG: number;
  intraChoG: number;
  postChoG: number;
  preKcal: number;
  intraKcal: number;
  postKcal: number;
  evidenceMaxChoGPerH: number;
  intraChoGPerH: number;
  /** Fascia di capacità intestinale usata per la banda (da W/kg dell'atleta). */
  gutCapacityTier: GutCapacityTier;
};

export type SubstrateFuelingPlan = {
  algorithmVersion: "substrate_fueling_v1";
  sessions: SubstrateFuelingSession[];
  totals: {
    preChoG: number;
    intraChoG: number;
    postChoG: number;
    fuelingKcal: number;
    oralTrainingKcal: number;
    /** kcal training non coperte oralmente (ossidazione lipidica endogena). */
    endogenousFatKcal: number;
  };
  provenance: string[];
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round(n: number, d = 1): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/** Quota del CHO bruciato da reintegrare durante l'esercizio (non % kcal totali seduta). */
export function intraChoReplaceFractionFromEnergyShare(choEnergyShare: number): number {
  const s = clamp(choEnergyShare, 0, 1);
  if (s >= 0.88) return 0.85;
  if (s >= 0.78) return 0.75;
  if (s >= 0.65) return 0.65;
  if (s >= 0.52) return 0.55;
  return 0.45;
}

/**
 * GUARDIA ASSOLUTA — nessun percorso può prescrivere più di 200 g/h di CHO in seduta,
 * qualunque cosa dicano la banda, la frazione di rimpiazzo o le scale di integrazione
 * performance. Decisione Mario (8 ago 2026): «alza quel limite fino a 200 e stiamo
 * tranquilli». È la RETE, non l'obiettivo: oggi la banda si ferma a 160 g/h, quindi
 * la guardia non morde mai — ed è voluto. A decidere i grammi è quanto l'atleta
 * ASSORBE (banda per capacità), non quanto brucia.
 */
export const ABSOLUTE_MAX_CHO_G_PER_HOUR = 200;

/** Applica la guardia assoluta a un rate g/h (ultima riga di difesa, sempre attiva). */
export function capChoGPerHour(gPerHour: number): number {
  if (!Number.isFinite(gPerHour) || gPerHour <= 0) return 0;
  return Math.min(gPerHour, ABSOLUTE_MAX_CHO_G_PER_HOUR);
}

/** Applica la guardia assoluta a grammi totali su una durata (g/h × h). */
export function capChoGramsForDuration(choG: number, durationH: number): number {
  if (!Number.isFinite(choG) || choG <= 0) return 0;
  const hours = Number.isFinite(durationH) && durationH > 0 ? durationH : 0;
  if (hours <= 0) return choG;
  return Math.min(choG, ABSOLUTE_MAX_CHO_G_PER_HOUR * hours);
}

/**
 * Capacità di assorbimento intestinale dell'atleta.
 * STESSA soglia W/kg già in uso nel solver V1 (`daily-energy-solver.deriveEvidenceChoRange`:
 * elite ≥ 4,8 W/kg, alta ≥ 4,2 W/kg) — un solo criterio di capacità in tutto il repo.
 */
export type GutCapacityTier = "base" | "high" | "elite";

export const GUT_CAPACITY_FTP_W_KG_THRESHOLDS = { elite: 4.8, high: 4.2 } as const;

export function gutCapacityTierFromFtpWKg(ftpWKg: number | null | undefined): GutCapacityTier {
  const v = typeof ftpWKg === "number" && Number.isFinite(ftpWKg) ? ftpWKg : 0;
  if (v >= GUT_CAPACITY_FTP_W_KG_THRESHOLDS.elite) return "elite";
  if (v >= GUT_CAPACITY_FTP_W_KG_THRESHOLDS.high) return "high";
  return "base";
}

/**
 * Pavimenti e default di FTP/peso del motore: FTP < 120 W o peso < 45 kg sono quasi sempre
 * dati sporchi (unità sbagliata, campo mai compilato), e senza il pavimento un peso di 40 kg
 * gonfierebbe i W/kg. Erano inline in `computeSubstrateFuelingPlan`: estratti qui perché
 * CHIUNQUE calcoli la fascia lo faccia sugli STESSI numeri con cui vengono calcolati i grammi.
 */
export const GUT_CAPACITY_INPUT_FLOORS = { ftpW: 120, weightKg: 45 } as const;
export const GUT_CAPACITY_INPUT_DEFAULTS = { ftpW: 250, weightKg: 70 } as const;

/**
 * UNICA normalizzazione di FTP e peso in tutto il motore nutrizione.
 * Un input è MISURATO solo se è un numero finito e POSITIVO: `null`, `undefined`, `0`, `NaN`,
 * negativi = mai misurato. Prima esistevano tre conversioni diverse dello stesso input
 * (qui, in `resolvePrescribedIntraChoGPerHour`, in `daily-nutrition-requirements`) e sullo
 * stesso atleta potevano dare tre risposte diverse.
 */
export function measuredPositive(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

/** FTP da usare per l'ENERGETICA dei substrati: default del motore se mai misurato. */
export function normalizeFtpW(ftpW: number | null | undefined): number {
  const measured = measuredPositive(ftpW);
  return measured == null
    ? GUT_CAPACITY_INPUT_DEFAULTS.ftpW
    : Math.max(GUT_CAPACITY_INPUT_FLOORS.ftpW, measured);
}

/** Peso da usare per l'ENERGETICA/pre-workout: default del motore se mai misurato. */
export function normalizeWeightKg(weightKg: number | null | undefined): number {
  const measured = measuredPositive(weightKg);
  return measured == null
    ? GUT_CAPACITY_INPUT_DEFAULTS.weightKg
    : Math.max(GUT_CAPACITY_INPUT_FLOORS.weightKg, measured);
}

/**
 * UNICO punto in cui si decide la fascia di capacità da FTP e peso grezzi.
 *
 * REGOLA: SI PROMUOVE SOLO SU MISURA. Se manca l'FTP **oppure** il peso, la fascia è "base"
 * — la colonna di HEAD — anche se poi il motore, per calcolare l'energetica, userà comunque
 * i suoi default (250 W / 70 kg). Senza questa regola un atleta senza FTP ma leggero
 * (default 250 W / 53 kg = 4,72 W/kg) verrebbe dichiarato «ventre allenato» senza averlo mai
 * dimostrato, e più CHO in gara su un intestino non allenato è la direzione pericolosa
 * (distress gastrointestinale). È anche la stessa scelta del solver V1: in
 * `daily-energy-solver` `ftpWKg` è null se manca un dato → `asFinite(null) ?? 0` → mai promosso.
 *
 * Sui valori MISURATI applica i pavimenti PRIMA del rapporto, esattamente come fa il motore
 * quando calcola i grammi: così l'etichetta mostrata («fascia elite») non può divergere dalla
 * banda applicata (con FTP 200 W su 40 kg il rapporto grezzo darebbe 5,00 = elite, quello del
 * motore 200/45 = 4,44 = alta).
 */
export function resolveGutCapacityTier(
  ftpW: number | null | undefined,
  weightKg: number | null | undefined,
): GutCapacityTier {
  const measuredFtpW = measuredPositive(ftpW);
  const measuredWeightKg = measuredPositive(weightKg);
  if (measuredFtpW == null || measuredWeightKg == null) return "base";
  return gutCapacityTierFromFtpWKg(
    Math.max(GUT_CAPACITY_INPUT_FLOORS.ftpW, measuredFtpW) /
      Math.max(GUT_CAPACITY_INPUT_FLOORS.weightKg, measuredWeightKg),
  );
}

/** Soglia di "CHO dominante" nell'energia della seduta: sopra, l'intestino può ricevere di più. */
export const CHO_DOMINANT_ENERGY_SHARE = 0.85;

type ChoCapacityTriplet = { base: number; high: number; elite: number };

type ChoBandRow = {
  /** La riga vale per durate STRETTAMENTE minori di questo valore in ore (Infinity = ultima). */
  durationBelowH: number;
  label: string;
  /** choEnergyShare < CHO_DOMINANT_ENERGY_SHARE — Z1/Z2, CHO minoritario. */
  mixed: ChoCapacityTriplet;
  /** choEnergyShare ≥ CHO_DOMINANT_ENERGY_SHARE — alta intensità, CHO dominante. */
  choDominant: ChoCapacityTriplet;
};

/**
 * BANDA DI ASSORBIMENTO — g/h massimi di CHO esogeno, per durata × intensità × capacità.
 *
 * La fisiologia: l'intestino ha un tetto (glucosio da solo ~60 g/h; con fruttosio in
 * co-trasporto 90–120; ventri allenati oltre) e quel tetto NON si sposta perché bruci di più.
 * Per questo la colonna che cambia è la CAPACITÀ dell'atleta, non il consumo.
 *
 * Le colonne "base" sono ESATTAMENTE i valori storici: nessuna regressione per chi non è
 * allenato. "alta" = ≥ 4,2 W/kg, "elite" = ≥ 4,8 W/kg (stesse soglie del solver V1).
 * Sotto i 45' l'integrazione non serve a nessuno: 30 g/h per tutti, elite compresi.
 * L'ultima cella (≥3 h, CHO dominante, elite = 160 g/h) sono i triathleti che Mario osserva.
 */
export const EVIDENCE_MAX_CHO_G_PER_HOUR_TABLE: readonly ChoBandRow[] = [
  //                                       │ base │ alta │ elite
  { durationBelowH: 0.75, label: "<45 min",
    mixed:       { base: 30, high:  30, elite:  30 },
    choDominant: { base: 30, high:  30, elite:  30 } },
  { durationBelowH: 2, label: "<2 h",
    mixed:       { base: 60, high:  70, elite:  80 },
    choDominant: { base: 90, high: 105, elite: 120 } },
  { durationBelowH: 3, label: "<3 h",
    mixed:       { base: 75, high:  90, elite: 100 },
    choDominant: { base: 110, high: 130, elite: 150 } },
  { durationBelowH: Number.POSITIVE_INFINITY, label: "≥3 h",
    mixed:       { base: 90, high: 110, elite: 120 },
    choDominant: { base: 120, high: 140, elite: 160 } },
];

export function evidenceMaxChoGPerHour(
  durationMin: number,
  choEnergyShare: number,
  capacityTier: GutCapacityTier = "base",
): number {
  const h = Math.max(0, durationMin) / 60;
  const row =
    EVIDENCE_MAX_CHO_G_PER_HOUR_TABLE.find((r) => h < r.durationBelowH) ??
    EVIDENCE_MAX_CHO_G_PER_HOUR_TABLE[EVIDENCE_MAX_CHO_G_PER_HOUR_TABLE.length - 1]!;
  const triplet = choEnergyShare >= CHO_DOMINANT_ENERGY_SHARE ? row.choDominant : row.mixed;
  return capChoGPerHour(triplet[capacityTier]);
}

/**
 * Etichetta UI della banda di assorbimento per una durata e una capacità: da Z1/Z2
 * (CHO minoritario) ad alta intensità (CHO dominante). È la STESSA tabella che decide
 * i grammi, così la fascia mostrata non può divergere da quella applicata.
 */
export function evidenceChoBandLabel(durationMin: number, capacityTier: GutCapacityTier): string {
  const h = Math.max(0, durationMin) / 60;
  const row =
    EVIDENCE_MAX_CHO_G_PER_HOUR_TABLE.find((r) => h < r.durationBelowH) ??
    EVIDENCE_MAX_CHO_G_PER_HOUR_TABLE[EVIDENCE_MAX_CHO_G_PER_HOUR_TABLE.length - 1]!;
  const lo = row.mixed[capacityTier];
  const hi = row.choDominant[capacityTier];
  return lo === hi ? `${lo} g/h` : `${lo}-${hi} g/h`;
}

/** g/h intra effettivamente prescritti dal piano (media pesata sulle ore di seduta). */
export function prescribedIntraChoGPerHour(plan: SubstrateFuelingPlan): number {
  const hours = plan.sessions.reduce((sum, s) => sum + Math.max(0, s.durationH), 0);
  if (hours <= 0) return 0;
  return round(capChoGPerHour(plan.totals.intraChoG / hours));
}

export function computeSubstrateFuelingPlan(input: {
  sessions: Array<{ label: string; avgPowerW: number; durationMin: number }>;
  /** FTP MISURATO dell'atleta (null/0/assente = mai misurato → default motore, fascia "base"). */
  ftpW?: number | null;
  /** Peso MISURATO dell'atleta (null/0/assente = mai misurato → default motore, fascia "base"). */
  weightKg?: number | null;
}): SubstrateFuelingPlan {
  const ftp = normalizeFtpW(input.ftpW);
  const weightKg = normalizeWeightKg(input.weightKg);
  const capacityTier = resolveGutCapacityTier(input.ftpW, input.weightKg);
  const capacityMeasured =
    measuredPositive(input.ftpW) != null && measuredPositive(input.weightKg) != null;
  const sessions: SubstrateFuelingSession[] = [];
  const provenance: string[] = [
    "Fueling intra: frazione del CHO bruciato in seduta (substrati), non % kcal training.",
    "Alta intensità (CHO ≈ energia) → replace fino ~85%; Z1/Z2 (CHO 50–65%) → replace ~45–55%.",
    "Cap intra g/h da durata + intensità + CAPACITÀ dell'atleta (banda di assorbimento). Pre/post = CHO mirato, non split % kcal training.",
    capacityMeasured
      ? `Capacità intestinale: ${capacityTier} (${round(ftp / weightKg, 2)} W/kg misurati; soglie ≥${GUT_CAPACITY_FTP_W_KG_THRESHOLDS.high} alta, ≥${GUT_CAPACITY_FTP_W_KG_THRESHOLDS.elite} elite — stesse del solver V1).`
      : "Capacità intestinale: base — FTP o peso non misurati, la fascia si alza solo su misura (l'energetica usa i default motore).",
    `Guardia assoluta: nessuna prescrizione oltre ${ABSOLUTE_MAX_CHO_G_PER_HOUR} g/h di CHO.`,
  ];

  for (const s of input.sessions) {
    const totals = substrateTotalsForSession(s.avgPowerW, s.durationMin, { ftpW: ftp });
    const choKcal = totals.choG * 4;
    const fatKcal = totals.fatG * 9;
    const proKcal = totals.proG * 4;
    const substrateKcal = choKcal + fatKcal + proKcal;
    const choEnergyShare = substrateKcal > 0 ? choKcal / substrateKcal : 0.5;
    const replaceFrac = intraChoReplaceFractionFromEnergyShare(choEnergyShare);
    const maxPerH = evidenceMaxChoGPerHour(s.durationMin, choEnergyShare, capacityTier);
    let intraChoG = round(totals.choG * replaceFrac);
    const intraCap = round(maxPerH * totals.durationH);
    if (intraChoG > intraCap) {
      intraChoG = intraCap;
      provenance.push(
        `Sessione ${s.label.slice(0, 40)}: intra CHO capped a ${maxPerH} g/h × ${totals.durationH} h (capacità ${capacityTier}).`,
      );
    }
    // Rete finale: la banda è già ≤ 200 g/h, questo taglio non morde mai oggi — resta perché
    // nessun percorso futuro possa superare la guardia assoluta passando di qui.
    intraChoG = round(capChoGramsForDuration(intraChoG, totals.durationH));

    const preChoG =
      s.durationMin >= 45 ? round(clamp(weightKg * 0.35, 20, 70)) : round(clamp(weightKg * 0.2, 10, 40));
    const postChoG = round(totals.choG * clamp(0.22 + choEnergyShare * 0.12, 0.2, 0.38));

    const preKcal = round(preChoG * 4, 0);
    const intraKcal = round(intraChoG * 4, 0);
    const postKcal = round(postChoG * 4, 0);

    sessions.push({
      sessionLabel: s.label,
      avgPowerW: s.avgPowerW,
      durationH: totals.durationH,
      choBurnedG: totals.choG,
      fatBurnedG: totals.fatG,
      proBurnedG: totals.proG,
      choEnergyShare: round(choEnergyShare, 2),
      intraChoReplaceFraction: replaceFrac,
      preChoG,
      intraChoG,
      postChoG,
      preKcal,
      intraKcal,
      postKcal,
      evidenceMaxChoGPerH: maxPerH,
      intraChoGPerH: totals.durationH > 0 ? round(capChoGPerHour(intraChoG / totals.durationH)) : 0,
      gutCapacityTier: capacityTier,
    });
  }

  const preChoG = round(sessions.reduce((sum, x) => sum + x.preChoG, 0));
  const intraChoG = round(sessions.reduce((sum, x) => sum + x.intraChoG, 0));
  const postChoG = round(sessions.reduce((sum, x) => sum + x.postChoG, 0));
  const fuelingKcal = Math.round(preChoG * 4 + intraChoG * 4 + postChoG * 4);
  const fatKcalTotal = sessions.reduce((sum, x) => sum + x.fatBurnedG * 9, 0);
  const proKcalTotal = sessions.reduce((sum, x) => sum + x.proBurnedG * 4, 0);
  const choNotOral = sessions.reduce(
    (sum, x) => sum + (x.choBurnedG - x.intraChoG) * 4,
    0,
  );

  return {
    algorithmVersion: "substrate_fueling_v1",
    sessions,
    totals: {
      preChoG,
      intraChoG,
      postChoG,
      fuelingKcal,
      oralTrainingKcal: fuelingKcal,
      endogenousFatKcal: Math.round(fatKcalTotal + proKcalTotal + choNotOral),
    },
    provenance,
  };
}

export type PrescribedIntraFuelingSession = {
  /** Id della seduta di ORIGINE (quello del chiamante), per appaiare i grammi alla riga giusta. */
  id: string;
  label: string;
  durationH: number;
  intraChoG: number;
  intraChoGPerH: number;
};

export type PrescribedIntraFueling = {
  sessions: PrescribedIntraFuelingSession[];
  gutCapacityTier: GutCapacityTier;
  /** Ore delle SOLE sedute su cui il modello ha prescritto: è il denominatore da usare. */
  totalDurationH: number;
  totalIntraChoG: number;
  /** Media pesata sulle ore = il g/h che si LEGGE e che si mangia. */
  intraChoGPerH: number;
};

/**
 * QUELLO CHE SI LEGGE = QUELLO CHE SI MANGIA.
 *
 * Prescrizione intra del modello a substrati (banda di assorbimento per capacità), PER SEDUTA
 * e per il giorno. Sostituisce il g/h "display" del solver V1
 * (`daily-energy-solver.adjustedChoGPerHour`, che alimenta solo testi informativi).
 *
 * Restituisce anche `totalDurationH`: chi mostra dei GRAMMI deve moltiplicare il g/h per
 * QUESTE ore, non per una durata presa da un'altra base (era il difetto: g/h calcolati sulle
 * sedute effettive × ore prese dalle sole pianificate → grammi fuori banda per quella durata).
 *
 * Applica la scala di integrazione performance ESATTAMENTE come
 * `applyPerformanceIntegrationToSubstrateFueling` (per seduta, poi la guardia assoluta).
 * Ritorna `null` quando il modello non è calcolabile (nessuna seduta con durata e potenza):
 * in quel caso il chiamante tiene il valore attuale.
 */
export function resolvePrescribedIntraFueling(input: {
  sessions: Array<{ id?: string | null; label?: string | null; avgPowerW: number; durationMin: number }>;
  ftpW?: number | null;
  weightKg?: number | null;
  fuelingChoScale?: number | null;
}): PrescribedIntraFueling | null {
  const usable = input.sessions
    .map((s, index) => ({ ...s, index }))
    .filter((s) => measuredPositive(s.durationMin) != null && measuredPositive(s.avgPowerW) != null);
  if (usable.length === 0) return null;

  const plan = computeSubstrateFuelingPlan({
    sessions: usable.map((s) => ({
      label: s.label && s.label.trim() !== "" ? s.label : `Sessione ${s.index + 1}`,
      avgPowerW: s.avgPowerW,
      durationMin: s.durationMin,
    })),
    ftpW: input.ftpW,
    weightKg: input.weightKg,
  });

  const scale = measuredPositive(input.fuelingChoScale) ?? 1;
  const sessions: PrescribedIntraFuelingSession[] = plan.sessions.map((s, i) => {
    const src = usable[i]!;
    const intraChoG = round(capChoGramsForDuration(s.intraChoG * scale, s.durationH));
    return {
      id: String(src.id ?? src.index),
      label: s.sessionLabel,
      durationH: s.durationH,
      intraChoG,
      intraChoGPerH: s.durationH > 0 ? round(capChoGPerHour(intraChoG / s.durationH)) : 0,
    };
  });

  const totalDurationH = sessions.reduce((sum, s) => sum + Math.max(0, s.durationH), 0);
  const totalIntraChoG = round(sessions.reduce((sum, s) => sum + s.intraChoG, 0));
  return {
    sessions,
    gutCapacityTier: resolveGutCapacityTier(input.ftpW, input.weightKg),
    totalDurationH: round(totalDurationH, 4),
    totalIntraChoG,
    intraChoGPerH: totalDurationH > 0 ? round(capChoGPerHour(totalIntraChoG / totalDurationH)) : 0,
  };
}

/** g/h prescritti per il giorno (media pesata sulle ore). `null` = modello non calcolabile. */
export function resolvePrescribedIntraChoGPerHour(input: {
  sessions: Array<{ id?: string | null; label?: string | null; avgPowerW: number; durationMin: number }>;
  ftpW?: number | null;
  weightKg?: number | null;
  fuelingChoScale?: number | null;
}): number | null {
  const prescribed = resolvePrescribedIntraFueling(input);
  if (prescribed == null) return null;
  return prescribed.intraChoGPerH > 0 ? prescribed.intraChoGPerH : null;
}
