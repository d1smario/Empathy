import type { Metadata } from "next";
import MobileNutritionHubView from "@/modules/mobile/views/MobileNutritionHubView";
import { redirectCoachToMobileRoster } from "@/lib/auth/redirect-coach-to-mobile-roster";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nutrition",
  description: "Meal plan e diario — app mobile.",
};

export default async function MobileNutritionPage() {
  await redirectCoachToMobileRoster();
  return <MobileNutritionHubView />;
}
