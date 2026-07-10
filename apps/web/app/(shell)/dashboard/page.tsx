import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Clock } from "lucide-react";
import { CoachDashboardView } from "@/components/coach/CoachDashboardView";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { coachOperationalApproved } from "@/lib/platform-coach-status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Oggi & Domani" };

/**
 * Dashboard per ruolo: il coach entra qui dal login (porta unica) e vede la SUA
 * operatività (atleti, sessioni, commissioni) — non i piani d'acquisto, che sono
 * roba da atleta. Coach NON approvato (in attesa/sospeso): avviso, niente dati
 * (coerente con il gate canAccessAthleteData). L'utente privato mantiene la
 * dashboard modulo esistente. (L'admin non passa di qui: la shell lo gira su /admin.)
 */
export default async function DashboardPage() {
  const session = await getSessionProfile();
  const t = await getTranslations("DashboardPage");
  if (session.role === "private") {
    redirect("/analysis");
  }
  if (session.role === "coach") {
    if (!coachOperationalApproved("coach", session.platformCoachStatus)) {
      return (
        <Pro2ModulePageShell
          eyebrow="Dashboard · Coach"
          eyebrowClassName="text-violet-400"
          title={t("accountUnderReviewTitle")}
          description={
            <span className="text-sm text-gray-400">
              {t("accountUnderReviewDescription")}
            </span>
          }
        >
          <Pro2SectionCard accent="amber" title={t("awaitingApprovalTitle")} subtitle={t("awaitingApprovalSubtitle")} icon={Clock}>
            <p className="text-sm leading-relaxed text-gray-300">
              {t("awaitingApprovalBody")}
            </p>
          </Pro2SectionCard>
        </Pro2ModulePageShell>
      );
    }
    return <CoachDashboardView />;
  }
  redirect("/analysis");
}
