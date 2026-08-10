import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import type { NutritionPerformanceIntegrationDials } from "@/lib/nutrition/performance-integration-scaler";
import { computeGlycogenDepletionForFueling } from "@/lib/nutrition/fueling-session-protocol";
import { buildEffectiveDayTrainingContext } from "@/lib/training/day-reality-context";
import { buildNutritionDayModelV2 } from "@/lib/nutrition/v2/nutrition-day-model-v2";
import {
  ABSOLUTE_MAX_CHO_G_PER_HOUR,
  capChoGPerHour,
  computeSubstrateFuelingPlan,
  evidenceChoBandLabel,
  evidenceMaxChoGPerHour,
  gutCapacityTierFromFtpWKg,
  intraChoReplaceFractionFromEnergyShare,
  measuredPositive,
  resolveGutCapacityTier,
  resolvePrescribedIntraChoGPerHour,
  resolvePrescribedIntraFueling,
  type GutCapacityTier,
} from "@/lib/nutrition/v2/fueling-from-substrates";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

test("alta intensità → replace CHO più alto che Z2", () => {
  const high = computeSubstrateFuelingPlan({
    sessions: [{ label: "Threshold", avgPowerW: 270, durationMin: 240 }],
    ftpW: 313,
    weightKg: 70,
  });
  const z2 = computeSubstrateFuelingPlan({
    sessions: [{ label: "Z2", avgPowerW: 180, durationMin: 240 }],
    ftpW: 313,
    weightKg: 70,
  });
  const hi = high.sessions[0]!;
  const lo = z2.sessions[0]!;
  assert.ok(hi.choEnergyShare > lo.choEnergyShare);
  assert.ok(hi.intraChoReplaceFraction >= lo.intraChoReplaceFraction);
  assert.ok(hi.intraChoG > lo.intraChoG, `intra CHO threshold ${hi.intraChoG} vs Z2 ${lo.intraChoG}`);
  assert.ok(high.totals.fuelingKcal > z2.totals.fuelingKcal);
});

test("intraChoReplaceFraction: share alto → ~85%", () => {
  assert.equal(intraChoReplaceFractionFromEnergyShare(0.92), 0.85);
  assert.equal(intraChoReplaceFractionFromEnergyShare(0.55), 0.55);
});

test("fueling kcal ≈ somma pre+intra+post CHO", () => {
  const plan = computeSubstrateFuelingPlan({
    sessions: [{ label: "Long", avgPowerW: 220, durationMin: 300 }],
    ftpW: 300,
    weightKg: 68,
  });
  const choKcal =
    plan.totals.preChoG * 4 + plan.totals.intraChoG * 4 + plan.totals.postChoG * 4;
  assert.equal(plan.totals.fuelingKcal, Math.round(choKcal));
});

// ── Banda di assorbimento personale (durata × intensità × capacità) ────────────────────

const MIXED_SHARE = 0.6; // Z1/Z2: CHO minoritario
const DOMINANT_SHARE = 0.9; // alta intensità: CHO dominante
const TIERS: GutCapacityTier[] = ["base", "high", "elite"];

/** Banda di HEAD (prima della personalizzazione): serve a provare la non-regressione. */
function headEvidenceMaxChoGPerHour(durationMin: number, choEnergyShare: number): number {
  const h = durationMin / 60;
  if (h < 0.75) return 30;
  if (h < 2) return choEnergyShare >= 0.85 ? 90 : 60;
  if (h < 3) return choEnergyShare >= 0.85 ? 110 : 75;
  return choEnergyShare >= 0.85 ? 120 : 90;
}

/** Griglia attesa: [durata rappresentativa, mixed(base,alta,elite), dominante(base,alta,elite)]. */
const EXPECTED_GRID: Array<{
  label: string;
  durationMin: number;
  mixed: [number, number, number];
  dominant: [number, number, number];
}> = [
  { label: "<45 min", durationMin: 30, mixed: [30, 30, 30], dominant: [30, 30, 30] },
  { label: "<2 h", durationMin: 90, mixed: [60, 70, 80], dominant: [90, 105, 120] },
  { label: "<3 h", durationMin: 150, mixed: [75, 90, 100], dominant: [110, 130, 150] },
  { label: "≥3 h", durationMin: 240, mixed: [90, 110, 120], dominant: [120, 140, 160] },
];

