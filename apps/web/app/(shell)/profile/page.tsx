import type { Metadata } from "next";
import { CoachProfileView } from "@/components/coach/CoachProfileView";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadBillingEntitlementForAuthUser } from "@/lib/billing/ensure-billing-entitlement";
import ProfilePageView from "@/modules/profile/views/ProfilePageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profilo",
  description: "Identità atleta, fisiologia e vincoli nutrizionali.",
};

/**
 * Profilo per ruolo (stesso pattern di /dashboard): il coach gestisce qui il
 * SUO account (stato approvazione, anagrafica fatturazione per le commissioni,
 * password, uscita) — il profilo ATLETA non c'entra e vive nelle schede
 * /athletes/[id]. L'utente privato mantiene il profilo atleta esistente.
 * (L'admin non passa di qui: la shell lo gira su /admin.)
 */
export default async function ProfilePage() {
  const session = await getSessionProfile();
  if (session.role === "coach") {
    return (
      <Pro2ModulePageShell
        eyebrow="Profilo · Coach"
        eyebrowClassName="text-violet-400"
        title="Il tuo account"
        description={
          <span className="text-sm text-gray-400">
            Dati del tuo account coach, anagrafica per le commissioni e sicurezza.
          </span>
        }
      >
        <CoachProfileView platformCoachStatus={session.platformCoachStatus} />
      </Pro2ModulePageShell>
    );
  }
  // Box "Invita il tuo coach": nascosto se l'atleta ha già un coach collegato.
  // L'atleta non può leggere `coach_athletes` (RLS = solo il coach), quindi il
  // controllo è server-side con service role, limitato al SUO athlete_id.
  let hasLinkedCoach = false;
  let linkedCoach: { name: string; email: string | null } | null = null;
  if (session.athleteId) {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const { data } = await admin
        .from("coach_athletes")
        .select("coach_user_id")
        .eq("athlete_id", session.athleteId)
        .limit(1);
      hasLinkedCoach = (data?.length ?? 0) > 0;
      const coachUserId = (data?.[0]?.coach_user_id as string | undefined) ?? undefined;
      if (coachUserId) {
        // Nome/email del coach collegato (service role: l'atleta non legge coach_athletes).
        try {
          const { data: u } = await admin.auth.admin.getUserById(coachUserId);
          const meta = (u?.user?.user_metadata ?? {}) as Record<string, unknown>;
          const fullName = [meta.first_name, meta.last_name]
            .filter((v): v is string => typeof v === "string" && v.trim() !== "")
            .join(" ")
            .trim();
          linkedCoach = { name: fullName || u?.user?.email || "Coach", email: u?.user?.email ?? null };
        } catch {
          linkedCoach = { name: "Coach", email: null };
        }
      }
    }
  }

  // Piano attivo: la scelta "quali dati prendere dal device" (sorgente + stream
  // di ingest) è riservata a chi ha un piano attivo.
  let hasActivePlan = false;
  if (session.userId) {
    const ent = await loadBillingEntitlementForAuthUser(session.userId);
    hasActivePlan = ent.hasAthleteAccess === true;
  }

  return <ProfilePageView hasLinkedCoach={hasLinkedCoach} hasActivePlan={hasActivePlan} linkedCoach={linkedCoach} />;
}
