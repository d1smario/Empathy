import type {
  IntelligentMealPlanAssembledCore,
  IntelligentMealPlanItemOut,
  IntelligentMealPlanRequest,
  IntelligentMealPlanSlotOut,
  MealSlotKey,
} from "@/lib/nutrition/intelligent-meal-plan-types";
import {
  CANONICAL_FOOD_TABLE,
  inferCanonicalFoodKeyPreferName,
  scaleCanonicalNutrientsToGrams,
  sumScaledNutrients,
  type ScaledMealItemNutrients,
} from "@/lib/nutrition/canonical-food-composition";
import {
  buildFdcCanonicalSnapshot,
  buildFdcCanonicalSnapshotFromFdcIds,
  nutrientsForMealPlanItemFromCache,
  type FdcCanonicalSnapshot,
} from "@/lib/nutrition/fdc-to-canonical-scaler";
import { loadFdcFoodsByIds } from "@/lib/nutrition/fdc-food-cache";
import { buildHydrationRoutineFromMealPlanRequest } from "@/lib/nutrition/meal-plan-hydration-routine";
import { buildMealPlanNutrientIntegrationHints } from "@/lib/nutrition/meal-plan-nutrient-integration-hints";
import { dedupeLunchDinnerMainProteins } from "@/lib/nutrition/meal-plan-protein-dedupe";
import type { NutrientTargetId } from "@/lib/nutrition/pathway-cofactors-to-nutrient-targets";
import { buildPathwayTargetRollupComparison } from "@/lib/nutrition/pathway-target-rollup-compare";

/**
 * Nutrienti di una riga-RICETTA: la somma dei suoi ingredienti, ciascuno scalato sui
 * propri grammi.
 *
 * È la correzione del difetto segnalato dal nutrizionista il 25 ago 2026 («troppi grassi
 * e pochi carboidrati; la somma dei singoli alimenti non coincide col totale»). Una riga
 * ricetta non ha una `compositionKey`, perché non è un alimento: il finalize ricadeva su
 * `inferCanonicalFoodKeyPreferName`, che indovina l'alimento DAL NOME. «Riso soffiato
 * yogurt greco miele e mirtilli» conteneva la parola yogurt → yogurt bianco INTERO,
 * scalato fino alle 467 kcal del piatto: kcal giuste, ripartizione dei macro di tutt'altro
 * alimento. Su 318 righe-ricetta su 318: −32,9 g di carboidrati e +10,7 g di grassi in
 * media, punte di +53 g.
 *
 * `null` quando nessun ingrediente è risolvibile: il chiamante lascia allora il percorso
 * storico, non scrive nutrienti inventati.
 */
export function nutrientsFromRecipeComponents(
  components: NonNullable<IntelligentMealPlanItemOut["components"]>,
  snapshot: FdcCanonicalSnapshot,
): ScaledMealItemNutrients | null {
  const parts: ScaledMealItemNutrients[] = [];
  for (const c of components) {
    if (!(c.grams > 0)) continue;
    // Il componente neutro (acqua/brodo) non ha né canonical né fdc: non porta nutrienti
    // ed è giusto che non ne porti — ma i suoi grammi restano nel piatto.
    const fdcKey = c.fdcId != null && c.fdcId > 0 ? `fdc:${c.fdcId}` : null;
    const canonical =
      (fdcKey ? snapshot[fdcKey]?.canonical : undefined) ??
      (c.canonicalKey ? (snapshot[c.canonicalKey]?.canonical ?? CANONICAL_FOOD_TABLE[c.canonicalKey]) : undefined);
    if (!canonical?.kcalPer100g) continue;
    parts.push(scaleCanonicalNutrientsToGrams(canonical, c.grams));
  }
  return parts.length > 0 ? sumScaledNutrients(parts) : null;
}

function enrichSlot(slot: IntelligentMealPlanSlotOut, snapshot: FdcCanonicalSnapshot): IntelligentMealPlanSlotOut {
  const items = slot.items.map((it) => {
    // RICETTA: i nutrienti vengono dagli ingredienti, mai dedotti dal nome del piatto.
    if (it.components && it.components.length > 0) {
      const fromComponents = nutrientsFromRecipeComponents(it.components, snapshot);
      if (fromComponents) {
        const next: IntelligentMealPlanItemOut = {
          ...it,
          compositionKey: it.compositionKey ?? "recipe:components",
          compositionStatus: "fdc_cache",
          nutrients: fromComponents,
        };
        return next;
      }
    }
    const { compositionKey, compositionStatus, nutrients } = nutrientsForMealPlanItemFromCache(
      {
        name: it.name,
        portionHint: it.portionHint,
        approxKcal: it.approxKcal,
        compositionKey: it.compositionKey,
      },
      snapshot,
    );
    const next: IntelligentMealPlanItemOut = {
      ...it,
      compositionKey: it.compositionKey ?? compositionKey,
      compositionStatus,
    };
    // Lookup fallito (`unresolved`): NON scriviamo `nutrients`. Scrivere un oggetto tutto-zero
    // faceva credere al client di avere il dato e l'alimento usciva a 0 kcal / CHO-PRO-FAT 0.
    // Senza il campo, `approxMacrosForPlanItem` stima da kcal + macroRole.
    if (nutrients) next.nutrients = nutrients;
    else delete next.nutrients;
    return next;
  });
  return { ...slot, items };
}

