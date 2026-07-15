"use client";

import { FileText, Plus, Sparkles, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SessionBlockIntensityChart } from "@/components/training/SessionBlockIntensityChart";
import { BuilderCalendarSaveConfirm } from "@/components/training/BuilderCalendarSaveConfirm";
import { TechnicalPlaybookSchemaFrame } from "@/components/training/TechnicalPlaybookSchemaFrame";
import {
  defaultPro2TechnicalManualRow,
  rowFromPlaybookEntry,
  type Pro2TechnicalManualRow,
} from "@/lib/training/builder/pro2-technical-manual-plan";
import {
  boardPointsForPaletteSportKey,
  buildTechnicalSchemaDataUrl,
  entryTypeToSchemaCategory,
  paletteSportKeyToV1Label,
} from "@/lib/training/builder/technical-schema-v1";
import {
  getTechnicalPlaybookForSport,
  type TechnicalPlaybookEntry,
} from "@/lib/training/builder/technical-playbook-catalog";
import type { TechnicalModuleFocus } from "@/lib/training/engine/types";
import type { ChartSegment } from "@/lib/training/engine/block-chart-segments";
const MINUTE_CHIP_PRESETS = [8, 10, 12, 14, 15, 16, 18, 20, 22, 25] as const;
const PERIOD_CHIP_PRESETS = [
  "3×4′",
  "4×5′",
  "6×90″",
  "8×45″",
  "Continuo",
  "2×8′ + 2′",
  "set da 25",
  "8 serie",
] as const;
const SPACE_CHIP_PRESETS = [
  "Metà campo",
  "Terzo offensivo",
  "12×12 m",
  "Campo intero",
  "Coppie tatami",
  "Ring / area 5×5",
  "Scatola servizio",
] as const;

const panelShell =
  "rounded-2xl border border-orange-500/40 bg-gradient-to-br from-orange-950/55 via-orange-950/25 to-orange-950/35 shadow-[0_0_40px_-10px_rgba(251,146,60,0.35)]";
const catalogPanel =
  "mt-4 rounded-xl border border-orange-400/35 bg-gradient-to-br from-orange-950/35 via-orange-950/12 to-black/40 p-3";

const chipOff =
  "rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[0.65rem] font-bold text-gray-300 transition hover:border-white/25 hover:bg-white/5";
const chipOnKind =
  "rounded-full border border-orange-300/55 bg-gradient-to-r from-orange-600/95 to-orange-600/90 px-2.5 py-1 text-[0.65rem] font-bold text-white shadow-md shadow-orange-600/25";
const chipOnViolet =
  "rounded-full border border-orange-300/55 bg-gradient-to-r from-orange-600/95 to-orange-600/90 px-2.5 py-1 text-[0.65rem] font-bold text-white shadow-md shadow-orange-600/25";
const chipOnOrange =
  "rounded-full border border-orange-300/50 bg-gradient-to-r from-orange-500/90 to-amber-600/85 px-2.5 py-1 text-[0.65rem] font-bold text-white shadow-md shadow-orange-500/25";
const chipOnTeal =
  "rounded-full border border-orange-300/50 bg-gradient-to-r from-orange-600/90 to-amber-600/85 px-2.5 py-1 text-[0.65rem] font-bold text-white shadow-md shadow-orange-500/20";
const chipRxIdle =
  "rounded-full border border-white/12 bg-black/35 px-2 py-1 text-[0.65rem] font-semibold text-gray-400 transition hover:border-orange-400/30 hover:text-orange-100";
const chipRxActive =
  "rounded-full border border-orange-300/50 bg-gradient-to-r from-orange-500/90 to-amber-600/80 px-2 py-1 text-[0.65rem] font-bold text-white shadow-md shadow-orange-500/25";

export type BuilderTechnicalManualComposerProps = {
  athleteId: string | null;
  physioHint: string | null;
  paletteSport: string;
  currentSportLabel: string;
  technicalManualRows: Pro2TechnicalManualRow[];
  setTechnicalManualRows: React.Dispatch<React.SetStateAction<Pro2TechnicalManualRow[]>>;
  technicalModuleFocus: TechnicalModuleFocus;
  manualSessionName: string;
  setManualSessionName: React.Dispatch<React.SetStateAction<string>>;
  manualChartSegments: ChartSegment[];
  manualPlannedDate: string;
  setManualPlannedDate: React.Dispatch<React.SetStateAction<string>>;
  manualSessionDurationMinutes: number;
  setManualSessionDurationMinutes: React.Dispatch<React.SetStateAction<number>>;
  manualSaveBusy: boolean;
  onSaveManual: (targetDate: string) => void;
  manualSaveErr: string | null;
  manualSaveOkId: string | null;
  canSave: boolean;
  estimatedTss: number;
  /** Quando true, nasconde la barra di salvataggio interna (bottoni Salva + messaggi). */
  hideSaveBar?: boolean;
  /** Slot in TESTA al box: «Punti di partenza» (Genera / Seleziona / Importa). */
  intro?: React.ReactNode;
  /** Slot in coda al box: salvataggio unico dell'orchestratore (Data/Ora + Salva). */
  footer?: React.ReactNode;
};

