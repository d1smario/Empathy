import assert from "node:assert/strict";
import test from "node:test";

import { HEALTH_MARKERS } from "@/lib/health/health-ontology";
import {
  buildManualMarkerCatalog,
  buildManualStagingPatches,
  convertLabValueToCanonicalUnit,
  validateManualLabEntry,
  validateManualLabEntryBatch,
  validateManualSampleDate,
} from "@/lib/health/manual-lab-entry";

/**
 * Inserimento manuale referto — logica pura.
 *
 * Il caso che dà il nome a questo file è REALE (audit Health, 2026-09): un referto con
 * «Emoglobina 156 g/L» entrava nel sistema come 156 e le soglie cliniche, scritte in g/dL,
 * non scattavano. Qui l'unità è obbligatoria e la conversione avviene PRIMA della scrittura:
 * il valore canonico che finisce nello staging run è già nell'unità che
 * `health-observation-normalizer` assume (`HealthMarkerDefinition.unit`).
 */

const catalog = buildManualMarkerCatalog(HEALTH_MARKERS);

test("catalogo: ogni marcatore con unità canonica accetta almeno la sua unità, in prima posizione", () => {
  const hb = catalog.find((m) => m.key === "emoglobina");
  assert.ok(hb, "emoglobina deve essere nel vocabolario");
  assert.equal(hb.canonicalUnit, "g/dL");
  assert.equal(hb.acceptedUnits[0], "g/dL");
  assert.ok(hb.acceptedUnits.includes("g/L"), "g/L è l'unità del referto dell'audit");
  assert.ok(hb.acceptedUnits.includes("mmol/L"));
});

test("catalogo: marcatore senza unità canonica non propone unità", () => {
  const sod = catalog.find((m) => m.key === "sod");
  assert.ok(sod);
  assert.equal(sod.canonicalUnit, null);
  assert.deepEqual(sod.acceptedUnits, []);
});

test("catalogo: filtrabile per pannello e non mescola i pannelli", () => {
  const blood = buildManualMarkerCatalog(HEALTH_MARKERS, "blood");
  assert.ok(blood.length > 0);
  assert.ok(blood.every((m) => m.panelType === "blood"));
  assert.ok(!blood.some((m) => m.key === "tsh"));
});

test("marcatore sconosciuto è rifiutato", () => {
  const res = validateManualLabEntry({ markerKey: "colesterolo_buono", value: "1", unit: "mg/dL" }, catalog);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.error.code, "unknown_marker");
  assert.equal(res.error.field, "marker");
});

test("marcatore di un altro pannello è rifiutato quando il pannello è vincolato", () => {
  const res = validateManualLabEntry({ markerKey: "tsh", value: "2", unit: "uIU/mL" }, catalog, {
    panelType: "blood",
  });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.error.code, "marker_panel_mismatch");
});

test("unità obbligatoria: marcatore con unità canonica e unità vuota è rifiutato", () => {
  const res = validateManualLabEntry({ markerKey: "emoglobina", value: "15.6", unit: "" }, catalog);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.error.code, "unit_required");
  assert.equal(res.error.field, "unit");
});

test("unità estranea al marcatore è rifiutata invece di essere ignorata", () => {
  const res = validateManualLabEntry({ markerKey: "emoglobina", value: "156", unit: "mmHg" }, catalog);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.error.code, "unit_not_accepted");
  assert.equal(res.error.field, "unit");
});

test("unità su marcatore senza unità canonica è rifiutata", () => {
  const res = validateManualLabEntry({ markerKey: "sod", value: "12", unit: "mg/dL" }, catalog);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.error.code, "unit_not_expected");
});

test("AUDIT: emoglobina 156 g/L entra come 15.6 g/dL, non come 156", () => {
  const res = validateManualLabEntry({ markerKey: "emoglobina", value: "156", unit: "g/L" }, catalog);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.entry.canonicalUnit, "g/dL");
  assert.equal(res.entry.canonicalValue, 15.6);
  assert.equal(res.entry.enteredValue, 156);
  assert.equal(res.entry.enteredUnit, "g/L");
  assert.equal(res.entry.converted, true);
});

