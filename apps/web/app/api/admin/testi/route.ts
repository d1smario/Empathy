import { NextResponse } from "next/server";

import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { loadEnabledLocales } from "@/lib/i18n/resolve-request-locale";
import { loadRawMessages } from "@/lib/i18n/messages-source";
import { FALLBACK_LOCALE } from "@/lib/i18n/supported-locales";
import {
  flattenMessages,
  getMessageAtPath,
  scopeForKey,
  validateOverrideValue,
  type TextScope,
} from "@/lib/i18n/text-catalog";
import { invalidatePublishedTextOverrides } from "@/lib/i18n/text-overrides";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 200;

type OverrideRow = {
  locale: string;
  text_key: string;
  draft_value: string | null;
  published_value: string | null;
};

function isScope(v: string | null): v is TextScope {
  return v === "vetrina" || v === "app";
}

/**
 * GET → catalogo paginato dei testi per uno scope, con per ogni lingua:
 * valore originale del JSON, bozza e valore pubblicato.
 */
export async function GET(request: Request) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403, headers: NO_STORE });
  }

  const url = new URL(request.url);
  const scopeParam = url.searchParams.get("scope");
  const scope: TextScope = isScope(scopeParam) ? scopeParam : "vetrina";
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const onlyPending = url.searchParams.get("pending") === "1";
  const onlyOverridden = url.searchParams.get("overridden") === "1";
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT) || DEFAULT_LIMIT));

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY sul server." },
      { status: 503, headers: NO_STORE },
    );
  }

  const locales = [...(await loadEnabledLocales())];
  const rawByLocale = new Map<string, Record<string, unknown>>();
  for (const loc of locales) rawByLocale.set(loc, await loadRawMessages(loc));
  const fallbackTree = rawByLocale.get(FALLBACK_LOCALE) ?? (await loadRawMessages(FALLBACK_LOCALE));

  // Le CHIAVI canoniche vengono dal file completo (fallback EN): i file parziali
  // (tr/de/fr) ne contengono solo un sottoinsieme.
  const allKeys = flattenMessages(fallbackTree)
    .map((f) => f.key)
    .filter((key) => scopeForKey(key) === scope);

  const { data, error } = await admin
    .from("ui_text_overrides")
    .select("locale, text_key, draft_value, published_value")
    .eq("scope", scope);
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }
  const rows = (data ?? []) as OverrideRow[];
  const byKey = new Map<string, Map<string, OverrideRow>>();
  for (const r of rows) {
    if (!byKey.has(r.text_key)) byKey.set(r.text_key, new Map());
    byKey.get(r.text_key)!.set(r.locale, r);
  }

  const buildItem = (key: string) => {
    const perLocale = byKey.get(key);
    const values: Record<string, {
      base: string;
      isFallback: boolean;
      draft: string | null;
      published: string | null;
    }> = {};
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
    return { key, namespace: key.split(".")[0] ?? "", values, hasPending, hasOverride };
  };

  let items = allKeys.map(buildItem);
  if (onlyPending) items = items.filter((i) => i.hasPending);
  if (onlyOverridden) items = items.filter((i) => i.hasOverride);
  if (q) {
    items = items.filter((i) => {
      if (i.key.toLowerCase().includes(q)) return true;
      return Object.values(i.values).some((v) =>
        (v.published ?? v.draft ?? v.base).toLowerCase().includes(q),
      );
    });
  }

  const total = items.length;
  const page = items.slice(offset, offset + limit);

  // Conteggio bozze in attesa su TUTTI gli scope: alimenta il badge del pulsante «Pubblica».
  const { data: pendingRows } = await admin
    .from("ui_text_overrides")
    .select("scope, draft_value, published_value");
  const pendingByScope = { vetrina: 0, app: 0 };
  for (const r of (pendingRows ?? []) as { scope: TextScope; draft_value: string | null; published_value: string | null }[]) {
    if (r.draft_value !== null && r.draft_value !== r.published_value) pendingByScope[r.scope] += 1;
  }

  return NextResponse.json(
    { ok: true as const, scope, locales, total, offset, limit, items: page, pendingByScope },
    { headers: NO_STORE },
  );
}

/**
 * PATCH → salva una BOZZA (non tocca il sito) oppure azzera l'override della chiave.
 * Body: { locale, key, value } | { locale, key, reset: true }
 */
export async function PATCH(request: Request) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403, headers: NO_STORE });
  }

  let body: { locale?: string; key?: string; value?: string; reset?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false as const, error: "Body JSON non valido." }, { status: 400, headers: NO_STORE });
  }

  const locale = (body.locale ?? "").trim();
  const key = (body.key ?? "").trim();
  if (!locale || !key) {
    return NextResponse.json({ ok: false as const, error: "locale e key sono obbligatori." }, { status: 400, headers: NO_STORE });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY sul server." },
      { status: 503, headers: NO_STORE },
    );
  }

  // Azzeramento: via la riga → il sito torna al testo del repo.
  if (body.reset) {
    const { error } = await admin.from("ui_text_overrides").delete().eq("locale", locale).eq("text_key", key);
    if (error) {
      return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
    }
    invalidatePublishedTextOverrides();
    return NextResponse.json({ ok: true as const, reset: true }, { headers: NO_STORE });
  }

  const value = typeof body.value === "string" ? body.value : "";

  // La chiave deve esistere davvero nell'albero dei messaggi, e il nuovo testo deve
  // conservare segnaposto e tag dell'originale (sono contratti col codice).
  const raw = await loadRawMessages(locale);
  const fallbackTree = await loadRawMessages(FALLBACK_LOCALE);
  const baseValue = getMessageAtPath(raw, key) ?? getMessageAtPath(fallbackTree, key);
  if (baseValue === undefined) {
    return NextResponse.json({ ok: false as const, error: "Chiave inesistente nei testi." }, { status: 404, headers: NO_STORE });
  }
  const check = validateOverrideValue(baseValue, value);
  if (!check.ok) {
    return NextResponse.json({ ok: false as const, error: check.error }, { status: 422, headers: NO_STORE });
  }

  const { error } = await admin.from("ui_text_overrides").upsert(
    {
      scope: scopeForKey(key),
      locale,
      text_key: key,
      draft_value: value,
      updated_by: session.userId,
    },
    { onConflict: "locale,text_key" },
  );
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true as const, draft: true }, { headers: NO_STORE });
}
