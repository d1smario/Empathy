"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ActiveAthleteScopeProvider } from "@/lib/use-active-athlete";

/**
 * Dispatcher delle schede atleta scoped per la shell MOBILE coach
 * (/m/athletes/[id]/[module]): monta la vista dentro lo scope imposto dall'URL
 * (ActiveAthleteScopeProvider scope="coach"), preferendo le viste MOBILI dove
 * esistono (Dashboard) e riusando le viste desktop dei moduli senza variante mobile.
 * Gemello mobile di ScopedAthleteModuleView (desktop).
 */
const LOADING = (
  <div className="px-6 py-16 text-center font-mono text-[0.65rem] uppercase tracking-[0.3em] text-gray-600">
    Loading module…
  </div>
);

const MobileDashboardView = dynamic(
  () => import("@/modules/mobile/views/MobileDashboardView").then((m) => m.MobileDashboardView),
  { ssr: false, loading: () => LOADING },
);
const TrainingCalendarPageView = dynamic(() => import("@/modules/training/views/TrainingCalendarPageView"), { ssr: false, loading: () => LOADING });
const NutritionPageView = dynamic(() => import("@/modules/nutrition/views/NutritionPageView"), { ssr: false, loading: () => LOADING });
const HealthPageView = dynamic(() => import("@/modules/health/views/HealthPageView"), { ssr: false, loading: () => LOADING });
const PhysiologyPageView = dynamic(() => import("@/modules/physiology/views/PhysiologyPageView"), { ssr: false, loading: () => LOADING });
const BiomechanicsPageView = dynamic(() => import("@/modules/biomechanics/views/BiomechanicsPageView"), { ssr: false, loading: () => LOADING });
const AerodynamicsPageView = dynamic(() => import("@/modules/aerodynamics/views/AerodynamicsPageView"), { ssr: false, loading: () => LOADING });

// Bioenergetica/Longevity sono dentro la Dashboard (come desktop): niente scheda dedicata.
const VIEWS: Record<string, ComponentType> = {
  dashboard: MobileDashboardView,
  training: TrainingCalendarPageView,
  health: HealthPageView,
  physiology: PhysiologyPageView,
  biomechanics: BiomechanicsPageView,
  aerodynamics: AerodynamicsPageView,
};

export function MobileScopedAthleteModuleView({ module, athleteId }: { module: string; athleteId: string }) {
  let content: React.ReactNode = null;
  if (module === "nutrition") {
    // In scope coach montiamo il meal-plan (come desktop): l'hub di link mobile sarebbe
    // pagina morta dentro lo scope.
    content = <NutritionPageView subRoute="meal-plan" />;
  } else {
    const View = VIEWS[module];
    if (!View) return null;
    content = <View />;
  }
  return (
    <ActiveAthleteScopeProvider athleteId={athleteId} scope="coach">
      {content}
    </ActiveAthleteScopeProvider>
  );
}
