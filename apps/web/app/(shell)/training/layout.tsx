import { redirectCoachToRoster } from "@/lib/auth/redirect-coach-to-roster";

export const dynamic = "force-dynamic";

/**
 * Training è una vista atleta (dati propri). Per il coach lo scope giusto è
 * /athletes/[id]/training: senza atleta in scope l'hub e le sottoviste (builder,
 * calendar, analytics, session) sarebbero vuote → rimandiamo il coach al roster.
 * Il layout copre l'indice e TUTTE le sottorotte in un unico gate (no-op per
 * il privato; l'admin è già espulso dalla shell verso /admin).
 */
export default async function TrainingLayout({ children }: { children: React.ReactNode }) {
  await redirectCoachToRoster();
  return <>{children}</>;
}
