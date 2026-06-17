"use client";

/**
 * Dashboard "F0" — Human Performance Operating System.
 *
 * Vista atleta unica: readiness ring, umanoide centrale con 9 aree, trend 7g,
 * profilo fisiologico (KPI) e human system status. Cablata su
 * `GET /api/dashboard/scores` (contratto in `@/lib/dashboard/dashboard-scores`).
 *
 * Stale-while-revalidate cross-mount (`@/lib/client-swr-cache`): se c'è cache la
 * dipinge subito e rivalida in background — niente spinner ad ogni atterraggio.
 * Dati assenti => stato "in attesa" muto, mai numeri finti.
 */

import { useEffect, useMemo, useState } from "react";
import { AthleteCanvas } from "@/components/marketing/hero/AthleteCanvas";
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

type AreaTheme = { ring: string; text: string; border: string; dot: string };

const AREA_THEME: Record<DashboardAreaKey, AreaTheme> = {
  performance: { ring: "#fb7185", text: "text-rose-300", border: "border-rose-500/30", dot: "bg-rose-400" },
  recovery: { ring: "#a78bfa", text: "text-violet-300", border: "border-violet-500/30", dot: "bg-violet-400" },
  sleep: { ring: "#60a5fa", text: "text-sky-300", border: "border-sky-500/30", dot: "bg-sky-400" },
  stress: { ring: "#c084fc", text: "text-purple-300", border: "border-purple-500/30", dot: "bg-purple-400" },
  biomarkers: { ring: "#fb923c", text: "text-orange-300", border: "border-orange-500/30", dot: "bg-orange-400" },
  hormones: { ring: "#2dd4bf", text: "text-teal-300", border: "border-teal-500/30", dot: "bg-teal-400" },
  microbiome: { ring: "#f472b6", text: "text-pink-300", border: "border-pink-500/30", dot: "bg-pink-400" },
  nutrition: { ring: "#34d399", text: "text-emerald-300", border: "border-emerald-500/30", dot: "bg-emerald-400" },
  longevity: { ring: "#fbbf24", text: "text-amber-300", border: "border-amber-500/30", dot: "bg-amber-400" },
};

/** Hint utile quando l'area non ha ancora dati reali (mai numero finto). */
const AREA_WAITING_HINT: Record<DashboardAreaKey, string> = {
  performance: "Sincronizza training per la performance",
  recovery: "Collega un device per il recupero",
  sleep: "Collega un device per il sonno",
  stress: "Collega un device per lo stress",
  biomarkers: "Carica un esame in Health",
  hormones: "Carica un pannello ormonale in Health",
  microbiome: "Carica un test microbiota in Health",
  nutrition: "Compila il diario alimentare",
  longevity: "Servono più dati per l'indice longevità",
};

