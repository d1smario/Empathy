"use client";

import { useCallback, useMemo, useState } from "react";
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
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { hydrateBuilderStateFromLibraryContract } from "@/lib/training/library/hydrate-builder-from-library-contract";
import { estimateTssFromSegments } from "@/lib/training/builder/tss-estimate";
import { macroIdForSport, SPORT_MACRO_SECTORS } from "@/lib/training/builder/sport-macro-palette";
import {
  ADAPTATION_BY_MACRO,
  defaultAdaptationForMacro,
  initialManualPlanBlocks,
  localCalendarDateString,
} from "@/lib/training/training-builder-rich-kit";
import type {
  AdaptationTarget,
  TechnicalAthleticQualityId,
  TechnicalGameContext,
  TechnicalWorkPhase,
} from "@/lib/training/engine";
import type { BuilderManualComposerSwitchProps } from "@/modules/training/views/sections/BuilderManualComposerSwitch";

/** Solo le prop di stato: hideSaveBar/intro/footer restano al montante (modale). */
export type BuilderComposerBag = Omit<
  BuilderManualComposerSwitchProps,
  "hideSaveBar" | "intro" | "footer"
>;

type BuilderPhase = "base" | "build" | "peak" | "taper";

function normalizePhase(value: string | undefined): BuilderPhase {
  return value === "base" || value === "build" || value === "peak" || value === "taper" ? value : "base";
}

/**
 * Stato composer AUTONOMO per il modale «Modifica seduta pianificata» — replica gli
 * useState + i memo derivati di TrainingBuilderRichPageView SENZA importarne lo stato
 * (vincolo: il Builder quotidiano non deve cambiare). Copre solo l'EDITING della tela:
 * niente start-points / generate / libreria / save-to-calendar (quelli restano nel
 * Builder). `hydrateFromContract` popola la tela da un contratto; `buildContract`
 * ricostruisce il Pro2BuilderSessionContract dallo stato corrente per activeMacroId.
 */
