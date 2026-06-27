/**
 * Kit puro estratto da `TrainingBuilderRichPageView` per decomporre il God-component.
 *
 * Contiene SOLO la regione pura del componente (tipi + costanti + helper, ZERO React/JSX/hook):
 * helper di calcolo TSS/minuti, normalizzazione date calendario, default adattamento per macro,
 * preset one-tap engine, chip Gym, e i tipi/cache di finestra builder. Copiati VERBATIM dal sorgente.
 *
 * NON incluso qui: il sotto-componente React `KpiCard` (resta nel componente padre, che importa
 * `ACCENT_KPI` da questo kit). Il kit NON importa nulla dal componente, per evitare cicli.
 */
import {
  type ExecutedWorkout,
  type PlannedWorkout,
} from "@empathy/domain-training";
import {
  defaultManualPlanBlock,
  type ManualPlanBlock,
} from "@/lib/training/builder/manual-plan-block";
import { SPORT_MACRO_SECTORS, type SportMacroId } from "@/lib/training/builder/sport-macro-palette";
import {
  type AdaptationTarget,
  type GymContractionEmphasis,
  type GymEquipmentChannel,
} from "@/lib/training/engine";
import type { TrainingTwinContextStripViewModel } from "@/api/training/contracts";
import type { ReadSpineCoverageSummary } from "@/lib/platform/read-spine-coverage";

export function initialManualPlanBlocks(): ManualPlanBlock[] {
  return [{ ...defaultManualPlanBlock("steady", "Blocco 1"), minutes: 20, seconds: 0, intensity: "Z2" }];
}

