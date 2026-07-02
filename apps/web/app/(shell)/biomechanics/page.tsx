import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { redirectCoachToRoster } from "@/lib/auth/redirect-coach-to-roster";
import BiomechanicsPageView from "@/modules/biomechanics/views/BiomechanicsPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Biomechanics",
  description: "Video and photo capture for the Pro 2 biomechanics pipeline with staging and biomechanical twin.",
};

export default async function BiomechanicsPage() {
  await redirectCoachToRoster();
  const t = await getTranslations("BiomechanicsPage");
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-gray-400">{t("loading")}</div>
      }
    >
      <BiomechanicsPageView />
    </Suspense>
  );
}
