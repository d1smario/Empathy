/**
 * Test di fedeltà ai numeri di Mario (6 ago 2026) per il motore classi/quote.
 * Tolleranza ±1 g sui casi di fedeltà; la griglia è un test di sanità, non di fedeltà.
 * Il modulo è PURO e NON COLLEGATO: questi test sono l'unico consumer ammesso
 * finché il mattone di collegamento (void requirements) non esiste.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  classifyNutritionDay,
  lookupMealDistribution,
  DAY_CLASS_BANDS,
  MARIO_KCAL_PER_G,
  MEAL_DISTRIBUTION_RECUPERO,
  MEAL_DISTRIBUTION_TRAINING_MATTINO,
  MEAL_DISTRIBUTION_TRAINING_POMERIGGIO,
  type MealDistribution,
} from "@/lib/nutrition/v2/day-classification-engine";

/** BMR Katch-McArdle: stesso ancoraggio del solver (le bande di Mario sono tarate qui). */
function katchMcArdle(leanMassKg: number): number {
  return 370 + 21.6 * leanMassKg;
}

function assertWithin1g(actual: number, expected: number, label: string) {
  assert.ok(
    Math.abs(actual - expected) <= 1,
    `${label}: atteso ${expected} ±1 g, trovato ${actual}`,
  );
}

test("fedeltà (a): quote massime di Mario — lean 62, target 5880, ratio 4 → PRO 248, FAT 186, CHO ≈ 778", () => {
  const result = classifyNutritionDay({
    bmrKcal: 1470,
    leanMassKg: 62,
    consumoKcal: 5880, // ratio = 5880/1470 = 4.0 esatto
    strategiaPct: 100,
  });
  assert.ok(result, "atteso risultato non-null");
  assert.equal(result.dayClass, "pesante");
  assert.equal(result.t, 1);
  assert.equal(result.kcalTarget, 5880);
  assertWithin1g(result.proteinG, 248, "PRO (62×4.0)");
  assertWithin1g(result.fatG, 186, "FAT (62×3.0)");
  // CHO = (5880 − 248×4.1 − 186×9)/4.1 ≈ 778 (fattori di Mario, non 4/4/9)
  assertWithin1g(result.choG, 778, "CHO dal residuo kcal");
  assert.equal(result.choDeficit, false);
  assert.deepEqual(result.mealCountRange, [5, 6]);
});

test("fedeltà (b): estremi di banda — ratio 1.55 → Leggero PRO 1.8 (continuità); ratio 2.15 → Pesante PRO 2.5 / FAT 1.8", () => {
  const at155 = classifyNutritionDay({ bmrKcal: 1000, leanMassKg: 62, consumoKcal: 1550 });
  assert.ok(at155);
  assert.equal(at155.dayClass, "leggero");
  assert.equal(at155.t, 0);
  assert.ok(Math.abs(at155.proteinGPerKgLean - 1.8) < 1e-9, `PRO a 1.55 atteso 1.8, trovato ${at155.proteinGPerKgLean}`);
  assert.ok(Math.abs(at155.fatGPerKgLean - 1.3) < 1e-9, "FAT a 1.55 parte da 1.3 (dente di sega VOLUTO)");

  // Continuità delle PROTEINE al confine: appena sotto 1.55 il Recupero arriva a ~1.8.
  const justBelow = classifyNutritionDay({ bmrKcal: 1000, leanMassKg: 62, consumoKcal: 1549.9 });
  assert.ok(justBelow);
  assert.equal(justBelow.dayClass, "recupero");
  assert.ok(
    Math.abs(justBelow.proteinG - at155.proteinG) <= 0.2,
    `continuità PRO al confine 1.55: ${justBelow.proteinG} vs ${at155.proteinG}`,
  );
  // ...mentre i GRASSI hanno il dente di sega (1.8 → 1.3): non smussato.
  assert.ok(justBelow.fatGPerKgLean > 1.79, `FAT Recupero a ridosso di 1.55 atteso ~1.8, trovato ${justBelow.fatGPerKgLean}`);

  const at215 = classifyNutritionDay({ bmrKcal: 1000, leanMassKg: 62, consumoKcal: 2150 });
  assert.ok(at215);
  assert.equal(at215.dayClass, "pesante");
  assert.equal(at215.t, 0);
  assert.ok(Math.abs(at215.proteinGPerKgLean - 2.5) < 1e-9, "PRO a 2.15 = 2.5 (gradino da tabella 2.4→2.5)");
  assert.ok(Math.abs(at215.fatGPerKgLean - 1.8) < 1e-9, "FAT a 2.15 = 1.8 (dente di sega 2.0→1.8 VOLUTO)");

  // Ancoraggio documentato: a ratio 1.60 esce PRO 1.85 (non 1.80) — conseguenza dei confini contigui.
  const at160 = classifyNutritionDay({ bmrKcal: 1000, leanMassKg: 62, consumoKcal: 1600 });
  assert.ok(at160);
  assert.ok(Math.abs(at160.proteinGPerKgLean - 1.85) < 1e-6, `PRO a 1.60 atteso 1.85, trovato ${at160.proteinGPerKgLean}`);
});

