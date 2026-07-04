import { redirect } from "next/navigation";

/** Assorbita in «Oggi» (riorganizzazione menù 2026-07): redirect per i deep-link storici. */
export default function MobileNutritionDiaryPage() {
  redirect("/m/nutrition/today");
}
