import { redirect } from "next/navigation";
import { redirectCoachToRoster } from "@/lib/auth/redirect-coach-to-roster";

export const dynamic = "force-dynamic";

/**
 * Hub Allenamento rimosso (2026-07): l'indice va diretto al Calendario (vista
 * tabella). Il coach viene comunque spedito al roster da redirectCoachToRoster.
 */
export default async function TrainingIndexPage() {
  await redirectCoachToRoster();
  redirect("/training/calendar");
}
