import { redirect } from "next/navigation";

/** Strumenti eliminato (2026-07): integratori e previsione vivono nel Piano, bioenergetica in Physiology. */
export default function NutritionRedirectPage() {
  redirect("/nutrition/meal-plan");
}
