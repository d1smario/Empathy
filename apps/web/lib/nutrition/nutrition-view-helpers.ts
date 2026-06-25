/**
 * Helper di presentazione/util puri estratti da NutritionPageView (fetta 1 della
 * decomposizione del God-component da 5k righe): funzioni pure, testabili,
 * nessuna dipendenza React/contratti. I due class-helper accettano `string`
 * (i chiamatori passano l'union FunctionalMealSelectorViewModel — assegnabile;
 * comportamento invariato).
 */

import { CHART_AXIS, CHART_MODULE_ACCENT, CHART_SIGNAL, chartHexToRgba } from "@/lib/ui/chart-theme";

export const SPORTS = ["Running", "Ciclismo", "Nuoto", "XC Ski", "Triathlon", "Canoa", "MTB"];

/** Voce unica nel gate fueling quando manca la seduta pianificata quel giorno (solo piano, non eseguito retroattivo). */
export const FUELING_MISSING_DAY_TRAINING = "seduta pianificata nel calendario per il giorno scelto";

export const BRAND_ALIASES: Array<{ label: string; aliases: string[] }> = [
  { label: "Enervit", aliases: ["enervit"] },
  { label: "Maurten", aliases: ["maurten"] },
  { label: "SiS", aliases: ["sis", "science in sport", "scienceinsport"] },
  { label: "+Watt", aliases: ["+watt", "watt", "plus watt"] },
  { label: "Powerbar", aliases: ["powerbar", "power bar"] },
];

/** Palette grafico fueling / glicogeno — valori convergenti su lib/ui/chart-theme.ts (Grammatica §12). */
export const FUELING_CHART_THEME_PRO2 = {
  areaTop: CHART_SIGNAL.cho,
  areaBottom: CHART_SIGNAL.cho,
  line: CHART_SIGNAL.cho,
  dot: CHART_MODULE_ACCENT.nutrition,
  text: CHART_AXIS.tick,
  axis: CHART_AXIS.line,
  zoneGreen: chartHexToRgba(CHART_SIGNAL.hrv, 0.2),
  zoneYellow: chartHexToRgba(CHART_MODULE_ACCENT.nutrition, 0.2),
  zoneRed: chartHexToRgba("#fb7185", 0.18),
} as const;

export function parseFuelingMinuteOffset(timeLabel: string): number {
  const match = timeLabel.match(/([+-]?\d+)/);
  return match ? Number(match[1]) : 0;
}

export function n(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const x = Number(v);
    return Number.isFinite(x) ? x : fallback;
  }
  return fallback;
}

export function hasPositiveNumber(v: unknown): boolean {
  return n(v, 0) > 0;
}

export function record(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** `meal_count_mode` nel diet week → `meal_strategy` usato in Nutrizione. */
export function mapMealCountModeToMealStrategy(mode: unknown): string | null {
  const m = String(mode ?? "").trim();
  if (!m || m === "4") return null;
  if (m === "1") return "1-meal";
  if (m === "2") return "2-meals";
  if (m === "3") return "3-meals";
  if (m === "5") return "5-meals";
  if (m === "6") return "6-meals";
  if (m === "fasting" || m.startsWith("semi-")) return m;
  return null;
}

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function round(v: number, digits = 0) {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}

export function fuelingPhaseColor(phase: string): string {
  const p = phase.toLowerCase();
  if (p.includes("pre")) return "#e879f9";
  if (p.includes("post")) return "#4ade80";
  return "#fb923c";
}

export function portionHintForMealKcal(mealKcal: number, refKcal = 750): string {
  if (!Number.isFinite(mealKcal) || mealKcal <= 0) return "";
  const f = mealKcal / refKcal;
  if (f > 1.12) return "Porzioni orientate al surplus kcal del giorno.";
  if (f < 0.88) return "Porzioni orientate a giornata più leggera.";
  return "Allinea porzioni al target kcal del pasto.";
}

export function nutritionToneForLabel(label: string): "amber" | "cyan" | "green" | "rose" | "slate" {
  const normalized = label.toLowerCase();
  if (normalized.includes("cho") || normalized.includes("glycogen") || normalized.includes("tier")) return "amber";
  if (normalized.includes("fluid") || normalized.includes("hydration") || normalized.includes("power")) return "cyan";
  if (normalized.includes("score") || normalized.includes("coverage") || normalized.includes("protein")) return "green";
  if (normalized.includes("risk") || normalized.includes("esaur") || normalized.includes("redox")) return "rose";
  return "slate";
}

/** Vie metaboliche — colori fase (allineati palette Pro 2). */
export function pathwayOperationalPhaseRowClass(phase: string): string {
  switch (phase) {
    case "pre_acute":
      return "border-l-4 border-l-violet-400 bg-violet-500/10 pl-3 py-2 rounded-r-md border-y border-r border-white/10";
    case "peri_workout":
      return "border-l-4 border-l-fuchsia-400 bg-fuchsia-500/10 pl-3 py-2 rounded-r-md border-y border-r border-white/10";
    case "early_recovery":
      return "border-l-4 border-l-orange-400 bg-orange-500/[0.12] pl-3 py-2 rounded-r-md border-y border-r border-white/10";
    case "late_recovery":
      return "border-l-4 border-l-sky-400 bg-sky-500/10 pl-3 py-2 rounded-r-md border-y border-r border-white/10";
    default:
      return "border-l-4 border-l-gray-500 bg-white/[0.04] pl-3 py-2 rounded-r-md border-y border-r border-white/10";
  }
}

export const FUNCTIONAL_EXAMPLE_CELL_CLASSES = [
  "rounded-xl border border-fuchsia-500/35 bg-fuchsia-500/10 px-3 py-2.5",
  "rounded-xl border border-violet-500/35 bg-violet-500/10 px-3 py-2.5",
  "rounded-xl border border-orange-500/35 bg-orange-500/[0.11] px-3 py-2.5",
] as const;

export function metabolicPhaseSlotCardClass(phase: string): string {
  switch (phase) {
    case "pre_load":
      return "border-violet-400/45 bg-gradient-to-br from-violet-500/[0.14] to-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
    case "during_load":
      return "border-fuchsia-400/45 bg-gradient-to-br from-fuchsia-500/[0.14] to-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
    case "early_recovery":
      return "border-orange-400/45 bg-gradient-to-br from-orange-500/[0.14] to-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
    case "late_recovery":
      return "border-sky-400/45 bg-gradient-to-br from-sky-500/[0.12] to-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
    default:
      return "border-white/15 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";
  }
}

export function functionalCandidateRowClass(timing: string): string {
  switch (timing) {
    case "pre":
      return "border-l-[3px] border-l-violet-400 bg-violet-500/[0.07]";
    case "peri":
      return "border-l-[3px] border-l-fuchsia-400 bg-fuchsia-500/[0.07]";
    case "early_recovery":
      return "border-l-[3px] border-l-orange-400 bg-orange-500/[0.09]";
    case "late_recovery":
      return "border-l-[3px] border-l-sky-400 bg-sky-500/[0.07]";
    default:
      return "border-l-[3px] border-l-gray-500 bg-white/[0.03]";
  }
}
