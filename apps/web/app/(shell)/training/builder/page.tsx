import type { Metadata } from "next";
import { Suspense } from "react";
import TrainingBuilderRichPageView from "@/modules/training/views/TrainingBuilderRichPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Training · Builder",
  description: "Session builder — dense Pro 2 view (calendar data + gradual V1 engine import).",
};

function BuilderRouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6 text-sm text-gray-400">
      Loading builder…
    </div>
  );
}

export default function TrainingBuilderPage() {
  return (
    <Suspense fallback={<BuilderRouteFallback />}>
      <TrainingBuilderRichPageView />
    </Suspense>
  );
}
