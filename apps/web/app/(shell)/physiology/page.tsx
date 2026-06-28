import type { Metadata } from "next";
import { redirectCoachToRoster } from "@/lib/auth/redirect-coach-to-roster";
import PhysiologyPageView from "@/modules/physiology/views/PhysiologyPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Physiology",
  description: "Metabolic Lab — CP, lactate, max oxidation (deterministic engines).",
};

export default async function PhysiologyPage() {
  await redirectCoachToRoster();
  return <PhysiologyPageView />;
}
