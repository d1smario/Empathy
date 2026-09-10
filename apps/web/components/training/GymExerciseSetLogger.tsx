"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import {
  clearExerciseSet,
  saveExerciseSet,
  setLogKey,
  validateSetLogRow,
  visibleSetCount,
  type ExerciseSetLogRow,
} from "@/lib/training/exercise-set-log";

export type GymExerciseSetLoggerProps = {
  athleteId: string;
  date: string;
  plannedWorkoutId?: string | null;
  blockId: string;
  exerciseName: string;
  catalogExerciseId?: string | null;
  /** Serie prescritte dalla scheda. */
  prescribedSets?: number | null;
  /** Righe già registrate per questo blocco (dal caricamento del giorno). */
  logged: ExerciseSetLogRow[];
  /** In scope coach/admin si guarda soltanto: registra chi si allena. */
  readOnly?: boolean;
  onSaved?: () => void;
};

type Draft = { reps: string; weight: string };

function toDraft(row: ExerciseSetLogRow | undefined): Draft {
  return {
    reps: row?.reps != null ? String(row.reps) : "",
    weight: row?.weightKg != null ? String(row.weightKg) : "",
  };
}

function parseField(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

/**
 * Registrazione di una serie: ripetizioni, carico, fatta o saltata.
 *
 * Perché il carico è qui e non solo nella scheda: il pianificatore non conosce i carichi
 * dell'atleta e li lascia vuoti — su 1.189 prescrizioni salvate, 1.185 hanno il peso nullo.
 * Quello che l'atleta scrive qui diventa lo storico su cui il coach potrà prescrivere.
 *
 * Riga assente ≠ serie saltata: finché non si tocca nulla la risposta è «non data».
 */
export function GymExerciseSetLogger({
  athleteId,
  date,
  plannedWorkoutId,
  blockId,
  exerciseName,
  catalogExerciseId,
  prescribedSets,
  logged,
  readOnly = false,
  onSaved,
}: GymExerciseSetLoggerProps) {
  const t = useTranslations("GymExerciseSetLogger");
  const db = useMemo(() => createEmpathyBrowserSupabase(), []);

  const byIndex = useMemo(() => {
    const m = new Map<number, ExerciseSetLogRow>();
    for (const r of logged) if (r.blockId === blockId) m.set(r.setIndex, r);
    return m;
  }, [logged, blockId]);

  const maxLogged = useMemo(() => Math.max(0, ...[...byIndex.keys()]), [byIndex]);
  const setCount = visibleSetCount(prescribedSets, maxLogged);

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Le bozze seguono il salvato: dopo un ricaricamento la schermata dice quello che c'è in tabella.
  useEffect(() => {
    const next: Record<string, Draft> = {};
    for (let i = 1; i <= setCount; i += 1) next[setLogKey(blockId, i)] = toDraft(byIndex.get(i));
    setDrafts(next);
  }, [byIndex, blockId, setCount]);

  const persist = useCallback(
    async (setIndex: number, patch: { reps?: number | null; weightKg?: number | null; done?: boolean }) => {
      if (!db || readOnly) return;
      const key = setLogKey(blockId, setIndex);
      const current = byIndex.get(setIndex);
      const draft = drafts[key] ?? toDraft(current);
      const reps = patch.reps !== undefined ? patch.reps : parseField(draft.reps);
      const weightKg = patch.weightKg !== undefined ? patch.weightKg : parseField(draft.weight);
      const done = patch.done !== undefined ? patch.done : (current?.done ?? true);

      if (Number.isNaN(reps) || Number.isNaN(weightKg)) {
        setError(t("notANumber"));
        return;
      }
      const invalid = validateSetLogRow({ setIndex, reps, weightKg });
      if (invalid) {
        setError(t(invalid === "reps" ? "repsOutOfRange" : invalid === "weight_kg" ? "weightOutOfRange" : "setOutOfRange"));
        return;
      }

      setBusy(key);
      setError(null);
      const res = await saveExerciseSet(db, {
        athleteId,
        date,
        plannedWorkoutId: plannedWorkoutId ?? null,
        blockId,
        setIndex,
        catalogExerciseId: catalogExerciseId ?? null,
        exerciseName,
        reps,
        weightKg,
        done,
      });
      setBusy(null);
      if (!res.ok) setError(t("saveFailed"));
      else onSaved?.();
    },
    [db, readOnly, blockId, byIndex, drafts, athleteId, date, plannedWorkoutId, catalogExerciseId, exerciseName, t, onSaved],
  );

  const forget = useCallback(
    async (setIndex: number) => {
      if (!db || readOnly) return;
      const key = setLogKey(blockId, setIndex);
      setBusy(key);
      setError(null);
      const res = await clearExerciseSet(db, { athleteId, date, blockId, setIndex });
      setBusy(null);
      if (!res.ok) setError(t("saveFailed"));
      else onSaved?.();
    },
    [db, readOnly, blockId, athleteId, date, t, onSaved],
  );

  if (!db) return null;

  return (
    <div className="mt-3 border-t border-orange-500/15 pt-3">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-orange-300/80">
        {readOnly ? t("titleReadOnly") : t("title")}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {Array.from({ length: setCount }, (_, i) => i + 1).map((setIndex) => {
          const key = setLogKey(blockId, setIndex);
          const row = byIndex.get(setIndex);
          const draft = drafts[key] ?? toDraft(row);
          const recorded = row != null;
          return (
            <li key={key} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="w-10 shrink-0 font-mono text-gray-500">{t("setLabel", { n: setIndex })}</span>
              <label className="flex items-center gap-1">
                <span className="sr-only">{t("repsLabel")}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  disabled={readOnly}
                  value={draft.reps}
                  placeholder={t("repsPlaceholder")}
                  onChange={(e) => setDrafts((d) => ({ ...d, [key]: { ...draft, reps: e.target.value } }))}
                  onBlur={() => void persist(setIndex, {})}
                  className="w-14 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-center tabular-nums text-gray-100 disabled:opacity-60"
                />
                <span className="text-gray-500">{t("repsUnit")}</span>
              </label>
              <label className="flex items-center gap-1">
                <span className="sr-only">{t("weightLabel")}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  disabled={readOnly}
                  value={draft.weight}
                  placeholder={t("weightPlaceholder")}
                  onChange={(e) => setDrafts((d) => ({ ...d, [key]: { ...draft, weight: e.target.value } }))}
                  onBlur={() => void persist(setIndex, {})}
                  className="w-16 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-center tabular-nums text-gray-100 disabled:opacity-60"
                />
                <span className="text-gray-500">kg</span>
              </label>
              {readOnly ? (
                <span className="text-[0.65rem] text-gray-500">
                  {recorded ? (row?.done ? t("stateDone") : t("stateSkipped")) : t("stateNoAnswer")}
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy === key}
                    onClick={() => void persist(setIndex, { done: !(row?.done ?? false) || !recorded })}
                    className={`rounded-lg border px-2 py-1 text-[0.65rem] transition ${
                      recorded && row?.done
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
                        : "border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
                    }`}
                  >
                    {recorded && row?.done ? t("markedDone") : t("markDone")}
                  </button>
                  <button
                    type="button"
                    disabled={busy === key}
                    onClick={() => void persist(setIndex, { done: false })}
                    className={`rounded-lg border px-2 py-1 text-[0.65rem] transition ${
                      recorded && row?.done === false
                        ? "border-amber-500/40 bg-amber-500/15 text-amber-100"
                        : "border-white/15 bg-white/5 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    {t("markSkipped")}
                  </button>
                  {recorded ? (
                    <button
                      type="button"
                      disabled={busy === key}
                      onClick={() => void forget(setIndex)}
                      className="rounded-lg px-1.5 py-1 text-[0.65rem] text-gray-500 underline decoration-dotted hover:text-gray-300"
                    >
                      {t("forget")}
                    </button>
                  ) : null}
                </>
              )}
            </li>
          );
        })}
      </ul>
      {error ? <p className="mt-2 text-[0.65rem] text-amber-300">{error}</p> : null}
    </div>
  );
}
