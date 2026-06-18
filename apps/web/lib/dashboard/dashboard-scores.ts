/**
 * Dashboard "F1" scores — pure composer for the new Empathy athlete dashboard.
 *
 * NO I/O here: the route fetches via the canonical resolvers (twin, recovery-summary,
 * internal-load, EPI, biomarker panels with VALUES, physiological profile) and passes the
 * already-resolved inputs in. This file only normalizes/composes them into the 9-area +
 * readiness + systemStatus + KPI contract. Areas without real data => score:null,
 * status:null, hasData:false, trend:[]. Never invent scores.
 *
 * Reuses existing engines and never re-derives physiology:
 *  - twin scores come from `resolveCanonicalTwinState` (0–100, already normalized)
 *  - recovery/sleep come from `resolveLatestRecoverySummary`
 *  - systemStatus reuses `twin.internalLoadIndex` (existing aggregate, not a new formula)
 *  - longevity reuses `EpiResult.score`; nutrition reuses the EPI "nutrition" pillar
 *  - biomarkers/hormones/microbiome reuse the health-panel readers' axis scoring on REAL
 *    panel values only (demo fallbacks are explicitly bypassed).
 */

import type { CanonicalTwinState } from "@/lib/twin/athlete-state-resolver";
import type { RecoverySummary } from "@/lib/reality/recovery-summary";
import type { EpiResult } from "@/lib/empathy/schemas";
import type { PhysiologicalProfile } from "@empathy/domain-physiology";
import {
  readNum,
  inflammationAxisScore,
  oxidativeRomsScore,
  oxidativeBapScore,
  capPercentDisplay,
  biologicalAgeRingScore,
  hpaAxisScore,
  hpgAxisScore,
  thyroidAxisScore,
  dheaAxisScore,
  igfAxisScore,
} from "@/modules/health/lib/health-panel-readers";

export type DashboardAreaKey =
  | "performance"
  | "recovery"
  | "sleep"
  | "stress"
  | "biomarkers"
  | "hormones"
  | "microbiome"
  | "nutrition"
  | "longevity";

export type DashboardAreaStatus = "ottimale" | "buona" | "attenzione" | "bassa";

export type DashboardArea = {
  key: DashboardAreaKey;
  label: string;
  score: number | null;
  status: DashboardAreaStatus | null;
  /** false per "stress" (livello basso = bene). */
  higherIsBetter: boolean;
  /** Serie cronologica (oldest→newest) fino a ~30 punti. [] se non disponibile. */
  trend: number[];
  hasData: boolean;
};

export type DashboardKpis = {
  weightKg: number | null;
  bodyFatPct: number | null;
  vo2max: number | null;
  ftpWatts: number | null;
  lt1Watts: number | null;
  lt2Watts: number | null;
  vLamax: number | null;
  biologicalAge: number | null;
  targetAge: number | null;
};

export type DashboardScoresPayload = {
  ok: true;
  athleteId: string;
  generatedAt: string;
  readiness: { score: number | null; label: string | null; trend: number[] };
  systemStatus: { pct: number | null; label: string | null; trend: number[] };
  areas: DashboardArea[];
  kpis: DashboardKpis;
};

/** Subset of `biomarker_panels` rows the composer needs (values must be loaded). */
export type BiomarkerPanelInput = {
  type: string | null;
  sample_date: string | null;
  created_at: string | null;
  values: Record<string, unknown> | null;
};

/**
 * Snapshot-derived trends (oldest→newest), one number per stored daily snapshot.
 * Built by the route from `dashboard_daily_scores` (last ~30 rows). Optional and
 * empty-safe: when the table is missing / no snapshot exists, the route omits it
 * and the composer falls back to the device-derived series (recovery/sleep) or [].
 */
export type DashboardSnapshotTrends = {
  readiness?: number[];
  systemStatus?: number[];
  /** Per-area chronological series keyed by area key. */
  areas?: Partial<Record<DashboardAreaKey, number[]>>;
};

