"use client";

import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Layers } from "lucide-react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { cn } from "@/lib/cn";
import {
  sportFamilies,
  type MultiSportTarget,
  type SportFamily,
} from "@/lib/training/virya/virya-annual-plan-kit";

/**
 * Card "1 · Macro famiglia" del render di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Render-only: stato/handler nel padre,
 * passati via props. JSX verbatim.
 */
export type ViryaMacroFamilyStepProps = {
  sportFamily: SportFamily;
  setSportFamily: Dispatch<SetStateAction<SportFamily>>;
  setDiscipline: Dispatch<SetStateAction<string>>;
  setSportTargetValue: (index: number, key: keyof MultiSportTarget, value: string) => void;
  setViryaStep: Dispatch<SetStateAction<1 | 2 | 3 | 4 | 5>>;
};

export function ViryaMacroFamilyStep({
  sportFamily,
  setSportFamily,
  setDiscipline,
  setSportTargetValue,
  setViryaStep,
}: ViryaMacroFamilyStepProps) {
  const t = useTranslations("ViryaMacroFamilyStep");
  return (
    <Pro2SectionCard
      accent="violet"
      title={t("cardTitle")}
      subtitle={t("cardSubtitle")}
      icon={Layers}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {sportFamilies.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setSportFamily(f.id);
              setDiscipline(f.sports[0]);
              setSportTargetValue(0, "sport", f.sports[0]);
              if (f.id === "strength") setDiscipline("Gym");
            }}
            className={cn(
              "flex flex-col gap-2 rounded-2xl border p-4 text-left transition",
              sportFamily === f.id
                ? "border-cyan-400/55 bg-cyan-500/10 shadow-[0_0_24px_rgba(34,211,238,0.12)]"
                : "border-white/10 bg-black/35 hover:border-white/25",
            )}
          >
            <span className="text-2xl" aria-hidden>
              {f.id === "aerobic" ? "⚡" : f.id === "strength" ? "🏋️" : f.id === "technical" ? "🎯" : "🧘"}
            </span>
            <span className="text-sm font-semibold text-white">{f.label}</span>
            <span className="text-xs text-slate-500">
              {f.sports.slice(0, 5).join(", ")}
              {f.sports.length > 5 ? "…" : ""}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/45 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/25"
          onClick={() => setViryaStep(2)}
        >
          {t("continue")} <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </Pro2SectionCard>
  );
}
