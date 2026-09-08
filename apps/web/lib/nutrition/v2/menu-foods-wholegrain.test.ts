/**
 * DATI — «niente CEREALI INTEGRALI prima dello sforzo», il ramo che la soglia sulla fibra
 * NON copre.
 *
 *   «Nei giorni di carico intenso e gara limitiamo apporto di fibre e prodotti fermentati
 *    nei pasti pre-allenamento/gara: niente yogurt, kefir, CEREALI INTEGRALI o altri elementi
 *    troppo ricchi di fibre. Restano comunque disponibili cereali classici, latte o latte
 *    vegetale.»
 *
 * Mario nomina i cereali integrali come CATEGORIA, non come «quelli sopra tot fibra». Sui
 * dati veri le due cose non coincidono: il riso integrale COTTO ha 1,6 g di fibra per 100 g
 * di prodotto (sotto qualunque soglia ragionevole) e il farro secco 3,9. Per questo la
 * proprietà è DICHIARATA (`nutrition_menu_foods.is_wholegrain`) e non dedotta.
 *
 * ── PERCHÉ QUESTO TEST PUÒ CADERE ────────────────────────────────────────────────────
 * Non contiene una lista scelta a mano di casi che passano. Interroga TUTTE le righe attive
 * e confronta la colonna dichiarata con un SECONDO segnale indipendente: le parole
 * dell'etichetta italiana che significano «integrale» e nient'altro (integrale, crusca,
 * avena, farro, segale, muesli, granola, decorticato, bulgur, kamut, quinoa, teff, sorgo,
 * amaranto, saraceno, multicereale, germe di grano, venere, riso rosso, riso selvaggio,
 * miglio, popcorn, grano soffiato, grano duro, fiocchi di cereali).
 *
 * Le due strade devono dare lo stesso verdetto su ogni riga. Le UNICHE deroghe ammesse
 * sono elencate in {@link DEROGHE_LESSICO} con la ragione scritta: qualunque altra
 * divergenza — una riga nuova, una classificazione dimenticata, un falso positivo — fa
 * cadere il test con il nome dell'alimento.
 *
 * Prima della migrazione `20260908160000` questo test cadeva su «Riso integrale»,
 * «Riso rosso», «Riso venere», «Farro», «Miglio», «Grano saraceno», «Grano duro»,
 * «Grano soffiato», «Farro soffiato», «Pane d'avena»: il lessico li chiamava integrali,
 * la colonna non esisteva.
 *
 * È un test sui dati di produzione: gira solo con le credenziali Supabase in `.env.local`
 * (URL + service role). Senza credenziali si SALTA con un messaggio esplicito.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  MENU_FOOD_HIGH_FIBER_THRESHOLD_AS_EATEN_G,
  MENU_FOOD_HIGH_FIBER_THRESHOLD_DRY_G,
  menuFoodFiberFermentedInfo,
} from "@/lib/nutrition/v2/menu-food-fiber-fermented";

/**
 * Parole che, nell'etichetta italiana del catalogo, significano «cereale integrale» e
 * nient'altro. Sono il secondo segnale, indipendente dalla colonna: se il lessico e la
 * colonna divergono, uno dei due è sbagliato e il test lo dice.
 */
const PAROLE_INTEGRALE = [
  "integral", // integrale / integrali
  "crusca",
  "avena",
  "farro",
  "segale",
  "muesli",
  "granola",
  "decorticato",
  "bulgur",
  "kamut",
  "quinoa",
  "teff",
  "sorgo",
  "amaranto",
  "saraceno",
  "multicereale",
  "germe di grano",
  "venere",
  "riso rosso",
  "riso selvaggio",
  "miglio",
  "popcorn",
  "grano soffiato",
  "grano duro",
  "fiocchi di cereali",
];

/**
 * Deroghe al lessico: l'etichetta contiene una parola «integrale» ma l'alimento non lo è.
 * Ogni riga porta la ragione. Chi ne aggiunge una si assume la decisione qui, in chiaro.
 */
const DEROGHE_LESSICO: Record<string, string> = {
  // Mario lascia esplicitamente disponibili «latte o latte vegetale»: una bevanda di avena
  // (0,5 g di fibra per 100 ml) non è il carico di fibre che la regola vuole evitare.
  oat_drink: "bevanda vegetale, non un cereale integrale: Mario la lascia disponibile",
};

/** Cereali «classici» che Mario lascia disponibili: NON devono risultare integrali. */
const CLASSICI_DI_MARIO = [
  "pasta_dry",
  "pasta_egg",
  "pasta_fresh",
  "rice_dry",
  "rice_parboiled",
  "rice_arborio",
  "corn_flakes",
  "bread_white",
  "bread_italian",
  "roll_hard",
  "rice_cakes",
  "cornmeal_polenta",
  "semolina",
  "couscous",
  "breadsticks",
  "puffed_rice",
];

