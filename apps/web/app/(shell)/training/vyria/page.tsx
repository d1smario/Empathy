import type { Metadata } from "next";
import TrainingViryaPageView from "@/modules/training/views/TrainingViryaPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Training · Virya",
  description: "Virya — periodizzazione stagionale di lungo periodo. Coach/admin.",
};

/**
 * Virya: vista di lungo periodo dello strumento di programmazione. Il coach la
 * raggiunge dalla scheda atleta (tab «Virya» in ScopedTrainingTabs); questa rotta
 * account-level resta viva per lo staff. La gate coach/admin vive nella view
 * (l'atleta viene rimandato al Calendario).
 */
export default function TrainingViryaPage() {
  return <TrainingViryaPageView />;
}
