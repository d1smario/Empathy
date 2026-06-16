"use client";

/**
 * Cache in-memory per stale-while-revalidate lato client.
 *
 * Persiste tra le navigazioni della stessa sessione SPA (non tra reload del
 * browser). Serve a NON rimostrare lo skeleton di caricamento ogni volta che si
 * torna su una pagina già vista: al ritorno si dipingono subito gli ultimi dati
 * in cache e si rivalida in background, aggiornando in silenzio.
 *
 * Chiavi tipicamente per-atleta, es. `dash-core:${athleteId}`.
 */
const store = new Map<string, unknown>();

export function readSwrCache<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function writeSwrCache<T>(key: string, value: T): void {
  store.set(key, value);
}

/** Invalida le chiavi che soddisfano il predicato (es. dopo una scrittura nota). */
export function invalidateSwrCache(predicate: (key: string) => boolean): void {
  for (const key of Array.from(store.keys())) {
    if (predicate(key)) store.delete(key);
  }
}
