import type { Metadata } from "next";
import BiomechanicsStagingReviewView from "@/modules/biomechanics/views/BiomechanicsStagingReviewView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review biomeccanica · Biomechanics",
  description: "Revisione della cattura prima della conferma.",
};

export default function BiomechanicsStagingPage({ params }: { params: { id: string } }) {
  return <BiomechanicsStagingReviewView runId={params.id} />;
}
