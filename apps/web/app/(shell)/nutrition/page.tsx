import { redirect } from "next/navigation";

/**
 * Riorganizzazione menù nutrition (2026-07, «per momento d'uso»): l'ingresso nel
 * modulo atterra su «Oggi» (rifornimento + diario del giorno), non più sul meal plan.
 */
export default function NutritionIndexPage() {
  redirect("/nutrition/today");
}
