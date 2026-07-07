"use client";

import type { ExecutedWorkout } from "@empathy/domain-training";
import { Activity, Dumbbell, Leaf } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Pro2GymSchedaBlockList } from "@/components/training/Pro2GymSchedaBlockList";
import { SportDisciplineGlyph } from "@/components/training/SportDisciplineGlyph";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import type { SessionDetailViewModel } from "@/lib/training/session-detail-summary";
import type { SportGlyphId } from "@/lib/training/builder/sport-glyph-id";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";

type Discipline = "strength" | "recovery" | "endurance" | "generic";

/** Classifica la disciplina dalla stringa sport dell'ESEGUITO (da trace_summary). */
function classifyDiscipline(sport: string | null, glyph: SportGlyphId | null): Discipline {
  const s = (sport ?? "").toLowerCase();
  if (
    glyph === "gym" ||
    glyph === "hyrox" ||
    glyph === "crossfit" ||
    /(gym|strength|weight|barbell|forza|lift|wod)/.test(s)
  ) {
    return "strength";
  }
  if (/(recovery|recupero|mobilit|mobility|yoga|pilates|stretch|breath|rest|riposo)/.test(s)) {
    return "recovery";
  }
  if (
    glyph != null ||
    /(run|corsa|ride|bike|bici|cycl|swim|nuoto|row|ski|endurance|tempo|threshold|soglia|vo2|interval|fartlek)/.test(s)
  ) {
    return "endurance";
  }
  return "generic";
}

/** Fallback: classifica dal `type` della seduta PIANIFICATA collegata (quando l'eseguito non ha sport). */
function classifyFromPlannedType(type: string | null): Discipline | null {
  const s = (type ?? "").toLowerCase();
  if (!s) return null;
  if (/(strength|gym|forza|lift|crossfit|hyrox|wod)/.test(s)) return "strength";
  if (/(recovery|recupero|mobilit|yoga|pilates|stretch|breath|rest|riposo)/.test(s)) return "recovery";
  if (/(endurance|tempo|threshold|soglia|vo2|interval|fartlek|run|ride|bike|swim|row|ski)/.test(s)) return "endurance";
  return null;
}

/** Fallback ulteriore: la `family` del contratto Pro2 della pianificata. */
function familyToDiscipline(family: string | undefined): Discipline | null {
  if (family === "strength") return "strength";
  if (family === "aerobic") return "endurance";
  if (family === "lifestyle") return "recovery";
  return null;
}

const META: Record<
  Discipline,
  { icon: typeof Activity; border: string; grad: string; text: string; titleKey: string; descKey: string }
> = {
  strength: {
    icon: Dumbbell,
    border: "border-violet-400/40",
    grad: "from-violet-500/15",
    text: "text-violet-300",
    titleKey: "summaryStrengthTitle",
    descKey: "summaryStrengthDesc",
  },
  recovery: {
    icon: Leaf,
    border: "border-emerald-400/40",
    grad: "from-emerald-500/15",
    text: "text-emerald-300",
    titleKey: "summaryRecoveryTitle",
    descKey: "summaryRecoveryDesc",
  },
  endurance: {
    icon: Activity,
    border: "border-orange-400/40",
    grad: "from-orange-500/15",
    text: "text-orange-300",
    titleKey: "summaryEnduranceTitle",
    descKey: "summaryEnduranceDesc",
  },
  generic: {
    icon: Activity,
    border: "border-sky-400/40",
    grad: "from-sky-500/15",
    text: "text-sky-300",
    titleKey: "summaryGenericTitle",
    descKey: "summaryGenericDesc",
  },
};

/**
 * Modulo «riepilogo seduta» per il dettaglio quando NON ci sono serie HD da grafico:
 * al posto del box grigio «nessuna serie», una card elegante scelta per disciplina.
 * Disciplina dallo sport dell'eseguito; se assente, dal `type`/`family` della
 * pianificata collegata. Per la FORZA carica la scheda esercizi dalla pianificata
 * (`plannedWorkoutId` → contratto Pro2 `gymRx`) e la renderizza con Pro2GymSchedaBlockList.
 * I KPI scalari + biomarcatori restano renderizzati sotto dal chiamante.
 */
export function SessionSummaryModule({
  workout,
  vm,
  athleteId,
}: {
  workout: ExecutedWorkout;
  vm: SessionDetailViewModel;
  athleteId?: string | null;
}) {
  const t = useTranslations("CalendarDaySessionDetail");
  const baseDiscipline = classifyDiscipline(vm.sport, vm.sportGlyph);
  // Serve la pianificata quando: è forza (per la scheda) o è generica (per riclassificare dal tipo).
  const needsPlanned = baseDiscipline === "strength" || baseDiscipline === "generic";

  const [planned, setPlanned] = useState<{
    type: string | null;
    contract: ReturnType<typeof parsePro2BuilderSessionFromNotes>;
  } | null>(null);

  useEffect(() => {
    const pid = workout.plannedWorkoutId;
    if (!needsPlanned || !pid || !athleteId) return;
    let cancelled = false;
    (async () => {
      const supabase = createEmpathyBrowserSupabase();
      if (!supabase) return;
      const { data, error } = await supabase
        .from("planned_workouts")
        .select("type, notes")
        .eq("id", pid)
        .eq("athlete_id", athleteId)
        .maybeSingle();
      if (cancelled || error || !data) return;
      const row = data as { type?: string | null; notes?: string | null };
      setPlanned({ type: row.type ?? null, contract: parsePro2BuilderSessionFromNotes(row.notes ?? null) });
    })();
    return () => {
      cancelled = true;
    };
  }, [workout.plannedWorkoutId, athleteId, needsPlanned]);

  const contract = planned?.contract ?? null;
  // Disciplina effettiva: sport eseguito → tipo pianificato → family contratto → generica.
  const discipline: Discipline =
    baseDiscipline !== "generic"
      ? baseDiscipline
      : classifyFromPlannedType(planned?.type ?? null) ?? familyToDiscipline(contract?.family) ?? "generic";

  const m = META[discipline];
  const Icon = m.icon;
  const notes = (workout.subjectiveNotes ?? "").trim();

  const hasScheda =
    discipline === "strength" &&
    !!contract &&
    (contract.blocks ?? []).some((b) => b.gymRx || b.kind === "gym_exercise" || b.kind === "strength_sets");

  return (
    <div className={`rounded-2xl border ${m.border} bg-gradient-to-br ${m.grad} via-black/50 to-black/75 p-5`}>
      <div className="flex items-center gap-3">
        {vm.sportGlyph ? (
          <SportDisciplineGlyph glyph={vm.sportGlyph} className="h-9 w-9 text-white" />
        ) : (
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${m.border} bg-black/40 ${m.text}`}>
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">{t(m.titleKey)}</p>
          <p className="text-xs text-gray-400">{t(m.descKey)}</p>
        </div>
      </div>

      {notes ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
          <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] text-gray-500">
            {t("summaryRpe")}
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-gray-200">{notes}</p>
        </div>
      ) : null}

      {discipline === "strength" ? (
        hasScheda ? (
          <div className="mt-4">
            <Pro2GymSchedaBlockList contract={contract!} compact />
          </div>
        ) : (
          <p className="mt-3 text-xs text-gray-500">{t("summarySchedaHint")}</p>
        )
      ) : null}
    </div>
  );
}
