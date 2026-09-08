import type { MealPlanV2ComposedItem, MealPlanV2ServingBasis } from "@empathy/contracts";
import {
  inferCanonicalFoodKeyPreferName,
  scaleCanonicalNutrientsToGrams,
  scaleCanonicalNutrientsToKcal,
  CANONICAL_FOOD_TABLE,
} from "@/lib/nutrition/canonical-food-composition";
import { fdcIdForCanonicalKey } from "@/lib/nutrition/canonical-food-fdc-aliases";
import type { MediterraneanComposedMeal } from "@/lib/nutrition/mediterranean-meal-composer";
import { parseGramsFromPortion } from "@/lib/nutrition/meal-exposition-helpers";
import { labelItForStaple, servingBasisForCanonical } from "@/lib/nutrition/v2/fdc-staple-registry";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Adapter V1 MediterraneanComposedMeal → V2 composed items (gara, pathway adds). */
function gramsFromMediterraneanItem(
  it: MediterraneanComposedMeal["items"][number],
  canonicalKey: string,
  kcal: number,
): number {
  const fromHint = parseGramsFromPortion(`${it.portionHint} ${it.name}`.trim());
  if (fromHint != null && fromHint > 0) return fromHint;
  const row = CANONICAL_FOOD_TABLE[canonicalKey];
  if (row?.kcalPer100g) return Math.max(8, Math.round((kcal * 100) / row.kcalPer100g));
  return 0;
}

type ItemMacros = { choG: number; proG: number; fatG: number };

/**
 * Ripartizione per RUOLO delle kcal: ultima spiaggia, non la strada principale.
 *
 * Serve solo agli item del protocollo gara che non hanno una composizione da cui leggere
 * («Carbo Recovery Mix», «MCT oil»: nomi commerciali che non risolvono a nessun alimento
 * canonico). Per tutto il resto i macro vengono dall'alimento — vedi `macrosFromComposition`.
 */
function macrosFromRoleSplit(role: string, kcal: number): ItemMacros {
  const split =
    role === "cho_heavy"
      ? { c: 0.72, p: 0.14, f: 0.14 }
      : role === "protein"
        ? { c: 0.25, p: 0.45, f: 0.3 }
        : role === "fat"
          ? { c: 0.18, p: 0.18, f: 0.64 }
          : role === "veg"
            ? { c: 0.45, p: 0.2, f: 0.35 }
            : { c: 0.5, p: 0.2, f: 0.3 };
  return {
    choG: round1((kcal * split.c) / 4),
    proG: round1((kcal * split.p) / 4),
    fatG: round1((kcal * split.f) / 9),
  };
}

/**
 * Oltre questa deviazione fra le kcal della composizione e le kcal dichiarate dall'item, i
 * grammi e le kcal dell'item non parlano dello stesso piatto e la scalatura per grammi non
 * è credibile: si ripiega sulle kcal. È la STESSA soglia (20%) di `reconcileScaledNutrients`
 * in `fdc-to-canonical-scaler`, cioè del percorso che calcola i nutrienti del
 * `response_payload`.
 *
 * ATTENZIONE a cosa questa soglia NON garantisce: allinea il CRITERIO di ripiego, non il
 * risultato. Le due strade leggono due FONTI diverse per la composizione per 100 g — qui la
 * tabella TS di `canonical-food-composition.ts`, il payload lo snapshot `nutrition_fdc_foods` —
 * quindi finché una riga FDC diverge dalla tabella, i due numeri divergono su quell'alimento.
 * È successo davvero col grana: l'alias `cheese_hard` puntava alla riga USDA del formaggio
 * GRATTUGIATO (13,9 g di carboidrati per 100 g, che sono l'antiagglomerante, non il formaggio)
 * invece che a quella del duro. Un commento precedente qui dichiarava i due numeri «identici
 * per costruzione»: non era vero, e la divergenza si chiude correggendo la FONTE — come è
 * stato fatto per il grana — non aggiungendo compensazioni qui.
 */
const COMPOSITION_KCAL_DEVIATION_MAX = 0.2;

/** Ciò che `inferCanonicalFoodKey` restituisce quando NON ha riconosciuto l'alimento. */
const UNRESOLVED_CANONICAL_KEY = "generic_mixed";

/**
 * Macro dell'item dalla COMPOSIZIONE dell'alimento (banca canonica della piattaforma,
 * la stessa che risolve `canonicalKey` → `fdc:NNN`), scalata sui grammi serviti.
 *
 * `null` quando l'alimento non è risolvibile (`generic_mixed`, riga senza kcal): in quel
 * caso il chiamante ricade sulla ripartizione per ruolo, che è come si comportava prima.
 */
