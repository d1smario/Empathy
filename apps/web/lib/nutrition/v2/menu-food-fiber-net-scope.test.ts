import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMenuFoodFiberFermentedIndex,
  type MenuFoodEntry,
  mapMenuFoodRows,
} from "@/lib/nutrition/v2/menu-food-catalog-db";
import { isPreEffortExcludedFood, isPreEffortExcludedHit } from "@/lib/nutrition/v2/pre-effort-food-filter";

/**
 * REGOLA 2 di Mario — DOVE la rete sulla fibra può misurare, e dove deve tacere.
 *
 * La soglia sulla fibra è un confronto DENTRO una popolazione. Fino a ieri la popolazione
 * era la sola base di porzione, e `serving_basis` non è un asse crudo/cotto: è come il
 * catalogo pesa quell'alimento. Risultato provato: il CORNETTO (2,6 g/100 g, base
 * `cooked_grams`) usciva dalla colazione pre-sforzo confrontato con la soglia dei cereali
 * COTTI (2,5), in mezzo a confetture e miele. Un cornetto non è né un cereale integrale né
 * un alimento ricco di fibre: usciva per un artefatto della base di misura.
 *
 * Ora la popolazione è la coppia (POOL, BASE) — vedi `FIBER_NET_POOL_BASES` — più i legumi,
 * che sono ricchi di fibre ovunque stiano. Fuori di lì decidono le due colonne DICHIARATE
 * (`is_fermented`, `is_wholegrain`), che sono curate a mano e non stimate.
 *
 * Alimenti, pool, basi, fibre, fdcId e `substitution_group` sono quelli VERI di
 * `nutrition_menu_foods` + `nutrition_menu_food_meal_roles` + `nutrition_fdc_foods`
 * (prod ggmpegwnzbrjkeiydwqu, letti il 2026-09-08), e passano dal MAPPING VERO del loader
 * (`mapMenuFoodRows`) e dall'indice vero (`buildMenuFoodFiberFermentedIndex`): il test non
 * costruisce entry a mano, altrimenti proverebbe una pipeline che non esiste.
 */

type Row = {
  key: string;
  label: string;
  fdcId: number;
  pools: string[];
  basis: "dry_grams" | "cooked_grams" | "ml";
  rotationKey: string | null;
  substitutionGroup: string | null;
  wholegrain: boolean;
  fermented?: boolean;
  fiber: number | null;
  kcal: number;
};

