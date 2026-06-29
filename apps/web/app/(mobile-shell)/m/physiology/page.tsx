import type { Metadata } from "next";
import PhysiologyPageView from "@/modules/physiology/views/PhysiologyPageView";
import { redirectCoachToMobileRoster } from "@/lib/auth/redirect-coach-to-mobile-roster";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Physiology",
};

export default async function MobilePhysiologyPage() {
  await redirectCoachToMobileRoster();
  return <PhysiologyPageView />;
}
