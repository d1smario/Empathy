"use client";

import { CalendarRange } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("ViryaMacroPeriodsCard");
  return (
    <Pro2SectionCard
      accent="violet"
      title={t("title")}
      subtitle={t("subtitle")}
      icon={CalendarRange}
    >
      <p className="mb-3 text-xs text-slate-400">
        {t.rich("windowDescription", {
          start: planWindowStart,
          end: planWindowEnd,
          mono: (chunks) => <span className="font-mono text-slate-300">{chunks}</span>,
        })}
      </p>
      <button
        type="button"
        className="rounded-xl border border-violet-500/45 bg-violet-500/15 px-4 py-2.5 text-sm font-semibold text-violet-100 hover:bg-violet-500/25"
        onClick={applyClassicPeriodization}
      >
        {t("generateClassicPhases")}
      </button>
      <p className="mt-2 text-[0.7rem] text-slate-500">
        {t("overwriteWarning")}
      </p>
    </Pro2SectionCard>
  );
}
