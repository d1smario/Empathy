"use client";

import {
  type ExecutedWorkout,
  type PlannedWorkout,
} from "@empathy/domain-training";
import {
  Activity,
  Bike,
  CalendarRange,
  Clock,
  Flame,
  Heart,
  Sparkles,
  Timer,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoachWorkoutLibraryPanel } from "@/components/training/CoachWorkoutLibraryPanel";
import { BuilderCalendarSaveConfirm } from "@/components/training/BuilderCalendarSaveConfirm";
import { BuilderGymManualComposer } from "@/components/training/BuilderGymManualComposer";
import { BuilderLifestyleManualComposer } from "@/components/training/BuilderLifestyleManualComposer";
import { BuilderManualComposer } from "@/components/training/BuilderManualComposer";
import { BuilderTechnicalManualComposer } from "@/components/training/BuilderTechnicalManualComposer";
import { TrainingPlannedWindowContextStrip } from "@/components/training/TrainingPlannedWindowContextStrip";
import { TrainingSubnav } from "@/components/training/TrainingSubnav";
import { ResearchTraceScientificPanel } from "@/components/training/ResearchTraceScientificPanel";
import { ReplicateStatusStrip } from "@/components/training/ReplicateStatusStrip";
import { SessionBlockIntensityChart } from "@/components/training/SessionBlockIntensityChart";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2Accordion, Pro2Button } from "@/components/ui/empathy";
import {
  buildPro2BuilderSessionContract,
  defaultManualPlanBlock,
  manualPlanBlocksToChartSegments,
  manualPlanBlocksToGeneratedSession,
  type ManualPlanBlock,
} from "@/lib/training/builder/manual-plan-block";
import {
  buildPro2GymSchedaSessionContract,
  gymManualRowsToChartSegments,
  gymManualRowsToGeneratedSession,
  type Pro2GymManualRow,
} from "@/lib/training/builder/pro2-gym-manual-plan";
import {
  buildPro2LifestyleSchedaSessionContract,
  lifestyleManualRowsToChartSegments,
  lifestyleManualRowsToGeneratedSession,
  type Pro2LifestyleManualRow,
} from "@/lib/training/builder/pro2-lifestyle-manual-plan";
import {
  buildPro2TechnicalSchedaSessionContract,
  technicalManualRowsToChartSegments,
  technicalManualRowsToGeneratedSession,
  type Pro2TechnicalManualRow,
} from "@/lib/training/builder/pro2-technical-manual-plan";
import { buildPro2GymManualRowsFromEngine } from "@/lib/training/builder/build-pro2-gym-rows-from-engine";
import { PRO2_GYM_EXECUTION_STYLES } from "@/lib/training/builder/gym-execution-styles";
import { pro2PaletteSportToBlock1SportTag } from "@/lib/training/domain-blocks/block1-strength-functional";
import { fetchUnifiedBuilderExercises } from "@/modules/training/services/training-builder-catalog-api";
import { macroIdForSport, SPORT_MACRO_SECTORS, type SportMacroId } from "@/lib/training/builder/sport-macro-palette";
import { trainingDomainForPaletteSport } from "@/lib/training/sport-domain-map";
import { estimateTssFromSegments } from "@/lib/training/builder/tss-estimate";
import { serializePro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { hydrateBuilderStateFromLibraryContract } from "@/lib/training/library/hydrate-builder-from-library-contract";
import { buildPro2ContractFromEngineGeneration } from "@/lib/training/builder/engine-session-contract-for-calendar";
import { GymExerciseMediaThumb } from "@/components/training/GymExerciseMediaThumb";
import {
  TECHNICAL_ATHLETIC_QUALITY_OPTIONS,
  type AdaptationTarget,
  type GymContractionEmphasis,
  type GymEquipmentChannel,
  type GymGenerationProfile,
  type TechnicalAthleticQualityId,
  type TechnicalGameContext,
  type TechnicalWorkPhase,
} from "@/lib/training/engine";
import { sessionBlocksToChartSegments } from "@/lib/training/engine/block-chart-segments";
import { generateBuilderSession } from "@/modules/training/services/training-engine-api";
import { invalidatePlannedWindowCacheForAthlete } from "@/lib/training/planned-window-client-cache";
import {
  deletePlannedWorkout,
  insertPlannedWorkoutFromEngineSession,
  verifyPlannedWorkoutReadable,
} from "@/modules/training/services/training-planned-api";
import {
  fetchBuilderDayAdaptation,
  type BuilderDayAdaptationResponse,
} from "@/modules/training/services/training-builder-day-adaptation-api";
import { pushBuilderSessionToWahoo } from "@/modules/training/services/wahoo-push-api";
import { sessionSupportsWahooStructuredPlan } from "@/lib/integrations/wahoo-plan-from-generated-session";
import type { TrainingPlannedWindowOkViewModel, TrainingTwinContextStripViewModel } from "@/api/training/contracts";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import type { ReadSpineCoverageSummary } from "@/lib/platform/read-spine-coverage";
import { fetchNutritionViewModel } from "@/modules/nutrition/services/nutrition-api";
import { fetchProfileViewModel } from "@/modules/profile/services/profile-api";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import {
  initialManualPlanBlocks,
  localCalendarDateString,
  normalizeCalendarTargetDay,
  builderPlannedWindowRange,
  WindowErr,
  sumPlannedTss,
  sumExecutedTss,
  sumMinutesPlanned,
  sumMinutesExecuted,
  ACCENT_KPI,
  ADAPTATION_OPTIONS,
  ADAPTATION_BY_MACRO,
  defaultAdaptationForMacro,
  defaultSessionMinutesForMacro,
  EngineQuickPreset,
  ENGINE_QUICK_GYM,
  GYM_EQUIPMENT_CHIPS,
  GYM_CONTRACTION_CHIPS,
  ENGINE_QUICK_TECHNICAL,
  ENGINE_QUICK_LIFESTYLE,
  EngineGenerateOverrides,
  BuilderWindowCacheEntry,
} from "@/lib/training/training-builder-rich-kit";
import { BuilderViryaEntryBanner } from "@/modules/training/views/sections/BuilderViryaEntryBanner";
import { BuilderDayAdaptationPanel } from "@/modules/training/views/sections/BuilderDayAdaptationPanel";
import { BuilderSportMacroSectorPicker } from "@/modules/training/views/sections/BuilderSportMacroSectorPicker";
import { BuilderUpcomingPlannedSection } from "@/modules/training/views/sections/BuilderUpcomingPlannedSection";

function KpiCard({
  label,
  value,
  hint,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: keyof typeof ACCENT_KPI;
  icon: typeof Activity;
}) {
  const a = ACCENT_KPI[accent];
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 backdrop-blur-sm ${a.border} ${a.bg} ${a.ring} ${a.glow}`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-95 ${a.bar}`}
        aria-hidden
      />
      <div className="relative pt-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{label}</p>
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.iconWrap}`}
            aria-hidden
          >
            <Icon className={`h-5 w-5 ${a.icon}`} strokeWidth={2.35} />
          </div>
        </div>
        <p className={`mt-2 font-mono text-2xl font-bold tabular-nums tracking-tight ${a.value}`}>{value}</p>
        {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
      </div>
    </div>
  );
}

let builderWindowCacheKey: string | null = null;
let builderWindowCache: BuilderWindowCacheEntry | null = null;

/**
 * Builder = unico motore sessione; Vyria annuale userà solo questo endpoint per materializzare.
 */
export default function TrainingBuilderRichPageView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { athleteId, role, adminScoped, loading: ctxLoading } = useActiveAthlete();
  /** Contenuti tecnici (diagnostica, sorgenti motore) visibili solo a coach/admin. */
  const showTech = role === "coach" || adminScoped;
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [planned, setPlanned] = useState<PlannedWorkout[]>([]);
  const [executed, setExecuted] = useState<ExecutedWorkout[]>([]);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [calendarRefresh, setCalendarRefresh] = useState(0);
  const [readSpineCoverage, setReadSpineCoverage] = useState<ReadSpineCoverageSummary | null>(null);
  const [twinContextStrip, setTwinContextStrip] = useState<TrainingTwinContextStripViewModel | null>(null);
  const [plannedProvenanceSummary, setPlannedProvenanceSummary] = useState<Partial<Record<string, number>> | null>(null);
  /** Unica data calendario (manuale + generato): evita salvataggi su giorni diversi tra sezioni del builder. */
  const [plannedDate, setPlannedDate] = useState(() => localCalendarDateString());
  const [dismissViryaEntryBanner, setDismissViryaEntryBanner] = useState(false);

  /** Calendario → builder: `?date=YYYY-MM-DD` + opz. `replace_planned_id` per sostituire la riga pianificata. */
  const dateFromQuery = searchParams.get("date");
  const replacePlannedIdFromQuery =
    searchParams.get("replace_planned_id")?.trim() || searchParams.get("replacePlannedId")?.trim() || null;
  const viryaEntry = searchParams.get("src") === "virya";
  const [dayAdaptation, setDayAdaptation] = useState<BuilderDayAdaptationResponse | null>(null);
  const [dayAdaptationBusy, setDayAdaptationBusy] = useState(false);
  const [dayAdaptationErr, setDayAdaptationErr] = useState<string | null>(null);
  const [adaptedTssHint, setAdaptedTssHint] = useState<number | null>(null);

  useEffect(() => {
    if (!dateFromQuery || !/^\d{4}-\d{2}-\d{2}$/.test(dateFromQuery)) return;
    setPlannedDate(dateFromQuery);
  }, [dateFromQuery]);

  useEffect(() => {
    if (!athleteId || ctxLoading) return;
    let cancelled = false;
    (async () => {
      setDayAdaptationBusy(true);
      setDayAdaptationErr(null);
      const res = await fetchBuilderDayAdaptation({
        athleteId,
        date: plannedDate,
        replacePlannedId: replacePlannedIdFromQuery,
      });
      if (cancelled) return;
      setDayAdaptationBusy(false);
      if (!res.ok) {
        setDayAdaptation(null);
        setDayAdaptationErr(res.error);
        return;
      }
      setDayAdaptation(res);
      if (res.targetPlanned) {
        setSessionMinutes(res.targetPlanned.adaptedDurationMinutes);
        setManualSessionDurationMinutes(res.targetPlanned.adaptedDurationMinutes);
        setAdaptedTssHint(res.targetPlanned.adaptedTssTarget > 0 ? res.targetPlanned.adaptedTssTarget : null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId, ctxLoading, plannedDate, replacePlannedIdFromQuery, calendarRefresh]);

  useEffect(() => {
    if (ctxLoading) return;
    if (!athleteId) {
      setPlanned([]);
      setExecuted([]);
      setRange(null);
      setReadSpineCoverage(null);
      setTwinContextStrip(null);
      setPlannedProvenanceSummary(null);
      setErr("Seleziona un atleta attivo (coach) o completa il profilo.");
      setLoading(false);
      return;
    }
    let c = false;
    (async () => {
      const { from, to } = builderPlannedWindowRange(plannedDate);
      const cacheKey = `${athleteId}|${from}|${to}`;
      const cached = builderWindowCacheKey === cacheKey ? builderWindowCache : null;
      if (cached) {
        // Cache cross-mount: mostra subito i dati (niente spinner); refresh in background sotto.
        setPlanned(cached.planned);
        setExecuted(cached.executed);
        setRange(cached.range);
        setReadSpineCoverage(cached.readSpineCoverage);
        setTwinContextStrip(cached.twinContextStrip);
        setPlannedProvenanceSummary(cached.plannedProvenanceSummary);
        setErr(null);
        setLoading(false);
      } else {
        setLoading(true);
        setErr(null);
      }
      try {
        const q = new URLSearchParams({
          athleteId,
          from,
          to,
          includeAthleteContext: "0",
          includePlannedNotes: "0",
          includeTraceSummary: "0",
        });
        const res = await fetch(`/api/training/planned-window?${q}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers: await buildSupabaseAuthHeaders(),
        });
        const json = (await res.json()) as TrainingPlannedWindowOkViewModel | WindowErr;
        if (c) return;
        if (!res.ok || !json.ok) {
          // Refresh in background fallito: tieni i dati già mostrati dalla cache, niente flash di errore.
          if (cached) return;
          setPlanned([]);
          setExecuted([]);
          setRange(null);
          setReadSpineCoverage(null);
          setTwinContextStrip(null);
          setPlannedProvenanceSummary(null);
          setErr(("error" in json && json.error) || "Lettura calendario non riuscita.");
          return;
        }
        const entry: BuilderWindowCacheEntry = {
          planned: json.planned,
          executed: json.executed ?? [],
          range: { from: json.from, to: json.to },
          readSpineCoverage: json.readSpineCoverage ?? null,
          twinContextStrip: json.twinContextStrip ?? null,
          plannedProvenanceSummary: json.plannedProvenanceSummary ?? null,
        };
        setPlanned(entry.planned);
        setExecuted(entry.executed);
        setRange(entry.range);
        setReadSpineCoverage(entry.readSpineCoverage);
        setTwinContextStrip(entry.twinContextStrip);
        setPlannedProvenanceSummary(entry.plannedProvenanceSummary);
        setErr(null);
        builderWindowCache = entry;
        builderWindowCacheKey = cacheKey;
      } catch {
        if (!c && !cached) {
          setErr("Errore di rete.");
          setReadSpineCoverage(null);
          setTwinContextStrip(null);
          setPlannedProvenanceSummary(null);
        }
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [athleteId, ctxLoading, calendarRefresh, plannedDate]);

  const stats = useMemo(() => {
    const pTss = sumPlannedTss(planned);
    const eTss = sumExecutedTss(executed);
    const pMin = sumMinutesPlanned(planned);
    const eMin = sumMinutesExecuted(executed);
    return {
      pTss,
      eTss,
      pMin,
      eMin,
      sessionsPlanned: planned.length,
      sessionsExecuted: executed.length,
    };
  }, [planned, executed]);

  const [adaptation, setAdaptation] = useState<AdaptationTarget>("mitochondrial_density");
  const [phase, setPhase] = useState<"base" | "build" | "peak" | "taper">("base");
  const [sessionMinutes, setSessionMinutes] = useState(60);
  const [sport, setSport] = useState("cycling");
  const activeMacroId = useMemo(() => macroIdForSport(sport), [sport]);
  const currentSportLabel = useMemo(() => {
    const sector = SPORT_MACRO_SECTORS.find((x) => x.id === activeMacroId);
    const chip = sector?.sports.find((c) => c.sport.trim().toLowerCase() === sport.trim().toLowerCase());
    return chip?.label ?? sport;
  }, [activeMacroId, sport]);

  useEffect(() => {
    if (activeMacroId !== "aerobic") {
      setLengthMode("time");
    }
    setSessionMinutes(defaultSessionMinutesForMacro(activeMacroId));
    const allowed = ADAPTATION_BY_MACRO[activeMacroId];
    setAdaptation((prev) => (allowed.includes(prev) ? prev : defaultAdaptationForMacro(activeMacroId)));
  }, [activeMacroId]);
  const [genBusy, setGenBusy] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<Awaited<ReturnType<typeof generateBuilderSession>> | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveOkId, setSaveOkId] = useState<string | null>(null);
  const [wahooPushBusy, setWahooPushBusy] = useState(false);
  const [wahooPushErr, setWahooPushErr] = useState<string | null>(null);
  const [wahooPushOk, setWahooPushOk] = useState<string | null>(null);

  const [intensityUnit, setIntensityUnit] = useState<"watt" | "hr">("watt");
  const [ftpW, setFtpW] = useState(250);
  const [hrMax, setHrMax] = useState(185);
  const [lengthMode, setLengthMode] = useState<"time" | "distance">("time");
  const [speedRefKmh, setSpeedRefKmh] = useState(32);
  const [manualSessionName, setManualSessionName] = useState("Seduta coach Pro 2");
  const [manualPlanBlocks, setManualPlanBlocks] = useState<ManualPlanBlock[]>(initialManualPlanBlocks);
  const [manualSaveBusy, setManualSaveBusy] = useState(false);
  const [manualSaveErr, setManualSaveErr] = useState<string | null>(null);
  const [manualSaveOkId, setManualSaveOkId] = useState<string | null>(null);
  const [manualActiveIndex, setManualActiveIndex] = useState(0);
  /** Durata pianificata sul calendario (coach): separata dalla somma dei segmenti del grafico. */
  const [manualSessionDurationMinutes, setManualSessionDurationMinutes] = useState(60);
  /** Scheda palestra (V1 model): solo macro B; mai blocchi watt/FC del composer aerobico. */
  const [gymManualRows, setGymManualRows] = useState<Pro2GymManualRow[]>([]);
  /** Scheda lifestyle (macro D): playbook mind-body + righe prescrittive come Gym. */
  const [lifestyleManualRows, setLifestyleManualRows] = useState<Pro2LifestyleManualRow[]>([]);
  const [physioHint, setPhysioHint] = useState<string | null>(null);
  const [gymEquipChannels, setGymEquipChannels] = useState<GymEquipmentChannel[]>([]);
  const [gymContraction, setGymContraction] = useState<GymContractionEmphasis>("standard");
  /** Stile esecuzione usato dal generatore scheda (parità V1 `executionStyle` nella materializzazione). */
  const [gymAutoExecutionStyle, setGymAutoExecutionStyle] = useState("");

  /** Macro C · moduli tecnico-tattici (V1 Virya: obiettivi + metodologia → EVidenza nel motore). */
  const [techWorkPhase, setTechWorkPhase] = useState<TechnicalWorkPhase>("technique");
  const [techGameContext, setTechGameContext] = useState<TechnicalGameContext>("build_up");
  const [techQualities, setTechQualities] = useState<TechnicalAthleticQualityId[]>([]);
  const [technicalManualRows, setTechnicalManualRows] = useState<Pro2TechnicalManualRow[]>([]);

  const planOpts = useMemo(
    () => ({
      unit: intensityUnit,
      ftpW: Math.max(1, ftpW),
      hrMax: Math.max(1, hrMax),
      lengthMode,
      speedRefKmh: Math.max(1, speedRefKmh),
    }),
    [intensityUnit, ftpW, hrMax, lengthMode, speedRefKmh],
  );

  const adaptationAllowed = useMemo(() => ADAPTATION_BY_MACRO[activeMacroId], [activeMacroId]);

  const gymEngineProfile = useMemo((): GymGenerationProfile | undefined => {
    if (activeMacroId !== "strength") return undefined;
    const equipmentChannels = gymEquipChannels.length ? gymEquipChannels : undefined;
    const contraction = gymContraction !== "standard" ? gymContraction : undefined;
    if (!equipmentChannels && !contraction) return undefined;
    return { equipmentChannels, contraction };
  }, [activeMacroId, gymEquipChannels, gymContraction]);

  useEffect(() => {
    if (activeMacroId !== "strength") {
      setGymEquipChannels([]);
      setGymContraction("standard");
      setGymManualRows([]);
      setGymAutoExecutionStyle("");
    }
  }, [activeMacroId]);

  useEffect(() => {
    if (activeMacroId !== "lifestyle") {
      setLifestyleManualRows([]);
    }
  }, [activeMacroId]);

  const manualSession = useMemo(() => {
    if (activeMacroId === "strength") {
      return gymManualRowsToGeneratedSession({ sport, rows: gymManualRows, adaptationTarget: adaptation });
    }
    if (activeMacroId === "lifestyle") {
      return lifestyleManualRowsToGeneratedSession({ sport, rows: lifestyleManualRows, adaptationTarget: adaptation });
    }
    if (activeMacroId === "technical") {
      return technicalManualRowsToGeneratedSession({ sport, rows: technicalManualRows, adaptationTarget: adaptation });
    }
    return manualPlanBlocksToGeneratedSession({
      sport,
      blocks: manualPlanBlocks,
      opts: planOpts,
      family: activeMacroId,
      adaptationTarget: adaptation,
    });
  }, [sport, gymManualRows, lifestyleManualRows, technicalManualRows, activeMacroId, adaptation, manualPlanBlocks, planOpts]);
  const manualChartSegments = useMemo(() => {
    if (activeMacroId === "strength") {
      return gymManualRowsToChartSegments(gymManualRows);
    }
    if (activeMacroId === "lifestyle") {
      return lifestyleManualRowsToChartSegments(lifestyleManualRows);
    }
    if (activeMacroId === "technical") {
      return technicalManualRowsToChartSegments(technicalManualRows);
    }
    return manualPlanBlocksToChartSegments(manualPlanBlocks, planOpts);
  }, [activeMacroId, gymManualRows, lifestyleManualRows, technicalManualRows, manualPlanBlocks, planOpts]);

  const manualTssPreview = useMemo(() => estimateTssFromSegments(manualChartSegments), [manualChartSegments]);

  const genChartSegments = useMemo(() => {
    if (!genResult || !("ok" in genResult) || !genResult.ok) return [];
    return sessionBlocksToChartSegments(genResult.session.blocks);
  }, [genResult]);

  const genTssPreview = useMemo(() => estimateTssFromSegments(genChartSegments), [genChartSegments]);

  const wahooPushSessionCandidate = useMemo(() => {
    if (!genResult || !("ok" in genResult) || !genResult.ok) return null;
    if (activeMacroId === "strength") {
      return gymManualRowsToGeneratedSession({
        sport,
        rows: gymManualRows,
        adaptationTarget: adaptation,
      });
    }
    return genResult.session;
  }, [genResult, activeMacroId, sport, gymManualRows, adaptation]);

  const wahooPushEligible = Boolean(
    athleteId &&
      wahooPushSessionCandidate &&
      sessionSupportsWahooStructuredPlan(wahooPushSessionCandidate) &&
      hrMax > 0 &&
      (intensityUnit === "hr" || ftpW > 0),
  );

  useEffect(() => {
    setWahooPushErr(null);
    setWahooPushOk(null);
  }, [genResult]);

  /** Cambio giorno / atleta / replace: non mostrare la seduta generata per un altro giorno. */
  const builderDayScopeRef = useRef<string | null>(null);
  useEffect(() => {
    const scope = `${athleteId ?? ""}|${plannedDate}|${replacePlannedIdFromQuery ?? ""}`;
    if (builderDayScopeRef.current === scope) return;
    builderDayScopeRef.current = scope;
    setGenResult(null);
    setGenErr(null);
    setGenBusy(false);
    setSaveOkId(null);
    setSaveErr(null);
    setSaveBusy(false);
    setWahooPushErr(null);
    setWahooPushOk(null);
    setManualSaveOkId(null);
    setManualSaveErr(null);
  }, [athleteId, plannedDate, replacePlannedIdFromQuery]);

  useEffect(() => {
    setManualActiveIndex((i) => Math.min(i, Math.max(0, manualPlanBlocks.length - 1)));
  }, [manualPlanBlocks.length]);

  const loadLibraryContractInBuilder = useCallback((contract: Pro2BuilderSessionContract) => {
    const state = hydrateBuilderStateFromLibraryContract(contract);
    setSport(state.sport);
    setManualSessionName(state.manualSessionName);
    setManualSessionDurationMinutes(state.manualSessionDurationMinutes);
    setIntensityUnit(state.intensityUnit);
    setFtpW(state.ftpW);
    setHrMax(state.hrMax);
    setLengthMode(state.lengthMode);
    setSpeedRefKmh(state.speedRefKmh);
    setManualPlanBlocks(
      state.manualPlanBlocks.length > 0 ? state.manualPlanBlocks : [defaultManualPlanBlock("steady", state.manualSessionName)],
    );
    setGymManualRows(state.gymManualRows);
    setTechnicalManualRows(state.technicalManualRows);
    setLifestyleManualRows(state.lifestyleManualRows);
    setManualActiveIndex(0);
    requestAnimationFrame(() => {
      document.getElementById("builder-manual-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    if (!athleteId) {
      setPhysioHint(null);
      return;
    }
    if (macroIdForSport(sport) === "strength") {
      setPhysioHint(null);
      return;
    }
    let c = false;
    (async () => {
      try {
        const vm = await fetchProfileViewModel(athleteId);
        if (c || vm.error) {
          if (!c) setPhysioHint(null);
          return;
        }
        const phys =
          vm.physiologyState?.physiologicalProfile ?? vm.athleteMemory?.physiology?.physiologicalProfile;
        if (!phys) {
          if (!c) setPhysioHint(null);
          return;
        }
        const p = phys;
        const hint: string[] = [];
        if (typeof p.ftpWatts === "number" && p.ftpWatts > 0) {
          setFtpW(Math.round(p.ftpWatts));
          hint.push(`FTP ${Math.round(p.ftpWatts)} W`);
        }
        if (typeof p.lt2HeartRate === "number" && p.lt2HeartRate > 0) {
          const hm = Math.min(220, Math.max(155, Math.round(p.lt2HeartRate / 0.88)));
          setHrMax(hm);
          hint.push(`FC max ~${hm} bpm`);
        } else if (typeof p.lt1HeartRate === "number" && p.lt1HeartRate > 0) {
          const hm = Math.min(220, Math.max(155, Math.round(p.lt1HeartRate / 0.72)));
          setHrMax(hm);
          hint.push(`FC max ~${hm} bpm`);
        }
        setPhysioHint(hint.length ? `Da fisiologia: ${hint.join(" · ")}` : null);
      } catch {
        if (!c) setPhysioHint(null);
      }
    })();
    return () => {
      c = true;
    };
  }, [athleteId, sport]);

  const runGenerate = useCallback(
    async (overrides?: EngineGenerateOverrides) => {
      if (!athleteId) return;
      const adaptationUse = overrides?.adaptation ?? adaptation;
      const sessionMinutesUse = overrides?.sessionMinutes ?? sessionMinutes;
      const phaseUse = overrides?.phase ?? phase;
      if (overrides?.adaptation != null) setAdaptation(overrides.adaptation);
      if (overrides?.sessionMinutes != null) setSessionMinutes(overrides.sessionMinutes);
      if (overrides?.phase != null) setPhase(overrides.phase);
      setGenBusy(true);
      setGenErr(null);
      setGenResult(null);
      const paletteDomain = trainingDomainForPaletteSport(sport);
      const out = await generateBuilderSession({
        athleteId,
        /** Adattamento giornaliero da twin/recovery; il piano VIRYA annuale resta invariato. */
        applyOperationalScaling: true,
        request: {
          sport,
          ...(paletteDomain ? { domain: paletteDomain } : {}),
          goalLabel: adaptationUse,
          adaptationTarget: adaptationUse,
          sessionMinutes: sessionMinutesUse,
          ...(adaptedTssHint != null && adaptedTssHint > 0 ? { tssTargetHint: adaptedTssHint } : {}),
          phase: phaseUse,
          ...(activeMacroId === "strength" && gymEngineProfile ? { gymProfile: gymEngineProfile } : {}),
          ...(activeMacroId === "technical"
            ? {
                technicalModuleFocus: {
                  workPhase: techWorkPhase,
                  gameContext: techGameContext,
                  athleticQualities: techQualities,
                },
              }
            : {}),
        },
      });
      if ("error" in out) {
        setGenBusy(false);
        setGenErr(out.error);
        return;
      }

      if (activeMacroId === "strength") {
        const sportTag = pro2PaletteSportToBlock1SportTag(sport);
        const { rows: catalogRows, error: catErr } = await fetchUnifiedBuilderExercises({
          sportTag,
          limit: 400,
        });
        if (catErr || catalogRows.length === 0) {
          setGenBusy(false);
          setGenErr(catErr ?? "Catalogo EMPATHY non disponibile per materializzare la scheda.");
          setGenResult(null);
          return;
        }
        const built = buildPro2GymManualRowsFromEngine({
          blockExercises: out.blockExercises,
          catalogRows,
          sportTag,
          adaptation: adaptationUse,
          executionStyle: gymAutoExecutionStyle,
        });
        if (built.length === 0) {
          setGenBusy(false);
          setGenErr(
            "Il motore ha proposto una struttura ma nessun esercizio del catalogo risulta compatibile. Prova altro adattamento o disciplina.",
          );
          setGenResult(null);
          return;
        }
        setGymManualRows(built);
        const scaledMinutes =
          "operationalScaling" in out && out.operationalScaling?.sessionMinutesEffective != null
            ? out.operationalScaling.sessionMinutesEffective
            : sessionMinutesUse;
        setManualSessionDurationMinutes(scaledMinutes);
        const goalLabel = String((out.session as { goalLabel?: string }).goalLabel ?? "").trim();
        if (goalLabel) setManualSessionName(goalLabel);
      }

      setGenResult(out);
      setSaveErr(null);
      setSaveOkId(null);
      setGenBusy(false);
    },
    [
      athleteId,
      adaptation,
      phase,
      sessionMinutes,
      sport,
      activeMacroId,
      gymEngineProfile,
      gymAutoExecutionStyle,
      techWorkPhase,
      techGameContext,
      techQualities,
      adaptedTssHint,
    ],
  );

  const finalizeCalendarSave = useCallback(
    async (input: {
      date: string;
      plannedWorkoutId: string | null;
      setOkId: (id: string | null) => void;
      setErrMsg: (msg: string | null) => void;
    }) => {
      if (!athleteId) return;
      const day = input.date.trim().slice(0, 10);
      invalidatePlannedWindowCacheForAthlete(athleteId);
      const verify = await verifyPlannedWorkoutReadable({
        athleteId,
        date: day,
        plannedWorkoutId: input.plannedWorkoutId,
      });
      if (!verify.ok) {
        input.setErrMsg(verify.error);
        input.setOkId(null);
        return;
      }
      input.setOkId(input.plannedWorkoutId ?? "ok");
      setCalendarRefresh((n) => n + 1);
      router.push(`/training/calendar?date=${encodeURIComponent(day)}`);
    },
    [athleteId, router],
  );

  const saveToCalendar = useCallback(async (targetDate: string) => {
    if (!athleteId || !genResult || !("ok" in genResult) || !genResult.ok) return;
    const day = normalizeCalendarTargetDay(targetDate);
    if (!day) {
      setSaveErr("Data calendario non valida.");
      return;
    }
    setSaveBusy(true);
    setSaveErr(null);
    setSaveOkId(null);

    const renderProfile = {
      intensityUnit,
      ftpW: Math.max(1, ftpW),
      hrMax: Math.max(1, hrMax),
      lengthMode,
      speedRefKmh: Math.max(1, speedRefKmh),
    };

    let session = genResult.session;
    let extraNotesLines: string[] | undefined;

    if (activeMacroId === "strength") {
      const scheda = gymManualRowsToGeneratedSession({
        sport,
        rows: gymManualRows,
        adaptationTarget: adaptation,
      });
      if (!scheda) {
        setSaveBusy(false);
        setSaveErr("Scheda vuota: rigenera o applica esercizi dal catalogo.");
        return;
      }
      session = scheda;
      const contract = buildPro2GymSchedaSessionContract({
        rows: gymManualRows,
        renderProfile,
        discipline: currentSportLabel || sport.trim() || "Gym",
        sessionName: manualSessionName.trim() || "Scheda Pro 2",
        adaptationTarget: adaptation,
        phase,
      });
      extraNotesLines = [serializePro2BuilderSessionContract(contract)];
    } else {
      const loadScale =
        "operationalScaling" in genResult &&
        genResult.operationalScaling?.applied &&
        genResult.operationalScaling.loadScale > 0
          ? genResult.operationalScaling.loadScale
          : 1;
      const builderFamily =
        activeMacroId === "aerobic" ? "aerobic" : activeMacroId === "technical" ? "technical" : "lifestyle";
      const contract = buildPro2ContractFromEngineGeneration({
        session: genResult.session,
        blockExercises: "blockExercises" in genResult ? genResult.blockExercises : undefined,
        renderProfile,
        family: builderFamily,
        discipline: currentSportLabel || sport.trim() || "Endurance",
        sessionName: manualSessionName.trim() || genResult.session.goalLabel || "Sessione Pro 2",
        adaptationTarget: adaptation,
        phase,
        plannedSessionDurationMinutes:
          dayAdaptation?.ok && dayAdaptation.targetPlanned
            ? dayAdaptation.targetPlanned.adaptedDurationMinutes
            : sessionMinutes,
        loadScale,
      });
      if (contract) {
        extraNotesLines = [serializePro2BuilderSessionContract(contract)];
      }
    }

    if (replacePlannedIdFromQuery) {
      try {
        await deletePlannedWorkout({ id: replacePlannedIdFromQuery, athleteId });
      } catch (e) {
        setSaveBusy(false);
        setSaveErr(e instanceof Error ? e.message : "Impossibile sostituire la seduta pianificata.");
        return;
      }
    }

    const res = await insertPlannedWorkoutFromEngineSession({
      athleteId,
      date: day,
      session,
      extraNotesLines,
      plannedDurationMinutesOverride:
        dayAdaptation?.ok && dayAdaptation.targetPlanned
          ? dayAdaptation.targetPlanned.adaptedDurationMinutes
          : null,
    });
    setSaveBusy(false);
    if (!res.ok) {
      setSaveErr(res.error);
      return;
    }
    await finalizeCalendarSave({
      date: day,
      plannedWorkoutId: res.plannedWorkoutId,
      setOkId: setSaveOkId,
      setErrMsg: setSaveErr,
    });
  }, [
    athleteId,
    genResult,
    plannedDate,
    replacePlannedIdFromQuery,
    dayAdaptation,
    activeMacroId,
    gymManualRows,
    sport,
    adaptation,
    currentSportLabel,
    manualSessionName,
    phase,
    intensityUnit,
    ftpW,
    hrMax,
    lengthMode,
    speedRefKmh,
    finalizeCalendarSave,
  ]);

  const pushSessionToWahooCloud = useCallback(async () => {
    if (!athleteId || !wahooPushSessionCandidate || !sessionSupportsWahooStructuredPlan(wahooPushSessionCandidate)) return;
    setWahooPushBusy(true);
    setWahooPushErr(null);
    setWahooPushOk(null);
    const r = await pushBuilderSessionToWahoo({
      athleteId,
      session: wahooPushSessionCandidate,
      plannedDate,
      planName: manualSessionName.trim() || wahooPushSessionCandidate.goalLabel?.trim(),
      intensityChannel: intensityUnit,
      workoutTypeLocation: lengthMode === "distance" ? 1 : 0,
      ftpW: Math.max(1, ftpW),
      hrMax: Math.max(1, hrMax),
      scheduleWorkout: true,
    });
    setWahooPushBusy(false);
    if (!r.ok) {
      setWahooPushErr([r.error, r.phase ? `fase: ${r.phase}` : null].filter(Boolean).join(" · "));
      return;
    }
    setWahooPushOk(
      r.plan_id != null ? `Piano Wahoo #${r.plan_id} e workout pianificato creati.` : "Piano inviato a Wahoo Cloud.",
    );
  }, [
    athleteId,
    wahooPushSessionCandidate,
    plannedDate,
    manualSessionName,
    intensityUnit,
    lengthMode,
    ftpW,
    hrMax,
  ]);

  const saveManualToCalendar = useCallback(async (targetDate: string) => {
    if (!athleteId || !manualSession) return;
    const day = normalizeCalendarTargetDay(targetDate);
    if (!day) {
      setManualSaveErr("Data calendario non valida.");
      return;
    }
    setManualSaveBusy(true);
    setManualSaveErr(null);
    setManualSaveOkId(null);
    const renderProfile = {
      intensityUnit,
      ftpW: Math.max(1, ftpW),
      hrMax: Math.max(1, hrMax),
      lengthMode,
      speedRefKmh: Math.max(1, speedRefKmh),
    };
    const contract =
      activeMacroId === "strength"
        ? buildPro2GymSchedaSessionContract({
            rows: gymManualRows,
            renderProfile,
            discipline: currentSportLabel || sport.trim() || "Gym",
            sessionName: manualSessionName.trim() || "Scheda Pro 2",
            adaptationTarget: adaptation,
            phase,
          })
        : activeMacroId === "lifestyle"
          ? buildPro2LifestyleSchedaSessionContract({
              rows: lifestyleManualRows,
              renderProfile,
              discipline: currentSportLabel || sport.trim() || "Lifestyle",
              sessionName: manualSessionName.trim() || "Scheda lifestyle Pro 2",
              adaptationTarget: adaptation,
              phase,
            })
          : activeMacroId === "technical"
            ? buildPro2TechnicalSchedaSessionContract({
                rows: technicalManualRows,
                renderProfile,
                discipline: currentSportLabel || sport.trim() || "Sport tecnico",
                sessionName: manualSessionName.trim() || "Scheda tecnica Pro 2",
                adaptationTarget: adaptation,
                phase,
                technicalModuleFocus: {
                  workPhase: techWorkPhase,
                  gameContext: techGameContext,
                  athleticQualities: techQualities,
                },
              })
            : buildPro2BuilderSessionContract({
                blocks: manualPlanBlocks,
                renderProfile,
                discipline: sport.trim() || "Endurance",
                sessionName: manualSessionName.trim() || "Sessione Pro 2",
                adaptationTarget: adaptation,
                phase,
                family: activeMacroId,
              });
    const jsonLine = serializePro2BuilderSessionContract(contract);
    const res = await insertPlannedWorkoutFromEngineSession({
      athleteId,
      date: day,
      session: manualSession,
      extraNotesLines: [jsonLine],
    });
    setManualSaveBusy(false);
    if (!res.ok) {
      setManualSaveErr(res.error);
      return;
    }
    await finalizeCalendarSave({
      date: day,
      plannedWorkoutId: res.plannedWorkoutId,
      setOkId: setManualSaveOkId,
      setErrMsg: setManualSaveErr,
    });
  }, [
    athleteId,
    manualSession,
    manualPlanBlocks,
    gymManualRows,
    lifestyleManualRows,
    technicalManualRows,
    techWorkPhase,
    techGameContext,
    techQualities,
    currentSportLabel,
    intensityUnit,
    ftpW,
    hrMax,
    lengthMode,
    speedRefKmh,
    sport,
    manualSessionName,
    adaptation,
    phase,
    activeMacroId,
    finalizeCalendarSave,
  ]);

  const libraryContractToSave = useMemo(() => {
    const renderProfile = {
      intensityUnit,
      ftpW: Math.max(1, ftpW),
      hrMax: Math.max(1, hrMax),
      lengthMode,
      speedRefKmh: Math.max(1, speedRefKmh),
    };
    if (genResult && "ok" in genResult && genResult.ok) {
      if (activeMacroId === "strength") {
        return buildPro2GymSchedaSessionContract({
          rows: gymManualRows,
          renderProfile,
          discipline: currentSportLabel || sport.trim() || "Gym",
          sessionName: manualSessionName.trim() || "Scheda Pro 2",
          adaptationTarget: adaptation,
          phase,
        });
      }
      const loadScale =
        "operationalScaling" in genResult &&
        genResult.operationalScaling?.applied &&
        genResult.operationalScaling.loadScale > 0
          ? genResult.operationalScaling.loadScale
          : 1;
      const builderFamily =
        activeMacroId === "aerobic" ? "aerobic" : activeMacroId === "technical" ? "technical" : "lifestyle";
      return (
        buildPro2ContractFromEngineGeneration({
          session: genResult.session,
          blockExercises: "blockExercises" in genResult ? genResult.blockExercises : undefined,
          renderProfile,
          family: builderFamily,
          discipline: currentSportLabel || sport.trim() || "Endurance",
          sessionName: manualSessionName.trim() || genResult.session.goalLabel || "Sessione Pro 2",
          adaptationTarget: adaptation,
          phase,
          plannedSessionDurationMinutes:
            dayAdaptation?.ok && dayAdaptation.targetPlanned
              ? dayAdaptation.targetPlanned.adaptedDurationMinutes
              : sessionMinutes,
          loadScale,
        }) ?? null
      );
    }
    if (!manualSession) return null;
    if (activeMacroId === "strength") {
      return buildPro2GymSchedaSessionContract({
        rows: gymManualRows,
        renderProfile,
        discipline: currentSportLabel || sport.trim() || "Gym",
        sessionName: manualSessionName.trim() || "Scheda Pro 2",
        adaptationTarget: adaptation,
        phase,
      });
    }
    if (activeMacroId === "lifestyle") {
      return buildPro2LifestyleSchedaSessionContract({
        rows: lifestyleManualRows,
        renderProfile,
        discipline: currentSportLabel || sport.trim() || "Lifestyle",
        sessionName: manualSessionName.trim() || "Scheda lifestyle Pro 2",
        adaptationTarget: adaptation,
        phase,
      });
    }
    if (activeMacroId === "technical") {
      return buildPro2TechnicalSchedaSessionContract({
        rows: technicalManualRows,
        renderProfile,
        discipline: currentSportLabel || sport.trim() || "Sport tecnico",
        sessionName: manualSessionName.trim() || "Scheda tecnica Pro 2",
        adaptationTarget: adaptation,
        phase,
        technicalModuleFocus: {
          workPhase: techWorkPhase,
          gameContext: techGameContext,
          athleticQualities: techQualities,
        },
      });
    }
    return buildPro2BuilderSessionContract({
      blocks: manualPlanBlocks,
      renderProfile,
      discipline: sport.trim() || "Endurance",
      sessionName: manualSessionName.trim() || "Sessione Pro 2",
      adaptationTarget: adaptation,
      phase,
      family: activeMacroId,
    });
  }, [
    genResult,
    manualSession,
    activeMacroId,
    gymManualRows,
    lifestyleManualRows,
    technicalManualRows,
    techWorkPhase,
    techGameContext,
    techQualities,
    manualPlanBlocks,
    intensityUnit,
    ftpW,
    hrMax,
    lengthMode,
    speedRefKmh,
    currentSportLabel,
    sport,
    manualSessionName,
    adaptation,
    phase,
    dayAdaptation,
    sessionMinutes,
  ]);

  const upcoming = useMemo(() => {
    const today = localCalendarDateString();
    return [...planned]
      .filter((w) => w.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);
  }, [planned]);

  const [nutritionLine, setNutritionLine] = useState<string | null>(null);
  const [nutritionBusy, setNutritionBusy] = useState(false);
  const [nutritionErr, setNutritionErr] = useState<string | null>(null);

  const refreshNutritionContext = useCallback(async () => {
    if (!athleteId) return;
    setNutritionBusy(true);
    setNutritionErr(null);
    try {
      const vm = await fetchNutritionViewModel({ athleteId, date: plannedDate });
      if (vm.error) {
        setNutritionErr(vm.error);
        setNutritionLine(null);
        return;
      }
      const p = vm.plan;
      const src =
        vm.planSource === "calendar_training_solver"
          ? "da calendario"
          : vm.planSource === "nutrition_plans"
            ? "da piano nutrizione"
            : "nessun allenamento in calendario per questo giorno";
      setNutritionLine(
        `${p.calories} kcal · CHO ${p.carbsG}g · PRO ${p.proteinsG}g · FAT ${p.fatsG}g · H₂O ${p.hydrationMl}ml · ${src}` +
          (typeof vm.plannedSessionsCount === "number" ? ` · sedute pianific. ${vm.plannedSessionsCount}` : ""),
      );
    } catch (e) {
      setNutritionErr(e instanceof Error ? e.message : "Errore lettura nutrizione");
      setNutritionLine(null);
    } finally {
      setNutritionBusy(false);
    }
  }, [athleteId, plannedDate]);

  useEffect(() => {
    if (!athleteId) return;
    void refreshNutritionContext();
  }, [athleteId, plannedDate, calendarRefresh, refreshNutritionContext]);

  const showData = !ctxLoading && !loading && !err;

  return (
    <Pro2ModulePageShell
      eyebrow="Allenamento"
      eyebrowClassName="text-orange-400"
      title="Crea la tua seduta"
      description="Scegli lo sport, genera la seduta, rifiniscila e salvala nel calendario in quattro passi."
    >
        <div className="scroll-mt-28">
          <TrainingSubnav />
        </div>

        <BuilderViryaEntryBanner
          viryaEntry={viryaEntry}
          dismissViryaEntryBanner={dismissViryaEntryBanner}
          setDismissViryaEntryBanner={setDismissViryaEntryBanner}
        />

        {athleteId && readSpineCoverage ? (
          <TrainingPlannedWindowContextStrip
            className="mb-4"
            label="Builder"
            readSpineCoverage={readSpineCoverage}
            twinContextStrip={twinContextStrip}
            athleteId={athleteId}
            plannedProvenanceSummary={plannedProvenanceSummary}
          />
        ) : null}

        <BuilderDayAdaptationPanel
          athleteId={athleteId}
          plannedDate={plannedDate}
          dayAdaptationBusy={dayAdaptationBusy}
          dayAdaptationErr={dayAdaptationErr}
          dayAdaptation={dayAdaptation}
          genBusy={genBusy}
          runGenerate={runGenerate}
          replacePlannedIdFromQuery={replacePlannedIdFromQuery}
        />

        <BuilderSportMacroSectorPicker
          activeMacroId={activeMacroId}
          sport={sport}
          setSport={setSport}
        />

        <section
          aria-label="Genera sessione (builder engine)"
          className={`rounded-2xl border p-4 sm:p-5 lg:p-6 ${
            activeMacroId === "strength"
              ? "border-orange-500/25 bg-gradient-to-br from-orange-950/[0.12] via-black/60 to-black/85"
              : activeMacroId === "technical"
                ? "border-orange-500/25 bg-gradient-to-br from-orange-950/[0.12] via-black/60 to-black/85"
                : activeMacroId === "lifestyle"
                  ? "border-orange-500/25 bg-gradient-to-br from-orange-950/[0.12] via-black/60 to-black/85"
                  : "border-orange-500/25 bg-gradient-to-br from-orange-950/[0.12] via-black/60 to-black/85"
          }`}
        >
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-orange-400/45 bg-orange-500/25 text-sm font-black text-orange-100">
              2
            </span>
            Genera sessione
          </h2>
          {activeMacroId === "strength" ? (
            <p className="mt-1 text-sm text-gray-400">
              Il motore propone la struttura (nomi esercizio), poi si materializza la{" "}
              <span className="text-orange-200">scheda sul catalogo EMPATHY</span> con serie, ripetute, recuperi e immagini.
              Disciplina: <span className="font-semibold text-orange-200">{currentSportLabel}</span>.
            </p>
          ) : activeMacroId === "technical" ? (
            <p className="mt-1 text-sm text-gray-400">
              Concentrati su tecnica, tattica, schemi e moduli: la parte aerobico-pura resta in A · Aerobico.
              Il builder stima un <span className="text-orange-200/95">TSS</span> da confrontare con RPE / carico interno.
              Disciplina: <span className="font-semibold text-orange-200">{currentSportLabel}</span>.
            </p>
          ) : activeMacroId === "lifestyle" ? (
            <p className="mt-1 text-sm text-gray-400">
              Preset per mobilità, recovery, qualità movimento e lavoro aerobico leggero (mind-body).
              Disciplina: <span className="font-semibold text-orange-200">{currentSportLabel}</span>.
            </p>
          ) : (
            <p className="mt-1 text-sm text-gray-400">
              Macro aerobica: input compatti. Output: blocchi + esercizi dalla libreria, calibrati su profilo
              fisiologico e digital twin dell&apos;atleta quando disponibili.
            </p>
          )}

          {activeMacroId === "strength" ? (
            <div className="mt-4 flex flex-col gap-3">
              <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">Preset generativi</p>
              <div className="flex flex-wrap gap-2">
                {ENGINE_QUICK_GYM.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!athleteId || genBusy}
                    onClick={() => void runGenerate({ adaptation: p.adaptation, sessionMinutes: p.minutes, phase: p.phase })}
                    className="min-w-[10rem] flex-1 rounded-2xl border-2 border-orange-400/35 bg-gradient-to-br from-orange-600/90 to-amber-700/90 px-4 py-3 text-left text-sm font-bold text-white shadow-[0_0_20px_rgba(251,146,60,0.2)] transition hover:brightness-110 disabled:opacity-40"
                  >
                    <Sparkles className="mb-1 h-4 w-4 text-amber-100 opacity-90" aria-hidden />
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-orange-500/20 bg-black/25 p-3">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Attrezzi · filtro libreria</p>
                <p className="mt-1 text-xs text-gray-500">
                  Pesi, corpo libero, cavi, elastici, macchinari. Nessun chip = nessun filtro stretto.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {GYM_EQUIPMENT_CHIPS.map((ch) => {
                    const on = gymEquipChannels.includes(ch.id);
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() =>
                          setGymEquipChannels((prev) =>
                            prev.includes(ch.id) ? prev.filter((x) => x !== ch.id) : [...prev, ch.id],
                          )
                        }
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                          on
                            ? "border-orange-400 bg-orange-500/30 text-white"
                            : "border-white/15 bg-black/40 text-gray-400 hover:border-white/25"
                        }`}
                      >
                        {ch.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
                  Contrazione / stile
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {GYM_CONTRACTION_CHIPS.map((ch) => {
                    const sel = gymContraction === ch.id;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setGymContraction(ch.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                          sel
                            ? "border-amber-300 bg-amber-500/25 text-amber-50"
                            : "border-white/15 bg-black/40 text-gray-400 hover:border-white/25"
                        }`}
                      >
                        {ch.label}
                      </button>
                    );
                  })}
                </div>
                <label className="mt-3 flex max-w-lg flex-col gap-1 text-[0.65rem] text-gray-400">
                  Stile esecuzione nella scheda generata
                  <select
                    className="rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                    value={gymAutoExecutionStyle}
                    onChange={(e) => setGymAutoExecutionStyle(e.target.value)}
                  >
                    <option value="">Standard · usa solo prescrizione deterministica</option>
                    {PRO2_GYM_EXECUTION_STYLES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <details className="rounded-xl border border-white/10 bg-black/30">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-gray-300 marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="underline decoration-orange-400/50 decoration-1 underline-offset-2">Durata, fase e adattamento</span>
                  <span className="ml-2 text-xs text-gray-500">(opzionale)</span>
                </summary>
                <div className="flex flex-wrap items-end gap-3 border-t border-white/10 px-4 pb-4 pt-3">
                  <div className="flex min-w-[11rem] flex-1 items-start gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 p-3 sm:min-w-[10rem]">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" aria-hidden />
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                      Adattamento
                      <select
                        className="rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                        value={adaptation}
                        onChange={(e) => setAdaptation(e.target.value as AdaptationTarget)}
                      >
                        {ADAPTATION_OPTIONS.filter((o) => adaptationAllowed.includes(o.value)).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex min-w-[8rem] items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3">
                    <CalendarRange className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                      Fase
                      <select
                        className="rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                        value={phase}
                        onChange={(e) => setPhase(e.target.value as typeof phase)}
                      >
                        <option value="base">base</option>
                        <option value="build">build</option>
                        <option value="peak">peak</option>
                        <option value="taper">taper</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex min-w-[6.5rem] flex-1 items-start gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 p-3 sm:w-[6.5rem] sm:flex-none">
                    <Clock className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" aria-hidden />
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                      Min
                      <input
                        type="number"
                        min={20}
                        max={180}
                        className="w-full rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                        value={sessionMinutes}
                        onChange={(e) => setSessionMinutes(Number(e.target.value))}
                      />
                    </label>
                  </div>
                </div>
              </details>
              <Pro2Button
                type="button"
                variant="primary"
                className="!inline-flex !w-full !items-center !justify-center !gap-2 sm:!w-auto"
                disabled={!athleteId || genBusy}
                onClick={() => void runGenerate()}
              >
                <Flame className="h-4 w-4 text-amber-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.55)]" aria-hidden />
                {genBusy ? "Generazione…" : "Genera con impostazioni attuali"}
              </Pro2Button>
            </div>
          ) : activeMacroId === "technical" ? (
            <div className="mt-4 flex flex-col gap-3">
              <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">Preset generativi</p>
              <div className="flex flex-wrap gap-2">
                {ENGINE_QUICK_TECHNICAL.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!athleteId || genBusy}
                    onClick={() => void runGenerate({ adaptation: p.adaptation, sessionMinutes: p.minutes, phase: p.phase })}
                    className="min-w-[10rem] flex-1 rounded-2xl border-2 border-orange-400/35 bg-gradient-to-br from-orange-600/90 to-amber-700/90 px-4 py-3 text-left text-sm font-bold text-white shadow-[0_0_20px_rgba(251,146,60,0.2)] transition hover:brightness-110 disabled:opacity-40"
                  >
                    <Sparkles className="mb-1 h-4 w-4 text-amber-100 opacity-90" aria-hidden />
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-orange-500/25 bg-orange-500/[0.07] p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
                  Struttura modulare · Macro C
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Allinea fase di lavoro, contesto di gioco e qualità atletica: il motore arricchisce cue e traccia (come obiettivi V1:
                  fase offensiva/difensiva, schemi, modulo tecnico).
                </p>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Fase di lavoro</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {(
                        [
                          { id: "technique" as const, label: "Tecnica" },
                          { id: "tactics" as const, label: "Tattica" },
                        ] as const
                      ).map((opt) => {
                        const sel = techWorkPhase === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setTechWorkPhase(opt.id)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                              sel
                                ? "border-orange-400 bg-orange-500/30 text-white"
                                : "border-white/15 bg-black/40 text-gray-400 hover:border-white/25"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Contesto</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {(
                        [
                          { id: "defensive" as const, label: "Difensivo" },
                          { id: "build_up" as const, label: "Impostazione" },
                          { id: "offensive" as const, label: "Offensivo" },
                        ] as const
                      ).map((opt) => {
                        const sel = techGameContext === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setTechGameContext(opt.id)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                              sel
                                ? "border-orange-400 bg-orange-500/30 text-white"
                                : "border-white/15 bg-black/40 text-gray-400 hover:border-white/25"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Qualità atletica (multipla)</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {TECHNICAL_ATHLETIC_QUALITY_OPTIONS.map((q) => {
                        const on = techQualities.includes(q.id);
                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() =>
                              setTechQualities((prev) =>
                                prev.includes(q.id) ? prev.filter((x) => x !== q.id) : [...prev, q.id],
                              )
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                              on
                                ? "border-orange-400 bg-orange-500/30 text-white"
                                : "border-white/15 bg-black/40 text-gray-400 hover:border-white/25"
                            }`}
                          >
                            {q.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              <details className="rounded-xl border border-white/10 bg-black/30">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-gray-300 marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="underline decoration-orange-400/50 decoration-1 underline-offset-2">Durata, fase e adattamento</span>
                  <span className="ml-2 text-xs text-gray-500">(opzionale)</span>
                </summary>
                <div className="flex flex-wrap items-end gap-3 border-t border-white/10 px-4 pb-4 pt-3">
                  <div className="flex min-w-[11rem] flex-1 items-start gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 p-3 sm:min-w-[10rem]">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" aria-hidden />
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                      Adattamento
                      <select
                        className="rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                        value={adaptation}
                        onChange={(e) => setAdaptation(e.target.value as AdaptationTarget)}
                      >
                        {ADAPTATION_OPTIONS.filter((o) => adaptationAllowed.includes(o.value)).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex min-w-[8rem] items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3">
                    <CalendarRange className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                      Fase
                      <select
                        className="rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                        value={phase}
                        onChange={(e) => setPhase(e.target.value as typeof phase)}
                      >
                        <option value="base">base</option>
                        <option value="build">build</option>
                        <option value="peak">peak</option>
                        <option value="taper">taper</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex min-w-[6.5rem] flex-1 items-start gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 p-3 sm:w-[6.5rem] sm:flex-none">
                    <Clock className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" aria-hidden />
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                      Min
                      <input
                        type="number"
                        min={20}
                        max={180}
                        className="w-full rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                        value={sessionMinutes}
                        onChange={(e) => setSessionMinutes(Number(e.target.value))}
                      />
                    </label>
                  </div>
                </div>
              </details>
              <Pro2Button
                type="button"
                variant="primary"
                className="!inline-flex !w-full !items-center !justify-center !gap-2 sm:!w-auto"
                disabled={!athleteId || genBusy}
                onClick={() => void runGenerate()}
              >
                <Flame className="h-4 w-4 text-amber-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]" aria-hidden />
                {genBusy ? "Generazione…" : "Genera con impostazioni attuali"}
              </Pro2Button>
            </div>
          ) : activeMacroId === "lifestyle" ? (
            <div className="mt-4 flex flex-col gap-3">
              <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">Preset generativi · Lifestyle</p>
              <div className="flex flex-wrap gap-2">
                {ENGINE_QUICK_LIFESTYLE.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!athleteId || genBusy}
                    onClick={() => void runGenerate({ adaptation: p.adaptation, sessionMinutes: p.minutes, phase: p.phase })}
                    className="min-w-[10rem] flex-1 rounded-2xl border-2 border-orange-400/35 bg-gradient-to-br from-orange-600/90 to-amber-700/90 px-4 py-3 text-left text-sm font-bold text-white shadow-[0_0_20px_rgba(251,146,60,0.2)] transition hover:brightness-110 disabled:opacity-40"
                  >
                    <Sparkles className="mb-1 h-4 w-4 text-amber-100 opacity-90" aria-hidden />
                    {p.label}
                  </button>
                ))}
              </div>
              <details className="rounded-xl border border-white/10 bg-black/30">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-gray-300 marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="underline decoration-orange-400/50 decoration-1 underline-offset-2">Durata, fase e adattamento</span>
                  <span className="ml-2 text-xs text-gray-500">(opzionale)</span>
                </summary>
                <div className="flex flex-wrap items-end gap-3 border-t border-white/10 px-4 pb-4 pt-3">
                  <div className="flex min-w-[11rem] flex-1 items-start gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 p-3 sm:min-w-[10rem]">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" aria-hidden />
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                      Adattamento
                      <select
                        className="rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                        value={adaptation}
                        onChange={(e) => setAdaptation(e.target.value as AdaptationTarget)}
                      >
                        {ADAPTATION_OPTIONS.filter((o) => adaptationAllowed.includes(o.value)).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex min-w-[8rem] items-start gap-2 rounded-xl border border-teal-500/35 bg-teal-500/10 p-3">
                    <CalendarRange className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" aria-hidden />
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                      Fase
                      <select
                        className="rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                        value={phase}
                        onChange={(e) => setPhase(e.target.value as typeof phase)}
                      >
                        <option value="base">base</option>
                        <option value="build">build</option>
                        <option value="peak">peak</option>
                        <option value="taper">taper</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex min-w-[6.5rem] flex-1 items-start gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 p-3 sm:w-[6.5rem] sm:flex-none">
                    <Clock className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" aria-hidden />
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                      Min
                      <input
                        type="number"
                        min={20}
                        max={180}
                        className="w-full rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                        value={sessionMinutes}
                        onChange={(e) => setSessionMinutes(Number(e.target.value))}
                      />
                    </label>
                  </div>
                </div>
              </details>
              <Pro2Button
                type="button"
                variant="primary"
                className="!inline-flex !w-full !items-center !justify-center !gap-2 sm:!w-auto"
                disabled={!athleteId || genBusy}
                onClick={() => void runGenerate()}
              >
                <Flame className="h-4 w-4" aria-hidden />
                {genBusy ? "Generazione…" : "Genera con impostazioni attuali"}
              </Pro2Button>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="flex min-w-[11rem] flex-1 items-start gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 p-3 sm:min-w-[10rem]">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" aria-hidden />
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                  Adattamento
                  <select
                    className="rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                    value={adaptation}
                    onChange={(e) => setAdaptation(e.target.value as AdaptationTarget)}
                  >
                    {ADAPTATION_OPTIONS.filter((o) => adaptationAllowed.includes(o.value)).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex min-w-[8rem] items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3">
                <CalendarRange className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                  Fase
                  <select
                    className="rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                    value={phase}
                    onChange={(e) => setPhase(e.target.value as typeof phase)}
                  >
                    <option value="base">base</option>
                    <option value="build">build</option>
                    <option value="peak">peak</option>
                    <option value="taper">taper</option>
                  </select>
                </label>
              </div>
              <div className="flex w-[6.5rem] items-start gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 p-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" aria-hidden />
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                  Min
                  <input
                    type="number"
                    min={20}
                    max={180}
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                    value={sessionMinutes}
                    onChange={(e) => setSessionMinutes(Number(e.target.value))}
                  />
                </label>
              </div>
              <div className="flex min-w-[9rem] flex-1 items-start gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 p-3 sm:min-w-[8rem]">
                <Bike className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" aria-hidden />
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                  Sport
                  <input
                    type="text"
                    className="rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                    value={sport}
                    onChange={(e) => setSport(e.target.value)}
                  />
                </label>
              </div>
              <Pro2Button
                type="button"
                variant="primary"
                className="!inline-flex !items-center !gap-2"
                disabled={!athleteId || genBusy}
                onClick={() => void runGenerate()}
              >
                <Flame className="h-4 w-4" aria-hidden />
                {genBusy ? "Generazione…" : "Genera sessione"}
              </Pro2Button>
            </div>
          )}
          {genErr ? (
            <p className="mt-4 text-sm text-amber-300" role="alert">
              {genErr}
            </p>
          ) : null}
          {genResult && "ok" in genResult && genResult.ok && genResult.operationalScaling?.applied ? (
            <div
              className="mt-4 rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/95"
              role="status"
            >
              <p className="font-semibold text-amber-200">
                Adattamento giornaliero · {genResult.operationalScaling.loadScalePct}% del target pianificato
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-100/80">
                {genResult.operationalScaling.guidance} Il piano VIRYA resta invariato; questa seduta è scalata da recovery, twin e
                bioenergetica.
              </p>
            </div>
          ) : null}
          {genResult && "ok" in genResult && genResult.ok ? (
            <div className="mt-6 space-y-4 rounded-xl border border-white/10 bg-black/30 p-4 text-sm">
              {activeMacroId === "strength" ? (
                <div className="space-y-3 rounded-xl border border-orange-500/25 bg-gradient-to-br from-orange-950/20 via-black/40 to-black/60 p-4">
                  <p className="text-sm font-semibold text-white">
                    Scheda generata ({gymManualRows.length} esercizi) · TSS stimato ~{manualTssPreview}
                  </p>
                  <p className="text-xs text-gray-500">
                    Nomi proposti dal motore, abbinati al catalogo EMPATHY. Affina serie e carichi nel composer sotto.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {gymManualRows.map((row) => (
                      <div
                        key={row.id}
                        className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 shadow-inner"
                      >
                        <GymExerciseMediaThumb
                          src={row.mediaUrl}
                          alt={row.name}
                          catalogExerciseId={row.exerciseId}
                          fallbackLabel={row.name}
                          className="h-28 w-28 shrink-0 rounded-xl border border-orange-500/20 object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold leading-snug text-white">{row.name}</p>
                          <p className="mt-2 font-mono text-xs text-orange-100/90">
                            {row.sets}×{row.reps}
                            {row.loadKg != null && row.loadKg > 0 ? ` · ${row.loadKg} kg` : ""}
                            {row.pct1Rm != null && row.pct1Rm > 0 ? ` · ~${row.pct1Rm}% 1RM` : ""} · rec {row.restSec}s
                            {(row.chainLabel ?? "").trim() ? ` · gruppo ${(row.chainLabel ?? "").trim()}` : ""}
                          </p>
                          {row.quickIncomplete ? (
                            <p className="mt-1 text-[0.65rem] text-orange-300/90">Scheda veloce (incompleta)</p>
                          ) : null}
                          {row.executionStyle ? (
                            <p className="mt-1 text-[0.65rem] text-gray-400">{row.executionStyle}</p>
                          ) : null}
                          {(row.notes ?? "").trim() ? (
                            <p className="mt-1 line-clamp-2 text-[0.65rem] text-gray-400">{row.notes}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className={`rounded-xl border p-3 ${
                    activeMacroId === "lifestyle"
                      ? "border-orange-500/25 bg-gradient-to-br from-orange-950/20 to-black/45"
                      : activeMacroId === "technical"
                        ? "border-orange-500/25 bg-gradient-to-br from-orange-950/20 to-black/45"
                        : "border-orange-500/25 bg-gradient-to-br from-orange-950/20 to-black/45"
                  }`}
                >
                  <SessionBlockIntensityChart
                    segments={genChartSegments}
                    title="Grafico sessione (auto)"
                    estimatedTss={genTssPreview}
                  />
                </div>
              )}
              <div className="flex flex-wrap items-end gap-3 border-b border-white/10 pb-4">
                <label className="flex flex-col gap-1 text-xs text-gray-500">
                  Data calendario (manuale e generato)
                  <input
                    type="date"
                    className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                    value={plannedDate}
                    onChange={(e) => setPlannedDate(e.target.value)}
                  />
                </label>
                <Pro2Button
                  type="button"
                  variant="secondary"
                  className="!border-orange-500/30 !bg-orange-500/10 !text-orange-100 hover:!border-orange-400/50 hover:!bg-orange-500/20"
                  disabled={saveBusy || wahooPushBusy}
                  onClick={() => void saveToCalendar(plannedDate)}
                >
                  {saveBusy ? "Salvataggio…" : "Salva nel calendario"}
                </Pro2Button>
                <Pro2Button
                  type="button"
                  variant="secondary"
                  className="!border-orange-500/30 !bg-orange-500/10 !text-orange-100 hover:!border-orange-400/50 hover:!bg-orange-500/20"
                  disabled={!wahooPushEligible || saveBusy || wahooPushBusy}
                  title={
                    !wahooPushEligible
                      ? "Serve sessione endurance con blocchi, FTP/FC valide e account Wahoo collegato (Profilo)."
                      : undefined
                  }
                  onClick={() => void pushSessionToWahooCloud()}
                >
                  {wahooPushBusy ? "Wahoo…" : "Invia a Wahoo"}
                </Pro2Button>
              </div>
              {saveErr ? (
                <p className="text-sm text-amber-300" role="alert">
                  {saveErr}
                </p>
              ) : null}
              {wahooPushErr ? (
                <p className="text-sm text-amber-300" role="alert">
                  Wahoo: {wahooPushErr}
                </p>
              ) : null}
              {wahooPushOk ? <p className="text-sm text-emerald-200/90">{wahooPushOk}</p> : null}
              {saveOkId ? (
                <BuilderCalendarSaveConfirm date={plannedDate} plannedWorkoutId={saveOkId} />
              ) : null}
              {showTech ? <p className="font-mono text-[0.65rem] text-gray-500">{genResult.source}</p> : null}
              <p className="text-gray-300">
                Profilo fisiologico: {genResult.physiologyPresent ? "sì" : "no"} · Twin: {genResult.twinPresent ? "sì" : "no"}
              </p>
              {activeMacroId !== "strength" ? (
                <ul className="space-y-3">
                  {(genResult.blockExercises as Array<{ order: number; label: string; exercises: Array<{ name?: string }> }>).map(
                    (b) => (
                      <li key={b.order} className="border-b border-white/5 pb-3 last:border-0">
                        <span className="font-bold text-white">
                          {b.order}. {b.label}
                        </span>
                        <ul className="mt-1 list-disc pl-5 text-gray-400">
                          {b.exercises.map((ex) => (
                            <li key={ex.name}>{ex.name ?? "—"}</li>
                          ))}
                        </ul>
                      </li>
                    ),
                  )}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="flex items-center gap-2 rounded-xl border border-orange-500/25 bg-orange-500/[0.06] px-4 py-2.5">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-orange-400/45 bg-orange-500/25 text-sm font-black text-orange-100">
            3
          </span>
          <p className="text-sm font-bold text-white">
            Rifinisci{" "}
            <span className="font-normal text-gray-400">— adatta blocchi, esercizi, durata e nome della seduta nel composer qui sotto.</span>
          </p>
        </div>

        <div id="builder-manual-editor">
        {activeMacroId === "strength" ? (
          <BuilderGymManualComposer
            athleteId={athleteId}
            physioHint={physioHint}
            gymRows={gymManualRows}
            setGymRows={setGymManualRows}
            manualSessionName={manualSessionName}
            setManualSessionName={setManualSessionName}
            manualChartSegments={manualChartSegments}
            manualPlannedDate={plannedDate}
            setManualPlannedDate={setPlannedDate}
            manualSessionDurationMinutes={manualSessionDurationMinutes}
            setManualSessionDurationMinutes={setManualSessionDurationMinutes}
            paletteSport={sport}
            currentSportLabel={currentSportLabel}
            manualSaveBusy={manualSaveBusy}
            onSaveManual={(date) => void saveManualToCalendar(date)}
            manualSaveErr={manualSaveErr}
            manualSaveOkId={manualSaveOkId}
            canSave={Boolean(manualSession)}
            estimatedTss={manualTssPreview}
          />
        ) : activeMacroId === "technical" ? (
          <BuilderTechnicalManualComposer
            athleteId={athleteId}
            physioHint={physioHint}
            paletteSport={sport}
            currentSportLabel={currentSportLabel}
            technicalManualRows={technicalManualRows}
            setTechnicalManualRows={setTechnicalManualRows}
            technicalModuleFocus={{
              workPhase: techWorkPhase,
              gameContext: techGameContext,
              athleticQualities: techQualities,
            }}
            manualSessionName={manualSessionName}
            setManualSessionName={setManualSessionName}
            manualChartSegments={manualChartSegments}
            manualPlannedDate={plannedDate}
            setManualPlannedDate={setPlannedDate}
            manualSessionDurationMinutes={manualSessionDurationMinutes}
            setManualSessionDurationMinutes={setManualSessionDurationMinutes}
            manualSaveBusy={manualSaveBusy}
            onSaveManual={(date) => void saveManualToCalendar(date)}
            manualSaveErr={manualSaveErr}
            manualSaveOkId={manualSaveOkId}
            canSave={Boolean(manualSession)}
            estimatedTss={manualTssPreview}
          />
        ) : activeMacroId === "lifestyle" ? (
          <BuilderLifestyleManualComposer
            athleteId={athleteId}
            physioHint={physioHint}
            lifestyleRows={lifestyleManualRows}
            setLifestyleRows={setLifestyleManualRows}
            manualSessionName={manualSessionName}
            setManualSessionName={setManualSessionName}
            manualChartSegments={manualChartSegments}
            manualPlannedDate={plannedDate}
            setManualPlannedDate={setPlannedDate}
            manualSessionDurationMinutes={manualSessionDurationMinutes}
            setManualSessionDurationMinutes={setManualSessionDurationMinutes}
            paletteSport={sport}
            currentSportLabel={currentSportLabel}
            manualSaveBusy={manualSaveBusy}
            onSaveManual={(date) => void saveManualToCalendar(date)}
            manualSaveErr={manualSaveErr}
            manualSaveOkId={manualSaveOkId}
            canSave={Boolean(manualSession)}
            estimatedTss={manualTssPreview}
          />
        ) : (
          <BuilderManualComposer
            athleteId={athleteId}
            macroFamily={activeMacroId}
            physioHint={physioHint}
            manualPlanBlocks={manualPlanBlocks}
            setManualPlanBlocks={setManualPlanBlocks}
            activeIndex={manualActiveIndex}
            setActiveIndex={setManualActiveIndex}
            intensityUnit={intensityUnit}
            setIntensityUnit={setIntensityUnit}
            ftpW={ftpW}
            setFtpW={setFtpW}
            hrMax={hrMax}
            setHrMax={setHrMax}
            lengthMode={lengthMode}
            setLengthMode={setLengthMode}
            speedRefKmh={speedRefKmh}
            setSpeedRefKmh={setSpeedRefKmh}
            manualSessionName={manualSessionName}
            setManualSessionName={setManualSessionName}
            manualChartSegments={manualChartSegments}
            manualPlannedDate={plannedDate}
            setManualPlannedDate={setPlannedDate}
            manualSaveBusy={manualSaveBusy}
            onSaveManual={(date) => void saveManualToCalendar(date)}
            manualSaveErr={manualSaveErr}
            manualSaveOkId={manualSaveOkId}
            canSave={Boolean(manualSession)}
            estimatedTss={manualTssPreview}
            manualSessionDurationMinutes={manualSessionDurationMinutes}
            setManualSessionDurationMinutes={setManualSessionDurationMinutes}
          />
        )}
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-orange-500/25 bg-orange-500/[0.06] px-4 py-2.5">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-orange-400/45 bg-orange-500/25 text-sm font-black text-orange-100">
            4
          </span>
          <p className="text-sm font-bold text-white">
            Salva{" "}
            <span className="font-normal text-gray-400">
              — usa «Salva nel calendario» nella seduta generata o nel composer: la seduta appare in «Prossime pianificate» e nel Calendario.
            </span>
          </p>
        </div>

        <CoachWorkoutLibraryPanel
          athleteId={athleteId}
          targetDate={plannedDate}
          contractToSave={libraryContractToSave}
          saveTitle={manualSessionName.trim() || undefined}
          onApplied={() => setCalendarRefresh((n) => n + 1)}
          onLoadInBuilder={loadLibraryContractInBuilder}
        />

        <BuilderUpcomingPlannedSection
          ctxLoading={ctxLoading}
          loading={loading}
          err={err}
          showData={showData}
          upcoming={upcoming}
          executed={executed}
        />

        {/* In fondo: accordion unico «Dettagli e motore» — contesto generativo e KPI finestra. */}
        <Pro2Accordion
          id="mod-dettagli-motore"
          title="Dettagli e motore"
          subtitle="Contesto generativo, asset e KPI della finestra calendario"
          accent="orange"
        >
          <div className="space-y-6">
            <section
              aria-label="Contesto generativo e asset"
              className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5 shadow-inner"
            >
              <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">
                Builder · contesto generativo
              </p>
              <p className="mt-1 max-w-3xl text-xs text-gray-500">
                Knowledge library e asset esterni sono di supporto e audit: il motore sessione resta deterministico; nessun redirect o
                blocco se i dati mancano (fallback locale in-modulo).
              </p>
              {!athleteId ? (
                <p className="mt-3 text-sm text-gray-500">Seleziona un atleta attivo per caricare tracce e contesto nutrizione.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  <ResearchTraceScientificPanel athleteId={athleteId} limit={16} traceSurface="latest_primary" />
                  <ReplicateStatusStrip />
                  <div className="rounded-xl border border-orange-500/25 bg-orange-950/10 p-3 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">Nutrizione · giorno seduta engine</p>
                        <p className="mt-0.5 font-mono text-[0.7rem] text-gray-500">{plannedDate}</p>
                      </div>
                      <Pro2Button
                        type="button"
                        variant="secondary"
                        disabled={nutritionBusy}
                        className="border-orange-500/30 bg-orange-500/10 text-xs text-orange-100 hover:border-orange-400/50 hover:bg-orange-500/20"
                        onClick={() => void refreshNutritionContext()}
                      >
                        {nutritionBusy ? "Lettura…" : "Aggiorna sintesi"}
                      </Pro2Button>
                    </div>
                    {nutritionErr ? <p className="mt-2 text-xs text-amber-200/90">{nutritionErr}</p> : null}
                    {nutritionLine ? (
                      <p className="mt-2 text-sm text-gray-200">{nutritionLine}</p>
                    ) : !nutritionErr && !nutritionBusy ? (
                      <p className="mt-2 text-xs text-gray-500">Solo lettura API nutrizione — utile per allineare fueling mentale al giorno scelto.</p>
                    ) : null}
                  </div>
                </div>
              )}
            </section>

            <section aria-label="KPI finestra" className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
              <KpiCard
                label="TSS pianificato"
                value={showData ? Math.round(stats.pTss).toString() : "—"}
                hint={range ? `${range.from} → ${range.to}` : undefined}
                accent="orange"
                icon={Flame}
              />
              <KpiCard
                label="TSS eseguito"
                value={showData ? Math.round(stats.eTss).toString() : "—"}
                hint="Nella stessa finestra"
                accent="orange"
                icon={Activity}
              />
              <KpiCard
                label="Sessioni (pian. / eseg.)"
                value={showData ? `${stats.sessionsPlanned} / ${stats.sessionsExecuted}` : "—"}
                accent="orange"
                icon={Timer}
              />
              <KpiCard
                label="Minuti totali"
                value={showData ? `${Math.round(stats.pMin + stats.eMin)}` : "—"}
                hint="Pianificato + eseguito (somma grezza)"
                accent="orange"
                icon={Heart}
              />
            </section>
          </div>
        </Pro2Accordion>
    </Pro2ModulePageShell>
  );
}
