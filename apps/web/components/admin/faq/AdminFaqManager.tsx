"use client";

import { useCallback, useEffect, useState } from "react";

type FaqEntry = {
  id: string;
  questionIt: string;
  answerIt: string;
  questionEn: string;
  answerEn: string;
  questionTr: string;
  answerTr: string;
  questionDe: string;
  answerDe: string;
  questionFr: string;
  answerFr: string;
  category: string | null;
  sortOrder: number;
  published: boolean;
};

type Draft = {
  questionIt: string;
  answerIt: string;
  questionEn: string;
  answerEn: string;
  questionTr: string;
  answerTr: string;
  questionDe: string;
  answerDe: string;
  questionFr: string;
  answerFr: string;
  category: string;
  sortOrder: number;
  published: boolean;
};

const EMPTY_DRAFT: Draft = {
  questionIt: "",
  answerIt: "",
  questionEn: "",
  answerEn: "",
  questionTr: "",
  answerTr: "",
  questionDe: "",
  answerDe: "",
  questionFr: "",
  answerFr: "",
  category: "",
  sortOrder: 0,
  published: true,
};

/** Lingue editabili della FAQ (allineate alle colonne DB + lingue vetrina). */
const LANGS: { label: string; q: keyof Draft; a: keyof Draft }[] = [
  { label: "Italiano", q: "questionIt", a: "answerIt" },
  { label: "English", q: "questionEn", a: "answerEn" },
  { label: "Türkçe", q: "questionTr", a: "answerTr" },
  { label: "Deutsch", q: "questionDe", a: "answerDe" },
  { label: "Français", q: "questionFr", a: "answerFr" },
];

const inputCls =
  "w-full rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-gray-100 outline-none focus:border-pink-400/50 disabled:opacity-50";

/** Gestione FAQ della vetrina (platform admin): CRUD bilingue IT/EN + ordine + pubblicazione. */
export function AdminFaqManager() {
  const [items, setItems] = useState<FaqEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/faq", { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; items?: FaqEntry[] };
    if (data.ok && data.items) setItems(data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startNew = () => {
    setDraft({ ...EMPTY_DRAFT, sortOrder: items.length });
    setEditing("new");
    setMsg(null);
  };
  const startEdit = (it: FaqEntry) => {
    setDraft({
      questionIt: it.questionIt,
      answerIt: it.answerIt,
      questionEn: it.questionEn,
      answerEn: it.answerEn,
      questionTr: it.questionTr,
      answerTr: it.answerTr,
      questionDe: it.questionDe,
      answerDe: it.answerDe,
      questionFr: it.questionFr,
      answerFr: it.answerFr,
      category: it.category ?? "",
      sortOrder: it.sortOrder,
      published: it.published,
    });
    setEditing(it.id);
    setMsg(null);
  };
  const setField =
    (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((d) => ({ ...d, [k]: k === "sortOrder" ? Number(e.target.value) : e.target.value }));

  const save = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const isNew = editing === "new";
      const res = await fetch(isNew ? "/api/admin/faq" : `/api/admin/faq/${editing}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMsg({ ok: false, text: data.error ?? "Salvataggio non riuscito." });
        return;
      }
      setEditing(null);
      await load();
    } finally {
      setBusy(false);
    }
  }, [draft, editing, load]);

  const remove = useCallback(
    async (id: string) => {
      if (!window.confirm("Eliminare questa FAQ?")) return;
      setBusy(true);
      try {
        await fetch(`/api/admin/faq/${id}`, { method: "DELETE" });
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const togglePublished = useCallback(
    async (it: FaqEntry) => {
      setBusy(true);
      try {
        await fetch(`/api/admin/faq/${it.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ published: !it.published }),
        });
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const editor = (
    <div className="space-y-2 rounded-xl border border-pink-400/20 bg-white/[0.03] p-4">
      <div className="grid gap-2 md:grid-cols-2">
        {LANGS.map((l) => (
          <div key={l.q} className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">{l.label}</p>
            <input className={inputCls} placeholder={`Domanda (${l.label})`} value={draft[l.q] as string} onChange={setField(l.q)} disabled={busy} />
            <textarea className={`${inputCls} min-h-[90px]`} placeholder={`Risposta (${l.label})`} value={draft[l.a] as string} onChange={setField(l.a)} disabled={busy} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input className={`${inputCls} max-w-[160px]`} placeholder="Categoria" value={draft.category} onChange={setField("category")} disabled={busy} />
        <label className="flex items-center gap-1.5 text-xs text-gray-400">
          Ordine
          <input className={`${inputCls} w-16`} type="number" value={draft.sortOrder} onChange={setField("sortOrder")} disabled={busy} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-300">
          <input type="checkbox" checked={draft.published} onChange={(e) => setDraft((d) => ({ ...d, published: e.target.checked }))} disabled={busy} />
          Pubblicata
        </label>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setEditing(null)} disabled={busy} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gray-300 hover:text-white disabled:opacity-40">
            Annulla
          </button>
          <button type="button" onClick={() => void save()} disabled={busy} className="rounded-lg border border-pink-400/30 bg-pink-400/10 px-3 py-1.5 text-xs font-medium text-pink-200 hover:bg-pink-400/20 disabled:opacity-40">
            {busy ? "Salvataggio…" : "Salva"}
          </button>
        </div>
      </div>
      {msg ? <p className={`text-[11px] ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p> : null}
    </div>
  );

  if (loading) return <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-xs text-gray-500">Caricamento…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{items.length} FAQ · usa il numero per ordinare, IT ed EN separati.</p>
        <button type="button" onClick={startNew} disabled={editing === "new"} className="rounded-lg border border-pink-400/30 bg-pink-400/10 px-3 py-1.5 text-xs font-medium text-pink-200 hover:bg-pink-400/20 disabled:opacity-40">
          + Aggiungi FAQ
        </button>
      </div>

      {editing === "new" ? editor : null}

      <div className="space-y-2">
        {items.map((it) =>
          editing === it.id ? (
            <div key={it.id}>{editor}</div>
          ) : (
            <div key={it.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{it.questionIt || it.questionEn || "—"}</p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">{it.questionEn || "—"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                    <span className="font-mono">#{it.sortOrder}</span>
                    {it.category ? <span className="rounded-full border border-white/10 px-2 py-0.5">{it.category}</span> : null}
                    <button type="button" onClick={() => void togglePublished(it)} disabled={busy} className={it.published ? "text-emerald-400" : "text-gray-500"}>
                      {it.published ? "● pubblicata" : "○ bozza"}
                    </button>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => startEdit(it)} className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-gray-300 hover:text-white">
                    Modifica
                  </button>
                  <button type="button" onClick={() => void remove(it.id)} disabled={busy} className="rounded-lg border border-red-400/25 px-2.5 py-1 text-xs text-red-300 hover:bg-red-400/10 disabled:opacity-40">
                    Elimina
                  </button>
                </div>
              </div>
            </div>
          ),
        )}
        {items.length === 0 && editing !== "new" ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-xs text-gray-500">Nessuna FAQ. Aggiungine una.</p>
        ) : null}
      </div>
    </div>
  );
}
