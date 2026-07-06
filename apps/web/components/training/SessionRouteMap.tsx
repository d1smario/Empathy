"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { cn } from "@/lib/cn";
import type { GeoPoint } from "@/lib/training/series-channel-registry";

/**
 * Mappa percorso GPS in **3D isometrico** — self-contained (zero tile esterne, no
 * Leaflet/Mapbox/API key). La traccia è proiettata su un piano-terra a griglia in
 * prospettiva assonometrica e la QUOTA è estrusa in altezza: si vedono colli e discese
 * nello spazio, non solo la forma dall'alto. Sotto il percorso una "tenda" altimetrica
 * colorata (verde basso → rosso alto). Dati reali (lat/lon/alt) da Garmin/FIT/GPX/TCX.
 *
 *   - >= 2 punti distinti → percorso 3D + tenda + start/end + griglia
 *   - == 1 punto reale → marker singolo (2D)
 *   - vuoto / null → non renderizza nulla
 */
export type SessionRouteMapProps = {
  points: GeoPoint[] | null | undefined;
  className?: string;
  height?: number;
};

const VIEW_W = 620;
const EARTH_R = 6371000;

// Camera isometrica.
const PAD = 26;
const GROUND_SY = 96; // profondità del piano-terra
const ELEV_H = 132; // altezza massima di estrusione quota

function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`;
  return `${Math.round(meters)} m`;
}

/** quota normalizzata 0..1 → verde (basso) → ambra → rosso (alto). */
function elevationColor(tNorm: number): string {
  const stops: Array<[number, number, number]> = [
    [52, 211, 153],
    [251, 191, 36],
    [248, 113, 113],
  ];
  const c = Math.max(0, Math.min(1, tNorm));
  const seg = c <= 0.5 ? 0 : 1;
  const local = c <= 0.5 ? c / 0.5 : (c - 0.5) / 0.5;
  const a = stops[seg]!;
  const b = stops[seg + 1]!;
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * local)}, ${Math.round(a[1] + (b[1] - a[1]) * local)}, ${Math.round(a[2] + (b[2] - a[2]) * local)})`;
}

