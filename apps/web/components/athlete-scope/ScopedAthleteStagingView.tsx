"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ActiveAthleteScopeProvider } from "@/lib/use-active-athlete";

/**
 * Dispatcher delle viste staging/review scoped — coach (/athletes/[id]/[module]/staging/[runId])
 * E admin (/admin/utenti/[userId]/[module]/staging/[runId]): monta la review nello scope
 * dell'atleta imposto dall'URL (ActiveAthleteScopeProvider) così la vista risolve il giusto
 * athleteId e i back-link/CTA restano dentro la scheda, invece di uscire nella shell globale
 * (audit lato coach B3 + parità admin). In scope admin si passa scopeOwnerUserId per ricostruire
 * gli href admin (le rotte admin sono chiavate su userId, non athleteId).
 */
const LOADING = (
  <div className="px-6 py-16 text-center font-mono text-[0.65rem] uppercase tracking-[0.3em] text-gray-600">
    Loading review…
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
  scopeOwnerUserId = null,
}: {
  module: string;
  athleteId: string;
  runId: string;
  scope?: "admin" | "coach";
  /** userId dell'utente selezionato (scope admin): per ricostruire gli href admin. */
  scopeOwnerUserId?: string | null;
}) {
  const View = STAGING_VIEWS[module];
  if (!View) return null;
  return (
    <ActiveAthleteScopeProvider athleteId={athleteId} scope={scope} scopeOwnerUserId={scopeOwnerUserId}>
      <View runId={runId} />
    </ActiveAthleteScopeProvider>
  );
}
