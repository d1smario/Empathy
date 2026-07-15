"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlannedWorkout } from "@empathy/domain-training";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { PLANNED_WORKOUTS_WINDOW_SELECT_LITE } from "@/lib/training/planned-executed-window-query";
import {
  dedupePlannedWorkoutDbRows,
  type PlannedWorkoutDbDedupeRow,
} from "@/lib/training/planned/planned-workout-dedupe-fingerprint";

/** PostgREST default cap = 1000: alza il tetto per finestre settimana multi-atleta. */
const PLANNED_WEEK_ROW_LIMIT = 5000;

/** Riga planned LITE (senza `notes`) arricchita con `athlete_id`/`kj_target` per la griglia coach. */
export type CoachCalendarPlannedRow = PlannedWorkoutDbDedupeRow & {
  athlete_id: string;
  kj_target: number | null;
};

export type CoachCalendarWeekState = {
  /** Chiave `${athleteId}|${YYYY-MM-DD}` → righe planned dedupate del giorno. */
  cells: Map<string, CoachCalendarPlannedRow[]>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

/** Chiave di cella canonica: atleta + giorno. */
export function coachCalendarCellKey(athleteId: string, dateIso: string): string {
  return `${athleteId}|${dateIso.slice(0, 10)}`;
}

/** Adatta una riga LITE al contratto `PlannedWorkout` per i view-model chip (contract null: nessun `notes`). */
export function coachCalendarRowToPlannedWorkout(row: CoachCalendarPlannedRow): PlannedWorkout {
  return {
    id: row.id ?? "",
    athleteId: row.athlete_id,
    date: String(row.date ?? "").slice(0, 10),
    type: row.type,
    durationMinutes: row.duration_minutes,
    tssTarget: row.tss_target,
    kjTarget: row.kj_target ?? undefined,
    kcalTarget: row.kcal_target ?? undefined,
  };
}

function normalizeRow(raw: unknown): CoachCalendarPlannedRow {
  const r = raw as Record<string, unknown>;
  return {
    id: typeof r.id === "string" ? r.id : undefined,
    athlete_id: String(r.athlete_id ?? "").trim(),
    date: typeof r.date === "string" ? r.date : undefined,
    type: String(r.type ?? "session"),
    duration_minutes: Number(r.duration_minutes ?? 0),
    tss_target: Number(r.tss_target ?? 0),
    kj_target: r.kj_target == null || r.kj_target === "" ? null : Number(r.kj_target),
    kcal_target: r.kcal_target == null || r.kcal_target === "" ? null : Number(r.kcal_target),
    notes: null,
    created_at: typeof r.created_at === "string" ? r.created_at : null,
  };
}

/**
 * Dedupe per atleta (le regole del guardrail lavorano per-giorno, non per-atleta) e
 * bucket in celle `${athleteId}|${giorno}`.
 */
function buildCells(rows: CoachCalendarPlannedRow[]): Map<string, CoachCalendarPlannedRow[]> {
  const byAthlete = new Map<string, CoachCalendarPlannedRow[]>();
  for (const row of rows) {
    if (!row.athlete_id) continue;
    const list = byAthlete.get(row.athlete_id) ?? [];
    list.push(row);
    byAthlete.set(row.athlete_id, list);
  }

  const cells = new Map<string, CoachCalendarPlannedRow[]>();
  for (const [athleteId, athleteRows] of byAthlete) {
    const deduped = dedupePlannedWorkoutDbRows(athleteRows);
    for (const row of deduped) {
      const day = String(row.date ?? "").slice(0, 10);
      if (!day) continue;
      const key = coachCalendarCellKey(athleteId, day);
      const cell = cells.get(key) ?? [];
      cell.push(row);
      cells.set(key, cell);
    }
  }
  return cells;
}

// Cache cross-mount della settimana coach: ri-atterrando (stessi atleti + stessa finestra) i
// chip compaiono subito, poi il refetch in background ri-allinea. Chiave = ids ordinati + finestra.
let weekCacheKey: string | null = null;
let weekCache: Map<string, CoachCalendarPlannedRow[]> | null = null;

function cacheKeyFor(ids: string[], from: string, to: string): string {
  return `${[...ids].sort().join(",")}|${from}|${to}`;
}

/**
 * Settimana calendario coach (sola lettura, DB-first): una query `planned_workouts`
 * `.in(athlete_id, ids).gte/lte(date)` con select LITE, dedupe per atleta e mappa per cella.
 * Nessuna scrittura. Cache module-level su `ids|from|to`.
 */
export function useCoachCalendarWeek(athleteIds: string[], weekFrom: string, weekTo: string): CoachCalendarWeekState {
  const key = cacheKeyFor(athleteIds, weekFrom, weekTo);
  const [cells, setCells] = useState<Map<string, CoachCalendarPlannedRow[]>>(
    () => (weekCacheKey === key && weekCache ? weekCache : new Map()),
  );
  const [loading, setLoading] = useState(!(weekCacheKey === key && weekCache));
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const refetch = useCallback(() => setReloadTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    // Nessun atleta: cella vuota, nessuna query.
    if (athleteIds.length === 0) {
      setCells(new Map());
      setError(null);
      setLoading(false);
      return;
    }

    const hasCache = weekCacheKey === key && weekCache;
    if (hasCache) {
      setCells(weekCache!);
      setError(null);
      setLoading(false);
    } else {
      setLoading(true);
      setError(null);
    }

    (async () => {
      const supabase = createEmpathyBrowserSupabase();
      if (!supabase) {
        if (!cancelled && !hasCache) setError("supabase_unconfigured");
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const { data, error: queryError } = await supabase
          .from("planned_workouts")
          .select(PLANNED_WORKOUTS_WINDOW_SELECT_LITE)
          .in("athlete_id", athleteIds)
          .gte("date", weekFrom)
          .lte("date", weekTo)
          .limit(PLANNED_WEEK_ROW_LIMIT);
        if (cancelled) return;
        if (queryError) {
          if (!hasCache) setError(queryError.message);
          return;
        }
        const rows = (data ?? []).map(normalizeRow);
        const nextCells = buildCells(rows);
        weekCacheKey = key;
        weekCache = nextCells;
        setCells(nextCells);
        setError(null);
      } catch {
        if (!cancelled && !hasCache) setError("request_failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `key` racchiude ids+finestra; `reloadTick` forza il refetch manuale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reloadTick]);

  return { cells, loading, error, refetch };
}
