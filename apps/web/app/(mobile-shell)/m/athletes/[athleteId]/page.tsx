import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Base atleta selezionato (mobile): si atterra su Analisi, come desktop. */
export default function MobileCoachSelectedAthleteIndexPage({ params }: { params: { athleteId: string } }) {
  redirect(`/m/athletes/${params.athleteId}/analysis`);
}
