import { NextResponse } from "next/server";

import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { loadRawMessages } from "@/lib/i18n/messages-source";
import { FALLBACK_LOCALE } from "@/lib/i18n/supported-locales";
import {
  getMessageAtPath,
  scopeForKey,
  validateOverrideValue,
  type TextScope,
} from "@/lib/i18n/text-catalog";
import { invalidatePublishedTextOverrides } from "@/lib/i18n/text-overrides";
import { loadAdminTextItems } from "@/lib/i18n/admin-text-items";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 200;

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

  // La fusione JSON del repo + override vive in un posto solo (`admin-text-items`): la usa anche
  // l'esportazione, e due copie prima o poi divergerebbero.
  const loaded = await loadAdminTextItems(admin, [scope]);
  if (!loaded.ok) {
    return NextResponse.json({ ok: false as const, error: loaded.error }, { status: 500, headers: NO_STORE });
  }
  const { locales } = loaded;
  let items = loaded.items;
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
