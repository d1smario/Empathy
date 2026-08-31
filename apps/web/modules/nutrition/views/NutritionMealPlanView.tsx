"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { NutritionDayKpiStrip } from "@/components/nutrition/NutritionDayKpiStrip";
import type {
  FoodDiaryEntryViewModel,
  FunctionalFoodRecommendationsViewModel,
  NutritionApplicationDirectiveViewModel,
  NutritionPathwayModulationViewModel,
} from "@/api/nutrition/contracts";
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
import type { OnboardingItemResult } from "@/lib/onboarding/onboarding-completeness";

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

export type NutritionMealPlanDailyTargetsProps = {
  complianceTargets: { kcal: number; carbs: number; protein: number; fat: number };
  dateLabel: string;
  /** Assunto del giorno dal registro diario (Diario eliminato 2026-07: vive sul Piano). */
  dayConsumed?: { kcal: number; carbs: number; protein: number; fat: number; count: number } | null;
  round: (v: number, digits?: number) => number;
};

/** Blocco KPI giornaliero: UNICO posto dei macro/kcal del giorno (sezione `mod-target-giorno`, dopo il selettore giorno). */
export function NutritionMealPlanDailyTargets({
  complianceTargets,
  dateLabel,
  dayConsumed,
  round,
}: NutritionMealPlanDailyTargetsProps) {
  const t = useTranslations("NutritionMealPlanView");
  // Il pannello «Bilancio kcal · cosa stai sommando» (energy ledger, gated coach/admin)
  // è stato RIMOSSO per tutti su richiesta del proprietario (2026-08): dettaglio motore
  // che non deve stare in grafica. Qui restano solo KPI del giorno e assunto/rimanente.

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
  /** True SOLO mentre il piano si sta generando (evento). Non usarlo per la lettura. */
  intelligentMealLoading: boolean;
  /**
   * True mentre si LEGGE il piano persistito dal DB (o i requisiti di profilo): stato
   * DISTINTO dalla generazione — leggere non è generare, e dirlo confonde chi apre la
   * pagina («sto generando» durante una semplice query è il bug che questo prop chiude).
   */
  planReadLoading?: boolean;
  /**
   * Requisiti di profilo OBBLIGATORI ancora mancanti CHE VINCOLANO LA NUTRIZIONE
   * (fonte unica: computeOnboardingCompleteness + itemsBlockingPlan(..., "nutrition")).
   * I requisiti del solo training non arrivano qui: non impediscono un piano alimentare.
   * Se non è vuoto NON si genera nulla: si dice all'atleta quali voci mancano e dove
   * completarle.
   */
  missingRequirements?: OnboardingItemResult[];
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
  /** Target del giorno FONTE UNICA (helper condiviso + reintegro): sostituisce il totale kcal-based della routine. */
  hydrationTotalTargetMl: number;
  /** Quota reintegro inclusa nel totale (caption «incluso reintegro» se > 0). */
  hydrationReintegrationMl: number;
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
  planReadLoading = false,
  missingRequirements = [],
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
  selectedPlanDate,
  mealConfirmations,
  mealConfirmBusySlot,
  persistMealConfirmation,
  onMealExtraSaved,
  dayDiaryEntries,
  onDeleteDiaryEntry,
  diaryEntryDeleteBusyId,
  hydrationMinDailyMl,
  hydrationTotalTargetMl,
  hydrationReintegrationMl,
  hydrationIntakeMl,
  onAddHydrationIntake,
  hydrationIntakeBusy,
}: NutritionMealPlanWorkspaceProps) {
  const t = useTranslations("NutritionMealPlanView");
  /** Etichette dei requisiti: STESSO dizionario della sala d'attesa onboarding (nessun secondo elenco). */
  const tOnboarding = useTranslations("Onboarding");
  const router = useRouter();
  const { role: viewerRole, adminScoped, platformAdminView } = useActiveAthlete();
  const requirementLabel = (item: OnboardingItemResult) => {
    const key = `items.${item.key}.label`;
    return tOnboarding.has(key) ? tOnboarding(key) : item.label;
  };
  const requirementUnlocks = (item: OnboardingItemResult) => {
    const key = `items.${item.key}.unlocks`;
    return tOnboarding.has(key) ? tOnboarding(key) : item.unlocks;
  };
  const requirementsBlocking = missingRequirements.length > 0;

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
                      /**
                       * Header pasto = SOMMA DELLE VOCI SERVITE, non il target del solver.
                       *
                       * Prima mostrava il target («non somma USDA delle voci, spesso
                       * sbilancia colazione vs pranzo»): una scelta che aveva senso finché
                       * i macro delle voci erano inaffidabili — le righe-ricetta prendevano
                       * i nutrienti da un alimento indovinato dal NOME del piatto. Corretto
                       * quello (nutrientsFromRecipeComponents), la somma delle voci è il
                       * piatto vero e il target è un altro numero.
                       *
                       * Mostrarli come se fossero lo stesso è ciò che il nutrizionista ha
                       * segnalato il 25 ago: «se sommo le cifre il totale dei carboidrati è
                       * inferiore al dovuto, quello dei grassi superiore». Misurato: su 685
                       * pasti il 44,2% divergeva di oltre 50 kcal, fino a 1.238. Chi legge
                       * un totale sopra un elenco si aspetta che sia la somma dell'elenco —
                       * e deve poter fare il conto e ritrovarselo.
                       *
                       * `sumVisibleSlotMacros` ricade da sé sul target quando il pasto non
                       * ha voci (pasto soppresso, o tutte rimosse dal coach): lì il target
                       * resta l'unico numero disponibile, ed è giusto mostrarlo.
                       */
                      const totals = sumVisibleSlotMacros(sl, isVis, fallback);
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
                    totalTargetMl={hydrationTotalTargetMl}
                    reintegrationMl={hydrationReintegrationMl}
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
              {/* «Numeri tecnici del giorno» RIMOSSO (decisione proprietario, 10 ago):
                  il pannello coach/admin con Σ kcal solver, pathway modulation, righe
                  training e target per slot non serve più — i numeri che contano vivono
                  nel «Bilancio kcal» del target giornaliero e nelle card pasto. */}
            </>
          ) : null}
          {!intelligentMealPlan ? (
            <div className="empathy-meal-plan-expo-shell">
              {/* Piano assente: PRIMA si dice cosa manca. Il generativo senza i dati
                  obbligatori non parte, quindi non si genera e non si mente all'atleta. */}
              {requirementsBlocking ? (
                <div
                  className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-left"
                  role="status"
                >
                  <p className="mb-2 text-[13px] font-semibold leading-snug text-amber-100">
                    {t("missingRequirementsTitle")}
                  </p>
                  <ul className="m-0 grid list-none gap-2 p-0">
                    {missingRequirements.map((item) => (
                      <li key={item.key} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block text-[12px] font-semibold text-amber-50">{requirementLabel(item)}</span>
                          <span className="block text-[11px] leading-snug text-amber-100/70">{requirementUnlocks(item)}</span>
                        </span>
                        {/* Nelle schede admin il deep-link porterebbe lo staff sul PROPRIO
                            profilo, non su quello dell'atleta guardato: lì il bottone non si
                            rende affatto, invece di renderlo inerte al click. */}
                        {adminScoped ? null : (
                          <button
                            type="button"
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-100 transition-colors hover:border-amber-300/60 hover:bg-amber-500/20"
                            onClick={() => router.push(item.href)}
                          >
                            {tOnboarding("complete")}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mb-0 mt-2.5 text-[11px] leading-snug text-amber-100/70">
                    {t("missingRequirementsHint")}
                  </p>
                </div>
              ) : (
                (() => {
                  // LETTURA ≠ GENERAZIONE: mentre la query è in volo si dice «carico», mai «genero».
                  const stateMessage = planReadLoading
                    ? t("loadingPersistedPlan")
                    : intelligentMealLoading || canRequestIntelligentPlan
                      ? t("preparingTodayPlan")
                      : mealPathwayCatalogPending
                        ? t("loadingUsdaCatalog")
                        : platformAdminView
                          ? // Istruzione di manutenzione: nomina «Profile → Diet» e la
                            // ripartizione per pasto, cioè cosa fare per sbloccare. Ha senso
                            // solo per chi quei campi li può toccare; a chi non ha i comandi
                            // non si mostra niente al suo posto — nessuna riga, nessun
                            // paragrafo vuoto (istruzione del proprietario, 31 ago).
                            t("profileDietRequired")
                          : null;
                  return stateMessage ? (
                    <p className="mb-3 text-center text-[12px] leading-snug text-gray-400">{stateMessage}</p>
                  ) : null;
                })()
              )}
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
            {/* Card «Bioenergetic / Adaptation loop X/100» RIMOSSE (feedback 2026-07):
                punteggi motore con default finto 55, in inglese — quel livello vive
                nel pannello Previsioni della dashboard, non in fondo ai pasti. */}
          </div>
        </section>
      </section>
      {/* Bottone «Salva configurazione nutrizione» spostato accanto alla
          Previsione (2026-07): salva le manopole previsione/fueling, che ora
          vivono nel Piano — in fondo ai pasti confondeva. */}
    </>
  );
}
