"use client";

import type { Dispatch, SetStateAction } from "react";
import { ChevronLeft, ChevronRight, Dumbbell } from "lucide-react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { cn } from "@/lib/cn";
import {
  sportFamilies,
  sportIcon,
  type MultiSportTarget,
  type SportFamily,
} from "@/lib/training/virya/virya-annual-plan-kit";

/**
 * Card "2 · Sport e disciplina" del render di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Render-only: stato/handler nel padre,
 * passati via props. JSX verbatim.
 */
export type ViryaSportDisciplineStepProps = {
  sportFamily: SportFamily;
  familySports: string[];
  discipline: string;
  setDiscipline: Dispatch<SetStateAction<string>>;
  setSportTargetValue: (index: number, key: keyof MultiSportTarget, value: string) => void;
  setViryaStep: Dispatch<SetStateAction<1 | 2 | 3 | 4 | 5>>;
};

export function ViryaSportDisciplineStep({
  sportFamily,
  familySports,
  discipline,
  setDiscipline,
  setSportTargetValue,
  setViryaStep,
}: ViryaSportDisciplineStepProps) {
  return (
    <Pro2SectionCard
      accent="cyan"
      title="2 · Sport e disciplina"
      subtitle="Scegli la disciplina operativa coerente con la macro"
      icon={Dumbbell}
    >
      <p className="mb-3 text-xs text-slate-400">
        Macro attiva:{" "}
        <span className="font-semibold text-cyan-200">
          {sportFamilies.find((x) => x.id === sportFamily)?.label ?? sportFamily}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {familySports.map((sport) => (
          <button
            key={sport}
            type="button"
            onClick={() => {
              setDiscipline(sport);
              setSportTargetValue(0, "sport", sport);
            }}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition",
              discipline === sport
                ? "border-fuchsia-400/55 bg-fuchsia-500/15 text-fuchsia-50"
                : "border-white/15 bg-black/35 text-slate-300 hover:border-white/30",
            )}
          >
            <span aria-hidden>{sportIcon(sport)}</span>
            {sport}
          </button>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5"
          onClick={() => setViryaStep(1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> Indietro
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/45 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/25"
          onClick={() => setViryaStep(3)}
        >
          Continua <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </Pro2SectionCard>
  );
}
