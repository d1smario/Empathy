/**
 * DATI + SCHEMA — classificazione allergeni del catalogo `nutrition_menu_foods`.
 *
 * Il catalogo (fonte del pool del motore V2) aveva solo is_meat/is_fish/is_animal_product:
 * nessuna colonna allergeni. Il filtro di sicurezza lavorava per SOTTOSTRINGA sulla
 * descrizione e per questo lasciava passare «Frutta secca mista tostata» a un allergico
 * alla frutta a guscio e «Latticello» a un intollerante al lattosio.
 *
 * Questo test verifica il CONTRATTO DATI su cui si appoggia il filtro:
 *   - `allergen_classes text[] NOT NULL DEFAULT '{}'`  → vocabolario CHIUSO di 14 token EU;
 *   - `allergens_reviewed boolean NOT NULL DEFAULT false` → «esaminato» ≠ «mai guardato»:
 *     una riga con elenco vuoto è sicura SOLO se qualcuno l'ha davvero esaminata.
 *
 * È un test sui dati di produzione: gira solo quando trova le credenziali Supabase in
 * `.env.local` (URL + service role). Senza credenziali si SALTA con un messaggio esplicito
 * invece di dare falso verde su un DB che non ha nemmeno interrogato.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

/** Vocabolario chiuso: i 14 allergeni EU (Allegato II Reg. 1169/2011) in snake_case IT. */
const ALLERGEN_VOCABULARY = [
  "glutine",
  "crostacei",
  "uova",
  "pesce",
  "arachidi",
  "soia",
  "latte",
  "frutta_a_guscio",
  "sedano",
  "senape",
  "sesamo",
  "solfiti",
  "lupini",
  "molluschi",
] as const;

/**
 * Casi reali che il filtro per sottostringa NON prendeva: la descrizione non contiene la
 * parola dell'allergene («Latticello» non contiene «latte», «Tahini» non contiene «sesamo»,
 * «Frutta secca mista» non nomina nessuna noce). Almeno queste classi devono esserci.
 */
const MUST_CONTAIN: Record<string, string[]> = {
  mixed_nuts: ["frutta_a_guscio"],
  mixed_nuts_roasted: ["frutta_a_guscio"],
  pine_nuts: ["frutta_a_guscio"],
  buttermilk: ["latte"],
  ghee: ["latte"],
  whey_protein_powder: ["latte"],
  whey_protein_ultrafiltered: ["latte"],
  casein_micellar: ["latte"],
  cottage_cheese: ["latte"],
  burrata: ["latte"],
  peanut_butter: ["arachidi"],
  peanut_butter_crunchy: ["arachidi"],
  peanut_oil: ["arachidi"],
  tahini: ["sesamo"],
  hummus: ["sesamo"],
  sesame_oil: ["sesamo"],
  tortilla_flour: ["glutine"],
  seitan: ["glutine"],
  couscous: ["glutine"],
  bulgur: ["glutine"],
  semolina: ["glutine"],
  oat_dry: ["glutine"],
  oat_drink: ["glutine"],
  corn_flakes: ["glutine"],
  gnocchi_potato: ["glutine"],
  rusk_toast: ["glutine"],
  croissant_butter: ["glutine", "latte", "uova"],
  pasta_egg: ["glutine", "uova"],
  hazelnut_cocoa_spread: ["frutta_a_guscio", "latte"],
  tempeh: ["soia"],
  tofu_firm: ["soia"],
  soy_protein_powder: ["soia"],
  lupins: ["lupini"],
  celeriac: ["sedano"],
  celery: ["sedano"],
  shrimp: ["crostacei"],
  spider_crab: ["crostacei"],
  langoustine: ["crostacei"],
  clams: ["molluschi"],
  squid: ["molluschi"],
  octopus: ["molluschi"],
  cuttlefish: ["molluschi"],
  salt_cod: ["pesce"],
  anchovy_oil: ["pesce"],
  fish_white: ["pesce"],
  smoked_salmon: ["pesce"],
  egg_white: ["uova"],
  apricots_dried: ["solfiti"],
};

