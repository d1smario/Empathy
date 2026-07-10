import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/contact — invio pubblico form Contatti / Collabora.
 * Insert server-side con service-role (RLS nega ogni accesso client), così niente
 * insert anon diretti. Honeypot `company` anti-bot: se valorizzato, rispondiamo ok
 * ma non persistiamo.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

  // Honeypot: campo nascosto lato UI; se compilato è un bot.
  if (str(body.company).length > 0) {
    return NextResponse.json({ ok: true as const, received: true }, { headers: NO_STORE });
  }

  const kind = str(body.kind) === "collaborate" ? "collaborate" : "contact";
  const name = str(body.name).slice(0, 200);
  const email = str(body.email).slice(0, 200);
  const message = str(body.message).slice(0, 5000);

  if (!name) {
    return NextResponse.json({ ok: false as const, error: "Il nome è obbligatorio." }, { status: 400, headers: NO_STORE });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false as const, error: "Email non valida." }, { status: 400, headers: NO_STORE });
  }
  if (message.length < 10) {
    return NextResponse.json({ ok: false as const, error: "Scrivi un messaggio (min 10 caratteri)." }, { status: 400, headers: NO_STORE });
  }

  // Meta opzionali (ruolo/azienda/telefono/profilo) senza vincoli rigidi.
  const meta: Record<string, string> = {};
  for (const key of ["role", "organization", "phone", "profile", "link"]) {
    const v = str(body[key]);
    if (v) meta[key] = v.slice(0, 500);
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Servizio non disponibile al momento." },
      { status: 503, headers: NO_STORE },
    );
  }

  const { error } = await admin.from("contact_submissions").insert({ kind, name, email, message, meta });
  if (error) {
    return NextResponse.json({ ok: false as const, error: "Invio non riuscito, riprova." }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true as const, received: true }, { headers: NO_STORE });
}
