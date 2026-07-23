import assert from "node:assert/strict";
import test from "node:test";
import { CANONICAL_FOOD_TABLE } from "@/lib/nutrition/canonical-food-composition";
import { fdcIdForCanonicalKey } from "@/lib/nutrition/canonical-food-fdc-aliases";
import { isPlausiblePer100gMacros } from "@/lib/nutrition/macro-plausibility";
import {
  pickStapleForPool,
  STAPLE_ALLOWLIST_BY_POOL,
  stapleRegistryKeysForPool,
} from "@/lib/nutrition/v2/fdc-staple-registry";

test("staple registry: ogni pool principale ha almeno 3 chiavi", () => {
  for (const key of ["breakfast_cho", "lunch_carb", "lunch_pro", "dinner_carb", "dinner_pro"]) {
    assert.ok(stapleRegistryKeysForPool(key).length >= 3, key);
  }
});

test("staple registry: macro plausibili per ogni entry", () => {
  for (const list of Object.values(STAPLE_ALLOWLIST_BY_POOL)) {
    for (const e of list) {
      const row = CANONICAL_FOOD_TABLE[e.canonicalKey];
      assert.ok(row?.kcalPer100g, e.canonicalKey);
      assert.ok(
        isPlausiblePer100gMacros({
          kcal_100: row.kcalPer100g,
          carbs_100: row.carbsG,
          protein_100: row.proteinG,
          fat_100: row.fatG,
        }),
        e.canonicalKey,
      );
    }
  }
});

test("staple registry: ogni entry ha alias fdc_id e label italiana", () => {
  for (const list of Object.values(STAPLE_ALLOWLIST_BY_POOL)) {
    for (const e of list) {
      const fdcId = fdcIdForCanonicalKey(e.canonicalKey);
      assert.ok(typeof fdcId === "number" && fdcId > 0, `alias mancante: ${e.canonicalKey}`);
      assert.ok(e.labelIt && !e.labelIt.includes("_"), `label mancante: ${e.canonicalKey}`);
    }
  }
});

test("filterByDiet: vegetarian esclude carni e pesci, vegan anche latticini/uova/miele", () => {
  /** Enumera TUTTE le entry pescabili del pool: ad ogni pick esclude l'fdcId scelto e ripete. */
  const pickKeys = (poolKey: string, dietType?: "omnivore" | "pescatarian" | "vegetarian" | "vegan") => {
    const keys = new Set<string>();
    const usedFdcIds = new Set<number>();
    for (let i = 0; i < 64; i += 1) {
      const p = pickStapleForPool({ poolKey, seed: 7, dietType, usedFdcIds });
      if (!p) break;
      if (keys.has(p.entry.canonicalKey)) break;
      keys.add(p.entry.canonicalKey);
      usedFdcIds.add(p.hit.fdcId);
    }
    return keys;
  };
  const meats = ["chicken_breast", "beef_lean", "turkey_breast", "pork_loin", "lamb_leg", "rabbit", "veal_loin", "ham_cooked"];
  const fishes = ["fish_white", "tuna_canned", "mackerel_atlantic", "sardines", "shrimp", "octopus", "squid", "cod_raw"];
  for (const k of [...meats, ...fishes]) {
    assert.ok(!pickKeys("lunch_pro", "vegetarian").has(k), `vegetarian non deve pescare ${k}`);
    assert.ok(!pickKeys("lunch_pro", "vegan").has(k), `vegan non deve pescare ${k}`);
  }
  for (const k of meats) {
    assert.ok(!pickKeys("lunch_pro", "pescatarian").has(k), `pescatarian non deve pescare ${k}`);
  }
  assert.ok(!pickKeys("breakfast_pro", "vegan").has("yogurt_greek"), "vegan: no yogurt greco");
  assert.ok(!pickKeys("breakfast_pro", "vegan").has("milk_whole"), "vegan: no latte");
  assert.ok(!pickKeys("breakfast_cho", "vegan").has("honey"), "vegan: no miele");
  assert.ok(pickKeys("lunch_pro", "vegan").size > 0, "vegan: pool proteico non vuoto");
});

