"use client";

import { useEffect, useState } from "react";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { Pro2Link } from "@/components/ui/empathy";
import { readSwrCache, writeSwrCache } from "@/lib/client-swr-cache";
import { fetchHealthPanelsTimeline, type HealthPanelTimelineRow } from "@/modules/health/services/health-module-api";

type BiomarkerPanelRow = {
  id: string;
  type: string;
  sample_date: string | null;
  reported_at: string | null;
};

export function HealthBiomarkerPanelsCard() {
  const { athleteId, loading: ctxLoading } = useActiveAthlete();
  const [loading, setLoading] = useState(true);
  const [panels, setPanels] = useState<BiomarkerPanelRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (ctxLoading) return;
    if (!athleteId) {
      setPanels([]);
      setErr("Nessun atleta attivo.");
      setLoading(false);
      return;
    }
    // Stale-while-revalidate: al ritorno mostra subito gli ultimi referti in cache
    // (niente skeleton) e rivalida in background.
    const cacheKey = `dash-biomarkers:${athleteId}`;
    const cached = readSwrCache<BiomarkerPanelRow[]>(cacheKey);
    if (cached) {
      setPanels(cached);
      setErr(null);
      setLoading(false);
    } else {
      setLoading(true);
    }
    let c = false;
    (async () => {
      setErr(null);
      try {
        const { panels: timelinePanels, error } = await fetchHealthPanelsTimeline(athleteId);
        if (c) return;
        if (error) {
          if (!cached) {
            setPanels([]);
            setErr(error);
          }
          return;
        }
        const compactRows: BiomarkerPanelRow[] = (timelinePanels as HealthPanelTimelineRow[])
          .map((p) => ({
            id: p.id,
            type: p.type,
            sample_date: p.sample_date,
            reported_at: p.reported_at,
          }))
          .slice(0, 8);
        setPanels(compactRows);
        writeSwrCache(cacheKey, compactRows);
      } catch {
        if (!c && !cached) setErr("Errore di rete.");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [athleteId, ctxLoading]);

  return (
    <section
      className="w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-left backdrop-blur-md sm:p-6"
      aria-label="Panel biomarkers"
    >
      <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-rose-400">Salute · dati reali</p>
      <h2 className="mt-2 text-lg font-bold text-white">Biomarcatori recenti</h2>

      {ctxLoading || loading ? (
        <div className="mt-4 h-2 w-36 animate-pulse rounded-full bg-white/10" />
      ) : null}

      {!ctxLoading && !loading && err ? (
        <p className="mt-4 text-sm text-amber-300/90" role="alert">
          {err}
        </p>
      ) : null}

      {!ctxLoading && !loading && !err && panels.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">Nessun referto ancora. Aggiungi i tuoi esami in Health.</p>
      ) : null}

      {!ctxLoading && !loading && !err && panels.length > 0 ? (
        <ul className="mt-4 grid gap-2 border-t border-white/10 pt-4 sm:grid-cols-2">
          {panels.map((p) => (
            <li
              key={p.id}
              className="flex min-w-0 flex-wrap items-baseline gap-x-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-300 transition-colors hover:border-rose-500/40 hover:bg-white/[0.05]"
            >
              <span className="min-w-0 truncate font-medium capitalize text-white">{p.type.replace(/_/g, " ")}</span>
              <span className="font-mono text-xs tabular-nums text-gray-500">
                {p.sample_date ?? p.reported_at?.slice(0, 10) ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <Pro2Link
        href="/health"
        variant="ghost"
        className="mt-4 inline-flex justify-center border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15"
      >
        Apri Health
      </Pro2Link>
    </section>
  );
}
