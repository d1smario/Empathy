/**
 * DATI + SCHEMA — REGOLA 2 di Mario sul catalogo `nutrition_menu_foods`.
 *
 *   «Nei giorni di carico intenso e gara limitiamo apporto di fibre e prodotti fermentati
 *    nei pasti pre-allenamento/gara: niente yogurt, kefir, cereali integrali o altri elementi
 *    troppo ricchi di fibre. Restano comunque disponibili cereali classici, latte o latte
 *    vegetale.»
 *
 * Per applicarla servono due risposte su OGNI alimento del catalogo: è fermentato? è ricco
 * di fibre? Questo test verifica il CONTRATTO DATI che le rende possibili:
 *   - `is_fermented boolean NOT NULL DEFAULT false` esiste e NESSUNA riga attiva è NULL;
 *   - la classificazione fatta a mano è quella giusta sulle famiglie che Mario nomina
 *     (yogurt in ogni forma, kefir, latticello) e sui casi che NON devono cadere dentro
 *     (latte e bevande vegetali, che Mario lascia esplicitamente disponibili);
 *   - la fibra arriva da `nutrition_fdc_foods.fiber_100g`, si legge SEMPRE insieme alla base
 *     di porzione della riga, e la soglia della base `dry_grams` separa DAVVERO pasta/riso/
 *     corn flakes (ammessi) da muesli/avena/crusca (esclusi), sui valori veri.
 *
 * Il ramo «cereali integrali» della stessa regola — che la fibra NON copre — ha il suo test
 * sui dati veri in `menu-foods-wholegrain.test.ts`.
 *
 * È un test sui dati di produzione: gira solo con le credenziali Supabase in `.env.local`
 * (URL + service role). Senza credenziali si SALTA con un messaggio esplicito, invece di
 * dare falso verde su un DB che non ha nemmeno interrogato.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  MENU_FOOD_HIGH_FIBER_THRESHOLD_DRY_G,
  fiberNetApplies,
  isHighFiberPer100g,
  isPreEffortExcludedByFacts,
  menuFoodFiberFermentedInfo,
} from "@/lib/nutrition/v2/menu-food-fiber-fermented";

/**
 * FERMENTATI — la famiglia è più larga dei due nomi che Mario cita: yogurt in ogni forma
 * (greco, vegetale, di capra, di pecora), kefir, latticello, panna acida (crema acidificata
 * con fermenti lattici), tempeh, e i formaggi stagionati/a crosta fiorita/erborinati.
 */
const DEVONO_ESSERE_FERMENTATI = [
  "yogurt_plain",
  "yogurt_lowfat",
  "yogurt_greek",
  "yogurt_greek_fruit",
  "yogurt_greek_nonfat",
  "yogurt_greek_whole",
  "goat_yogurt",
  "sheep_yogurt",
  "soy_yogurt",
  "kefir",
  "buttermilk",
  "sour_cream",
  "tempeh",
  "parmigiano_reggiano",
  "cheese_hard",
  "pecorino_romano",
  "provolone",
  "gruyere",
  "emmental",
  "edam",
  "gouda",
  "cheddar",
  "fontina",
  "taleggio",
  "gorgonzola",
  "brie",
  "camembert",
  "caciotta",
  "feta",
  "goat_cheese_aged",
];

/**
 * NON fermentati, e non per distrazione: Mario lascia esplicitamente disponibili «latte o
 * latte vegetale», quindi latte vaccino/di capra/di pecora e le bevande vegetali NON
 * fermentate devono restare pescabili anche nel pre-gara. Il tofu è latte di soia coagulato
 * (a differenza del tempeh, che è fermentato): tenerli distinti è metà del valore del dato.
 */
