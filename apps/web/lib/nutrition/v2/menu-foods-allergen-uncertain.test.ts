/**
 * DATI — la terza via degli allergeni: «incerto» non è «esaminato e pulito».
 *
 * IL BUCO CHE QUESTO TEST CHIUDE
 * La classificazione allergeni del catalogo (`nutrition_menu_foods`) ha marcato
 * `allergens_reviewed = true` su TUTTE le 499 righe attive, comprese quelle che la sua
 * stessa intestazione dichiarava di NON aver classificato (salumi, wurstel, castagne,
 * cocco). Effetto sui dati: mortadella, wurstel, salame, salsiccia risultavano
 * «esaminati e senza allergeni» — cioè sicuri — e il fail-closed di
 * `isAllergenExcludedInfo` non scattava più su di loro. Il difetto che il filtro per
 * classi doveva chiudere rientrava dai dati.
 *
 * LA REGOLA, in tre esiti distinti (non due):
 *   1. classificata      → `allergen_classes` piene, `allergens_reviewed = true`;
 *   2. genuinamente pulita → `{}` + `true` (mela, riso, olio EVO, petto di pollo);
 *   3. INCERTA           → `{}` + `allergens_reviewed = FALSE`, perché la lista
 *      ingredienti dipende da marca o ricetta. Un salume non è «senza allergeni»:
 *      è «non lo sappiamo», e il fail-closed deve escluderlo per un allergico invece
 *      di dichiararlo sicuro.
 *
 * Test sui dati di PRODUZIONE: gira solo con le credenziali Supabase in `.env.local`
 * (URL + service role). Senza credenziali SALTA con un messaggio esplicito, invece di
 * dare verde su un DB che non ha nemmeno interrogato.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  allergenFoodInfo,
  createAllergenFilterContext,
  isAllergenExcludedFdcId,
  type AllergenFoodInfo,
} from "@/lib/nutrition/v2/fdc-candidate-filter";

/**
 * Famiglie TRASFORMATE: prodotti composti la cui lista ingredienti cambia da marca a
 * marca e da ricetta a ricetta. Il riconoscimento è per NOME (non per elenco di chiavi)
 * apposta: la regola è «un salume non può essere dichiarato esaminato-e-senza-allergeni»,
 * e deve valere anche per le righe che qualcuno aggiungerà domani.
 *
 * Nella realtà italiana questi prodotti contengono con altissima frequenza lattosio
 * (latte), derivati della soia, senape, solfiti — e la mortadella i pistacchi
 * (frutta a guscio).
 */
const TRANSFORMED_FAMILIES: { famiglia: string; matches: (key: string, label: string) => boolean }[] = [
  {
    famiglia: "salumi, affettati e carni conservate",
    matches: (key, label) =>
      key.endsWith("_deli") ||
      /(mortadella|wurstel|salame|salsicci|prosciutto|coppa|speck|pancetta|bresaola|roast beef|affettat|in scatola)/.test(
        label,
      ),
  },
  {
    famiglia: "conserve di frutta zuccherate",
    matches: (_key, label) => /(confettura|marmellata)/.test(label),
  },
  {
    famiglia: "voci generiche (una classe di alimenti, non un alimento)",
    matches: (_key, label) => ["legumi", "confettura", "pasta di legumi"].includes(label.trim()),
  },
];

function transformedFamilyOf(key: string, labelIt: string): string | null {
  const label = (labelIt || "").toLowerCase();
  for (const f of TRANSFORMED_FAMILIES) {
    if (f.matches(key, label)) return f.famiglia;
  }
  return null;
}

