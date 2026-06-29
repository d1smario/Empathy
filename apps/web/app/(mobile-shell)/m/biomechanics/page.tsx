import type { Metadata } from "next";
import BiomechanicsPageView from "@/modules/biomechanics/views/BiomechanicsPageView";
import { redirectCoachToMobileRoster } from "@/lib/auth/redirect-coach-to-mobile-roster";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Biomechanics",
};

export default async function MobileBiomechanicsPage() {
  await redirectCoachToMobileRoster();
  return <BiomechanicsPageView />;
}
