"use client";

/**
 * Header readiness ("Il tuo punteggio") per il titolo pagina della dashboard.
 *
 * Mostra lo score generale di readiness in un anello conic-gradient brand
 * (viola→rosa→arancio) col numero al centro, la label, e un riferimento
 * "Ottimale 100" accanto. NIENTE Human System Status.
 *
 * Riusa lo stesso contratto e la stessa cache SWR cross-mount di
 * `NewDashboardView` (chiave `dash-scores:${athleteId}` in `@/lib/client-swr-cache`):
 * se c'è cache la dipinge subito e rivalida in background — niente doppio fetch,
 * niente spinner ad ogni atterraggio. Dati assenti => "—" muto, mai numeri finti.
 */

import { useEffect, useState } from "react";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { readSwrCache, writeSwrCache } from "@/lib/client-swr-cache";
import type { DashboardScoresPayload } from "@/lib/dashboard/dashboard-scores";

function fmtScore(score: number | null): string {
  return score == null ? "—" : String(Math.round(score));
}

function isPayload(value: unknown): value is DashboardScoresPayload {
  return Boolean(value) && typeof value === "object" && (value as { ok?: unknown }).ok === true;
}

/** Anello readiness compatto per l'header: numero al centro, gradiente brand. */
function HeaderRing({ score, label }: { score: number | null; label: string | null }) {
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
  const deg = (pct / 100) * 360;
  return (
    <div
      className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full sm:h-[4.5rem] sm:w-[4.5rem]"
      style={{
        background: `conic-gradient(from -90deg, #a855f7 0deg, #ec4899 ${deg * 0.55}deg, #fb923c ${deg}deg, rgba(255,255,255,0.08) ${deg}deg 360deg)`,
      }}
      role="img"
      aria-label={`Il tuo punteggio ${fmtScore(score)}${label ? `, ${label}` : ""}`}
    >
      <div className="grid h-[3.25rem] w-[3.25rem] place-items-center rounded-full bg-black/85 sm:h-14 sm:w-14">
        <span className="text-xl font-bold tabular-nums text-white sm:text-2xl">{fmtScore(score)}</span>
      </div>
    </div>
  );
}

export function DashboardReadinessHeader() {
  const { athleteId } = useActiveAthlete();
  const [data, setData] = useState<DashboardScoresPayload | null>(null);

  useEffect(() => {
    let active = true;
    const cacheKey = athleteId ? `dash-scores:${athleteId}` : null;

    async function load() {
      if (!athleteId || !cacheKey) {
        setData(null);
        return;
      }
      // Stale-while-revalidate: cache → dipingi subito; condivisa con NewDashboardView.
      const cached = readSwrCache<DashboardScoresPayload>(cacheKey);
      if (cached) setData(cached);

      try {
        const res = await fetch(`/api/dashboard/scores?athleteId=${encodeURIComponent(athleteId)}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as unknown;
        if (!active) return;
        if (isPayload(json)) {
          setData(json);
          writeSwrCache(cacheKey, json);
        }
      } catch {
        // Silenzioso: l'header non blocca la pagina; la vista principale gestisce gli errori.
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [athleteId]);

  const readiness = data?.readiness ?? { score: null, label: null };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 sm:gap-4 sm:px-4">
      <HeaderRing score={readiness.score} label={readiness.label} />
      <div className="min-w-0">
        <div className="font-mono text-[0.58rem] uppercase tracking-[0.2em] text-gray-500">Il tuo punteggio</div>
        <div className="text-sm font-semibold capitalize text-gray-100">{readiness.label ?? "In attesa"}</div>
        <div className="mt-0.5 text-[0.65rem] text-gray-500">
          Ottimale <span className="font-semibold text-gray-300">100</span>
        </div>
      </div>
    </div>
  );
}
