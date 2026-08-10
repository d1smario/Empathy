import type {
  DailyMacroGrams,
  DailyNutritionRequirementsV2,
  EmpathyNutritionStrategyKind,
  FdcDietProfileTag,
  MacroGPerKgTemplate,
} from "@empathy/contracts";
import {
  computeNutritionDailyEnergyModel,
  normalizeLifestyleActivityClass,
} from "@/lib/nutrition/daily-energy-solver";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import { dietProfileFromAthleteDietType } from "@/lib/nutrition/v2/fdc-food-taxonomy";
import {
  computeSubstrateFuelingPlan,
  normalizeFtpW,
  normalizeWeightKg,
} from "@/lib/nutrition/v2/fueling-from-substrates";
import { substrateTotalsForSession } from "@/lib/nutrition/v2/substrate-rates";

/**
 * Lifestyle: UNA sola fonte, il solver V1 (`LIFESTYLE_PCT` dentro
 * `computeNutritionDailyEnergyModel`, moderate = +20% BMR). Il vecchio modello
 * PAL parallelo (PAL_BY_LIFESTYLE, moderate = 1.40 → +40% BMR) è stato rimosso:
 * sui giorni reali le due scale divergevano (fino a 2× sul lifestyle) e il
 * browser usa già il solver V1 — qui si allinea senza cambi visibili.
 */

export const STRATEGY_TEMPLATES: Record<EmpathyNutritionStrategyKind, MacroGPerKgTemplate> = {
  maintenance: { choMinGPerKg: 3, choMaxGPerKg: 5, proGPerKg: 1.4, fatGPerKg: 0.9 },
  load: { choMinGPerKg: 8, choMaxGPerKg: 12, proGPerKg: 1.5, fatGPerKg: 0.5 },
  deload: { choMinGPerKg: 0.5, choMaxGPerKg: 1, proGPerKg: 2.5, fatGPerKg: 1.5 },
  recovery: { choMinGPerKg: 2, choMaxGPerKg: 4, proGPerKg: 1.8, fatGPerKg: 1 },
  race: { choMinGPerKg: 7, choMaxGPerKg: 10, proGPerKg: 1.6, fatGPerKg: 0.6 },
  custom: { choMinGPerKg: 4, choMaxGPerKg: 6, proGPerKg: 1.5, fatGPerKg: 0.8 },
};

function roundG(n: number): number {
  return Math.round(n);
}

function basalMacrosFromTemplate(weightKg: number, template: MacroGPerKgTemplate): DailyMacroGrams {
  const choMid = (template.choMinGPerKg + template.choMaxGPerKg) / 2;
  return {
    choG: roundG(choMid * weightKg),
    proG: roundG(template.proGPerKg * weightKg),
    fatG: roundG(template.fatGPerKg * weightKg),
  };
}

function sumMacros(a: DailyMacroGrams, b: DailyMacroGrams): DailyMacroGrams {
  return {
    choG: roundG(a.choG + b.choG),
    proG: roundG(a.proG + b.proG),
    fatG: roundG(a.fatG + b.fatG),
  };
}

export type BuildDailyRequirementsInput = {
  request: IntelligentMealPlanRequest;
  /**
   * Peso MISURATO dell'atleta. `null`/`0` = mai misurato: il motore mette il suo default
   * (70 kg) per l'energetica, ma la fascia di capacità intestinale resta "base" — non si
   * promuove nessuno su un dato che non esiste (vedi `resolveGutCapacityTier`).
   */
  weightKg: number | null;
  /** FTP MISURATO dell'atleta. `null`/`0` = mai misurato (stessa regola del peso). */
  ftpWatts?: number | null;
  lifestyleActivityClass?: string | null;
  dietDayMealsScalePct?: number | null;
  strategyKind?: EmpathyNutritionStrategyKind;
  plannedSessions?: Array<{ label: string; avgPowerW: number; durationMin: number }>;
};

export function inferStrategyKindFromRequest(req: IntelligentMealPlanRequest): EmpathyNutritionStrategyKind {
  const trainingLines = (req.trainingDayLines ?? []).join(" ").toLowerCase();
  if (req.racePreLunch || req.racePostRecovery) return "race";
  if (/recovery|scarico|deload|riposo/.test(trainingLines)) return "recovery";
  if (/long|endurance|4h|>3|carbo.?load|load|vo2|soglia|threshold/.test(trainingLines)) return "load";
  return "maintenance";
}

