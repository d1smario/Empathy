/**
 * TEMA GRAFICI EMPATHY — Fase 3 (Grammatica Visiva v1).
 *
 * Costanti di stile condivise per TUTTI i grafici dell'app autenticata
 * (Recharts, SVG custom, bar-chart in CSS). Zero dipendenze runtime:
 * solo costanti `as const` e funzioni pure. Nessun side effect.
 *
 * REGOLE D'USO (solo sostituzione di letterali, mai cambi strutturali):
 * - Griglia:      <CartesianGrid stroke={CHART_GRID.stroke} strokeDasharray={CHART_GRID.strokeDasharray} vertical={false} />
 * - Assi:         <XAxis tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} />
 * - Tooltip:      <Tooltip contentStyle={chartTooltipStyle("training")} />
 * - Serie:        colore canonico per segnale fisiologico → CHART_SIGNAL.hr, CHART_SIGNAL.power, ...
 *                 serie generiche/cicliche → chartSeriesForModule("physiology")[i] (prima traccia = accento modulo)
 * - Bar CSS/SVG:  riusare gli stessi hex (CHART_SIGNAL / CHART_MODULE_ACCENT) al posto dei valori inline.
 *
 * Gli hex degli accenti modulo sono i Tailwind `-400` corrispondenti a
 * `moduleEyebrowClass()` in `core/navigation/module-ui-accent.ts`: il bordo
 * tooltip e la prima serie "risuonano" con l'eyebrow del modulo.
 */

import type { CSSProperties } from "react";
import type { ProductModuleId } from "@empathy/contracts";

/** Dimensioni font canoniche (px) per tick, label assi, legenda e tooltip. */
export const CHART_FONT = {
  tick: 10,
  axisLabel: 11,
  legend: 11,
  tooltip: 12,
} as const;

/** Griglia cartesiana unica per tutti i chart (tema scuro). */
export const CHART_GRID = {
  stroke: "rgba(255,255,255,0.08)",
  strokeDasharray: "3 3",
} as const;

/** Assi: linea quasi invisibile, tick gray-400 (token --empathy-text-muted), muted gray-500. */
export const CHART_AXIS = {
  line: "rgba(255,255,255,0.12)",
  tick: "#9ca3af",
  tickMuted: "#6b7280",
  label: "#9ca3af",
} as const;

/** Spessori traccia canonici. */
export const CHART_STROKE = {
  thin: 1.6,
  base: 2,
  bold: 2.4,
} as const;

/** Superficie tooltip unica (sfondo near-black, testo gray-200, radius 12 = rounded-xl). */
export const CHART_TOOLTIP = {
  background: "rgba(9,9,12,0.95)",
  border: "rgba(255,255,255,0.12)",
  borderRadius: 12,
  text: "#e5e7eb",
} as const;

/**
 * Accento per modulo (hex = Tailwind `-400`, stessa mappa di moduleEyebrowClass).
 * Record esaustivo su ProductModuleId: se nasce un modulo nuovo, TypeScript segnala qui.
 */
export const CHART_MODULE_ACCENT: Record<ProductModuleId, string> = {
  dashboard: "#22d3ee", // cyan-400
  calendario: "#38bdf8", // sky-400
  athletes: "#a78bfa", // violet-400
  commissioni: "#fbbf24", // amber-400
  profile: "#e879f9", // fuchsia-400
  health: "#fb7185", // rose-400
  physiology: "#34d399", // emerald-400
  training: "#fb923c", // orange-400
  nutrition: "#fbbf24", // amber-400
  bioenergetics: "#a3e635", // lime-400
  biomechanics: "#2dd4bf", // teal-400
  aerodynamics: "#38bdf8", // sky-400
  longevity: "#e879f9", // fuchsia-400
  settings: "#a1a1aa", // zinc-400
};

/**
 * Colore canonico per segnale fisiologico: UN solo hex per segnale, identico
 * in ogni modulo (unifica SERIES_COLOR, STROKE_BY_CHANNEL_ID, strokeFor, ...).
 */
export const CHART_SIGNAL = {
  power: "#fb923c", // orange-400 — potenza/lavoro meccanico
  hr: "#f87171", // red-400 — frequenza cardiaca
  hrv: "#34d399", // emerald-400 — variabilità FC
  speed: "#22d3ee", // cyan-400 — velocità/pace
  cadence: "#a78bfa", // violet-400 — cadenza
  altitude: "#94a3b8", // slate-400 — quota (neutro topografico)
  glucose: "#e879f9", // fuchsia-400 — glicemia
  lactate: "#c084fc", // purple-400 — lattato
  fat: "#38bdf8", // sky-400 — ossidazione grassi
  cho: "#fb923c", // orange-400 — carboidrati (stessa famiglia di power)
  sleep: "#7dd3fc", // sky-300 — sonno
  load: "#f472b6", // pink-400 — carico/CTL
} as const;

export type ChartSignalId = keyof typeof CHART_SIGNAL;

/**
 * Ciclo serie deterministico per grafici multi-traccia senza semantica di
 * segnale (es. confronto canali arbitrari). 8 tinte distinte su fondo scuro.
 */
export const CHART_SERIES = [
  "#fb923c", // orange-400
  "#22d3ee", // cyan-400
  "#a78bfa", // violet-400
  "#34d399", // emerald-400
  "#f472b6", // pink-400
  "#60a5fa", // blue-400
  "#fbbf24", // amber-400
  "#fb7185", // rose-400
] as const;

/** Converte un hex `#rrggbb` in `rgba(...)` con alpha dato (per bordi/aloni tinti). */
export function chartHexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Palette serie per modulo: la prima traccia è l'accento del modulo, poi il
 * ciclo CHART_SERIES (senza duplicare l'accento). Uso: `chartSeriesForModule("health")[i % 8]`.
 */
export function chartSeriesForModule(module: ProductModuleId): readonly string[] {
  const accent = CHART_MODULE_ACCENT[module];
  return [accent, ...CHART_SERIES.filter((hex) => hex !== accent)];
}

/**
 * `contentStyle` canonico per i Tooltip Recharts (o stile tooltip SVG custom).
 * Con `module` il bordo è tinto sull'accento del modulo (alpha 0.35), come
 * l'eyebrow di pagina; senza, bordo neutro white/12.
 */
export function chartTooltipStyle(module?: ProductModuleId): CSSProperties {
  const accent = module ? CHART_MODULE_ACCENT[module] : undefined;
  return {
    backgroundColor: CHART_TOOLTIP.background,
    border: `1px solid ${accent ? chartHexToRgba(accent, 0.35) : CHART_TOOLTIP.border}`,
    borderRadius: CHART_TOOLTIP.borderRadius,
    color: CHART_TOOLTIP.text,
    fontSize: CHART_FONT.tooltip,
  };
}
