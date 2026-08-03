import type { IntelligentMealPlanItemOut, IntelligentMealPlanSlotOut } from "@/lib/nutrition/intelligent-meal-plan-types";

/** Ripartizione energetica di ripiego per ruolo macro (quando il dettaglio CHO/PRO/FAT manca). */
function macroSplitForRole(role: IntelligentMealPlanItemOut["macroRole"] | undefined): {
  carbsPct: number;
  proteinPct: number;
  fatPct: number;
} {
  switch (role ?? "mixed") {
    case "cho_heavy":
      return { carbsPct: 0.72, proteinPct: 0.14, fatPct: 0.14 };
    case "protein":
      return { carbsPct: 0.25, proteinPct: 0.45, fatPct: 0.3 };
    case "fat":
      return { carbsPct: 0.18, proteinPct: 0.18, fatPct: 0.64 };
    case "veg":
      return { carbsPct: 0.45, proteinPct: 0.2, fatPct: 0.35 };
    default:
      return { carbsPct: 0.5, proteinPct: 0.2, fatPct: 0.3 };
  }
}

/**
 * Macro per voce.
 *
 * Preferenza: `item.nutrients` server (post-finalize), che arriva da cache USDA `nutrition_fdc_foods`
 * con fallback automatico al `CANONICAL_FOOD_TABLE` TS.
 *
 * DIFESA IN PROFONDITÀ (difetto «Pistacchi 6 g · 0 kcal · CHO 0 · PRO 0 · FAT 0»): la sola PRESENZA
 * di `item.nutrients` non basta più a fidarsi. Un payload con tutti i macro a zero è, per un alimento
 * con una porzione reale, un lookup fallito a monte travestito da dato — non un alimento a zero macro.
 * Quindi:
 *  - macro tutti a zero (con o senza kcal) → si stima da kcal + `macroRole`, mai 0/0/0;
 *  - kcal > 0 ma macro tutti a zero (payload PARZIALE) → le kcal reali si TENGONO (sono il dato buono,
 *    tipicamente USDA) e si ripartiscono per ruolo: buttarle e ricadere su `approxKcal` perderebbe
 *    l'informazione migliore che abbiamo;
 *  - `nutrients` assente → comportamento invariato (stima da `approxKcal` + ruolo).
 * Il minimo di 1 kcal garantisce che nessuna voce del piano possa mai mostrarsi a 0 kcal / 0 macro.
 */
