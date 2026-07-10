import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

type Row = {
  id: string;
  kind: string | null;
  name: string | null;
  email: string | null;
  message: string | null;
  meta: unknown;
  status: string | null;
  created_at: string | null;
};

/** GET /api/admin/contact — elenco submission Contatti/Collabora (platform admin). */
export async function GET() {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403, headers: NO_STORE });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY." }, { status: 503, headers: NO_STORE });
  }
  const { data, error } = await admin
    .from("contact_submissions")
    .select("id, kind, name, email, message, meta, status, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }
  const items = ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    kind: r.kind === "collaborate" ? "collaborate" : "contact",
    name: r.name ?? "",
    email: r.email ?? "",
    message: r.message ?? "",
    meta: (r.meta ?? {}) as Record<string, unknown>,
    status: r.status ?? "new",
    createdAt: r.created_at ?? null,
  }));
  return NextResponse.json({ ok: true as const, items }, { headers: NO_STORE });
}

/** PATCH /api/admin/contact — aggiorna stato (new|read|archived). Body: { id, status }. */
export async function PATCH(req: Request) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403, headers: NO_STORE });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY." }, { status: 503, headers: NO_STORE });
  }
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; status?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const status = body.status === "read" || body.status === "archived" || body.status === "new" ? body.status : "";
  if (!id || !status) {
    return NextResponse.json({ ok: false as const, error: "id e status validi richiesti." }, { status: 400, headers: NO_STORE });
  }
  const { error } = await admin.from("contact_submissions").update({ status }).eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true as const, id, status }, { headers: NO_STORE });
}