/** Data calendario locale (non UTC): allineata a griglia Calendario e `input type="date"`. */
export function localCalendarDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function normalizeCalendarTargetDay(raw: string): string | null {
  const key = raw.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

export function addCalendarDays(isoDate: string, deltaDays: number): string {
  const key = isoDate.slice(0, 10);
  const base = new Date(`${key}T12:00:00`);
  if (Number.isNaN(base.getTime())) return key;
  base.setDate(base.getDate() + deltaDays);
  return localCalendarDateString(base);
}

/** Finestra fetch KPI: include data target + margine, così sedute lontane restano visibili. */
export function builderPlannedWindowRange(calendarTargetDate: string): { from: string; to: string } {
  const today = localCalendarDateString();
  let from = addCalendarDays(today, -7);
  let to = addCalendarDays(today, 120);
  if (/^\d{4}-\d{2}-\d{2}$/.test(calendarTargetDate)) {
    const lo = addCalendarDays(calendarTargetDate, -14);
    const hi = addCalendarDays(calendarTargetDate, 14);
    if (lo < from) from = lo;
    if (hi > to) to = hi;
  }
  return { from, to };
}

export type WindowErr = { ok: false; error?: string };

export function sumPlannedTss(rows: PlannedWorkout[]): number {
  return rows.reduce((acc, w) => acc + (Number.isFinite(w.tssTarget) ? w.tssTarget : 0), 0);
}

export function sumExecutedTss(rows: ExecutedWorkout[]): number {
  return rows.reduce((acc, w) => acc + (Number.isFinite(w.tss) ? w.tss : 0), 0);
}

export function sumMinutesPlanned(rows: PlannedWorkout[]): number {
  return rows.reduce((acc, w) => acc + (Number.isFinite(w.durationMinutes) ? w.durationMinutes : 0), 0);
}

export function sumMinutesExecuted(rows: ExecutedWorkout[]): number {
  return rows.reduce((acc, w) => acc + (Number.isFinite(w.durationMinutes) ? w.durationMinutes : 0), 0);
}

export const ACCENT_KPI: Record<
  "orange" | "slate",
  {
    border: string;
    bg: string;
    ring: string;
    bar: string;
    value: string;
    iconWrap: string;
    icon: string;
    glow: string;
  }
> = {
  orange: {
    border: "border-orange-500/45",
    bg: "bg-gradient-to-br from-orange-950/50 via-black/40 to-black/50",
    ring: "ring-1 ring-orange-400/25",
    bar: "from-orange-400 via-amber-400 to-orange-600",
    value: "text-orange-50",
    iconWrap:
      "bg-orange-500/40 text-orange-50 border-2 border-orange-300/60 shadow-[0_0_16px_rgba(251,146,60,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]",
    icon: "drop-shadow-[0_0_6px_rgba(255,255,255,0.45)]",
    glow: "shadow-[0_0_24px_rgba(251,146,60,0.12)]",
  },
  slate: {
    border: "border-white/20",
    bg: "bg-gradient-to-br from-black/60 to-black/50",
    ring: "ring-1 ring-white/10",
    bar: "from-gray-500 via-gray-400 to-gray-600",
    value: "text-gray-100",
    iconWrap: "bg-gray-600/50 text-gray-100 border-2 border-gray-400/40 shadow-inner",
    icon: "",
    glow: "",
  },
};

export const ADAPTATION_OPTIONS: { value: AdaptationTarget; label: string }[] = [
  { value: "mitochondrial_density", label: "Densità mitocondriale" },
  { value: "vo2_max_support", label: "Supporto VO₂max" },
  { value: "lactate_tolerance", label: "Tolleranza lattato" },
  { value: "lactate_clearance", label: "Clearance lattato" },
  { value: "max_strength", label: "Forza max (alta tensione)" },
  { value: "hypertrophy_mixed", label: "Massa · ipertrofia integrata" },
  {
    value: "hypertrophy_myofibrillar",
    label: "Fibrillare · alta intensità, volume contenuto (misti / potenza)",
  },
  {
    value: "hypertrophy_sarcoplasmic",
    label: "Sarcoplasmica · sfinimento, alto volume (massa / forza pura)",
  },
  { value: "neuromuscular_adaptation", label: "Neuromuscolare · intento velocità / RFD" },
  { value: "power_output", label: "Potenza esplosiva" },
  { value: "movement_quality", label: "Qualità movimento" },
  { value: "mobility_capacity", label: "Mobilità" },
  { value: "skill_transfer", label: "Transfer skill" },
  { value: "recovery", label: "Recovery" },
];

/** Adattamenti ammessi per macro A–D (coerenti col dominio motore). */
export const ADAPTATION_BY_MACRO: Record<SportMacroId, AdaptationTarget[]> = {
  aerobic: [
    "mitochondrial_density",
    "vo2_max_support",
    "lactate_tolerance",
    "lactate_clearance",
    "recovery",
    "movement_quality",
  ],
  strength: [
    "max_strength",
    "hypertrophy_mixed",
    "hypertrophy_myofibrillar",
    "hypertrophy_sarcoplasmic",
    "neuromuscular_adaptation",
    "power_output",
    "movement_quality",
    "lactate_tolerance",
    "recovery",
  ],
  technical: ["skill_transfer", "movement_quality", "power_output", "lactate_tolerance", "recovery"],
  lifestyle: ["mobility_capacity", "recovery", "movement_quality", "mitochondrial_density"],
};

export function defaultAdaptationForMacro(m: SportMacroId): AdaptationTarget {
  const row = ADAPTATION_BY_MACRO[m];
  return row[0] ?? "mitochondrial_density";
}

export function defaultSessionMinutesForMacro(m: SportMacroId): number {
  if (m === "strength") return 60;
  if (m === "technical") return 75;
  if (m === "lifestyle") return 45;
  return 60;
}

export function sportBelongsToMacro(sportVal: string, macroId: SportMacroId): boolean {
  const sector = SPORT_MACRO_SECTORS.find((x) => x.id === macroId);
  if (!sector) return false;
  const s = sportVal.trim().toLowerCase();
  return sector.sports.some((c) => c.sport.trim().toLowerCase() === s);
}

/** Preset one-tap per Gym / Tecnici: stesso engine, meno campi esposti. */
export type EngineQuickPreset = {
  id: string;
  label: string;
  adaptation: AdaptationTarget;
  minutes: number;
  phase: "base" | "build" | "peak" | "taper";
};

export const ENGINE_QUICK_GYM: EngineQuickPreset[] = [
  { id: "g-max", label: "Forza max · 60′", adaptation: "max_strength", minutes: 60, phase: "base" },
  { id: "g-mass", label: "Massa integrata · 60′", adaptation: "hypertrophy_mixed", minutes: 60, phase: "build" },
  { id: "g-myo", label: "Fibrillare · intenso 45′", adaptation: "hypertrophy_myofibrillar", minutes: 45, phase: "build" },
  { id: "g-sarco", label: "Sarcoplasmica · volume 60′", adaptation: "hypertrophy_sarcoplasmic", minutes: 60, phase: "build" },
  { id: "g-neuro", label: "Neuromuscolare · 45′", adaptation: "neuromuscular_adaptation", minutes: 45, phase: "base" },
  { id: "g-pow", label: "Potenza · 45′", adaptation: "power_output", minutes: 45, phase: "build" },
];

export const GYM_EQUIPMENT_CHIPS: { id: GymEquipmentChannel; label: string }[] = [
  { id: "free_weight", label: "Libero / bilanciere" },
  { id: "bodyweight", label: "Corpo libero" },
  { id: "cable", label: "Cavi" },
  { id: "elastic", label: "Elastici" },
  { id: "machine", label: "Macchinari" },
];

export const GYM_CONTRACTION_CHIPS: { id: GymContractionEmphasis; label: string }[] = [
  { id: "standard", label: "Standard" },
  { id: "eccentric", label: "Eccentrica" },
  { id: "isometric", label: "Isometrica" },
  { id: "plyometric", label: "Pliometrica" },
];

export const ENGINE_QUICK_TECHNICAL: EngineQuickPreset[] = [
  { id: "t-skill", label: "Drill & transfer · 50′", adaptation: "skill_transfer", minutes: 50, phase: "base" },
  { id: "t-tech", label: "Tecnico · 60′", adaptation: "movement_quality", minutes: 60, phase: "build" },
  { id: "t-pace", label: "Ritmo / potenza · 40′", adaptation: "power_output", minutes: 40, phase: "peak" },
  { id: "t-lac", label: "Tolleranza lattato · 55′", adaptation: "lactate_tolerance", minutes: 55, phase: "build" },
  { id: "t-rec", label: "Recovery attivo · 35′", adaptation: "recovery", minutes: 35, phase: "taper" },
];

export const ENGINE_QUICK_LIFESTYLE: EngineQuickPreset[] = [
  { id: "l-mob", label: "Mobilità · 45′", adaptation: "mobility_capacity", minutes: 45, phase: "base" },
  { id: "l-rec", label: "Recovery profondo · 40′", adaptation: "recovery", minutes: 40, phase: "taper" },
  { id: "l-qual", label: "Qualità movimento · 50′", adaptation: "movement_quality", minutes: 50, phase: "base" },
  { id: "l-aero", label: "Aerobico dolce · 55′", adaptation: "mitochondrial_density", minutes: 55, phase: "base" },
];

export type EngineGenerateOverrides = Partial<{
  adaptation: AdaptationTarget;
  sessionMinutes: number;
  phase: "base" | "build" | "peak" | "taper";
}>;

/**
 * Cache cross-mount della finestra calendario builder: ri-atterrando sulla pagina
 * (es. dal calendario al builder e ritorno) i dati compaiono SUBITO, senza spinner
 * né "refresh". Il refetch parte comunque in background (silenzioso) e aggiorna
 * stato + cache, così le sedute appena salvate restano riflesse. La chiave include
 * athleteId + finestra from/to (che dipende dalla data selezionata): non si mostrano
 * mai i dati di un atleta o di una finestra diversa.
 */
export type BuilderWindowCacheEntry = {
  planned: PlannedWorkout[];
  executed: ExecutedWorkout[];
  range: { from: string; to: string } | null;
  readSpineCoverage: ReadSpineCoverageSummary | null;
  twinContextStrip: TrainingTwinContextStripViewModel | null;
  plannedProvenanceSummary: Partial<Record<string, number>> | null;
};
