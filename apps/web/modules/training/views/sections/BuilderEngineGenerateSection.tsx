"use client";

import {
  Bike,
  CalendarRange,
  Clock,
  Flame,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { Dispatch, SetStateAction } from "react";
import { BuilderCalendarSaveConfirm } from "@/components/training/BuilderCalendarSaveConfirm";
import { GymExerciseMediaThumb } from "@/components/training/GymExerciseMediaThumb";
import { SessionBlockIntensityChart } from "@/components/training/SessionBlockIntensityChart";
import { Pro2Button } from "@/components/ui/empathy";
import type { Pro2GymManualRow } from "@/lib/training/builder/pro2-gym-manual-plan";
import { PRO2_GYM_EXECUTION_STYLES } from "@/lib/training/builder/gym-execution-styles";
import {
  TECHNICAL_ATHLETIC_QUALITY_OPTIONS,
  type AdaptationTarget,
  type GymContractionEmphasis,
  type GymEquipmentChannel,
  type TechnicalAthleticQualityId,
  type TechnicalGameContext,
  type TechnicalWorkPhase,
} from "@/lib/training/engine";
import type { generateBuilderSession } from "@/modules/training/services/training-engine-api";
import type { ChartSegment } from "@/lib/training/engine/block-chart-segments";
import type { SportMacroId } from "@/lib/training/builder/sport-macro-palette";
import {
  ADAPTATION_OPTIONS,
  ENGINE_QUICK_GYM,
  GYM_EQUIPMENT_CHIPS,
  GYM_CONTRACTION_CHIPS,
  ENGINE_QUICK_TECHNICAL,
  ENGINE_QUICK_LIFESTYLE,
  type EngineGenerateOverrides,
} from "@/lib/training/training-builder-rich-kit";

type BuilderGenResult = Awaited<ReturnType<typeof generateBuilderSession>>;

/**
 * Step 2 "Genera sessione" del builder seduta (decomposizione del God-component
 * TrainingBuilderRichPageView). Render-only: stato nel padre, passato via props.
 */
export type BuilderEngineGenerateSectionProps = {
  activeMacroId: SportMacroId;
  currentSportLabel: string;
  athleteId: string | null;
  genBusy: boolean;
  runGenerate: (overrides?: EngineGenerateOverrides) => Promise<void>;
  gymEquipChannels: GymEquipmentChannel[];
  setGymEquipChannels: Dispatch<SetStateAction<GymEquipmentChannel[]>>;
  gymContraction: GymContractionEmphasis;
  setGymContraction: Dispatch<SetStateAction<GymContractionEmphasis>>;
  gymAutoExecutionStyle: string;
  setGymAutoExecutionStyle: Dispatch<SetStateAction<string>>;
  adaptation: AdaptationTarget;
  setAdaptation: Dispatch<SetStateAction<AdaptationTarget>>;
  adaptationAllowed: AdaptationTarget[];
  phase: "base" | "build" | "peak" | "taper";
  setPhase: Dispatch<SetStateAction<"base" | "build" | "peak" | "taper">>;
  sessionMinutes: number;
  setSessionMinutes: Dispatch<SetStateAction<number>>;
  sport: string;
  setSport: Dispatch<SetStateAction<string>>;
  techWorkPhase: TechnicalWorkPhase;
  setTechWorkPhase: Dispatch<SetStateAction<TechnicalWorkPhase>>;
  techGameContext: TechnicalGameContext;
  setTechGameContext: Dispatch<SetStateAction<TechnicalGameContext>>;
  techQualities: TechnicalAthleticQualityId[];
  setTechQualities: Dispatch<SetStateAction<TechnicalAthleticQualityId[]>>;
  genErr: string | null;
  genResult: BuilderGenResult | null;
  gymManualRows: Pro2GymManualRow[];
  manualTssPreview: number;
  genChartSegments: ChartSegment[];
  genTssPreview: number;
  plannedDate: string;
  setPlannedDate: Dispatch<SetStateAction<string>>;
  saveBusy: boolean;
  saveToCalendar: (targetDate: string) => Promise<void>;
  wahooPushBusy: boolean;
  wahooPushEligible: boolean;
  pushSessionToWahooCloud: () => Promise<void>;
  saveErr: string | null;
  wahooPushErr: string | null;
  wahooPushOk: string | null;
  saveOkId: string | null;
  /** Nasconde la barra salva+Wahoo interna: il salvataggio è accentrato nella
   *  barra «Salva» unica dell'orchestratore. Il preview della sessione resta. */
  hideSaveBar?: boolean;
  showTech: boolean;
};

export function BuilderEngineGenerateSection({
  activeMacroId,
  currentSportLabel,
  athleteId,
  genBusy,
  runGenerate,
  gymEquipChannels,
  setGymEquipChannels,
  gymContraction,
  setGymContraction,
  gymAutoExecutionStyle,
  setGymAutoExecutionStyle,
  adaptation,
  setAdaptation,
  adaptationAllowed,
  phase,
  setPhase,
  sessionMinutes,
  setSessionMinutes,
  sport,
  setSport,
  techWorkPhase,
  setTechWorkPhase,
  techGameContext,
  setTechGameContext,
  techQualities,
  setTechQualities,
  genErr,
  genResult,
  gymManualRows,
  manualTssPreview,
  genChartSegments,
  genTssPreview,
  plannedDate,
  setPlannedDate,
  saveBusy,
  saveToCalendar,
  wahooPushBusy,
  wahooPushEligible,
  pushSessionToWahooCloud,
  saveErr,
  wahooPushErr,
  wahooPushOk,
  saveOkId,
  showTech,
  hideSaveBar,
}: BuilderEngineGenerateSectionProps) {
  const t = useTranslations("BuilderEngineGenerateSection");
  return (
    <section
      aria-label={t("sectionAriaLabel")}
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
        {t("generateSession")}
      </h2>
      {activeMacroId === "strength" ? (
        <p className="mt-1 text-sm text-gray-400">
          {t.rich("introStrength", {
            sport: currentSportLabel,
            cat: (chunks) => <span className="text-orange-200">{chunks}</span>,
            disc: (chunks) => <span className="font-semibold text-orange-200">{chunks}</span>,
          })}
        </p>
      ) : activeMacroId === "technical" ? (
        <p className="mt-1 text-sm text-gray-400">
          {t.rich("introTechnical", {
            sport: currentSportLabel,
            tss: (chunks) => <span className="text-orange-200/95">{chunks}</span>,
            disc: (chunks) => <span className="font-semibold text-orange-200">{chunks}</span>,
          })}
        </p>
      ) : activeMacroId === "lifestyle" ? (
        <p className="mt-1 text-sm text-gray-400">
          {t.rich("introLifestyle", {
            sport: currentSportLabel,
            disc: (chunks) => <span className="font-semibold text-orange-200">{chunks}</span>,
          })}
        </p>
      ) : (
        <p className="mt-1 text-sm text-gray-400">
          {t("introAerobic")}
        </p>
      )}

      {activeMacroId === "strength" ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">{t("generativePresets")}</p>
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
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("equipmentLibraryFilter")}</p>
            <p className="mt-1 text-xs text-gray-500">
              {t("equipmentHint")}
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
              {t("contractionStyle")}
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
              {t("executionStyleLabel")}
              <select
                className="rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                value={gymAutoExecutionStyle}
                onChange={(e) => setGymAutoExecutionStyle(e.target.value)}
              >
                <option value="">{t("executionStyleStandard")}</option>
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
              <span className="underline decoration-orange-400/50 decoration-1 underline-offset-2">{t("durationPhaseAdaptation")}</span>
              <span className="ml-2 text-xs text-gray-500">{t("optional")}</span>
            </summary>
            <div className="flex flex-wrap items-end gap-3 border-t border-white/10 px-4 pb-4 pt-3">
              <div className="flex min-w-[11rem] flex-1 items-start gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 p-3 sm:min-w-[10rem]">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" aria-hidden />
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                  {t("adaptationLabel")}
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
                  {t("phaseLabel")}
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
                  {t("minLabel")}
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
            {genBusy ? t("generating") : t("generateWithCurrentSettings")}
          </Pro2Button>
        </div>
      ) : activeMacroId === "technical" ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">{t("generativePresets")}</p>
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
              {t("modularStructureMacroC")}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {t("modularStructureHint")}
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("workPhase")}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(
                    [
                      { id: "technique" as const, label: t("workPhaseTechnique") },
                      { id: "tactics" as const, label: t("workPhaseTactics") },
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
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("gameContext")}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(
                    [
                      { id: "defensive" as const, label: t("contextDefensive") },
                      { id: "build_up" as const, label: t("contextBuildUp") },
                      { id: "offensive" as const, label: t("contextOffensive") },
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
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("athleticQualityMultiple")}</p>
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
              <span className="underline decoration-orange-400/50 decoration-1 underline-offset-2">{t("durationPhaseAdaptation")}</span>
              <span className="ml-2 text-xs text-gray-500">{t("optional")}</span>
            </summary>
            <div className="flex flex-wrap items-end gap-3 border-t border-white/10 px-4 pb-4 pt-3">
              <div className="flex min-w-[11rem] flex-1 items-start gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 p-3 sm:min-w-[10rem]">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" aria-hidden />
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                  {t("adaptationLabel")}
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
                  {t("phaseLabel")}
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
                  {t("minLabel")}
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
            {genBusy ? t("generating") : t("generateWithCurrentSettings")}
          </Pro2Button>
        </div>
      ) : activeMacroId === "lifestyle" ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">{t("generativePresetsLifestyle")}</p>
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
              <span className="underline decoration-orange-400/50 decoration-1 underline-offset-2">{t("durationPhaseAdaptation")}</span>
              <span className="ml-2 text-xs text-gray-500">{t("optional")}</span>
            </summary>
            <div className="flex flex-wrap items-end gap-3 border-t border-white/10 px-4 pb-4 pt-3">
              <div className="flex min-w-[11rem] flex-1 items-start gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 p-3 sm:min-w-[10rem]">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" aria-hidden />
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                  {t("adaptationLabel")}
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
                  {t("phaseLabel")}
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
                  {t("minLabel")}
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
            {genBusy ? t("generating") : t("generateWithCurrentSettings")}
          </Pro2Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex min-w-[11rem] flex-1 items-start gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 p-3 sm:min-w-[10rem]">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" aria-hidden />
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
              {t("adaptationLabel")}
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
              {t("phaseLabel")}
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
              {t("minLabel")}
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
              {t("sportLabel")}
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
            {genBusy ? t("generating") : t("generateSession")}
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
            {t("dailyAdaptationTitle", { pct: genResult.operationalScaling.loadScalePct })}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/80">
            {genResult.operationalScaling.guidance} {t("dailyAdaptationBody")}
          </p>
        </div>
      ) : null}
      {genResult && "ok" in genResult && genResult.ok ? (
        <div className="mt-6 space-y-4 rounded-xl border border-white/10 bg-black/30 p-4 text-sm">
          {activeMacroId === "strength" ? (
            <div className="space-y-3 rounded-xl border border-orange-500/25 bg-gradient-to-br from-orange-950/20 via-black/40 to-black/60 p-4">
              <p className="text-sm font-semibold text-white">
                {t("generatedCardHeader", { count: gymManualRows.length, tss: manualTssPreview })}
              </p>
              <p className="text-xs text-gray-500">
                {t("generatedCardHint")}
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
                        {(row.chainLabel ?? "").trim() ? ` · ${t("groupPrefix")} ${(row.chainLabel ?? "").trim()}` : ""}
                      </p>
                      {row.quickIncomplete ? (
                        <p className="mt-1 text-[0.65rem] text-orange-300/90">{t("quickCardIncomplete")}</p>
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
                title={t("sessionChartAuto")}
                estimatedTss={genTssPreview}
              />
            </div>
          )}
          {!hideSaveBar && (
            <>
              <div className="flex flex-wrap items-end gap-3 border-b border-white/10 pb-4">
                <label className="flex flex-col gap-1 text-xs text-gray-500">
                  {t("calendarDateLabel")}
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
                  {saveBusy ? t("saving") : t("saveToCalendar")}
                </Pro2Button>
                <Pro2Button
                  type="button"
                  variant="secondary"
                  className="!border-orange-500/30 !bg-orange-500/10 !text-orange-100 hover:!border-orange-400/50 hover:!bg-orange-500/20"
                  disabled={!wahooPushEligible || saveBusy || wahooPushBusy}
                  title={
                    !wahooPushEligible
                      ? t("wahooIneligibleTitle")
                      : undefined
                  }
                  onClick={() => void pushSessionToWahooCloud()}
                >
                  {wahooPushBusy ? t("wahooBusy") : t("sendToWahoo")}
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
            </>
          )}
          {showTech ? <p className="font-mono text-[0.65rem] text-gray-500">{genResult.source}</p> : null}
          <p className="text-gray-300">
            {t("physiologicalProfile")}: {genResult.physiologyPresent ? t("yes") : t("no")} · {t("twin")}: {genResult.twinPresent ? t("yes") : t("no")}
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
  );
}