export type DashboardScoresInput = {
  athleteId: string;
  generatedAt?: string;
  twin: CanonicalTwinState | null;
  recovery: RecoverySummary | null;
  /** Twin history slice (oldest→newest) for the trend where available. */
  twinHistory7d?: CanonicalTwinState["history"];
  /** Recovery 7d series (oldest→newest), one summary per day where present. */
  recoverySeries7d?: RecoverySummary[];
  /** Internal-load index 7d series (oldest→newest) for systemStatus trend. */
  internalLoadIndexSeries7d?: number[];
  /**
   * 30-day trends reconstructed from `dashboard_daily_scores` snapshots. For
   * recovery/sleep the richer device-derived series is preferred when present;
   * for all other areas (and readiness/systemStatus) the snapshot series is used
   * when the in-memory series is empty. Missing table / no rows => undefined.
   */
  snapshotTrends?: DashboardSnapshotTrends;
  epi: EpiResult | null;
  physiology: PhysiologicalProfile | null;
  /** athlete_profiles.weight_kg / body_fat_pct (when present). */
  profile: { weightKg: number | null; bodyFatPct: number | null } | null;
  /** Chronological age (years, 1 decimal) from athlete_profiles.birth_date; null if missing. */
  targetAge?: number | null;
  /** Latest panel per relevant type (with VALUES), keyed by normalized type. */
  panelsByType: Partial<Record<string, BiomarkerPanelInput>>;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

/** Average of present (finite) values; null if none. */
function avgPresent(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!present.length) return null;
  return present.reduce((sum, v) => sum + v, 0) / present.length;
}

/** Status label from a 0–100 score. For "lower is better" areas the score is inverted first. */
function statusFromScore(score: number | null, higherIsBetter: boolean): DashboardAreaStatus | null {
  if (score == null || !Number.isFinite(score)) return null;
  const effective = higherIsBetter ? score : 100 - score;
  if (effective >= 80) return "ottimale";
  if (effective >= 60) return "buona";
  if (effective >= 40) return "attenzione";
  return "bassa";
}

function readinessLabel(score: number | null): string | null {
  return statusFromScore(score, true);
}

function systemStatusLabel(pct: number | null): string | null {
  return statusFromScore(pct, true);
}

const PANEL_KEY = {
  inflammation: "inflammation",
  oxidative: "oxidative",
  blood: "blood",
  epigenetic: "epigenetics",
  hormones: "hormones",
  microbiota: "microbiota",
} as const;

function panelValues(input: BiomarkerPanelInput | undefined): Record<string, unknown> | null {
  if (!input || !input.values || typeof input.values !== "object") return null;
  return input.values;
}

/**
 * Biomarkers composite: inflammation + oxidative + epigenetic, computed only from REAL
 * values (no demo fallback). Returns null when no relevant marker exists for the athlete.
 */
