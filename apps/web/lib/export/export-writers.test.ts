import test from "node:test";
import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import { toCsv } from "@/lib/export/csv-writer";
import { buildXlsx, columnLetter, escapeXml, sanitizeSheetName } from "@/lib/export/xlsx-writer";
import { buildTextExportTable, onlineTextValue, pendingDraftsText } from "@/lib/i18n/admin-text-export";
import type { AdminTextItem } from "@/lib/i18n/admin-text-items";

// ── CSV ──────────────────────────────────────────────────────────────────────────────────────

test("CSV: BOM in testa, righe CRLF", () => {
  const csv = toCsv([["a", "b"], ["c", "d"]]);
  assert.equal(csv.charCodeAt(0), 0xfeff, "senza BOM Excel rovina le lettere accentate");
  assert.equal(csv.slice(1), "a,b\r\nc,d\r\n");
});

test("CSV: virgole, virgolette e a capo vanno fra virgolette, le virgolette si raddoppiano", () => {
  const csv = toCsv([["uno, due", 'dice "ciao"', "riga1\nriga2", "pulito"]], { bom: false });
  assert.equal(csv, '"uno, due","dice ""ciao""","riga1\nriga2",pulito\r\n');
});

test("CSV: null e undefined diventano celle vuote, non «null»", () => {
  assert.equal(toCsv([[null, undefined, 0]], { bom: false }), ",,0\r\n");
});

// ── XLSX ─────────────────────────────────────────────────────────────────────────────────────

test("lettere di colonna: A, Z, AA, AZ, BA", () => {
  assert.deepEqual([0, 25, 26, 51, 52].map(columnLetter), ["A", "Z", "AA", "AZ", "BA"]);
});

test("nomi di foglio: caratteri vietati tolti, 31 caratteri al massimo, niente doppioni", () => {
  const taken = new Set<string>();
  assert.equal(sanitizeSheetName("Vetrina", taken), "Vetrina");
  assert.equal(sanitizeSheetName("vetrina", taken), "vetrina (2)");
  assert.equal(sanitizeSheetName("a/b:c", new Set()), "a b c");
  assert.equal(sanitizeSheetName("x".repeat(40), new Set()).length, 31);
  assert.equal(sanitizeSheetName("   ", new Set()), "Foglio");
});

test("escapeXml: entità e caratteri di controllo che corromperebbero il file", () => {
  assert.equal(escapeXml(`<a href="x">Tom & 'Jerry'</a>`), "&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;");
  assert.equal(escapeXml(`a${String.fromCharCode(1)}b${String.fromCharCode(0x0b)}c`), "abc");
  assert.equal(escapeXml("a\tb\nc"), "a\tb\nc", "tab e a capo sono ammessi");
});

test("xlsx: lo zip contiene le parti che Excel si aspetta, un foglio per tabella", () => {
  const files = unzipSync(buildXlsx([{ name: "Vetrina", rows: [["h"], ["v"]] }, { name: "App", rows: [["h"]] }]));
  for (const part of [
    "[Content_Types].xml",
    "_rels/.rels",
    "xl/workbook.xml",
    "xl/_rels/workbook.xml.rels",
    "xl/styles.xml",
    "xl/worksheets/sheet1.xml",
    "xl/worksheets/sheet2.xml",
  ]) {
    assert.ok(files[part], `manca ${part}`);
  }
  const wb = strFromU8(files["xl/workbook.xml"]!);
  assert.match(wb, /name="Vetrina"/);
  assert.match(wb, /name="App"/);
});

test("xlsx: celle di testo in linea, intestazione in grassetto e bloccata", () => {
  const files = unzipSync(buildXlsx([{ name: "T", rows: [["Chiave", "IT"], ["home.title", "Più «forte» & oltre"]] }]));
  const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]!);
  assert.match(sheet, /<pane ySplit="1"[^>]*state="frozen"/);
  assert.match(sheet, /<c r="A1" t="inlineStr" s="1">/, "intestazione con lo stile grassetto");
  assert.match(sheet, /<c r="B2" t="inlineStr" s="2"><is><t xml:space="preserve">Più «forte» &amp; oltre<\/t>/);
});

test("xlsx: un testo che comincia con «=» resta testo, non diventa formula", () => {
  const sheet = strFromU8(unzipSync(buildXlsx([{ name: "T", rows: [["h"], ["=SOMMA(A1:A2)"]] }]))["xl/worksheets/sheet1.xml"]!);
  assert.match(sheet, /t="inlineStr"[^>]*><is><t xml:space="preserve">=SOMMA\(A1:A2\)<\/t>/);
  assert.doesNotMatch(sheet, /<f>/);
});

test("xlsx: senza fogli è un errore, non un file vuoto", () => {
  assert.throws(() => buildXlsx([]));
});

// ── tabella dei testi ────────────────────────────────────────────────────────────────────────

const v = (base: string, isFallback: boolean, draft: string | null = null, published: string | null = null) => ({
  base,
  isFallback,
  draft,
  published,
});

const item: AdminTextItem = {
  key: "home.title",
  namespace: "home",
  scope: "vetrina",
  values: {
    it: v("Allenati meglio", false, "Allenati meglio, mangia giusto", "Allenati meglio"),
    en: v("Train better", false, null, "Train smarter"),
    de: v("Train better", true),
  },
  hasPending: true,
  hasOverride: true,
};

test("valore online: il pubblicato vince sull'originale", () => {
  assert.equal(onlineTextValue(item.values.en), "Train smarter");
});

test("valore online: senza pubblicato resta l'originale della lingua", () => {
  assert.equal(onlineTextValue(v("Ciao", false)), "Ciao");
});

test("valore online: una lingua senza un suo testo resta VUOTA, non ricopia l'inglese", () => {
  assert.equal(onlineTextValue(item.values.de), "");
});

test("le bozze non pubblicate stanno in una colonna a parte, una per riga", () => {
  assert.equal(pendingDraftsText(item, ["it", "en", "de"]), "IT: Allenati meglio, mangia giusto");
});

test("tabella: intestazione e riga, con e senza la colonna Ambito", () => {
  const t = buildTextExportTable([item], ["it", "en", "de"], { includeScope: true });
  assert.deepEqual(t.header, ["Ambito", "Sezione", "Chiave", "IT", "EN", "DE", "Bozze non pubblicate"]);
  assert.deepEqual(t.rows[0], [
    "Vetrina",
    "home",
    "home.title",
    "Allenati meglio",
    "Train smarter",
    "",
    "IT: Allenati meglio, mangia giusto",
  ]);
  const senza = buildTextExportTable([item], ["it"]);
  assert.equal(senza.header[0], "Sezione");
  assert.equal(senza.columnWidths.length, senza.header.length);
});
