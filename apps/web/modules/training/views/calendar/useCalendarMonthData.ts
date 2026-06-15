"use client";

import type { ExecutedWorkout, PlannedWorkout } from "@empathy/domain-training";
import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TrainingPlannedWindowOkViewModel } from "@/api/training/contracts";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import type { WellnessByDateMap } from "@/lib/physiology/wellness-window-summary";
import { normalizeDateKey, workoutDayKey } from "@/lib/training/calendar-analyzer-helpers";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import {
  fetchPlannedWindowCached,
  invalidatePlannedWindowCacheForAthlete,
} from "@/lib/training/planned-window-client-cache";
import { useAthleteFtpWatts } from "@/lib/training/physiology/use-athlete-ftp-watts";
import { isViryaPlannedWorkout } from "@/lib/training/virya/virya-planned-notes";
import {
  activeViryaCalendarTombstones,
  clearViryaCalendarTombstone,
} from "@/lib/training/virya/virya-calendar-tombstone";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { importExecutedWorkoutFile, importPlannedProgramFile } from "@/modules/training/services/training-import-api";
import {
  deletePlannedWorkoutsOnDate,
  deleteViryaCalendarPlan,
  fetchViryaCalendarPlans,
  patchPlannedWorkout,
  type ViryaCalendarPlanSummary,
} from "@/modules/training/services/training-planned-api";

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Sposta una chiave YYYY-MM-DD di `delta` giorni (mezzogiorno locale → evita salti fusi). */
function addDaysToIsoDateKey(isoDay: string, deltaDays: number): string {
  const key = isoDay.slice(0, 10);
  const base = new Date(`${key}T12:00:00`);
  if (Number.isNaN(base.getTime())) return key;
  base.setDate(base.getDate() + deltaDays);
  return toDateKey(base);
}

/** Confronto solo giorni `YYYY-MM-DD` (stringa ISO, fuso mezzogiorno già applicato altrove). */
function minIsoDay(a: string, b: string): string {
  return a <= b ? a : b;
}
function maxIsoDay(a: string, b: string): string {
  return a >= b ? a : b;
}

/**
 * La griglia resta sul mese visibile, ma il fetch allarga la finestra (come il Builder):
 * evita sedute “perdute” ai bordi e allinea i dati alla lista “Prossime pianificate”.
 */
function calendarPlannedFetchBounds(monthStart: Date, monthEnd: Date): {
  monthFrom: string;
  monthTo: string;
  fetchFrom: string;
  fetchTo: string;
} {
  const monthFrom = toDateKey(monthStart);
  const monthTo = toDateKey(monthEnd);
  /** Griglia: mese visibile + margine breve (drag / bordi). Evita ±45g con trace_summary enormi. */
  const fetchFrom = addDaysToIsoDateKey(monthFrom, -7);
  const fetchTo = addDaysToIsoDateKey(monthTo, 7);
  return { monthFrom, monthTo, fetchFrom, fetchTo };
}

function mergeExecutedForDay(
  prev: ExecutedWorkout[],
  dayKey: string,
  dayRows: ExecutedWorkout[],
): ExecutedWorkout[] {
  const rest = prev.filter((w) => normalizeDateKey(workoutDayKey(w)) !== dayKey);
  return [...rest, ...dayRows].sort((a, b) => workoutDayKey(a).localeCompare(workoutDayKey(b)));
}

function mergePlannedForDay(prev: PlannedWorkout[], dayKey: string, dayRows: PlannedWorkout[]): PlannedWorkout[] {
  const rest = prev.filter((w) => normalizeDateKey(w.date) !== dayKey);
  return [...rest, ...dayRows].sort((a, b) => normalizeDateKey(a.date).localeCompare(normalizeDateKey(b.date)));
}

