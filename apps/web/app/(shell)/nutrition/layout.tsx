import { redirectCoachToRoster } from "@/lib/auth/redirect-coach-to-roster";

export const dynamic = "force-dynamic";

/**
 * Nutrition è una vista atleta (dati propri). Per il coach lo scope giusto è
 * /athletes/[id]/nutrition: senza atleta in scope le sottoviste (meal-plan, diary,
 * fueling, integration, predictor) sarebbero vuote → rimandiamo il coach al roster.
 * Copre l'indice e tutte le sottorotte in un unico gate.
 */
export default async function NutritionLayout({ children }: { children: React.ReactNode }) {
  await redirectCoachToRoster();
  return <>{children}</>;
}
