import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { coachOrgIdForDb } from "@/lib/coach-org-id";
import { coachOperationalApproved } from "@/lib/platform-coach-status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Alfabeto leggibile (no 0/O/1/I/L) per codici dettabili a voce.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LEN = 4;

/** Genera un codice corto leggibile, es. COACH-7K2P. */
function newCoachCode(): string {
  let suffix = "";
  for (let i = 0; i < CODE_LEN; i += 1) {
    suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `COACH-${suffix}`;
}

type CoachIdentity = {
  userId: string;
  orgId: string;
};

/**
 * Gate condiviso GET/POST: utente autenticato + ruolo coach approvato.
 * Ritorna NextResponse di errore oppure l'identità coach risolta.
 */
async function requireApprovedCoach(): Promise<NextResponse | CoachIdentity> {
  const cookieClient = createSupabaseCookieClient();
  if (!cookieClient) {
    return NextResponse.json({ ok: false as const, error: "Supabase non configurato." }, { status: 503 });
  }

  const {
    data: { user },
    error: authErr,
  } = await cookieClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false as const, error: "Non autenticato." }, { status: 401 });
  }

  const { data: profile, error: profErr } = await cookieClient
    .from("app_user_profiles")
    .select("role, platform_coach_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profErr) {
    return NextResponse.json({ ok: false as const, error: profErr.message }, { status: 500 });
  }

  const row = profile as { role?: string; platform_coach_status?: string | null } | null;
  if (row?.role !== "coach") {
    return NextResponse.json(
      { ok: false as const, error: "Solo account con ruolo coach hanno un codice." },
      { status: 403 },
    );
  }
  if (!coachOperationalApproved("coach", row?.platform_coach_status)) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Il tuo account coach non è ancora abilitato dall’amministrazione.",
      },
      { status: 403 },
    );
  }

  return { userId: user.id, orgId: coachOrgIdForDb() };
}

/**
 * GET: ritorna il codice coach esistente (o `code: null` se non ancora generato).
 */
export async function GET() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Codice coach: manca SUPABASE_SERVICE_ROLE_KEY sul server." },
      { status: 503 },
    );
  }

  const gate = await requireApprovedCoach();
  if (gate instanceof NextResponse) return gate;

  const { data, error } = await admin
    .from("coach_codes")
    .select("code, is_active")
    .eq("coach_user_id", gate.userId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
  }

  const existing = data as { code?: string; is_active?: boolean } | null;
  return NextResponse.json({
    ok: true as const,
    code: existing?.code ?? null,
    isActive: existing?.is_active ?? null,
  });
}

/**
 * POST: genera (o ruota) il codice coach. Upsert su coach_codes (PK = coach_user_id),
 * un solo codice per coach. Service role per il write; gate ruolo lato cookie.
 */
export async function POST() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Codice coach: manca SUPABASE_SERVICE_ROLE_KEY sul server." },
      { status: 503 },
    );
  }

  const gate = await requireApprovedCoach();
  if (gate instanceof NextResponse) return gate;

  // Retry su collisione del codice (vincolo UNIQUE su coach_codes.code).
  let lastErr: string | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = newCoachCode();
    const { data, error } = await admin
      .from("coach_codes")
      .upsert(
        {
          coach_user_id: gate.userId,
          org_id: gate.orgId,
          code,
          is_active: true,
        },
        { onConflict: "coach_user_id" },
      )
      .select("code")
      .maybeSingle();

    if (!error) {
      const row = data as { code?: string } | null;
      return NextResponse.json({ ok: true as const, code: row?.code ?? code });
    }

    lastErr = error.message;
    // 23505 = unique_violation sul codice: rigenera e riprova.
    const isUniqueViolation =
      (error as { code?: string }).code === "23505" || /duplicate key|unique/i.test(error.message);
    if (!isUniqueViolation) {
      return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json(
    { ok: false as const, error: lastErr ?? "Impossibile generare un codice univoco." },
    { status: 500 },
  );
}
