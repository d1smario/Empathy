import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MobileDashboardView } from "@/modules/mobile/views/MobileDashboardView";
import { getSessionProfile } from "@/lib/auth/session-profile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analisi",
  description: "Twin, KPI, trend e predizioni",
};

export default async function MobileAnalysisPage() {
  const session = await getSessionProfile();
  if (session.role !== "private") {
    redirect("/m/dashboard");
  }
  return <MobileDashboardView />;
}
