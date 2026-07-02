"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useDeferredVisible } from "@/lib/ui/use-deferred-visible";
import type {
  TrainingExecutedVolumeRollupViewModel,
  TrainingRecoveryContinuousRollupViewModel,
  TrainingAnalyticsViewModel,
} from "@/api/training/contracts";
import { fetchTrainingAnalyticsRows } from "@/modules/training/services/training-analytics-api";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { LineChart as LineChartIcon } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_AXIS, CHART_FONT, CHART_GRID, CHART_SIGNAL, chartTooltipStyle } from "@/lib/ui/chart-theme";

type PresetId = "7" | "28" | "90" | "365";

type SleepPoint = {
  date: string;
  sleep: number | null;
  deep: number | null;
  rem: number | null;
  light: number | null;
  hr: number | null;
  hrv: number | null;
};

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rangeEndingToday(daysInclusive: number): { from: string; to: string } {
  const to = new Date();
  to.setHours(12, 0, 0, 0);
  const from = new Date(to);
  from.setDate(from.getDate() - (daysInclusive - 1));
  return { from: toDateKey(from), to: toDateKey(to) };
}

const PRESETS: Array<{ id: PresetId; label: string; days: number }> = [
  { id: "7", label: "7d", days: 7 },
  { id: "28", label: "28d", days: 28 },
  { id: "90", label: "90d", days: 90 },
  { id: "365", label: "1y", days: 365 },
];

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pick(trace: Record<string, unknown> | null, keys: string[]): number | null {
  if (!trace) return null;
  for (const key of keys) {
    const value = num(trace[key]);
    if (value != null) return value;
  }
  return null;
}

/** Difesa in profondità: trace legacy possono ancora avere ore sonno fuori scala. */
function pickPlausibleSleepHours(trace: Record<string, unknown> | null, keys: string[]): number | null {
  const v = pick(trace, keys);
  if (v == null || !Number.isFinite(v)) return null;
  if (v <= 0 || v > 20) return null;
  return v;
}

function formatRollup(r: TrainingExecutedVolumeRollupViewModel | null | undefined): {
  sessions: string;
  hours: string;
  tss: string;
  km: string;
  elev: string;
  kcal: string;
} {
  if (!r) return { sessions: "—", hours: "—", tss: "—", km: "—", elev: "—", kcal: "—" };
  const hours = r.durationMinutes / 60;
  return {
    sessions: String(r.sessionCount),
    hours: hours >= 10 ? hours.toFixed(1) : hours.toFixed(2),
    tss: r.tss >= 1 ? Math.round(r.tss).toString() : r.tss.toFixed(1),
    km: r.distanceKm >= 0.05 ? r.distanceKm.toFixed(1) : "0",
    elev: r.elevationGainM >= 1 ? Math.round(r.elevationGainM).toString() : r.elevationGainM.toFixed(0),
    kcal: r.kcal >= 1 ? Math.round(r.kcal).toString() : "—",
  };
}

function avg(values: Array<number | null>, digits = 2): number | null {
  const valid = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!valid.length) return null;
  const m = valid.reduce((s, v) => s + v, 0) / valid.length;
  return Number(m.toFixed(digits));
}

function asTrace(row: Record<string, unknown>): Record<string, unknown> | null {
  const t = row.trace_summary;
  return t && typeof t === "object" ? (t as Record<string, unknown>) : null;
}

// Cache cross-mount degli analytics di volume: ri-atterrando sulla pagina i dati
// compaiono subito (niente spinner/placeholder), poi un refetch in background
// silenzioso aggiorna stato+cache così restano riflessi i nuovi eseguiti.
// La chiave è composta (athleteId + finestra from→to del preset) per non mostrare
// mai i dati di un altro atleta o di un'altra finestra temporale.
const trainingVolumeCache = new Map<string, TrainingAnalyticsViewModel>();

