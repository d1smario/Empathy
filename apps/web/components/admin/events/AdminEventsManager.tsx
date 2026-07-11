"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type EventEntry = {
  id: string;
  titleIt: string;
  titleEn: string;
  bodyIt: string;
  bodyEn: string;
  imageUrl: string | null;
  eventDate: string | null;
  location: string | null;
  ctaUrl: string | null;
  sortOrder: number;
  published: boolean;
};

type Draft = {
  titleIt: string;
  titleEn: string;
  bodyIt: string;
  bodyEn: string;
  imageUrl: string;
  eventDate: string; // datetime-local
  location: string;
  ctaUrl: string;
  sortOrder: number;
  published: boolean;
};

const EMPTY_DRAFT: Draft = {
  titleIt: "",
  titleEn: "",
  bodyIt: "",
  bodyEn: "",
  imageUrl: "",
  eventDate: "",
  location: "",
  ctaUrl: "",
  sortOrder: 0,
  published: true,
};

const inputCls =
  "w-full rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-gray-100 outline-none focus:border-rose-400/50 disabled:opacity-50";

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-CH", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

/** Gestione "Prossimi eventi" della vetrina (platform admin): blog IT/EN + immagine. */
export function AdminEventsManager() {
  const [items, setItems] = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/events", { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; items?: EventEntry[] };
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
  const startEdit = (it: EventEntry) => {
    setDraft({
      titleIt: it.titleIt,
      titleEn: it.titleEn,
      bodyIt: it.bodyIt,
      bodyEn: it.bodyEn,
      imageUrl: it.imageUrl ?? "",
      eventDate: isoToLocalInput(it.eventDate),
      location: it.location ?? "",
      ctaUrl: it.ctaUrl ?? "",
      sortOrder: it.sortOrder,
      published: it.published,
    });
    setEditing(it.id);
    setMsg(null);
  };
  const setField =
    (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((d) => ({ ...d, [k]: k === "sortOrder" ? Number(e.target.value) : e.target.value }));

  const uploadImage = useCallback(async (file: File) => {
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/events/upload-image", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; publicUrl?: string; error?: string };
      if (!res.ok || !data.ok || !data.publicUrl) {
        setMsg({ ok: false, text: data.error ?? "Upload non riuscito." });
        return;
      }
      setDraft((d) => ({ ...d, imageUrl: data.publicUrl! }));
    } finally {
      setUploading(false);
    }
  }, []);

  const save = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const isNew = editing === "new";
      const payload = {
        ...draft,
        eventDate: draft.eventDate ? new Date(draft.eventDate).toISOString() : "",
      };
      const res = await fetch(isNew ? "/api/admin/events" : `/api/admin/events/${editing}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
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
      if (!window.confirm("Eliminare questo evento?")) return;
      setBusy(true);
      try {
        await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const togglePublished = useCallback(
    async (it: EventEntry) => {
      setBusy(true);
      try {
        await fetch(`/api/admin/events/${it.id}`, {
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
    <div className="space-y-3 rounded-xl border border-rose-400/20 bg-white/[0.03] p-4">
      {/* immagine */}
      <div className="flex items-center gap-3">
        {draft.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={draft.imageUrl} alt="" className="h-16 w-24 rounded-lg border border-white/10 object-cover" />
        ) : (
          <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-dashed border-white/15 text-[10px] text-gray-500">
            nessuna
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadImage(f);
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || busy} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gray-300 hover:text-white disabled:opacity-40">
            {uploading ? "Caricamento…" : draft.imageUrl ? "Cambia immagine" : "Carica immagine"}
          </button>
          {draft.imageUrl ? (
            <button type="button" onClick={() => setDraft((d) => ({ ...d, imageUrl: "" }))} disabled={busy} className="text-left text-[11px] text-red-300 hover:underline">
              Rimuovi
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">Italiano</p>
          <input className={inputCls} placeholder="Titolo (IT)" value={draft.titleIt} onChange={setField("titleIt")} disabled={busy} />
          <textarea className={`${inputCls} min-h-[90px]`} placeholder="Descrizione (IT)" value={draft.bodyIt} onChange={setField("bodyIt")} disabled={busy} />
        </div>
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">English</p>
          <input className={inputCls} placeholder="Title (EN)" value={draft.titleEn} onChange={setField("titleEn")} disabled={busy} />
          <textarea className={`${inputCls} min-h-[90px]`} placeholder="Description (EN)" value={draft.bodyEn} onChange={setField("bodyEn")} disabled={busy} />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[11px] text-gray-400">
          Data e ora
          <input className={inputCls} type="datetime-local" value={draft.eventDate} onChange={setField("eventDate")} disabled={busy} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-gray-400">
          Luogo
          <input className={inputCls} placeholder="Es. Lugano · online" value={draft.location} onChange={setField("location")} disabled={busy} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-gray-400">
          Link (opzionale)
          <input className={inputCls} placeholder="https://…" value={draft.ctaUrl} onChange={setField("ctaUrl")} disabled={busy} />
        </label>
        <div className="flex items-end gap-4">
          <label className="flex items-center gap-1.5 text-xs text-gray-400">
            Ordine
            <input className={`${inputCls} w-16`} type="number" value={draft.sortOrder} onChange={setField("sortOrder")} disabled={busy} />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-300">
            <input type="checkbox" checked={draft.published} onChange={(e) => setDraft((d) => ({ ...d, published: e.target.checked }))} disabled={busy} />
            Pubblicato
          </label>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {msg ? <p className={`text-[11px] ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p> : null}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setEditing(null)} disabled={busy} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gray-300 hover:text-white disabled:opacity-40">
            Annulla
          </button>
          <button type="button" onClick={() => void save()} disabled={busy || uploading} className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-400/20 disabled:opacity-40">
            {busy ? "Salvataggio…" : "Salva"}
          </button>
        </div>
      </div>
    </div>
  );

  if (loading) return <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-xs text-gray-500">Caricamento…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{items.length} eventi · compaiono su <span className="font-mono text-gray-400">/faq</span> in &quot;Prossimi eventi&quot;.</p>
        <button type="button" onClick={startNew} disabled={editing === "new"} className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-400/20 disabled:opacity-40">
          + Nuovo evento
        </button>
      </div>

      {editing === "new" ? editor : null}

      <div className="space-y-2">
        {items.map((it) =>
          editing === it.id ? (
            <div key={it.id}>{editor}</div>
          ) : (
            <div key={it.id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              {it.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.imageUrl} alt="" className="h-14 w-20 shrink-0 rounded-lg border border-white/10 object-cover" />
              ) : (
                <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/10 text-[10px] text-gray-600">img</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{it.titleIt || it.titleEn || "—"}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                  <span className="font-mono">#{it.sortOrder}</span>
                  <span>{fmtDate(it.eventDate)}</span>
                  {it.location ? <span className="rounded-full border border-white/10 px-2 py-0.5">{it.location}</span> : null}
                  <button type="button" onClick={() => void togglePublished(it)} disabled={busy} className={it.published ? "text-emerald-400" : "text-gray-500"}>
                    {it.published ? "● pubblicato" : "○ bozza"}
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
          ),
        )}
        {items.length === 0 && editing !== "new" ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-xs text-gray-500">Nessun evento. Creane uno.</p>
        ) : null}
      </div>
    </div>
  );
}
