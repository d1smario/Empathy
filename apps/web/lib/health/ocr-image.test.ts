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
