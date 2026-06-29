import { redirectCoachToMobileRoster } from "@/lib/auth/redirect-coach-to-mobile-roster";

export const dynamic = "force-dynamic";

/**
 * Training è vista atleta (dati propri). Per il coach lo scope è /m/athletes/[id]/training:
 * il layout rimanda il coach al roster su TUTTE le sottorotte (calendar, session, session/[date])
 * in un unico gate, come il desktop (shell)/training/layout.tsx. No-op per l'atleta.
 */
export default async function MobileTrainingLayout({ children }: { children: React.ReactNode }) {
  await redirectCoachToMobileRoster();
  return <>{children}</>;
}