test("fedeltà (c): clamp — ratio 4.5 identico a 4.0; ratio 0.8 identico al minimo Recupero (1.0)", () => {
  const bmr = 1470;
  const lean = 62;
  const at40 = classifyNutritionDay({ bmrKcal: bmr, leanMassKg: lean, consumoKcal: bmr * 4.0 });
  const at45 = classifyNutritionDay({ bmrKcal: bmr, leanMassKg: lean, consumoKcal: bmr * 4.5 });
  assert.ok(at40 && at45);
  assert.equal(at45.dayClass, "pesante");
  assert.equal(at45.t, 1);
  assert.equal(at45.proteinGPerKgLean, at40.proteinGPerKgLean);
  assert.equal(at45.fatGPerKgLean, at40.fatGPerKgLean);
  assert.equal(at45.proteinG, at40.proteinG);
  assert.equal(at45.fatG, at40.fatG);

  const at10 = classifyNutritionDay({ bmrKcal: bmr, leanMassKg: lean, consumoKcal: bmr * 1.0 });
  const at08 = classifyNutritionDay({ bmrKcal: bmr, leanMassKg: lean, consumoKcal: bmr * 0.8 });
  assert.ok(at10 && at08);
  assert.equal(at08.dayClass, "recupero");
  assert.equal(at08.t, 0);
  assert.equal(at08.proteinGPerKgLean, at10.proteinGPerKgLean);
  assert.equal(at08.fatGPerKgLean, at10.fatGPerKgLean);
  assert.equal(at08.proteinG, at10.proteinG);
  assert.equal(at08.fatG, at10.fatG);
  assert.ok(Math.abs(at08.proteinGPerKgLean - 1.2) < 1e-9, "minimo Recupero PRO 1.2");
  assert.ok(Math.abs(at08.fatGPerKgLean - 1.2) < 1e-9, "minimo Recupero FAT 1.2");
});

test("sanità (d): griglia ratio 1.0→4.0 (passo 0.05) × lean {40,52,62,75} → CHO ≥ 0 e quota CHO 40–65% del target", () => {
  for (const lean of [40, 52, 62, 75]) {
    const bmr = katchMcArdle(lean);
    for (let i = 0; i <= 60; i += 1) {
      const ratio = 1 + i * 0.05;
      const result = classifyNutritionDay({
        bmrKcal: bmr,
        leanMassKg: lean,
        consumoKcal: bmr * ratio,
        strategiaPct: 100,
      });
      assert.ok(result, `risultato null a lean ${lean}, ratio ${ratio}`);
      assert.equal(result.choDeficit, false, `choDeficit a lean ${lean}, ratio ${ratio}`);
      assert.ok(result.choG >= 0, `CHO negativo a lean ${lean}, ratio ${ratio}`);
      const choKcalShare = (result.choG * MARIO_KCAL_PER_G.cho) / result.kcalTarget;
      assert.ok(
        choKcalShare >= 0.4 && choKcalShare <= 0.65,
        `quota CHO ${(choKcalShare * 100).toFixed(1)}% fuori da 40–65% a lean ${lean}, ratio ${ratio}`,
      );
    }
  }
});

test("strategiaPct: scala il target kcal (e quindi i CHO), NON la classe né le quote (ratio resta sul consumo)", () => {
  const base = classifyNutritionDay({ bmrKcal: 1700, leanMassKg: 62, consumoKcal: 3400, strategiaPct: 100 });
  const iper = classifyNutritionDay({ bmrKcal: 1700, leanMassKg: 62, consumoKcal: 3400, strategiaPct: 110 });
  const ipo = classifyNutritionDay({ bmrKcal: 1700, leanMassKg: 62, consumoKcal: 3400, strategiaPct: 90 });
  assert.ok(base && iper && ipo);
  assert.equal(iper.kcalTarget, Math.round(3400 * 1.1));
  assert.equal(ipo.kcalTarget, Math.round(3400 * 0.9));
  assert.equal(iper.dayClass, base.dayClass);
  assert.equal(ipo.dayClass, base.dayClass);
  assert.equal(iper.proteinG, base.proteinG);
  assert.equal(ipo.fatG, base.fatG);
  assert.ok(iper.choG > base.choG && ipo.choG < base.choG, "solo i CHO assorbono la strategia");
});

