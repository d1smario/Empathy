"use client";

import { CalendarRange } from "lucide-react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";

/**
 * Card "Macro-periodi di preparazione" del render di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Render-only: stato/handler nel padre,
 * passati via props. JSX verbatim.
 */
export type ViryaMacroPeriodsCardProps = {
  planWindowStart: string;
  planWindowEnd: string;
  applyClassicPeriodization: () => void;
};

export function ViryaMacroPeriodsCard({
  planWindowStart,
  planWindowEnd,
  applyClassicPeriodization,
}: ViryaMacroPeriodsCardProps) {
  return (
    <Pro2SectionCard
      accent="violet"
      title="Preparation macro-periods"
      subtitle="Base, build, taper, peak — four phases over the duration chosen in step 3"
      icon={CalendarRange}
    >
      <p className="mb-3 text-xs text-slate-400">
        The template splits the window <span className="font-mono text-slate-300">{planWindowStart}</span> →{" "}
        <span className="font-mono text-slate-300">{planWindowEnd}</span> into four coherent blocks. You can
        fine-tune dates and TSS in the next step (phase table and weekly grid).
      </p>
      <button
        type="button"
        className="rounded-xl border border-violet-500/45 bg-violet-500/15 px-4 py-2.5 text-sm font-semibold text-violet-100 hover:bg-violet-500/25"
        onClick={applyClassicPeriodization}
      >
        Generate classic phases (base · build · taper · peak)
      </button>
      <p className="mt-2 text-[0.7rem] text-slate-500">
        Overwrites the current phase list and clears weekly customizations until you reset them in step 5.
      </p>
    </Pro2SectionCard>
  );
}
