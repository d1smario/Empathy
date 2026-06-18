"use client";

/**
 * Dashboard desktop — Human Performance Operating System.
 *
 * Usa i componenti condivisi `DashboardKpiGrid`, `DashboardSystemStatus`,
 * `DashboardTwinRadial` e l'hook `useDashboardScores`.
 */

import { DashboardTwinRadial } from "@/components/dashboard/DashboardTwinRadial";
import { DashboardReadinessHeader } from "@/components/dashboard/DashboardReadinessHeader";
import { DashboardKpiGrid } from "@/components/dashboard/DashboardKpiGrid";
import { DashboardSystemStatus } from "@/components/dashboard/DashboardSystemStatus";
import { DashboardLongevityPanels } from "@/components/dashboard/DashboardLongevityPanels";
import { DashboardBioenergeticStrip } from "@/components/dashboard/DashboardBioenergeticStrip";
import { useDashboardScores } from "@/lib/dashboard/use-dashboard-scores";
import { useActiveAthlete } from "@/lib/use-active-athlete";

const EMPTY_KPIS = {
  weightKg: null,
  bodyFatPct: null,
  vo2max: null,
  ftpWatts: null,
  lt1Watts: null,
  lt2Watts: null,
  vLamax: null,
  biologicalAge: null,
  targetAge: null,
};

export function NewDashboardView() {
  const { athleteId, role, loading: athleteLoading } = useActiveAthlete();
  const { data, loading, error } = useDashboardScores();

  if (!athleteId && !athleteLoading) {
    return (
      <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-gray-400">
        {role === "coach" ? "Seleziona un atleta attivo per vedere la dashboard." : "Profilo atleta non disponibile."}
      </p>
    );
  }

  if (loading && !data) {
    return (
      <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-gray-500">
        Caricamento dashboard…
      </p>
    );
  }

  if (error && !data) {
    return (
      <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100" role="alert">
        {error}
      </p>
    );
  }

  const systemStatus = data?.systemStatus ?? { pct: null, label: null, trend: [] };

  return (
    <div className="space-y-10">
      {/* CORPO + AREE: umanoide point-cloud con i 9 contatori ad arco. */}
      <section aria-label="Aree fisiologiche" className="relative">
        <div className="absolute right-0 top-0 z-10">
          <DashboardReadinessHeader />
        </div>
        <DashboardTwinRadial areas={data?.areas ?? []} />
      </section>

      {/* STRISCIA 24 H: box Bioenergetica della giornata (ex modulo /bioenergetics) */}
      <section aria-label="Striscia 24 h">
        <DashboardBioenergeticStrip />
      </section>

      {/* PROFILO FISIOLOGICO */}
      <section aria-label="Profilo fisiologico">
        <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Profilo fisiologico</p>
        <DashboardKpiGrid kpis={data?.kpis ?? EMPTY_KPIS} columns={3} />
      </section>

      {/* HUMAN SYSTEM STATUS */}
      <section aria-label="Human System Status">
        <DashboardSystemStatus pct={systemStatus.pct} label={systemStatus.label} trend={systemStatus.trend} />
      </section>

      {/* LONGEVITÀ & FITNESS: check-in di oggi + indice (ex modulo /longevity) */}
      <section aria-label="Longevità & Fitness">
        <DashboardLongevityPanels />
      </section>
    </div>
  );
}
