"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type {
  TrainingAdaptationLoopViewModel,
  TrainingBioenergeticModulationViewModel,
} from "@/api/training/contracts";
import { BarChart3, Hexagon, LineChart } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TrainingSubnav } from "@/components/training/TrainingSubnav";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import type { ReadSpineCoverageSummary } from "@/lib/platform/read-spine-coverage";
import type { RecoverySummary } from "@/lib/reality/recovery-summary";
import type { TrainingDayOperationalContext } from "@/lib/training/day-operational-context";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { fetchTrainingAnalyticsRows } from "@/modules/training/services/training-analytics-api";
import {
  OVERLAY_METRIC_DEFS,
  type CompareDayRow,
  type ExecutedAnalyticsRow,
  type MetricSeriesKey,
  dailyMetricMap,
  hexWeekCompareFromTimeline,
  normalize01Series,
  refKpisLastNDays,
  valueForMetric,
} from "@/lib/training/analytics/executed-metric-aggregates";
import type { CrossChannelSessionVm } from "@/lib/training/analytics/cross-channel-session";
// Sezione cross-channel (recharts) renderizzata in fondo alla pagina analytics:
// chunk separato, no SSR, fuori dal bundle iniziale del modulo Training.
const TrainingAnalyzerCrossChannelSection = dynamic(
  () =>
    import("@/components/training/TrainingAnalyzerCrossChannelSection").then(
      (m) => m.TrainingAnalyzerCrossChannelSection,
    ),
  {
    ssr: false,
    loading: () => <div className="h-64 rounded-2xl border border-white/10 bg-black/20" aria-hidden />,
  },
);
import { CalendarDaySessionDetail } from "@/components/training/CalendarDaySessionDetail";
import { TrainingCalendarAnalyzer } from "@/components/training/TrainingCalendarAnalyzer";
import { workoutDayKey } from "@/lib/training/calendar-analyzer-helpers";
import { trainingRealityDiagnosticsBannerIt } from "@/lib/training/training-reality-diagnostics";
import type { ExecutedWorkout } from "@empathy/domain-training";
import type { TrainingRealityDiagnosticsViewModel } from "@/api/training/contracts";
import { EMPATHY_LOAD_LABELS_IT } from "@empathy/contracts";
import {
  executedWorkoutsFromAnalyticsRows,
  filterPlannedByDate,
  filterWorkoutsByDate,
  monthWorkoutsForDate,
  plannedWorkoutsFromAnalyticsRows,
} from "@/lib/training/analytics/analytics-row-mappers";
import { CHART_AXIS, CHART_GRID, CHART_SIGNAL, chartHexToRgba, chartSeriesForModule } from "@/lib/ui/chart-theme";

/** Palette serie del modulo training: prima traccia = accento orange (chart-theme). */
const TRAINING_SERIES = chartSeriesForModule("training");

/** Data locale YYYY-MM-DD (evita shift UTC su `toISOString`). */
function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Finestra inclusiva che termina il giorno `anchorYmd` (locale). */
function rangeEndingOnAnchor(anchorYmd: string, daysInclusive: number): { from: string; to: string } {
  const parts = anchorYmd.split("-").map((x) => Number(x));
  const y = parts[0];
  const m = parts[1];
  const day = parts[2];
  if (!y || !m || !day || daysInclusive < 1) {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return rangeEndingOnAnchor(toLocalDateKey(today), Math.max(1, daysInclusive));
  }
  const anchor = new Date(y, m - 1, day, 12, 0, 0, 0);
  const from = new Date(anchor);
  from.setDate(anchor.getDate() - (daysInclusive - 1));
  return { from: toLocalDateKey(from), to: toLocalDateKey(anchor) };
}

const WINDOW_PRESETS: Array<{ id: number; label: string }> = [
  { id: 1, label: "1d" },
  { id: 7, label: "7d" },
  { id: 28, label: "28d" },
  { id: 90, label: "90d" },
  { id: 120, label: "120d" },
  { id: 365, label: "365d" },
];

function polyline(values: number[], width: number, height: number) {
  if (!values.length) return "";
  const max = Math.max(1, ...values);
  return values
    .map((v, i) => {
      const x = 20 + (i / Math.max(1, values.length - 1)) * (width - 40);
      const y = height - 20 - (v / max) * (height - 40);
      return `${x},${y}`;
    })
    .join(" ");
}

function couplingColor(coupling: number): string {
  if (coupling > 1.15) return "#fb7185";
  if (coupling < 0.85) return "#fbbf24";
  return "#34d399";
}

function polylineNormalized(values: number[], width: number, height: number) {
  if (!values.length) return "";
  return values
    .map((v, i) => {
      const x = 20 + (i / Math.max(1, values.length - 1)) * (width - 40);
      const clamped = Math.max(0, Math.min(100, v));
      const y = height - 20 - (clamped / 100) * (height - 40);
      return `${x},${y}`;
    })
    .join(" ");
}

