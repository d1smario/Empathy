import type { Metadata } from "next";
import { CoachProfileView } from "@/components/coach/CoachProfileView";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { getSessionProfile } from "@/lib/auth/session-profile";
import ProfilePageView from "@/modules/profile/views/ProfilePageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
  description: "Profilo — app mobile.",
};

/**
 * Profilo per ruolo (come desktop): il coach gestisce qui il SUO account (stato
 * approvazione, anagrafica per le commissioni, sicurezza); l'atleta il proprio
 * profilo. (L'admin non passa dalla shell mobile.)
 */
export default async function MobileProfilePage() {
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
  return (
    <div className="mx-auto max-w-lg px-2 pb-4 pt-2">
      <ProfilePageView />
    </div>
  );
}
