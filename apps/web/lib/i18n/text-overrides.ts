import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "@/lib/integrations/integration-status";
import { noStoreFetch } from "@/lib/supabase/no-store-fetch";
import type { SupportedLocale } from "@/lib/i18n/supported-locales";

/**
 * Override dei testi UI pubblicati da Admin → Testi, fusi sopra `messages/<locale>.json`
 * a ogni richiesta (vedi `i18n/request.ts`). Così il copy del sito si cambia dal pannello
 * senza toccare il repo né rideployare.
 *
 * Client ANON dedicato (non il cookie client): il dato è pubblico e la policy
 * `ui_text_overrides_read_published` lo espone a anon; senza cookie evitiamo lavoro inutile.
 * `noStoreFetch` è OBBLIGATORIO: senza, Next può servire la lettura dalla Data Cache e una
 * pubblicazione resterebbe invisibile (vedi lib/supabase/no-store-fetch.ts).
 */

/** Finestra di propagazione dopo «Pubblica». Tenuta bassa: il pannello promette «entro un minuto». */
const OVERRIDES_TTL_MS = 60 * 1000;

type CacheEntry = { value: PublishedOverride[]; expiresAt: number };
const cache = new Map<string, CacheEntry>();

export type PublishedOverride = { key: string; value: string };

/** Svuota la cache in-memory di QUESTA istanza (chiamata dopo una pubblicazione). */
export function invalidatePublishedTextOverrides(): void {
  cache.clear();
}

export async function loadPublishedTextOverrides(locale: SupportedLocale): Promise<PublishedOverride[]> {
  const hit = cache.get(locale);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const config = getSupabasePublicConfig();
  if (!config) return [];

  try {
    const supabase = createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: noStoreFetch },
    });
    const { data, error } = await supabase
      .from("ui_text_overrides")
      .select("text_key, published_value")
      .eq("locale", locale)
      .not("published_value", "is", null);

    // Errore transitorio (o tabella non ancora creata): NON si cachea, così al
    // tentativo successivo si riprova invece di servire il vuoto per un minuto.
    if (error || !data) return [];

    const rows = (data as { text_key: string; published_value: string | null }[])
      .filter((r) => typeof r.published_value === "string" && r.published_value.length > 0)
      .map((r) => ({ key: r.text_key, value: r.published_value as string }));

    cache.set(locale, { value: rows, expiresAt: Date.now() + OVERRIDES_TTL_MS });
    return rows;
  } catch {
    return [];
  }
}

/** Il percorso esiste già nell'albero base? Gli override non possono INVENTARE chiavi. */
function pathExists(root: unknown, segments: string[]): boolean {
  let node: unknown = root;
  for (const seg of segments) {
    if (Array.isArray(node)) {
      const idx = Number(seg);
      if (!Number.isInteger(idx) || idx < 0 || idx >= node.length) return false;
      node = node[idx];
      continue;
    }
    if (!node || typeof node !== "object") return false;
    if (!Object.prototype.hasOwnProperty.call(node, seg)) return false;
    node = (node as Record<string, unknown>)[seg];
  }
  return typeof node === "string";
}

/**
 * Scrive `value` al percorso clonando SOLO i nodi lungo il cammino (copy-on-write).
 * L'albero di partenza arriva da `import()` di un JSON: è un modulo condiviso fra
 * richieste, mutarlo farebbe colare l'override di un utente su tutti gli altri.
 */
function setPathCopyOnWrite(root: unknown, segments: string[], value: string): unknown {
  const [head, ...rest] = segments;
  if (head === undefined) return value;

  if (Array.isArray(root)) {
    const idx = Number(head);
    if (!Number.isInteger(idx) || idx < 0 || idx >= root.length) return root;
    const copy = root.slice();
    copy[idx] = rest.length ? setPathCopyOnWrite(root[idx], rest, value) : value;
    return copy;
  }

  const base = (root && typeof root === "object" ? root : {}) as Record<string, unknown>;
  const copy: Record<string, unknown> = { ...base };
  copy[head] = rest.length ? setPathCopyOnWrite(base[head], rest, value) : value;
  return copy;
}

/** Applica gli override pubblicati sopra l'albero dei messaggi, senza mutarlo. */
export function applyTextOverrides<T>(messages: T, overrides: readonly PublishedOverride[]): T {
  if (!overrides.length) return messages;
  let out: unknown = messages;
  for (const { key, value } of overrides) {
    const segments = key.split(".");
    // Chiave rimossa dai JSON dopo il salvataggio dell'override → si ignora in silenzio.
    if (!pathExists(out, segments)) continue;
    out = setPathCopyOnWrite(out, segments, value);
  }
  return out as T;
}
