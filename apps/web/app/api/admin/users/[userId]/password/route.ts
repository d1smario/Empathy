import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/users/[userId]/password
 * Service role: imposta una NUOVA password per l'utente target (auth.admin.updateUserById).
 * Riservato al platform admin. La password viaggia solo da admin → server (HTTPS): mai loggata,
 * mai persistita in chiaro. Vincoli Supabase Auth: min 6 (qui min 8) e max 72 byte (bcrypt).
 */
export async function POST(req: Request, { params }: { params: { userId: string } }) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY per l'aggiornamento admin." },
      { status: 503 },
    );
  }

  const userId = (params.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ ok: false as const, error: "userId mancante." }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8) {
    return NextResponse.json(
      { ok: false as const, error: "La password deve avere almeno 8 caratteri." },
      { status: 400 },
    );
  }
  if (Buffer.byteLength(password, "utf8") > 72) {
    return NextResponse.json(
      { ok: false as const, error: "La password è troppo lunga (max 72 byte)." },
      { status: 400 },
    );
  }

  const { data, error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const, userId: data.user?.id ?? userId });
}
