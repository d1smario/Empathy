import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScopedAthleteStagingView } from "@/components/athlete-scope/ScopedAthleteStagingView";

export const dynamic = "force-dynamic";

/** Moduli con flusso staging/review (proposta da validare). */
const STAGING_MODULES = ["health", "biomechanics", "aerodynamics"];

type PageProps = { params: { athleteId: string; module: string; runId: string } };

export function generateMetadata({ params }: PageProps): Metadata {
  return { title: `Review · ${params.module} · Athlete` };
}

/**
 * Review/validazione di una proposta nello scope dell'atleta selezionato dal coach
 * (shell MOBILE). Gate (coach + canAccessAthleteData → 404) e barra contestuale dal
 * layout /m/athletes/[athleteId]; qui montiamo la staging view (riuso del dispatcher
 * desktop ScopedAthleteStagingView) nello scope coach dall'URL.
 */
export default function MobileCoachAthleteStagingPage({ params }: PageProps) {
  if (!STAGING_MODULES.includes(params.module)) notFound();
  return (
    <ScopedAthleteStagingView module={params.module} athleteId={params.athleteId} runId={params.runId} scope="coach" />
  );
}
