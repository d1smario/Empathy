/**
 * Target idratazione giornaliero — FONTE UNICA per Oggi (app/api/today) e Nutrizione
 * (NutritionPageView `hydrationPlan` → card «Quanto bere oggi»). Formula canonica:
 * base = max(2200, peso×33); extra allenamento = max(600, ore×650) SOLO se c'è una seduta
 * pianificata (trainingMl = 0 a riposo). I parametri `fluidMlPerHour`/`floorMultiplier`
 * restano opzionali per compatibilità ma le superfici NON li passano più: niente
 * moltiplicatori personalizzati, così Oggi e Nutrizione mostrano lo stesso numero.
 * Il reintegro del giorno (nutrition_daily_adjustment.extra_water_ml) si somma DOPO,
 * lato superficie, come componente esplicita sopra questo totale.
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
