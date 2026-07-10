import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Base atleta selezionato: si atterra su Analisi (overview/twin). */
export default function CoachSelectedAthleteIndexPage({ params }: { params: { athleteId: string } }) {
  redirect(`/athletes/${params.athleteId}/analysis`);
}
