"use client";

import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ExecutedWorkout } from "@empathy/domain-training";
import { BuilderDialog } from "@/components/training/BuilderDialog";
import { CalendarDaySessionDetail } from "@/components/training/CalendarDaySessionDetail";
import { coachAthleteSessionHref } from "@/lib/athlete-scope/scoped-athlete-href";
import { useAthleteFtpWatts } from "@/lib/training/physiology/use-athlete-ftp-watts";

/**
 * Popup «Analisi allenamento» del calendario coach — SOLA LETTURA. Contenitore = `BuilderDialog`
 * (portal + backdrop + Esc/X + max-h). Corpo = `CalendarDaySessionDetail` riusato tale e quale:
 * si auto-alimenta (fetch serie HD da `executed_workout_series` per `workout.id` → grafici/mappa).
 * FTP via `useAthleteFtpWatts` (stesso percorso del Builder) per l'IF nell'header KPI. Footer: link
 * scoped alla sessione completa dell'atleta (mai la rotta globale /training/session).
 */
export function CoachSessionAnalysisModal({
  open,
  executed,
  athleteId,
  dateIso,
  onClose,
}: {
  open: boolean;
  executed: ExecutedWorkout | null;
  athleteId: string | null;
  dateIso: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("CoachCalendarBoard");
  const ftpWatts = useAthleteFtpWatts(open ? athleteId : null);

  const sessionHref = athleteId && dateIso ? coachAthleteSessionHref(athleteId, dateIso) : null;

  return (
    <BuilderDialog open={open} title={t("analysisTitle")} onClose={onClose} closeLabel={t("analysisClose")}>
      {executed && dateIso ? (
        <div className="space-y-5">
          <CalendarDaySessionDetail
            selectedDate={dateIso}
            dayExecuted={[executed]}
            athleteId={athleteId}
            athleteFtpWatts={ftpWatts}
          />
          {sessionHref ? (
            <div className="border-t border-white/10 pt-4">
              <a
                href={sessionHref}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/50 hover:text-white"
              >
                {t("openFullSession")}
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </BuilderDialog>
  );
}
