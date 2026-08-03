"use client";

/**
 * PlanSkeletonReviewPanel — container di revisione dello scheletro L1 (VIRYA rework,
 * blueprint sezioni B/D, decisione D5: container NUOVO e leggero, sezioni prop-driven).
 *
 * PERCHÉ un container separato e non il riuso di ViryaWeeklyProgramTable: quella
 * tabella parla il linguaggio del wizard (override locali, chip WeekObjectiveKey,
 * patch in-memory) mentre qui si revisiona lo scheletro PERSISTITO: le prop non
 * combaciano e adattarle significherebbe agganciare il wizard al DB — esattamente
 * ciò che il rework smonta. Qui: lettura DB-first (browser→Supabase, policy coach
 * read di F1), edit inline per-settimana salvato via UPDATE diretto (policy
 * coach_update), approvazione via POST /api/training/plan/approve (unica azione
 * server: transizione di stato + kickoff materializzazione, filone server).
 *
 * Vocabolario stimoli = SOLO i 14 `AdaptationTarget` (contratto B): il select del
 * primario enumera l'enum reale, mai testo libero.
 */

import { CalendarRange, CheckCircle2, Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Button } from "@/components/ui/empathy";
import { cn } from "@/lib/cn";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import {
  planSkeletonFromRows,
  type TrainingPlanMesocycleRow,
  type TrainingPlanRow,
  type TrainingPlanWeekRow,
} from "@/lib/training/plan/plan-skeleton-mappers";
import {
  ADAPTATION_TARGETS,
  type AdaptationTarget,
  type PlanSkeleton,
  type PlanSkeletonWeek,
} from "@/lib/training/plan/plan-skeleton-types";
import { isoWeekStart } from "@/lib/training/plan/reshape-plan-timeline";

/**
 * Patch di revisione per-settimana. Le leve sono quelle della spec coach: VOLUME
 * (ore) e INTENSITÀ (carico) della settimana, più stimolo primario e note. Il
 * carico è consumato dal motore (materialize passa `budget_tss` alla generazione),
 * quindi cambiarlo cambia davvero le sedute.
 */
type WeekReviewPatch = {
  hoursTarget: number | null;
  loadTarget: number;
  coachNotes: string | null;
  primary: AdaptationTarget;
};

type SaveState = "idle" | "saving" | "saved" | "error";

/** Colonne lette dal browser (policy coach_read F1) — tutte mappate dai mapper L1. */
const PLAN_SELECT =
  "id, athlete_id, name, status, approved_by, approved_at, discipline, start_date, end_date, goal_event_date";
const MESO_SELECT =
  "id, seq, phase, label, weeks, load_weeks, deload_weeks, weekly_tss_target, sessions_target, objective, notes";
const WEEK_SELECT =
  "id, week_start, phase, week_in_phase, budget_tss, sessions, objectives, coach_notes, hours_target, family_mix, mesocycle_id";

function formatIsoDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-CH", { dateStyle: "medium" }).format(d);
}

/**
 * Riga settimana con edit inline. Stato locale alla riga: input controllati +
 * salvataggio esplicito per-riga (feedback salvato/errore riga per riga, niente
 * autosave silenzioso: la revisione è un atto deliberato del coach).
 */