function computeBiomarkers(panelsByType: DashboardScoresInput["panelsByType"]): number | null {
  // Inflammation markers may live on a dedicated "inflammation" panel or on "blood".
  const inflPanel = panelValues(panelsByType[PANEL_KEY.inflammation]) ?? panelValues(panelsByType[PANEL_KEY.blood]);
  const oxPanel = panelValues(panelsByType[PANEL_KEY.oxidative]);
  const epiPanel = panelValues(panelsByType[PANEL_KEY.epigenetic]);

  const subScores: number[] = [];

  // Inflammation axes (lower marker => higher score). Use a neutral demo placeholder for the
  // axis fn but only feed it when the underlying value is actually present.
  const crp = readNum(inflPanel, ["crp_mg_l", "crp", "pcr", "pcr_us", "hs_crp", "hs-crp", "c_reactive_protein"]);
  const il6 = readNum(inflPanel, ["il6", "il_6", "interleukin_6"]);
  const tnf = readNum(inflPanel, ["tnf_alpha", "tnf", "tnfa"]);
  const hcy = readNum(inflPanel, ["homocysteine", "omocisteina"]);
  const oxLdl = readNum(inflPanel, ["oxidized_ldl", "ldl_ox", "ldl_oxidized", "ox_ldl"]);
  const inflAxes = [
    crp != null ? inflammationAxisScore(crp, 5, 0) : null,
    il6 != null ? inflammationAxisScore(il6, 10, 0) : null,
    tnf != null ? inflammationAxisScore(tnf, 25, 0) : null,
    hcy != null ? inflammationAxisScore(hcy, 20, 0) : null,
    oxLdl != null ? inflammationAxisScore(oxLdl, 80, 0) : null,
  ];
  const inflScore = avgPresent(inflAxes);
  if (inflScore != null) subScores.push(inflScore);

  // Oxidative axes.
  const roms = readNum(oxPanel, ["d_roms", "roms_carr", "roms", "d_rom"]);
  const bap = readNum(oxPanel, ["bap", "bap_umol", "bap_score", "bap_uM"]);
  const gsh = readNum(oxPanel, ["glutathione", "glutatione", "gsh", "glutatione_ridotto"]);
  const sod = readNum(oxPanel, ["sod", "superoxide_dismutase"]);
  const cat = readNum(oxPanel, ["catalase", "catalasi"]);
  const oxAxes = [
    roms != null ? oxidativeRomsScore(roms, 0) : null,
    bap != null ? oxidativeBapScore(bap, 0) : null,
    gsh != null ? capPercentDisplay(gsh, 0) : null,
    sod != null ? capPercentDisplay(sod, 0) : null,
    cat != null ? capPercentDisplay(cat, 0) : null,
  ];
  const oxScore = avgPresent(oxAxes);
  if (oxScore != null) subScores.push(oxScore);

  // Epigenetic / biological-age component.
  const meth = readNum(epiPanel, [
    "methylation_score",
    "metilazione",
    "methylation",
    "metilazione_score",
    "metabolic_methylation_score",
    "inflammation_methylation_index",
  ]);
  const directDelta = readNum(epiPanel, ["biological_age_delta", "epigenetic_age_delta", "eta_bio_vs_crono", "age_delta_years", "gap_anni"]);
  const epiAge = readNum(epiPanel, ["epigenetic_age_years", "biological_age_years", "eta_biologica"]);
  const chronoAge = readNum(epiPanel, ["chronological_age_years", "age_years", "eta_cronologica"]);
  const delta = directDelta ?? (epiAge != null && chronoAge != null ? Number((epiAge - chronoAge).toFixed(2)) : null);
  const epiAxes = [
    meth != null ? capPercentDisplay(meth, 0) : null,
    delta != null ? biologicalAgeRingScore(delta, 0) : null,
  ];
  const epiScore = avgPresent(epiAxes);
  if (epiScore != null) subScores.push(epiScore);

  if (!subScores.length) return null;
  return round1(clamp(avgPresent(subScores) ?? 0, 0, 100));
}

/** Hormones / endocrine balance from a real hormonal panel only. */
function computeHormones(panelsByType: DashboardScoresInput["panelsByType"]): number | null {
  const panel = panelValues(panelsByType[PANEL_KEY.hormones]) ?? panelValues(panelsByType[PANEL_KEY.blood]);
  const am = readNum(panel, [
    "cortisol_am",
    "cortisol_morning",
    "cortisolo_am",
    "cortisolo_mattina",
    "cortisol_ug_dl",
    "cortisol",
    "cortisolo",
  ]);
  const pm = readNum(panel, ["cortisol_pm", "cortisol_evening", "cortisolo_pm", "cortisolo_sera"]);
  const tt = readNum(panel, ["testosterone", "testosterone_total", "testosterone_totale", "testosterone_ng_dl"]);
  const tsh = readNum(panel, ["tsh", "tsh_miu_l"]);
  const dhea = readNum(panel, ["dhea_s", "dhea", "dehydroepiandrosterone", "dhea_s_ug_dl"]);
  const igf = readNum(panel, ["igf1", "igf_1", "igf-1", "insulin_like_growth_factor_1"]);

  const axes = [
    am != null || pm != null ? hpaAxisScore(am, pm, 0) : null,
    tt != null ? hpgAxisScore(tt, 0) : null,
    tsh != null ? thyroidAxisScore(tsh, 0) : null,
    dhea != null ? dheaAxisScore(dhea, 0) : null,
    igf != null ? igfAxisScore(igf, 0) : null,
  ];
  const score = avgPresent(axes);
  if (score == null) return null;
  return round1(clamp(score, 0, 100));
}

