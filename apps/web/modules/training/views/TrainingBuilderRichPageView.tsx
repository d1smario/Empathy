"use client";

import {
  type ExecutedWorkout,
  type PlannedWorkout,
} from "@empathy/domain-training";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoachWorkoutLibraryPanel } from "@/components/training/CoachWorkoutLibraryPanel";
import { TrainingPlannedWindowContextStrip } from "@/components/training/TrainingPlannedWindowContextStrip";
import { TrainingSubnav } from "@/components/training/TrainingSubnav";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
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
import { pro2PaletteSportToBlock1SportTag } from "@/lib/training/domain-blocks/block1-strength-functional";
import { fetchUnifiedBuilderExercises } from "@/modules/training/services/training-builder-catalog-api";
import { macroIdForSport, SPORT_MACRO_SECTORS } from "@/lib/training/builder/sport-macro-palette";
import { trainingDomainForPaletteSport } from "@/lib/training/sport-domain-map";
import { estimateTssFromSegments } from "@/lib/training/builder/tss-estimate";
import { serializePro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { hydrateBuilderStateFromLibraryContract } from "@/lib/training/library/hydrate-builder-from-library-contract";
import { buildPro2ContractFromEngineGeneration } from "@/lib/training/builder/engine-session-contract-for-calendar";
import { type AdaptationTarget, type GymContractionEmphasis, type GymEquipmentChannel, type GymGenerationProfile, type TechnicalAthleticQualityId, type TechnicalGameContext, type TechnicalWorkPhase } from "@/lib/training/engine";
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
import { initialManualPlanBlocks, localCalendarDateString, normalizeCalendarTargetDay, builderPlannedWindowRange, WindowErr, sumPlannedTss, sumExecutedTss, sumMinutesPlanned, sumMinutesExecuted, ADAPTATION_BY_MACRO, defaultAdaptationForMacro, defaultSessionMinutesForMacro, EngineGenerateOverrides, BuilderWindowCacheEntry } from "@/lib/training/training-builder-rich-kit";
import { BuilderViryaEntryBanner } from "@/modules/training/views/sections/BuilderViryaEntryBanner";
import { BuilderDayAdaptationPanel } from "@/modules/training/views/sections/BuilderDayAdaptationPanel";
import { BuilderSportMacroSectorPicker } from "@/modules/training/views/sections/BuilderSportMacroSectorPicker";
import { BuilderUpcomingPlannedSection } from "@/modules/training/views/sections/BuilderUpcomingPlannedSection";
import { BuilderEngineGenerateSection } from "@/modules/training/views/sections/BuilderEngineGenerateSection";
import { BuilderManualComposerSwitch } from "@/modules/training/views/sections/BuilderManualComposerSwitch";
import { BuilderDetailsEngineAccordion } from "@/modules/training/views/sections/BuilderDetailsEngineAccordion";


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

        <BuilderEngineGenerateSection
          activeMacroId={activeMacroId}
          currentSportLabel={currentSportLabel}
          athleteId={athleteId}
          genBusy={genBusy}
          runGenerate={runGenerate}
          gymEquipChannels={gymEquipChannels}
          setGymEquipChannels={setGymEquipChannels}
          gymContraction={gymContraction}
          setGymContraction={setGymContraction}
          gymAutoExecutionStyle={gymAutoExecutionStyle}
          setGymAutoExecutionStyle={setGymAutoExecutionStyle}
          adaptation={adaptation}
          setAdaptation={setAdaptation}
          adaptationAllowed={adaptationAllowed}
          phase={phase}
          setPhase={setPhase}
          sessionMinutes={sessionMinutes}
          setSessionMinutes={setSessionMinutes}
          sport={sport}
          setSport={setSport}
          techWorkPhase={techWorkPhase}
          setTechWorkPhase={setTechWorkPhase}
          techGameContext={techGameContext}
          setTechGameContext={setTechGameContext}
          techQualities={techQualities}
          setTechQualities={setTechQualities}
          genErr={genErr}
          genResult={genResult}
          gymManualRows={gymManualRows}
          manualTssPreview={manualTssPreview}
          genChartSegments={genChartSegments}
          genTssPreview={genTssPreview}
          plannedDate={plannedDate}
          setPlannedDate={setPlannedDate}
          saveBusy={saveBusy}
          saveToCalendar={saveToCalendar}
          wahooPushBusy={wahooPushBusy}
          wahooPushEligible={wahooPushEligible}
          pushSessionToWahooCloud={pushSessionToWahooCloud}
          saveErr={saveErr}
          wahooPushErr={wahooPushErr}
          wahooPushOk={wahooPushOk}
          saveOkId={saveOkId}
          showTech={showTech}
        />

        <div className="flex items-center gap-2 rounded-xl border border-orange-500/25 bg-orange-500/[0.06] px-4 py-2.5">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-orange-400/45 bg-orange-500/25 text-sm font-black text-orange-100">
            3
          </span>
          <p className="text-sm font-bold text-white">
            Rifinisci{" "}
            <span className="font-normal text-gray-400">— adatta blocchi, esercizi, durata e nome della seduta nel composer qui sotto.</span>
          </p>
        </div>

        <BuilderManualComposerSwitch
          activeMacroId={activeMacroId}
          athleteId={athleteId}
          physioHint={physioHint}
          gymManualRows={gymManualRows}
          setGymManualRows={setGymManualRows}
          technicalManualRows={technicalManualRows}
          setTechnicalManualRows={setTechnicalManualRows}
          lifestyleManualRows={lifestyleManualRows}
          setLifestyleManualRows={setLifestyleManualRows}
          manualPlanBlocks={manualPlanBlocks}
          setManualPlanBlocks={setManualPlanBlocks}
          manualActiveIndex={manualActiveIndex}
          setManualActiveIndex={setManualActiveIndex}
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
          plannedDate={plannedDate}
          setPlannedDate={setPlannedDate}
          manualSessionDurationMinutes={manualSessionDurationMinutes}
          setManualSessionDurationMinutes={setManualSessionDurationMinutes}
          sport={sport}
          currentSportLabel={currentSportLabel}
          techWorkPhase={techWorkPhase}
          techGameContext={techGameContext}
          techQualities={techQualities}
          manualSaveBusy={manualSaveBusy}
          saveManualToCalendar={saveManualToCalendar}
          manualSaveErr={manualSaveErr}
          manualSaveOkId={manualSaveOkId}
          manualSession={manualSession}
          manualTssPreview={manualTssPreview}
        />

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
        <BuilderDetailsEngineAccordion
          athleteId={athleteId}
          plannedDate={plannedDate}
          nutritionBusy={nutritionBusy}
          nutritionErr={nutritionErr}
          nutritionLine={nutritionLine}
          refreshNutritionContext={refreshNutritionContext}
          showData={showData}
          stats={stats}
          range={range}
        />
    </Pro2ModulePageShell>
  );
}
