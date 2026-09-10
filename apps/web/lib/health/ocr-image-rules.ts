/**
 * Regole di ammissione all'OCR — pure, senza `server-only`, quindi verificabili.
 *
 * Stanno fuori da `ocr-image.ts` perché quello carica Tesseract e vive solo sul server:
 * le soglie e il riconoscimento del formato sono decisioni, e una decisione va testata.
 */

/** Sotto questa fiducia il testo è rumore: meglio dire «non ho letto» che proporre numeri a caso. */
export const OCR_MIN_CONFIDENCE = 40;

/** Immagini oltre questa soglia non si processano: tempo e memoria non valgono il risultato. */
export const OCR_MAX_BYTES = 12 * 1024 * 1024;

/**
 * Il mime non basta: il telefono manda anche `image/heic` o mime vuoti, e il nome del file
 * spesso è l'unico indizio buono. Il PDF non passa di qui — ha già la sua strada.
 */
export function isOcrSupportedMime(mime: string, filename: string): boolean {
  const m = (mime || "").toLowerCase();
  if (m.includes("pdf")) return false;
  if (/\.pdf$/i.test(filename || "")) return false;
  if (/^image\/(jpeg|jpg|png|webp|bmp|tiff?)$/.test(m)) return true;
  return /\.(jpe?g|png|webp|bmp|tiff?)$/i.test(filename || "");
}
