import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

const KINDS = ["text", "number", "boolean", "choice"] as const;
type Kind = (typeof KINDS)[number];

/** PATCH /api/admin/questionnaires/questions/[questionId] — aggiorna una domanda (platform admin). */
export async function PATCH(req: Request, { params }: { params: { questionId: string } }) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403, headers: NO_STORE });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY." }, { status: 503, headers: NO_STORE });
  }
  const id = (params.questionId ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false as const, error: "id domanda mancante." }, { status: 400, headers: NO_STORE });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof body.prompt === "string" && body.prompt.trim()) patch.prompt = body.prompt.trim();
  if (typeof body.kind === "string") {
    if (!KINDS.includes(body.kind as Kind)) {
      return NextResponse.json(
        { ok: false as const, error: "Tipo domanda non valido (text/number/boolean/choice)." },
        { status: 400, headers: NO_STORE },
      );
    }
    patch.kind = body.kind;
    if (body.kind !== "choice") patch.options = null;
  }
  if ("options" in body) {
    const options = Array.isArray(body.options)
      ? body.options.filter((o): o is string => typeof o === "string").map((o) => o.trim()).filter(Boolean)
      : null;
    let kind = patch.kind as Kind | undefined;
    if (kind === undefined) {
      // Perché: options senza kind nel body deve rispettare il kind corrente in DB,
      // altrimenti una PATCH parziale aggira il vincolo «≥2 opzioni per choice».
      const { data: current, error: readError } = await admin
        .from("questionnaire_questions")
        .select("kind")
        .eq("id", id)
        .maybeSingle();
      if (readError) {
        return NextResponse.json({ ok: false as const, error: readError.message }, { status: 500, headers: NO_STORE });
      }
      if (!current) {
        return NextResponse.json({ ok: false as const, error: "Domanda non trovata." }, { status: 404, headers: NO_STORE });
      }
      if (KINDS.includes(current.kind as Kind)) kind = current.kind as Kind;
    }
    if (kind === "choice" && (!options || options.length < 2)) {
      return NextResponse.json(
        { ok: false as const, error: "Una domanda a scelta richiede almeno 2 opzioni." },
        { status: 400, headers: NO_STORE },
      );
    }
    if (kind !== "choice" && kind !== undefined) {
      patch.options = null;
    } else {
      patch.options = options;
    }
  }
  if (typeof body.required === "boolean") patch.required = body.required;
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) patch.sort_order = Math.trunc(body.sortOrder);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false as const, error: "Nessun campo da aggiornare." }, { status: 400, headers: NO_STORE });
  }

  const { error } = await admin.from("questionnaire_questions").update(patch).eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true as const, id }, { headers: NO_STORE });
}

/** DELETE /api/admin/questionnaires/questions/[questionId] — elimina una domanda (cascade su risposte). */
export async function DELETE(_req: Request, { params }: { params: { questionId: string } }) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403, headers: NO_STORE });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY." }, { status: 503, headers: NO_STORE });
  }
  const id = (params.questionId ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false as const, error: "id domanda mancante." }, { status: 400, headers: NO_STORE });
  }
  const { error } = await admin.from("questionnaire_questions").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true as const, id }, { headers: NO_STORE });
}