const NON_DEVONO_ESSERE_FERMENTATI = [
  "milk_whole",
  "milk_skim",
  "milk_semi_skimmed",
  "goat_milk",
  "sheep_milk",
  "soymilk",
  "oat_drink",
  "rice_drink",
  "almond_drink_unsweetened",
  "coconut_milk",
  "tofu_firm",
  "tofu_silken",
  "tofu_extra_firm",
  "mozzarella",
  "mozzarella_whole",
  "burrata",
  "ricotta_cheese",
  "mung_sprouts",
  "seitan",
  "honey",
  "butter_unsalted",
  "heavy_cream",
];

/** Cereali «classici» di Mario (tutti su base `dry_grams`): devono restare SOTTO la soglia. */
const CEREALI_AMMESSI = [
  "rice_parboiled",
  "rice_dry",
  "pasta_dry",
  "pasta_egg",
  "corn_flakes",
  "bread_white",
  "bread_italian",
  "roll_hard",
  "semolina",
  "breadsticks",
  "puffed_rice",
];

/** Ricchi di fibre (base `dry_grams`): devono stare SOPRA la soglia del secco. */
const CEREALI_ESCLUSI = [
  "pasta_whole",
  "bread_whole_wheat",
  "bread_multigrain",
  "roll_whole_wheat",
  "crackers_whole",
  "english_muffin_whole",
  "muesli",
  "granola",
  "oat_dry",
  "oat_bran",
  "wheat_bran",
  "bread_rye",
];

type MenuFoodRow = {
  canonical_key: string;
  label_it: string;
  serving_basis: string;
  rotation_key: string | null;
  is_fermented: boolean | null;
  is_wholegrain: boolean | null;
  pool_keys: string[] | null;
  fdc_id: number;
};

function collectEnvFiles(): string[] {
  const found: string[] = [];
  let dir = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    for (const candidate of [path.join(dir, ".env.local"), path.join(dir, "apps", "web", ".env.local")]) {
      if (existsSync(candidate) && !found.includes(candidate)) found.push(candidate);
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return found;
}

function readEnvCredentials(): { url: string; key: string } | null {
  const parsed = new Map<string, string>();
  for (const envFile of collectEnvFiles()) {
    for (const raw of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const name = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (value && !parsed.has(name)) parsed.set(name, value);
    }
  }
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    parsed.get("NEXT_PUBLIC_SUPABASE_URL") ||
    parsed.get("SUPABASE_URL") ||
    "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || parsed.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return url && key ? { url, key } : null;
}

const credentials = readEnvCredentials();
const skipReason = credentials
  ? false
  : "credenziali Supabase assenti (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local)";

let cachedRows: MenuFoodRow[] | null = null;
let cachedFiber: Map<number, number | null> | null = null;

function admin() {
  const creds = credentials;
  assert.ok(creds, "credenziali Supabase mancanti");
  return createClient(creds.url, creds.key, { auth: { persistSession: false } });
}

async function loadActiveRows(): Promise<MenuFoodRow[]> {
  if (cachedRows) return cachedRows;
  const client = admin();
  const rows: MenuFoodRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("nutrition_menu_foods")
      .select("canonical_key, label_it, serving_basis, rotation_key, is_fermented, is_wholegrain, pool_keys, fdc_id")
      .eq("is_active", true)
      .order("canonical_key")
      .range(from, from + pageSize - 1);
    // Colonna mancante → PostgREST 42703: il messaggio finisce nell'assert, è la prova rossa.
    assert.equal(error, null, `select fallita: ${error ? JSON.stringify(error) : ""}`);
    const page = (data ?? []) as MenuFoodRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  assert.ok(rows.length > 400, `catalogo troppo piccolo (${rows.length} righe attive)`);
  cachedRows = rows;
  return rows;
}

async function loadFiberByFdcId(): Promise<Map<number, number | null>> {
  if (cachedFiber) return cachedFiber;
  const client = admin();
  const rows = await loadActiveRows();
  const ids = [...new Set(rows.map((r) => r.fdc_id).filter((n) => Number.isFinite(n) && n > 0))];
  const map = new Map<number, number | null>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await client
      .from("nutrition_fdc_foods")
      .select("fdc_id, fiber_100g")
      .in("fdc_id", ids.slice(i, i + 200));
    assert.equal(error, null, `select fibra fallita: ${error ? JSON.stringify(error) : ""}`);
    for (const raw of data ?? []) {
      const r = raw as { fdc_id: number; fiber_100g: number | string | null };
      map.set(Number(r.fdc_id), r.fiber_100g == null ? null : Number(r.fiber_100g));
    }
  }
  cachedFiber = map;
  return map;
}

