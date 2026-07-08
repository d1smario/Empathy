"use client";

import { FileText, Plus, Sparkles, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { LifestylePracticeMediaThumb } from "@/components/training/LifestylePracticeMediaThumb";
import { BuilderCalendarSaveConfirm } from "@/components/training/BuilderCalendarSaveConfirm";
import { SessionBlockIntensityChart } from "@/components/training/SessionBlockIntensityChart";
import { lifestyleV1FallbackImageForCategory } from "@/lib/training/builder/lifestyle-media";
import {
  defaultPro2LifestyleManualRow,
  rowFromLifestylePlaybookEntry,
  type Pro2LifestyleManualRow,
} from "@/lib/training/builder/pro2-lifestyle-manual-plan";
import {
  getLifestylePlaybookForSport,
  lifestyleCategoryLabel,
  type LifestylePlaybookEntry,
  type LifestylePracticeCategory,
} from "@/lib/training/builder/lifestyle-playbook-catalog";
import type { ChartSegment } from "@/lib/training/engine/block-chart-segments";
import { SESSION_DURATION_CHOICES } from "@/lib/training/builder/session-duration-choices";
const ROUND_CHIP_PRESETS = [1, 2, 3, 4, 5, 6] as const;
const REST_CHIP_PRESETS = [0, 20, 30, 45, 60, 90, 120] as const;
const RPE_CHIP_PRESETS = [3, 4, 5, 6, 7] as const;

const EXECUTION_QUICK_CHIPS: readonly string[] = [
  "Lento controllato",
  "Flusso continuo",
  "Tenute respirate",
  "Tecnica controllata",
  "Micro-movimento",
];
const BREATH_QUICK_CHIPS: readonly string[] = [
  "Naso 4:6",
  "Naso 5:5",
  "Coerenza 6:6",
  "Box 4-4-4-4",
  "Diaframmatica lenta",
  "Espira in allungamento",
];

const PRACTICE_CATEGORY_OPTION_IDS: readonly LifestylePracticeCategory[] = [
  "yoga",
  "pilates",
  "breath",
  "meditation",
  "mobility",
  "stretch",
];

const panelShell =
  "rounded-2xl border border-orange-500/40 bg-gradient-to-br from-orange-950/55 via-amber-950/25 to-orange-950/40 shadow-[0_0_40px_-10px_rgba(251,146,60,0.35)]";
const catalogPanel =
  "mt-4 rounded-xl border border-orange-400/35 bg-gradient-to-br from-orange-950/35 via-amber-950/15 to-orange-950/25 p-3";
const chipOff =
  "rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[0.65rem] font-bold text-gray-300 transition hover:border-white/25 hover:bg-white/5";
const chipOnCat =
  "rounded-full border border-orange-300/55 bg-gradient-to-r from-orange-600/95 to-amber-600/90 px-2.5 py-1 text-[0.65rem] font-bold text-white shadow-md shadow-orange-600/25";
const chipRxActive =
  "rounded-full border border-amber-300/50 bg-gradient-to-r from-amber-500/90 to-orange-600/80 px-2 py-1 text-[0.65rem] font-bold text-white shadow-md shadow-amber-500/25";
const chipRxIdle =
  "rounded-full border border-white/12 bg-black/35 px-2 py-1 text-[0.65rem] font-semibold text-gray-400 transition hover:border-amber-400/30 hover:text-amber-100";

const btnPrimary =
  "empathy-btn-gradient inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition hover:brightness-110 disabled:opacity-40";

export type BuilderLifestyleManualComposerProps = {
  athleteId: string | null;
  physioHint: string | null;
  lifestyleRows: Pro2LifestyleManualRow[];
  setLifestyleRows: React.Dispatch<React.SetStateAction<Pro2LifestyleManualRow[]>>;
  manualSessionName: string;
  setManualSessionName: React.Dispatch<React.SetStateAction<string>>;
  manualChartSegments: ChartSegment[];
  manualPlannedDate: string;
  setManualPlannedDate: React.Dispatch<React.SetStateAction<string>>;
  manualSessionDurationMinutes: number;
  setManualSessionDurationMinutes: React.Dispatch<React.SetStateAction<number>>;
  /** Chiave palette: yoga | pilates | meditation | breathwork | mobility | stretching */
  paletteSport: string;
  currentSportLabel: string;
  manualSaveBusy: boolean;
  onSaveManual: (targetDate: string) => void;
  manualSaveErr: string | null;
  manualSaveOkId: string | null;
  canSave: boolean;
  estimatedTss: number;
  /** Quando true, nasconde la barra di salvataggio interna (date + Salva + messaggi). */
  hideSaveBar?: boolean;
};

export function BuilderLifestyleManualComposer({
  athleteId,
  physioHint,
  lifestyleRows,
  setLifestyleRows,
  manualSessionName,
  setManualSessionName,
  manualChartSegments,
  manualPlannedDate,
  setManualPlannedDate,
  manualSessionDurationMinutes,
  setManualSessionDurationMinutes,
  paletteSport,
  currentSportLabel,
  manualSaveBusy,
  onSaveManual,
  manualSaveErr,
  manualSaveOkId,
  canSave,
  estimatedTss,
  hideSaveBar,
}: BuilderLifestyleManualComposerProps) {
  const t = useTranslations("BuilderLifestyleManualComposer");
  const practiceCategoryLabel = (id: LifestylePracticeCategory): string => t(`practiceCategory_${id}`);
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<LifestylePracticeCategory | "">("");
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string>("");
  const [extraNotesOpen, setExtraNotesOpen] = useState<Record<string, boolean>>({});

  const playbookForSport = useMemo(() => getLifestylePlaybookForSport(paletteSport), [paletteSport]);

  const visiblePlaybook = useMemo(() => {
    if (!catalogCategoryFilter) return playbookForSport;
    return playbookForSport.filter((e) => e.practiceCategory === catalogCategoryFilter);
  }, [playbookForSport, catalogCategoryFilter]);

  useEffect(() => {
    if (selectedPlaybookId && !visiblePlaybook.some((e) => e.id === selectedPlaybookId)) {
      setSelectedPlaybookId("");
    }
  }, [visiblePlaybook, selectedPlaybookId]);

  const structureMinutesFromChart = useMemo(
    () => Math.max(0, Math.round(manualChartSegments.reduce((s, seg) => s + seg.durationSeconds, 0) / 60)),
    [manualChartSegments],
  );

  const updateRow = (id: string, partial: Partial<Pro2LifestyleManualRow>) => {
    setLifestyleRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...partial } : r)));
  };

  const removeRow = (id: string) => {
    setLifestyleRows((prev) => prev.filter((r) => r.id !== id));
  };

  const addFromPlaybook = (entry: LifestylePlaybookEntry) => {
    setLifestyleRows((prev) => [...prev, rowFromLifestylePlaybookEntry(entry)]);
  };

  const addEmptyRow = () => {
    setLifestyleRows((prev) => [...prev, defaultPro2LifestyleManualRow({ practiceCategory: catalogCategoryFilter || "mobility" })]);
  };

  const selectedEntry = visiblePlaybook.find((e) => e.id === selectedPlaybookId) ?? null;

  return (
    <section aria-label={t("sectionAriaLabel")} className={`p-4 sm:p-6 ${panelShell}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">
            {t("headerTitle")}
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-gray-400">
            {t.rich("headerDescription", {
              sport: () => (
                <span className="font-semibold text-orange-300">{currentSportLabel}</span>
              ),
            })}
          </p>
        </div>
        {physioHint ? (
          <span className="rounded-full border border-orange-500/40 bg-orange-500/15 px-3 py-1 text-[0.65rem] font-medium text-orange-200">
            {physioHint}
          </span>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-orange-500/30 bg-black/45 p-3 shadow-inner">
        <SessionBlockIntensityChart segments={manualChartSegments} title={t("chartTitle")} estimatedTss={estimatedTss} />
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-orange-500/20 bg-gradient-to-r from-orange-950/40 to-amber-950/25 px-3 py-2.5">
          <label className="flex flex-col gap-1 text-[0.65rem] text-gray-400">
            <span className="font-bold uppercase tracking-wider text-orange-200/90">{t("calendarDuration")}</span>
            <select
              className="min-w-[7.5rem] rounded-lg border border-orange-500/30 bg-black/50 px-2 py-2 text-sm font-mono text-white"
              value={manualSessionDurationMinutes}
              onChange={(e) => setManualSessionDurationMinutes(Number(e.target.value))}
            >
              {SESSION_DURATION_CHOICES.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </label>
          <p className="max-w-md pb-1 text-[0.65rem] leading-relaxed text-gray-500">
            {t.rich("timeEstimate", {
              minutes: structureMinutesFromChart,
              mono: (chunks) => (
                <span className="font-mono font-semibold text-amber-200/90">{chunks}</span>
              ),
            })}
          </p>
        </div>
      </div>

      <div className={catalogPanel}>
        <p className="mb-2 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-orange-200">
          <Sparkles className="h-3.5 w-3.5 text-orange-300" aria-hidden />
          {t("playbookHeading")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={catalogCategoryFilter === "" ? chipOnCat : chipOff}
            onClick={() => setCatalogCategoryFilter("")}
          >
            {t("filterAll")}
          </button>
          {PRACTICE_CATEGORY_OPTION_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={catalogCategoryFilter === id ? chipOnCat : chipOff}
              onClick={() => setCatalogCategoryFilter((prev) => (prev === id ? "" : id))}
            >
              {practiceCategoryLabel(id)}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="max-h-[14rem] overflow-y-auto rounded-lg border border-white/10 bg-black/45 p-1">
            {visiblePlaybook.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-gray-500">{t("noEntries")}</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {visiblePlaybook.map((e) => {
                  const sel = selectedPlaybookId === e.id;
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedPlaybookId(e.id)}
                        className={`flex w-full flex-col rounded-md px-2 py-1.5 text-left text-xs transition ${
                          sel
                            ? "bg-gradient-to-r from-orange-600/50 to-amber-600/40 text-white ring-1 ring-orange-300/45"
                            : "text-gray-300 hover:bg-white/10"
                        }`}
                      >
                        <span className="font-semibold leading-snug">{e.name}</span>
                        <span className="text-[0.6rem] text-gray-500">
                          {lifestyleCategoryLabel(e.practiceCategory)} · {e.brief}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex flex-col justify-between rounded-lg border border-orange-500/30 bg-gradient-to-br from-orange-950/40 to-amber-950/20 p-3">
            {selectedEntry ? (
              <>
                <div className="flex gap-3">
                  <LifestylePracticeMediaThumb
                    src={null}
                    practiceCategory={selectedEntry.practiceCategory}
                    alt={selectedEntry.name}
                    playbookItemId={selectedEntry.id}
                    fallbackLabel={selectedEntry.name}
                    className="h-24 w-24 shrink-0 rounded-xl border border-orange-400/25"
                  />
                  <div className="min-w-0">
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-orange-300/80">{t("selectedLabel")}</p>
                    <p className="mt-1 text-sm font-bold text-white">{selectedEntry.name}</p>
                    <p className="mt-1 text-[0.65rem] text-gray-500">{selectedEntry.brief}</p>
                    <p className="mt-1 text-[0.55rem] text-orange-500/80">
                      {t("v1PreviewLabel")}{" "}
                      <span className="font-mono text-orange-400/90">
                        {lifestyleV1FallbackImageForCategory(selectedEntry.practiceCategory)}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    className="w-full rounded-xl border border-amber-400/45 bg-gradient-to-r from-orange-600 to-amber-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition hover:brightness-110"
                    onClick={() => addFromPlaybook(selectedEntry)}
                  >
                    <Plus className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden />
                    {t("addToPlan")}
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-white/15 bg-black/40 py-2 text-xs font-semibold text-gray-300 hover:border-orange-400/35 hover:text-white"
                    onClick={addEmptyRow}
                  >
                    {t("freeRowFull")}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-gray-500">{t("selectPracticeHint")}</p>
                <button
                  type="button"
                  className="rounded-xl border border-amber-400/40 bg-amber-600/25 py-2.5 text-sm font-bold text-amber-100 hover:bg-amber-600/35"
                  onClick={addEmptyRow}
                >
                  <Plus className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden />
                  {t("freeRow")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-orange-500/25 bg-black/35 p-3">
        <label className="flex max-w-xl flex-col gap-1 text-[0.65rem] text-gray-400">
          {t("sessionName")}
          <input
            type="text"
            className="rounded-lg border border-orange-400/30 bg-black/50 px-2 py-2 text-sm text-white"
            value={manualSessionName}
            onChange={(e) => setManualSessionName(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-[0.65rem] font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-amber-300 to-orange-300">
          {t("planCount", { count: lifestyleRows.length })}
        </p>
        {lifestyleRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-orange-500/30 bg-orange-950/20 px-4 py-8 text-center text-sm text-gray-500">
            {t.rich("emptyPlanMessage", {
              flow: (chunks) => <span className="text-orange-300">{chunks}</span>,
            })}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {lifestyleRows.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-orange-400/35 bg-gradient-to-br from-orange-950/40 via-amber-950/15 to-orange-950/25 p-4 shadow-inner shadow-orange-950/40"
              >
                <div className="mb-3 flex gap-3">
                  <div className="relative h-28 w-28 shrink-0">
                    <LifestylePracticeMediaThumb
                      src={row.mediaUrl}
                      practiceCategory={row.practiceCategory}
                      alt={row.name}
                      playbookItemId={row.playbookItemId}
                      fallbackLabel={row.name}
                      className="h-full w-full rounded-xl border border-orange-400/25"
                    />
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-xl bg-black/65 px-1 py-0.5 text-center text-[0.55rem] font-bold uppercase tracking-wide text-orange-100/95">
                      {lifestyleCategoryLabel(row.practiceCategory)}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <input
                        type="text"
                        className="min-w-[10rem] flex-1 rounded-lg border border-orange-400/35 bg-black/45 px-3 py-2 text-base font-semibold text-white"
                        value={row.name}
                        onChange={(e) => updateRow(row.id, { name: e.target.value })}
                      />
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
                        onClick={() => removeRow(row.id)}
                        aria-label={t("removePractice")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <label className="flex max-w-xs flex-col gap-1 text-[0.65rem] text-gray-500">
                      {t("categoryPrescription")}
                      <select
                        className="rounded-lg border border-orange-400/30 bg-black/50 px-2 py-2 text-sm text-white"
                        value={row.practiceCategory}
                        onChange={(e) => updateRow(row.id, { practiceCategory: e.target.value as LifestylePracticeCategory })}
                      >
                        {PRACTICE_CATEGORY_OPTION_IDS.map((id) => (
                          <option key={id} value={id}>
                            {practiceCategoryLabel(id)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex max-w-lg flex-col gap-1 text-[0.65rem] text-gray-500">
                      {t("imageUrlLabel")}
                      <input
                        type="url"
                        inputMode="url"
                        autoComplete="off"
                        placeholder={t("imageUrlPlaceholder")}
                        className="rounded-lg border border-amber-400/25 bg-black/50 px-2 py-2 text-sm text-white placeholder:text-gray-600"
                        value={row.mediaUrl ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateRow(row.id, { mediaUrl: v === "" ? undefined : v });
                        }}
                      />
                      <span className="text-[0.55rem] leading-snug text-gray-600">
                        {t.rich("imageUrlHint", {
                          path: () => (
                            <span className="font-mono text-gray-500">
                              {lifestyleV1FallbackImageForCategory(row.practiceCategory)}
                            </span>
                          ),
                        })}
                      </span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2 border-t border-white/10 pt-3">
                  <p className="text-[0.6rem] font-bold uppercase tracking-wider text-orange-300/90">{t("roundsCycles")}</p>
                  <div className="flex flex-wrap gap-1">
                    {ROUND_CHIP_PRESETS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={row.rounds === n ? chipRxActive : chipRxIdle}
                        onClick={() => updateRow(row.id, { rounds: n })}
                      >
                        {n}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      aria-label={t("customRounds")}
                      className="w-14 rounded-full border border-white/15 bg-black/50 px-2 py-1 text-center text-[0.65rem] font-mono text-white"
                      value={row.rounds}
                      onChange={(e) => updateRow(row.id, { rounds: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-[0.6rem] font-bold uppercase tracking-wider text-amber-300/90">{t("holdsBreathsDuration")}</p>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                    value={row.holdOrReps}
                    onChange={(e) => updateRow(row.id, { holdOrReps: e.target.value })}
                    placeholder={t("holdsPlaceholder")}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  <div className="min-w-[8rem] flex-1 space-y-2">
                    <p className="text-[0.6rem] font-bold uppercase tracking-wider text-orange-200/90">{t("recoverySeconds")}</p>
                    <div className="flex flex-wrap gap-1">
                      {REST_CHIP_PRESETS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={row.restSec === s ? chipRxActive : chipRxIdle}
                          onClick={() => updateRow(row.id, { restSec: s })}
                        >
                          {s}s
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min={0}
                      className="w-full max-w-[6rem] rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-[0.7rem] font-mono text-white"
                      value={row.restSec}
                      onChange={(e) => updateRow(row.id, { restSec: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </div>
                  <div className="min-w-[8rem] flex-1 space-y-2">
                    <p className="text-[0.6rem] font-bold uppercase tracking-wider text-orange-200/90">{t("rpeOptional")}</p>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className={row.rpe == null ? chipRxActive : chipRxIdle}
                        onClick={() => updateRow(row.id, { rpe: null })}
                      >
                        —
                      </button>
                      {RPE_CHIP_PRESETS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          className={row.rpe === r ? chipRxActive : chipRxIdle}
                          onClick={() => updateRow(row.id, { rpe: r })}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-[0.6rem] font-bold uppercase tracking-wider text-amber-200/90">{t("breathingPatternShortcuts")}</p>
                  <div className="flex flex-wrap gap-1">
                    {BREATH_QUICK_CHIPS.map((label) => (
                      <button
                        key={label}
                        type="button"
                        className={row.breathPattern === label ? chipRxActive : chipRxIdle}
                        onClick={() => updateRow(row.id, { breathPattern: label })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                    placeholder={t("otherPatternPlaceholder")}
                    value={row.breathPattern}
                    onChange={(e) => updateRow(row.id, { breathPattern: e.target.value })}
                  />
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-[0.6rem] font-bold uppercase tracking-wider text-orange-200/90">{t("executionStyleShortcuts")}</p>
                  <div className="flex flex-wrap gap-1">
                    {EXECUTION_QUICK_CHIPS.map((label) => (
                      <button
                        key={label}
                        type="button"
                        className={row.executionStyle === label ? chipRxActive : chipRxIdle}
                        onClick={() => updateRow(row.id, { executionStyle: label })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                    placeholder={t("customExecutionPlaceholder")}
                    value={row.executionStyle}
                    onChange={(e) => updateRow(row.id, { executionStyle: e.target.value })}
                  />
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-[0.6rem] font-bold uppercase tracking-wider text-orange-200/90">{t("blockCircuit")}</p>
                  <div className="flex flex-wrap items-center gap-1">
                    {["A", "B", "C", "D"].map((g) => (
                      <button
                        key={g}
                        type="button"
                        className={row.chainLabel === g ? chipRxActive : chipRxIdle}
                        onClick={() => updateRow(row.id, { chainLabel: row.chainLabel === g ? "" : g })}
                      >
                        {g}
                      </button>
                    ))}
                    <input
                      type="text"
                      placeholder={t("labelPlaceholder")}
                      className="min-w-[5rem] flex-1 rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-[0.7rem] text-white"
                      value={row.chainLabel}
                      onChange={(e) => updateRow(row.id, { chainLabel: e.target.value })}
                    />
                  </div>
                </div>

                <label className="mt-3 flex flex-col gap-1 text-xs text-gray-500">
                  {t("techniqueCue")}
                  <textarea
                    rows={2}
                    className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                    value={row.technique}
                    onChange={(e) => updateRow(row.id, { technique: e.target.value })}
                  />
                </label>

                <div className="mt-3">
                  <button
                    type="button"
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.7rem] font-bold transition ${
                      extraNotesOpen[row.id]
                        ? "border-orange-400/50 bg-orange-500/20 text-orange-100"
                        : "border-white/15 bg-black/40 text-gray-300 hover:border-orange-400/35"
                    }`}
                    onClick={() =>
                      setExtraNotesOpen((prev) => ({ ...prev, [row.id]: !prev[row.id] }))
                    }
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                    {t("additionalNotes")}
                  </button>
                  {extraNotesOpen[row.id] ? (
                    <textarea
                      rows={3}
                      className="mt-2 w-full rounded-lg border border-orange-400/25 bg-black/50 px-2 py-2 text-sm text-white"
                      placeholder={t("notesForCoachPlaceholder")}
                      value={row.notes}
                      onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!hideSaveBar && (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-white/10 pt-4">
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              {t("dateLabel")}
              <input
                type="date"
                className="rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                value={manualPlannedDate}
                onChange={(e) => setManualPlannedDate(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={btnPrimary}
              disabled={!athleteId || !canSave || manualSaveBusy}
              onClick={() => onSaveManual(manualPlannedDate)}
            >
              {manualSaveBusy ? t("saving") : t("saveToCalendar")}
            </button>
          </div>
          {manualSaveErr ? (
            <p className="mt-3 text-sm text-amber-300" role="alert">
              {manualSaveErr}
            </p>
          ) : null}
          {manualSaveOkId ? (
            <BuilderCalendarSaveConfirm date={manualPlannedDate} plannedWorkoutId={manualSaveOkId} />
          ) : null}
        </>
      )}
    </section>
  );
}
