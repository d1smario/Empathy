"use client";

import { BookMarked, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { CoachLibraryContractEditor } from "@/components/training/CoachLibraryContractEditor";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { Pro2Button } from "@/components/ui/empathy";
import type { CoachWorkoutLibraryItemView } from "@/lib/training/library/coach-workout-library-types";
import {
  applyCoachLibraryItem,
  clonePlannedWorkout,
  fetchCoachLibraryItemContract,
  fetchCoachLibraryItems,
  importEmpathyAerobicStarterPack,
  saveCoachLibraryItem,
  updateCoachLibraryItem,
} from "@/modules/training/services/training-library-api";
import { serializePro2BuilderContractToZwo } from "@/lib/training/planned-structured-export";
import { STARTER_PACK_TEMPLATE_COUNT } from "@/lib/training/library/starter-pack-aerobic";
import {
  LIBRARY_DISCIPLINE_OPTIONS,
  LIBRARY_FAMILY_OPTIONS,
  LIBRARY_METHODOLOGY_TAG_OPTIONS,
  LIBRARY_VIRYA_PHASE_OPTIONS,
} from "@/lib/training/library/library-item-filters";

export type CoachWorkoutLibraryPanelProps = {
  athleteId: string | null;
  targetDate: string;
  contractToSave?: Pro2BuilderSessionContract | null;
  saveTitle?: string;
  sourcePlannedId?: string | null;
  onApplied?: () => void;
  /** Carica il template (anche bozza modificata) nel composer manuale del Builder. */
  onLoadInBuilder?: (contract: Pro2BuilderSessionContract) => void;
  /** Stato aperto controllato dall'esterno (es. bottone «Seleziona dalla mia libreria» in alto). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Nasconde il bottone «Salva sessione in libreria» (contesto select-only, il salvataggio è altrove). */
  hideSaveSession?: boolean;
};

export function CoachWorkoutLibraryPanel({
  athleteId,
  targetDate,
  contractToSave,
  saveTitle,
  sourcePlannedId,
  onApplied,
  onLoadInBuilder,
  open: openProp,
  onOpenChange,
  hideSaveSession = false,
}: CoachWorkoutLibraryPanelProps) {
  const t = useTranslations("CoachWorkoutLibraryPanel");
  const [openUncontrolled, setOpenUncontrolled] = useState(false);
  const open = openProp ?? openUncontrolled;
  const setOpen = useCallback(
    (next: boolean) => {
      if (onOpenChange) onOpenChange(next);
      else setOpenUncontrolled(next);
    },
    [onOpenChange],
  );
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [items, setItems] = useState<CoachWorkoutLibraryItemView[]>([]);
  const [resultTotal, setResultTotal] = useState(0);
  const [filter, setFilter] = useState("");
  const [familyFilter, setFamilyFilter] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [viryaPhaseFilter, setViryaPhaseFilter] = useState("");
  const [applyScaling, setApplyScaling] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [previewContract, setPreviewContract] = useState<Pro2BuilderSessionContract | null>(null);
  const [draftContract, setDraftContract] = useState<Pro2BuilderSessionContract | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const hasActiveFilters =
    Boolean(filter.trim()) ||
    Boolean(familyFilter) ||
    Boolean(disciplineFilter) ||
    Boolean(tagFilter) ||
    Boolean(viryaPhaseFilter);

  useEffect(() => {
    if (!open || items.length === 0) {
      setSelectedItemId(null);
      setPreviewContract(null);
      setDraftContract(null);
      return;
    }
    if (!selectedItemId || !items.some((i) => i.id === selectedItemId)) {
      setSelectedItemId(items[0]!.id);
    }
  }, [open, items, selectedItemId]);

  useEffect(() => {
    if (!selectedItemId) {
      setPreviewContract(null);
      setDraftContract(null);
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setDraftContract(null);
    void fetchCoachLibraryItemContract(selectedItemId).then((r) => {
      if (cancelled) return;
      setPreviewLoading(false);
      const c = r.ok && r.contract ? r.contract : null;
      setPreviewContract(c);
      setDraftContract(c ? structuredClone(c) : null);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedItemId]);

  const contractDirty =
    Boolean(draftContract && previewContract) &&
    JSON.stringify(draftContract) !== JSON.stringify(previewContract);

  const activeContract = draftContract ?? previewContract;

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { items: rows, total, error } = await fetchCoachLibraryItems({
      q: filter.trim() || undefined,
      family: familyFilter || undefined,
      discipline: disciplineFilter || undefined,
      tag: tagFilter || undefined,
      viryaPhase: viryaPhaseFilter || undefined,
    });
    setLoading(false);
    if (error) {
      setErr(
        error === "coach_only" || error === "coach_not_approved"
          ? t("libraryReserved")
          : error,
      );
      setItems([]);
      setResultTotal(0);
      return;
    }
    setItems(rows);
    setResultTotal(total ?? rows.length);
  }, [filter, familyFilter, disciplineFilter, tagFilter, viryaPhaseFilter]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  function clearFilters() {
    setFilter("");
    setFamilyFilter("");
    setDisciplineFilter("");
    setTagFilter("");
    setViryaPhaseFilter("");
  }

  async function handleSave() {
    if (!contractToSave) {
      setErr(t("errNoContract"));
      return;
    }
    setBusy("save");
    setErr(null);
    setOkMsg(null);
    const title = (saveTitle ?? contractToSave.sessionName ?? t("defaultSessionTitle")).trim().slice(0, 200);
    const r = await saveCoachLibraryItem({ title, contract: contractToSave });
    setBusy(null);
    if (!r.ok) {
      setErr(r.error ?? t("errSaveFailed"));
      return;
    }
    setOkMsg(t("okSavedToLibrary", { title }));
    void refresh();
  }

  async function handleApply(item: CoachWorkoutLibraryItemView) {
    if (!athleteId) {
      setErr(t("errSelectAthlete"));
      return;
    }
    setBusy(`apply-${item.id}`);
    setErr(null);
    setOkMsg(null);
    const r = await applyCoachLibraryItem({
      itemId: item.id,
      athleteId,
      date: targetDate,
      applyScaling,
      contract: item.id === selectedItemId && draftContract ? draftContract : undefined,
    });
    setBusy(null);
    if (!r.ok) {
      setErr(r.error ?? t("errApplyFailed"));
      return;
    }
    const scaleHint =
      applyScaling && r.loadScalePct != null ? t("loadSuffix", { pct: r.loadScalePct }) : "";
    setOkMsg(t("okApplied", { title: item.title, date: targetDate, scaleHint }));
    onApplied?.();
  }

  async function handleImportStarterPack() {
    setBusy("starter");
    setErr(null);
    setOkMsg(null);
    const r = await importEmpathyAerobicStarterPack();
    setBusy(null);
    if (!r.ok) {
      setErr(r.error ?? t("errPackImport"));
      return;
    }
    setOkMsg(
      t("okPackResult", {
        imported: r.imported ?? 0,
        updated: r.updated ?? 0,
        skipped: r.skipped ?? 0,
        total: r.total ?? STARTER_PACK_TEMPLATE_COUNT,
      }),
    );
    void refresh();
  }

  async function handleExportZwo(item: CoachWorkoutLibraryItemView) {
    setBusy(`zwo-${item.id}`);
    setErr(null);
    const r = await fetchCoachLibraryItemContract(item.id);
    setBusy(null);
    if (!r.ok || !r.contract) {
      setErr(r.error ?? t("errExportFailed"));
      return;
    }
    try {
      const zwo = serializePro2BuilderContractToZwo(r.contract);
      const blob = new Blob([zwo], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(r.title ?? item.title).replace(/[^\w\-]+/g, "_").slice(0, 80)}.zwo`;
      a.click();
      URL.revokeObjectURL(url);
      setOkMsg(t("okZwoExport", { title: item.title }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("errZwoExportFailed"));
    }
  }

  async function handleSaveDraft() {
    if (!selectedItemId || !draftContract) return;
    setBusy("save-draft");
    setErr(null);
    setOkMsg(null);
    const item = items.find((i) => i.id === selectedItemId);
    const r = await updateCoachLibraryItem({
      itemId: selectedItemId,
      contract: draftContract,
      title: item?.title,
    });
    setBusy(null);
    if (!r.ok) {
      setErr(r.error ?? t("errSaveChanges"));
      return;
    }
    setPreviewContract(structuredClone(draftContract));
    setOkMsg(t("okTemplateUpdated"));
    void refresh();
  }

  async function handleCloneSource() {
    if (!athleteId || !sourcePlannedId) return;
    setBusy("clone");
    setErr(null);
    setOkMsg(null);
    const r = await clonePlannedWorkout({ sourceId: sourcePlannedId, athleteId, date: targetDate });
    setBusy(null);
    if (!r.ok) {
      setErr(r.error ?? t("errCopyFailed"));
      return;
    }
    setOkMsg(t("okSessionCopied", { date: targetDate }));
    onApplied?.();
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-orange-200">
          <BookMarked className="h-4 w-4" aria-hidden />
          {t("panelTitle")}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </button>
      {open ? (
        <div className="space-y-3 border-t border-white/10 px-4 pb-4 pt-3">
          <p className="text-xs text-gray-500">
            {t("description")}
          </p>
          <div className="flex flex-wrap gap-2">
            {contractToSave && !hideSaveSession ? (
              <Pro2Button type="button" variant="secondary" disabled={busy != null} onClick={() => void handleSave()}>
                {busy === "save" ? t("savingShort") : t("saveToLibrary")}
              </Pro2Button>
            ) : null}
            <Pro2Button
              type="button"
              variant="secondary"
              disabled={busy != null}
              onClick={() => void handleImportStarterPack()}
            >
              {busy === "starter" ? t("importing") : t("importCatalog", { count: STARTER_PACK_TEMPLATE_COUNT })}
            </Pro2Button>
            {sourcePlannedId ? (
              <Pro2Button
                type="button"
                variant="secondary"
                disabled={busy != null}
                onClick={() => void handleCloneSource()}
              >
                {busy === "clone" ? t("copying") : t("copySelected")}
              </Pro2Button>
            ) : null}
            <input
              type="search"
              placeholder={t("searchPlaceholder")}
              className="min-w-[140px] flex-1 rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void refresh();
              }}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white"
              value={disciplineFilter}
              onChange={(e) => setDisciplineFilter(e.target.value)}
              aria-label={t("filterDiscipline")}
            >
              {LIBRARY_DISCIPLINE_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              aria-label={t("filterMethodology")}
            >
              {LIBRARY_METHODOLOGY_TAG_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white"
              value={familyFilter}
              onChange={(e) => setFamilyFilter(e.target.value)}
              aria-label={t("filterFamily")}
            >
              {LIBRARY_FAMILY_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white"
              value={viryaPhaseFilter}
              onChange={(e) => setViryaPhaseFilter(e.target.value)}
              aria-label={t("filterViryaPhase")}
            >
              {LIBRARY_VIRYA_PHASE_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pro2Button type="button" variant="secondary" disabled={loading} onClick={() => void refresh()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("applyFilters")}
            </Pro2Button>
            {hasActiveFilters ? (
              <button
                type="button"
                className="text-xs font-semibold text-gray-400 underline decoration-white/20 hover:text-orange-200"
                onClick={clearFilters}
              >
                {t("resetFilters")}
              </button>
            ) : null}
            <span className="text-[0.65rem] text-gray-500">
              {loading ? "…" : t("templateCount", { count: resultTotal })}
            </span>
            <label className="ml-auto flex items-center gap-2 text-[0.65rem] text-gray-400">
              <input
                type="checkbox"
                checked={applyScaling}
                onChange={(e) => setApplyScaling(e.target.checked)}
              />
              {t("adaptLoad")}
            </label>
          </div>
          {err ? (
            <p className="text-xs text-amber-300" role="alert">
              {err}
            </p>
          ) : null}
          {okMsg ? (
            <p className="text-xs text-emerald-300" role="status">
              {okMsg}
            </p>
          ) : null}
          <div className="max-h-[min(32rem,70vh)] overflow-y-auto rounded-xl border border-white/10">
            {loading && items.length === 0 ? (
              <p className="p-3 text-xs text-gray-500">{t("loading")}</p>
            ) : items.length === 0 ? (
              <p className="p-3 text-xs text-gray-500">{t("noTemplates")}</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {items.map((item) => {
                  const selected = item.id === selectedItemId;
                  return (
                    <li key={item.id}>
                      <div
                        className={`flex items-center justify-between gap-2 px-3 py-2 transition ${
                          selected
                            ? "border-l-2 border-orange-400/80 bg-gradient-to-r from-orange-950/50 to-transparent"
                            : "border-l-2 border-transparent hover:bg-white/[0.03]"
                        }`}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setSelectedItemId(item.id)}
                        >
                          <div className="truncate text-xs font-semibold text-white">{item.title}</div>
                          <div className="text-[0.65rem] text-gray-500">
                            {item.discipline} · {item.family} · {item.durationMinutes}′ · TSS {item.tssTarget}
                            {formatItemTags(item.metadata)}
                          </div>
                        </button>
                        <div className="flex shrink-0 gap-1">
                          <Pro2Button
                            type="button"
                            variant="secondary"
                            className="!px-2 !py-1 text-[0.65rem]"
                            disabled={busy != null}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleExportZwo(item);
                            }}
                          >
                            {busy === `zwo-${item.id}` ? "…" : "ZWO"}
                          </Pro2Button>
                          {onLoadInBuilder && activeContract && item.id === selectedItemId ? (
                            <Pro2Button
                              type="button"
                              variant="secondary"
                              className="!px-2 !py-1 text-[0.65rem]"
                              disabled={busy != null}
                              onClick={(e) => {
                                e.stopPropagation();
                                onLoadInBuilder(activeContract);
                                setOkMsg(t("loadedInBuilderEdit", { title: item.title }));
                              }}
                            >
                              {t("builderButton")}
                            </Pro2Button>
                          ) : null}
                          <Pro2Button
                            type="button"
                            variant="secondary"
                            className="!px-2 !py-1 text-[0.65rem]"
                            disabled={busy != null || !athleteId}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleApply(item);
                            }}
                          >
                            {busy === `apply-${item.id}` ? "…" : t("apply")}
                          </Pro2Button>
                        </div>
                      </div>
                      {selected ? (
                        <div className="border-t border-orange-500/15 bg-gradient-to-b from-orange-950/30 via-black/40 to-black/60 px-3 py-3">
                          {previewLoading ? (
                            <div className="flex items-center justify-center gap-2 py-6 text-xs text-gray-400">
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              {t("loadingChart")}
                            </div>
                          ) : activeContract ? (
                            <CoachLibraryContractEditor
                              contract={activeContract}
                              title={item.title}
                              tssFallback={item.tssTarget}
                              durationFallback={item.durationMinutes}
                              dirty={contractDirty}
                              saveBusy={busy === "save-draft"}
                              onChange={setDraftContract}
                              onSave={() => void handleSaveDraft()}
                              onReset={() => {
                                if (previewContract) setDraftContract(structuredClone(previewContract));
                              }}
                              onOpenInBuilder={
                                onLoadInBuilder
                                  ? () => {
                                      onLoadInBuilder(activeContract);
                                      setOkMsg(t("loadedInBuilder", { title: item.title }));
                                    }
                                  : undefined
                              }
                            />
                          ) : (
                            <p className="py-4 text-center text-xs text-amber-200/90">
                              {t("structureUnavailable")}
                            </p>
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatItemTags(metadata: Record<string, unknown>): string {
  const tags = metadata.tags;
  if (!Array.isArray(tags) || tags.length === 0) return "";
  const slice = tags
    .filter((t): t is string => typeof t === "string")
    .slice(0, 3)
    .join(" · ");
  return slice ? ` · ${slice}` : "";
}