test("griglia banda: ogni combinazione durata × intensità × capacità dà il valore atteso", () => {
  for (const row of EXPECTED_GRID) {
    TIERS.forEach((tier, i) => {
      assert.equal(
        evidenceMaxChoGPerHour(row.durationMin, MIXED_SHARE, tier),
        row.mixed[i],
        `${row.label} · Z1/Z2 · ${tier}`,
      );
      assert.equal(
        evidenceMaxChoGPerHour(row.durationMin, DOMINANT_SHARE, tier),
        row.dominant[i],
        `${row.label} · alta intensità · ${tier}`,
      );
    });
  }
});

test("nessuna regressione: la colonna 'base' coincide con la banda di HEAD, confini compresi", () => {
  const durations = [10, 30, 44, 45, 60, 90, 119, 120, 150, 179, 180, 240, 360];
  for (const durationMin of durations) {
    for (const share of [0, 0.4, 0.6, 0.84, 0.85, 0.9, 1]) {
      assert.equal(
        evidenceMaxChoGPerHour(durationMin, share, "base"),
        headEvidenceMaxChoGPerHour(durationMin, share),
        `base ${durationMin} min · share ${share}`,
      );
    }
  }
});

test("sotto i 45 minuti restano 30 g/h per tutti, elite compresi", () => {
  for (const durationMin of [10, 30, 44]) {
    for (const tier of TIERS) {
      assert.equal(evidenceMaxChoGPerHour(durationMin, MIXED_SHARE, tier), 30);
      assert.equal(evidenceMaxChoGPerHour(durationMin, DOMINANT_SHARE, tier), 30);
    }
  }
  // E anche nel piano completo: elite 5,33 W/kg su 40 minuti in soglia → 30 g/h.
  const plan = computeSubstrateFuelingPlan({
    sessions: [{ label: "Short hard", avgPowerW: 310, durationMin: 40 }],
    ftpW: 320,
    weightKg: 60,
  });
  const s = plan.sessions[0]!;
  assert.equal(s.gutCapacityTier, "elite");
  assert.equal(s.evidenceMaxChoGPerH, 30);
  assert.equal(s.intraChoGPerH, 30);
});

test("soglie capacità: stesse del solver V1 (≥4,2 alta · ≥4,8 elite)", () => {
  assert.equal(gutCapacityTierFromFtpWKg(4.19), "base");
  assert.equal(gutCapacityTierFromFtpWKg(4.2), "high");
  assert.equal(gutCapacityTierFromFtpWKg(4.79), "high");
  assert.equal(gutCapacityTierFromFtpWKg(4.8), "elite");
  assert.equal(gutCapacityTierFromFtpWKg(null), "base");
  assert.equal(gutCapacityTierFromFtpWKg(undefined), "base");
});

test("caso Mario: elite 320 W su 60 kg (5,33 W/kg), ≥3 h ad alta intensità → 160 g/h prescritti", () => {
  const plan = computeSubstrateFuelingPlan({
    sessions: [{ label: "Long triathlon 3h", avgPowerW: 288, durationMin: 180 }],
    ftpW: 320,
    weightKg: 60,
  });
  const s = plan.sessions[0]!;
  assert.equal(s.gutCapacityTier, "elite");
  assert.ok(s.choEnergyShare >= 0.85, `choEnergyShare ${s.choEnergyShare} deve essere alta intensità`);
  assert.equal(s.evidenceMaxChoGPerH, 160);
  assert.equal(s.intraChoGPerH, 160, "i 160 g/h che Mario osserva nei triathleti");
  assert.equal(s.intraChoG, 480, "160 g/h × 3 h");
});

test("stesso atleta a HEAD sarebbe stato tagliato a 120 g/h: la banda personale è ciò che cambia", () => {
  const s = computeSubstrateFuelingPlan({
    sessions: [{ label: "Long triathlon 3h", avgPowerW: 288, durationMin: 180 }],
    ftpW: 320,
    weightKg: 60,
  }).sessions[0]!;
  assert.equal(headEvidenceMaxChoGPerHour(180, s.choEnergyShare), 120);
  assert.ok(s.intraChoGPerH > 120, `oggi ${s.intraChoGPerH} g/h contro i 120 di HEAD`);
});

