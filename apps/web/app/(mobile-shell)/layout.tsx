import { MobileShellWithAdaptiveBackdrop } from "@/components/shell/MobileShellWithAdaptiveBackdrop";
import { redirectPlatformAdminToConsole } from "@/lib/auth/redirect-platform-admin";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { gateAuthenticatedShellAccessOrRedirect } from "@/lib/billing/subscription-paywall";

export const dynamic = "force-dynamic";

export default async function MobileShellLayout({ children }: { children: React.ReactNode }) {
  // Platform admin: la shell mobile non è la sua area → /admin.
  await redirectPlatformAdminToConsole();
  // Coach e atleta condividono la shell mobile: il coach opera per atleta selezionato
  // (roster /m/athletes → /m/athletes/[id]/...), l'atleta sui propri dati. La nav è
  // role-aware (initialRole evita il flash); le rotte atleta "nude" rimandano il coach
  // al roster (vedi redirectCoachToMobileRoster nelle pagine modulo).
  const session = await getSessionProfile();
  await gateAuthenticatedShellAccessOrRedirect();
  return (
    <MobileShellWithAdaptiveBackdrop initialRole={session.role}>{children}</MobileShellWithAdaptiveBackdrop>
  );
}
