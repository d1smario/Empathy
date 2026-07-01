"use client";

import { useDashboardScores } from "@/lib/dashboard/use-dashboard-scores";
import { MobileHeroSection } from "@/modules/mobile/components/MobileHeroSection";
import { MobileTwinSection } from "@/modules/mobile/components/MobileTwinSection";
import { MobileTrendsSection } from "@/modules/mobile/components/MobileTrendsSection";
import { MobileProfileSection } from "@/modules/mobile/components/MobileProfileSection";
import { DashboardSystemStatus } from "@/components/dashboard/DashboardSystemStatus";
import { DashboardBioenergeticStrip } from "@/components/dashboard/DashboardBioenergeticStrip";
import { DashboardLongevityPanels } from "@/components/dashboard/DashboardLongevityPanels";
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

export function MobileDashboardView() {
  const { athleteId, role, loading: athleteLoading } = useActiveAthlete();
  const { data, loading, error } = useDashboardScores();

  if (!athleteId && !athleteLoading) {
    return (
      <div className="px-4 py-6">
        <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-gray-400">
          {role === "coach" ? "Select an active athlete to view the dashboard." : "Athlete profile not available."}
        </p>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="px-4 py-6">
        <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-gray-500">
          Loading dashboard…
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="px-4 py-6">
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100" role="alert">
          {error}
        </p>
      </div>
    );
  }

  const readiness = data?.readiness ?? { score: null, label: null };
  const systemStatus = data?.systemStatus ?? { pct: null, label: null, trend: [] };

  return (
    <div className="relative min-h-screen bg-black px-4 pb-28 pt-4">
      <div className="space-y-6">
        <MobileHeroSection score={readiness.score} label={readiness.label} />
        <MobileTwinSection areas={data?.areas ?? []} />
        <DashboardBioenergeticStrip lite />
        <MobileTrendsSection areas={data?.areas ?? []} />
        <MobileProfileSection kpis={data?.kpis ?? EMPTY_KPIS} />
        <DashboardSystemStatus pct={systemStatus.pct} label={systemStatus.label} trend={systemStatus.trend} />
        <DashboardLongevityPanels />
      </div>
    </div>
  );
}
