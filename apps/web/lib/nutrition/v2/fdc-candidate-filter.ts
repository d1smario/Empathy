import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import {
  type AllergenClassToken,
  normalizeAllergenClassList,
} from "@/lib/nutrition/meal-plan-profile-food-filter";

/** Descrizioni SR Legacy / artefatti / junk food da escludere dal composer V2. */
const DESCRIPTION_DENYLIST = [
  /^beverage$/i,
  /^beverages$/i,
  /^snacks?,?\s/i,
  /butter replacement/i,
  /meal replacement/i,
  /infant formula/i,
  /babyfood/i,
  /walrus/i,
  /alaska native/i,
  /navajo/i,
  /graham cracker.*crust/i,
  /pie crust.*cookie/i,
  /restaurant,\s*chinese/i,
  /gelatins,\s*dry powder/i,
  /french fries/i,
  /potato chips/i,
  /tortilla chips/i,
  /onion rings/i,
  /corn dog/i,
  /fast foods/i,
  /kraft foods/i,
  /general mills/i,
  /granola bar/i,
  /fruit leather/i,
  /candy bar/i,
  /ice cream/i,
  /cupcake/i,
  /doughnut/i,
  /rice cake/i,
  /\bcrackers?\b/i,
  /mini rice cakes/i,
  /^candies/i,
  /^candy,/i,
];

export function isDeniedFdcDescription(description: string, denyFragments: string[]): boolean {
  const d = description.toLowerCase();
  for (const frag of denyFragments) {
    if (frag && d.includes(frag.toLowerCase())) return true;
  }
  for (const re of DESCRIPTION_DENYLIST) {
    if (re.test(description)) return true;
  }
  return false;
}

// ── Filtro ALLERGENI per classi (fail-closed) ────────────────────────────────────────
// Il filtro storico per sottostringhe decide sulla DESCRIZIONE: chi non viene riconosciuto
// passa ("Pinoli" e "Latticello" non contengono nessuno dei frammenti generati da
// "Noci, nocciole" / "Lattosio"). Qui la decisione passa alle CLASSI dichiarate sul cibo
// (`nutrition_menu_foods.allergen_classes` + `allergens_reviewed`) e fallisce in CHIUSURA:
// un cibo che nessuno ha ancora esaminato non si serve a chi ha dichiarato un'allergia.

/** Classi dichiarate su un alimento + se qualcuno le ha davvero esaminate. */
export type AllergenFoodInfo = {
  /** Token del vocabolario chiuso (già normalizzati). Vuoto = nessuna classe dichiarata. */
  classes: readonly AllergenClassToken[];
  /** `allergens_reviewed`: false = riga mai esaminata → per il fail-closed è ignota. */
  reviewed: boolean;
};

/** fdcId → classi dell'alimento. Costruito quando si carica il catalogo del menù. */
export type AllergenFoodIndex = ReadonlyMap<number, AllergenFoodInfo>;

export type AllergenFilterContext = {
  /** Tutte le classi che l'atleta non tollera (allergie + intolleranze + esclusioni). */
  athleteClasses: ReadonlySet<string>;
  /**
   * Fail-closed armato: vero solo se almeno una classe viene da ALLERGIE/INTOLLERANZE e
   * il catalogo ha davvero righe esaminate (senza fonte di classificazione bloccare tutto
   * svuoterebbe il piano invece di proteggerlo — resta la rete per sottostringhe).
   */
  failClosed: boolean;
  foodIndex: AllergenFoodIndex;
};

/**
 * Costruisce il contesto, o `null` quando non c'è NIENTE da decidere (atleta senza
 * allergie/intolleranze/esclusioni mappabili): `null` = comportamento odierno intatto.
 */
export function createAllergenFilterContext(input: {
  allergyClasses: readonly AllergenClassToken[];
  exclusionClasses?: readonly AllergenClassToken[];
  foodIndex?: AllergenFoodIndex | null;
}): AllergenFilterContext | null {
  const athleteClasses = new Set<string>([...input.allergyClasses, ...(input.exclusionClasses ?? [])]);
  if (athleteClasses.size === 0) return null;
  const foodIndex: AllergenFoodIndex = input.foodIndex ?? new Map<number, AllergenFoodInfo>();
  let hasReviewed = false;
  for (const info of foodIndex.values()) {
    if (info.reviewed) {
      hasReviewed = true;
      break;
    }
  }
  return {
    athleteClasses,
    failClosed: input.allergyClasses.length > 0 && hasReviewed,
    foodIndex,
  };
}

/** Normalizza una riga di catalogo (colonne DB) in {@link AllergenFoodInfo}. */
export function allergenFoodInfo(
  classes: unknown,
  reviewed: unknown,
): AllergenFoodInfo {
  return {
    classes: normalizeAllergenClassList(classes),
    reviewed: reviewed === true,
  };
}

/**
 * DECISIONE, nell'ordine del contratto:
 *  a. il cibo porta una classe che l'atleta non tollera → ESCLUSO;
 *  b. fail-closed armato e il cibo NON è classificato (assente dall'indice o
 *     `allergens_reviewed = false`) → ESCLUSO;
 *  c. altrimenti ammesso qui (resta il filtro per sottostringa a valle);
 *  d. nessun contesto (atleta senza dichiarazioni) → sempre ammesso, come oggi.
 */
export function isAllergenExcludedInfo(
  info: AllergenFoodInfo | null | undefined,
  ctx: AllergenFilterContext | null | undefined,
): boolean {
  if (!ctx || ctx.athleteClasses.size === 0) return false;
  if (info) {
    for (const c of info.classes) {
      if (ctx.athleteClasses.has(c)) return true;
    }
  }
  if (!ctx.failClosed) return false;
  return !info || !info.reviewed;
}

/** Come {@link isAllergenExcludedInfo}, partendo dall'fdcId del candidato. */
export function isAllergenExcludedFdcId(
  fdcId: number | null | undefined,
  ctx: AllergenFilterContext | null | undefined,
): boolean {
  if (!ctx || ctx.athleteClasses.size === 0) return false;
  const info = typeof fdcId === "number" && Number.isFinite(fdcId) ? ctx.foodIndex.get(fdcId) : undefined;
  return isAllergenExcludedInfo(info, ctx);
}

export function filterFdcCandidates(
  candidates: FdcFoodBrowseHit[],
  denyFragments: string[],
  allergen?: AllergenFilterContext | null,
): FdcFoodBrowseHit[] {
  return candidates.filter(
    (c) =>
      c.kcalPer100g > 0 &&
      !isAllergenExcludedFdcId(c.fdcId, allergen) &&
      !isDeniedFdcDescription(c.description, denyFragments),
  );
}
