import { ShellWithAdaptiveBackdrop } from "@/components/shell/ShellWithAdaptiveBackdrop";
import { redirectPlatformAdminToConsole } from "@/lib/auth/redirect-platform-admin";
import { gateAuthenticatedShellAccessOrRedirect } from "@/lib/billing/subscription-paywall";
import { getSessionProfile } from "@/lib/auth/session-profile";

export const dynamic = "force-dynamic";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  // Platform admin: la shell utente/coach non è la sua area → /admin.
  await redirectPlatformAdminToConsole();
  // Server-side paywall gate: redirect a /pricing se loggato senza entitlement
  // e `EMPATHY_PAYWALL_ENFORCED=true`. No-op per anonimi e con flag spenta.
  await gateAuthenticatedShellAccessOrRedirect();
  // Role + athleteId risolti dal server: la sidebar li usa come stato iniziale (SSR),
  // così al reload mostra SUBITO le voci giuste senza il flash in cui le voci
  // atleta/coach compaiono dopo la risoluzione client del contesto atleta.
  const session = await getSessionProfile();
  return (
    <ShellWithAdaptiveBackdrop initialRole={session.role} initialAthleteId={session.athleteId}>
      {children}
    </ShellWithAdaptiveBackdrop>
  );
}