const STATUS_LABEL: Record<NonNullable<DashboardArea["status"]>, string> = {
  ottimale: "Ottimale",
  buona: "Buona",
  attenzione: "Attenzione",
  bassa: "Bassa",
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
/*  ReadinessRing                                                     */
/* ------------------------------------------------------------------ */

function ReadinessRing({ score, label }: { score: number | null; label: string | null }) {
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
  const deg = (pct / 100) * 360;
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative grid h-32 w-32 place-items-center rounded-full sm:h-36 sm:w-36"
        style={{
          background: `conic-gradient(from -90deg, #a855f7 0deg, #ec4899 ${deg * 0.55}deg, #fb923c ${deg}deg, rgba(255,255,255,0.06) ${deg}deg 360deg)`,
        }}
        role="img"
        aria-label={`Readiness ${fmtScore(score)}${label ? `, ${label}` : ""}`}
      >
        <div className="grid h-[6.25rem] w-[6.25rem] place-items-center rounded-full bg-black/80 sm:h-28 sm:w-28">
          <span className="text-3xl font-bold tabular-nums text-white sm:text-4xl">{fmtScore(score)}</span>
        </div>
      </div>
      <div className="text-center">
        <div className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">Readiness</div>
        <div className="text-sm font-semibold capitalize text-gray-200">{label ?? "In attesa"}</div>
      </div>
    </div>
  );
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
/*  AreaBox                                                           */
/* ------------------------------------------------------------------ */

function AreaBox({ area }: { area: DashboardArea }) {
  const theme = AREA_THEME[area.key];
  if (!area.hasData || area.score == null) {
    return (
      <div className={`rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-center ${theme.border}`}>
        <div className={`font-mono text-[0.6rem] uppercase tracking-wider ${theme.text} opacity-80`}>{area.label}</div>
        <div className="mt-1 text-2xl font-bold text-gray-600">—</div>
        <div className="mt-1 text-[0.62rem] leading-snug text-gray-500">{AREA_WAITING_HINT[area.key]}</div>
      </div>
    );
  }
  return (
    <div className={`rounded-2xl border bg-black/30 px-3 py-3 text-center ${theme.border}`}>
      <div className={`flex items-center justify-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-wider ${theme.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} aria-hidden />
        {area.label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-white sm:text-3xl">{fmtScore(area.score)}</div>
      <div className="mt-0.5 text-[0.62rem] text-gray-400">{area.status ? STATUS_LABEL[area.status] : "—"}</div>
    </div>
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

  const readiness = data?.readiness ?? { score: null, label: null, trend7d: [] };
  const systemStatus = data?.systemStatus ?? { pct: null, label: null, trend: [] };
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

  // Aree per il layout desktop a 3 colonne: 4 a sinistra, 4 a destra, Performance al centro.
  const performanceArea = areasByKey.get("performance") ?? null;
  const leftKeys: DashboardAreaKey[] = ["recovery", "sleep", "stress", "biomarkers"];
  const rightKeys: DashboardAreaKey[] = ["hormones", "microbiome", "nutrition", "longevity"];
  const leftAreas = leftKeys.map((k) => areasByKey.get(k)).filter((a): a is DashboardArea => Boolean(a));
  const rightAreas = rightKeys.map((k) => areasByKey.get(k)).filter((a): a is DashboardArea => Boolean(a));

  const systemPct = systemStatus.pct == null ? 0 : Math.max(0, Math.min(100, systemStatus.pct));

  return (
    <div className="space-y-10">
      {/* 1) HERO */}
      <section className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-black/30 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-gray-500">
            Human Performance Operating System
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
            Understand Today.
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
              Predict Tomorrow.
            </span>
          </h2>
        </div>
        <div className="shrink-0">
          <ReadinessRing score={readiness.score} label={readiness.label} />
        </div>
      </section>

      {/* 2) CORPO + AREE */}
      <section aria-label="Aree fisiologiche">
        {/* Mobile: umanoide in alto, poi 9 aree in grid 2 col */}
        <div className="lg:hidden">
          <div className="mx-auto max-w-sm">
            <AthleteCanvas />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {orderedAreas.map((area) => (
              <AreaBox key={area.key} area={area} />
            ))}
          </div>
        </div>

        {/* Desktop: 4 box | umanoide | 4 box, Performance sopra il centro */}
        <div className="hidden gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <div className="flex flex-col justify-center gap-3">
            {leftAreas.map((area) => (
              <AreaBox key={area.key} area={area} />
            ))}
          </div>
          <div className="flex w-[22rem] flex-col items-center">
            {performanceArea ? (
              <div className="mb-4 w-56">
                <AreaBox area={performanceArea} />
              </div>
            ) : null}
            <AthleteCanvas />
          </div>
          <div className="flex flex-col justify-center gap-3">
            {rightAreas.map((area) => (
              <AreaBox key={area.key} area={area} />
            ))}
          </div>
        </div>
      </section>

      {/* 3) TREND 7 GIORNI */}
      <section aria-label="Trend 7 giorni">
        <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Trend · 7 giorni</p>
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
                  <Sparkline values={area.trend7d} color={theme.ring} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4) PROFILO FISIOLOGICO */}
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

      {/* 5) HUMAN SYSTEM STATUS */}
      <section aria-label="Human system status" className="rounded-3xl border border-white/10 bg-black/30 p-6">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Human System Status</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-4xl font-bold tabular-nums text-white sm:text-5xl">
              {systemStatus.pct == null ? "—" : `${Math.round(systemStatus.pct)}%`}
            </div>
            <div className="mt-1 text-sm font-semibold capitalize text-gray-300">{systemStatus.label ?? "In attesa"}</div>
          </div>
          <div className="w-full sm:w-64">
            {systemStatus.trend.length ? (
              <Sparkline values={systemStatus.trend} color="#a78bfa" width={256} height={40} />
            ) : (
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500"
                  style={{ width: `${systemPct}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
