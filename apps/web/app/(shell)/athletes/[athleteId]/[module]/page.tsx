import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScopedAthleteModuleView } from "@/components/athlete-scope/ScopedAthleteModuleView";
import { PRODUCT_MODULE_NAV } from "@/core/navigation/module-registry";

export const dynamic = "force-dynamic";

type PageProps = { params: { athleteId: string; module: string } };

const ATHLETE_MODULES = PRODUCT_MODULE_NAV.filter((m) => m.scope === "athlete");

export function generateMetadata({ params }: PageProps): Metadata {
  const m = ATHLETE_MODULES.find((x) => x.module === params.module);
  return { title: m ? `${m.label} · Atleta` : "Atleta" };
}

/**
 * Scheda modulo dell'atleta selezionato dal coach: stessa vista e stesso
 * dispatcher delle schede admin (ScopedAthleteModuleView), scope dall'URL.
 * Autorizzazione e barra contestuale nel layout a monte.
 */
export default function CoachSelectedAthleteModulePage({ params }: PageProps) {
  const moduleItem = ATHLETE_MODULES.find((x) => x.module === params.module);
  if (!moduleItem) notFound();
  return <ScopedAthleteModuleView module={moduleItem.module} athleteId={params.athleteId} scope="coach" />;
}