test("stessa unità: nessuna conversione, valore invariato", () => {
  const res = validateManualLabEntry({ markerKey: "emoglobina", value: "15,6", unit: "g/dL" }, catalog);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.entry.canonicalValue, 15.6);
  assert.equal(res.entry.converted, false);
});

test("conversione molare: glicemia 5.5 mmol/L → mg/dL", () => {
  const res = validateManualLabEntry({ markerKey: "glicemia", value: "5.5", unit: "mmol/L" }, catalog);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.entry.canonicalUnit, "mg/dL");
  assert.ok(Math.abs(res.entry.canonicalValue - 99.09) < 0.05, `atteso ~99.09, ottenuto ${res.entry.canonicalValue}`);
});

test("conversione conteggi: piastrine 250 10^9/L → 250 10^3/uL", () => {
  const res = validateManualLabEntry({ markerKey: "plt", value: "250", unit: "10^9/L" }, catalog);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.entry.canonicalValue, 250);
});

test("conversione conteggi: globuli bianchi 7200 /uL → 7.2 10^3/uL", () => {
  const res = validateManualLabEntry({ markerKey: "wbc", value: "7200", unit: "/uL" }, catalog);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.entry.canonicalValue, 7.2);
});

test("HbA1c IFCC: 48 mmol/mol → ~6.54 %", () => {
  const res = validateManualLabEntry({ markerKey: "hba1c", value: "48", unit: "mmol/mol" }, catalog);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.entry.canonicalUnit, "%");
  assert.ok(Math.abs(res.entry.canonicalValue - 6.542) < 0.01, `atteso ~6.54, ottenuto ${res.entry.canonicalValue}`);
});

test("vitamina D 75 nmol/L → 30 ng/mL", () => {
  const res = validateManualLabEntry({ markerKey: "vit_d", value: "75", unit: "nmol/L" }, catalog);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.ok(Math.abs(res.entry.canonicalValue - 30.0) < 0.2, `atteso ~30, ottenuto ${res.entry.canonicalValue}`);
});

test("valore non numerico rifiutato", () => {
  for (const bad of ["", "   ", "abc", "12,3,4", "NaN"]) {
    const res = validateManualLabEntry({ markerKey: "ferritina", value: bad, unit: "ng/mL" }, catalog);
    assert.equal(res.ok, false, `«${bad}» doveva essere rifiutato`);
    if (res.ok) continue;
    assert.equal(res.error.field, "value");
  }
});

test("valore negativo rifiutato su un marcatore di concentrazione", () => {
  const res = validateManualLabEntry({ markerKey: "ferritina", value: "-3", unit: "ng/mL" }, catalog);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.error.code, "negative_value");
});

test("valore negativo ammesso sul delta di età biologica", () => {
  const res = validateManualLabEntry({ markerKey: "biological_age_delta", value: "-2.4", unit: "" }, catalog);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.entry.canonicalValue, -2.4);
});

test("valore fuori plausibilità rifiutato sul marcatore che un intervallo ce l'ha", () => {
  const res = validateManualLabEntry({ markerKey: "ferritina", value: "99999999", unit: "ng/mL" }, catalog);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.error.code, "value_out_of_plausible_range");
});

/** Senza intervallo (punteggi di scala ignota) resta solo il tetto anti-refuso. */
test("valore fuori scala rifiutato sul marcatore senza intervallo di plausibilità", () => {
  const res = validateManualLabEntry({ markerKey: "sod", value: "99999999999", unit: "" }, catalog);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.error.code, "value_out_of_scale");
});

