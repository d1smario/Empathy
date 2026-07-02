"use client";

import type { Dispatch, SetStateAction } from "react";
import { Target } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("ViryaSeasonObjectiveStep");
  return (
    <Pro2SectionCard
      accent="rose"
      title={t("cardTitle")}
      subtitle={t("cardSubtitle")}
      icon={Target}
    >
      <label className="block">
        <span className="mb-2 block text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
          {t("objectiveLabel")}
        </span>
        <textarea
          className="min-h-[100px] w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-slate-600"
          rows={4}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder={t("objectivePlaceholder")}
        />
      </label>
    </Pro2SectionCard>
  );
}
