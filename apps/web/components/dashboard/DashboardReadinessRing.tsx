"use client";

function fmtScore(score: number | null): string {
  return score == null ? "—" : String(Math.round(score));
}

export type DashboardReadinessRingProps = {
  score: number | null;
  label?: string | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
};

export function DashboardReadinessRing({
  score,
  label,
  size = "md",
  showLabel = false,
  className,
}: DashboardReadinessRingProps) {
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
  const deg = (pct / 100) * 360;

  const dimensions = {
    sm: { outer: 56, inner: 44, text: "text-base" },
    md: { outer: 72, inner: 56, text: "text-2xl" },
    lg: { outer: 96, inner: 76, text: "text-3xl" },
  }[size];

  return (
    <div className={`flex flex-col items-center ${className ?? ""}`}>
      <div
        className="relative grid shrink-0 place-items-center rounded-full"
        style={{
          width: dimensions.outer,
          height: dimensions.outer,
          background: `conic-gradient(from -90deg, #a855f7 0deg, #ec4899 ${deg * 0.55}deg, #fbbf24 ${deg}deg, rgba(255,255,255,0.08) ${deg}deg 360deg)`,
        }}
        role="img"
        aria-label={`Readiness score ${fmtScore(score)}${label ? `, ${label}` : ""}`}
      >
        <div
          className="grid place-items-center rounded-full bg-black/85"
          style={{ width: dimensions.inner, height: dimensions.inner }}
        >
          <span className={`font-bold tabular-nums text-white ${dimensions.text}`}>{fmtScore(score)}</span>
        </div>
      </div>
      {showLabel && label ? (
        <div className="mt-1 text-center text-xs font-medium capitalize text-gray-300">{label}</div>
      ) : null}
    </div>
  );
}