test("guardia CHO: residuo negativo → choG 0 + choDeficit true (mai throw)", () => {
  const result = classifyNutritionDay({ bmrKcal: 1000, leanMassKg: 100, consumoKcal: 1000 });
  assert.ok(result);
  assert.equal(result.choG, 0);
  assert.equal(result.choDeficit, true);
});

test("input mancanti/non validi → null, mai throw", () => {
  assert.equal(classifyNutritionDay({ bmrKcal: null, leanMassKg: 62, consumoKcal: 3000 }), null);
  assert.equal(classifyNutritionDay({ bmrKcal: 0, leanMassKg: 62, consumoKcal: 3000 }), null);
  assert.equal(classifyNutritionDay({ bmrKcal: -5, leanMassKg: 62, consumoKcal: 3000 }), null);
  assert.equal(classifyNutritionDay({ bmrKcal: 1700, leanMassKg: undefined, consumoKcal: 3000 }), null);
  assert.equal(classifyNutritionDay({ bmrKcal: 1700, leanMassKg: 0, consumoKcal: 3000 }), null);
  assert.equal(classifyNutritionDay({ bmrKcal: 1700, leanMassKg: 62, consumoKcal: Number.NaN }), null);
});

test("pasti per classe: Recupero [3,3], Leggero [4,5], Pesante [5,6]", () => {
  const recupero = classifyNutritionDay({ bmrKcal: 1700, leanMassKg: 62, consumoKcal: 1700 * 1.2 });
  const leggero = classifyNutritionDay({ bmrKcal: 1700, leanMassKg: 62, consumoKcal: 1700 * 1.8 });
  const pesante = classifyNutritionDay({ bmrKcal: 1700, leanMassKg: 62, consumoKcal: 1700 * 3.0 });
  assert.ok(recupero && leggero && pesante);
  assert.equal(recupero.dayClass, "recupero");
  assert.deepEqual(recupero.mealCountRange, [3, 3]);
  assert.equal(leggero.dayClass, "leggero");
  assert.deepEqual(leggero.mealCountRange, [4, 5]);
  assert.equal(pesante.dayClass, "pesante");
  assert.deepEqual(pesante.mealCountRange, [5, 6]);
});

test("tabelle distribuzione §5: ogni riga somma a 100", () => {
  const sum = (dist: MealDistribution) =>
    Object.values(dist).reduce((total, pct) => total + (pct ?? 0), 0);
  assert.equal(sum(MEAL_DISTRIBUTION_RECUPERO), 100);
  assert.equal(sum(MEAL_DISTRIBUTION_TRAINING_MATTINO.leggero), 100);
  assert.equal(sum(MEAL_DISTRIBUTION_TRAINING_MATTINO.pesante), 100);
  assert.equal(sum(MEAL_DISTRIBUTION_TRAINING_POMERIGGIO.leggero), 100);
  assert.equal(sum(MEAL_DISTRIBUTION_TRAINING_POMERIGGIO.pesante), 100);
});

test("lookupMealDistribution: recupero ignora l'orario; leggero/pesante seguono mattino/pomeriggio", () => {
  assert.equal(lookupMealDistribution("recupero", "mattino"), MEAL_DISTRIBUTION_RECUPERO);
  assert.equal(lookupMealDistribution("recupero", "pomeriggio"), MEAL_DISTRIBUTION_RECUPERO);
  assert.equal(lookupMealDistribution("leggero", "mattino"), MEAL_DISTRIBUTION_TRAINING_MATTINO.leggero);
  assert.equal(lookupMealDistribution("pesante", "mattino"), MEAL_DISTRIBUTION_TRAINING_MATTINO.pesante);
  assert.equal(lookupMealDistribution("leggero", "pomeriggio"), MEAL_DISTRIBUTION_TRAINING_POMERIGGIO.leggero);
  assert.equal(lookupMealDistribution("pesante", "pomeriggio"), MEAL_DISTRIBUTION_TRAINING_POMERIGGIO.pesante);
});

test("bande: confini contigui 1.55/2.15, tetto 4.00, quote da tabella", () => {
  assert.equal(DAY_CLASS_BANDS.length, 3);
  const [recupero, leggero, pesante] = DAY_CLASS_BANDS;
  assert.equal(recupero.ratioMax, leggero.ratioMin);
  assert.equal(leggero.ratioMax, pesante.ratioMin);
  assert.equal(pesante.ratioMax, 4.0);
  assert.equal(recupero.proMax, leggero.proMin); // continuità PRO a 1.55
  assert.ok(leggero.proMax < pesante.proMin); // gradino PRO 2.4→2.5 a 2.15
  assert.ok(recupero.fatMax > leggero.fatMin); // dente di sega FAT 1.8→1.3
  assert.ok(leggero.fatMax > pesante.fatMin); // dente di sega FAT 2.0→1.8
});
