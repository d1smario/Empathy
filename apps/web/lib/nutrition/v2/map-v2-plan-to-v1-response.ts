import type {
  IntelligentMealPlanAssembledCore,
  IntelligentMealPlanItemOut,
  IntelligentMealPlanRequest,
  IntelligentMealPlanSlotOut,
  MealSlotKey,
} from "@/lib/nutrition/intelligent-meal-plan-types";
import {
  dayInteractionSummaryExtras,
  decorateComposedMealSlots,
  pathwayBoostStatusFromRequest,
} from "@/lib/nutrition/enrich-meal-slots-after-compose";
import { DAY_ENGINE_DEFAULT_SLOT_TIMES } from "@/lib/nutrition/v2/day-engine-integration";
import { finalizeIntelligentMealPlanCore } from "@/lib/nutrition/meal-plan-response-finalize";
import { fdcIdForCanonicalKey } from "@/lib/nutrition/canonical-food-fdc-aliases";
import { buildFdcCanonicalSnapshotFromFdcIds, buildFdcCanonicalSnapshotFromFoods } from "@/lib/nutrition/fdc-to-canonical-scaler";
import { loadFdcFoodsByIds } from "@/lib/nutrition/fdc-food-cache";
import type { MealPlanV2Production } from "@/lib/nutrition/v2/build-meal-plan-v2-production";
import { portionHintIt } from "@/lib/nutrition/v2/compose-meal-plan-v2";
import { mealRotationStaplesFromComposedItems } from "@/lib/nutrition/v2/fdc-staple-registry";
import { MEAL_SLOT_ASSEMBLY } from "@/lib/nutrition/v2/meal-slot-assembly-spec";
import { v2ComposedSlotToMediterraneanMeal } from "@/lib/nutrition/v2/v2-mediterranean-meal-adapter";

function macroRoleFromItem(choG: number, proG: number, fatG: number): IntelligentMealPlanItemOut["macroRole"] {
  const choK = choG * 4;
  const proK = proG * 4;
  const fatK = fatG * 9;
  const total = choK + proK + fatK;
  if (total <= 0) return "mixed";
  if (choK / total >= 0.55) return "cho_heavy";
  if (proK / total >= 0.35) return "protein";
  if (fatK / total >= 0.45) return "fat";
  return "mixed";
}

function mapItem(
  item: MealPlanV2Production["composedMealPlan"][number]["items"][number],
  slotKey: MealSlotKey,
  itemIndex: number,
): IntelligentMealPlanItemOut {
  const label = item.description;
  const roles = MEAL_SLOT_ASSEMBLY[slotKey] ?? [];
  const positional = roles[itemIndex] ?? roles[roles.length - 1] ?? {
    foodRole: "cho_simple" as const,
    lever: "cho" as const,
    poolKey: "snack_cho",
    minG: 25,
    maxG: 180,
    stepG: 5,
  };
  // Il ruolo sull'item (grammatica dei pasti) vince sulla posizione: con la linea CHO
  // secondaria a colazione o una ricetta l'indice non coincide più con MEAL_SLOT_ASSEMBLY.
  const spec =
    item.foodRole && item.foodRole !== positional.foodRole
      ? { ...positional, foodRole: item.foodRole as typeof positional.foodRole }
      : positional;
  if (item.recipe && item.recipe.components.length > 0) {
    // Ricetta: UN item col piatto intero e gli ingredienti nel portionHint. Nessuna
    // compositionKey: non è un alimento FDC, i macro sono già la somma degli ingredienti.
    const g = Math.round(item.grams);
    const parts = item.recipe.components.map((c) => `${c.labelIt} ${Math.round(c.grams)} g`).join(", ");
    return {
      name: label,
      portionHint: `${g} g ${label} (piatto cotto) · ${parts}`,
      functionalBridge: "Alimentazione sportiva · ricetta del nutrizionista (ingredienti del catalogo)",
      approxKcal: Math.round(item.kcal),
      macroRole: macroRoleFromItem(item.choG, item.proG, item.fatG),
      // Gli ingredienti in forma STRUTTURATA, non solo nel testo del portionHint: sono il
      // dato con cui il finalize calcola i nutrienti della riga. Finché c'era solo il
      // testo, il finalize non aveva una composizione da usare e deduceva l'alimento dal
      // NOME del piatto — con i macro di quell'unico alimento al posto di quelli veri
      // (25 ago: 318 righe su 318, −33 g di carboidrati e +11 g di grassi in media).
      components: item.recipe.components.map((c) => ({
        canonicalKey: c.canonicalKey ?? null,
        fdcId: typeof c.fdcId === "number" && c.fdcId > 0 ? c.fdcId : null,
        labelIt: c.labelIt,
        grams: Math.round(c.grams * 10) / 10,
      })),
    };
  }
  const canonicalKey = item.canonicalKey;
  // `servingBasis` dice solo COME esprimere la porzione (crudo/cotto/ml): non ha nulla a che
  // vedere con l'usabilita' della riga USDA. Gli alimenti del catalogo DB privi di entry nella
  // staple registry arrivano senza servingBasis e con la vecchia condizione perdevano il
  // `fdc:NNN`, finendo per essere ri-dedotti per regex dal nome italiano (→ macro a zero).
  const compositionKey: string | undefined =
    item.fdcId > 0
      ? `fdc:${item.fdcId}`
      : canonicalKey && fdcIdForCanonicalKey(canonicalKey)
        ? `fdc:${fdcIdForCanonicalKey(canonicalKey)}`
        : canonicalKey || undefined;

  return {
    name: label,
    portionHint: portionHintIt(label, item.grams, spec, item.servingBasis),
    functionalBridge: "Alimentazione sportiva · staple canonico",
    approxKcal: Math.round(item.kcal),
    macroRole: macroRoleFromItem(item.choG, item.proG, item.fatG),
    compositionKey,
    compositionStatus: compositionKey?.startsWith("fdc:") ? "fdc_cache" : "canonical_estimate",
  };
}

