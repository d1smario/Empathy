import type { Metadata } from "next";
import { MobileDashboardView } from "@/modules/mobile/views/MobileDashboardView";
import { redirectCoachToMobileRoster } from "@/lib/auth/redirect-coach-to-mobile-roster";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Human Performance Operating System",
};

export default async function MobileDashboardPage() {
  await redirectCoachToMobileRoster();
  return <MobileDashboardView />;
}
