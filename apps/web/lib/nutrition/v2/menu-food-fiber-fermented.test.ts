/**
 * REGOLA 2 di Mario, parte DATI — «niente fermentati, integrali né fibre prima dello sforzo».
 *
 * Questo test copre il LATO PURO: le due soglie fibra (una per base di porzione) calibrate
 * sul catalogo e il viaggio dei tre dati (fermentato / integrale / fibra con la sua base)
 * dalle righe del catalogo fino all'indice che il compositore consulta per fdcId. Niente DB:
 * righe finte, stesso stile del test del catalogo. La verifica sui DATI VERI sta in
 * `menu-foods-fermented-fiber.test.ts` e `menu-foods-wholegrain.test.ts`; la DECISIONE
 * (quali giorni, quali pasti) vive nel motore, `pre-effort-food-filter.ts`.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMenuFoodFiberFermentedIndex,
  mapMenuFoodRows,
} from "@/lib/nutrition/v2/menu-food-catalog-db";
import {
  MENU_FOOD_HIGH_FIBER_THRESHOLD_AS_EATEN_G,
  MENU_FOOD_HIGH_FIBER_THRESHOLD_DRY_G,
  isHighFiberPer100g,
  isPreEffortExcludedByFacts,
  menuFoodFiberFermentedInfo,
} from "@/lib/nutrition/v2/menu-food-fiber-fermented";

/**
 * Valori di fibra MISURATI sulle righe attive del catalogo (nutrition_fdc_foods.fiber_100g),
 * base `dry_grams`. Sono la prova che la soglia non è un numero scelto a caso: a sinistra i
 * cereali classici che Mario tiene (la pasta di semola è l'alimento del suo pasto pre-gara),
 * a destra i ricchi di fibre che vuole fuori.
 *
 * NOTA: farro (3,9) e grano soffiato (4,4) stanno sotto la soglia e restano qui — la fibra
 * NON li prende, e infatti a prenderli è la colonna `is_wholegrain`. Tenerli in questa lista
 * è il promemoria che la soglia da sola non basta.
 */
const AMMESSI_REALI_SECCO: Array<[string, number]> = [
  ["riso parboiled", 1.8],
  ["pane tipo casereccio", 2.1],
  ["panino (rosetta)", 2.3],
  ["corn flakes", 2.7],
  ["pane", 2.9],
  ["grissini", 3.0],
  ["pasta di semola", 3.2],
  ["pasta all'uovo", 3.3],
  ["semolino", 3.9],
  ["farro", 3.9],
  ["polenta (farina di mais)", 3.9],
  ["gallette di riso", 4.2],
  ["grano soffiato", 4.4],
];

const ESCLUSI_REALI_SECCO: Array<[string, number]> = [
  ["pane di segale", 5.8],
  ["pane integrale", 6.0],
  ["crackers integrali", 6.9],
  ["pane multicereale", 7.4],
  ["panino integrale", 7.5],
  ["granola", 8.9],
  ["fiocchi d'avena", 9.4],
  ["muesli", 9.8],
  ["pasta integrale", 10.1],
  ["crusca d'avena", 15.4],
  ["crusca di grano", 42.8],
];

/**
 * Stessi valori veri, ma sulla base «come si mangia» (cooked_grams). Altra scala, altra
 * soglia — e OGGI anche un'altra popolazione: la soglia del cotto viene chiesta solo dove
 * quella base raccoglie cereali cotti (`lunch_carb`/`dinner_carb`) e sui legumi. Le liste
 * qui sotto sono quella popolazione, non tutto il catalogo: confettura, cornetto, scarola e
 * olive verdi ne sono USCITE, perché a nessuno serve sapere se un cornetto sta sopra la
 * soglia dei cereali cotti (vedi `menu-food-fiber-net-scope.test.ts`).
 */
const AMMESSI_REALI_COTTO: Array<[string, number]> = [
  ["miglio", 1.3],
  ["cous cous", 1.4],
  ["riso integrale", 1.6],
  ["gnocchi di patate", 1.75],
  ["patate", 2.2],
];

