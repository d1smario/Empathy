import { MobileShellWithAdaptiveBackdrop } from "@/components/shell/MobileShellWithAdaptiveBackdrop";
import { redirectPlatformAdminToConsole } from "@/lib/auth/redirect-platform-admin";
import { gateAuthenticatedShellAccessOrRedirect } from "@/lib/billing/subscription-paywall";

export const dynamic = "force-dynamic";

export default async function MobileShellLayout({ children }: { children: React.ReactNode }) {
  // Platform admin: la shell mobile atleta non è la sua area → /admin.
  await redirectPlatformAdminToConsole();
  await gateAuthenticatedShellAccessOrRedirect();
  return <MobileShellWithAdaptiveBackdrop>{children}</MobileShellWithAdaptiveBackdrop>;
}