const CATALOGO: Row[] = [
  // ── Cereali/carboidrati: la rete vale, la soglia è quella della loro base ──────────
  { key: "pasta_dry", label: "Pasta di semola", fdcId: 168927, pools: ["lunch_carb", "dinner_carb"],
    basis: "dry_grams", rotationKey: "carb:pasta", substitutionGroup: "MAIN_COMPLEX_CARB", wholegrain: false, fiber: 3.2, kcal: 371 },
  { key: "rice_parboiled", label: "Riso parboiled", fdcId: 169758, pools: ["lunch_carb", "dinner_carb"],
    basis: "dry_grams", rotationKey: "carb:riso", substitutionGroup: "MAIN_COMPLEX_CARB", wholegrain: false, fiber: 1.8, kcal: 374 },
  { key: "corn_flakes", label: "Corn flakes", fdcId: 174648, pools: ["breakfast_cho"],
    basis: "dry_grams", rotationKey: "breakfast:cereali", substitutionGroup: "BREAKFAST_COMPLEX_CARB", wholegrain: false, fiber: 2.7, kcal: 384 },
  { key: "bread_white", label: "Pane", fdcId: 174925, pools: ["breakfast_cho"],
    basis: "dry_grams", rotationKey: "breakfast:bread", substitutionGroup: "BREAD_BASED_CARB", wholegrain: false, fiber: 2.9, kcal: 290 },
  { key: "potato_cooked", label: "Patate", fdcId: 170093, pools: ["lunch_carb", "dinner_carb"],
    basis: "cooked_grams", rotationKey: "carb:patate", substitutionGroup: "MAIN_COMPLEX_CARB", wholegrain: false, fiber: 2.2, kcal: 93 },
  { key: "barley_pearled", label: "Orzo perlato", fdcId: 170285, pools: ["lunch_carb", "dinner_carb"],
    basis: "cooked_grams", rotationKey: "carb:orzo", substitutionGroup: "MAIN_COMPLEX_CARB", wholegrain: false, fiber: 3.8, kcal: 123 },
  { key: "chestnuts", label: "Castagne", fdcId: 170190, pools: ["lunch_carb", "dinner_carb"],
    basis: "cooked_grams", rotationKey: "carb:castagne", substitutionGroup: "GENERIC", wholegrain: false, fiber: 5.1, kcal: 245 },
  { key: "pasta_legumes", label: "Pasta di legumi", fdcId: 900009876, pools: ["lunch_carb", "dinner_carb"],
    basis: "cooked_grams", rotationKey: "carb:pasta_legumi", substitutionGroup: "MAIN_COMPLEX_CARB", wholegrain: false, fiber: 4.9, kcal: 168 },
  // ── Integrali dichiarati: li prende la colonna, non la soglia ─────────────────────
  { key: "rice_brown", label: "Riso integrale", fdcId: 169704, pools: ["lunch_carb", "dinner_carb"],
    basis: "cooked_grams", rotationKey: "carb:riso", substitutionGroup: "MAIN_COMPLEX_CARB", wholegrain: true, fiber: 1.6, kcal: 123 },
  { key: "farro_dry", label: "Farro", fdcId: 169746, pools: ["lunch_carb", "dinner_carb"],
    basis: "dry_grams", rotationKey: "carb:farro", substitutionGroup: "MAIN_COMPLEX_CARB", wholegrain: true, fiber: 3.9, kcal: 127 },
  { key: "oat_dry", label: "Fiocchi d'avena", fdcId: 172989, pools: ["breakfast_cho"],
    basis: "dry_grams", rotationKey: "breakfast:oat", substitutionGroup: "BREAKFAST_COMPLEX_CARB", wholegrain: true, fiber: 9.4, kcal: 371 },
  { key: "muesli", label: "Muesli", fdcId: 900032138, pools: ["breakfast_cho"],
    basis: "dry_grams", rotationKey: "breakfast:muesli", substitutionGroup: "BREAKFAST_COMPLEX_CARB", wholegrain: true, fiber: 9.8, kcal: 371 },
  // ── Legumi: ricchi di fibre ovunque stiano, anche fuori dai pool dei carboidrati ──
  { key: "chickpeas_cooked", label: "Ceci", fdcId: 173799, pools: ["lunch_pro", "dinner_pro"],
    basis: "cooked_grams", rotationKey: "prot:ceci", substitutionGroup: "PLANT_PROTEIN", wholegrain: false, fiber: 7.6, kcal: 164 },
  { key: "lentils_red", label: "Lenticchie rosse", fdcId: 174284, pools: ["lunch_pro", "dinner_pro"],
    basis: "dry_grams", rotationKey: "prot:lenticchie", substitutionGroup: "PLANT_PROTEIN", wholegrain: false, fiber: 10.8, kcal: 358 },
  { key: "lupins", label: "Lupini", fdcId: 172424, pools: ["lunch_pro", "dinner_pro"],
    basis: "cooked_grams", rotationKey: "prot:lupini", substitutionGroup: "PLANT_PROTEIN", wholegrain: false, fiber: 2.8, kcal: 119 },
  // Hummus: nessuna rotation_key, lo dichiara solo il gruppo di sostituzione.
  { key: "hummus", label: "Hummus", fdcId: 174289, pools: ["snack_pro"],
    basis: "dry_grams", rotationKey: null, substitutionGroup: "PLANT_PROTEIN", wholegrain: false, fiber: 5.5, kcal: 237 },
  // Tofu: PLANT_PROTEIN come i legumi, ma la sua fibra sta sotto la soglia → resta.
  { key: "tofu_firm", label: "Tofu", fdcId: 172475, pools: ["lunch_pro", "dinner_pro"],
    basis: "dry_grams", rotationKey: "prot:tofu", substitutionGroup: "PLANT_PROTEIN", wholegrain: false, fiber: 2.3, kcal: 144 },
  // ── Dove la rete NON può misurare ────────────────────────────────────────────────
  // Cornetto e crema di cacao: base «come si mangia» dentro breakfast_cho, cioè in mezzo a
  // confetture, miele e sciroppi. Non sono cereali cotti e non si confrontano con quella soglia.
  { key: "croissant_butter", label: "Cornetto", fdcId: 174987, pools: ["breakfast_cho"],
    basis: "cooked_grams", rotationKey: "breakfast:croissant", substitutionGroup: "BREAKFAST_SWEET_OCCASIONAL", wholegrain: false, fiber: 2.6, kcal: 406 },
  { key: "hazelnut_cocoa_spread", label: "Crema di cacao e nocciole", fdcId: 168000, pools: ["breakfast_cho"],
    basis: "cooked_grams", rotationKey: "breakfast:confettura", substitutionGroup: "BREAKFAST_FAT_NUTS", wholegrain: false, fiber: 5.4, kcal: 539 },
  { key: "almonds_raw", label: "Mandorle", fdcId: 2346393, pools: ["breakfast_fat", "snack_pro"],
    basis: "dry_grams", rotationKey: null, substitutionGroup: "BREAKFAST_FAT_NUTS", wholegrain: false, fiber: 10.8, kcal: 579 },
  { key: "figs_dried", label: "Fichi secchi", fdcId: 174665, pools: ["snack_cho"],
    basis: "dry_grams", rotationKey: "cho:fichi", substitutionGroup: "FRUIT", wholegrain: false, fiber: 9.8, kcal: 249 },
  // ── Controlli: il fermentato cade comunque, la carne resta ───────────────────────
  { key: "yogurt_greek", label: "Yogurt greco", fdcId: 170903, pools: ["breakfast_pro", "snack_pro"],
    basis: "dry_grams", rotationKey: "breakfast:yogurt", substitutionGroup: "BREAKFAST_PROTEIN_DAIRY", wholegrain: false, fermented: true, fiber: 0, kcal: 73 },
  { key: "chicken_breast", label: "Petto di pollo", fdcId: 171077, pools: ["lunch_pro", "dinner_pro"],
    basis: "dry_grams", rotationKey: "prot:pollo", substitutionGroup: "WHITE_MEAT", wholegrain: false, fiber: 0, kcal: 120 },
];

