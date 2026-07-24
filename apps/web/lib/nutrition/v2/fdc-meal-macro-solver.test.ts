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
  assert.equal(grams[1], 40);
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

test("cap fat-dense: formaggio protein_primary limitato ma mai sotto il minG dello spec", () => {
  // Formaggio (380 kcal/100g, fat 33 > pro 25) come proteina di colazione da 400 kcal:
  // cap 50% = 52 g < minG 80 → il pavimento dello spec vince (porzione sensata garantita).
  const roles = MEAL_SLOT_ASSEMBLY.breakfast;
  const lines = [
    { spec: roles[0]!, hit: hitKcal(250, 50, 8, 2) }, // pane
    { spec: roles[1]!, hit: hitKcal(380, 2, 25, 33) }, // formaggio
    { spec: roles[2]!, hit: hitKcal(884, 0, 0, 100) }, // olio
  ];
  const grams = solveFdcMealPortions(lines, { kcal: 400, carbsG: 45, proteinG: 25, fatG: 12 });
  assert.equal(grams[1], roles[1]!.minG);
});
