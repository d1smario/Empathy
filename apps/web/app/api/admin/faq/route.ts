import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { loadAllFaq } from "@/lib/marketing/faq";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/** GET /api/admin/faq — elenco completo FAQ (platform admin). */
export async function GET() {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403, headers: NO_STORE });
  }
  const items = await loadAllFaq();
  return NextResponse.json({ ok: true as const, items }, { headers: NO_STORE });
}

/** POST /api/admin/faq — crea una nuova FAQ (platform admin). */
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
  const payload = {
    question_it: str(body.questionIt),
    answer_it: str(body.answerIt),
    question_en: str(body.questionEn),
    answer_en: str(body.answerEn),
    question_tr: str(body.questionTr),
    answer_tr: str(body.answerTr),
    question_de: str(body.questionDe),
    answer_de: str(body.answerDe),
    question_fr: str(body.questionFr),
    answer_fr: str(body.answerFr),
    category: str(body.category) || null,
    sort_order: Number.isFinite(body.sortOrder) ? Math.trunc(body.sortOrder as number) : 0,
    published: body.published === false ? false : true,
  };
  if (!payload.question_it && !payload.question_en) {
    return NextResponse.json(
      { ok: false as const, error: "Serve almeno una domanda (IT o EN)." },
      { status: 400, headers: NO_STORE },
    );
  }

  const { data, error } = await admin.from("faq_entries").insert(payload).select("id").maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true as const, id: (data as { id?: string } | null)?.id ?? null }, { headers: NO_STORE });
}