test("data prelievo: formato, futuro e preistoria rifiutati; ISO valida accettata", () => {
  const today = "2026-09-08";
  assert.equal(validateManualSampleDate("08/09/2026", today).ok, false);
  assert.equal(validateManualSampleDate("2026-02-30", today).ok, false);
  assert.equal(validateManualSampleDate("2026-09-11", today).ok, false);
  assert.equal(validateManualSampleDate("1899-12-31", today).ok, false);
  const ok = validateManualSampleDate("2026-09-08", today);
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.date, "2026-09-08");
});

test("batch: raccoglie tutti gli errori e rifiuta i marcatori duplicati", () => {
  const res = validateManualLabEntryBatch(
    [
      { markerKey: "emoglobina", value: "156", unit: "g/L" },
      { markerKey: "emoglobina", value: "15.7", unit: "g/dL" },
      { markerKey: "ferritina", value: "boh", unit: "ng/mL" },
    ],
    catalog,
    { panelType: "blood" },
  );
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.errors.length, 2);
  assert.ok(res.errors.some((e) => e.code === "duplicate_marker"));
  assert.ok(res.errors.some((e) => e.field === "value"));
});

test("batch vuoto rifiutato", () => {
  const res = validateManualLabEntryBatch([], catalog, { panelType: "blood" });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.errors[0].code, "no_entries");
});

test("batch valido produce patch nella forma che la review page e /apply già consumano", () => {
  const res = validateManualLabEntryBatch(
    [
      { markerKey: "emoglobina", value: "156", unit: "g/L" },
      { markerKey: "ferritina", value: "42", unit: "ng/mL" },
    ],
    catalog,
    { panelType: "blood" },
  );
  assert.equal(res.ok, true);
  if (!res.ok) return;
  const patches = buildManualStagingPatches(res.entries, "blood");
  assert.equal(patches.length, 2);
  const hb = patches[0];
  assert.equal(hb.target, "health.blood");
  assert.equal(hb.action, "set_field");
  assert.equal(hb.field, "emoglobina");
  assert.equal(hb.proposed_value, 15.6);
  assert.equal(hb.unit, "g/dL");
  assert.equal(hb.confidence, 1);
  assert.ok(String(hb.notes).includes("156"), "la nota conserva il valore originale del referto");
  assert.ok(String(hb.notes).includes("g/L"));
});

test("convertLabValueToCanonicalUnit è simmetrica sulle unità di massa/volume", () => {
  const down = convertLabValueToCanonicalUnit({ markerKey: "emoglobina", value: 156, fromUnit: "g/L", toUnit: "g/dL" });
  assert.equal(down.ok, true);
  if (!down.ok) return;
  const up = convertLabValueToCanonicalUnit({
    markerKey: "emoglobina",
    value: down.value,
    fromUnit: "g/dL",
    toUnit: "g/L",
  });
  assert.equal(up.ok, true);
  if (!up.ok) return;
  assert.equal(up.value, 156);
});

test("convertLabValueToCanonicalUnit non inventa ponti tra dimensioni diverse senza massa molare", () => {
  const res = convertLabValueToCanonicalUnit({
    markerKey: "il6",
    value: 3,
    fromUnit: "pmol/L",
    toUnit: "pg/mL",
  });
  assert.equal(res.ok, false);
});

test("tolleranza di scrittura: micro µ/μ, spazi e maiuscole non cambiano il risultato", () => {
  for (const unit of ["µg/L", "μg/L", " UG / L ", "ug/l"]) {
    const res = validateManualLabEntry({ markerKey: "ferritina", value: "42", unit }, catalog);
    assert.equal(res.ok, true, `unità «${unit}» doveva essere accettata`);
    if (!res.ok) continue;
    assert.equal(res.entry.canonicalValue, 42);
    assert.equal(res.entry.canonicalUnit, "ng/mL");
  }
});

/**
 * Regressione: `L/L` è un rapporto fra grandezze omogenee, non un «volume per volume».
 * La prima stesura lo faceva cadere nel ramo per-volume e lo rifiutava.
 */
test("ematocrito 0.45 L/L → 45 %", () => {
  const res = validateManualLabEntry({ markerKey: "hct", value: "0,45", unit: "L/L" }, catalog);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.entry.canonicalUnit, "%");
  assert.equal(res.entry.canonicalValue, 45);
});