const ESCLUSI_REALI_COTTO: Array<[string, number]> = [
  ["lupini", 2.8],
  ["orzo perlato", 3.8],
  ["bulgur", 4.5],
  ["pasta di legumi", 4.9],
  ["castagne", 5.1],
  ["ceci", 7.6],
];

test("soglia fibra: due basi, due soglie, calibrate sui valori veri del catalogo", () => {
  // Base SECCO: la soglia deve stare SOPRA la pasta di semola (3,2) — una soglia a 3
  // escluderebbe proprio il pasto pre-gara di Mario — e SOTTO il pane di segale (5,8).
  assert.ok(
    MENU_FOOD_HIGH_FIBER_THRESHOLD_DRY_G > 4.4,
    `soglia secco ${MENU_FOOD_HIGH_FIBER_THRESHOLD_DRY_G} taglia fuori pasta di semola/semolino/polenta`,
  );
  assert.ok(
    MENU_FOOD_HIGH_FIBER_THRESHOLD_DRY_G <= 5.8,
    `soglia secco ${MENU_FOOD_HIGH_FIBER_THRESHOLD_DRY_G} lascia passare pane di segale/pane integrale`,
  );
  for (const [nome, fibra] of AMMESSI_REALI_SECCO) {
    assert.equal(isHighFiberPer100g(fibra, "dry_grams"), false, `${nome} (${fibra} g secco) non è «ricco di fibre»`);
  }
  for (const [nome, fibra] of ESCLUSI_REALI_SECCO) {
    assert.equal(isHighFiberPer100g(fibra, "dry_grams"), true, `${nome} (${fibra} g secco) deve essere escluso`);
  }

  // Base COME SI MANGIA, popolazione dei cereali cotti + legumi: sopra le patate (2,2),
  // sotto i lupini (2,8), che sono il legume più magro di fibra e devono uscire lo stesso.
  assert.ok(
    MENU_FOOD_HIGH_FIBER_THRESHOLD_AS_EATEN_G > 2.2,
    `soglia cotto ${MENU_FOOD_HIGH_FIBER_THRESHOLD_AS_EATEN_G} taglia fuori le patate`,
  );
  assert.ok(
    MENU_FOOD_HIGH_FIBER_THRESHOLD_AS_EATEN_G <= 2.8,
    `soglia cotto ${MENU_FOOD_HIGH_FIBER_THRESHOLD_AS_EATEN_G} lascia passare lupini e orzo perlato`,
  );
  for (const [nome, fibra] of AMMESSI_REALI_COTTO) {
    assert.equal(isHighFiberPer100g(fibra, "cooked_grams"), false, `${nome} (${fibra} g cotto) non è «ricco di fibre»`);
  }
  for (const [nome, fibra] of ESCLUSI_REALI_COTTO) {
    assert.equal(isHighFiberPer100g(fibra, "cooked_grams"), true, `${nome} (${fibra} g cotto) deve essere escluso`);
  }
});

test("soglia fibra: LO STESSO numero cambia verdetto a seconda della base", () => {
  // È il difetto in una riga: 3,0 g/100 g su secco è un grissino, su cotto è quasi il doppio
  // della fibra di una pasta cotta. Con una soglia sola uno dei due verdetti era sbagliato.
  assert.equal(isHighFiberPer100g(3.0, "dry_grams"), false);
  assert.equal(isHighFiberPer100g(3.0, "cooked_grams"), true);
  // `ml` è già «come si mangia»: stessa soglia del cotto, e nessuna bevanda del catalogo
  // (max 0,5 g/100 ml) la supera — latte e bevande vegetali restano disponibili.
  assert.equal(isHighFiberPer100g(3.0, "ml"), true);
  assert.equal(isHighFiberPer100g(0.5, "ml"), false);
});

