import type { Metadata } from "next";
import { Suspense } from "react";
import nextDynamic from "next/dynamic";

const NutritionPageView = nextDynamic(() => import("@/modules/nutrition/views/NutritionPageView"), {
  loading: () => <div className="min-h-[40vh] animate-pulse rounded-2xl bg-white/5" aria-hidden />,
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nutrition",
  description: "Meal plan atleta — app mobile.",
};

// Nutrition apre DIRETTAMENTE il Piano: niente hub intermedio (feedback 2026-07).
// Il confinamento coach → roster resta nel layout (copre indice + meal-plan).
export default function MobileNutritionPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] animate-pulse rounded-2xl bg-white/5" />}>
      <div className="mx-auto max-w-lg px-3 pb-6 pt-3">
        <NutritionPageView subRoute="meal-plan" />
      </div>
    </Suspense>
  );
}
