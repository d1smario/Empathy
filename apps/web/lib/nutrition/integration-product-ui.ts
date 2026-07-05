import type { FuelingFunctionalFocus, FuelingProduct } from "@/lib/nutrition/fueling-product-catalog";

function round(v: number, digits = 0) {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}

/**
 * True solo se l'URL è una vera pagina prodotto (path oltre la radice), non la
 * homepage del brand. Feedback 2026-07: «Scheda produttore» che rimanda alla home
 * è ingannevole — il link va mostrato solo quando porta davvero alla scheda.
 * Si riaccende da solo man mano che si curano i product_url profondi nel catalogo DB.
 */
export function hasProductDatasheetUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "");
    return path.length > 0;
  } catch {
    return false;
  }
}

export const FUELING_FORMAT_IT: Record<FuelingProduct["format"], string> = {
  powder: "Polvere",
  gel: "Gel",
  bar: "Barretta",
  chew: "Chew",
  drink: "Drink",
  capsule: "Capsule",
  tablet: "Compresse",
  gummies: "Gummies",
  sachet: "Bustina",
};

export const FUELING_CATEGORY_IT: Record<FuelingProduct["category"], string> = {
  recovery: "Recovery",
  drink: "Drink",
  gel: "Gel",
  bar: "Bar",
  chew: "Chew",
};

export const FOCUS_IT: Partial<Record<FuelingFunctionalFocus, string>> = {
  carbo: "Carbo",
  electrolyte: "Elettroliti",
  preworkout: "Pre-workout",
  recovery: "Recovery",
  protein: "Proteine",
  eaa: "EAA",
  bcaa: "BCAA",
  caffeine: "Caffeina",
  creatine: "Creatina",
};

export const TIMING_IT: Record<FuelingProduct["timing"][number], string> = {
  pre: "Pre",
  intra: "Intra",
  post: "Post",
  daily: "Giornaliero",
};

/** Colonna primaria per la griglia integrazione (Pre / Intra / Post). */
export type IntegrationTimingBucket = "pre" | "intra" | "post";

/**
 * Bucket per lo «stack per timing» fuso nel Rifornimento (2026-07): «daily»
 * resta colonna propria — creatina/omega/recovery quotidiani sono legittimi
 * anche nei giorni di riposo, schiacciarli su pre/intra/post creava il falso
 * messaggio «prendi integratori da seduta anche a riposo».
 */
export type StackTimingBucket = IntegrationTimingBucket | "daily";

export function stackTimingBucket(product: FuelingProduct): StackTimingBucket {
  if (product.timing.includes("daily")) return "daily";
  return primaryIntegrationTimingBucket(product);
}

export function primaryIntegrationTimingBucket(product: FuelingProduct): IntegrationTimingBucket {
  const { timing, category, functionalFocus } = product;
  if (timing.includes("intra")) return "intra";
  if (timing.includes("post")) return "post";
  if (timing.includes("pre")) return "pre";
  if (timing.includes("daily")) {
    if (
      functionalFocus.includes("recovery") ||
      functionalFocus.includes("creatine") ||
      functionalFocus.includes("protein") ||
      functionalFocus.includes("eaa") ||
      functionalFocus.includes("bcaa") ||
      category === "recovery"
    ) {
      return "post";
    }
    if (functionalFocus.includes("preworkout") || functionalFocus.includes("caffeine")) return "pre";
    if (category === "gel" || functionalFocus.includes("carbo")) return "intra";
    return "post";
  }
  if (category === "gel") return "intra";
  if (category === "recovery") return "post";
  if (functionalFocus.includes("recovery") || functionalFocus.includes("creatine")) return "post";
  if (functionalFocus.includes("preworkout") || functionalFocus.includes("caffeine")) return "pre";
  return "intra";
}

export type IntegrationQuantityContext = {
  choGHour: number;
  energyAdequacyRatio: number | null | undefined;
  proteinBiasPctPoints: number;
  fuelingChoScale: number;
};

export function buildIntegrationQuantityHint(product: FuelingProduct, ctx: IntegrationQuantityContext): string {
  const lines: string[] = [];
  const choH = ctx.choGHour;
  const gPer = product.carbohydrateGPerServing;

  if (product.functionalFocus.includes("recovery") || product.functionalFocus.includes("protein")) {
    lines.push("Post-seduta: 1 porzione entro ~60 min, in aggiunta al pasto (recovery).");
  }
  if (product.timing.includes("pre") && (product.functionalFocus.includes("preworkout") || product.functionalFocus.includes("caffeine"))) {
    lines.push("Pre: dose singola 20–45 min prima; valutare tolleranza individuale alla caffeina.");
  }
  // Testi in linguaggio umano (feedback 2026-07): mai gergo motore
  // («target intra solver», «scala fueling ×1.00», «leve») nelle card prodotto.
  if (gPer != null && gPer > 0 && (product.timing.includes("intra") || product.timing.includes("pre")) && choH > 3) {
    const porzH = Math.max(0.25, choH / gPer);
    lines.push(
      `≈${round(porzH, 1)} porzioni/h per coprire ~${round(choH, 0)} g/h di CHO (1 porzione = ${gPer} g).`,
    );
  } else if (gPer != null && gPer > 0) {
    lines.push(`1 porzione ≈ ${gPer} g di CHO.`);
  }
  if (ctx.energyAdequacyRatio != null && ctx.energyAdequacyRatio < 0.88) {
    lines.push("Oggi hai mangiato sotto il target: non tagliare il recovery, abbinalo al pasto principale.");
  }
  if (ctx.proteinBiasPctPoints >= 2 && (product.functionalFocus.includes("protein") || product.functionalFocus.includes("eaa"))) {
    lines.push("Giornata a maggior fabbisogno proteico: prendi il recovery insieme al pasto.");
  }
  if (!lines.length) {
    lines.push("Quantità: segui l'etichetta del prodotto e le indicazioni dello staff.");
  }
  return lines.slice(0, 2).join(" ");
}