test("soglia fibra: fibra ignota o senza base non è «ricca di fibre» (nessun default inventato)", () => {
  assert.equal(isHighFiberPer100g(null, "dry_grams"), false);
  assert.equal(isHighFiberPer100g(undefined, "dry_grams"), false);
  assert.equal(isHighFiberPer100g(Number.NaN, "dry_grams"), false);
  // Un numero SENZA base non è confrontabile: non si finge di poterlo confrontare.
  assert.equal(isHighFiberPer100g(42.8, null), false);
  assert.equal(isHighFiberPer100g(42.8, undefined), false);
  assert.equal(isHighFiberPer100g(42.8, "grammi_a_caso" as never), false);
  // Il confine è inclusivo: esattamente alla soglia si è già «ricchi».
  assert.equal(isHighFiberPer100g(MENU_FOOD_HIGH_FIBER_THRESHOLD_DRY_G, "dry_grams"), true);
  assert.equal(isHighFiberPer100g(MENU_FOOD_HIGH_FIBER_THRESHOLD_AS_EATEN_G, "cooked_grams"), true);
});

test("menuFoodFiberFermentedInfo: normalizza le colonne DB, i flag solo su true esplicito", () => {
  assert.deepEqual(menuFoodFiberFermentedInfo(true, 1.2, { isWholegrain: false, servingBasis: "dry_grams" }), {
    classified: true,
    fermented: true,
    wholegrain: false,
    fiberPer100g: 1.2,
    fiberBasis: "dry_grams",
    overFiberThreshold: false,
    highFiber: false,
  });
  assert.deepEqual(menuFoodFiberFermentedInfo(false, 9.8, { isWholegrain: false, servingBasis: "dry_grams" }), {
    classified: true,
    fermented: false,
    wholegrain: false,
    fiberPer100g: 9.8,
    fiberBasis: "dry_grams",
    overFiberThreshold: true,
    highFiber: true,
  });
  // null/undefined/stringhe → false: «non classificato» non diventa «fermentato» né
  // «integrale». E non diventa nemmeno «guardato»: `classified` resta false, e il filtro
  // pre-sforzo lo tratta come un alimento su cui nessuno sa rispondere.
  assert.deepEqual(menuFoodFiberFermentedInfo(null, null, { isWholegrain: null }), {
    classified: false,
    fermented: false,
    wholegrain: false,
    fiberPer100g: null,
    fiberBasis: null,
    overFiberThreshold: false,
    highFiber: false,
  });
  assert.deepEqual(menuFoodFiberFermentedInfo("true", undefined, { isWholegrain: "true" }), {
    classified: false,
    fermented: false,
    wholegrain: false,
    fiberPer100g: null,
    fiberBasis: null,
    overFiberThreshold: false,
    highFiber: false,
  });
  // MEZZA risposta non è una risposta: le due colonne coprono due metà diverse della regola
  // (fermentati e cereali integrali), e i secondi dalla fibra non si riconoscono.
  assert.equal(menuFoodFiberFermentedInfo(false, 3.2, { servingBasis: "dry_grams" }).classified, false);
  assert.equal(menuFoodFiberFermentedInfo(undefined, 3.2, { isWholegrain: false }).classified, false);
});

test("menuFoodFiberFermentedInfo: il non classificato NON passa nel pasto pre-sforzo", () => {
  // Il terzo fail-open della stessa famiglia: su un ambiente senza le due colonne la riga
  // rispondeva «non fermentata, non integrale» e lo yogurt tornava nel piatto. Ora l'assenza
  // di dato è un'esclusione, come per gli allergeni non esaminati.
  const muto = menuFoodFiberFermentedInfo(undefined, 0, { servingBasis: "dry_grams" });
  assert.equal(muto.classified, false);
  assert.equal(muto.fermented, false, "non inventa il verdetto opposto: dice solo che non sa");
  assert.equal(isPreEffortExcludedByFacts(muto), true, "non classificato deve restare fuori");
  // Con le colonne al loro posto lo stesso alimento passa: la chiusura non è un tappo fisso.
  assert.equal(
    isPreEffortExcludedByFacts(menuFoodFiberFermentedInfo(false, 0, { isWholegrain: false, servingBasis: "dry_grams" })),
    false,
  );
});

