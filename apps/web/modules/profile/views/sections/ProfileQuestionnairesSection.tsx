"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { Pro2Button } from "@/components/ui/empathy";
import { profileToneForEditorSection } from "@/lib/profile/profile-page-kit";

/**
 * Sezione "Questionari" dell'editor profilo (5ª tab).
 *
 * Come Devices è AUTONOMA (DB-first, browser→Supabase): legge i questionari ATTIVI
 * (`questionnaires.is_active`, RLS select per tutti gli autenticati) + domande, e le
 * risposte dell'atleta attivo da `questionnaire_answers` (RLS: own / coach-read /
 * admin). Il salvataggio è SEPARATO dal submit del profilo — un bottone per
 * questionario, `type="button"` perché viviamo dentro la <form> dell'editor — e fa
 * UPSERT onConflict (athlete_id, question_id) con updated_at=now(): ULTIMA VINCE,
 * nessuno storico (decisione prodotto della migrazione 20260716000000).
 *
 * Permessi INVERTITI rispetto a canEditNutritionPercents: qui compila SOLO l'atleta;
 * coach/admin in scope atleta VEDONO le risposte in sola lettura (input disabled).
 */

type QuestionKind = "text" | "number" | "boolean" | "choice";

type QuestionnaireRow = {
  id: string;
  title: string;
  description: string | null;
};

