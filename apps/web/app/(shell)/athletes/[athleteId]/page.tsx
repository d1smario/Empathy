import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Base atleta selezionato: si atterra sulla Dashboard (overview/twin), come l'atleta. */
export default function CoachSelectedAthleteIndexPage({ params }: { params: { athleteId: string } }) {
  redirect(`/athletes/${params.athleteId}/dashboard`);
}
