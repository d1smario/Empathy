import { NextResponse } from "next/server";

import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import type { TextScope } from "@/lib/i18n/text-catalog";
import { invalidatePublishedTextOverrides } from "@/lib/i18n/text-overrides";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

type PendingRow = {
  id: string;
  locale: string;
  text_key: string;
  draft_value: string | null;
  published_value: string | null;
};

/**
 * POST → manda ONLINE le bozze di uno scope («Pubblica»), oppure le scarta («Annulla»).
 * Body: { scope: 'vetrina'|'app', action?: 'publish'|'discard' }
 *
 * Pubblicare = copiare draft_value in published_value: solo published_value è
 * leggibile dal sito (policy RLS), quindi finché non si passa di qui il pubblico
 * continua a vedere il testo del repo.
 */
export async function POST(request: Request) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403, headers: NO_STORE });
  }

  let body: { scope?: string; action?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false as const, error: "Body JSON non valido." }, { status: 400, headers: NO_STORE });
  }

  const scope = (body.scope === "app" ? "app" : "vetrina") as TextScope;
  const action = body.action === "discard" ? "discard" : "publish";

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY sul server." },
      { status: 503, headers: NO_STORE },
    );
  }

  const { data, error } = await admin
    .from("ui_text_overrides")
    .select("id, locale, text_key, draft_value, published_value")
    .eq("scope", scope);
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }

  const pending = ((data ?? []) as PendingRow[]).filter(
    (r) => r.draft_value !== null && r.draft_value !== r.published_value,
  );
  if (!pending.length) {
    return NextResponse.json({ ok: true as const, changed: 0, action }, { headers: NO_STORE });
  }

  if (action === "discard") {
    // Scarta le bozze: quelle mai pubblicate spariscono, le altre tornano al valore online.
    const neverPublished = pending.filter((r) => r.published_value === null).map((r) => r.id);
    const revertable = pending.filter((r) => r.published_value !== null);

    if (neverPublished.length) {
      const { error: delErr } = await admin.from("ui_text_overrides").delete().in("id", neverPublished);
      if (delErr) {
        return NextResponse.json({ ok: false as const, error: delErr.message }, { status: 500, headers: NO_STORE });
      }
    }
    for (const row of revertable) {
      const { error: updErr } = await admin
        .from("ui_text_overrides")
        .update({ draft_value: row.published_value })
        .eq("id", row.id);
      if (updErr) {
        return NextResponse.json({ ok: false as const, error: updErr.message }, { status: 500, headers: NO_STORE });
      }
    }
    return NextResponse.json({ ok: true as const, changed: pending.length, action }, { headers: NO_STORE });
  }

  const publishedAt = new Date().toISOString();
  for (const row of pending) {
    const { error: updErr } = await admin
      .from("ui_text_overrides")
      .update({ published_value: row.draft_value, published_at: publishedAt, updated_by: session.userId })
      .eq("id", row.id);
    if (updErr) {
      return NextResponse.json({ ok: false as const, error: updErr.message }, { status: 500, headers: NO_STORE });
    }
  }

  // Azzera la cache di QUESTA istanza; le altre si allineano entro il TTL (60s).
  invalidatePublishedTextOverrides();

  return NextResponse.json({ ok: true as const, changed: pending.length, action }, { headers: NO_STORE });
}
