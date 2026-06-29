import type { Metadata } from "next";
import { Suspense } from "react";
import TrainingCalendarPageView from "@/modules/training/views/TrainingCalendarPageView";
import { redirectCoachToMobileRoster } from "@/lib/auth/redirect-coach-to-mobile-roster";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Training · Calendar",
  description: "Calendario operativo — app mobile.",
};

export default async function MobileTrainingCalendarPage() {
  await redirectCoachToMobileRoster();
  return (
    <Suspense fallback={<div className="min-h-[40vh] animate-pulse rounded-2xl bg-white/5" />}>
      <div className="mx-auto max-w-lg px-2 pb-4 pt-2">
        <TrainingCalendarPageView />
      </div>
    </Suspense>
  );
}
