"use client";

import { ChevronLeft, ChevronRight, Target } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { addIsoDays, mondayOfIsoWeek } from "@/lib/dates/iso-day-arithmetic";
import { COACH_APPLICATION_EVIDENCE_SOURCE } from "@/lib/memory/coach-application-traces";
import type { TrainingPlannerContextViewModel } from "@/api/training/contracts";
import {
  serializePro2BuilderSessionContract,
  type Pro2BuilderBlockContract,
  type Pro2BuilderSessionContract,
} from "@/lib/training/builder/pro2-session-contract";
import {
  buildPro2BlockSessionContract,
  mapEngineSessionToTrainingBlocks,
  scaleTrainingBlock,
  summarizeBlocks,
} from "@/lib/training/builder/engine-blocks-to-session-contract";
import { finalizeViryaPro2ContractAsBuilderFile } from "@/lib/training/builder/finalize-virya-pro2-contract-as-builder-file";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import { getLifestyleProtocolMediaUrl, getLifestyleProtocolsForDiscipline, getTechnicalDrillMediaUrl, getTechnicalDrillsForDiscipline, LIFESTYLE_PROTOCOL_LIBRARY, TEAM_SPORT_DRILL_LIBRARY, type LifestyleProtocol, type TechnicalDrill } from "@/lib/training/libraries";
import { loadLifestyleProtocolsClient, loadTechnicalDrillsClient } from "@/lib/training/libraries-client";
import type { AdaptationTarget, SessionGoalRequest, TrainingDomain } from "@/lib/training/engine";
import type { BuilderSessionOperationalScalingViewModel } from "@/api/training/contracts";
import { materializeViryaGymBuilderSession } from "@/lib/training/virya/materialize-virya-gym-builder-session";
import { isGenericViryaPlanName, suggestedViryaPlanName, viryaPlanTag } from "@/lib/training/virya/virya-plan-name";
import { resolveAerobicViryaPrescription } from "@/lib/training/engine/aerobic-virya-prescription";
import { materializeViryaAerobicFromCatalog } from "@/lib/training/virya/materialize-virya-aerobic-from-catalog";
import { loadAerobicStarterPresetsClient } from "@/lib/training/library/aerobic-starter-presets-client";
import { generateBuilderSession } from "@/modules/training/services/training-engine-api";
import { importViryaWeekToLibrary } from "@/modules/training/services/training-library-api";
import { fetchViryaCalendarPlans, replaceTrainingPlannerCalendar, type ViryaCalendarPlanSummary } from "@/modules/training/services/training-planned-api";
import { activeGymModulesForWeek, buildGymDayModules, ensureGymWeekModules, formatGymDistrictsLabel, gymModuleDistricts, type GymDayModule } from "@/lib/training/virya/gym-day-modules";
import { buildViryaBuilderSessionBrief } from "@/lib/training/virya/build-virya-session-brief";
import {
  deriveViryaBuilderInstructions,
  formatViryaBriefMetaLine,
  weekdayLabel,
  type ViryaDerivedBuilderInstructions,
} from "@/lib/training/virya/derive-virya-builder-instructions";
import type { ViryaMacroPhase, ViryaWeekdayPatternId } from "@/lib/training/virya/virya-builder-session-brief";
import {
  buildWeekGenerationPlan,
  defaultWeekdayPatternForSessions,
} from "@/lib/training/virya/virya-microcycle-planner";
import type {
  LifestyleDayModule,
  TechnicalDayModule,
} from "@/lib/training/virya/virya-day-module-types";
import { PhaseType, WeekObjectiveKey, ViryaRetuneProposalWeek, ViryaRetuneProposal, SportFamily, GymPrimaryGoal, GymMacroObjective, PhasePlan, RacePlan, MultiSportTarget, phaseLabels, sportFamilies, isoToday, addDays, weeksBetween, planWindowEndForWeeks, aerobicPhasesMatchWindow, clamp, demandScore, targetSummary, emptyTargetSport, aggregateGoalTargets, buildAerobicClassicPhases, defaultPhases, phasesCoverGymWindow, buildTechnicalDayModules, buildLifestyleDayModules, buildGymMacroPhases, DEFAULT_AEROBIC_PLAN_WEEKS } from "@/lib/training/virya/virya-annual-plan-kit";
import { ViryaHeroHeader } from "@/modules/training/views/sections/ViryaHeroHeader";
import { ViryaStatusBanners } from "@/modules/training/views/sections/ViryaStatusBanners";
import { ViryaPhaseRecapGrid } from "@/modules/training/views/sections/ViryaPhaseRecapGrid";
import { ViryaAnnualLoadProjectionCard } from "@/modules/training/views/sections/ViryaAnnualLoadProjectionCard";
import { ViryaMasterPlanCard } from "@/modules/training/views/sections/ViryaMasterPlanCard";
import { ViryaAerobicNote } from "@/modules/training/views/sections/ViryaAerobicNote";
import { ViryaStrengthConfigBlock } from "@/modules/training/views/sections/ViryaStrengthConfigBlock";
import { ViryaTechnicalConfigBlock } from "@/modules/training/views/sections/ViryaTechnicalConfigBlock";
import { ViryaLifestyleConfigBlock } from "@/modules/training/views/sections/ViryaLifestyleConfigBlock";
import { ViryaApprovedDecisionsCard } from "@/modules/training/views/sections/ViryaApprovedDecisionsCard";
import { ViryaWeeklyProgramTable } from "@/modules/training/views/sections/ViryaWeeklyProgramTable";
import { ViryaMicrocyclePreviewCard } from "@/modules/training/views/sections/ViryaMicrocyclePreviewCard";
import { ViryaSaveToCalendarCard } from "@/modules/training/views/sections/ViryaSaveToCalendarCard";
import { ViryaSaveWeekToLibraryCard } from "@/modules/training/views/sections/ViryaSaveWeekToLibraryCard";
import { ViryaCalendarPlansCard } from "@/modules/training/views/sections/ViryaCalendarPlansCard";
import { ViryaMacroFamilyStep } from "@/modules/training/views/sections/ViryaMacroFamilyStep";
import { ViryaSportDisciplineStep } from "@/modules/training/views/sections/ViryaSportDisciplineStep";
import { ViryaPlanPeriodStep } from "@/modules/training/views/sections/ViryaPlanPeriodStep";
import { ViryaSeasonObjectiveStep } from "@/modules/training/views/sections/ViryaSeasonObjectiveStep";
import { ViryaEventsCard } from "@/modules/training/views/sections/ViryaEventsCard";
import { ViryaMacroPeriodsCard } from "@/modules/training/views/sections/ViryaMacroPeriodsCard";
import { ViryaContextKpiCard } from "@/modules/training/views/sections/ViryaContextKpiCard";
import { ViryaOperationalModulationCard } from "@/modules/training/views/sections/ViryaOperationalModulationCard";
import { ViryaPhasesTable } from "@/modules/training/views/sections/ViryaPhasesTable";


export type ViryaAnnualPlanOrchestratorProps = {
  athleteId: string | null;
  viryaContext: TrainingPlannerContextViewModel | null;
  contextLoading: boolean;
};

