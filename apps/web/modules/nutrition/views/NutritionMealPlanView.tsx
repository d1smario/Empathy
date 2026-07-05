"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { AdaptationSectorStrip } from "@/components/nutrition/AdaptationSectorStrip";
import { NutritionDayKpiStrip } from "@/components/nutrition/NutritionDayKpiStrip";
import { Pro2Accordion } from "@/components/ui/empathy";
import type {
  FoodDiaryEntryViewModel,
  FunctionalFoodRecommendationsViewModel,
  NutritionApplicationDirectiveViewModel,
  NutritionPathwayModulationViewModel,
} from "@/api/nutrition/contracts";
import type { AdaptationSectorBoxVm } from "@/lib/adaptation/adaptation-sector-box";
import {
  NutritionMicronutrientDailyBoard,
  mealPlanDayTotalsToMicroLines,
  type NutritionMicronutrientGridProps,
} from "@/modules/nutrition/components/NutritionMicronutrientGrid";
import type { IntelligentMealPlanResponseBody, MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { sumVisibleSlotMacros } from "@/lib/nutrition/meal-exposition-helpers";
import {
  buildExpositionItemsFromPlan,
  EmpathyMealPlanExpositionCard,
} from "@/modules/nutrition/components/EmpathyMealPlanExpositionCard";
import { HydrationDayCard } from "@/modules/nutrition/components/HydrationDayCard";
import {
  MealDayCarousel,
  sortMealCarouselItemsByTime,
  type MealCarouselItem,
} from "@/modules/nutrition/components/MealDayCarousel";
import type { MealPathwaySlotBundle } from "@/modules/nutrition/types/meal-pathway-slot-bundle";
import type { PathwayMealSlotKey } from "@/lib/nutrition/pathway-meal-usda-slots";

export type MealPlanDisplayRow = {
  key: string;
  label: string;
  time: string;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  portionHint?: string;
};

export type NutritionMealPlanStateTone = "amber" | "cyan" | "green" | "rose" | "slate";

export type NutritionMealPlanEnergyLedger = {
  /** BMR + lifestyle + quota training destinata ai pasti (solver). */
  mealsKcalSolver: number | null;
  /** BMR + lifestyle + costo training completo (include parte gestita come fueling). */
  dailyKcalSolver: number | null;
  /** Parte del costo training allocata a pre/intra/post (non nei cinque slot pasto). */
  fuelingKcalSolver: number | null;
  /** Costo training pianificato del giorno (allineato al calendario/Builder; sostituito dall'eseguito quando importato). */
  trainingKcalSolver: number | null;
  /** Somma kcal voci USDA del piano generato (esclude voci coach nascoste). */
  assembledUsdaKcalSum: number | null;
};

export type NutritionMealPlanDailyTargetsProps = {
  complianceTargets: { kcal: number; carbs: number; protein: number; fat: number };
  dateLabel: string;
  /** Assunto del giorno dal registro diario (Diario eliminato 2026-07: vive sul Piano). */
  dayConsumed?: { kcal: number; carbs: number; protein: number; fat: number; count: number } | null;
  round: (v: number, digits?: number) => number;
  /** Chiarimento 3954 vs 3555: pasti vs giornata vs fueling vs assemblaggio USDA. */
  energyLedger?: NutritionMealPlanEnergyLedger | null;
};

/** Blocco KPI giornaliero: UNICO posto dei macro/kcal del giorno (sezione `mod-target-giorno`, dopo il selettore giorno). */
export function NutritionMealPlanDailyTargets({
  complianceTargets,
  dateLabel,
  dayConsumed,
  round,
  energyLedger,
}: NutritionMealPlanDailyTargetsProps) {
  const t = useTranslations("NutritionMealPlanView");
  const { role: viewerRole, adminScoped } = useActiveAthlete();
  /** Bilancio kcal (solver / Σ USDA / BMR): dettaglio motore, solo coach/admin. */
  const showTech = viewerRole === "coach" || adminScoped;
  const slotSumKcal = round(complianceTargets.kcal);
  const ledger = energyLedger ?? null;
  const showLedger =
    showTech &&
    ledger &&
    (ledger.mealsKcalSolver != null ||
      ledger.dailyKcalSolver != null ||
      ledger.fuelingKcalSolver != null ||
      ledger.assembledUsdaKcalSum != null);

  return (
    <div>
      <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("dailyTarget")}</p>
      <NutritionDayKpiStrip
        targets={{
          kcal: complianceTargets.kcal,
          carbsG: complianceTargets.carbs,
          proteinG: complianceTargets.protein,
          fatG: complianceTargets.fat,
        }}
        dateLabel={dateLabel}
      />
      {showLedger ? (
        <div
          className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-gray-400"
          role="region"
          aria-label={t("dailyEnergyBalanceAria")}
        >
          <p className="mb-1.5 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("kcalBalanceHeading")}</p>
          <ul className="m-0 list-none space-y-1 p-0 font-mono">
            <li>
              <span className="text-gray-500">{t("mealSlotsSum")}</span>{" "}
              <span className="font-semibold tabular-nums text-white">{slotSumKcal} kcal</span>
            </li>
            {ledger.mealsKcalSolver != null ? (
              <li>
                <span className="text-gray-500">{t("solverMealsTarget")}</span>{" "}
                <span className="font-semibold tabular-nums text-white">{round(ledger.mealsKcalSolver)} kcal</span>
              </li>
            ) : null}
            {ledger.fuelingKcalSolver != null ? (
              <li>
                <span className="text-gray-500">{t("fuelingShare")}</span>{" "}
                <span className="font-semibold tabular-nums text-white">{round(ledger.fuelingKcalSolver)} kcal</span>
              </li>
            ) : null}
            {ledger.dailyKcalSolver != null ? (
              <li>
                <span className="text-gray-500">{t("dailyMetabolicTotal")}</span>{" "}
                <span className="font-semibold tabular-nums text-white">{round(ledger.dailyKcalSolver)} kcal</span>
              </li>
            ) : null}
            {ledger.trainingKcalSolver != null && ledger.trainingKcalSolver > 0 ? (
              <li>
                <span className="text-gray-500">{t("plannedTrainingCost")}</span>{" "}
                <span className="tabular-nums text-gray-300">{round(ledger.trainingKcalSolver)} kcal</span>
              </li>
            ) : null}
            {ledger.assembledUsdaKcalSum != null ? (
              <li>
                <span className="text-gray-500">{t("assembledUsdaSum")}</span>{" "}
                <span className="font-semibold tabular-nums text-white">{round(ledger.assembledUsdaKcalSum)} kcal</span>
                {ledger.mealsKcalSolver != null && ledger.mealsKcalSolver > 0 ? (
                  ledger.assembledUsdaKcalSum < ledger.mealsKcalSolver - 60 ? (
                    <span className="block pt-1 text-[10px] text-amber-300/90">
                      {t("belowSolverTarget")}
                    </span>
                  ) : ledger.assembledUsdaKcalSum > ledger.mealsKcalSolver + 120 ? (
                    <span className="block pt-1 text-[10px] text-gray-500">
                      {t("aboveSolverTarget")}
                    </span>
                  ) : null
                ) : null}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
      {/* Assunto vs rimanente del giorno (portato dal Diario, 2026-07): quello
          che registri dal carosello si riflette QUI, non su un'altra pagina.
          L'idratazione minima è migrata nella card «Quanto bere oggi». */}
      {dayConsumed && dayConsumed.count > 0 ? (
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <span className="text-gray-400">
            {t("consumedSoFar")}{" "}
            <span className="font-mono font-bold tabular-nums text-emerald-300">{dayConsumed.kcal} kcal</span>{" "}
            <span className="font-mono tabular-nums text-gray-500">
              · C {dayConsumed.carbs}g · P {dayConsumed.protein}g · F {dayConsumed.fat}g
            </span>
          </span>
          <span className="text-gray-400">
            {complianceTargets.kcal - dayConsumed.kcal >= 0 ? (
              <>
                {t("remainingToday")}{" "}
                <span className="font-mono font-bold tabular-nums text-cyan-200">
                  {round(complianceTargets.kcal - dayConsumed.kcal)} kcal
                </span>
              </>
            ) : (
              <>
                {t("overTarget")}{" "}
                <span className="font-mono font-bold tabular-nums text-amber-300">
                  +{round(dayConsumed.kcal - complianceTargets.kcal)} kcal
                </span>
              </>
            )}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export type NutritionMealPlanLeadPanelsProps = {
  nutritionSectorBoxes: AdaptationSectorBoxVm[];
  pathwayModulation: NutritionPathwayModulationViewModel | null;
  functionalFoodRecommendations: FunctionalFoodRecommendationsViewModel;
};

/** Approfondimenti del giorno (adattamento + pillole funzionali): collassati di default per canone Pro2. */
export function NutritionMealPlanLeadPanels({
  nutritionSectorBoxes,
  functionalFoodRecommendations,
}: NutritionMealPlanLeadPanelsProps) {
  const t = useTranslations("NutritionMealPlanView");
  const router = useRouter();
  const { adminScoped } = useActiveAthlete();
  return (
    <Pro2Accordion
      accent="amber"
      title={t("leadPanelsTitle")}
      subtitle={t("leadPanelsSubtitle")}
    >
      <div className="space-y-3">
        <AdaptationSectorStrip title={t("sectorsAdaptationDay")} boxes={nutritionSectorBoxes} />

        {functionalFoodRecommendations.targets.length ? (
          <div style={{ fontSize: "0.8rem" }}>
            <strong>{t("adaptivePills")}</strong>
            <span className="nutrition-muted"> {t("adaptivePillsSuffix")} </span>
            <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "4px", verticalAlign: "middle" }}>
              {functionalFoodRecommendations.targets.slice(0, 8).map((t) => (
                <span
                  key={t.nutrientId}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gray-300"
                  title={t.rationaleIt}
                >
                  {t.displayNameIt.split("(")[0].trim()}
                </span>
              ))}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-amber-300 transition-colors hover:border-amber-400/50 hover:bg-amber-500/20"
              style={{ marginLeft: "8px", cursor: "pointer" }}
              onClick={() => {
                if (adminScoped) return; // nelle schede admin niente navigazione cross-shell
                router.push("/nutrition/integration");
              }}
            >
              {t("goToIntegration")}
            </button>
          </div>
        ) : null}
      </div>
    </Pro2Accordion>
  );
}

export type NutritionMealPlanWorkspaceProps = {
  athleteId: string;
  role: string;
  /** Pasti attivi da Profile Diet (ordine + budget kcal); unica fonte ripartizione calorica. */
  mealPlanDisplayRows: MealPlanDisplayRow[];
  mealDisplayByKey: Map<MealSlotKey, MealPlanDisplayRow>;
  mealPathwayBySlot: Partial<Record<string, MealPathwaySlotBundle>>;
  pathwayModulation: NutritionPathwayModulationViewModel | null;
  /** Da `GET /api/nutrition/module` — allineato al selettore funzionale e alle contextLines del piano. */
  nutritionApplicationDirective: NutritionApplicationDirectiveViewModel | null;
  /** Note complete del selettore (incl. direttiva / patch / integrazione). */
  functionalMealSelectorNotes: string[] | null;
  intelligentMealPlan: IntelligentMealPlanResponseBody | null;
  intelligentMealLoading: boolean;
  intelligentMealError: string | null;
  canRequestIntelligentPlan: boolean;
  /** True mentre i fetch USDA per i 5 slot non sono completati (il pulsante resta disabilitato). */
  mealPathwayCatalogPending?: boolean;
  /** Se Diet non è configurato per il giorno della data selezionata. */
  dietDayNotice?: string | null;
  /** Giornata gara: regola fissa pasta/riso T−3 h (non dipende da USDA pathway). */
  raceDayPreRaceNotice?: string | null;
  coachMealRemovalKeys: Set<string>;
  coachSessionFoodExclusions: string[];
  onCoachShowAllItems: () => void;
  onCoachClearSessionExclusions: () => void;
  removeCoachMealPlanItem: (slot: MealSlotKey, index: number, label: string) => void;
  persistFoodExclusionToProfile: (slot: MealSlotKey, index: number, label: string) => void | Promise<void>;
  profileFoodExcludeBusy: string | null;
  mealTabMicronutrientProps: NutritionMicronutrientGridProps;
  nutritionStateCards: Array<{ label: string; value: string; tone: NutritionMealPlanStateTone }>;
  /** Companion di giornata: conferme consumo per pasto + quick-add extra (carosello). */
  selectedPlanDate: string;
  mealConfirmations: Record<string, { confirmed?: boolean; at?: string }>;
  mealConfirmBusySlot: string | null;
  persistMealConfirmation: (slotKey: string, nextConfirmed: boolean) => void | Promise<void>;
  onMealExtraSaved: () => void;
  /** Registro diario del giorno (mini-registro per pasto, Diario eliminato 2026-07). */
  dayDiaryEntries: FoodDiaryEntryViewModel[];
  onDeleteDiaryEntry: (entryId: string) => void | Promise<void>;
  diaryEntryDeleteBusyId: string | null;
  /** Idratazione: minimo del giorno + contatore bevuto (card «Quanto bere oggi»). */
  hydrationMinDailyMl: number;
  hydrationIntakeMl: number;
  onAddHydrationIntake: (deltaMl: number) => void;
  hydrationIntakeBusy: boolean;
};

export function NutritionMealPlanWorkspace({
  athleteId,
  role,
  mealPlanDisplayRows,
  mealDisplayByKey,
  mealPathwayBySlot,
  pathwayModulation,
  nutritionApplicationDirective,
  functionalMealSelectorNotes,
  intelligentMealPlan,
  intelligentMealLoading,
  intelligentMealError,
  canRequestIntelligentPlan,
  mealPathwayCatalogPending = false,
  dietDayNotice = null,
  raceDayPreRaceNotice = null,
  coachMealRemovalKeys,
  coachSessionFoodExclusions,
  onCoachShowAllItems,
  onCoachClearSessionExclusions,
  removeCoachMealPlanItem,
  persistFoodExclusionToProfile,
  profileFoodExcludeBusy,
  mealTabMicronutrientProps,
  nutritionStateCards,
  selectedPlanDate,
  mealConfirmations,
  mealConfirmBusySlot,
  persistMealConfirmation,
  onMealExtraSaved,
  dayDiaryEntries,
  onDeleteDiaryEntry,
  diaryEntryDeleteBusyId,
  hydrationMinDailyMl,
  hydrationIntakeMl,
  onAddHydrationIntake,
  hydrationIntakeBusy,
}: NutritionMealPlanWorkspaceProps) {
  const t = useTranslations("NutritionMealPlanView");
  const router = useRouter();
  const { role: viewerRole, adminScoped } = useActiveAthlete();

  /** Slot diario per slot piano: gli snack del piano collassano su "snack" (contratto POST diary). */
  const diaryEntriesForSlot = (slotKey: string) => {
    const diarySlot = slotKey.startsWith("snack")
      ? "snack"
      : ["breakfast", "lunch", "dinner"].includes(slotKey)
        ? slotKey
        : "other";
    return dayDiaryEntries
      .filter((e) => e.mealSlot === diarySlot)
      .map((e) => ({ id: e.id, label: e.foodLabel, quantityG: e.quantityG, kcal: e.kcal }));
  };
  /** Numeri/etichette motore (solver/composer/pathway/planDate, cache USDA): solo coach/admin. */
  const showTech = viewerRole === "coach" || adminScoped;
  const mealPlanMicroBoardProps = intelligentMealPlan?.nutrientRollup?.dayTotals
    ? mealPlanDayTotalsToMicroLines(intelligentMealPlan.nutrientRollup.dayTotals)
    : mealTabMicronutrientProps;

  return (
    <>
      <section id="nutrition-meal-plan" className="scroll-mt-28 mb-10 space-y-4">
        <section className="viz-card builder-panel" style={{ marginBottom: "12px" }}>
          <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("mealPlanSelectedDay")}</p>
          {mealPathwayCatalogPending ? (
            <p className="mb-3 text-xs text-gray-500">{t("loadingUsdaIntegration")}</p>
          ) : null}
          {raceDayPreRaceNotice ? (
            <p className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100" role="status">
              {raceDayPreRaceNotice}
            </p>
          ) : null}
          {dietDayNotice ? (
            <p className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100" role="status">
              {dietDayNotice}
            </p>
          ) : null}
          {intelligentMealError ? (
            <div className="alert-error" style={{ marginBottom: 10, fontSize: 13 }}>
              {intelligentMealError}
              {/\b503\b|timeout|ECONNRESET/i.test(intelligentMealError)
                ? t("serverUnavailableSuffix")
                : null}
            </div>
          ) : null}
          {intelligentMealPlan?.pathwayBoostStatus === "usda_cache_miss" ? (
            <div
              className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] leading-relaxed text-amber-100/90"
              role="status"
            >
              {t("foodCatalogUpdating")}
              {showTech ? (
                <span className="mt-1 block text-[11px] text-amber-200/70">
                  {t("pathwayActiveCacheMiss")}
                </span>
              ) : null}
            </div>
          ) : null}
          {showTech && intelligentMealPlan?.pathwayTargetRollup?.length ? (
            <div
              className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] leading-relaxed text-gray-200"
              role="status"
            >
              <p className="mb-2 font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-amber-400">{t("pathwayTargetVsRollup")}</p>
              <ul className="mb-0 grid gap-1 sm:grid-cols-2">
                {intelligentMealPlan.pathwayTargetRollup.map((line) => (
                  <li key={line.nutrientId} className="flex items-baseline justify-between gap-2">
                    <span className="text-gray-300">{line.labelIt}</span>
                    <span className={`font-mono tabular-nums ${line.status === "met" ? "text-emerald-300" : "text-amber-300"}`}>
                      {line.dayValue} {line.unit} / ≥{line.floor} {line.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {intelligentMealPlan ? (
            <>
              {/* Companion a due colonne su desktop: pasti (carosello) a sinistra,
                  «quanto bere oggi» a destra. Una colonna sotto i 1280px. */}
              <div className={intelligentMealPlan.hydrationRoutine ? "empathy-plan-companion-grid" : undefined}>
              <div className="empathy-meal-plan-expo-shell" style={{ minWidth: 0 }}>
                {coachMealRemovalKeys.size > 0 || coachSessionFoodExclusions.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
                    <span className="muted-copy" style={{ fontSize: 12 }}>
                      {t("coachChangesHidden", { count: coachMealRemovalKeys.size })}
                      {coachSessionFoodExclusions.length ? t("coachExclusionsForRegen", { count: coachSessionFoodExclusions.length }) : ""}
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gray-300 transition-colors hover:border-amber-400/50 hover:bg-amber-500/10"
                      onClick={onCoachShowAllItems}
                    >
                      {t("showAllItems")}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gray-300 transition-colors hover:border-amber-400/50 hover:bg-amber-500/10"
                      onClick={onCoachClearSessionExclusions}
                    >
                      {t("clearSessionExclusions")}
                    </button>
                  </div>
                ) : null}
                {/* Carosello companion (2026-07): scorrimento orizzontale tra i pasti,
                    conferma di consumo sotto ogni card e quick-add «ho mangiato altro». */}
                <MealDayCarousel
                  items={sortMealCarouselItemsByTime(mealPlanDisplayRows.map((mealRow): MealCarouselItem => {
                    const slotKey = mealRow.key as MealSlotKey;
                    const sl = intelligentMealPlan.slots.find((s) => s.slot === slotKey);
                    const meta = intelligentMealPlan.solverBasis.slots.find((x) => x.slot === slotKey);
                    const isVis = (ii: number) => !coachMealRemovalKeys.has(`${slotKey}:${ii}`);
                    const fallback = {
                      kcal: meta?.targetKcal ?? 0,
                      carbsG: meta?.targetCarbsG ?? 0,
                      proteinG: meta?.targetProteinG ?? 0,
                      fatG: meta?.targetFatG ?? 0,
                    };
                    let card: ReactNode;
                    if (!sl) {
                      card = (
                        <EmpathyMealPlanExpositionCard
                          slot={slotKey}
                          titleUpper={(meta?.labelIt ?? mealRow.label).toUpperCase()}
                          subline={meta?.scheduledTimeLocal?.trim() || mealRow.time}
                          totalKcal={fallback.kcal}
                          carbsG={fallback.carbsG}
                          proteinG={fallback.proteinG}
                          fatG={fallback.fatG}
                          items={[]}
                        />
                      );
                    } else {
                      const itemTotals = sumVisibleSlotMacros(sl, isVis, fallback);
                      /** Header pasto: target % profilo (solver), non somma USDA delle voci (spesso sbilancia colazione vs pranzo). */
                      const totals = {
                        kcal: fallback.kcal > 0 ? fallback.kcal : itemTotals.kcal,
                        carbsG: fallback.carbsG > 0 ? fallback.carbsG : itemTotals.carbsG,
                        proteinG: fallback.proteinG > 0 ? fallback.proteinG : itemTotals.proteinG,
                        fatG: fallback.fatG > 0 ? fallback.fatG : itemTotals.fatG,
                      };
                      const expoItems = buildExpositionItemsFromPlan(sl.items, isVis);
                      card = (
                        <EmpathyMealPlanExpositionCard
                          slot={slotKey}
                          titleUpper={(meta?.labelIt ?? mealRow.label).toUpperCase()}
                          subline={meta?.scheduledTimeLocal?.trim() || mealRow.time}
                          totalKcal={totals.kcal}
                          carbsG={totals.carbsG}
                          proteinG={totals.proteinG}
                          fatG={totals.fatG}
                          items={expoItems}
                          boostNote={sl.boostNote}
                          integrationHref="/nutrition/integration"
                          showCoachControls={role === "coach"}
                          athleteId={athleteId}
                          profileFoodExcludeBusyLabel={profileFoodExcludeBusy}
                          onCoachRemove={(si) => {
                            const it = sl.items[si];
                            if (it) removeCoachMealPlanItem(slotKey, si, it.name);
                          }}
                          onCoachExcludeProfile={(si) => {
                            const it = sl.items[si];
                            if (it) void persistFoodExclusionToProfile(slotKey, si, it.name);
                          }}
                        />
                      );
                    }
                    return {
                      slotKey,
                      label: meta?.labelIt ?? mealRow.label,
                      time: meta?.scheduledTimeLocal?.trim() || mealRow.time,
                      confirmed: Boolean(mealConfirmations[slotKey]?.confirmed),
                      entries: diaryEntriesForSlot(slotKey),
                      card,
                    };
                  }))}
                  onConfirmMeal={(slot, next) => {
                    if (!adminScoped) void persistMealConfirmation(slot, next);
                  }}
                  confirmBusySlot={mealConfirmBusySlot}
                  extraAdd={adminScoped ? null : { athleteId, entryDate: selectedPlanDate, onSaved: onMealExtraSaved }}
                  onDeleteEntry={adminScoped ? undefined : (entryId) => void onDeleteDiaryEntry(entryId)}
                  deleteBusyId={diaryEntryDeleteBusyId}
                />
                {/* Legenda IG rimossa (feedback utente 2026-07): le pillole IG
                    sulle singole voci restano, la spiegazione statica no. */}
                {/* Σ kcal USDA assemblato: vive in UN solo posto, nel «Bilancio kcal» del target giornaliero. */}
              </div>
              {intelligentMealPlan.hydrationRoutine ? (
                <div className="empathy-plan-companion-aside">
                  <HydrationDayCard
                    routine={intelligentMealPlan.hydrationRoutine}
                    minDailyMl={hydrationMinDailyMl}
                    intakeMl={hydrationIntakeMl}
                    onAddIntake={adminScoped ? undefined : onAddHydrationIntake}
                    intakeBusy={hydrationIntakeBusy}
                  />
                </div>
              ) : null}
              </div>
              {/* «Avviso legale e note aggiuntive» rimosso (feedback utente 2026-07):
                  il disclaimer piattaforma vive in /termini, il rimando a Integratori
                  sta già in «Adattamento del giorno». */}
              {showTech ? (
              <details className="collapsible-card" style={{ marginBottom: 12 }}>
                <summary style={{ fontSize: 13, cursor: "pointer" }}>
                  {t("technicalNumbersSummary")}
                </summary>
                <div className="muted-copy" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.45 }}>
                  <p style={{ marginBottom: 8 }}>
                    {t.rich("planCombinesNote", {
                      b: (chunks) => <strong>{chunks}</strong>,
                      total: intelligentMealPlan.solverBasis.dailyMealsKcalTotal,
                      date: intelligentMealPlan.solverBasis.planDate,
                    })}
                  </p>
                  {intelligentMealPlan.solverBasis.profileConstraintLines.length ? (
                    <ul style={{ margin: "0 0 8px 18px" }}>
                      {intelligentMealPlan.solverBasis.profileConstraintLines.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  ) : null}
                  {intelligentMealPlan.solverBasis.pathwayModulationActiveLabels?.trim() ? (
                    <p style={{ marginBottom: 8 }}>
                      <strong>{t("activePathwayModulation")}</strong>:{" "}
                      {intelligentMealPlan.solverBasis.pathwayModulationActiveLabels.trim()}
                      {" · "}
                      <span className="text-gray-400">
                        {t("micronutrientBoostsNote")}
                      </span>
                    </p>
                  ) : null}
                  {intelligentMealPlan.solverBasis.integrationLeverLines.length ? (
                    <p style={{ marginBottom: 8 }}>
                      <strong>{t("operationalIntegration")}</strong>: {intelligentMealPlan.solverBasis.integrationLeverLines.join(" · ")}
                    </p>
                  ) : null}
                  {intelligentMealPlan.solverBasis.routineDigest ? (
                    <p style={{ marginBottom: 8 }}>
                      <strong>Routine</strong>: {intelligentMealPlan.solverBasis.routineDigest}
                    </p>
                  ) : null}
                  {intelligentMealPlan.solverBasis.trainingDayLines.length ? (
                    <p style={{ marginBottom: 8 }}>
                      <strong>{t("trainingForTheDay")}</strong>: {intelligentMealPlan.solverBasis.trainingDayLines.join(" | ")}
                    </p>
                  ) : null}
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 10 }}>
                    {intelligentMealPlan.solverBasis.slots.map((s) => (
                      <li key={s.slot}>
                        {s.labelIt} {s.scheduledTimeLocal ? `@ ${s.scheduledTimeLocal}` : ""}: {s.targetKcal} kcal · {s.targetCarbsG} CHO ·{" "}
                        {s.targetProteinG} PRO · {s.targetFatG} {t("fatUnit")}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
              ) : null}
            </>
          ) : null}
          {!intelligentMealPlan ? (
            <div className="empathy-meal-plan-expo-shell">
              <p className="mb-3 text-center text-[12px] leading-snug text-gray-400">
                {intelligentMealLoading
                  ? t("generatingMealPlan")
                  : canRequestIntelligentPlan
                    ? t("readyToGenerate")
                    : mealPathwayCatalogPending
                      ? t("loadingUsdaCatalog")
                      : t("profileDietRequired")}
              </p>
              {/* Scheletro card con solo i target del solver. Nessun item farlocco
                  (in passato il piano base distribuiva kcal_target/n_righe a ciascun
                  alimento, producendo numeri irrealistici tipo 1 banana = 320 kcal).
                  Stesso carosello del piano generato: conferme ed extra funzionano
                  anche prima della generazione (i target dei pasti sono noti). */}
              <MealDayCarousel
                items={sortMealCarouselItemsByTime(mealPlanDisplayRows.map((meal): MealCarouselItem => {
                  const slotKey = meal.key as PathwayMealSlotKey;
                  const bundle = mealPathwayBySlot[slotKey];
                  const subline = !bundle || bundle.loading
                    ? t("sublineLoadingPathways", { time: meal.time })
                    : intelligentMealLoading
                      ? t("sublineGenerationInProgress", { time: meal.time })
                      : meal.time;
                  return {
                    slotKey,
                    label: meal.label,
                    time: meal.time,
                    confirmed: Boolean(mealConfirmations[slotKey]?.confirmed),
                    entries: diaryEntriesForSlot(slotKey),
                    card: (
                      <EmpathyMealPlanExpositionCard
                        slot={slotKey}
                        titleUpper={meal.label.toUpperCase()}
                        subline={subline}
                        totalKcal={meal.kcal}
                        carbsG={meal.carbs}
                        proteinG={meal.protein}
                        fatG={meal.fat}
                        items={[]}
                      />
                    ),
                  };
                }))}
                onConfirmMeal={(slot, next) => {
                  if (!adminScoped) void persistMealConfirmation(slot, next);
                }}
                confirmBusySlot={mealConfirmBusySlot}
                extraAdd={adminScoped ? null : { athleteId, entryDate: selectedPlanDate, onSaved: onMealExtraSaved }}
                onDeleteEntry={adminScoped ? undefined : (entryId) => void onDeleteDiaryEntry(entryId)}
                deleteBusyId={diaryEntryDeleteBusyId}
              />
              <p className="muted-copy mt-3 text-center text-[11px] leading-snug text-gray-500">
                {t("metabolicPathwaysUsda")}{" "}
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 align-middle text-[11px] font-semibold text-gray-300 transition-colors hover:border-amber-400/50 hover:bg-amber-500/10"
                  onClick={() => {
                    if (adminScoped) return; // nelle schede admin niente navigazione cross-shell
                    router.push("/nutrition/integration");
                  }}
                >
                  {t("openIntegration")}
                </button>
              </p>
            </div>
          ) : null}
          {/* Micronutrienti SEMPRE aperti (feedback 2026-07: niente tendina). */}
          <div className="mt-4">
            <div className="mb-3">
              <h3 className="viz-title text-base">{t("micronutrientsTitle")}</h3>
              <p className="mt-0.5 text-xs text-gray-400">{t("micronutrientsSubtitle")}</p>
            </div>
            <section className="nutrition-report-shell">
              <div className="nutrition-meal-plan-micro">
                <NutritionMicronutrientDailyBoard {...mealPlanMicroBoardProps} />
              </div>
            </section>
            <div className="kpi-grid nutrition-score-grid" style={{ marginTop: 12 }}>
              {nutritionStateCards.map((card) => (
                <div key={card.label} className={`kpi-card signal-board-card tone-${card.tone} nutrition-score-card`}>
                  <div className="kpi-card-label">
                    <span className="signal-board-dot" />
                    {card.label}
                  </div>
                  <div className="kpi-card-value">{card.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>
      {/* Bottone «Salva configurazione nutrizione» spostato accanto alla
          Previsione (2026-07): salva le manopole previsione/fueling, che ora
          vivono nel Piano — in fondo ai pasti confondeva. */}
    </>
  );
}
