"use client";

/**
 * Header readiness ("Il tuo punteggio") per il titolo pagina della dashboard.
 *
 * Usa `DashboardReadinessRing` condiviso e l'hook `useDashboardScores`.
 */

import { useTranslations } from "next-intl";

import { DashboardReadinessRing } from "@/components/dashboard/DashboardReadinessRing";
import { useDashboardScores } from "@/lib/dashboard/use-dashboard-scores";

export function DashboardReadinessHeader() {
  const t = useTranslations("DashboardReadinessHeader");
  const { data } = useDashboardScores();
  const readiness = data?.readiness ?? { score: null, label: null };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 sm:gap-4 sm:px-4">
      <DashboardReadinessRing score={readiness.score} size="md" />
      <div className="min-w-0">
        <div className="font-mono text-[0.58rem] uppercase tracking-[0.2em] text-gray-500">{t("yourScore")}</div>
        <div className="text-sm font-semibold capitalize text-gray-100">{readiness.label ?? t("pending")}</div>
        <div className="mt-0.5 text-[0.65rem] text-gray-500">
          {t.rich("optimal", { value: (chunks) => <span className="font-semibold text-gray-300">{chunks}</span> })}
        </div>
      </div>
    </div>
  );
}
