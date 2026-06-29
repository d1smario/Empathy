"use client";

import {
  Activity,
  Calendar,
  Flame,
  Heart,
  PersonStanding,
  Target,
  Weight,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { DashboardKpis } from "@/lib/dashboard/dashboard-scores";

type KpiDef = { key: keyof DashboardKpis; label: string; unit?: string; icon: LucideIcon; digits?: number };

const KPI_DEFS: KpiDef[] = [
  { key: "weightKg", label: "Peso", unit: "kg", icon: Weight, digits: 1 },
  { key: "bodyFatPct", label: "Massa Grassa", unit: "%", icon: PersonStanding, digits: 1 },
  { key: "vo2max", label: "VO₂max", unit: "ml/kg/min", icon: Activity, digits: 0 },
  { key: "ftpWatts", label: "FTP", unit: "W", icon: Zap, digits: 0 },
  { key: "lt1Watts", label: "LT1", unit: "W", icon: Zap, digits: 0 },
  { key: "lt2Watts", label: "LT2", unit: "W", icon: Flame, digits: 0 },
  { key: "vLamax", label: "VLamax", unit: "m/s", icon: Activity, digits: 2 },
  { key: "biologicalAge", label: "Biological Age", unit: "anni", icon: Calendar, digits: 1 },
  { key: "targetAge", label: "Target Age", unit: "anni", icon: Target, digits: 1 },
];

function fmt(value: number | null, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return digits > 0 ? value.toFixed(digits) : String(Math.round(value));
}

export type DashboardKpiGridProps = {
  kpis: DashboardKpis;
  columns?: 2 | 3 | 4 | 5;
};

export function DashboardKpiGrid({ kpis, columns = 3 }: DashboardKpiGridProps) {
  const gridClass = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
  }[columns];

  return (
    <div className={`grid gap-3 ${gridClass}`}>
      {KPI_DEFS.map((kpi) => {
        const Icon = kpi.icon;
        const value = fmt(kpis[kpi.key], kpi.digits);
        return (
          <div
            key={kpi.key}
            className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5 transition hover:border-white/15 min-w-0"
          >
            <div className="flex items-center gap-1.5 text-[0.55rem] uppercase tracking-wider text-gray-500 min-w-0 [overflow-wrap:anywhere]">
              <Icon className="h-3 w-3 shrink-0" aria-hidden />
              {kpi.label}
            </div>
            <div className="mt-1 flex flex-wrap items-baseline text-lg font-bold tabular-nums text-white [overflow-wrap:anywhere]">
              {value}
              {value !== "—" && kpi.unit ? <span className="ml-1 text-xs font-medium text-gray-500">{kpi.unit}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
