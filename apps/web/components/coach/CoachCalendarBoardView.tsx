"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { ExecutedWorkout } from "@empathy/domain-training";
import { plannedCalendarChipViewModel } from "@/lib/training/planned-workout-display";
import { useCoachRoster } from "@/lib/coach/use-coach-roster";
import {
  CoachCalendarWeekGrid,
  type CoachCalendarDay,
} from "@/components/coach/CoachCalendarWeekGrid";
import {
  CoachCalendarSourcesMenu,
  type CoachCalendarSourceTab,
} from "@/components/coach/CoachCalendarSourcesMenu";
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
import { deletePlannedWorkout } from "@/modules/training/services/training-planned-api";
import { loadAerobicStarterPresetsClient } from "@/lib/training/library/aerobic-starter-presets-client";
import type { AerobicStarterPreset } from "@/lib/training/library/starter-pack-aerobic";
import type { CoachWorkoutLibraryItemView } from "@/lib/training/library/coach-workout-library-types";
import {
  COACH_CALENDAR_DRAG_MIME,
  encodeCoachCalendarDragPayload,
  type CoachCalendarDragPayload,
} from "@/lib/training/library/coach-calendar-drag-payload";

/**
 * La «mano» della board: UNA sola seduta selezionata alla volta, qualunque sia la sorgente.
 * Una sola mano = un solo bottone per cella (mai «Incolla qui» e «Assegna qui» insieme).
 * - `clone`  → seduta già a calendario copiata con l'icona copia (ex clipboard);
 * - `source` → voce scelta dal menù a tendina (libreria coach o template Empathy).
 */