test("monotonia: capacità più alta non dà MAI meno g/h, durata maggiore nemmeno", () => {
  const durations = [10, 30, 44, 45, 60, 90, 119, 120, 150, 179, 180, 240, 360];
  const shares = [MIXED_SHARE, DOMINANT_SHARE];

  // Capacità: base ≤ alta ≤ elite, a parità di durata e intensità.
  for (const durationMin of durations) {
    for (const share of shares) {
      const base = evidenceMaxChoGPerHour(durationMin, share, "base");
      const high = evidenceMaxChoGPerHour(durationMin, share, "high");
      const elite = evidenceMaxChoGPerHour(durationMin, share, "elite");
      assert.ok(high >= base, `${durationMin} min share ${share}: alta ${high} < base ${base}`);
      assert.ok(elite >= high, `${durationMin} min share ${share}: elite ${elite} < alta ${high}`);
    }
  }

  // Durata: crescente a parità di capacità e intensità.
  for (const tier of TIERS) {
    for (const share of shares) {
      let prev = 0;
      for (const durationMin of durations) {
        const v = evidenceMaxChoGPerHour(durationMin, share, tier);
        assert.ok(v >= prev, `${tier} share ${share}: ${durationMin} min dà ${v} < ${prev}`);
        prev = v;
      }
    }
  }

  // Intensità: CHO dominante ≥ Z1/Z2, a parità di durata e capacità.
  for (const durationMin of durations) {
    for (const tier of TIERS) {
      assert.ok(
        evidenceMaxChoGPerHour(durationMin, DOMINANT_SHARE, tier) >=
          evidenceMaxChoGPerHour(durationMin, MIXED_SHARE, tier),
        `${durationMin} min ${tier}`,
      );
    }
  }
});

// ── Guardia assoluta a 200 g/h ────────────────────────────────────────────────────────

test("guardia: la banda non arriva mai a 200 g/h (la rete non morde, è voluto)", () => {
  for (const row of EXPECTED_GRID) {
    for (const tier of TIERS) {
      for (const share of [MIXED_SHARE, DOMINANT_SHARE]) {
        const v = evidenceMaxChoGPerHour(row.durationMin, share, tier);
        assert.ok(v <= ABSOLUTE_MAX_CHO_G_PER_HOUR, `${row.label} ${tier}: ${v}`);
      }
    }
  }
  assert.equal(ABSOLUTE_MAX_CHO_G_PER_HOUR, 200);
});

test("guardia: nessuna combinazione di piano supera 200 g/h prescritti", () => {
  const durations = [20, 45, 90, 150, 180, 300, 600];
  const ftps = [200, 260, 300, 320, 420];
  const weights = [45, 55, 60, 70, 95];
  for (const durationMin of durations) {
    for (const ftpW of ftps) {
      for (const weightKg of weights) {
        for (const pctFtp of [0.5, 0.65, 0.75, 0.85, 0.95, 1.05]) {
          const plan = computeSubstrateFuelingPlan({
            sessions: [{ label: "s", avgPowerW: Math.round(ftpW * pctFtp), durationMin }],
            ftpW,
            weightKg,
          });
          const s = plan.sessions[0]!;
          assert.ok(
            s.intraChoGPerH <= ABSOLUTE_MAX_CHO_G_PER_HOUR,
            `${durationMin} min · ${ftpW} W · ${weightKg} kg · ${pctFtp} FTP → ${s.intraChoGPerH} g/h`,
          );
        }
      }
    }
  }
});

test("guardia: la prescrizione mostrata non supera 200 g/h nemmeno con scale assurde e durate minime", () => {
  let max = 0;
  let worst = "";
  for (const ftpW of [100, 250, 400, 800]) {
    for (const weightKg of [40, 53, 60, 95]) {
      for (const durationMin of [0.1, 1, 20, 44, 45, 90, 180, 240, 1440]) {
        for (const pctFtp of [0.2, 0.65, 0.88, 1.2, 2]) {
          for (const fuelingChoScale of [1, 1.12, 5, 100, 1000]) {
            const p = resolvePrescribedIntraFueling({
              sessions: [{ id: "s", label: "s", avgPowerW: Math.round(ftpW * pctFtp), durationMin }],
              ftpW,
              weightKg,
              fuelingChoScale,
            });
            if (p == null) continue;
            for (const s of p.sessions) {
              if (s.intraChoGPerH > max) {
                max = s.intraChoGPerH;
                worst = `${ftpW}W ${weightKg}kg ${durationMin}min ${pctFtp}FTP ×${fuelingChoScale}`;
              }
            }
            if (p.intraChoGPerH > max) max = p.intraChoGPerH;
          }
        }
      }
    }
  }
  assert.ok(max <= ABSOLUTE_MAX_CHO_G_PER_HOUR, `massimo raggiunto ${max} g/h su ${worst}`);
});

function minimalRequest(): IntelligentMealPlanRequest {
  return {
    athleteId: "athlete-test",
    planDate: "2026-06-05",
    dietType: "omnivore",
    intolerances: null,
    allergies: null,
    foodExclusions: null,
    foodPreferences: null,
    supplements: null,
    aggregateInhibitors: null,
    pathwayTimingLines: [],
    trainingDayLines: ["Long ride 3h @ 288w threshold"],
    routineDigest: null,
    contextLines: [],
    mealPlanSolverMeta: { dailyMealsKcalTotal: 4200, integrationLeverLines: [] },
    slots: [],
  };
}

