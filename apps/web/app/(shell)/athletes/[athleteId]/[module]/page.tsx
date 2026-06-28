import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScopedAthleteModuleView } from "@/components/athlete-scope/ScopedAthleteModuleView";
import { SCOPED_ATHLETE_TABS } from "@/core/navigation/module-registry";

export const dynamic = "force-dynamic";

type PageProps = { params: { athleteId: string; module: string } };

export function generateMetadata({ params }: PageProps): Metadata {
  const tab = SCOPED_ATHLETE_TABS.find((x) => x.module === params.module);
  return { title: tab ? `${tab.label} · Atleta` : "Atleta" };
}

/**
 * Scheda modulo dell'atleta selezionato dal coach: stessa vista e stesso
 * dispatcher delle schede admin (ScopedAthleteModuleView), scope dall'URL.
 * I tab provengono da SCOPED_ATHLETE_TABS (Dashboard + 6 moduli) → identici
 * a quelli dell'atleta. Autorizzazione e barra contestuale nel layout a monte.
 */
export default function CoachSelectedAthleteModulePage({ params }: PageProps) {
  const tab = SCOPED_ATHLETE_TABS.find((x) => x.module === params.module);
  if (!tab) notFound();
  return <ScopedAthleteModuleView module={tab.module} athleteId={params.athleteId} scope="coach" />;
}