test("menuFoodFiberFermentedInfo: l'integrale è escluso anche quando la fibra dice il contrario", () => {
  // Riso integrale, base cotto: 1,6 g/100 g. La soglia non lo prende — e non deve, perché
  // quel numero è annacquato. Lo prende la colonna dichiarata.
  const riso = menuFoodFiberFermentedInfo(false, 1.6, { isWholegrain: true, servingBasis: "cooked_grams" });
  assert.equal(riso.overFiberThreshold, false, "la soglia da sola non prende il riso integrale cotto");
  assert.equal(riso.wholegrain, true);
  assert.equal(riso.highFiber, true, "l'integrale dichiarato esce comunque");
  assert.equal(isPreEffortExcludedByFacts(riso), true);

  // Farro secco 3,9 e grano duro senza fibra misurata: stessa storia.
  assert.equal(
    isPreEffortExcludedByFacts(menuFoodFiberFermentedInfo(false, 3.9, { isWholegrain: true, servingBasis: "dry_grams" })),
    true,
  );
  assert.equal(
    isPreEffortExcludedByFacts(menuFoodFiberFermentedInfo(false, null, { isWholegrain: true, servingBasis: "dry_grams" })),
    true,
  );

  // Le tre condizioni sono complementari: ognuna da sola basta, e i classici passano tutte.
  const pasta = menuFoodFiberFermentedInfo(false, 3.2, { isWholegrain: false, servingBasis: "dry_grams" });
  assert.equal(isPreEffortExcludedByFacts(pasta), false, "la pasta di semola deve restare");
  const yogurt = menuFoodFiberFermentedInfo(true, 0, { isWholegrain: false, servingBasis: "cooked_grams" });
  assert.equal(isPreEffortExcludedByFacts(yogurt), true, "fermentato: esce anche con zero fibra");
  const ceci = menuFoodFiberFermentedInfo(false, 7.6, { isWholegrain: false, servingBasis: "cooked_grams" });
  assert.equal(isPreEffortExcludedByFacts(ceci), true, "né fermentato né integrale: lo prende la fibra");
  assert.equal(isPreEffortExcludedByFacts(null), false);
  assert.equal(isPreEffortExcludedByFacts(undefined), false);
});

test("menuFoodFiberFermentedInfo: senza base la fibra non è utilizzabile, non «bassa»", () => {
  // Chi ha in mano solo due numeri e non sa su che base siano NON deve fingere un confronto:
  // la fibra torna null e il verdetto lo dà l'indice per fdcId, che la base ce l'ha.
  const senzaBase = menuFoodFiberFermentedInfo(false, 42.8);
  assert.equal(senzaBase.fiberPer100g, null, "un numero senza base non è confrontabile");
  assert.equal(senzaBase.fiberBasis, null);
  assert.equal(senzaBase.overFiberThreshold, false);
  assert.equal(senzaBase.highFiber, false);
});

// ── Il dato viaggia col candidato: righe DB → MenuFoodEntry → indice per fdcId ────────

function menuRow(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    canonical_key: "pasta_dry",
    fdc_id: 1,
    label_it: "Pasta di semola",
    serving_basis: "dry_grams",
    pool_keys: ["lunch_carb"],
    rotation_key: "carb:pasta",
    carb_family: "carb_starch",
    is_meat: false,
    is_fish: false,
    is_animal_product: false,
    is_fermented: false,
    is_wholegrain: false,
    sort_priority: 100,
    ...overrides,
  };
}

const macroRow = (fdcId: number, fiber: number | null) => ({
  fdc_id: fdcId,
  kcal_100g: 360,
  carbs_100g: 75,
  protein_100g: 12,
  fat_100g: 1.5,
  fiber_100g: fiber,
});

