"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ExecutedWorkout } from "@empathy/domain-training";
import {
  SessionMultiAxisChart,
  type MultiAxisChannel,
  type MultiAxisSeries,
} from "@/components/training/SessionMultiAxisChart";
import { BiomarkerTile, KpiTile, sessionBiomarkerTiles } from "@/components/training/SessionKpiTiles";
import {
  fetchExecutedSeriesBundles,
  type ExecutedSeriesBundle,
} from "@/lib/training/executed-series-fetch";
import { buildSessionDetailVM, type SessionKpiTile } from "@/lib/training/session-detail-summary";
import { formatElapsedLabel } from "@/lib/training/calendar-analyzer-helpers";
import type { GeoPoint } from "@/lib/training/series-channel-registry";

const OVERLAY_CHANNELS = new Set<MultiAxisChannel>([
  "power",
  "hr",
  "speed",
  "cadence",
  "altitude",
  "temperature",
]);
/** Ordine dei box KPI dell'anteprima, uguale al dettaglio seduta. */
const PRIMARY_ORDER = ["Distanza", "Durata", "Dislivello", "Carico", "IF"] as const;

function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Anteprima compatta di una seduta ESEGUITA dentro la riga del calendario: i box KPI
 * principali + un mini grafico multifattoriale. Le serie HD si caricano in **lazy**
 * (IntersectionObserver) solo quando la riga entra nel viewport, così un mese pieno
 * non rallenta il primo render. Stesso motore del dettaglio seduta (parità dati).
 */
export function SessionRowPreview({
  workout,
  athleteId,
  ftpW,
}: {
  workout: ExecutedWorkout;
  athleteId: string | null | undefined;
  ftpW: number | null | undefined;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const [series, setSeries] = useState<ExecutedSeriesBundle[]>([]);
  const [routePoints, setRoutePoints] = useState<GeoPoint[]>([]);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);

  // Lazy: osserva la riga; carica le serie solo quando è vicina/entra nel viewport.
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  useEffect(() => {
    if (!inView || !athleteId || !workout.id) return;
    let cancelled = false;
    fetchExecutedSeriesBundles(athleteId, workout.id)
      .then((r) => {
        if (cancelled) return;
        setSeries(r.series);
        setRoutePoints(r.routePoints);
        setDistanceMeters(r.distanceMeters);
      })
      .catch(() => {
        /* best-effort: senza serie mostriamo solo i KPI scalari */
      });
    return () => {
      cancelled = true;
    };
  }, [inView, athleteId, workout.id]);

  const vm = useMemo(() => buildSessionDetailVM(workout, { ftpW: ftpW ?? null }), [workout, ftpW]);

  const overlaySeries = useMemo<MultiAxisSeries[]>(
    () =>
      series
        .filter((s) => OVERLAY_CHANNELS.has(s.channel as MultiAxisChannel))
        .map((s) => ({ channel: s.channel as MultiAxisChannel, unit: s.unit, values: s.values })),
    [series],
  );
  const overlayLabels = useMemo(() => {
    const n = overlaySeries.reduce((m, s) => Math.max(m, s.values.length), 0);
    const dur = Number.isFinite(workout.durationMinutes) ? Number(workout.durationMinutes) : null;
    return Array.from({ length: n }, (_, i) => formatElapsedLabel(i, n, dur));
  }, [overlaySeries, workout.durationMinutes]);

  // KPI: base dal VM (Durata/Carico/…) + Distanza/Dislivello/IF derivati dalle serie reali.
  const primaryKpi = useMemo<SessionKpiTile[]>(() => {
    const tiles = [...vm.kpi];
    const has = (label: string) => tiles.some((t) => t.label === label);

    const power = series.find((s) => s.channel === "power")?.values ?? [];
    if (power.length > 0 && ftpW && ftpW > 0 && !has("IF")) {
      const avg = power.reduce((a, b) => a + b, 0) / power.length;
      const iff = avg / ftpW;
      if (iff > 0 && iff < 3) tiles.push({ label: "IF", value: iff.toFixed(2), accent: "sky" });
    }

    if (!has("Distanza")) {
      let km: number | null = distanceMeters != null ? distanceMeters / 1000 : null;
      if (km == null && routePoints.length >= 2) {
        let d = 0;
        for (let i = 1; i < routePoints.length; i += 1) d += haversineKm(routePoints[i - 1]!, routePoints[i]!);
        km = d > 0 ? d : null;
      }
      if (km != null) tiles.push({ label: "Distanza", value: km.toFixed(1), unit: "km", accent: "fuchsia" });
    }

    if (!has("Dislivello")) {
      const alt = series.find((s) => s.channel === "altitude")?.values ?? [];
      if (alt.length >= 2) {
        let gain = 0;
        for (let i = 1; i < alt.length; i += 1) {
          const dd = alt[i]! - alt[i - 1]!;
          if (dd > 0) gain += dd;
        }
        if (gain > 3) tiles.push({ label: "Dislivello", value: Math.round(gain).toString(), unit: "m", accent: "emerald" });
      }
    }

    return PRIMARY_ORDER.map((label) => tiles.find((t) => t.label === label)).filter(
      (t): t is SessionKpiTile => t != null,
    );
  }, [vm.kpi, series, routePoints, distanceMeters, ftpW]);

  const bioTiles = useMemo(() => sessionBiomarkerTiles(workout), [workout]);
  const hasChart = overlaySeries.length > 0;

  if (primaryKpi.length === 0 && !hasChart && bioTiles.length === 0) {
    return <div ref={ref} />;
  }

  return (
    <div ref={ref} className="mt-3 space-y-2">
      {primaryKpi.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {primaryKpi.map((tile) => (
            <KpiTile key={tile.label} tile={tile} size="sm" />
          ))}
        </div>
      ) : null}

      {hasChart ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-2">
          <SessionMultiAxisChart series={overlaySeries} labels={overlayLabels} compact height={104} />
        </div>
      ) : null}

      {bioTiles.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {bioTiles.map((tile) => (
            <BiomarkerTile key={tile.label} tile={tile} size="sm" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
