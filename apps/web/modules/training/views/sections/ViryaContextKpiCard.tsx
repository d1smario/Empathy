"use client";

import { Activity } from "lucide-react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";

/**
 * Card "Contesto · KPI" del render di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Render-only: stato/handler nel padre,
 * passati via props. JSX verbatim.
 */
export type ViryaContextKpiCardProps = {
  viryaSummaryCards: Array<{ label: string; value: string; tone: "cyan" | "green" | "amber" | "rose" | "slate" }>;
};

export function ViryaContextKpiCard({
  viryaSummaryCards,
}: ViryaContextKpiCardProps) {
  return (
    <Pro2SectionCard
      accent="slate"
      title="Contesto · KPI"
      subtitle="Goal, readiness, loop adattamento (da memoria atleta)"
      icon={Activity}
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {viryaSummaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
            <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">{card.label}</div>
            <div className="mt-0.5 text-sm font-semibold text-white">{card.value}</div>
          </div>
        ))}
      </div>
    </Pro2SectionCard>
  );
}
