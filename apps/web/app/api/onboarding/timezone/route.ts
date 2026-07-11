import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Valida un IANA time zone (es. "Europe/Zurich") provandolo con Intl. */
function isValidIanaTimeZone(tz: string): boolean {
  if (!/^[A-Za-z]+\/[A-Za-z0-9_+\-/]+$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Imposta il fuso orario dell'atleta corrente dal valore rilevato dal browser
 * (Intl.DateTimeFormat().resolvedOptions().timeZone). Scrive SOLO se assente,
 * per non sovrascrivere una scelta esplicita dell'utente.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSessionProfile();
    if (session.role !== "private" || !session.athleteId) {
      return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 403 });
    }
    const body = (await req.json().catch(() => null)) as { timezone?: unknown } | null;
    const tz = typeof body?.timezone === "string" ? body.timezone.trim() : "";
    if (!isValidIanaTimeZone(tz)) {
      return NextResponse.json({ ok: false, error: "Fuso orario non valido" }, { status: 400 });
    }
    const db = createSupabaseCookieClient();
    if (!db) {
      return NextResponse.json({ ok: false, error: "Supabase non configurato" }, { status: 500 });
    }

    // Non sovrascrivere un fuso già impostato dall'utente.
    const { data: existing } = await db
      .from("athlete_profiles")
      .select("timezone")
      .eq("id", session.athleteId)
      .maybeSingle();
    const current = typeof existing?.timezone === "string" ? existing.timezone.trim() : "";
    if (current.length > 0) {
      return NextResponse.json({ ok: true, timezone: current, changed: false });
    }

    const { error } = await db
      .from("athlete_profiles")
      .update({ timezone: tz })
      .eq("id", session.athleteId);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, timezone: tz, changed: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Errore" },
      { status: 500 },
    );
  }
}
