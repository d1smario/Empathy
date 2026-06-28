import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session-profile";

/**
 * Pagine modulo atleta "nude" (/health, /physiology, /training, /nutrition, /biomechanics,
 * /aerodynamics): per il coach NON sono lo scope giusto — lui opera dentro la scheda
 * dell'atleta selezionato (/athletes/[id]/[module]). Senza atleta in scope queste viste
 * sarebbero vuote (context coach athleteId=null). Lo rimandiamo al roster per scegliere.
 *
 * Il privato (dati propri) e il platform-admin (già espulso dalla shell verso /admin)
 * non sono interessati: redirige SOLO il role coach.
 */
export async function redirectCoachToRoster(): Promise<void> {
  const session = await getSessionProfile();
  if (session.role === "coach") redirect("/athletes");
}
