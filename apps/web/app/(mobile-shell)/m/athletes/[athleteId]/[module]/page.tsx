import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MobileScopedAthleteModuleView } from "@/components/athlete-scope/MobileScopedAthleteModuleView";
import { SCOPED_ATHLETE_TABS } from "@/core/navigation/module-registry";

export const dynamic = "force-dynamic";

type PageProps = { params: { athleteId: string; module: string } };

export function generateMetadata({ params }: PageProps): Metadata {
  const tab = SCOPED_ATHLETE_TABS.find((x) => x.module === params.module);
  return { title: tab ? `${tab.label} · Atleta` : "Atleta" };
}

/**
 * Scheda modulo dell'atleta selezionato dal coach nella shell MOBILE. Tab da
 * SCOPED_ATHLETE_TABS (Dashboard + 6 moduli) → identici a desktop/atleta. Gate e
 * barra contestuale dal layout. Le viste sono montate in scope coach dal dispatcher.
 */
export default function MobileCoachSelectedAthleteModulePage({ params }: PageProps) {
  const tab = SCOPED_ATHLETE_TABS.find((x) => x.module === params.module);
  if (!tab) notFound();
  return <MobileScopedAthleteModuleView module={tab.module} athleteId={params.athleteId} />;
}