function dials(fuelingChoScale: number): NutritionPerformanceIntegrationDials {
  return {
    trainingEnergyScale: 1,
    mealTrainingFraction: 0.4,
    fuelingChoScale,
    proteinBiasPctPoints: 0,
    hydrationFloorMultiplier: 1,
    sessionFluidMultiplier: 1,
    rationale: ["test"],
    diaryInsight: null,
    acuteMealEstimate: null,
  };
}

test("guardia: nemmeno le scale di integrazione performance al massimo superano 200 g/h", () => {
  // 1.12 è il massimo che il dial può produrre; 5 è un valore assurdo di regressione.
  for (const scale of [1.12, 2, 5, 50]) {
    const { requirements } = buildNutritionDayModelV2({
      request: minimalRequest(),
      weightKg: 60,
      ftpWatts: 320,
      plannedSessions: [{ label: "Long triathlon 3h", avgPowerW: 288, durationMin: 180 }],
      strategyKind: "load",
      performanceIntegration: dials(scale),
    });
    const sessions = requirements.substrateFueling?.sessions ?? [];
    assert.ok(sessions.length > 0, "il modello a substrati deve esserci");
    for (const s of sessions) {
      assert.ok(
        s.intraChoGPerH <= ABSOLUTE_MAX_CHO_G_PER_HOUR,
        `scale ×${scale} → ${s.intraChoGPerH} g/h`,
      );
    }
  }
});

test("scala performance realistica (×1.12) resta sotto la guardia e sopra la banda pura", () => {
  const { requirements } = buildNutritionDayModelV2({
    request: minimalRequest(),
    weightKg: 60,
    ftpWatts: 320,
    plannedSessions: [{ label: "Long triathlon 3h", avgPowerW: 288, durationMin: 180 }],
    strategyKind: "load",
    performanceIntegration: dials(1.12),
  });
  const s = requirements.substrateFueling!.sessions[0]!;
  assert.equal(s.intraChoGPerH, 179.2, "160 g/h × 1.12");
  assert.ok(s.intraChoGPerH < ABSOLUTE_MAX_CHO_G_PER_HOUR);
});

// ── Quello che si legge = quello che si mangia ─────────────────────────────────────────

test("resolvePrescribedIntraChoGPerHour: stesso numero che il piano prescrive", () => {
  const sessions = [{ label: "Long", avgPowerW: 288, durationMin: 180 }];
  const plan = computeSubstrateFuelingPlan({ sessions, ftpW: 320, weightKg: 60 });
  assert.equal(
    resolvePrescribedIntraChoGPerHour({ sessions, ftpW: 320, weightKg: 60 }),
    plan.sessions[0]!.intraChoGPerH,
  );
});

test("resolvePrescribedIntraChoGPerHour: null senza sedute utili (il chiamante tiene il valore attuale)", () => {
  assert.equal(resolvePrescribedIntraChoGPerHour({ sessions: [], ftpW: 320, weightKg: 60 }), null);
  assert.equal(
    resolvePrescribedIntraChoGPerHour({
      sessions: [{ label: "riposo", avgPowerW: 0, durationMin: 0 }],
      ftpW: 320,
      weightKg: 60,
    }),
    null,
  );
});

test("resolvePrescribedIntraChoGPerHour: applica la scala performance e la guardia", () => {
  const sessions = [{ label: "Long", avgPowerW: 288, durationMin: 180 }];
  assert.equal(
    resolvePrescribedIntraChoGPerHour({ sessions, ftpW: 320, weightKg: 60, fuelingChoScale: 1.12 }),
    179.2,
  );
  assert.equal(
    resolvePrescribedIntraChoGPerHour({ sessions, ftpW: 320, weightKg: 60, fuelingChoScale: 10 }),
    ABSOLUTE_MAX_CHO_G_PER_HOUR,
  );
});

test("etichetta banda UI: esce dalla stessa tabella dei grammi", () => {
  assert.equal(evidenceChoBandLabel(30, "elite"), "30 g/h");
  assert.equal(evidenceChoBandLabel(90, "base"), "60-90 g/h");
  assert.equal(evidenceChoBandLabel(240, "elite"), "120-160 g/h");
  assert.equal(evidenceChoBandLabel(240, "high"), "110-140 g/h");
});

