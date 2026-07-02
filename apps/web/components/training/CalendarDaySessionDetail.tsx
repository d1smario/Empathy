"use client";

import type { ExecutedWorkout } from "@empathy/domain-training";
import { Activity, Gauge, Map as MapIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { SessionRouteMap } from "@/components/training/SessionRouteMap";
import { SportDisciplineGlyph } from "@/components/training/SportDisciplineGlyph";
import { TrainingSingleTraceChart } from "@/components/training/TrainingSingleTraceChart";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import {
  formatElapsedLabel,
  geoPointsFromWorkoutTrace,
  pickPrimaryExecutedWorkout,
} from "@/lib/training/calendar-analyzer-helpers";
import {
  buildSessionDetailVM,
  type SessionDetailViewModel,
  type SessionKpiTile,
} from "@/lib/training/session-detail-summary";
import {
  type GeoPoint,
  isGeoPoint,
  type SeriesChannelId,
} from "@/lib/training/series-channel-registry";
import { cn } from "@/lib/cn";
import { CHART_SIGNAL } from "@/lib/ui/chart-theme";

/**
 * Canali scalari renderizzati come trace chart. `route` è gestito a parte come
 * mini-mappa (vedi `SessionRouteMap`); `time_elapsed` non si chartizza da solo.
 */
type ChartChannel = Exclude<SeriesChannelId, "route" | "time_elapsed">;

const CHART_CHANNELS: ReadonlySet<ChartChannel> = new Set([
  "power",
  "hr",
  "speed",
  "cadence",
  "altitude",
  "temperature",
  "distance",
  "pace_min_per_km",
  "vertical_speed_mps",
]);

/** Colori segnale canonici da chart-theme (un hex per segnale in tutta l'app). */
const SERIES_COLOR: Record<ChartChannel, string> = {
  power: CHART_SIGNAL.power,
  hr: CHART_SIGNAL.hr,
  speed: CHART_SIGNAL.speed,
  cadence: CHART_SIGNAL.cadence,
  altitude: CHART_SIGNAL.altitude,
  temperature: "#fbbf24", // amber-400 — nessun segnale canonico dedicato
  distance: "#60a5fa", // blue-400 (ciclo CHART_SERIES)
  pace_min_per_km: CHART_SIGNAL.speed,
  vertical_speed_mps: CHART_SIGNAL.altitude,
};

const SESSION_SERIES_CHART_CHANNELS = Array.from(CHART_CHANNELS).join(",");

const SERIES_LABEL: Record<ChartChannel, string> = {
  power: "Power",
  hr: "HR",
  speed: "Speed",
  cadence: "Cadence",
  altitude: "Altitude",
  temperature: "Temperature",
  distance: "Distance",
  pace_min_per_km: "Pace",
  vertical_speed_mps: "Vertical speed",
};

type ExtendedSeriesBundle = {
  channel: ChartChannel;
  unit: string;
  values: number[];
};

type RouteBundle = { points: GeoPoint[] };

function fmt(value: number | null, digits: number): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function KpiTile({ tile }: { tile: SessionKpiTile }) {
  return (
    <div className="rounded-2xl border border-orange-500/25 bg-black/40 px-4 py-3">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">{tile.label}</p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">
        {tile.value}
        {tile.unit ? <span className="ml-1 text-xs font-medium text-gray-500">{tile.unit}</span> : null}
      </p>
    </div>
  );
}

function SessionDetailCard({
  vm,
  workout,
  dayExecutedDuration,
  athleteId,
}: {
  vm: SessionDetailViewModel;
  workout: ExecutedWorkout;
  dayExecutedDuration: number | null;
  athleteId: string | null | undefined;
}) {
  const t = useTranslations("CalendarDaySessionDetail");
  const traceRoutePoints = useMemo(() => geoPointsFromWorkoutTrace(workout), [workout]);
  const [dbSeries, setDbSeries] = useState<ExtendedSeriesBundle[]>([]);
  const [routeBundle, setRouteBundle] = useState<RouteBundle | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);

  useEffect(() => {
    setRouteBundle(traceRoutePoints.length > 0 ? { points: traceRoutePoints } : null);
  }, [traceRoutePoints]);

  useEffect(() => {
    if (!athleteId || !vm.workoutId) return;
    let cancelled = false;
    const needsRouteFromDb = traceRoutePoints.length < 2;
    const channels = needsRouteFromDb
      ? `${SESSION_SERIES_CHART_CHANNELS},route`
      : SESSION_SERIES_CHART_CHANNELS;
    (async () => {
      try {
        const q = new URLSearchParams({ athleteId, executedId: vm.workoutId, channels });
        const res = await fetch(`/api/training/session-series?${q}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers: await buildSupabaseAuthHeaders(),
        });
        if (!res.ok) return;
        const json = (await res.json()) as
          | {
              ok: true;
              channels: Array<{
                channel: string;
                unit: string;
                shape?: "scalar" | "geo_point";
                samples: unknown[];
              }>;
            }
          | { ok: false; error?: string };
        if (cancelled || !("ok" in json) || !json.ok) return;

        const merged: ExtendedSeriesBundle[] = [];
        for (const c of json.channels) {
          if (c.channel === "route") {
            const pts = (Array.isArray(c.samples) ? c.samples : []).filter(isGeoPoint) as GeoPoint[];
            if (pts.length >= 1) {
              setRouteBundle((prev) =>
                !prev || pts.length > prev.points.length ? { points: pts } : prev,
              );
            }
            continue;
          }
          if (!CHART_CHANNELS.has(c.channel as ChartChannel)) continue;
          const nums = Array.isArray(c.samples)
            ? (c.samples.filter((v) => typeof v === "number" && Number.isFinite(v)) as number[])
            : [];
          if (nums.length < 1) continue;
          /** Recharts line/area: almeno 2 punti; con 1 campione (sessioni brevi) duplichiamo costante. */
          const chartValues = nums.length >= 2 ? nums : [nums[0]!, nums[0]!];
          if (c.channel === "distance") {
            const last = nums[nums.length - 1];
            if (typeof last === "number" && Number.isFinite(last)) setDistanceMeters(last);
          }
          merged.push({
            channel: c.channel as ChartChannel,
            unit: c.unit,
            values: chartValues,
          });
        }
        if (merged.length) setDbSeries(merged);
      } catch {
        // best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId, vm.workoutId, traceRoutePoints.length]);

  const allSeries = useMemo<ExtendedSeriesBundle[]>(() => {
    /**
     * Merge: serie in `trace_summary` (vm.series, fonte VM legacy) + serie HD da DB.
     * DB ha priorità per i canali presenti in entrambi (più completo + nuovi canali).
     */
    const byChannel = new Map<ChartChannel, ExtendedSeriesBundle>();
    for (const s of vm.series) {
      if (CHART_CHANNELS.has(s.channel as ChartChannel)) {
        byChannel.set(s.channel as ChartChannel, {
          channel: s.channel as ChartChannel,
          unit: s.unit,
          values: s.values,
        });
      }
    }
    for (const s of dbSeries) byChannel.set(s.channel, s);
    return Array.from(byChannel.values());
  }, [vm.series, dbSeries]);

  const seriesChannels = allSeries.map((s) => s.channel);
  const [activeChannel, setActiveChannel] = useState<ChartChannel | null>(seriesChannels[0] ?? null);

  useEffect(() => {
    if (activeChannel && seriesChannels.includes(activeChannel)) return;
    setActiveChannel(seriesChannels[0] ?? null);
  }, [activeChannel, seriesChannels]);

  const activeSeries = useMemo(
    () => (activeChannel ? allSeries.find((s) => s.channel === activeChannel) ?? null : null),
    [activeChannel, allSeries],
  );

  const seriesLabels = useMemo(() => {
    if (!activeSeries) return [] as string[];
    const total = activeSeries.values.length;
    return activeSeries.values.map((_, i) => formatElapsedLabel(i, total, dayExecutedDuration));
  }, [activeSeries, dayExecutedDuration]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {vm.sportGlyph ? <SportDisciplineGlyph glyph={vm.sportGlyph} className="h-9 w-9" /> : null}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
            {vm.sport ?? t("sessionFallback")} · {vm.sourceLabel}
          </p>
          {vm.fileName ? (
            <p className="truncate text-xs text-gray-500" title={vm.fileName}>
              file: {vm.fileName}
            </p>
          ) : null}
        </div>
        {vm.importQualityNote ? (
          <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-amber-300">
            {vm.importQualityNote}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {vm.kpi.map((tile) => (
          <KpiTile key={tile.label} tile={tile} />
        ))}
        {distanceMeters != null && !vm.kpi.some((t) => t.label === "Distanza") ? (
          <KpiTile
            tile={{
              label: "Distanza",
              value: (distanceMeters / 1000).toFixed(2),
              unit: "km",
            }}
          />
        ) : null}
      </div>

      {routeBundle && routeBundle.points.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MapIcon className="h-3.5 w-3.5 text-orange-400" />
            <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.2em] text-orange-400">
              {t("gpsRoute")}
            </p>
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">
              {routeBundle.points.length} pt
              {routeBundle.points.length === 2 &&
              routeBundle.points[0]!.lat === routeBundle.points[1]!.lat &&
              routeBundle.points[0]!.lon === routeBundle.points[1]!.lon
                ? vm.parserEngine === "garmin_wellness_api_summary"
                  ? ` · ${t("routeStartPointOnly")}`
                  : ` · ${t("routeSingleGpsPoint")}`
                : ""}
            </span>
          </div>
          <SessionRouteMap points={routeBundle.points} />
        </div>
      ) : null}

      {vm.secondary.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          <table className="w-full divide-y divide-white/5 text-sm">
            <thead>
              <tr className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">
                <th className="px-3 py-2 text-left">{t("channel")}</th>
                <th className="px-3 py-2 text-right">min</th>
                <th className="px-3 py-2 text-right">avg</th>
                <th className="px-3 py-2 text-right">max</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono tabular-nums text-white">
              {vm.secondary.map((row) => (
                <tr key={row.channel}>
                  <td className="px-3 py-2 font-sans text-gray-300">
                    {row.label}
                    <span className="ml-1 text-[0.65rem] uppercase tracking-[0.16em] text-gray-500">{row.unit}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{fmt(row.min, row.unit === "rpm" || row.unit === "m" || row.unit === "W" || row.unit === "bpm" ? 0 : 1)}</td>
                  <td className="px-3 py-2 text-right">{fmt(row.avg, row.unit === "rpm" || row.unit === "m" || row.unit === "W" || row.unit === "bpm" ? 0 : 1)}</td>
                  <td className="px-3 py-2 text-right">{fmt(row.max, row.unit === "rpm" || row.unit === "m" || row.unit === "W" || row.unit === "bpm" ? 0 : 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {allSeries.length > 0 && activeChannel ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {allSeries.map((s) => {
              const isActive = activeChannel === s.channel;
              return (
                <button
                  key={s.channel}
                  type="button"
                  onClick={() => setActiveChannel(s.channel)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition",
                    isActive
                      ? "border-white/40 bg-white/10 text-white"
                      : "border-white/10 bg-black/40 text-gray-400 hover:border-white/25 hover:text-gray-200",
                  )}
                  style={isActive ? { borderColor: SERIES_COLOR[s.channel], color: SERIES_COLOR[s.channel] } : undefined}
                >
                  {SERIES_LABEL[s.channel]}
                </button>
              );
            })}
          </div>
          {activeSeries ? (
            <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
              <TrainingSingleTraceChart
                label={SERIES_LABEL[activeSeries.channel]}
                color={SERIES_COLOR[activeSeries.channel]}
                values={activeSeries.values}
                labels={seriesLabels}
                unit={activeSeries.unit}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-gray-500">
          {t("noHighResSeries")}
        </p>
      )}
    </div>
  );
}

export type CalendarDaySessionDetailProps = {
  selectedDate: string;
  dayExecuted: ExecutedWorkout[];
  athleteId?: string | null;
};

export function CalendarDaySessionDetail({ selectedDate, dayExecuted, athleteId }: CalendarDaySessionDetailProps) {
  const t = useTranslations("CalendarDaySessionDetail");
  const sortedExecuted = useMemo(() => {
    const primary = pickPrimaryExecutedWorkout(dayExecuted);
    if (!primary) return dayExecuted;
    return [primary, ...dayExecuted.filter((w) => w.id !== primary.id)];
  }, [dayExecuted]);
  const vms = useMemo(() => sortedExecuted.map((w) => buildSessionDetailVM(w)), [sortedExecuted]);
  const subtitle = t("subtitle", { count: dayExecuted.length, date: selectedDate });

  if (dayExecuted.length === 0) {
    return (
      <div id="day-session-detail" className="scroll-mt-24">
        <Pro2SectionCard
          accent="orange"
          title={t("sessionOfTheDay")}
          subtitle={subtitle}
          icon={Activity}
        >
          <p className="text-sm text-gray-400">
            {t("emptyState")}
          </p>
        </Pro2SectionCard>
      </div>
    );
  }

  return (
    <div id="day-session-detail" className="scroll-mt-24 space-y-6">
      {vms.map((vm, idx) => {
        const w = sortedExecuted[idx]!;
        const duration = Number.isFinite(w.durationMinutes) ? w.durationMinutes : null;
        return (
          <Pro2SectionCard
            key={vm.workoutId}
            accent="orange"
            title={idx === 0 ? t("sessionOfTheDay") : t("sessionNumbered", { n: idx + 1 })}
            subtitle={idx === 0 ? subtitle : `${vm.sport ?? t("sessionFallback")} · ${vm.sourceLabel}`}
            icon={idx === 0 ? Activity : Gauge}
          >
            <SessionDetailCard
              vm={vm}
              workout={w}
              dayExecutedDuration={duration}
              athleteId={athleteId}
            />
          </Pro2SectionCard>
        );
      })}
    </div>
  );
}
