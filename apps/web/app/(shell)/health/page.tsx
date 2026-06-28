import type { Metadata } from "next";
import { redirectCoachToRoster } from "@/lib/auth/redirect-coach-to-roster";
import HealthPageView from "@/modules/health/views/HealthPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Health & Bio",
  description: "Import esami, archivio laboratorio, trend e memoria atleta.",
};

export default async function HealthPage() {
  await redirectCoachToRoster();
  return <HealthPageView />;
}