test("nessun tetto a 150 g/h: il g/h mostrato è quello prescritto (480 g / 3 h = 160)", () => {
  const s = computeSubstrateFuelingPlan({
    sessions: [{ label: "Long triathlon 3h", avgPowerW: 288, durationMin: 180 }],
    ftpW: 320,
    weightKg: 60,
  }).sessions[0]!;
  // Il calcolo che la UI fa per l'etichetta «CHO/h seduta ~N g/h»: grammi intra / ore.
  const shownGPerHour = capChoGPerHour(s.intraChoG / s.durationH);
  assert.equal(shownGPerHour, 160, "il vecchio Math.min(150, …) stampava 150 su un piano da 160");
  assert.equal(shownGPerHour, s.intraChoGPerH, "etichetta e prescrizione devono coincidere");
});

test("capChoGPerHour: lascia passare i 160, taglia solo oltre la guardia", () => {
  assert.equal(capChoGPerHour(160), 160);
  assert.equal(capChoGPerHour(199.9), 199.9);
  assert.equal(capChoGPerHour(250), ABSOLUTE_MAX_CHO_G_PER_HOUR);
  assert.equal(capChoGPerHour(0), 0);
  assert.equal(capChoGPerHour(Number.NaN), 0);
});

test("curva glicogeno: l'ingestione segue i 160 g/h prescritti, non il vecchio clamp a 150", () => {
  const physiology = {
    choSharePct: 70,
    vLamax: 0.55,
    oxidativeCeilingKcalMin: 20,
    redoxPct: 50,
    gutDeliveryPct: 100,
    coriReturnG: 0,
  };
  const model = computeGlycogenDepletionForFueling({
    weightKg: 60,
    muscleMassKg: 28,
    durationMin: 180,
    intensityPctFtp: 90,
    fuelingPhysiology: physiology,
    resolvedFuelingChoGPerHour: 160,
  });
  assert.equal(model.totalIntake, 480, "160 g/h × 3 h (col clamp a 150 sarebbero stati 450)");
  // La guardia assoluta resta l'unico tetto.
  const capped = computeGlycogenDepletionForFueling({
    weightKg: 60,
    muscleMassKg: 28,
    durationMin: 180,
    intensityPctFtp: 90,
    fuelingPhysiology: physiology,
    resolvedFuelingChoGPerHour: 400,
  });
  assert.equal(capped.totalIntake, ABSOLUTE_MAX_CHO_G_PER_HOUR * 3);
});

test("fascia di capacità: un solo criterio, sugli STESSI input pavimentati dei grammi", () => {
  // 200 W su 40 kg: rapporto grezzo 5,00 (elite), rapporto del motore 200/45 = 4,44 (alta).
  assert.equal(gutCapacityTierFromFtpWKg(200 / 40), "elite", "il rapporto grezzo direbbe elite");
  assert.equal(resolveGutCapacityTier(200, 40), "high", "il motore pavimenta il peso a 45 kg");
  const s = computeSubstrateFuelingPlan({
    sessions: [{ label: "Long", avgPowerW: 190, durationMin: 240 }],
    ftpW: 200,
    weightKg: 40,
  }).sessions[0]!;
  assert.equal(s.gutCapacityTier, resolveGutCapacityTier(200, 40), "etichetta = fascia applicata");
  // Stessa cosa sull'FTP pavimentato a 120 W.
  assert.equal(resolveGutCapacityTier(60, 45), gutCapacityTierFromFtpWKg(120 / 45));
});

// ── Si promuove SOLO su misura: un FTP mai misurato non alza la banda ─────────────────

/**
 * Il difetto che questi test presidiano: il motore, quando l'FTP manca, mette il suo default
 * (250 W) per calcolare l'energetica. Se la FASCIA viene calcolata su quel default, un atleta
 * leggero senza FTP diventa «ventre allenato» senza averlo mai dimostrato — e su un intestino
 * non allenato più CHO in gara è la direzione pericolosa. In produzione (sola lettura, ago 2026)
 * esiste davvero un atleta con `ftp_watts` NULL e `weight_kg` = 53,00: 250/53 = 4,72 W/kg
 * sarebbe stato "alta". Il test precedente controllava solo il caso in cui MANCANO ENTRAMBI,
 * ed è per questo che la suite era verde col difetto vivo.
 */
test("FTP mai misurato + peso presente → fascia base (caso reale 53 kg, ftp NULL)", () => {
  assert.equal(resolveGutCapacityTier(null, 53), "base", "senza FTP non si promuove nessuno");
  assert.equal(resolveGutCapacityTier(undefined, 53), "base");
  assert.equal(resolveGutCapacityTier(0, 53), "base", "0 memorizzato = mai misurato");
  assert.equal(resolveGutCapacityTier(Number.NaN, 53), "base");
  // Con l'FTP MISURATO a 250 W lo stesso peso promuove: è la misura a fare la differenza.
  assert.equal(resolveGutCapacityTier(250, 53), "high", "250 W misurati su 53 kg = 4,72 W/kg");
  // Sotto 52,08 kg il default darebbe "elite": neanche lì si promuove senza misura.
  assert.equal(resolveGutCapacityTier(null, 50), "base");
  assert.equal(resolveGutCapacityTier(250, 50), "elite");
});