function normalizeIsoDateParam(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const m = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export const PLANNED_DRAG_MIME = "application/x-empathy-planned-workout";

export type PlannedDragPayload = { id: string; fromDate: string };

export function readPlannedDragPayload(dataTransfer: DataTransfer | null): PlannedDragPayload | null {
  if (!dataTransfer) return null;
  const raw = dataTransfer.getData(PLANNED_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PlannedDragPayload;
    if (typeof parsed.id !== "string" || !parsed.id.trim()) return null;
    const fromDate = normalizeDateKey(parsed.fromDate);
    if (!fromDate) return null;
    return { id: parsed.id.trim(), fromDate };
  } catch {
    return null;
  }
}

export interface CalendarFileImportFormState {
  mode: "auto" | "executed" | "planned";
  date: string;
  device: string;
  notes: string;
  file: File | null;
  /** Solo modalità planned: se l’API programmato fallisce, importa lo stesso file come eseguito (traccia → Analyzer). */
  fallbackExecutedOnPlannedError: boolean;
}

/** Solo per confronto oggettivo con Builder (stesso endpoint): HTTP + conteggi risposta. */
export interface CalendarFetchDiag {
  status: number;
  plannedN: number;
  executedN: number;
  executedFallback?: boolean;
  executedHiddenByPreference?: number;
  sampleDates?: string[];
  apiError?: string;
  resFrom?: string;
  resTo?: string;
}

export interface ExecutedCalendarGapInfo {
  totalRows: number;
  sample: Array<{
    id: string;
    date: string;
    dayKey: string;
    duration: ExecutedWorkout["durationMinutes"];
    tss: ExecutedWorkout["tss"];
  }>;
}

/**
 * Stato, fetch e ref anti-stale del Calendario training — IN BLOCCO.
 * Ordine fetch invariato: PLAN lite (griglia) → EXEC → wellness → VIRYA → dettaglio giorno.
 * Ref critici: `plannedWindowFetchGenRef` (risposte lente), `locallyRemovedPlannedIdsRef`
 * (righe appena eliminate), `plannedMoveInFlightRef` (finestra 250ms anti-revert del drag),
 * tombstone VIRYA (piani eliminati che ricompaiono).
 */
export function useCalendarMonthData() {
  const searchParams = useSearchParams();
  const { athleteId, role, adminScoped, loading: ctxLoading } = useActiveAthlete();
  /** Contenuti tecnici (diagnostica, dump) visibili solo a coach/admin, mai allo spettatore atleta. */
  const showTech = role === "coach" || adminScoped;
  const [calendarReady, setCalendarReady] = useState(false);
  const athleteFtpWatts = useAthleteFtpWatts(calendarReady ? athleteId : null);

  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));

  useEffect(() => {
    const q = normalizeIsoDateParam(searchParams.get("date"));
    if (q) {
      setSelectedDate(q);
      const parsed = new Date(`${q}T12:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        setMonthCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
      }
    }
  }, [searchParams]);

  const monthStart = useMemo(() => new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1), [monthCursor]);
  const monthEnd = useMemo(() => new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0), [monthCursor]);
  const monthStartWeekdayMonday = useMemo(() => (monthStart.getDay() + 6) % 7, [monthStart]);
  const daysInMonth = monthEnd.getDate();

  const [loading, setLoading] = useState(true);
  const [monthRefreshing, setMonthRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [planned, setPlanned] = useState<PlannedWorkout[]>([]);
  const [executed, setExecuted] = useState<ExecutedWorkout[]>([]);
  const [plannedProvenanceSummary, setPlannedProvenanceSummary] = useState<Partial<Record<string, number>> | null>(null);
  const [wellnessByDate, setWellnessByDate] = useState<WellnessByDateMap>({});
  const [showFileImport, setShowFileImport] = useState(false);
  const [fileImportForm, setFileImportForm] = useState<CalendarFileImportFormState>({
    mode: "auto",
    date: "",
    device: "auto",
    notes: "",
    file: null,
    fallbackExecutedOnPlannedError: false,
  });
  const [fetchDiag, setFetchDiag] = useState<CalendarFetchDiag | null>(null);

  const { monthFrom, monthTo, fetchFrom, fetchTo } = useMemo(
    () => calendarPlannedFetchBounds(monthStart, monthEnd),
    [monthStart, monthEnd],
  );

  /**
   * Evita che risposte `planned-window` più lente sovrascrivano una lettura più recente
   * (es. dopo elimina seduta: due fetch in parallelo → la vecchia ripristina la riga).
   */
  const plannedWindowFetchGenRef = useRef(0);
  const selectedDayFetchGenRef = useRef(0);
  const calendarReadyRef = useRef(false);
  const lastVisibilityRefreshAtRef = useRef(0);
  /** Id eliminati in-sessione: filtra fetch stale che ripresentano la riga prima che il DB sia allineato. */
  const locallyRemovedPlannedIdsRef = useRef<Set<string>>(new Set());
  const [viryaReappearWarning, setViryaReappearWarning] = useState<string | null>(null);
  const [dayDeleteAllBusy, setDayDeleteAllBusy] = useState(false);
  const [dayDeleteAllConfirm, setDayDeleteAllConfirm] = useState(false);
  const [dragPlannedId, setDragPlannedId] = useState<string | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [movePlannedBusyId, setMovePlannedBusyId] = useState<string | null>(null);
  /** Blocca merge stale del fetch giorno (250ms) durante drag/PATCH — evita revert su swap 05↔06. */
  const plannedMoveInFlightRef = useRef(0);
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const calendarEnrichmentGenRef = useRef(0);
  const [belowFoldReady, setBelowFoldReady] = useState(false);
  const [viryaPlans, setViryaPlans] = useState<ViryaCalendarPlanSummary[] | null>(null);
  const [viryaPlansLoadErr, setViryaPlansLoadErr] = useState<string | null>(null);
  const [viryaPlansLoading, setViryaPlansLoading] = useState(false);
  /** Evita doppio POST import (doppio click / StrictMode) che crea righe PLAN duplicate. */
  const trainingImportInFlightRef = useRef(false);

  /** Tick per forzare rifetch del dettaglio del giorno selezionato anche se `selectedDate`
   *  non cambia (es. import su stesso giorno gia' selezionato → la cella mostrava ancora
   *  i dati Fase 1 senza trace_summary aggiornato). */
  const [selectedDayRefreshTick, setSelectedDayRefreshTick] = useState(0);
  /** Giorno già arricchito dal pipeline post-griglia (evita doppio fetch trace al first paint). */
  const postGridEnrichedDayRef = useRef<string | null>(null);

  useEffect(() => {
    setDayDeleteAllConfirm(false);
  }, [selectedDate]);

  /** Cambio atleta: non mostrare griglia con dati del profilo precedente finché non arriva il nuovo fetch. */
  useEffect(() => {
    calendarReadyRef.current = false;
    setCalendarReady(false);
    setExecuted([]);
    setPlanned([]);
    setWellnessByDate({});
    setFetchDiag(null);
    setBelowFoldReady(false);
    setViryaPlans(null);
    setViryaPlansLoadErr(null);
    setViryaPlansLoading(false);
    postGridEnrichedDayRef.current = null;
  }, [athleteId]);

  const mergeSelectedDayFromWindow = useCallback(
    async (dayKey: string, fetchGen: number, scope: "grid" | "selected") => {
      const isStale = () =>
        scope === "grid"
          ? fetchGen !== plannedWindowFetchGenRef.current
          : fetchGen !== selectedDayFetchGenRef.current;
      if (!athleteId || plannedMoveInFlightRef.current > 0) return;
      try {
        const q = new URLSearchParams({
          athleteId,
          from: dayKey,
          to: dayKey,
          includeAthleteContext: "0",
          includeTraceSummary: "1",
          includePlannedNotes: "1",
        });
        const url = `/api/training/planned-window?${q}`;
        const cached = await fetchPlannedWindowCached<
          TrainingPlannedWindowOkViewModel | { ok: false; error?: string }
        >(url, {
          cache: "no-store",
          credentials: "same-origin",
          headers: await buildSupabaseAuthHeaders(),
        });
        if (isStale()) return;
        if (!cached.ok || !cached.json.ok) return;
        if (plannedMoveInFlightRef.current > 0) return;
        const day = cached.json as TrainingPlannedWindowOkViewModel;
        setExecuted((prev) => mergeExecutedForDay(prev, dayKey, day.executed ?? []));
        setPlanned((prev) => mergePlannedForDay(prev, dayKey, day.planned ?? []));
      } catch {
        /* best-effort */
      }
    },
    [athleteId],
  );

  /**
   * Dopo la griglia PLAN visibile: una chiamata alla volta (EXEC device → wellness → VIRYA).
   * Notes builder del giorno: solo al cambio data / pannello sotto (mergeSelectedDayFromWindow).
   */
  const runPostGridEnrichment = useCallback(
    async (gridFetchGen: number) => {
      const enrichGen = ++calendarEnrichmentGenRef.current;
      const isEnrichStale = () => enrichGen !== calendarEnrichmentGenRef.current;
      const isGridStale = () => gridFetchGen !== plannedWindowFetchGenRef.current;
      if (!athleteId) return;

      setBelowFoldReady(false);
      setViryaPlansLoading(true);
      setViryaPlansLoadErr(null);

      try {
        const authHeaders = await buildSupabaseAuthHeaders();
        const qExec = new URLSearchParams({
          athleteId,
          from: fetchFrom,
          to: fetchTo,
          includePlanned: "0",
          includeExecuted: "1",
          includeAthleteContext: "0",
          includeTraceSummary: "0",
          includePlannedNotes: "0",
        });
        const execUrl = `/api/training/planned-window?${qExec}`;
        const execCached = await fetchPlannedWindowCached<
          TrainingPlannedWindowOkViewModel | { ok: false; error?: string }
        >(execUrl, {
          cache: "no-store",
          credentials: "same-origin",
          headers: authHeaders,
        });
        if (isEnrichStale() || isGridStale()) return;
        if (execCached.ok && execCached.json.ok) {
          const core = execCached.json as TrainingPlannedWindowOkViewModel;
          setExecuted(core.executed ?? []);
          setFetchDiag((prev) =>
            prev
              ? {
                  ...prev,
                  executedN: core.executed?.length ?? 0,
                  executedFallback: core.executedAdminFallbackUsed ?? false,
                  executedHiddenByPreference: core.executedHiddenBySourcePreference ?? 0,
                  sampleDates: Array.isArray(core.executedSampleDates) ? core.executedSampleDates : prev.sampleDates,
                }
              : prev,
          );
        }
      } catch {
        /* eseguiti opzionali */
      }

      if (isEnrichStale() || isGridStale()) return;

      try {
        const authHeaders = await buildSupabaseAuthHeaders();
        const q = new URLSearchParams({
          athleteId,
          from: fetchFrom,
          to: fetchTo,
          includeWellness: "1",
          includePlanned: "0",
          includeExecuted: "0",
          includeAthleteContext: "0",
          includeTraceSummary: "0",
          includePlannedNotes: "0",
        });
        const url = `/api/training/planned-window?${q}`;
        const cached = await fetchPlannedWindowCached<
          TrainingPlannedWindowOkViewModel | { ok: false; error?: string }
        >(url, {
          cache: "no-store",
          credentials: "same-origin",
          headers: authHeaders,
        });
        if (isEnrichStale() || isGridStale()) return;
        if (cached.ok && cached.json.ok) {
          setWellnessByDate((cached.json as TrainingPlannedWindowOkViewModel).wellnessByDate ?? {});
        }
      } catch {
        /* wellness opzionale */
      }

      if (isEnrichStale() || isGridStale()) return;

      try {
        const plans = await fetchViryaCalendarPlans(athleteId);
        if (isEnrichStale() || isGridStale()) return;
        setViryaPlans(plans);
        const tombs = activeViryaCalendarTombstones(athleteId);
        for (const t of tombs) {
          if (plans.some((p) => p.tag === t.tag)) {
            await deleteViryaCalendarPlan({ athleteId, tag: t.tag });
          } else {
            clearViryaCalendarTombstone(athleteId, t.tag);
          }
        }
      } catch (e) {
        if (!isEnrichStale()) {
          setViryaPlansLoadErr(e instanceof Error ? e.message : "Errore piani VIRYA");
          setViryaReappearWarning(
            e instanceof Error
              ? `Piano VIRYA eliminato in precedenza ma ancora presente sul server: ${e.message}`
              : "Piano VIRYA eliminato in precedenza ma ancora presente sul server.",
          );
        }
      } finally {
        if (!isEnrichStale()) setViryaPlansLoading(false);
      }

      if (isEnrichStale() || isGridStale()) return;
      setBelowFoldReady(true);
    },
    [athleteId, fetchFrom, fetchTo],
  );

  const loadMonth = useCallback(
    async (opts?: { anchorDay?: string }) => {
      /** Con `athleteId` già noto non bloccare: altrimenti dopo delete il refresh può saltare e la UI resta su dati vecchi. */
      if (ctxLoading && !athleteId) return;
      const fetchGen = ++plannedWindowFetchGenRef.current;
      const isStale = () => fetchGen !== plannedWindowFetchGenRef.current;

      if (!athleteId) {
        setPlanned([]);
        setExecuted([]);
        setPlannedProvenanceSummary(null);
        setErr("Nessun atleta attivo.");
        setLoading(false);
        calendarReadyRef.current = false;
        setCalendarReady(false);
        setMonthRefreshing(false);
        return;
      }
      if (calendarReadyRef.current) {
        setMonthRefreshing(true);
      } else {
        setLoading(true);
      }
      setErr(null);
      setBelowFoldReady(false);
      if (opts?.anchorDay?.trim()) {
        invalidatePlannedWindowCacheForAthlete(athleteId);
      }
      try {
        let from = fetchFrom;
        let to = fetchTo;
        const anchorRaw = opts?.anchorDay?.trim() ?? "";
        const anchor = anchorRaw.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
        if (anchor) {
          /** Dopo import la `loadMonth` può girare prima che React aggiorni `monthCursor` → finestra mensile troppo stretta; forziamo inclusione del giorno salvato. */
          const padFrom = addDaysToIsoDateKey(anchor, -14);
          const padTo = addDaysToIsoDateKey(anchor, 14);
          from = minIsoDay(from, padFrom);
          to = maxIsoDay(to, padTo);
        }
        const authHeaders = await buildSupabaseAuthHeaders();
        const fetchPlannedWindow = async (q: URLSearchParams) => {
          const url = `/api/training/planned-window?${q}`;
          const cached = await fetchPlannedWindowCached<
            TrainingPlannedWindowOkViewModel | { ok: false; error?: string }
          >(url, {
            cache: "no-store",
            credentials: "same-origin",
            headers: authHeaders,
          });
          const res = { ok: cached.ok, status: cached.status } as Response;
          return { res, json: cached.json };
        };

        /** Step 1 — chip PLAN in cella (solo `planned_workouts`, lite). */
        const qPlan = new URLSearchParams({ athleteId, from, to });
        qPlan.set("includePlanned", "1");
        qPlan.set("includeExecuted", "0");
        qPlan.set("includeAthleteContext", "0");
        qPlan.set("includeTraceSummary", "0");
        qPlan.set("includePlannedNotes", "0");
        const { res, json } = await fetchPlannedWindow(qPlan);
        if (isStale()) return;

        if (!res.ok || !json.ok) {
          setPlanned([]);
          setExecuted([]);
          setPlannedProvenanceSummary(null);
          setWellnessByDate({});
          setFetchDiag({
            status: res.status,
            plannedN: 0,
            executedN: 0,
            apiError: ("error" in json && json.error) || res.statusText,
          });
          setErr(("error" in json && json.error) || "Lettura calendario non riuscita.");
          return;
        }
        const core = json as TrainingPlannedWindowOkViewModel;
        const p = core.planned ?? [];
        const removed = locallyRemovedPlannedIdsRef.current;
        const stillPresent = p.filter((row) => removed.has(row.id));
        if (stillPresent.length > 0) {
          setViryaReappearWarning(
            `Il server ha ancora ${stillPresent.length} seduta/e appena eliminate (id duplicato o refresh in ritardo). Usa «Tutto il piano VIRYA» se è un piano annuale, oppure attendi e riprova.`,
          );
        } else {
          setViryaReappearWarning(null);
          for (const id of removed) {
            if (!p.some((row) => row.id === id)) removed.delete(id);
          }
        }
        setPlanned(p.filter((row) => !removed.has(row.id)));
        setExecuted([]);
        setPlannedProvenanceSummary(core.plannedProvenanceSummary ?? null);
        setFetchDiag({
          status: res.status,
          plannedN: p.length,
          executedN: 0,
          executedFallback: false,
          executedHiddenByPreference: 0,
          sampleDates: [],
          resFrom: core.from,
          resTo: core.to,
        });
      } catch {
        if (isStale()) return;
        setErr("Errore di rete.");
        setPlanned([]);
        setExecuted([]);
        setPlannedProvenanceSummary(null);
        setWellnessByDate({});
        setFetchDiag({ status: 0, plannedN: 0, executedN: 0, apiError: "network" });
      } finally {
        if (!isStale()) {
          setLoading(false);
          setMonthRefreshing(false);
          calendarReadyRef.current = true;
          setCalendarReady(true);
          const gridGen = fetchGen;
          window.setTimeout(() => {
            void runPostGridEnrichment(gridGen);
          }, 0);
        }
      }
    },
    [athleteId, ctxLoading, fetchFrom, fetchTo, runPostGridEnrichment],
  );

  /**
   * Dettaglio giorno (notes builder + trace): solo dopo la coda EXEC → wellness → VIRYA,
   * così non compete con la griglia né duplica il primo paint.
   */
  useEffect(() => {
    if (!athleteId || ctxLoading || !calendarReady || !selectedDate || !belowFoldReady) return;
    const fetchGen = ++selectedDayFetchGenRef.current;
    const timer = window.setTimeout(() => {
      void mergeSelectedDayFromWindow(selectedDate, fetchGen, "selected").then(() => {
        if (fetchGen === selectedDayFetchGenRef.current) {
          postGridEnrichedDayRef.current = selectedDate;
        }
      });
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [
    athleteId,
    ctxLoading,
    calendarReady,
    belowFoldReady,
    selectedDate,
    selectedDayRefreshTick,
    mergeSelectedDayFromWindow,
  ]);

  const movePlannedWorkoutToDate = useCallback(
    async (workoutId: string, fromDate: string, toDate: string) => {
      const targetDate = normalizeDateKey(toDate);
      const sourceDate = normalizeDateKey(fromDate);
      if (!athleteId || !targetDate || !sourceDate || workoutId.trim() === "") return;
      if (targetDate === sourceDate) return;
      if (plannedMoveInFlightRef.current > 0) {
        setErr("Attendi il termine dello spostamento precedente, poi riprova.");
        return;
      }

      plannedMoveInFlightRef.current += 1;
      setMovePlannedBusyId(workoutId);
      setErr(null);
      setSuccess(null);
      const previous = planned;
      setPlanned((prev) =>
        prev.map((w) => (w.id === workoutId ? { ...w, date: targetDate } : w)),
      );
      setSelectedDate(targetDate);
      const targetMonth = new Date(`${targetDate}T12:00:00`);
      if (!Number.isNaN(targetMonth.getTime())) {
        setMonthCursor(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1));
      }

      try {
        await patchPlannedWorkout({
          id: workoutId,
          athleteId,
          patch: { date: targetDate },
        });
        setSuccess(`Seduta spostata al ${targetDate}.`);
        invalidatePlannedWindowCacheForAthlete(athleteId);
        await loadMonth({ anchorDay: targetDate });
        setSelectedDayRefreshTick((t) => t + 1);
      } catch (e) {
        setPlanned(previous);
        setErr(e instanceof Error ? e.message : "Spostamento seduta non riuscito");
        invalidatePlannedWindowCacheForAthlete(athleteId);
        await loadMonth({ anchorDay: sourceDate });
        setSelectedDayRefreshTick((t) => t + 1);
      } finally {
        plannedMoveInFlightRef.current = Math.max(0, plannedMoveInFlightRef.current - 1);
        setMovePlannedBusyId(null);
        setDragPlannedId(null);
        setDropTargetDate(null);
      }
    },
    [athleteId, loadMonth, planned],
  );

  useEffect(() => {
    const urlDay = normalizeIsoDateParam(searchParams.get("date")) ?? undefined;
    postGridEnrichedDayRef.current = null;
    void loadMonth(urlDay ? { anchorDay: urlDay } : undefined);
  }, [athleteId, loadMonth, searchParams]);

  /** Dopo salvataggio in Builder (altra tab) o ritorno alla pagina: ricarica finestra (debounced). */
  useEffect(() => {
    if (!athleteId || ctxLoading) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastVisibilityRefreshAtRef.current < 12_000) return;
      lastVisibilityRefreshAtRef.current = now;
      invalidatePlannedWindowCacheForAthlete(athleteId);
      void loadMonth({ anchorDay: selectedDate });
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [athleteId, ctxLoading, selectedDate, loadMonth]);

  const plannedByDate = useMemo(() => {
    const m = new Map<string, PlannedWorkout[]>();
    for (const w of planned) {
      const key = normalizeDateKey(w.date);
      if (!key) continue;
      const arr = m.get(key) ?? [];
      arr.push(w);
      m.set(key, arr);
    }
    return m;
  }, [planned]);

  const executedByDate = useMemo(() => {
    const m = new Map<string, ExecutedWorkout[]>();
    for (const w of executed) {
      const key = normalizeDateKey(workoutDayKey(w));
      if (!key) continue;
      const arr = m.get(key) ?? [];
      arr.push(w);
      m.set(key, arr);
    }
    return m;
  }, [executed]);

  const monthlySessionCount = useMemo(() => {
    const inMonth = (dayKey: string) => dayKey >= monthFrom && dayKey <= monthTo;
    const p = planned.filter((w) => inMonth(normalizeDateKey(w.date))).length;
    const e = executed.filter((w) => inMonth(normalizeDateKey(workoutDayKey(w)))).length;
    return p + e;
  }, [planned, executed, monthFrom, monthTo]);

  const monthDayKeys = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    });
  }, [daysInMonth, monthStart]);

  const monthExecutedRows = useMemo(() => {
    return executed.filter((w) => {
      const key = normalizeDateKey(workoutDayKey(w));
      return key >= monthFrom && key <= monthTo;
    });
  }, [executed, monthFrom, monthTo]);

  const monthExecutedRenderedCount = useMemo(() => {
    return monthDayKeys.reduce((acc, key) => acc + (executedByDate.get(key)?.length ?? 0), 0);
  }, [monthDayKeys, executedByDate]);

  const executedCalendarGap = useMemo<ExecutedCalendarGapInfo | null>(() => {
    if (monthExecutedRows.length <= 0) return null;
    if (monthExecutedRenderedCount > 0) return null;
    const sample = monthExecutedRows.slice(0, 5).map((w) => ({
      id: w.id,
      date: normalizeDateKey(w.date),
      dayKey: normalizeDateKey(workoutDayKey(w)),
      duration: w.durationMinutes,
      tss: w.tss,
    }));
    return {
      totalRows: monthExecutedRows.length,
      sample,
    };
  }, [monthExecutedRows, monthExecutedRenderedCount]);

  const dayPlanned = useMemo(() => plannedByDate.get(selectedDate) ?? [], [plannedByDate, selectedDate]);
  const dayExecuted = useMemo(() => executedByDate.get(selectedDate) ?? [], [executedByDate, selectedDate]);
  const builderReplacePlanned = useMemo(
    () => dayPlanned.find((w) => !isViryaPlannedWorkout(w.notes ?? null)) ?? dayPlanned[0] ?? null,
    [dayPlanned],
  );

  const calendarLibraryContract = useMemo(() => {
    const first = dayPlanned[0];
    if (!first) return null;
    return parsePro2BuilderSessionFromNotes(first.notes ?? null);
  }, [dayPlanned]);

  const monthLabel = monthCursor.toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  async function handleFileImportSubmit(e: FormEvent) {
    e.preventDefault();
    if (!athleteId || !fileImportForm.file) return;
    if (trainingImportInFlightRef.current) return;
    trainingImportInFlightRef.current = true;
    setSaving(true);
    setErr(null);
    setSuccess(null);
    try {
      let refreshAnchor: string | null = null;

      if (fileImportForm.mode === "planned") {
        const json = await importPlannedProgramFile({
          athleteId,
          file: fileImportForm.file,
          notes: fileImportForm.notes || undefined,
          date: normalizeDateKey(fileImportForm.date) || selectedDate,
        });
        if (json.structured) {
          const sf = typeof json.structuredFormat === "string" ? json.structuredFormat : "strutturato";
          const sc = json.structuredCompanion as
            | { status: string; message?: string; mode?: string; reason?: string }
            | undefined;
          let companionHint = "";
          if (sc?.status === "ok") {
            companionHint =
              " È stata creata anche una traccia EXEC companion (durata/TSS coerenti con la seduta) per l’Analyzer.";
          } else if (sc?.status === "error" && typeof sc.message === "string" && sc.message.trim()) {
            companionHint = ` Nota traccia companion: ${sc.message.trim()}`;
          } else if (sc?.status === "skipped" && typeof sc.reason === "string" && sc.reason.trim()) {
            companionHint = ` Traccia companion non creata: ${sc.reason.trim()}`;
          }
          const nRows =
            Array.isArray(json.intervalLadder) && json.intervalLadder.length > 0
              ? json.intervalLadder.length
              : null;
          const ladderHint =
            nRows != null
              ? ` Scala intervalli: ${nRows} righe (durata + watt per blocco).`
              : "";
          setSuccess(
            `Seduta pianificata importata (${sf}) con grafico a blocchi come nel Builder; apri la seduta su quel giorno per rivederla.${ladderHint}${companionHint}`,
          );
        } else {
          const n = typeof json.importedCount === "number" ? json.importedCount : 0;
          setSuccess(
            `Programmazione importata: ${n} sedute. Compaiono come chip PLAN (tipo, durata, TSS). Per curve ZWO/ERG/MRC o FIT workout usa un file dedicato: viene creata una seduta con struttura Builder.`,
          );
        }
        const fd = json.firstDate;
        if (fd && /^\d{4}-\d{2}-\d{2}$/.test(fd)) {
          setSelectedDate(fd);
          const d = new Date(`${fd}T12:00:00`);
          setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1));
        }
        refreshAnchor =
          normalizeDateKey(typeof json.firstDate === "string" ? json.firstDate : "") ||
          normalizeDateKey(fileImportForm.date) ||
          selectedDate ||
          null;
      } else {
        const effectiveDate = normalizeDateKey(fileImportForm.date) || selectedDate;
        const importIntent = fileImportForm.mode === "auto" ? "auto" : "executed";
        const json = await importExecutedWorkoutFile({
          athleteId,
          file: fileImportForm.file,
          date: effectiveDate,
          plannedDate: effectiveDate,
          notes: fileImportForm.notes || undefined,
          device: fileImportForm.device !== "auto" ? fileImportForm.device : undefined,
          importIntent,
        });
        if (json.structured) {
          const sf = typeof json.structuredFormat === "string" ? json.structuredFormat.toUpperCase() : "STRUTTURATO";
          const fallbackNote =
            json.routeReason === "auto_fallback_empty_executed_fit_workout"
              ? " Rilevato programma FIT (non attività): salvato come PLAN con blocchi Builder."
              : "";
          setSuccess(
            `Seduta in calendario (PLAN · ${sf}) per atleta attivo · giorno ${effectiveDate}.${fallbackNote} Apri il giorno per grafico a blocchi e export ZWO/FIT.`,
          );
          const fd = json.firstDate;
          if (fd && /^\d{4}-\d{2}-\d{2}$/.test(fd)) {
            setSelectedDate(fd);
            const d = new Date(`${fd}T12:00:00`);
            setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1));
            refreshAnchor = fd;
          } else {
            refreshAnchor = effectiveDate;
          }
        } else {
          const fmt =
            json.parsed && typeof json.parsed.format === "string"
              ? String(json.parsed.format).toUpperCase()
              : "FILE";
          setSuccess(`Workout eseguito (EXEC · ${fmt}) · giorno ${effectiveDate}.`);
          const imp = json.imported as { date?: string } | null | undefined;
          const impDate =
            (imp && typeof imp.date === "string" ? imp.date : null) ??
            (json.parsed && typeof json.parsed.date === "string" ? json.parsed.date : null);
          if (impDate && /^\d{4}-\d{2}-\d{2}$/.test(impDate.slice(0, 10))) {
            const key = impDate.slice(0, 10);
            setSelectedDate(key);
            const d = new Date(`${key}T12:00:00`);
            setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1));
          }
          const fromImpDate =
            impDate && /^\d{4}-\d{2}-\d{2}$/.test(impDate.slice(0, 10)) ? impDate.slice(0, 10) : null;
          const fromParsedDate = normalizeDateKey(
            json.parsed && typeof json.parsed.date === "string" ? json.parsed.date : "",
          );
          refreshAnchor = fromImpDate ?? (fromParsedDate || effectiveDate || null);
        }
      }
      setFileImportForm((f) => ({ ...f, file: null }));

      const anchorKey = (refreshAnchor ?? "").trim().slice(0, 10);
      await loadMonth(/^\d{4}-\d{2}-\d{2}$/.test(anchorKey) ? { anchorDay: anchorKey } : undefined);
      /** Forza rifetch del dettaglio giorno con trace pieno anche se selectedDate
       *  e' uguale a anchorKey: senza tick l'useEffect non parte. */
      setSelectedDayRefreshTick((t) => t + 1);
    } catch (x) {
      const msg = x instanceof Error ? x.message : "Errore in fase di import.";
      if (
        fileImportForm.mode === "planned" &&
        fileImportForm.fallbackExecutedOnPlannedError &&
        fileImportForm.file
      ) {
        try {
          const effectiveExecutedDate = normalizeDateKey(fileImportForm.date) || selectedDate;
          await importExecutedWorkoutFile({
            athleteId,
            file: fileImportForm.file,
            date: effectiveExecutedDate,
            notes: fileImportForm.notes || undefined,
            device: fileImportForm.device !== "auto" ? fileImportForm.device : undefined,
            importIntent: "executed",
          });
          setErr(null);
          setSuccess(
            `Import programmato non riuscito (${msg}). Stesso file salvato come workout eseguito nel giorno scelto: apri la sezione Analyzer sotto per le serie (come da import eseguito).`,
          );
          const key = effectiveExecutedDate.slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
            setSelectedDate(key);
            const d = new Date(`${key}T12:00:00`);
            setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1));
          }
          await loadMonth(/^\d{4}-\d{2}-\d{2}$/.test(key) ? { anchorDay: key } : undefined);
          setSelectedDayRefreshTick((t) => t + 1);
          setFileImportForm((f) => ({ ...f, file: null }));
        } catch (fb) {
          setErr(
            `${msg} — fallback Analyzer (import eseguito): ${fb instanceof Error ? fb.message : "non riuscito"}.`,
          );
        }
      } else {
        setErr(msg);
      }
    } finally {
      trainingImportInFlightRef.current = false;
      setSaving(false);
    }
  }

  /** Toolbar: torna al mese e giorno correnti. */
  const goToToday = useCallback(() => {
    const t = new Date();
    const cur = toDateKey(t);
    setMonthCursor(new Date(t.getFullYear(), t.getMonth(), 1));
    setSelectedDate(cur);
  }, []);

  /** Toolbar: apri/chiudi import file e scrolla alla sezione (id storico preservato). */
  const toggleFileImport = useCallback(() => {
    setShowFileImport((open) => {
      const next = !open;
      if (next) {
        setFileImportForm((f) => ({ ...f, date: selectedDateRef.current }));
        window.setTimeout(() => {
          document.getElementById("training-calendar-file-import")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 80);
      }
      return next;
    });
  }, []);

  /** Elimina tutte le sedute pianificate del giorno selezionato (con tombstone locale anti-ricomparsa). */
  const deleteAllPlannedOnSelectedDay = useCallback(async () => {
    if (!athleteId) return;
    setDayDeleteAllBusy(true);
    setSuccess(null);
    setErr(null);
    try {
      const r = await deletePlannedWorkoutsOnDate({
        athleteId,
        date: selectedDate,
      });
      for (const w of dayPlanned) {
        locallyRemovedPlannedIdsRef.current.add(w.id);
      }
      setPlanned((prev) => prev.filter((x) => normalizeDateKey(x.date) !== selectedDate));
      setDayDeleteAllConfirm(false);
      setSuccess(`Rimosse ${r.deletedOnDateCount} sedute pianificate del ${selectedDate}.`);
      await loadMonth();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Eliminazione giorno non riuscita");
    } finally {
      setDayDeleteAllBusy(false);
    }
  }, [athleteId, selectedDate, dayPlanned, loadMonth]);

  /** Eliminazione singola dal dettaglio pianificato: tombstone + refresh finestra. */
  const handlePlannedDeleted = useCallback(
    async (removedId?: string | null) => {
      if (removedId) {
        locallyRemovedPlannedIdsRef.current.add(removedId);
        setPlanned((prev) => prev.filter((x) => x.id !== removedId));
      }
      await loadMonth();
    },
    [loadMonth],
  );

  /** Mutazioni del giorno dal dettaglio builder (duplica, modifica…): invalida cache e rifetch trace. */
  const handleDayCalendarMutated = useCallback(async () => {
    if (athleteId) invalidatePlannedWindowCacheForAthlete(athleteId);
    await loadMonth({ anchorDay: selectedDateRef.current });
    setSelectedDayRefreshTick((t) => t + 1);
  }, [athleteId, loadMonth]);

  /** Analyzer: rimozione pianificato → tombstone locale + refresh. */
  const handleAnalyzerPlannedChanged = useCallback(
    (removedId?: string | null) => {
      if (removedId) {
        locallyRemovedPlannedIdsRef.current.add(removedId);
        setPlanned((prev) => prev.filter((w) => w.id !== removedId));
      }
      void loadMonth();
    },
    [loadMonth],
  );

  return {
    // contesto atleta / ruolo
    athleteId,
    role,
    adminScoped,
    ctxLoading,
    showTech,
    athleteFtpWatts,
    // mese / giorno selezionato
    monthCursor,
    setMonthCursor,
    selectedDate,
    setSelectedDate,
    monthLabel,
    monthStart,
    daysInMonth,
    monthStartWeekdayMonday,
    monthFrom,
    monthTo,
    fetchFrom,
    fetchTo,
    goToToday,
    // dati finestra
    planned,
    executed,
    plannedByDate,
    executedByDate,
    wellnessByDate,
    plannedProvenanceSummary,
    monthlySessionCount,
    monthExecutedRenderedCount,
    executedCalendarGap,
    dayPlanned,
    dayExecuted,
    builderReplacePlanned,
    calendarLibraryContract,
    // stato caricamento / messaggi
    loading,
    monthRefreshing,
    calendarReady,
    belowFoldReady,
    err,
    success,
    saving,
    fetchDiag,
    viryaReappearWarning,
    // piani VIRYA
    viryaPlans,
    viryaPlansLoadErr,
    viryaPlansLoading,
    // drag & drop chip PLAN
    dragPlannedId,
    setDragPlannedId,
    dropTargetDate,
    setDropTargetDate,
    movePlannedBusyId,
    movePlannedWorkoutToDate,
    // azioni giorno
    dayDeleteAllBusy,
    dayDeleteAllConfirm,
    setDayDeleteAllConfirm,
    deleteAllPlannedOnSelectedDay,
    handlePlannedDeleted,
    handleDayCalendarMutated,
    handleAnalyzerPlannedChanged,
    loadMonth,
    // import file
    showFileImport,
    toggleFileImport,
    fileImportForm,
    setFileImportForm,
    handleFileImportSubmit,
  };
}

export type CalendarMonthData = ReturnType<typeof useCalendarMonthData>;
