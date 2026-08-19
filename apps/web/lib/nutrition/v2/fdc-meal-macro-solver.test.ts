import assert from "node:assert/strict";
import test from "node:test";
import { solveFdcMealPortions } from "@/lib/nutrition/v2/fdc-meal-macro-solver";
import { MEAL_SLOT_ASSEMBLY } from "@/lib/nutrition/v2/meal-slot-assembly-spec";
import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";

const hit = (cho: number, pro: number, fat: number): FdcFoodBrowseHit => ({
  fdcId: 1,
  description: "Pasta, cooked",
  kcalPer100g: 160,
  proteinPer100g: pro,
  carbsPer100g: cho,
  fatPer100g: fat,
  tags: {
    mealCourse: [],
    foodFamily: [],
    macroDominant: [],
    slotFit: [],
    dietProfile: [],
    dietExclude: [],
    mealRole: [],
    aminoProfile: [],
    nutrientDensity: [],
    classifierVersion: "t",
  },
  tagSource: "db",
});

test("solveFdcMealPortions hits Diet slot macros", () => {
  const roles = MEAL_SLOT_ASSEMBLY.lunch;
  const lines = [
    { spec: roles[0]!, hit: hit(30, 5, 1) },
    { spec: roles[1]!, hit: hit(0, 31, 3) },
    { spec: roles[2]!, hit: hit(4, 3, 0) },
  ];
  const grams = solveFdcMealPortions(lines, { kcal: 900, carbsG: 115, proteinG: 57, fatG: 26 });
  const cho = lines.reduce((a, l, i) => a + (grams[i]! / 100) * l.hit.carbsPer100g, 0);
  assert.ok(cho >= 108, `cho ${cho}`);
});

/** Come `hit` ma con kcal esplicite: il cap fat-dense ragiona sulle kcal reali dell'alimento. */
const hitKcal = (kcal: number, cho: number, pro: number, fat: number): FdcFoodBrowseHit => ({
  ...hit(cho, pro, fat),
  kcalPer100g: kcal,
});

test("cap fat-dense: mandorle protein_secondary non esplodono le kcal dello slot", () => {
  // Worst case «semi»: mandorle (579 kcal/100g, fat 50 > pro 21) su spuntino da 250 kcal.
  // Senza cap il solver le portava a 65-70 g per chiudere le proteine → slot ~463 kcal (1.85×).
  const roles = MEAL_SLOT_ASSEMBLY.snack_pm;
  const lines = [
    { spec: roles[0]!, hit: hitKcal(89, 23, 1.1, 0.3) }, // banana
    { spec: roles[1]!, hit: hitKcal(579, 22, 21, 50) }, // mandorle
  ];
  const target = { kcal: 250, carbsG: 30, proteinG: 15, fatG: 8 };
  const grams = solveFdcMealPortions(lines, target);
  // Cap 50% kcal (21.6 g) sotto il minG 40 → vince il pavimento dello spec: 40 g di mandorle.
  // Il pavimento del fat-dense è ENERGETICO: ~50% del target (125 kcal → 20 g di mandorle),
  // non i 40 g pensati per gli affettati. Mai sotto i 20 g (porzione minima sensata).
  assert.equal(grams[1], 20);
  const kcal = lines.reduce((a, l, i) => a + (grams[i]! / 100) * l.hit.kcalPer100g, 0);
  assert.ok(kcal <= target.kcal * 1.3, `kcal slot ${kcal} > 1.3× target ${target.kcal}`);
});

test("cap fat-dense: pollo e yogurt (pro > fat) restano INVARIATI", () => {
  // Alimenti proteici normali: il tetto effettivo resta il maxG dello spec → stessi grammi
  // del solver pre-cap, byte-per-byte (valori catturati dal solver senza cap sugli stessi input).
  const lunch = MEAL_SLOT_ASSEMBLY.lunch;
  const lunchLines = [
    { spec: lunch[0]!, hit: hitKcal(160, 30, 5, 1) }, // pasta
    { spec: lunch[1]!, hit: hitKcal(165, 0, 31, 3) }, // pollo
    { spec: lunch[2]!, hit: hitKcal(30, 4, 3, 0) }, // verdura
  ];
  assert.deepEqual(
    solveFdcMealPortions(lunchLines, { kcal: 900, carbsG: 115, proteinG: 57, fatG: 26 }),
    [365, 115, 120],
  );

  const snack = MEAL_SLOT_ASSEMBLY.snack_pm;
  const yogLines = [
    { spec: snack[0]!, hit: hitKcal(89, 23, 1.1, 0.3) }, // banana
    { spec: snack[1]!, hit: hitKcal(59, 3.6, 10, 0.4) }, // yogurt greco
  ];
  assert.deepEqual(solveFdcMealPortions(yogLines, { kcal: 250, carbsG: 30, proteinG: 15, fatG: 4 }), [110, 140]);
});

