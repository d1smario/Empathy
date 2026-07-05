import { redirect } from "next/navigation";

/** Il fueling vive nel Piano (Diario eliminato 2026-07): redirect diretto, niente doppio salto. */
export default function MobileNutritionFuelingPage() {
  redirect("/m/nutrition/meal-plan");
}