test("mapMenuFoodRows: porta is_fermented, is_wholegrain e fiber_100g sull'entry", () => {
  const pools = mapMenuFoodRows(
    [
      menuRow({}),
      menuRow({ canonical_key: "yogurt_greek", fdc_id: 2, label_it: "Yogurt greco", pool_keys: ["breakfast_pro"], is_fermented: true }),
      menuRow({ canonical_key: "muesli", fdc_id: 3, label_it: "Muesli", pool_keys: ["breakfast_cho"], is_wholegrain: true }),
      menuRow({ canonical_key: "rusk_toast", fdc_id: 4, label_it: "Fette biscottate", pool_keys: ["breakfast_cho"] }),
    ],
    [macroRow(1, 3.2), macroRow(2, 0), macroRow(3, 9.8), macroRow(4, null)],
  );
  assert.ok(pools);
  const pasta = pools!.get("lunch_carb")![0]!;
  assert.equal(pasta.isFermented, false);
  assert.equal(pasta.isWholegrain, false);
  assert.equal(pasta.fiberPer100g, 3.2);

  const yogurt = pools!.get("breakfast_pro")![0]!;
  assert.equal(yogurt.isFermented, true);
  // `breakfast_pro` non è una popolazione dove la soglia sulla fibra sa giudicare: il numero
  // resta MISURATO ma non confrontabile. Lo yogurt esce dal fermentato, non dalla fibra.
  assert.equal(yogurt.fiberPer100g, undefined);
  assert.equal(yogurt.fiberMeasuredPer100g, 0);

  const breakfastCho = pools!.get("breakfast_cho")!;
  const muesli = breakfastCho.find((e) => e.canonicalKey === "muesli")!;
  assert.equal(muesli.fiberPer100g, 9.8);
  assert.equal(muesli.fiberMeasuredPer100g, 9.8);
  assert.equal(muesli.isWholegrain, true);
  // fiber_100g NULL nel DB → campo assente sull'entry, MAI 0 inventato.
  const rusk = breakfastCho.find((e) => e.canonicalKey === "rusk_toast")!;
  assert.equal(rusk.fiberPer100g, undefined);
  assert.equal(rusk.fiberMeasuredPer100g, undefined);
});

test("mapMenuFoodRows: riga senza le colonne della Regola 2 (select degradata) → NON classificata", () => {
  // Era il terzo fail-open: `is_fermented === true` su una colonna mai selezionata dava
  // `false`, cioè «l'ho guardato, non è fermentato». La riga muta ora resta muta, e chi
  // decide (pre-effort-food-filter) la tiene fuori dal pasto pre-sforzo.
  const row = menuRow({});
  delete row.is_fermented;
  delete row.is_wholegrain;
  const pools = mapMenuFoodRows([row], [macroRow(1, 3.2)]);
  const pasta = pools!.get("lunch_carb")![0]!;
  assert.equal(pasta.isFermented, undefined);
  assert.equal(pasta.isWholegrain, undefined);
  const info = buildMenuFoodFiberFermentedIndex(pools).get(1)!;
  assert.equal(info.classified, false);
  assert.equal(isPreEffortExcludedByFacts(info), true);

  // Anche una sola colonna mancante lascia la riga a metà: stessa chiusura.
  const meta = menuRow({});
  delete meta.is_wholegrain;
  const soloFermentati = mapMenuFoodRows([meta], [macroRow(1, 3.2)]);
  assert.equal(soloFermentati!.get("lunch_carb")![0]!.isFermented, false);
  assert.equal(soloFermentati!.get("lunch_carb")![0]!.isWholegrain, undefined);
  assert.equal(isPreEffortExcludedByFacts(buildMenuFoodFiberFermentedIndex(soloFermentati).get(1)!), true);

  // Colonna presente ma NULL: idem, non è una risposta.
  const nulla = menuRow({ is_fermented: null, is_wholegrain: null });
  const conNull = mapMenuFoodRows([nulla], [macroRow(1, 3.2)]);
  assert.equal(conNull!.get("lunch_carb")![0]!.isFermented, undefined);
  assert.equal(isPreEffortExcludedByFacts(buildMenuFoodFiberFermentedIndex(conNull).get(1)!), true);
});

