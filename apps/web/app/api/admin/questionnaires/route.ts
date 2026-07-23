import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

type QuestionRow = {
  id: string;
  prompt: string;
  kind: string;
  options: unknown;
  required: boolean;
  sort_order: number;
};

type QuestionnaireRow = {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string | null;
  questionnaire_questions: QuestionRow[] | null;
};

/** GET /api/admin/questionnaires — elenco questionari con domande (platform admin). */
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
    .from("questionnaires")
    .select(
      "id, title, description, is_active, sort_order, created_at, questionnaire_questions(id, prompt, kind, options, required, sort_order)",
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }

  const items = ((data ?? []) as QuestionnaireRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    questions: (row.questionnaire_questions ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((q) => ({
        id: q.id,
        prompt: q.prompt,
        kind: q.kind,
        options: Array.isArray(q.options) ? (q.options as string[]) : null,
        required: q.required,
        sortOrder: q.sort_order,
      })),
  }));
  return NextResponse.json({ ok: true as const, items }, { headers: NO_STORE });
}

/** POST /api/admin/questionnaires — crea un questionario (platform admin). */
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
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ ok: false as const, error: "Serve un titolo." }, { status: 400, headers: NO_STORE });
  }
  const payload = {
    title,
    description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
    is_active: body.isActive === false ? false : true,
    sort_order:
      typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder) ? Math.trunc(body.sortOrder) : 100,
  };

  const { data, error } = await admin.from("questionnaires").insert(payload).select("id").maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true as const, id: (data as { id?: string } | null)?.id ?? null }, { headers: NO_STORE });
}