export function ViryaAnnualPlanOrchestrator({
  athleteId: selectedAthleteId,
  viryaContext,
  contextLoading,
}: ViryaAnnualPlanOrchestratorProps) {
  const start = isoToday();
  const [planName, setPlanName] = useState("EMPATHY Annual Strategy");
  const [sportFamily, setSportFamily] = useState<SportFamily>("aerobic");
  const [discipline, setDiscipline] = useState("Ciclismo");
  const [objective, setObjective] = useState("Miglioramento performance metabolica con doppio picco");
  const [sportTargets, setSportTargets] = useState<MultiSportTarget[]>([
    { ...emptyTargetSport("Ciclismo"), loadSharePct: 100 },
    emptyTargetSport(""),
    emptyTargetSport(""),
  ]);
  const [gymPrimaryGoal, setGymPrimaryGoal] = useState<GymPrimaryGoal>("forza");
  const [gymPlanStart, setGymPlanStart] = useState(start);
  const [gymPlanEnd, setGymPlanEnd] = useState(addDays(start, 364));
  const [gymMacroPhaseCount, setGymMacroPhaseCount] = useState(4);
  const [gymTrainingDaysPerWeek, setGymTrainingDaysPerWeek] = useState(5);
  const [viryaWeekdayPattern, setViryaWeekdayPattern] = useState<"auto" | ViryaWeekdayPatternId>("auto");
  const [gymDayModules, setGymDayModules] = useState<GymDayModule[]>(() => buildGymDayModules());
  const [viryaCalendarPlans, setViryaCalendarPlans] = useState<ViryaCalendarPlanSummary[]>([]);
  const [viryaPlansLoading, setViryaPlansLoading] = useState(false);
  const [viryaPlanDeletingTag, setViryaPlanDeletingTag] = useState<string | null>(null);
  const [technicalPlanStart, setTechnicalPlanStart] = useState(start);
  const [technicalPlanEnd, setTechnicalPlanEnd] = useState(addDays(start, 364));
  const [technicalMacroPhaseCount, setTechnicalMacroPhaseCount] = useState(4);
  const [technicalTrainingDaysPerWeek, setTechnicalTrainingDaysPerWeek] = useState(5);
  const [technicalDayModules, setTechnicalDayModules] = useState<TechnicalDayModule[]>(buildTechnicalDayModules(5));
  const [lifestylePlanStart, setLifestylePlanStart] = useState(start);
  const [lifestylePlanEnd, setLifestylePlanEnd] = useState(addDays(start, 364));
  const [lifestyleMacroPhaseCount, setLifestyleMacroPhaseCount] = useState(4);
  const [lifestyleTrainingDaysPerWeek, setLifestyleTrainingDaysPerWeek] = useState(5);
  const [lifestyleDayModules, setLifestyleDayModules] = useState<LifestyleDayModule[]>(buildLifestyleDayModules(5));
  const [selectedGymWeekStart, setSelectedGymWeekStart] = useState<string>("");
  const [selectedTechnicalWeekStart, setSelectedTechnicalWeekStart] = useState<string>("");
  const [selectedLifestyleWeekStart, setSelectedLifestyleWeekStart] = useState<string>("");
  const [phases, setPhases] = useState<PhasePlan[]>(() => {
    const end = defaultPhases(start)[3]?.end ?? addDays(start, 154);
    return buildAerobicClassicPhases(start, end);
  });
  const [races, setRaces] = useState<RacePlan[]>([
    { id: crypto.randomUUID(), date: addDays(start, 70), name: "Gara test #1", raceType: "test", priority: "B" },
    { id: crypto.randomUUID(), date: addDays(start, 150), name: "Gara obiettivo", raceType: "goal", priority: "A" },
  ]);
  const [gymWeekCustomizations, setGymWeekCustomizations] = useState<
    Record<string, { sessionsPerWeek: number; loadPct: number; modules: GymDayModule[] }>
  >({});
  const [technicalWeekCustomizations, setTechnicalWeekCustomizations] = useState<
    Record<string, { sessionsPerWeek: number; loadPct: number; modules: TechnicalDayModule[] }>
  >({});
  const [lifestyleWeekCustomizations, setLifestyleWeekCustomizations] = useState<
    Record<string, { sessionsPerWeek: number; loadPct: number; modules: LifestyleDayModule[] }>
  >({});
  const [replacePrevious, setReplacePrevious] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLibrary, setSavingLibrary] = useState(false);
  const [libraryWeekStart, setLibraryWeekStart] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [viryaStep, setViryaStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [adaptationControlPct, setAdaptationControlPct] = useState<0 | 50 | 70 | 100>(100);
  const [planWindowStart, setPlanWindowStart] = useState(start);
  const [planWindowEnd, setPlanWindowEnd] = useState(() => planWindowEndForWeeks(start, DEFAULT_AEROBIC_PLAN_WEEKS));
  const [weeklyProgramOverrides, setWeeklyProgramOverrides] = useState<
    Record<
      string,
      {
        weeklyTss?: number;
        sessionsPerWeek?: number;
        hoursPerWeek?: number;
        objectives?: WeekObjectiveKey[];
      }
    >
  >({});

  const [technicalDrills, setTechnicalDrills] = useState<TechnicalDrill[]>(TEAM_SPORT_DRILL_LIBRARY);
  const [lifestyleProtocols, setLifestyleProtocols] = useState<LifestyleProtocol[]>(LIFESTYLE_PROTOCOL_LIBRARY);
  useEffect(() => {
    loadTechnicalDrillsClient().then(setTechnicalDrills).catch(() => {});
    loadLifestyleProtocolsClient().then(setLifestyleProtocols).catch(() => {});
  }, []);

  const familySports = sportFamilies.find((f) => f.id === sportFamily)?.sports ?? [];
  const defaultTechnicalDrill = useMemo(() => getTechnicalDrillsForDiscipline(discipline, technicalDrills)[0] ?? null, [discipline, technicalDrills]);
  const defaultLifestyleProtocol = useMemo(() => getLifestyleProtocolsForDiscipline(discipline, lifestyleProtocols)[0] ?? null, [discipline, lifestyleProtocols]);
  const operationalContext = viryaContext?.operationalContext ?? null;
  const recoverySummary = viryaContext?.recoverySummary ?? null;
  const adaptationLoop = viryaContext?.adaptationLoop ?? null;
  const bioenergeticModulation = viryaContext?.bioenergeticModulation ?? null;
  const viryaApprovedPatches = viryaContext?.viryaApprovedPatches ?? [];
  const viryaRetuneDirective = viryaContext?.viryaRetuneDirective ?? null;
  const viryaRetuneProposalVm = viryaContext?.viryaRetuneProposal ?? null;

  const planWindowWeekCount = useMemo(() => {
    const ws = planWindowStart.trim();
    const we = planWindowEnd.trim();
    if (!ws || !we) return 0;
    return weeksBetween(ws, we);
  }, [planWindowStart, planWindowEnd]);

  const annualProjection = useMemo(() => {
    const weeks: {
      week: number;
      weekStart: string;
      tss: number;
      phase: string;
      phaseType: PhaseType;
      sessions: number;
    }[] = [];
    let idx = 1;
    for (const p of phases) {
      const wc = weeksBetween(p.start, p.end);
      for (let w = 0; w < wc; w += 1) {
        const weekStart = addDays(p.start, w * 7);
        const progressive = p.phase === "build" ? 1 + Math.min(0.14, w * 0.02) : 1;
        const taper = p.phase === "peak" || p.phase === "deload" ? Math.max(0.68, 1 - w * 0.08) : 1;
        const baseTss = Math.round(p.weeklyTss * progressive * taper);
        const custom =
          sportFamily === "strength"
            ? gymWeekCustomizations[weekStart]
            : sportFamily === "technical"
              ? technicalWeekCustomizations[weekStart]
              : sportFamily === "lifestyle"
                ? lifestyleWeekCustomizations[weekStart]
              : undefined;
        const loadPct = custom ? clamp(custom.loadPct, 50, 180) : 100;
        const finalTss = Math.round(baseTss * (loadPct / 100));
        weeks.push({
          week: idx,
          weekStart,
          tss: finalTss,
          phase: phaseLabels[p.phase],
          phaseType: p.phase,
          sessions: custom?.sessionsPerWeek ?? p.sessionsPerWeek,
        });
        idx += 1;
      }
    }
    const ws = planWindowStart.trim();
    const we = planWindowEnd.trim();
    if (!ws || !we) return weeks;
    const inWindow = weeks.filter((row) => row.weekStart >= ws && row.weekStart <= we);
    return inWindow.map((row, i) => ({ ...row, week: i + 1 }));
  }, [
    phases,
    sportFamily,
    gymWeekCustomizations,
    technicalWeekCustomizations,
    lifestyleWeekCustomizations,
    planWindowStart,
    planWindowEnd,
  ]);

  const baseProgramWeekRows = useMemo(
    () =>
      annualProjection.map((row) => {
        const o = weeklyProgramOverrides[row.weekStart];
        return {
          ...row,
          displayTss: o?.weeklyTss ?? row.tss,
          displaySessions: o?.sessionsPerWeek ?? row.sessions,
          hoursPerWeek: o?.hoursPerWeek,
          objectives: o?.objectives ?? [],
        };
      }),
    [annualProjection, weeklyProgramOverrides],
  );

  const goalTargets = useMemo(() => aggregateGoalTargets(sportTargets), [sportTargets]);
  const physiologyDrive = useMemo(() => {
    const physiology = viryaContext?.physiologyState;
    const twin = viryaContext?.twinState;
    return {
      ftp: physiology?.physiologicalProfile.ftpWatts ?? null,
      vLamax: physiology?.metabolicProfile.vLamax ?? physiology?.physiologicalProfile.vLamax ?? null,
      oxidativeBottleneck: physiology?.performanceProfile.oxidativeBottleneckIndex ?? null,
      gutDelivery: physiology?.lactateProfile.bloodDeliveryPctOfIngested ?? null,
      coriReturn: physiology?.lactateProfile.glucoseFromCoriG ?? null,
      glycogen: twin?.glycogenStatus ?? null,
      readiness: twin?.readiness ?? null,
    };
  }, [viryaContext]);
  const viryaRetuneProposal = useMemo<ViryaRetuneProposal | null>(() => {
    if (!viryaRetuneDirective || !baseProgramWeekRows.length) return null;
    const today = isoToday();
    const currentIndex = baseProgramWeekRows.findIndex((row) => today >= row.weekStart && today <= addDays(row.weekStart, 6));
    const startIndex = currentIndex >= 0 ? currentIndex : Math.max(0, baseProgramWeekRows.findIndex((row) => row.weekStart >= today));
    if (startIndex < 0) return null;
    const mode = viryaRetuneDirective.recommendedMode;
    const weekCount = mode === "regeneration_microcycle" || mode === "load_reduction_retune" ? 2 : 1;
    const fullLoadFactor =
      mode === "regeneration_microcycle" ? 0.62 : mode === "load_reduction_retune" ? 0.78 : mode === "fueling_supported_retune" ? 0.94 : 1;
    const control = adaptationControlPct / 100;
    const loadFactor = 1 - (1 - fullLoadFactor) * control;
    const fullSessionDelta = mode === "regeneration_microcycle" ? -2 : mode === "load_reduction_retune" ? -1 : 0;
    const sessionDelta = Math.round(fullSessionDelta * control);
    const objectives: WeekObjectiveKey[] =
      mode === "regeneration_microcycle"
        ? ["recupero", "aerobico"]
        : mode === "load_reduction_retune"
          ? ["recupero"]
          : mode === "fueling_supported_retune"
            ? ["aerobico"]
            : [];
    const targetWeeks = baseProgramWeekRows.slice(startIndex, startIndex + weekCount).map((row): ViryaRetuneProposalWeek => {
      const proposedTss = Math.round(clamp(row.displayTss * loadFactor, 80, Math.max(120, row.displayTss)));
      const proposedSessions = Math.round(clamp(row.displaySessions + sessionDelta, 1, Math.max(1, row.displaySessions)));
      const nextObjectives = Array.from(new Set([...(row.objectives ?? []), ...objectives]));
      return {
        weekStart: row.weekStart,
        week: row.week,
        phase: row.phase,
        currentTss: row.displayTss,
        proposedTss,
        currentSessions: row.displaySessions,
        proposedSessions,
        objectives: nextObjectives,
        rationale: [
          `Directive ${mode.replaceAll("_", " ")}.`,
          `Coach adaptation control ${adaptationControlPct}%.`,
          `TSS ${row.displayTss} -> ${proposedTss}; sedute ${row.displaySessions} -> ${proposedSessions}.`,
          "Adattamento automatico nel programma VIRYA; Calendar viene scritto solo dal comando Salva.",
        ],
      };
    });
    return {
      mode,
      status: targetWeeks.length ? "automatic" : "idle",
      targetWeeks,
      adaptationControlPct,
      approvalPolicy: "automatic_by_data_with_coach_policy",
    };
  }, [adaptationControlPct, baseProgramWeekRows, viryaRetuneDirective]);

  const programWeekRows = useMemo(
    () =>
      baseProgramWeekRows.map((row) => {
        const autoRetune = adaptationControlPct > 0 ? viryaRetuneProposal?.targetWeeks.find((week) => week.weekStart === row.weekStart) : null;
        return autoRetune
          ? {
              ...row,
              displayTss: autoRetune.proposedTss,
              displaySessions: autoRetune.proposedSessions,
              objectives: autoRetune.objectives,
            }
          : row;
      }),
    [adaptationControlPct, baseProgramWeekRows, viryaRetuneProposal],
  );

  useEffect(() => {
    if (!programWeekRows.length) return;
    if (libraryWeekStart && programWeekRows.some((r) => r.weekStart === libraryWeekStart)) return;
    setLibraryWeekStart(programWeekRows[0]!.weekStart);
  }, [libraryWeekStart, programWeekRows]);

  const annualLoadWeekCap = planWindowWeekCount > 0 ? planWindowWeekCount : 52;
  const annualLoad = programWeekRows.slice(0, annualLoadWeekCap).map((w) => w.displayTss);
  while (annualLoad.length < annualLoadWeekCap) annualLoad.push(0);
  const maxAnnual = Math.max(...annualLoad, 1);

  const totalSessions = programWeekRows.reduce((sum, w) => sum + w.displaySessions, 0);
  const totalTss = programWeekRows.reduce((sum, w) => sum + w.displayTss, 0);
  const strengthPhaseLoadHints = useMemo(() => {
    if (sportFamily !== "strength") return new Map<string, { avgLoad: number; avgSessions: number }>();
    const map = new Map<string, { avgLoad: number; avgSessions: number }>();
    for (const p of phases) {
      const weeks = programWeekRows.filter((w) => w.weekStart >= p.start && w.weekStart <= p.end);
      if (!weeks.length) continue;
      map.set(p.id, {
        avgLoad: Math.round(weeks.reduce((s, w) => s + w.displayTss, 0) / weeks.length),
        avgSessions: Math.round(weeks.reduce((s, w) => s + w.displaySessions, 0) / weeks.length),
      });
    }
    return map;
  }, [sportFamily, phases, programWeekRows]);
  const objectiveDemand = useMemo(() => {
    if (sportFamily === "strength") {
      const daysFactor = clamp(gymTrainingDaysPerWeek / 5, 0.7, 1.35);
      const uniqueTypes = new Set(gymDayModules.map((m) => m.exerciseType).filter(Boolean)).size;
      const modeFactor = clamp(1 + (Math.max(1, uniqueTypes) - 1) * 0.06, 1, 1.24);
      const goalFactor =
        gymPrimaryGoal === "potenza" || gymPrimaryGoal === "rapidita"
          ? 1.1
          : gymPrimaryGoal === "forza"
            ? 1.08
            : gymPrimaryGoal === "massa"
              ? 1.05
              : gymPrimaryGoal === "resistenza"
                ? 1.0
                : 0.95;
      return clamp(1.0 * daysFactor * modeFactor * goalFactor, 0.5, 2.1);
    }
    if (sportFamily === "technical") {
      const daysFactor = clamp(technicalTrainingDaysPerWeek / 5, 0.75, 1.35);
      const objectiveVariety = Math.max(1, new Set(technicalDayModules.flatMap((m) => m.objectives)).size);
      const objectiveFactor = clamp(1 + (objectiveVariety - 1) * 0.02, 1, 1.22);
      const intensityFactor = clamp(
        technicalDayModules.reduce((acc, m) => acc + (m.intensity === "Massimale" ? 1.2 : m.intensity === "Alta" ? 1.1 : m.intensity === "Media" ? 1.0 : 0.9), 0) /
          Math.max(1, technicalDayModules.length),
        0.85,
        1.2,
      );
      return clamp(1.0 * daysFactor * objectiveFactor * intensityFactor, 0.5, 2.1);
    }
    if (sportFamily === "lifestyle") {
      const daysFactor = clamp(lifestyleTrainingDaysPerWeek / 5, 0.75, 1.3);
      const avgRpe =
        lifestyleDayModules.reduce((acc, m) => acc + clamp(m.intensityRpe, 1, 10), 0) / Math.max(1, lifestyleDayModules.length);
      const rpeFactor = clamp(avgRpe / 4.5, 0.7, 1.25);
      const variety = Math.max(1, new Set(lifestyleDayModules.map((m) => m.practiceType)).size);
      const varietyFactor = clamp(1 + (variety - 1) * 0.03, 1, 1.2);
      return clamp(0.95 * daysFactor * rpeFactor * varietyFactor, 0.45, 1.9);
    }
    const active = sportTargets.filter((t) => (t.sport ?? "").trim() !== "");
    if (!active.length) return demandScore(goalTargets);
    const sumShares = active.reduce((s, t) => s + Math.max(0, t.loadSharePct ?? 0), 0);
    const weighted = active.reduce((acc, t) => {
      const localDemand = demandScore({
        distanceKm: t.distanceKm,
        durationMin: t.durationMin,
        speedAvgKmh: t.speedAvgKmh,
        powerAvgW: t.powerAvgW,
        elevationM: t.elevationM,
        workKj: t.workKj,
      });
      const w = sumShares > 0 ? Math.max(0, t.loadSharePct ?? 0) / sumShares : 1 / active.length;
      return acc + localDemand * w;
    }, 0);
    return clamp(weighted, 0.25, 1.9);
  }, [sportFamily, gymTrainingDaysPerWeek, gymDayModules, gymPrimaryGoal, technicalTrainingDaysPerWeek, technicalDayModules, lifestyleTrainingDaysPerWeek, lifestyleDayModules, sportTargets, goalTargets]);
  const goalSummary = useMemo(() => targetSummary(goalTargets), [goalTargets]);
  const goalRaceDate = useMemo(() => {
    const sorted = [...races]
      .filter((r) => r.raceType === "goal")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return sorted[0]?.date ?? null;
  }, [races]);
  const sportFamilyLabel = useMemo(
    () => sportFamilies.find((option) => option.id === sportFamily)?.label.split("·")[1]?.trim() ?? sportFamilies.find((option) => option.id === sportFamily)?.label ?? sportFamily,
    [sportFamily],
  );
  const viryaHeroStats = useMemo(
    () => [
      { label: "Family", value: sportFamilyLabel },
      { label: "Discipline", value: discipline },
      { label: "Phases", value: String(phases.length) },
      { label: `Carico annuo`, value: String(totalTss) },
    ],
    [discipline, phases.length, sportFamilyLabel, totalTss],
  );
  const viryaSummaryCards = useMemo<
    Array<{ label: string; value: string; tone: "cyan" | "green" | "amber" | "rose" | "slate" }>
  >(
    () => [
      { label: "Goal date", value: goalRaceDate ? new Date(`${goalRaceDate}T00:00:00`).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "Open", tone: "amber" },
      { label: "Sessions", value: String(totalSessions), tone: "cyan" },
      { label: "Demand", value: objectiveDemand.toFixed(2), tone: objectiveDemand >= 1.2 ? "rose" : objectiveDemand >= 0.9 ? "amber" : "green" },
      { label: "Readiness", value: physiologyDrive.readiness != null ? `${physiologyDrive.readiness.toFixed(0)}%` : "—", tone: "green" },
      { label: "Bioenergetica", value: bioenergeticModulation ? `${bioenergeticModulation.mitochondrialReadinessScore}/100` : "—", tone: bioenergeticModulation?.state === "protective" ? "rose" : bioenergeticModulation?.state === "watch" ? "amber" : "cyan" },
      { label: "Loop", value: adaptationLoop ? adaptationLoop.status : "stable", tone: adaptationLoop?.status === "regenerate" ? "rose" : adaptationLoop?.status === "watch" ? "amber" : "slate" },
    ],
    [adaptationLoop, bioenergeticModulation, goalRaceDate, objectiveDemand, physiologyDrive.readiness, totalSessions],
  );

  useEffect(() => {
    const sport1 = (sportTargets[0]?.sport ?? "").trim();
    if (sport1 && sport1 !== discipline) setDiscipline(sport1);
  }, [sportTargets, discipline]);

  useEffect(() => {
    setPlanName((prev) => (isGenericViryaPlanName(prev) ? suggestedViryaPlanName(sportFamily, discipline) : prev));
  }, [sportFamily, discipline]);

  useEffect(() => {
    setGymDayModules((prev) => ensureGymWeekModules(prev));
  }, []);

  const refreshViryaCalendarPlans = useCallback(async () => {
    if (!selectedAthleteId) {
      setViryaCalendarPlans([]);
      return;
    }
    setViryaPlansLoading(true);
    try {
      const plans = await fetchViryaCalendarPlans(selectedAthleteId);
      setViryaCalendarPlans(plans);
    } catch {
      setViryaCalendarPlans([]);
    } finally {
      setViryaPlansLoading(false);
    }
  }, [selectedAthleteId]);

  useEffect(() => {
    void refreshViryaCalendarPlans();
  }, [refreshViryaCalendarPlans]);

  useEffect(() => {
    setTechnicalDayModules((prev) => {
      const target = Math.max(1, Math.min(7, technicalTrainingDaysPerWeek));
      if (prev.length === target) return prev;
      const next = prev.slice(0, target);
      while (next.length < target) {
        const day = next.length + 1;
        next.push({
          dayIndex: day,
          objectives: day % 2 === 0 ? ["Fase offensiva", "Schemi"] : ["Condizione fisica", "Tecnica con modulo"],
          exerciseType: day % 2 === 0 ? "Lavoro tattico a reparti" : "Small sided game",
          intensity: day % 2 === 0 ? "Media" : "Alta",
          methodology: "Progressivo",
        });
      }
      return next;
    });
  }, [technicalTrainingDaysPerWeek]);

  useEffect(() => {
    setLifestyleDayModules((prev) => {
      const target = Math.max(1, Math.min(7, lifestyleTrainingDaysPerWeek));
      if (prev.length === target) return prev;
      const next = prev.slice(0, target);
      while (next.length < target) {
        const day = next.length + 1;
        next.push({
          dayIndex: day,
          objective: day % 2 === 0 ? "Mobilita articolare" : "Recupero autonomico",
          practiceType: day % 2 === 0 ? "Yoga Hatha" : "Pilates Mat",
          intensityRpe: 3,
          breathingCadence: "Naso 5:5",
          holdOrFlow: "Tenute 20-40s",
          methodology: "Rigenerativo",
        });
      }
      return next;
    });
  }, [lifestyleTrainingDaysPerWeek]);

  useEffect(() => {
    if (sportFamily !== "strength") return;
    const firstWeekStart = annualProjection[0]?.weekStart ?? "";
    if (!selectedGymWeekStart && firstWeekStart) {
      setSelectedGymWeekStart(firstWeekStart);
    } else if (
      selectedGymWeekStart &&
      !annualProjection.some((w) => w.weekStart === selectedGymWeekStart)
    ) {
      setSelectedGymWeekStart(firstWeekStart);
    }
  }, [sportFamily, annualProjection, selectedGymWeekStart]);

  useEffect(() => {
    if (sportFamily !== "technical") return;
    const firstWeekStart = annualProjection[0]?.weekStart ?? "";
    if (!selectedTechnicalWeekStart && firstWeekStart) {
      setSelectedTechnicalWeekStart(firstWeekStart);
    } else if (
      selectedTechnicalWeekStart &&
      !annualProjection.some((w) => w.weekStart === selectedTechnicalWeekStart)
    ) {
      setSelectedTechnicalWeekStart(firstWeekStart);
    }
  }, [sportFamily, annualProjection, selectedTechnicalWeekStart]);

  useEffect(() => {
    if (sportFamily !== "lifestyle") return;
    const firstWeekStart = annualProjection[0]?.weekStart ?? "";
    if (!selectedLifestyleWeekStart && firstWeekStart) {
      setSelectedLifestyleWeekStart(firstWeekStart);
    } else if (
      selectedLifestyleWeekStart &&
      !annualProjection.some((w) => w.weekStart === selectedLifestyleWeekStart)
    ) {
      setSelectedLifestyleWeekStart(firstWeekStart);
    }
  }, [sportFamily, annualProjection, selectedLifestyleWeekStart]);

  useEffect(() => {
    if (sportFamily !== "aerobic") return;
    const s = planWindowStart.trim();
    const e = planWindowEnd.trim();
    if (!s || !e || new Date(e) < new Date(s)) return;
    if (aerobicPhasesMatchWindow(phases, s, e)) return;
    const next = buildAerobicClassicPhases(s, e);
    if (next.length) setPhases(next);
  }, [sportFamily, planWindowStart, planWindowEnd, phases]);

  function updatePhase(id: string, patch: Partial<PhasePlan>) {
    setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function addPhase() {
    const last = phases[phases.length - 1];
    const newStart = last ? addDays(last.end, 1) : start;
    setPhases((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        start: newStart,
        end: addDays(newStart, 27),
        phase: "base",
        macroObjective:
          sportFamily === "strength"
            ? gymPrimaryGoal
            : sportFamily === "technical"
              ? "tecnico_tattico"
              : sportFamily === "lifestyle"
                ? "lifestyle_balance"
                : undefined,
        mesocycle: `M${prev.length + 1}`,
        weeklyTss: 450,
        sessionsPerWeek: 6,
        notes: "",
      },
    ]);
  }

  function removePhase(id: string) {
    setPhases((prev) => prev.filter((p) => p.id !== id));
  }

  function addRace() {
    setRaces((prev) => [...prev, { id: crypto.randomUUID(), date: addDays(start, 21), name: "Nuova gara", raceType: "warmup", priority: "C" }]);
  }

  function updateRace(id: string, patch: Partial<RacePlan>) {
    setRaces((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRace(id: string) {
    setRaces((prev) => prev.filter((r) => r.id !== id));
  }

  function setSportTargetValue(index: number, key: keyof MultiSportTarget, value: string) {
    setSportTargets((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        if (key === "sport") return { ...t, sport: value };
        const n = Number(value);
        if (key === "loadSharePct") {
          return { ...t, loadSharePct: Number.isFinite(n) ? clamp(n, 0, 100) : null };
        }
        return { ...t, [key]: Number.isFinite(n) && n > 0 ? n : null };
      }),
    );
  }

  function regenerateGymMacroPlan() {
    const next = buildGymMacroPhases(gymPlanStart, gymPlanEnd, gymMacroPhaseCount).map((p) => ({
      ...p,
      sessionsPerWeek: Math.max(1, Math.min(7, gymTrainingDaysPerWeek)),
    }));
    setPhases(next);
    setPlanWindowStart(gymPlanStart);
    setPlanWindowEnd(gymPlanEnd);
  }

  function regenerateTechnicalMacroPlan() {
    const next = buildGymMacroPhases(technicalPlanStart, technicalPlanEnd, technicalMacroPhaseCount);
    setPhases(next);
  }

  function regenerateLifestyleMacroPlan() {
    const next = buildGymMacroPhases(lifestylePlanStart, lifestylePlanEnd, lifestyleMacroPhaseCount);
    setPhases(next);
  }

  function loadStatusLabel(loadPct: number) {
    if (loadPct > 100) return "Carico";
    if (loadPct < 100) return "Scarico";
    return "Stabile";
  }

  function selectedWeekConfig() {
    const baseSessions = Math.max(1, Math.min(7, gymTrainingDaysPerWeek));
    const baseModules = gymDayModules.slice(0, baseSessions);
    const saved = gymWeekCustomizations[selectedGymWeekStart];
    if (saved) return saved;
    return { sessionsPerWeek: baseSessions, loadPct: 100, modules: baseModules };
  }

  function updateSelectedWeekConfig(patch: Partial<{ sessionsPerWeek: number; loadPct: number; modules: GymDayModule[] }>) {
    if (!selectedGymWeekStart) return;
    setGymWeekCustomizations((prev) => {
      const current = prev[selectedGymWeekStart] ?? selectedWeekConfig();
      return {
        ...prev,
        [selectedGymWeekStart]: {
          sessionsPerWeek: patch.sessionsPerWeek ?? current.sessionsPerWeek,
          loadPct: patch.loadPct ?? current.loadPct,
          modules: patch.modules ?? current.modules,
        },
      };
    });
  }

  function selectedTechnicalWeekConfig() {
    const baseSessions = Math.max(1, Math.min(7, technicalTrainingDaysPerWeek));
    const baseModules = technicalDayModules.slice(0, baseSessions);
    const saved = technicalWeekCustomizations[selectedTechnicalWeekStart];
    if (saved) return saved;
    return { sessionsPerWeek: baseSessions, loadPct: 100, modules: baseModules };
  }

  function updateSelectedTechnicalWeekConfig(
    patch: Partial<{ sessionsPerWeek: number; loadPct: number; modules: TechnicalDayModule[] }>,
  ) {
    if (!selectedTechnicalWeekStart) return;
    setTechnicalWeekCustomizations((prev) => {
      const current = prev[selectedTechnicalWeekStart] ?? selectedTechnicalWeekConfig();
      return {
        ...prev,
        [selectedTechnicalWeekStart]: {
          sessionsPerWeek: patch.sessionsPerWeek ?? current.sessionsPerWeek,
          loadPct: patch.loadPct ?? current.loadPct,
          modules: patch.modules ?? current.modules,
        },
      };
    });
  }

  function selectedLifestyleWeekConfig() {
    const baseSessions = Math.max(1, Math.min(7, lifestyleTrainingDaysPerWeek));
    const baseModules = lifestyleDayModules.slice(0, baseSessions);
    const saved = lifestyleWeekCustomizations[selectedLifestyleWeekStart];
    if (saved) return saved;
    return { sessionsPerWeek: baseSessions, loadPct: 100, modules: baseModules };
  }

  function updateSelectedLifestyleWeekConfig(
    patch: Partial<{ sessionsPerWeek: number; loadPct: number; modules: LifestyleDayModule[] }>,
  ) {
    if (!selectedLifestyleWeekStart) return;
    setLifestyleWeekCustomizations((prev) => {
      const current = prev[selectedLifestyleWeekStart] ?? selectedLifestyleWeekConfig();
      return {
        ...prev,
        [selectedLifestyleWeekStart]: {
          sessionsPerWeek: patch.sessionsPerWeek ?? current.sessionsPerWeek,
          loadPct: patch.loadPct ?? current.loadPct,
          modules: patch.modules ?? current.modules,
        },
      };
    });
  }

  function autoTuneFromGoal() {
    const weeksToGoal =
      goalRaceDate == null
        ? 24
        : Math.max(8, weeksBetween(isoToday(), goalRaceDate));
    const volumeBias = clamp(
      (goalTargets.distanceKm ?? 0) / 200 + (goalTargets.durationMin ?? 0) / 420,
      0,
      1.2,
    );
    const intensityBias = clamp(
      (goalTargets.speedAvgKmh ?? 0) / 40 + (goalTargets.powerAvgW ?? 0) / 360,
      0,
      1.2,
    );
    const climbingBias = clamp((goalTargets.elevationM ?? 0) / 3500, 0, 1);
    let demand = demandScore(goalTargets);
    const flags = viryaContext?.flags ?? {};
    if (flags.peripheralLimit) demand = clamp(demand * 1.06, 0.25, 1.9);
    if (flags.gutConstraint || flags.dysbiosisRisk) demand = clamp(demand * 0.97, 0.25, 1.9);
    if (flags.redoxLimit) demand = clamp(demand * 0.95, 0.25, 1.9);
    if (flags.epigeneticConstraint) demand = clamp(demand * 0.93, 0.25, 1.9);
    const oxidativeBottleneck = viryaContext?.physiologyState?.performanceProfile.oxidativeBottleneckIndex ?? 0;
    const gutDelivery = viryaContext?.physiologyState?.lactateProfile.bloodDeliveryPctOfIngested ?? 100;
    const glycogenStatus = viryaContext?.twinState?.glycogenStatus ?? 100;
    const readiness = viryaContext?.twinState?.readiness ?? 100;
    if (oxidativeBottleneck >= 60) demand = clamp(demand * 0.96, 0.25, 1.9);
    if (gutDelivery <= 75) demand = clamp(demand * 0.97, 0.25, 1.9);
    if (glycogenStatus < 40) demand = clamp(demand * 0.95, 0.25, 1.9);
    if (readiness < 45) demand = clamp(demand * 0.94, 0.25, 1.9);

    // Strength-specific generator: objective and exercise mode drive annual load shape.
    if (sportFamily === "strength") {
      const modeCount = Math.max(1, new Set(gymDayModules.map((m) => m.exerciseType).filter(Boolean)).size);
      const modeComplexityBoost = clamp(1 + (modeCount - 1) * 0.05, 1, 1.2);
      const goalDemandBoost =
        gymPrimaryGoal === "potenza" || gymPrimaryGoal === "rapidita"
          ? 1.08
          : gymPrimaryGoal === "forza"
            ? 1.06
            : gymPrimaryGoal === "massa"
              ? 1.04
              : gymPrimaryGoal === "resistenza"
                ? 1.0
                : 0.96;
      demand = clamp(demand * modeComplexityBoost * goalDemandBoost, 0.25, 2.0);
    }
    if (sportFamily === "technical") {
      const objectiveVariety = Math.max(1, new Set(technicalDayModules.flatMap((m) => m.objectives)).size);
      const intensityLoad =
        technicalDayModules.reduce(
          (acc, m) => acc + (m.intensity === "Massimale" ? 1.25 : m.intensity === "Alta" ? 1.12 : m.intensity === "Media" ? 1.0 : 0.9),
          0,
        ) / Math.max(1, technicalDayModules.length);
      const techComplexityBoost = clamp(1 + (objectiveVariety - 1) * 0.03, 1, 1.28);
      demand = clamp(demand * techComplexityBoost * clamp(intensityLoad, 0.85, 1.25), 0.25, 2.0);
    }
    if (sportFamily === "lifestyle") {
      const avgRpe =
        lifestyleDayModules.reduce((acc, m) => acc + clamp(m.intensityRpe, 1, 10), 0) / Math.max(1, lifestyleDayModules.length);
      const breathingVariety = Math.max(1, new Set(lifestyleDayModules.map((m) => m.breathingCadence)).size);
      const lifestyleBoost = clamp((avgRpe / 4.2) * (1 + (breathingVariety - 1) * 0.02), 0.75, 1.2);
      demand = clamp(demand * lifestyleBoost, 0.25, 1.8);
    }

    setPhases((prev) =>
      prev.map((p, idx) => {
        const phaseFactor =
          p.phase === "base" ? 0.88 :
          p.phase === "build" ? 1.02 :
          p.phase === "refine" ? 1.08 :
          p.phase === "peak" ? 0.92 :
          p.phase === "deload" ? 0.72 : 1.0;
        const progressionFactor = 1 + (idx / Math.max(1, prev.length - 1)) * 0.06;
        const strengthObjective = (p.macroObjective as GymMacroObjective | undefined) ?? "forza";
        const strengthObjectiveBoost =
          strengthObjective === "potenza" || strengthObjective === "neuromuscolare"
            ? 1.08
            : strengthObjective === "forza" || strengthObjective === "ipertrofia_miofibrillare"
              ? 1.06
              : strengthObjective === "massa" || strengthObjective === "ipertrofia_sarcoplasmatica"
                ? 1.04
                : strengthObjective === "definizione"
                  ? 0.95
                  : 0.9;
        const baseTss = 320 * demand * phaseFactor * progressionFactor + 90 * volumeBias + 50 * intensityBias + 30 * climbingBias;
        const tss = Math.round(
          clamp(
            sportFamily === "strength" ? baseTss * strengthObjectiveBoost : baseTss,
            180,
            760,
          ),
        );
        const sessions = Math.round(
          clamp(
            sportFamily === "strength"
              ? gymTrainingDaysPerWeek + (p.phase === "deload" ? -1 : 0)
              : 5 + 1.2 * volumeBias + 0.6 * intensityBias + (p.phase === "deload" ? -2 : 0),
            1,
            9,
          ),
        );
        const hintTag = (viryaContext?.strategyHints ?? []).slice(0, 3).join(",");
        const note = [
          `GoalMap ${weeksToGoal}w`,
          `Demand ${demand.toFixed(2)}`,
          `Vol ${volumeBias.toFixed(2)}`,
          `Int ${intensityBias.toFixed(2)}`,
          `Climb ${climbingBias.toFixed(2)}`,
          hintTag ? `Hints ${hintTag}` : "",
        ].join(" · ");
        return {
          ...p,
          weeklyTss: tss,
          sessionsPerWeek: sessions,
          notes: p.notes ? `${p.notes} | ${note}` : note,
        };
      }),
    );
  }

  function viryaStructureTag() {
    if (sportFamily === "strength") {
      const types = Array.from(new Set(gymDayModules.map((m) => m.exerciseType).filter(Boolean)));
      return `GYM_STRUCTURE goal=${gymPrimaryGoal};types=${types.join(",") || "none"};days=${gymTrainingDaysPerWeek};week_custom=true`;
    }
    if (sportFamily === "technical" && defaultTechnicalDrill) {
      const uniqueObjectives = Array.from(new Set(technicalDayModules.flatMap((m) => m.objectives))).join(",");
      return `TECH_STRUCTURE drill=${defaultTechnicalDrill.title};days=${technicalTrainingDaysPerWeek};objectives=${uniqueObjectives || "none"};week_custom=true`;
    }
    if (sportFamily === "lifestyle") {
      const practices = Array.from(new Set(lifestyleDayModules.map((m) => m.practiceType))).join(",");
      return `LIFESTYLE_STRUCTURE protocol=Lifestyle;days=${lifestyleTrainingDaysPerWeek};practices=${practices || "none"};week_custom=true`;
    }
    return "AEROBIC_STRUCTURE periodized";
  }

  function serializeViryaSessionContract(input: {
    family: SportFamily;
    discipline: string;
    sessionName: string;
    phase: PhaseType;
    durationMinutes: number;
    tss: number;
    kcal: number;
    adaptationTarget?: string;
    methodology?: string;
    blocks?: Pro2BuilderBlockContract[];
  }) {
    const firstNote = [viryaStructureTag(), input.methodology ? `methodology=${input.methodology}` : ""].filter(Boolean).join(" · ");
    const blocks = input.blocks?.length
      ? input.blocks.map((b, i) =>
          i === 0 && firstNote
            ? { ...b, notes: b.notes ? `${firstNote} | ${b.notes}` : firstNote }
            : b,
        )
      : [];
    return serializePro2BuilderSessionContract({
      version: 1,
      source: "virya",
      family: input.family,
      discipline: input.discipline,
      sessionName: input.sessionName,
      phase: input.phase,
      adaptationTarget: input.adaptationTarget,
      plannedSessionDurationMinutes: input.durationMinutes,
      summary: {
        durationSec: Math.max(0, Math.round(input.durationMinutes * 60)),
        tss: Math.max(0, Math.round(input.tss)),
        kcal: Math.max(0, Math.round(input.kcal)),
        kj: Math.max(0, Math.round(input.kcal * 4.184)),
        avgPowerW: 0,
      },
      blocks,
    });
  }

  function mapViryaPhaseToEnginePhase(phase: PhaseType): SessionGoalRequest["phase"] {
    if (phase === "base") return "base";
    if (phase === "build") return "build";
    if (phase === "deload") return "taper";
    return "peak";
  }

  function viryaDomainForSession(family: SportFamily, disciplineName: string): TrainingDomain {
    if (family === "strength") return "gym";
    if (family === "technical") {
      return ["Boxe", "Karate", "Judo", "Muay Thai"].includes(disciplineName) ? "combat" : "team_sport";
    }
    if (family === "lifestyle") return "mind_body";
    return "endurance";
  }

  function deriveStrengthAdaptation(module: GymDayModule): AdaptationTarget {
    const objectiveText = `${gymPrimaryGoal} ${module.districtObjective} ${module.methodology}`.toLowerCase();
    if (/(potenza|rapid)/.test(objectiveText)) return "power_output";
    if (/(mobil|stretch|postural)/.test(objectiveText)) return "mobility_capacity";
    if (/(circuit|resist|definiz)/.test(objectiveText)) return "lactate_clearance";
    return "max_strength";
  }

  function deriveTechnicalAdaptation(module: TechnicalDayModule): AdaptationTarget {
    const objectiveText = module.objectives.join(" ").toLowerCase();
    if (objectiveText.includes("recupero")) return "recovery";
    if (objectiveText.includes("aerobico")) return "mitochondrial_density";
    if (objectiveText.includes("anaerobico")) return "lactate_tolerance";
    if (objectiveText.includes("velocita")) return "power_output";
    return "skill_transfer";
  }

  function deriveLifestyleAdaptation(module: LifestyleDayModule): AdaptationTarget {
    const objectiveText = `${module.objective} ${module.practiceType}`.toLowerCase();
    if (/(recupero|stress|respir|medit)/.test(objectiveText)) return "recovery";
    if (/(mobil|flessibil)/.test(objectiveText)) return "mobility_capacity";
    return "movement_quality";
  }

  function deriveViryaRequest(input: {
    family: SportFamily;
    discipline: string;
    phase: PhaseType;
    objective?: string;
    methodology?: string;
    tss: number;
    gymModule?: GymDayModule;
    technicalModule?: TechnicalDayModule;
    lifestyleModule?: LifestyleDayModule;
    /** Solo famiglia aerobica: stimoli settimana + indice seduta per rotazione metabolica. */
    weekObjectives?: WeekObjectiveKey[];
    sessionIndexInWeek?: number;
    sessionsInWeek?: number;
  }): {
    adaptationTarget: AdaptationTarget;
    domain: TrainingDomain;
    intensityHint: string;
    objectiveDetail: string;
  } {
    if (input.family === "strength" && input.gymModule) {
      return {
        adaptationTarget: deriveStrengthAdaptation(input.gymModule),
        domain: "gym",
        intensityHint: `${input.gymModule.methodology} · ${input.gymModule.districtObjective}`,
        objectiveDetail: `${formatGymDistrictsLabel(input.gymModule)} / ${input.gymModule.exerciseType}`,
      };
    }
    if (input.family === "technical" && input.technicalModule) {
      return {
        adaptationTarget: deriveTechnicalAdaptation(input.technicalModule),
        domain: viryaDomainForSession("technical", input.discipline),
        intensityHint: `${input.technicalModule.intensity} · ${input.technicalModule.methodology}`,
        objectiveDetail: input.technicalModule.objectives.join(" > "),
      };
    }
    if (input.family === "lifestyle" && input.lifestyleModule) {
      return {
        adaptationTarget: deriveLifestyleAdaptation(input.lifestyleModule),
        domain: "mind_body",
        intensityHint: `RPE ${input.lifestyleModule.intensityRpe} · ${input.lifestyleModule.breathingCadence}`,
        objectiveDetail: `${input.lifestyleModule.practiceType} · ${input.lifestyleModule.objective}`,
      };
    }
    const preset = resolveAerobicViryaPrescription({
      viryaPhase: input.phase,
      goalSummary: input.objective ?? "",
      weekObjectives: input.weekObjectives ?? [],
      sessionIndexInWeek: input.sessionIndexInWeek ?? 0,
      sessionsInWeek: Math.max(1, input.sessionsInWeek ?? 1),
    });
    return {
      adaptationTarget: preset.adaptationTarget,
      domain: "endurance",
      intensityHint: preset.intensityHint,
      objectiveDetail: [
        input.objective ?? input.methodology ?? "periodized endurance support",
        preset.objectiveDetail,
        preset.archetypeLabelIt ? `model=${preset.archetypeLabelIt}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    };
  }

  async function materializeViryaSessionContract(input: {
    family: SportFamily;
    discipline: string;
    sessionName: string;
    phase: PhaseType;
    durationMinutes: number;
    tss: number;
    kcal: number;
    objective?: string;
    methodology?: string;
    gymModule?: GymDayModule;
    technicalModule?: TechnicalDayModule;
    lifestyleModule?: LifestyleDayModule;
    weekObjectives?: WeekObjectiveKey[];
    sessionIndexInWeek?: number;
    sessionsInWeek?: number;
    builderInstructions?: ViryaDerivedBuilderInstructions;
  }) {
    const request = input.builderInstructions
      ? {
          adaptationTarget: input.builderInstructions.adaptationTarget,
          domain: input.builderInstructions.domain,
          intensityHint: input.builderInstructions.intensityHint,
          objectiveDetail: input.builderInstructions.objectiveDetail,
        }
      : deriveViryaRequest(input);
    const fallbackBlocks = buildViryaBlocks(input);
    if (!selectedAthleteId) {
      return serializeViryaSessionContract({
        family: input.family,
        discipline: input.discipline,
        sessionName: input.sessionName,
        phase: input.phase,
        durationMinutes: input.durationMinutes,
        tss: input.tss,
        kcal: input.kcal,
        adaptationTarget: request.adaptationTarget,
        methodology: input.methodology,
        blocks: fallbackBlocks,
      });
    }

    if (input.family === "strength" && input.gymModule) {
      const gymBuilt = await materializeViryaGymBuilderSession({
        athleteId: selectedAthleteId,
        discipline: input.discipline,
        sessionName: input.sessionName,
        phase: mapViryaPhaseToEnginePhase(input.phase),
        durationMinutes: input.durationMinutes,
        tss: input.tss,
        kcal: input.kcal,
        adaptationTarget: request.adaptationTarget,
        intensityHint: request.intensityHint,
        objectiveDetail: request.objectiveDetail,
        methodology: input.methodology,
        gymModule: input.gymModule,
        viryaStructureTag: viryaStructureTag(),
        applyOperationalScaling: false,
      });
      if (gymBuilt.ok) {
        return gymBuilt.notesLine;
      }
      return serializeViryaSessionContract({
        family: input.family,
        discipline: input.discipline,
        sessionName: input.sessionName,
        phase: input.phase,
        durationMinutes: input.durationMinutes,
        tss: input.tss,
        kcal: input.kcal,
        adaptationTarget: request.adaptationTarget,
        methodology: input.methodology,
        blocks: gymBuilt.fallbackBlocks.length ? gymBuilt.fallbackBlocks : fallbackBlocks,
      });
    }

    if (input.family === "aerobic") {
      const prescription =
        input.builderInstructions?.aerobicPrescription ??
        resolveAerobicViryaPrescription({
          viryaPhase: input.phase,
          goalSummary: input.objective ?? "",
          weekObjectives: input.weekObjectives ?? [],
          sessionIndexInWeek: input.sessionIndexInWeek ?? 0,
          sessionsInWeek: Math.max(1, input.sessionsInWeek ?? 1),
        });
      const physiologyEarly = viryaContext?.physiologyState;
      const ftpEarly = Number(physiologyEarly?.physiologicalProfile.ftpWatts ?? 0);
      const hrEarly = Number(physiologyEarly?.performanceProfile.maxHrBpm ?? 0);
      const aerobicPresets = await loadAerobicStarterPresetsClient();
      const catalogSerialized = materializeViryaAerobicFromCatalog(
        {
          prescription,
          discipline: input.discipline,
          sessionName: input.sessionName,
          phase: input.phase,
          targetDurationMinutes: input.durationMinutes,
          targetTss: input.tss,
          targetKcal: input.kcal,
          sessionIndexInWeek: input.sessionIndexInWeek ?? 0,
          ftpW: Number.isFinite(ftpEarly) && ftpEarly > 0 ? ftpEarly : 250,
          hrMax: Number.isFinite(hrEarly) && hrEarly > 0 ? hrEarly : 185,
          viryaStructureTag: viryaStructureTag(),
          methodology: input.methodology,
        },
        aerobicPresets,
      );
      if (catalogSerialized) {
        return catalogSerialized;
      }
    }

    const engineRes = await generateBuilderSession({
      athleteId: selectedAthleteId,
      /** Piano VIRYA = struttura guida; lo scaling giornaliero è solo nel builder operativo. */
      applyOperationalScaling: false,
      request: {
        sport: input.discipline.toLowerCase(),
        domain: request.domain,
        goalLabel: input.sessionName,
        adaptationTarget: request.adaptationTarget,
        sessionMinutes: input.durationMinutes,
        phase: mapViryaPhaseToEnginePhase(input.phase),
        tssTargetHint: input.tss,
        intensityHint: request.intensityHint,
        objectiveDetail: request.objectiveDetail,
      },
    });
    if (!("ok" in engineRes) || !engineRes.ok) {
      return serializeViryaSessionContract({
        family: input.family,
        discipline: input.discipline,
        sessionName: input.sessionName,
        phase: input.phase,
        durationMinutes: input.durationMinutes,
        tss: input.tss,
        kcal: input.kcal,
        adaptationTarget: request.adaptationTarget,
        methodology: input.methodology,
        blocks: fallbackBlocks,
      });
    }
    const operationalScaling = (
      engineRes as { operationalScaling?: BuilderSessionOperationalScalingViewModel | null }
    ).operationalScaling;
    const effectiveDuration = operationalScaling?.sessionMinutesEffective ?? input.durationMinutes;
    const effectiveTss = operationalScaling?.tssTargetHintEffective ?? input.tss;
    const effectiveKcal =
      operationalScaling?.applied && operationalScaling.loadScale > 0
        ? Math.max(1, Math.round(input.kcal * operationalScaling.loadScale))
        : input.kcal;
    const effectiveMethodology = operationalScaling?.applied
      ? [input.methodology, `[EMPATHY operational scale ${operationalScaling.loadScalePct}%] ${operationalScaling.headline}`]
          .filter(Boolean)
          .join(" | ")
      : input.methodology;

    const physiology = viryaContext?.physiologyState;
    const ftpRaw = Number(physiology?.physiologicalProfile.ftpWatts ?? 0);
    const hrRaw = Number(physiology?.performanceProfile.maxHrBpm ?? 0);
    const ftpW = Number.isFinite(ftpRaw) && ftpRaw > 0 ? ftpRaw : 250;
    const hrMax = Number.isFinite(hrRaw) && hrRaw > 0 ? hrRaw : 185;
    const unit = "watt" as const;
    const lengthMode = "time" as const;
    const speedRefKmh = 32;

    const loadScale =
      operationalScaling?.applied && operationalScaling.loadScale > 0 ? operationalScaling.loadScale : 1;
    const mediaFromFallback = (index: number) =>
      fallbackBlocks[index]?.lifestyleRx?.mediaUrl ?? fallbackBlocks[0]?.lifestyleRx?.mediaUrl;
    const trainingBlocks = mapEngineSessionToTrainingBlocks({
      session: engineRes.session as unknown as Record<string, unknown>,
      blockExercises: Array.isArray(engineRes.blockExercises)
        ? (engineRes.blockExercises as Array<Record<string, unknown>>)
        : undefined,
      fallbackBlocks,
      fallbackDurationMinutes: input.durationMinutes,
      fallbackTarget: input.objective,
      fallbackIntensityCue: request.intensityHint,
      fallbackNotes: request.objectiveDetail,
      mediaResolver: mediaFromFallback,
    });
    const scaledBlocks = trainingBlocks.map((b) => scaleTrainingBlock(b, loadScale));
    const summary = summarizeBlocks(scaledBlocks, { unit, ftpW, hrMax, lengthMode, speedRefKmh });

    const builderFamily =
      input.family === "aerobic" ? "aerobic" : input.family === "technical" ? "technical" : "lifestyle";
    const contract = buildPro2BlockSessionContract({
      discipline: input.discipline,
      family: builderFamily,
      sessionName: input.sessionName,
      adaptationTarget: request.adaptationTarget,
      phase: input.phase,
      summary,
      plannedSessionDurationMinutes: effectiveDuration,
      blocks: scaledBlocks,
      unit,
      ftpW,
      hrMax,
      lengthMode,
      speedRefKmh,
    });

    const finalized = finalizeViryaPro2ContractAsBuilderFile({
      contract,
      ftpW,
      hrMax,
      intensityUnit: unit,
      lengthMode,
      speedRefKmh,
    });

    const firstNote = [viryaStructureTag(), effectiveMethodology ? `methodology=${effectiveMethodology}` : ""]
      .filter(Boolean)
      .join(" · ");
    const blocksMerged = (finalized.blocks ?? []).map((b, i) => {
      if (i !== 0) return b;
      const withPrefix = firstNote ? (b.notes ? `${firstNote} | ${b.notes}` : firstNote) : (b.notes ?? "");
      const n = withPrefix.trim() || "virya_planner";
      return {
        ...b,
        notes: n.includes("origin=virya_planner") ? n : `${n} | origin=virya_planner`,
      };
    });

    return serializePro2BuilderSessionContract({ ...finalized, blocks: blocksMerged });
  }

  function buildViryaBlocks(input: {
    family: SportFamily;
    discipline: string;
    durationMinutes: number;
    objective?: string;
    methodology?: string;
    gymModule?: GymDayModule;
    technicalModule?: TechnicalDayModule;
    lifestyleModule?: LifestyleDayModule;
  }): Pro2BuilderBlockContract[] {
    if (input.family === "strength" && input.gymModule) {
      return [
        {
          id: `virya-strength-${input.gymModule.dayIndex}`,
          label: `${formatGymDistrictsLabel(input.gymModule)} · ${input.gymModule.exerciseType}`,
          kind: "strength_sets",
          durationMinutes: input.durationMinutes,
          target: input.gymModule.districtObjective,
          intensityCue: input.objective,
          notes: `method=${input.gymModule.methodology};districts=${gymModuleDistricts(input.gymModule).join(",")};exerciseType=${input.gymModule.exerciseType}`,
        },
      ];
    }
    if (input.family === "technical" && input.technicalModule) {
      const drill = getTechnicalDrillsForDiscipline(input.discipline, technicalDrills)[0] ?? defaultTechnicalDrill;
      const mediaUrl = drill ? getTechnicalDrillMediaUrl(drill) : undefined;
      return [
        {
          id: `virya-technical-${input.technicalModule.dayIndex}`,
          label: input.technicalModule.exerciseType,
          kind: "technical_drill",
          durationMinutes: input.durationMinutes,
          target: input.technicalModule.objectives.join(" > "),
          intensityCue: input.technicalModule.intensity,
          notes: [
            `method=${input.technicalModule.methodology};objectives=${input.technicalModule.objectives.join(",")}`,
            mediaUrl ? `virya_media_url=${mediaUrl}` : "",
          ]
            .filter(Boolean)
            .join(";"),
        },
      ];
    }
    if (input.family === "lifestyle" && input.lifestyleModule) {
      const protocol = getLifestyleProtocolsForDiscipline(input.discipline, lifestyleProtocols)[0] ?? defaultLifestyleProtocol;
      const mediaUrl = protocol ? getLifestyleProtocolMediaUrl(protocol) : undefined;
      return [
        {
          id: `virya-lifestyle-${input.lifestyleModule.dayIndex}`,
          label: input.lifestyleModule.practiceType,
          kind: "flow_recovery",
          durationMinutes: input.durationMinutes,
          target: input.lifestyleModule.objective,
          intensityCue: `RPE ${input.lifestyleModule.intensityRpe}`,
          notes: `breathing=${input.lifestyleModule.breathingCadence};holdFlow=${input.lifestyleModule.holdOrFlow};method=${input.lifestyleModule.methodology}`,
          lifestyleRx: mediaUrl ? { mediaUrl } : undefined,
        },
      ];
    }
    return [
      {
        id: `virya-aerobic-${input.discipline.toLowerCase().replace(/\s+/g, "-")}`,
        label: input.discipline,
        kind: "steady",
        durationMinutes: input.durationMinutes,
        target: input.objective,
        intensityCue: "periodized_aerobic",
        notes: `method=${input.methodology ?? "annual_periodized_distribution"}`,
      },
    ];
  }

  async function buildViryaPlannedRows(onlyWeekStart?: string | null) {
    const tag = viryaPlanTag(planName);
    let gymSchedaSessions = 0;
    const athleteId = selectedAthleteId;
    if (!athleteId) {
      return {
        rows: [],
        effectivePhases: phases,
        syncGymPhasesToWindow: false,
        gymSchedaSessions: 0,
        tag,
      };
    }
    const contextHint = (viryaContext?.strategyHints ?? []).slice(0, 4).join(",");
    const strengthWindowStart =
      sportFamily === "strength" ? (planWindowStart.trim() || gymPlanStart.trim()) : gymPlanStart;
    const strengthWindowEnd =
      sportFamily === "strength" ? (planWindowEnd.trim() || gymPlanEnd.trim()) : gymPlanEnd;
    const syncGymPhasesToWindow =
      sportFamily === "strength" &&
      !phasesCoverGymWindow(phases, strengthWindowStart, strengthWindowEnd);
    const aerobicWindowStart = planWindowStart.trim();
    const aerobicWindowEnd = planWindowEnd.trim();
    const aerobicPhasesMismatch =
      sportFamily === "aerobic" &&
      aerobicWindowStart &&
      aerobicWindowEnd &&
      !aerobicPhasesMatchWindow(phases, aerobicWindowStart, aerobicWindowEnd);
    const effectivePhases = syncGymPhasesToWindow
      ? buildGymMacroPhases(strengthWindowStart, strengthWindowEnd, gymMacroPhaseCount).map((p) => ({
          ...p,
          sessionsPerWeek: Math.max(1, Math.min(7, gymTrainingDaysPerWeek)),
        }))
      : aerobicPhasesMismatch
        ? buildAerobicClassicPhases(aerobicWindowStart, aerobicWindowEnd)
        : phases;
    const rows: {
      athlete_id: string;
      date: string;
      type: string;
      duration_minutes: number;
      tss_target: number;
      kcal_target: number;
      notes: string;
    }[] = [];
    const activeSports = sportTargets
      .filter((t) => (t.sport ?? "").trim() !== "")
      .map((t) => ({
        ...t,
        sport: t.sport.trim(),
        share: Math.max(0, t.loadSharePct ?? 0),
      }));

    for (const phase of effectivePhases) {
      const weekCount = weeksBetween(phase.start, phase.end);
      const phaseMonday = mondayOfIsoWeek(phase.start);
      for (let w = 0; w < weekCount; w += 1) {
        const weekStart = addIsoDays(phaseMonday, w * 7);
        if (onlyWeekStart && weekStart !== onlyWeekStart) continue;
        const wm = resolveWeekMetrics(phase, w, weekStart);
        const objNote = wm.objectives.length ? `week_focus=${wm.objectives.join("+")}` : "";
        if (sportFamily === "strength") {
          const weekCfg = gymWeekCustomizations[weekStart];
          const weekSessions = wm.sessions;
          const loadPct = Math.max(50, Math.min(180, weekCfg?.loadPct ?? 100));
          const adjustedWeeklyTss = wm.weeklyTss;
          const templateModules = ensureGymWeekModules(
            weekCfg?.modules?.length ? weekCfg.modules : gymDayModules.length ? gymDayModules : buildGymDayModules(),
          );
          const modules = activeGymModulesForWeek(templateModules, weekSessions);
          const weekPlan = buildWeekGenerationPlan({
            weeklyBudgetLoad: adjustedWeeklyTss,
            sessionsPerWeek: weekSessions,
            phase: phase.phase as ViryaMacroPhase,
            family: "strength",
            patternId: viryaPatternForSessions(),
          });
          for (const slot of weekPlan.slots) {
            const slotModule = modules[slot.slotIndex % modules.length]!;
            const phaseObj = phase.macroObjective ?? gymPrimaryGoal;
            const sessionName = `${planName.trim() || "VIRYA"} · ${phaseLabels[phase.phase]} · Gym · ${weekdayLabel(slot.weekdayOffset)}`;
            const brief = buildViryaBuilderSessionBrief({
              weekStart,
              slot,
              sessionsInWeek: weekPlan.slots.length,
              weeklyBudgetLoad: weekPlan.weeklyBudgetLoad,
              weekdayPatternId: weekPlan.patternId,
              phase: phase.phase as ViryaMacroPhase,
              family: "strength",
              discipline: "Gym",
              planName: planName.trim() || "VIRYA",
              phaseLabel: phaseLabels[phase.phase],
              sessionName,
              objective: String(phaseObj),
              methodology: slotModule.methodology,
              weekObjectives: wm.objectives,
              gymPrimaryGoal,
              contextHint: contextHint || undefined,
            });
            const derived = deriveViryaBuilderInstructions({ brief, gymModule: slotModule });
            const serializedContract = await materializeViryaSessionContract({
              family: "strength",
              discipline: "Gym",
              sessionName,
              phase: phase.phase,
              durationMinutes: derived.sessionMinutes,
              tss: derived.tss,
              kcal: derived.kcal,
              objective: String(phaseObj),
              methodology: slotModule.methodology,
              gymModule: slotModule,
              builderInstructions: derived,
              sessionIndexInWeek: slot.slotIndex,
              sessionsInWeek: weekPlan.slots.length,
            });
            if (serializedContract.includes("catalogExerciseId")) gymSchedaSessions += 1;
            const briefMeta = formatViryaBriefMetaLine(brief, derived, weekPlan.loadSum);
            const viryaMeta = `${tag} ${phaseLabels[phase.phase]} · ${phase.mesocycle} · ${objective} · GymGoal ${gymPrimaryGoal} · MacroObjective ${phaseObj} · LoadWeek ${loadPct}% (${loadStatusLabel(loadPct)}) · Giorno${slotModule.dayIndex} distretti=${formatGymDistrictsLabel(slotModule)} obiettivo=${slotModule.districtObjective} esercizio=${slotModule.exerciseType} metodologia=${slotModule.methodology} · ${objNote} · Hints: ${contextHint || "none"} · ${viryaStructureTag()} · ${briefMeta}`;
            rows.push({
              athlete_id: athleteId,
              date: addDays(weekStart, slot.weekdayOffset),
              type: "gym",
              duration_minutes: derived.sessionMinutes,
              tss_target: derived.tss,
              kcal_target: derived.kcal,
              notes: [serializedContract, viryaMeta].join("\n"),
            });
          }
        } else if (sportFamily === "technical") {
          const weekCfg = technicalWeekCustomizations[weekStart];
          const weekSessions = wm.sessions;
          const loadPct = Math.max(50, Math.min(180, weekCfg?.loadPct ?? 100));
          const adjustedWeeklyTss = wm.weeklyTss;
          const modules = weekCfg?.modules?.length
            ? weekCfg.modules
            : technicalDayModules.length
              ? technicalDayModules
              : buildTechnicalDayModules(weekSessions);
          const weekPlan = buildWeekGenerationPlan({
            weeklyBudgetLoad: adjustedWeeklyTss,
            sessionsPerWeek: weekSessions,
            phase: phase.phase as ViryaMacroPhase,
            family: "technical",
            patternId: viryaPatternForSessions(),
          });
          for (const slot of weekPlan.slots) {
            const slotModule = modules[slot.slotIndex % modules.length]!;
            const phaseObj = phase.macroObjective ?? "tecnico";
            const sequence = slotModule.objectives.length ? slotModule.objectives.join(" > ") : "N/A";
            const sessionName = `${planName || "VIRYA"} · ${phaseLabels[phase.phase]} · ${discipline} · ${weekdayLabel(slot.weekdayOffset)}`;
            const brief = buildViryaBuilderSessionBrief({
              weekStart,
              slot,
              sessionsInWeek: weekPlan.slots.length,
              weeklyBudgetLoad: weekPlan.weeklyBudgetLoad,
              weekdayPatternId: weekPlan.patternId,
              phase: phase.phase as ViryaMacroPhase,
              family: "technical",
              discipline,
              planName: planName.trim() || "VIRYA",
              phaseLabel: phaseLabels[phase.phase],
              sessionName,
              objective: sequence,
              methodology: slotModule.methodology,
              weekObjectives: wm.objectives,
              contextHint: contextHint || undefined,
            });
            const derived = deriveViryaBuilderInstructions({ brief, technicalModule: slotModule });
            const serializedContract = await materializeViryaSessionContract({
              family: "technical",
              discipline,
              sessionName,
              phase: phase.phase,
              durationMinutes: derived.sessionMinutes,
              tss: derived.tss,
              kcal: derived.kcal,
              objective: sequence,
              methodology: slotModule.methodology,
              technicalModule: slotModule,
              builderInstructions: derived,
              sessionIndexInWeek: slot.slotIndex,
              sessionsInWeek: weekPlan.slots.length,
            });
            const briefMeta = formatViryaBriefMetaLine(brief, derived, weekPlan.loadSum);
            rows.push({
              athlete_id: athleteId,
              date: addDays(weekStart, slot.weekdayOffset),
              type: discipline.toLowerCase(),
              duration_minutes: derived.sessionMinutes,
              tss_target: derived.tss,
              kcal_target: derived.kcal,
              notes: [
                serializedContract,
                `${tag} ${phaseLabels[phase.phase]} · ${phase.mesocycle} · ${objective} · Modulo C Tecnico-Tattico · MacroObjective ${phaseObj} · LoadWeek ${loadPct}% (${loadStatusLabel(loadPct)}) · Giorno${slotModule.dayIndex} obiettivi=${sequence} esercizio=${slotModule.exerciseType} intensita=${slotModule.intensity} metodo=${slotModule.methodology} · ${objNote} · Hints: ${contextHint || "none"} · ${viryaStructureTag()} · ${briefMeta}`,
              ].join("\n"),
            });
          }
        } else if (sportFamily === "lifestyle") {
          const weekCfg = lifestyleWeekCustomizations[weekStart];
          const weekSessions = wm.sessions;
          const loadPct = Math.max(50, Math.min(180, weekCfg?.loadPct ?? 100));
          const adjustedWeeklyTss = wm.weeklyTss;
          const modules = weekCfg?.modules?.length
            ? weekCfg.modules
            : lifestyleDayModules.length
              ? lifestyleDayModules
              : buildLifestyleDayModules(weekSessions);
          const weekPlan = buildWeekGenerationPlan({
            weeklyBudgetLoad: adjustedWeeklyTss,
            sessionsPerWeek: weekSessions,
            phase: phase.phase as ViryaMacroPhase,
            family: "lifestyle",
            patternId: viryaPatternForSessions(),
          });
          for (const slot of weekPlan.slots) {
            const slotModule = modules[slot.slotIndex % modules.length]!;
            const phaseObj = phase.macroObjective ?? "lifestyle";
            const sessionName = `${planName || "VIRYA"} · ${phaseLabels[phase.phase]} · ${discipline} · ${weekdayLabel(slot.weekdayOffset)}`;
            const brief = buildViryaBuilderSessionBrief({
              weekStart,
              slot,
              sessionsInWeek: weekPlan.slots.length,
              weeklyBudgetLoad: weekPlan.weeklyBudgetLoad,
              weekdayPatternId: weekPlan.patternId,
              phase: phase.phase as ViryaMacroPhase,
              family: "lifestyle",
              discipline,
              planName: planName.trim() || "VIRYA",
              phaseLabel: phaseLabels[phase.phase],
              sessionName,
              objective: slotModule.objective,
              methodology: slotModule.methodology,
              weekObjectives: wm.objectives,
              contextHint: contextHint || undefined,
            });
            const derived = deriveViryaBuilderInstructions({ brief, lifestyleModule: slotModule });
            const serializedContract = await materializeViryaSessionContract({
              family: "lifestyle",
              discipline,
              sessionName,
              phase: phase.phase,
              durationMinutes: derived.sessionMinutes,
              tss: derived.tss,
              kcal: derived.kcal,
              objective: slotModule.objective,
              methodology: slotModule.methodology,
              lifestyleModule: slotModule,
              builderInstructions: derived,
              sessionIndexInWeek: slot.slotIndex,
              sessionsInWeek: weekPlan.slots.length,
            });
            const briefMeta = formatViryaBriefMetaLine(brief, derived, weekPlan.loadSum);
            rows.push({
              athlete_id: athleteId,
              date: addDays(weekStart, slot.weekdayOffset),
              type: discipline.toLowerCase(),
              duration_minutes: derived.sessionMinutes,
              tss_target: derived.tss,
              kcal_target: derived.kcal,
              notes: [
                serializedContract,
                `${tag} ${phaseLabels[phase.phase]} · ${phase.mesocycle} · ${objective} · Modulo D Lifestyle · MacroObjective ${phaseObj} · LoadWeek ${loadPct}% (${loadStatusLabel(loadPct)}) · Giorno${slotModule.dayIndex} objective=${slotModule.objective} pratica=${slotModule.practiceType} RPE=${slotModule.intensityRpe} breathing=${slotModule.breathingCadence} holdFlow=${slotModule.holdOrFlow} method=${slotModule.methodology} · ${objNote} · Hints: ${contextHint || "none"} · ${viryaStructureTag()} · ${briefMeta}`,
              ].join("\n"),
            });
          }
        } else {
          const normalizedSports =
            activeSports.length > 0
              ? activeSports
              : [{ ...emptyTargetSport(discipline), sport: discipline, share: 100 }];
          const sharesSum = normalizedSports.reduce((s, sp) => s + Math.max(0, sp.share), 0);

          for (const sportTarget of normalizedSports) {
            const normalizedShare =
              sharesSum > 0 ? Math.max(0, sportTarget.share) / sharesSum : 1 / normalizedSports.length;
            const sportWeeklyTss = Math.max(20, Math.round(wm.weeklyTss * normalizedShare));
            const sportSessions = Math.max(1, Math.round(wm.sessions * normalizedShare));
            const weekPlan = buildWeekGenerationPlan({
              weeklyBudgetLoad: sportWeeklyTss,
              sessionsPerWeek: sportSessions,
              phase: phase.phase as ViryaMacroPhase,
              family: "aerobic",
              patternId: viryaPatternForSessions(),
            });
            for (const slot of weekPlan.slots) {
              const brief = buildViryaBuilderSessionBrief({
                weekStart,
                slot,
                sessionsInWeek: weekPlan.slots.length,
                weeklyBudgetLoad: weekPlan.weeklyBudgetLoad,
                weekdayPatternId: weekPlan.patternId,
                phase: phase.phase as ViryaMacroPhase,
                family: "aerobic",
                discipline: sportTarget.sport,
                planName: planName.trim() || "VIRYA",
                phaseLabel: phaseLabels[phase.phase],
                sessionName: `${planName || "VIRYA"} · ${phaseLabels[phase.phase]} · ${sportTarget.sport} · ${weekdayLabel(slot.weekdayOffset)}`,
                objective: goalSummary,
                methodology: "annual_periodized_distribution",
                weekObjectives: wm.objectives,
                contextHint: contextHint || undefined,
              });
              const derived = deriveViryaBuilderInstructions({ brief });
              const archetypeLabel = derived.aerobicPrescription?.archetypeLabelIt ?? "aerobic";
              const sessionTitle = `${planName || "VIRYA"} · ${phaseLabels[phase.phase]} · ${sportTarget.sport} · ${archetypeLabel} · ${weekdayLabel(slot.weekdayOffset)}`;
              const serializedContract = await materializeViryaSessionContract({
                family: "aerobic",
                discipline: sportTarget.sport,
                sessionName: sessionTitle,
                phase: phase.phase,
                durationMinutes: derived.sessionMinutes,
                tss: derived.tss,
                kcal: derived.kcal,
                objective: goalSummary,
                methodology: "annual_periodized_distribution",
                weekObjectives: wm.objectives,
                sessionIndexInWeek: slot.slotIndex,
                sessionsInWeek: weekPlan.slots.length,
                builderInstructions: derived,
              });
              const briefMeta = formatViryaBriefMetaLine(brief, derived, weekPlan.loadSum);
              rows.push({
                athlete_id: athleteId,
                date: addDays(weekStart, slot.weekdayOffset),
                type: sportTarget.sport.toLowerCase(),
                duration_minutes: derived.sessionMinutes,
                tss_target: derived.tss,
                kcal_target: derived.kcal,
                notes: [
                  serializedContract,
                  `${tag} ${phaseLabels[phase.phase]} · ${phase.mesocycle} · ${objective} · Sport ${sportTarget.sport} (${Math.round(normalizedShare * 100)}%) · Target: ${goalSummary} · ${objNote} · Hints: ${contextHint || "none"} · ${viryaStructureTag()} · ${briefMeta}`,
                ].join("\n"),
              });
            }
          }
        }
      }
    }

    return { rows, effectivePhases, syncGymPhasesToWindow, gymSchedaSessions, tag };
  }

  async function generateOnCalendar() {
    setError(null);
    setSuccess(null);
    if (!selectedAthleteId) {
      setError("Atleta non disponibile per la generazione.");
      return;
    }
    if (!phases.length) {
      setError("Aggiungi almeno una fase.");
      return;
    }
    setSaving(true);
    const { rows, effectivePhases, syncGymPhasesToWindow, gymSchedaSessions, tag } = await buildViryaPlannedRows();

    if (rows.length === 0) {
      setError(
        "Nessuna seduta generata: controlla date mag–giu (passo 3 → Applica periodo alle fasi), macro-fasi al passo 4/5 e giorni/settimana gym, poi riprova.",
      );
      setSaving(false);
      return;
    }

    try {
      const coachTraceIds =
        viryaContext?.athleteMemory?.evidenceMemory?.items
          ?.filter(
            (item) =>
              item.source === COACH_APPLICATION_EVIDENCE_SOURCE &&
              (item.module === "training" || item.module === "physiology"),
          )
          .map((item) => item.id ?? "")
          .filter((id): id is string => Boolean(id)) ?? [];
      const generationAudit =
        coachTraceIds.length || viryaRetuneProposalVm || viryaRetuneDirective
          ? {
              source: "virya_orchestrator_calendar_replace",
              coachTraceIds: coachTraceIds.slice(0, 12),
              viryaRetuneMode: viryaRetuneProposalVm?.recommendedMode ?? viryaRetuneDirective?.recommendedMode ?? null,
            }
          : undefined;
      const result = await replaceTrainingPlannerCalendar({
        athleteId: selectedAthleteId,
        replaceTag: replacePrevious ? tag : undefined,
        rows,
        generationAudit,
      });
      if (syncGymPhasesToWindow) {
        setPhases(effectivePhases);
      }
      const rowDates = rows.map((r) => r.date).filter(Boolean).sort();
      const minD = rowDates[0] ?? "";
      const maxD = rowDates[rowDates.length - 1] ?? "";
      const rangeHint =
        minD && maxD
          ? ` Intervallo ${minD} → ${maxD}: in Calendar usa le frecce o apri una data nel range (la vista iniziale mostra solo poche settimane).`
          : "";
      const gymHint =
        sportFamily === "strength" && gymSchedaSessions < rows.length
          ? ` Attenzione: ${rows.length - gymSchedaSessions} sedute senza scheda catalogo (fallback leggero) — verifica distretti o ripubblica dopo deploy.`
          : sportFamily === "strength"
            ? ` Schede palestra Builder: ${gymSchedaSessions}/${rows.length}.`
            : "";
      const dedupeHint =
        (result.dedupeSkippedCount ?? 0) > 0
          ? ` Attenzione: ${result.dedupeSkippedCount} righe saltate (già presenti stesso giorno/fingerprint) — apri Calendar e verifica tutte le date.`
          : "";
      setSuccess(
        `Piano «${planName.trim() || "Annual"}» (${tag}): ${rows.length} sessioni generate.${dedupeHint}${gymHint}${rangeHint}`,
      );
      void refreshViryaCalendarPlans();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Errore inatteso durante la generazione.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function saveWeekToLibrary() {
    setError(null);
    setSuccess(null);
    if (!selectedAthleteId) {
      setError("Atleta non disponibile: serve il contesto atleta per materializzare le sedute.");
      return;
    }
    const weekStart = libraryWeekStart.trim();
    if (!weekStart) {
      setError("Seleziona la settimana da esportare in libreria.");
      return;
    }
    const weekRow = programWeekRows.find((r) => r.weekStart === weekStart);
    setSavingLibrary(true);
    try {
      const { rows } = await buildViryaPlannedRows(weekStart);
      if (!rows.length) {
        setError(`Nessuna seduta materializzata per la settimana ${weekStart}.`);
        return;
      }
      const sessions: Array<{
        title: string;
        contract: Pro2BuilderSessionContract;
        weekdayOffset?: number;
      }> = [];
      for (const row of rows) {
        const contract = parsePro2BuilderSessionFromNotes(row.notes);
        if (!contract) continue;
        const rowDate = new Date(`${row.date}T12:00:00`);
        const weekDate = new Date(`${weekStart}T12:00:00`);
        const weekdayOffset = Math.round((rowDate.getTime() - weekDate.getTime()) / 86_400_000);
        sessions.push({
          title: (contract.sessionName ?? `VIRYA · ${row.date}`).trim().slice(0, 200),
          contract: contract as Pro2BuilderSessionContract,
          weekdayOffset: Number.isFinite(weekdayOffset) ? weekdayOffset : undefined,
        });
      }
      if (!sessions.length) {
        setError("Contratti Builder non trovati nelle sedute materializzate.");
        return;
      }
      const r = await importViryaWeekToLibrary({
        weekStart,
        viryaPlanName: planName.trim() || "VIRYA",
        viryaPlanTag: viryaPlanTag(planName),
        viryaPhase: weekRow?.phaseType,
        viryaWeekNumber: weekRow?.week,
        weekObjectives: weekRow?.objectives?.length ? weekRow.objectives : undefined,
        sessions,
      });
      if (!r.ok) {
        setError(
          r.error === "coach_only" || r.error === "coach_not_approved"
            ? "Export libreria riservato ai coach approvati."
            : (r.error ?? "Export libreria fallito"),
        );
        return;
      }
      setSuccess(
        `Settimana ${weekStart}: ${r.imported ?? sessions.length} sedute salvate in libreria coach (cartella VIRYA · settimane tipo).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export libreria fallito");
    } finally {
      setSavingLibrary(false);
    }
  }

  function applyPlanPeriod(): boolean {
    const s = planWindowStart.trim();
    const e = planWindowEnd.trim();
    if (!s || !e || new Date(e) < new Date(s)) {
      setError("Intervallo date non valido (fine prima dell’inizio).");
      return false;
    }
    setError(null);
    if (sportFamily === "strength") {
      setGymPlanStart(s);
      setGymPlanEnd(e);
      const next = buildGymMacroPhases(s, e, gymMacroPhaseCount).map((p) => ({
        ...p,
        sessionsPerWeek: Math.max(1, Math.min(7, gymTrainingDaysPerWeek)),
      }));
      setPhases(next);
      return true;
    }
    if (sportFamily === "technical") {
      setTechnicalPlanStart(s);
      setTechnicalPlanEnd(e);
      setPhases(
        buildGymMacroPhases(s, e, technicalMacroPhaseCount).map((p) => ({
          ...p,
          sessionsPerWeek: Math.max(1, Math.min(7, technicalTrainingDaysPerWeek)),
        })),
      );
      return true;
    }
    if (sportFamily === "lifestyle") {
      setLifestylePlanStart(s);
      setLifestylePlanEnd(e);
      setPhases(
        buildGymMacroPhases(s, e, lifestyleMacroPhaseCount).map((p) => ({
          ...p,
          sessionsPerWeek: Math.max(1, Math.min(7, lifestyleTrainingDaysPerWeek)),
        })),
      );
      return true;
    }
    const next = buildAerobicClassicPhases(s, e);
    if (!next.length) {
      setError("Intervallo date non valido (fine prima dell’inizio).");
      return false;
    }
    setPhases(next);
    return true;
  }

  function applyClassicPeriodization() {
    const s = planWindowStart.trim();
    const e = planWindowEnd.trim();
    if (!s || !e || new Date(e) < new Date(s)) {
      setError("Imposta date inizio/fine valide al passo 3 prima di generare le fasi.");
      return;
    }
    setError(null);
    const next = buildAerobicClassicPhases(s, e);
    if (!next.length) return;
    setPhases(next);
    setWeeklyProgramOverrides({});
  }

  function applyPlanWindowPreset(weeks: number) {
    const base = planWindowStart.trim() || start;
    const end = addDays(base, weeks * 7 - 1);
    setPlanWindowStart(base);
    setPlanWindowEnd(end);
    if (sportFamily === "strength") {
      setGymPlanStart(base);
      setGymPlanEnd(end);
      setPhases(
        buildGymMacroPhases(base, end, gymMacroPhaseCount).map((p) => ({
          ...p,
          sessionsPerWeek: Math.max(1, Math.min(7, gymTrainingDaysPerWeek)),
        })),
      );
      setError(null);
      return;
    }
    if (sportFamily === "technical") {
      setTechnicalPlanStart(base);
      setTechnicalPlanEnd(end);
      setPhases(
        buildGymMacroPhases(base, end, technicalMacroPhaseCount).map((p) => ({
          ...p,
          sessionsPerWeek: Math.max(1, Math.min(7, technicalTrainingDaysPerWeek)),
        })),
      );
      setError(null);
      return;
    }
    if (sportFamily === "lifestyle") {
      setLifestylePlanStart(base);
      setLifestylePlanEnd(end);
      setPhases(
        buildGymMacroPhases(base, end, lifestyleMacroPhaseCount).map((p) => ({
          ...p,
          sessionsPerWeek: Math.max(1, Math.min(7, lifestyleTrainingDaysPerWeek)),
        })),
      );
      setError(null);
      return;
    }
    const next = buildAerobicClassicPhases(base, end);
    if (next.length) {
      setPhases(next);
      setWeeklyProgramOverrides({});
      setError(null);
    }
  }

  function patchWeeklyOverride(
    weekStart: string,
    patch: Partial<{ weeklyTss: number; sessionsPerWeek: number; hoursPerWeek: number; objectives: WeekObjectiveKey[] }>,
  ) {
    setWeeklyProgramOverrides((prev) => ({
      ...prev,
      [weekStart]: { ...prev[weekStart], ...patch },
    }));
  }

  function clearWeeklyHours(weekStart: string) {
    setWeeklyProgramOverrides((prev) => {
      const cur = { ...prev[weekStart] };
      delete cur.hoursPerWeek;
      return { ...prev, [weekStart]: cur };
    });
  }

  function toggleWeekObjective(weekStart: string, id: WeekObjectiveKey) {
    setWeeklyProgramOverrides((prev) => {
      const cur = prev[weekStart]?.objectives ?? [];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return { ...prev, [weekStart]: { ...prev[weekStart], objectives: next } };
    });
  }

  function resolveWeekMetrics(phase: PhasePlan, weekIndexInPhase: number, weekStart: string) {
    const progressive = phase.phase === "build" ? 1 + Math.min(0.14, weekIndexInPhase * 0.02) : 1;
    const taper = phase.phase === "peak" || phase.phase === "deload" ? Math.max(0.68, 1 - weekIndexInPhase * 0.08) : 1;
    const baseTss = Math.round(phase.weeklyTss * progressive * taper);
    const custom =
      sportFamily === "strength"
        ? gymWeekCustomizations[weekStart]
        : sportFamily === "technical"
          ? technicalWeekCustomizations[weekStart]
          : sportFamily === "lifestyle"
            ? lifestyleWeekCustomizations[weekStart]
            : undefined;
    const loadPct = custom ? clamp(custom.loadPct, 50, 180) : 100;
    const computedTss = Math.round(baseTss * (loadPct / 100));
    const defaultSessions = Math.max(
      1,
      Math.min(
        7,
        sportFamily === "strength"
          ? gymTrainingDaysPerWeek
          : sportFamily === "technical"
            ? technicalTrainingDaysPerWeek
            : sportFamily === "lifestyle"
              ? lifestyleTrainingDaysPerWeek
              : phase.sessionsPerWeek,
      ),
    );
    const sessionsFromCustom = custom?.sessionsPerWeek;
    const computedSessions = Math.max(1, Math.min(7, sessionsFromCustom ?? defaultSessions));
    const ov = weeklyProgramOverrides[weekStart];
    const autoRetune = adaptationControlPct > 0 ? viryaRetuneProposal?.targetWeeks.find((week) => week.weekStart === weekStart) : null;
    return {
      weeklyTss: autoRetune?.proposedTss ?? ov?.weeklyTss ?? computedTss,
      sessions: autoRetune?.proposedSessions ?? (ov?.sessionsPerWeek != null ? clamp(ov.sessionsPerWeek, 1, 7) : computedSessions),
      hoursPerWeek: ov?.hoursPerWeek,
      objectives: autoRetune?.objectives ?? ov?.objectives ?? [],
    };
  }

  function viryaPatternForSessions(): ViryaWeekdayPatternId | undefined {
    return viryaWeekdayPattern === "auto" ? undefined : viryaWeekdayPattern;
  }

  const microcyclePreviewRows = useMemo(() => {
    const phase = phases[0];
    if (!phase) return [];
    const weekStart = phase.start;
    const wm = resolveWeekMetrics(phase, 0, weekStart);
    const weekPlan = buildWeekGenerationPlan({
      weeklyBudgetLoad: wm.weeklyTss,
      sessionsPerWeek: wm.sessions,
      phase: phase.phase as ViryaMacroPhase,
      family: sportFamily,
      patternId: viryaPatternForSessions(),
    });
    const effectivePattern =
      viryaWeekdayPattern === "auto"
        ? defaultWeekdayPatternForSessions(wm.sessions)
        : viryaWeekdayPattern;
    const gymModules =
      sportFamily === "strength"
        ? activeGymModulesForWeek(
            ensureGymWeekModules(gymDayModules.length ? gymDayModules : buildGymDayModules()),
            wm.sessions,
          )
        : [];
    const technicalMods =
      sportFamily === "technical"
        ? technicalDayModules.length
          ? technicalDayModules
          : buildTechnicalDayModules(wm.sessions)
        : [];
    const lifestyleMods =
      sportFamily === "lifestyle"
        ? lifestyleDayModules.length
          ? lifestyleDayModules
          : buildLifestyleDayModules(wm.sessions)
        : [];
    return weekPlan.slots.map((slot) => {
      const gymModule =
        sportFamily === "strength" ? gymModules[slot.slotIndex % Math.max(1, gymModules.length)] : undefined;
      const technicalModule =
        sportFamily === "technical"
          ? technicalMods[slot.slotIndex % Math.max(1, technicalMods.length)]
          : undefined;
      const lifestyleModule =
        sportFamily === "lifestyle"
          ? lifestyleMods[slot.slotIndex % Math.max(1, lifestyleMods.length)]
          : undefined;
      const brief = buildViryaBuilderSessionBrief({
        weekStart,
        slot,
        sessionsInWeek: weekPlan.slots.length,
        weeklyBudgetLoad: weekPlan.weeklyBudgetLoad,
        weekdayPatternId: weekPlan.patternId,
        phase: phase.phase as ViryaMacroPhase,
        family: sportFamily,
        discipline: sportFamily === "strength" ? "Gym" : discipline,
        planName: planName.trim() || "VIRYA",
        phaseLabel: phaseLabels[phase.phase],
        sessionName: `${planName.trim() || "VIRYA"} · ${phaseLabels[phase.phase]}`,
        gymPrimaryGoal: sportFamily === "strength" ? gymPrimaryGoal : undefined,
        weekObjectives: wm.objectives,
        contextHint: (viryaContext?.strategyHints ?? []).slice(0, 4).join(","),
      });
      const derived = deriveViryaBuilderInstructions({
        brief,
        gymModule,
        technicalModule,
        lifestyleModule,
      });
      return {
        day: weekdayLabel(slot.weekdayOffset),
        role: slot.sessionRole,
        load: slot.loadTarget,
        adapt: derived.adaptationTarget,
        patternId: effectivePattern,
        loadSum: weekPlan.loadSum,
      };
    });
  }, [
    phases,
    sportFamily,
    viryaWeekdayPattern,
    gymDayModules,
    gymPrimaryGoal,
    gymTrainingDaysPerWeek,
    technicalDayModules,
    technicalTrainingDaysPerWeek,
    lifestyleDayModules,
    lifestyleTrainingDaysPerWeek,
    discipline,
    planName,
    weeklyProgramOverrides,
    gymWeekCustomizations,
    technicalWeekCustomizations,
    lifestyleWeekCustomizations,
    adaptationControlPct,
    viryaRetuneProposal,
    viryaContext?.strategyHints,
  ]);

  return (
    <div id="virya-orchestrator" className="mt-6 scroll-mt-24 space-y-6">
      <ViryaHeroHeader
        planName={planName}
        setPlanName={setPlanName}
        viryaHeroStats={viryaHeroStats}
      />

      <ViryaStatusBanners
        error={error}
        success={success}
        contextLoading={contextLoading}
      />

      {selectedAthleteId ? (
        <ViryaCalendarPlansCard
          viryaPlansLoading={viryaPlansLoading}
          viryaCalendarPlans={viryaCalendarPlans}
          viryaPlanDeletingTag={viryaPlanDeletingTag}
          selectedAthleteId={selectedAthleteId}
          setViryaPlanDeletingTag={setViryaPlanDeletingTag}
          setError={setError}
          setSuccess={setSuccess}
          refreshViryaCalendarPlans={refreshViryaCalendarPlans}
        />
      ) : null}

      <nav className="flex flex-wrap gap-2 border-b border-white/10 pb-4" aria-label="Passi Virya">
        {(
          [
            { n: 1 as const, label: "Macro", desc: "A · B · C · D" },
            { n: 2 as const, label: "Sport", desc: "Disciplina" },
            { n: 3 as const, label: "Periodo", desc: "Date piano" },
            { n: 4 as const, label: "Stagione", desc: "Cardine · eventi · fasi" },
            { n: 5 as const, label: "Settimane", desc: "Stimoli · griglia · Calendar" },
          ] as const
        ).map((s) => (
          <button
            key={s.n}
            type="button"
            onClick={() => setViryaStep(s.n)}
            className={cn(
              "flex min-w-[128px] flex-1 flex-col items-start rounded-xl border px-3 py-2.5 text-left transition sm:min-w-[150px]",
              viryaStep === s.n
                ? "border-cyan-400/50 bg-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.08)]"
                : "border-white/10 bg-black/25 hover:border-white/20",
            )}
          >
            <span className="text-[0.6rem] font-bold uppercase tracking-wider text-slate-500">Passo {s.n}</span>
            <span className="text-sm font-semibold text-white">{s.label}</span>
            <span className="text-[0.7rem] leading-tight text-slate-500">{s.desc}</span>
          </button>
        ))}
      </nav>

      {viryaStep === 1 ? (
        <ViryaMacroFamilyStep
          sportFamily={sportFamily}
          setSportFamily={setSportFamily}
          setDiscipline={setDiscipline}
          setSportTargetValue={setSportTargetValue}
          setViryaStep={setViryaStep}
        />
      ) : null}

      {viryaStep === 2 ? (
        <ViryaSportDisciplineStep
          sportFamily={sportFamily}
          familySports={familySports}
          discipline={discipline}
          setDiscipline={setDiscipline}
          setSportTargetValue={setSportTargetValue}
          setViryaStep={setViryaStep}
        />
      ) : null}

      {viryaStep === 3 ? (
        <ViryaPlanPeriodStep
          planWindowStart={planWindowStart}
          setPlanWindowStart={setPlanWindowStart}
          planWindowEnd={planWindowEnd}
          setPlanWindowEnd={setPlanWindowEnd}
          planWindowWeekCount={planWindowWeekCount}
          applyPlanWindowPreset={applyPlanWindowPreset}
          applyPlanPeriod={applyPlanPeriod}
          setViryaStep={setViryaStep}
        />
      ) : null}

      {viryaStep === 4 ? (
        <div className="space-y-6">
          <ViryaSeasonObjectiveStep
            objective={objective}
            setObjective={setObjective}
          />

          <ViryaEventsCard
            races={races}
            addRace={addRace}
            updateRace={updateRace}
            removeRace={removeRace}
          />

          <ViryaMacroPeriodsCard
            planWindowStart={planWindowStart}
            planWindowEnd={planWindowEnd}
            applyClassicPeriodization={applyClassicPeriodization}
          />

          <div className="flex flex-wrap justify-between gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5"
              onClick={() => setViryaStep(3)}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden /> Indietro
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/45 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/25"
              onClick={() => setViryaStep(5)}
            >
              Griglia settimanale e Calendar <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      {viryaStep === 5 ? (
        <div className="space-y-6">
          <ViryaContextKpiCard
            viryaSummaryCards={viryaSummaryCards}
          />

          {operationalContext ? (
            <ViryaOperationalModulationCard
              operationalContext={operationalContext}
              recoverySummary={recoverySummary}
              bioenergeticModulation={bioenergeticModulation}
              adaptationLoop={adaptationLoop}
            />
          ) : null}

          {viryaApprovedPatches.length > 0 ? (
            <ViryaApprovedDecisionsCard
              viryaApprovedPatches={viryaApprovedPatches}
              viryaRetuneDirective={viryaRetuneDirective}
              viryaRetuneProposalVm={viryaRetuneProposalVm}
              viryaRetuneProposal={viryaRetuneProposal}
              adaptationControlPct={adaptationControlPct}
              setAdaptationControlPct={setAdaptationControlPct}
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/15 px-4 py-3 text-sm">
            <span className="font-semibold text-fuchsia-200">Riepilogo passi 1–4</span>
            <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1 text-slate-200">
              {sportFamilies.find((x) => x.id === sportFamily)?.label ?? sportFamily}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-white">{discipline}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">
              {planWindowStart} → {planWindowEnd}
            </span>
            <span className="text-slate-600">·</span>
            <Link
              href="/training/builder?src=virya"
              className="text-xs font-semibold text-pink-300 underline-offset-2 hover:text-pink-200 hover:underline"
            >
              Builder sessione
            </Link>
            <button
              type="button"
              className="ml-auto text-xs font-semibold text-cyan-300 hover:text-cyan-200"
              onClick={() => setViryaStep(1)}
            >
              Modifica flusso guidato
            </button>
          </div>

          <ViryaWeeklyProgramTable
            programWeekRows={programWeekRows}
            planWindowWeekCount={planWindowWeekCount}
            patchWeeklyOverride={patchWeeklyOverride}
            clearWeeklyHours={clearWeeklyHours}
            toggleWeekObjective={toggleWeekObjective}
          />

          <ViryaMicrocyclePreviewCard
            viryaWeekdayPattern={viryaWeekdayPattern}
            setViryaWeekdayPattern={setViryaWeekdayPattern}
            microcyclePreviewRows={microcyclePreviewRows}
          />

          <ViryaSaveToCalendarCard
            planName={planName}
            replacePrevious={replacePrevious}
            setReplacePrevious={setReplacePrevious}
            generateOnCalendar={generateOnCalendar}
            saving={saving}
            selectedAthleteId={selectedAthleteId}
            phases={phases}
          />

          <ViryaSaveWeekToLibraryCard
            libraryWeekStart={libraryWeekStart}
            setLibraryWeekStart={setLibraryWeekStart}
            savingLibrary={savingLibrary}
            programWeekRows={programWeekRows}
            saveWeekToLibrary={saveWeekToLibrary}
            saving={saving}
            selectedAthleteId={selectedAthleteId}
          />

          <div className="flex justify-start">
            <button
              type="button"
              className="text-xs font-semibold text-slate-400 underline decoration-white/20 hover:text-cyan-300"
              onClick={() => setViryaStep(4)}
            >
              ← Torna a obiettivo cardine, eventi e macro-fasi
            </button>
          </div>

      <section className="viz-grid">
        <article className="viz-card builder-panel rounded-2xl !border-pink-500/30 !bg-black p-5 text-white shadow-[inset_0_1px_0_rgba(251,146,60,0.08)]">
          <h3 className="viz-title">Piano annuale</h3>
          <div className="form-grid-two">
            <label className="form-field">
              <span>Nome piano</span>
              <input className="form-input" value={planName} onChange={(e) => setPlanName(e.target.value)} />
            </label>
            <label className="form-field">
              <span>{sportFamily === "strength" ? "Modulo" : "Disciplina"}</span>
              <input
                className="form-input"
                value={
                  sportFamily === "strength"
                    ? "B · Gym & Performance"
                    : sportFamily === "technical"
                      ? "C · Sport tecnici/tattici"
                      : sportFamily === "lifestyle"
                        ? "D · Lifestyle"
                        : discipline
                }
                onChange={(e) => setDiscipline(e.target.value)}
                disabled={sportFamily === "strength" || sportFamily === "technical" || sportFamily === "lifestyle"}
              />
            </label>
          </div>
          <label className="form-field" style={{ marginTop: "10px" }}>
            <span>Obiettivo piano annuale (coach)</span>
            <textarea
              className="form-textarea min-h-[5rem] w-full rounded-xl border border-pink-500/25 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30"
              rows={4}
              placeholder="Descrivi l’obiettivo cardine della stagione per l’atleta…"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
            />
            <span className="mt-1 block text-[0.7rem] text-slate-500">Modificabile in qualsiasi momento; viene propagato nelle note di generazione.</span>
          </label>
          {sportFamily === "aerobic" ? (
            <ViryaAerobicNote />
          ) : sportFamily === "strength" ? (
            <ViryaStrengthConfigBlock
              gymPlanStart={gymPlanStart}
              setGymPlanStart={setGymPlanStart}
              gymPlanEnd={gymPlanEnd}
              setGymPlanEnd={setGymPlanEnd}
              gymMacroPhaseCount={gymMacroPhaseCount}
              setGymMacroPhaseCount={setGymMacroPhaseCount}
              regenerateGymMacroPlan={regenerateGymMacroPlan}
              selectedGymWeekStart={selectedGymWeekStart}
              setSelectedGymWeekStart={setSelectedGymWeekStart}
              programWeekRows={programWeekRows}
              selectedWeekConfig={selectedWeekConfig}
              updateSelectedWeekConfig={updateSelectedWeekConfig}
              setGymTrainingDaysPerWeek={setGymTrainingDaysPerWeek}
              gymPrimaryGoal={gymPrimaryGoal}
              setGymPrimaryGoal={setGymPrimaryGoal}
              loadStatusLabel={loadStatusLabel}
            />
          ) : sportFamily === "technical" ? (
            <ViryaTechnicalConfigBlock
              technicalPlanStart={technicalPlanStart}
              setTechnicalPlanStart={setTechnicalPlanStart}
              technicalPlanEnd={technicalPlanEnd}
              setTechnicalPlanEnd={setTechnicalPlanEnd}
              technicalMacroPhaseCount={technicalMacroPhaseCount}
              setTechnicalMacroPhaseCount={setTechnicalMacroPhaseCount}
              regenerateTechnicalMacroPlan={regenerateTechnicalMacroPlan}
              selectedTechnicalWeekStart={selectedTechnicalWeekStart}
              setSelectedTechnicalWeekStart={setSelectedTechnicalWeekStart}
              programWeekRows={programWeekRows}
              selectedTechnicalWeekConfig={selectedTechnicalWeekConfig}
              updateSelectedTechnicalWeekConfig={updateSelectedTechnicalWeekConfig}
              loadStatusLabel={loadStatusLabel}
            />
          ) : (
            <ViryaLifestyleConfigBlock
              lifestylePlanStart={lifestylePlanStart}
              setLifestylePlanStart={setLifestylePlanStart}
              lifestylePlanEnd={lifestylePlanEnd}
              setLifestylePlanEnd={setLifestylePlanEnd}
              lifestyleMacroPhaseCount={lifestyleMacroPhaseCount}
              setLifestyleMacroPhaseCount={setLifestyleMacroPhaseCount}
              regenerateLifestyleMacroPlan={regenerateLifestyleMacroPlan}
              selectedLifestyleWeekStart={selectedLifestyleWeekStart}
              setSelectedLifestyleWeekStart={setSelectedLifestyleWeekStart}
              programWeekRows={programWeekRows}
              selectedLifestyleWeekConfig={selectedLifestyleWeekConfig}
              updateSelectedLifestyleWeekConfig={updateSelectedLifestyleWeekConfig}
              loadStatusLabel={loadStatusLabel}
            />
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-orange-400/50 bg-orange-500/15 px-3 py-1.5 text-xs font-semibold text-orange-100 hover:bg-orange-500/25"
              onClick={autoTuneFromGoal}
            >
              Auto-tune fasi dal target
            </button>
          </div>
          <ViryaPhaseRecapGrid
            phases={phases}
            strengthPhaseLoadHints={strengthPhaseLoadHints}
          />
        </article>

      </section>

      <ViryaPhasesTable
        phases={phases}
        sportFamily={sportFamily}
        strengthPhaseLoadHints={strengthPhaseLoadHints}
        addPhase={addPhase}
        updatePhase={updatePhase}
        removePhase={removePhase}
      />

      <section className="viz-grid">
        <ViryaAnnualLoadProjectionCard
          annualLoad={annualLoad}
          maxAnnual={maxAnnual}
        />
        <ViryaMasterPlanCard
          programWeekRows={programWeekRows}
        />
        <article className="viz-card builder-panel">
          <h3 className="viz-title">Deploy piano su Calendar</h3>
          <p style={{ margin: "0 0 10px 0", color: "var(--empathy-text-muted)", fontSize: "13px" }}>
            VIRYA genera le sedute previste. Dopo esecuzione reale, EMPATHY confronta previsto/eseguito e riadatta training + nutrition + fueling.
          </p>
          <label className="form-field" style={{ marginBottom: "10px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input type="checkbox" checked={replacePrevious} onChange={(e) => setReplacePrevious(e.target.checked)} />
              Sostituisci sessioni VIRYA già sul calendario nello stesso intervallo di date (cancella marker [VIRYA:…] prima di reinserire)
            </span>
          </label>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void generateOnCalendar()}
              disabled={saving || !selectedAthleteId || phases.length === 0}
              title={
                !selectedAthleteId
                  ? "Seleziona / carica contesto atleta"
                  : phases.length === 0
                    ? "Aggiungi fasi (passo 4) prima di generare"
                    : undefined
              }
            >
              {saving ? "Generazione..." : "Genera piano annuale"}
            </button>
            <Link href="/training/calendar" style={{ color: "var(--empathy-primary)", textDecoration: "none", alignSelf: "center" }}>
              Apri Calendar →
            </Link>
          </div>
        </article>
      </section>
        </div>
      ) : null}
    </div>
  );
}
