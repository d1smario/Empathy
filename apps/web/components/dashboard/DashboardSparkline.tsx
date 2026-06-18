"use client";

type DashboardSparklineProps = {
  values: number[];
  color: string;
  width?: number;
  height?: number;
  showArea?: boolean;
  showDots?: boolean;
  className?: string;
};

export function DashboardSparkline({
  values,
  color,
  width = 120,
  height = 34,
  showArea = true,
  showDots = false,
  className,
}: DashboardSparklineProps) {
  const padX = 2;
  const padY = 3;

  if (!values.length) {
    const y = height / 2;
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className={className ?? "h-8 w-full"} preserveAspectRatio="none" aria-hidden>
        <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="rgba(148,163,184,0.2)" strokeWidth={1.5} strokeDasharray="3 4" />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values.map((v, i) => {
    const x = padX + (values.length === 1 ? (width - padX * 2) / 2 : (i / (values.length - 1)) * (width - padX * 2));
    const y = height - padY - ((v - min) / span) * (height - padY * 2);
    return { x, y };
  });

  const linePoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPoints = `${points[0].x.toFixed(1)},${height} ${linePoints} ${points[points.length - 1].x.toFixed(1)},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className ?? "h-8 w-full"} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`sparklineGrad-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {showArea && (
        <polygon
          fill={`url(#sparklineGrad-${color.replace(/[^a-z0-9]/gi, "")})`}
          points={areaPoints}
        />
      )}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={linePoints}
      />
      {showDots &&
        points.map((p, i) => (
          <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={1.8} fill={color} />
        ))}
    </svg>
  );
}
