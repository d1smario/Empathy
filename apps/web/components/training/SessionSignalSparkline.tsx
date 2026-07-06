"use client";

import { useId, useMemo } from "react";

/**
 * Mini-curva (sparkline) di un canale seduta: la serie HD reale disegnata come
 * micro-grafico, non un valore scalare. Stretch a tutta larghezza (preserveAspectRatio
 * none + tratto non-scaling), riempimento a gradiente sotto la linea.
 */
export function SessionSignalSparkline({
  values,
  color,
  height = 40,
}: {
  values: number[];
  color: string;
  height?: number;
}) {
  const gid = useId().replace(/:/g, "");
  const geo = useMemo(() => {
    const W = 300;
    const H = height;
    const pad = 3;
    const clean = values.filter((v) => Number.isFinite(v));
    if (clean.length < 2) return null;
    const N = Math.min(clean.length, 120);
    const step = clean.length / N;
    const sampled = Array.from({ length: N }, (_, i) => clean[Math.min(clean.length - 1, Math.round(i * step))]!);
    const min = Math.min(...sampled);
    const max = Math.max(...sampled);
    const range = max - min || 1;
    const pts = sampled.map((v, i) => {
      const x = (i / (N - 1)) * (W - pad * 2) + pad;
      const y = H - pad - ((v - min) / range) * (H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const line = pts.join(" ");
    const area = `${pts.join(" ")} ${(W - pad).toFixed(1)},${H} ${pad.toFixed(1)},${H}`;
    return { line, area, W, H };
  }, [values, height]);

  if (!geo) return null;

  return (
    <svg
      viewBox={`0 0 ${geo.W} ${geo.H}`}
      preserveAspectRatio="none"
      className="mt-2 w-full"
      style={{ height: `${geo.H}px` }}
      role="img"
      aria-hidden
    >
      <defs>
        <linearGradient id={`spk-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={geo.area} fill={`url(#spk-${gid})`} />
      <polyline
        points={geo.line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