test("peso mai misurato + FTP presente → fascia base", () => {
  assert.equal(resolveGutCapacityTier(320, null), "base");
  assert.equal(resolveGutCapacityTier(320, 0), "base");
  assert.equal(resolveGutCapacityTier(320, undefined), "base");
  assert.equal(resolveGutCapacityTier(320, 60), "elite", "misurati entrambi → 5,33 W/kg");
});

test("i grammi del piano seguono la fascia: senza FTP l'atleta da 53 kg resta sulla colonna base", () => {
  const sessions = [{ label: "Long 4h", avgPowerW: 220, durationMin: 240 }];
  const noFtp = computeSubstrateFuelingPlan({ sessions, ftpW: null, weightKg: 53 }).sessions[0]!;
  const withFtp = computeSubstrateFuelingPlan({ sessions, ftpW: 250, weightKg: 53 }).sessions[0]!;
  assert.equal(noFtp.gutCapacityTier, "base");
  assert.equal(withFtp.gutCapacityTier, "high");
  // Stessa energetica (il default motore è 250 W in entrambi) → stesso CHO bruciato…
  assert.equal(noFtp.choBurnedG, withFtp.choBurnedG);
  // …ma banda e grammi diversi: 120 g/h contro 140 g/h → +32,7 g di intra sulla stessa seduta.
  assert.equal(noFtp.evidenceMaxChoGPerH, 120);
  assert.equal(withFtp.evidenceMaxChoGPerH, 140);
  assert.equal(noFtp.intraChoG, 480, "480 g = 120 g/h × 4 h (la banda base taglia)");
  assert.equal(withFtp.intraChoG, 512.7, "la banda alta non taglia più: 85% del CHO bruciato");
  assert.equal(round1(withFtp.intraChoG - noFtp.intraChoG), 32.7);
  // E coincide con HEAD, dove tutti prendevano la colonna base: nessuna regressione.
  assert.equal(noFtp.evidenceMaxChoGPerH, headEvidenceMaxChoGPerHour(240, noFtp.choEnergyShare));
});

test("percorso che PERSISTE il piano: senza FTP misurato la banda resta base", () => {
  const build = (ftpWatts: number | null, weightKg: number | null) =>
    buildNutritionDayModelV2({
      request: minimalRequest(),
      weightKg,
      ftpWatts,
      plannedSessions: [{ label: "Long 4h", avgPowerW: 220, durationMin: 240 }],
      strategyKind: "load",
    }).requirements.substrateFueling!.sessions[0]!;
  assert.equal(build(null, 53).intraChoGPerH, 120, "FTP mai misurato → colonna base (cap a 120 g/h)");
  assert.equal(build(250, 53).intraChoGPerH, 128.2, "FTP misurato a 250 W su 53 kg → fascia alta");
  assert.equal(build(null, null).intraChoGPerH, 120, "entrambi mancanti → base");
  // Anche il peso mancante non deve promuovere via il pavimento a 45 kg del fabbisogno.
  assert.equal(build(250, null).intraChoGPerH, 120, "peso mai misurato → base, non 250/45 = 5,6");
});

test("normalizzazione unica: 0 e NaN valgono 'mai misurato' ovunque", () => {
  for (const v of [0, -10, Number.NaN, null, undefined]) {
    assert.equal(measuredPositive(v as number | null | undefined), null, `measuredPositive(${String(v)})`);
  }
  assert.equal(measuredPositive(250), 250);
  // FTP 0 memorizzato: etichetta, grammi del pannello e grammi del motore devono concordare.
  assert.equal(resolveGutCapacityTier(0, 50), "base");
  assert.equal(
    computeSubstrateFuelingPlan({
      sessions: [{ label: "s", avgPowerW: 180, durationMin: 240 }],
      ftpW: 0,
      weightKg: 50,
    }).sessions[0]!.gutCapacityTier,
    "base",
  );
  assert.equal(
    resolvePrescribedIntraFueling({
      sessions: [{ label: "s", avgPowerW: 180, durationMin: 240 }],
      ftpW: 0,
      weightKg: 50,
    })!.gutCapacityTier,
    "base",
  );
  assert.equal(
    buildNutritionDayModelV2({
      request: minimalRequest(),
      weightKg: 50,
      ftpWatts: 0,
      plannedSessions: [{ label: "s", avgPowerW: 180, durationMin: 240 }],
      strategyKind: "load",
    }).requirements.substrateFueling!.sessions[0]!.intraChoGPerH,
    resolvePrescribedIntraFueling({
      sessions: [{ label: "s", avgPowerW: 180, durationMin: 240 }],
      ftpW: 0,
      weightKg: 50,
    })!.sessions[0]!.intraChoGPerH,
    "motore del piano e numero mostrato devono coincidere anche con FTP 0",
  );
  // Peso 0 memorizzato: idem, e nessun percorso lo trasforma in 45 kg per promuovere.
  assert.equal(resolveGutCapacityTier(250, 0), "base");
  assert.equal(
    computeSubstrateFuelingPlan({
      sessions: [{ label: "s", avgPowerW: 180, durationMin: 240 }],
      ftpW: 250,
      weightKg: 0,
    }).sessions[0]!.gutCapacityTier,
    "base",
  );
});

