import "server-only";

/**
 * Legge i messaggi GREZZI di una lingua da `messages/<locale>.json`, senza il merge
 * su EN che fa `i18n/request.ts`. Serve al pannello Admin → Testi per distinguere
 * «tradotto davvero in questa lingua» da «ereditato dall'inglese».
 *
 * I JSON sono moduli statici: la cache è solo per non ripagare il parse a ogni richiesta.
 * NON mutare gli oggetti restituiti (sono condivisi fra richieste).
 */
const cache = new Map<string, Record<string, unknown>>();

export async function loadRawMessages(locale: string): Promise<Record<string, unknown>> {
  const hit = cache.get(locale);
  if (hit) return hit;
  try {
    const mod = (await import(`../../messages/${locale}.json`)).default as Record<string, unknown>;
    cache.set(locale, mod);
    return mod;
  } catch {
    return {};
  }
}