function slotCoherenceFor(slot: MealSlotKey, suppressed: boolean): string {
  if (suppressed) {
    return "Pasto soppresso: energia in finestra allenamento → modulo Fueling (substrati V2).";
  }
  return "Composizione mediterranea sportiva: primo + secondo + contorno (V2 staple).";
}

function composedMealForSlot(
  production: MealPlanV2Production,
  slotKey: MealSlotKey,
): ReturnType<typeof v2ComposedSlotToMediterraneanMeal> {
  const composed = production.composedMealPlan.find((s) => s.slot === slotKey);
  if (!composed || composed.items.length === 0) {
    return { items: [], lines: [], totalApproxKcal: 0 };
  }
  const items = composed.items.map((it, idx) => mapItem(it, slotKey, idx));
  // Gli item passano interi (compositionKey/compositionStatus inclusi): il decoratore usa
  // questo pasto SOLO per le note pathway/rotazione — gli item serviti restano quelli
  // dei `preEnrichSlots` (identici a questi per costruzione, stessa `composedMealPlan`).
  return {
    items,
    lines: items.map((i) => i.portionHint),
    totalApproxKcal: items.reduce((s, i) => s + i.approxKcal, 0),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function mapV2PlanToV1AssembledCore(
  production: MealPlanV2Production,
  request: IntelligentMealPlanRequest,
): IntelligentMealPlanAssembledCore {
  const suppressed = new Set(request.suppressedSlots ?? []);
  const slotMeta = new Map(request.slots.map((s) => [s.slot, s]));

  // UNA sola giornata alimentare (audit 12 ago): gli slot del payload sono ESATTAMENTE
  // quelli di `composedMealPlan` — la stessa produzione che persistV2PlanToDb scrive in
  // meal/meal_item — cioè day-engine quando applied, legacy altrimenti. Prima il payload
  // seguiva `request.slots` (solver legacy): con day-engine applied perdeva pasti interi
  // (snack del day-engine visibili in Oggi ma non in Nutrizione) e trascinava slot vuoti.
  // Uno slot NON soppresso rimasto senza item non viene persistito → nemmeno servito qui.
  const preEnrichSlots: IntelligentMealPlanSlotOut[] = production.composedMealPlan
    .filter((composed) => suppressed.has(composed.slot as MealSlotKey) || composed.items.length > 0)
    .map((composed) => {
    const slotKey = composed.slot as MealSlotKey;
    const meta = slotMeta.get(slotKey);
    const isSuppressed = suppressed.has(slotKey);

    if (isSuppressed) {
      return {
        slot: slotKey,
        targetKcalEcho: composed.targetKcal,
        items: [
          {
            name: "Fueling in seduta",
            portionHint: "Vedi timeline Fueling",
            functionalBridge: "CHO intra da substrati fisiologici",
            approxKcal: 0,
            macroRole: "cho_heavy",
          },
        ],
        slotCoherence: slotCoherenceFor(slotKey, true),
        slotTimingRationale: meta?.scheduledTimeLocal
          ? `Orario ${meta.scheduledTimeLocal}: slot dentro finestra training.`
          : "Slot in finestra training.",
      };
    }

    return {
      slot: slotKey,
      targetKcalEcho: composed.targetKcal,
      items: composed.items.map((it, idx) => mapItem(it, slotKey, idx)),
      slotCoherence: slotCoherenceFor(slotKey, false),
      slotTimingRationale: meta?.scheduledTimeLocal
        ? `Pasto ${meta.labelIt} alle ${meta.scheduledTimeLocal} · target Diet ${composed.targetKcal} kcal.`
        : `Target Diet ${composed.targetKcal} kcal.`,
    };
  });

  // Decorazione (note pathway/integrazione/coerenza): NON tocca item, grammi né kcal.
  const enrichedSlots = decorateComposedMealSlots({
    request,
    slots: preEnrichSlots,
    getBaseMealForSlot: (slotKey) => composedMealForSlot(production, slotKey),
  });

  // Slot-target SERVITI dal composer (production.dietMealSlotBudgets = day-engine quando
  // applied, legacy altrimenti): finiscono in solverBasis.slots via attachSolverBasis…,
  // così i target in pagina Nutrizione sono gli stessi dei meal persistiti (letti da Oggi).
  const servedSlotBasis: NonNullable<IntelligentMealPlanAssembledCore["servedSlotBasis"]> =
    production.dietMealSlotBudgets.map((b) => {
      const key = b.key as MealSlotKey;
      const meta = slotMeta.get(key);
      return {
        slot: key,
        labelIt: b.label || meta?.labelIt || key,
        // Orario: dallo slot omologo del client se presente, altrimenti default day-engine
        // (stessa scelta di DayEngineSlot.time) — i budget non trasportano orari.
        scheduledTimeLocal: meta?.scheduledTimeLocal?.trim() || DAY_ENGINE_DEFAULT_SLOT_TIMES[key] || "",
        targetKcal: Math.round(b.kcal),
        targetCarbsG: round1(b.carbs),
        targetProteinG: round1(b.protein),
        targetFatG: round1(b.fat),
      };
    });
  const servedMealsKcalTotal = production.dietMealSlotBudgets.reduce((sum, b) => sum + b.kcal, 0);

  const fuelNote = production.requirements.substrateFueling
    ? `Fueling V2: ${production.requirements.energy.fuelingKcal} kcal oral (CHO substrati).`
    : "";

  return {
    layer: "deterministic_meal_assembly_v1",
    disclaimer:
      `Piano generato con motore Nutrition V2 (staple sportivi + fueling substrati). ${fuelNote} Ripartizione pasti da Profile Diet.`,
    slots: enrichedSlots,
    dayInteractionSummary: dayInteractionSummaryExtras(
      request,
      [`Strategia ${production.requirements.strategyKind}`, fuelNote].filter(Boolean).join(" · "),
      servedMealsKcalTotal,
    ),
    mealRotationStaples: composedStaples(production),
    pathwayBoostStatus: pathwayBoostStatusFromRequest(request),
    servedSlotBasis,
  };
}

function composedStaples(production: MealPlanV2Production): string[] {
  const items = production.composedMealPlan.flatMap((slot) => slot.items);
  return mealRotationStaplesFromComposedItems(items);
}

export async function mapV2PlanToV1Response(
  production: MealPlanV2Production,
  request: IntelligentMealPlanRequest,
): Promise<IntelligentMealPlanAssembledCore> {
  const core = mapV2PlanToV1AssembledCore(production, request);
  const fdcIds = new Set<number>();
  const canonicalKeys: string[] = [];

  for (const slot of core.slots) {
    for (const it of slot.items) {
      const key = it.compositionKey ?? "";
      if (key.startsWith("fdc:")) {
        const id = Number(key.slice(4));
        if (Number.isFinite(id) && id > 0) fdcIds.add(id);
      } else if (key && !key.startsWith("fdc:")) {
        canonicalKeys.push(key);
      }
    }
  }

  for (const slot of production.composedMealPlan) {
    for (const it of slot.items) {
      if (it.fdcId > 0) fdcIds.add(it.fdcId);
      if (it.canonicalKey) canonicalKeys.push(it.canonicalKey);
    }
  }

  const foodsByFdcId = fdcIds.size > 0 ? await loadFdcFoodsByIds([...fdcIds]) : new Map();
  const snapFdc = buildFdcCanonicalSnapshotFromFdcIds([...fdcIds], foodsByFdcId);
  const snapCanon = buildFdcCanonicalSnapshotFromFoods([...new Set(canonicalKeys)], foodsByFdcId);
  const snapshot = { ...snapCanon, ...snapFdc };

  // Niente dedupe proteine pranzo/cena qui: sostituirebbe nel payload un segnaposto di
  // famiglia («Proteina: pollo/tacchino») al posto del cibo CONCRETO già persistito in
  // meal_item — le due pagine mostrerebbero alimenti diversi per lo stesso pasto.
  return finalizeIntelligentMealPlanCore(core, request, snapshot, { lunchDinnerProteinDedupe: false });
}
