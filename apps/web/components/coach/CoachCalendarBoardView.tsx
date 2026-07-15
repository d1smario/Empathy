"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Dumbbell, Sparkles, X } from "lucide-react";
import type { ExecutedWorkout } from "@empathy/domain-training";
import { LOAD_CHIP_LABEL } from "@/lib/training/load-metrics-labels";
import { plannedCalendarChipViewModel } from "@/lib/training/planned-workout-display";
import { formatAthleteLabel, useCoachRoster } from "@/lib/coach/use-coach-roster";
import {
  CoachCalendarWeekGrid,
  type CoachCalendarDay,
} from "@/components/coach/CoachCalendarWeekGrid";
import { CoachSessionAnalysisModal } from "@/components/coach/CoachSessionAnalysisModal";
import {
  CalendarSessionEditModal,
  type CalendarEditPlannedRow,
} from "@/components/coach/CalendarSessionEditModal";
import {
  coachCalendarCellKey,
  coachCalendarRowToPlannedWorkout,
  useCoachCalendarWeek,
  type CoachCalendarPlannedRow,
} from "@/modules/training/services/use-coach-calendar-week";
import { useCoachCalendarExecutedWeek } from "@/modules/training/services/use-coach-calendar-executed-week";
import {
  applyCoachLibraryItem,
  applyEmpathyPreset,
  clonePlannedWorkout,
  fetchCoachLibraryItems,
} from "@/modules/training/services/training-library-api";
import { loadAerobicStarterPresetsClient } from "@/lib/training/library/aerobic-starter-presets-client";
import type { AerobicStarterPreset } from "@/lib/training/library/starter-pack-aerobic";
import type { CoachWorkoutLibraryItemView } from "@/lib/training/library/coach-workout-library-types";
import {
  COACH_CALENDAR_DRAG_MIME,
  encodeCoachCalendarDragPayload,
  type CoachCalendarDragPayload,
} from "@/lib/training/library/coach-calendar-drag-payload";

type SourceTab = "coach" | "empathy";

type SessionModalState = {
  open: boolean;
  executed: ExecutedWorkout | null;
  athleteId: string | null;
  dateIso: string | null;
};

/** Chiave giorno locale `YYYY-MM-DD` (le colonne `date` dei workout sono date pure). */
function dayKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Settimana lun→dom con offset (0 = corrente, ±1 = precedente/successiva). */
function weekMondayWithOffset(offset: number): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7);
  return monday;
}

