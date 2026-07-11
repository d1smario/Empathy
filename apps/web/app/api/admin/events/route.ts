import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { loadAllEvents } from "@/lib/marketing/events";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/** GET /api/admin/events — elenco completo eventi (platform admin). */
export async function GET() {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403, headers: NO_STORE });
  }
  const items = await loadAllEvents();
  return NextResponse.json({ ok: true as const, items }, { headers: NO_STORE });
}

/** POST /api/admin/events — crea un evento (platform admin). */
export async function POST(req: Request) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403, headers: NO_STORE });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY." }, { status: 503, headers: NO_STORE });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const strOrNull = (v: unknown): string | null => (str(v) ? str(v) : null);
  const payload = {
    title_it: str(body.titleIt),
    title_en: str(body.titleEn),
    body_it: str(body.bodyIt),
    body_en: str(body.bodyEn),
    image_url: strOrNull(body.imageUrl),
    event_date: strOrNull(body.eventDate),
    location: strOrNull(body.location),
    cta_url: strOrNull(body.ctaUrl),
    sort_order: Number.isFinite(body.sortOrder) ? Math.trunc(body.sortOrder as number) : 0,
    published: body.published === false ? false : true,
  };
  if (!payload.title_it && !payload.title_en) {
    return NextResponse.json(
      { ok: false as const, error: "Serve almeno un titolo (IT o EN)." },
      { status: 400, headers: NO_STORE },
    );
  }

  const { data, error } = await admin.from("vetrina_events").insert(payload).select("id").maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true as const, id: (data as { id?: string } | null)?.id ?? null }, { headers: NO_STORE });
}
