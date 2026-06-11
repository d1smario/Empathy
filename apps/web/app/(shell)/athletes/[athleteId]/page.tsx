import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Base atleta selezionato: si atterra direttamente sulla prima scheda. */
export default function CoachSelectedAthleteIndexPage({ params }: { params: { athleteId: string } }) {
  redirect(`/athletes/${params.athleteId}/health`);
}
