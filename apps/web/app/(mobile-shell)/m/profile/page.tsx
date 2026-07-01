import type { Metadata } from "next";
import { CoachProfileView } from "@/components/coach/CoachProfileView";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { getSessionProfile } from "@/lib/auth/session-profile";
import ProfilePageView from "@/modules/profile/views/ProfilePageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
  description: "Profile — mobile app.",
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
        eyebrow="Profile · Coach"
        eyebrowClassName="text-violet-400"
        title="Your account"
        description={
          <span className="text-sm text-gray-400">
            Your coach account details, personal information for commissions and security.
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
