import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Activity, ArrowUpRight, Layers, Pill } from "lucide-react";
import { NutritionSubnav } from "@/components/nutrition/NutritionSubnav";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nutrition · Tools",
};

/**
 * «Strumenti»: hub delle viste analitiche del modulo nutrition (riorganizzazione
 * menù 2026-07). Previsione e Integratori mantengono le loro pagine; Bioenergetica
 * è un rimando esplicito al modulo Physiology (non più una pillola del subnav che
 * teletrasportava fuori modulo senza preavviso).
 */
export default async function NutritionToolsPage() {
  const t = await getTranslations("NutritionToolsPage");

  const cardClass =
    "flex items-start gap-4 rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:border-amber-400/40 hover:bg-black/40";

  return (
    <Pro2ModulePageShell
      eyebrow={t("eyebrow")}
      eyebrowClassName="text-amber-400"
      title={t("title")}
      description={<span className="text-gray-400">{t("description")}</span>}
    >
      <section className="viz-card builder-panel space-y-4" style={{ marginBottom: "12px" }}>
        <NutritionSubnav />
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/nutrition/predictor" className={cardClass}>
          <Activity className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" aria-hidden />
          <div>
            <p className="font-semibold text-white">{t("predictorTitle")}</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">{t("predictorSubtitle")}</p>
          </div>
        </Link>
        <Link href="/nutrition/integration" className={cardClass}>
          <Pill className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" aria-hidden />
          <div>
            <p className="font-semibold text-white">{t("integrationTitle")}</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">{t("integrationSubtitle")}</p>
          </div>
        </Link>
        <Link href="/physiology/bioenergetics" className={cardClass}>
          <Layers className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" aria-hidden />
          <div>
            <p className="flex items-center gap-1 font-semibold text-white">
              {t("bioenergeticsTitle")}
              <ArrowUpRight className="h-3.5 w-3.5 text-gray-500" aria-hidden />
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">{t("bioenergeticsSubtitle")}</p>
          </div>
        </Link>
      </div>
    </Pro2ModulePageShell>
  );
}
