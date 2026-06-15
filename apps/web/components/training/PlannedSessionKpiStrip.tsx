"use client";

import type { PlannedSessionMetrics } from "@/lib/training/physiology/planned-session-metrics";

function formatDurationMin(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "—";
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.round(min)}m`;
}

export function PlannedSessionKpiStrip({
  metrics,
  compact = false,
}: {
  metrics: PlannedSessionMetrics;
  compact?: boolean;
}) {
  const gridClass = compact
    ? "grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
    : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";

  return (
    <div className={gridClass}>
      <div className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.08] px-4 py-3">
        <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Durata</div>
        <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-orange-50">{formatDurationMin(metrics.durationMinutes)}</div>
      </div>
      <div className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.08] px-4 py-3">
        <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Carico · TSS</div>
        <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-orange-50">{metrics.tss > 0 ? metrics.tss.toFixed(0) : "—"}</div>
      </div>
      <div className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.08] px-4 py-3">
        <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">kJ · meccanico</div>
        <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-orange-50">{metrics.kj > 0 ? metrics.kj.toFixed(0) : "—"}</div>
      </div>
      <div className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.08] px-4 py-3">
        <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Kcal · metabolico</div>
        <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-orange-50">{metrics.kcal > 0 ? metrics.kcal.toFixed(0) : "—"}</div>
      </div>
      <div className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.08] px-4 py-3">
        <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Pavg</div>
        <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-orange-50">
          {metrics.avgPowerW != null && metrics.avgPowerW > 0 ? metrics.avgPowerW : "—"}
          {metrics.avgPowerW != null && metrics.avgPowerW > 0 ? (
            <span className="ml-1 text-xs font-medium text-gray-500">W</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
