/**
 * Kit del Metabolic Lab: tipi, costanti e helper puri estratti da PhysiologyPageView
 * (fetta 2 della decomposizione del God-component). Nessun React qui — logica pura,
 * testabile e riusabile dai sotto-componenti che verranno estratti nelle fette
 * successive.
 */
import type { SupportedSport } from "@/lib/engines/vo2-estimator";

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export type CpPoint = { label: string; sec: number };
export type LabSection = "metabolic_profile" | "lactate_analysis" | "max_oxidate";
export type LabRun = {
  id: string;
  section: LabSection;
  model_version: string;
  created_at: string;
  input_payload?: Record<string, unknown> | null;
  output_payload: Record<string, unknown> | null;
};

export function labHistorySectionTitle(section: LabSection): string {
  if (section === "metabolic_profile") return "Metabolic profile";
  if (section === "lactate_analysis") return "Lactate analysis";
  return "Oxidative capacity";
}

export type WorkoutSample = {
  id: string;
  date: string;
  duration_min: number;
  tss: number;
  sport: string;
  power_w: number | null;
  velocity_m_min: number | null;
  grade_pct: number | null;
  elevation_gain_m: number | null;
  core_temp_c: number | null;
  skin_temp_c: number | null;
  rer: number | null;
  vo2_l_min: number | null;
  vco2_l_min: number | null;
  smo2: number | null;
  lactate_mmol_l: number | null;
  glucose_mmol_l: number | null;
};

export type SportSpecificPanelVm = {
  key: SupportedSport;
  title: string;
  sessionCount: number;
  avgDurationMin: number | null;
  avgTss: number | null;
  avgPowerW: number | null;
  avgVelocityMMin: number | null;
  avgRer: number | null;
  avgVo2LMin: number | null;
  vo2EstimateMlKgMin: number | null;
  lastDate: string | null;
};

export type PubmedItem = {
  source: "pubmed";
  pmid: string;
  title: string;
  journal: string | null;
  pub_date: string | null;
  authors: string[];
  url: string;
};

export const CP_POINTS: CpPoint[] = [
  { label: "5s", sec: 5 },
  { label: "15s", sec: 15 },
  { label: "30s", sec: 30 },
  { label: "60s", sec: 60 },
  { label: "3m", sec: 180 },
  { label: "5m", sec: 300 },
  { label: "12m", sec: 720 },
  { label: "20m", sec: 1200 },
];

export function initialEmptyCpInputs(): Record<string, string> {
  return Object.fromEntries(CP_POINTS.map((p) => [p.label, ""]));
}

/** Campi vuoti per atleta: si compilano a mano o da import sessione (nessun demo pre-fill). */
export const LACTATE_DEFAULT_INPUT: Record<string, string> = {
  duration_min: "",
  power_w: "",
  ftp_w: "",
  body_mass_kg: "",
  velocity_m_min: "",
  grade_pct: "",
  efficiency: "",
  vo2_l_min: "",
  vco2_l_min: "",
  rer: "",
  smo2_rest: "",
  smo2_work: "",
  lactate_oxidation_pct: "",
  cori_pct: "",
  cho_ingested_g_h: "",
  gut_absorption_pct: "",
  microbiota_sequestration_pct: "",
  gut_training_pct: "",
  core_temp_c: "",
  glucose_mmol_l: "",
  candida_overgrowth_pct: "",
  bifidobacteria_pct: "",
  akkermansia_pct: "",
  butyrate_producers_pct: "",
  endotoxin_risk_pct: "",
};

export const MAXOX_DEFAULT_INPUT: Record<string, string> = {
  vo2_l_min: "",
  body_mass_kg: "",
  /** Durata finestra test (min): allinea il split CP (P_oss) in Metabolic profile. */
  duration_min: "60",
  power_w: "",
  velocity_m_min: "",
  grade_pct: "",
  ftp_w: "",
  efficiency: "",
  rer: "",
  smo2_rest_pct: "",
  smo2_work_pct: "",
  lactate_mmol_l: "",
  lactate_trend_mmol_h: "",
  core_temp_c: "",
  hemoglobin_g_dl: "",
  sao2_pct: "",
};

/** Campi stringa lab ripristinabili da `input_payload` snapshot. */
export function patchLabStringsFromPayload(
  payload: Record<string, unknown>,
  allowedKeys: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of allowedKeys) {
    const raw = payload[k];
    if (raw == null || raw === "") continue;
    const s = typeof raw === "number" && Number.isFinite(raw) ? String(raw) : String(raw).trim();
    if (s !== "") out[k] = s;
  }
  return out;
}

export type SourceTag = "auto" | "manual" | "default" | "mixed";
export type PrecedenceSource = "measured" | "manual" | "preset" | "default";
export type Vo2InputMode = "device" | "test";
export type RerInputMode = "auto" | "manual";
export type MicrobiotaSourceMode = "health_bio" | "preset" | "manual";
export type DysbiosisPreset = "eubiosi" | "lieve" | "moderata" | "severa" | "grave";

