import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/** PATCH /api/admin/faq/[id] — aggiorna una FAQ (platform admin). */
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
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const setStr = (key: string, col: string) => {
    if (typeof body[key] === "string") patch[col] = (body[key] as string).trim();
  };
  setStr("questionIt", "question_it");
  setStr("answerIt", "answer_it");
  setStr("questionEn", "question_en");
  setStr("answerEn", "answer_en");
  setStr("questionTr", "question_tr");
  setStr("answerTr", "answer_tr");
  setStr("questionDe", "question_de");
  setStr("answerDe", "answer_de");
  setStr("questionFr", "question_fr");
  setStr("answerFr", "answer_fr");
  if ("category" in body) patch.category = typeof body.category === "string" && body.category.trim() ? body.category.trim() : null;
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) patch.sort_order = Math.trunc(body.sortOrder);
  if (typeof body.published === "boolean") patch.published = body.published;

  const { error } = await admin.from("faq_entries").update(patch).eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true as const, id }, { headers: NO_STORE });
}

/** DELETE /api/admin/faq/[id] — elimina una FAQ (platform admin). */
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
  const { error } = await admin.from("faq_entries").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true as const, id }, { headers: NO_STORE });
}
