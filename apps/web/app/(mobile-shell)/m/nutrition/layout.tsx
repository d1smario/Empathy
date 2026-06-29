import { redirectCoachToMobileRoster } from "@/lib/auth/redirect-coach-to-mobile-roster";

export const dynamic = "force-dynamic";

/**
 * Nutrition è vista atleta (dati propri). Per il coach lo scope è /m/athletes/[id]/nutrition:
 * il layout rimanda il coach al roster su indice E sottorotte (meal-plan, diary) in un unico
 * gate, come il desktop (shell)/nutrition/layout.tsx. No-op per l'atleta.
 */
export default async function MobileNutritionLayout({ children }: { children: React.ReactNode }) {
  await redirectCoachToMobileRoster();
  return <>{children}</>;
}
