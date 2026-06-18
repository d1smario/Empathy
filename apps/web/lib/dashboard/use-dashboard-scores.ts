"use client";

import { useEffect, useState } from "react";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { readSwrCache, writeSwrCache } from "@/lib/client-swr-cache";
import type { DashboardScoresPayload } from "@/lib/dashboard/dashboard-scores";

function isPayload(value: unknown): value is DashboardScoresPayload {
  return Boolean(value) && typeof value === "object" && (value as { ok?: unknown }).ok === true;
}

export type UseDashboardScoresReturn = {
  data: DashboardScoresPayload | null;
  loading: boolean;
  error: string | null;
};

/**
 * Hook condiviso per caricare i punteggi dashboard.
 * Usa la stessa chiave SWR cache di `NewDashboardView` e `DashboardReadinessHeader`
 * (`dash-scores:${athleteId}`) per non fare doppi fetch e dipingere subito i dati
 * già disponibili.
 */
export function useDashboardScores(): UseDashboardScoresReturn {
  const { athleteId, loading: ctxLoading } = useActiveAthlete();
  // Init sincrono dalla cache (in-memory in SPA, sessionStorage al reload): dipinge
  // subito gli ultimi punteggi senza il flash "Caricamento dashboard…"; la fetch
  // sotto rivalida in background in silenzio.
  const [data, setData] = useState<DashboardScoresPayload | null>(() =>
    athleteId ? (readSwrCache<DashboardScoresPayload>(`dash-scores:${athleteId}`) ?? null) : null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ctxLoading) return;
    if (!athleteId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    const cacheKey = `dash-scores:${athleteId}`;

    async function load() {
      const cached = readSwrCache<DashboardScoresPayload>(cacheKey);
      if (cached) {
        setData(cached);
        setError(null);
        setLoading(false);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const res = await fetch(`/api/dashboard/scores?athleteId=${encodeURIComponent(athleteId ?? "")}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const json = (await res.json()) as unknown;
        if (!active) return;

        if (isPayload(json)) {
          setData(json);
          writeSwrCache(cacheKey, json);
          setError(null);
        } else if (!cached) {
          setError((json as { error?: string })?.error ?? "Impossibile caricare la dashboard");
          setData(null);
        }
      } catch {
        if (active && !cached) {
          setError("Impossibile caricare la dashboard");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [athleteId, ctxLoading]);

  return { data, loading, error };
}
