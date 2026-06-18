"use client";

import { CheckCircle2 } from "lucide-react";
import { DashboardSparkline } from "@/components/dashboard/DashboardSparkline";

type DashboardSystemStatusProps = {
  pct: number | null;
  label?: string | null;
  trend?: number[];
};

export function DashboardSystemStatus({ pct, label, trend = [] }: DashboardSystemStatusProps) {
  const value = pct == null ? null : Math.max(0, Math.min(100, pct));

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
      <div className="shrink-0">
        <div className="text-[0.6rem] uppercase tracking-wider text-gray-500">Human System Status</div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-emerald-400">{value ?? "—"}%</span>
          {label ? <span className="text-sm font-medium capitalize text-emerald-300">{label}</span> : null}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <DashboardSparkline values={trend} color="#34d399" height={28} showArea />
      </div>
      <div className="shrink-0">
        <CheckCircle2 className="h-6 w-6 text-emerald-400" aria-hidden />
      </div>
    </div>
  );
}