test("schema: is_fermented esiste e nessuna riga attiva resta senza classificazione", { skip: skipReason }, async () => {
  const rows = await loadActiveRows();
  const nulli = rows.filter((r) => r.is_fermented !== true && r.is_fermented !== false);
  assert.deepEqual(
    nulli.map((r) => r.canonical_key),
    [],
    "righe attive senza is_fermented (NULL / colonna assente)",
  );
});

test("fermentati: yogurt in ogni forma, kefir, latticello, tempeh, formaggi stagionati", { skip: skipReason }, async () => {
  const rows = await loadActiveRows();
  const byKey = new Map(rows.map((r) => [r.canonical_key, r]));
  const mancanti: string[] = [];
  for (const key of DEVONO_ESSERE_FERMENTATI) {
    const row = byKey.get(key);
    if (!row) continue; // chiave non più nel catalogo: non è questo test a doverlo dire
    if (row.is_fermented !== true) mancanti.push(`${key} (${row.label_it})`);
  }
  assert.deepEqual(mancanti, [], "alimenti fermentati NON marcati");
});

test("non fermentati: latte e bevande vegetali restano disponibili, come dice Mario", { skip: skipReason }, async () => {
  const rows = await loadActiveRows();
  const byKey = new Map(rows.map((r) => [r.canonical_key, r]));
  const falsiPositivi: string[] = [];
  for (const key of NON_DEVONO_ESSERE_FERMENTATI) {
    const row = byKey.get(key);
    if (!row) continue;
    if (row.is_fermented === true) falsiPositivi.push(`${key} (${row.label_it})`);
  }
  assert.deepEqual(falsiPositivi, [], "alimenti marcati fermentati per errore");
});

test("fibra: la soglia del secco separa i cereali classici dai ricchi di fibre, sui valori veri", { skip: skipReason }, async () => {
  const rows = await loadActiveRows();
  const byKey = new Map(rows.map((r) => [r.canonical_key, r]));
  const fiber = await loadFiberByFdcId();
  const fibraDi = (key: string): number | null => {
    const row = byKey.get(key);
    return row ? (fiber.get(row.fdc_id) ?? null) : null;
  };
  // Le due liste stanno tutte sulla stessa base: confrontarle fra loro ha senso solo così.
  for (const key of [...CEREALI_AMMESSI, ...CEREALI_ESCLUSI]) {
    const row = byKey.get(key);
    if (!row) continue;
    assert.equal(row.serving_basis, "dry_grams", `${key}: base di porzione cambiata, la lista non è più omogenea`);
  }

  const ammessiSbagliati: string[] = [];
  for (const key of CEREALI_AMMESSI) {
    const f = fibraDi(key);
    if (f == null) continue; // fibra non misurata: non è alta per definizione
    if (isHighFiberPer100g(f, "dry_grams")) ammessiSbagliati.push(`${key} = ${f} g`);
  }
  assert.deepEqual(
    ammessiSbagliati,
    [],
    `cereali classici sopra la soglia ${MENU_FOOD_HIGH_FIBER_THRESHOLD_DRY_G} g (secco)`,
  );

  const esclusiSbagliati: string[] = [];
  for (const key of CEREALI_ESCLUSI) {
    const f = fibraDi(key);
    assert.notEqual(f, null, `${key}: fibra non misurata, la soglia non potrebbe escluderlo`);
    if (f != null && !isHighFiberPer100g(f, "dry_grams")) esclusiSbagliati.push(`${key} = ${f} g`);
  }
  assert.deepEqual(
    esclusiSbagliati,
    [],
    `ricchi di fibre sotto la soglia ${MENU_FOOD_HIGH_FIBER_THRESHOLD_DRY_G} g (secco)`,
  );

  // La pasta di semola è l'alimento del pasto pre-gara di Mario: deve restare, punto.
  assert.equal(fibraDi("pasta_dry"), 3.2, "la fibra della pasta di semola è cambiata: ricalibrare la soglia");
});