type PendingAssign =
  | { kind: "clone"; sourceId: string; title: string }
  | { kind: "source"; payload: CoachCalendarDragPayload; title: string };

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

  // (A) SELEZIONE → ASSEGNAZIONE — una sola «mano» in-memory (NIENTE persistenza).
  // Si riempie in due modi: copia di una seduta già a calendario, oppure scelta dal menù
  // sorgenti. Si svuota solo con la X sul chip o con Escape: dopo un'assegnazione RESTA piena,
  // così la stessa seduta va su più atleti con più click senza riaprire il menù.
  const [pending, setPending] = useState<PendingAssign | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);
  const onCopyPlanned = useCallback((row: CoachCalendarPlannedRow, _athleteId: string) => {
    if (!row.id) return;
    const chip = plannedCalendarChipViewModel(coachCalendarRowToPlannedWorkout(row));
    setPending({ kind: "clone", sourceId: row.id, title: chip.sportLabel });
  }, []);
  const cancelPending = useCallback(() => setPending(null), []);

  const onPickSource = useCallback((payload: CoachCalendarDragPayload, title: string) => {
    setPending({ kind: "source", payload, title });
  }, []);

  // ELIMINA seduta pianificata — riusa `deletePlannedWorkout` (DELETE /api/training/planned),
  // la stessa API del calendario atleta. Distruttiva e non annullabile → conferma esplicita
  // PRIMA della chiamata (stesso pattern di TrainingCalendarAnalyzer). A esito, `refetchWeek`
  // come fanno copia/modifica: la griglia si riallinea al DB, niente stato locale ottimistico.
  const [deleteBusy, setDeleteBusy] = useState(false);
  const onDeletePlanned = useCallback(
    async (row: CoachCalendarPlannedRow, athleteId: string) => {
      const id = row.id;
      if (!id || deleteBusy) return;
      if (!window.confirm(t("confirmDeletePlanned"))) return;
      setDeleteBusy(true);
      setDropFeedback(null);
      try {
        await deletePlannedWorkout({ id, athleteId });
        setDropFeedback({ tone: "ok", text: t("deletedToast") });
        refetchWeek();
      } catch {
        setDropFeedback({ tone: "error", text: t("deleteError") });
      } finally {
        setDeleteBusy(false);
      }
    },
    [deleteBusy, refetchWeek, t],
  );

  const onAssignInto = useCallback(
    async (athleteId: string, dateIso: string) => {
      if (!pending || assignBusy) return;
      setAssignBusy(true);
      setDropFeedback(null);
      // Un solo punto di smistamento verso le tre API già esistenti.
      const genericError = pending.kind === "clone" ? t("copyError") : t("assignError");
      try {
        const res =
          pending.kind === "clone"
            ? await clonePlannedWorkout({ sourceId: pending.sourceId, athleteId, date: dateIso })
            : pending.payload.kind === "coach-item"
              ? await applyCoachLibraryItem({
                  itemId: pending.payload.itemId,
                  athleteId,
                  date: dateIso,
                  applyScaling: false,
                })
              : await applyEmpathyPreset({ presetId: pending.payload.presetId, athleteId, date: dateIso });
        if (res.ok) {
          setDropFeedback({ tone: "ok", text: t("assignedToast", { title: pending.title }) });
          refetchWeek();
        } else if (res.error === "forbidden" || res.error === "forbidden_source") {
          setDropFeedback({ tone: "error", text: t("assignForbidden") });
        } else {
          setDropFeedback({ tone: "error", text: genericError });
        }
      } catch {
        setDropFeedback({ tone: "error", text: genericError });
      } finally {
        setAssignBusy(false);
      }
    },
    [pending, assignBusy, refetchWeek, t],
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

  // Menù a tendina delle sorgenti (ex aside a sinistra): `open` sollevato qui perché anche
  // l'Escape «svuota la mano» vive a questo livello e i due non devono accavallarsi.
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sourceTab, setSourceTab] = useState<CoachCalendarSourceTab>("coach");

  // Escape svuota la mano. NIENTE Escape quando è aperto un popover/modale che lo usa già
  // per sé (menù sorgenti, editor seduta, analisi): lì Escape deve solo chiudere quello.
  useEffect(() => {
    if (!pending) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (sourcesOpen || editOpen || sessionModal.open || copyWeekSource) return;
      setPending(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pending, sourcesOpen, editOpen, sessionModal.open, copyWeekSource]);

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
    /* UNA colonna: il calendario prende TUTTA la larghezza. Le sorgenti sono passate
       dall'aside di 18rem a un menù a tendina nella barra qui sotto — vedi
       CoachCalendarSourcesMenu per il perché. */
    <div className="min-w-0 space-y-4">
      {/* Barra settimana: navigazione a sinistra, «mano» + menù sorgenti a destra. */}
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Chip «in mano»: la seduta selezionata è SEMPRE visibile, con la X per annullare
              (Escape fa lo stesso). Compatto e in linea con la data: niente banda full-width. */}
          {pending ? (
            <span
              role="status"
              className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[0.72rem] font-medium text-cyan-100"
            >
              {/* min-w-0 + max-w piccolo su schermo stretto: il chip si accorcia invece di
                  spingere fuori il trigger (la sidebar da 16.5rem lascia poco spazio). */}
              <span className="min-w-0 max-w-[8rem] truncate sm:max-w-[14rem]">
                {pending.kind === "clone"
                  ? t("clipboardShort", { title: pending.title })
                  : t("selectedShort", { title: pending.title })}
              </span>
              <button
                type="button"
                onClick={cancelPending}
                aria-label={t("cancelSelection")}
                title={t("cancelSelection")}
                className="flex shrink-0 items-center justify-center rounded text-cyan-50/80 transition hover:text-white"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          ) : null}
          {dropBusy || assignBusy ? <span className="text-[0.7rem] text-cyan-300">{t("assigning")}</span> : null}
          {deleteBusy ? <span className="text-[0.7rem] text-rose-300">{t("deleting")}</span> : null}
          {weekLoading && athleteIds.length > 0 ? (
            <span className="text-[0.7rem] text-gray-500">{t("weekLoading")}</span>
          ) : null}
          {/* Trigger per ULTIMO (più a destra): con justify-end non si sposta quando il chip
              compare o sparisce. Ancorato a destra, il pannello non copre la colonna atleti. */}
          <CoachCalendarSourcesMenu
            open={sourcesOpen}
            onOpenChange={setSourcesOpen}
            tab={sourceTab}
            onTabChange={setSourceTab}
            libraryItems={libraryItems}
            libraryLoading={libraryLoading}
            libraryError={libraryError}
            empathyPresets={empathyPresets}
            empathyLoading={empathyLoading}
            empathyError={empathyError}
            onDragStartSource={handleCardDragStart}
            onPickSource={onPickSource}
          />
        </div>
      </div>

      {/* Riga guida: dice quello che si fa DAVVERO (scegli → clicca il giorno). */}
      <p className="text-[0.72rem] text-gray-500">
        {pending ? t("assignHintActive") : t("assignHintIdle")}
      </p>

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

      {/* (B) Il picker COPIA SETTIMANA vive nella griglia come POPOVER ancorato al bottone
          «Copia sett.» (niente fascia in-flow: la board non si sposta all'apertura). */}

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
          onDeletePlanned={onDeletePlanned}
          onAssignInto={onAssignInto}
          onCopyWeek={onCopyWeek}
          copyWeekSource={copyWeekSource}
          onRunCopyWeek={runCopyWeek}
          onCancelCopyWeek={cancelCopyWeek}
          assignActive={pending != null}
          assignBusy={assignBusy}
          deleteBusy={deleteBusy}
          assignHereLabel={pending?.kind === "source" ? t("assignHere") : t("pasteHere")}
          copyWeekBusy={copyWeekBusy}
          onDropSession={onDropSession}
        />
      ) : null}

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
