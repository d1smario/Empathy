import type { Metadata } from "next";
import TrainingViryaPageView from "@/modules/training/views/TrainingViryaPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Training · Piano",
  description: "Piano — periodizzazione stagionale (vista lungo periodo del Builder). Coach/admin.",
};

/**
 * «Piano» (ex Virya): vista di lungo periodo dello strumento di programmazione,
 * gemella del Builder «Giorno». Riattivata il 2026-07 dopo il redirect temporaneo.
 * La gate coach/admin vive nella view (l'atleta viene rimandato al Calendario).
 */
export default function TrainingPianoPage() {
  return <TrainingViryaPageView />;
}
