import type { Metadata } from "next";
import { redirectCoachToRoster } from "@/lib/auth/redirect-coach-to-roster";
import TrainingHubPageView from "@/modules/training/views/TrainingHubPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Training · Hub",
  description: "Training hub — Builder, Calendar, Analyzer, Virya.",
};

export default async function TrainingHubPage() {
  await redirectCoachToRoster();
  return <TrainingHubPageView />;
}