function formatDurationTotal(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function radarRingPoints(values: number[], cx: number, cy: number, maxR: number): string {
  return values
    .map((v, i) => {
      const t = ((-90 + i * 60) * Math.PI) / 180;
      const r = (Math.max(0, Math.min(100, v)) / 100) * maxR;
      return `${cx + r * Math.cos(t)},${cy + r * Math.sin(t)}`;
    })
    .join(" ");
}

// Cache cross-mount delle righe analytics: ri-atterrando sulla pagina (stesso
// atleta + stessa finestra) i dati compaiono subito (niente spinner/"refresh");
// il refetch parte comunque in background, così le mutazioni restano riflesse.
// La chiave è composta (athleteId|from|to): la finestra temporale cambia il
// dataset, quindi non bisogna mai mostrare i dati di un'altra finestra/atleta.
let trainingAnalyticsCacheKey: string | null = null;
let trainingAnalyticsCache: Awaited<ReturnType<typeof fetchTrainingAnalyticsRows>> | null = null;

/**
 * Analyzer — logica V1 (carico esterno/interno, planned vs real) con shell Pro 2 / Tailwind.
 */
export default function TrainingAnalyticsPageView() {
  const t = useTranslations("TrainingAnalyticsPageView");
  const { athleteId, role, adminScoped, loading: athleteLoading } = useActiveAthlete();
  /** Contenuti tecnici (coperture, diagnostica) visibili solo a coach/admin. */
  const showTech = role === "coach" || adminScoped;
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [plannedRows, setPlannedRows] = useState<Array<Record<string, unknown>>>([]);
  const [series, setSeries] = useState<
    Array<{
      date: string;
      external: number;
      internal: number;
      ctl: number;
      atl: number;
      tsb: number;
      iCtl: number;
      iAtl: number;
      iTsb: number;
    }>
  >([]);
  const [compareSeries, setCompareSeries] = useState<
    Array<{
      date: string;
      planned: number;
      executed: number;
      internal: number;
      ctl: number;
      atl: number;
      tsb: number;
      iCtl: number;
      iAtl: number;
      iTsb: number;
      executionVsPlanPct: number;
    }>
  >([]);
  const [latest, setLatest] = useState<{
    date: string;
    external: number;
    internal: number;
    ctl: number;
    atl: number;
    tsb: number;
    iCtl: number;
    iAtl: number;
    iTsb: number;
  } | null>(null);
  const [windows, setWindows] = useState<{
    last7: { external: number; internal: number; coupling: number };
    last28: { external: number; internal: number; coupling: number };
    couplingDelta: number;
  } | null>(null);
  const [planWindows, setPlanWindows] = useState<{
    last7: {
      planned: number;
      executed: number;
      internal: number;
      delta: number;
      compliancePct: number;
      internalVsExecuted: number;
    };
    last28: {
      planned: number;
      executed: number;
      internal: number;
      delta: number;
      compliancePct: number;
      internalVsExecuted: number;
    };
  } | null>(null);
  const [adaptationLoop, setAdaptationLoop] = useState<TrainingAdaptationLoopViewModel | null>(null);
  const [twinState, setTwinState] = useState<{
    readiness?: number;
    fatigueAcute?: number;
    glycogenStatus?: number;
    adaptationScore?: number;
    redoxStressIndex?: number;
    divergenceScore?: number;
    interventionScore?: number;
    loadSnapshot?: { plannedTssNext7d?: number; plannedSessionsNext7d?: number };
  } | null>(null);
  const [recoverySummary, setRecoverySummary] = useState<RecoverySummary | null>(null);
  const [operationalContext, setOperationalContext] = useState<TrainingDayOperationalContext | null>(null);
  const [bioenergeticModulation, setBioenergeticModulation] = useState<TrainingBioenergeticModulationViewModel | null>(null);
  const [readSpineCoverage, setReadSpineCoverage] = useState<ReadSpineCoverageSummary | null>(null);
  const [crossModuleDynamicsLines, setCrossModuleDynamicsLines] = useState<string[]>([]);
  const [crossChannelSessions, setCrossChannelSessions] = useState<CrossChannelSessionVm[]>([]);
  const [executedSessions, setExecutedSessions] = useState<ExecutedWorkout[]>([]);
  const [trainingRealityDiagnostics, setTrainingRealityDiagnostics] =
    useState<TrainingRealityDiagnosticsViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Ultimo giorno della finestra analizzata (incluso). */
  const [anchorDate, setAnchorDate] = useState<string>(() => toLocalDateKey(new Date()));
  const [windowDays, setWindowDays] = useState<number>(120);
  const bounds = useMemo(() => rangeEndingOnAnchor(anchorDate, windowDays), [anchorDate, windowDays]);
  const [overlayOn, setOverlayOn] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const d of OVERLAY_METRIC_DEFS) {
      init[d.key] = ["planned", "executed", "internal", "ctl", "iCtl"].includes(d.key);
    }
    return init;
  });
  const [hexMetric, setHexMetric] = useState<MetricSeriesKey>("executed");
  /** Giorno per drill-down grafico (MMP, GPS, telemetria). */
  const [focusDay, setFocusDay] = useState<string>(() => toLocalDateKey(new Date()));

  useEffect(() => {
    setFocusDay(anchorDate);
  }, [anchorDate]);

  useEffect(() => {
    async function loadExecuted() {
      if (!athleteId) {
        setRows([]);
        setPlannedRows([]);
        setSeries([]);
        setCompareSeries([]);
        setLatest(null);
        setWindows(null);
        setPlanWindows(null);
        setAdaptationLoop(null);
        setTwinState(null);
        setRecoverySummary(null);
        setOperationalContext(null);
        setBioenergeticModulation(null);
        setReadSpineCoverage(null);
        setCrossModuleDynamicsLines([]);
        setCrossChannelSessions([]);
        setExecutedSessions([]);
        setTrainingRealityDiagnostics(null);
        setLoading(false);
        return;
      }
      // Applica il payload di successo a stato + cache (riuso per cache-hit e refetch).
      const applyPayload = (payload: Awaited<ReturnType<typeof fetchTrainingAnalyticsRows>>) => {
        setError(null);
        setRows(payload.rows ?? []);
        setExecutedSessions(payload.executedSessions ?? []);
        setTrainingRealityDiagnostics(payload.trainingRealityDiagnostics ?? null);
        setPlannedRows(payload.plannedRows ?? []);
        setSeries(payload.series ?? []);
        setCompareSeries(payload.compareSeries ?? []);
        setLatest(payload.latest ?? null);
        setWindows(payload.windows ?? null);
        setPlanWindows(payload.planWindows ?? null);
        setAdaptationLoop(payload.adaptationLoop ?? null);
        setTwinState(payload.athleteMemory?.twin ?? payload.twinState ?? null);
        setRecoverySummary(payload.recoverySummary ?? null);
        setOperationalContext(payload.operationalContext ?? null);
        setBioenergeticModulation(payload.bioenergeticModulation ?? null);
        setReadSpineCoverage(payload.readSpineCoverage ?? null);
        setCrossModuleDynamicsLines(payload.crossModuleDynamicsLines ?? []);
        setCrossChannelSessions(payload.crossChannelSessions ?? []);
      };

      // Cache-hit per stessa chiave (atleta + finestra): mostra subito i dati senza
      // spinner; sotto si procede comunque al refetch in background (silenzioso).
      const cacheKey = `${athleteId}|${bounds.from}|${bounds.to}`;
      const cached =
        trainingAnalyticsCacheKey === cacheKey && trainingAnalyticsCache && !trainingAnalyticsCache.error
          ? trainingAnalyticsCache
          : null;
      if (cached) {
        applyPayload(cached);
        setLoading(false);
      } else {
        setLoading(true);
        setError(null);
      }

      const payload = await fetchTrainingAnalyticsRows({
        athleteId,
        from: bounds.from,
        to: bounds.to,
      });

      if (payload.error) {
        // Su cache-hit teniamo i dati già mostrati: l'errore di refresh è silenzioso.
        if (!cached) {
          setError(payload.error);
          setRows([]);
          setPlannedRows([]);
          setSeries([]);
          setCompareSeries([]);
          setLatest(null);
          setWindows(null);
          setPlanWindows(null);
          setAdaptationLoop(null);
          setTwinState(null);
          setRecoverySummary(null);
          setOperationalContext(null);
          setBioenergeticModulation(null);
          setReadSpineCoverage(null);
          setCrossModuleDynamicsLines([]);
          setCrossChannelSessions([]);
          setExecutedSessions([]);
          setTrainingRealityDiagnostics(null);
        }
      } else {
        applyPayload(payload);
        trainingAnalyticsCache = payload;
        trainingAnalyticsCacheKey = cacheKey;
      }
      setLoading(false);
    }
    void loadExecuted();
  }, [athleteId, bounds.from, bounds.to]);

  const last42 = series.slice(-42);
  const last42Compare = compareSeries.slice(-42);
  const external7 = windows?.last7.external ?? 0;
  const internal7 = windows?.last7.internal ?? 0;
  const external28 = windows?.last28.external ?? 0;
  const internal28 = windows?.last28.internal ?? 0;
  const coupling7 = windows?.last7.coupling ?? 0;
  const coupling28 = windows?.last28.coupling ?? 0;
  const couplingDelta = windows?.couplingDelta ?? 0;
  const couplingToneClass = coupling7 > 1.15 ? "text-rose-300" : coupling7 < 0.85 ? "text-amber-300" : "text-emerald-300";
  const plan7 = planWindows?.last7;
  const plan28 = planWindows?.last28;
  const compliance7 = plan7?.compliancePct ?? 0;
  const divergenceScore = adaptationLoop?.divergenceScore ?? twinState?.divergenceScore ?? 0;
  const interventionScore = adaptationLoop?.interventionScore ?? twinState?.interventionScore ?? 0;
  const adaptationToneClass =
    divergenceScore > 45 ? "text-rose-300" : divergenceScore > 20 ? "text-amber-300" : "text-emerald-300";

  const adaptationStatus =
    divergenceScore > 45
      ? t("adaptationStatusHighDivergence")
      : coupling7 > 1.15
        ? t("adaptationStatusWarning")
        : coupling7 < 0.85
          ? t("adaptationStatusLowCoupling")
          : t("adaptationStatusBalanced");
  const adaptabilityScore = Math.max(0, Math.min(100, Math.round(100 - divergenceScore * 1.7)));
  const operationalSuggestedLoad7d = useMemo(() => {
    if (!operationalContext) return null;
    return Math.max(0, Math.round((adaptationLoop?.expectedLoad7d ?? 0) * operationalContext.loadScale));
  }, [operationalContext, adaptationLoop?.expectedLoad7d]);

  const dmMap = useMemo(() => dailyMetricMap(rows as ExecutedAnalyticsRow[]), [rows]);
  const executedWorkouts = useMemo(() => {
    if (executedSessions.length > 0) return executedSessions;
    return athleteId ? executedWorkoutsFromAnalyticsRows(rows, athleteId) : [];
  }, [executedSessions, rows, athleteId]);
  const plannedWorkouts = useMemo(
    () => (athleteId ? plannedWorkoutsFromAnalyticsRows(plannedRows, athleteId) : []),
    [plannedRows, athleteId],
  );
  const focusDayExecuted = useMemo(
    () => filterWorkoutsByDate(executedWorkouts, focusDay),
    [executedWorkouts, focusDay],
  );
  const focusDayPlanned = useMemo(
    () => filterPlannedByDate(plannedWorkouts, focusDay),
    [plannedWorkouts, focusDay],
  );
  const focusMonthExecuted = useMemo(
    () => monthWorkoutsForDate(executedWorkouts, focusDay),
    [executedWorkouts, focusDay],
  );
  const activeDays = useMemo(() => {
    const days = new Set<string>();
    for (const w of executedWorkouts) {
      const key = workoutDayKey(w);
      if (key && Number(w.durationMinutes) > 0) days.add(key);
    }
    for (const c of compareSeries) {
      if (c.executed > 0 || c.planned > 0) days.add(c.date);
    }
    return Array.from(days).sort().slice(-14);
  }, [executedWorkouts, compareSeries]);
  const realityDiagBanner = trainingRealityDiagnostics
    ? trainingRealityDiagnosticsBannerIt(trainingRealityDiagnostics)
    : null;
  const weeklyExternalLoad = useMemo(() => {
    const last42 = compareSeries.slice(-42);
    const weeks: number[] = [];
    for (let w = 0; w < 6; w += 1) {
      const slice = last42.slice(w * 7, (w + 1) * 7);
      weeks.push(slice.reduce((s, d) => s + d.executed, 0));
    }
    return weeks;
  }, [compareSeries]);
  const analyticsEndDate = compareSeries.at(-1)?.date ?? bounds.to;
  const refKpis7d = useMemo(
    () => refKpisLastNDays(rows as ExecutedAnalyticsRow[], 7, analyticsEndDate),
    [rows, analyticsEndDate],
  );

  const toCompareRow = (c: (typeof compareSeries)[number]): CompareDayRow => ({
    date: c.date,
    planned: c.planned,
    executed: c.executed,
    internal: c.internal,
    ctl: c.ctl,
    iCtl: c.iCtl,
  });

  const seriesForMetric = (key: MetricSeriesKey): number[] =>
    last42Compare.map((c) => valueForMetric(key, toCompareRow(c), dmMap, c.date));

  const hexData = useMemo(() => {
    const dates = compareSeries.map((c) => c.date);
    const daily = new Map<string, number>();
    for (const c of compareSeries) {
      daily.set(c.date, valueForMetric(hexMetric, toCompareRow(c), dmMap, c.date));
    }
    return hexWeekCompareFromTimeline(daily, dates);
  }, [compareSeries, dmMap, hexMetric]);

  const hexNorm = useMemo(() => {
    const seq = [...hexData.recent, ...hexData.baseline];
    const n = normalize01Series(seq);
    return { recent: n.slice(0, 6), baseline: n.slice(6, 12) };
  }, [hexData]);

  const plannedPolyline = polyline(last42Compare.map((p) => p.planned), 1100, 260);
  const extPolyline = polyline(last42Compare.map((p) => p.executed), 1100, 260);
  const intPolyline = polyline(last42Compare.map((p) => p.internal), 1100, 260);
  const ctlPolyline = polyline(last42.map((p) => p.ctl), 1100, 260);
  const iCtlPolyline = polyline(last42.map((p) => p.iCtl), 1100, 260);

  /** Prefisso label settimana (fuori dai callback SVG dove `t` viene shadowato dall'angolo). */
  const weekAbbrev = t("weekAbbrev");

  const kpiCard = (label: string, value: ReactNode, valueClass = "text-white") => (
    <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
      <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{label}</div>
      <div className={`mt-1 font-mono text-lg font-semibold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  );

  return (
    <Pro2ModulePageShell
      eyebrow={t("eyebrow")}
      eyebrowClassName="text-orange-400"
      title={t("title")}
      description={t("description")}
    >
      <div className="scroll-mt-28">
        <TrainingSubnav />
      </div>

      {athleteId ? (
        <section
          className="mb-6 rounded-2xl border border-orange-500/25 bg-black/35 p-4"
          aria-label={t("analysisTimeWindowAria")}
        >
          <p className="mb-3 font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">
            {t("analysisPeriod")}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex min-w-[12rem] flex-col gap-1 text-xs text-gray-400">
              <span className="font-semibold text-gray-300">{t("windowEndDate")}</span>
              <input
                type="date"
                value={anchorDate}
                max={toLocalDateKey(new Date())}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) setAnchorDate(v);
                }}
                className="rounded-xl border border-white/15 bg-black/50 px-3 py-2 font-mono text-sm tabular-nums text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </label>
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-semibold text-gray-300">{t("range")}</span>
              <div className="flex flex-wrap gap-2">
                {WINDOW_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setWindowDays(p.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                      windowDays === p.id
                        ? "border-orange-400/55 bg-orange-500/20 text-orange-100 shadow-[0_0_12px_rgba(251,146,60,0.15)]"
                        : "border-white/15 bg-black/40 text-gray-400 hover:border-white/25 hover:text-gray-200"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-3 font-mono text-[0.7rem] text-gray-500">
            {t("periodLabel")} <span className="text-gray-400">{bounds.from}</span> → <span className="text-gray-400">{bounds.to}</span>
            {windowDays === 1 ? t("periodSingleDaySuffix") : null}
          </p>
          <label className="mt-4 flex min-w-[12rem] flex-col gap-1 text-xs text-gray-400">
            <span className="font-semibold text-gray-300">{t("detailedAnalysisDay")}</span>
            <input
              type="date"
              value={focusDay}
              min={bounds.from}
              max={bounds.to}
              onChange={(e) => {
                const v = e.target.value;
                if (/^\d{4}-\d{2}-\d{2}$/.test(v)) setFocusDay(v);
              }}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm tabular-nums text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
          </label>
          {activeDays.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {activeDays.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setFocusDay(d)}
                  className={`rounded-full border px-2 py-1 font-mono text-[0.65rem] ${
                    focusDay === d
                      ? "border-orange-400/50 bg-orange-500/20 text-orange-100"
                      : "border-white/15 bg-black/40 text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {d.slice(8, 10)}/{d.slice(5, 7)}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {showTech && readSpineCoverage && athleteId && !error ? (
        <details className="mb-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-gray-300">
          <summary className="cursor-pointer font-mono text-[0.65rem] uppercase tracking-[0.2em] text-orange-400">
            {t("readSpineSummary", { score: readSpineCoverage.spineScore })}
          </summary>
          <p className="mt-2 text-xs text-gray-500">
            {t("readSpineDescription")}
          </p>
        </details>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" role="alert">
          {error}
        </p>
      ) : null}

      {!athleteId && !athleteLoading ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-gray-400">
          {role === "coach"
            ? t("noAthleteCoach")
            : t("noAthleteProfile")}
        </div>
      ) : loading ? (
        <p className="text-sm text-gray-500">{t("loading")}</p>
      ) : !series.length && !plannedRows.length ? (
        <p className="text-sm text-gray-500">
          {t("noData", { from: bounds.from, to: bounds.to })}
        </p>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.08] px-4 py-3">
              <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{EMPATHY_LOAD_LABELS_IT.trainingLoad} {t("perWeekSuffix")}</div>
              <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-orange-50">{refKpis7d.tss.toFixed(0)}</div>
            </div>
            <div className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.08] px-4 py-3">
              <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Kcal {t("perWeekSuffix")}</div>
              <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-orange-50">
                {refKpis7d.kcal.toFixed(0)}
                <span className="ml-1 text-xs font-medium text-gray-500">kcal</span>
              </div>
            </div>
            <div className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.08] px-4 py-3">
              <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("avgWatts")}</div>
              <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-orange-50">
                {refKpis7d.wattAvg != null ? refKpis7d.wattAvg.toFixed(0) : "—"}
                {refKpis7d.wattAvg != null ? <span className="ml-1 text-xs font-medium text-gray-500">W</span> : null}
              </div>
            </div>
            <div className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.08] px-4 py-3">
              <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("totalTime")} {t("perWeekSuffix")}</div>
              <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-orange-50">
                {formatDurationTotal(refKpis7d.totalMinutes)}
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-white/10 bg-black/30 p-4">
            <h2 className="mb-3 text-sm font-bold text-white">{t("weeklyProgressionTitle")}</h2>
            <svg viewBox="0 0 400 120" width="100%" height="120" className="max-h-[28vh]">
              <defs>
                <linearGradient id="wkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_SIGNAL.load} />
                  <stop offset="95%" stopColor={chartHexToRgba(CHART_SIGNAL.load, 0.25)} />
                </linearGradient>
              </defs>
              {weeklyExternalLoad.map((v, i) => {
                const max = Math.max(1, ...weeklyExternalLoad);
                const barH = (v / max) * 80;
                const x = 24 + i * 58;
                return (
                  <g key={i}>
                    <rect x={x} y={100 - barH} width={40} height={barH} rx={4} fill="url(#wkGrad)" opacity={0.92} />
                    <text x={x + 20} y={112} textAnchor="middle" fill={CHART_AXIS.tick} fontSize={9}>
                      {weekAbbrev}{i + 1}
                    </text>
                    <text x={x + 20} y={Math.max(12, 94 - barH)} textAnchor="middle" fill="#e5e7eb" fontSize={9}>
                      {Math.round(v)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <section className="mb-8 rounded-2xl border border-orange-500/25 bg-gradient-to-b from-orange-950/20 to-black/40 p-4 shadow-inner shadow-orange-950/20">
            <h2 className="mb-1 text-base font-bold text-white">
              {t("dayAnalysisLabel")}{" "}
              {new Date(`${focusDay}T12:00:00`).toLocaleDateString(t("dateLocale"), {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h2>
            <p className="mb-4 text-xs text-gray-400">
              {t("dayAnalysisDescription")}
            </p>
            {realityDiagBanner ? (
              <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
                {realityDiagBanner}
              </p>
            ) : null}
            {focusDayExecuted.length === 0 && focusDayPlanned.length === 0 ? (
              <p className="text-sm text-gray-500">{t("noSessionOnDay")}</p>
            ) : (
              <div className="space-y-8">
                {focusDayExecuted.length > 0 ? (
                  <CalendarDaySessionDetail
                    selectedDate={focusDay}
                    dayExecuted={focusDayExecuted}
                    athleteId={athleteId}
                  />
                ) : null}
                <TrainingCalendarAnalyzer
                  selectedDate={focusDay}
                  dayPlanned={focusDayPlanned}
                  dayExecuted={focusDayExecuted}
                  monthExecuted={focusMonthExecuted}
                  athleteId={athleteId}
                />
              </div>
            )}
          </section>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {kpiCard(t("kpiExternalLoad7d"), external7.toFixed(0))}
            {kpiCard(t("kpiInternalLoad7d"), internal7.toFixed(0))}
            {kpiCard(t("kpiPlannedActual7d"), plan7 ? `${plan7.planned.toFixed(0)} / ${plan7.executed.toFixed(0)}` : "—")}
            {kpiCard(
              t("kpiExecutionCompliance7d"),
              `${compliance7.toFixed(0)}%`,
              compliance7 < 70 || compliance7 > 130 ? "text-amber-200" : "text-emerald-200",
            )}
            {kpiCard(
              t("kpiCoupling7d"),
              <>
                <span style={{ color: couplingColor(coupling7) }}>{coupling7.toFixed(2)}</span>
                <span className="ml-2 text-xs font-normal text-gray-500">
                  Δ28d {couplingDelta >= 0 ? "+" : ""}
                  {couplingDelta.toFixed(2)}
                </span>
              </>,
              couplingToneClass,
            )}
            {kpiCard(
              `${EMPATHY_LOAD_LABELS_IT.fitness4} · ${EMPATHY_LOAD_LABELS_IT.strain} · ${EMPATHY_LOAD_LABELS_IT.form}`,
              latest ? `${latest.ctl.toFixed(1)} / ${latest.atl.toFixed(1)} / ${latest.tsb.toFixed(1)}` : "—",
            )}
            {kpiCard(
              `${EMPATHY_LOAD_LABELS_IT.conditioningInt4} · ${EMPATHY_LOAD_LABELS_IT.fatigueInt}`,
              latest ? `${latest.iCtl.toFixed(1)} / ${latest.iAtl.toFixed(1)}` : "—",
            )}
            {kpiCard(
              t("kpiReadinessFatigue"),
              twinState
                ? `${(twinState.readiness ?? 0).toFixed(1)} / ${(twinState.fatigueAcute ?? 0).toFixed(1)}`
                : "—",
            )}
            {kpiCard(
              t("kpiGlycogenAdaptation"),
              twinState
                ? `${(twinState.glycogenStatus ?? 0).toFixed(1)} / ${(twinState.adaptationScore ?? 0).toFixed(1)}`
                : "—",
            )}
            {kpiCard(
              t("kpiDivergenceIntervention"),
              `${divergenceScore.toFixed(1)} / ${interventionScore.toFixed(1)}`,
              adaptationToneClass,
            )}
          </div>

          <details
            className="mb-6 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm"
            style={{ borderLeft: `3px solid ${couplingColor(coupling7)}` }}
          >
            <summary className={`cursor-pointer font-semibold ${couplingToneClass}`}>
              {t("adaptabilitySummary", { score: adaptabilityScore, coupling: coupling7.toFixed(2) })}
            </summary>
            <p className={`mt-2 font-semibold ${couplingToneClass}`}>{adaptationStatus}</p>
            <p className="mt-2 text-xs text-gray-500">
              Adaptation loop: planned {Math.round(adaptationLoop?.expectedLoad7d ?? 0)} · real{" "}
              {Math.round(adaptationLoop?.realLoad7d ?? 0)} · internal {Math.round(adaptationLoop?.internalLoad7d ?? 0)}{" "}
              · twin redox {(twinState?.redoxStressIndex ?? 0).toFixed(1)}
            </p>
          </details>

          {operationalContext ? (
            <details
              className={`mb-6 rounded-2xl border p-4 text-sm ${
                operationalContext.loadScalePct < 100
                  ? "border-amber-500/35 bg-amber-500/10 text-amber-50"
                  : "border-emerald-500/35 bg-emerald-500/10 text-emerald-50"
              }`}
            >
              <summary className="cursor-pointer">
                <strong>{operationalContext.headline}</strong> {t("operationalLoadSuffix", { pct: operationalContext.loadScalePct })}
              </summary>
              <p className="mt-2">{operationalContext.guidance}</p>
              {operationalSuggestedLoad7d != null ? (
                <p className="mt-2">
                  {t("operationalWindow7d", { plan: Math.round(adaptationLoop?.expectedLoad7d ?? 0), operational: operationalSuggestedLoad7d })}
                </p>
              ) : null}
              {recoverySummary ? (
                <p className="mt-2">
                  {t("recoveryLabel")} {recoverySummary.status}
                  {recoverySummary.sleepDurationHours != null ? t("recoverySleepSuffix", { hours: recoverySummary.sleepDurationHours }) : ""}
                  {recoverySummary.hrvMs != null ? ` · HRV ${recoverySummary.hrvMs} ms` : ""}
                  {recoverySummary.strainScore != null ? ` · strain ${recoverySummary.strainScore}` : ""}.
                </p>
              ) : null}
            </details>
          ) : null}

          {bioenergeticModulation ? (
            <details
              className={`mb-6 rounded-2xl border p-4 text-sm ${
                bioenergeticModulation.loadScalePct < 100
                  ? "border-amber-500/35 bg-amber-500/10"
                  : "border-emerald-500/35 bg-emerald-500/10"
              }`}
            >
              <summary className="cursor-pointer">
                <strong>{bioenergeticModulation.headline}</strong> · readiness{" "}
                {bioenergeticModulation.mitochondrialReadinessScore.toFixed(0)}/100
              </summary>
              <p className="mt-2">
                {t("bioStateCoverage", { state: bioenergeticModulation.state, coverage: bioenergeticModulation.signalCoveragePct.toFixed(0) })}
              </p>
              <p className="mt-2">{bioenergeticModulation.guidance}</p>
              {!!bioenergeticModulation.missingSignals.length ? (
                <p className="mt-2">Missing: {bioenergeticModulation.missingSignals.join(" · ")}.</p>
              ) : null}
              {!!bioenergeticModulation.recommendedInputs.length ? (
                <p className="mt-2">Suggested inputs: {bioenergeticModulation.recommendedInputs.join(" · ")}.</p>
              ) : null}
            </details>
          ) : null}

          {crossModuleDynamicsLines.length ? (
            <details className="mb-6 rounded-2xl border border-orange-500/25 bg-orange-950/20 p-4 text-sm text-gray-300">
              <summary className="cursor-pointer text-sm font-bold text-orange-100">
                {t("crossModuleDynamicsSummary", { count: crossModuleDynamicsLines.length })}
              </summary>
              <p className="mt-2 text-xs text-gray-500">
                {t("crossModuleDynamicsDescription")}
              </p>
              <ul className="mt-2 list-inside list-disc text-xs leading-relaxed text-gray-400">
                {crossModuleDynamicsLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="mb-6 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                <LineChart className="h-4 w-4 text-orange-400" aria-hidden />
                {t("normalizedComparisonTitle")}
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-xs text-gray-300 hover:bg-white/10"
                  onClick={() => {
                    const o: Record<string, boolean> = {};
                    for (const def of OVERLAY_METRIC_DEFS) o[def.key] = true;
                    setOverlayOn(o);
                  }}
                >
                  {t("enableAll")}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-xs text-gray-300 hover:bg-white/10"
                  onClick={() => {
                    const o: Record<string, boolean> = {};
                    for (const def of OVERLAY_METRIC_DEFS) {
                      o[def.key] = ["planned", "executed", "internal", "ctl", "iCtl"].includes(def.key);
                    }
                    setOverlayOn(o);
                  }}
                >
                  {t("loadOnly")}
                </button>
              </div>
            </div>
            <details className="mb-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-400">
              <summary className="cursor-pointer text-gray-300">
                {t("overlayMetricsNotes", { count: Object.values(overlayOn).filter(Boolean).length })}
              </summary>
              <p className="mt-2">
                {t("overlayMetricsDescription")}
              </p>
            </details>
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2">
              {OVERLAY_METRIC_DEFS.map((d) => (
                <label
                  key={d.key}
                  className="inline-flex cursor-pointer items-center gap-2 text-xs text-gray-400 hover:text-gray-200"
                >
                  <input
                    type="checkbox"
                    className="rounded border-white/20 bg-black/40"
                    checked={overlayOn[d.key] ?? false}
                    onChange={(e) => setOverlayOn((prev) => ({ ...prev, [d.key]: e.target.checked }))}
                  />
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                    {d.label}
                  </span>
                </label>
              ))}
            </div>
            <svg viewBox="0 0 1100 260" width="100%" height="260" className="max-h-[30vh] sm:max-h-[40vh]">
              {OVERLAY_METRIC_DEFS.map((d) => {
                if (!overlayOn[d.key]) return null;
                const raw = seriesForMetric(d.key);
                const norm = normalize01Series(raw);
                return (
                  <polyline
                    key={d.key}
                    fill="none"
                    stroke={d.color}
                    strokeWidth="2"
                    strokeOpacity={0.92}
                    points={polylineNormalized(norm, 1100, 260)}
                  />
                );
              })}
            </svg>
            <div className="mt-2 text-[0.65rem] text-gray-500">
              {t("xAxisNote")}
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-white/10 bg-black/30 p-4">
            <h2 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-bold text-white">
              <Hexagon className="h-4 w-4 text-orange-400" aria-hidden />
              {t("hexagonalComparisonTitle")}
            </h2>
            <details className="mb-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-400">
              <summary className="cursor-pointer text-gray-300">
                {t("hexagonGuideSummary", { metric: hexMetric })}
              </summary>
              <p className="mt-2">
                {t("hexagonGuideDescription")}
              </p>
            </details>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <label className="text-xs text-gray-400">
                {t("metricLabel")}
                <select
                  className="ml-2 rounded-xl border border-white/15 bg-black/40 px-2 py-1 text-sm text-white"
                  value={hexMetric}
                  onChange={(e) => setHexMetric(e.target.value as MetricSeriesKey)}
                >
                  {OVERLAY_METRIC_DEFS.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center">
              <svg viewBox="0 0 420 420" width="320" height="320" className="shrink-0">
                {Array.from({ length: 6 }, (_, i) => {
                  const t = ((-90 + i * 60) * Math.PI) / 180;
                  const cx = 210;
                  const cy = 210;
                  const r = 150;
                  const x2 = cx + r * Math.cos(t);
                  const y2 = cy + r * Math.sin(t);
                  return (
                    <line
                      key={i}
                      x1={cx}
                      y1={cy}
                      x2={x2}
                      y2={y2}
                      stroke={CHART_GRID.stroke}
                      strokeWidth={1}
                    />
                  );
                })}
                <polygon
                  points={radarRingPoints(hexNorm.baseline, 210, 210, 150)}
                  fill={chartHexToRgba(TRAINING_SERIES[2]!, 0.08)}
                  stroke={chartHexToRgba(TRAINING_SERIES[2]!, 0.55)}
                  strokeWidth={2}
                  strokeDasharray="7 5"
                />
                <polygon
                  points={radarRingPoints(hexNorm.recent, 210, 210, 150)}
                  fill={chartHexToRgba(TRAINING_SERIES[0]!, 0.12)}
                  stroke={TRAINING_SERIES[0]}
                  strokeWidth={2.5}
                />
                {Array.from({ length: 6 }, (_, i) => {
                  const t = ((-90 + i * 60) * Math.PI) / 180;
                  const cx = 210;
                  const cy = 210;
                  const lr = 172;
                  const tx = cx + lr * Math.cos(t);
                  const ty = cy + lr * Math.sin(t);
                  const label = `${weekAbbrev}${i + 1}`;
                  return (
                    <text
                      key={i}
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={CHART_AXIS.tickMuted}
                      fontSize={11}
                    >
                      {label}
                    </text>
                  );
                })}
              </svg>
              <div className="max-w-md text-xs text-gray-400">
                <p className="mb-2">
                  <span className="inline-block h-2 w-4 rounded-sm bg-orange-400/90" />{" "}
                  {t.rich("hexLegendRecent", {
                    b: (chunks) => <strong className="text-gray-300">{chunks}</strong>,
                  })}
                </p>
                <p>
                  <span className="inline-block h-0.5 w-4 border-t-2 border-dotted border-violet-400" />{" "}
                  {t.rich("hexLegendPrevious", {
                    b: (chunks) => <strong className="text-gray-300">{chunks}</strong>,
                  })}
                </p>
                {compareSeries.length < 84 ? (
                  <p className="mt-3 text-amber-200/90">{t("hexExtendRange")}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-white/10 bg-black/30 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
              <BarChart3 className="h-4 w-4 text-orange-400" aria-hidden />
              {t("trend42dTitle")}
            </h2>
            <svg viewBox="0 0 1100 260" width="100%" height="260" className="max-h-[30vh] sm:max-h-[40vh]">
              <polyline fill="none" stroke={TRAINING_SERIES[1]} strokeWidth="2" points={plannedPolyline} />
              <polyline fill="none" stroke={TRAINING_SERIES[0]} strokeWidth="2.5" points={extPolyline} />
              <polyline fill="none" stroke={TRAINING_SERIES[2]} strokeWidth="2.5" points={intPolyline} />
              <polyline fill="none" stroke={TRAINING_SERIES[3]} strokeWidth="2" points={ctlPolyline} />
              <polyline fill="none" stroke={TRAINING_SERIES[4]} strokeWidth="2" points={iCtlPolyline} />
            </svg>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: TRAINING_SERIES[1] }} /> {t("legendPlanned")}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: TRAINING_SERIES[0] }} /> {t("legendExternal")}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: TRAINING_SERIES[2] }} /> {t("legendInternal")}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: TRAINING_SERIES[3] }} /> {EMPATHY_LOAD_LABELS_IT.fitness4}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: TRAINING_SERIES[4] }} /> {EMPATHY_LOAD_LABELS_IT.conditioningInt4}
              </span>
            </div>
          </div>

          <TrainingAnalyzerCrossChannelSection sessions={crossChannelSessions} />

          <div className="mb-6 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-4">
            <h2 className="mb-3 text-sm font-bold text-white">{t("plannedVsRealWindowsTitle")}</h2>
            <table className="w-full min-w-[520px] text-sm text-gray-300">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">{t("thWindow")}</th>
                  <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">{t("thPlanned")}</th>
                  <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">{t("thReal")}</th>
                  <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">{t("thInternal")}</th>
                  <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">{t("thCompliance")}</th>
                  <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">{t("thCoupling")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  {
                    label: t("windowLast7d"),
                    planned: plan7?.planned ?? 0,
                    ext: plan7?.executed ?? external7,
                    int: plan7?.internal ?? internal7,
                    compliance: plan7?.compliancePct ?? 0,
                    coupling: coupling7,
                  },
                  {
                    label: t("windowLast28d"),
                    planned: plan28?.planned ?? 0,
                    ext: plan28?.executed ?? external28,
                    int: plan28?.internal ?? internal28,
                    compliance: plan28?.compliancePct ?? 0,
                    coupling: coupling28,
                  },
                ].map((r) => {
                  const color = couplingColor(r.coupling);
                  return (
                    <tr key={r.label} style={{ background: `${color}14` }}>
                      <td className="px-3 py-2 text-gray-300">{r.label}</td>
                      <td className="px-3 py-2 font-mono tabular-nums text-white">{r.planned.toFixed(0)}</td>
                      <td className="px-3 py-2 font-mono tabular-nums text-white">{r.ext.toFixed(0)}</td>
                      <td className="px-3 py-2 font-mono tabular-nums text-white">{r.int.toFixed(0)}</td>
                      <td className="px-3 py-2 font-mono tabular-nums text-white">{r.compliance.toFixed(0)}%</td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold"
                          style={{
                            border: `1px solid ${color}`,
                            color,
                            background: `${color}22`,
                          }}
                        >
                          {r.coupling.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <details className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <summary className="mb-3 flex cursor-pointer items-center gap-2 text-sm font-bold text-white">
              <LineChart className="h-4 w-4 text-orange-400" aria-hidden />
              {t("adaptationLoopSummary", { score: adaptabilityScore })}
            </summary>
            <table className="w-full text-sm text-gray-300">
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="py-2 text-gray-500">Status / next</td>
                  <td className="py-2">{`${adaptationLoop?.status ?? "aligned"} / ${adaptationLoop?.nextAction ?? "keep_course"}`}</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-500">Expected 7d</td>
                  <td className="py-2 font-mono tabular-nums text-white">{Math.round(adaptationLoop?.expectedLoad7d ?? 0)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-500">Real 7d</td>
                  <td className="py-2 font-mono tabular-nums text-white">{Math.round(adaptationLoop?.realLoad7d ?? 0)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-500">Internal 7d</td>
                  <td className="py-2 font-mono tabular-nums text-white">{Math.round(adaptationLoop?.internalLoad7d ?? 0)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-500">Compliance</td>
                  <td className="py-2 font-mono tabular-nums text-white">{(adaptationLoop?.executionCompliancePct ?? 0).toFixed(0)}%</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-500">Readiness / adaptation</td>
                  <td className="py-2 font-mono tabular-nums text-white">{`${(adaptationLoop?.readinessScore ?? 0).toFixed(1)} / ${(adaptationLoop?.adaptationScore ?? 0).toFixed(1)}`}</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-500">Divergence / intervention</td>
                  <td className="py-2 font-mono tabular-nums text-white">{`${(adaptationLoop?.divergenceScore ?? 0).toFixed(1)} / ${(adaptationLoop?.interventionScore ?? 0).toFixed(1)}`}</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-500">Data points</td>
                  <td className="py-2">{`${plannedRows.length} planned · ${rows.length} executed`}</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-500">Triggers</td>
                  <td className="py-2">{adaptationLoop?.triggers?.length ? adaptationLoop.triggers.join(" · ") : "—"}</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-500">Guidance</td>
                  <td className="py-2 text-gray-400">{adaptationLoop?.guidance ?? "—"}</td>
                </tr>
              </tbody>
            </table>
          </details>
        </>
      )}
    </Pro2ModulePageShell>
  );
}