/** Microbiome from a real microbiota panel only (phyla + diversity). */
function computeMicrobiome(panelsByType: DashboardScoresInput["panelsByType"]): number | null {
  const panel = panelValues(panelsByType[PANEL_KEY.microbiota]);
  const f = readNum(panel, ["firmicutes_pct", "firmicutes", "firmicutes_phylum", "phylum_firmicutes"]);
  const b = readNum(panel, ["bacteroidetes_pct", "bacteroidetes", "bacteroidetes_phylum", "phylum_bacteroidetes"]);
  const a = readNum(panel, ["actinobacteria_pct", "actinobacteria", "actinobacteria_phylum", "phylum_actinobacteria"]);
  const div = readNum(panel, ["diversity_shannon", "diversity", "alpha_diversity", "shannon", "shannon_index", "diversita_shannon"]);

  // Diversity is the strongest single-axis health proxy; phyla balance contributes when present.
  const divScore = div != null ? clamp((div / 4.5) * 100, 0, 100) : null;
  // Firmicutes/Bacteroidetes balance: closer to ~1:1 is favorable. Only used when both present.
  let ratioScore: number | null = null;
  if (f != null && b != null && b > 0) {
    const ratio = f / b;
    ratioScore = clamp(100 - Math.abs(ratio - 1) * 35, 0, 100);
  }
  const actinoScore = a != null ? clamp(a * 8, 0, 100) : null;
  const score = avgPresent([divScore, ratioScore, actinoScore]);
  if (score == null) return null;
  return round1(clamp(score, 0, 100));
}

/** Biological age (years) from the epigenetic panel if present, else null. */
function biologicalAgeYears(panelsByType: DashboardScoresInput["panelsByType"]): number | null {
  const panel = panelValues(panelsByType[PANEL_KEY.epigenetic]);
  return readNum(panel, ["epigenetic_age_years", "biological_age_years", "eta_biologica"]);
}

/** Performance composite from twin chronic fitness + adaptation (already normalized). */
function computePerformance(twin: CanonicalTwinState | null): { score: number | null; hasData: boolean } {
  if (!twin) return { score: null, hasData: false };
  // adaptationScore is a composite the engine already produced; fitnessChronic is CTL (not 0–100).
  // We require executed load (real training) before claiming a performance score.
  const hasLoad = twin.sources.executedLoad;
  const adaptation = asNum(twin.adaptationScore);
  if (!hasLoad || adaptation == null) return { score: null, hasData: false };
  // Normalize chronic fitness (CTL) into a soft 0–100 contribution (CTL ~100 = high).
  const ctl = asNum(twin.fitnessChronic) ?? 0;
  const ctlNorm = clamp(ctl, 0, 100);
  const score = round1(clamp(adaptation * 0.7 + ctlNorm * 0.3, 0, 100));
  return { score, hasData: true };
}

/** EPI "nutrition" pillar (diary energy adequacy + protein), real-data-only. */
function nutritionFromEpi(epi: EpiResult | null): { score: number | null; hasData: boolean } {
  if (!epi) return { score: null, hasData: false };
  const pillar = epi.pillars.find((p) => p.pillar === "nutrition");
  if (!pillar || !pillar.available || pillar.score == null) return { score: null, hasData: false };
  return { score: round1(clamp(pillar.score, 0, 100)), hasData: true };
}