function buildSchemaDataUrlFromPlaybookEntry(entry: TechnicalPlaybookEntry): string {
  const sportLabel = paletteSportKeyToV1Label(entry.sport);
  return buildTechnicalSchemaDataUrl({
    sportLabelV1: sportLabel,
    title: entry.name,
    objective: entry.brief,
    methodology: entry.defaultCue,
    category: entryTypeToSchemaCategory(entry.entryType),
    boardPoints: boardPointsForPaletteSportKey(entry.sport),
    sourceLabel: "EMPATHY playbook",
    tags: entry.schemaTags,
  });
}

function buildSchemaDataUrlFromRow(
  row: Pro2TechnicalManualRow,
  playbook: TechnicalPlaybookEntry[],
  fallbackSportKey: string,
): string {
  const sk = row.sportKeyForSchema.trim() || fallbackSportKey;
  const sportLabel = paletteSportKeyToV1Label(sk);
  const entry = playbook.find((e) => e.id === row.playbookItemId);
  return buildTechnicalSchemaDataUrl({
    sportLabelV1: sportLabel,
    title: row.name,
    objective: entry?.brief ?? row.coachingCue ?? row.name,
    methodology: row.coachingCue || row.periodsLabel || "Coach scheme",
    category: entryTypeToSchemaCategory(row.entryType),
    boardPoints: boardPointsForPaletteSportKey(sk),
    sourceLabel: "Coach sheet Pro 2",
    tags: entry?.schemaTags,
  });
}

