"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { cn } from "@/lib/cn";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { NutritionPlanDatePicker } from "@/components/nutrition/NutritionPlanDatePicker";
import { NutritionSubnav } from "@/components/nutrition/NutritionSubnav";
import { ResearchTraceStatusSummary } from "@/components/nutrition/ResearchTraceStatusSummary";
import { SessionKnowledgeSummary } from "@/components/nutrition/SessionKnowledgeSummary";
import { Pro2Accordion } from "@/components/ui/empathy";
import type { KnowledgeResearchTraceSummary } from "@/api/knowledge/contracts";
import type {
  AdaptationGuidance,
  NutritionDailyEnergyModel,
  PhysiologyState,
} from "@/lib/empathy/schemas";
import { buildOperationalDynamicsLines } from "@/lib/platform/operational-dynamics-lines";
import { resolveNutritionDayModel } from "@/modules/nutrition/hooks/resolve-nutrition-day-model";
import { useNutritionHeavyModuleEnrichment } from "@/modules/nutrition/hooks/use-nutrition-heavy-module-enrichment";
import {
  assignPathwayTargetsToMealSlots,
  catalogIdsForSlot,
  collectSearchQueriesForSlot,
  type PathwayMealSlotKey,
} from "@/lib/nutrition/pathway-meal-usda-slots";
import { fetchUsdaFoodsForCatalogIds } from "@/modules/nutrition/services/pathway-meal-usda-client";
import {
  buildFunctionalFoodRecommendationsViewModel,
  FUNCTIONAL_NUTRIENT_CATALOG,
  type FunctionalNutrientCatalogEntry,
} from "@/lib/nutrition/functional-food-recommendations";
import { loadFunctionalNutrientCatalogClient } from "@/lib/nutrition/functional-food-recommendations-client";
import { buildFunctionalMealSelectorViewModel } from "@/lib/nutrition/functional-meal-selector";
import {
  BRAND_ALIASES,
  FUELING_CHART_THEME_PRO2,
  FUELING_MISSING_DAY_TRAINING,
  FUNCTIONAL_EXAMPLE_CELL_CLASSES,
  SPORTS,
  clamp,
  fuelingPhaseColor,
  functionalCandidateRowClass,
  hasPositiveNumber,
  mapMealCountModeToMealStrategy,
  metabolicPhaseSlotCardClass,
  n,
  nutritionToneForLabel,
  parseFuelingMinuteOffset,
  pathwayOperationalPhaseRowClass,
  portionHintForMealKcal,
  record,
  round,
} from "@/lib/nutrition/nutrition-view-helpers";
import { PredictorSection } from "@/modules/nutrition/views/sections/PredictorSection";
import { DiarySection } from "@/modules/nutrition/views/sections/DiarySection";
import { FuelingSection } from "@/modules/nutrition/views/sections/FuelingSection";
import { IntegrationSection, type IntegrationProductCardProduct } from "@/modules/nutrition/views/sections/IntegrationSection";
import { MealPlanSection } from "@/modules/nutrition/views/sections/MealPlanSection";
import {
  mergeNutritionProfileForSolver,
  mergePhysioForSolver,
  type AthleteNutritionRow,
  type PhysioRow,
} from "@/lib/nutrition/nutrition-athlete-profile-mappers";
import type {
  ExecutedRow,
  FoodLookupItem,
  FuelingSlot,
  FuelingTrainingContextRow,
  GarminFuelingStep,
  MediaAssetRow,
  PlannedRow,
  RecoverySummaryRow,
  TwinStateRow,
} from "@/lib/nutrition/nutrition-view-types";
import { buildEffectiveDayTrainingContext } from "@/lib/training/day-reality-context";
import {
  fetchNutritionModuleContext,
  type NutritionPlannedWorkoutRow,
} from "@/modules/nutrition/services/nutrition-module-api";
import {
  mergeNutritionTrainingRowsById,
  nutritionModuleWindowKeys,
} from "@/modules/nutrition/services/nutrition-module-window-merge";
import {
  fetchOperationalDayHub,
  isOperationalDayHubEnabled,
} from "@/modules/nutrition/services/operational-day-hub-api";
import type {
  ApprovedApplicationPatch,
  FunctionalFoodRecommendationsViewModel,
  FunctionalFoodTargetViewModel,
  FunctionalMealSelectorViewModel,
  NutritionApplicationDirectiveViewModel,
  NutritionMetabolicEfficiencyGenerativeViewModel,
  NutritionPathwayModulationViewModel,
  NutrientInterrogationViewModel,
  NutritionPerformanceIntegrationDials,
  UsdaRichFoodItemViewModel,
} from "@/api/nutrition/contracts";
import type { CrossDomainInterpretationRoadmap, EmpathyApplicationPlaybook } from "@empathy/contracts";
import { mergePlaybookIntoMealPlanRequest } from "@/lib/interpretation/materialize-application-playbook";
import type {
  TrainingAdaptationLoopViewModel,
  TrainingBioenergeticModulationViewModel,
} from "@/api/training/contracts";
import {
  buildFuelingMediaKeyCandidates,
  FUELING_PRODUCT_CATALOG,
  type FuelingCategory,
  type FuelingFunctionalFocus,
  type FuelingProduct,
} from "@/lib/nutrition/fueling-product-catalog";
import {
  buildIntegrationQuantityHint,
  FUELING_CATEGORY_IT,
  FUELING_FORMAT_IT,
  FOCUS_IT,
  primaryIntegrationTimingBucket,
  TIMING_IT,
  type IntegrationTimingBucket,
} from "@/lib/nutrition/integration-product-ui";
import { resolveFuelingPro2MediaUrlFromCandidates } from "@/lib/nutrition/fueling-pro2-media-manifest";
import {
  fetchNutritionMediaRows,
  saveNutritionProfileConfig,
  saveNutritionDeviceExport,
  saveNutritionLookupItem,
} from "@/modules/nutrition/services/nutrition-actions-api";
import type { TrainingDayOperationalContext } from "@/lib/training/day-operational-context";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { dedupePlannedWorkoutDbRows } from "@/lib/training/planned/planned-workout-dedupe-fingerprint";
import {
  effectivePlannedWorkoutNutritionMetrics,
  resolveBuilderSessionForPlannedRow,
} from "@/lib/training/builder/pro2-session-notes";
import { Pro2GymSchedaBlockList } from "@/components/training/Pro2GymSchedaBlockList";
import { analyzePlannedSessionsForFueling } from "@/lib/nutrition/fueling-planned-session-analysis";
import {
  buildFuelingProtocolSlots,
  buildGlycogenPlotGeometry,
  computeGlycogenDepletionForFueling,
  type FuelingProtocolSlot,
} from "@/lib/nutrition/fueling-session-protocol";
import { FoodDiaryPanel } from "@/modules/nutrition/components/FoodDiaryPanel";
import {
  NutritionMicronutrientGrid,
  mealPlanDayTotalsToMicroLines,
  pathwayNutrientSummaryToMicroLines,
} from "@/modules/nutrition/components/NutritionMicronutrientGrid";
import { buildIntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-request-builder";
import {
  activeMealSlotKeysForMode,
  buildDietMealSlotBudgets,
  resolveSixMealSnackPercentages,
  type CaloricDistribution,
} from "@/lib/nutrition/diet-meal-slot-budgets";
import { computeSnackSlotsSuppressedByTrainingWindow } from "@/lib/nutrition/nutrition-meal-times-training-coherence";
import {
  distributionImpliesSixMeals,
  isUsableCaloricDistribution,
  resolveNutritionDietDay,
} from "@/lib/nutrition/resolve-nutrition-diet-day";
import { mealTimesFromRoutineWeekPlanForDate } from "@/lib/nutrition/routine-week-plan-meal-times";
import { resolveMealTimesForNutritionPlanDate } from "@/lib/nutrition/nutrition-meal-times-training-coherence";
import {
  buildRacePreLunchDayContext,
  mapPlannedSessionsForRaceDetection,
} from "@/lib/nutrition/race-day-pre-race-lunch";
import {
  buildRoutineSyntheticFuelingSessionInput,
  detectRoutineRaceDay,
} from "@/lib/nutrition/routine-race-day-context";
import type { IntelligentMealPlanResponseBody, MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import {
  buildNutritionAdaptationSectorBoxes,
  type NutritionAdaptationSectorPillContext,
} from "@/lib/nutrition/nutrition-adaptation-sector-strip";
import {
  type NutritionMealPlanEnergyLedger,
} from "@/modules/nutrition/views/NutritionMealPlanView";
import type { MealPathwaySlotBundle } from "@/modules/nutrition/types/meal-pathway-slot-bundle";
import { fetchIntelligentMealPlan } from "@/modules/nutrition/services/intelligent-meal-plan-api";
import { isMealPlanV2PreviewUiEnabled } from "@/modules/nutrition/services/intelligent-meal-plan-v2-api";
import { MealPlanV2PreviewPanel } from "@/modules/nutrition/components/MealPlanV2PreviewPanel";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { updateProfilePayload } from "@/modules/profile/services/profile-api";
import type { FoodDiaryComplianceRow } from "@/modules/nutrition/services/food-diary-api";
import {
  aggregateStapleCountsForWeek,
  isoWeekBucketId,
  readMealRotationWeekPayload,
  recordPlanDayStaples,
} from "@/lib/nutrition/meal-rotation-week-cache";
import {
  isIsoDateKey,
  readPersistedNutritionPlanDate,
  writePersistedNutritionPlanDate,
} from "@/lib/nutrition/persisted-nutrition-plan-date";






/**
 * "today" = vista unificata del giorno (Rifornimento + Diario sulla stessa data,
 * riorganizzazione menù 2026-07): stessi blocchi di fueling+diary, un solo date picker.
 */
export type NutritionSubRoute = "meal-plan" | "fueling" | "integration" | "predictor" | "diary" | "today";

// Cache cross-mount del contesto modulo nutrition: ri-atterrando sulla pagina i
// dati compaiono subito (niente spinner "Caricamento…"); il refetch parte comunque
// in background e aggiorna stato+cache, così le mutazioni (save/upload/rigenera)
// restano riflesse senza spinner.
let nutritionModuleCacheId: string | null = null;
let nutritionModuleCache: Awaited<ReturnType<typeof fetchNutritionModuleContext>> | null = null;


function isTrustedFuelingImage(url: string | undefined | null): boolean {
  if (!url) return false;
  const value = url.toLowerCase();
  if (value.includes("unsplash.com") || value.includes("pexels.com") || value.includes("pixabay.com")) return false;
  return (
    value.includes("enervit") ||
    value.includes("maurten") ||
    value.includes("scienceinsport") ||
    value.includes("precisionhydration") ||
    value.includes("namedsport") ||
    value.includes("neversecond") ||
    value.includes("watt.it") ||
    value.includes("powerbar")
  );
}

function buildFuelingPackshot(
  brand: string,
  product: string,
  category: string,
  format?: string,
): string {
  const palette: Record<string, { bg: string; fg: string; accent: string; accentSoft: string }> = {
    Enervit: { bg: "#12090c", fg: "#fff7fa", accent: "#ff355e", accentSoft: "#ffd400" },
    Maurten: { bg: "#0d1014", fg: "#f8fafc", accent: "#c7d2fe", accentSoft: "#60a5fa" },
    SiS: { bg: "#09101d", fg: "#f8fafc", accent: "#38bdf8", accentSoft: "#8b5cf6" },
    "+Watt": { bg: "#14100c", fg: "#fffaf0", accent: "#f59e0b", accentSoft: "#fb7185" },
    Powerbar: { bg: "#140b10", fg: "#fff7ed", accent: "#ef4444", accentSoft: "#fbbf24" },
    "Precision Fuel & Hydration": { bg: "#0d1117", fg: "#f8fafc", accent: "#f97316", accentSoft: "#facc15" },
    "Named Sport": { bg: "#0b1215", fg: "#f1f5f9", accent: "#22c55e", accentSoft: "#38bdf8" },
    Neversecond: { bg: "#111318", fg: "#f8fafc", accent: "#e2e8f0", accentSoft: "#a855f7" },
  };
  const tone = palette[brand] ?? { bg: "#111827", fg: "#f9fafb", accent: "#fb923c", accentSoft: "#60a5fa" };
  const title = product.length > 28 ? `${product.slice(0, 28)}...` : product;
  const formatLabel = (format ?? category).toUpperCase();
  const pack =
    format === "gel"
      ? `<path d='M770 176 h138 l40 86 v290 l-40 78 h-138 l-40 -78 v-290 z' fill='#101317' stroke='${tone.accent}' stroke-width='8' />
         <rect x='760' y='232' width='158' height='236' rx='20' fill='${tone.accent}' />
         <rect x='760' y='468' width='158' height='54' rx='12' fill='${tone.accentSoft}' />`
      : format === "bar"
        ? `<rect x='684' y='270' width='298' height='168' rx='28' fill='#12161d' stroke='${tone.accent}' stroke-width='8' />
           <rect x='712' y='294' width='242' height='64' rx='14' fill='${tone.accent}' />
           <rect x='712' y='370' width='162' height='34' rx='10' fill='${tone.accentSoft}' />`
        : `<rect x='734' y='156' width='182' height='472' rx='36' fill='#0c1016' stroke='${tone.accent}' stroke-width='8' />
           <rect x='758' y='214' width='134' height='244' rx='24' fill='${tone.accent}' />
           <rect x='758' y='476' width='134' height='72' rx='18' fill='${tone.accentSoft}' />
           <ellipse cx='825' cy='156' rx='76' ry='20' fill='#20252d' />`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='800' viewBox='0 0 1200 800'>
  <defs>
    <linearGradient id='bg' x1='0' x2='1' y1='0' y2='1'>
      <stop offset='0%' stop-color='${tone.bg}'/>
      <stop offset='100%' stop-color='#111827'/>
    </linearGradient>
    <linearGradient id='glow' x1='0' x2='1'>
      <stop offset='0%' stop-color='${tone.accent}' stop-opacity='0.95'/>
      <stop offset='100%' stop-color='${tone.accentSoft}' stop-opacity='0.95'/>
    </linearGradient>
  </defs>
  <rect width='1200' height='800' rx='48' fill='url(#bg)'/>
  <circle cx='930' cy='160' r='180' fill='${tone.accent}' opacity='0.12'/>
  <circle cx='250' cy='640' r='220' fill='${tone.accentSoft}' opacity='0.08'/>
  <rect x='58' y='58' width='1084' height='684' rx='34' fill='none' stroke='${tone.accent}' stroke-opacity='0.45' stroke-width='3'/>
  <text x='108' y='170' fill='${tone.fg}' font-family='Arial, Helvetica, sans-serif' font-size='56' font-weight='700'>${brand}</text>
  <text x='108' y='228' fill='url(#glow)' font-family='Arial, Helvetica, sans-serif' font-size='28' font-weight='700'>${category.toUpperCase()} · ${formatLabel}</text>
  <text x='108' y='304' fill='${tone.fg}' font-family='Arial, Helvetica, sans-serif' font-size='42' font-weight='700'>${title}</text>
  <text x='108' y='364' fill='#d6dde7' font-family='Arial, Helvetica, sans-serif' font-size='22'>Fueling visual fallback · official click-through preserved</text>
  <rect x='108' y='426' width='262' height='44' rx='999' fill='${tone.accent}' opacity='0.16' stroke='${tone.accent}' stroke-opacity='0.45'/>
  <text x='136' y='455' fill='${tone.fg}' font-family='Arial, Helvetica, sans-serif' font-size='20' font-weight='700'>EMPATHY FUELING ASSET</text>
  ${pack}
  <rect x='666' y='648' width='318' height='28' rx='14' fill='#000000' opacity='0.28'/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function resolveFuelingProductImage(
  product: FuelingProduct | undefined,
  category: FuelingCategory,
  fuelingMediaByKey: Record<string, string>,
) {
  const keyCandidates = buildFuelingMediaKeyCandidates(product, category);
  const pro2Local = resolveFuelingPro2MediaUrlFromCandidates(keyCandidates);
  const mediaCandidate =
    keyCandidates.map((key) => fuelingMediaByKey[key]).find(Boolean)
    ?? pro2Local
    ?? product?.imageUrl;
  const trustedImage = isTrustedFuelingImage(mediaCandidate) ? mediaCandidate : null;
  // NIENTE logo.clearbit.com: il servizio è dismesso (DNS morto) e vinceva sul
  // packshot locale → tutte le card prodotto mostravano immagini rotte. Il
  // packshot SVG generato (brand+prodotto+categoria) è il fallback effettivo.
  const brandedPackshotFallback = buildFuelingPackshot(
    product?.brand ?? "Fuel Brand",
    product?.product ?? "Fuel Product",
    category,
    product?.format,
  );
  const displayImage = trustedImage ?? brandedPackshotFallback;
  return {
    displayImage,
    // true = packshot generato (nessuna immagine reale): il contatore a valle
    // conta i prodotti con immagine vera.
    isLogoFallback: !trustedImage,
  };
}



export default function NutritionPageView({ subRoute }: { subRoute: NutritionSubRoute }) {
  const t = useTranslations("NutritionPageView");
  const router = useRouter();
  const pathname = usePathname();
  const { athleteId, role, loading: athleteLoading, adminScoped, platformAdminView } = useActiveAthlete();
  /** Diagnostica tecnica (research trace, roadmap, ontology, dump motore): solo coach/admin. */
  const showTech = role === "coach" || adminScoped;
  const [profile, setProfile] = useState<AthleteNutritionRow | null>(null);
  const [physio, setPhysio] = useState<PhysioRow | null>(null);
  const [physiologyState, setPhysiologyState] = useState<PhysiologyState | null>(null);
  const [twinState, setTwinState] = useState<TwinStateRow | null>(null);
  const [recoverySummary, setRecoverySummary] = useState<RecoverySummaryRow | null>(null);
  const [operationalContext, setOperationalContext] = useState<TrainingDayOperationalContext | null>(null);
  const [adaptationLoop, setAdaptationLoop] = useState<TrainingAdaptationLoopViewModel | null>(null);
  const [bioenergeticModulation, setBioenergeticModulation] = useState<TrainingBioenergeticModulationViewModel | null>(null);
  const [researchTraceSummaries, setResearchTraceSummaries] = useState<KnowledgeResearchTraceSummary[]>([]);
  const [metabolicEfficiencyGenerativeModel, setMetabolicEfficiencyGenerativeModel] =
    useState<NutritionMetabolicEfficiencyGenerativeViewModel | null>(null);
  const [crossDomainInterpretationRoadmap, setCrossDomainInterpretationRoadmap] =
    useState<CrossDomainInterpretationRoadmap | null>(null);
  const [applicationPlaybook, setApplicationPlaybook] = useState<EmpathyApplicationPlaybook | null>(null);
  const [nutrientInterrogation, setNutrientInterrogation] = useState<NutrientInterrogationViewModel | null>(null);
  const [functionalMealSelector, setFunctionalMealSelector] = useState<FunctionalMealSelectorViewModel | null>(null);
  const [pathwayModulation, setPathwayModulation] = useState<NutritionPathwayModulationViewModel | null>(null);
  const [nutritionApplicationDirective, setNutritionApplicationDirective] = useState<NutritionApplicationDirectiveViewModel | null>(
    null,
  );
  const [nutritionApprovedPatches, setNutritionApprovedPatches] = useState<ApprovedApplicationPatch[]>([]);
  const [nutritionPerformanceIntegration, setNutritionPerformanceIntegration] =
    useState<NutritionPerformanceIntegrationDials | null>(null);
  /** Solver energia canonico da GET /api/nutrition/module (pathwayDate). */
  const [serverDailyEnergyModel, setServerDailyEnergyModel] = useState<NutritionDailyEnergyModel | null>(null);
  const serverDailyEnergyDateRef = useRef<string | null>(null);
  const [executed, setExecuted] = useState<ExecutedRow[]>([]);
  const [planned, setPlanned] = useState<PlannedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [adherenceOptIn, setAdherenceOptIn] = useState(false);
  const [adherenceConfigLoading, setAdherenceConfigLoading] = useState(false);
  const [selectedPlanDate, setSelectedPlanDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const lastNutritionHydrationKey = useRef<string>("");
  /** Finestra `from`…`to` dell’ultimo `fetchNutritionModuleContext` completo (per pathwayDate incrementale). */
  const nutritionModuleWindowRef = useRef<{ from: string; to: string } | null>(null);
  const nutritionModuleFullWindowRef = useRef<{ from: string; to: string } | null>(null);
  const nutritionModuleExpandInFlightRef = useRef(false);
  /** Ultima data per cui `functionalMealSelector` è stato allineato al server (evita fetch doppi). */
  const serverSelectorPathwayDateRef = useRef<string | null>(null);
  /** Incrementato al ritorno sul tab: ricarica profilo/fisiologia se aggiornati altrove (altra scheda / profilo). */
  const [nutritionContextVersion, setNutritionContextVersion] = useState(0);

  const [dailyEnergyKcal, setDailyEnergyKcal] = useState(3000);
  /** Split % pasti (hydrate da Diet / meal_plan — fallback UI se resolver giorno vuoto). */
  const [caloricSplit, setCaloricSplit] = useState<CaloricDistribution>({
    breakfast: 25,
    lunch: 35,
    dinner: 30,
    snacks: 10,
  });
  const [macroSplit, setMacroSplit] = useState({ carbs: 50, protein: 25, fat: 25 });
  const [mealTimes, setMealTimes] = useState({
    breakfast: "07:30",
    lunch: "13:00",
    dinner: "20:00",
    snack_am: "10:30",
    snack_pm: "16:30",
    snack_evening: "22:30",
  });

  /** Diet del giorno selezionato (Profile → week_plan[weekday]); unica fonte per pasti e % kcal. */
  const resolvedDietDay = useMemo(
    () =>
      resolveNutritionDietDay(profile?.nutrition_config, selectedPlanDate, {
        preferredMealCount: profile?.preferred_meal_count ?? null,
      }),
    [profile?.nutrition_config, profile?.preferred_meal_count, selectedPlanDate],
  );

  const [mealStrategy, setMealStrategy] = useState("3-meals");

  const effectiveMealCountMode = useMemo(() => {
    let m = String(resolvedDietDay.mealCountMode ?? "").trim();
    const dist = resolvedDietDay.caloricDistribution;
    if (
      m === "4" &&
      dist &&
      (profile?.preferred_meal_count === 6 || mealStrategy === "6-meals") &&
      distributionImpliesSixMeals(dist)
    ) {
      m = "6";
    }
    if (m && m !== "fasting") return m;
    if (mealStrategy === "6-meals") return "6";
    if (mealStrategy === "5-meals") return "5";
    if (mealStrategy === "3-meals") return "3";
    if (profile?.preferred_meal_count === 6 && dist && distributionImpliesSixMeals(dist)) return "6";
    return m || "5";
  }, [
    resolvedDietDay.mealCountMode,
    resolvedDietDay.caloricDistribution,
    mealStrategy,
    profile?.preferred_meal_count,
  ]);

  const activeDietMealSlotKeys = useMemo(
    () => activeMealSlotKeysForMode(effectiveMealCountMode),
    [effectiveMealCountMode],
  );

  const [sessionDurationMin, setSessionDurationMin] = useState(120);
  const [sessionIntensityPctFtp, setSessionIntensityPctFtp] = useState(78);
  const [fuelingChoGPerHour, setFuelingChoGPerHour] = useState(75);
  const [fluidMlPerHour, setFluidMlPerHour] = useState(650);
  const [sodiumMgPerHour, setSodiumMgPerHour] = useState(700);
  const [cofactor, setCofactor] = useState("Bicarbonato + Caffeina");

  const [predictorSport, setPredictorSport] = useState("Running");
  const [predictorDistanceKm, setPredictorDistanceKm] = useState(21);
  const [predictorTimeMin, setPredictorTimeMin] = useState(95);
  const [predictorIntensityPctFtp, setPredictorIntensityPctFtp] = useState(84);
  const [predictorUsePlanDay, setPredictorUsePlanDay] = useState(true);
  const [diaryMacroRows, setDiaryMacroRows] = useState<FoodDiaryComplianceRow[]>([]);
  const [foodQuery, setFoodQuery] = useState("");
  const [foodLookupResults, setFoodLookupResults] = useState<FoodLookupItem[]>([]);
  const [foodLookupLoading, setFoodLookupLoading] = useState(false);
  const [foodLookupError, setFoodLookupError] = useState<string | null>(null);
  const [usdaRichByCatalogId, setUsdaRichByCatalogId] = useState<
    Record<string, { loading: boolean; error?: string; foods?: UsdaRichFoodItemViewModel[] }>
  >({});
  const [savingCatalogKey, setSavingCatalogKey] = useState<string | null>(null);
  const [garminExporting, setGarminExporting] = useState(false);
  const [garminMessage, setGarminMessage] = useState<string | null>(null);
  const [fuelingMediaByKey, setFuelingMediaByKey] = useState<Record<string, string>>({});
  const [mealPathwayBySlot, setMealPathwayBySlot] = useState<Partial<Record<string, MealPathwaySlotBundle>>>({});
  const [intelligentMealPlan, setIntelligentMealPlan] = useState<IntelligentMealPlanResponseBody | null>(null);
  const [intelligentMealLoading, setIntelligentMealLoading] = useState(false);
  const [intelligentMealError, setIntelligentMealError] = useState<string | null>(null);
  /** Indici voce originali nascosti nel piano corrente (non persistono nel DB). */
  const [coachMealRemovalKeys, setCoachMealRemovalKeys] = useState<Set<string>>(() => new Set());
  /** Etichette aggiunte per la prossima rigenerazione (vincolo deterministico sul request). */
  const [coachSessionFoodExclusions, setCoachSessionFoodExclusions] = useState<string[]>([]);
  const [profileFoodExcludeBusy, setProfileFoodExcludeBusy] = useState<string | null>(null);
  const [fuelingConfirmBusy, setFuelingConfirmBusy] = useState(false);

  useEffect(() => {
    if (!athleteId) return;
    let cancelled = false;
    setAdherenceConfigLoading(true);
    void (async () => {
      try {
        // Lettura diretta browser→Supabase del toggle adherence (RLS scoped su athlete_id).
        const supabase = createEmpathyBrowserSupabase();
        if (!supabase) return;
        const { data, error } = await supabase
          .from("nutrition_constraints")
          .select("athlete_id, adaptation_adherence_opt_in, updated_at")
          .eq("athlete_id", athleteId)
          .maybeSingle();
        if (cancelled) return;
        if (!error) {
          setAdherenceOptIn(data?.adaptation_adherence_opt_in === true);
        }
      } finally {
        if (!cancelled) setAdherenceConfigLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  useEffect(() => {
    if (!athleteId || loading) return;
    writePersistedNutritionPlanDate(athleteId, selectedPlanDate);
  }, [athleteId, selectedPlanDate, loading]);

  useEffect(() => {
    setIntelligentMealPlan(null);
    setIntelligentMealError(null);
    setCoachMealRemovalKeys(new Set());
    setCoachSessionFoodExclusions([]);
    setServerDailyEnergyModel(null);
    serverDailyEnergyDateRef.current = null;
    serverSelectorPathwayDateRef.current = null;
  }, [selectedPlanDate]);

  /** Allinea `functionalMealSelector` server al giorno scelto (senza ricaricare tutto il modulo). */
  useEffect(() => {
    if (!athleteId || loading) return;
    const w = nutritionModuleWindowRef.current;
    if (!w) return;
    if (selectedPlanDate < w.from || selectedPlanDate > w.to) return;
    if (serverSelectorPathwayDateRef.current === selectedPlanDate && serverDailyEnergyDateRef.current === selectedPlanDate) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        let hubEnergyApplied = false;
        if (isOperationalDayHubEnabled()) {
          const hub = await fetchOperationalDayHub({ athleteId, date: selectedPlanDate });
          if (cancelled) return;
          if (hub.ok) {
            if (hub.dailyEnergyModel) {
              setServerDailyEnergyModel(hub.dailyEnergyModel);
              serverDailyEnergyDateRef.current = selectedPlanDate;
              hubEnergyApplied = true;
            }
            if (hub.planned.length > 0) {
              setPlanned((prev) =>
                mergeNutritionTrainingRowsById(prev, hub.planned as PlannedRow[]),
              );
            }
            if (Array.isArray(hub.executed) && hub.executed.length > 0) {
              setExecuted((prev) =>
                mergeNutritionTrainingRowsById(prev, hub.executed as ExecutedRow[]),
              );
            }
          }
        }

        const snap = await fetchNutritionModuleContext({
          athleteId,
          from: selectedPlanDate,
          to: selectedPlanDate,
          pathwayDate: selectedPlanDate,
          mode: "pathway",
        });
        if (cancelled || snap.error) return;
        serverSelectorPathwayDateRef.current = selectedPlanDate;
        setFunctionalMealSelector(snap.functionalMealSelector ?? null);
        setPathwayModulation(snap.pathwayModulation ?? null);
        setApplicationPlaybook(snap.applicationPlaybook ?? null);
        if (!hubEnergyApplied) {
          setServerDailyEnergyModel(snap.dailyEnergyModel ?? null);
          serverDailyEnergyDateRef.current = snap.dailyEnergyModel ? selectedPlanDate : null;
        }
      } catch {
        /* rete: mantieni selettore client-side */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPlanDate, athleteId, loading]);

  /** Se l'utente sceglie una data fuori dalla finestra caricata, espandi a ±30 (on-demand). */
  useEffect(() => {
    if (!athleteId || loading) return;
    const w = nutritionModuleWindowRef.current;
    const full = nutritionModuleFullWindowRef.current;
    if (!w || !full) return;
    if (selectedPlanDate >= w.from && selectedPlanDate <= w.to) return;
    if (w.from === full.from && w.to === full.to) return;

    let cancelled = false;
    void (async () => {
      if (nutritionModuleExpandInFlightRef.current) return;
      nutritionModuleExpandInFlightRef.current = true;
      try {
        const expanded = await fetchNutritionModuleContext({
          athleteId,
          from: full.from,
          to: full.to,
          mode: "light",
        });
        if (cancelled || expanded.error) return;
        setPlanned((prev) =>
          mergeNutritionTrainingRowsById(prev, (expanded.planned as PlannedRow[]) ?? []),
        );
        setExecuted((prev) =>
          mergeNutritionTrainingRowsById(prev, (expanded.executed as ExecutedRow[]) ?? []),
        );
        nutritionModuleWindowRef.current = { from: full.from, to: full.to };
      } finally {
        nutritionModuleExpandInFlightRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPlanDate, athleteId, loading]);

  /** Sezioni pesanti (research traces, metabolic model) — dopo first paint. */
  useNutritionHeavyModuleEnrichment({
    athleteId,
    loading,
    selectedPlanDate,
    nutritionModuleWindow: nutritionModuleWindowRef.current,
    nutritionContextVersion,
    enabled: pathname?.includes("/nutrition/predictor") || pathname?.includes("/nutrition/integration"),
    onResearchTraces: setResearchTraceSummaries,
    onMetabolicModel: setMetabolicEfficiencyGenerativeModel,
    onCrossDomainRoadmap: setCrossDomainInterpretationRoadmap,
    onNutrientInterrogation: setNutrientInterrogation,
    onApplicationPlaybook: setApplicationPlaybook,
    onPathwayRefresh: (payload) => {
      if (payload.pathwayModulation) setPathwayModulation(payload.pathwayModulation);
      if (payload.functionalMealSelector) setFunctionalMealSelector(payload.functionalMealSelector);
    },
  });

  const onDiaryComplianceRows = useCallback((rows: FoodDiaryComplianceRow[]) => {
    setDiaryMacroRows(rows);
  }, []);


  useEffect(() => {
    async function loadData() {
      if (!athleteId) {
        setProfile(null);
        setPhysio(null);
        setPhysiologyState(null);
        setRecoverySummary(null);
        setOperationalContext(null);
        setAdaptationLoop(null);
        setBioenergeticModulation(null);
        setResearchTraceSummaries([]);
        setMetabolicEfficiencyGenerativeModel(null);
        setFunctionalMealSelector(null);
        setPathwayModulation(null);
        setApplicationPlaybook(null);
        setNutritionApplicationDirective(null);
        setNutritionApprovedPatches([]);
        setNutritionPerformanceIntegration(null);
        setExecuted([]);
        setPlanned([]);
        nutritionModuleWindowRef.current = null;
        nutritionModuleFullWindowRef.current = null;
        nutritionModuleExpandInFlightRef.current = false;
        serverSelectorPathwayDateRef.current = null;
        setLoading(false);
        return;
      }
      const today = new Date();
      const fullWindow = nutritionModuleWindowKeys(30, 30, today);
      const initialWindow = nutritionModuleWindowKeys(7, 7, today);
      const { from: fullStartKey, to: fullEndKey } = fullWindow;
      const { from: initialStartKey, to: initialEndKey } = initialWindow;
      nutritionModuleFullWindowRef.current = fullWindow;
      const todayKey = new Date().toISOString().slice(0, 10);
      const clampIsoDay = (d: string) => {
        if (d < fullStartKey) return fullStartKey;
        if (d > fullEndKey) return fullEndKey;
        return d;
      };

      /** Applica un contesto modulo (fetchato o da cache) a stato + finestra + data piano. */
      const applyModuleData = (data: NonNullable<typeof nutritionModuleCache>) => {
        const p = mergeNutritionProfileForSolver(
          null,
          (data.profile as AthleteNutritionRow | null) ?? null,
        );
        const ph = mergePhysioForSolver(null, (data.physio as PhysioRow | null) ?? null);
        const physiology = (data.physiologyState as PhysiologyState | null) ?? null;
        const twin = (data.twinState as TwinStateRow | null) ?? null;
        const recovery = (data.recoverySummary as RecoverySummaryRow | null) ?? null;
        const operational = (data.operationalContext as TrainingDayOperationalContext | null) ?? null;
        const loop = (data.adaptationLoop as TrainingAdaptationLoopViewModel | null) ?? null;
        const bio = (data.bioenergeticModulation as TrainingBioenergeticModulationViewModel | null) ?? null;
        const ex = (data.executed as ExecutedRow[]) ?? [];
        const pl = (data.planned as PlannedRow[]) ?? [];

        setProfile(p);
        setPhysio(ph);
        setPhysiologyState(physiology);
        setTwinState(twin);
        setRecoverySummary(recovery);
        setOperationalContext(operational);
        setAdaptationLoop(loop);
        setBioenergeticModulation(bio);
        setResearchTraceSummaries(data.researchTraceSummaries ?? []);
        setMetabolicEfficiencyGenerativeModel(data.metabolicEfficiencyGenerativeModel ?? null);
        setNutritionApplicationDirective(data.nutritionApplicationDirective ?? null);
        setNutritionApprovedPatches(data.nutritionApprovedPatches ?? []);
        setNutritionPerformanceIntegration(data.nutritionPerformanceIntegration ?? null);
        setExecuted(ex);
        setPlanned(pl);
        /** Dopo refresh modulo (profilo/fisiologia): evita che il rollup USDA del piano precedente copra i nuovi target kcal solver. */
        setIntelligentMealPlan(null);
        setIntelligentMealError(null);
        setCoachMealRemovalKeys(new Set());
        setCoachSessionFoodExclusions([]);
        const availableDates = Array.from(new Set(pl.map((row) => row.date))).sort();
        const nextDate = availableDates.find((d) => d >= todayKey) ?? availableDates[0] ?? todayKey;
        const persisted = readPersistedNutritionPlanDate(athleteId);
        const finalPlanDate = clampIsoDay(persisted ?? nextDate);
        setFunctionalMealSelector(null);
        setPathwayModulation(null);
        setApplicationPlaybook(null);
        setServerDailyEnergyModel(null);
        serverDailyEnergyDateRef.current = null;
        serverSelectorPathwayDateRef.current = null;
        nutritionModuleWindowRef.current = { from: initialStartKey, to: initialEndKey };
        setSelectedPlanDate(finalPlanDate);
      };

      // Cache cross-mount: se questo atleta è già stato caricato, mostra subito i
      // dati (niente spinner) e prosegui comunque col refetch in background.
      const cached = nutritionModuleCacheId === athleteId ? nutritionModuleCache : null;
      if (cached && !cached.error) {
        applyModuleData(cached);
        setError(null);
        setLoading(false);
      } else {
        setLoading(true);
        setError(null);
      }

      let moduleData = await fetchNutritionModuleContext({
        athleteId,
        from: initialStartKey,
        to: initialEndKey,
        mode: "light",
      });
      if (moduleData.error) {
        // Con cache già mostrata teniamo i dati visibili (refresh in background
        // silenzioso); senza cache puliamo e segnaliamo l'errore come prima.
        if (!cached || cached.error) {
          setError(moduleData.error || "Loading error");
          setResearchTraceSummaries([]);
          setMetabolicEfficiencyGenerativeModel(null);
          setFunctionalMealSelector(null);
          setPathwayModulation(null);
          setApplicationPlaybook(null);
          setNutritionApplicationDirective(null);
          setNutritionApprovedPatches([]);
          setNutritionPerformanceIntegration(null);
          nutritionModuleWindowRef.current = null;
          nutritionModuleFullWindowRef.current = null;
          nutritionModuleExpandInFlightRef.current = false;
          serverSelectorPathwayDateRef.current = null;
          setLoading(false);
        }
        return;
      }

      applyModuleData(moduleData);
      nutritionModuleCache = moduleData;
      nutritionModuleCacheId = athleteId;
      setLoading(false);

      const expandToFullWindow = async () => {
        if (nutritionModuleExpandInFlightRef.current) return;
        const w = nutritionModuleWindowRef.current;
        const full = nutritionModuleFullWindowRef.current;
        if (!w || !full || (w.from === full.from && w.to === full.to)) return;
        nutritionModuleExpandInFlightRef.current = true;
        try {
          const expanded = await fetchNutritionModuleContext({
            athleteId,
            from: full.from,
            to: full.to,
            mode: "light",
          });
          if (expanded.error) return;
          setPlanned((prev) =>
            mergeNutritionTrainingRowsById(prev, (expanded.planned as PlannedRow[]) ?? []),
          );
          setExecuted((prev) =>
            mergeNutritionTrainingRowsById(prev, (expanded.executed as ExecutedRow[]) ?? []),
          );
          nutritionModuleWindowRef.current = { from: full.from, to: full.to };
        } finally {
          nutritionModuleExpandInFlightRef.current = false;
        }
      };

      void expandToFullWindow();
    }
    loadData();
  }, [athleteId, pathname, nutritionContextVersion]);

  const selectedPlanSessions = useMemo(() => {
    const dayRows = planned.filter((p) => String(p.date ?? "").slice(0, 10) === selectedPlanDate);
    return dedupePlannedWorkoutDbRows(
      dayRows.map((session) => ({
        ...session,
        type: session.type ?? "session",
        duration_minutes: session.duration_minutes,
        tss_target: session.tss_target ?? 0,
        kcal_target: session.kcal_target,
        notes: session.notes,
        created_at: (session as { created_at?: string | null }).created_at ?? null,
      })),
    );
  }, [planned, selectedPlanDate]);
  const selectedExecutedSessions = useMemo(
    () => executed.filter((session) => session.date.slice(0, 10) === selectedPlanDate),
    [executed, selectedPlanDate],
  );

  const selectedPlanDateLabel = useMemo(
    () => new Date(`${selectedPlanDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }),
    [selectedPlanDate],
  );
  const selectedPlanDateShort = useMemo(
    () => new Date(`${selectedPlanDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "2-digit" }),
    [selectedPlanDate],
  );
  const effectiveDayContext = useMemo(
    () =>
      buildEffectiveDayTrainingContext({
        planned: selectedPlanSessions.map((session) => {
          const bs = resolveBuilderSessionForPlannedRow({
            builderSession: session.builderSession as Pro2BuilderSessionContract | null | undefined,
            notes: typeof session.notes === "string" ? session.notes : null,
          });
          const m = effectivePlannedWorkoutNutritionMetrics({
            durationMinutesDb: session.duration_minutes as number | null | undefined,
            tssTargetDb: session.tss_target as number | null | undefined,
            kcalTargetDb: session.kcal_target as number | null | undefined,
            builderSession: bs,
            athleteFtpWatts: physio?.ftp_watts ?? null,
          });
          return {
            id: String(session.id),
            title: session.plannedSessionName ?? session.plannedDiscipline ?? session.type ?? "Session",
            duration_minutes: m.durationMinutes,
            tss_target: m.tss,
            kcal_target: m.kcal,
          };
        }),
        executed: selectedExecutedSessions,
      }),
    [selectedPlanSessions, selectedExecutedSessions, physio?.ftp_watts],
  );

  const nutritionDayModel = useMemo<NutritionDailyEnergyModel | null>(
    () =>
      resolveNutritionDayModel({
        athleteId: athleteId ?? "",
        selectedPlanDate,
        serverDailyEnergyModel,
        serverDailyEnergyDate: serverDailyEnergyDateRef.current,
        profile,
        physio,
        plannedTraining: effectiveDayContext.sessions.map((session) => ({
          durationMinutes: session.durationMin,
          kcal: session.kcal,
          tss: session.tss,
          avgPowerW: session.avgPowerW,
        })),
        recoverySummary,
        nutritionPerformanceIntegration,
        dietDayMealsScalePct: resolvedDietDay.dayTypePct,
      }),
    [
      serverDailyEnergyModel,
      selectedPlanDate,
      athleteId,
      profile,
      physio,
      effectiveDayContext,
      recoverySummary,
      nutritionPerformanceIntegration,
      resolvedDietDay.dayTypePct,
    ],
  );

  /** BMR assente o peso non letto → pasti solver ~solo quota training; evita silenzio in UI. */
  const lowMealsBudgetWarning = useMemo(() => {
    if (!nutritionDayModel) return null;
    const meals = nutritionDayModel.totals.mealsKcal;
    const train = nutritionDayModel.training.kcal;
    if (meals >= 900) return null;
    if (train < 220) return null;
    if (meals > train * 0.55) return null;
    return { meals, train };
  }, [nutritionDayModel]);


  const nutritionStimulusLine = useMemo(() => {
    if (!selectedPlanSessions.length) return null;
    return selectedPlanSessions
      .map((s) => {
        const name = String(s.plannedSessionName ?? s.plannedDiscipline ?? s.type ?? "Session");
        const tgt = s.plannedAdaptationTarget ? ` · ${s.plannedAdaptationTarget}` : "";
        return `${name}${tgt}`;
      })
      .join(" + ");
  }, [selectedPlanSessions]);

  const nutritionSectorPillContext = useMemo((): NutritionAdaptationSectorPillContext | null => {
    if (!athleteId) return null;
    return {
      physiology: physiologyState,
      twin: twinState,
      recoverySummary,
      intolerances: profile?.intolerances ?? null,
      allergies: profile?.allergies ?? null,
      researchTraceSummaries,
    };
  }, [
    athleteId,
    physiologyState,
    twinState,
    recoverySummary,
    profile?.intolerances,
    profile?.allergies,
    researchTraceSummaries,
  ]);

  const nutritionSectorBoxes = useMemo(
    () => buildNutritionAdaptationSectorBoxes(pathwayModulation, nutritionStimulusLine, nutritionSectorPillContext),
    [pathwayModulation, nutritionStimulusLine, nutritionSectorPillContext],
  );

  /** Tab Integrazione: KPI da pathway + leve operative (allineati ai blocchi condivisi). */
  const integrationDynamicsSummary = useMemo(() => {
    const cards: { label: string; value: string }[] = [];
    if (pathwayModulation) {
      cards.push({ label: t("kpiModulatedPathways"), value: String(pathwayModulation.pathways.length) });
      cards.push({
        label: t("kpiAggregateInhibitors"),
        value: pathwayModulation.aggregateInhibitors.length ? String(pathwayModulation.aggregateInhibitors.length) : "0",
      });
      const levelHits = (["biochemical", "hormonal", "neurologic", "microbiota", "genetic"] as const).filter(
        (k) => pathwayModulation.multiLevelSummary[k].length > 0,
      ).length;
      cards.push({ label: t("kpiActiveLevels"), value: `${levelHits}/5` });
    }
    if (nutritionPerformanceIntegration) {
      cards.push({
        label: t("kpiRecoveryBioIndicator"),
        value: `×${nutritionPerformanceIntegration.trainingEnergyScale.toFixed(2)}`,
      });
      cards.push({
        label: "CHO fueling",
        value: `×${nutritionPerformanceIntegration.fuelingChoScale.toFixed(2)}`,
      });
      cards.push({
        label: t("kpiProteinBias"),
        value: `+${nutritionPerformanceIntegration.proteinBiasPctPoints}%`,
      });
      cards.push({
        label: t("kpiHydrationFloor"),
        value: `×${nutritionPerformanceIntegration.hydrationFloorMultiplier.toFixed(2)}`,
      });
    }
    if (!cards.length) {
      return [{ label: t("kpiIntegrationModel"), value: "—" }];
    }
    return cards;
  }, [pathwayModulation, nutritionPerformanceIntegration, t]);

  const [functionalCatalog, setFunctionalCatalog] = useState<FunctionalNutrientCatalogEntry[]>(FUNCTIONAL_NUTRIENT_CATALOG);
  useEffect(() => {
    loadFunctionalNutrientCatalogClient()
      .then(setFunctionalCatalog)
      .catch(() => {});
  }, []);

  const functionalFoodRecommendations = useMemo((): FunctionalFoodRecommendationsViewModel =>
    buildFunctionalFoodRecommendationsViewModel(pathwayModulation?.pathways ?? null, functionalCatalog), [pathwayModulation, functionalCatalog]);

  const effectiveFunctionalMealSelector = useMemo(
    (): FunctionalMealSelectorViewModel | null =>
      buildFunctionalMealSelectorViewModel({
        date: selectedPlanDate,
        pathwayModulation,
        foodRecommendations: functionalFoodRecommendations,
        nutritionPerformanceIntegration,
        approvedNutritionPatches: nutritionApprovedPatches,
        applicationDirective: nutritionApplicationDirective
          ? {
              focus: nutritionApplicationDirective.focus,
              coachValidatedMemoryCount: nutritionApplicationDirective.coachValidatedMemoryCount,
              coachValidatedMemoryLines: nutritionApplicationDirective.coachValidatedMemoryLines,
            }
          : null,
        adaptationLoop,
        recoverySummary,
        twin: twinState,
      }) ?? functionalMealSelector,
    [
      selectedPlanDate,
      pathwayModulation,
      functionalFoodRecommendations,
      nutritionPerformanceIntegration,
      nutritionApprovedPatches,
      nutritionApplicationDirective,
      adaptationLoop,
      recoverySummary,
      twinState,
      functionalMealSelector,
    ],
  );

  const pathwayTargetsByMealSlot = useMemo(
    () =>
      assignPathwayTargetsToMealSlots({
        targets: functionalFoodRecommendations.targets,
        planDate: selectedPlanDate,
        athleteId: athleteId ?? "",
        maxPerSlot: 3,
        selectorSlots: functionalMealSelector?.slots,
        pathwayModulation,
      }),
    [functionalFoodRecommendations.targets, selectedPlanDate, athleteId, functionalMealSelector?.slots, pathwayModulation],
  );

  useEffect(() => {
    const isMealPlanRoute =
      (pathname ?? "").replace(/\/$/, "") === "/nutrition" ||
      (pathname ?? "").replace(/\/$/, "") === "/nutrition/meal-plan";
    if (!isMealPlanRoute) return;
    if (!athleteId) return;
    const slots = pathwayTargetsByMealSlot;
    const keys: PathwayMealSlotKey[] = activeDietMealSlotKeys;
    setMealPathwayBySlot((prev) => {
      const next = { ...prev };
      for (const k of keys) {
        next[k] = {
          loading: true,
          error: null,
          foods: [],
          pathwayTargets: slots[k],
          usdaConfigured: true,
          lookupQueries: collectSearchQueriesForSlot(slots[k]),
        };
      }
      return next;
    });
    let cancelled = false;
    void (async () => {
      const results = await Promise.all(
        keys.map(async (k) => {
          const t = slots[k];
          const ids = catalogIdsForSlot(t);
          const res = await fetchUsdaFoodsForCatalogIds(ids);
          return { k, t, res };
        }),
      );
      if (cancelled) return;
      setMealPathwayBySlot((prev) => {
        const next = { ...prev };
        for (const { k, t, res } of results) {
          next[k] = {
            loading: false,
            error: res.error,
            foods: res.foods,
            pathwayTargets: t,
            usdaConfigured: res.usdaConfigured,
            lookupQueries: collectSearchQueriesForSlot(t),
          };
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId, pathwayTargetsByMealSlot, activeDietMealSlotKeys, pathname]);

  /** Giorno gara: pasta/riso pre-gara è deterministico — non bloccare su catalogo pathway USDA. */
  const raceDayPreRaceContext = useMemo(
    () =>
      buildRacePreLunchDayContext({
        weightKg: profile?.weight_kg,
        planDate: selectedPlanDate,
        routineConfig: profile?.routine_config ?? null,
        plannedSessions: mapPlannedSessionsForRaceDetection(selectedPlanSessions),
        activeMealSlots: activeDietMealSlotKeys,
      }),
    [profile?.weight_kg, profile?.routine_config, selectedPlanDate, selectedPlanSessions, activeDietMealSlotKeys],
  );

  const mealPlanGenerationReady = true;

  const resolvedMealDailyEnergyKcal = nutritionDayModel?.totals.mealsKcal ?? dailyEnergyKcal;
  const resolvedFuelingChoGPerHour =
    (nutritionDayModel?.fueling.adjustedChoGPerHour ?? 0) > 0
      ? (nutritionDayModel?.fueling.adjustedChoGPerHour ?? fuelingChoGPerHour)
      : fuelingChoGPerHour;
  const effectiveSessionDurationMin =
    effectiveDayContext.mode === "none" ? sessionDurationMin : effectiveDayContext.summary.totalDurationMin;
  const effectiveSessionIntensityPctFtp =
    effectiveDayContext.mode === "none"
      ? sessionIntensityPctFtp
      : effectiveDayContext.summary.estimatedIntensityPctFtp;
  const resolvedFuelingTier = nutritionDayModel?.fueling.capabilityTier ?? "base";
  const resolvedFuelingTierBand =
    resolvedFuelingTier === "elite"
      ? "120-130 g/h"
      : resolvedFuelingTier === "high"
        ? "90-110 g/h"
        : "60-90 g/h";
  const routineRaceDay = useMemo(
    () =>
      detectRoutineRaceDay({
        routineConfig: profile?.routine_config ?? null,
        planDate: selectedPlanDate,
      }),
    [profile?.routine_config, selectedPlanDate],
  );

  const fuelingReadiness = useMemo(() => {
    const missing: string[] = [];
    if (!profile) {
      missing.push("athlete profile");
    } else {
      if (!profile.birth_date) missing.push("birth date");
      if (!profile.sex) missing.push("gender");
      if (!hasPositiveNumber(profile.height_cm)) missing.push("height");
      if (!hasPositiveNumber(profile.weight_kg)) missing.push("weight");
    }
    if (!physio) {
      missing.push("physiological profile");
    } else {
      // Gate SOLO su ciò che il motore fueling usa davvero: FTP (base dei blocchi
      // potenza) — il resto era richiesto per errore: LT1/LT2 non compaiono nei
      // calcoli fueling, il VO2 è stimato dalla potenza e VLaMax è opzionale con
      // fallback (fueling-planned-session-analysis). Il gate stretto bloccava per
      // sempre chi non aveva il test lattato ("Still missing: LT1, LT2, VLaMax…").
      if (!hasPositiveNumber(physio.ftp_watts)) missing.push("FTP");
    }
    /** Fueling: seduta in calendario oppure giorno gara in routine (start + durata). */
    if (!selectedPlanSessions.length && !routineRaceDay) {
      missing.push(FUELING_MISSING_DAY_TRAINING);
    }
    const onlyDayTrainingMissing = missing.length === 1 && missing[0] === FUELING_MISSING_DAY_TRAINING;
    const hasProfileOrPhysiologyGap = missing.some((m) => m !== FUELING_MISSING_DAY_TRAINING);
    const dayTrainingAlsoMissing = missing.includes(FUELING_MISSING_DAY_TRAINING);
    return {
      ready: missing.length === 0,
      missing,
      onlyDayTrainingMissing,
      hasProfileOrPhysiologyGap,
      dayTrainingAlsoMissing,
    };
  }, [profile, physio, selectedPlanSessions.length, routineRaceDay]);

  const fuelingExecutionConfirmations = useMemo(() => {
    const raw = record(profile?.nutrition_config).fueling_execution_confirmations;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return {} as Record<string, { confirmed?: boolean; at?: string }>;
    }
    const out: Record<string, { confirmed?: boolean; at?: string }> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const vr = record(v);
      out[k] = {
        confirmed: Boolean(vr.confirmed),
        at: typeof vr.at === "string" ? vr.at : undefined,
      };
    }
    return out;
  }, [profile?.nutrition_config]);

  const fuelingConfirmedForSelectedDate = Boolean(fuelingExecutionConfirmations[selectedPlanDate]?.confirmed);

  const predictorEffectiveTimeMin = predictorUsePlanDay ? effectiveSessionDurationMin : predictorTimeMin;
  const predictorEffectiveIntensityPctFtp = predictorUsePlanDay ? effectiveSessionIntensityPctFtp : predictorIntensityPctFtp;
  const fuelingTrainingContext = useMemo<FuelingTrainingContextRow[]>(() => {
    if (!fuelingReadiness.ready) return [];
    const ftp = n(physio?.ftp_watts, 0);
    const weightKg = n(profile?.weight_kg, 0);
    const choGh = Math.max(0, resolvedFuelingChoGPerHour);

    type PlannedFuelSrc = {
      kind: "planned";
      session: NutritionPlannedWorkoutRow;
      input: {
        id: string;
        title: string;
        durationMinutesDb: number | null | undefined;
        tssTargetDb: number | null | undefined;
        kcalTargetDb: number | null | undefined;
        builderSession: Pro2BuilderSessionContract | null;
      };
    };
    const plannedSources: PlannedFuelSrc[] = selectedPlanSessions.map((session) => {
      const builder = resolveBuilderSessionForPlannedRow({
        builderSession: session.builderSession as Pro2BuilderSessionContract | null | undefined,
        notes: typeof session.notes === "string" ? session.notes : null,
      });
      return {
        kind: "planned",
        session,
        input: {
          id: String(session.id),
          title: String(session.plannedSessionName ?? builder?.sessionName ?? session.plannedDiscipline ?? session.type ?? "Session"),
          durationMinutesDb: session.duration_minutes as number | null | undefined,
          tssTargetDb: session.tss_target as number | null | undefined,
          kcalTargetDb: session.kcal_target as number | null | undefined,
          builderSession: builder,
        },
      };
    });

    const routineSynthetic = buildRoutineSyntheticFuelingSessionInput({
      routineConfig: profile?.routine_config ?? null,
      planDate: selectedPlanDate,
    });
    const sources = plannedSources;
    if (!sources.length && !routineSynthetic) return [];

    const inputs = sources.length
      ? sources.map((s) => s.input)
      : routineSynthetic
        ? [routineSynthetic]
        : [];

    const analyzed = analyzePlannedSessionsForFueling({
      sessions: inputs,
      weightKg,
      ftpWatts: ftp,
      physiology: physiologyState,
      choIngestedGH: choGh,
    });
    const byId = new Map(analyzed.map((a) => [a.id, a]));

    if (!sources.length && routineSynthetic) {
      const analysis = byId.get(routineSynthetic.id);
      return [
        {
          id: routineSynthetic.id,
          builderContract: null,
          title: routineSynthetic.title,
          family: "endurance",
          discipline: "cycling",
          target: "race",
          durationMin: routineSynthetic.durationMinutesDb,
          tss: routineSynthetic.tssTargetDb,
          kcal: 0,
          structure: "Race (routine)",
          blockLabels: [],
          intensityCues: [],
          substrate: analysis
            ? {
                estimatedIntensityPctFtp: analysis.substrate.estimatedIntensityPctFtp,
                lactateProducedG: round(analysis.substrate.lactateProducedG, 1),
                glucoseFromCoriG: round(analysis.substrate.glucoseFromCoriG, 1),
                glucoseNetFromCoriG: round(analysis.substrate.glucoseNetFromCoriG, 1),
                exogenousOxidizedG: round(analysis.substrate.exogenousOxidizedG, 1),
                choAvailableG: round(analysis.substrate.choAvailableG, 1),
                glycolyticSharePct: round(analysis.substrate.glycolyticSharePct, 1),
                gutPathwayRisk: analysis.substrate.gutPathwayRisk,
                bloodDeliveryPctOfIngested: round(analysis.substrate.bloodDeliveryPctOfIngested, 1),
                glycogenCombustedNetG: round(analysis.substrate.glycogenCombustedNetG, 1),
                glucoseRequiredForStrategyG: round(analysis.substrate.glucoseRequiredForStrategyG, 1),
              }
            : null,
          physiologicalIntent: analysis?.physiologicalIntent ?? ["Race day from routine — intra support from Fueling."],
          nutritionSupports: analysis?.nutritionSupports ?? [],
          inhibitorsAndRisks: analysis?.inhibitorsAndRisks ?? [],
          choEnergyWeight: analysis?.dayChoEnergyWeight ?? Math.max(1, routineSynthetic.tssTargetDb),
        },
      ];
    }

    return sources.map((src) => {
      const session = src.session;
        const builder = resolveBuilderSessionForPlannedRow({
          builderSession: session.builderSession as Pro2BuilderSessionContract | null | undefined,
          notes: typeof session.notes === "string" ? session.notes : null,
        });
        const blocks = builder?.blocks ?? [];
        const blockLabels = blocks
          .slice(0, 3)
          .map((block) => block.label)
          .filter(Boolean);
        const intensityCues = Array.from(
          new Set(
            blocks
              .map((block) => (typeof block.intensityCue === "string" ? block.intensityCue.trim() : ""))
              .filter(Boolean),
          ),
        ).slice(0, 2);
        const target = session.plannedAdaptationTarget ?? builder?.adaptationTarget ?? null;
        const m = effectivePlannedWorkoutNutritionMetrics({
          durationMinutesDb: session.duration_minutes as number | null | undefined,
          tssTargetDb: session.tss_target as number | null | undefined,
          kcalTargetDb: session.kcal_target as number | null | undefined,
          builderSession: builder,
          athleteFtpWatts: physio?.ftp_watts ?? null,
        });
        const analysis = byId.get(String(session.id));
        return {
          id: String(session.id),
          builderContract: builder,
          title: String(session.plannedSessionName ?? builder?.sessionName ?? session.plannedDiscipline ?? session.type ?? "Session"),
          family: session.plannedFamily ? String(session.plannedFamily) : builder?.family ?? null,
          discipline: session.plannedDiscipline ? String(session.plannedDiscipline) : builder?.discipline ?? (session.type ? String(session.type) : null),
          target: target ? String(target) : null,
          durationMin: m.durationMinutes,
          tss: m.tss,
          kcal: m.kcal,
          structure: blockLabels[0] ?? builder?.sessionName ?? null,
          blockLabels,
          intensityCues,
          substrate: analysis
            ? {
                estimatedIntensityPctFtp: analysis.substrate.estimatedIntensityPctFtp,
                lactateProducedG: round(analysis.substrate.lactateProducedG, 1),
                glucoseFromCoriG: round(analysis.substrate.glucoseFromCoriG, 1),
                glucoseNetFromCoriG: round(analysis.substrate.glucoseNetFromCoriG, 1),
                exogenousOxidizedG: round(analysis.substrate.exogenousOxidizedG, 1),
                choAvailableG: round(analysis.substrate.choAvailableG, 1),
                glycolyticSharePct: round(analysis.substrate.glycolyticSharePct, 1),
                gutPathwayRisk: analysis.substrate.gutPathwayRisk,
                bloodDeliveryPctOfIngested: round(analysis.substrate.bloodDeliveryPctOfIngested, 1),
                glycogenCombustedNetG: round(analysis.substrate.glycogenCombustedNetG, 1),
                glucoseRequiredForStrategyG: round(analysis.substrate.glucoseRequiredForStrategyG, 1),
              }
            : null,
          physiologicalIntent: analysis?.physiologicalIntent ?? [],
          nutritionSupports: analysis?.nutritionSupports ?? [],
          inhibitorsAndRisks: analysis?.inhibitorsAndRisks ?? [],
          choEnergyWeight: analysis?.dayChoEnergyWeight ?? Math.max(1, m.tss),
        };
    });
  }, [
    fuelingReadiness.ready,
    selectedPlanSessions,
    profile?.weight_kg,
    physio?.ftp_watts,
    physiologyState,
    resolvedFuelingChoGPerHour,
    profile?.routine_config,
    selectedPlanDate,
  ]);

  const fuelingEngineDaySummary = useMemo(() => {
    const subs = fuelingTrainingContext.map((s) => s.substrate).filter(Boolean);
    if (!subs.length) return null;
    return {
      lactateG: subs.reduce((acc, s) => acc + (s?.lactateProducedG ?? 0), 0),
      coriG: subs.reduce((acc, s) => acc + (s?.glucoseFromCoriG ?? 0), 0),
      coriNetG: subs.reduce((acc, s) => acc + (s?.glucoseNetFromCoriG ?? 0), 0),
      exoG: subs.reduce((acc, s) => acc + (s?.exogenousOxidizedG ?? 0), 0),
    };
  }, [fuelingTrainingContext]);

  const fuelingPlannedSummary = useMemo(() => {
    const totalDurationMin = fuelingTrainingContext.reduce((sum, session) => sum + Math.max(0, n(session.durationMin, 0)), 0);
    const totalTss = fuelingTrainingContext.reduce((sum, session) => sum + Math.max(0, n(session.tss, 0)), 0);
    const weightedIntensityNum = fuelingTrainingContext.reduce((sum, session) => {
      const duration = Math.max(1, n(session.durationMin, 0));
      return sum + n(session.substrate?.estimatedIntensityPctFtp, 0) * duration;
    }, 0);
    const weightedIntensityDen = fuelingTrainingContext.reduce((sum, session) => sum + Math.max(1, n(session.durationMin, 0)), 0);
    return {
      totalDurationMin: totalDurationMin > 0 ? totalDurationMin : sessionDurationMin,
      totalTss,
      estimatedIntensityPctFtp:
        weightedIntensityNum > 0 && weightedIntensityDen > 0
          ? weightedIntensityNum / weightedIntensityDen
          : sessionIntensityPctFtp,
    };
  }, [fuelingTrainingContext, sessionDurationMin, sessionIntensityPctFtp]);
  const fuelingPlannedEstimatedAvgPowerW =
    physio?.ftp_watts != null ? round(physio.ftp_watts * (fuelingPlannedSummary.estimatedIntensityPctFtp / 100)) : null;

  /** Con due o più sessioni pianificate, stima ripartizione g CHO intra in base al peso glicolitico (cho kcal) per sessione. */
  const fuelingIntraChoSplitBySession = useMemo(() => {
    const rows = fuelingTrainingContext.filter((s) => s.durationMin > 0);
    if (rows.length < 2) return null;
    const weights = rows.map((s) => Math.max(0.01, n(s.choEnergyWeight, s.tss || 1)));
    const sumW = weights.reduce((a, b) => a + b, 0);
    if (sumW <= 0) return null;
    const h = Math.max(0.5, fuelingPlannedSummary.totalDurationMin / 60);
    const intraTotal = Math.max(
      round(nutritionDayModel?.fueling.intraChoG ?? 0, 1),
      round(resolvedFuelingChoGPerHour * h, 1),
    );
    return rows.map((s, i) => ({
      id: s.id,
      label: String(s.title),
      choG: round(intraTotal * (weights[i] / sumW), 1),
    }));
  }, [fuelingTrainingContext, fuelingPlannedSummary.totalDurationMin, nutritionDayModel, resolvedFuelingChoGPerHour]);

  const knowledgeFuelingHints = useMemo(() => {
    const supports = Array.from(
      new Set(fuelingTrainingContext.flatMap((session) => session.nutritionSupports).filter(Boolean)),
    );
    const risks = Array.from(
      new Set(fuelingTrainingContext.flatMap((session) => session.inhibitorsAndRisks).filter(Boolean)),
    );
    const intents = Array.from(
      new Set(fuelingTrainingContext.flatMap((session) => session.physiologicalIntent).filter(Boolean)),
    );
    return { supports, risks, intents };
  }, [fuelingTrainingContext]);

  useEffect(() => {
    async function loadFuelingMedia() {
      const payload = await fetchNutritionMediaRows();
      if (payload.error) return;
      const rows = (payload.rows as MediaAssetRow[]) ?? [];
      const fuelingPrimary: Record<string, string> = {};
      for (const row of rows) {
        if (row.media_kind !== "image") continue;
        if (row.entity_type === "fueling" && !fuelingPrimary[row.entity_key]) {
          fuelingPrimary[row.entity_key] = row.url;
        }
      }
      setFuelingMediaByKey(fuelingPrimary);
    }

    void loadFuelingMedia();
  }, []);

  useEffect(() => {
    if (!profile) {
      lastNutritionHydrationKey.current = "";
      return;
    }
    const dayPlannedSig = planned
      .filter((p) => String(p.date ?? "").slice(0, 10) === selectedPlanDate)
      .map((p) => `${String(p.id)}:${String(p.duration_minutes ?? "")}`)
      .sort()
      .join(";");
    const hydrationKey = `${athleteId ?? ""}|${selectedPlanDate}|${JSON.stringify(profile.nutrition_config ?? null)}|${JSON.stringify(profile.routine_config ?? null)}|${dayPlannedSig}`;
    if (hydrationKey === lastNutritionHydrationKey.current) return;
    lastNutritionHydrationKey.current = hydrationKey;

    const nc = record(profile.nutrition_config);
    const rc = record(profile.routine_config);
    const mealPlan = record(nc.meal_plan);
    const macroFromMealPlan = record(mealPlan.macro_split);
    const macroRoot = record(nc.macro_split);

    const dietForDay = resolveNutritionDietDay(nc, selectedPlanDate);
    if (dietForDay.caloricDistribution) {
      setCaloricSplit(dietForDay.caloricDistribution);
    } else {
      const splitFromMealPlan = record(mealPlan.caloric_split);
      const splitRoot = record(nc.caloric_split);
      const useMealPlanSplit =
        splitFromMealPlan.breakfast_pct != null ||
        splitFromMealPlan.lunch_pct != null ||
        splitFromMealPlan.dinner_pct != null ||
        splitFromMealPlan.snacks_pct != null;
      const split = useMealPlanSplit ? splitFromMealPlan : splitRoot;
      setCaloricSplit({
        breakfast: n(split.breakfast_pct, 25),
        lunch: n(split.lunch_pct, 35),
        dinner: n(split.dinner_pct, 30),
        snacks: n(split.snacks_pct, 10),
      });
    }
    if (dietForDay.dailyMacros) {
      setMacroSplit(dietForDay.dailyMacros);
    } else {
      const useMealPlanMacro = macroFromMealPlan.carbs_pct != null || macroFromMealPlan.protein_pct != null;
      const macro = useMealPlanMacro ? macroFromMealPlan : macroRoot;
      setMacroSplit({
        carbs: n(macro.carbs_pct, 50),
        protein: n(macro.protein_pct, 25),
        fat: n(macro.fat_pct, 25),
      });
    }

    const fromCountMode = mapMealCountModeToMealStrategy(dietForDay.mealCountMode);
    setMealStrategy(fromCountMode ?? String(mealPlan.meal_strategy ?? nc.meal_strategy ?? "3-meals"));

    setDailyEnergyKcal(n(mealPlan.daily_kcal, 3000));

    const times = record(record(rc.meal_times));
    const flatMealTimes = {
      breakfast: String(times.breakfast ?? "07:30"),
      lunch: String(times.lunch ?? "13:00"),
      dinner: String(times.dinner ?? "20:00"),
      snack_am: String(times.snack_am ?? "10:30"),
      snack_pm: String(times.snack_pm ?? times.snacks ?? "16:30"),
    };
    const sessionsThisDay = planned.filter((p) => p.date === selectedPlanDate);
    const racePlannedSessions = mapPlannedSessionsForRaceDetection(sessionsThisDay);
    const resolvedTimes = resolveMealTimesForNutritionPlanDate({
      routineConfig: rc,
      planDate: selectedPlanDate,
      mealTimesFlatFromRoot: flatMealTimes,
      plannedSessions: racePlannedSessions,
      weightKg: profile?.weight_kg,
    });
    const weekTimes = mealTimesFromRoutineWeekPlanForDate(rc, selectedPlanDate, {
      ...flatMealTimes,
      snack_evening: String(times.snack_evening ?? "22:30"),
    });
    setMealTimes({
      ...resolvedTimes,
      snack_evening: weekTimes.snack_evening ?? String(times.snack_evening ?? "22:30"),
    });

    const fuelingCfg = record(nc.fueling);
    const predictorCfg = record(nc.performance_predictor);
    setSessionDurationMin(n(fuelingCfg.session_duration_min, 120));
    setSessionIntensityPctFtp(n(fuelingCfg.session_intensity_pct_ftp, 78));
    setFuelingChoGPerHour(n(fuelingCfg.cho_g_h, 75));
    setFluidMlPerHour(n(fuelingCfg.fluid_ml_h, 650));
    setSodiumMgPerHour(n(fuelingCfg.sodium_mg_h, 700));
    setCofactor(String(fuelingCfg.cofactor ?? "Bicarbonato + Caffeina"));

    setPredictorSport(String(predictorCfg.sport ?? "Running"));
    setPredictorDistanceKm(n(predictorCfg.distance_km, 21));
    setPredictorTimeMin(n(predictorCfg.event_time_min, 95));
    setPredictorIntensityPctFtp(n(predictorCfg.intensity_pct_ftp, 84));
  }, [profile, athleteId, selectedPlanDate, planned]);

  const profileSupplements = useMemo(() => {
    const fromSupp = profile?.supplements ?? [];
    const brands = record(profile?.supplement_config).selected_brands;
    const fromBrands = Array.isArray(brands) ? brands.map((x) => String(x)) : [];
    return Array.from(new Set([...fromSupp, ...fromBrands]));
  }, [profile]);

  const preferredBrands = useMemo(() => profileSupplements.slice(0, 6), [profileSupplements]);

  const normalizedPreferredBrands = useMemo(() => {
    const fromProfile = preferredBrands
      .map((raw) => {
        const lower = raw.toLowerCase();
        const found = BRAND_ALIASES.find((b) => b.aliases.some((a) => lower.includes(a)));
        return found?.label ?? null;
      })
      .filter((v): v is string => !!v);
    if (fromProfile.length) return Array.from(new Set(fromProfile));
    return ["Enervit", "SiS", "Maurten", "+Watt", "Powerbar"];
  }, [preferredBrands]);

  const restrictedTokens = useMemo(() => {
    const tokens = [
      ...(profile?.allergies ?? []),
      ...(profile?.intolerances ?? []),
      ...(profile?.food_exclusions ?? []),
    ]
      .map((x) => String(x).toLowerCase().trim())
      .filter(Boolean);
    return Array.from(new Set(tokens));
  }, [profile]);

  const filteredLookupResults = useMemo(() => {
    if (!restrictedTokens.length) return foodLookupResults;
    return foodLookupResults.filter((item) => {
      const hay = `${item.label} ${item.brand ?? ""}`.toLowerCase();
      return !restrictedTokens.some((t) => hay.includes(t));
    });
  }, [foodLookupResults, restrictedTokens]);

  /** Eseguiti ordinati per data desc (la finestra API è come il calendario: asc); per medie serve “ultimi 7”. */
  const recent7 = useMemo(() => {
    const sorted = [...executed].sort((a, b) => String(b.date).slice(0, 10).localeCompare(String(a.date).slice(0, 10)));
    return sorted.slice(0, 7);
  }, [executed]);
  const avgTss7 = useMemo(() => (recent7.length ? recent7.reduce((s, x) => s + n(x.tss), 0) / recent7.length : 0), [recent7]);
  const lactateAvg = useMemo(() => (recent7.length ? recent7.reduce((s, x) => s + n(x.lactate_mmoll), 0) / recent7.length : 0), [recent7]);
  const glucoseAvg = useMemo(() => (recent7.length ? recent7.reduce((s, x) => s + n(x.glucose_mmol, 5.1), 0) / recent7.length : 0), [recent7]);
  const smo2Avg = useMemo(() => (recent7.length ? recent7.reduce((s, x) => s + n(x.smo2, 56), 0) / recent7.length : 0), [recent7]);

  const dominantStimulus = useMemo(() => {
    const ftp = n(physio?.ftp_watts, 260);
    if (avgTss7 > 95 || lactateAvg > 4.8) return "High-intensity glycolytic";
    if (n(twinState?.redoxStressIndex, 0) > 55) return "Redox / recovery constrained";
    if (n(twinState?.glycogenStatus, 100) < 35) return "Low glycogen availability";
    if (avgTss7 > 70 || ftp > 290) return "Threshold endurance";
    if (smo2Avg < 52) return "Oxygen extraction stress";
    return "Aerobic base / recovery";
  }, [avgTss7, lactateAvg, smo2Avg, physio, twinState]);

  const fuelingPhysiology = useMemo(() => {
    const metabolic = physiologyState?.metabolicProfile;
    const lactate = physiologyState?.lactateProfile;
    const performance = physiologyState?.performanceProfile;
    const gutDeliveryPct = clamp(n(lactate?.bloodDeliveryPctOfIngested, 88), 45, 100);
    const sequestrationPct = clamp(n(lactate?.effectiveSequestrationPct, 0), 0, 35);
    const gutStressPct = clamp(n(lactate?.gutStressScore, 0) * 100, 0, 100);
    const dysbiosisPct = clamp(n(lactate?.microbiotaDysbiosisScore, 0) * 100, 0, 100);
    const coriFromPlannedSessions = fuelingTrainingContext.reduce((acc, s) => acc + (s.substrate?.glucoseFromCoriG ?? 0), 0);
    const coriReturnG =
      coriFromPlannedSessions > 0.05 ? coriFromPlannedSessions : Math.max(0, n(lactate?.glucoseFromCoriG, 0));
    const exoFromPlannedSessions = fuelingTrainingContext.reduce((acc, s) => acc + (s.substrate?.exogenousOxidizedG ?? 0), 0);
    const exogenousOxidizedG =
      exoFromPlannedSessions > 0.05 ? exoFromPlannedSessions : Math.max(0, n(lactate?.exogenousOxidizedG, 0));
    let choWeightedNum = 0;
    let choWeightedDen = 0;
    for (const s of fuelingTrainingContext) {
      const sub = s.substrate;
      if (!sub) continue;
      const w = Math.max(1, s.durationMin);
      choWeightedNum += sub.glycolyticSharePct * w;
      choWeightedDen += w;
    }
    const choShareFromSessions = choWeightedDen > 0 ? choWeightedNum / choWeightedDen : null;
    const choSharePct = clamp(
      choShareFromSessions != null ? choShareFromSessions : n(lactate?.glycolyticSharePct, 65),
      45,
      96,
    );
    const oxidativeCeilingKcalMin = Math.max(0, n(performance?.oxidativeCapacityKcalMin, 0));
    const redoxPct = clamp(n(performance?.redoxStressIndex, twinState?.redoxStressIndex ?? 0), 0, 100);
    const gutPathwayRisk = String(lactate?.gutPathwayRisk ?? "stable");
    const pcrCapacityJ = Math.max(0, n(metabolic?.pcrCapacityJ, 0));
    const vLamax = n(metabolic?.vLamax, physio?.v_lamax ?? 0);
    return {
      gutDeliveryPct,
      sequestrationPct,
      gutStressPct,
      dysbiosisPct,
      coriReturnG,
      exogenousOxidizedG,
      choSharePct,
      oxidativeCeilingKcalMin,
      redoxPct,
      gutPathwayRisk,
      pcrCapacityJ,
      vLamax,
    };
  }, [physiologyState, twinState, physio, fuelingTrainingContext]);

  const effectiveMacroSplit = useMemo(() => {
    const base = resolvedDietDay.dailyMacros ?? macroSplit;
    const bump = nutritionPerformanceIntegration?.proteinBiasPctPoints ?? 0;
    if (!bump) return base;
    const protein = Math.min(45, base.protein + bump);
    const fat = Math.max(15, base.fat - bump);
    return { ...base, protein, fat };
  }, [macroSplit, nutritionPerformanceIntegration, resolvedDietDay.dailyMacros]);

  const effectiveCaloricDistribution = useMemo((): CaloricDistribution | null => {
    if (isUsableCaloricDistribution(resolvedDietDay.caloricDistribution)) {
      return resolvedDietDay.caloricDistribution;
    }
    if (isUsableCaloricDistribution(caloricSplit)) return caloricSplit;
    return null;
  }, [resolvedDietDay.caloricDistribution, caloricSplit]);

  const distributionForMealRows = useMemo((): CaloricDistribution | null => {
    if (!effectiveCaloricDistribution) return null;
    if (effectiveMealCountMode === "6") {
      const r = resolveSixMealSnackPercentages(effectiveCaloricDistribution);
      return {
        ...effectiveCaloricDistribution,
        snack_am: r.snack_am,
        snack_pm: r.snack_pm,
        snack_evening: r.snack_evening,
        snacks: r.snacksTotal,
      };
    }
    return effectiveCaloricDistribution;
  }, [effectiveCaloricDistribution, effectiveMealCountMode]);

  const suppressedSnackSlots = useMemo(
    () =>
      computeSnackSlotsSuppressedByTrainingWindow({
        routineConfig: profile?.routine_config ?? null,
        planDate: selectedPlanDate,
        mealTimesFlatFromRoot: mealTimes,
        plannedSessions: selectedPlanSessions,
      }),
    [profile?.routine_config, selectedPlanDate, mealTimes, selectedPlanSessions],
  );

  const mealRows = useMemo(() => {
    if (!distributionForMealRows) return [];
    return buildDietMealSlotBudgets({
      mealCountMode: effectiveMealCountMode,
      caloricDistribution: distributionForMealRows,
      dailyKcal: resolvedMealDailyEnergyKcal,
      macroSplit: effectiveMacroSplit,
      mealTimes,
      round,
    });
  }, [
    distributionForMealRows,
    effectiveMealCountMode,
    resolvedMealDailyEnergyKcal,
    effectiveMacroSplit,
    mealTimes,
  ]);

  const diaryDayMacroTargets = useMemo(
    () => ({
      carbs: mealRows.reduce((s, m) => s + m.carbs, 0),
      protein: mealRows.reduce((s, m) => s + m.protein, 0),
      fat: mealRows.reduce((s, m) => s + m.fat, 0),
    }),
    [mealRows],
  );

  const mealPlanCards = useMemo(() => {
    return mealRows.map((row) => {
      const icon =
        row.key === "breakfast"
          ? "🌅"
          : row.key === "lunch"
            ? "🥗"
            : row.key === "dinner"
              ? "🌙"
              : row.key === "snack_evening"
                ? "🌙"
                : row.key === "snack_am"
                  ? "☕"
                  : "🥤";
      return {
        ...row,
        icon,
        portionHint: portionHintForMealKcal(row.kcal),
      };
    });
  }, [mealRows]);

  /** Kcal/macro per pasto: solo Diet (mai rollup USDA). USDA = composizione alimenti post-generazione. */
  const mealPlanCardsDisplay = mealPlanCards;

  /**
   * Righe esposte in Meal plan: dopo la generazione allinea alla base solver (6 slot)
   * anche se la griglia Diet locale era ancora a 4 pasti.
   */
  const mealPlanWorkspaceRows = useMemo(() => {
    const basis = intelligentMealPlan?.solverBasis?.slots;
    if (!basis?.length) return mealPlanCards;
    const byKey = new Map(mealPlanCards.map((r) => [r.key as MealSlotKey, r]));
    return basis.map((s) => {
      const existing = byKey.get(s.slot);
      if (existing) return existing;
      const icon =
        s.slot === "breakfast"
          ? "🌅"
          : s.slot === "lunch"
            ? "🥗"
            : s.slot === "dinner"
              ? "🌙"
              : s.slot === "snack_evening"
                ? "🌙"
                : s.slot === "snack_am"
                  ? "☕"
                  : "🥤";
      return {
        key: s.slot,
        label: s.labelIt,
        pct: 0,
        time: s.scheduledTimeLocal,
        kcal: s.targetKcal,
        carbs: s.targetCarbsG,
        protein: s.targetProteinG,
        fat: s.targetFatG,
        icon,
        portionHint: portionHintForMealKcal(s.targetKcal),
      };
    });
  }, [intelligentMealPlan, mealPlanCards]);

  const mealDisplayByKey = useMemo(() => {
    const m = new Map<MealSlotKey, (typeof mealPlanWorkspaceRows)[number]>();
    for (const row of mealPlanWorkspaceRows) {
      m.set(row.key as MealSlotKey, row);
    }
    return m;
  }, [mealPlanWorkspaceRows]);

  const trainingDayLinesForMealPlan = useMemo(
    () =>
      effectiveDayContext.sessions.map((s) =>
        [
          `${s.title}: ${Math.round(s.durationMin)} min`,
          `TSS ~${Math.round(s.tss)}`,
          s.kcal ? `est. kcal ${Math.round(s.kcal)}` : null,
          s.source === "executed" ? "executed" : "planned",
        ]
          .filter(Boolean)
          .join(", "),
      ),
    [effectiveDayContext],
  );

  const mealPlanIntegrationSolverLines = useMemo(() => {
    const p = nutritionDayModel?.performanceIntegration;
    if (!p) return [];
    return [
      `Recovery/bio (indicator, does not reduce requirement) ×${p.trainingEnergyScale.toFixed(2)}`,
      `Meals/training share ${Math.round(p.mealTrainingFraction * 100)}%`,
      `Intra CHO ×${p.fuelingChoScale.toFixed(2)}`,
      `Meal protein +${p.proteinBiasPctPoints}%`,
      `Session fluid ×${p.sessionFluidMultiplier.toFixed(2)}`,
      ...p.rationale.slice(0, 8),
    ];
  }, [nutritionDayModel?.performanceIntegration]);

  /** Reality (diario) + twin snapshot: contesto L2 per il composer, senza sostituire il solver. */
  const diaryTwinContextLinesForMealPlan = useMemo(() => {
    const lines: string[] = [];
    const insight = nutritionPerformanceIntegration?.diaryInsight;
    if (insight && insight.windowDays != null && insight.loggedDays != null) {
      lines.push(`Diary: ${insight.loggedDays}/${insight.windowDays} days with logged entries (ingest).`);
      if (insight.energyAdequacyRatio != null && Number.isFinite(insight.energyAdequacyRatio)) {
        lines.push(`Diary energy adequacy vs. target ~${Math.round(insight.energyAdequacyRatio * 100)}%.`);
      }
      if (insight.avgDailyKcal != null) {
        lines.push(`Recent diary average ~${Math.round(insight.avgDailyKcal)} kcal.`);
      }
    }
    const dayRows = diaryMacroRows.filter((d) => d.date === selectedPlanDate);
    if (dayRows.length) {
      const kcalSum = dayRows.reduce((s, r) => s + r.kcal, 0);
      if (kcalSum >= 30) {
        lines.push(
          `${selectedPlanDate}: diary entries ~${Math.round(kcalSum)} kcal (${dayRows.length} records) · comparison with deterministic plan.`,
        );
      }
    }
    const g = twinState?.glycogenStatus;
    const read = twinState?.readiness;
    if (typeof g === "number" && Number.isFinite(g) && typeof read === "number" && Number.isFinite(read)) {
      lines.push(
        `Twin: glycogen ~${Math.round(g)}%, readiness ~${Math.round(read)}% (interpretation only — plan numbers from solver).`,
      );
    }
    return lines;
  }, [
    diaryMacroRows,
    nutritionPerformanceIntegration?.diaryInsight,
    selectedPlanDate,
    twinState?.glycogenStatus,
    twinState?.readiness,
  ]);

  const intelligentMealPlanRequest = useMemo(() => {
    if (!athleteId || !profile) return null;
    const mergedFoodExclusions = [
      ...new Set(
        [...(profile.food_exclusions ?? []).map((x) => String(x).trim()), ...coachSessionFoodExclusions.map((x) => x.trim())].filter(
          Boolean,
        ),
      ),
    ];
    const base = buildIntelligentMealPlanRequest({
      athleteId,
      planDate: selectedPlanDate,
      plannedSessionsForDay: mapPlannedSessionsForRaceDetection(selectedPlanSessions),
      profile: {
        diet_type: profile.diet_type,
        intolerances: profile.intolerances,
        allergies: profile.allergies,
        food_exclusions: mergedFoodExclusions.length ? mergedFoodExclusions : profile.food_exclusions,
        food_preferences: profile.food_preferences,
        supplements: profile.supplements,
        routine_config: profile.routine_config,
        weight_kg: profile.weight_kg,
      },
      mealRows: mealPlanCards.map((m) => ({
        key: m.key,
        label: m.label,
        kcal: m.kcal,
        carbs: m.carbs,
        protein: m.protein,
        fat: m.fat,
        timeLocal: m.time,
      })),
      mealPathwayBySlot,
      contextLines: [
        ...diaryTwinContextLinesForMealPlan,
        recoverySummary?.guidance,
        ...(pathwayModulation?.notes ?? []).slice(0, 5),
        ...(nutritionPerformanceIntegration?.rationale ?? []).slice(0, 6),
        metabolicEfficiencyGenerativeModel?.headline,
        ...(nutritionApplicationDirective?.rationale ?? []).slice(0, 4),
        ...(nutritionApplicationDirective?.coachValidatedMemoryLines ?? [])
          .slice(0, 3)
          .map((line) => (line.trim() ? `Coach-validated memory: ${line.trim().slice(0, 200)}` : ""))
          .filter(Boolean),
        ...(nutritionApplicationDirective?.focus?.length
          ? [`Directive focus: ${nutritionApplicationDirective.focus.join(", ")}`]
          : []),
      ].filter((s): s is string => Boolean(s && String(s).trim())),
      pathwayModulation,
      trainingDayLines: trainingDayLinesForMealPlan,
      integrationLeverLines: mealPlanIntegrationSolverLines,
    });
    const withPlaybook = mergePlaybookIntoMealPlanRequest(base, applicationPlaybook);
    const weekId = isoWeekBucketId(selectedPlanDate);
    const payload = readMealRotationWeekPayload(athleteId, weekId);
    const weeklyStapleCounts = aggregateStapleCountsForWeek(payload, selectedPlanDate);
    return {
      ...withPlaybook,
      ...(Object.keys(weeklyStapleCounts).length ? { weeklyStapleCounts } : {}),
      ...(nutritionPerformanceIntegration ? { performanceIntegration: nutritionPerformanceIntegration } : {}),
    };
  }, [
    athleteId,
    profile,
    selectedPlanDate,
    mealPlanCards,
    mealPathwayBySlot,
    recoverySummary?.guidance,
    pathwayModulation,
    nutritionPerformanceIntegration?.rationale,
    metabolicEfficiencyGenerativeModel?.headline,
    trainingDayLinesForMealPlan,
    mealPlanIntegrationSolverLines,
    coachSessionFoodExclusions,
    selectedPlanSessions,
    nutritionApplicationDirective,
    applicationPlaybook,
    diaryTwinContextLinesForMealPlan,
  ]);

  const removeCoachMealPlanItem = useCallback((slot: MealSlotKey, index: number, foodLabel: string) => {
    const label = foodLabel.trim();
    const key = `${slot}:${index}`;
    setCoachMealRemovalKeys((prev) => new Set(prev).add(key));
    if (label) {
      setCoachSessionFoodExclusions((prev) => (prev.includes(label) ? prev : [...prev, label]));
    }
  }, []);

  const persistFoodExclusionToProfile = useCallback(
    async (slot: MealSlotKey, index: number, foodLabel: string) => {
      const label = foodLabel.trim();
      if (!athleteId || !profile || !label) return;
      const key = `${slot}:${index}`;
      setProfileFoodExcludeBusy(label);
      setError(null);
      try {
        const next = [...new Set([...(profile.food_exclusions ?? []).map(String), label])];
        await updateProfilePayload(athleteId, { food_exclusions: next });
        setProfile({ ...profile, food_exclusions: next });
        setCoachMealRemovalKeys((prev) => new Set(prev).add(key));
        setCoachSessionFoodExclusions((prev) => (prev.includes(label) ? prev : [...prev, label]));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Profile exclusion not saved");
      }
      setProfileFoodExcludeBusy(null);
    },
    [athleteId, profile],
  );

  const handleGenerateIntelligentMealPlan = useCallback(async () => {
    if (!athleteId || !intelligentMealPlanRequest) return;
    setIntelligentMealLoading(true);
    setIntelligentMealError(null);
    const result = await fetchIntelligentMealPlan(athleteId, intelligentMealPlanRequest);
    setIntelligentMealLoading(false);
    if (!result.ok) {
      setIntelligentMealError(result.error);
      return;
    }
    setIntelligentMealPlan(result.body);
    setCoachMealRemovalKeys(new Set());
    const rot = result.body.mealRotationStaples;
    const planD = result.body.solverBasis?.planDate;
    if (rot?.length && planD) {
      recordPlanDayStaples(athleteId, isoWeekBucketId(planD), planD, rot);
    }
  }, [athleteId, intelligentMealPlanRequest]);

  /**
   * Auto-genera il piano allineato al profilo (deterministico, USDA-backed)
   * appena i prerequisiti sono pronti. Evita la doppia interazione "piano base
   * placeholder -> click Genera": niente "piano base" con kcal distribuite
   * uniformemente fra righe (che produceva numeri non realistici tipo
   * 1 banana = target/n_righe kcal).
   *
   * Non riprova in loop se la generazione fallisce: l'utente puo' usare il
   * bottone "Genera il mio piano pasti" per ritentare.
   */
  useEffect(() => {
    if (!athleteId) return;
    if (!intelligentMealPlanRequest) return;
    if (!mealPlanGenerationReady) return;
    if (intelligentMealPlan) return;
    if (intelligentMealLoading) return;
    if (intelligentMealError) return;
    void handleGenerateIntelligentMealPlan();
  }, [
    athleteId,
    intelligentMealPlanRequest,
    mealPlanGenerationReady,
    intelligentMealPlan,
    intelligentMealLoading,
    intelligentMealError,
    handleGenerateIntelligentMealPlan,
  ]);

  const mealPlanEnergyLedger = useMemo((): NutritionMealPlanEnergyLedger | null => {
    let assembled: number | null = null;
    if (intelligentMealPlan?.slots?.length) {
      let t = 0;
      for (const sl of intelligentMealPlan.slots) {
        const sk = sl.slot as MealSlotKey;
        for (let ii = 0; ii < sl.items.length; ii++) {
          if (coachMealRemovalKeys.has(`${sk}:${ii}`)) continue;
          t += sl.items[ii]?.approxKcal ?? 0;
        }
      }
      assembled = Math.round(t);
    }
    if (!nutritionDayModel && assembled == null) return null;
    return {
      mealsKcalSolver: nutritionDayModel?.totals.mealsKcal ?? null,
      dailyKcalSolver: nutritionDayModel?.totals.dailyKcal ?? null,
      fuelingKcalSolver: nutritionDayModel?.totals.fuelingKcal ?? null,
      trainingKcalSolver: nutritionDayModel?.training.kcal ?? null,
      assembledUsdaKcalSum: assembled,
    };
  }, [nutritionDayModel, intelligentMealPlan, coachMealRemovalKeys]);

  const complianceOverview = useMemo(() => {
    const targetKcal = mealRows.reduce((s, m) => s + m.kcal, 0);
    const targetCarbs = mealRows.reduce((s, m) => s + m.carbs, 0);
    const targetProtein = mealRows.reduce((s, m) => s + m.protein, 0);
    const targetFat = mealRows.reduce((s, m) => s + m.fat, 0);

    const today = new Date().toISOString().slice(0, 10);
    const todayEntries = diaryMacroRows.filter((d) => d.date === today);
    const weekEntries = diaryMacroRows.filter((d) => {
      const stamp = new Date(`${d.date}T00:00:00`).getTime();
      const now = Date.now();
      return now - stamp <= 7 * 24 * 60 * 60 * 1000;
    });

    const sum = (rows: FoodDiaryComplianceRow[]) =>
      rows.reduce(
        (acc, r) => ({
          kcal: acc.kcal + n(r.kcal),
          carbs: acc.carbs + n(r.carbs),
          protein: acc.protein + n(r.protein),
          fat: acc.fat + n(r.fat),
        }),
        { kcal: 0, carbs: 0, protein: 0, fat: 0 },
      );

    const todayTotals = sum(todayEntries);
    const weekTotals = sum(weekEntries);
    const daysCovered = Math.max(1, new Set(weekEntries.map((e) => e.date)).size);
    const weekAvg = {
      kcal: weekTotals.kcal / daysCovered,
      carbs: weekTotals.carbs / daysCovered,
      protein: weekTotals.protein / daysCovered,
      fat: weekTotals.fat / daysCovered,
    };

    const scoreFor = (actual: number, target: number) => {
      if (target <= 0) return 0;
      const dev = Math.abs((actual - target) / target) * 100;
      return Math.max(0, 100 - dev);
    };

    const todayScore = Math.round(
      (scoreFor(todayTotals.kcal, targetKcal) +
        scoreFor(todayTotals.carbs, targetCarbs) +
        scoreFor(todayTotals.protein, targetProtein) +
        scoreFor(todayTotals.fat, targetFat)) /
        4,
    );
    const weekScore = Math.round(
      (scoreFor(weekAvg.kcal, targetKcal) +
        scoreFor(weekAvg.carbs, targetCarbs) +
        scoreFor(weekAvg.protein, targetProtein) +
        scoreFor(weekAvg.fat, targetFat)) /
        4,
    );

    return {
      target: { kcal: targetKcal, carbs: targetCarbs, protein: targetProtein, fat: targetFat },
      today: { ...todayTotals, score: todayScore, entries: todayEntries.length },
      week: { ...weekAvg, score: weekScore, entries: weekEntries.length, daysCovered },
    };
  }, [mealRows, diaryMacroRows]);

  const nutrientSummary = useMemo(() => {
    const foodDb: Record<
      string,
      {
        kcal: number;
        cho: number;
        pro: number;
        fat: number;
        vitC?: number;
        vitD?: number;
        b2?: number;
        b3?: number;
        mg?: number;
        fe?: number;
        omega3?: number;
        leucine?: number;
        carbType?: string;
      }
    > = {
      omelette: { kcal: 290, cho: 3, pro: 24, fat: 20, vitD: 2.2, b2: 0.52, b3: 0.2, mg: 22, fe: 2.7, leucine: 1.9 },
      mela: { kcal: 62, cho: 16, pro: 0.3, fat: 0.2, vitC: 5, b2: 0.03, b3: 0.1, mg: 6, fe: 0.2, carbType: "Fruttosio/Fibra" },
      yogurt: { kcal: 88, cho: 8, pro: 7, fat: 3, vitD: 1.3, b2: 0.34, b3: 0.2, mg: 18, fe: 0.1, leucine: 0.7 },
      cereali: { kcal: 150, cho: 29, pro: 4, fat: 2, b2: 0.09, b3: 1.6, mg: 36, fe: 2.2, carbType: "Amido" },
      riso: { kcal: 430, cho: 94, pro: 8, fat: 1, b2: 0.1, b3: 2, mg: 38, fe: 1.2, carbType: "Amido" },
      salmone: { kcal: 330, cho: 0, pro: 33, fat: 21, vitD: 9, b2: 0.5, b3: 12, mg: 40, fe: 0.9, omega3: 3.2, leucine: 2.7 },
      verdure: { kcal: 70, cho: 13, pro: 4, fat: 1, vitC: 40, b2: 0.15, b3: 1, mg: 48, fe: 1.5, carbType: "Fibra" },
      evo: { kcal: 108, cho: 0, pro: 0, fat: 12, omega3: 0.8 },
      patate: { kcal: 245, cho: 56, pro: 4, fat: 0.3, vitC: 22, b3: 2.2, mg: 40, fe: 0.8, carbType: "Amido" },
      frutta: { kcal: 95, cho: 22, pro: 1, fat: 0.4, vitC: 25, b2: 0.08, b3: 0.4, mg: 18, fe: 0.4, carbType: "Fruttosio/Fibra" },
      proteica: { kcal: 110, cho: 3, pro: 23, fat: 1.5, b2: 0.18, b3: 0.6, mg: 38, fe: 0.5, leucine: 2.2 },
      frutta_secca: { kcal: 120, cho: 4, pro: 4, fat: 10, vitC: 0, b2: 0.13, b3: 1.1, mg: 52, fe: 1.1, omega3: 0.6, carbType: "Fibra" },
    };

    const totals = {
      kcal: 0,
      cho: 0,
      pro: 0,
      fat: 0,
      vitC: 0,
      vitD: 0,
      b2: 0,
      b3: 0,
      mg: 0,
      fe: 0,
      omega3: 0,
      leucine: 0,
      carbTypes: new Set<string>(),
    };

    const mapToken = (item: string) => {
      const lower = item.toLowerCase();
      if (lower.includes("omelette") || lower.includes("egg")) return "omelette";
      if (lower.includes("mela") || lower.includes("apple")) return "mela";
      if (lower.includes("yogurt")) return "yogurt";
      if (lower.includes("cereali") || lower.includes("cereal") || lower.includes("oat")) return "cereali";
      if (lower.includes("riso") || lower.includes("rice")) return "riso";
      if (lower.includes("salmone") || lower.includes("salmon") || lower.includes("pesce") || lower.includes("fish")) return "salmone";
      if (lower.includes("verdure") || lower.includes("salad") || lower.includes("spinach") || lower.includes("broccoli"))
        return "verdure";
      if (lower.includes("olio") || lower.includes("olive oil")) return "evo";
      if (lower.includes("patate") || lower.includes("potato")) return "patate";
      if (lower.includes("frutta secca") || lower.includes("nut") || lower.includes("almond") || lower.includes("walnut"))
        return "frutta_secca";
      if (lower.includes("frutta") || lower.includes("fruit") || lower.includes("banana")) return "frutta";
      if (lower.includes("proteica") || lower.includes("whey") || lower.includes("yogurt greco") || lower.includes("cottage"))
        return "proteica";
      return null;
    };

    const slotKeys: PathwayMealSlotKey[] = activeDietMealSlotKeys;
    for (const slot of slotKeys) {
      const bundle = mealPathwayBySlot[slot];
      if (!bundle) continue;
      for (const food of (bundle.foods ?? []).slice(0, 6)) {
        const kcal = food.energyKcal100;
        if (kcal != null && Number.isFinite(kcal)) totals.kcal += kcal;
        const p = food.proteinG100;
        const c = food.carbsG100;
        const fa = food.fatG100;
        if (p != null && Number.isFinite(p)) totals.pro += p;
        if (c != null && Number.isFinite(c)) totals.cho += c;
        if (fa != null && Number.isFinite(fa)) totals.fat += fa;
      }
      const microKeys = new Set<string>();
      const textSeeds: string[] = [];
      for (const t of bundle.pathwayTargets ?? []) {
        textSeeds.push(t.displayNameIt, ...t.searchQueries);
      }
      for (const food of bundle.foods ?? []) textSeeds.push(food.description);
      for (const raw of textSeeds) {
        const key = mapToken(raw);
        if (!key || microKeys.has(key)) continue;
        microKeys.add(key);
        const f = foodDb[key];
        totals.vitC += f.vitC ?? 0;
        totals.vitD += f.vitD ?? 0;
        totals.b2 += f.b2 ?? 0;
        totals.b3 += f.b3 ?? 0;
        totals.mg += f.mg ?? 0;
        totals.fe += f.fe ?? 0;
        totals.omega3 += f.omega3 ?? 0;
        totals.leucine += f.leucine ?? 0;
        if (f.carbType) totals.carbTypes.add(f.carbType);
      }
    }

    return {
      kcal: round(totals.kcal),
      cho: round(totals.cho),
      pro: round(totals.pro),
      fat: round(totals.fat),
      vitC: round(totals.vitC, 1),
      vitD: round(totals.vitD, 1),
      b2: round(totals.b2, 2),
      b3: round(totals.b3, 2),
      mg: round(totals.mg),
      fe: round(totals.fe, 2),
      omega3: round(totals.omega3, 2),
      leucine: round(totals.leucine, 2),
      carbTypes: Array.from(totals.carbTypes).join(", "),
    };
  }, [mealPathwayBySlot]);

  const effectiveFluidMlPerHour = useMemo(
    () => round(fluidMlPerHour * (nutritionPerformanceIntegration?.sessionFluidMultiplier ?? 1)),
    [fluidMlPerHour, nutritionPerformanceIntegration],
  );

  const hydrationPlan = useMemo(() => {
    const floorMul = nutritionPerformanceIntegration?.hydrationFloorMultiplier ?? 1;
    const minDailyMl = Math.max(2200, n(profile?.weight_kg, 0) * 33) * floorMul;
    const fluidRate = effectiveFluidMlPerHour > 0 ? effectiveFluidMlPerHour : 650;
    const trainingMl = Math.max(600, Math.round((effectiveSessionDurationMin / 60) * fluidRate));
    return {
      minDailyMl: round(minDailyMl),
      trainingMl,
      sodiumMinMg: Math.round((trainingMl / 500) * 400),
    };
  }, [effectiveSessionDurationMin, profile, nutritionPerformanceIntegration, effectiveFluidMlPerHour]);

  const mealTabMicronutrientProps = useMemo(() => {
    const dayTotals = intelligentMealPlan?.nutrientRollup?.dayTotals;
    if (dayTotals) {
      return mealPlanDayTotalsToMicroLines(dayTotals, { stripZero: true });
    }
    return pathwayNutrientSummaryToMicroLines(nutrientSummary, hydrationPlan.minDailyMl);
  }, [intelligentMealPlan?.nutrientRollup?.dayTotals, nutrientSummary, hydrationPlan.minDailyMl]);

  /** Un protocollo pre/intra/post per seduta pianificata (≥2 sessioni); altrimenti un solo blocco “giornata”. */
  const fuelingSessionPackages = useMemo(() => {
    if (!fuelingReadiness.ready) return [];

    type TimelineStep = FuelingSlot & {
      product: FuelingProduct | undefined;
      displayImage: string;
      isLogoFallback: boolean;
      minuteOffset: number;
    };

    const fpGly = {
      choSharePct: fuelingPhysiology.choSharePct,
      vLamax: fuelingPhysiology.vLamax,
      oxidativeCeilingKcalMin: fuelingPhysiology.oxidativeCeilingKcalMin,
      redoxPct: fuelingPhysiology.redoxPct,
      gutDeliveryPct: fuelingPhysiology.gutDeliveryPct,
      coriReturnG: fuelingPhysiology.coriReturnG,
    };

    const supplements = profileSupplements;

    function enrichSlots(slots: FuelingProtocolSlot[]): TimelineStep[] {
      const products = slots.map((slot) => {
        if (slot.catalogProduct) return slot.catalogProduct;
        for (const brand of normalizedPreferredBrands) {
          const product = FUELING_PRODUCT_CATALOG.find((p) => p.brand === brand && p.category === slot.category);
          if (product) return product;
        }
        return FUELING_PRODUCT_CATALOG.find((p) => p.category === slot.category) ?? FUELING_PRODUCT_CATALOG[0];
      });
      return slots.map((slot, idx) => {
        const product = products[idx];
        const { displayImage, isLogoFallback } = resolveFuelingProductImage(product, slot.category, fuelingMediaByKey);
        return {
          ...slot,
          product,
          displayImage,
          isLogoFallback,
          minuteOffset: parseFuelingMinuteOffset(slot.time),
        };
      });
    }

    function timelineFromSteps(steps: TimelineStep[]) {
      const byPhase: Record<"pre" | "intra" | "post", TimelineStep[]> = { pre: [], intra: [], post: [] };
      for (const step of steps) {
        const key = step.phase.toLowerCase().includes("pre")
          ? "pre"
          : step.phase.toLowerCase().includes("post")
            ? "post"
            : "intra";
        byPhase[key].push(step);
      }
      byPhase.pre.sort((a, b) => a.minuteOffset - b.minuteOffset);
      byPhase.intra.sort((a, b) => a.minuteOffset - b.minuteOffset);
      byPhase.post.sort((a, b) => a.minuteOffset - b.minuteOffset);
      return [...byPhase.pre, ...byPhase.intra, ...byPhase.post];
    }

    const dayHours = Math.max(0.5, fuelingPlannedSummary.totalDurationMin / 60);
    const dayPre = Math.max(15, round(nutritionDayModel?.fueling.preChoG ?? 20));
    const dayPost = Math.max(25, round(nutritionDayModel?.fueling.postChoG ?? 30));
    const dayIntraTotal = Math.max(
      round(nutritionDayModel?.fueling.intraChoG ?? 0, 1),
      round(resolvedFuelingChoGPerHour * dayHours, 1),
    );
    const engineSuffixDay =
      fuelingEngineDaySummary != null
        ? ` · engine: lact ~${round(fuelingEngineDaySummary.lactateG, 1)} g · Cori ~${round(fuelingEngineDaySummary.coriG, 1)} g · CHOexo ~${round(fuelingEngineDaySummary.exoG, 1)} g`
        : "";
    const intraSplitFull =
      fuelingIntraChoSplitBySession != null && fuelingIntraChoSplitBySession.length > 0
        ? ` · estimated intra split: ${fuelingIntraChoSplitBySession
            .map((x) => {
              const short = x.label.length > 24 ? `${x.label.slice(0, 24)}…` : x.label;
              return `${short} ${x.choG}g`;
            })
            .join(" · ")}`
        : "";

    const buildPackage = (args: {
      id: string | number;
      title: string;
      durationMin: number;
      intensityPctFtp: number;
      preCho: number;
      postCho: number;
      intraTotalCho: number;
      engineSuffix: string;
      intraSplitNote: string;
    }) => {
      const slots = buildFuelingProtocolSlots({
        durationMin: args.durationMin,
        preCho: args.preCho,
        postCho: args.postCho,
        intraTotalCho: args.intraTotalCho,
        effectiveFluidMlPerHour,
        resolvedFuelingTierBand,
        engineSuffix: args.engineSuffix,
        intraSplitNote: args.intraSplitNote,
        profileSupplements: supplements,
        preferredBrands: normalizedPreferredBrands,
      });
      const steps = enrichSlots(slots);
      const timelineSteps = timelineFromSteps(steps);
      const durationH = Math.max(0.25, args.durationMin / 60);
      const choPerHourSession = Math.min(150, args.intraTotalCho / durationH);
      const glyc = computeGlycogenDepletionForFueling({
        weightKg: n(profile?.weight_kg, 0),
        muscleMassKg: profile?.muscle_mass_kg,
        durationMin: args.durationMin,
        intensityPctFtp: args.intensityPctFtp,
        fuelingPhysiology: fpGly,
        resolvedFuelingChoGPerHour: choPerHourSession,
      });
      const glyPlot = buildGlycogenPlotGeometry(glyc);
      const hydrationTimeline = Array.from({ length: Math.max(1, Math.ceil(args.durationMin / 20)) }, (_, i) => {
        const minute = i * 20;
        return { minuteLabel: minute === 0 ? "0'" : `+${minute}'`, note: "500ml + mineral salts" };
      });
      const totalHydration = steps.reduce((s, st) => s + st.fluid, 0);
      const totalCho = steps.reduce((s, st) => s + st.cho, 0);
      const visualMetrics = [
        {
          label: "CHO/h",
          value: round(choPerHourSession),
          unit: "g/h",
          pct: clamp((choPerHourSession / 130) * 100, 8, 100),
          color: "#ff6b00",
        },
        {
          label: "Total hydration",
          value: round(totalHydration),
          unit: "ml",
          pct: clamp((totalHydration / 3000) * 100, 8, 100),
          color: "#0ea5e9",
        },
        {
          label: "Sodium/h",
          value: round(sodiumMgPerHour),
          unit: "mg/h",
          pct: clamp((sodiumMgPerHour / 1200) * 100, 8, 100),
          color: "#8b5cf6",
        },
        {
          label: "Protocol kcal",
          value: round(totalCho * 4),
          unit: "kcal",
          pct: clamp(((totalCho * 4) / 1000) * 100, 8, 100),
          color: "#10b981",
        },
      ];
      const opsCards = [
        { label: "Session CHO", value: `${round(totalCho)} g` },
        { label: "Session fluid", value: `${round(totalHydration)} ml` },
        { label: "Steps", value: `${timelineSteps.length}` },
      ];
      return {
        id: args.id,
        title: args.title,
        durationMin: args.durationMin,
        intensityPctFtp: args.intensityPctFtp,
        choPerHourSession: round(choPerHourSession, 1),
        steps,
        timelineSteps,
        hydrationTimeline,
        visualMetrics,
        opsCards,
        glycogenDepletion: glyc,
        glycogenPlot: glyPlot,
      };
    };

    const sessions = fuelingTrainingContext;

    if (sessions.length <= 1) {
      const s0 = sessions[0];
      const duration = s0?.durationMin ?? fuelingPlannedSummary.totalDurationMin;
      const intensity = s0?.substrate?.estimatedIntensityPctFtp ?? fuelingPlannedSummary.estimatedIntensityPctFtp;
      const engineOne =
        s0?.substrate != null
          ? ` · engine: lact ~${s0.substrate.lactateProducedG} g · Cori ~${s0.substrate.glucoseFromCoriG} g · CHOexo ~${s0.substrate.exogenousOxidizedG} g`
          : engineSuffixDay;
      return [
        buildPackage({
          id: s0?.id ?? "day",
          title: s0?.title ?? "Training day context",
          durationMin: duration,
          intensityPctFtp: intensity,
          preCho: dayPre,
          postCho: dayPost,
          intraTotalCho: dayIntraTotal,
          engineSuffix: engineOne,
          intraSplitNote: "",
        }),
      ];
    }

    const weights = sessions.map((s) => Math.max(0.01, n(s.choEnergyWeight, s.tss || 1)));
    const sumW = weights.reduce((a, b) => a + b, 0);

    return sessions.map((s, i) => {
      const wShare = weights[i] / sumW;
      const preS = Math.max(12, round(dayPre * wShare));
      const postS = Math.max(18, round(dayPost * wShare));
      const intraS =
        fuelingIntraChoSplitBySession?.find((x) => String(x.id) === String(s.id))?.choG ?? round(dayIntraTotal * wShare, 1);
      const dur = Math.max(1, s.durationMin);
      const intens = s.substrate?.estimatedIntensityPctFtp ?? fuelingPlannedSummary.estimatedIntensityPctFtp;
      const eng =
        s.substrate != null
          ? ` · engine: lact ~${s.substrate.lactateProducedG} g · Cori ~${s.substrate.glucoseFromCoriG} g · CHOexo ~${s.substrate.exogenousOxidizedG} g`
          : "";
      return buildPackage({
        id: s.id,
        title: String(s.title),
        durationMin: dur,
        intensityPctFtp: intens,
        preCho: preS,
        postCho: postS,
        intraTotalCho: intraS,
        engineSuffix: eng,
        intraSplitNote: i === 0 ? intraSplitFull : "",
      });
    });
  }, [
    profileSupplements,
    profile,
    fuelingReadiness.ready,
    fuelingPlannedSummary,
    effectiveFluidMlPerHour,
    nutritionDayModel,
    resolvedFuelingChoGPerHour,
    resolvedFuelingTierBand,
    fuelingEngineDaySummary,
    fuelingIntraChoSplitBySession,
    fuelingTrainingContext,
    fuelingPhysiology,
    fuelingMediaByKey,
    normalizedPreferredBrands,
    sodiumMgPerHour,
  ]);

  const integrationProductCards = useMemo(() => {
    const focusPriority: FuelingFunctionalFocus[] = [
      "preworkout",
      "carbo",
      "electrolyte",
      "protein",
      "recovery",
      "eaa",
      "bcaa",
      "caffeine",
      "creatine",
    ];
    const preferred = normalizedPreferredBrands.length
      ? normalizedPreferredBrands
      : Array.from(new Set(FUELING_PRODUCT_CATALOG.map((item) => item.brand))).slice(0, 6);
    const picked: FuelingProduct[] = [];
    for (const focus of focusPriority) {
      for (const brand of preferred) {
        const product = FUELING_PRODUCT_CATALOG.find(
          (item) => item.brand === brand && item.functionalFocus.includes(focus),
        );
        if (product && !picked.some((entry) => entry.brand === product.brand && entry.product === product.product)) {
          picked.push(product);
          break;
        }
      }
    }
    return picked.slice(0, 9).map((product) => ({
      ...product,
      ...resolveFuelingProductImage(product, product.category, fuelingMediaByKey),
    }));
  }, [fuelingMediaByKey, normalizedPreferredBrands]);

  const integrationProductsByTiming = useMemo(() => {
    const buckets: Record<IntegrationTimingBucket, IntegrationProductCardProduct[]> = {
      pre: [],
      intra: [],
      post: [],
    };
    for (const product of integrationProductCards) {
      buckets[primaryIntegrationTimingBucket(product)].push(product);
    }
    return buckets;
  }, [integrationProductCards]);

  const integrationStackSummary = useMemo(() => {
    const brandCount = new Set(integrationProductCards.map((product) => product.brand)).size;
    const focusCount = new Set(integrationProductCards.flatMap((product) => product.functionalFocus)).size;
    const directImages = integrationProductCards.filter((product) => !product.isLogoFallback).length;
    return [
      { label: "Products", value: `${integrationProductCards.length}` },
      { label: "Brands", value: `${brandCount}` },
      { label: "Focus", value: `${focusCount}` },
      { label: "Official images", value: `${directImages}/${integrationProductCards.length}` },
    ];
  }, [integrationProductCards]);

  /** Proiezione glicogeno aggregata sulla giornata (predictor e riepilogo). */
  const glycogenDepletion = useMemo(
    () =>
      computeGlycogenDepletionForFueling({
        weightKg: n(profile?.weight_kg, 72),
        muscleMassKg: profile?.muscle_mass_kg,
        durationMin: effectiveSessionDurationMin,
        intensityPctFtp: effectiveSessionIntensityPctFtp,
        fuelingPhysiology: {
          choSharePct: fuelingPhysiology.choSharePct,
          vLamax: fuelingPhysiology.vLamax,
          oxidativeCeilingKcalMin: fuelingPhysiology.oxidativeCeilingKcalMin,
          redoxPct: fuelingPhysiology.redoxPct,
          gutDeliveryPct: fuelingPhysiology.gutDeliveryPct,
          coriReturnG: fuelingPhysiology.coriReturnG,
        },
        resolvedFuelingChoGPerHour,
      }),
    [
      effectiveSessionDurationMin,
      effectiveSessionIntensityPctFtp,
      profile,
      resolvedFuelingChoGPerHour,
      fuelingPhysiology,
    ],
  );
  const fuelingPlanGlycogenDepletion = useMemo(
    () =>
      computeGlycogenDepletionForFueling({
        weightKg: n(profile?.weight_kg, 0),
        muscleMassKg: profile?.muscle_mass_kg,
        durationMin: fuelingPlannedSummary.totalDurationMin,
        intensityPctFtp: fuelingPlannedSummary.estimatedIntensityPctFtp,
        fuelingPhysiology: {
          choSharePct: fuelingPhysiology.choSharePct,
          vLamax: fuelingPhysiology.vLamax,
          oxidativeCeilingKcalMin: fuelingPhysiology.oxidativeCeilingKcalMin,
          redoxPct: fuelingPhysiology.redoxPct,
          gutDeliveryPct: fuelingPhysiology.gutDeliveryPct,
          coriReturnG: fuelingPhysiology.coriReturnG,
        },
        resolvedFuelingChoGPerHour,
      }),
    [profile, fuelingPlannedSummary, fuelingPhysiology, resolvedFuelingChoGPerHour],
  );

  const fuelingOpsCards = useMemo(() => {
    const totalCho = fuelingSessionPackages.reduce((s, p) => s + p.steps.reduce((x, st) => x + st.cho, 0), 0);
    const totalFluid = fuelingSessionPackages.reduce((s, p) => s + p.steps.reduce((x, st) => x + st.fluid, 0), 0);
    const totalSteps = fuelingSessionPackages.reduce((s, p) => s + p.timelineSteps.length, 0);
    return [
      { label: "CHO total", value: `${round(totalCho)}`, unit: "g", tone: "amber", sub: "Pre + intra + post" },
      { label: "Fluid total", value: `${round(totalFluid)}`, unit: "ml", tone: "cyan", sub: t("opsSessionTotal") },
      { label: "Sodium", value: `${round(sodiumMgPerHour)}`, unit: "mg/h", tone: "violet", sub: t("opsHourlyTarget") },
      { label: "Gut delivery", value: `${round(fuelingPhysiology.gutDeliveryPct)}`, unit: "%", tone: "green", sub: t("opsEstimatedAbsorption") },
      { label: "Glycogen end", value: `${round(fuelingPlanGlycogenDepletion.finalRemaining)}`, unit: "g", tone: "rose", sub: t("opsPlanEnd") },
      { label: "Steps", value: `${totalSteps}`, unit: "", tone: "slate", sub: t("opsOpenableActions") },
    ];
  }, [fuelingSessionPackages, sodiumMgPerHour, fuelingPhysiology.gutDeliveryPct, fuelingPlanGlycogenDepletion.finalRemaining, t]);

  const selectedExecutedKj = useMemo(
    () => selectedExecutedSessions.reduce((sum, session) => sum + n(session.kj, 0), 0),
    [selectedExecutedSessions],
  );

  const nutritionStateCards = useMemo<
    Array<{ label: string; value: string; tone: "amber" | "cyan" | "green" | "rose" | "slate" }>
  >(
    () => [
      {
        label: "Bioenergetic",
        value: `${round(bioenergeticModulation?.mitochondrialReadinessScore ?? 55)}/100`,
        tone:
          bioenergeticModulation?.state === "protective"
            ? "rose"
            : bioenergeticModulation?.state === "watch"
              ? "amber"
              : "cyan",
      },
      {
        label: "Adaptation loop",
        value: `${round(adaptationLoop?.adaptationScore ?? 55)}/100`,
        tone:
          adaptationLoop?.status === "regenerate"
            ? "rose"
            : adaptationLoop?.status === "watch"
              ? "amber"
              : "green",
      },
    ],
    [adaptationLoop, bioenergeticModulation],
  );

  const garminPayload = useMemo(() => {
    const ftp = n(physio?.ftp_watts, 0);
    const steps: GarminFuelingStep[] = fuelingSessionPackages.flatMap((pkg) =>
      pkg.steps.map((slot) => {
        const raw = slot.time.replace("'", "").trim();
        const minute_offset = raw.startsWith("+")
          ? Number(raw.slice(1))
          : raw.startsWith("-")
            ? -Number(raw.slice(1))
            : Number(raw);
        const shortTitle = pkg.title.length > 28 ? `${pkg.title.slice(0, 28)}…` : pkg.title;
        return {
          phase: `[${shortTitle}] ${slot.phase}`,
          minute_offset: Number.isFinite(minute_offset) ? minute_offset : 0,
          icon: slot.icon,
          protocol: slot.plan,
          cho_g: slot.cho,
          hydration_ml: slot.fluid,
          notes: slot.notes,
        };
      }),
    );

    const totalCho = steps.reduce((s, x) => s + x.cho_g, 0);
    const totalHydration = steps.reduce((s, x) => s + x.hydration_ml, 0);

    return {
      schema: "empathy.garmin.fueling.v1",
      generated_at: new Date().toISOString(),
      athlete_id: athleteId,
      sport: predictorSport,
      estimated_intensity_pct_ftp: fuelingPlannedSummary.estimatedIntensityPctFtp,
      ftp_watts: ftp,
      estimated_event_duration_min: fuelingPlannedSummary.totalDurationMin,
      fueling_targets: {
        cho_g_h: resolvedFuelingChoGPerHour,
        fluid_ml_h: fluidMlPerHour,
        sodium_mg_h: sodiumMgPerHour,
      },
      fueling_tier: resolvedFuelingTier,
      fueling_band: resolvedFuelingTierBand,
      glycogen_projection: {
        total_g: fuelingPlanGlycogenDepletion.totalGlycogen,
        consume_total_g: fuelingPlanGlycogenDepletion.totalConsume,
        fueling_total_g: fuelingPlanGlycogenDepletion.totalIntake,
        absorbed_total_g: fuelingPlanGlycogenDepletion.totalAbsorbed,
        cori_total_g: fuelingPlanGlycogenDepletion.totalCori,
        net_total_g: fuelingPlanGlycogenDepletion.totalNet,
        remaining_g: fuelingPlanGlycogenDepletion.finalRemaining,
        remaining_pct: fuelingPlanGlycogenDepletion.finalPct,
        zone: fuelingPlanGlycogenDepletion.finalZone,
      },
      protocol_summary: {
        sessions_count: fuelingSessionPackages.length,
        steps_count: steps.length,
        cho_total_g: totalCho,
        hydration_total_ml: totalHydration,
      },
      steps,
    };
  }, [
    athleteId,
    fluidMlPerHour,
    resolvedFuelingChoGPerHour,
    fuelingSessionPackages,
    fuelingPlanGlycogenDepletion,
    physio,
    predictorSport,
    fuelingPlannedSummary,
    resolvedFuelingTier,
    resolvedFuelingTierBand,
    sodiumMgPerHour,
  ]);

  const predictor = useMemo(() => {
    const ftp = n(physio?.ftp_watts, 260);
    const intensity = clamp(predictorEffectiveIntensityPctFtp / 100, 0.45, 1.1);
    const powerW = ftp * intensity;
    const metabolicKcalH = powerW * 3.587;
    const choFrac = clamp(
      intensity >= 0.9 ? 0.92 : intensity >= 0.82 ? 0.82 : intensity >= 0.72 ? 0.68 : intensity >= 0.62 ? 0.55 : 0.45,
      0.4,
      0.96,
    );
    const physiologyChoFrac = clamp(fuelingPhysiology.choSharePct / 100, 0.45, 0.96);
    const choGH = (metabolicKcalH * choFrac) / 4;
    const muscleKg = n(profile?.muscle_mass_kg, n(profile?.weight_kg, 72) * 0.45);
    const involvedFractionMap: Record<string, number> = {
      Running: 0.78,
      Ciclismo: 0.66,
      Nuoto: 0.72,
      "XC Ski": 0.82,
      Triathlon: 0.8,
      Canoa: 0.58,
      MTB: 0.7,
    };
    const involved = involvedFractionMap[predictorSport] ?? 0.68;
    const muscleGlycogen = muscleKg * 12.5 * involved;
    const liverGlycogen = 95;
    const totalGlycogen = muscleGlycogen + liverGlycogen;
    const eventHours = predictorEffectiveTimeMin / 60;
    const fuelingTotal = resolvedFuelingChoGPerHour * eventHours;
    const absorbedFuelingTotal = fuelingTotal * (fuelingPhysiology.gutDeliveryPct / 100);
    const coriTotal = fuelingPhysiology.coriReturnG > 0 ? round(fuelingPhysiology.coriReturnG * Math.max(1, eventHours / glycogenDepletion.totalHours), 1) : 0;
    const modelChoGH = round((metabolicKcalH * physiologyChoFrac) / 4, 1);
    const netDrainPerHour = Math.max(0, modelChoGH - absorbedFuelingTotal / Math.max(1, eventHours) - coriTotal / Math.max(1, eventHours));
    const exhaustionHours = netDrainPerHour > 0 ? totalGlycogen / netDrainPerHour : 999;
    const totalEnergy = metabolicKcalH * eventHours;
    const maxSustainablePct =
      exhaustionHours >= eventHours ? predictorEffectiveIntensityPctFtp : round(Math.max(55, predictorEffectiveIntensityPctFtp * (exhaustionHours / eventHours)));

    return {
      ftp,
      intensity,
      powerW,
      metabolicKcalH,
      choGH: modelChoGH,
      totalGlycogen,
      eventHours,
      totalEnergy,
      fuelingTotal,
      absorbedFuelingTotal,
      coriTotal,
      exhaustionHours,
      maxSustainablePct,
    };
  }, [physio, profile, predictorEffectiveIntensityPctFtp, predictorSport, predictorEffectiveTimeMin, resolvedFuelingChoGPerHour, fuelingPhysiology, glycogenDepletion.totalHours]);
  const predictorOpsCards = useMemo(
    () => [
      { label: "Power stimata", value: `${round(predictor.powerW)}`, unit: "W", sub: t("predictorSubEventPower"), tone: nutritionToneForLabel("Power stimata") },
      {
        label: "Consumo energetico",
        value: `${round(predictor.metabolicKcalH)}`,
        unit: "kcal/h",
        sub: t("predictorSubMetabolicCost"),
        tone: nutritionToneForLabel("Consumo energetico"),
      },
      { label: "CHO richiesta", value: `${round(predictor.choGH)}`, unit: "g/h", sub: t("predictorSubOxidativeDemand"), tone: nutritionToneForLabel("CHO richiesta") },
      {
        label: "Serbatoio glicogeno",
        value: `${round(predictor.totalGlycogen)}`,
        unit: "g",
        sub: t("predictorSubEstimatedTotalAvailable"),
        tone: nutritionToneForLabel("Serbatoio glicogeno"),
      },
      {
        label: "Esaurimento stimato",
        value: predictor.exhaustionHours > 100 ? "No risk" : `${round(predictor.exhaustionHours, 1)}`,
        unit: predictor.exhaustionHours > 100 ? "" : "h",
        sub: t("predictorSubRiskHorizon"),
        tone: nutritionToneForLabel("Esaurimento stimato"),
      },
      {
        label: "% FTP sostenibile",
        value: `${predictor.maxSustainablePct}`,
        unit: "%",
        sub: t("predictorSubWithCurrentFueling"),
        tone: nutritionToneForLabel("% FTP sostenibile"),
      },
    ],
    [predictor, t],
  );

  async function handleSaveNutrition() {
    if (!athleteId) return;
    setSaving(true);
    setError(null);

    const existingRoutine = record(profile?.routine_config);
    const existingNutrition = record(profile?.nutrition_config);
    const splitForSave = effectiveCaloricDistribution ?? caloricSplit;

    const payloadNutrition = {
      ...existingNutrition,
      /** Diet (% pasti, n° pasti) si modifica solo in Profile → Diet; qui non si riscrive `week_plan`. */
      meal_strategy: mealStrategy,
      caloric_split: {
        breakfast_pct: splitForSave.breakfast,
        lunch_pct: splitForSave.lunch,
        dinner_pct: splitForSave.dinner,
        snacks_pct: splitForSave.snacks,
      },
      meal_plan: {
        daily_kcal: round(resolvedMealDailyEnergyKcal),
        meal_strategy: mealStrategy,
        caloric_split: {
          breakfast_pct: splitForSave.breakfast,
          lunch_pct: splitForSave.lunch,
          dinner_pct: splitForSave.dinner,
          snacks_pct: splitForSave.snacks,
        },
      },
      fueling: {
        session_duration_min: sessionDurationMin,
        session_intensity_pct_ftp: sessionIntensityPctFtp,
        cho_g_h: resolvedFuelingChoGPerHour,
        fluid_ml_h: fluidMlPerHour,
        sodium_mg_h: sodiumMgPerHour,
        cofactor,
      },
      performance_predictor: {
        sport: predictorSport,
        distance_km: predictorDistanceKm,
        event_time_min: predictorTimeMin,
        intensity_pct_ftp: predictorIntensityPctFtp,
      },
      nutriomics_engine: {
        dominant_stimulus: dominantStimulus,
        omics_inputs: ["epigenetica", "microbiota", "blood panels", "intolleranze", "ritmi circadiani", "training analyzer"],
      },
      updated_at: new Date().toISOString(),
    };

    const payloadRoutine = {
      ...existingRoutine,
      meal_times: {
        breakfast: mealTimes.breakfast,
        lunch: mealTimes.lunch,
        dinner: mealTimes.dinner,
        snack_am: mealTimes.snack_am,
        snack_pm: mealTimes.snack_pm,
        snacks: mealTimes.snack_pm,
      },
    };

    try {
      await saveNutritionProfileConfig({
        athleteId,
        nutrition_config: payloadNutrition,
        routine_config: payloadRoutine,
      });
      // Upsert diretto browser→Supabase del toggle adherence (RLS write scoped su athlete_id).
      const supabase = createEmpathyBrowserSupabase();
      if (!supabase) throw new Error("Error saving nutrition adherence toggle");
      const { error: adherenceError } = await supabase.from("nutrition_constraints").upsert(
        {
          athlete_id: athleteId,
          adaptation_adherence_opt_in: adherenceOptIn,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "athlete_id" },
      );
      if (adherenceError) {
        throw new Error(adherenceError.message || "Error saving nutrition adherence toggle");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving nutrition configuration");
    }
    setSaving(false);
  }

  async function persistFuelingExecutionConfirmation(nextConfirmed: boolean) {
    if (!athleteId || !profile) return;
    setFuelingConfirmBusy(true);
    setError(null);
    try {
      const existingNutrition = record(profile.nutrition_config);
      const prev = record(existingNutrition.fueling_execution_confirmations);
      const merged: Record<string, unknown> = { ...prev };
      if (nextConfirmed) {
        merged[selectedPlanDate] = { confirmed: true, at: new Date().toISOString() };
      } else {
        delete merged[selectedPlanDate];
      }
      await saveNutritionProfileConfig({
        athleteId,
        nutrition_config: {
          ...existingNutrition,
          fueling_execution_confirmations: merged,
        },
        routine_config: record(profile.routine_config),
      });
      setNutritionContextVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save fueling confirmation");
    }
    setFuelingConfirmBusy(false);
  }

  async function runFoodLookupForQuery(rawQuery: string) {
    const q = rawQuery.trim();
    if (!q) return;
    setFoodLookupLoading(true);
    setFoodLookupError(null);
    try {
      const url = `/api/nutrition/food-lookup?q=${encodeURIComponent(q)}&brands=${encodeURIComponent(preferredBrands.join(","))}`;
      const res = await fetch(url, { method: "GET" });
      const payload = (await res.json()) as { items?: FoodLookupItem[]; error?: string };
      if (!res.ok) throw new Error(payload.error || "Lookup error");
      setFoodLookupResults(Array.isArray(payload.items) ? payload.items : []);
      setFoodQuery(q);
    } catch (e) {
      setFoodLookupError(e instanceof Error ? e.message : "Food lookup error");
      setFoodLookupResults([]);
    } finally {
      setFoodLookupLoading(false);
    }
  }

  async function runFoodLookup() {
    await runFoodLookupForQuery(foodQuery);
  }

  async function runFoodLookupFromPathway(query: string) {
    await runFoodLookupForQuery(query);
    if (adminScoped) return; // nelle schede admin niente navigazione cross-shell
    router.push("/nutrition/integration");
  }

  async function fetchUsdaRichForCatalog(catalogId: string) {
    setUsdaRichByCatalogId((prev) => ({ ...prev, [catalogId]: { loading: true } }));
    try {
      const res = await fetch(`/api/nutrition/usda-by-nutrient?catalogId=${encodeURIComponent(catalogId)}`);
      const payload = (await res.json()) as { foods?: UsdaRichFoodItemViewModel[]; error?: string };
      if (!res.ok) {
        setUsdaRichByCatalogId((prev) => ({
          ...prev,
          [catalogId]: {
            loading: false,
            error: payload.error || `USDA error (${res.status})`,
            foods: [],
          },
        }));
        return;
      }
      setUsdaRichByCatalogId((prev) => ({
        ...prev,
        [catalogId]: {
          loading: false,
          foods: Array.isArray(payload.foods) ? payload.foods : [],
          error: undefined,
        },
      }));
    } catch (e) {
      setUsdaRichByCatalogId((prev) => ({
        ...prev,
        [catalogId]: {
          loading: false,
          error: e instanceof Error ? e.message : "Network error",
          foods: [],
        },
      }));
    }
  }

  async function saveLookupItemToCatalog(item: FoodLookupItem) {
    const key = `${item.source}-${item.brand ?? "na"}-${item.label}`;
    setSavingCatalogKey(key);
    setFoodLookupError(null);
    try {
      await saveNutritionLookupItem({
        source: item.source,
        brand: item.brand,
        product_name: item.label,
        category: "fueling",
        kcal_100g: item.kcal_100,
        cho_100g: item.carbs_100,
        protein_100g: item.protein_100,
        fat_100g: item.fat_100,
        sodium_mg_100g: item.sodium_mg_100,
        metadata: {
          saved_from: "nutrition_fueling_lookup",
          query: foodQuery.trim(),
          saved_at: new Date().toISOString(),
        },
      });
    } catch (err) {
      setFoodLookupError(err instanceof Error ? err.message : "Error saving to catalog");
    }
    setSavingCatalogKey(null);
  }

  async function exportGarminFuelingPayload() {
    if (!athleteId) return;
    if (!fuelingReadiness.ready) {
      setGarminMessage(`Complete the fueling data first: ${fuelingReadiness.missing.join(", ")}.`);
      return;
    }
    setGarminExporting(true);
    setGarminMessage(null);
    try {
      await saveNutritionDeviceExport({
        athlete_id: athleteId,
        provider: "garmin_connectiq",
        payload: garminPayload,
      });
      setGarminMessage("Garmin payload created and saved to sync history.");

      const blob = new Blob([JSON.stringify(garminPayload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `empathy-garmin-fueling-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setGarminMessage(
        `JSON export created, but DB save unavailable: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    } finally {
      setGarminExporting(false);
    }
  }

  return (
    <Pro2ModulePageShell
      eyebrow={t("shellEyebrow")}
      eyebrowClassName="text-amber-400"
      title={t("shellTitle")}
      description={
        <span className="text-gray-400">
          {t("shellDescription")}
        </span>
      }
    >
      {error && <div className="alert-error">{error}</div>}

      {athleteLoading || loading ? (
        <p className="text-gray-500">{t("loading")}</p>
      ) : !athleteId ? (
        <p className="text-gray-500">{t("noActiveAthlete")}</p>
      ) : (
        <>
          {/* Aree del modulo: subnav consolidato in UN solo mount (inerte nelle schede admin, v2). */}
          <section className="viz-card builder-panel space-y-4" style={{ marginBottom: "12px" }}>
            <div className="flex flex-col gap-3">
              <div className="min-w-0 flex-1">
                <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("nutritionAreas")}</p>
                <div
                  className={adminScoped ? "pointer-events-none cursor-default opacity-50" : undefined}
                  title={adminScoped ? t("availableInDedicatedTab") : undefined}
                  aria-disabled={adminScoped || undefined}
                >
                  <NutritionSubnav />
                </div>
              </div>
            </div>
          </section>

          {/* PRIMARY JOB sopra la piega: scegli il giorno e genera il piano pasti — UNA sola CTA primaria. */}
          {subRoute === "meal-plan" ? (
            <MealPlanSection
              athleteId={athleteId}
              role={role}
              selectedPlanDate={selectedPlanDate}
              setSelectedPlanDate={setSelectedPlanDate}
              platformAdminView={platformAdminView}
              intelligentMealLoading={intelligentMealLoading}
              intelligentMealError={intelligentMealError}
              intelligentMealPlan={intelligentMealPlan}
              setIntelligentMealPlan={setIntelligentMealPlan}
              intelligentMealPlanRequest={intelligentMealPlanRequest}
              mealPlanGenerationReady={mealPlanGenerationReady}
              handleGenerateIntelligentMealPlan={handleGenerateIntelligentMealPlan}
              mealRows={mealRows}
              lowMealsBudgetWarning={lowMealsBudgetWarning}
              setCoachMealRemovalKeys={setCoachMealRemovalKeys}
              setCoachSessionFoodExclusions={setCoachSessionFoodExclusions}
              coachMealRemovalKeys={coachMealRemovalKeys}
              coachSessionFoodExclusions={coachSessionFoodExclusions}
              complianceOverview={complianceOverview}
              selectedPlanDateLabel={selectedPlanDateLabel}
              hydrationPlan={hydrationPlan}
              selectedExecutedKj={selectedExecutedKj}
              nutritionDayModel={nutritionDayModel}
              effectiveDayContext={effectiveDayContext}
              mealPlanEnergyLedger={mealPlanEnergyLedger}
              mealPlanWorkspaceRows={mealPlanWorkspaceRows}
              mealDisplayByKey={mealDisplayByKey}
              mealPathwayBySlot={mealPathwayBySlot}
              pathwayModulation={pathwayModulation}
              nutritionApplicationDirective={nutritionApplicationDirective}
              effectiveFunctionalMealSelector={effectiveFunctionalMealSelector}
              raceDayPreRaceContext={raceDayPreRaceContext}
              suppressedSnackSlots={suppressedSnackSlots}
              effectiveMealCountMode={effectiveMealCountMode}
              resolvedDietDay={resolvedDietDay}
              removeCoachMealPlanItem={removeCoachMealPlanItem}
              persistFoodExclusionToProfile={persistFoodExclusionToProfile}
              profileFoodExcludeBusy={profileFoodExcludeBusy}
              mealTabMicronutrientProps={mealTabMicronutrientProps}
              nutritionStateCards={nutritionStateCards}
              saving={saving}
              handleSaveNutrition={handleSaveNutrition}
              nutritionSectorBoxes={nutritionSectorBoxes}
              functionalFoodRecommendations={functionalFoodRecommendations}
            />
          ) : null}

          {/* Selettore di contesto PRIMA dei numeri per le aree giorno-dipendenti (nel meal plan è nel primary job). */}
          {subRoute !== "meal-plan" ? (
            <section
              id="mod-giorno"
              className="viz-card builder-panel scroll-mt-28 border border-amber-500/25 bg-black/20 px-4 py-3 sm:px-5"
            >
              <div className="flex flex-col gap-3">
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("dayToDisplay")}</span>
                <NutritionPlanDatePicker
                  value={selectedPlanDate}
                  onChange={setSelectedPlanDate}
                  minOffsetDays={-400}
                  maxOffsetDays={400}
                  className="w-full"
                />
              </div>
            </section>
          ) : null}

          {/* Split prescrittivo/consuntivo (2026-07): il DIARIO («today») è solo
              consuntivo — registra cosa hai mangiato + conferma del rifornimento.
              Il protocollo fueling (prescrittivo) vive nel PIANO, sotto il meal plan. */}
          {subRoute === "today" ? (
            <>
              <DiarySection
                athleteId={athleteId}
                onComplianceRowsChange={onDiaryComplianceRows}
                planDateForSolverTargets={selectedPlanDate}
                planDateAnchor={selectedPlanDate}
                diaryEnergyTargetKcal={resolvedMealDailyEnergyKcal}
                diaryMacroTargetCarbsG={diaryDayMacroTargets.carbs}
                diaryMacroTargetProteinG={diaryDayMacroTargets.protein}
                diaryMacroTargetFatG={diaryDayMacroTargets.fat}
                fallbackDailyEnergyKcal={dailyEnergyKcal}
                weightKg={profile?.weight_kg ?? null}
                metabolicEfficiencyIndex={metabolicEfficiencyGenerativeModel?.metabolicEfficiencyIndex ?? null}
              />
              <FuelingSection
                mode="confirmation"
                athleteId={athleteId}
                selectedPlanDate={selectedPlanDate}
                fuelingConfirmBusy={fuelingConfirmBusy}
                saving={saving}
                fuelingConfirmedForSelectedDate={fuelingConfirmedForSelectedDate}
                fuelingExecutionConfirmations={fuelingExecutionConfirmations}
                persistFuelingExecutionConfirmation={persistFuelingExecutionConfirmation}
                fuelingReadiness={fuelingReadiness}
                fuelingOpsCards={fuelingOpsCards}
                fuelingSessionPackages={fuelingSessionPackages}
                recoverySummary={recoverySummary}
                showTech={showTech}
                fuelingTrainingContext={fuelingTrainingContext}
                fuelingIntraChoSplitBySession={fuelingIntraChoSplitBySession}
                knowledgeFuelingHints={knowledgeFuelingHints}
                nutritionPerformanceIntegration={nutritionPerformanceIntegration}
                fuelingPhysiology={fuelingPhysiology}
              />
            </>
          ) : null}

          {subRoute === "fueling" || subRoute === "meal-plan" ? (
            <FuelingSection
              mode={subRoute === "meal-plan" ? "protocol" : "full"}
              athleteId={athleteId}
              selectedPlanDate={selectedPlanDate}
              fuelingConfirmBusy={fuelingConfirmBusy}
              saving={saving}
              fuelingConfirmedForSelectedDate={fuelingConfirmedForSelectedDate}
              fuelingExecutionConfirmations={fuelingExecutionConfirmations}
              persistFuelingExecutionConfirmation={persistFuelingExecutionConfirmation}
              fuelingReadiness={fuelingReadiness}
              fuelingOpsCards={fuelingOpsCards}
              fuelingSessionPackages={fuelingSessionPackages}
              recoverySummary={recoverySummary}
              showTech={showTech}
              fuelingTrainingContext={fuelingTrainingContext}
              fuelingIntraChoSplitBySession={fuelingIntraChoSplitBySession}
              knowledgeFuelingHints={knowledgeFuelingHints}
              nutritionPerformanceIntegration={nutritionPerformanceIntegration}
              fuelingPhysiology={fuelingPhysiology}
            />
          ) : null}

          {subRoute === "integration" ? (
            <IntegrationSection
              integrationDynamicsSummary={integrationDynamicsSummary}
              integrationStackSummary={integrationStackSummary}
              nutritionPerformanceIntegration={nutritionPerformanceIntegration}
              applicationPlaybook={applicationPlaybook}
              showTech={showTech}
              crossDomainInterpretationRoadmap={crossDomainInterpretationRoadmap}
              nutrientInterrogation={nutrientInterrogation}
              pathwayModulation={pathwayModulation}
              selectedPlanDateLabel={selectedPlanDateLabel}
              functionalFoodRecommendations={functionalFoodRecommendations}
              foodLookupLoading={foodLookupLoading}
              runFoodLookupFromPathway={runFoodLookupFromPathway}
              usdaRichByCatalogId={usdaRichByCatalogId}
              fetchUsdaRichForCatalog={fetchUsdaRichForCatalog}
              effectiveFunctionalMealSelector={effectiveFunctionalMealSelector}
              integrationProductCards={integrationProductCards}
              integrationProductsByTiming={integrationProductsByTiming}
              resolvedFuelingChoGPerHour={resolvedFuelingChoGPerHour}
            />
          ) : null}

          {subRoute === "predictor" ? (
            <PredictorSection
              predictorSport={predictorSport}
              setPredictorSport={setPredictorSport}
              predictorDistanceKm={predictorDistanceKm}
              setPredictorDistanceKm={setPredictorDistanceKm}
              predictorTimeMin={predictorTimeMin}
              setPredictorTimeMin={setPredictorTimeMin}
              predictorIntensityPctFtp={predictorIntensityPctFtp}
              setPredictorIntensityPctFtp={setPredictorIntensityPctFtp}
              predictorUsePlanDay={predictorUsePlanDay}
              setPredictorUsePlanDay={setPredictorUsePlanDay}
              predictor={predictor}
              predictorOpsCards={predictorOpsCards}
              effectiveSessionDurationMin={effectiveSessionDurationMin}
              effectiveSessionIntensityPctFtp={effectiveSessionIntensityPctFtp}
              selectedPlanDateShort={selectedPlanDateShort}
              resolvedFuelingTierBand={resolvedFuelingTierBand}
            />
          ) : null}

          {subRoute === "diary" ? (
            <DiarySection
              athleteId={athleteId}
              onComplianceRowsChange={onDiaryComplianceRows}
              planDateForSolverTargets={selectedPlanDate}
              planDateAnchor={selectedPlanDate}
              diaryEnergyTargetKcal={resolvedMealDailyEnergyKcal}
              diaryMacroTargetCarbsG={diaryDayMacroTargets.carbs}
              diaryMacroTargetProteinG={diaryDayMacroTargets.protein}
              diaryMacroTargetFatG={diaryDayMacroTargets.fat}
              fallbackDailyEnergyKcal={dailyEnergyKcal}
              weightKg={profile?.weight_kg ?? null}
              metabolicEfficiencyIndex={metabolicEfficiencyGenerativeModel?.metabolicEfficiencyIndex ?? null}
            />
          ) : null}

          {/* In fondo: accordion unico «Dettagli e motore» (metodologia, parametri, diagnostica coach/admin). */}
          <section id="mod-dettagli-motore" className="scroll-mt-28" style={{ marginTop: "4px" }}>
            <Pro2Accordion
              accent="amber"
              title={t("howItWorksTitle")}
              subtitle={t("howItWorksSubtitle")}
            >
              <div className="space-y-5 text-sm text-gray-300">
                {subRoute === "meal-plan" ? (
                  <>
                    <div>
                      <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("mealPlanHowTitle")}</p>
                      <p className="mt-1 leading-relaxed text-gray-400">
                        {t("mealPlanHowBody")}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                      <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
                        {t("adherenceAdaptationTitle")}
                      </p>
                      <label className="inline-flex items-center gap-2 text-sm text-gray-200">
                        <input
                          type="checkbox"
                          checked={adherenceOptIn}
                          disabled={saving || adherenceConfigLoading}
                          onChange={(event) => setAdherenceOptIn(event.target.checked)}
                        />
                        {t("adherenceAdaptationToggle")}
                      </label>
                      <p className="m-0 mt-1 text-[0.75rem] leading-relaxed text-gray-400">
                        {t("adherenceAdaptationHint")}
                      </p>
                    </div>
                  </>
                ) : null}

                {subRoute === "fueling" || subRoute === "meal-plan" ? (
                  <div>
                    <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("fuelingHowTitle")}</p>
                    <p className="mt-1 leading-relaxed text-gray-400">
                      {t("fuelingHowBody")}
                    </p>
                  </div>
                ) : null}

                {subRoute === "integration" ? (
                  <>
                    <div>
                      <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("integrationHowTitle")}</p>
                      <p className="mt-1 leading-relaxed text-gray-400">
                        {t("integrationHowBody")}
                      </p>
                    </div>
                    <details className="collapsible-card" style={{ marginBottom: 0 }}>
                      <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
                        {t("brandsCatalogTokens", {
                          count: profileSupplements.length
                            ? t("entriesCount", { n: profileSupplements.length })
                            : t("defaultSet"),
                        })}
                      </summary>
                      <p className="nutrition-muted" style={{ fontSize: "0.75rem", marginTop: "8px", marginBottom: "8px", lineHeight: 1.45 }}>
                        {t("supplementsMatchingNote")}
                      </p>
                      {profileSupplements.length ? (
                        <ul
                          className="nutrition-muted m-0 flex max-h-48 list-none flex-wrap gap-1.5 overflow-y-auto p-0"
                          style={{ fontSize: "0.68rem", lineHeight: 1.35 }}
                        >
                          {profileSupplements.map((token) => (
                            <li
                              key={token}
                              className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 font-mono text-[0.65rem] font-semibold text-gray-300"
                            >
                              {token}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="nutrition-muted m-0" style={{ fontSize: "0.75rem" }}>
                          {t("noProfileTokens")}
                        </p>
                      )}
                    </details>
                  </>
                ) : null}

                {subRoute === "predictor" ? (
                  <div>
                    <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("predictorHowTitle")}</p>
                    <p className="mt-1 leading-relaxed text-gray-400">
                      {t("predictorHowBody")}
                    </p>
                  </div>
                ) : null}

                {subRoute === "diary" || subRoute === "today" ? (
                  <div>
                    <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("diaryHowTitle")}</p>
                    <p className="mt-1 leading-relaxed text-gray-400">
                      {t("diaryHowBody")}
                    </p>
                  </div>
                ) : null}

                {showTech && subRoute === "meal-plan" ? (
                  <div className="space-y-4 border-t border-white/10 pt-4">
                    <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-amber-400">
                      {t("technicalDiagnostics")}
                    </p>
                    {researchTraceSummaries.length ? (
                      <ResearchTraceStatusSummary traces={researchTraceSummaries} label={t("nutritionResearchStatus")} />
                    ) : null}
                    {athleteId && isMealPlanV2PreviewUiEnabled() ? (
                      <MealPlanV2PreviewPanel athleteId={athleteId} planRequest={intelligentMealPlanRequest} />
                    ) : null}
                  </div>
                ) : null}

                {showTech && (subRoute === "fueling" || subRoute === "meal-plan") && fuelingReadiness.ready ? (
                  <div className="space-y-3 border-t border-white/10 pt-4">
                    <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-amber-400">
                      {t("technicalDiagnosticsFueling")}
                    </p>
                    <div className="nutrition-detail-rail" style={{ marginBottom: 0 }}>
                      <span><strong>{t("diagDay")}</strong> {selectedPlanDateShort}</span>
                      <span><strong>{t("diagPlannedDuration")}</strong> {round(fuelingPlannedSummary.totalDurationMin)} min</span>
                      <span><strong>{t("diagPlannedIntensity")}</strong> {round(fuelingPlannedSummary.estimatedIntensityPctFtp)}% FTP</span>
                      <span><strong>{t("diagFuelingTier")}</strong> {resolvedFuelingTierBand}</span>
                      {fuelingPlannedEstimatedAvgPowerW != null && (
                        <span><strong>{t("diagEstimatedAvgPower")}</strong> {round(fuelingPlannedEstimatedAvgPowerW)} W</span>
                      )}
                      <span><strong>{t("diagChoDelivery")}</strong> {round(fuelingPhysiology.gutDeliveryPct)}%</span>
                      <span><strong>{t("diagCoriReturn")}</strong> {round(fuelingPhysiology.coriReturnG)} g</span>
                      <span><strong>{t("diagRedox")}</strong> {round(fuelingPhysiology.redoxPct)}/100</span>
                      {fuelingTrainingContext.length ? (
                        <span>
                          <strong>{t("diagSessionTss")}</strong> {round(fuelingPlannedSummary.totalTss)}
                        </span>
                      ) : null}
                      {fuelingIntraChoSplitBySession?.length ? (
                        <span>
                          <strong>{t("diagIntraChoSplit")}</strong>{" "}
                          {fuelingIntraChoSplitBySession.map((x) => `${x.label}: ${x.choG}g`).join(" · ")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </Pro2Accordion>
          </section>
        </>
      )}
    </Pro2ModulePageShell>
  );
}

