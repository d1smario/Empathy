"use client";

import type { ComponentProps } from "react";
import { FoodDiaryPanel } from "@/modules/nutrition/components/FoodDiaryPanel";

/**
 * Sezione "Diario alimentare" di NutritionPageView (decomposizione God-component).
 * Wrapper sottile: header + delega a FoodDiaryPanel. I props sono tipizzati dai
 * props reali di FoodDiaryPanel (Pick) e inoltrati con spread → type-safe per
 * costruzione. NB: il flusso dati è inverso — onComplianceRowsChange popola
 * diaryMacroRows nel padre (letto dalle derive meal-plan), quindi quello stato
 * resta nel padre; qui passa solo il callback.
 */
type FoodDiaryPanelProps = ComponentProps<typeof FoodDiaryPanel>;

export type DiarySectionProps = Pick<
  FoodDiaryPanelProps,
  | "athleteId"
  | "onComplianceRowsChange"
  | "planDateForSolverTargets"
  | "planDateAnchor"
  | "diaryEnergyTargetKcal"
  | "diaryMacroTargetCarbsG"
  | "diaryMacroTargetProteinG"
  | "diaryMacroTargetFatG"
  | "fallbackDailyEnergyKcal"
  | "weightKg"
  | "metabolicEfficiencyIndex"
>;

export function DiarySection(props: DiarySectionProps) {
  return (
    <section id="nutrition-diary" className="scroll-mt-28 mb-10 space-y-4">
      <header className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <h2 className="text-lg font-bold text-white">Food Diary</h2>
        <p className="mt-1 text-sm text-gray-400">Actual intake vs target — USDA catalog and adherence.</p>
      </header>
      <FoodDiaryPanel {...props} />
    </section>
  );
}
