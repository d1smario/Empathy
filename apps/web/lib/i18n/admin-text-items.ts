/**
 * Il catalogo dei testi come lo vede l'admin: per ogni chiave e ogni lingua abilitata, il testo
 * originale del repo, la bozza e il valore pubblicato.
 *
 * Estratto dalla rotta `GET /api/admin/testi` perché ora lo usa anche l'esportazione: la fusione
 * fra JSON del repo e override del database è una sola, e due copie prima o poi divergerebbero.
 * Server-only di fatto (legge i file di lingua e usa il client di servizio).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { loadEnabledLocales } from "@/lib/i18n/resolve-request-locale";
import { loadRawMessages } from "@/lib/i18n/messages-source";
import { FALLBACK_LOCALE } from "@/lib/i18n/supported-locales";
import { flattenMessages, getMessageAtPath, scopeForKey, type TextScope } from "@/lib/i18n/text-catalog";

export type AdminTextLocaleValue = {
  /** Testo del file di lingua; se la lingua non ce l'ha, quello della lingua di ripiego. */
  base: string;
  /** True quando la lingua non ha un suo testo per questa chiave (il sito mostra il ripiego). */
  isFallback: boolean;
  draft: string | null;
  published: string | null;
};

export type AdminTextItem = {
  key: string;
  namespace: string;
  scope: TextScope;
  values: Record<string, AdminTextLocaleValue>;
  hasPending: boolean;
  hasOverride: boolean;
};

type OverrideRow = {
  locale: string;
  text_key: string;
  draft_value: string | null;
  published_value: string | null;
};

export type AdminTextItemsResult =
  | { ok: true; locales: string[]; items: AdminTextItem[] }
  | { ok: false; error: string };

export async function loadAdminTextItems(
  admin: SupabaseClient,
  scopes: readonly TextScope[],
): Promise<AdminTextItemsResult> {
  const locales = [...(await loadEnabledLocales())];
  const rawByLocale = new Map<string, Record<string, unknown>>();
  for (const loc of locales) rawByLocale.set(loc, await loadRawMessages(loc));
  const fallbackTree = rawByLocale.get(FALLBACK_LOCALE) ?? (await loadRawMessages(FALLBACK_LOCALE));

  // Le CHIAVI canoniche vengono dal file completo (fallback EN): i file parziali
  // (tr/de/fr) ne contengono solo un sottoinsieme.
  const wanted = new Set<TextScope>(scopes);
  const allKeys = flattenMessages(fallbackTree)
    .map((f) => f.key)
    .filter((key) => wanted.has(scopeForKey(key)));

  const { data, error } = await admin
    .from("ui_text_overrides")
    .select("locale, text_key, draft_value, published_value")
    .in("scope", [...wanted]);
  if (error) return { ok: false, error: error.message };

  const byKey = new Map<string, Map<string, OverrideRow>>();
  for (const r of (data ?? []) as OverrideRow[]) {
    if (!byKey.has(r.text_key)) byKey.set(r.text_key, new Map());
    byKey.get(r.text_key)!.set(r.locale, r);
  }

  const items = allKeys.map((key): AdminTextItem => {
    const perLocale = byKey.get(key);
    const values: Record<string, AdminTextLocaleValue> = {};
    let hasPending = false;
    let hasOverride = false;
    for (const loc of locales) {
      const own = getMessageAtPath(rawByLocale.get(loc) ?? {}, key);
      const base = own ?? getMessageAtPath(fallbackTree, key) ?? "";
      const row = perLocale?.get(loc) ?? null;
      const draft = row?.draft_value ?? null;
      const published = row?.published_value ?? null;
      if (draft !== null && draft !== published) hasPending = true;
      if (published !== null) hasOverride = true;
      values[loc] = { base, isFallback: own === undefined, draft, published };
    }
    return { key, namespace: key.split(".")[0] ?? "", scope: scopeForKey(key), values, hasPending, hasOverride };
  });

  return { ok: true, locales, items };
}
