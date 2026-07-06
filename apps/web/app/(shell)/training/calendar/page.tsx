import type { Metadata } from "next";
import { Suspense } from "react";
import TrainingCalendarTableView from "@/modules/training/views/calendar/TrainingCalendarTableView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Training · Calendario",
  description: "Le tue attività per giorno — clicca per aprire la seduta.",
};

export default function TrainingCalendarPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] animate-pulse rounded-2xl bg-white/5" />}>
      <TrainingCalendarTableView />
    </Suspense>
  );
}
