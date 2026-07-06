"use client";

import type { ExecutedWorkout } from "@empathy/domain-training";
import { Activity, Gauge, Map as MapIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { SportDisciplineGlyph } from "@/components/training/SportDisciplineGlyph";

// Mappa GPS "professionale" (Leaflet + tile CartoDB reali) caricata solo lato client.
const StravaStyleMap = dynamic(
  () => import("@/components/training/StravaStyleMap").then((m) => m.StravaStyleMap),
  {
    ssr: false,
    loading: () => <div className="h-[300px] w-full animate-pulse rounded-2xl bg-white/5" />,
  },
);
import { SessionSignalSparkline } from "@/components/training/SessionSignalSparkline";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import {
  geoPointsFromWorkoutTrace,
  pickPrimaryExecutedWorkout,
} from "@/lib/training/calendar-analyzer-helpers";
import {
  buildSessionDetailVM,
  type SessionDetailViewModel,
  type SessionKpiTile,
  type SessionSecondaryRow,
} from "@/lib/training/session-detail-summary";
import {
  type GeoPoint,
  isGeoPoint,
  type SeriesChannelId,
} from "@/lib/training/series-channel-registry";
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

/** Canali chart richiesti al DB (colonna `channel` di `executed_workout_series`). */
const SESSION_SERIES_CHART_CHANNELS: readonly string[] = Array.from(CHART_CHANNELS);

/** Etichette IT + cifre per la tabella min/avg/max calcolata dalle serie HD. */
const CHANNEL_LABEL_IT: Record<ChartChannel, string> = {
  power: "Potenza",
  hr: "FC",
  speed: "Velocità",
  cadence: "Cadenza",
  altitude: "Quota",
  temperature: "Temperatura",
  distance: "Distanza",
  pace_min_per_km: "Passo",
  vertical_speed_mps: "Vel. verticale",
};
const CHANNEL_DIGITS: Record<ChartChannel, number> = {
  power: 0,
  hr: 0,
  speed: 1,
  cadence: 0,
  altitude: 0,
  temperature: 1,
  distance: 0,
  pace_min_per_km: 1,
  vertical_speed_mps: 1,
};

/** Colore canonico per canale (coerente col grafico multi-asse) per le sparkline. */
const SIGNAL_COLOR: Record<ChartChannel, string> = {
  power: CHART_SIGNAL.power,
  hr: CHART_SIGNAL.hr,
  speed: CHART_SIGNAL.speed,
  cadence: CHART_SIGNAL.cadence,
  altitude: CHART_SIGNAL.altitude,
  temperature: "#fbbf24",
  distance: "#60a5fa",
  pace_min_per_km: CHART_SIGNAL.speed,
  vertical_speed_mps: CHART_SIGNAL.altitude,
};

/** min/avg/max di una serie HD → riga tabella secondaria (stessa forma del VM). */
function seriesStatsRow(channel: ChartChannel, unit: string, values: number[]): SessionSecondaryRow | null {
  const f = values.filter((v) => Number.isFinite(v));
  if (f.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const v of f) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  const digits = CHANNEL_DIGITS[channel] ?? 1;
  const factor = 10 ** digits;
  const round = (x: number) => Math.round(x * factor) / factor;
  return {
    channel,
    label: CHANNEL_LABEL_IT[channel] ?? channel,
    unit,
    min: round(min),
    avg: round(sum / f.length),
    max: round(max),
  };
}

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

/** Tile biomarcatore (lattato/glicemia/SmO₂): accento fucsia per distinguerlo dai KPI performance. */
function BiomarkerTile({ tile }: { tile: SessionKpiTile }) {
  return (
    <div className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/[0.04] px-4 py-3">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-fuchsia-300/70">{tile.label}</p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">
        {tile.value}
        {tile.unit ? <span className="ml-1 text-xs font-medium text-gray-500">{tile.unit}</span> : null}
      </p>
    </div>
  );
}

/** Biomarcatori seduta da colonne `executed_workouts` (lattato/glicemia/SmO₂). Adattivo: solo valori presenti. */
function sessionBiomarkerTiles(workout: ExecutedWorkout): SessionKpiTile[] {
  const tiles: SessionKpiTile[] = [];
  const lac = Number(workout.lactateMmoll);
  const glu = Number(workout.glucoseMmol);
  const smo = Number(workout.smo2);
  if (Number.isFinite(lac) && lac > 0) tiles.push({ label: "Lattato", value: lac.toFixed(1), unit: "mmol/L" });
  if (Number.isFinite(glu) && glu > 0) tiles.push({ label: "Glicemia", value: glu.toFixed(1), unit: "mmol/L" });
  if (Number.isFinite(smo) && smo > 0) tiles.push({ label: "SmO₂", value: smo.toFixed(0), unit: "%" });
  return tiles;
}

function SessionDetailCard({
  vm,
  workout,
  athleteId,
  athleteFtpWatts,
}: {
  vm: SessionDetailViewModel;
  workout: ExecutedWorkout;
  athleteId: string | null | undefined;
  athleteFtpWatts: number | null | undefined;
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
      ? [...SESSION_SERIES_CHART_CHANNELS, "route"]
      : [...SESSION_SERIES_CHART_CHANNELS];
    (async () => {
      try {
        /** DB-first: serie HD lette direttamente da `executed_workout_series` (RLS access-scoped). */
        const supabase = createEmpathyBrowserSupabase();
        if (!supabase) return;
        const { data, error } = await supabase
          .from("executed_workout_series")
          .select("channel, unit, samples")
          .eq("athlete_id", athleteId)
          .eq("executed_workout_id", vm.workoutId)
          .in("channel", channels);
        if (cancelled || error || !data) return;
        const rows = data as Array<{ channel: string; unit: string; samples: unknown }>;

        const merged: ExtendedSeriesBundle[] = [];
        for (const c of rows) {
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


  // Tabella min/avg/max dalle serie HD (tutti i canali, coerente col grafico);
  // fallback alle statistiche del trace_summary (vm.secondary) se non ci sono serie.
  const secondaryRows = useMemo<SessionSecondaryRow[]>(() => {
    const rows = allSeries
      .map((s) => seriesStatsRow(s.channel, s.unit, s.values))
      .filter((r): r is SessionSecondaryRow => r != null);
    return rows.length > 0 ? rows : vm.secondary;
  }, [allSeries, vm.secondary]);

  // Potenza media + IF dalla serie HD reale (ground truth): alcuni trace_summary hanno
  // l'avg potenza sottostimato → correggiamo con l'avg dei campioni per coerenza col grafico.
  const seriesPowerAvg = useMemo(() => {
    const row = secondaryRows.find((r) => r.channel === "power");
    return row && row.avg != null && Number.isFinite(row.avg) ? row.avg : null;
  }, [secondaryRows]);
  const kpiTiles = useMemo<SessionKpiTile[]>(() => {
    if (seriesPowerAvg == null) return vm.kpi;
    const ftp = athleteFtpWatts ?? null;
    const ifValue = ftp != null && ftp > 0 ? seriesPowerAvg / ftp : null;
    const ifTile: SessionKpiTile | null =
      ifValue != null && ifValue > 0 && ifValue < 3
        ? { label: "IF", value: ifValue.toFixed(2), accent: "sky" }
        : null;
    const out: SessionKpiTile[] = [];
    let ifDone = false;
    for (const tile of vm.kpi) {
      if (tile.label === "IF") {
        // Sostituisci l'IF del VM (da trace, spesso assente) con quello dalle serie.
        if (ifTile && !ifDone) {
          out.push(ifTile);
          ifDone = true;
        }
        continue;
      }
      out.push(tile.label === "Potenza media" ? { ...tile, value: Math.round(seriesPowerAvg).toString() } : tile);
      // Inserisci l'IF subito dopo il Carico se il VM non l'aveva.
      if (ifTile && !ifDone && tile.label === "Carico") {
        out.push(ifTile);
        ifDone = true;
      }
    }
    return out;
  }, [vm.kpi, seriesPowerAvg, athleteFtpWatts]);

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
        {kpiTiles.map((tile) => (
          <KpiTile key={tile.label} tile={tile} />
        ))}
        {distanceMeters != null && !kpiTiles.some((t) => t.label === "Distanza") ? (
          <KpiTile
            tile={{
              label: "Distanza",
              value: (distanceMeters / 1000).toFixed(2),
              unit: "km",
            }}
          />
        ) : null}
      </div>

      {(() => {
        const bio = sessionBiomarkerTiles(workout);
        if (bio.length === 0) return null;
        return (
          <div className="space-y-2">
            <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.2em] text-fuchsia-300/80">
              {t("biomarkers")}
            </p>
            <div className="grid grid-cols-3 gap-3 md:max-w-lg">
              {bio.map((tile) => (
                <BiomarkerTile key={tile.label} tile={tile} />
              ))}
            </div>
          </div>
        );
      })()}

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
          <StravaStyleMap
            route={routeBundle.points.map((p) => [p.lat, p.lon] as [number, number])}
            height={320}
          />
        </div>
      ) : null}

      {secondaryRows.length > 0 ? (
        <div className="space-y-2">
          {secondaryRows.map((row) => {
            const digits = row.unit === "rpm" || row.unit === "m" || row.unit === "W" || row.unit === "bpm" ? 0 : 1;
            const values = allSeries.find((s) => s.channel === row.channel)?.values ?? [];
            const color = SIGNAL_COLOR[row.channel as ChartChannel] ?? "#a1a1aa";
            return (
              <div key={row.channel} className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-200">
                    {row.label}
                    <span className="ml-1 text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">{row.unit}</span>
                  </p>
                  <p className="font-mono text-xs tabular-nums text-gray-300">
                    <span className="text-gray-500">min</span> {fmt(row.min, digits)}
                    <span className="mx-1 text-gray-600">·</span>
                    <span className="text-gray-500">avg</span> {fmt(row.avg, digits)}
                    <span className="mx-1 text-gray-600">·</span>
                    <span className="text-gray-500">max</span> {fmt(row.max, digits)}
                  </p>
                </div>
                {values.length >= 2 ? <SessionSignalSparkline values={values} color={color} /> : null}
              </div>
            );
          })}
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
  /** FTP atleta (W) per calcolare l'IF nell'header KPI. Opzionale: senza, l'IF non compare. */
  athleteFtpWatts?: number | null;
};

export function CalendarDaySessionDetail({
  selectedDate,
  dayExecuted,
  athleteId,
  athleteFtpWatts,
}: CalendarDaySessionDetailProps) {
  const t = useTranslations("CalendarDaySessionDetail");
  const sortedExecuted = useMemo(() => {
    const primary = pickPrimaryExecutedWorkout(dayExecuted);
    if (!primary) return dayExecuted;
    return [primary, ...dayExecuted.filter((w) => w.id !== primary.id)];
  }, [dayExecuted]);
  const vms = useMemo(
    () => sortedExecuted.map((w) => buildSessionDetailVM(w, { ftpW: athleteFtpWatts ?? null })),
    [sortedExecuted, athleteFtpWatts],
  );
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
              athleteId={athleteId}
              athleteFtpWatts={athleteFtpWatts}
            />
          </Pro2SectionCard>
        );
      })}
    </div>
  );
}
