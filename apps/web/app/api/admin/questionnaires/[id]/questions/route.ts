import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

const KINDS = ["text", "number", "boolean", "choice"] as const;
type Kind = (typeof KINDS)[number];

/** Normalizza le opzioni (array di stringhe non vuote) per kind=choice, altrimenti null. */
function parseOptions(kind: Kind, raw: unknown): string[] | null {
  if (kind !== "choice") return null;
  if (!Array.isArray(raw)) return [];
  return raw.filter((o): o is string => typeof o === "string").map((o) => o.trim()).filter(Boolean);
}

/** POST /api/admin/questionnaires/[id]/questions — crea una domanda (platform admin). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403, headers: NO_STORE });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY." }, { status: 503, headers: NO_STORE });
  }
  const questionnaireId = (params.id ?? "").trim();
  if (!questionnaireId) {
    return NextResponse.json({ ok: false as const, error: "id questionario mancante." }, { status: 400, headers: NO_STORE });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ ok: false as const, error: "Serve il testo della domanda." }, { status: 400, headers: NO_STORE });
  }
  const kind = KINDS.includes(body.kind as Kind) ? (body.kind as Kind) : null;
  if (!kind) {
    return NextResponse.json(
      { ok: false as const, error: "Tipo domanda non valido (text/number/boolean/choice)." },
      { status: 400, headers: NO_STORE },
    );
  }
  const options = parseOptions(kind, body.options);
  if (kind === "choice" && (!options || options.length < 2)) {
    return NextResponse.json(
      { ok: false as const, error: "Una domanda a scelta richiede almeno 2 opzioni." },
      { status: 400, headers: NO_STORE },
    );
  }

  const payload = {
    questionnaire_id: questionnaireId,
    prompt,
    kind,
    options,
    required: body.required === true,
    sort_order:
      typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder) ? Math.trunc(body.sortOrder) : 100,
  };

  const { data, error } = await admin.from("questionnaire_questions").insert(payload).select("id").maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true as const, id: (data as { id?: string } | null)?.id ?? null }, { headers: NO_STORE });
}
