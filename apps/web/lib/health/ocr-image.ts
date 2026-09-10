import "server-only";

import { OCR_MAX_BYTES, OCR_MIN_CONFIDENCE } from "@/lib/health/ocr-image-rules";

export { isOcrSupportedMime, OCR_MAX_BYTES, OCR_MIN_CONFIDENCE } from "@/lib/health/ocr-image-rules";

/**
 * OCR di foto e scansioni — senza IA.
 *
 * Il parser dei referti legge PDF che contengono testo. Ma quello che la gente carica
 * davvero è una fotografia scattata col telefono: i quattro caricamenti veri arrivati in
 * produzione erano tutti `image.jpg`. Senza uno strato che trasformi l'immagine in testo,
 * il matcher non ha niente da leggere e il referto finisce sempre a mano.
 *
 * Qui gira Tesseract, riconoscimento ottico classico: nessun modello linguistico, nessuna
 * chiamata a servizi di intelligenza artificiale. Il testo che produce entra nello stesso
 * matcher del PDF, e il risultato resta una PROPOSTA da confermare — l'OCR sbaglia, e un
 * valore del sangue sbagliato è peggio di un valore assente.
 */

export type OcrResult = { text: string; confidence: number } | null;

/**
 * Estrae testo da un'immagine. Ritorna `null` su qualunque intoppo: l'OCR è un tentativo in
 * più, non un passaggio obbligato — se fallisce si torna esattamente al comportamento di
 * prima, cioè l'inserimento a mano.
 */
export async function extractTextFromImageBuffer(buffer: Buffer): Promise<OcrResult> {
  if (!buffer?.length || buffer.length > OCR_MAX_BYTES) return null;
  type OcrWorker = {
    recognize: (b: Buffer) => Promise<{ data: { text?: string; confidence?: number } }>;
    terminate: () => Promise<unknown>;
  };
  let worker: OcrWorker | null = null;
  try {
    const { createWorker } = await import("tesseract.js");
    // Italiano e inglese insieme: i referti italiani hanno spesso intestazioni in inglese.
    worker = (await createWorker(["ita", "eng"])) as unknown as OcrWorker;
    if (!worker) return null;
    const { data } = await worker.recognize(buffer);
    const text = String(data?.text ?? "").trim();
    const confidence = Number(data?.confidence ?? 0);
    if (!text) return null;
    if (Number.isFinite(confidence) && confidence > 0 && confidence < OCR_MIN_CONFIDENCE) return null;
    return { text, confidence: Number.isFinite(confidence) ? confidence : 0 };
  } catch {
    return null;
  } finally {
    try {
      await worker?.terminate();
    } catch {
      /* la chiusura del worker non deve mai far fallire un caricamento */
    }
  }
}