// ── Numeratore e denominatore dalla STESSA base ───────────────────────────────────────

/**
 * Il pannello Nutrizione mostra g/h E grammi. I grammi sono g/h × ore: se il g/h esce da una
 * base (sedute effettive) e le ore da un'altra (sole pianificate), il pacchetto disegnato può
 * stare fuori dalla banda della durata mostrata. La base scelta è quella PIANIFICATA, perché è
 * quella su cui è generato il piano che l'atleta mangia (`intelligent-meal-plan-route-prep` →
 * Edge Function `generate-meal-plan` legge solo `planned_workouts`) e quella che il pannello
 * disegna: così il numero letto e il piano mangiato restano lo stesso numero.
 */
test("g/h e grammi dalla stessa base: 60' pianificati, 4 h eseguite → prescrizione dei 60'", () => {
  const ctx = buildEffectiveDayTrainingContext({
    planned: [{ id: "p1", title: "Sciolta 60'", duration_minutes: 60, tss_target: 45, kcal_target: 500 }],
    executed: [
      {
        id: "e1",
        date: "2026-08-10",
        duration_minutes: 240,
        tss: 260,
        kcal: 3200,
        trace_summary: { power_avg_w: 282 },
      },
    ],
  });
  assert.equal(ctx.mode, "executed", "l'effettivo esiste ed è diverso dal pianificato");

  const prescribed = resolvePrescribedIntraFueling({
    sessions: [{ id: "p1", label: "Sciolta 60'", avgPowerW: 282, durationMin: 60 }],
    ftpW: 320,
    weightKg: 60,
  })!;
  assert.equal(prescribed.gutCapacityTier, "elite");
  assert.equal(prescribed.intraChoGPerH, 120, "banda <2 h · alta intensità · elite");
  assert.equal(prescribed.totalDurationH, 1, "le ore sono quelle della seduta prescritta");
  assert.equal(prescribed.totalIntraChoG, 120, "120 g/h × 1 h, non 160 g/h × 1 h");
  // Etichetta di fascia e grammi parlano della stessa durata.
  assert.equal(evidenceChoBandLabel(prescribed.totalDurationH * 60, prescribed.gutCapacityTier), "80-120 g/h");
  // Invariante generale: grammi / ore = g/h dichiarato, sempre dentro la banda della durata.
  assert.equal(prescribed.totalIntraChoG / prescribed.totalDurationH, prescribed.intraChoGPerH);
  assert.ok(
    prescribed.intraChoGPerH <=
      evidenceMaxChoGPerHour(prescribed.totalDurationH * 60, DOMINANT_SHARE, prescribed.gutCapacityTier),
  );
});