/** L'altra metà della sicurezza: niente falsi positivi da sottostringa. */
const MUST_NOT_CONTAIN: Record<string, string[]> = {
  // «Latte di cocco» / «Bevanda di mandorla»: la parola «latte» c'è, il latte no.
  coconut_milk: ["latte"],
  soymilk: ["latte"],
  soy_yogurt: ["latte"],
  almond_drink_unsweetened: ["latte"],
  rice_drink: ["latte"],
  // Gallette e paste senza glutine: il filtro non deve toglierle a un celiaco.
  rice_cakes: ["glutine"],
  corn_cakes: ["glutine"],
  pasta_corn_gf: ["glutine"],
  puffed_rice: ["glutine"],
  polenta_placeholder_never_present: [],
  // Le arachidi NON sono frutta a guscio (classi EU distinte) e viceversa.
  peanuts: ["frutta_a_guscio"],
  almonds_raw: ["arachidi"],
  // Pseudo-cereali e cereali naturalmente senza glutine.
  quinoa_dry: ["glutine"],
  buckwheat: ["glutine"],
  millet: ["glutine"],
  amaranth: ["glutine"],
  teff: ["glutine"],
};

type MenuFoodRow = {
  canonical_key: string;
  label_it: string;
  allergen_classes: string[] | null;
  allergens_reviewed: boolean | null;
};