type QuestionRow = {
  id: string;
  questionnaire_id: string;
  prompt: string;
  kind: QuestionKind;
  options: string[];
  required: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";

function isQuestionKind(value: string): value is QuestionKind {
  return value === "text" || value === "number" || value === "boolean" || value === "choice";
}

/** jsonb → stringa di draft per gli input (boolean → "true"/"false"). */
function answerValueToDraft(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return "";
}

/** Draft → valore jsonb tipizzato per kind; null = risposta vuota/invalida (non salvare). */
function draftToAnswerValue(kind: QuestionKind, draft: string): string | number | boolean | null {
  const trimmed = draft.trim();
  if (!trimmed) return null;
  if (kind === "number") {
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  if (kind === "boolean") {
    if (trimmed !== "true" && trimmed !== "false") return null;
    return trimmed === "true";
  }
  return trimmed;
}

export function ProfileQuestionnairesSection({
  athleteId,
  readOnly,
}: {
  athleteId: string | null;
  /** true in scope coach/admin: il coach VEDE, non compila. */
  readOnly: boolean;
}) {
  const t = useTranslations("ProfileQuestionnairesSection");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});

  useEffect(() => {
    if (!athleteId) {
      setQuestionnaires([]);
      setQuestions([]);
      setDrafts({});
      setLoading(false);
      return;
    }
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      setLoadError(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    void (async () => {
      const [qnRes, quRes, ansRes] = await Promise.all([
        supabase
          .from("questionnaires")
          .select("id, title, description")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("questionnaire_questions")
          .select("id, questionnaire_id, prompt, kind, options, required")
          .order("sort_order", { ascending: true }),
        supabase.from("questionnaire_answers").select("question_id, value").eq("athlete_id", athleteId),
      ]);
      if (cancelled) return;
      if (qnRes.error || quRes.error || ansRes.error) {
        setLoadError(true);
        setLoading(false);
        return;
      }
      const activeQuestionnaires = (qnRes.data ?? []) as QuestionnaireRow[];
      const activeIds = new Set(activeQuestionnaires.map((q) => q.id));
      const parsedQuestions: QuestionRow[] = ((quRes.data ?? []) as {
        id: string;
        questionnaire_id: string;
        prompt: string;
        kind: string;
        options: unknown;
        required: boolean;
      }[])
        .filter((row) => activeIds.has(row.questionnaire_id) && isQuestionKind(row.kind))
        .map((row) => ({
          id: row.id,
          questionnaire_id: row.questionnaire_id,
          prompt: row.prompt,
          kind: row.kind as QuestionKind,
          options: Array.isArray(row.options) ? row.options.map((o) => String(o)) : [],
          required: Boolean(row.required),
        }));
      const nextDrafts: Record<string, string> = {};
      for (const row of (ansRes.data ?? []) as { question_id: string; value: unknown }[]) {
        nextDrafts[row.question_id] = answerValueToDraft(row.value);
      }
      setQuestionnaires(activeQuestionnaires);
      setQuestions(parsedQuestions);
      setDrafts(nextDrafts);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  function setDraft(questionId: string, questionnaireId: string, value: string) {
    setDrafts((prev) => ({ ...prev, [questionId]: value }));
    // Nuove modifiche invalidano il "salvato ✓" del questionario.
    setSaveStates((prev) => (prev[questionnaireId] === "saved" ? { ...prev, [questionnaireId]: "idle" } : prev));
  }

  async function saveQuestionnaire(questionnaireId: string) {
    if (!athleteId || readOnly) return;
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) return;
    const nowIso = new Date().toISOString();
    const rows = questions
      .filter((q) => q.questionnaire_id === questionnaireId)
      .map((q) => ({ question: q, value: draftToAnswerValue(q.kind, drafts[q.id] ?? "") }))
      .filter((entry) => entry.value !== null)
      .map((entry) => ({
        athlete_id: athleteId,
        question_id: entry.question.id,
        value: entry.value,
        updated_at: nowIso,
      }));
    setSaveStates((prev) => ({ ...prev, [questionnaireId]: "saving" }));
    if (rows.length === 0) {
      setSaveStates((prev) => ({ ...prev, [questionnaireId]: "saved" }));
      return;
    }
    const { error } = await supabase
      .from("questionnaire_answers")
      .upsert(rows, { onConflict: "athlete_id,question_id" });
    setSaveStates((prev) => ({ ...prev, [questionnaireId]: error ? "error" : "saved" }));
  }

  const tone = profileToneForEditorSection("questionnaires");

  return (
    <div>
      <h3 className={`profile-section-band tone-${tone}`}>
        <span className="profile-kpi-dot" />
        {t("sectionTitle")}
      </h3>
      <p className="mb-3 text-xs text-gray-400">{readOnly ? t("readOnlyHint") : t("sectionHint")}</p>

      {loading ? (
        <p className="muted-copy text-sm">{t("loading")}</p>
      ) : loadError ? (
        <p className="text-sm text-rose-400/90">{t("loadError")}</p>
      ) : questionnaires.length === 0 ? (
        <p className="muted-copy text-sm">{t("noQuestionnaires")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {questionnaires.map((questionnaire) => {
            const questionnaireQuestions = questions.filter((q) => q.questionnaire_id === questionnaire.id);
            const saveState = saveStates[questionnaire.id] ?? "idle";
            return (
              <div key={questionnaire.id} className={`profile-subpanel tone-${tone}`}>
                <h4 className="profile-editor-subtitle">
                  <span className="profile-kpi-dot" />
                  {questionnaire.title}
                </h4>
                {questionnaire.description ? <p className="muted-copy text-sm">{questionnaire.description}</p> : null}

                {questionnaireQuestions.length === 0 ? (
                  <p className="muted-copy mt-2 text-sm">{t("noQuestions")}</p>
                ) : (
                  <div className="mt-3 flex flex-col gap-3">
                    {questionnaireQuestions.map((question) => {
                      const draft = drafts[question.id] ?? "";
                      const label = (
                        <label className="form-label">
                          {question.prompt}
                          {question.required ? <span className="text-rose-300"> *</span> : null}
                        </label>
                      );
                      if (question.kind === "text") {
                        return (
                          <div key={question.id} className="form-group">
                            {label}
                            <textarea
                              className="form-input"
                              rows={2}
                              value={draft}
                              disabled={readOnly}
                              onChange={(e) => setDraft(question.id, questionnaire.id, e.target.value)}
                            />
                          </div>
                        );
                      }
                      if (question.kind === "number") {
                        return (
                          <div key={question.id} className="form-group">
                            {label}
                            <input
                              type="number"
                              className="form-input"
                              value={draft}
                              disabled={readOnly}
                              onChange={(e) => setDraft(question.id, questionnaire.id, e.target.value)}
                            />
                          </div>
                        );
                      }
                      if (question.kind === "boolean") {
                        return (
                          <div key={question.id} className="form-group">
                            {label}
                            <select
                              className="form-select"
                              value={draft}
                              disabled={readOnly}
                              onChange={(e) => setDraft(question.id, questionnaire.id, e.target.value)}
                            >
                              <option value="">—</option>
                              <option value="true">{t("yes")}</option>
                              <option value="false">{t("no")}</option>
                            </select>
                          </div>
                        );
                      }
                      // kind === "choice"
                      return (
                        <div key={question.id} className="form-group">
                          {label}
                          <select
                            className="form-select"
                            value={draft}
                            disabled={readOnly}
                            onChange={(e) => setDraft(question.id, questionnaire.id, e.target.value)}
                          >
                            <option value="">{t("selectPlaceholder")}</option>
                            {question.options.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!readOnly && questionnaireQuestions.length > 0 ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {/* type=button OBBLIGATORIO: siamo dentro la <form> dell'editor profilo,
                        un submit implicito farebbe partire "Aggiorna profilo". */}
                    <Pro2Button
                      type="button"
                      variant="secondary"
                      disabled={saveState === "saving"}
                      className="border border-emerald-500/35 bg-emerald-500/10 text-emerald-50 hover:bg-emerald-500/20"
                      onClick={() => void saveQuestionnaire(questionnaire.id)}
                    >
                      {saveState === "saving" ? t("saving") : t("save")}
                    </Pro2Button>
                    {saveState === "saved" ? <span className="text-sm text-emerald-300/90">{t("saved")}</span> : null}
                    {saveState === "error" ? <span className="text-sm text-rose-400/90">{t("saveError")}</span> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
