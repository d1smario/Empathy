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

/**
 * Durata massima dichiarata dalla rotta di caricamento (`maxDuration`, secondi). Il valore vive
 * anche come letterale nella rotta — Next vuole la configurazione statica — e un test controlla
 * che i due numeri coincidano.
 */
export const UPLOAD_ROUTE_MAX_DURATION_S = 60;

/**
 * Oltre questo tempo l'OCR si arrende e il referto va all'inserimento a mano. Deve restare ben
 * sotto la durata della rotta: se scadesse la funzione, fallirebbe TUTTO il caricamento — file,
 * pannello, revisione — non soltanto la lettura della foto.
 */
export const OCR_TIMEOUT_MS = 40_000;

export type OcrLangOptions =
  | { langPath: string; gzip: true; cacheMethod: "none" }
  | { cachePath: string; cacheMethod: "write" };

/**
 * Da dove leggere i modelli di lingua. Dalla cartella del repo se c'è: nessuna rete, nessuna
 * scrittura. Altrimenti — la funzione è stata impacchettata senza i file — si torna a scaricarli,
 * ma con la cache in una cartella scrivibile invece che nella cartella corrente.
 */
export function chooseOcrLangOptions(localDir: string | null, writableTmpDir: string): OcrLangOptions {
  if (localDir) return { langPath: localDir, gzip: true, cacheMethod: "none" };
  return { cachePath: writableTmpDir, cacheMethod: "write" };
}

/**
 * Aspetta `work` al massimo `ms` millisecondi. Allo scadere risolve `null` e chiama `onTimeout`
 * (per liberare le risorse); un errore di `work` diventa anch'esso `null`. Non rifiuta mai:
 * l'OCR è un tentativo in più, non un passaggio che possa far cadere il caricamento.
 */
export function withTimeout<T>(work: Promise<T>, ms: number, onTimeout?: () => void): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        onTimeout?.();
      } catch {
        /* la pulizia non deve cambiare l'esito */
      }
      resolve(null);
    }, ms);
    work.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}
