"use client";

import type { ReactNode } from "react";
import { CoachCodeCard } from "@/components/coach/CoachCodeCard";
import { CoachInviteLinksCard } from "@/components/coach/CoachInviteLinksCard";
import { CoachRosterCard } from "@/components/coach/CoachRosterCard";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Link } from "@/components/ui/empathy";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { Users } from "lucide-react";
import { useTranslations } from "next-intl";

function Pill({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{children}</span>
  );
}

/**
 * Modulo **Coach · Atleti**: stato account, roster, inviti (copy essenziale, senza dettagli tecnici).
 */
export function CoachAthletesModulePanel({ basePath = "/athletes" }: { basePath?: string }) {
  const { role, coachOperationalApproved, platformCoachStatus, loading, signedIn } = useActiveAthlete();
  const t = useTranslations("CoachAthletesModulePanel");

  const showStatus = !loading && signedIn;

  return (
    <Pro2SectionCard accent="violet" title={t("title")} subtitle={t("subtitle")} icon={Users}>
      <div className="flex flex-col gap-8">
        {/* Niente badge «Coach · attivo» per il coach già approvato: è rumore (se sei
            nella console sei attivo). La riga stato resta solo per gli stati che
            richiedono un'azione: atleta (diventa coach), pending, sospeso. */}
        {showStatus && !(role === "coach" && coachOperationalApproved) ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-white/10 pb-6">
            {role === "private" ? (
              <>
                <Pill className="bg-white/10 text-gray-200">{t("athleteAccount")}</Pill>
                <Pro2Link
                  href="/access"
                  variant="secondary"
                  className="justify-center border border-cyan-500/40 bg-cyan-500/15 text-sm hover:bg-cyan-500/25"
                >
                  {t("becomeCoach")}
                </Pro2Link>
              </>
            ) : null}
            {role === "coach" && !coachOperationalApproved && (platformCoachStatus === "pending" || platformCoachStatus === null) ? (
              <>
                <Pill className="bg-amber-500/20 text-amber-100">{t("coachPending")}</Pill>
                <span className="text-sm text-gray-400">{t("enablementNote")}</span>
              </>
            ) : null}
            {role === "coach" && platformCoachStatus === "suspended" ? (
              <Pill className="bg-rose-500/20 text-rose-100">{t("coachSuspended")}</Pill>
            ) : null}
          </div>
        ) : null}

        <CoachRosterCard basePath={basePath} />
        <div className="grid gap-6 sm:grid-cols-2">
          <CoachInviteLinksCard />
          <CoachCodeCard />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-white/10 pt-6">
          <Pro2Link href="/dashboard" variant="secondary" className="justify-center border border-white/15 text-sm">
            {t("dashboard")}
          </Pro2Link>
        </div>
      </div>
    </Pro2SectionCard>
  );
}