export function BuilderTechnicalManualComposer({
  athleteId,
  physioHint,
  paletteSport,
  currentSportLabel,
  technicalManualRows,
  setTechnicalManualRows,
  manualSessionName,
  setManualSessionName,
  manualChartSegments,
  manualPlannedDate,
  setManualPlannedDate,
  manualSaveBusy,
  onSaveManual,
  manualSaveErr,
  manualSaveOkId,
  canSave,
  estimatedTss,
  hideSaveBar,
  intro,
  footer,
}: BuilderTechnicalManualComposerProps) {
  const t = useTranslations("BuilderTechnicalManualComposer");
  const playbook = useMemo(() => getTechnicalPlaybookForSport(paletteSport), [paletteSport]);
  const [catalogKind, setCatalogKind] = useState<"all" | "drill" | "scheme">("all");
  const [search, setSearch] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string>("");
  const [presetMinutes, setPresetMinutes] = useState<number | null>(null);
  const [presetPeriods, setPresetPeriods] = useState<string | null>(null);
  const [presetSpace, setPresetSpace] = useState<string | null>(null);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return playbook.filter((e) => {
      if (catalogKind !== "all" && e.entryType !== catalogKind) return false;
      if (!q) return true;
      return `${e.name} ${e.brief} ${e.id}`.toLowerCase().includes(q);
    });
  }, [playbook, catalogKind, search]);

  useEffect(() => {
    setSelectedEntryId((prev) => {
      if (filteredCatalog.some((e) => e.id === prev)) return prev;
      return filteredCatalog[0]?.id ?? "";
    });
  }, [filteredCatalog]);

  const selectedEntry = filteredCatalog.find((e) => e.id === selectedEntryId) ?? null;

  useEffect(() => {
    setPresetMinutes(null);
    setPresetPeriods(null);
    setPresetSpace(null);
  }, [selectedEntryId]);

  const selectedSchemaUrl = useMemo(
    () => (selectedEntry ? buildSchemaDataUrlFromPlaybookEntry(selectedEntry) : ""),
    [selectedEntry],
  );

  const structureMinutesFromChart = useMemo(
    () => Math.max(0, Math.round(manualChartSegments.reduce((s, seg) => s + seg.durationSeconds, 0) / 60)),
    [manualChartSegments],
  );

  const updateRow = (id: string, partial: Partial<Pro2TechnicalManualRow>) => {
    setTechnicalManualRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...partial } : r)));
  };

  const removeRow = (id: string) => {
    setTechnicalManualRows((prev) => prev.filter((r) => r.id !== id));
  };

  const addBlankRow = () => {
    setTechnicalManualRows((prev) => [
      ...prev,
      defaultPro2TechnicalManualRow({
        name: "Free block",
        sportKeyForSchema: paletteSport,
        visualSchemaKind: "v1_svg",
      }),
    ]);
  };

  const addFromEntry = useCallback(
    (entry: TechnicalPlaybookEntry) => {
      const minutes = presetMinutes ?? entry.defaultMinutes;
      const periods = presetPeriods ?? entry.defaultPeriods;
      const space = presetSpace ?? entry.defaultSpace;
      setTechnicalManualRows((prev) => [
        ...prev,
        rowFromPlaybookEntry({
          ...entry,
          defaultMinutes: minutes,
          defaultPeriods: periods,
          defaultSpace: space,
        }),
      ]);
    },
    [presetMinutes, presetPeriods, presetSpace, setTechnicalManualRows],
  );

  return (
    <section aria-label={t("ariaLabel")} className={`p-4 sm:p-6 ${panelShell}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">
            {t("title")}
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-gray-400">
            {t.rich("description", {
              s: (chunks) => <span className="text-orange-300">{chunks}</span>,
              code: (chunks) => <span className="font-mono text-orange-200/80">{chunks}</span>,
            })}
          </p>
        </div>
        {physioHint ? (
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-[0.65rem] font-medium text-emerald-200">
            {physioHint}
          </span>
        ) : null}
      </div>

      {intro ? <div className="mt-4">{intro}</div> : null}

      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <label className="block min-w-[12rem] flex-1">
          <span className="mb-1 block text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">{t("sessionName")}</span>
          <input
            type="text"
            className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2.5 text-base font-semibold text-white"
            value={manualSessionName}
            onChange={(e) => setManualSessionName(e.target.value)}
          />
        </label>
        <div className="flex shrink-0 flex-col items-end leading-tight">
          <span className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">{t("sessionDurationReadonly")}</span>
          <span className="font-mono text-lg font-semibold text-white">{structureMinutesFromChart}′</span>
          <span className="text-[0.6rem] text-gray-500">{t("sessionDurationFromBlocks")}</span>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-orange-500/30 bg-black/45 p-3 shadow-inner">
        <SessionBlockIntensityChart segments={manualChartSegments} title={t("chartTitle")} estimatedTss={estimatedTss} />
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-orange-500/20 bg-orange-950/25 px-3 py-2.5">
          {!hideSaveBar && (
            <button
              type="button"
              disabled={!athleteId || manualSaveBusy || !canSave}
              onClick={() => onSaveManual(manualPlannedDate)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-lg transition disabled:opacity-40 bg-gradient-to-r from-orange-600 via-orange-600 to-orange-500 hover:brightness-110 border border-white/10"
            >
              <FileText className="h-4 w-4" aria-hidden />
              {manualSaveBusy ? t("savingShort") : t("saveSheet")}
            </button>
          )}
        </div>
      </div>

      <div className={catalogPanel}>
        <p className="mb-2 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-orange-200">
          <Sparkles className="h-3.5 w-3.5 text-orange-300" aria-hidden />
          {t("playbookFilters")}
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "all" as const, label: t("kindAll") },
              { id: "drill" as const, label: t("kindDrill") },
              { id: "scheme" as const, label: t("kindSchemes") },
            ] as const
          ).map((k) => (
            <button key={k.id} type="button" className={catalogKind === k.id ? chipOnKind : chipOff} onClick={() => setCatalogKind(k.id)}>
              {k.label}
            </button>
          ))}
        </div>
        <label className="mt-3 flex max-w-md flex-col gap-1 text-[0.65rem] text-gray-400">
          {t("search")}
          <input
            type="search"
            className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
          />
        </label>

        {selectedEntry ? (
          <div className="mt-4 space-y-3 rounded-xl border border-orange-500/25 bg-gradient-to-r from-orange-950/25 to-orange-950/20 p-3">
            <p className="text-[0.6rem] font-bold uppercase tracking-wider text-orange-200/90">{t("presetsBeforeAdding")}</p>
            <div>
              <p className="text-[0.58rem] font-bold uppercase tracking-wider text-gray-500">{t("minutes")}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {MINUTE_CHIP_PRESETS.map((m) => {
                  const eff = presetMinutes ?? selectedEntry.defaultMinutes;
                  const sel = eff === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      className={sel ? chipOnOrange : chipRxIdle}
                      onClick={() => setPresetMinutes(m)}
                    >
                      {m}′
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[0.58rem] font-bold uppercase tracking-wider text-gray-500">{t("periods")}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {PERIOD_CHIP_PRESETS.map((p) => {
                  const eff = presetPeriods ?? selectedEntry.defaultPeriods;
                  const sel = eff === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      className={sel ? chipOnViolet : chipRxIdle}
                      onClick={() => setPresetPeriods(p)}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[0.58rem] font-bold uppercase tracking-wider text-gray-500">{t("space")}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                <button
                  type="button"
                  className={
                    (presetSpace ?? selectedEntry.defaultSpace) === selectedEntry.defaultSpace ? chipOnTeal : chipRxIdle
                  }
                  onClick={() => setPresetSpace(selectedEntry.defaultSpace)}
                >
                  {t("entryDefault")}
                </button>
                {SPACE_CHIP_PRESETS.map((s) => {
                  const eff = presetSpace ?? selectedEntry.defaultSpace;
                  const sel = eff === s;
                  return (
                    <button key={s} type="button" className={sel ? chipOnTeal : chipRxIdle} onClick={() => setPresetSpace(s)}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="max-h-[16rem] overflow-y-auto rounded-lg border border-white/10 bg-black/45 p-1">
            {filteredCatalog.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-gray-500">{t("noEntries")}</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {filteredCatalog.map((e) => {
                  const sel = selectedEntryId === e.id;
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedEntryId(e.id)}
                        className={`flex w-full flex-col rounded-md px-2 py-1.5 text-left text-xs transition ${
                          sel
                            ? "bg-gradient-to-r from-orange-600/50 to-orange-600/40 text-white ring-1 ring-orange-300/45"
                            : "text-gray-300 hover:bg-white/10"
                        }`}
                      >
                        <span className="font-semibold leading-snug">
                          {e.entryType === "scheme" ? "▣ " : "◈ "}
                          {e.name}
                        </span>
                        <span className="text-[0.6rem] text-gray-500">{e.brief}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-orange-500/30 bg-gradient-to-br from-orange-950/40 to-orange-950/15 p-3">
            {selectedEntry && selectedSchemaUrl ? (
              <>
                <TechnicalPlaybookSchemaFrame
                  dataUrl={selectedSchemaUrl}
                  title={selectedEntry.name}
                  visualKey={selectedEntry.id}
                  className="max-w-xl"
                />
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-wider text-orange-300/80">{t("selected")}</p>
                  <p className="mt-1 text-sm font-bold text-white">{selectedEntry.name}</p>
                  <p className="mt-1 text-[0.65rem] leading-relaxed text-gray-400">{selectedEntry.brief}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="w-full rounded-xl border border-orange-400/45 bg-gradient-to-r from-orange-600 to-orange-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:brightness-110"
                    onClick={() => addFromEntry(selectedEntry)}
                  >
                    <Plus className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden />
                    {t("addToSheet")}
                  </button>
                  <button type="button" className={`w-full py-2 text-center text-xs ${chipOff}`} onClick={addBlankRow}>
                    {t("freeBlock")}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-500">{t("noPlaybookItem")}</p>
            )}
          </div>
        </div>
      </div>

      {!hideSaveBar && (
        <div className="mt-4 rounded-xl border border-orange-500/25 bg-black/35 p-3">
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-[0.65rem] text-gray-400">
              {t("date")}
              <input
                type="date"
                className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                value={manualPlannedDate}
                onChange={(e) => setManualPlannedDate(e.target.value)}
              />
            </label>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <p className="text-[0.65rem] font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-orange-300 to-orange-200">
          {t("dailySheetBlocks", { count: technicalManualRows.length })}
        </p>
        {technicalManualRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-orange-500/30 bg-orange-950/20 px-4 py-8 text-center text-sm text-gray-500">
            {t.rich("emptySheet", {
              code: (chunks) => <span className="font-mono text-orange-300">{chunks}</span>,
            })}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {technicalManualRows.map((row) => {
              const rowUrl = buildSchemaDataUrlFromRow(row, playbook, paletteSport);
              return (
                <li
                  key={row.id}
                  className="rounded-2xl border border-orange-400/35 bg-gradient-to-br from-orange-950/40 via-orange-950/15 to-black/30 p-4 shadow-inner"
                >
                  <div className="flex flex-col gap-3 lg:flex-row">
                    <div className="w-full shrink-0 lg:w-[min(100%,22rem)]">
                      <TechnicalPlaybookSchemaFrame dataUrl={rowUrl} title={row.name} visualKey={row.visualAssetKey} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <input
                          type="text"
                          className="min-w-[10rem] flex-1 rounded-lg border border-orange-400/35 bg-black/45 px-3 py-2 text-base font-semibold text-white"
                          value={row.name}
                          onChange={(e) => updateRow(row.id, { name: e.target.value })}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={row.entryType === "drill" ? chipOnKind : chipOff}
                            onClick={() => updateRow(row.id, { entryType: "drill" })}
                          >
                            Drill
                          </button>
                          <button
                            type="button"
                            className={row.entryType === "scheme" ? chipOnViolet : chipOff}
                            onClick={() => updateRow(row.id, { entryType: "scheme" })}
                          >
                            {t("rowScheme")}
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
                            onClick={() => removeRow(row.id)}
                            aria-label={t("removeBlock")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <p className="text-[0.58rem] font-bold uppercase tracking-wider text-orange-200/80">{t("minutes")}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {MINUTE_CHIP_PRESETS.map((m) => (
                            <button
                              key={m}
                              type="button"
                              className={row.durationMinutes === m ? chipOnOrange : chipRxIdle}
                              onClick={() => updateRow(row.id, { durationMinutes: m })}
                            >
                              {m}′
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[0.58rem] font-bold uppercase tracking-wider text-orange-200/80">{t("periods")}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {PERIOD_CHIP_PRESETS.map((p) => (
                            <button
                              key={p}
                              type="button"
                              className={row.periodsLabel === p ? chipOnViolet : chipRxIdle}
                              onClick={() => updateRow(row.id, { periodsLabel: p })}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          className="mt-2 w-full rounded-lg border border-white/12 bg-black/45 px-2 py-1.5 text-xs text-white"
                          placeholder={t("periodsFreeText")}
                          value={row.periodsLabel}
                          onChange={(e) => updateRow(row.id, { periodsLabel: e.target.value })}
                        />
                      </div>
                      <div>
                        <p className="text-[0.58rem] font-bold uppercase tracking-wider text-teal-200/80">{t("space")}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {SPACE_CHIP_PRESETS.map((s) => (
                            <button
                              key={s}
                              type="button"
                              className={row.spaceLabel === s ? chipOnTeal : chipRxIdle}
                              onClick={() => updateRow(row.id, { spaceLabel: s })}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          className="mt-2 w-full rounded-lg border border-white/12 bg-black/45 px-2 py-1.5 text-xs text-white"
                          placeholder={t("spaceFree")}
                          value={row.spaceLabel}
                          onChange={(e) => updateRow(row.id, { spaceLabel: e.target.value })}
                        />
                      </div>
                      <label className="flex flex-col gap-1 text-[0.65rem] text-gray-400">
                        Coaching cue
                        <input
                          type="text"
                          className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                          value={row.coachingCue}
                          onChange={(e) => updateRow(row.id, { coachingCue: e.target.value })}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[0.65rem] text-gray-400">
                        {t("notes")}
                        <textarea
                          className="min-h-[3rem] rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                          value={row.notes}
                          onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                        />
                      </label>
                      <p className="text-[0.58rem] text-gray-600">
                        Schema: <span className="font-mono text-gray-400">{row.visualSchemaKind}</span> · sport{" "}
                        <span className="font-mono text-gray-400">{row.sportKeyForSchema || paletteSport}</span>
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!hideSaveBar && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
          <button
            type="button"
            disabled={!athleteId || manualSaveBusy || !canSave}
            onClick={() => onSaveManual(manualPlannedDate)}
            className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-lg transition disabled:opacity-40 bg-gradient-to-r from-orange-600 via-orange-600 to-orange-500 hover:brightness-110 border border-white/10"
          >
            <FileText className="h-4 w-4" aria-hidden />
            {manualSaveBusy ? t("saving") : t("saveSheetToCalendar")}
          </button>
          {manualSaveErr ? (
            <span className="text-xs text-rose-300" role="alert">
              {manualSaveErr}
            </span>
          ) : null}
          {manualSaveOkId ? (
            <BuilderCalendarSaveConfirm
              date={manualPlannedDate}
              plannedWorkoutId={manualSaveOkId}
              className="text-xs text-emerald-300"
            />
          ) : null}
        </div>
      )}
      {footer}
    </section>
  );
}