function collectEnvFiles(): string[] {
  const found: string[] = [];
  let dir = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    for (const candidate of [
      path.join(dir, ".env.local"),
      path.join(dir, "apps", "web", ".env.local"),
    ]) {
      if (existsSync(candidate) && !found.includes(candidate)) found.push(candidate);
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return found;
}

function readEnvCredentials(): { url: string; key: string } | null {
  // Le variabili possono stare in più .env.local (root e apps/web): si fondono, primo vince.
  const parsed = new Map<string, string>();
  for (const envFile of collectEnvFiles()) {
    for (const raw of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const name = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
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
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || parsed.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return url && key ? { url, key } : null;
}

const credentials = readEnvCredentials();
const skipReason = credentials
  ? false
  : "credenziali Supabase assenti (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local)";

let cachedRows: MenuFoodRow[] | null = null;

async function loadActiveRows(): Promise<MenuFoodRow[]> {
  if (cachedRows) return cachedRows;
  const creds = credentials;
  assert.ok(creds, "credenziali Supabase mancanti");
  const admin = createClient(creds.url, creds.key, { auth: { persistSession: false } });
  const rows: MenuFoodRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("nutrition_menu_foods")
      .select("canonical_key, label_it, allergen_classes, allergens_reviewed")
      .eq("is_active", true)
      .order("canonical_key")
      .range(from, from + pageSize - 1);
    // Colonne mancanti → PostgREST 42703: il messaggio finisce nell'assert, è la prova rossa.
    assert.equal(error, null, `select fallita: ${error ? JSON.stringify(error) : ""}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as MenuFoodRow[]));
    if (data.length < pageSize) break;
  }
  assert.ok(rows.length > 0, "catalogo attivo vuoto: nessuna riga da verificare");
  cachedRows = rows;
  return rows;
}

test("catalogo menù: le colonne allergeni esistono e il catalogo attivo non è vuoto", { skip: skipReason }, async () => {
  const rows = await loadActiveRows();
  assert.ok(rows.length >= 400, `attese ~499 righe attive, trovate ${rows.length}`);
  for (const row of rows) {
    assert.ok(Array.isArray(row.allergen_classes), `${row.canonical_key}: allergen_classes non è un array`);
    assert.equal(typeof row.allergens_reviewed, "boolean", `${row.canonical_key}: allergens_reviewed non è booleano`);
  }
});

test("catalogo menù: vocabolario allergeni CHIUSO ai 14 token EU", { skip: skipReason }, async () => {
  const rows = await loadActiveRows();
  const allowed = new Set<string>(ALLERGEN_VOCABULARY);
  const offenders: string[] = [];
  for (const row of rows) {
    for (const token of row.allergen_classes ?? []) {
      if (!allowed.has(token)) offenders.push(`${row.canonical_key} → "${token}"`);
    }
    const tokens = row.allergen_classes ?? [];
    assert.equal(
      new Set(tokens).size,
      tokens.length,
      `${row.canonical_key}: token duplicati in allergen_classes (${tokens.join(", ")})`,
    );
  }
  assert.deepEqual(offenders, [], `token fuori vocabolario: ${offenders.join(" | ")}`);
});

/**
 * Le righe INCERTE dichiarate dalla migrazione 20260908110000: prodotti trasformati o voci
 * generiche la cui lista ingredienti dipende da marca o ricetta. Stanno a `{}` con
 * `allergens_reviewed = false` APPOSTA, così il fail-closed le esclude per un allergico invece
 * di dichiararle sicure. L'elenco è chiuso: una riga nuova che nessuno ha guardato nascerebbe
 * false e non è qui dentro → il test sotto la trova.
 */
const INCERTE_DICHIARATE = [
  // salumi, affettati e carni conservate (14)
  "bresaola",
  "chicken_breast_deli",
  "coppa",
  "corned_beef_canned",
  "ham_cooked",
  "mortadella",
  "pork_belly_cured",
  "prosciutto_crudo",
  "roast_beef_deli",
  "salame",
  "salsiccia",
  "speck",
  "turkey_breast_deli",
  "wurstel",
  // voci generiche (3)
  "jam_preserves",
  "legumes_cooked",
  "pasta_legumes",
  // conserve di frutta zuccherate (2)
  "jam_apricot",
  "marmalade_orange",
  // cereali soffiati da colazione (1) + frutta essiccata (1)
  "puffed_rice",
  "dates_medjool",
].sort();

/**
 * PRIMA questo test chiedeva `allergens_reviewed = true` su OGNI riga attiva. Era la richiesta
 * sbagliata: costringeva a marcare «esaminato e senza allergeni» anche mortadella, wurstel,
 * salame e salsiccia — e con l'elenco vuoto dichiarato affidabile il fail-closed smetteva di
 * scattare proprio su di loro. La regola giusta non è «tutto esaminato» ma «niente lasciato
 * indietro in silenzio»: le uniche righe non fidate devono essere quelle DICHIARATE incerte.
 */
test("catalogo menù: le righe non fidate sono esattamente quelle dichiarate incerte", { skip: skipReason }, async () => {
  const rows = await loadActiveRows();
  const nonFidate = rows
    .filter((r) => r.allergens_reviewed !== true)
    .map((r) => r.canonical_key)
    .sort();

  const impreviste = nonFidate.filter((k) => !INCERTE_DICHIARATE.includes(k));
  assert.deepEqual(
    impreviste,
    [],
    `righe non fidate ma mai dichiarate incerte (${impreviste.length}): sono state aggiunte senza esame. ` +
      `${impreviste.slice(0, 25).join(", ")}${impreviste.length > 25 ? " …" : ""}`,
  );

  const promosseASorpresa = INCERTE_DICHIARATE.filter((k) => !nonFidate.includes(k));
  assert.deepEqual(
    promosseASorpresa,
    [],
    `righe dichiarate incerte ma tornate «esaminate» (${promosseASorpresa.length}): il fail-closed non le esclude più. ` +
      `${promosseASorpresa.join(", ")}`,
  );

  // Le incerte non devono nemmeno portare classi: «non lo sappiamo» ≠ «sappiamo che ha X».
  const byKey = new Map(rows.map((r) => [r.canonical_key, r]));
  for (const key of INCERTE_DICHIARATE) {
    const row = byKey.get(key);
    if (!row) continue;
    assert.deepEqual(
      row.allergen_classes ?? [],
      [],
      `${key} ("${row.label_it}") è incerta ma porta classi: decidere se classificarla o lasciarla incerta`,
    );
  }
});

test("catalogo menù: i casi che sfuggivano al filtro per sottostringa sono classificati", { skip: skipReason }, async () => {
  const rows = await loadActiveRows();
  const byKey = new Map(rows.map((r) => [r.canonical_key, r]));
  const missing: string[] = [];
  for (const [key, expected] of Object.entries(MUST_CONTAIN)) {
    const row = byKey.get(key);
    if (!row) continue; // riga non presente/disattivata: non è questo test a doverlo dire
    const actual = new Set(row.allergen_classes ?? []);
    for (const cls of expected) {
      if (!actual.has(cls)) missing.push(`${key} ("${row.label_it}") manca "${cls}"`);
    }
  }
  assert.deepEqual(missing, [], `classificazioni mancanti: ${missing.join(" | ")}`);
});

test("catalogo menù: nessun falso positivo da sottostringa (latte di cocco, gallette, arachidi≠noci)", { skip: skipReason }, async () => {
  const rows = await loadActiveRows();
  const byKey = new Map(rows.map((r) => [r.canonical_key, r]));
  const wrong: string[] = [];
  for (const [key, forbidden] of Object.entries(MUST_NOT_CONTAIN)) {
    const row = byKey.get(key);
    if (!row) continue;
    const actual = new Set(row.allergen_classes ?? []);
    for (const cls of forbidden) {
      if (actual.has(cls)) wrong.push(`${key} ("${row.label_it}") non deve avere "${cls}"`);
    }
  }
  assert.deepEqual(wrong, [], `classi di troppo: ${wrong.join(" | ")}`);
});
