import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadOnboardingCompleteness } from "@/lib/onboarding/load-onboarding-snapshot";
import { buildOnboardingEmail } from "@/lib/onboarding/onboarding-email-content";
import { isPostmarkConfigured, sendTransactionalEmail } from "@/lib/onboarding/postmark-send";
import { loadEntitledAthleteIds, resolvePlanWindowStartIso } from "@/lib/onboarding/onboarding-window";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Finestra onboarding (giorni dalla partenza). Oggi la partenza = created_at del profilo
 *  (proxy). Mattone 4: sostituire con plan_started_at reale dell'acquisto. */
const WINDOW_DAYS = 3;
/** Ora locale dell'atleta in cui inviare la mail (cron ORARIA → gate sull'ora locale). */
const SEND_HOUR_LOCAL = 8;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return (req.headers.get("authorization") ?? "") === `Bearer ${secret}`;
}

function localHour(tz: string | null): number {
  const now = new Date();
  try {
    if (!tz) return now.getUTCHours();
    const s = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(now);
    const h = Number.parseInt(s, 10);
    return Number.isFinite(h) ? h % 24 : now.getUTCHours();
  } catch {
    return now.getUTCHours();
  }
}

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://empathy.coach").replace(/\/+$/, "");
}

/**
 * Cron oraria mail onboarding. Vercel invoca GET con `Authorization: Bearer <CRON_SECRET>`.
 * Per ogni atleta nella finestra dei 3 giorni con onboarding INCOMPLETO, all'ora locale
 * giusta e non ancora servito per quel giorno: invia la mail «cosa manca» (idempotente).
 *
 * Sicuro di default: DRY-RUN (nessun invio) finché non si passa `?send=true`, e comunque
 * Postmark fa no-op finché non è configurato. `?force=true` bypassa il gate ora-locale (test).
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const send = searchParams.get("send") === "true";
  const force = searchParams.get("force") === "true";

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, error: "Service role non configurato" }, { status: 500 });
  }

  const sinceIso = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const { data: rows, error } = await db
    .from("athlete_profiles")
    .select("id, email, first_name, timezone, created_at, plan_started_at")
    .or(`created_at.gte.${sinceIso},plan_started_at.gte.${sinceIso}`);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Solo atleti con diritto d'uso (prova/abbonamento/grant) ricevono la mail.
  const entitled = await loadEntitledAthleteIds(db, ((rows ?? []) as Array<Record<string, unknown>>).map((r) => String(r.id ?? "")));

  const app = appBaseUrl();
  const summary = {
    inWindow: rows?.length ?? 0,
    eligibleHour: 0,
    sent: 0,
    dryRun: 0,
    skippedNotEntitled: 0,
    skippedHour: 0,
    skippedAlready: 0,
    skippedPlanReady: 0,
    skippedNoEmail: 0,
    skippedNoConfig: 0,
  };
  const preview: Array<{ athleteId: string; dayIndex: number; to: string | null; subject: string }> = [];

  for (const raw of (rows ?? []) as Array<Record<string, unknown>>) {
    const athleteId = String(raw.id ?? "");
    const windowStart = resolvePlanWindowStartIso(raw);
    if (!athleteId || !windowStart) continue;
    if (!entitled.has(athleteId)) {
      summary.skippedNotEntitled++;
      continue;
    }

    const daysSince = Math.floor((Date.now() - new Date(windowStart).getTime()) / 86_400_000);
    const dayIndex = daysSince + 1; // giorno 0 → D1
    if (dayIndex < 1 || dayIndex > 3) continue;

    const tz = typeof raw.timezone === "string" ? raw.timezone : null;
    if (!force && localHour(tz) !== SEND_HOUR_LOCAL) {
      summary.skippedHour++;
      continue;
    }
    summary.eligibleHour++;

    // Idempotenza: una mail per atleta+giorno.
    const { data: existing } = await db
      .from("onboarding_email_log")
      .select("id")
      .eq("athlete_id", athleteId)
      .eq("day_index", dayIndex)
      .maybeSingle();
    if (existing?.id) {
      summary.skippedAlready++;
      continue;
    }

    const completeness = await loadOnboardingCompleteness(db, athleteId);
    // Chi ha già completato non va infastidito: la mail «piano pronto» vive nel trigger di generazione (Mattone 3).
    if (completeness.planReady) {
      summary.skippedPlanReady++;
      continue;
    }

    const email = typeof raw.email === "string" ? raw.email.trim() : "";
    const firstName = typeof raw.first_name === "string" ? raw.first_name : null;
    const built = buildOnboardingEmail({ firstName, dayIndex, completeness, appUrl: app });

    if (!send) {
      summary.dryRun++;
      preview.push({ athleteId, dayIndex, to: email || null, subject: built.subject });
      continue;
    }
    if (!email) {
      summary.skippedNoEmail++;
      continue;
    }

    const res = await sendTransactionalEmail({
      to: email,
      subject: built.subject,
      htmlBody: built.htmlBody,
      textBody: built.textBody,
      tag: built.tag,
    });
    if ("skipped" in res && res.skipped) {
      // Postmark non configurato: non logghiamo, così riparte quando sarà pronto.
      summary.skippedNoConfig++;
      continue;
    }
    await db.from("onboarding_email_log").insert({
      athlete_id: athleteId,
      day_index: dayIndex,
      status: res.ok ? "sent" : "error",
      message_id: res.ok ? res.messageId : null,
    });
    if (res.ok) summary.sent++;
  }

  return NextResponse.json({
    ok: true,
    dryRun: !send,
    postmarkConfigured: isPostmarkConfigured(),
    summary,
    ...(send ? {} : { preview }),
  });
}