type MenuFoodRow = {
  canonical_key: string;
  fdc_id: number | null;
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
      .select("canonical_key, fdc_id, label_it, allergen_classes, allergens_reviewed")
      .eq("is_active", true)
      .order("canonical_key")
      .range(from, from + pageSize - 1);
    assert.equal(error, null, `select fallita: ${error ? JSON.stringify(error) : ""}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as MenuFoodRow[]));
    if (data.length < pageSize) break;
  }
  assert.ok(rows.length > 0, "catalogo attivo vuoto: nessuna riga da verificare");
  cachedRows = rows;
  return rows;
}

test(
  "catalogo menù: nessun prodotto trasformato è dichiarato «esaminato e senza allergeni»",
  { skip: skipReason },
  async () => {
    const rows = await loadActiveRows();
    const bugiardi = rows
      .filter((r) => r.allergens_reviewed === true && (r.allergen_classes ?? []).length === 0)
      .map((r) => ({ row: r, famiglia: transformedFamilyOf(r.canonical_key, r.label_it) }))
      .filter((x) => x.famiglia !== null)
      .map((x) => `${x.row.canonical_key} ("${x.row.label_it}") — ${x.famiglia}`);

    assert.deepEqual(
      bugiardi,
      [],
      `righe trasformate marcate «esaminate e senza allergeni» (${bugiardi.length}): il fail-closed ` +
        `non scatta più su di loro. Devono tornare allergens_reviewed = false.\n  ${bugiardi.join("\n  ")}`,
    );
  },
);

test(
  "catalogo menù: la famiglia trasformata è riconosciuta e presente (il test non passa a vuoto)",
  { skip: skipReason },
  async () => {
    const rows = await loadActiveRows();
    const trasformate = rows.filter((r) => transformedFamilyOf(r.canonical_key, r.label_it) !== null);
    // Se il catalogo cambiasse nome alle righe, il test sopra passerebbe perché non trova
    // nulla da controllare: questo lo impedisce.
    assert.ok(
      trasformate.length >= 15,
      `attese almeno 15 righe di famiglie trasformate, trovate ${trasformate.length}`,
    );
    for (const key of ["mortadella", "wurstel", "salame", "salsiccia"]) {
      const row = rows.find((r) => r.canonical_key === key);
      assert.ok(row, `riga "${key}" assente dal catalogo attivo`);
      assert.ok(
        transformedFamilyOf(row.canonical_key, row.label_it) !== null,
        `"${key}" non riconosciuta come famiglia trasformata`,
      );
    }
  },
);

test(
  "fail-closed: per un allergico al LATTE una riga incerta (mortadella) viene esclusa, il pollo no",
  { skip: skipReason },
  async () => {
    const rows = await loadActiveRows();
    const byKey = new Map(rows.map((r) => [r.canonical_key, r]));

    // Indice come lo costruisce il motore: fdcId → classi + esaminata.
    const foodIndex = new Map<number, AllergenFoodInfo>();
    for (const r of rows) {
      if (typeof r.fdc_id !== "number") continue;
      foodIndex.set(r.fdc_id, allergenFoodInfo(r.allergen_classes, r.allergens_reviewed));
    }

    // Atleta con ALLERGIA al latte (la classe arriva da allergie/intolleranze → fail-closed armato).
    const ctx = createAllergenFilterContext({ allergyClasses: ["latte"], foodIndex });
    assert.ok(ctx, "contesto allergeni nullo: l'atleta ha una classe dichiarata");
    assert.equal(ctx.failClosed, true, "fail-closed non armato: il catalogo non ha righe esaminate");

    const mortadella = byKey.get("mortadella");
    assert.ok(mortadella, "riga mortadella assente dal catalogo attivo");
    assert.equal(
      mortadella.allergens_reviewed,
      false,
      "mortadella dichiarata esaminata: la lista ingredienti dipende dalla marca (lattosio, soia, pistacchi)",
    );
    assert.equal(
      isAllergenExcludedFdcId(mortadella.fdc_id, ctx),
      true,
      "mortadella NON esclusa per un allergico al latte: il fail-closed non è scattato",
    );

    // …e il filtro non svuota il piatto: un alimento davvero pulito resta ammesso.
    const pollo = byKey.get("chicken_breast");
    assert.ok(pollo, "riga chicken_breast assente dal catalogo attivo");
    assert.equal(pollo.allergens_reviewed, true, "petto di pollo fresco deve restare esaminato-e-pulito");
    assert.deepEqual(pollo.allergen_classes ?? [], [], "petto di pollo fresco non ha allergeni EU");
    assert.equal(
      isAllergenExcludedFdcId(pollo.fdc_id, ctx),
      false,
      "petto di pollo escluso per un allergico al latte: il fail-closed sta togliendo troppo",
    );

    // Controprova sull'altra via d'uscita: la classe dichiarata esclude comunque.
    const parmigiano = byKey.get("parmigiano_reggiano");
    assert.ok(parmigiano, "riga parmigiano_reggiano assente dal catalogo attivo");
    assert.equal(
      isAllergenExcludedFdcId(parmigiano.fdc_id, ctx),
      true,
      "parmigiano non escluso per un allergico al latte",
    );
  },
);

test(
  "fail-closed: senza allergie dichiarate le righe incerte restano disponibili",
  { skip: skipReason },
  async () => {
    const rows = await loadActiveRows();
    const mortadella = rows.find((r) => r.canonical_key === "mortadella");
    assert.ok(mortadella, "riga mortadella assente dal catalogo attivo");

    const foodIndex = new Map<number, AllergenFoodInfo>();
    for (const r of rows) {
      if (typeof r.fdc_id !== "number") continue;
      foodIndex.set(r.fdc_id, allergenFoodInfo(r.allergen_classes, r.allergens_reviewed));
    }

    // Nessuna classe dichiarata → nessun contesto → catalogo intatto per chi non è allergico.
    const ctx = createAllergenFilterContext({ allergyClasses: [], foodIndex });
    assert.equal(ctx, null, "contesto creato per un atleta senza allergie: cambierebbe i piani di tutti");
    assert.equal(
      isAllergenExcludedFdcId(mortadella.fdc_id, ctx),
      false,
      "mortadella esclusa a un atleta senza allergie: la prudenza non deve costare a chi non serve",
    );
  },
);
