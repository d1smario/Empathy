"use client";

import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import {
  deleteViryaCalendarPlan,
  type ViryaCalendarPlanSummary,
} from "@/modules/training/services/training-planned-api";

/**
 * Card "Piani VIRYA su Calendar" del render di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Render-only: stato/handler nel padre,
 * passati via props. JSX verbatim.
 */
export type ViryaCalendarPlansCardProps = {
  viryaPlansLoading: boolean;
  viryaCalendarPlans: ViryaCalendarPlanSummary[];
  viryaPlanDeletingTag: string | null;
  selectedAthleteId: string | null;
  setViryaPlanDeletingTag: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setSuccess: Dispatch<SetStateAction<string | null>>;
  refreshViryaCalendarPlans: () => Promise<void>;
};

export function ViryaCalendarPlansCard({
  viryaPlansLoading,
  viryaCalendarPlans,
  viryaPlanDeletingTag,
  selectedAthleteId,
  setViryaPlanDeletingTag,
  setError,
  setSuccess,
  refreshViryaCalendarPlans,
}: ViryaCalendarPlansCardProps) {
  return (
    <Pro2SectionCard
      accent="cyan"
      className="!border-cyan-500/30"
      title="VIRYA Plans on Calendar"
      subtitle="Sessions tagged [VIRYA:…] for the active athlete — delete an entire plan before republishing"
      icon={CalendarRange}
    >
      {viryaPlansLoading ? (
        <p className="text-sm text-slate-400">Loading plans…</p>
      ) : viryaCalendarPlans.length === 0 ? (
        <p className="text-sm text-slate-500">No VIRYA plan in Calendar for this athlete.</p>
      ) : (
        <ul className="space-y-2">
          {viryaCalendarPlans.map((plan) => (
            <li
              key={plan.tag}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
            >
              <div>
                <span className="font-semibold text-white">{plan.planName}</span>
                <span className="mt-0.5 block font-mono text-[0.7rem] text-slate-500">
                  {plan.dateMin} → {plan.dateMax} · {plan.sessionCount} sessions
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/training/calendar?date=${plan.dateMin}`}
                  className="rounded-lg border border-sky-500/35 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-200 hover:bg-sky-500/20"
                >
                  Open in Calendar
                </Link>
                <button
                  type="button"
                  className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
                  disabled={viryaPlanDeletingTag === plan.tag}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Delete all ${plan.sessionCount} sessions of the plan «${plan.planName}» (${plan.dateMin} → ${plan.dateMax})?`,
                      )
                    ) {
                      return;
                    }
                    void (async () => {
                      if (!selectedAthleteId) return;
                      setViryaPlanDeletingTag(plan.tag);
                      setError(null);
                      try {
                        const n = await deleteViryaCalendarPlan({ athleteId: selectedAthleteId, tag: plan.tag });
                        setSuccess(`Plan «${plan.planName}» removed: ${n} sessions deleted.`);
                        await refreshViryaCalendarPlans();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Plan deletion failed.");
                      } finally {
                        setViryaPlanDeletingTag(null);
                      }
                    })();
                  }}
                >
                  {viryaPlanDeletingTag === plan.tag ? "Deleting…" : "Delete plan"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="mt-3 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
        onClick={() => void refreshViryaCalendarPlans()}
      >
        Refresh list
      </button>
    </Pro2SectionCard>
  );
}
