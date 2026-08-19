/**
 * `fetch` per i client Supabase lato server che NON passa dalla Data Cache di Next.
 *
 * PERCHÉ: Next 14 intercetta il `fetch` globale e, dentro un Route Handler che esporta
 * solo GET (es. i cron), salva nella Data Cache OGNI GET «cacheabile» — anche con header
 * `Authorization` — con `revalidate = false` (per sempre), a meno che la richiesta non
 * tocchi `cookies()`/`headers()` di next/headers o la fetch non dica `cache: "no-store"`.
 * `export const dynamic = "force-dynamic"` NON basta: a runtime, per un route handler,
 * cambia solo il rendering della rotta, non la cache delle fetch (verificato su 14.2.3:
 * 3 chiamate alla stessa rotta → 1 sola richiesta all'upstream).
 *
 * EFFETTO REALE (19 ago): il worker della ripianificazione settimanale leggeva
 * `planned_workouts?athlete_id=…&date=eq.2026-08-25` → vuoto → la risposta vuota finiva
 * in cache; 26 minuti dopo, con la seduta ormai inserita, la stessa URL veniva servita
 * dalla cache (nessuna richiesta a Supabase nei log del gateway) → piano «a riposo» con
 * seduta reale. supabase-js (postgrest-js) chiama `fetch(url, {method, headers, body,
 * signal})` senza `cache`, quindi va forzato qui, alla radice, per tutti i client server.
 */
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Aggiunge `cache: "no-store"` a ogni chiamata (l'`init` esplicito dell'utente resta, il `cache` vince). */
export function withNoStoreCache(baseFetch: FetchLike): FetchLike {
  return (input, init) => baseFetch(input, { ...(init ?? {}), cache: "no-store" });
}

/** `fetch` globale corrente risolto a OGNI chiamata (Next lo patcha dopo l'import dei moduli). */
export const noStoreFetch: FetchLike = (input, init) =>
  withNoStoreCache((i, o) => fetch(i, o))(input, init);
