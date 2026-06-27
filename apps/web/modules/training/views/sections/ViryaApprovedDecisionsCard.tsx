"use client";

import type { Dispatch, SetStateAction } from "react";
import { LineChart } from "lucide-react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import type { ApprovedApplicationPatch } from "@/lib/dashboard/resolve-operational-signals-bundle";
import type { ViryaRetuneProposalVm } from "@/lib/training/virya-retune-proposal";
import { ViryaRetuneProposal } from "@/lib/training/virya/virya-annual-plan-kit";

type ViryaRetuneDirective = {
  recommendedMode: string;
  appliedCount: number;
  pendingCount: number;
  builderPolicy: "single_session_materialization_only";
  calendarPolicy: "coach_validated_retune_before_replace";
  rationale: string[];
};

/**
 * Card "Decisioni approvate · input VIRYA" del render di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Render-only: stato/handler nel padre,
 * passati via props. JSX verbatim.
 */
export type ViryaApprovedDecisionsCardProps = {
  viryaApprovedPatches: ApprovedApplicationPatch[];
  viryaRetuneDirective: ViryaRetuneDirective | null;
  viryaRetuneProposalVm: ViryaRetuneProposalVm | null;
  viryaRetuneProposal: ViryaRetuneProposal | null;
  adaptationControlPct: 0 | 50 | 70 | 100;
  setAdaptationControlPct: Dispatch<SetStateAction<0 | 50 | 70 | 100>>;
};

export function ViryaApprovedDecisionsCard({
  viryaApprovedPatches,
  viryaRetuneDirective,
  viryaRetuneProposalVm,
  viryaRetuneProposal,
  adaptationControlPct,
  setAdaptationControlPct,
}: ViryaApprovedDecisionsCardProps) {
  return (
    <Pro2SectionCard
      accent="cyan"
      title="Decisioni approvate · input VIRYA"
      subtitle="Patch validate dalla Reasoning Dashboard: influenzano il retune, ma la sessione resta materializzata dal Builder."
      icon={LineChart}
    >
      {viryaRetuneDirective ? (
        <div className="mb-3 rounded-xl border border-cyan-500/25 bg-cyan-950/10 p-3">
          <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-cyan-200/80">
            Retune directive · {viryaRetuneDirective.recommendedMode.replaceAll("_", " ")}
          </div>
          <div className="mt-2 grid gap-2 text-xs text-slate-300 md:grid-cols-3">
            <div>Applied {viryaRetuneDirective.appliedCount}</div>
            <div>Pending {viryaRetuneDirective.pendingCount}</div>
            <div>Builder: single-session only</div>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-slate-400">
            {viryaRetuneDirective.rationale.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {viryaRetuneProposalVm ? (
        <div className="mb-3 rounded-xl border border-violet-500/25 bg-violet-950/10 p-3">
          <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-violet-200/80">
            Proposta retune server (strutturata)
          </div>
          <div className="mt-2 grid gap-2 text-xs text-slate-300 md:grid-cols-3">
            <div>Mode {viryaRetuneProposalVm.recommendedMode.replaceAll("_", " ")}</div>
            <div>Load ×{viryaRetuneProposalVm.loadScaleSuggestion.toFixed(2)}</div>
            <div>Session Δ {viryaRetuneProposalVm.sessionDeltaSuggestion}</div>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-slate-400">
            {viryaRetuneProposalVm.rationaleLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {viryaRetuneProposalVm.linkedCoachTraceIds.length ? (
            <p className="mt-2 font-mono text-[0.62rem] text-slate-600">
              Coach traces: {viryaRetuneProposalVm.linkedCoachTraceIds.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
      {viryaRetuneProposal?.targetWeeks.length ? (
        <div className="mb-3 rounded-xl border border-amber-500/25 bg-amber-950/10 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-amber-200/80">
                Adattamento automatico microciclo · {viryaRetuneProposal.mode.replaceAll("_", " ")}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Se il recupero e&apos; inefficiente, VIRYA adatta automaticamente il programma secondo la percentuale coach. Calendar viene scritto solo quando salvi.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-2">
              <div className="mb-2 text-[0.62rem] font-bold uppercase tracking-wider text-slate-500">
                Coach adaptation control
              </div>
              <div className="flex flex-wrap gap-1.5">
                {([0, 50, 70, 100] as const).map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setAdaptationControlPct(pct)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                      adaptationControlPct === pct
                        ? "border-amber-300 bg-amber-400/25 text-amber-50"
                        : "border-white/10 bg-black/35 text-slate-300 hover:border-amber-300/45"
                    }`}
                  >
                    {pct === 0 ? "Mantieni piano" : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {viryaRetuneProposal.targetWeeks.map((week) => (
              <div key={week.weekStart} className="rounded-lg border border-white/10 bg-black/30 p-2">
                <div className="font-mono text-[0.62rem] text-slate-500">
                  Week {week.week} · {week.weekStart} · {week.phase}
                </div>
                <div className="mt-1 text-sm font-semibold text-white">
                  TSS {week.currentTss} → {week.proposedTss} · sedute {week.currentSessions} → {week.proposedSessions}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Focus: {week.objectives.length ? week.objectives.join(" · ") : "invariato"}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {viryaApprovedPatches.slice(0, 6).map((patch) => (
          <div key={patch.id} className="rounded-xl border border-cyan-500/20 bg-black/30 p-3">
            <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-cyan-200/80">
              {patch.target} · {patch.confidence != null ? `${Math.round(patch.confidence * 100)}%` : "n/d"}
            </div>
            <div className="mt-1 text-sm font-semibold text-white">{patch.action.replaceAll("_", " ")}</div>
            {typeof patch.reason === "string" && patch.reason.trim() ? (
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{patch.reason}</p>
            ) : null}
            {patch.stagingRunId ? (
              <p className="mt-2 font-mono text-[0.62rem] text-slate-600">staging: {patch.stagingRunId}</p>
            ) : null}
          </div>
        ))}
      </div>
    </Pro2SectionCard>
  );
}
