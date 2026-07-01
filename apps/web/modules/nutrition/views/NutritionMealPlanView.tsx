"use client";

import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { AdaptationSectorStrip } from "@/components/nutrition/AdaptationSectorStrip";
import { NutritionDayKpiStrip } from "@/components/nutrition/NutritionDayKpiStrip";
import { Pro2Accordion } from "@/components/ui/empathy";
import type {
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
  EmpathyMealPlanGlycemicLegend,
} from "@/modules/nutrition/components/EmpathyMealPlanExpositionCard";
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
  hydrationMinDailyMl: number;
  selectedExecutedKj: number;
  sessionLoadKcalEstimate: number;
  round: (v: number, digits?: number) => number;
  /** Chiarimento 3954 vs 3555: pasti vs giornata vs fueling vs assemblaggio USDA. */
  energyLedger?: NutritionMealPlanEnergyLedger | null;
};

/** Blocco KPI giornaliero: UNICO posto dei macro/kcal del giorno (sezione `mod-target-giorno`, dopo il selettore giorno). */
export function NutritionMealPlanDailyTargets({
  complianceTargets,
  dateLabel,
  hydrationMinDailyMl,
  selectedExecutedKj,
  sessionLoadKcalEstimate,
  round,
  energyLedger,
}: NutritionMealPlanDailyTargetsProps) {
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
      <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Daily target</p>
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
          aria-label="Daily energy balance"
        >
          <p className="mb-1.5 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">kcal balance · what you are summing</p>
          <ul className="m-0 list-none space-y-1 p-0 font-mono">
            <li>
              <span className="text-gray-500">Σ meal slots (grid above):</span>{" "}
              <span className="font-semibold tabular-nums text-white">{slotSumKcal} kcal</span>
            </li>
            {ledger.mealsKcalSolver != null ? (
              <li>
                <span className="text-gray-500">Solver meals target (BMR+lifestyle+training share on meals):</span>{" "}
                <span className="font-semibold tabular-nums text-white">{round(ledger.mealsKcalSolver)} kcal</span>
              </li>
            ) : null}
            {ledger.fuelingKcalSolver != null ? (
              <li>
                <span className="text-gray-500">Fueling share (pre/intra/post, not in meals):</span>{" "}
                <span className="font-semibold tabular-nums text-white">{round(ledger.fuelingKcalSolver)} kcal</span>
              </li>
            ) : null}
            {ledger.dailyKcalSolver != null ? (
              <li>
                <span className="text-gray-500">Daily metabolic total (BMR+lifestyle+training):</span>{" "}
                <span className="font-semibold tabular-nums text-white">{round(ledger.dailyKcalSolver)} kcal</span>
              </li>
            ) : null}
            {ledger.trainingKcalSolver != null && ledger.trainingKcalSolver > 0 ? (
              <li>
                <span className="text-gray-500">Planned training cost (Builder, aligned to calendar):</span>{" "}
                <span className="tabular-nums text-gray-300">{round(ledger.trainingKcalSolver)} kcal</span>
              </li>
            ) : null}
            {ledger.assembledUsdaKcalSum != null ? (
              <li>
                <span className="text-gray-500">Σ assembled USDA plan (food items):</span>{" "}
                <span className="font-semibold tabular-nums text-white">{round(ledger.assembledUsdaKcalSum)} kcal</span>
                {ledger.mealsKcalSolver != null && ledger.mealsKcalSolver > 0 ? (
                  ledger.assembledUsdaKcalSum < ledger.mealsKcalSolver - 60 ? (
                    <span className="block pt-1 text-[10px] text-amber-300/90">
                      Below the solver meals target: incomplete assembly or conservative portions — try regenerating the plan or reviewing the
                      items.
                    </span>
                  ) : ledger.assembledUsdaKcalSum > ledger.mealsKcalSolver + 120 ? (
                    <span className="block pt-1 text-[10px] text-gray-500">
                      Above the solver meals target: the USDA sum is indicative (approximate portions) and is not constrained slot-by-slot to the
                      solver&apos;s meal needs.
                    </span>
                  ) : null
                ) : null}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
      <p className="mt-2 text-xs text-gray-500">
        Minimum hydration: <span className="font-mono font-semibold tabular-nums text-gray-300">{hydrationMinDailyMl} ml</span>
        {" · "}
        {selectedExecutedKj > 0 ? (
          <>
            Session energy (kj): <span className="font-mono font-semibold tabular-nums text-gray-300">{round(selectedExecutedKj)} kJ</span>
          </>
        ) : (
          <>
            Session load estimate: <span className="font-mono font-semibold tabular-nums text-gray-300">{round(sessionLoadKcalEstimate)} kcal</span>
          </>
        )}
      </p>
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
  const router = useRouter();
  const { adminScoped } = useActiveAthlete();
  return (
    <Pro2Accordion
      accent="amber"
      title="Day adaptation and functional pills"
      subtitle="Adaptation sectors and suggestions from the day&apos;s signals"
    >
      <div className="space-y-3">
        <AdaptationSectorStrip title="Sectors · adaptation (day)" boxes={nutritionSectorBoxes} />

        {functionalFoodRecommendations.targets.length ? (
          <div style={{ fontSize: "0.8rem" }}>
            <strong>Adaptive nutritional pills</strong>
            <span className="nutrition-muted"> — functional suggestions from the day&apos;s signals: </span>
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
              Go to Integration
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
  saving: boolean;
  onSaveNutrition: () => void;
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
  saving,
  onSaveNutrition,
}: NutritionMealPlanWorkspaceProps) {
  const router = useRouter();
  const { role: viewerRole, adminScoped } = useActiveAthlete();
  /** Numeri/etichette motore (solver/composer/pathway/planDate, cache USDA): solo coach/admin. */
  const showTech = viewerRole === "coach" || adminScoped;
  const mealPlanMicroBoardProps = intelligentMealPlan?.nutrientRollup?.dayTotals
    ? mealPlanDayTotalsToMicroLines(intelligentMealPlan.nutrientRollup.dayTotals)
    : mealTabMicronutrientProps;

  return (
    <>
      <section id="nutrition-meal-plan" className="scroll-mt-28 mb-10 space-y-4">
        <section className="viz-card builder-panel" style={{ marginBottom: "12px" }}>
          <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Meal plan · selected day</p>
          {mealPathwayCatalogPending ? (
            <p className="mb-3 text-xs text-gray-500">Loading USDA integration for the day&apos;s meal slots… then you can generate the plan.</p>
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
                ? " — server temporarily unavailable or timed out: try again shortly."
                : null}
            </div>
          ) : null}
          {intelligentMealPlan?.pathwayBoostStatus === "usda_cache_miss" ? (
            <div
              className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] leading-relaxed text-amber-100/90"
              role="status"
            >
              Food catalog updating: the plan is complete, but some suggestions for more
              nutrient-rich foods may arrive shortly. Try again later.
              {showTech ? (
                <span className="mt-1 block text-[11px] text-amber-200/70">
                  Pathway active: food swaps applied in the plan, but the USDA cache (top foods ranking) is not
                  available.
                </span>
              ) : null}
            </div>
          ) : null}
          {showTech && intelligentMealPlan?.pathwayTargetRollup?.length ? (
            <div
              className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] leading-relaxed text-gray-200"
              role="status"
            >
              <p className="mb-2 font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-amber-400">Pathway · target vs day rollup</p>
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
              <div className="empathy-meal-plan-expo-shell">
                {coachMealRemovalKeys.size > 0 || coachSessionFoodExclusions.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
                    <span className="muted-copy" style={{ fontSize: 12 }}>
                      Coach changes: {coachMealRemovalKeys.size} items hidden
                      {coachSessionFoodExclusions.length ? ` · ${coachSessionFoodExclusions.length} exclusions for regeneration` : ""}
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gray-300 transition-colors hover:border-amber-400/50 hover:bg-amber-500/10"
                      onClick={onCoachShowAllItems}
                    >
                      Show all items
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gray-300 transition-colors hover:border-amber-400/50 hover:bg-amber-500/10"
                      onClick={onCoachClearSessionExclusions}
                    >
                      Clear session exclusions
                    </button>
                  </div>
                ) : null}
                <div className="empathy-meal-expo-grid">
                  {mealPlanDisplayRows.map((mealRow) => {
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
                    if (!sl) {
                      return (
                        <EmpathyMealPlanExpositionCard
                          key={slotKey}
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
                    }
                    const itemTotals = sumVisibleSlotMacros(sl, isVis, fallback);
                    /** Header pasto: target % profilo (solver), non somma USDA delle voci (spesso sbilancia colazione vs pranzo). */
                    const totals = {
                      kcal: fallback.kcal > 0 ? fallback.kcal : itemTotals.kcal,
                      carbsG: fallback.carbsG > 0 ? fallback.carbsG : itemTotals.carbsG,
                      proteinG: fallback.proteinG > 0 ? fallback.proteinG : itemTotals.proteinG,
                      fatG: fallback.fatG > 0 ? fallback.fatG : itemTotals.fatG,
                    };
                    const expoItems = buildExpositionItemsFromPlan(sl.items, isVis);
                    return (
                      <EmpathyMealPlanExpositionCard
                        key={slotKey}
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
                  })}
                </div>
                <EmpathyMealPlanGlycemicLegend />
                {/* Σ kcal USDA assemblato: vive in UN solo posto, nel «Bilancio kcal» del target giornaliero. */}
              </div>
              <details className="collapsible-card" style={{ marginBottom: 12 }}>
                <summary style={{ fontSize: 13, cursor: "pointer" }}>Legal notice and additional notes</summary>
                <p className="muted-copy" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>
                  {intelligentMealPlan.disclaimer}
                </p>
                <p className="muted-copy" style={{ fontSize: 12, lineHeight: 1.45 }}>
                  {intelligentMealPlan.dayInteractionSummary}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (adminScoped) return; // nelle schede admin niente navigazione cross-shell
                      router.push("/nutrition/integration");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-100 transition-colors hover:border-amber-400/50 hover:bg-amber-500/20"
                  >
                    <Zap className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
                    Go to Integration →
                  </button>
                  <span className="text-[10px] text-gray-500">
                    All operational details are collected in the Integration module.
                  </span>
                </div>
              </details>
              {showTech ? (
              <details className="collapsible-card" style={{ marginBottom: 12 }}>
                <summary style={{ fontSize: 13, cursor: "pointer" }}>
                  Technical numbers for the day (training, routine, target per meal)
                </summary>
                <div className="muted-copy" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.45 }}>
                  <p style={{ marginBottom: 8 }}>
                    This plan <strong>combines</strong> the grid targets (kcal/macros per meal from the daily model with the selected
                    session) with the assembly of food items. Σ meals kcal:{" "}
                    <strong>{intelligentMealPlan.solverBasis.dailyMealsKcalTotal}</strong> · date {intelligentMealPlan.solverBasis.planDate}
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
                      <strong>Active pathway modulation</strong>:{" "}
                      {intelligentMealPlan.solverBasis.pathwayModulationActiveLabels.trim()}
                      {" · "}
                      <span className="text-gray-400">
                        The micronutrient boosts in the notes follow the cofactors of these pathways, not the composer&apos;s food list.
                      </span>
                    </p>
                  ) : null}
                  {intelligentMealPlan.solverBasis.integrationLeverLines.length ? (
                    <p style={{ marginBottom: 8 }}>
                      <strong>Operational integration (solver)</strong>: {intelligentMealPlan.solverBasis.integrationLeverLines.join(" · ")}
                    </p>
                  ) : null}
                  {intelligentMealPlan.solverBasis.routineDigest ? (
                    <p style={{ marginBottom: 8 }}>
                      <strong>Routine</strong>: {intelligentMealPlan.solverBasis.routineDigest}
                    </p>
                  ) : null}
                  {intelligentMealPlan.solverBasis.trainingDayLines.length ? (
                    <p style={{ marginBottom: 8 }}>
                      <strong>Training for the day</strong>: {intelligentMealPlan.solverBasis.trainingDayLines.join(" | ")}
                    </p>
                  ) : null}
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 10 }}>
                    {intelligentMealPlan.solverBasis.slots.map((s) => (
                      <li key={s.slot}>
                        {s.labelIt} {s.scheduledTimeLocal ? `@ ${s.scheduledTimeLocal}` : ""}: {s.targetKcal} kcal · {s.targetCarbsG} CHO ·{" "}
                        {s.targetProteinG} PRO · {s.targetFatG} fat
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
              ) : null}
              {intelligentMealPlan.hydrationRoutine ? (
                <details className="collapsible-card" style={{ marginBottom: 12 }}>
                  <summary style={{ fontSize: 13, cursor: "pointer" }}>How much to drink today (water and salts) — detail</summary>
                  <p className="nutrition-muted" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.45 }}>
                    Estimated daily fluid target ~{intelligentMealPlan.hydrationRoutine.totalTargetMl} ml (baseline{" "}
                    {intelligentMealPlan.hydrationRoutine.baselineDailyMl} ml + training extra ~{intelligentMealPlan.hydrationRoutine.trainingExtraMl}{" "}
                    ml). Educational values, adapt to climate and sweat rate.
                  </p>
                  <div className="mt-2.5 overflow-x-auto">
                    <table className="w-full min-w-[560px] text-xs sm:min-w-[720px]">
                      <thead>
                        <tr>
                          <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Window</th>
                          <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Time</th>
                          <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Volume (ml)</th>
                          <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Na (mg)</th>
                          <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">K (mg)</th>
                          <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Mg (mg)</th>
                          <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {intelligentMealPlan.hydrationRoutine.windows.map((w, wi) => (
                          <tr key={`hyd-${wi}-${w.labelIt}`} className="transition-colors hover:bg-white/[0.03]">
                            <td className="px-3 py-2 text-gray-300">{w.labelIt}</td>
                            <td className="px-3 py-2 font-mono tabular-nums text-gray-300">{w.scheduledTimeLocal}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{w.volumeMl}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{w.sodiumMg}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{w.potassiumMg}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{w.magnesiumMg}</td>
                            <td className="max-w-[280px] px-3 py-2 text-gray-400">{w.notesIt}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ) : null}
            </>
          ) : null}
          {!intelligentMealPlan ? (
            <div className="empathy-meal-plan-expo-shell">
              <p className="mb-3 text-center text-[12px] leading-snug text-gray-400">
                {intelligentMealLoading
                  ? "Generating the meal plan aligned to your profile (deterministic calculation + USDA)…"
                  : canRequestIntelligentPlan
                    ? "Ready to generate the plan. Auto-generation in progress…"
                    : mealPathwayCatalogPending
                      ? "Loading USDA catalog for the selected day…"
                      : "Profile → Diet requires a % split per meal. Save the profile and reload."}
              </p>
              <div className="empathy-meal-expo-grid">
                {/* Scheletro card con solo i target del solver. Nessun item farlocco
                    (in passato il piano base distribuiva kcal_target/n_righe a ciascun
                    alimento, producendo numeri irrealistici tipo 1 banana = 320 kcal). */}
                {mealPlanDisplayRows.map((meal) => {
                  const slotKey = meal.key as PathwayMealSlotKey;
                  const bundle = mealPathwayBySlot[slotKey];
                  const subline = !bundle || bundle.loading
                    ? `${meal.time} · loading metabolic pathways`
                    : intelligentMealLoading
                      ? `${meal.time} · generation in progress`
                      : meal.time;
                  return (
                    <EmpathyMealPlanExpositionCard
                      key={slotKey}
                      slot={slotKey}
                      titleUpper={meal.label.toUpperCase()}
                      subline={subline}
                      totalKcal={meal.kcal}
                      carbsG={meal.carbs}
                      proteinG={meal.protein}
                      fatG={meal.fat}
                      items={[]}
                    />
                  );
                })}
              </div>
              <EmpathyMealPlanGlycemicLegend />
              <p className="muted-copy mt-3 text-center text-[11px] leading-snug text-gray-500">
                Metabolic pathways and USDA food database:{" "}
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 align-middle text-[11px] font-semibold text-gray-300 transition-colors hover:border-amber-400/50 hover:bg-amber-500/10"
                  onClick={() => {
                    if (adminScoped) return; // nelle schede admin niente navigazione cross-shell
                    router.push("/nutrition/integration");
                  }}
                >
                  Open Integration
                </button>
              </p>
            </div>
          ) : null}
          <Pro2Accordion
            accent="amber"
            title="Micronutrients and day status"
            subtitle="Plan micronutrient board and bioenergetic/adaptation indicators"
          >
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
          </Pro2Accordion>
        </section>
      </section>

      <section className="viz-card builder-panel">
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={saving}
            className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-bold text-gray-200 transition-colors hover:bg-white/10 disabled:opacity-60"
            onClick={onSaveNutrition}
          >
            {saving ? "Saving..." : "Save nutrition configuration"}
          </button>
          <span className="text-xs text-gray-500">
            Saves meal split, refueling and forecast to the profile (does not regenerate the plan).
          </span>
        </div>
      </section>
    </>
  );
}
