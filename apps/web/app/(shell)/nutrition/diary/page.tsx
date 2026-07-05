import { redirect } from "next/navigation";

/** DIARIO eliminato (2026-07): registro, conferme e idratazione vivono nel Piano. Redirect per i deep-link storici. */
export default function NutritionDiaryPage() {
  redirect("/nutrition/meal-plan");
}