function pools(rows: readonly Row[] = CATALOGO) {
  const mapped = mapMenuFoodRows(
    rows.map((r) => ({
      canonical_key: r.key,
      fdc_id: r.fdcId,
      label_it: r.label,
      serving_basis: r.basis,
      pool_keys: r.pools,
      rotation_key: r.rotationKey,
      carb_family: null,
      is_meat: r.key === "chicken_breast",
      is_fish: false,
      is_animal_product: ["chicken_breast", "yogurt_greek"].includes(r.key),
      is_fermented: r.fermented === true,
      is_wholegrain: r.wholegrain,
      sort_priority: 100,
    })),
    rows.map((r) => ({
      fdc_id: r.fdcId,
      kcal_100g: r.kcal,
      carbs_100g: 50,
      protein_100g: 10,
      fat_100g: 5,
      fiber_100g: r.fiber,
    })),
    rows.map((r) => ({
      canonical_key: r.key,
      score_breakfast: "5",
      score_snack: "5",
      score_lunch: "5",
      score_dinner: "5",
      score_pre_workout: "5",
      score_post_workout: "5",
      role_breakfast: "NONE",
      role_snack: "NONE",
      role_lunch: "NONE",
      role_dinner: "NONE",
      macro_role: "MIXED",
      frequency: "COMMON",
      max_week: 7,
      prep_speed: 5,
      substitution_group: r.substitutionGroup,
    })),
  );
  assert.ok(mapped, "fixture non mappabile");
  return mapped;
}

/** Verdetto pre-sforzo sull'alimento, per la strada vera: riga di catalogo + indice fdcId. */
function esclusi(rows: readonly Row[] = CATALOGO): Set<string> {
  const mapped = pools(rows);
  const restriction = { foodIndex: buildMenuFoodFiberFermentedIndex(mapped), why: "test" };
  const out = new Set<string>();
  const seen = new Set<MenuFoodEntry>();
  for (const list of mapped.values()) {
    for (const e of list) {
      if (seen.has(e)) continue;
      seen.add(e);
      if (isPreEffortExcludedFood(e, restriction, e.fdcId)) out.add(e.labelIt);
    }
  }
  return out;
}

test("la rete sulla fibra vale nei pool dei cereali/carboidrati e sui legumi", () => {
  const fuori = esclusi();
  for (const label of [
    "Orzo perlato", // 3,8 cotto in lunch_carb: NON è dichiarato integrale, lo prende solo la soglia
    "Castagne", // 5,1 cotto
    "Pasta di legumi", // 4,9 cotto
    "Ceci", // 7,6 cotto, legume in lunch_pro
    "Lenticchie rosse", // 10,8 secco, legume in lunch_pro
    "Lupini", // 2,8 cotto: il legume più magro di fibra, ed esce lo stesso
    "Hummus", // 5,5 secco in snack_pro: lo dichiara PLANT_PROTEIN, non la rotation_key
  ]) {
    assert.ok(fuori.has(label), `«${label}» dovrebbe restare fuori dai pasti pre-sforzo`);
  }
});