type Row = {
  canonical_key: string;
  label_it: string;
  serving_basis: string;
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

let cachedRows: Row[] | null = null;
let cachedFiber: Map<number, number | null> | null = null;

function admin() {
  const creds = credentials;
  assert.ok(creds, "credenziali Supabase mancanti");
  return createClient(creds.url, creds.key, { auth: { persistSession: false } });
}

async function loadActiveRows(): Promise<Row[]> {
  if (cachedRows) return cachedRows;
  const client = admin();
  const rows: Row[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("nutrition_menu_foods")
      .select("canonical_key, label_it, serving_basis, is_fermented, is_wholegrain, pool_keys, fdc_id")
      .eq("is_active", true)
      .order("canonical_key")
      .range(from, from + pageSize - 1);
    // Colonna mancante → PostgREST 42703: il messaggio finisce nell'assert, è la prova rossa.
    assert.equal(error, null, `select fallita: ${error ? JSON.stringify(error) : ""}`);
    const page = (data ?? []) as Row[];
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

function lessicoDiceIntegrale(row: Row): boolean {
  const testo = `${row.label_it} ${row.canonical_key}`.toLowerCase();
  return PAROLE_INTEGRALE.some((p) => testo.includes(p));
}

/** Il verdetto vero del motore, costruito con gli stessi fatti che legge il compositore. */
function verdetto(row: Row, fibra: number | null) {
  return menuFoodFiberFermentedInfo(row.is_fermented, fibra, {
    isWholegrain: row.is_wholegrain,
    servingBasis: row.serving_basis,
  });
}

test("schema: is_wholegrain esiste e nessuna riga attiva resta senza classificazione", { skip: skipReason }, async () => {
  const rows = await loadActiveRows();
  const nulli = rows.filter((r) => r.is_wholegrain !== true && r.is_wholegrain !== false);
  assert.deepEqual(
    nulli.map((r) => r.canonical_key),
    [],
    "righe attive senza is_wholegrain (NULL / colonna assente)",
  );
});

test(
  "integrali: la colonna dichiarata e il lessico dell'etichetta dicono la stessa cosa su TUTTE le righe attive",
  { skip: skipReason },
  async () => {
    const rows = await loadActiveRows();

    // Il lessico dice integrale, la colonna no → classificazione dimenticata.
    const dimenticati = rows
      .filter((r) => lessicoDiceIntegrale(r) && r.is_wholegrain !== true && !(r.canonical_key in DEROGHE_LESSICO))
      .map((r) => `${r.canonical_key} (${r.label_it})`);
    assert.deepEqual(dimenticati, [], "l'etichetta dice integrale ma is_wholegrain è false");

    // La colonna dice integrale, il lessico no → o è un falso positivo, o il lessico va esteso.
    const inattesi = rows
      .filter((r) => r.is_wholegrain === true && !lessicoDiceIntegrale(r))
      .map((r) => `${r.canonical_key} (${r.label_it})`);
    assert.deepEqual(inattesi, [], "is_wholegrain è true ma nessuna parola dell'etichetta lo dice");

    // Le deroghe devono restare deroghe: se una diventa integrale, la riga va tolta dalla lista.
    const deroghePromosse = rows
      .filter((r) => r.canonical_key in DEROGHE_LESSICO && r.is_wholegrain === true)
      .map((r) => r.canonical_key);
    assert.deepEqual(deroghePromosse, [], "deroga al lessico ora marcata integrale: aggiornare DEROGHE_LESSICO");

    // La regola morde davvero: se il conteggio crolla a zero qualcosa ha azzerato la colonna.
    const integrali = rows.filter((r) => r.is_wholegrain === true);
    assert.ok(integrali.length >= 30, `solo ${integrali.length} integrali dichiarati: colonna azzerata?`);
  },
);

test(
  "pre-sforzo: nessun integrale del catalogo resta pescabile, e i classici di Mario restano",
  { skip: skipReason },
  async () => {
    const rows = await loadActiveRows();
    const fiber = await loadFiberByFdcId();
    const pool = (r: Row) =>
      (r.pool_keys ?? []).some((k) => ["breakfast_cho", "lunch_carb", "dinner_carb", "snack_cho"].includes(k));

    // Ogni riga dei pool cereali: se il lessico la dice integrale, il verdetto DEVE escluderla.
    // È il difetto che il test precedente non poteva vedere: il riso integrale cotto ha 1,6 g
    // di fibra e passava la soglia indenne.
    const integraliAmmessi = rows
      .filter((r) => pool(r) && lessicoDiceIntegrale(r) && !(r.canonical_key in DEROGHE_LESSICO))
      .filter((r) => {
        const info = verdetto(r, fiber.get(r.fdc_id) ?? null);
        return !(info.fermented || info.highFiber);
      })
      .map((r) => `${r.canonical_key} (${r.label_it}, fibra ${fiber.get(r.fdc_id) ?? "n/d"} ${r.serving_basis})`);
    assert.deepEqual(integraliAmmessi, [], "cereali integrali ancora pescabili nei pasti pre-sforzo");

    // …e il contrario: i classici che Mario lascia disponibili devono restare pescabili.
    const byKey = new Map(rows.map((r) => [r.canonical_key, r]));
    const classiciEsclusi: string[] = [];
    for (const key of CLASSICI_DI_MARIO) {
      const row = byKey.get(key);
      if (!row) continue; // chiave non più a catalogo: non è questo test a doverlo dire
      const info = verdetto(row, fiber.get(row.fdc_id) ?? null);
      if (info.fermented || info.highFiber) {
        classiciEsclusi.push(`${key} (${row.label_it}, fibra ${fiber.get(row.fdc_id) ?? "n/d"} ${row.serving_basis})`);
      }
    }
    assert.deepEqual(classiciEsclusi, [], "cereali classici esclusi: Mario li lascia disponibili");
  },
);

test(
  "fibra: il confronto è dentro la base di porzione, non fra basi diverse",
  { skip: skipReason },
  async () => {
    const rows = await loadActiveRows();
    const fiber = await loadFiberByFdcId();
    const byKey = new Map(rows.map((r) => [r.canonical_key, r]));
    const fibraDi = (key: string) => {
      const row = byKey.get(key);
      return row ? { fibra: fiber.get(row.fdc_id) ?? null, base: row.serving_basis } : null;
    };

    // Le due basi convivono DAVVERO nei pool cereali: se un giorno non fosse più vero, la
    // doppia soglia sarebbe complessità inutile e questo test lo direbbe.
    const carb = rows.filter((r) => (r.pool_keys ?? []).some((k) => k === "lunch_carb" || k === "dinner_carb"));
    const basi = new Set(carb.map((r) => r.serving_basis));
    assert.ok(basi.has("dry_grams") && basi.has("cooked_grams"), `pool carb su una sola base: ${[...basi].join(",")}`);

    // Il caso che dimostra il difetto: riso integrale COTTO 1,6 g/100 g contro pasta di semola
    // SECCA 3,2 g/100 g. Col numero nudo il riso integrale sembra il più leggero dei due.
    const riso = fibraDi("rice_brown");
    const pasta = fibraDi("pasta_dry");
    assert.deepEqual(riso, { fibra: 1.6, base: "cooked_grams" }, "riso integrale: fibra/base cambiate");
    assert.deepEqual(pasta, { fibra: 3.2, base: "dry_grams" }, "pasta di semola: fibra/base cambiate");
    assert.ok(riso!.fibra! < pasta!.fibra!, "premessa del difetto: il numero nudo del riso integrale è più basso");

    // Le soglie sono due e diverse: una sola soglia su due basi è il difetto, non la cura.
    assert.ok(
      MENU_FOOD_HIGH_FIBER_THRESHOLD_AS_EATEN_G < MENU_FOOD_HIGH_FIBER_THRESHOLD_DRY_G,
      "la soglia sul prodotto come si mangia deve essere più bassa di quella sul secco",
    );

    // Calibrazione sui valori veri, base per base: i classici sotto, i ricchi sopra.
    const sopraSecco = ["pasta_whole", "bread_whole_wheat", "muesli", "oat_dry", "wheat_bran"];
    for (const key of sopraSecco) {
      const v = fibraDi(key);
      if (!v || v.fibra == null) continue;
      assert.equal(v.base, "dry_grams", `${key}: base cambiata`);
      assert.ok(v.fibra >= MENU_FOOD_HIGH_FIBER_THRESHOLD_DRY_G, `${key} = ${v.fibra} g sotto la soglia secco`);
    }
    const sopraCotto = ["chickpeas_cooked", "beans_white", "chestnuts", "pasta_legumes", "barley_pearled"];
    for (const key of sopraCotto) {
      const v = fibraDi(key);
      if (!v || v.fibra == null) continue;
      assert.equal(v.base, "cooked_grams", `${key}: base cambiata`);
      assert.ok(
        v.fibra >= MENU_FOOD_HIGH_FIBER_THRESHOLD_AS_EATEN_G,
        `${key} = ${v.fibra} g sotto la soglia «come si mangia»`,
      );
    }
    // Patate e pomodori pelati sono cotti e poveri di fibra: la soglia bassa non deve mangiarseli.
    for (const key of ["potato_cooked", "tomatoes_canned", "couscous", "gnocchi_potato"]) {
      const v = fibraDi(key);
      if (!v || v.fibra == null) continue;
      assert.ok(
        v.fibra < MENU_FOOD_HIGH_FIBER_THRESHOLD_AS_EATEN_G,
        `${key} = ${v.fibra} g: la soglia «come si mangia» lo escluderebbe`,
      );
    }
  },
);

test("la regola non svuota i pool: restano alternative in colazione, pranzo e cena", { skip: skipReason }, async () => {
  const rows = await loadActiveRows();
  const fiber = await loadFiberByFdcId();
  const superstiti = (pool: string) =>
    rows.filter((r) => {
      if (!(r.pool_keys ?? []).includes(pool)) return false;
      const info = verdetto(r, fiber.get(r.fdc_id) ?? null);
      return !(info.fermented || info.highFiber);
    }).length;

  for (const pool of ["breakfast_cho", "breakfast_pro", "lunch_carb", "dinner_carb", "lunch_pro", "dinner_pro"]) {
    assert.ok(
      superstiti(pool) >= 5,
      `pool ${pool}: solo ${superstiti(pool)} alimenti superano la regola pre-sforzo`,
    );
  }
});
