/**
 * Layer intelligence post-compose del ramo V2: DECORA gli slot composti, non li ricalcola.
 *
 * PRINCIPIO (audit 12 ago, «una sola giornata alimentare»): gli item, i grammi e le kcal
 * del payload devono essere ESATTAMENTE quelli che il persist scrive in `meal_item`
 * (stessa produzione `composedMealPlan`). Qui quindi non si ri-scala niente e non si
 * aggiungono item: pathway advice e integrazione giornaliera diventano NOTE testuali
 * (boostNote/slotCoherence). La vecchia versione iterava `request.slots` e ri-scalava le
 * kcal sul target del solver LEGACY: con day-engine applied il payload perdeva l'uplift
 * (mediana −44% kcal serviti nei giorni pesanti) e mostrava un set di slot diverso dai
 * `meal` persistiti (pasti interi visibili in Oggi ma non in Nutrizione).
 */

import type {
  IntelligentMealPlanAssembledCore,
  IntelligentMealPlanRequest,
  IntelligentMealPlanSlotOut,
  MealSlotKey,
} from "@/lib/nutrition/intelligent-meal-plan-types";
import type { MediterraneanComposedMeal, MediterraneanDayContext, MediterraneanDietType } from "@/lib/nutrition/mediterranean-meal-composer";
import { createMediterraneanDayContext } from "@/lib/nutrition/mediterranean-meal-composer";
import { applyPathwayAdvice } from "@/lib/nutrition/meal-pathway-advisor";
import { registerMealCanonicalKeys } from "@/lib/nutrition/meal-rotation-guard";
import { buildDailySupplementIntegrationPlan } from "@/lib/nutrition/meal-plan-daily-supplement-scheduler";
import { buildMealPlanFoodDenyFragments } from "@/lib/nutrition/meal-plan-profile-food-filter";
import { nutrientBoostAppliesToSlot } from "@/lib/nutrition/pathway-absorption-hints";
import type { NutrientTargetId } from "@/lib/nutrition/pathway-cofactors-to-nutrient-targets";
import { isRacePreRaceMealSlot, racePreLunchContextLine } from "@/lib/nutrition/race-day-pre-race-lunch";

const VALID_NUTRIENT_TARGET_IDS = new Set<NutrientTargetId>([
  "vitA_mcg_RAE",
  "vitC_mg",
  "vitD_mcg",
  "vitE_mg",
  "vitK_mcg",
  "thiamineB1_mg",
  "riboflavinB2_mg",
  "niacinB3_mg",
  "vitB6_mg",
  "folate_mcg",
  "vitB12_mcg",
  "ca_mg",
  "fe_mg",
  "mg_mg",
  "p_mg",
  "k_mg",
  "na_mg",
  "zn_mg",
  "se_mcg",
  "fiberG",
  "omega3G",
]);

function normalizeDietType(raw: string | null | undefined): MediterraneanDietType {
  const d = (raw ?? "").trim().toLowerCase();
  if (d === "vegan" || d.includes("vegan")) return "vegan";
  if (d === "vegetarian" || d.includes("veget")) return "vegetarian";
  if (d === "pescatarian" || d.includes("pesc")) return "pescatarian";
  return "omnivore";
}

function selectValidBoostTargets(
  targets: NonNullable<IntelligentMealPlanRequest["nutrientBoostTargets"]>,
): Array<{ nutrientId: NutrientTargetId; labelIt: string }> {
  return targets
    .filter((t) => VALID_NUTRIENT_TARGET_IDS.has(t.nutrientId as NutrientTargetId))
    .map((t) => ({ nutrientId: t.nutrientId as NutrientTargetId, labelIt: t.labelIt }));
}

export type DecorateComposedMealSlotsInput = {
  request: IntelligentMealPlanRequest;
  /**
   * Slot COMPOSTI (dal `composedMealPlan` V2): item, grammi e kcal sono quelli persistiti
   * in `meal_item` e da qui escono INVARIATI (cambia solo il testo di contorno).
   */
  slots: IntelligentMealPlanSlotOut[];
  getBaseMealForSlot: (slot: MealSlotKey) => MediterraneanComposedMeal;
  dayCtx?: MediterraneanDayContext;
};

export function buildMediterraneanDayContextFromRequest(req: IntelligentMealPlanRequest): MediterraneanDayContext {
  return createMediterraneanDayContext(
    req.planDate,
    req.weeklyStapleCounts,
    req.postWorkoutMealBySlot,
    normalizeDietType(req.dietType),
    buildMealPlanFoodDenyFragments(req),
    req.suppressedSlots,
    req.racePreLunch ?? undefined,
    req.racePostRecovery ?? undefined,
  );
}

