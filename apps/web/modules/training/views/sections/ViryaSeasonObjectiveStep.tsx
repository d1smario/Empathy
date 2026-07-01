"use client";

import type { Dispatch, SetStateAction } from "react";
import { Target } from "lucide-react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";

/**
 * Card "4 · Obiettivo cardine" del render di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Render-only: stato/handler nel padre,
 * passati via props. JSX verbatim.
 */
export type ViryaSeasonObjectiveStepProps = {
  objective: string;
  setObjective: Dispatch<SetStateAction<string>>;
};

export function ViryaSeasonObjectiveStep({
  objective,
  setObjective,
}: ViryaSeasonObjectiveStepProps) {
  return (
    <Pro2SectionCard
      accent="rose"
      title="4 · Key objective"
      subtitle="The reason for the season — drives hints, plan copy and calendar notes"
      icon={Target}
    >
      <label className="block">
        <span className="mb-2 block text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
          Key objective
        </span>
        <textarea
          className="min-h-[100px] w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-slate-600"
          rows={4}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="E.g. double peak on races X/Y, threshold and VO2, lactate management for 40k…"
        />
      </label>
    </Pro2SectionCard>
  );
}
