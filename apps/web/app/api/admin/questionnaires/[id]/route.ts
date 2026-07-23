import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/** PATCH /api/admin/questionnaires/[id] — aggiorna un questionario (platform admin). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403, headers: NO_STORE });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY." }, { status: 503, headers: NO_STORE });
  }
  const id = (params.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false as const, error: "id mancante." }, { status: 400, headers: NO_STORE });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();
  if ("description" in body) {
    patch.description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  }
  if (typeof body.isActive === "boolean") patch.is_active = body.isActive;
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) patch.sort_order = Math.trunc(body.sortOrder);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false as const, error: "Nessun campo da aggiornare." }, { status: 400, headers: NO_STORE });
  }

  const { error } = await admin.from("questionnaires").update(patch).eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true as const, id }, { headers: NO_STORE });
}

/** DELETE /api/admin/questionnaires/[id] — elimina un questionario (cascade su domande e risposte). */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403, headers: NO_STORE });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY." }, { status: 503, headers: NO_STORE });
  }
  const id = (params.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false as const, error: "id mancante." }, { status: 400, headers: NO_STORE });
  }
  const { error } = await admin.from("questionnaires").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true as const, id }, { headers: NO_STORE });
}
