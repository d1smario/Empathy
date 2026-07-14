"use client";

import {
  type ExecutedWorkout,
  type PlannedWorkout,
} from "@empathy/domain-training";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoachWorkoutLibraryPanel } from "@/components/training/CoachWorkoutLibraryPanel";
import { saveCoachLibraryItem } from "@/modules/training/services/training-library-api";
import { TrainingPlannedWindowContextStrip } from "@/components/training/TrainingPlannedWindowContextStrip";
import { TrainingSubnav } from "@/components/training/TrainingSubnav";
import { ViryaLongTermStrip } from "@/components/training/ViryaLongTermStrip";
import { useScopedAthleteName } from "@/lib/training/use-scoped-athlete-name";
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
import { parseStructuredWorkoutForBuilder } from "@/modules/training/services/training-import-api";
import { macroIdForSport, SPORT_MACRO_SECTORS } from "@/lib/training/builder/sport-macro-palette";
import { trainingDomainForPaletteSport } from "@/lib/training/sport-domain-map";
import { estimateTssFromSegments } from "@/lib/training/builder/tss-estimate";
import { serializePro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { hydrateBuilderStateFromLibraryContract } from "@/lib/training/library/hydrate-builder-from-library-contract";
import { buildPro2ContractFromEngineGeneration } from "@/lib/training/builder/engine-session-contract-for-calendar";
import { BuilderCalendarSaveConfirm } from "@/components/training/BuilderCalendarSaveConfirm";
import { Pro2Button } from "@/components/ui/empathy";
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
import { fetchProfileViewModel } from "@/modules/profile/services/profile-api";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { initialManualPlanBlocks, localCalendarDateString, normalizeCalendarTargetDay, builderPlannedWindowRange, WindowErr, ADAPTATION_BY_MACRO, defaultAdaptationForMacro, defaultSessionMinutesForMacro, EngineGenerateOverrides, BuilderWindowCacheEntry } from "@/lib/training/training-builder-rich-kit";
import { BuilderViryaEntryBanner } from "@/modules/training/views/sections/BuilderViryaEntryBanner";
import { BuilderDayAdaptationPanel } from "@/modules/training/views/sections/BuilderDayAdaptationPanel";
import { BuilderSportMacroSectorPicker } from "@/modules/training/views/sections/BuilderSportMacroSectorPicker";
import { BuilderUpcomingPlannedSection } from "@/modules/training/views/sections/BuilderUpcomingPlannedSection";
import { BuilderEngineGenerateSection } from "@/modules/training/views/sections/BuilderEngineGenerateSection";
import { BuilderManualComposerSwitch } from "@/modules/training/views/sections/BuilderManualComposerSwitch";
import { BuilderStartPointModal } from "@/modules/training/views/sections/BuilderStartPointModal";


let builderWindowCacheKey: string | null = null;
let builderWindowCache: BuilderWindowCacheEntry | null = null;

/**
 * Builder = unico motore sessione; Vyria annuale userà solo questo endpoint per materializzare.
 */
export default function TrainingBuilderRichPageView() {
  const t = useTranslations("TrainingBuilderRichPageView");
  const searchParams = useSearchParams();
  const router = useRouter();
  const { athleteId, role, adminScoped, loading: ctxLoading } = useActiveAthlete();
  /** Contenuti tecnici (diagnostica, sorgenti motore) visibili solo a coach/admin. */
  const showTech = role === "coach" || adminScoped;
  /** Il Builder è coach-only: titolo «Crea la seduta per {atleta}» col nome in scope. */
  const scopedAthleteName = useScopedAthleteName();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [planned, setPlanned] = useState<PlannedWorkout[]>([]);
  const [executed, setExecuted] = useState<ExecutedWorkout[]>([]);
  const [calendarRefresh, setCalendarRefresh] = useState(0);
  const [readSpineCoverage, setReadSpineCoverage] = useState<ReadSpineCoverageSummary | null>(null);
  const [twinContextStrip, setTwinContextStrip] = useState<TrainingTwinContextStripViewModel | null>(null);
  const [plannedProvenanceSummary, setPlannedProvenanceSummary] = useState<Partial<Record<string, number>> | null>(null);
  /** Unica data calendario (manuale + generato): evita salvataggi su giorni diversi tra sezioni del builder. */
  const [plannedDate, setPlannedDate] = useState(() => localCalendarDateString());
  /** Orario canonico della seduta (HH:MM). Obbligatorio in UI, serializzato nel contratto builder in notes. */
  const [scheduledTime, setScheduledTime] = useState("12:00");
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
      setReadSpineCoverage(null);
      setTwinContextStrip(null);
      setPlannedProvenanceSummary(null);
      setErr(t("errNoActiveAthlete"));
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
          setReadSpineCoverage(null);
          setTwinContextStrip(null);
          setPlannedProvenanceSummary(null);
          setErr(("error" in json && json.error) || t("errReadCalendar"));
          return;
        }
        const entry: BuilderWindowCacheEntry = {
          planned: json.planned,
          executed: json.executed ?? [],
          readSpineCoverage: json.readSpineCoverage ?? null,
          twinContextStrip: json.twinContextStrip ?? null,
          plannedProvenanceSummary: json.plannedProvenanceSummary ?? null,
        };
        setPlanned(entry.planned);
        setExecuted(entry.executed);
        setReadSpineCoverage(entry.readSpineCoverage);
        setTwinContextStrip(entry.twinContextStrip);
        setPlannedProvenanceSummary(entry.plannedProvenanceSummary);
        setErr(null);
        builderWindowCache = entry;
        builderWindowCacheKey = cacheKey;
      } catch {
        if (!c && !cached) {
          setErr(t("errNetwork"));
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
  /** «Salva nella mia libreria» dal box Salva: nome + esito, riusa libraryContractToSave. */
  const [libName, setLibName] = useState("");
  const [libSaveBusy, setLibSaveBusy] = useState(false);
  const [libSaveErr, setLibSaveErr] = useState<string | null>(null);
  const [libSaveOk, setLibSaveOk] = useState<string | null>(null);
  /** Modale «Punti di partenza»: un solo overlay aperto per volta (Genera / Libreria / Importa). */
  const [startPointModal, setStartPointModal] = useState<null | "generate" | "library" | "import">(null);
  const closeStartPointModal = useCallback(() => setStartPointModal(null), []);

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
  // [M1] Import FIT/ZWO/ERG/MRC direttamente nell'editor manuale (anteprima editabile,
  // niente scrittura DB): parse server-side → contratto → idratazione dello stato Builder.
  const importStructuredInputRef = useRef<HTMLInputElement | null>(null);
  const [structuredImportBusy, setStructuredImportBusy] = useState(false);
  const [structuredImportErr, setStructuredImportErr] = useState<string | null>(null);
  const [structuredImportOk, setStructuredImportOk] = useState<string | null>(null);
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
    setStructuredImportOk(null);
    setStructuredImportErr(null);
    setLibSaveOk(null);
    setLibSaveErr(null);
  }, [athleteId, plannedDate, replacePlannedIdFromQuery]);

  useEffect(() => {
    setManualActiveIndex((i) => Math.min(i, Math.max(0, manualPlanBlocks.length - 1)));
  }, [manualPlanBlocks.length]);

  const loadLibraryContractInBuilder = useCallback(
    (contract: Pro2BuilderSessionContract, opts?: { scroll?: boolean; keepSport?: boolean }) => {
      // Editor ripopolato da altra fonte (template libreria / Genera aerobico): il banner
      // «Importato …» non deve restare appeso. Il flusso import lo re-imposta subito dopo.
      setStructuredImportOk(null);
      setStructuredImportErr(null);
      const state = hydrateBuilderStateFromLibraryContract(contract);
      // keepSport: quando la sorgente è la generazione motore lo sport è già quello
      // selezionato; NON reidratarlo dal label del contratto (potrebbe cambiarlo).
      if (!opts?.keepSport) setSport(state.sport);
      setManualSessionName(state.manualSessionName);
      setManualSessionDurationMinutes(state.manualSessionDurationMinutes);
      setScheduledTime(state.scheduledTime ?? "12:00");
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
      if (opts?.scroll !== false) {
        requestAnimationFrame(() => {
          document.getElementById("builder-manual-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    },
    [],
  );

  const handleStructuredWorkoutImport = useCallback(
    async (file: File | null | undefined): Promise<boolean> => {
      if (!file) return false;
      if (!athleteId) {
        setStructuredImportErr("Seleziona prima un atleta.");
        setStructuredImportOk(null);
        return false;
      }
      setStructuredImportBusy(true);
      setStructuredImportErr(null);
      setStructuredImportOk(null);
      try {
        const res = await parseStructuredWorkoutForBuilder({ athleteId, file });
        loadLibraryContractInBuilder(res.contract);
        // L'editor manuale importato è la fonte di verità: azzera la seduta motore
        // (altrimenti Push su Wahoo e salvataggio in libreria userebbero ancora quella)
        // e i banner di salvataggio stantii.
        setGenResult(null);
        setSaveOkId(null);
        setSaveErr(null);
        const rows = res.intervalRows > 0 ? ` · ${res.intervalRows} intervalli` : "";
        setStructuredImportOk(`Importato «${res.sessionName}»${rows}. Rivedi i blocchi e salva.`);
        return true;
      } catch (e) {
        setStructuredImportErr(e instanceof Error ? e.message : "Import non riuscito");
        return false;
      } finally {
        setStructuredImportBusy(false);
      }
    },
    [athleteId, loadLibraryContractInBuilder],
  );

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
          hint.push(t("hrMaxHint", { hm }));
        } else if (typeof p.lt1HeartRate === "number" && p.lt1HeartRate > 0) {
          const hm = Math.min(220, Math.max(155, Math.round(p.lt1HeartRate / 0.72)));
          setHrMax(hm);
          hint.push(t("hrMaxHint", { hm }));
        }
        setPhysioHint(hint.length ? t("fromPhysiology", { hints: hint.join(" · ") }) : null);
      } catch {
        if (!c) setPhysioHint(null);
      }
    })();
    return () => {
      c = true;
    };
  }, [athleteId, sport]);

  const runGenerate = useCallback(
    async (overrides?: EngineGenerateOverrides): Promise<boolean> => {
      if (!athleteId) return false;
      const adaptationUse = overrides?.adaptation ?? adaptation;
      const sessionMinutesUse = overrides?.sessionMinutes ?? sessionMinutes;
      const phaseUse = overrides?.phase ?? phase;
      if (overrides?.adaptation != null) setAdaptation(overrides.adaptation);
      if (overrides?.sessionMinutes != null) setSessionMinutes(overrides.sessionMinutes);
      if (overrides?.phase != null) setPhase(overrides.phase);
      setGenBusy(true);
      setGenErr(null);
      setGenResult(null);
      setStructuredImportOk(null);
      setStructuredImportErr(null);
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
        return false;
      }

      if (activeMacroId === "strength") {
        const sportTag = pro2PaletteSportToBlock1SportTag(sport);
        const { rows: catalogRows, error: catErr } = await fetchUnifiedBuilderExercises({
          sportTag,
          limit: 400,
        });
        if (catErr || catalogRows.length === 0) {
          setGenBusy(false);
          setGenErr(catErr ?? t("errCatalogUnavailable"));
          setGenResult(null);
          return false;
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
          setGenErr(t("errNoCompatibleExercise"));
          setGenResult(null);
          return false;
        }
        setGymManualRows(built);
        const scaledMinutes =
          "operationalScaling" in out && out.operationalScaling?.sessionMinutesEffective != null
            ? out.operationalScaling.sessionMinutesEffective
            : sessionMinutesUse;
        setManualSessionDurationMinutes(scaledMinutes);
        const goalLabel = String((out.session as { goalLabel?: string }).goalLabel ?? "").trim();
        if (goalLabel) setManualSessionName(goalLabel);
      } else {
        // Aerobic/technical/lifestyle: materializza la sessione generata anche
        // nell'editor «Rifinisci» (stessa pipeline+scaling di saveToCalendar), così
        // la rifinitura parte dal generato invece che da blocchi vuoti.
        const loadScale =
          "operationalScaling" in out &&
          out.operationalScaling?.applied &&
          out.operationalScaling.loadScale > 0
            ? out.operationalScaling.loadScale
            : 1;
        const builderFamily =
          activeMacroId === "aerobic" ? "aerobic" : activeMacroId === "technical" ? "technical" : "lifestyle";
        const editorContract = buildPro2ContractFromEngineGeneration({
          session: out.session,
          blockExercises: "blockExercises" in out ? out.blockExercises : undefined,
          renderProfile: {
            intensityUnit,
            ftpW: Math.max(1, ftpW),
            hrMax: Math.max(1, hrMax),
            lengthMode,
            speedRefKmh: Math.max(1, speedRefKmh),
          },
          family: builderFamily,
          discipline: currentSportLabel || sport.trim() || "Endurance",
          sessionName: manualSessionName.trim() || out.session.goalLabel || "Sessione Pro 2",
          adaptationTarget: adaptationUse,
          phase: phaseUse,
          plannedSessionDurationMinutes:
            dayAdaptation?.ok && dayAdaptation.targetPlanned
              ? dayAdaptation.targetPlanned.adaptedDurationMinutes
              : sessionMinutesUse,
          loadScale,
        });
        if (editorContract) {
          loadLibraryContractInBuilder(editorContract, { scroll: false, keepSport: true });
        }
      }

      setGenResult(out);
      setSaveErr(null);
      setSaveOkId(null);
      setGenBusy(false);
      return true;
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
      currentSportLabel,
      manualSessionName,
      dayAdaptation,
      intensityUnit,
      ftpW,
      hrMax,
      lengthMode,
      speedRefKmh,
      loadLibraryContractInBuilder,
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
      // In scope coach/admin il Builder è montato dentro /athletes/[id]/training: NON
      // reindirizzare al calendario globale (perderebbe lo scope). Resta col messaggio di
      // successo; il coach passa al tab «Calendario» per vedere la seduta dell'atleta.
      if (!adminScoped) {
        router.push(`/training/calendar?date=${encodeURIComponent(day)}`);
      }
    },
    [athleteId, router, adminScoped],
  );

  const saveToCalendar = useCallback(async (targetDate: string) => {
    if (!athleteId || !genResult || !("ok" in genResult) || !genResult.ok) return;
    const day = normalizeCalendarTargetDay(targetDate);
    if (!day) {
      setSaveErr(t("errInvalidDate"));
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
        setSaveErr(t("errEmptyPlan"));
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
        scheduledTime,
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
        scheduledTime,
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
        setSaveErr(e instanceof Error ? e.message : t("errReplaceSession"));
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
    scheduledTime,
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
      setWahooPushErr([r.error, r.phase ? `phase: ${r.phase}` : null].filter(Boolean).join(" · "));
      return;
    }
    setWahooPushOk(
      r.plan_id != null ? t("wahooPlanCreated", { planId: r.plan_id }) : t("wahooPlanSent"),
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
      setManualSaveErr(t("errInvalidDate"));
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
            scheduledTime,
          })
        : activeMacroId === "lifestyle"
          ? buildPro2LifestyleSchedaSessionContract({
              rows: lifestyleManualRows,
              renderProfile,
              discipline: currentSportLabel || sport.trim() || "Lifestyle",
              sessionName: manualSessionName.trim() || "Scheda lifestyle Pro 2",
              adaptationTarget: adaptation,
              phase,
              scheduledTime,
            })
          : activeMacroId === "technical"
            ? buildPro2TechnicalSchedaSessionContract({
                rows: technicalManualRows,
                renderProfile,
                discipline: currentSportLabel || sport.trim() || "Sport tecnico",
                sessionName: manualSessionName.trim() || "Scheda tecnica Pro 2",
                adaptationTarget: adaptation,
                phase,
                scheduledTime,
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
                scheduledTime,
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
    scheduledTime,
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
          scheduledTime,
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
          scheduledTime,
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
        scheduledTime,
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
        scheduledTime,
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
        scheduledTime,
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
      scheduledTime,
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
    scheduledTime,
  ]);

  const saveToLibrary = useCallback(async () => {
    if (!libraryContractToSave) {
      setLibSaveErr(t("saveBarLibraryEmpty"));
      setLibSaveOk(null);
      return;
    }
    setLibSaveBusy(true);
    setLibSaveErr(null);
    setLibSaveOk(null);
    const title = (libName.trim() || manualSessionName.trim() || libraryContractToSave.sessionName || "Seduta Pro 2")
      .trim()
      .slice(0, 200);
    const r = await saveCoachLibraryItem({ title, contract: libraryContractToSave });
    setLibSaveBusy(false);
    if (!r.ok) {
      setLibSaveErr(r.error ?? t("saveBarLibraryEmpty"));
      return;
    }
    setLibSaveOk(t("saveBarLibrarySavedOk", { title }));
  }, [libraryContractToSave, libName, manualSessionName, t]);

  /** Genera dentro il modale: alla generazione riuscita chiude l'overlay e lascia la tela popolata. */
  const runGenerateFromModal = useCallback(
    async (overrides?: EngineGenerateOverrides) => {
      const ok = await runGenerate(overrides);
      if (ok) setStartPointModal(null);
    },
    [runGenerate],
  );

  /** Carica un template libreria e chiude il modale «Seleziona dalla mia libreria». */
  const loadLibraryContractFromModal = useCallback(
    (contract: Pro2BuilderSessionContract) => {
      loadLibraryContractInBuilder(contract);
      setStartPointModal(null);
    },
    [loadLibraryContractInBuilder],
  );

  /** Import da file nel modale: a import riuscito chiude l'overlay. */
  const handleStructuredWorkoutImportFromModal = useCallback(
    async (file: File | null | undefined) => {
      const ok = await handleStructuredWorkoutImport(file);
      if (ok) setStartPointModal(null);
    },
    [handleStructuredWorkoutImport],
  );

  const upcoming = useMemo(() => {
    const today = localCalendarDateString();
    return [...planned]
      .filter((w) => w.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);
  }, [planned]);

  const showData = !ctxLoading && !loading && !err;

  return (
    <Pro2ModulePageShell
      eyebrow={t("eyebrow")}
      eyebrowClassName="text-orange-400"
      title={scopedAthleteName ? t("pageTitleForAthlete", { name: scopedAthleteName }) : t("pageTitleGeneric")}
      description={
        scopedAthleteName ? t("pageDescriptionForAthlete", { name: scopedAthleteName }) : t("pageDescription")
      }
      contentMaxWidthClassName="max-w-none"
    >
        {adminScoped ? null : (
          <div className="scroll-mt-28">
            <TrainingSubnav />
          </div>
        )}

        <ViryaLongTermStrip athleteId={athleteId} date={plannedDate} />

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
          replacePlannedIdFromQuery={replacePlannedIdFromQuery}
        />

        <BuilderSportMacroSectorPicker
          activeMacroId={activeMacroId}
          sport={sport}
          setSport={setSport}
        />

        {/* [G1] Punti di partenza: scatola compatta con TRE bottoni; ognuno apre un
            modale con la sezione esistente (Genera motore / picker libreria / import
            FIT·ZWO·ERG). All'azione riuscita il modale si chiude e la tela sotto
            (anteprima + editor) resta popolata, pronta da rifinire e salvare. */}
        <div className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.06] p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gray-500">
              {t("startPointsHeading")}
            </span>
            <span className="h-px flex-1 bg-white/10" aria-hidden />
          </div>
          <p className="mt-2 text-xs text-gray-400">{t("startPointsIntro")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Pro2Button type="button" variant="primary" onClick={() => setStartPointModal("generate")}>
              {t("startPointGenerate")}
            </Pro2Button>
            <Pro2Button
              type="button"
              variant="secondary"
              className="!border-orange-500/30 !bg-orange-500/10 !text-orange-100 hover:!border-orange-400/50 hover:!bg-orange-500/20"
              onClick={() => setStartPointModal("library")}
              title={t("pickFromLibraryHint")}
            >
              {t("pickFromLibrary")}
            </Pro2Button>
            <Pro2Button
              type="button"
              variant="secondary"
              className="!border-orange-500/30 !bg-orange-500/10 !text-orange-100 hover:!border-orange-400/50 hover:!bg-orange-500/20"
              disabled={!athleteId}
              title={!athleteId ? t("importNeedsAthlete") : t("startPointImportHint")}
              onClick={() => setStartPointModal("import")}
            >
              {t("startPointImport")}
            </Pro2Button>
          </div>
        </div>

        {/* Esito import: mostrato in pagina (il modale si chiude a import riuscito). */}
        {structuredImportOk ? <p className="text-sm text-emerald-200/90">{structuredImportOk}</p> : null}

        {/* Modale «Genera sessione»: stessa sezione motore di prima con i suoi input e
            azione; runGenerateFromModal chiude l'overlay alla generazione riuscita. */}
        <BuilderStartPointModal
          open={startPointModal === "generate"}
          title={t("startPointGenerate")}
          closeLabel={t("modalClose")}
          onClose={closeStartPointModal}
        >
          <BuilderEngineGenerateSection
            activeMacroId={activeMacroId}
          currentSportLabel={currentSportLabel}
          athleteId={athleteId}
          genBusy={genBusy}
          runGenerate={runGenerateFromModal}
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
          hideSaveBar
          />
        </BuilderStartPointModal>

        {/* Modale «Seleziona dalla mia libreria»: il picker coach aperto nell'overlay.
            Caricando un template (onLoadInBuilder) chiude e porta la seduta nell'editor;
            «Applica» salva in calendario e chiude. */}
        <BuilderStartPointModal
          open={startPointModal === "library"}
          title={t("pickFromLibrary")}
          closeLabel={t("modalClose")}
          onClose={closeStartPointModal}
        >
          <CoachWorkoutLibraryPanel
            athleteId={athleteId}
            targetDate={plannedDate}
            contractToSave={libraryContractToSave}
            saveTitle={manualSessionName.trim() || undefined}
            onApplied={() => {
              setCalendarRefresh((n) => n + 1);
              setStartPointModal(null);
            }}
            onLoadInBuilder={loadLibraryContractFromModal}
            open
          />
        </BuilderStartPointModal>

        {/* Modale «Importa FIT/ZWO/ERG»: flusso file esistente; a import riuscito
            chiude (handleStructuredWorkoutImportFromModal), l'errore resta nel modale. */}
        <BuilderStartPointModal
          open={startPointModal === "import"}
          title={t("startPointImport")}
          closeLabel={t("modalClose")}
          onClose={closeStartPointModal}
        >
          <p className="text-sm text-gray-300">{t("startPointImportHint")}</p>
          <input
            ref={importStructuredInputRef}
            type="file"
            accept=".fit,.fit.gz,.gz,.zwo,.erg,.mrc"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              void handleStructuredWorkoutImportFromModal(f);
              e.target.value = "";
            }}
          />
          <Pro2Button
            type="button"
            variant="primary"
            disabled={!athleteId || structuredImportBusy}
            title={!athleteId ? t("importNeedsAthlete") : t("startPointImportHint")}
            onClick={() => importStructuredInputRef.current?.click()}
          >
            {structuredImportBusy ? t("importBusy") : t("startPointImport")}
          </Pro2Button>
          {structuredImportErr ? (
            <p className="text-sm text-amber-300" role="alert">
              {structuredImportErr}
            </p>
          ) : null}
        </BuilderStartPointModal>

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
          hideSaveBar
        />

        {/* [4] Salva UNICO: l'editor «Rifinisci» è la fonte di verità (Genera e i
            template lo popolano), quindi qui c'è un solo salvataggio per tutte le
            famiglie — via saveManualToCalendar — più il push Wahoo. */}
        <section
          aria-label={t("saveBarSave")}
          className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-950/20 to-black/50 p-4 sm:p-5"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-orange-400/45 bg-orange-500/25 text-sm font-black text-orange-100">
              4
            </span>
            <p className="text-sm font-bold text-white">
              {t.rich("saveLine", {
                muted: (chunks) => <span className="font-normal text-gray-400">{chunks}</span>,
              })}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              {t("saveBarDate")}
              <input
                type="date"
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              {t("saveBarTime")}
              <input
                type="time"
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </label>
            <Pro2Button
              type="button"
              variant="primary"
              disabled={!athleteId || !manualSession || manualSaveBusy || !scheduledTime}
              onClick={() => void saveManualToCalendar(plannedDate)}
            >
              {manualSaveBusy ? t("saveBarSaving") : t("saveBarSave")}
            </Pro2Button>
          </div>
          {/* [2] Seconda azione nello STESSO box: salva la seduta corrente nella
              libreria coach con un nome, riusabile poi come punto di partenza. */}
          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-white/10 pt-4">
            <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs text-gray-500">
              {t("saveBarLibraryName")}
              <input
                type="text"
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                placeholder={t("saveBarLibraryNamePlaceholder")}
                value={libName}
                onChange={(e) => setLibName(e.target.value)}
              />
            </label>
            <Pro2Button
              type="button"
              variant="secondary"
              className="!border-orange-500/30 !bg-orange-500/10 !text-orange-100 hover:!border-orange-400/50 hover:!bg-orange-500/20"
              disabled={!athleteId || !libraryContractToSave || libSaveBusy}
              onClick={() => void saveToLibrary()}
            >
              {libSaveBusy ? t("saveBarLibrarySaving") : t("saveBarLibrarySave")}
            </Pro2Button>
          </div>
          {!manualSession ? <p className="mt-3 text-xs text-gray-500">{t("saveBarEmpty")}</p> : null}
          {manualSaveErr ? (
            <p className="mt-3 text-sm text-amber-300" role="alert">
              {manualSaveErr}
            </p>
          ) : null}
          {libSaveErr ? (
            <p className="mt-3 text-sm text-amber-300" role="alert">
              {libSaveErr}
            </p>
          ) : null}
          {libSaveOk ? <p className="mt-3 text-sm text-emerald-200/90">{libSaveOk}</p> : null}
          {manualSaveOkId ? (
            <div className="mt-3">
              <BuilderCalendarSaveConfirm date={plannedDate} plannedWorkoutId={manualSaveOkId} />
            </div>
          ) : null}
        </section>

        <BuilderUpcomingPlannedSection
          ctxLoading={ctxLoading}
          loading={loading}
          err={err}
          showData={showData}
          upcoming={upcoming}
          executed={executed}
        />
    </Pro2ModulePageShell>
  );
}
