"use client";

/**
 * Dashboard "F0" — Human Performance Operating System (vista corpo).
 *
 * L'hero e lo score generale di readiness vivono ORA nel titolo pagina
 * (`StandardModuleSurface` + `DashboardReadinessHeader`): qui resta il CORPO.
 * Umanoide centrale (`AthleteCanvas mode="idle"`, posa neutra senza HUD) con 9
 * contatori piccoli disposti quasi in cerchio attorno ad esso, più "Trend 7g" e
 * "Profilo fisiologico" (KPI).
 *
 * Cablata su `GET /api/dashboard/scores` (contratto in `@/lib/dashboard/dashboard-scores`).
 * Stale-while-revalidate cross-mount (`@/lib/client-swr-cache`, chiave condivisa
 * con `DashboardReadinessHeader`): cache → dipingi subito, rivalida in background —
 * niente doppio fetch, niente spinner ad ogni atterraggio. Dati assenti => stato
 * "in attesa" muto, mai numeri finti.
 */

import { useEffect, useMemo, useState } from "react";
import { DashboardTwinRadial } from "@/components/dashboard/DashboardTwinRadial";
import { DashboardReadinessHeader } from "@/components/dashboard/DashboardReadinessHeader";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { readSwrCache, writeSwrCache } from "@/lib/client-swr-cache";
import type {
  DashboardArea,
  DashboardAreaKey,
  DashboardKpis,
  DashboardScoresPayload,
} from "@/lib/dashboard/dashboard-scores";

/* ------------------------------------------------------------------ */
/*  Palette + copy per area                                           */
/* ------------------------------------------------------------------ */

type AreaTheme = { ring: string; text: string; border: string; glow: string };