function WeekReviewRow({
  week,
  index,
  disabled,
  onSave,
}: {
  week: PlanSkeletonWeek;
  index: number;
  disabled: boolean;
  onSave: (weekId: string, patch: WeekReviewPatch) => Promise<string | null>;
}) {
  const t = useTranslations("PlanSkeletonReviewPanel");
  const [hours, setHours] = useState<string>(week.hoursTarget != null ? String(week.hoursTarget) : "");
  const [load, setLoad] = useState<string>(String(week.loadTarget));
  const [notes, setNotes] = useState<string>(week.coachNotes ?? "");
  const [primary, setPrimary] = useState<AdaptationTarget>(week.stimulus.primary);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const dirty =
    hours !== (week.hoursTarget != null ? String(week.hoursTarget) : "") ||
    load !== String(week.loadTarget) ||
    notes !== (week.coachNotes ?? "") ||
    primary !== week.stimulus.primary;

  const handleSave = useCallback(async () => {
    setSaveState("saving");
    const trimmedHours = hours.trim();
    const parsedHours = trimmedHours === "" ? null : Number(trimmedHours);
    const parsedLoad = Number(load.trim());
    const err = await onSave(week.id, {
      hoursTarget: parsedHours != null && Number.isFinite(parsedHours) ? Math.max(0, parsedHours) : null,
      // Carico vuoto/non numerico → si tiene il valore corrente: azzerarlo per una
      // digitazione a metà svuoterebbe la settimana in generazione.
      loadTarget: Number.isFinite(parsedLoad) ? Math.max(0, Math.round(parsedLoad)) : week.loadTarget,
      coachNotes: notes.trim() === "" ? null : notes.trim(),
      primary,
    });
    setSaveState(err ? "error" : "saved");
  }, [hours, load, notes, primary, onSave, week.id, week.loadTarget]);

  return (
    <tr className="border-b border-white/[0.05] align-middle">
      <td className="p-2 font-mono text-xs font-semibold text-violet-300">{index + 1}</td>
      <td className="whitespace-nowrap p-2 font-mono text-[0.7rem] text-slate-300">{week.weekStart}</td>
      <td className="whitespace-nowrap p-2 text-xs font-semibold text-slate-200">{t(`phase.${week.phase}`)}</td>
      <td className="p-2 font-mono text-xs text-slate-400">{week.mesocycleSeq ?? "—"}</td>
      <td className="p-2">
        <input
          type="number"
          min={0}
          step={10}
          disabled={disabled}
          value={load}
          onChange={(e) => {
            setLoad(e.target.value);
            setSaveState("idle");
          }}
          className="w-20 rounded-lg border border-white/15 bg-black/40 px-2 py-1 font-mono text-xs tabular-nums text-orange-200 outline-none transition focus:border-violet-400/60 disabled:opacity-50"
        />
      </td>
      <td className="p-2 font-mono text-xs tabular-nums text-slate-300">{week.sessionsTarget}</td>
      <td className="p-2">
        <input
          type="number"
          min={0}
          step={0.5}
          placeholder="—"
          disabled={disabled}
          value={hours}
          onChange={(e) => {
            setHours(e.target.value);
            setSaveState("idle");
          }}
          className="w-16 rounded-lg border border-white/15 bg-black/40 px-2 py-1 font-mono text-xs text-slate-100 outline-none transition focus:border-violet-400/60 disabled:opacity-50"
        />
      </td>
      <td className="p-2">
        <select
          disabled={disabled}
          value={primary}
          onChange={(e) => {
            setPrimary(e.target.value as AdaptationTarget);
            setSaveState("idle");
          }}
          className="w-full min-w-[180px] rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-xs text-slate-100 outline-none transition focus:border-violet-400/60 disabled:opacity-50"
        >
          {ADAPTATION_TARGETS.map((target) => (
            <option key={target} value={target}>
              {t(`adaptation.${target}`)}
            </option>
          ))}
        </select>
      </td>
      <td className="p-2">
        <input
          type="text"
          disabled={disabled}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setSaveState("idle");
          }}
          placeholder="—"
          className="w-full min-w-[160px] rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-xs text-slate-100 outline-none transition focus:border-violet-400/60 disabled:opacity-50"
        />
      </td>
      <td className="whitespace-nowrap p-2 text-right">
        {saveState === "saved" && !dirty ? (
          <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            {t("saved")}
          </span>
        ) : (
          <button
            type="button"
            disabled={disabled || !dirty || saveState === "saving"}
            onClick={() => void handleSave()}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-[0.65rem] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
              saveState === "error"
                ? "border-red-400/50 bg-red-500/10 text-red-300"
                : "border-violet-400/40 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20",
            )}
          >
            {saveState === "saving" ? t("saving") : saveState === "error" ? t("saveError") : t("save")}
          </button>
        )}
      </td>
    </tr>
  );
}

/**
 * Pannello revisione: banner stato + fasi/mesocicli + settimane editabili +
 * «Approva piano» (solo su draft). Montato SOPRA il wizard nella tab Piano/Virya.
 */
