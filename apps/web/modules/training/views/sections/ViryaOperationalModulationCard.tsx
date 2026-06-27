"use client";

import { LineChart } from "lucide-react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import type {
  TrainingAdaptationLoopViewModel,
  TrainingBioenergeticModulationViewModel,
} from "@/api/training/contracts";
import type { RecoverySummary } from "@/lib/reality/recovery-summary";
import type { TrainingDayOperationalContext } from "@/lib/training/day-operational-context";

/**
 * Card "Modulazione operativa" del render di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Render-only: stato/handler nel padre,
 * passati via props. JSX verbatim.
 */
export type ViryaOperationalModulationCardProps = {
  operationalContext: TrainingDayOperationalContext;
  recoverySummary: RecoverySummary | null;
  bioenergeticModulation: TrainingBioenergeticModulationViewModel | null;
  adaptationLoop: TrainingAdaptationLoopViewModel | null;
};

export function ViryaOperationalModulationCard({
  operationalContext,
  recoverySummary,
  bioenergeticModulation,
  adaptationLoop,
}: ViryaOperationalModulationCardProps) {
  return (
    <Pro2SectionCard
      accent="emerald"
      title="Modulazione operativa"
      subtitle="Carico scalato, recovery, segnali bio e piano vs reale"
      icon={LineChart}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Carico</div>
          <div className="mt-1 text-lg font-semibold text-white">{operationalContext.loadScalePct}%</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Modalità</div>
          <div className="mt-1 text-sm text-slate-200">{operationalContext.headline}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Recovery</div>
          <div className="mt-1 text-sm text-slate-200">
            {recoverySummary
              ? [
                  recoverySummary.status,
                  recoverySummary.sleepDurationHours != null ? `${recoverySummary.sleepDurationHours}h` : null,
                  recoverySummary.hrvMs != null ? `HRV ${recoverySummary.hrvMs}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"
              : "—"}
          </div>
        </div>
        {bioenergeticModulation ? (
          <div className="rounded-xl border border-white/10 bg-black/30 p-3 sm:col-span-2 lg:col-span-1">
            <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Bioenergetica</div>
            <div className="mt-1 text-sm text-slate-200">
              {bioenergeticModulation.mitochondrialReadinessScore}/100 · copertura{" "}
              {bioenergeticModulation.signalCoveragePct}% · ±{bioenergeticModulation.inputUncertaintyPct}%
            </div>
          </div>
        ) : null}
        {adaptationLoop ? (
          <div className="rounded-xl border border-white/10 bg-black/30 p-3 sm:col-span-2">
            <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Piano / reale</div>
            <div className="mt-1 text-sm text-slate-200">
              {adaptationLoop.executionCompliancePct.toFixed(0)}% compliance · Δ
              {adaptationLoop.executionDeltaTss > 0 ? "+" : ""}
              {adaptationLoop.executionDeltaTss.toFixed(0)} TSS · {adaptationLoop.nextAction}
            </div>
          </div>
        ) : null}
      </div>
    </Pro2SectionCard>
  );
}