test("buildMenuFoodFiberFermentedIndex: indice per fdcId, come per gli allergeni", () => {
  const pools = mapMenuFoodRows(
    [
      menuRow({}),
      menuRow({ canonical_key: "kefir", fdc_id: 2, label_it: "Kefir", pool_keys: ["breakfast_pro"], is_fermented: true }),
      menuRow({ canonical_key: "oat_dry", fdc_id: 3, label_it: "Fiocchi d'avena", pool_keys: ["breakfast_cho"], is_wholegrain: true }),
      // Riso integrale: base COTTO, 1,6 g di fibra. Solo la colonna dichiarata lo prende.
      menuRow({
        canonical_key: "rice_brown",
        fdc_id: 4,
        label_it: "Riso integrale",
        pool_keys: ["lunch_carb"],
        serving_basis: "cooked_grams",
        is_wholegrain: true,
      }),
    ],
    [macroRow(1, 3.2), macroRow(2, 0), macroRow(3, 9.4), macroRow(4, 1.6)],
  );
  const index = buildMenuFoodFiberFermentedIndex(pools);
  assert.deepEqual(index.get(1), {
    classified: true,
    fermented: false,
    wholegrain: false,
    fiberPer100g: 3.2,
    fiberBasis: "dry_grams",
    overFiberThreshold: false,
    highFiber: false,
  });
  assert.deepEqual(index.get(2), {
    classified: true,
    fermented: true,
    wholegrain: false,
    fiberPer100g: 0,
    fiberBasis: "dry_grams",
    overFiberThreshold: false,
    highFiber: false,
  });
  assert.deepEqual(index.get(3), {
    classified: true,
    fermented: false,
    wholegrain: true,
    fiberPer100g: 9.4,
    fiberBasis: "dry_grams",
    overFiberThreshold: true,
    highFiber: true,
  });
  assert.deepEqual(index.get(4), {
    classified: true,
    fermented: false,
    wholegrain: true,
    fiberPer100g: 1.6,
    fiberBasis: "cooked_grams",
    overFiberThreshold: false,
    highFiber: true,
  });
  assert.equal(index.get(999), undefined);
  // Pool nulli/assenti → indice vuoto, mai throw (stessa promessa dell'indice allergeni).
  assert.equal(buildMenuFoodFiberFermentedIndex(null).size, 0);
  assert.equal(buildMenuFoodFiberFermentedIndex(undefined).size, 0);
});

test("buildMenuFoodFiberFermentedIndex: stesso fdcId su più canonical_key → in chiusura", () => {
  // Caso raro ma reale (due chiavi che puntano allo stesso alimento USDA): se UNA delle due
  // righe è fermentata o ricca di fibre, l'fdcId eredita il vincolo — non si perde per strada.
  const pools = mapMenuFoodRows(
    [
      menuRow({ canonical_key: "yogurt_plain", fdc_id: 7, pool_keys: ["breakfast_pro"], is_fermented: false }),
      menuRow({ canonical_key: "yogurt_greek", fdc_id: 7, pool_keys: ["snack_pro"], is_fermented: true }),
    ],
    [macroRow(7, 0)],
  );
  const info = buildMenuFoodFiberFermentedIndex(pools).get(7)!;
  assert.equal(info.fermented, true);

  const fibrosi = mapMenuFoodRows(
    [
      menuRow({ canonical_key: "a", fdc_id: 8, pool_keys: ["breakfast_cho"] }),
      menuRow({ canonical_key: "b", fdc_id: 8, pool_keys: ["snack_cho"] }),
    ],
    [macroRow(8, 9.8)],
  );
  const fibra = buildMenuFoodFiberFermentedIndex(fibrosi).get(8)!;
  assert.equal(fibra.fiberPer100g, 9.8);
  assert.equal(fibra.highFiber, true);

  // Anche l'integrale si fonde in chiusura: basta una riga a dichiararlo.
  const integrali = mapMenuFoodRows(
    [
      menuRow({ canonical_key: "a", fdc_id: 9, pool_keys: ["lunch_carb"], is_wholegrain: false }),
      menuRow({ canonical_key: "b", fdc_id: 9, pool_keys: ["dinner_carb"], is_wholegrain: true }),
    ],
    [macroRow(9, 1.6)],
  );
  const misto = buildMenuFoodFiberFermentedIndex(integrali).get(9)!;
  assert.equal(misto.wholegrain, true);
  assert.equal(misto.highFiber, true);
});