export function decorateComposedMealSlots(input: DecorateComposedMealSlotsInput): IntelligentMealPlanAssembledCore["slots"] {
  const { request } = input;
  const dayCtx = input.dayCtx ?? buildMediterraneanDayContextFromRequest(request);
  const suppressed = new Set(request.suppressedSlots ?? []);
  const validBoostTargets = request.nutrientBoostTargets ? selectValidBoostTargets(request.nutrientBoostTargets) : [];

  const dailyIntegrationPlan = buildDailySupplementIntegrationPlan({
    boostTargets: validBoostTargets,
    slots: request.slots,
    suppressedSlots: request.suppressedSlots ?? [],
    pathwayModulation: request.pathwayModulation,
    dietType: normalizeDietType(request.dietType),
  });

  const reqBySlot = new Map(request.slots.map((s) => [s.slot, s]));

  return input.slots.map((slot) => {
    // Slot soppresso: il mapper ha già costruito il marcatore «Fueling in seduta» (0 kcal).
    if (suppressed.has(slot.slot)) return slot;

    const slotReq = reqBySlot.get(slot.slot);
    const isRacePreLunch = isRacePreRaceMealSlot(slot.slot, request.racePreLunch ?? null);
    const baseMeal = input.getBaseMealForSlot(slot.slot);

    const slotBoostIds = validBoostTargets
      .filter((t) => nutrientBoostAppliesToSlot(t.nutrientId, slot.slot, request.pathwayModulation))
      .map((t) => t.nutrientId);

    // Advice pathway in modalità SOLO-NOTE: gli item che l'advisor aggiungerebbe negli
    // spuntini NON entrano nel piatto (il piatto è già persistito), diventano suggerimento.
    const pathway = isRacePreLunch
      ? { meal: baseMeal, adviceNotes: [] as string[] }
      : applyPathwayAdvice(baseMeal, slot.slot, slotBoostIds, dayCtx);
    const adviceNotes = [...pathway.adviceNotes];
    if (pathway.meal.items.length > baseMeal.items.length) {
      for (const add of pathway.meal.items.slice(baseMeal.items.length)) {
        adviceNotes.push(`Aggiunta suggerita: ${add.name} (${add.portionHint})`);
      }
    }

    // La rotazione registra il pasto SERVITO (quello persistito), non quello ipotetico.
    registerMealCanonicalKeys(dayCtx, baseMeal);

    // Integrazione giornaliera: nota, non item — un integratore presente nel payload ma
    // assente da meal_item romperebbe l'invariante payload≡persistito (Nutrizione vs Oggi).
    const integrationItems = isRacePreLunch ? [] : dailyIntegrationPlan[slot.slot] ?? [];
    if (integrationItems.length > 0) {
      adviceNotes.push(
        `Integrazione: ${integrationItems.map((it) => `${it.name} (${it.portionHint})`).join(", ")}`,
      );
    }

    const groupTitles = (slotReq?.functionalFoodGroups ?? []).map((g) => g.displayNameIt).join(" · ");
    const bridgePrefix = groupTitles
      ? `Target funzionali (solver): ${groupTitles.slice(0, 180)}${groupTitles.length > 180 ? "…" : ""}. `
      : "";
    // SOLO testo: item, grammi e approxKcal passano invariati (sono quelli persistiti).
    const items = slot.items.map((it) => ({
      ...it,
      functionalBridge: `${bridgePrefix}${it.functionalBridge}`.slice(0, 500),
    }));

    const timing =
      (slotReq?.functionalFoodGroups ?? []).find((g) => g.timingHalfLifeHint.trim())?.timingHalfLifeHint ??
      request.pathwayTimingLines[0] ??
      (slot.slotTimingRationale ||
        `Orario pasto ${slotReq?.scheduledTimeLocal || "—"}; allinea al carico del giorno.`);

    const baseCoherence = isRacePreLunch
      ? racePreLunchContextLine(request.racePreLunch!)
      : groupTitles
        ? `Combinazione solver + funzionale: target ${slot.targetKcalEcho} kcal con priorità a ${groupTitles.slice(0, 260)}`
        : `Pasto strutturato su target Diet: ${slot.targetKcalEcho} kcal; porzioni da staple sportivi.`;

    const slotBoostNote =
      adviceNotes.length > 0 ? `Suggerimenti pathway: ${adviceNotes.slice(0, 3).join(" | ")}` : undefined;

    return {
      ...slot,
      items,
      slotCoherence: `${baseCoherence}${slotBoostNote ? ` · ${slotBoostNote}` : ""}`.slice(0, 480),
      slotTimingRationale: timing.slice(0, 400),
      boostNote: slotBoostNote,
    };
  });
}

export function pathwayBoostStatusFromRequest(
  request: IntelligentMealPlanRequest,
): IntelligentMealPlanAssembledCore["pathwayBoostStatus"] {
  const valid = request.nutrientBoostTargets ? selectValidBoostTargets(request.nutrientBoostTargets) : [];
  return valid.length > 0 ? "applied" : undefined;
}

export function dayInteractionSummaryExtras(
  request: IntelligentMealPlanRequest,
  engineNote?: string,
  /** Totale kcal degli slot SERVITI (composer V2): senza, resta l'eco del solver legacy. */
  servedMealsKcalTotal?: number,
): string {
  const validBoostTargets = request.nutrientBoostTargets ? selectValidBoostTargets(request.nutrientBoostTargets) : [];
  const mealsKcalTotal =
    servedMealsKcalTotal != null && Number.isFinite(servedMealsKcalTotal)
      ? Math.round(servedMealsKcalTotal)
      : request.mealPlanSolverMeta.dailyMealsKcalTotal;
  const bits = [
    engineNote,
    `Σ pasti solver: ${mealsKcalTotal} kcal/giorno`,
    validBoostTargets.length > 0 ? `Cofactors attivi: ${validBoostTargets.map((t) => t.labelIt).join(", ")}` : null,
    request.routineDigest,
  ].filter((s): s is string => Boolean(s?.trim()));
  return bits.join(" · ").slice(0, 820);
}

export type { MealSlotKey };
