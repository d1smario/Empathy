"use client";

import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { viryaPlanTag } from "@/lib/training/virya/virya-plan-name";
import { PhasePlan } from "@/lib/training/virya/virya-annual-plan-kit";

/**
 * Card "Salva sul Calendar" del render di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Render-only: stato/handler nel padre,
 * passati via props. JSX verbatim.
 */
export type ViryaSaveToCalendarCardProps = {
  planName: string;
  replacePrevious: boolean;
  setReplacePrevious: Dispatch<SetStateAction<boolean>>;
  generateOnCalendar: () => Promise<void>;
  saving: boolean;
  selectedAthleteId: string | null;
  phases: PhasePlan[];
};

export function ViryaSaveToCalendarCard({
  planName,
  replacePrevious,
  setReplacePrevious,
  generateOnCalendar,
  saving,
  selectedAthleteId,
  phases,
}: ViryaSaveToCalendarCardProps) {
  return (
    <Pro2SectionCard
      accent="cyan"
      title="Save to Calendar"
      subtitle="Bulk-save the plan's sessions to the Calendar"
      icon={CalendarRange}
    >
      <p className="mb-3 text-sm text-slate-300">
        Plan <strong className="text-white">«{planName.trim() || "Untitled"}»</strong> · tag{" "}
        <code className="rounded bg-black/40 px-1 text-cyan-200">{viryaPlanTag(planName)}</code>.{" "}
        <strong className="text-amber-200">
          Configuring May–Jun in VIRYA does not write to the Calendar: this button is required.
        </strong>{" "}
        After success, open Calendar on the indicated dates (e.g. May–June).
      </p>
      <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-white/20 bg-black/40"
          checked={replacePrevious}
          onChange={(e) => setReplacePrevious(e.target.checked)}
        />
        <span>
          Replace VIRYA sessions already saved in the same date range as the plan (marker{" "}
          <code className="rounded bg-black/40 px-1">[VIRYA:…]</code> in the notes)
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-xl border border-cyan-500/50 bg-cyan-500/20 px-5 py-3 text-sm font-semibold text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.12)] hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void generateOnCalendar()}
          disabled={saving || !selectedAthleteId || phases.length === 0}
          title={
            !selectedAthleteId
              ? "Select / load athlete context"
              : phases.length === 0
                ? "Add phases (step 4) before generating"
                : undefined
          }
        >
          {saving ? "Generating…" : "Generate annual plan on Calendar"}
        </button>
        <Link
          href="/training/calendar"
          className="text-sm font-semibold text-cyan-300 underline decoration-cyan-500/40 hover:text-cyan-200"
        >
          Open Calendar →
        </Link>
      </div>
    </Pro2SectionCard>
  );
}
