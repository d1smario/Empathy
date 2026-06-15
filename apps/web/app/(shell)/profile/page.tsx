import type { Metadata } from "next";
import { CoachProfileView } from "@/components/coach/CoachProfileView";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { getSessionProfile } from "@/lib/auth/session-profile";
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
  return <ProfilePageView />;
}