export function buildDailyNutritionRequirementsV2(input: BuildDailyRequirementsInput): DailyNutritionRequirementsV2 {
  const { request } = input;
  /**
   * Valori per l'ENERGETICA: default + pavimenti del motore, calcolati UNA volta qui
   * (`normalizeWeightKg` = max(45, peso) con default 70; `normalizeFtpW` = max(120, FTP) con
   * default 250 — gli stessi numeri di prima, ora da una sola funzione). Ai calcoli di
   * CAPACITÀ intestinale vanno invece i valori GREZZI: solo `resolveGutCapacityTier` sa
   * distinguere «misurato» da «default», ed è lì che si decide se alzare la banda.
   */
  const w = normalizeWeightKg(input.weightKg);
  const ftpForEnergetics = normalizeFtpW(input.ftpWatts);
  const strategyKind = input.strategyKind ?? inferStrategyKindFromRequest(request);
  const template = STRATEGY_TEMPLATES[strategyKind];
  const dietProfileActive: FdcDietProfileTag = dietProfileFromAthleteDietType(request.dietType);

  const lifestyleClass = normalizeLifestyleActivityClass(input.lifestyleActivityClass ?? "moderate");

  const sessions =
    input.plannedSessions?.length
      ? input.plannedSessions
      : extractPlannedSessionsFromRequest(request, ftpForEnergetics);

  const energyModel = computeNutritionDailyEnergyModel({
    athleteId: request.athleteId,
    date: request.planDate,
    weightKg: w,
    /* Il solver V1 continua a ricevere il default motore quando l'FTP manca, com'era prima
       che i chiamanti passassero il grezzo: cambiarlo sposterebbe le kcal di chi non ha FTP
       (calibrazione atleta), che è fuori dallo scopo della banda di assorbimento. */
    ftpWatts: ftpForEnergetics,
    lifestyleActivityClass: lifestyleClass,
    dietDayMealsScalePct: input.dietDayMealsScalePct ?? 100,
    plannedTraining: sessions.map((s) => ({
      durationMinutes: s.durationMin,
      avgPowerW: s.avgPowerW,
      kcalTarget: null,
      tssTarget: null,
    })),
  });

  // Lifestyle dal solver V1 (unica fonte): bmr × LIFESTYLE_PCT[classe].
  const lifestyleKcal = energyModel.lifestyle.kcal;

  let trainingCho = 0;
  let trainingFat = 0;
  let trainingPro = 0;
  const substrateRates: DailyNutritionRequirementsV2["substrateRates"] = [];

  for (const s of sessions) {
    const totals = substrateTotalsForSession(s.avgPowerW, s.durationMin, { ftpW: ftpForEnergetics });
    trainingCho += totals.choG;
    trainingFat += totals.fatG;
    trainingPro += totals.proG;
    substrateRates.push({
      sessionLabel: s.label,
      avgPowerW: s.avgPowerW,
      durationH: totals.durationH,
      choGPerH: totals.choGPerH,
      fatGPerH: totals.fatGPerH,
      proGPerH: totals.proGPerH,
    });
  }

  const basal = basalMacrosFromTemplate(w, template);
  const training: DailyMacroGrams = {
    choG: roundG(trainingCho),
    proG: roundG(trainingPro),
    fatG: roundG(trainingFat),
  };
  const total = sumMacros(basal, training);

  const dietScale =
    input.dietDayMealsScalePct != null && Number.isFinite(input.dietDayMealsScalePct)
      ? Math.max(0, Math.min(200, input.dietDayMealsScalePct)) / 100
      : 1;

  const substrateTrainingKcal = roundG(
    sessions.reduce((sum, s) => {
      const t = substrateTotalsForSession(s.avgPowerW, s.durationMin, { ftpW: ftpForEnergetics });
      return sum + t.kcalPerH * t.durationH;
    }, 0),
  );
  const trainingKcal =
    energyModel.training.kcal > 0 ? energyModel.training.kcal : substrateTrainingKcal;

  const dailyKcal = Math.round((energyModel.bmrKcal + lifestyleKcal + trainingKcal) * dietScale);

  const substrateFueling =
    sessions.length > 0
      ? computeSubstrateFuelingPlan({
          sessions: sessions.map((s) => ({
            label: s.label,
            avgPowerW: s.avgPowerW,
            durationMin: s.durationMin,
          })),
          /* GREZZI di proposito: il motore applica da sé default e pavimenti per l'energetica,
             ma la fascia di capacità deve poter vedere che FTP o peso non sono mai stati
             misurati (passando `w` = 45 di default un atleta senza peso sarebbe diventato
             "elite" con l'FTP di un altro campo). */
          ftpW: input.ftpWatts,
          weightKg: input.weightKg,
        })
      : undefined;

  const fuelingKcal = substrateFueling?.totals.fuelingKcal ?? energyModel.totals.fuelingKcal;
  const mealsKcal = Math.max(800, Math.round(dailyKcal - fuelingKcal));

  const provenance = [
    `Strategia V2 preview: ${strategyKind} (CHO ${template.choMinGPerKg}–${template.choMaxGPerKg} g/kg, PRO ${template.proGPerKg} g/kg, FAT ${template.fatGPerKg} g/kg).`,
    `Profilo dieta attivo (asse 4): ${dietProfileActive}.`,
    `Lifestyle ${lifestyleClass} (+${Math.round(energyModel.lifestyle.pct * 100)}% × BMR ${energyModel.bmrKcal} kcal) → ${lifestyleKcal} kcal (solver V1, fonte unica).`,
    `Training: ${trainingKcal} kcal · ${sessions.length} seduta/e · substrati CHO/FAT/PRO da potenza media.`,
    substrateFueling
      ? `Fueling V2: ${fuelingKcal} kcal oral (pre+intra+post CHO da consumo substrati); pasti ${mealsKcal} kcal = fabbisogno − fueling.`
      : "Nessuna seduta: fueling V1 solver legacy.",
    "Ripartizione % tra pasti: Profile Diet (`buildDietMealSlotBudgets`), non preset composer.",
    ...(substrateFueling?.provenance ?? []),
  ];

  return {
    athleteId: request.athleteId,
    planDate: request.planDate,
    algorithmVersion: "nutrition_requirements_v2_production",
    weightKg: w,
    strategyKind,
    dietProfileActive,
    dailyMacroTargetsGPerKg: {
      choMinGPerKg: template.choMinGPerKg,
      choMaxGPerKg: template.choMaxGPerKg,
      proGPerKg: template.proGPerKg,
      fatGPerKg: template.fatGPerKg,
    },
    energy: {
      bmrKcal: energyModel.bmrKcal,
      lifestyleKcal,
      trainingKcal,
      dailyKcal,
      mealsKcal,
      fuelingKcal,
      // Campo di contratto: moltiplicatore EFFETTIVO del lifestyle V1 (1 + pct),
      // non più la scala PAL parallela rimossa.
      palMultiplier: Number((1 + energyModel.lifestyle.pct).toFixed(2)),
      endogenousTrainingKcal: substrateFueling?.totals.endogenousFatKcal,
    },
    substrateFueling: substrateFueling
      ? {
          algorithmVersion: substrateFueling.algorithmVersion,
          sessions: substrateFueling.sessions.map((s) => ({
            sessionLabel: s.sessionLabel,
            avgPowerW: s.avgPowerW,
            durationH: s.durationH,
            choBurnedG: s.choBurnedG,
            fatBurnedG: s.fatBurnedG,
            choEnergyShare: s.choEnergyShare,
            intraChoReplaceFraction: s.intraChoReplaceFraction,
            preChoG: s.preChoG,
            intraChoG: s.intraChoG,
            postChoG: s.postChoG,
            intraChoGPerH: s.intraChoGPerH,
          })),
          totals: {
            preChoG: substrateFueling.totals.preChoG,
            intraChoG: substrateFueling.totals.intraChoG,
            postChoG: substrateFueling.totals.postChoG,
            fuelingKcal: substrateFueling.totals.fuelingKcal,
            endogenousFatKcal: substrateFueling.totals.endogenousFatKcal,
          },
        }
      : undefined,
    macros: { basal, training, total },
    substrateRates,
    provenance,
  };
}

