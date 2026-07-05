import type { Metadata } from "next";
import MobileNutritionHubView from "@/modules/mobile/views/MobileNutritionHubView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nutrition",
  description: "Meal plan with intake log and hydration — mobile app.",
};

// Il confinamento coach → roster è nel layout (copre indice + meal-plan).
export default function MobileNutritionPage() {
  return <MobileNutritionHubView />;
}
