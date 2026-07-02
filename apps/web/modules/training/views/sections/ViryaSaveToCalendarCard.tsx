"use client";

import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("ViryaSaveToCalendarCard");
  const displayPlanName = planName.trim() || t("untitledPlan");
  return (
    <Pro2SectionCard
      accent="cyan"
      title={t("title")}
      subtitle={t("subtitle")}
      icon={CalendarRange}
    >
      <p className="mb-3 text-sm text-slate-300">
        {t.rich("planLine", {
          name: displayPlanName,
          tag: viryaPlanTag(planName),
          strong: (chunks) => <strong className="text-white">{chunks}</strong>,
          warn: (chunks) => <strong className="text-amber-200">{chunks}</strong>,
          code: (chunks) => (
            <code className="rounded bg-black/40 px-1 text-cyan-200">{chunks}</code>
          ),
        })}
      </p>
      <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-white/20 bg-black/40"
          checked={replacePrevious}
          onChange={(e) => setReplacePrevious(e.target.checked)}
        />
        <span>
          {t.rich("replaceLabel", {
            code: (chunks) => (
              <code className="rounded bg-black/40 px-1">{chunks}</code>
            ),
          })}
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
              ? t("titleSelectAthlete")
              : phases.length === 0
                ? t("titleAddPhases")
                : undefined
          }
        >
          {saving ? t("generating") : t("generateButton")}
        </button>
        <Link
          href="/training/calendar"
          className="text-sm font-semibold text-cyan-300 underline decoration-cyan-500/40 hover:text-cyan-200"
        >
          {t("openCalendar")}
        </Link>
      </div>
    </Pro2SectionCard>
  );
}
