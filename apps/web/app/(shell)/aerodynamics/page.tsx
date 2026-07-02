import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { redirectCoachToRoster } from "@/lib/auth/redirect-coach-to-roster";
import AerodynamicsPageView from "@/modules/aerodynamics/views/AerodynamicsPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aerodynamics",
  description: "Capture photos and videos for the Pro 2 aerodynamics pipeline with deterministic CdA.",
};

export default async function AerodynamicsPage() {
  await redirectCoachToRoster();
  const t = await getTranslations("AerodynamicsPage");
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-gray-400">{t("loading")}</div>
      }
    >
      <AerodynamicsPageView />
    </Suspense>
  );
}
