import { redirect } from "next/navigation";

/**
 * Split prescrittivo/consuntivo (2026-07): si atterra sul PIANO («cosa mangiare»:
 * target, pasti e protocollo rifornimento); il Diario serve a segnare il consumato.
 */
export default function NutritionIndexPage() {
  redirect("/nutrition/meal-plan");
}