test("cap fat-dense: formaggio protein_primary limitato dal pavimento ENERGETICO (≈50% slot), mai sotto 20 g", () => {
  // Formaggio (380 kcal/100g, fat 33 > pro 25) come proteina di colazione da 400 kcal:
  // cap 50% = 52 g < minG 80 → il pavimento dello spec vince (porzione sensata garantita).
  const roles = MEAL_SLOT_ASSEMBLY.breakfast;
  const lines = [
    { spec: roles[0]!, hit: hitKcal(250, 50, 8, 2) }, // pane
    { spec: roles[1]!, hit: hitKcal(380, 2, 25, 33) }, // formaggio
    { spec: roles[2]!, hit: hitKcal(884, 0, 0, 100) }, // olio
  ];
  const grams = solveFdcMealPortions(lines, { kcal: 400, carbsG: 45, proteinG: 25, fatG: 12 });
  // Prima il formaggio restava a minG 80 g (304 kcal su una colazione): ora il pavimento è
  // energetico e scende a 50 g (~190 kcal, metà slot), il resto lo coprono pane e olio.
  assert.ok(grams[1]! < roles[1]!.minG, `formaggio ${grams[1]} g: il minG in grammi non è più il pavimento sul fat-dense`);
  assert.ok(grams[1]! >= 20);
});

const hitK = (kcal: number, cho: number, pro: number, fat: number): FdcFoodBrowseHit => ({ ...hit(cho, pro, fat), kcalPer100g: kcal });

test("spuntino: l'alimento fat-dense (nocciole) non sfora più lo slot per colpa del minimo in grammi", () => {
  // Caso misurato in shadow sui piani reali: fichi secchi 30 g + NOCCIOLE 40 g su un target da 220 kcal
  // usciva a ~405 kcal (+185), perché minG 40 del ruolo vale 77 kcal di bresaola ma 258 di nocciole.
  const roles = MEAL_SLOT_ASSEMBLY.snack_am;
  const lines = [
    { spec: roles[0]!, hit: hitK(249, 64, 3.3, 0.9) },   // fichi secchi
    { spec: roles[1]!, hit: hitK(646, 17, 15, 62) },     // nocciole tostate (fat-dense)
  ];
  const target = { kcal: 220, carbsG: 30, proteinG: 8, fatG: 8 };
  const grams = solveFdcMealPortions(lines, target);
  const kcal = lines.reduce((a, l, i) => a + (grams[i]! / 100) * l.hit.kcalPer100g, 0);
  assert.ok(grams[1]! < 40, `nocciole ${grams[1]} g: il pavimento in grammi non è più 40 sul fat-dense`);
  assert.ok(grams[1]! >= 20, `nocciole ${grams[1]} g: mai sotto la porzione minima sensata`);
  assert.ok(kcal <= target.kcal * 1.25, `spuntino ${kcal.toFixed(0)} kcal su target 220: lo sforamento da +85% è rientrato`);
});

test("spuntino: la proteina magra (bresaola) tiene il suo minimo di 40 g — il pavimento energetico vale solo per il fat-dense", () => {
  const roles = MEAL_SLOT_ASSEMBLY.snack_am;
  const lines = [
    { spec: roles[0]!, hit: hitK(249, 64, 3.3, 0.9) },
    { spec: roles[1]!, hit: hitK(151, 0, 32, 2.6) },      // bresaola: proteina > grasso
  ];
  const grams = solveFdcMealPortions(lines, { kcal: 220, carbsG: 30, proteinG: 8, fatG: 8 });
  assert.ok(grams[1]! >= 40, `bresaola ${grams[1]} g: il minimo storico resta`);
});