test("la regola non svuota i pool: restano alternative in colazione, pranzo e cena", { skip: skipReason }, async () => {
  const rows = await loadActiveRows();
  const fiber = await loadFiberByFdcId();
  // Verdetto COMPLETO (fermentato OPPURE integrale OPPURE fibra alta sulla base giusta):
  // se restassero 5 alternative solo dimenticando una delle tre condizioni non varrebbe nulla.
  const superstiti = (pool: string) =>
    rows.filter((r) => {
      if (!(r.pool_keys ?? []).includes(pool)) return false;
      // Verdetto con la rete fibra RISTRETTA alla sua popolazione, come nel motore: contare
      // i superstiti con una regola più severa di quella vera direbbe poco.
      const misurata = fiber.get(r.fdc_id) ?? null;
      const confrontabile = fiberNetApplies({
        poolKeys: r.pool_keys ?? [],
        servingBasis: r.serving_basis,
        rotationKey: r.rotation_key,
      })
        ? misurata
        : null;
      const info = menuFoodFiberFermentedInfo(r.is_fermented, confrontabile, {
        isWholegrain: r.is_wholegrain,
        servingBasis: r.serving_basis,
        measuredFiberPer100g: misurata,
      });
      return !isPreEffortExcludedByFacts(info);
    }).length;

  for (const pool of ["breakfast_cho", "breakfast_pro", "lunch_carb", "dinner_carb", "lunch_pro", "dinner_pro"]) {
    assert.ok(
      superstiti(pool) >= 5,
      `pool ${pool}: solo ${superstiti(pool)} alimenti superano la regola pre-sforzo`,
    );
  }
});

// ── DOVE la rete sulla fibra può misurare, sul catalogo VERO ─────────────────────────

let cachedGroups: Map<string, string | null> | null = null;

/** `substitution_group` (colonna v6 dei ruoli): è la dichiarazione «legume» del catalogo. */
async function loadSubstitutionGroups(): Promise<Map<string, string | null>> {
  if (cachedGroups) return cachedGroups;
  const client = admin();
  const map = new Map<string, string | null>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("nutrition_menu_food_meal_roles")
      .select("canonical_key, substitution_group")
      .order("canonical_key")
      .range(from, from + pageSize - 1);
    assert.equal(error, null, `select ruoli fallita: ${error ? JSON.stringify(error) : ""}`);
    const page = (data ?? []) as { canonical_key: string; substitution_group: string | null }[];
    for (const r of page) map.set(r.canonical_key, r.substitution_group);
    if (page.length < pageSize) break;
  }
  cachedGroups = map;
  return map;
}

/** Il verdetto della Regola 2 su una riga vera, con la rete fibra ristretta alla sua popolazione. */
async function verdettoPerChiave(): Promise<Map<string, boolean>> {
  const rows = await loadActiveRows();
  const fiber = await loadFiberByFdcId();
  const groups = await loadSubstitutionGroups();
  const out = new Map<string, boolean>();
  for (const r of rows) {
    const misurata = fiber.get(r.fdc_id) ?? null;
    const confrontabile = fiberNetApplies({
      poolKeys: r.pool_keys ?? [],
      servingBasis: r.serving_basis,
      substitutionGroup: groups.get(r.canonical_key),
      rotationKey: r.rotation_key,
    })
      ? misurata
      : null;
    const info = menuFoodFiberFermentedInfo(r.is_fermented, confrontabile, {
      isWholegrain: r.is_wholegrain,
      servingBasis: r.serving_basis,
      measuredFiberPer100g: misurata,
    });
    out.set(r.canonical_key, isPreEffortExcludedByFacts(info));
  }
  return out;
}

