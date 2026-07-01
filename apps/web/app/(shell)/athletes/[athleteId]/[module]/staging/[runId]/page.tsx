import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScopedAthleteStagingView } from "@/components/athlete-scope/ScopedAthleteStagingView";

export const dynamic = "force-dynamic";

/** Moduli con flusso staging/review (proposta AI da validare). */
const STAGING_MODULES = ["health", "biomechanics", "aerodynamics"];

type PageProps = { params: { athleteId: string; module: string; runId: string } };

export function generateMetadata({ params }: PageProps): Metadata {
  return { title: `Review · ${params.module} · Athlete` };
}

/**
 * Review/validazione di una proposta AI nello scope dell'atleta selezionato dal coach.
 * Gate (coach + canAccessAthleteData → 404) e barra contestuale arrivano dal layout
 * /athletes/[athleteId]/layout.tsx; qui montiamo la staging view nello scope dall'URL.
 */
export default function CoachAthleteStagingPage({ params }: PageProps) {
  if (!STAGING_MODULES.includes(params.module)) notFound();
  return (
    <ScopedAthleteStagingView
      module={params.module}
      athleteId={params.athleteId}
      runId={params.runId}
      scope="coach"
    />
  );
}