function macrosFromComposition(canonicalKey: string, grams: number, kcal: number): ItemMacros | null {
  // `generic_mixed` è l'esito di «non ho riconosciuto questo alimento», non un alimento:
  // ha una riga in tabella ma è un profilo medio. Usarlo darebbe 9 g di carboidrati a 10 g
  // di MCT oil — lo stesso genere di numero impossibile che questo lavoro toglie. Come
  // `nutrientsForMealPlanItemFromCache`, qui vale «non risolto».
  if (canonicalKey === UNRESOLVED_CANONICAL_KEY) return null;
  const row = CANONICAL_FOOD_TABLE[canonicalKey];
  if (!row?.kcalPer100g) return null;
  const byGrams = grams > 0 ? scaleCanonicalNutrientsToGrams(row, grams) : null;
  const deviation = byGrams ? Math.abs(byGrams.kcal - kcal) / Math.max(kcal, 1) : Infinity;
  const scaled = byGrams && deviation <= COMPOSITION_KCAL_DEVIATION_MAX ? byGrams : scaleCanonicalNutrientsToKcal(row, kcal);
  return { choG: round1(scaled.carbsG), proG: round1(scaled.proteinG), fatG: round1(scaled.fatG) };
}

/**
 * L'unità con cui la porzione va RI-SCRITTA a valle (`portionHintIt`, in mapItem).
 *
 * Chi compone la voce è già passato per una decisione di unità: il protocollo pre-gara
 * scrive «17 g olio EVO» perché il nutrizionista prescrive grammi e la bilancia pesa
 * grammi. La staple registry, che serve al percorso generativo, risponde «ml» per qualunque
 * chiave contenga `oil` — e il payload ri-serviva l'olio del protocollo come «15 ml», che
 * il finalize riconverte in 13,8 g: −1,2 g di grasso e due kcal diverse sulla stessa riga.
 *
 * Regola: quando la riga di partenza dichiara già i grammi, quella è l'unità. Solo quando
 * non li dichiara si torna al default del catalogo.
 */
function servingBasisForComposedItem(portionHint: string, canonicalKey: string): MealPlanV2ServingBasis {
  return /\d+(?:[.,]\d+)?\s*g(?:rammi?)?\b/i.test(portionHint) ? "dry_grams" : servingBasisForCanonical(canonicalKey);
}

export function mediterraneanMealToV2Items(meal: MediterraneanComposedMeal): MealPlanV2ComposedItem[] {
  return meal.items.map((it) => {
    const canonicalKey = inferCanonicalFoodKeyPreferName(it.name, it.portionHint);
    const fdcId = fdcIdForCanonicalKey(canonicalKey) ?? 0;
    const servingBasis = servingBasisForComposedItem(it.portionHint, canonicalKey);
    const kcal = Math.max(1, Math.round(it.approxKcal));
    const grams = gramsFromMediterraneanItem(it, canonicalKey, kcal);
    const role = it.macroRole ?? "mixed";
    // I macro vengono dall'ALIMENTO, non da una percentuale delle kcal per ruolo. La
    // percentuale faceva uscire 180,7 g di CHO da 275 g di riso crudo (2,48 g/kg invece dei
    // 3 g/kg del protocollo pre-gara), 6,3 g di carboidrati da 15 g di olio EVO e 4-5 g di
    // carboidrati dal grana — e faceva divergere `meal_item` (letto da «Oggi») dal
    // `response_payload` (letto da Nutrizione) sullo stesso identico piatto.
    const macros = macrosFromComposition(canonicalKey, grams, kcal) ?? macrosFromRoleSplit(role, kcal);
    return {
      fdcId,
      description: it.name,
      grams,
      kcal,
      ...macros,
      canonicalKey,
      servingBasis,
    };
  });
}

export function v2ComposedSlotToMediterraneanMeal(items: MealPlanV2ComposedItem[]): MediterraneanComposedMeal {
  const out = items.map((it) => ({
    name: it.description,
    portionHint:
      it.grams > 0
        ? `${Math.round(it.grams)} g ${labelItForStaple(it.canonicalKey ?? it.description) || it.description}`
        : it.description,
    functionalBridge: "Composizione V2 staple",
    approxKcal: Math.round(it.kcal),
    macroRole:
      it.choG * 4 >= it.proG * 4 && it.choG * 4 >= it.fatG * 9
        ? ("cho_heavy" as const)
        : it.proG * 4 >= it.fatG * 9
          ? ("protein" as const)
          : it.fatG * 9 > it.choG * 4
            ? ("fat" as const)
            : ("mixed" as const),
  }));
  const totalApproxKcal = out.reduce((s, i) => s + i.approxKcal, 0);
  return {
    items: out,
    lines: out.map((i) => i.portionHint),
    totalApproxKcal,
  };
}