export function CoachCalendarBoardView() {
  const t = useTranslations("CoachCalendarBoard");
  const locale = useLocale();
  const { athletes, loading: rosterLoading, error: rosterError, coachActivation } = useCoachRoster();

  const [weekOffset, setWeekOffset] = useState(0);

  const todayKey = useMemo(() => dayKey(new Date()), []);
  const { days, weekFrom, weekTo, rangeLabel } = useMemo(() => {
    const monday = weekMondayWithOffset(weekOffset);
    const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const list: CoachCalendarDay[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = dayKey(d);
      list.push({
        iso,
        label: dayFmt.format(d),
        dayNum: String(d.getDate()),
        isToday: iso === todayKey,
      });
    }
    const rangeFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    const first = new Date(monday);
    const last = new Date(monday);
    last.setDate(monday.getDate() + 6);
    return {
      days: list,
      weekFrom: list[0]!.iso,
      weekTo: list[6]!.iso,
      rangeLabel: `${rangeFmt.format(first)} – ${rangeFmt.format(last)}`,
    };
  }, [weekOffset, locale, todayKey]);

  const athleteIds = useMemo(() => athletes.map((a) => a.id), [athletes]);
  const { cells, loading: weekLoading, error: weekError, refetch: refetchWeek } = useCoachCalendarWeek(
    athleteIds,
    weekFrom,
    weekTo,
  );
  const { cellMap: executedCells } = useCoachCalendarExecutedWeek(athleteIds, weekFrom, weekTo);

  // Popup «Analisi allenamento»: stato sollevato qui, montato in fondo alla vista.
  const [sessionModal, setSessionModal] = useState<SessionModalState>({
    open: false,
    executed: null,
    athleteId: null,
    dateIso: null,
  });
  const openExecuted = useCallback((executed: ExecutedWorkout, athleteId: string, dayIso: string) => {
    setSessionModal({ open: true, executed, athleteId, dateIso: dayIso });
  }, []);
  const closeSessionModal = useCallback(() => setSessionModal((s) => ({ ...s, open: false })), []);

  // Popup «Modifica seduta pianificata»: editor del Builder in un modale, salvataggio in-place.
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<CalendarEditPlannedRow | null>(null);
  const onEditPlanned = useCallback((row: CoachCalendarPlannedRow, athleteId: string) => {
    if (!row.id) return;
    setEditRow({ id: row.id, athleteId, date: String(row.date ?? "").slice(0, 10) });
    setEditOpen(true);
  }, []);
  const closeEditModal = useCallback(() => setEditOpen(false), []);
  const onEditSaved = useCallback(() => refetchWeek(), [refetchWeek]);

  // Feedback condiviso (drop, incolla, copia settimana): banner con auto-dismiss.
  const [dropBusy, setDropBusy] = useState(false);
  const [dropFeedback, setDropFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // (A) COPIA/INCOLLA SEDUTA — clipboard in-memory (NIENTE persistenza).
  const [clipboard, setClipboard] = useState<{ sourceId: string; title: string } | null>(null);
  const [pasteBusy, setPasteBusy] = useState(false);
  const onCopyPlanned = useCallback((row: CoachCalendarPlannedRow, _athleteId: string) => {
    if (!row.id) return;
    const chip = plannedCalendarChipViewModel(coachCalendarRowToPlannedWorkout(row));
    setClipboard({ sourceId: row.id, title: chip.sportLabel });
  }, []);
  const cancelCopy = useCallback(() => setClipboard(null), []);

  const onPasteInto = useCallback(
    async (athleteId: string, dateIso: string) => {
      if (!clipboard || pasteBusy) return;
      setPasteBusy(true);
      setDropFeedback(null);
      try {
        const res = await clonePlannedWorkout({ sourceId: clipboard.sourceId, athleteId, date: dateIso });
        if (res.ok) {
          setDropFeedback({ tone: "ok", text: t("assignedToast", { title: clipboard.title }) });
          refetchWeek();
          // Clipboard MANTENUTA: si può incollare più volte finché non si annulla.
        } else if (res.error === "forbidden" || res.error === "forbidden_source") {
          setDropFeedback({ tone: "error", text: t("assignForbidden") });
        } else {
          setDropFeedback({ tone: "error", text: t("copyError") });
        }
      } catch {
        setDropFeedback({ tone: "error", text: t("copyError") });
      } finally {
        setPasteBusy(false);
      }
    },
    [clipboard, pasteBusy, refetchWeek, t],
  );

  // (B) COPIA SETTIMANA — su un altro atleta, stesse date.
  const [copyWeekSource, setCopyWeekSource] = useState<string | null>(null);
  const [copyWeekBusy, setCopyWeekBusy] = useState(false);
  const onCopyWeek = useCallback((sourceAthleteId: string) => {
    setCopyWeekSource(sourceAthleteId);
  }, []);
  const cancelCopyWeek = useCallback(() => setCopyWeekSource(null), []);

  const runCopyWeek = useCallback(
    async (sourceAthleteId: string, destAthleteId: string) => {
      if (copyWeekBusy) return;
      setCopyWeekBusy(true);
      setDropFeedback(null);
      // Righe planned della settimana corrente del sorgente (già in memoria, select LITE).
      const sourceRows: Array<{ id: string; date: string }> = [];
      for (const day of days) {
        const cell = cells.get(coachCalendarCellKey(sourceAthleteId, day.iso)) ?? [];
        for (const row of cell) {
          if (row.id) sourceRows.push({ id: row.id, date: String(row.date ?? day.iso).slice(0, 10) });
        }
      }
      let copied = 0;
      let skipped = 0;
      let forbidden = 0;
      for (const src of sourceRows) {
        try {
          const res = await clonePlannedWorkout({ sourceId: src.id, athleteId: destAthleteId, date: src.date });
          if (res.ok) {
            if (res.dedupeSkipped) skipped += 1;
            else copied += 1;
          } else if (res.error === "forbidden" || res.error === "forbidden_source") {
            forbidden += 1;
          } else {
            skipped += 1;
          }
        } catch {
          skipped += 1;
        }
      }
      setCopyWeekSource(null);
      setCopyWeekBusy(false);
      setDropFeedback({
        tone: forbidden > 0 && copied === 0 ? "error" : "ok",
        text: t("copyWeekResult", { copied, skipped, forbidden }),
      });
      refetchWeek();
    },
    [copyWeekBusy, days, cells, refetchWeek, t],
  );

  // DRAG&DROP: assegnazione seduta da card sinistra → cella giorno×atleta.
  const handleCardDragStart = useCallback(
    (e: DragEvent<HTMLElement>, payload: CoachCalendarDragPayload) => {
      e.dataTransfer.setData(COACH_CALENDAR_DRAG_MIME, encodeCoachCalendarDragPayload(payload));
      e.dataTransfer.effectAllowed = "copy";
    },
    [],
  );

  const onDropSession = useCallback(
    async ({
      payload,
      athleteId,
      dateIso,
    }: {
      payload: CoachCalendarDragPayload;
      athleteId: string;
      dateIso: string;
    }) => {
      if (dropBusy) return;
      setDropBusy(true);
      setDropFeedback(null);
      try {
        const res =
          payload.kind === "coach-item"
            ? await applyCoachLibraryItem({ itemId: payload.itemId, athleteId, date: dateIso, applyScaling: false })
            : await applyEmpathyPreset({ presetId: payload.presetId, athleteId, date: dateIso });
        if (res.ok) {
          setDropFeedback({ tone: "ok", text: t("assignedToast", { title: payload.title }) });
          refetchWeek();
        } else if (res.error === "forbidden") {
          setDropFeedback({ tone: "error", text: t("assignForbidden") });
        } else {
          setDropFeedback({ tone: "error", text: t("assignError") });
        }
      } catch {
        setDropFeedback({ tone: "error", text: t("assignError") });
      } finally {
        setDropBusy(false);
      }
    },
    [dropBusy, refetchWeek, t],
  );

  // Auto-dismiss del feedback drop dopo qualche secondo.
  useEffect(() => {
    if (!dropFeedback) return;
    const timer = setTimeout(() => setDropFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [dropFeedback]);

  // Pannello sorgenti (sinistra) a DUE sorgenti — SOLA LETTURA (nessun drag/applicazione).
  const [sourceTab, setSourceTab] = useState<SourceTab>("coach");

  // (1) SEDUTE COACH — libreria del coach.
  const [libraryItems, setLibraryItems] = useState<CoachWorkoutLibraryItemView[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLibraryLoading(true);
    setLibraryError(null);
    (async () => {
      const { items, error } = await fetchCoachLibraryItems();
      if (cancelled) return;
      if (error) {
        setLibraryError(error);
        setLibraryItems([]);
      } else {
        setLibraryItems(items);
      }
      setLibraryLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // (2) TEMPLATE EMPATHY — preset aerobici (browser→Supabase, stessa fonte di Virya).
  const [empathyPresets, setEmpathyPresets] = useState<AerobicStarterPreset[]>([]);
  const [empathyLoading, setEmpathyLoading] = useState(true);
  const [empathyError, setEmpathyError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEmpathyLoading(true);
    setEmpathyError(null);
    (async () => {
      try {
        const presets = await loadAerobicStarterPresetsClient();
        if (cancelled) return;
        setEmpathyPresets(presets);
      } catch {
        if (!cancelled) setEmpathyError("load_failed");
      } finally {
        if (!cancelled) setEmpathyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rosterErrText = rosterError
    ? rosterError.kind === "network"
      ? t("rosterErrorNetwork")
      : rosterError.message || t("rosterErrorLoad")
    : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      {/* SINISTRA — pannello sorgenti a DUE tab (coach + Empathy), SOLA LETTURA (nessun drag). */}
      <aside className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex rounded-lg border border-white/10 bg-black/20 p-0.5">
          <button
            type="button"
            onClick={() => setSourceTab("coach")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[0.7rem] font-semibold transition ${
              sourceTab === "coach" ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Dumbbell className="h-3.5 w-3.5" aria-hidden />
            {t("coachSourcesTab")}
          </button>
          <button
            type="button"
            onClick={() => setSourceTab("empathy")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[0.7rem] font-semibold transition ${
              sourceTab === "empathy" ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t("empathySourcesTab")}
          </button>
        </div>

        {sourceTab === "coach" ? (
          <div>
            <p className="mt-3 text-[0.7rem] text-gray-500">{t("sourcesHint")}</p>
            {libraryLoading ? (
              <p className="mt-4 text-xs text-gray-500">{t("sourcesLoading")}</p>
            ) : libraryError ? (
              <p className="mt-4 text-xs text-amber-200" role="alert">
                {t("sourcesError")}
              </p>
            ) : libraryItems.length === 0 ? (
              <p className="mt-4 text-xs text-gray-500">{t("sourcesEmpty")}</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {libraryItems.map((item) => (
                  <li
                    key={item.id}
                    draggable
                    onDragStart={(e) =>
                      handleCardDragStart(e, { kind: "coach-item", itemId: item.id, title: item.title })
                    }
                    className="cursor-grab select-none rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 transition hover:border-white/25 active:cursor-grabbing"
                  >
                    <p className="truncate text-sm font-medium text-white">{item.title}</p>
                    <p className="mt-0.5 text-[0.7rem] text-gray-500">
                      <span className="uppercase tracking-wide">{t(`family.${item.family}`)}</span>
                      {" · "}
                      {item.durationMinutes}m
                      {" · "}
                      {LOAD_CHIP_LABEL} {item.tssTarget}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div>
            <p className="mt-3 text-[0.7rem] text-gray-500">{t("empathySourcesHint")}</p>
            {empathyLoading ? (
              <p className="mt-4 text-xs text-gray-500">{t("empathyLoading")}</p>
            ) : empathyError ? (
              <p className="mt-4 text-xs text-amber-200" role="alert">
                {t("empathyError")}
              </p>
            ) : empathyPresets.length === 0 ? (
              <p className="mt-4 text-xs text-gray-500">{t("empathyEmpty")}</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {empathyPresets.map((preset) => (
                  <li
                    key={preset.presetId}
                    draggable
                    onDragStart={(e) =>
                      handleCardDragStart(e, {
                        kind: "empathy-preset",
                        presetId: preset.presetId,
                        title: preset.title,
                        discipline: preset.discipline,
                      })
                    }
                    className="cursor-grab select-none rounded-xl border border-violet-400/20 bg-violet-500/[0.06] px-3 py-2.5 transition hover:border-violet-400/40 active:cursor-grabbing"
                  >
                    <p className="truncate text-sm font-medium text-white">{preset.title}</p>
                    <p className="mt-0.5 text-[0.7rem] text-gray-500">
                      <span className="uppercase tracking-wide">{preset.discipline}</span>
                      {" · "}
                      {preset.plannedMinutes}m
                      {" · "}
                      {LOAD_CHIP_LABEL} {preset.tss}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </aside>

      {/* DESTRA — griglia settimana × atleti (sola lettura). */}
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset((n) => n - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-300 transition hover:border-white/25 hover:text-white"
              aria-label={t("prevWeek")}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="min-w-[7rem] text-center text-sm font-semibold text-white tabular-nums">{rangeLabel}</span>
            <button
              type="button"
              onClick={() => setWeekOffset((n) => n + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-300 transition hover:border-white/25 hover:text-white"
              aria-label={t("nextWeek")}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
            {weekOffset !== 0 ? (
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[0.7rem] font-medium text-gray-300 transition hover:border-white/25 hover:text-white"
              >
                {t("today")}
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {dropBusy ? <span className="text-[0.7rem] text-cyan-300">{t("assigning")}</span> : null}
            {weekLoading && athleteIds.length > 0 ? (
              <span className="text-[0.7rem] text-gray-500">{t("weekLoading")}</span>
            ) : null}
          </div>
        </div>

        {dropFeedback ? (
          <p
            role="status"
            className={`rounded-xl border px-4 py-2.5 text-sm ${
              dropFeedback.tone === "ok"
                ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
                : "border-amber-400/30 bg-amber-500/10 text-amber-200"
            }`}
          >
            {dropFeedback.text}
          </p>
        ) : null}

        {/* (A) BANNER CLIPBOARD — visibile finché la clipboard è piena; «Incolla qui» compare in ogni cella. */}
        {clipboard ? (
          <div
            role="status"
            className="flex flex-wrap items-center gap-3 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2.5 text-sm text-cyan-100"
          >
            <span className="min-w-0 flex-1">{t("clipboardBanner", { title: clipboard.title })}</span>
            <button
              type="button"
              onClick={cancelCopy}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[0.7rem] font-medium text-cyan-50 transition hover:border-white/30 hover:text-white"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              {t("cancelCopy")}
            </button>
          </div>
        ) : null}

        {/* (B) PICKER COPIA SETTIMANA — scelta atleta destinazione dal roster (escluso il sorgente). */}
        {copyWeekSource ? (
          <div className="rounded-xl border border-violet-400/30 bg-violet-500/[0.08] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-violet-100">{t("copyWeekPickTarget")}</p>
              <button
                type="button"
                onClick={cancelCopyWeek}
                disabled={copyWeekBusy}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[0.7rem] font-medium text-gray-200 transition enabled:hover:border-white/30 enabled:hover:text-white disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                {t("cancelCopy")}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {athletes
                .filter((a) => a.id !== copyWeekSource)
                .map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={copyWeekBusy}
                    onClick={() => runCopyWeek(copyWeekSource, a.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-violet-400/30 bg-black/25 px-3 py-1.5 text-xs font-medium text-white transition enabled:hover:border-violet-300/60 enabled:hover:bg-violet-500/15 disabled:cursor-default disabled:opacity-50"
                  >
                    {t("copyWeekConfirm")} · {formatAthleteLabel(a)}
                  </button>
                ))}
            </div>
            {copyWeekBusy ? <p className="mt-2 text-[0.7rem] text-violet-200">{t("assigning")}</p> : null}
          </div>
        ) : null}

        {coachActivation === "suspended" ? (
          <p className="rounded-xl border border-rose-500/30 bg-rose-950/20 px-4 py-3 text-sm text-rose-100" role="status">
            {t("coachSuspended")}
          </p>
        ) : null}

        {rosterErrText ? (
          <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
            {rosterErrText}
          </p>
        ) : null}

        {weekError ? (
          <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="alert">
            {t("weekError")}
          </p>
        ) : null}

        {rosterLoading && athletes.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-gray-500">
            {t("rosterLoading")}
          </div>
        ) : !rosterLoading && athletes.length === 0 && !rosterErrText ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-gray-500">
            {t("noAthletes")}
          </div>
        ) : athletes.length > 0 ? (
          <CoachCalendarWeekGrid
            athletes={athletes}
            days={days}
            cells={cells}
            executedCells={executedCells}
            onOpenExecuted={openExecuted}
            onEditPlanned={onEditPlanned}
            onCopyPlanned={onCopyPlanned}
            onPasteInto={onPasteInto}
            onCopyWeek={onCopyWeek}
            pasteActive={clipboard != null}
            pasteBusy={pasteBusy}
            copyWeekBusy={copyWeekBusy}
            onDropSession={onDropSession}
          />
        ) : null}
      </section>

      <CoachSessionAnalysisModal
        open={sessionModal.open}
        executed={sessionModal.executed}
        athleteId={sessionModal.athleteId}
        dateIso={sessionModal.dateIso}
        onClose={closeSessionModal}
      />

      <CalendarSessionEditModal
        open={editOpen}
        plannedRow={editRow}
        onClose={closeEditModal}
        onSaved={onEditSaved}
      />
    </div>
  );
}
