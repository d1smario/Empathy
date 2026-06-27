import { redirect } from "next/navigation";
import { MobileShellWithAdaptiveBackdrop } from "@/components/shell/MobileShellWithAdaptiveBackdrop";
import { redirectPlatformAdminToConsole } from "@/lib/auth/redirect-platform-admin";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { gateAuthenticatedShellAccessOrRedirect } from "@/lib/billing/subscription-paywall";

export const dynamic = "force-dynamic";

export default async function MobileShellLayout({ children }: { children: React.ReactNode }) {
  // Platform admin: la shell mobile atleta non è la sua area → /admin.
  await redirectPlatformAdminToConsole();
  // Coach: l'app mobile è la shell dell'atleta (dati propri). Il coach opera dalla shell
  // desktop (/dashboard → /athletes/[id]) → fuori dalla /m/* per non vedere viste vuote.
  const session = await getSessionProfile();
  if (session.role === "coach") {
    redirect("/dashboard");
  }
  await gateAuthenticatedShellAccessOrRedirect();
  return <MobileShellWithAdaptiveBackdrop>{children}</MobileShellWithAdaptiveBackdrop>;
}