test("le due colonne dichiarate decidono da sole: integrali e fermentati restano fuori", () => {
  const fuori = esclusi();
  for (const label of [
    "Riso integrale", // 1,6 cotto: sotto ogni soglia, lo prende is_wholegrain
    "Farro", // 3,9 secco: idem
    "Fiocchi d'avena",
    "Muesli",
    "Yogurt greco",
  ]) {
    assert.ok(fuori.has(label), `«${label}» dovrebbe restare fuori dai pasti pre-sforzo`);
  }
});

test("i classici di Mario restano nel piatto pre-sforzo", () => {
  const fuori = esclusi();
  for (const label of ["Pasta di semola", "Riso parboiled", "Corn flakes", "Pane", "Patate", "Tofu", "Petto di pollo"]) {
    assert.ok(!fuori.has(label), `«${label}» escluso: la regola sta mangiando i cereali classici`);
  }
});

test("dove il confronto non ha senso la rete TACE: il cornetto resta a colazione", () => {
  const fuori = esclusi();
  // Il caso provato dai revisori: 2,6 g/100 g su base `cooked_grams` non è «ricco di fibre»,
  // è un cornetto intero pesato come si mangia in mezzo a confetture e miele.
  assert.ok(!fuori.has("Cornetto"), "il cornetto esce ancora per un artefatto della base di misura");
  assert.ok(!fuori.has("Crema di cacao e nocciole"), "stessa popolazione del cornetto, stesso artefatto");
  // PREZZO DICHIARATO della restrizione (vedi il report F2): frutta oleosa e frutta secca
  // rientrano, perché nessuno le ha dichiarate e il loro numero non si confronta con la
  // soglia dei cereali. Se Mario le vuole fuori serve una TERZA colonna, non una soglia
  // allargata su una popolazione sbagliata. Il test lo mette nero su bianco.
  assert.ok(!fuori.has("Mandorle"), "atteso: la rete non giudica i grassi (10,8 g/100 g di mandorle)");
  assert.ok(!fuori.has("Fichi secchi"), "atteso: la rete non giudica la frutta secca da spuntino");
});

test("degrado v5 (senza substitution_group): i legumi li tiene la rotation_key", () => {
  const senzaGruppo = CATALOGO.map((r) => ({ ...r, substitutionGroup: null }));
  const fuori = esclusi(senzaGruppo);
  for (const label of ["Ceci", "Lenticchie rosse", "Lupini"]) {
    assert.ok(fuori.has(label), `«${label}» rientrerebbe nel pre-sforzo se cadesse la colonna v6`);
  }
  // L'hummus non ha rotation_key: senza il gruppo v6 nessuno lo dichiara legume. È il buco
  // noto di quel degrado, dichiarato qui invece che scoperto in produzione.
  assert.ok(!fuori.has("Hummus"), "se l'hummus esce anche senza gruppo, aggiornare questo commento");
});

test("l'indice risponde anche per gli alimenti che la rete non giudica", () => {
  // Un fdcId del catalogo fuori dalle popolazioni della rete NON deve diventare «ignoto»:
  // sul percorso dei candidati USDA grezzi l'ignoto viene escluso in chiusura, e un petto
  // di pollo sparirebbe dal pranzo pre-gara per il motivo sbagliato.
  const index = buildMenuFoodFiberFermentedIndex(pools());
  const restriction = { foodIndex: index, why: "test" };
  const pollo = index.get(171077)!;
  assert.equal(pollo.classified, true);
  assert.equal(pollo.fiberPer100g, 0, "la misura grezza deve restare nell'indice");
  assert.equal(pollo.overFiberThreshold, false);
  assert.equal(isPreEffortExcludedHit({ fdcId: 171077 }, restriction), false);
  // E il cornetto dà lo stesso verdetto sui due percorsi (riga di catalogo e hit USDA).
  assert.equal(isPreEffortExcludedHit({ fdcId: 174987 }, restriction), false);
  assert.equal(isPreEffortExcludedHit({ fdcId: 170285 }, restriction), true, "orzo perlato: fuori su entrambi i percorsi");
});