/**
 * Aggiunge stime nutrizionali dettagliate (macro/micro/aminoacidi/frazioni lipidiche/GI/II/GL) e routine idratazione
 * coerente con gli orari inviati nel request.
 *
 * **Regola generativa:** `nutrientRollup` descrive solo la **composizione** delle voci scelte (USDA/canonical);
 * kcal e % per pasto restano quelle del profilo Diet (`targetKcal` nel request), mai ricalcolate dal rollup.
 *
 * Composizione preferita: cache USDA `nutrition_fdc_foods` (via `getOrImportFdcFood` → `nutrientsForMealPlanItemFromCache`).
 * Fallback automatico al `CANONICAL_FOOD_TABLE` TS quando una key non è ancora mappata o l'import USDA fallisce.
 *
 * Il `snapshot` può essere passato dall'esterno (chi ha già pre-caricato la cache, es. il builder
 * `buildDeterministicMealPlanFromRequest`) o lasciato omesso: in quel caso viene calcolato qui.
 */
export async function finalizeIntelligentMealPlanCore(
  core: IntelligentMealPlanAssembledCore,
  req: IntelligentMealPlanRequest,
  snapshot?: FdcCanonicalSnapshot,
  opts?: {
    /**
     * false = niente sostituzione del segnaposto proteico pranzo/cena. Il ramo V2 lo
     * disattiva: i suoi item sono GIÀ persistiti in meal_item e il dedupe qui riscriveva
     * solo il payload (pagina Nutrizione col segnaposto, Oggi col cibo concreto).
     * Default true: il ramo V1 (composer mediterraneo) resta com'era.
     */
    lunchDinnerProteinDedupe?: boolean;
  },
): Promise<IntelligentMealPlanAssembledCore> {
  const slotsDeduped =
    opts?.lunchDinnerProteinDedupe === false ? core.slots : dedupeLunchDinnerMainProteins(core.slots);
  const baseSnapshot =
    snapshot ??
    (await buildFdcCanonicalSnapshot(
      slotsDeduped.flatMap((s) => s.items.map((it) => inferCanonicalFoodKeyPreferName(it.name, it.portionHint))),
    ));
  // Gli INGREDIENTI delle ricette non stanno nello snapshot di base, che si costruisce
  // dai nomi degli item: il piatto è uno, gli ingredienti sono altri quattro o cinque.
  // Li si carica per fdc_id — che il catalogo porta esplicito, quindi senza passare dagli
  // alias nome→fdc, che per questi non esistono. Senza questo pezzo il calcolo dai
  // componenti ricadrebbe sulla sola tabella TS interna e perderebbe gli alimenti che
  // vivono solo nel catalogo DB.
  const componentFdcIds = [
    ...new Set(
      slotsDeduped.flatMap((s) =>
        s.items.flatMap((it) => (it.components ?? []).map((c) => c.fdcId).filter((id): id is number => typeof id === "number" && id > 0)),
      ),
    ),
  ];
  const fdcSnapshot = componentFdcIds.length
    ? {
        ...baseSnapshot,
        ...buildFdcCanonicalSnapshotFromFdcIds(componentFdcIds, await loadFdcFoodsByIds(componentFdcIds)),
      }
    : baseSnapshot;
  const slots = slotsDeduped.map((s) => enrichSlot(s, fdcSnapshot));
  const byReq = new Map(req.slots.map((s) => [s.slot, s]));

  const perSlot: Array<{
    slot: MealSlotKey;
    labelIt: string;
    scheduledTimeLocal: string;
    totals: ScaledMealItemNutrients;
  }> = slots.map((s) => {
    const meta = byReq.get(s.slot);
    // Gli item senza `nutrients` (lookup non risolto) non contribuiscono al rollup micro:
    // meglio un rollup piu' povero che micronutrienti inventati.
    const totals = sumScaledNutrients(
      s.items.map((i) => i.nutrients).filter((n): n is ScaledMealItemNutrients => Boolean(n)),
    );
    return {
      slot: s.slot,
      labelIt: meta?.labelIt ?? s.slot,
      scheduledTimeLocal: meta?.scheduledTimeLocal ?? "",
      totals,
    };
  });

  const dayTotals = sumScaledNutrients(perSlot.map((p) => p.totals));

  const integrationHints = buildMealPlanNutrientIntegrationHints(dayTotals);
  let dayInteractionSummary = core.dayInteractionSummary;
  if (integrationHints.length) {
    dayInteractionSummary = `${dayInteractionSummary} · ${integrationHints.join(" · ")}`.slice(0, 900);
  }

  const boostTargets =
    req.nutrientBoostTargets?.filter(
      (t): t is { nutrientId: NutrientTargetId; labelIt: string } =>
        typeof t.nutrientId === "string" && typeof t.labelIt === "string" && t.labelIt.trim() !== "",
    ) ?? [];
  const pathwayTargetRollup =
    boostTargets.length > 0 ? buildPathwayTargetRollupComparison(boostTargets, dayTotals) : undefined;

  return {
    ...core,
    slots,
    dayInteractionSummary,
    pathwayTargetRollup,
    nutrientRollup: {
      disclaimerIt:
        "Composizione da cache USDA FDC (nutrition_fdc_foods) quando disponibile; fallback alla banca canonica interna per voci non ancora mappate. GI/II derivati da macro USDA (Wolever-style estimate, salvati in DB).",
      dayTotals,
      perSlot,
    },
    hydrationRoutine: buildHydrationRoutineFromMealPlanRequest(req),
  };
}