test("mmol/mol non si converte da sola in %: solo HbA1c ha la relazione (affine)", () => {
  const hct = catalog.find((m) => m.key === "hct");
  assert.ok(hct);
  assert.ok(!hct.acceptedUnits.includes("mmol/mol"));
  const hba1c = catalog.find((m) => m.key === "hba1c");
  assert.ok(hba1c);
  assert.ok(hba1c.acceptedUnits.includes("mmol/mol"));
});

/* ------------------------------------------------------------------ */
/* Revisione 2026-09: unità SENSATE, non solo convertibili              */
/* ------------------------------------------------------------------ */

/**
 * Il menù non è più «tutto ciò che sa convertirsi»: quella regola offriva all'emoglobina
 * 16 unità, fra cui `mg/dL` (15.6 → 0.0156) e `pg/dL` (15.6 → 0), entrambe numeri che
 * passavano ogni controllo e arrivavano al coach come valore proposto.
 */
test("menù curato: emoglobina offre solo le unità che si vedono sui referti", () => {
  const hb = catalog.find((m) => m.key === "emoglobina");
  assert.ok(hb);
  assert.deepEqual(hb.acceptedUnits, ["g/dL", "g/L", "mmol/L"]);
});

test("menù curato: nessuna unità offerta è un vicolo cieco (il server la accetta davvero)", () => {
  const dead: string[] = [];
  for (const marker of catalog) {
    if (!marker.canonicalUnit || !marker.plausibleRange) continue;
    const mid = (marker.plausibleRange.min + marker.plausibleRange.max) / 2;
    for (const unit of marker.acceptedUnits) {
      const back = convertLabValueToCanonicalUnit({
        markerKey: marker.key,
        value: mid,
        fromUnit: marker.canonicalUnit,
        toUnit: unit,
      });
      if (!back.ok) {
        dead.push(`${marker.key}/${unit}: canonica→unità non convertibile`);
        continue;
      }
      // Numero, non stringa: qui si prova il MENÙ, non la lettura della scrittura.
      const res = validateManualLabEntry({ markerKey: marker.key, value: back.value, unit }, catalog);
      if (!res.ok) dead.push(`${marker.key}/${unit}: ${res.error.code}`);
    }
  }
  assert.deepEqual(dead, [], `unità offerte ma rifiutate: ${dead.join(" | ")}`);
});

test("menù curato: ogni marcatore con unità canonica ha una lista curata e un intervallo di plausibilità", () => {
  const missing = catalog
    .filter((m) => m.canonicalUnit)
    .filter((m) => m.acceptedUnits.length === 0 || !m.plausibleRange)
    .map((m) => m.key);
  assert.deepEqual(missing, []);
});

test("unità clinicamente assurda rifiutata NOMINANDO l'unità, non il valore", () => {
  for (const unit of ["mg/dL", "pg/dL", "ug/L", "ng/mL"]) {
    const res = validateManualLabEntry({ markerKey: "emoglobina", value: "15.6", unit }, catalog);
    assert.equal(res.ok, false, `«${unit}» doveva essere rifiutata per l'emoglobina`);
    if (res.ok) continue;
    assert.equal(res.error.field, "unit");
    assert.equal(res.error.code, "unit_not_accepted");
  }
});

/** Prova del revisore: ematocrito 45 con «L/L» entrava come 4500 %. */
test("PLAUSIBILITÀ: ematocrito 45 dichiarato in L/L è rifiutato, e il messaggio nomina l'unità", () => {
  const res = validateManualLabEntry({ markerKey: "hct", value: "45", unit: "L/L" }, catalog);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.error.code, "value_out_of_plausible_range");
  assert.equal(res.error.field, "value");
  assert.ok(res.error.message.includes("L/L"), `il messaggio deve nominare l'unità: ${res.error.message}`);
});