export function approxMacrosForPlanItem(item: IntelligentMealPlanItemOut): {
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
} {
  const n = item.nutrients;
  const hasMacroDetail = !!n && n.carbsG + n.proteinG + n.fatG > 0;
  if (n && hasMacroDetail) {
    // kcal mancanti ma macro presenti: le ricostruiamo con Atwater invece di stampare 0.
    const kcal = n.kcal > 0 ? n.kcal : n.carbsG * 4 + n.proteinG * 4 + n.fatG * 9;
    return {
      kcal: Math.round(kcal),
      carbsG: round1(n.carbsG),
      proteinG: round1(n.proteinG),
      fatG: round1(n.fatG),
    };
  }
  const kcal = Math.max(1, Math.round(n && n.kcal > 0 ? n.kcal : item.approxKcal ?? 0));
  const macroSplit = macroSplitForRole(item.macroRole);
  const carbsG = (kcal * macroSplit.carbsPct) / 4;
  const proteinG = (kcal * macroSplit.proteinPct) / 4;
  const fatG = (kcal * macroSplit.fatPct) / 9;
  return {
    kcal,
    carbsG: round1(carbsG),
    proteinG: round1(proteinG),
    fatG: round1(fatG),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * IG dell'item.
 *
 * Preferenza: `item.nutrients.glycemicIndex` quando proviene dalla cache USDA (Wolever-style estimate
 * server-side, salvato in `nutrition_fdc_foods`). È l'unica formula canonica del progetto post-Step 3.
 *
 * Fallback sync: stima locale da macro + bias `macroRole` (path dry / nutrients assenti).
 */
export function estimatedItemGlycemicIndex(item: IntelligentMealPlanItemOut): number {
  if (item.nutrients && item.nutrients.glycemicIndex > 0) {
    return Math.round(item.nutrients.glycemicIndex);
  }
  const { carbsG, proteinG, fatG } = approxMacrosForPlanItem(item);
  const denom = Math.max(1, carbsG * 4 + proteinG * 4 + fatG * 9);
  const carbEnergyPct = (carbsG * 4) / denom;
  let ig = 32 + carbEnergyPct * 52;
  if (item.macroRole === "cho_heavy") ig += 10;
  if (item.macroRole === "veg") ig -= 14;
  if (item.macroRole === "fat") ig -= 6;
  return Math.round(Math.min(92, Math.max(28, ig)));
}

export type GiBand = "low" | "med" | "high" | "vhigh";

export function bandFromGi(ig: number): GiBand {
  if (ig < 35) return "low";
  if (ig < 55) return "med";
  if (ig < 71) return "high";
  return "vhigh";
}

export function giBandLabelIt(band: GiBand): string {
  switch (band) {
    case "low":
      return "BASSO";
    case "med":
      return "MED";
    case "high":
      return "HIGH";
    case "vhigh":
      return "V.HIGH";
    default:
      return "";
  }
}

export function weightedAvgGlycemicIndex(items: Array<{ ig: number; kcal: number }>): number {
  const w = items.reduce((s, i) => s + Math.max(0, i.kcal), 0);
  if (w <= 0) return 50;
  const sum = items.reduce((s, i) => s + i.ig * Math.max(0, i.kcal), 0);
  return Math.round(sum / w);
}

export function parseGramsFromPortion(hint: string | undefined | null): number | undefined {
  if (!hint) return undefined;
  const gm = hint.match(/(\d+(?:[.,]\d+)?)\s*g(?:rammi?)?\b/i);
  if (gm) return Math.round(Number(parseFloat(gm[1].replace(",", "."))));
  const ml = hint.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
  if (ml && /olio|evo|olive\s+oil/i.test(hint)) {
    return Math.round(Number(parseFloat(ml[1].replace(",", "."))) * 0.92);
  }
  return undefined;
}

export function stimulusLabelFromAvgGi(avg: GiBand): { text: string; tone: "alto" | "medio" | "basso" } {
  if (avg === "vhigh" || avg === "high") return { text: "Stimolo ALTO", tone: "alto" };
  if (avg === "med") return { text: "Stimolo MEDIO", tone: "medio" };
  return { text: "Stimolo CONTENUTO", tone: "basso" };
}

/** Stima IG da grammi macro (uso righe «dry» / piano base senza item assembler). */
export function estimatedGlycemicIndexFromMacros(
  carbsG: number,
  proteinG: number,
  fatG: number,
  bias: "cho_heavy" | "balanced" | "protein" | "fat" | "veg" = "balanced",
): number {
  const denom = Math.max(1, carbsG * 4 + proteinG * 4 + fatG * 9);
  const carbEnergyPct = (carbsG * 4) / denom;
  let ig = 32 + carbEnergyPct * 52;
  if (bias === "cho_heavy") ig += 10;
  if (bias === "veg") ig -= 14;
  if (bias === "fat") ig -= 6;
  return Math.round(Math.min(92, Math.max(28, ig)));
}

/**
 * Righe testuali del piano base (pathway): stesse kcal per voce (quota sul totale pasto),
 * ma CHO/PRO/FAT/IG da inferenza canonica sulla stringa (non ripartizione uniforme dei macro).
 */
export function buildExpositionItemsFromDryLines(
  lines: string[],
  totals: { kcal: number; carbsG: number; proteinG: number; fatG: number },
): Array<{
  sourceIndex: number;
  name: string;
  portionHint?: string;
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  ig: number;
  weightG?: number;
}> {
  const trimmed = lines.map((l) => l.trim()).filter(Boolean);
  const n = Math.max(1, trimmed.length);
  const kEach = Math.max(0, totals.kcal) / n;
  return trimmed.map((line, ii) => {
    const kcal = Math.max(1, Math.round(kEach));
    const stub: IntelligentMealPlanItemOut = {
      name: line,
      portionHint: "",
      functionalBridge: "",
      approxKcal: kcal,
      macroRole: "mixed",
    };
    const m = approxMacrosForPlanItem(stub);
    const ig = estimatedItemGlycemicIndex(stub);
    return {
      sourceIndex: ii,
      name: line,
      kcal: m.kcal,
      carbsG: m.carbsG,
      proteinG: m.proteinG,
      fatG: m.fatG,
      ig,
      weightG: parseGramsFromPortion(line),
    };
  });
}

export function sumVisibleSlotMacros(
  slot: IntelligentMealPlanSlotOut,
  isVisible: (idx: number) => boolean,
  fallback: { kcal: number; carbsG: number; proteinG: number; fatG: number },
): { kcal: number; carbsG: number; proteinG: number; fatG: number } {
  let kcal = 0;
  let carbsG = 0;
  let proteinG = 0;
  let fatG = 0;
  for (let i = 0; i < slot.items.length; i++) {
    if (!isVisible(i)) continue;
    const m = approxMacrosForPlanItem(slot.items[i]);
    kcal += m.kcal;
    carbsG += m.carbsG;
    proteinG += m.proteinG;
    fatG += m.fatG;
  }
  if (kcal < 4) return { ...fallback };
  return {
    kcal: Math.round(kcal),
    carbsG: round1(carbsG),
    proteinG: round1(proteinG),
    fatG: round1(fatG),
  };
}