/**
 * L'elenco che Mario e i revisori hanno chiesto di verificare sul catalogo vero: a sinistra
 * quelli che devono restare nel piatto pre-sforzo, a destra quelli che devono uscire. Il
 * CORNETTO sta a sinistra: 2,6 g/100 g su base `cooked_grams` non è «ricco di fibre», è un
 * cornetto intero pesato come si mangia in mezzo a confetture e miele.
 */
const PRE_SFORZO_AMMESSI = [
  "pasta_dry",
  "rice_parboiled",
  "corn_flakes",
  "bread_white",
  "bread_italian",
  "croissant_butter",
  "potato_cooked",
  "couscous",
  "gnocchi_potato",
  "milk_semi_skimmed",
  "tofu_firm",
];

const PRE_SFORZO_ESCLUSI = [
  "rice_brown",
  "farro_dry",
  "oat_dry",
  "muesli",
  "barley_pearled",
  "chestnuts",
  "pasta_legumes",
  "chickpeas_cooked",
  "lentils_red",
  "beans_white",
  "lupins",
  "hummus",
  "yogurt_greek",
  "kefir",
];

test("rete fibra: sul catalogo vero il cornetto resta e l'orzo perlato esce", { skip: skipReason }, async () => {
  const verdetto = await verdettoPerChiave();
  const rientrati: string[] = [];
  for (const key of PRE_SFORZO_ESCLUSI) {
    if (verdetto.get(key) === false) rientrati.push(key);
  }
  assert.deepEqual(rientrati, [], "alimenti che devono restare fuori dai pasti pre-sforzo e invece rientrano");

  const buttatiFuori: string[] = [];
  for (const key of PRE_SFORZO_AMMESSI) {
    if (verdetto.get(key) === true) buttatiFuori.push(key);
  }
  assert.deepEqual(buttatiFuori, [], "alimenti ammessi da Mario e invece esclusi dalla regola");
});

test("rete fibra: nessun alimento esce per la fibra fuori dalla sua popolazione", { skip: skipReason }, async () => {
  // La rete deve mordere SOLO dove il confronto ha senso. Se un alimento esce per la soglia
  // pur non essendo né in un pool di cereali/carboidrati né un legume, la restrizione è stata
  // aggirata da qualche parte.
  const rows = await loadActiveRows();
  const fiber = await loadFiberByFdcId();
  const groups = await loadSubstitutionGroups();
  const fuoriPopolazione: string[] = [];
  for (const r of rows) {
    if (r.is_fermented === true || r.is_wholegrain === true) continue;
    const misurata = fiber.get(r.fdc_id) ?? null;
    if (!isHighFiberPer100g(misurata, r.serving_basis as never)) continue;
    const dentro = fiberNetApplies({
      poolKeys: r.pool_keys ?? [],
      servingBasis: r.serving_basis,
      substitutionGroup: groups.get(r.canonical_key),
      rotationKey: r.rotation_key,
    });
    if (!dentro) continue;
    const carb = (r.pool_keys ?? []).some((p) => ["breakfast_cho", "lunch_carb", "dinner_carb"].includes(p));
    const legume =
      groups.get(r.canonical_key) === "PLANT_PROTEIN" || (r.rotation_key ?? "").startsWith("prot:");
    if (!carb && !legume) fuoriPopolazione.push(`${r.canonical_key} (${misurata} g, ${r.serving_basis})`);
  }
  assert.deepEqual(fuoriPopolazione, [], "esclusi dalla fibra fuori dai pool cereali/carboidrati e dai legumi");
});
