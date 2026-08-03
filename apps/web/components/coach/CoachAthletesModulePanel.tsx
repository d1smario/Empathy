"use client";

import { useState, type ReactNode } from "react";
import { KeyRound, UserPlus } from "lucide-react";
import { CoachAlertsPanel } from "@/components/coach/CoachAlertsPanel";
import { CoachCodeCard } from "@/components/coach/CoachCodeCard";
import { CoachInviteLinksCard } from "@/components/coach/CoachInviteLinksCard";
import { CoachRosterCard } from "@/components/coach/CoachRosterCard";
import { BuilderDialog } from "@/components/training/BuilderDialog";
import { Pro2Button, Pro2Link } from "@/components/ui/empathy";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { useTranslations } from "next-intl";

function Pill({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{children}</span>
  );
}

/**
 * Modulo **Coach · Atleti**: il lavoro quotidiano del coach in due colonne — a sinistra CHI
 * (roster), a destra COSA È SUCCESSO (alert dei suoi atleti). Inviti e codice coach non sono
 * il lavoro quotidiano: erano due card grandi che occupavano mezza pagina, ora sono due
 * bottoni piccoli che aprono un dialog (stesso identico flusso, `bare` toglie solo la cornice).
 *
 * Due colonne da `lg` in su, come il resto della console coach (CoachDashboardView): sotto,
 * impilate — atleti sopra, alert sotto. `items-start` perché le due colonne devono avere
 * ALTEZZE INDIPENDENTI (senza, la griglia le stira alla più alta) e ognuna scrolla dentro di sé.
 *
 * Niente più link «Dashboard» in fondo: la voce è già in sidebar sul desktop, e sulla shell
 * mobile puntava a `/dashboard` fuori shell, dove il coach viene comunque rimbalzato qui.
 */
export function CoachAthletesModulePanel({ basePath = "/athletes" }: { basePath?: string }) {
  const { role, coachOperationalApproved, platformCoachStatus, loading, signedIn } = useActiveAthlete();
  const t = useTranslations("CoachAthletesModulePanel");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);

  const showStatus = !loading && signedIn;
  // Le due card si auto-nascondono per l'account atleta: qui si nascondono già i bottoni,
  // altrimenti aprirebbero un dialog vuoto.
  const showCoachTools = loading || role !== "private";

  // Contenitore senza header: «Atleti · Stato, roster e inviti» duplicava l'header di
  // pagina in alto (StandardModuleSurface). Teniamo solo il box, non il titolo/icona.
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-lg backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-6">
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

        {/* `!` sulle utility di taglia: `cn` è una semplice join (niente tailwind-merge),
            quindi senza important vincerebbe il px-5/text-sm della base di Pro2Button.
            Stesso trucco già usato in CoachLibraryContractEditor. */}
        {showCoachTools ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Pro2Button
              variant="secondary"
              className="gap-1.5 !px-3.5 !py-1.5 !text-xs"
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden />
              {t("invite")}
            </Pro2Button>
            <Pro2Button variant="secondary" className="gap-1.5 !px-3.5 !py-1.5 !text-xs" onClick={() => setCodeOpen(true)}>
              <KeyRound className="h-3.5 w-3.5" aria-hidden />
              {t("coachCode")}
            </Pro2Button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          {/* `min-w-0` su entrambe: senza, una riga lunga (email, nome atleta) sfonderebbe
              la colonna e la pagina scrollerebbe in orizzontale su mobile. */}
          <div className="min-w-0">
            <CoachRosterCard basePath={basePath} />
          </div>
          <div className="min-w-0">
            <CoachAlertsPanel basePath={basePath} />
          </div>
        </div>
      </div>

      {/* Montati solo da aperti: così la GET del codice coach non parte al caricamento pagina. */}
      {inviteOpen ? (
        <BuilderDialog open title={t("invite")} closeLabel={t("closeDialog")} onClose={() => setInviteOpen(false)}>
          <CoachInviteLinksCard bare />
        </BuilderDialog>
      ) : null}
      {codeOpen ? (
        <BuilderDialog open title={t("coachCode")} closeLabel={t("closeDialog")} onClose={() => setCodeOpen(false)}>
          <CoachCodeCard bare />
        </BuilderDialog>
      ) : null}
    </section>
  );
}