export function useBuilderComposerState({ athleteId }: { athleteId: string | null }) {
  const [sport, setSport] = useState("cycling");
  const activeMacroId = useMemo(() => macroIdForSport(sport), [sport]);
  const currentSportLabel = useMemo(() => {
    const sector = SPORT_MACRO_SECTORS.find((x) => x.id === activeMacroId);
    const chip = sector?.sports.find((c) => c.sport.trim().toLowerCase() === sport.trim().toLowerCase());
    return chip?.label ?? sport;
  }, [activeMacroId, sport]);

  const [manualSessionName, setManualSessionName] = useState("Seduta coach Pro 2");
  const [manualPlanBlocks, setManualPlanBlocks] = useState<ManualPlanBlock[]>(initialManualPlanBlocks);
  const [gymManualRows, setGymManualRows] = useState<Pro2GymManualRow[]>([]);
  const [lifestyleManualRows, setLifestyleManualRows] = useState<Pro2LifestyleManualRow[]>([]);
  const [technicalManualRows, setTechnicalManualRows] = useState<Pro2TechnicalManualRow[]>([]);
  const [manualActiveIndex, setManualActiveIndex] = useState(-1);

  const [intensityUnit, setIntensityUnit] = useState<"watt" | "hr">("watt");
  const [ftpW, setFtpW] = useState(250);
  const [hrMax, setHrMax] = useState(185);
  const [lengthMode, setLengthMode] = useState<"time" | "distance">("time");
  const [speedRefKmh, setSpeedRefKmh] = useState(32);

  const [plannedDate, setPlannedDate] = useState(() => localCalendarDateString());
  const [scheduledTime, setScheduledTime] = useState("12:00");
  const [manualSessionDurationMinutes, setManualSessionDurationMinutes] = useState(60);

  const [adaptation, setAdaptation] = useState<AdaptationTarget>("mitochondrial_density");
  const [phase, setPhase] = useState<BuilderPhase>("base");

  const [techWorkPhase, setTechWorkPhase] = useState<TechnicalWorkPhase>("technique");
  const [techGameContext, setTechGameContext] = useState<TechnicalGameContext>("build_up");
  const [techQualities, setTechQualities] = useState<TechnicalAthleticQualityId[]>([]);

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

  /** Idrata la tela dal contratto builder (setta sport PRIMA dei blocchi così activeMacroId è coerente). */
  const hydrateFromContract = useCallback((contract: Pro2BuilderSessionContract) => {
    const state = hydrateBuilderStateFromLibraryContract(contract);
    setSport(state.sport);
    setManualSessionName(state.manualSessionName);
    setManualSessionDurationMinutes(state.manualSessionDurationMinutes);
    setScheduledTime(state.scheduledTime ?? "12:00");
    setIntensityUnit(state.intensityUnit);
    setFtpW(state.ftpW);
    setHrMax(state.hrMax);
    setLengthMode(state.lengthMode);
    setSpeedRefKmh(state.speedRefKmh);
    setManualPlanBlocks(
      state.manualPlanBlocks.length > 0
        ? state.manualPlanBlocks
        : [defaultManualPlanBlock("steady", state.manualSessionName)],
    );
    setGymManualRows(state.gymManualRows);
    setTechnicalManualRows(state.technicalManualRows);
    setLifestyleManualRows(state.lifestyleManualRows);
    setManualActiveIndex(-1);
    // Round-trip adattamento / fase / focus tecnico dal contratto (non coperti dall'idratatore libreria).
    const allowed = ADAPTATION_BY_MACRO[state.macroId];
    const adapt = contract.adaptationTarget as AdaptationTarget | undefined;
    setAdaptation(adapt && allowed.includes(adapt) ? adapt : defaultAdaptationForMacro(state.macroId));
    setPhase(normalizePhase(contract.phase));
    if (contract.technicalModuleFocus) {
      setTechWorkPhase(contract.technicalModuleFocus.workPhase);
      setTechGameContext(contract.technicalModuleFocus.gameContext);
      setTechQualities(contract.technicalModuleFocus.athleticQualities ?? []);
    }
  }, []);

  /** Costruisce il Pro2BuilderSessionContract dallo stato corrente per activeMacroId. */
  const buildContract = useCallback((): Pro2BuilderSessionContract => {
    const renderProfile = {
      intensityUnit,
      ftpW: Math.max(1, ftpW),
      hrMax: Math.max(1, hrMax),
      lengthMode,
      speedRefKmh: Math.max(1, speedRefKmh),
    };
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
    activeMacroId,
    intensityUnit,
    ftpW,
    hrMax,
    lengthMode,
    speedRefKmh,
    gymManualRows,
    lifestyleManualRows,
    technicalManualRows,
    manualPlanBlocks,
    currentSportLabel,
    sport,
    manualSessionName,
    adaptation,
    phase,
    scheduledTime,
    techWorkPhase,
    techGameContext,
    techQualities,
  ]);

  /** Prop-bag per <BuilderManualComposerSwitch>. Le prop di salvataggio sono neutre:
   *  il modale rende hideSaveBar + il proprio footer «Salva». */
  const composerBag: BuilderComposerBag = {
    activeMacroId,
    athleteId,
    physioHint: null,
    gymManualRows,
    setGymManualRows,
    technicalManualRows,
    setTechnicalManualRows,
    lifestyleManualRows,
    setLifestyleManualRows,
    manualPlanBlocks,
    setManualPlanBlocks,
    manualActiveIndex,
    setManualActiveIndex,
    intensityUnit,
    setIntensityUnit,
    ftpW,
    setFtpW,
    hrMax,
    setHrMax,
    lengthMode,
    setLengthMode,
    speedRefKmh,
    setSpeedRefKmh,
    manualSessionName,
    setManualSessionName,
    manualChartSegments,
    plannedDate,
    setPlannedDate,
    manualSessionDurationMinutes,
    setManualSessionDurationMinutes,
    sport,
    currentSportLabel,
    techWorkPhase,
    techGameContext,
    techQualities,
    manualSaveBusy: false,
    saveManualToCalendar: async () => {},
    manualSaveErr: null,
    manualSaveOkId: null,
    manualSession,
    manualTssPreview,
  };

  return { composerBag, hydrateFromContract, buildContract, activeMacroId };
}
