"use client";

/**
 * Cache stale-while-revalidate lato client.
 *
 * Due layer:
 *  - in-memory (veloce, per-sessione SPA): NON rimostra lo skeleton tornando su
 *    una pagina già vista durante la stessa sessione di navigazione;
 *  - sessionStorage (stessa scheda): fa sopravvivere la cache anche al RELOAD del
 *    browser, così al ricaricamento si dipingono subito gli ultimi dati e si
 *    rivalida in background invece di aspettare la rete.
 *
 * `ts` per voce permette di saltare il refetch quando la cache è ancora fresca
 * (vedi `readSwrCacheAgeMs`). Chiavi tipicamente per-atleta, es. `dash-scores:${athleteId}`.
 */
type SwrEntry<T> = { value: T; ts: number };

const SS_PREFIX = "swr:";
const store = new Map<string, SwrEntry<unknown>>();

function readEntry<T>(key: string): SwrEntry<T> | undefined {
  const mem = store.get(key) as SwrEntry<T> | undefined;
  if (mem) return mem;
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(SS_PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as SwrEntry<T>;
    if (parsed && typeof parsed === "object" && "value" in parsed) {
      store.set(key, parsed as SwrEntry<unknown>);
      return parsed;
    }
  } catch {
    // sessionStorage non disponibile / JSON corrotto: ignora.
  }
  return undefined;
}

export function readSwrCache<T>(key: string): T | undefined {
  return readEntry<T>(key)?.value;
}

/** Età (ms) della voce in cache, `undefined` se assente. Per saltare un refetch ancora fresco. */
export function readSwrCacheAgeMs(key: string): number | undefined {
  const entry = readEntry(key);
  return entry ? Math.max(0, Date.now() - entry.ts) : undefined;
}

export function writeSwrCache<T>(key: string, value: T): void {
  const entry: SwrEntry<T> = { value, ts: Date.now() };
  store.set(key, entry as SwrEntry<unknown>);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SS_PREFIX + key, JSON.stringify(entry));
  } catch {
    // quota/serializzazione: la cache in-memory basta comunque.
  }
}

/** Invalida le chiavi che soddisfano il predicato (es. dopo una scrittura nota). */
export function invalidateSwrCache(predicate: (key: string) => boolean): void {
  for (const key of Array.from(store.keys())) {
    if (predicate(key)) {
      store.delete(key);
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.removeItem(SS_PREFIX + key);
        } catch {
          // ignora
        }
      }
    }
  }
}