test("prescrizione PER SEDUTA: ogni pacchetto resta dentro la banda della sua durata", () => {
  // Giorno doppia seduta: 40' intensi + 4 h in Z2. Ripartire un totale di giornata col peso
  // glicolitico metteva la seduta corta ben sopra i suoi 30 g/h (banda <45 min).
  const prescribed = resolvePrescribedIntraFueling({
    sessions: [
      { id: "short", label: "Richiami 40'", avgPowerW: 300, durationMin: 40 },
      { id: "long", label: "Fondo 4h", avgPowerW: 210, durationMin: 240 },
    ],
    ftpW: 320,
    weightKg: 60,
  })!;
  assert.equal(prescribed.sessions.length, 2);
  const short = prescribed.sessions.find((s) => s.id === "short")!;
  const long = prescribed.sessions.find((s) => s.id === "long")!;
  assert.equal(short.intraChoGPerH, 30, "sotto i 45 minuti restano 30 g/h anche per un elite");
  assert.equal(short.intraChoG, 20.1, "30 g/h × 0,67 h");
  assert.ok(long.intraChoGPerH > short.intraChoGPerH);
  for (const s of prescribed.sessions) {
    assert.ok(
      s.intraChoGPerH <= evidenceMaxChoGPerHour(s.durationH * 60, DOMINANT_SHARE, prescribed.gutCapacityTier),
      `${s.label}: ${s.intraChoGPerH} g/h fuori dalla banda della sua durata`,
    );
    assert.equal(round1(s.intraChoG), round1(s.intraChoGPerH * s.durationH), `${s.label}: grammi ≠ g/h × ore`);
  }
  // Il totale del giorno è la somma delle sedute, e il g/h del giorno è la media pesata.
  assert.equal(
    round1(prescribed.totalIntraChoG),
    round1(prescribed.sessions.reduce((sum, s) => sum + s.intraChoG, 0)),
  );
  assert.equal(round1(prescribed.totalDurationH), round1(40 / 60 + 240 / 60));
  assert.equal(
    round1(prescribed.intraChoGPerH),
    round1(prescribed.totalIntraChoG / prescribed.totalDurationH),
  );
});

test("il caso Mario resta intatto: elite, ≥3 h ad alta intensità → 160 g/h e 480 g", () => {
  const prescribed = resolvePrescribedIntraFueling({
    sessions: [{ id: "s1", label: "Long triathlon 3h", avgPowerW: 288, durationMin: 180 }],
    ftpW: 320,
    weightKg: 60,
  })!;
  assert.equal(prescribed.intraChoGPerH, 160);
  assert.equal(prescribed.totalIntraChoG, 480);
  assert.equal(prescribed.totalDurationH, 3);
});

// ── La banda deve arrivare DAVVERO in produzione: il bundle della Edge Function ─────────

/**
 * `generate-meal-plan` è il percorso PRIMARIO del motore V2 (la route Next è solo fallback su
 * 5xx). Il bundle è un artefatto tracciato in git generato da `_build.sh`: se resta indietro,
 * il codice qui sotto è corretto e gli atleti continuano a ricevere la banda vecchia.
 * Questo test è la sveglia: fallisce finché il bundle non viene rigenerato.
 */
test("bundle Edge Function allineato: porta la banda personale e la guardia a 200", () => {
  const bundlePath = path.resolve(
    __dirname,
    "../../../../../supabase/functions/generate-meal-plan/nutrition-v2-engine.mjs",
  );
  const src = readFileSync(bundlePath, "utf8");

  assert.ok(
    src.includes("EVIDENCE_MAX_CHO_G_PER_HOUR_TABLE"),
    "il bundle non contiene la tabella della banda personale: rigenera con supabase/functions/generate-meal-plan/_build.sh",
  );
  assert.ok(
    src.includes(`ABSOLUTE_MAX_CHO_G_PER_HOUR = ${ABSOLUTE_MAX_CHO_G_PER_HOUR}`),
    "il bundle non contiene la guardia assoluta a 200 g/h",
  );
  assert.ok(
    src.includes("evidenceMaxChoGPerHour(s.durationMin, choEnergyShare, capacityTier)"),
    "il bundle chiama ancora la banda senza capacità dell'atleta",
  );
  assert.ok(
    !/return choEnergyShare >= 0\.85 \? 120 : 90;/.test(src),
    "il bundle contiene ancora la banda di HEAD (tetto 120 g/h)",
  );
  // La cella dei triathleti di Mario deve essere nel bundle, non solo nel sorgente.
  assert.ok(
    /choDominant: \{ base: 120, high: 140, elite: 160 \}/.test(src),
    "la riga ≥3 h ad alta intensità non arriva a 160 g/h nel bundle",
  );
  // La regola «si promuove solo su misura» deve valere anche nel percorso che PERSISTE il piano.
  assert.ok(
    src.includes("function measuredPositive("),
    "il bundle non ha la normalizzazione unica (0/null/NaN = mai misurato)",
  );
  assert.ok(
    /const ftpMeasuredW = measuredPositive\(/.test(src),
    "il bundle sostituisce ancora il default FTP prima di calcolare la fascia di capacità",
  );
  assert.ok(
    /const weightMeasuredKg = measuredPositive\(/.test(src),
    "il bundle sostituisce ancora il peso di default prima di calcolare la fascia di capacità",
  );
  assert.ok(
    src.includes("if (measuredFtpW == null || measuredWeightKg == null) return \"base\""),
    "nel bundle la fascia può ancora essere promossa da un FTP/peso mai misurati",
  );
});