test("pickStapleForPool: lunch carb non sceglie junk", () => {
  const pick = pickStapleForPool({ poolKey: "lunch_carb", seed: 42 });
  assert.ok(pick);
  assert.ok(!/chip|snack|beverage/i.test(pick.entry.labelIt));
  assert.ok(["pasta_dry", "rice_dry", "potato_cooked", "farro_dry", "quinoa_dry"].includes(pick.entry.canonicalKey));
});

test("pickStapleForPool: dedupe stesso carb (riso) pranzo+cena; pasta pranzo non blocca riso cena", () => {
  // seed 0 → dayOffset 0 → ordine originale del pool (rice in testa a dinner_carb).
  const usedRiso = new Set<string>(["carb:riso"]);
  const noRice = pickStapleForPool({
    poolKey: "dinner_carb",
    seed: 0,
    usedCarbFamilies: usedRiso,
  });
  assert.ok(!noRice || noRice.entry.canonicalKey !== "rice_dry");

  const usedPasta = new Set<string>(["carb:pasta"]);
  const dinnerAfterPastaLunch = pickStapleForPool({
    poolKey: "dinner_carb",
    seed: 0,
    usedCarbFamilies: usedPasta,
  });
  assert.ok(dinnerAfterPastaLunch);
  assert.equal(dinnerAfterPastaLunch!.entry.canonicalKey, "rice_dry");
});

test("pickStapleForPool: rotazione per seed — l'offset sposta l'ordine del pool", () => {
  // lunch_carb: idx 0 = pasta_dry, idx 1 = rice_dry, idx 2 = potato_cooked.
  const pick0 = pickStapleForPool({ poolKey: "lunch_carb", seed: 0 });
  const pick1 = pickStapleForPool({ poolKey: "lunch_carb", seed: 1 });
  const pick2 = pickStapleForPool({ poolKey: "lunch_carb", seed: 2 });
  assert.equal(pick0?.entry.canonicalKey, "pasta_dry");
  assert.equal(pick1?.entry.canonicalKey, "rice_dry");
  assert.equal(pick2?.entry.canonicalKey, "potato_cooked");

  // Deterministico: stesso seed → stessa scelta.
  const again = pickStapleForPool({ poolKey: "lunch_carb", seed: 1 });
  assert.equal(again?.entry.canonicalKey, pick1?.entry.canonicalKey);

  // Seed grande (hash FNV): offset = seed % poolSize, mai out-of-range.
  const poolSize = stapleRegistryKeysForPool("lunch_carb").length;
  const big = pickStapleForPool({ poolKey: "lunch_carb", seed: 3_735_928_559 });
  const expectedIdx = 3_735_928_559 % poolSize;
  assert.equal(big?.entry.canonicalKey, stapleRegistryKeysForPool("lunch_carb")[expectedIdx]);
});

test("pickStapleForPool: la penalità settimanale vince sulla rotazione", () => {
  // seed 0 → pasta_dry in testa; ma pasta già usata 2 volte in settimana → deve cedere.
  const withTargetUses = pickStapleForPool({
    poolKey: "lunch_carb",
    seed: 0,
    dayCtx: { weekStapleCounts: { "carb:pasta": 2 }, dayUsedCanonicalKeys: new Set() },
  });
  assert.ok(withTargetUses);
  assert.notEqual(withTargetUses!.entry.canonicalKey, "pasta_dry");
  assert.equal(withTargetUses!.entry.canonicalKey, "rice_dry");

  // Anche 1 solo uso (-80) supera il gap di rotazione (10/posizione fra i primi).
  const withOneUse = pickStapleForPool({
    poolKey: "lunch_carb",
    seed: 0,
    dayCtx: { weekStapleCounts: { "carb:pasta": 1 }, dayUsedCanonicalKeys: new Set() },
  });
  assert.equal(withOneUse?.entry.canonicalKey, "rice_dry");
});
