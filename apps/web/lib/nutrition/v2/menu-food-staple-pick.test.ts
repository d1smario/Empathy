import assert from "node:assert/strict";
import test from "node:test";
import type { MenuFoodEntry } from "@/lib/nutrition/v2/menu-food-catalog-db";
import {
  mealRotationStaplesFromComposedItems,
  pickStapleForPool,
  weekStapleCountForEntry,
} from "@/lib/nutrition/v2/fdc-staple-registry";

/** Entry catalogo con macro plausibili (stile riso) — l'indice differenzia fdcId e chiave. */
function menuEntry(i: number, overrides?: Partial<MenuFoodEntry>): MenuFoodEntry {
  return {
    canonicalKey: `food_${String(i).padStart(2, "0")}`,
    labelIt: `Cibo ${i}`,
    servingBasis: "dry_grams",
    rotationKey: undefined,
    carbFamily: undefined,
    fdcId: 10_000 + i,
    kcalPer100g: 360,
    carbsPer100g: 79,
    proteinPer100g: 7,
    fatPer100g: 0.6,
    isMeat: false,
    isFish: false,
    isAnimalProduct: false,
    ...overrides,
  };
}

test("pickStapleForPool con menuEntries: usa SOLO il catalogo (mai l'allowlist)", () => {
  const entries = [menuEntry(0, { canonicalKey: "rice_black", labelIt: "Riso venere", rotationKey: "carb:riso" })];
  const pick = pickStapleForPool({ poolKey: "lunch_carb", seed: 0, menuEntries: entries });
  assert.ok(pick);
  assert.equal(pick!.entry.canonicalKey, "rice_black");
  assert.equal(pick!.hit.description, "Riso venere"); // description = labelIt
  assert.equal(pick!.hit.fdcId, 10_000);
  assert.equal(pick!.hit.kcalPer100g, 360); // macro dal DB, non da CANONICAL_FOOD_TABLE
});

test("pickStapleForPool con menuEntries: filtro dieta sui flag espliciti", () => {
  const entries = [
    menuEntry(0, { canonicalKey: "meat_new", isMeat: true }),
    menuEntry(1, { canonicalKey: "fish_new", isFish: true }),
    menuEntry(2, { canonicalKey: "cheese_new", isAnimalProduct: true }),
    menuEntry(3, { canonicalKey: "legume_new" }),
  ];
  /** Enumera tutte le entry pescabili escludendo via usedFdcIds gli fdcId già scelti. */
  const pickAll = (dietType?: "omnivore" | "pescatarian" | "vegetarian" | "vegan") => {
    const keys = new Set<string>();
    const usedFdcIds = new Set<number>();
    for (let i = 0; i < 16; i += 1) {
      const p = pickStapleForPool({ poolKey: "lunch_pro", seed: 0, dietType, usedFdcIds, menuEntries: entries });
      if (!p) break;
      keys.add(p.entry.canonicalKey);
      usedFdcIds.add(p.hit.fdcId);
    }
    return keys;
  };
  assert.deepEqual([...pickAll("omnivore")].sort(), ["cheese_new", "fish_new", "legume_new", "meat_new"]);
  assert.ok(!pickAll("pescatarian").has("meat_new"));
  assert.ok(pickAll("pescatarian").has("fish_new"));
  assert.ok(!pickAll("vegetarian").has("meat_new"));
  assert.ok(!pickAll("vegetarian").has("fish_new"));
  assert.ok(pickAll("vegetarian").has("cheese_new"));
  assert.deepEqual([...pickAll("vegan")], ["legume_new"]);
});

test("pickStapleForPool senza menuEntries (tabella vuota/irraggiungibile): identico a oggi", () => {
  // Stessa attesa dei test storici sull'allowlist: seed 0 → pasta_dry in testa a lunch_carb.
  const fallback = pickStapleForPool({ poolKey: "lunch_carb", seed: 0 });
  assert.equal(fallback?.entry.canonicalKey, "pasta_dry");
  // menuEntries vuoto è trattato come assente (loader → null, mai array vuoto per pool noti).
  const emptyMenu = pickStapleForPool({ poolKey: "lunch_carb", seed: 0, menuEntries: [] });
  assert.equal(emptyMenu?.entry.canonicalKey, "pasta_dry");
});

test("pickStapleForPool con pool grande (50 entry): rotazione per seed e penalità settimanale", () => {
  const entries = Array.from({ length: 50 }, (_, i) => menuEntry(i, { rotationKey: `fam:${i % 10}` }));
  // Il seed sposta l'offset di partenza: seed k → entry di indice k.
  for (const seed of [0, 1, 7, 49]) {
    const p = pickStapleForPool({ poolKey: "lunch_carb", seed, menuEntries: entries });
    assert.equal(p?.entry.canonicalKey, entries[seed]!.canonicalKey, `seed ${seed}`);
  }
  // Deterministico: stesso seed → stessa scelta.
  const a = pickStapleForPool({ poolKey: "lunch_carb", seed: 13, menuEntries: entries });
  const b = pickStapleForPool({ poolKey: "lunch_carb", seed: 13, menuEntries: entries });
  assert.equal(a?.entry.canonicalKey, b?.entry.canonicalKey);
  // Seed grande (hash FNV) → offset = seed % 50, mai out-of-range.
  const big = pickStapleForPool({ poolKey: "lunch_carb", seed: 3_735_928_559, menuEntries: entries });
  assert.equal(big?.entry.canonicalKey, entries[3_735_928_559 % 50]!.canonicalKey);
  // Penalità settimanale sulla ROTATION KEY del catalogo: l'entry in testa cede alla successiva.
  const penalized = pickStapleForPool({
    poolKey: "lunch_carb",
    seed: 0,
    menuEntries: entries,
    dayCtx: { weekStapleCounts: { "fam:0": 2 }, dayUsedCanonicalKeys: new Set() },
  });
  assert.equal(penalized?.entry.canonicalKey, entries[1]!.canonicalKey);
});

test("weekStapleCountForEntry: conta per rotation key del catalogo (o canonical)", () => {
  const e = menuEntry(0, { canonicalKey: "rice_black", rotationKey: "carb:riso" });
  assert.equal(weekStapleCountForEntry(e, { "carb:riso": 2 }), 2);
  assert.equal(weekStapleCountForEntry(e, { rice_black: 1, "carb:riso": 2 }), 2); // vince il max
  assert.equal(weekStapleCountForEntry(menuEntry(1), { food_01: 3 }), 3); // senza famiglia → canonical
});

test("mealRotationStaplesFromComposedItems: rotationKey sull'item e resolver dal catalogo", () => {
  // 1. rotationKey sull'item composto (cibi nuovi in memoria) vince.
  assert.deepEqual(
    mealRotationStaplesFromComposedItems([{ canonicalKey: "rice_black", rotationKey: "carb:riso" }]),
    ["carb:riso"],
  );
  // 2. Solo canonical_key (riga DB) + resolver dal catalogo → famiglia.
  const resolver = (ck: string) => (ck === "rice_black" ? "carb:riso" : undefined);
  assert.deepEqual(mealRotationStaplesFromComposedItems([{ canonicalKey: "rice_black" }], resolver), ["carb:riso"]);
  // 3. Chiave storica senza resolver → costante hardcoded (comportamento invariato).
  assert.deepEqual(mealRotationStaplesFromComposedItems([{ canonicalKey: "pasta_dry" }]), ["carb:pasta"]);
  // 4. Chiave ignota ovunque → fallback canonical_key.
  assert.deepEqual(mealRotationStaplesFromComposedItems([{ canonicalKey: "novel_food" }]), ["novel_food"]);
});