/**
 * Longevity = EpiResult.score, solo con copertura reale. "minimal" (es. solo baseline
 * demografico dall'età) NON basta: richiediamo almeno "standard"/"extended", altrimenti
 * un utente nuovo vedrebbe un punteggio inventato dall'età anagrafica.
 */
function longevityFromEpi(epi: EpiResult | null): { score: number | null; hasData: boolean } {
  if (
    !epi ||
    !(epi.dataTier === "standard" || epi.dataTier === "extended") ||
    epi.provenance.pillarsAvailable.length === 0
  ) {
    return { score: null, hasData: false };
  }
  return { score: round1(clamp(epi.score, 0, 100)), hasData: true };
}

/** Keep only finite, 1-decimal-rounded numbers from a snapshot series. */
function cleanSnapshotSeries(series: number[] | undefined): number[] {
  if (!series || !series.length) return [];
  return series
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .map((v) => round1(v));
}

/** Build trend for recovery-derived areas from a series of summaries (oldest→newest). */
function recoveryTrend(
  series: RecoverySummary[] | undefined,
  pick: (s: RecoverySummary) => number | null,
): number[] {
  if (!series || !series.length) return [];
  return series
    .map((s) => pick(s))
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .map((v) => round1(v));
}

/** Twin-history trend for a numeric twin field (oldest→newest), filtered to finite values. */
function twinTrend(
  history: CanonicalTwinState["history"] | undefined,
  pick: (snap: NonNullable<CanonicalTwinState["history"]>[number]) => number | null | undefined,
): number[] {
  if (!history || !history.length) return [];
  return history
    .slice(-7)
    .map((snap) => pick(snap))
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .map((v) => round1(v));
}

/**
 * Compose the dashboard payload. Pure: all inputs are pre-fetched by the route.
 */
