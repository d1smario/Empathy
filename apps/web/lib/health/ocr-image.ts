import "server-only";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  chooseOcrLangOptions,
  OCR_MAX_BYTES,
  OCR_MIN_CONFIDENCE,
  OCR_TIMEOUT_MS,
  withTimeout,
} from "@/lib/health/ocr-image-rules";

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

/** Italiano e inglese insieme: i referti italiani hanno spesso intestazioni in inglese. */
const OCR_LANGS = ["ita", "eng"];

/**
 * La cartella dei modelli nel repo (`lib/health/tessdata`, vedi il README lì dentro). Due
 * candidati: la cartella corrente è la radice dell'app sia in sviluppo sia su Vercel, ma è la
 * radice del monorepo se qualcuno lancia da lì.
 */
function findLocalTessdata(): string | null {
  const candidates = [
    path.join(process.cwd(), "lib", "health", "tessdata"),
    path.join(process.cwd(), "apps", "web", "lib", "health", "tessdata"),
  ];
  for (const dir of candidates) {
    if (OCR_LANGS.every((lang) => fs.existsSync(path.join(dir, `${lang}.traineddata.gz`)))) return dir;
  }
  return null;
}

type OcrWorker = {
  recognize: (b: Buffer) => Promise<{ data: { text?: string; confidence?: number } }>;
  terminate: () => Promise<unknown>;
};

/**
 * Estrae testo da un'immagine. Ritorna `null` su qualunque intoppo — errore, fiducia troppo
 * bassa, tempo scaduto: l'OCR è un tentativo in più, non un passaggio obbligato, e se fallisce
 * si torna esattamente al comportamento di prima, cioè l'inserimento a mano.
 *
 * Il tempo è la parte delicata. Senza un limite, una foto lenta da leggere (o i modelli da
 * scaricare a un avvio a freddo) poteva superare la durata della funzione, e allora cadeva
 * tutto il caricamento. `OCR_TIMEOUT_MS` sta apposta sotto la durata della rotta.
 */
export async function extractTextFromImageBuffer(buffer: Buffer): Promise<OcrResult> {
  if (!buffer?.length || buffer.length > OCR_MAX_BYTES) return null;
  // Contenitore invece di una variabile: il worker nasce dentro una funzione asincrona e deve
  // restare raggiungibile dal `finally` anche se nel frattempo il tempo è scaduto.
  const holder: { worker: OcrWorker | null; timedOut: boolean } = { worker: null, timedOut: false };

  const work = (async () => {
    const { createWorker } = await import("tesseract.js");
    const options = chooseOcrLangOptions(findLocalTessdata(), path.join(os.tmpdir(), "tesseract-cache"));
    const created = (await createWorker(OCR_LANGS, undefined, options)) as unknown as OcrWorker;
    holder.worker = created;
    // Pronto dopo la scadenza: nessuno lo aspetta più, va chiuso subito.
    if (holder.timedOut) return null;
    const { data } = await created.recognize(buffer);
    return data;
  })();

  try {
    const data = await withTimeout(work, OCR_TIMEOUT_MS, () => {
      holder.timedOut = true;
    });
    if (!data) return null;
    const text = String(data.text ?? "").trim();
    const confidence = Number(data.confidence ?? 0);
    if (!text) return null;
    if (Number.isFinite(confidence) && confidence > 0 && confidence < OCR_MIN_CONFIDENCE) return null;
    return { text, confidence: Number.isFinite(confidence) ? confidence : 0 };
  } finally {
    // La chiusura del worker non deve mai far fallire un caricamento.
    if (holder.worker) {
      await holder.worker.terminate().catch(() => undefined);
    } else {
      // Scaduto mentre i modelli si caricavano: il worker, se e quando arriva, si chiude lì.
      void work.then(
        () => holder.worker?.terminate().catch(() => undefined),
        () => undefined,
      );
    }
  }
}
