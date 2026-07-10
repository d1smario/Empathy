import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScopedAthleteSessionView } from "@/components/athlete-scope/ScopedAthleteSessionView";

export const dynamic = "force-dynamic";

type PageProps = { params: { athleteId: string; module: string; date: string } };

export function generateMetadata({ params }: PageProps): Metadata {
  return { title: `Training · ${params.date} · Athlete` };
}

/**
 * Dettaglio seduta del giorno nello scope coach, shell MOBILE (parità desktop
 * /athletes/[id]/training/session/[date]). Gate e barra contestuale dal layout
 * /m/athletes/[athleteId]; riuso del wrapper desktop ScopedAthleteSessionView.
 */
export default function MobileCoachAthleteSessionPage({ params }: PageProps) {
  if (params.module !== "training") notFound();
  return <ScopedAthleteSessionView athleteId={params.athleteId} scope="coach" />;
}