test("PLAUSIBILITÀ: lo stesso ematocrito scritto bene passa in entrambe le unità", () => {
  const pct = validateManualLabEntry({ markerKey: "hct", value: "45", unit: "%" }, catalog);
  assert.equal(pct.ok, true);
  const ll = validateManualLabEntry({ markerKey: "hct", value: "0,45", unit: "L/L" }, catalog);
  assert.equal(ll.ok, true);
  if (!ll.ok) return;
  assert.equal(ll.entry.canonicalValue, 45);
});

test("PLAUSIBILITÀ: uno zero non è un valore, è l'assenza di un valore travestita", () => {
  const res = validateManualLabEntry({ markerKey: "emoglobina", value: "0", unit: "g/dL" }, catalog);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.error.code, "value_out_of_plausible_range");
});

/* ------------------------------------------------------------------ */
/* Separatore delle migliaia italiano                                   */
/* ------------------------------------------------------------------ */

/**
 * «250.000» è ESATTAMENTE come un emocromo italiano stampa le piastrine. Prima diventava
 * 0.25 ×10³/µL — una trombocitopenia catastrofica al posto di un valore normale.
 * Qui non si indovina: la scrittura è ambigua (250 mila o 250,000?) e viene rifiutata
 * dicendo come riscriverla.
 */
test("MIGLIAIA: «250.000» non diventa mai 0.25 — è ambiguo e viene rifiutato", () => {
  const res = validateManualLabEntry({ markerKey: "plt", value: "250.000", unit: "10^3/uL" }, catalog);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.error.code, "ambiguous_number_format");
  assert.equal(res.error.field, "value");
  assert.ok(res.error.message.includes("250000"), `il messaggio deve suggerire come riscriverlo: ${res.error.message}`);
});

/**
 * La virgola resta il decimale (serve a poter scrivere tre decimali). Chi arriva dall'inglese e
 * scrive «250,000» per duecentocinquantamila non passa comunque in silenzio: quello che ne esce
 * — 0.25 ×10³/µL — è fuori plausibilità e viene fermato lì.
 */
test("MIGLIAIA: la virgola è il decimale, e l'errore all'inglese lo ferma la plausibilità", () => {
  const asDecimal = validateManualLabEntry({ markerKey: "plt", value: "250,000", unit: "10^3/uL" }, catalog);
  assert.equal(asDecimal.ok, true);
  if (!asDecimal.ok) return;
  assert.equal(asDecimal.entry.canonicalValue, 250);

  const perMicroliter = validateManualLabEntry({ markerKey: "plt", value: "250,000", unit: "/uL" }, catalog);
  assert.equal(perMicroliter.ok, false, "0.25 ×10³/µL non è un numero di piastrine");
  if (perMicroliter.ok) return;
  assert.equal(perMicroliter.error.code, "value_out_of_plausible_range");
});

test("MIGLIAIA: la riscrittura suggerita non è a sua volta ambigua", () => {
  const res = validateManualLabEntry({ markerKey: "tsh", value: "1.234", unit: "uIU/mL" }, catalog);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.error.code, "ambiguous_number_format");
  assert.ok(res.error.message.includes("1,234"), `deve suggerire la virgola: ${res.error.message}`);
  const rewritten = validateManualLabEntry({ markerKey: "tsh", value: "1,234", unit: "uIU/mL" }, catalog);
  assert.equal(rewritten.ok, true, "la riscrittura suggerita deve essere accettata");
  if (!rewritten.ok) return;
  assert.equal(rewritten.entry.canonicalValue, 1.234);
});

test("MIGLIAIA: «4.500.000 /mm^3» dei globuli rossi entra come 4.5 ×10⁶/µL", () => {
  const res = validateManualLabEntry({ markerKey: "rbc", value: "4.500.000", unit: "/mm^3" }, catalog);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.entry.canonicalValue, 4.5);
  assert.equal(res.entry.canonicalUnit, "10^6/uL");
});

