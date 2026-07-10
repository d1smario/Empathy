import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScopedAthleteSessionView } from "@/components/athlete-scope/ScopedAthleteSessionView";

export const dynamic = "force-dynamic";

type PageProps = { params: { athleteId: string; module: string; date: string } };

export function generateMetadata({ params }: PageProps): Metadata {
  return { title: `Training · ${params.date} · Athlete` };
}

/**
 * Dettaglio seduta del giorno nello scope dell'atleta selezionato dal coach:
 * la tabella Calendario in scope linka qui (non alla rotta globale
 * /training/session/[date], che per un coach perde l'atleta → «Nessun atleta
 * attivo»). Gate (coach + canAccessAthleteData → 404) e barra contestuale dal
 * layout /athletes/[athleteId]/layout.tsx. Stesso pattern dello staging.
 */
export default function CoachAthleteSessionPage({ params }: PageProps) {
  if (params.module !== "training") notFound();
  return <ScopedAthleteSessionView athleteId={params.athleteId} scope="coach" />;
}
