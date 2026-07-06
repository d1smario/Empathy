import type { Metadata } from "next";
import { Suspense } from "react";
import TrainingCalendarTableView from "@/modules/training/views/calendar/TrainingCalendarTableView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Training · Calendario",
  description: "Le tue attività per giorno — clicca per aprire la seduta.",
};

// Stessa vista del desktop (stessi concetti): la tabella diventa lista di card
// su schermo stretto. Il confinamento coach → roster è nel layout /m/training.
export default function MobileTrainingCalendarPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] animate-pulse rounded-2xl bg-white/5" />}>
      <div className="mx-auto max-w-lg px-2 pb-4 pt-2">
        <TrainingCalendarTableView />
      </div>
    </Suspense>
  );
}