test("MIGLIAIA: forme miste e decimali normali restano quelle che sono", () => {
  const cases: Array<[string, number]> = [
    ["15.6", 15.6],
    ["15,6", 15.6],
    ["0.45", 0.45],
    ["0,450", 0.45],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["7 200", 7200],
  ];
  for (const [text, expected] of cases) {
    const res = validateManualLabEntry({ markerKey: "ferritina", value: text, unit: "ng/mL" }, catalog);
    assert.equal(res.ok, true, `«${text}» doveva essere accettato`);
    if (!res.ok) continue;
    assert.equal(res.entry.canonicalValue, expected, `«${text}» → atteso ${expected}`);
  }
});

test("MIGLIAIA: scritture rotte restano rifiutate come non-numero", () => {
  for (const bad of ["1.23.456", "12,3,4", "1..2", "."]) {
    const res = validateManualLabEntry({ markerKey: "wbc", value: bad, unit: "/uL" }, catalog);
    assert.equal(res.ok, false, `«${bad}» doveva essere rifiutato`);
    if (res.ok) continue;
    assert.equal(res.error.code, "invalid_value");
  }
});

/* ------------------------------------------------------------------ */
/* Audit: la stringa digitata                                           */
/* ------------------------------------------------------------------ */

test("AUDIT: la nota conserva la stringa DIGITATA, non solo il numero già parsato", () => {
  const res = validateManualLabEntry({ markerKey: "emoglobina", value: "15,6", unit: "g/dL" }, catalog);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.entry.enteredText, "15,6");
  const [patch] = buildManualStagingPatches([res.entry], "blood");
  assert.equal(patch.entered_text, "15,6");
  assert.ok(String(patch.notes).includes("15,6"), `la nota deve mostrare la scrittura originale: ${patch.notes}`);
});

/* ------------------------------------------------------------------ */
/* Superficie pubblica: catena dei prototipi                            */
/* ------------------------------------------------------------------ */

test("chiavi della catena dei prototipi non fanno esplodere né inventano conversioni", () => {
  for (const markerKey of ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"]) {
    const res = convertLabValueToCanonicalUnit({ markerKey, value: 1, fromUnit: "g/L", toUnit: "g/dL" });
    assert.equal(res.ok, true, `«${markerKey}» deve usare solo l'algebra generica`);
    if (!res.ok) continue;
    assert.equal(res.value, 0.1);
  }
});

test("unità che colpiscono la catena dei prototipi non producono NaN", () => {
  for (const unit of ["constructor", "toString", "valueOf/L", "L/constructor"]) {
    const res = convertLabValueToCanonicalUnit({ markerKey: "emoglobina", value: 1, fromUnit: unit, toUnit: "g/dL" });
    assert.equal(res.ok, false, `«${unit}» non è un'unità: doveva fallire, non dare NaN`);
  }
});

test("un valore non finito non esce mai come numero canonico", () => {
  const res = validateManualLabEntry({ markerKey: "emoglobina", value: Number.NaN, unit: "g/dL" }, catalog);
  assert.equal(res.ok, false);
});

/* ------------------------------------------------------------------ */
/* Data del prelievo e fuso orario                                      */
/* ------------------------------------------------------------------ */

/**
 * In Italia alle 00:30 del 9 settembre a Greenwich sono ancora le 22:30 dell'8: il prelievo
 * «di oggi» veniva rifiutato come futuro. Il server non conosce il fuso di chi scrive, quindi
 * la soglia è UTC + 1 giorno — il massimo scarto possibile fra un fuso qualsiasi e UTC.
 */
test("DATA: il giorno dopo quello UTC è accettato (fusi a est di Greenwich)", () => {
  const res = validateManualSampleDate("2026-09-09", "2026-09-08");
  assert.equal(res.ok, true, "dopo mezzanotte in Italia il prelievo di oggi non è nel futuro");
});

test("DATA: due giorni avanti restano futuro, in qualunque fuso", () => {
  const res = validateManualSampleDate("2026-09-10", "2026-09-08");
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.error.code, "future_sample_date");
});