export type ProCheckRow = {
  key: string;
  label: string;
  valueText: string;
  source: SourceTag;
  inRange: boolean;
  evidenceReady: boolean;
  aligned: boolean;
  rangeText: string;
};

export function reliabilityBadge(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "High reliability", color: "#00e08d" };
  if (score >= 70) return { label: "Medium reliability", color: "#ffd60a" };
  return { label: "Low reliability", color: "#ff5d5d" };
}

export function parseNum(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function toSupportedSport(sportRaw: string | null | undefined): SupportedSport {
  const sport = (sportRaw ?? "").toLowerCase();
  if (sport.includes("run")) return "running";
  if (sport.includes("swim")) return "swimming";
  if (sport.includes("ski")) return "xc_ski";
  return "cycling";
}

export function sportLabelIt(sport: SupportedSport): string {
  if (sport === "running") return "Corsa";
  if (sport === "swimming") return "Nuoto";
  if (sport === "xc_ski") return "Sci nordico";
  return "Bici";
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function estimateRerFromFtpIntensity(intensityPctFtp: number, fatOxAdaptation: number) {
  const i = clamp(intensityPctFtp, 40, 130);
  const points = [
    { x: 40, y: 0.76 },
    { x: 55, y: 0.8 },
    { x: 70, y: 0.86 },
    { x: 80, y: 0.9 },
    { x: 90, y: 0.93 },
    { x: 100, y: 0.95 },
    { x: 108, y: 1.0 },
    { x: 120, y: 1.03 },
    { x: 130, y: 1.05 },
  ];
  let base = 0.9;
  for (let idx = 0; idx < points.length - 1; idx += 1) {
    const left = points[idx];
    const right = points[idx + 1];
    if (i >= left.x && i <= right.x) {
      const t = (i - left.x) / (right.x - left.x);
      base = lerp(left.y, right.y, t);
      break;
    }
  }
  // Below threshold, better fat adaptation shifts RER downward.
  const belowThresholdFactor = clamp((95 - i) / 35, 0, 1);
  const adaptationShift = (0.5 - clamp(fatOxAdaptation, 0, 1)) * 0.08 * belowThresholdFactor;
  return clamp(base + adaptationShift, 0.72, 1.05);
}

export function sourceFromInputs(
  keys: string[],
  current: Record<string, string>,
  autoBase: Record<string, number> | null,
  defaults: Record<string, string>,
): SourceTag {
  const tags = keys.map((key) => {
    const currentNum = parseNum(current[key] ?? "");
    if (currentNum == null) return "default" as const;
    const autoNum = autoBase?.[key];
    if (autoNum != null) {
      const tol = Math.max(0.5, Math.abs(autoNum) * 0.02);
      if (Math.abs(currentNum - autoNum) <= tol) return "auto" as const;
      return "manual" as const;
    }
    const defNum = parseNum(defaults[key] ?? "");
    if (defNum != null && Math.abs(currentNum - defNum) <= Math.max(0.5, Math.abs(defNum) * 0.02)) return "default" as const;
    return "manual" as const;
  });

  const uniq = Array.from(new Set(tags));
  if (uniq.length === 1) return uniq[0];
  return "mixed";
}

export const MICROBIOTA_FIELDS = new Set([
  "candida_overgrowth_pct",
  "bifidobacteria_pct",
  "akkermansia_pct",
  "butyrate_producers_pct",
  "endotoxin_risk_pct",
]);

export function resolveInputByPrecedence(params: {
  key: string;
  current: Record<string, string>;
  autoBase: Record<string, number> | null;
  defaults: Record<string, string>;
  presetMode: boolean;
  allowManualOverride?: boolean;
}): { value: number; source: PrecedenceSource } {
  const { key, current, autoBase, defaults, presetMode, allowManualOverride } = params;
  const currentNum = parseNum(current[key] ?? "");
  const autoNumRaw = autoBase?.[key];
  const autoNum = typeof autoNumRaw === "number" && Number.isFinite(autoNumRaw) ? autoNumRaw : null;
  const defaultNum = parseNum(defaults[key] ?? "");
  const currentSource: PrecedenceSource =
    presetMode && MICROBIOTA_FIELDS.has(key) ? "preset" : "manual";

  // Rule: real measured data has precedence.
  // Exception: explicit manual override modes (e.g., VO2 test) can override measured values.
  if (allowManualOverride && currentNum != null) return { value: currentNum, source: currentSource };
  if (autoNum != null) return { value: autoNum, source: "measured" };
  if (currentNum != null) return { value: currentNum, source: currentSource };
  if (defaultNum != null) return { value: defaultNum, source: "default" };
  return { value: 0, source: "default" };
}

export function estimateUncertaintyPct(sources: PrecedenceSource[]) {
  const total = Math.max(1, sources.length);
  const measured = sources.filter((s) => s === "measured").length / total;
  const manual = sources.filter((s) => s === "manual").length / total;
  const preset = sources.filter((s) => s === "preset").length / total;
  const defaults = sources.filter((s) => s === "default").length / total;
  const pct = 6 + manual * 6 + preset * 12 + defaults * 22 + (1 - measured) * 6;
  return Math.round(clamp(pct, 5, 40));
}
