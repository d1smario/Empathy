"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ActiveAthleteScopeProvider } from "@/lib/use-active-athlete";

/**
 * Dispatcher condiviso delle schede atleta scoped (admin /admin/utenti/[id]/* e
 * coach /athletes/[id]/*): monta la vista modulo dentro lo scope imposto
 * dall'URL (ActiveAthleteScopeProvider). next/dynamic: un chunk per modulo.
 *
 * In scope (coach E admin) la scheda training monta il CALENDARIO (lo strumento
 * di lavoro) invece dell'hub di link: con la navigazione cross-shell disattivata
 * l'hub sarebbe una pagina morta di link inerti (audit B2). L'hub resta solo per
 * l'atleta sul proprio /training (provider globale, adminScoped=false).
 */
const LOADING = (
  <div className="px-6 py-16 text-center font-mono text-[0.65rem] uppercase tracking-[0.3em] text-gray-600">
    Caricamento modulo…
  </div>
);

const NewDashboardView = dynamic(
  () => import("@/components/dashboard/NewDashboardView").then((m) => m.NewDashboardView),
  { ssr: false, loading: () => LOADING },
);
const TrainingHubPageView = dynamic(() => import("@/modules/training/views/TrainingHubPageView"), { ssr: false, loading: () => LOADING });
const TrainingCalendarPageView = dynamic(() => import("@/modules/training/views/TrainingCalendarPageView"), { ssr: false, loading: () => LOADING });
const HealthPageView = dynamic(() => import("@/modules/health/views/HealthPageView"), { ssr: false, loading: () => LOADING });
const BiomechanicsPageView = dynamic(() => import("@/modules/biomechanics/views/BiomechanicsPageView"), { ssr: false, loading: () => LOADING });
const AerodynamicsPageView = dynamic(() => import("@/modules/aerodynamics/views/AerodynamicsPageView"), { ssr: false, loading: () => LOADING });
const NutritionPageView = dynamic(() => import("@/modules/nutrition/views/NutritionPageView"), { ssr: false, loading: () => LOADING });
const PhysiologyPageView = dynamic(() => import("@/modules/physiology/views/PhysiologyPageView"), { ssr: false, loading: () => LOADING });

// Bioenergetica e Longevity NON sono schede a sé: l'atleta le vede dentro la Dashboard
// (strisce/pannelli in NewDashboardView), quindi coach e admin le vedono lì pure.
const VIEWS: Record<string, ComponentType> = {
  dashboard: NewDashboardView,
  training: TrainingHubPageView,
  health: HealthPageView,
  biomechanics: BiomechanicsPageView,
  aerodynamics: AerodynamicsPageView,
  physiology: PhysiologyPageView,
};

export function ScopedAthleteModuleView({
  module,
  athleteId,
  scope = "admin",
  scopeOwnerUserId = null,
}: {
  module: string;
  athleteId: string;
  scope?: "admin" | "coach";
  /** userId dell'utente selezionato (scope admin): per ricostruire gli href admin. */
  scopeOwnerUserId?: string | null;
}) {
  let content: React.ReactNode = null;
  if (module === "nutrition") {
    content = <NutritionPageView subRoute="meal-plan" />;
  } else if (module === "training") {
    content = <TrainingCalendarPageView />;
  } else {
    const View = VIEWS[module];
    if (!View) return null;
    content = <View />;
  }
  return (
    <ActiveAthleteScopeProvider athleteId={athleteId} scope={scope} scopeOwnerUserId={scopeOwnerUserId}>
      {content}
    </ActiveAthleteScopeProvider>
  );
}
