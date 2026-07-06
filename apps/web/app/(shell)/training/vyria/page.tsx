import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Virya rimosso da Allenamento (2026-07): la route reindirizza al Calendario.
 * La view/motore Virya restano nel repo (non più raggiungibili da qui) in attesa
 * di un'eventuale rimozione mirata delle dipendenze.
 */
export default function TrainingVyriaPage() {
  redirect("/training/calendar");
}