export function composeDashboardScores(input: DashboardScoresInput): DashboardScoresPayload {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const twin = input.twin;
  const recovery = input.recovery;
  const snapshots = input.snapshotTrends;
  const snapAreas = snapshots?.areas ?? {};

  /**
   * "Sorgente reale": il twin resolver produce SEMPRE valori baseline (readiness
   * default 60, autonomicStrain = 100 − readiness, `sources.internalLoad` hardcoded
   * a true). Per rispettare la regola del dashboard ("aree senza dati reali →
   * nessun punteggio, mai inventare"), readiness / systemStatus / stress / recupero
   * vengono mostrati SOLO quando esiste una sorgente realmente misurata.
   *  - twinRealSignal: c'è almeno un dato reale (allenamento eseguito, recovery da
   *    device, fisiologia o bioenergetica) → readiness e systemStatus sono sensati.
   *  - autonomicRealSignal: c'è un dato autonomico/fisiologico → lo Stress è sensato
   *    (altrimenti deriverebbe solo dal baseline di readiness).
   */
  const twinRealSignal = Boolean(
    twin &&
      (twin.sources.executedLoad ||
        twin.sources.realityRecovery ||
        twin.sources.physiology ||
        twin.sources.bioenergetics),
  );
  const autonomicRealSignal = Boolean(twin && (twin.sources.realityRecovery || twin.sources.physiology));

  // ---- Readiness (reuse existing twin readiness) ----
  const readinessScore = twinRealSignal && twin ? asNum(twin.readiness) : null;
  const readinessTwinTrend = twinTrend(input.twinHistory7d ?? twin?.history, (s) => s.readiness);
  const readinessTrend = readinessTwinTrend.length
    ? readinessTwinTrend
    : cleanSnapshotSeries(snapshots?.readiness);

  // ---- systemStatus (reuse internalLoadIndex aggregate; do NOT invent a new formula) ----
  const systemStatusPct = twinRealSignal && twin ? asNum(twin.internalLoadIndex) : null;
  const systemStatusFromSeries = cleanSnapshotSeries(input.internalLoadIndexSeries7d);
  const systemStatusTrend = systemStatusFromSeries.length
    ? systemStatusFromSeries
    : cleanSnapshotSeries(snapshots?.systemStatus);

  // ---- recovery ----
  // hasData su sorgente reale: recovery da device OPPURE recovery dalla realtà
  // (`sources.realityRecovery`). NON `sources.internalLoad` (hardcoded true → mostrava
  // sempre un baseline). Senza sorgente reale → score null ("in attesa").
  const recoveryHasData =
    recovery?.recoveryScore != null ||
    recovery?.readinessScore != null ||
    (twin?.sources.realityRecovery === true && asNum(twin.recoveryCapacity) != null);
  const recoveryScore = recoveryHasData
    ? asNum(recovery?.recoveryScore ?? null) ??
      asNum(recovery?.readinessScore ?? null) ??
      (twin ? asNum(twin.recoveryCapacity) : null)
    : null;
  // Prefer the richer device-derived series; else snapshot trend; else twin history.
  const recoveryFromSeries = recoveryTrend(input.recoverySeries7d, (s) => s.recoveryScore ?? s.readinessScore);
  const recoveryTrendValues = recoveryFromSeries.length
    ? recoveryFromSeries
    : cleanSnapshotSeries(snapAreas.recovery).length
      ? cleanSnapshotSeries(snapAreas.recovery)
      : twinTrend(input.twinHistory7d ?? twin?.history, (s) => s.recoveryCapacity);

  // ---- sleep ----
  const sleepScore =
    asNum(recovery?.sleepScore ?? null) ?? (twin ? asNum(twin.sleepRecovery) : null);
  const sleepHasData = recovery?.sleepScore != null || (twin ? asNum(twin.sleepRecovery) != null : false);
  // Prefer the richer device-derived series; else snapshot trend; else twin history.
  const sleepFromSeries = recoveryTrend(input.recoverySeries7d, (s) => s.sleepScore);
  const sleepTrendValues = sleepFromSeries.length
    ? sleepFromSeries
    : cleanSnapshotSeries(snapAreas.sleep).length
      ? cleanSnapshotSeries(snapAreas.sleep)
      : twinTrend(input.twinHistory7d ?? twin?.history, (s) => s.sleepRecovery);

  // ---- stress (level, lower = better) ----
  // Composite of autonomic strain + redox stress (+ thermal when present). All twin 0–100.
  const stressComponents = twin
    ? [asNum(twin.autonomicStrain), asNum(twin.redoxStressIndex), asNum(twin.thermalStress)]
    : [];
  const stressLevel = avgPresent(stressComponents);
  // autonomicStrain deriva dal baseline di readiness (sempre presente): senza una
  // sorgente autonomica/fisiologica reale lo Stress resta "in attesa".
  const stressHasData = autonomicRealSignal && stressLevel != null;
  const stressScoreOut = stressHasData ? stressLevel : null;
  const stressTwinTrend = twinTrend(input.twinHistory7d ?? twin?.history, (s) =>
    avgPresent([s.autonomicStrain, s.redoxStressIndex, s.thermalStress]),
  );
  const stressTrendValues = stressTwinTrend.length ? stressTwinTrend : cleanSnapshotSeries(snapAreas.stress);

  // ---- biomarkers / hormones / microbiome (real panel values only) ----
  const biomarkersScore = computeBiomarkers(input.panelsByType);
  const hormonesScore = computeHormones(input.panelsByType);
  const microbiomeScore = computeMicrobiome(input.panelsByType);

  // ---- nutrition / longevity (reuse EPI) ----
  const nutrition = nutritionFromEpi(input.epi);
  const longevity = longevityFromEpi(input.epi);

  // ---- performance ----
  const performance = computePerformance(twin);

  // Performance: prefer twin adaptation history; else snapshot trend.
  const performanceTwinTrend = twinTrend(input.twinHistory7d ?? twin?.history, (s) => s.adaptationScore);
  const performanceTrend = performanceTwinTrend.length
    ? performanceTwinTrend
    : cleanSnapshotSeries(snapAreas.performance);

  const areas: DashboardArea[] = [
    {
      key: "performance",
      label: "Performance",
      score: performance.score,
      higherIsBetter: true,
      hasData: performance.hasData,
      trend: performanceTrend,
      status: statusFromScore(performance.score, true),
    },
    {
      key: "recovery",
      label: "Recupero",
      score: recoveryScore != null ? round1(clamp(recoveryScore, 0, 100)) : null,
      higherIsBetter: true,
      hasData: Boolean(recoveryHasData) && recoveryScore != null,
      trend: recoveryTrendValues,
      status: statusFromScore(recoveryScore, true),
    },
    {
      key: "sleep",
      label: "Sonno",
      score: sleepScore != null ? round1(clamp(sleepScore, 0, 100)) : null,
      higherIsBetter: true,
      hasData: Boolean(sleepHasData) && sleepScore != null,
      trend: sleepTrendValues,
      status: statusFromScore(sleepScore, true),
    },
    {
      key: "stress",
      label: "Stress",
      score: stressScoreOut != null ? round1(clamp(stressScoreOut, 0, 100)) : null,
      higherIsBetter: false,
      hasData: stressHasData,
      trend: stressTrendValues,
      status: statusFromScore(stressScoreOut, false),
    },
    {
      key: "biomarkers",
      label: "Biomarcatori",
      score: biomarkersScore,
      higherIsBetter: true,
      hasData: biomarkersScore != null,
      trend: cleanSnapshotSeries(snapAreas.biomarkers),
      status: statusFromScore(biomarkersScore, true),
    },
    {
      key: "hormones",
      label: "Ormoni",
      score: hormonesScore,
      higherIsBetter: true,
      hasData: hormonesScore != null,
      trend: cleanSnapshotSeries(snapAreas.hormones),
      status: statusFromScore(hormonesScore, true),
    },
    {
      key: "microbiome",
      label: "Microbioma",
      score: microbiomeScore,
      higherIsBetter: true,
      hasData: microbiomeScore != null,
      trend: cleanSnapshotSeries(snapAreas.microbiome),
      status: statusFromScore(microbiomeScore, true),
    },
    {
      key: "nutrition",
      label: "Nutrizione",
      score: nutrition.score,
      higherIsBetter: true,
      hasData: nutrition.hasData,
      trend: cleanSnapshotSeries(snapAreas.nutrition),
      status: statusFromScore(nutrition.score, true),
    },
    {
      key: "longevity",
      label: "Longevità",
      score: longevity.score,
      higherIsBetter: true,
      hasData: longevity.hasData,
      trend: cleanSnapshotSeries(snapAreas.longevity),
      status: statusFromScore(longevity.score, true),
    },
  ];

  const phys = input.physiology;
  const kpis: DashboardKpis = {
    weightKg: input.profile?.weightKg ?? null,
    bodyFatPct: input.profile?.bodyFatPct ?? null,
    vo2max: phys?.vo2maxMlMinKg ?? null,
    ftpWatts: phys?.ftpWatts ?? null,
    lt1Watts: phys?.lt1Watts ?? null,
    lt2Watts: phys?.lt2Watts ?? null,
    vLamax: phys?.vLamax ?? null,
    biologicalAge: biologicalAgeYears(input.panelsByType),
    // Target = età anagrafica (riferimento dell'età biologica), da athlete_profiles.birth_date.
    targetAge: input.targetAge ?? null,
  };

  return {
    ok: true,
    athleteId: input.athleteId,
    generatedAt,
    readiness: {
      score: readinessScore != null ? round1(clamp(readinessScore, 0, 100)) : null,
      label: readinessLabel(readinessScore),
      trend: readinessTrend,
    },
    systemStatus: {
      pct: systemStatusPct != null ? round1(clamp(systemStatusPct, 0, 100)) : null,
      label: systemStatusLabel(systemStatusPct),
      trend: systemStatusTrend,
    },
    areas,
    kpis,
  };
}
