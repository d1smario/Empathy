"use client";

import type { Dispatch, SetStateAction } from "react";
import { BuilderGymManualComposer } from "@/components/training/BuilderGymManualComposer";
import { BuilderLifestyleManualComposer } from "@/components/training/BuilderLifestyleManualComposer";
import { BuilderManualComposer } from "@/components/training/BuilderManualComposer";
import { BuilderTechnicalManualComposer } from "@/components/training/BuilderTechnicalManualComposer";
import type { ManualPlanBlock, PlanChartSegment } from "@/lib/training/builder/manual-plan-block";
import type { Pro2GymManualRow } from "@/lib/training/builder/pro2-gym-manual-plan";
import type { Pro2LifestyleManualRow } from "@/lib/training/builder/pro2-lifestyle-manual-plan";
import type { Pro2TechnicalManualRow } from "@/lib/training/builder/pro2-technical-manual-plan";
import type { GeneratedSession } from "@/lib/training/engine/types";
import type {
  TechnicalAthleticQualityId,
  TechnicalGameContext,
  TechnicalWorkPhase,
} from "@/lib/training/engine";
import type { SportMacroId } from "@/lib/training/builder/sport-macro-palette";

/**
 * Switch composer manuale del builder seduta: monta uno dei 4 composer
 * (palestra / tecnico / lifestyle / aerobico) in base a `activeMacroId`.
 * (decomposizione del God-component TrainingBuilderRichPageView).
 * Pura cablatura props→child: stato nel padre, passato via props.
 */
export type BuilderManualComposerSwitchProps = {
  activeMacroId: SportMacroId;
  athleteId: string | null;
  physioHint: string | null;
  gymManualRows: Pro2GymManualRow[];
  setGymManualRows: Dispatch<SetStateAction<Pro2GymManualRow[]>>;
  technicalManualRows: Pro2TechnicalManualRow[];
  setTechnicalManualRows: Dispatch<SetStateAction<Pro2TechnicalManualRow[]>>;
  lifestyleManualRows: Pro2LifestyleManualRow[];
  setLifestyleManualRows: Dispatch<SetStateAction<Pro2LifestyleManualRow[]>>;
  manualPlanBlocks: ManualPlanBlock[];
  setManualPlanBlocks: Dispatch<SetStateAction<ManualPlanBlock[]>>;
  manualActiveIndex: number;
  setManualActiveIndex: Dispatch<SetStateAction<number>>;
  intensityUnit: "watt" | "hr";
  setIntensityUnit: Dispatch<SetStateAction<"watt" | "hr">>;
  ftpW: number;
  setFtpW: Dispatch<SetStateAction<number>>;
  hrMax: number;
  setHrMax: Dispatch<SetStateAction<number>>;
  lengthMode: "time" | "distance";
  setLengthMode: Dispatch<SetStateAction<"time" | "distance">>;
  speedRefKmh: number;
  setSpeedRefKmh: Dispatch<SetStateAction<number>>;
  manualSessionName: string;
  setManualSessionName: Dispatch<SetStateAction<string>>;
  manualChartSegments: PlanChartSegment[];
  plannedDate: string;
  setPlannedDate: Dispatch<SetStateAction<string>>;
  manualSessionDurationMinutes: number;
  setManualSessionDurationMinutes: Dispatch<SetStateAction<number>>;
  sport: string;
  currentSportLabel: string;
  techWorkPhase: TechnicalWorkPhase;
  techGameContext: TechnicalGameContext;
  techQualities: TechnicalAthleticQualityId[];
  manualSaveBusy: boolean;
  saveManualToCalendar: (targetDate: string) => Promise<void>;
  manualSaveErr: string | null;
  manualSaveOkId: string | null;
  manualSession: GeneratedSession | null;
  manualTssPreview: number;
  /** Nasconde la barra salva interna del composer: il salvataggio è accentrato
   *  nella barra «Salva» unica dell'orchestratore. */
  hideSaveBar?: boolean;
};

export function BuilderManualComposerSwitch({
  activeMacroId,
  athleteId,
  physioHint,
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
  manualSaveBusy,
  saveManualToCalendar,
  manualSaveErr,
  manualSaveOkId,
  manualSession,
  manualTssPreview,
  hideSaveBar,
}: BuilderManualComposerSwitchProps) {
  return (
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
            hideSaveBar={hideSaveBar}
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
            hideSaveBar={hideSaveBar}
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
            hideSaveBar={hideSaveBar}
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
            hideSaveBar={hideSaveBar}
            estimatedTss={manualTssPreview}
          />
        )}
        </div>
  );
}