export function extractPlannedSessionsFromRequest(
  req: IntelligentMealPlanRequest,
  defaultFtp: number,
): Array<{ label: string; avgPowerW: number; durationMin: number }> {
  const out: Array<{ label: string; avgPowerW: number; durationMin: number }> = [];
  for (const line of req.trainingDayLines ?? []) {
    const power = parsePowerFromLine(line, defaultFtp);
    const dur = parseDurationFromLine(line);
    if (dur > 0 && power > 0) {
      out.push({ label: line.slice(0, 80), avgPowerW: power, durationMin: dur });
    }
  }
  if (out.length === 0 && (req.suppressedSlots?.length || req.trainingDayLines?.length)) {
    out.push({ label: "Allenamento pianificato (stima preview)", avgPowerW: Math.round(defaultFtp * 0.86), durationMin: 240 });
  }
  return out;
}

function parsePowerFromLine(line: string, ftp: number): number {
  const w = line.match(/(\d{2,4})\s*w\b/i);
  if (w) return Number(w[1]);
  const pct = line.match(/(\d{2,3})\s*%\s*ftp/i);
  if (pct) return Math.round((Number(pct[1]) / 100) * ftp);
  return 0;
}

function parseDurationFromLine(line: string): number {
  const h = line.match(/(\d+(?:[.,]\d+)?)\s*h\b/i);
  if (h) return Math.round(Number(h[1].replace(",", ".")) * 60);
  const min = line.match(/(\d+)\s*min/i);
  if (min) return Number(min[1]);
  return 0;
}
