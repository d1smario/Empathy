"use client";

import { useCallback, useEffect, useState } from "react";

type QuestionKind = "text" | "number" | "boolean" | "choice";

type Question = {
  id: string;
  prompt: string;
  kind: QuestionKind;
  options: string[] | null;
  required: boolean;
  sortOrder: number;
};

type Questionnaire = {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  questions: Question[];
};

type QuestionnaireDraft = {
  title: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
};

type QuestionDraft = {
  prompt: string;
  kind: QuestionKind;
  optionsText: string;
  required: boolean;
  sortOrder: number;
};

const EMPTY_QUESTIONNAIRE: QuestionnaireDraft = { title: "", description: "", isActive: true, sortOrder: 100 };
const EMPTY_QUESTION: QuestionDraft = { prompt: "", kind: "text", optionsText: "", required: false, sortOrder: 100 };

const KIND_LABELS: Record<QuestionKind, string> = {
  text: "Testo",
  number: "Numero",
  boolean: "Sì/No",
  choice: "Scelta",
};

const inputCls =
  "w-full rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-gray-100 outline-none focus:border-pink-400/50 disabled:opacity-50";
const primaryBtnCls =
  "rounded-lg border border-pink-400/30 bg-pink-400/10 px-3 py-1.5 text-xs font-medium text-pink-200 hover:bg-pink-400/20 disabled:opacity-40";
const secondaryBtnCls =
  "rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gray-300 hover:text-white disabled:opacity-40";

