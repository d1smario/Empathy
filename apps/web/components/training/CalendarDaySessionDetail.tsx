"use client";

import type { ExecutedWorkout } from "@empathy/domain-training";
import { Activity, Map as MapIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { SportDisciplineGlyph } from "@/components/training/SportDisciplineGlyph";

// Mappa GPS 3D reale (MapLibre GL: base CartoDB + terreno estruso + pitch), solo lato
// client. Ripiega automaticamente sulla 2D Leaflet se il browser non ha WebGL.
const SessionRoute3DMap = dynamic(
  () => import("@/components/training/SessionRoute3DMap").then((m) => m.SessionRoute3DMap),
  {
    ssr: false,
    loading: () => <div className="h-[340px] w-full animate-pulse rounded-2xl bg-white/5" />,
  },
);
import {
  SessionMultiAxisChart,
  type MultiAxisChannel,
  type MultiAxisSeries,
} from "@/components/training/SessionMultiAxisChart";
import { BiomarkerTile, KpiTile, sessionBiomarkerTiles } from "@/components/training/SessionKpiTiles";
import { SessionSummaryModule } from "@/components/training/SessionSummaryModule";
import {
  SessionDataGridTable,
  SessionDistributionHistogram,
} from "@/components/training/SessionAnalysisDistributions";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import {
  formatElapsedLabel,
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

/** Canali resi nell'overlay multi-asse; gli altri restano solo nel calcolo min/avg/max. */
const MULTI_AXIS_CHANNELS = new Set<ChartChannel>([
  "power",
  "hr",
  "speed",
  "cadence",
  "altitude",
  "temperature",
  // Passo e velocità verticale: utili per corsa/trail dove la potenza spesso manca.
  "pace_min_per_km",
  "vertical_speed_mps",
]);

/** Label KPI del top-5 canonico (come mockup): il resto va nei box-segnale sotto. */
const PRIMARY_KPI_ORDER = ["Distanza", "Durata", "Dislivello", "Carico", "IF"] as const;

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

/** Distanza haversine (km) tra due punti GPS, per derivare la distanza dal percorso. */
function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
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

  // Serie dell'overlay multi-asse (potenza/FC/velocità/cadenza/quota/temp) + etichette
  // temporali comuni: tutte le tracce su un unico grafico, per vederne gli incroci.
  const overlaySeries = useMemo<MultiAxisSeries[]>(
    () =>
      allSeries
        .filter((s) => MULTI_AXIS_CHANNELS.has(s.channel))
        .map((s) => ({ channel: s.channel as MultiAxisChannel, unit: s.unit, values: s.values })),
    [allSeries],
  );
  const overlayMaxLen = useMemo(
    () => overlaySeries.reduce((m, s) => Math.max(m, s.values.length), 0),
    [overlaySeries],
  );
  const overlayLabels = useMemo(() => {
    const dur = Number.isFinite(workout.durationMinutes) ? Number(workout.durationMinutes) : null;
    return Array.from({ length: overlayMaxLen }, (_, i) => formatElapsedLabel(i, overlayMaxLen, dur));
  }, [overlayMaxLen, workout.durationMinutes]);

  // A2: distribuzioni FC/cadenza (minuti nel bucket) + griglia dati (Time × canali),
  // stile TrainingPeaks. Solo canali con dati reali (device import) — niente grafici finti.
  const distribution = useMemo(() => {
    const durMin = Number.isFinite(workout.durationMinutes) ? Number(workout.durationMinutes) : 0;
    const hr = allSeries.find((s) => s.channel === "hr")?.values ?? [];
    const cadence = allSeries.find((s) => s.channel === "cadence")?.values ?? [];
    const gridChannels = ["speed", "hr", "cadence", "power", "altitude", "temperature"];
    return {
      durMin,
      hr: hr.some((v) => Number.isFinite(v)) ? hr : null,
      cadence: cadence.some((v) => Number.isFinite(v)) ? cadence : null,
      hasGrid: allSeries.some(
        (s) => gridChannels.includes(s.channel) && s.values.some((v) => Number.isFinite(v)),
      ),
    };
  }, [allSeries, workout.durationMinutes]);

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

  // Distanza dal percorso GPS (haversine) e dislivello dalla serie quota — quando il
  // trace_summary non li espone, così il top-5 resta completo su dati REALI derivati.
  const routeDistanceKm = useMemo(() => {
    const pts = routeBundle?.points ?? [];
    if (pts.length < 2) return null;
    let km = 0;
    for (let i = 1; i < pts.length; i += 1) km += haversineKm(pts[i - 1]!, pts[i]!);
    return km > 0 ? km : null;
  }, [routeBundle]);
  const elevGainM = useMemo(() => {
    const alt = allSeries.find((s) => s.channel === "altitude")?.values ?? [];
    if (alt.length < 2) return null;
    let gain = 0;
    for (let i = 1; i < alt.length; i += 1) {
      const d = alt[i]! - alt[i - 1]!;
      if (d > 0) gain += d;
    }
    return gain > 3 ? gain : null;
  }, [allSeries]);

  // Tutti i KPI + Distanza/Dislivello derivati se mancanti. Split: top-5 canonici in
  // alto, i totali (Lavoro/Energia) scendono nella sezione box-segnale sotto.
  const allKpi = useMemo<SessionKpiTile[]>(() => {
    const tiles = [...kpiTiles];
    const has = (label: string) => tiles.some((t) => t.label === label);
    if (!has("Distanza")) {
      const km = routeDistanceKm ?? (distanceMeters != null ? distanceMeters / 1000 : null);
      if (km != null) tiles.push({ label: "Distanza", value: km.toFixed(1), unit: "km", accent: "fuchsia" });
    }
    if (!has("Dislivello") && elevGainM != null) {
      tiles.push({ label: "Dislivello", value: Math.round(elevGainM).toString(), unit: "m", accent: "emerald" });
    }
    return tiles;
  }, [kpiTiles, distanceMeters, routeDistanceKm, elevGainM]);
  const primaryKpi = useMemo(
    () =>
      PRIMARY_KPI_ORDER.map((label) => allKpi.find((tile) => tile.label === label)).filter(
        (tile): tile is SessionKpiTile => tile != null,
      ),
    [allKpi],
  );
  const scalarKpi = useMemo(
    () => allKpi.filter((tile) => tile.label === "Lavoro" || tile.label === "Energia"),
    [allKpi],
  );
  const bioTiles = useMemo(() => sessionBiomarkerTiles(workout), [workout]);

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

      {/* Top-5 KPI canonici: Distanza · Durata · Dislivello · Carico(TSS) · IF. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {primaryKpi.map((tile) => (
          <KpiTile key={tile.label} tile={tile} />
        ))}
      </div>

      {overlaySeries.length > 0 ? (
        <div className="space-y-2">
          <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.2em] text-orange-300/80">
            {t("multifactorAnalysis")}
          </p>
          <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
            <SessionMultiAxisChart series={overlaySeries} labels={overlayLabels} />
          </div>
        </div>
      ) : (
        <SessionSummaryModule workout={workout} vm={vm} athleteId={athleteId} />
      )}

      {/* A2: distribuzioni FC/cadenza + griglia dati (solo con serie reali dal device). */}
      {distribution.hr || distribution.cadence || distribution.hasGrid ? (
        <div className="space-y-2">
          <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.2em] text-orange-300/80">
            {t("distributionsTitle")}
          </p>
          {distribution.hr || distribution.cadence ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {distribution.hr ? (
                <SessionDistributionHistogram
                  title={t("hrDistribution")}
                  values={distribution.hr}
                  durationMinutes={distribution.durMin}
                  color="#f87171"
                  bucketWidth={5}
                  unit="bpm"
                  minutesLabel={t("minutesLabel")}
                  excludeZeroLabel={t("excludeZero")}
                />
              ) : null}
              {distribution.cadence ? (
                <SessionDistributionHistogram
                  title={t("cadenceDistribution")}
                  values={distribution.cadence}
                  durationMinutes={distribution.durMin}
                  color="#a78bfa"
                  bucketWidth={5}
                  unit="rpm"
                  minutesLabel={t("minutesLabel")}
                  excludeZeroLabel={t("excludeZero")}
                  supportsExcludeZero
                />
              ) : null}
            </div>
          ) : null}
          {distribution.hasGrid ? (
            <SessionDataGridTable
              title={t("dataGrid")}
              timeLabel={t("timeCol")}
              series={allSeries}
              durationMinutes={distribution.durMin}
            />
          ) : null}
        </div>
      ) : null}

      {/* Totali (lavoro/energia) + biomarcatori: valori scalari NON presenti
          nell'overlay multifattoriale, quindi non sono un doppione delle sue curve. */}
      {scalarKpi.length > 0 || bioTiles.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {scalarKpi.map((tile) => (
            <KpiTile key={tile.label} tile={tile} />
          ))}
          {bioTiles.map((tile) => (
            <BiomarkerTile key={tile.label} tile={tile} />
          ))}
        </div>
      ) : null}

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
          <SessionRoute3DMap
            route={routeBundle.points.map((p) => [p.lat, p.lon] as [number, number])}
            height={340}
          />
        </div>
      ) : null}
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
      {/* Card senza header: «Sessione del giorno · N eseguito» era ridondante con l'header pagina. */}
      {vms.map((vm, idx) => {
        const w = sortedExecuted[idx]!;
        return (
          <section
            key={vm.workoutId}
            className="rounded-2xl border border-orange-500/25 bg-gradient-to-br from-orange-950/[0.12] via-black/60 to-black/85 p-4 shadow-inner sm:p-6"
          >
            <SessionDetailCard vm={vm} workout={w} athleteId={athleteId} athleteFtpWatts={athleteFtpWatts} />
          </section>
        );
      })}
    </div>
  );
}
