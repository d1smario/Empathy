"use client";

import { useCallback, useEffect, useState } from "react";
import { executedWorkoutFromDbRow, type ExecutedWorkout, type ExecutedWorkoutDbRow } from "@empathy/domain-training";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { EXECUTED_WORKOUTS_WINDOW_SELECT_LITE } from "@/lib/training/planned-executed-window-query";
import { coachCalendarCellKey } from "@/modules/training/services/use-coach-calendar-week";

/** PostgREST default cap = 1000: alza il tetto per finestre settimana multi-atleta. */
const EXECUTED_WEEK_ROW_LIMIT = 5000;

export type CoachCalendarExecutedWeekState = {
  /** Chiave `${athleteId}|${YYYY-MM-DD}` → sedute ESEGUITE del giorno (anche non programmate). */
  cellMap: Map<string, ExecutedWorkout[]>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

function buildCells(rows: ExecutedWorkout[]): Map<string, ExecutedWorkout[]> {
  const cells = new Map<string, ExecutedWorkout[]>();
  for (const row of rows) {
    if (!row.athleteId) continue;
    const day = String(row.date ?? "").slice(0, 10);
    if (!day) continue;
    const key = coachCalendarCellKey(row.athleteId, day);
    const cell = cells.get(key) ?? [];
    cell.push(row);
    cells.set(key, cell);
  }
  return cells;
}

// Cache cross-mount degli eseguiti: stessa strategia del week hook planned. Chiave = ids+finestra.
let execCacheKey: string | null = null;
let execCache: Map<string, ExecutedWorkout[]> | null = null;

function cacheKeyFor(ids: string[], from: string, to: string): string {
  return `${[...ids].sort().join(",")}|${from}|${to}`;
}

/**
 * Sedute ESEGUITE della settimana coach (sola lettura, DB-first): UNA query `executed_workouts`
 * `.in(athlete_id, ids).gte/lte(date)` con select LITE, SENZA filtro `source` e SENZA join con
 * `planned_workouts` — così gli eseguiti con `plannedWorkoutId` null (attività non programmate)
 * ENTRANO nella cella. RLS `*_access_scoped` (coach_athletes) autorizza la lettura, come per il
 * planned. Bucket per cella `${athleteId}|${giorno}` con la STESSA chiave del week hook. Nessuna
 * scrittura. Cache module-level su `ids|from|to`.
 */
export function useCoachCalendarExecutedWeek(
  athleteIds: string[],
  weekFrom: string,
  weekTo: string,
): CoachCalendarExecutedWeekState {
  const key = cacheKeyFor(athleteIds, weekFrom, weekTo);
  const [cellMap, setCellMap] = useState<Map<string, ExecutedWorkout[]>>(
    () => (execCacheKey === key && execCache ? execCache : new Map()),
  );
  const [loading, setLoading] = useState(!(execCacheKey === key && execCache));
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const refetch = useCallback(() => setReloadTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    if (athleteIds.length === 0) {
      setCellMap(new Map());
      setError(null);
      setLoading(false);
      return;
    }

    const hasCache = execCacheKey === key && execCache;
    if (hasCache) {
      setCellMap(execCache!);
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
          .from("executed_workouts")
          .select(EXECUTED_WORKOUTS_WINDOW_SELECT_LITE)
          .in("athlete_id", athleteIds)
          .gte("date", weekFrom)
          .lte("date", weekTo)
          .limit(EXECUTED_WEEK_ROW_LIMIT);
        if (cancelled) return;
        if (queryError) {
          if (!hasCache) setError(queryError.message);
          return;
        }
        const rows = ((data ?? []) as ExecutedWorkoutDbRow[]).map(executedWorkoutFromDbRow);
        const nextCells = buildCells(rows);
        execCacheKey = key;
        execCache = nextCells;
        setCellMap(nextCells);
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

  return { cellMap, loading, error, refetch };
}