export function TrainingPeriodVolumeSummary({
  athleteId,
  deferUntilVisible = false,
}: {
  athleteId: string | null;
  /** Ritarda il fetch analytics finché la sezione non è vicina al viewport. */
  deferUntilVisible?: boolean;
}) {
  const t = useTranslations("TrainingPeriodVolumeSummary");
  const { ref: visibilityRef, visible: nearViewport } = useDeferredVisible();
  const fetchEnabled = Boolean(athleteId) && (!deferUntilVisible || nearViewport);
  const [preset, setPreset] = useState<PresetId>("28");
  const [loading, setLoading] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [rollup, setRollup] = useState<TrainingExecutedVolumeRollupViewModel | null>(null);
  const [recoveryRollup, setRecoveryRollup] = useState<TrainingRecoveryContinuousRollupViewModel | null>(null);
  const [analyticsVm, setAnalyticsVm] = useState<TrainingAnalyticsViewModel | null>(null);

  const bounds = useMemo(() => {
    const p = PRESETS.find((x) => x.id === preset) ?? PRESETS[1];
    return rangeEndingToday(p.days);
  }, [preset]);

  useEffect(() => {
    if (!fetchEnabled) {
      if (!athleteId) {
        setRollup(null);
        setRecoveryRollup(null);
        setAnalyticsVm(null);
        setFetchErr(null);
        setLoading(false);
      }
      return;
    }
    let cancelled = false;
    const cacheKey = `${athleteId}|${bounds.from}|${bounds.to}`;
    const cached = trainingVolumeCache.get(cacheKey);
    if (cached) {
      // Dati già visti per questo atleta+finestra: mostrali subito (niente spinner),
      // poi prosegui col refetch in background per riflettere eventuali nuovi eseguiti.
      setRollup(cached.executedVolumeRollup ?? null);
      setRecoveryRollup(cached.recoveryContinuousRollup ?? null);
      setAnalyticsVm(cached);
      setFetchErr(cached.error ?? null);
      setLoading(false);
    } else {
      setLoading(true);
      setFetchErr(null);
    }
    void fetchTrainingAnalyticsRows({ athleteId: athleteId!, from: bounds.from, to: bounds.to }).then((vm) => {
      if (cancelled) return;
      setRollup(vm.executedVolumeRollup ?? null);
      setRecoveryRollup(vm.recoveryContinuousRollup ?? null);
      setAnalyticsVm(vm);
      setFetchErr(vm.error ?? null);
      trainingVolumeCache.set(cacheKey, vm);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [athleteId, bounds.from, bounds.to, fetchEnabled]);

  const f = formatRollup(rollup);

  const sleepSeries = useMemo<SleepPoint[]>(() => {
    const rows = analyticsVm?.rows ?? [];
    return rows
      .map((row) => {
        const trace = asTrace(row);
        const sleep = pickPlausibleSleepHours(trace, [
          "sleep_hours",
          "total_sleep_hours",
          "sleep_duration_hours",
          "sleep_h",
        ]);
        const deep = pick(trace, ["sleep_deep_hours", "deep_sleep_hours", "sleep_deep_h"]);
        const rem = pick(trace, ["sleep_rem_hours", "rem_sleep_hours", "sleep_rem_h"]);
        const light = pick(trace, ["sleep_light_hours", "light_sleep_hours", "sleep_light_h"]);
        const hr = pick(trace, ["resting_hr_bpm", "resting_heart_rate", "night_hr_bpm", "sleep_hr_bpm"]);
        const hrv = pick(trace, ["hrv_rmssd_ms", "hrv_rmssd_milli", "night_hrv_rmssd_ms", "rmssd"]);
        return {
          date: typeof row.date === "string" ? row.date : "",
          sleep,
          deep,
          rem,
          light,
          hr,
          hrv,
        };
      })
      .filter((r) => r.date)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [analyticsVm?.rows]);

  const biomarkerCells = useMemo(() => {
    const rows = analyticsVm?.rows ?? [];
    const traces = rows.map((r) => asTrace(r as Record<string, unknown>));
    const scan = (keys: string[]): number | null => {
      for (let i = traces.length - 1; i >= 0; i -= 1) {
        const value = pick(traces[i], keys);
        if (value != null) return value;
      }
      return null;
    };
    const latestLactate = (() => {
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        const row = rows[i] as Record<string, unknown>;
        const v = num(row.lactate_mmoll);
        if (v != null) return v;
        const t = asTrace(row);
        const tr = pick(t, ["lactate_mmol_l", "lactate_mmoll"]);
        if (tr != null) return tr;
      }
      return null;
    })();
    const latestGlucose = (() => {
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        const row = rows[i] as Record<string, unknown>;
        const v = num(row.glucose_mmol);
        if (v != null) return v;
        const t = asTrace(row);
        const tr = pick(t, ["glucose_mmol_l", "glucose_mmol"]);
        if (tr != null) return tr;
      }
      return null;
    })();
    return [
      { k: "VO₂", v: scan(["vo2_l_min", "vo2_lpm"]) != null ? `${scan(["vo2_l_min", "vo2_lpm"])?.toFixed(2)} L/min` : "—" },
      { k: "VCO₂", v: scan(["vco2_l_min", "vco2_lpm"]) != null ? `${scan(["vco2_l_min", "vco2_lpm"])?.toFixed(2)} L/min` : "—" },
      { k: t("bioGlucose"), v: latestGlucose != null ? `${latestGlucose.toFixed(2)} mmol/L` : "—" },
      { k: t("bioGlycemicTir"), v: scan(["time_in_range_pct", "glucose_tir_pct"]) != null ? `${(scan(["time_in_range_pct", "glucose_tir_pct"]) ?? 0).toFixed(0)}%` : "—" },
      { k: t("bioGlycemicCv"), v: scan(["glucose_variability_cv", "glucose_cv_pct"]) != null ? `${(scan(["glucose_variability_cv", "glucose_cv_pct"]) ?? 0).toFixed(1)}%` : "—" },
      { k: "Testosterone", v: scan(["testosterone", "testosterone_ng_dl"]) != null ? `${Math.round(scan(["testosterone", "testosterone_ng_dl"]) ?? 0)} ng/dL` : "—" },
      { k: t("bioCortisol"), v: scan(["cortisol_ug_dl", "cortisol"]) != null ? `${(scan(["cortisol_ug_dl", "cortisol"]) ?? 0).toFixed(1)} ug/dL` : "—" },
      { k: "DHEA-S", v: scan(["dhea_s_ug_dl", "dhea_s", "dhea"]) != null ? `${Math.round(scan(["dhea_s_ug_dl", "dhea_s", "dhea"]) ?? 0)} ug/dL` : "—" },
      { k: t("bioNitricOxide"), v: scan(["nitric_oxide", "nitric_oxide_index", "no_index"]) != null ? `${(scan(["nitric_oxide", "nitric_oxide_index", "no_index"]) ?? 0).toFixed(1)}` : "—" },
      { k: t("bioLactate"), v: latestLactate != null ? `${latestLactate.toFixed(2)} mmol/L` : "—" },
      { k: "NAD", v: scan(["nad", "nad_plus", "nad_index"]) != null ? `${(scan(["nad", "nad_plus", "nad_index"]) ?? 0).toFixed(1)}` : "—" },
    ];
  }, [analyticsVm?.rows, t]);

  const avgCells = useMemo(() => {
    const sleepAvg = avg(sleepSeries.map((p) => p.sleep), 2);
    const deepAvg = avg(sleepSeries.map((p) => p.deep), 2);
    const remAvg = avg(sleepSeries.map((p) => p.rem), 2);
    const lightAvg = avg(sleepSeries.map((p) => p.light), 2);
    const hrAvg = avg(sleepSeries.map((p) => p.hr), 1);
    const hrvAvg = avg(sleepSeries.map((p) => p.hrv), 1);
    return [
      { k: t("avgTotalSleep"), v: sleepAvg != null ? `${sleepAvg.toFixed(2)} h` : "—" },
      { k: t("avgDeep"), v: deepAvg != null ? `${deepAvg.toFixed(2)} h` : "—" },
      { k: t("avgRem"), v: remAvg != null ? `${remAvg.toFixed(2)} h` : "—" },
      { k: t("avgLight"), v: lightAvg != null ? `${lightAvg.toFixed(2)} h` : "—" },
      { k: t("avgNightHr"), v: hrAvg != null ? `${hrAvg.toFixed(1)} bpm` : "—" },
      { k: t("avgNightHrv"), v: hrvAvg != null ? `${hrvAvg.toFixed(1)} ms` : "—" },
    ];
  }, [sleepSeries, t]);

  return (
    <div ref={deferUntilVisible ? visibilityRef : undefined} className="w-full min-w-0">
    <Pro2SectionCard
      accent="orange"
      title={t("cardTitle")}
      subtitle={t("cardSubtitle", { from: bounds.from, to: bounds.to })}
      icon={LineChartIcon}
    >
      {!athleteId ? (
        <p className="text-sm text-amber-200/85">{t("selectAthlete")}</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                  preset === p.id
                    ? "border-orange-400/55 bg-orange-500/20 text-orange-100 shadow-[0_0_14px_rgba(251,146,60,0.18)]"
                    : "border-white/15 bg-black/35 text-gray-400 hover:border-white/25 hover:text-gray-200"
                }`}
              >
                {t(`preset_${p.id}`)}
              </button>
            ))}
          </div>
          {fetchErr ? <p className="mb-3 text-xs text-amber-300/90">{fetchErr}</p> : null}
          {!loading && analyticsVm?.adaptationSummary ? (
            <p className="mb-3 rounded-xl border border-orange-500/25 bg-orange-500/5 px-3 py-2 text-xs text-orange-100/90">
              <span className="font-semibold text-orange-200/95">{t("twinAdaptation")}</span>
              {analyticsVm.adaptationSummary.recoveryDataTier ? (
                <span>
                  tier{" "}
                  {analyticsVm.adaptationSummary.recoveryDataTier === "minimal"
                    ? t("tierMinimal")
                    : analyticsVm.adaptationSummary.recoveryDataTier === "extended"
                      ? t("tierExtended")
                      : t("tierStandard")}
                  {" · "}
                </span>
              ) : null}
              {analyticsVm.adaptationSummary.adaptationScoreV1 ? (
                <>
                  v1 {Math.round(analyticsVm.adaptationSummary.adaptationScoreV1.compositeScore)} (conf{" "}
                  {(analyticsVm.adaptationSummary.adaptationScoreV1.confidence * 100).toFixed(0)}%)
                </>
              ) : analyticsVm.adaptationSummary.adaptationScore != null ? (
                <>legacy {Math.round(analyticsVm.adaptationSummary.adaptationScore)}/100</>
              ) : (
                t("partialMetrics")
              )}
              {analyticsVm.adaptationSummary.asOf ? (
                <span className="ml-1 font-mono text-[0.65rem] text-gray-500">· asOf {analyticsVm.adaptationSummary.asOf}</span>
              ) : null}
            </p>
          ) : null}
          {loading ? (
            <div className="h-16 animate-pulse rounded-xl bg-orange-500/10" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { k: t("volSessions"), v: f.sessions },
                  { k: t("volHours"), v: f.hours },
                  { k: t("volLoad"), v: f.tss },
                  { k: t("volDistanceKm"), v: f.km },
                  { k: t("volElevationM"), v: f.elev },
                  { k: "kcal", v: f.kcal },
                ].map((cell) => (
                  <div key={cell.k} className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-center shadow-inner">
                    <div className="font-mono text-lg font-semibold tabular-nums text-white">{cell.v}</div>
                    <div className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-gray-500">{cell.k}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  { k: "Rest HR", v: recoveryRollup?.avgRestingHrBpm != null ? `${Math.round(recoveryRollup.avgRestingHrBpm)} bpm` : "—" },
                  { k: "HRV RMSSD", v: recoveryRollup?.avgHrvRmssdMs != null ? `${Math.round(recoveryRollup.avgHrvRmssdMs)} ms` : "—" },
                  { k: t("recAvgSleep"), v: recoveryRollup?.avgSleepHours != null ? `${recoveryRollup.avgSleepHours.toFixed(2)} h` : "—" },
                  { k: "Skin temp", v: recoveryRollup?.avgSkinTempC != null ? `${recoveryRollup.avgSkinTempC.toFixed(2)} C` : "—" },
                  { k: "Sample rc", v: recoveryRollup != null ? String(recoveryRollup.sampleCount) : "0" },
                ].map((cell) => (
                  <div key={cell.k} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-center">
                    <div className="font-mono text-sm font-semibold tabular-nums text-white">{cell.v}</div>
                    <div className="mt-1 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-gray-500">{cell.k}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                  <p className="mb-2 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-gray-500">{t("sleepTrendHeader")}</p>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sleepSeries}>
                        <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} />
                        <XAxis dataKey="date" tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} />
                        <YAxis tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} />
                        <Tooltip contentStyle={chartTooltipStyle("training")} />
                        <Legend />
                        <Line type="monotone" dataKey="sleep" name={t("legendTotalH")} stroke={CHART_SIGNAL.sleep} dot={false} connectNulls />
                        <Line type="monotone" dataKey="deep" name="Deep h" stroke={CHART_SIGNAL.lactate} dot={false} connectNulls />
                        <Line type="monotone" dataKey="rem" name="REM h" stroke={CHART_SIGNAL.load} dot={false} connectNulls />
                        <Line type="monotone" dataKey="light" name="Light h" stroke="#fbbf24" dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                  <p className="mb-2 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-gray-500">{t("nightHrHrvHeader")}</p>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sleepSeries}>
                        <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} />
                        <XAxis dataKey="date" tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} />
                        <YAxis tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} />
                        <Tooltip contentStyle={chartTooltipStyle("training")} />
                        <Legend />
                        <Line type="monotone" dataKey="hr" name={t("legendNightHr")} stroke={CHART_SIGNAL.hr} dot={false} connectNulls />
                        <Line type="monotone" dataKey="hrv" name="HRV RMSSD" stroke={CHART_SIGNAL.hrv} dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {avgCells.map((cell) => (
                  <div key={cell.k} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-center">
                    <div className="font-mono text-sm font-semibold tabular-nums text-white">{cell.v}</div>
                    <div className="mt-1 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-gray-500">{cell.k}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {biomarkerCells.map((cell) => (
                  <div key={cell.k} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-center">
                    <div className="font-mono text-sm font-semibold tabular-nums text-white">{cell.v}</div>
                    <div className="mt-1 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-gray-500">{cell.k}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="mt-3 text-[0.65rem] leading-relaxed text-gray-500">
            {t.rich("footerNote", {
              code: (chunks) => (
                <code className="rounded border border-white/10 bg-white/5 px-1 text-gray-400">{chunks}</code>
              ),
            })}
          </p>
        </>
      )}
    </Pro2SectionCard>
    </div>
  );
}
