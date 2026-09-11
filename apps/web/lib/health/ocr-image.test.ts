import test from "node:test";
import assert from "node:assert/strict";
import { isOcrSupportedMime, OCR_MAX_BYTES, OCR_MIN_CONFIDENCE } from "@/lib/health/ocr-image-rules";

test("riconosce i formati che la gente fotografa davvero", () => {
  assert.equal(isOcrSupportedMime("image/jpeg", "image.jpg"), true);
  assert.equal(isOcrSupportedMime("image/png", "referto.png"), true);
  assert.equal(isOcrSupportedMime("image/heic", "IMG_0042.jpeg"), true, "il nome salva un mime esotico");
});

test("un PDF non passa dall'OCR: ha già la sua strada", () => {
  assert.equal(isOcrSupportedMime("application/pdf", "referto.pdf"), false);
});

test("niente mime e niente estensione utile: non si tenta", () => {
  assert.equal(isOcrSupportedMime("", ""), false);
  assert.equal(isOcrSupportedMime("application/octet-stream", "referto.zip"), false);
});

test("le soglie sono quelle dichiarate", () => {
  assert.equal(OCR_MAX_BYTES, 12 * 1024 * 1024);
  assert.equal(OCR_MIN_CONFIDENCE, 40);
});

// ── messa in produzione ─────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import {
  chooseOcrLangOptions,
  OCR_TIMEOUT_MS,
  UPLOAD_ROUTE_MAX_DURATION_S,
  withTimeout,
} from "@/lib/health/ocr-image-rules";

const WEB = path.resolve(__dirname, "..", "..");

test("con i modelli nel repo: niente rete e niente cache su disco", () => {
  assert.deepEqual(chooseOcrLangOptions("/x/tessdata", "/tmp/c"), {
    langPath: "/x/tessdata",
    gzip: true,
    cacheMethod: "none",
  });
});

test("senza modelli locali: rete, ma cache in una cartella scrivibile e non in quella corrente", () => {
  assert.deepEqual(chooseOcrLangOptions(null, "/tmp/c"), { cachePath: "/tmp/c", cacheMethod: "write" });
});

test("il limite dell'OCR sta ben sotto la durata della rotta: scade prima l'OCR, mai il caricamento", () => {
  assert.ok(OCR_TIMEOUT_MS <= UPLOAD_ROUTE_MAX_DURATION_S * 1000 - 15_000, `${OCR_TIMEOUT_MS} ms`);
});

test("la rotta dichiara davvero la durata che le regole danno per scontata", () => {
  const route = fs.readFileSync(path.join(WEB, "app/api/health/upload-document/route.ts"), "utf8");
  const m = /export const maxDuration = (\d+);/.exec(route);
  assert.ok(m, "maxDuration mancante nella rotta di caricamento");
  assert.equal(Number(m![1]), UPLOAD_ROUTE_MAX_DURATION_S);
});

test("i modelli compressi ci sono e sono davvero gzip", () => {
  for (const lang of ["ita", "eng"]) {
    const file = path.join(WEB, "lib/health/tessdata", `${lang}.traineddata.gz`);
    const head = fs.readFileSync(file).subarray(0, 2);
    assert.deepEqual([...head], [0x1f, 0x8b], `${lang}: non è un file gzip`);
  }
});

test("la funzione della rotta include i modelli: senza, il tracciamento li lascerebbe fuori", () => {
  const cfg = fs.readFileSync(path.join(WEB, "next.config.mjs"), "utf8");
  assert.match(cfg, /"\/api\/health\/upload-document":\s*\["\.\/lib\/health\/tessdata\/\*\*\/\*"\]/);
});

test("withTimeout: consegna il risultato se arriva in tempo", async () => {
  assert.equal(await withTimeout(Promise.resolve(7), 1000), 7);
});

test("withTimeout: allo scadere risolve null e chiama la pulizia", async () => {
  let pulito = false;
  const lento = new Promise<number>((r) => setTimeout(() => r(1), 200));
  assert.equal(await withTimeout(lento, 10, () => (pulito = true)), null);
  assert.equal(pulito, true);
});

test("withTimeout: un errore diventa null, non fa cadere il chiamante", async () => {
  assert.equal(await withTimeout(Promise.reject(new Error("tesseract giù")), 1000), null);
});
