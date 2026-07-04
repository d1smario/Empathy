"use client";

import type { ComponentProps } from "react";
import { FoodDiaryPanel } from "@/modules/nutrition/components/FoodDiaryPanel";

/**
 * Sezione "Diario alimentare" di NutritionPageView (decomposizione God-component).
 * Wrapper sottile: delega a FoodDiaryPanel, che ha già titolo e spiegazione propri
 * (il banner introduttivo duplicato è stato rimosso — feedback utente 2026-07).
 * I props sono tipizzati dai props reali di FoodDiaryPanel (Pick) e inoltrati con
 * spread → type-safe per costruzione. NB: il flusso dati è inverso —
 * onComplianceRowsChange popola diaryMacroRows nel padre (letto dalle derive
 * meal-plan), quindi quello stato resta nel padre; qui passa solo il callback.
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
      <FoodDiaryPanel {...props} />
    </section>
  );
}
