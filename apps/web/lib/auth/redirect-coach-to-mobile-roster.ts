import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session-profile";

/**
 * Gemello mobile di `redirectCoachToRoster`: le rotte modulo atleta "nude" della shell
 * mobile (/m/dashboard, /m/health, /m/training/calendar, …) mostrano i dati PROPRI
 * dell'utente. Per il coach non sono lo scope giusto (opera per atleta selezionato via
 * /m/athletes/[id]/…); senza atleta in scope sarebbero vuote → lo rimandiamo al roster
 * mobile. Redirige SOLO il role coach; l'atleta resta sui propri dati.
 */
export async function redirectCoachToMobileRoster(): Promise<void> {
  const session = await getSessionProfile();
  if (session.role === "coach") redirect("/m/athletes");
}
