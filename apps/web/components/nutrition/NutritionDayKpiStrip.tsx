"use client";

import type { LucideIcon } from "lucide-react";
import { Drumstick, Droplets, Flame, Wheat } from "lucide-react";

function KpiCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  unit: string;
  hint?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/[0.12] via-black/60 to-black/85 p-4 shadow-inner">
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{label}</p>
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-amber-400/45 bg-amber-500/35 text-amber-50"
            aria-hidden
          >
            <Icon className="h-5 w-5" strokeWidth={2.35} />
          </div>
        </div>
        <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-50">
          {value}
          <span className="ml-1 text-xs font-medium text-gray-500">{unit}</span>
        </p>
        {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
      </div>
    </div>
  );
}

export type NutritionDayKpiTargets = {
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
};

type NutritionDayKpiStripProps = {
  targets: NutritionDayKpiTargets;
  dateLabel?: string;
};

/**
 * KPI giornalieri principali (stesso linguaggio visivo dei KpiCard del Builder training).
 */
export function NutritionDayKpiStrip({ targets, dateLabel }: NutritionDayKpiStripProps) {
  const kcal = Math.round(targets.kcal);
  const c = Math.round(targets.carbsG);
  const p = Math.round(targets.proteinG);
  const f = Math.round(targets.fatG);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Energia giorno"
        value={`${kcal}`}
        unit="kcal"
        hint={dateLabel ? `Target · ${dateLabel}` : "Budget energetico giornaliero"}
        icon={Flame}
      />
      <KpiCard
        label="Carboidrati"
        value={`${c}`}
        unit="g"
        hint="CHO totale"
        icon={Wheat}
      />
      <KpiCard
        label="Proteine"
        value={`${p}`}
        unit="g"
        hint="PRO totale"
        icon={Drumstick}
      />
      <KpiCard
        label="Grassi"
        value={`${f}`}
        unit="g"
        hint="Lipidi totali"
        icon={Droplets}
      />
    </div>
  );
}
