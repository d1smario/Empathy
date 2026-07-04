"use client";

import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { NutritionPlanDatePicker } from "@/components/nutrition/NutritionPlanDatePicker";
import { round } from "@/lib/nutrition/nutrition-view-helpers";
import {
  NutritionMealPlanDailyTargets,
  NutritionMealPlanLeadPanels,
  NutritionMealPlanWorkspace,
  type MealPlanDisplayRow,
  type NutritionMealPlanEnergyLedger,
  type NutritionMealPlanStateTone,
} from "@/modules/nutrition/views/NutritionMealPlanView";
import type {
  FunctionalFoodRecommendationsViewModel,
  NutritionApplicationDirectiveViewModel,
  NutritionPathwayModulationViewModel,
} from "@/api/nutrition/contracts";
import type { AdaptationSectorBoxVm } from "@/lib/adaptation/adaptation-sector-box";
import type { NutritionMicronutrientGridProps } from "@/modules/nutrition/components/NutritionMicronutrientGrid";
import type { IntelligentMealPlanResponseBody, MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import type { MealPathwaySlotBundle } from "@/modules/nutrition/types/meal-pathway-slot-bundle";
import type { RacePreLunchDayContext } from "@/lib/nutrition/race-day-pre-race-lunch";

/**
 * Sezione "Meal plan" di NutritionPageView (decomposizione del God-component).
 * Consolida i cinque blocchi interlacciati che nel padre erano gated da
 * `subRoute === "meal-plan"`: azione genera-piano (B1), anchor subnav (B2),
 * target del giorno (B3), workspace pasti (B4) e pannelli approfondimenti (B5).
 * Il padre la renderizza già gated dal subRoute, quindi qui non si ri-controlla
 * `subRoute`; i blocchi B1/B4/B5 restano avvolti dal gate `athleteId`.
 * Render puro: riceve stato, setter e derive dal padre come props read-only.
 * Lo stato e il compute restano nel padre — qui solo presentazione.
 *
 * NB: il selettore di contesto per le altre aree (`subRoute !== "meal-plan"`) e
 * i frammenti meal-plan dentro gli accordion più in basso in NutritionPageView
 * NON fanno parte di questa estrazione e restano nel padre.
 */
export type MealPlanSectionProps = {
  athleteId: string | null;
  role: string;
  selectedPlanDate: string;
  setSelectedPlanDate: Dispatch<SetStateAction<string>>;
  platformAdminView: boolean;
  intelligentMealLoading: boolean;
  intelligentMealError: string | null;
  intelligentMealPlan: IntelligentMealPlanResponseBody | null;
  setIntelligentMealPlan: Dispatch<SetStateAction<IntelligentMealPlanResponseBody | null>>;
  intelligentMealPlanRequest: unknown;
  mealPlanGenerationReady: boolean;
  handleGenerateIntelligentMealPlan: () => Promise<void>;
  mealRows: unknown[];
  lowMealsBudgetWarning: { meals: number; train: number } | null;
  setCoachMealRemovalKeys: Dispatch<SetStateAction<Set<string>>>;
  setCoachSessionFoodExclusions: Dispatch<SetStateAction<string[]>>;
  coachMealRemovalKeys: Set<string>;
  coachSessionFoodExclusions: string[];
  complianceOverview: { target: { kcal: number; carbs: number; protein: number; fat: number } };
  selectedPlanDateLabel: string;
  hydrationPlan: { minDailyMl: number };
  selectedExecutedKj: number;
  nutritionDayModel: { training: { kcal: number } } | null;
  effectiveDayContext: { summary: { totalKcal: number } };
  mealPlanEnergyLedger: NutritionMealPlanEnergyLedger | null;
  mealPlanWorkspaceRows: MealPlanDisplayRow[];
  mealDisplayByKey: Map<MealSlotKey, MealPlanDisplayRow>;
  mealPathwayBySlot: Partial<Record<string, MealPathwaySlotBundle>>;
  pathwayModulation: NutritionPathwayModulationViewModel | null;
  nutritionApplicationDirective: NutritionApplicationDirectiveViewModel | null;
  effectiveFunctionalMealSelector: { notes: string[] } | null;
  raceDayPreRaceContext: RacePreLunchDayContext | null;
  suppressedSnackSlots: string[];
  effectiveMealCountMode: string;
  resolvedDietDay: { weekDayKey: string };
  removeCoachMealPlanItem: (slot: MealSlotKey, index: number, foodLabel: string) => void;
  persistFoodExclusionToProfile: (slot: MealSlotKey, index: number, label: string) => void | Promise<void>;
  profileFoodExcludeBusy: string | null;
  mealTabMicronutrientProps: NutritionMicronutrientGridProps;
  nutritionStateCards: Array<{ label: string; value: string; tone: NutritionMealPlanStateTone }>;
  saving: boolean;
  handleSaveNutrition: () => void;
  nutritionSectorBoxes: AdaptationSectorBoxVm[];
  functionalFoodRecommendations: FunctionalFoodRecommendationsViewModel;
};

export function MealPlanSection({
  athleteId,
  role,
  selectedPlanDate,
  setSelectedPlanDate,
  platformAdminView,
  intelligentMealLoading,
  intelligentMealError,
  intelligentMealPlan,
  setIntelligentMealPlan,
  intelligentMealPlanRequest,
  mealPlanGenerationReady,
  handleGenerateIntelligentMealPlan,
  mealRows,
  lowMealsBudgetWarning,
  setCoachMealRemovalKeys,
  setCoachSessionFoodExclusions,
  coachMealRemovalKeys,
  coachSessionFoodExclusions,
  complianceOverview,
  selectedPlanDateLabel,
  hydrationPlan,
  selectedExecutedKj,
  nutritionDayModel,
  effectiveDayContext,
  mealPlanEnergyLedger,
  mealPlanWorkspaceRows,
  mealDisplayByKey,
  mealPathwayBySlot,
  pathwayModulation,
  nutritionApplicationDirective,
  effectiveFunctionalMealSelector,
  raceDayPreRaceContext,
  suppressedSnackSlots,
  effectiveMealCountMode,
  resolvedDietDay,
  removeCoachMealPlanItem,
  persistFoodExclusionToProfile,
  profileFoodExcludeBusy,
  mealTabMicronutrientProps,
  nutritionStateCards,
  saving,
  handleSaveNutrition,
  nutritionSectorBoxes,
  functionalFoodRecommendations,
}: MealPlanSectionProps) {
  const t = useTranslations("MealPlanSection");
  return (
    <>
      {athleteId ? (
        <section
          id="mod-azione-giorno"
          className="viz-card builder-panel scroll-mt-28 border border-amber-500/25 bg-black/20 px-4 py-4 sm:px-5"
          style={{ marginBottom: "12px" }}
        >
          <h2 className="viz-title text-base">{t("dayPlanTitle")}</h2>
          <p className="mt-1 text-sm text-gray-400">
            {t("dayPlanDescription")}
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <NutritionPlanDatePicker
              value={selectedPlanDate}
              onChange={setSelectedPlanDate}
              minOffsetDays={-400}
              maxOffsetDays={400}
              className="w-full"
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {/* Generazione piano: azione riservata allo staff (admin). Nascosta ad atleta e coach. */}
              {platformAdminView ? (
                <>
                  <button
                    type="button"
                    className="btn-nutrition-cta"
                    disabled={
                      intelligentMealLoading ||
                      !(mealRows.length > 0 && Boolean(intelligentMealPlanRequest) && mealPlanGenerationReady)
                    }
                    onClick={() => void handleGenerateIntelligentMealPlan()}
                  >
                    {intelligentMealLoading ? t("generatingPlan") : t("generatePlanCta")}
                  </button>
                  {intelligentMealPlan ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gray-300 transition-colors hover:border-amber-400/50 hover:bg-amber-500/10"
                      onClick={() => {
                        setIntelligentMealPlan(null);
                        setCoachMealRemovalKeys(new Set());
                        setCoachSessionFoodExclusions([]);
                      }}
                    >
                      {t("regeneratePlan")}
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
          {lowMealsBudgetWarning ? (
            <div
              className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/95"
              role="status"
            >
              {t.rich("lowMealsBudgetWarning", {
                meals: Math.round(lowMealsBudgetWarning.meals),
                train: Math.round(lowMealsBudgetWarning.train),
                b: (chunks) => <strong className="font-semibold">{chunks}</strong>,
                s1: (chunks) => <span className="font-medium">{chunks}</span>,
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Macro/kcal del giorno: UN dato in UN solo posto. La barra di ancore
          in-page è stata rimossa (feedback utente 2026-07: la pagina scorre,
          le sezioni si susseguono senza bisogno di un secondo menù). */}
      <section id="mod-target-giorno" className="viz-card builder-panel scroll-mt-28" style={{ marginBottom: "12px" }}>
        <NutritionMealPlanDailyTargets
          complianceTargets={{
            kcal: complianceOverview.target.kcal,
            carbs: complianceOverview.target.carbs,
            protein: complianceOverview.target.protein,
            fat: complianceOverview.target.fat,
          }}
          dateLabel={selectedPlanDateLabel}
          hydrationMinDailyMl={hydrationPlan.minDailyMl}
          selectedExecutedKj={selectedExecutedKj}
          sessionLoadKcalEstimate={Math.max(
            nutritionDayModel?.training.kcal ?? 0,
            effectiveDayContext.summary.totalKcal,
          )}
          round={round}
          energyLedger={mealPlanEnergyLedger}
        />
      </section>

      {athleteId ? (
        <NutritionMealPlanWorkspace
          athleteId={athleteId}
          role={role}
          mealPlanDisplayRows={mealPlanWorkspaceRows}
          mealDisplayByKey={mealDisplayByKey}
          mealPathwayBySlot={mealPathwayBySlot}
          pathwayModulation={pathwayModulation}
          nutritionApplicationDirective={nutritionApplicationDirective}
          functionalMealSelectorNotes={effectiveFunctionalMealSelector?.notes ?? null}
          intelligentMealPlan={intelligentMealPlan}
          intelligentMealLoading={intelligentMealLoading}
          intelligentMealError={intelligentMealError}
          canRequestIntelligentPlan={
            mealRows.length > 0 && Boolean(intelligentMealPlanRequest) && mealPlanGenerationReady
          }
          mealPathwayCatalogPending={
            Boolean(intelligentMealPlanRequest) && !mealPlanGenerationReady
          }
          raceDayPreRaceNotice={
            raceDayPreRaceContext
              ? t("raceDayPreRaceNotice", {
                  meal: raceDayPreRaceContext.mealSlot === "breakfast" ? t("mealBreakfast") : t("mealLunch"),
                  time: raceDayPreRaceContext.lunchTimeLocal,
                  carbs: raceDayPreRaceContext.rule.carbsPerKgG,
                })
              : null
          }
          dietDayNotice={
            mealRows.length > 0
              ? [
                  suppressedSnackSlots.length > 0
                    ? t("snacksInTrainingWindow", { slots: suppressedSnackSlots.join(", ") })
                    : null,
                  mealRows.length < 6 && effectiveMealCountMode === "6"
                    ? t("sixMealsExpected")
                    : intelligentMealPlan && intelligentMealPlan.slots.length < mealRows.length
                      ? t("fewerSlotsThanDiet")
                      : null,
                ]
                  .filter(Boolean)
                  .join(" ")
              : t("noReadableSplit", { weekDayKey: resolvedDietDay.weekDayKey })
          }
          coachMealRemovalKeys={coachMealRemovalKeys}
          coachSessionFoodExclusions={coachSessionFoodExclusions}
          onCoachShowAllItems={() => setCoachMealRemovalKeys(new Set())}
          onCoachClearSessionExclusions={() => setCoachSessionFoodExclusions([])}
          removeCoachMealPlanItem={removeCoachMealPlanItem}
          persistFoodExclusionToProfile={persistFoodExclusionToProfile}
          profileFoodExcludeBusy={profileFoodExcludeBusy}
          mealTabMicronutrientProps={mealTabMicronutrientProps}
          nutritionStateCards={nutritionStateCards}
          saving={saving}
          onSaveNutrition={handleSaveNutrition}
        />
      ) : null}

      {/* Approfondimenti del giorno: sezioni avanzate collassate di default. */}
      {athleteId ? (
        <section id="mod-approfondimenti" className="scroll-mt-28" style={{ marginBottom: "12px" }}>
          <NutritionMealPlanLeadPanels
            nutritionSectorBoxes={nutritionSectorBoxes}
            pathwayModulation={pathwayModulation}
            functionalFoodRecommendations={functionalFoodRecommendations}
          />
        </section>
      ) : null}
    </>
  );
}