export function SessionRouteMap({ points, className, height = 340 }: SessionRouteMapProps) {
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
    const spanLat = Math.max(maxLat - minLat, 1e-9);
    const spanLon = Math.max(maxLon - minLon, 1e-9);

    // Normalizza il lato più lungo → quadrato unitario mantenendo le proporzioni.
    const geoW = spanLon * cosLat;
    const geoH = spanLat;
    const geoMax = Math.max(geoW, geoH);
    const normX = (p: GeoPoint) => ((p.lon - minLon) * cosLat) / geoMax; // 0..~1
    const normZ = (p: GeoPoint) => (maxLat - p.lat) / geoMax; // 0..~1 (nord = "lontano")

    const alts = distinct.map((p) => (typeof p.alt === "number" && Number.isFinite(p.alt) ? p.alt : null));
    const altValues = alts.filter((a): a is number => a != null);
    const altMin = altValues.length ? Math.min(...altValues) : 0;
    const altMax = altValues.length ? Math.max(...altValues) : 0;
    const altSpan = Math.max(altMax - altMin, 1e-6);
    const useElevation = altValues.length >= distinct.length * 0.8 && altMax - altMin > 3;

    const originX = VIEW_W / 2;
    const originY = height - PAD - GROUND_SY;
    const spanU = Math.max(geoW / geoMax, geoH / geoMax); // per centrare
    const SX = (VIEW_W / 2 - PAD) / Math.max(1, spanU);

    // Proiezione isometrica: piano (u=est, v=nord) + altezza (quota).
    const iso = (u: number, v: number, altN: number) => {
      const isoX = u - v;
      const isoY = (u + v) * 0.5;
      return { x: originX + isoX * SX, y: originY + isoY * GROUND_SY - altN * ELEV_H };
    };

    const top = distinct.map((p, i) => iso(normX(p), normZ(p), useElevation ? ((alts[i] ?? altMin) - altMin) / altSpan : 0));
    const ground = distinct.map((p) => iso(normX(p), normZ(p), 0));

    let totalMeters = 0;
    for (let i = 1; i < distinct.length; i += 1) totalMeters += haversineMeters(distinct[i - 1]!, distinct[i]!);

    return {
      distinct,
      top,
      ground,
      alts,
      altMin,
      altSpan,
      useElevation,
      totalMeters,
      elevGain: altMax - altMin,
      isMarkerOnly: distinct.length === 1,
      iso,
      originX,
    };
  }, [points, height]);

  if (!model) return null;

  const { isMarkerOnly } = model;

  if (isMarkerOnly) {
    const p = model.ground[0]!;
    return (
      <svg
        viewBox={`0 0 ${VIEW_W} ${height}`}
        className={cn("w-full rounded-2xl border border-white/10 bg-black/80", className)}
        role="img"
        aria-label={t("startPointLabel")}
      >
        <defs>
          <radialGradient id="markerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#34d399" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle cx={p.x} cy={p.y} r={28} fill="url(#markerGlow)" />
        <circle cx={p.x} cy={p.y} r={6} fill="#34d399" />
        <text x={p.x + 12} y={p.y + 4} fontSize={11} fontFamily="ui-monospace, monospace" fill="#a1a1aa">
          start
        </text>
      </svg>
    );
  }

  const { top, ground, alts, altMin, altSpan, useElevation, totalMeters, elevGain, iso, originX } = model;

  // Griglia del piano-terra (diamante iso + linee interne).
  const gridN = 6;
  const gridLines: string[] = [];
  for (let i = 0; i <= gridN; i += 1) {
    const s = i / gridN;
    const a = iso(s, 0, 0);
    const b = iso(s, 1, 0);
    gridLines.push(`M${a.x.toFixed(1)},${a.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)}`);
    const c = iso(0, s, 0);
    const d = iso(1, s, 0);
    gridLines.push(`M${c.x.toFixed(1)},${c.y.toFixed(1)} L${d.x.toFixed(1)},${d.y.toFixed(1)}`);
  }

  const groundPath = ground.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  // Tenda altimetrica: dal percorso in quota giù al piano-terra.
  const curtain =
    `${top.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} ` +
    `${[...ground].reverse().map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}`;

  const start = top[0]!;
  const end = top[top.length - 1]!;
  const startGround = ground[0]!;
  const endGround = ground[ground.length - 1]!;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      className={cn("w-full rounded-2xl border border-white/10 bg-black/80", className)}
      role="img"
      aria-label={t("trackLabel", { count: top.length })}
    >
      <defs>
        <linearGradient id="routeStroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f0abfc" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#fb923c" />
        </linearGradient>
        <linearGradient id="curtainFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.28} />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.02} />
        </linearGradient>
        <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Piano-terra a griglia */}
      <path d={gridLines.join(" ")} stroke="rgba(255,255,255,0.06)" strokeWidth={1} fill="none" />

      {/* Ombra del percorso sul terreno */}
      <polyline points={groundPath} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />

      {/* Tenda altimetrica (solo con quota) */}
      {useElevation ? <polygon points={curtain} fill="url(#curtainFill)" /> : null}

      {/* Pali verticali start/end (aggancio a terra) */}
      <line x1={start.x} y1={start.y} x2={startGround.x} y2={startGround.y} stroke="#34d399" strokeWidth={1} strokeDasharray="2 2" opacity={0.7} />
      <line x1={end.x} y1={end.y} x2={endGround.x} y2={endGround.y} stroke="#f87171" strokeWidth={1} strokeDasharray="2 2" opacity={0.7} />

      {/* Percorso in quota (colorato per elevazione se disponibile) */}
      {useElevation ? (
        <g filter="url(#routeGlow)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none">
          {top.slice(1).map((p, i) => {
            const prev = top[i]!;
            const a0 = alts[i];
            const a1 = alts[i + 1];
            const mid = a0 != null && a1 != null ? (a0 + a1) / 2 : (a0 ?? a1 ?? altMin);
            return (
              <line key={i} x1={prev.x.toFixed(1)} y1={prev.y.toFixed(1)} x2={p.x.toFixed(1)} y2={p.y.toFixed(1)} stroke={elevationColor((mid - altMin) / altSpan)} />
            );
          })}
        </g>
      ) : (
        <polyline
          points={top.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke="url(#routeStroke)"
          strokeWidth={2.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#routeGlow)"
        />
      )}

      {/* START / END */}
      <circle cx={start.x} cy={start.y} r={5.5} fill="#34d399" stroke="#0a0a0a" strokeWidth={1.5} />
      <text x={start.x - 9} y={start.y - 7} fontSize={10} fontFamily="ui-monospace, monospace" fill="#34d399" fontWeight={700} textAnchor="end">
        START
      </text>
      <circle cx={end.x} cy={end.y} r={5.5} fill="#f87171" stroke="#0a0a0a" strokeWidth={1.5} />
      <text x={end.x + 9} y={end.y + 15} fontSize={10} fontFamily="ui-monospace, monospace" fill="#f87171" fontWeight={700} textAnchor="start">
        END
      </text>

      {/* Distanza + dislivello */}
      <text x={PAD} y={26} fontSize={13} fontFamily="ui-monospace, monospace" fill="#f5f5f5" fontWeight={700}>
        {formatDistance(totalMeters)}
        {useElevation ? (
          <tspan fontSize={10} fill="#71717a" fontWeight={400}>
            {"  ↑ "}
            {Math.round(elevGain)} m
          </tspan>
        ) : null}
      </text>

      {/* Indicatore 3D + nord */}
      <text x={VIEW_W - PAD} y={26} fontSize={9} fontFamily="ui-monospace, monospace" fill="#71717a" textAnchor="end">
        {useElevation ? "3D · quota" : "3D"}
      </text>
      <g transform={`translate(${originX}, ${height - 14})`}>
        <text x={0} y={0} fontSize={8} fontFamily="ui-monospace, monospace" fill="#52525b" textAnchor="middle">
          ↖ N
        </text>
      </g>
    </svg>
  );
}
