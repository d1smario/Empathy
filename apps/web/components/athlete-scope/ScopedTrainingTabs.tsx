"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { BarChart3, CalendarDays, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

const LOADING = (
  <div className="px-6 py-16 text-center font-mono text-[0.65rem] uppercase tracking-[0.3em] text-gray-600">
    Loading…
  </div>
);
const TrainingCalendarTableView = dynamic(
  () => import("@/modules/training/views/calendar/TrainingCalendarTableView"),
  { ssr: false, loading: () => LOADING },
);
const TrainingBuilderRichPageView = dynamic(
  () => import("@/modules/training/views/TrainingBuilderRichPageView"),
  { ssr: false, loading: () => LOADING },
);
const TrainingAnalyticsPageView = dynamic(
  () => import("@/modules/training/views/TrainingAnalyticsPageView"),
  { ssr: false, loading: () => LOADING },
);

type ScopedTrainingTab = "calendar" | "builder" | "analyzer";

const TABS: { key: ScopedTrainingTab; label: string; Icon: typeof CalendarDays }[] = [
  { key: "calendar", label: "Calendario", Icon: CalendarDays },
  { key: "builder", label: "Builder", Icon: Sparkles },
  { key: "analyzer", label: "Analyzer", Icon: BarChart3 },
];

/**
 * Navigazione Training scope-aware per la scheda atleta del coach/admin
 * (`/athletes/[id]/training`). Monta Calendario/Builder/Analyzer DENTRO lo scope
 * atleta (provider a monte in ScopedAthleteModuleView) tramite stato locale, senza
 * navigare a rotte globali `/training/*` che perderebbero l'atleta. Così il Builder
 * costruisce per l'atleta selezionato e salva sul suo calendario (scrittura coach
 * già autorizzata da `canAccessAthleteData`). Le viste nascondono la propria
 * TrainingSubnav quando `adminScoped`, per non duplicare la navigazione.
 */
export function ScopedTrainingTabs() {
  const [tab, setTab] = useState<ScopedTrainingTab>("calendar");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-2">
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
                active
                  ? "bg-gradient-to-r from-fuchsia-500/25 to-orange-500/25 text-white shadow-inner"
                  : "text-gray-400 hover:bg-white/[0.05] hover:text-gray-200",
              )}
              aria-pressed={active}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
      {tab === "calendar" ? (
        <TrainingCalendarTableView />
      ) : tab === "builder" ? (
        <TrainingBuilderRichPageView />
      ) : (
        <TrainingAnalyticsPageView />
      )}
    </div>
  );
}
