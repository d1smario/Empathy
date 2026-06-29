import type { Metadata } from "next";
import HealthPageView from "@/modules/health/views/HealthPageView";
import { redirectCoachToMobileRoster } from "@/lib/auth/redirect-coach-to-mobile-roster";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Health & Bio",
  description: "Import esami, archivio laboratorio, trend e memoria atleta.",
};

export default async function MobileHealthPage() {
  await redirectCoachToMobileRoster();
  return <HealthPageView />;
}
