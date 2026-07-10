"use client";

import dynamic from "next/dynamic";
import { ActiveAthleteScopeProvider } from "@/lib/use-active-athlete";

/**
 * Dettaglio seduta del giorno nello scope dell'atleta selezionato (coach
 * /athletes/[id]/training/session/[date] e admin /admin/utenti/[userId]/...).
 * Stesso pattern di ScopedAthleteStagingView: la vista riusata legge athleteId
 * dal provider e la data da useParams (il segmento [date] è identico alla rotta
 * globale /training/session/[date]).
 */
const LOADING = (
  <div className="px-6 py-16 text-center font-mono text-[0.65rem] uppercase tracking-[0.3em] text-gray-600">
    Loading session…
  </div>
);

const TrainingSessionPageView = dynamic(() => import("@/modules/training/views/TrainingSessionPageView"), {
  ssr: false,
  loading: () => LOADING,
});

export function ScopedAthleteSessionView({
  athleteId,
  scope = "coach",
  scopeOwnerUserId = null,
}: {
  athleteId: string;
  scope?: "admin" | "coach";
  /** userId dell'utente selezionato (scope admin): per ricostruire gli href admin. */
  scopeOwnerUserId?: string | null;
}) {
  return (
    <ActiveAthleteScopeProvider athleteId={athleteId} scope={scope} scopeOwnerUserId={scopeOwnerUserId}>
      <TrainingSessionPageView />
    </ActiveAthleteScopeProvider>
  );
}
