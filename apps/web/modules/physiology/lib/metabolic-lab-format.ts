/**
 * Helper di presentazione puri del Metabolic Lab (mappatura colori/etichette).
 * Estratti da PhysiologyPageView (fetta 1 della decomposizione del God-component):
 * funzioni pure, testabili, riusabili dai sotto-componenti che verranno estratti.
 */

export function zoneColorFromName(name: string): string {
  if (name.startsWith("Z1")) return "#00c2ff";
  if (name.startsWith("Z2")) return "#00e08d";
  if (name.startsWith("Z3")) return "#b6ff35";
  if (name.startsWith("Z4")) return "#ffd60a";
  if (name.startsWith("Z5")) return "#ff9e00";
  return "#9ca3af";
}

export function maxOxStateColor(state: string): string {
  const lower = state.toLowerCase();
  if (lower.includes("critical") || lower.includes("severe")) return "#ff5d5d";
  if (lower.includes("limited") || lower.includes("warning")) return "#ffd60a";
  return "#00e08d";
}

export function choGapColor(gap: number): string {
  if (gap > 25) return "#ff5d5d";
  if (gap > 10) return "#ffd60a";
  return "#00e08d";
}

export function bottleneckColor(index: number): string {
  if (index >= 0.75) return "#ff5d5d";
  if (index >= 0.55) return "#ffd60a";
  return "#00e08d";
}

export function maxOxBottleneckLabel(kind: string): string {
  if (kind === "central_delivery") return "Central O2 delivery";
  if (kind === "peripheral_utilization") return "Peripheral/mitochondrial utilization";
  if (kind === "glycolytic_pressure") return "Glycolytic pressure";
  if (kind === "oxidative_ceiling") return "Aerobic ceiling (CP / capacity)";
  return "Balanced";
}
