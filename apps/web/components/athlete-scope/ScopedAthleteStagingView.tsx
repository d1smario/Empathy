"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ActiveAthleteScopeProvider } from "@/lib/use-active-athlete";

/**
 * Dispatcher delle viste staging/review scoped (coach /athletes/[id]/[module]/staging/[runId]):
 * monta la review nello scope dell'atleta imposto dall'URL (ActiveAthleteScopeProvider) così la
 * vista risolve il giusto athleteId e i back-link restano dentro la scheda atleta, invece di
 * uscire nella shell globale del coach (audit lato coach B3).
 */
const LOADING = (
  <div className="px-6 py-16 text-center font-mono text-[0.65rem] uppercase tracking-[0.3em] text-gray-600">
    Caricamento review…
  </div>
);

const HealthStagingReviewView = dynamic(() => import("@/modules/health/views/HealthStagingReviewView"), { ssr: false, loading: () => LOADING });
const BiomechanicsStagingReviewView = dynamic(() => import("@/modules/biomechanics/views/BiomechanicsStagingReviewView"), { ssr: false, loading: () => LOADING });
const AerodynamicsStagingReviewView = dynamic(() => import("@/modules/aerodynamics/views/AerodynamicsStagingReviewView"), { ssr: false, loading: () => LOADING });

const STAGING_VIEWS: Record<string, ComponentType<{ runId: string }>> = {
  health: HealthStagingReviewView,
  biomechanics: BiomechanicsStagingReviewView,
  aerodynamics: AerodynamicsStagingReviewView,
};

export function ScopedAthleteStagingView({
  module,
  athleteId,
  runId,
  scope = "coach",
}: {
  module: string;
  athleteId: string;
  runId: string;
  scope?: "admin" | "coach";
}) {
  const View = STAGING_VIEWS[module];
  if (!View) return null;
  return (
    <ActiveAthleteScopeProvider athleteId={athleteId} scope={scope}>
      <View runId={runId} />
    </ActiveAthleteScopeProvider>
  );
}
