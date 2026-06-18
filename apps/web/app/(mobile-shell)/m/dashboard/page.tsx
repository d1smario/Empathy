import type { Metadata } from "next";
import { MobileDashboardView } from "@/modules/mobile/views/MobileDashboardView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Human Performance Operating System",
};

export default function MobileDashboardPage() {
  return <MobileDashboardView />;
}
