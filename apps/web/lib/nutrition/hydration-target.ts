/**
 * Target idratazione giornaliero — STESSA formula della card «Quanto bere oggi» di Nutrizione
 * (NutritionPageView `hydrationPlan`): base = max(2200, peso×33) × floorMul; extra allenamento =
 * max(600, ore×fluidRate) quando c'è una seduta. Fonte condivisa così Oggi e Nutrizione mostrano
 * lo stesso numero (prima Oggi usava peso×35 → valore diverso).
 */
export function computeDailyHydrationTargetMl(input: {
  weightKg: number | null;
  sessionDurationMin?: number;
  fluidMlPerHour?: number;
  floorMultiplier?: number;
}): { baseMl: number; trainingMl: number; totalMl: number } {
  const floorMul = input.floorMultiplier && input.floorMultiplier > 0 ? input.floorMultiplier : 1;
  const baseMl = Math.round(Math.max(2200, (input.weightKg ?? 0) * 33) * floorMul);
  const dur = Math.max(0, input.sessionDurationMin ?? 0);
  const rate = input.fluidMlPerHour && input.fluidMlPerHour > 0 ? input.fluidMlPerHour : 650;
  const trainingMl = dur > 0 ? Math.max(600, Math.round((dur / 60) * rate)) : 0;
  return { baseMl, trainingMl, totalMl: baseMl + trainingMl };
}
