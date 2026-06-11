"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ActiveAthleteScopeProvider } from "@/lib/use-active-athlete";

/**
 * Dispatcher condiviso delle schede atleta scoped (admin /admin/utenti/[id]/* e
 * coach /athletes/[id]/*): monta la vista modulo dentro lo scope imposto
 * dall'URL (ActiveAthleteScopeProvider). next/dynamic: un chunk per modulo.
 *
 * `scope` distingue il chiamante: in scope COACH la scheda training monta il
 * CALENDARIO (lo strumento di lavoro) invece dell'hub di link, che con la
 * navigazione cross-shell disattivata sarebbe una pagina morta (audit B2).
 */
const LOADING = (
  <div className="px-6 py-16 text-center font-mono text-[0.65rem] uppercase tracking-[0.3em] text-gray-600">
    Caricamento modulo…
  </div>
);

const TrainingHubPageView = dynamic(() => import("@/modules/training/views/TrainingHubPageView"), { ssr: false, loading: () => LOADING });
const TrainingCalendarPageView = dynamic(() => import("@/modules/training/views/TrainingCalendarPageView"), { ssr: false, loading: () => LOADING });
const BioenergeticsPageView = dynamic(() => import("@/modules/bioenergetics/views/BioenergeticsPageView"), { ssr: false, loading: () => LOADING });
const LongevityFitnessPageView = dynamic(() => import("@/modules/longevity/views/LongevityFitnessPageView"), { ssr: false, loading: () => LOADING });
const HealthPageView = dynamic(() => import("@/modules/health/views/HealthPageView"), { ssr: false, loading: () => LOADING });
const BiomechanicsPageView = dynamic(() => import("@/modules/biomechanics/views/BiomechanicsPageView"), { ssr: false, loading: () => LOADING });
const AerodynamicsPageView = dynamic(() => import("@/modules/aerodynamics/views/AerodynamicsPageView"), { ssr: false, loading: () => LOADING });
const NutritionPageView = dynamic(() => import("@/modules/nutrition/views/NutritionPageView"), { ssr: false, loading: () => LOADING });
const PhysiologyPageView = dynamic(() => import("@/modules/physiology/views/PhysiologyPageView"), { ssr: false, loading: () => LOADING });

const VIEWS: Record<string, ComponentType> = {
  training: TrainingHubPageView,
  bioenergetics: BioenergeticsPageView,
  longevity: LongevityFitnessPageView,
  health: HealthPageView,
  biomechanics: BiomechanicsPageView,
  aerodynamics: AerodynamicsPageView,
  physiology: PhysiologyPageView,
};

export function ScopedAthleteModuleView({
  module,
  athleteId,
  scope = "admin",
}: {
  module: string;
  athleteId: string;
  scope?: "admin" | "coach";
}) {
  let content: React.ReactNode = null;
  if (module === "nutrition") {
    content = <NutritionPageView subRoute="meal-plan" />;
  } else if (module === "training" && scope === "coach") {
    content = <TrainingCalendarPageView />;
  } else {
    const View = VIEWS[module];
    if (!View) return null;
    content = <View />;
  }
  return <ActiveAthleteScopeProvider athleteId={athleteId}>{content}</ActiveAthleteScopeProvider>;
}
