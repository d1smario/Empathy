import type { Metadata } from "next";
import PhysiologyDailyWellnessPageView from "@/modules/physiology/views/PhysiologyDailyWellnessPageView";

export const dynamic = "force-dynamic";

type PageProps = { params: { date: string } };

export function generateMetadata({ params }: PageProps): Metadata {
  const d = params.date ?? "";
  return {
    title: d ? `Physiology · Day ${d}` : "Physiology · Day",
    description: "Daily panel: recovery, sleep, activity and biomarkers aligned with the calendar.",
  };
}

export default function PhysiologyDailyPage() {
  return <PhysiologyDailyWellnessPageView />;
}
