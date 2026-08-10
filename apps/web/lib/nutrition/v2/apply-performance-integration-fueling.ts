import type { DailyNutritionRequirementsV2 } from "@empathy/contracts";
import type { NutritionPerformanceIntegrationDials } from "@/lib/nutrition/performance-integration-scaler";
import {
  ABSOLUTE_MAX_CHO_G_PER_HOUR,
  capChoGPerHour,
  capChoGramsForDuration,
} from "@/lib/nutrition/v2/fueling-from-substrates";

function round(n: number, d = 1): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Performance integration modula solo composizione fueling (CHO/h), non fabbisogno totale.
 */
export function applyPerformanceIntegrationToSubstrateFueling(
  requirements: DailyNutritionRequirementsV2,
  integration: NutritionPerformanceIntegrationDials,
): DailyNutritionRequirementsV2 {
  const sf = requirements.substrateFueling;
  if (!sf?.sessions.length) return requirements;

  const scale = integration.fuelingChoScale ?? 1;
  if (scale === 1) {
    return {
      ...requirements,
      provenance: [
        ...requirements.provenance,
        `Integrazione performance: CHO/h fueling ×${scale} (informativo recovery/bio).`,
        ...integration.rationale.slice(0, 3),
      ],
    };
  }

  /**
   * GUARDIA ASSOLUTA anche qui: la scala performance moltiplica i grammi DOPO la banda
   * di assorbimento, quindi è l'ultimo punto in cui un valore potrebbe sfondare il tetto.
   * Oggi la banda arriva a 160 g/h e la scala max è 1,12 → 179 g/h: la rete non morde,
   * ed è voluto (vedi `ABSOLUTE_MAX_CHO_G_PER_HOUR`).
   */
  const sessions = sf.sessions.map((s) => {
    const intraChoG = round(capChoGramsForDuration(s.intraChoG * scale, s.durationH));
    const intraChoGPerH = s.durationH > 0 ? round(capChoGPerHour(intraChoG / s.durationH)) : 0;
    return {
      ...s,
      intraChoG,
      intraChoGPerH,
    };
  });

  const intraChoG = round(sessions.reduce((sum, x) => sum + x.intraChoG, 0));
  const fuelingKcal = Math.round(sf.totals.preChoG * 4 + intraChoG * 4 + sf.totals.postChoG * 4);
  const mealsKcal = Math.max(800, Math.round(requirements.energy.dailyKcal - fuelingKcal));

  return {
    ...requirements,
    energy: {
      ...requirements.energy,
      mealsKcal,
      fuelingKcal,
    },
    substrateFueling: {
      ...sf,
      sessions,
      totals: {
        ...sf.totals,
        intraChoG,
        fuelingKcal,
      },
    },
    provenance: [
      ...requirements.provenance,
      `Integrazione performance: intra CHO scalato ×${scale} (cap evidence in composer fueling, guardia assoluta ${ABSOLUTE_MAX_CHO_G_PER_HOUR} g/h).`,
      ...integration.rationale.slice(0, 3),
    ],
  };
}