export function PlanSkeletonReviewPanel({ athleteId }: { athleteId: string }) {
  const t = useTranslations("PlanSkeletonReviewPanel");
  const [skeleton, setSkeleton] = useState<PlanSkeleton | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveErr, setApproveErr] = useState<string | null>(null);
  // «Sedute in generazione»: nota mostrata SOLO dopo un'approvazione riuscita in
  // questa sessione (la materializzazione parte dal filone server all'approve).
  const [justApproved, setJustApproved] = useState(false);
  // Durate mesocicli in bozza locale: il ricalcolo della linea temporale è un atto
  // esplicito («Applica durate»), non un autosave per riga — sposta le date di
  // tutte le settimane successive.
  const [mesoWeeks, setMesoWeeks] = useState<Record<string, string>>({});
  const [reshaping, setReshaping] = useState(false);
  const [reshapeErr, setReshapeErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setErr(t("errNoSupabase"));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // DB-first: piano non-archived più recente dell'atleta in scope. La policy
      // coach_read di F1 autorizza la lettura (draft incluso); niente API route.
      const planRes = await supabase
        .from("training_plan")
        .select(PLAN_SELECT)
        .eq("athlete_id", athleteId)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
        .limit(1);
      if (planRes.error) {
        setErr(`${t("errLoad")}: ${planRes.error.message}`);
        return;
      }
      const planRow = (planRes.data?.[0] ?? null) as TrainingPlanRow | null;
      if (!planRow) {
        setSkeleton(null);
        return;
      }
      const [mesoRes, weekRes] = await Promise.all([
        supabase
          .from("training_plan_mesocycle")
          .select(MESO_SELECT)
          .eq("plan_id", planRow.id)
          .order("seq", { ascending: true }),
        supabase
          .from("training_plan_week")
          .select(WEEK_SELECT)
          .eq("plan_id", planRow.id)
          .order("week_start", { ascending: true }),
      ]);
      const firstError = mesoRes.error ?? weekRes.error;
      if (firstError) {
        setErr(`${t("errLoad")}: ${firstError.message}`);
        return;
      }
      setSkeleton(
        planSkeletonFromRows(
          planRow,
          (mesoRes.data ?? []) as TrainingPlanMesocycleRow[],
          (weekRes.data ?? []) as TrainingPlanWeekRow[],
        ),
      );
    } catch (e) {
      setErr(`${t("errLoad")}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [athleteId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * UPDATE diretto browser→Supabase (policy coach_update F1). `objectives` viene
   * riscritto INTERO con chiavi snake_case (contratto B): si preserva ciò che il
   * coach non ha toccato (secondary/maintenance/avoid, anche se derivati dalla
   * fase) e si sostituisce solo il primario — da qui in poi lo stimolo è esplicito
   * in DB, non più derivato alla lettura.
   */
  const saveWeek = useCallback(
    async (weekId: string, patch: WeekReviewPatch): Promise<string | null> => {
      const supabase = createEmpathyBrowserSupabase();
      if (!supabase) return t("errNoSupabase");
      const week = skeleton?.weeks.find((w) => w.id === weekId);
      if (!week) return t("errLoad");
      const nextObjectives = {
        primary: patch.primary,
        secondary: week.stimulus.secondary,
        maintenance: week.stimulus.maintenance,
        avoid: week.stimulus.avoid,
      };
      const { data, error } = await supabase
        .from("training_plan_week")
        .update({
          hours_target: patch.hoursTarget,
          budget_tss: patch.loadTarget,
          coach_notes: patch.coachNotes,
          objectives: nextObjectives,
        })
        .eq("id", weekId)
        .select("id");
      // RLS silenziosa (0 righe toccate) = permesso negato: trattarla come errore
      // esplicito, mai come salvataggio riuscito.
      if (error || !data || data.length === 0) {
        return error?.message ?? t("saveError");
      }
      setSkeleton((prev) =>
        prev
          ? {
              ...prev,
              weeks: prev.weeks.map((w) =>
                w.id === weekId
                  ? {
                      ...w,
                      hoursTarget: patch.hoursTarget,
                      loadTarget: patch.loadTarget,
                      coachNotes: patch.coachNotes,
                      stimulus: { ...w.stimulus, primary: patch.primary },
                    }
                  : w,
              ),
            }
          : prev,
      );
      return null;
    },
    [skeleton, t],
  );

  /**
   * Durata dei mesocicli: cambiare la lunghezza di una fase fa nascere/morire righe
   * settimana e sposta le date delle successive — operazioni che il coach non ha
   * per policy (solo UPDATE). Passa dal server, che ricalcola la linea temporale e,
   * se il piano è già vivo, rigenera le sedute future.
   */
  const applyMesoWeeks = useCallback(async () => {
    if (!skeleton) return;
    const payload = skeleton.mesocycles
      .map((m) => ({ id: m.id, weeks: Number(mesoWeeks[m.id] ?? m.weeks) }))
      .filter((m) => Number.isFinite(m.weeks) && m.weeks >= 1 && m.weeks <= 16);
    if (payload.length === 0) return;
    setReshaping(true);
    setReshapeErr(null);
    try {
      const res = await fetch("/api/training/plan/reshape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: skeleton.id, mesocycles: payload }),
      });
      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as { error?: unknown };
          if (typeof body?.error === "string" && body.error) {
            // `mesocycle_already_started` ha un messaggio suo: è una regola di
            // prodotto (non si riscrive il passato), non un errore tecnico.
            message = body.error === "mesocycle_already_started" ? t("reshapeStarted") : body.error;
          }
        } catch {
          // body non-JSON: resta l'HTTP status.
        }
        setReshapeErr(t("reshapeError", { message }));
        return;
      }
      setMesoWeeks({});
      await load();
    } catch (e) {
      setReshapeErr(t("reshapeError", { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setReshaping(false);
    }
  }, [skeleton, mesoWeeks, load, t]);

  /** Approvazione: unica azione che passa dal server (transizione di stato + generazione). */
  const approve = useCallback(async () => {
    if (!skeleton || skeleton.status !== "draft") return;
    setApproving(true);
    setApproveErr(null);
    try {
      const res = await fetch("/api/training/plan/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: skeleton.id }),
      });
      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as { error?: unknown };
          if (typeof body?.error === "string" && body.error) message = body.error;
        } catch {
          // body non-JSON: resta l'HTTP status.
        }
        setApproveErr(t("approveError", { message }));
        return;
      }
      setSkeleton((prev) =>
        prev ? { ...prev, status: "approved", approvedAt: new Date().toISOString() } : prev,
      );
      setJustApproved(true);
    } catch (e) {
      setApproveErr(t("approveError", { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setApproving(false);
    }
  }, [skeleton, t]);

  // Legacy = approvato/attivo senza traccia di approvazione (righe pre-rework col
  // default F1 'approved'): banner dedicato, niente bottone (nulla da approvare).
  const isLegacy = useMemo(
    () =>
      skeleton != null &&
      (skeleton.status === "approved" || skeleton.status === "active") &&
      skeleton.approvedAt == null &&
      skeleton.approvedBy == null,
    [skeleton],
  );

  /**
   * Mesocicli già iniziati: la loro durata non è più ridimensionabile (stessa
   * regola del server). «Iniziato» = la sua prima settimana cade prima del lunedì
   * corrente — le date passate non si riscrivono.
   */
  const mesoStartedSeqs = useMemo(() => {
    const started = new Set<number>();
    if (!skeleton) return started;
    const monday = isoWeekStart(new Date().toISOString().slice(0, 10));
    const firstBySeq = new Map<number, string>();
    for (const w of skeleton.weeks) {
      if (w.mesocycleSeq == null) continue;
      const cur = firstBySeq.get(w.mesocycleSeq);
      if (!cur || w.weekStart < cur) firstBySeq.set(w.mesocycleSeq, w.weekStart);
    }
    for (const [seq, first] of firstBySeq) {
      if (first < monday) started.add(seq);
    }
    return started;
  }, [skeleton]);

  /** Almeno una durata cambiata rispetto al DB → «Applica durate» attivo. */
  const mesoDurationsDirty = useMemo(() => {
    if (!skeleton) return false;
    return skeleton.mesocycles.some((m) => {
      const raw = mesoWeeks[m.id];
      if (raw == null) return false;
      const n = Number(raw);
      return Number.isFinite(n) && n >= 1 && n <= 16 && n !== m.weeks;
    });
  }, [skeleton, mesoWeeks]);

  // Il piano archiviato è storia: nessuna leva. Sugli altri il coach regola.
  const canEdit = skeleton != null && skeleton.status !== "archived";

  if (loading) {
    return (
      <div className="mb-6 h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" aria-hidden />
    );
  }
  if (err) {
    return (
      <p className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" role="alert">
        {err}
      </p>
    );
  }
  // Nessun piano non-archived: nulla da revisionare, il wizard sotto resta lo strumento.
  if (!skeleton) return null;

  const isDraft = skeleton.status === "draft";

  return (
    <div className="mb-6">
      <Pro2SectionCard
        accent={isDraft ? "amber" : "emerald"}
        title={t("cardTitle")}
        subtitle={t("cardSubtitle")}
        icon={CalendarRange}
      >
        {/* Banner stato: BOZZA ambra / Approvato verde / legacy senza revisione */}
        <div
          className={cn(
            "mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
            isDraft
              ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
              : isLegacy
                ? "border-white/15 bg-white/[0.04] text-slate-300"
                : "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
          )}
        >
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider",
                  isDraft
                    ? "border-amber-400/50 bg-amber-500/15 text-amber-200"
                    : isLegacy
                      ? "border-white/20 bg-white/5 text-slate-300"
                      : "border-emerald-400/50 bg-emerald-500/15 text-emerald-200",
                )}
              >
                {isDraft ? t("statusDraft") : isLegacy ? t("statusLegacy") : t("statusApproved")}
              </span>
              {skeleton.name ?? skeleton.discipline}
              <span className="font-mono text-[0.7rem] font-normal opacity-80">
                {t("planPeriod", { start: skeleton.startDate, end: skeleton.endDate })}
              </span>
            </p>
            <p className="mt-1 text-xs opacity-90">
              {isDraft ? t("draftBanner") : isLegacy ? t("legacyBanner") : t("approvedBanner")}
              {!isDraft && !isLegacy && skeleton.approvedAt
                ? ` — ${t("approvedAtLine", { date: formatIsoDate(skeleton.approvedAt) })}`
                : null}
              {skeleton.goalEventDate ? ` · ${t("goalEvent", { date: skeleton.goalEventDate })}` : null}
            </p>
            {justApproved ? (
              <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                {t("generatingNote")}
              </p>
            ) : null}
          </div>
          {isDraft ? (
            <Pro2Button type="button" disabled={approving} onClick={() => void approve()}>
              {approving ? t("approving") : t("approve")}
            </Pro2Button>
          ) : null}
        </div>

        {approveErr ? (
          <p className="mb-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-xs text-red-300" role="alert">
            {approveErr}
          </p>
        ) : null}

        {/* Fasi / mesocicli — tabella semplice: lo scheletro normalizzato, non il jsonb phases */}
        {skeleton.mesocycles.length > 0 ? (
          <div className="mb-4">
            <p className="mb-2 flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-wider text-slate-500">
              <Layers className="h-3.5 w-3.5" aria-hidden />
              {t("mesocyclesTitle")}
            </p>
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/25">
              <table className="w-full min-w-[640px] border-collapse text-left text-xs text-slate-200">
                <thead className="border-b border-white/10">
                  <tr className="font-mono text-[0.6rem] uppercase tracking-wider text-slate-500">
                    <th className="p-2 font-medium">{t("colSeq")}</th>
                    <th className="p-2 font-medium">{t("colPhase")}</th>
                    <th className="p-2 font-medium">{t("colLabel")}</th>
                    <th className="p-2 font-medium">{t("colWeeks")}</th>
                    <th className="p-2 font-medium">{t("colRatio")}</th>
                    <th className="p-2 font-medium">{t("colWeeklyLoad")}</th>
                    <th className="p-2 font-medium">{t("colSessions")}</th>
                    <th className="p-2 font-medium">{t("colObjective")}</th>
                  </tr>
                </thead>
                <tbody>
                  {skeleton.mesocycles.map((meso) => {
                    // Fase già iniziata → durata bloccata: cambiarla sposterebbe date
                    // già vissute dall'atleta (stessa regola applicata dal server).
                    const started = mesoStartedSeqs.has(meso.seq);
                    return (
                    <tr key={meso.id} className="border-b border-white/[0.05]">
                      <td className="p-2 font-mono font-semibold text-violet-300">{meso.seq}</td>
                      <td className="p-2 font-semibold">{t(`phase.${meso.phase}`)}</td>
                      <td className="p-2 text-slate-400">{meso.label ?? "—"}</td>
                      <td className="p-2">
                        {started || !canEdit ? (
                          <span
                            className="font-mono tabular-nums text-slate-400"
                            title={started ? t("reshapeStarted") : undefined}
                          >
                            {meso.weeks}
                          </span>
                        ) : (
                          <input
                            type="number"
                            min={1}
                            max={16}
                            step={1}
                            disabled={reshaping}
                            value={mesoWeeks[meso.id] ?? String(meso.weeks)}
                            onChange={(e) => {
                              setMesoWeeks((prev) => ({ ...prev, [meso.id]: e.target.value }));
                              setReshapeErr(null);
                            }}
                            className="w-16 rounded-lg border border-white/15 bg-black/40 px-2 py-1 font-mono text-xs tabular-nums text-slate-100 outline-none transition focus:border-violet-400/60 disabled:opacity-50"
                          />
                        )}
                      </td>
                      <td className="p-2 font-mono tabular-nums text-slate-400">
                        {meso.loadWeeks}:{meso.deloadWeeks}
                      </td>
                      <td className="p-2 font-mono tabular-nums text-orange-200">
                        {meso.weeklyTssTarget ?? "—"}
                      </td>
                      <td className="p-2 font-mono tabular-nums">{meso.sessionsTarget ?? "—"}</td>
                      <td className="p-2 text-slate-400">{meso.objective ?? "—"}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {canEdit ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void applyMesoWeeks()}
                  disabled={!mesoDurationsDirty || reshaping}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
                    "border-violet-400/40 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20",
                  )}
                >
                  {reshaping ? t("reshapeApplying") : t("reshapeApply")}
                </button>
                <p className="text-[0.7rem] text-slate-500">{t("reshapeHint")}</p>
              </div>
            ) : null}
            {reshapeErr ? (
              <p className="mt-2 text-xs text-rose-300" role="alert">
                {reshapeErr}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Settimane — edit inline hours_target / stimolo primario / coach_notes */}
        <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-wider text-slate-500">{t("weeksTitle")}</p>
        {skeleton.weeks.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-black/25 px-4 py-6 text-center text-xs text-slate-500">
            {t("noWeeks")}
          </p>
        ) : (
          <div className="max-h-[min(480px,55vh)] overflow-auto rounded-xl border border-white/10 bg-black/25">
            <table className="w-full min-w-[900px] border-collapse text-left text-xs text-slate-200">
              <thead className="sticky top-0 z-10 border-b border-white/10 bg-black/90 backdrop-blur-sm">
                <tr className="font-mono text-[0.6rem] uppercase tracking-wider text-slate-500">
                  <th className="p-2 font-medium">{t("colSeq")}</th>
                  <th className="p-2 font-medium">{t("colWeekStart")}</th>
                  <th className="p-2 font-medium">{t("colPhase")}</th>
                  <th className="p-2 font-medium">{t("colMeso")}</th>
                  <th className="p-2 font-medium">{t("colLoad")}</th>
                  <th className="p-2 font-medium">{t("colSessions")}</th>
                  <th className="p-2 font-medium">{t("colHours")}</th>
                  <th className="p-2 font-medium">{t("colStimulus")}</th>
                  <th className="p-2 font-medium">{t("colNotes")}</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {skeleton.weeks.map((week, index) => (
                  <WeekReviewRow
                    key={week.id}
                    week={week}
                    index={index}
                    // L'edit resta possibile anche su approved/active (correzioni in
                    // corsa, policy coach_update senza filtro status); si blocca solo
                    // durante l'approvazione per non incrociare scritture.
                    disabled={approving}
                    onSave={saveWeek}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Pro2SectionCard>
    </div>
  );
}
