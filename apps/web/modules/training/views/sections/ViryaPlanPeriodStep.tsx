"use client";

import type { Dispatch, SetStateAction } from "react";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { cn } from "@/lib/cn";

/**
 * Card "3 · Periodo del piano" del render di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Render-only: stato/handler nel padre,
 * passati via props. JSX verbatim.
 */
export type ViryaPlanPeriodStepProps = {
  planWindowStart: string;
  setPlanWindowStart: Dispatch<SetStateAction<string>>;
  planWindowEnd: string;
  setPlanWindowEnd: Dispatch<SetStateAction<string>>;
  planWindowWeekCount: number;
  applyPlanWindowPreset: (weeks: number) => void;
  applyPlanPeriod: () => boolean;
  setViryaStep: Dispatch<SetStateAction<1 | 2 | 3 | 4 | 5>>;
};

export function ViryaPlanPeriodStep({
  planWindowStart,
  setPlanWindowStart,
  planWindowEnd,
  setPlanWindowEnd,
  planWindowWeekCount,
  applyPlanWindowPreset,
  applyPlanPeriod,
  setViryaStep,
}: ViryaPlanPeriodStepProps) {
  return (
    <Pro2SectionCard
      accent="amber"
      title="3 · Plan period"
      subtitle="Seasonal interval; in the next step key goal, events and macro-phases"
      icon={CalendarRange}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
            Start date
          </span>
          <input
            type="date"
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white"
            value={planWindowStart}
            onChange={(e) => setPlanWindowStart(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
            End date
          </span>
          <input
            type="date"
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white"
            value={planWindowEnd}
            onChange={(e) => setPlanWindowEnd(e.target.value)}
          />
        </label>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <span className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Duration preset</span>
        <div className="flex flex-wrap gap-2">
          {[
            { w: 12, label: "12 weeks" },
            { w: 24, label: "24 weeks" },
            { w: 52, label: "52 weeks (annual)" },
          ].map((p) => (
            <button
              key={p.w}
              type="button"
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-medium transition",
                planWindowWeekCount === p.w
                  ? "border-amber-400/60 bg-amber-500/20 text-amber-50"
                  : "border-white/15 bg-white/5 text-slate-300 hover:border-amber-400/45 hover:bg-amber-500/10",
              )}
              onClick={() => applyPlanWindowPreset(p.w)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-500/20"
          onClick={applyPlanPeriod}
        >
          Apply period to phases
        </button>
        <span className="text-xs text-slate-500">
          Active duration:{" "}
          <span className="font-mono font-semibold text-amber-100">
            {planWindowWeekCount > 0 ? `${planWindowWeekCount} wk` : "—"}
          </span>
          . Presets, dates or «Continue» instantly realign phases and the weekly grid (base · build · taper · peak).
        </span>
      </div>
      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5"
          onClick={() => setViryaStep(2)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> Back
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/45 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/25"
          onClick={() => {
            if (applyPlanPeriod()) setViryaStep(4);
          }}
        >
          Goal, events and phases <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </Pro2SectionCard>
  );
}