/** Converte il testo dell'editor opzioni (una per riga) in array per l'API. */
function parseOptionsText(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Gestione questionari (platform admin): CRUD questionari e domande. Risposte atleta: ultima-vince. */
export function AdminQuestionnairesManager() {
  const [items, setItems] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [editingQuestionnaire, setEditingQuestionnaire] = useState<string | "new" | null>(null);
  const [questionnaireDraft, setQuestionnaireDraft] = useState<QuestionnaireDraft>(EMPTY_QUESTIONNAIRE);

  const [openQuestionnaire, setOpenQuestionnaire] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<string | "new" | null>(null);
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>(EMPTY_QUESTION);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/questionnaires", { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; items?: Questionnaire[] };
    if (data.ok && data.items) setItems(data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Questionari ─────────────────────────────────────────────────────────────

  const startNewQuestionnaire = () => {
    setQuestionnaireDraft({ ...EMPTY_QUESTIONNAIRE, sortOrder: (items.length + 1) * 100 });
    setEditingQuestionnaire("new");
    setMsg(null);
  };

  const startEditQuestionnaire = (q: Questionnaire) => {
    setQuestionnaireDraft({
      title: q.title,
      description: q.description ?? "",
      isActive: q.isActive,
      sortOrder: q.sortOrder,
    });
    setEditingQuestionnaire(q.id);
    setMsg(null);
  };

  const saveQuestionnaire = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const isNew = editingQuestionnaire === "new";
      const res = await fetch(isNew ? "/api/admin/questionnaires" : `/api/admin/questionnaires/${editingQuestionnaire}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(questionnaireDraft),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMsg({ ok: false, text: data.error ?? "Salvataggio non riuscito." });
        return;
      }
      setEditingQuestionnaire(null);
      await load();
    } finally {
      setBusy(false);
    }
  }, [editingQuestionnaire, questionnaireDraft, load]);

  const removeQuestionnaire = useCallback(
    async (id: string) => {
      if (!window.confirm("Eliminare il questionario? Verranno eliminate anche domande e risposte.")) return;
      setBusy(true);
      try {
        await fetch(`/api/admin/questionnaires/${id}`, { method: "DELETE" });
        if (openQuestionnaire === id) setOpenQuestionnaire(null);
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load, openQuestionnaire],
  );

  const toggleActive = useCallback(
    async (q: Questionnaire) => {
      setBusy(true);
      try {
        await fetch(`/api/admin/questionnaires/${q.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ isActive: !q.isActive }),
        });
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  // ── Domande ─────────────────────────────────────────────────────────────────

  const startNewQuestion = (questionnaire: Questionnaire) => {
    setQuestionDraft({ ...EMPTY_QUESTION, sortOrder: (questionnaire.questions.length + 1) * 100 });
    setEditingQuestion("new");
    setMsg(null);
  };

  const startEditQuestion = (q: Question) => {
    setQuestionDraft({
      prompt: q.prompt,
      kind: q.kind,
      optionsText: (q.options ?? []).join("\n"),
      required: q.required,
      sortOrder: q.sortOrder,
    });
    setEditingQuestion(q.id);
    setMsg(null);
  };

  const saveQuestion = useCallback(
    async (questionnaireId: string) => {
      setBusy(true);
      setMsg(null);
      try {
        const isNew = editingQuestion === "new";
        const payload = {
          prompt: questionDraft.prompt,
          kind: questionDraft.kind,
          options: questionDraft.kind === "choice" ? parseOptionsText(questionDraft.optionsText) : null,
          required: questionDraft.required,
          sortOrder: questionDraft.sortOrder,
        };
        const res = await fetch(
          isNew
            ? `/api/admin/questionnaires/${questionnaireId}/questions`
            : `/api/admin/questionnaires/questions/${editingQuestion}`,
          {
            method: isNew ? "POST" : "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setMsg({ ok: false, text: data.error ?? "Salvataggio non riuscito." });
          return;
        }
        setEditingQuestion(null);
        await load();
      } finally {
        setBusy(false);
      }
    },
    [editingQuestion, questionDraft, load],
  );

  const removeQuestion = useCallback(
    async (id: string) => {
      if (!window.confirm("Eliminare la domanda? Verranno eliminate anche le risposte degli atleti.")) return;
      setBusy(true);
      try {
        await fetch(`/api/admin/questionnaires/questions/${id}`, { method: "DELETE" });
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  // ── Editor ──────────────────────────────────────────────────────────────────

  const questionnaireEditor = (
    <div className="space-y-2 rounded-xl border border-pink-400/20 bg-white/[0.03] p-4">
      <input
        className={inputCls}
        placeholder="Titolo del questionario"
        value={questionnaireDraft.title}
        onChange={(e) => setQuestionnaireDraft((d) => ({ ...d, title: e.target.value }))}
        disabled={busy}
      />
      <textarea
        className={`${inputCls} min-h-[60px]`}
        placeholder="Descrizione (facoltativa)"
        value={questionnaireDraft.description}
        onChange={(e) => setQuestionnaireDraft((d) => ({ ...d, description: e.target.value }))}
        disabled={busy}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-gray-400">
          Ordine
          <input
            className={`${inputCls} w-20`}
            type="number"
            value={questionnaireDraft.sortOrder}
            onChange={(e) => setQuestionnaireDraft((d) => ({ ...d, sortOrder: Number(e.target.value) }))}
            disabled={busy}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={questionnaireDraft.isActive}
            onChange={(e) => setQuestionnaireDraft((d) => ({ ...d, isActive: e.target.checked }))}
            disabled={busy}
          />
          Attivo (visibile agli atleti)
        </label>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setEditingQuestionnaire(null)} disabled={busy} className={secondaryBtnCls}>
            Annulla
          </button>
          <button type="button" onClick={() => void saveQuestionnaire()} disabled={busy} className={primaryBtnCls}>
            {busy ? "Salvataggio…" : "Salva"}
          </button>
        </div>
      </div>
      {msg ? <p className={`text-[11px] ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p> : null}
    </div>
  );

  const questionEditor = (questionnaireId: string) => (
    <div className="space-y-2 rounded-xl border border-pink-400/20 bg-white/[0.03] p-3">
      <input
        className={inputCls}
        placeholder="Testo della domanda"
        value={questionDraft.prompt}
        onChange={(e) => setQuestionDraft((d) => ({ ...d, prompt: e.target.value }))}
        disabled={busy}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-gray-400">
          Tipo
          <select
            className={`${inputCls} w-auto`}
            value={questionDraft.kind}
            onChange={(e) => setQuestionDraft((d) => ({ ...d, kind: e.target.value as QuestionKind }))}
            disabled={busy}
          >
            {(Object.keys(KIND_LABELS) as QuestionKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-400">
          Ordine
          <input
            className={`${inputCls} w-20`}
            type="number"
            value={questionDraft.sortOrder}
            onChange={(e) => setQuestionDraft((d) => ({ ...d, sortOrder: Number(e.target.value) }))}
            disabled={busy}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={questionDraft.required}
            onChange={(e) => setQuestionDraft((d) => ({ ...d, required: e.target.checked }))}
            disabled={busy}
          />
          Obbligatoria
        </label>
      </div>
      {questionDraft.kind === "choice" ? (
        <textarea
          className={`${inputCls} min-h-[70px]`}
          placeholder={"Opzioni: una per riga (almeno 2)"}
          value={questionDraft.optionsText}
          onChange={(e) => setQuestionDraft((d) => ({ ...d, optionsText: e.target.value }))}
          disabled={busy}
        />
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setEditingQuestion(null)} disabled={busy} className={secondaryBtnCls}>
          Annulla
        </button>
        <button type="button" onClick={() => void saveQuestion(questionnaireId)} disabled={busy} className={primaryBtnCls}>
          {busy ? "Salvataggio…" : "Salva domanda"}
        </button>
      </div>
      {msg ? <p className={`text-[11px] ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p> : null}
    </div>
  );

  if (loading) {
    return <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-xs text-gray-500">Caricamento…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {items.length} questionari · l&apos;atleta risponde una sola volta, la risposta si sovrascrive (ultima-vince).
        </p>
        <button type="button" onClick={startNewQuestionnaire} disabled={editingQuestionnaire === "new"} className={primaryBtnCls}>
          + Nuovo questionario
        </button>
      </div>

      {editingQuestionnaire === "new" ? questionnaireEditor : null}

      <div className="space-y-2">
        {items.map((q) =>
          editingQuestionnaire === q.id ? (
            <div key={q.id}>{questionnaireEditor}</div>
          ) : (
            <div key={q.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{q.title}</p>
                  {q.description ? <p className="mt-0.5 truncate text-xs text-gray-500">{q.description}</p> : null}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                    <span className="font-mono">#{q.sortOrder}</span>
                    <span>{q.questions.length} domande</span>
                    <button type="button" onClick={() => void toggleActive(q)} disabled={busy} className={q.isActive ? "text-emerald-400" : "text-gray-500"}>
                      {q.isActive ? "● attivo" : "○ non attivo"}
                    </button>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenQuestionnaire((cur) => (cur === q.id ? null : q.id));
                      setEditingQuestion(null);
                      setMsg(null);
                    }}
                    className={secondaryBtnCls}
                  >
                    {openQuestionnaire === q.id ? "Chiudi domande" : "Domande"}
                  </button>
                  <button type="button" onClick={() => startEditQuestionnaire(q)} className={secondaryBtnCls}>
                    Modifica
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeQuestionnaire(q.id)}
                    disabled={busy}
                    className="rounded-lg border border-red-400/25 px-2.5 py-1 text-xs text-red-300 hover:bg-red-400/10 disabled:opacity-40"
                  >
                    Elimina
                  </button>
                </div>
              </div>

              {openQuestionnaire === q.id ? (
                <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-wider text-gray-500">Domande</p>
                    <button type="button" onClick={() => startNewQuestion(q)} disabled={editingQuestion === "new"} className={primaryBtnCls}>
                      + Aggiungi domanda
                    </button>
                  </div>
                  {editingQuestion === "new" ? questionEditor(q.id) : null}
                  {q.questions.map((question) =>
                    editingQuestion === question.id ? (
                      <div key={question.id}>{questionEditor(q.id)}</div>
                    ) : (
                      <div key={question.id} className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs text-gray-100">{question.prompt}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                            <span className="font-mono">#{question.sortOrder}</span>
                            <span className="rounded-full border border-white/10 px-2 py-0.5">{KIND_LABELS[question.kind]}</span>
                            {question.kind === "choice" && question.options ? <span className="truncate">{question.options.join(" · ")}</span> : null}
                            {question.required ? <span className="text-amber-300">obbligatoria</span> : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button type="button" onClick={() => startEditQuestion(question)} className={secondaryBtnCls}>
                            Modifica
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeQuestion(question.id)}
                            disabled={busy}
                            className="rounded-lg border border-red-400/25 px-2.5 py-1 text-xs text-red-300 hover:bg-red-400/10 disabled:opacity-40"
                          >
                            Elimina
                          </button>
                        </div>
                      </div>
                    ),
                  )}
                  {q.questions.length === 0 && editingQuestion !== "new" ? (
                    <p className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-center text-xs text-gray-500">
                      Nessuna domanda. Aggiungine una.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ),
        )}
        {items.length === 0 && editingQuestionnaire !== "new" ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-xs text-gray-500">
            Nessun questionario. Creane uno.
          </p>
        ) : null}
      </div>
    </div>
  );
}