const AREA_THEME: Record<DashboardAreaKey, AreaTheme> = {
  performance: { ring: "#fb7185", text: "text-rose-300", border: "border-rose-500/40", glow: "rgba(251,113,133,0.25)" },
  recovery: { ring: "#a78bfa", text: "text-violet-300", border: "border-violet-500/40", glow: "rgba(167,139,250,0.25)" },
  sleep: { ring: "#60a5fa", text: "text-sky-300", border: "border-sky-500/40", glow: "rgba(96,165,250,0.25)" },
  stress: { ring: "#c084fc", text: "text-purple-300", border: "border-purple-500/40", glow: "rgba(192,132,252,0.25)" },
  biomarkers: { ring: "#fb923c", text: "text-orange-300", border: "border-orange-500/40", glow: "rgba(251,146,60,0.25)" },
  hormones: { ring: "#2dd4bf", text: "text-teal-300", border: "border-teal-500/40", glow: "rgba(45,212,191,0.25)" },
  microbiome: { ring: "#f472b6", text: "text-pink-300", border: "border-pink-500/40", glow: "rgba(244,114,182,0.25)" },
  nutrition: { ring: "#34d399", text: "text-emerald-300", border: "border-emerald-500/40", glow: "rgba(52,211,153,0.25)" },
  longevity: { ring: "#fbbf24", text: "text-amber-300", border: "border-amber-500/40", glow: "rgba(251,191,36,0.25)" },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function fmtScore(score: number | null): string {
  return score == null ? "—" : String(Math.round(score));
}

function fmtKpi(value: number | null, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return digits > 0 ? value.toFixed(digits) : String(Math.round(value));
}

function isPayload(value: unknown): value is DashboardScoresPayload {
  return Boolean(value) && typeof value === "object" && (value as { ok?: unknown }).ok === true;
}

/* ------------------------------------------------------------------ */
/*  Sparkline                                                         */
/* ------------------------------------------------------------------ */

function Sparkline({ values, color, width = 96, height = 28 }: { values: number[]; color: string; width?: number; height?: number }) {
  const pad = 3;
  if (!values.length) {
    // Linea piatta tenue: nessun dato inventato.
    const y = height / 2;
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="h-7 w-full" preserveAspectRatio="none" aria-hidden>
        <line x1={pad} y1={y} x2={width - pad} y2={y} stroke="rgba(148,163,184,0.25)" strokeWidth={1.5} strokeDasharray="3 4" />
      </svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = pad + (values.length === 1 ? (width - pad * 2) / 2 : (i / (values.length - 1)) * (width - pad * 2));
      const y = height - pad - ((v - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-7 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  KpiTile                                                           */
/* ------------------------------------------------------------------ */

function KpiTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5">
      <div className="font-mono text-[0.58rem] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-0.5 text-lg font-bold tabular-nums text-white">
        {value}
        {value !== "—" && unit ? <span className="ml-1 text-xs font-medium text-gray-500">{unit}</span> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Vista principale                                                  */
/* ------------------------------------------------------------------ */

const AREA_ORDER: DashboardAreaKey[] = [
  "performance",
  "recovery",
  "sleep",
  "stress",
  "biomarkers",
  "hormones",
  "microbiome",
  "nutrition",
  "longevity",
];

export function NewDashboardView() {
  const { athleteId, role, loading: athleteLoading } = useActiveAthlete();
  const [data, setData] = useState<DashboardScoresPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const cacheKey = athleteId ? `dash-scores:${athleteId}` : null;

    async function load() {
      if (!athleteId || !cacheKey) {
        setData(null);
        setLoading(false);
        return;
      }
      // Stale-while-revalidate: cache → dipingi subito, niente skeleton al ritorno.
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
        const res = await fetch(`/api/dashboard/scores?athleteId=${encodeURIComponent(athleteId)}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as unknown;
        if (!active) return;
        if (isPayload(json)) {
          setData(json);
          writeSwrCache(cacheKey, json);
          setError(null);
        } else if (!cached) {
          const msg = (json as { error?: string })?.error ?? "Impossibile caricare la dashboard";
          setError(msg);
          setData(null);
        }
      } catch {
        if (active && !cached) setError("Impossibile caricare la dashboard");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [athleteId]);

  const areasByKey = useMemo(() => {
    const map = new Map<DashboardAreaKey, DashboardArea>();
    for (const area of data?.areas ?? []) map.set(area.key, area);
    return map;
  }, [data]);

  const orderedAreas = useMemo(
    () => AREA_ORDER.map((key) => areasByKey.get(key)).filter((a): a is DashboardArea => Boolean(a)),
    [areasByKey],
  );

  if (!athleteId && !athleteLoading) {
    return (
      <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-gray-400">
        {role === "coach" ? "Seleziona un atleta attivo per vedere la dashboard." : "Profilo atleta non disponibile."}
      </p>
    );
  }

  if (loading && !data) {
    return (
      <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-gray-500">
        Caricamento dashboard…
      </p>
    );
  }

  if (error && !data) {
    return (
      <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100" role="alert">
        {error}
      </p>
    );
  }

  const kpis: DashboardKpis =
    data?.kpis ?? {
      weightKg: null,
      bodyFatPct: null,
      vo2max: null,
      ftpWatts: null,
      lt1Watts: null,
      lt2Watts: null,
      vLamax: null,
      biologicalAge: null,
      targetAge: null,
    };

  return (
    <div className="space-y-10">
      {/* CORPO + AREE: umanoide point-cloud denso con i 9 contatori ad arco. */}
      <section aria-label="Aree fisiologiche" className="relative">
        <div className="absolute right-0 top-0 z-10">
          <DashboardReadinessHeader />
        </div>
        <DashboardTwinRadial areas={data?.areas ?? []} />
      </section>

      {/* TREND 7 GIORNI */}
      <section aria-label="Trend 30 giorni">
        <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Trend · 30 giorni</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {orderedAreas.map((area) => {
            const theme = AREA_THEME[area.key];
            return (
              <div key={area.key} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-[0.58rem] uppercase tracking-wider ${theme.text}`}>{area.label}</span>
                  <span className="text-sm font-bold tabular-nums text-white">{fmtScore(area.score)}</span>
                </div>
                <div className="mt-2">
                  <Sparkline values={area.trend} color={theme.ring} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* PROFILO FISIOLOGICO */}
      <section aria-label="Profilo fisiologico">
        <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Profilo fisiologico</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiTile label="Peso" value={fmtKpi(kpis.weightKg, 1)} unit="kg" />
          <KpiTile label="Massa grassa" value={fmtKpi(kpis.bodyFatPct, 1)} unit="%" />
          <KpiTile label="VO₂max" value={fmtKpi(kpis.vo2max, 1)} unit="ml/kg/min" />
          <KpiTile label="FTP" value={fmtKpi(kpis.ftpWatts)} unit="W" />
          <KpiTile label="LT1" value={fmtKpi(kpis.lt1Watts)} unit="W" />
          <KpiTile label="LT2" value={fmtKpi(kpis.lt2Watts)} unit="W" />
          <KpiTile label="VLamax" value={fmtKpi(kpis.vLamax, 2)} />
          <KpiTile label="Età biologica" value={fmtKpi(kpis.biologicalAge, 1)} unit="anni" />
          <KpiTile label="Target" value={fmtKpi(kpis.targetAge, 1)} unit="anni" />
        </div>
      </section>
    </div>
  );
}
