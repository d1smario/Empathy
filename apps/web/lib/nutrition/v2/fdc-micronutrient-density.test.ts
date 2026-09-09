import test from "node:test";
import assert from "node:assert/strict";
import {
  compareMicroDensity,
  extractMicrosPer100g,
  normalizeNutrientTargets,
} from "@/lib/nutrition/v2/fdc-micronutrient-density";

const min = (id: number, amt: number, name = "x", unit = "mg") => ({
  nutrientId: id,
  amountPer100g: amt,
  name,
  unit,
});

test("estrae ferro, zinco e B12 dagli id USDA", () => {
  const m = extractMicrosPer100g(
    [min(1089, 2.7, "Iron, Fe"), min(1095, 4.2, "Zinc, Zn"), min(1099, 41.2, "Fluoride, F")],
    [min(1178, 0.9, "Vitamin B-12", "µg")],
  );
  assert.equal(m.fe_mg, 2.7);
  assert.equal(m.zn_mg, 4.2);
  assert.equal(m.vitB12_mcg, 0.9);
  // Il fluoro non è un target: non deve entrare nel bagaglio che viaggia col pool.
  assert.equal(Object.keys(m).length, 3);
});

test("somma le forme diverse dello stesso target (folati)", () => {
  const m = extractMicrosPer100g([min(1177, 30), min(1187, 12), min(1190, 8)]);
  assert.equal(m.folate_mcg, 50);
});

test("ignora colonne assenti, valori non numerici e negativi", () => {
  assert.deepEqual(extractMicrosPer100g(null, undefined, "non un array"), {});
  assert.deepEqual(extractMicrosPer100g([min(1089, Number.NaN)]), {});
  assert.deepEqual(extractMicrosPer100g([{ nutrientId: 1089, amountPer100g: -3 }]), {});
  assert.deepEqual(extractMicrosPer100g([{ amountPer100g: 5 }]), {});
});

test("il confronto segue l'ORDINE dei target, non la somma", () => {
  const ricco_ferro = { fe_mg: 5, zn_mg: 1 };
  const ricco_zinco = { fe_mg: 4.9, zn_mg: 40 };
  // Ferro primo: vince chi ha più ferro, anche se l'altro ha molto più zinco.
  assert.ok(compareMicroDensity(ricco_ferro, ricco_zinco, ["fe_mg", "zn_mg"]) > 0);
  // Zinco primo: si ribalta.
  assert.ok(compareMicroDensity(ricco_ferro, ricco_zinco, ["zn_mg", "fe_mg"]) < 0);
});

test("passa al target successivo solo a parità del primo", () => {
  const a = { fe_mg: 3, zn_mg: 9 };
  const b = { fe_mg: 3, zn_mg: 2 };
  assert.ok(compareMicroDensity(a, b, ["fe_mg", "zn_mg"]) > 0);
});

test("differenze sotto l'1% non contano: è lo stesso alimento arrotondato", () => {
  assert.equal(compareMicroDensity({ fe_mg: 3.0 }, { fe_mg: 3.02 }, ["fe_mg"]), 0);
  assert.ok(compareMicroDensity({ fe_mg: 3.0 }, { fe_mg: 3.5 }, ["fe_mg"]) < 0);
});

test("un alimento senza dati micro non batte mai uno che ne ha", () => {
  assert.ok(compareMicroDensity(undefined, { fe_mg: 2 }, ["fe_mg"]) < 0);
  assert.ok(compareMicroDensity({ fe_mg: 2 }, undefined, ["fe_mg"]) > 0);
  assert.equal(compareMicroDensity(undefined, undefined, ["fe_mg"]), 0);
});

test("senza target attivi il confronto è sempre indifferente", () => {
  assert.equal(compareMicroDensity({ fe_mg: 99 }, { fe_mg: 0 }, []), 0);
});

test("normalizza i target scartando gli id sconosciuti e i doppioni", () => {
  const out = normalizeNutrientTargets([
    { nutrientId: "fe_mg" },
    { nutrientId: "inventato_mg" },
    { nutrientId: "fe_mg" },
    { nutrientId: "vitB12_mcg" },
    {},
  ]);
  assert.deepEqual(out, ["fe_mg", "vitB12_mcg"]);
});

test("target assenti o non-array danno lista vuota", () => {
  assert.deepEqual(normalizeNutrientTargets(null), []);
  assert.deepEqual(normalizeNutrientTargets(undefined), []);
});
