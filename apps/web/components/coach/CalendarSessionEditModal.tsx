"use client";

import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { BuilderDialog } from "@/components/training/BuilderDialog";
import { BuilderManualComposerSwitch } from "@/modules/training/views/sections/BuilderManualComposerSwitch";
import { useBuilderComposerState } from "@/modules/training/views/hooks/use-builder-composer-state";
import { coachAthleteSessionHref } from "@/lib/athlete-scope/scoped-athlete-href";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import { contractToPlannedWorkoutRow } from "@/lib/training/library/contract-to-planned-row";
import { patchPlannedWorkout } from "@/modules/training/services/training-planned-api";

export type CalendarEditPlannedRow = {
  id: string;
  athleteId: string;
  date: string;
};

/**
 * Popup «Modifica seduta pianificata» del Calendario Coach: monta l'editor del Builder
 * (BuilderManualComposerSwitch) in un modale con salvataggio IN-PLACE (UPDATE della stessa
 * riga `planned_workouts`, MAI insert → nessun duplicato). Stato composer AUTONOMO via
 * `useBuilderComposerState` (il Builder quotidiano non viene toccato). All'apertura fa UNA
 * fetch single-row, estrae il contratto da `notes` e idrata la tela; se la nota non ha un
 * contratto builder la seduta è mostrata come non modificabile qui (solo link sessione).
 */
export function CalendarSessionEditModal({
  open,
  plannedRow,
  onClose,
  onSaved,
}: {
  open: boolean;
  plannedRow: CalendarEditPlannedRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("CoachCalendarBoard");
  const state = useBuilderComposerState({ athleteId: plannedRow?.athleteId ?? null });

  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [editable, setEditable] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const { hydrateFromContract } = state;

  useEffect(() => {
    if (!open || !plannedRow) return;
    let cancelled = false;
    setLoading(true);
    setLoadErr(null);
    setEditable(false);
    setSaveErr(null);
    (async () => {
      const supabase = createEmpathyBrowserSupabase();
      if (!supabase) {
        if (!cancelled) {
          setLoadErr(t("saveError"));
          setLoading(false);
        }
        return;
      }
      const { data, error } = await supabase
        .from("planned_workouts")
        .select("id,notes,date,duration_minutes,tss_target,athlete_id")
        .eq("id", plannedRow.id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setLoadErr(t("saveError"));
        setLoading(false);
        return;
      }
      const contract = parsePro2BuilderSessionFromNotes(typeof data.notes === "string" ? data.notes : null);
      if (contract) {
        hydrateFromContract(contract);
        setEditable(true);
      } else {
        setEditable(false);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, plannedRow, hydrateFromContract, t]);

  const sessionHref = plannedRow ? coachAthleteSessionHref(plannedRow.athleteId, plannedRow.date) : null;

  const handleSave = useCallback(async () => {
    if (!plannedRow) return;
    setSaveBusy(true);
    setSaveErr(null);
    try {
      const contract = state.buildContract();
      const patch = contractToPlannedWorkoutRow({
        athleteId: plannedRow.athleteId,
        date: plannedRow.date,
        contract,
      });
      await patchPlannedWorkout({
        id: plannedRow.id,
        athleteId: plannedRow.athleteId,
        patch: {
          date: patch.date,
          type: patch.type,
          duration_minutes: patch.duration_minutes,
          tss_target: patch.tss_target,
          kcal_target: patch.kcal_target,
          notes: patch.notes,
        },
      });
      setSaveBusy(false);
      onSaved();
      onClose();
    } catch (e) {
      setSaveBusy(false);
      setSaveErr(e instanceof Error ? e.message : t("saveError"));
    }
  }, [plannedRow, state, onSaved, onClose, t]);

  return (
    <BuilderDialog open={open} title={t("editSessionTitle")} onClose={onClose} closeLabel={t("analysisClose")}>
      {loading ? (
        <p className="text-sm text-gray-400">{t("sourcesLoading")}</p>
      ) : loadErr ? (
        <p className="text-sm text-amber-200" role="alert">
          {loadErr}
        </p>
      ) : !editable ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-300">{t("notEditable")}</p>
          {sessionHref ? (
            <a
              href={sessionHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/50 hover:text-white"
            >
              {t("openFullSession")}
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </a>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5">
          <BuilderManualComposerSwitch hideSaveBar {...state.composerBag} />

          {saveErr ? (
            <p className="text-sm text-amber-200" role="alert">
              {saveErr}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saveBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-400/40 bg-orange-500/15 px-4 py-2 text-sm font-semibold text-orange-100 transition hover:border-orange-300/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveBusy ? t("saving") : t("save")}
            </button>
            {sessionHref ? (
              <a
                href={sessionHref}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/50 hover:text-white"
              >
                {t("openFullSession")}
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </a>
            ) : null}
          </div>
        </div>
      )}
    </BuilderDialog>
  );
}
