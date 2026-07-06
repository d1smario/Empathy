"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { cn } from "@/lib/cn";
import type { GeoPoint } from "@/lib/training/series-channel-registry";

/**
 * Mini-mappa SVG della traccia GPS — palette Pro 2. Niente librerie di mappe
 * (no Leaflet/Mapbox), no API key, no tile esterne: la traccia stessa è il dato,
 * arricchita da riferimenti che la rendono leggibile come mappa (griglia, scala,
 * distanza, nord). Adeguata a sessioni reali (Garmin/FIT/GPX/TCX).
 *
 * Comportamento:
 *   - >= 2 punti distinti → traccia (colorata per quota se disponibile) + start/end
 *   - == 1 punto reale → solo marker centrato
 *   - lista vuota / null → non renderizza nulla
 *
 * Proiezione lat/lon equirettangolare locale (compensata col coseno della latitudine
 * media): nord è sempre in alto, distorsione invisibile alle distanze di una sessione.
 */
export type SessionRouteMapProps = {
  points: GeoPoint[] | null | undefined;
  className?: string;
  height?: number;
};

const VIEW_W = 600;
const PADDING = 22;
const EARTH_R = 6371000;
const M_PER_DEG_LAT = 111320;

function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distanza "tonda" (1/2/5 × 10ⁿ) più vicina al target, per la barra di scala. */
function niceDistance(target: number): number {
  if (target <= 0) return 0;
  const pow = 10 ** Math.floor(Math.log10(target));
  const norm = target / pow;
  const nice = norm >= 5 ? 5 : norm >= 2 ? 2 : 1;
  return nice * pow;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`;
  return `${Math.round(meters)} m`;
}

/** quota normalizzata 0..1 → verde (basso) → ambra → rosso (alto), come profilo altimetrico. */
function elevationColor(tNorm: number): string {
  const stops: Array<[number, number, number]> = [
    [52, 211, 153], // emerald-400
    [251, 191, 36], // amber-400
    [248, 113, 113], // red-400
  ];
  const clamped = Math.max(0, Math.min(1, tNorm));
  const seg = clamped <= 0.5 ? 0 : 1;
  const local = clamped <= 0.5 ? clamped / 0.5 : (clamped - 0.5) / 0.5;
  const a = stops[seg]!;
  const b = stops[seg + 1]!;
  const r = Math.round(a[0] + (b[0] - a[0]) * local);
  const g = Math.round(a[1] + (b[1] - a[1]) * local);
  const bl = Math.round(a[2] + (b[2] - a[2]) * local);
  return `rgb(${r}, ${g}, ${bl})`;
}

export function SessionRouteMap({ points, className, height = 260 }: SessionRouteMapProps) {
  const t = useTranslations("SessionRouteMap");
  const model = useMemo(() => {
    if (!points || points.length === 0) return null;

    const seen = new Set<string>();
    const distinct: GeoPoint[] = [];
    for (const p of points) {
      const key = `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      distinct.push(p);
    }
    if (distinct.length === 0) return null;

    const lats = distinct.map((p) => p.lat);
    const lons = distinct.map((p) => p.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const midLat = (minLat + maxLat) / 2;
    const cosLat = Math.cos((midLat * Math.PI) / 180) || 1;

    const spanLat = Math.max(maxLat - minLat, 1e-6);
    const spanLon = Math.max((maxLon - minLon) * cosLat, 1e-6);

    const innerW = VIEW_W - PADDING * 2;
    const innerH = height - PADDING * 2;

    const scale = Math.min(innerW / spanLon, innerH / spanLat);
    const drawW = spanLon * scale;
    const drawH = spanLat * scale;
    const offsetX = PADDING + (innerW - drawW) / 2;
    const offsetY = PADDING + (innerH - drawH) / 2;

    const project = (p: GeoPoint): { x: number; y: number } => ({
      x: offsetX + (p.lon - minLon) * cosLat * scale,
      y: offsetY + (maxLat - p.lat) * scale,
    });

    // Distanza totale + quote (per colore traccia).
    let totalMeters = 0;
    for (let i = 1; i < distinct.length; i += 1) totalMeters += haversineMeters(distinct[i - 1]!, distinct[i]!);

    const alts = distinct.map((p) => (typeof p.alt === "number" && Number.isFinite(p.alt) ? p.alt : null));
    const altValues = alts.filter((a): a is number => a != null);
    const altMin = altValues.length ? Math.min(...altValues) : 0;
    const altMax = altValues.length ? Math.max(...altValues) : 0;
    const useElevation = altValues.length >= distinct.length * 0.8 && altMax - altMin > 3;

    // Barra di scala: distanza tonda ≈ 1/4 della larghezza tracciata.
    const metersPerPx = M_PER_DEG_LAT / scale;
    const scaleMeters = niceDistance((metersPerPx * (VIEW_W - PADDING * 2)) / 4);
    const scaleBarPx = scaleMeters / metersPerPx;

    return {
      distinct,
      project,
      isMarkerOnly: distinct.length === 1,
      totalMeters,
      alts,
      altMin,
      altMax,
      useElevation,
      scaleMeters,
      scaleBarPx,
    };
  }, [points, height]);

  if (!model) return null;
  const { distinct, project, isMarkerOnly } = model;

  const gridV = Array.from({ length: 7 }, (_, i) => ((i + 1) * VIEW_W) / 8);
  const gridH = Array.from({ length: 3 }, (_, i) => ((i + 1) * height) / 4);

  const Graticule = (
    <g stroke="rgba(255,255,255,0.055)" strokeWidth={1}>
      {gridV.map((x) => (
        <line key={`v${x}`} x1={x} y1={0} x2={x} y2={height} />
      ))}
      {gridH.map((y) => (
        <line key={`h${y}`} x1={0} y1={y} x2={VIEW_W} y2={y} />
      ))}
    </g>
  );

  const NorthArrow = (
    <g transform={`translate(${VIEW_W - 26}, 22)`}>
      <path d="M0,-11 L4,4 L0,0 L-4,4 Z" fill="#e5e7eb" opacity={0.8} />
      <text x={0} y={18} fontSize={9} fontFamily="ui-monospace, monospace" fill="#a1a1aa" textAnchor="middle">
        N
      </text>
    </g>
  );

  if (isMarkerOnly) {
    const { x, y } = project(distinct[0]!);
    return (
      <svg
        viewBox={`0 0 ${VIEW_W} ${height}`}
        className={cn("w-full rounded-2xl border border-white/10 bg-black/80", className)}
        role="img"
        aria-label={t("startPointLabel")}
      >
        <defs>
          <radialGradient id="markerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f0abfc" stopOpacity={0.55} />
            <stop offset="60%" stopColor="#f0abfc" stopOpacity={0.1} />
            <stop offset="100%" stopColor="#f0abfc" stopOpacity={0} />
          </radialGradient>
        </defs>
        {Graticule}
        {NorthArrow}
        <circle cx={x} cy={y} r={28} fill="url(#markerGlow)" />
        <circle cx={x} cy={y} r={6} fill="#f0abfc" />
        <circle cx={x} cy={y} r={2} fill="#0a0a0a" />
        <text x={x + 12} y={y + 4} fontSize={11} fontFamily="ui-monospace, monospace" fill="#a1a1aa">
          start
        </text>
      </svg>
    );
  }

  const projected = distinct.map(project);
  const start = projected[0]!;
  const end = projected[projected.length - 1]!;
  const { alts, altMin, altMax, useElevation, totalMeters, scaleMeters, scaleBarPx } = model;
  const altRange = Math.max(1e-6, altMax - altMin);

  const gradientPolyline = projected.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

  // Etichette start/end separate: START a sinistra del marker, END a destra —
  // così restano leggibili anche su un giro chiuso (start≈end).
  const scaleBarY = height - 16;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      className={cn("w-full rounded-2xl border border-white/10 bg-black/80", className)}
      role="img"
      aria-label={t("trackLabel", { count: distinct.length })}
    >
      <defs>
        <linearGradient id="routeStroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f0abfc" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#fb923c" />
        </linearGradient>
        <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {Graticule}
      {NorthArrow}

      {useElevation ? (
        <g filter="url(#routeGlow)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none">
          {projected.slice(1).map((p, i) => {
            const prev = projected[i]!;
            const a0 = alts[i];
            const a1 = alts[i + 1];
            const midAlt = a0 != null && a1 != null ? (a0 + a1) / 2 : (a0 ?? a1 ?? altMin);
            const color = elevationColor((midAlt - altMin) / altRange);
            return (
              <line key={i} x1={prev.x.toFixed(2)} y1={prev.y.toFixed(2)} x2={p.x.toFixed(2)} y2={p.y.toFixed(2)} stroke={color} />
            );
          })}
        </g>
      ) : (
        <polyline
          points={gradientPolyline}
          fill="none"
          stroke="url(#routeStroke)"
          strokeWidth={2.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#routeGlow)"
        />
      )}

      {/* START */}
      <g>
        <circle cx={start.x} cy={start.y} r={5.5} fill="#34d399" stroke="#0a0a0a" strokeWidth={1.5} />
        <text
          x={start.x - 9}
          y={start.y - 7}
          fontSize={10}
          fontFamily="ui-monospace, monospace"
          fill="#34d399"
          fontWeight={700}
          textAnchor="end"
        >
          START
        </text>
      </g>
      {/* END */}
      <g>
        <circle cx={end.x} cy={end.y} r={5.5} fill="#f87171" stroke="#0a0a0a" strokeWidth={1.5} />
        <text
          x={end.x + 9}
          y={end.y + 15}
          fontSize={10}
          fontFamily="ui-monospace, monospace"
          fill="#f87171"
          fontWeight={700}
          textAnchor="start"
        >
          END
        </text>
      </g>

      {/* Distanza totale */}
      <text x={PADDING} y={24} fontSize={13} fontFamily="ui-monospace, monospace" fill="#f5f5f5" fontWeight={700}>
        {formatDistance(totalMeters)}
        {useElevation ? (
          <tspan fontSize={10} fill="#71717a" fontWeight={400}>
            {"  ↑ "}
            {Math.round(altMax - altMin)} m
          </tspan>
        ) : null}
      </text>

      {/* Barra di scala */}
      {scaleBarPx > 8 && scaleBarPx < VIEW_W - PADDING * 2 ? (
        <g transform={`translate(${PADDING}, ${scaleBarY})`}>
          <line x1={0} y1={0} x2={scaleBarPx} y2={0} stroke="#d4d4d8" strokeWidth={2} />
          <line x1={0} y1={-4} x2={0} y2={4} stroke="#d4d4d8" strokeWidth={2} />
          <line x1={scaleBarPx} y1={-4} x2={scaleBarPx} y2={4} stroke="#d4d4d8" strokeWidth={2} />
          <text x={scaleBarPx / 2} y={-6} fontSize={9} fontFamily="ui-monospace, monospace" fill="#a1a1aa" textAnchor="middle">
            {formatDistance(scaleMeters)}
          </text>
        </g>
      ) : null}
    </svg>
  );
}
