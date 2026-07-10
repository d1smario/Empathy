"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Submission = {
  id: string;
  kind: "contact" | "collaborate";
  name: string;
  email: string;
  message: string;
  meta: Record<string, unknown>;
  status: "new" | "read" | "archived";
  createdAt: string | null;
};

type Filter = "all" | "contact" | "collaborate";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("it-CH", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

/** Elenco submission Contatti / Collabora (platform admin): filtro, dettaglio, stato. */
export function AdminContactList() {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/contact", { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; items?: Submission[] };
    if (data.ok && data.items) setItems(data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = useCallback(
    async (id: string, status: Submission["status"]) => {
      setBusy(id);
      try {
        await fetch("/api/admin/contact", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, status }),
        });
        setItems((list) => list.map((it) => (it.id === id ? { ...it, status } : it)));
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const filtered = useMemo(() => (filter === "all" ? items : items.filter((it) => it.kind === filter)), [items, filter]);
  const newCount = items.filter((it) => it.status === "new").length;

  if (loading) return <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-xs text-gray-500">Caricamento…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "contact", "collaborate"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f ? "border-pink-400/40 bg-pink-400/10 text-pink-200" : "border-white/10 text-gray-400 hover:text-white"
            }`}
          >
            {f === "all" ? "Tutti" : f === "contact" ? "Contatti" : "Collabora"}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-500">
          {filtered.length} messaggi · <span className="text-amber-300">{newCount} nuovi</span>
        </span>
      </div>

      <div className="space-y-2">
        {filtered.map((it) => (
          <div
            key={it.id}
            className={`rounded-xl border bg-white/[0.02] p-4 ${it.status === "new" ? "border-amber-400/25" : "border-white/10"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${it.kind === "collaborate" ? "border-violet-400/30 bg-violet-400/10 text-violet-300" : "border-cyan-400/30 bg-cyan-400/10 text-cyan-300"}`}>
                    {it.kind === "collaborate" ? "Collabora" : "Contatto"}
                  </span>
                  <span className="text-sm font-semibold text-white">{it.name || "—"}</span>
                  <a href={`mailto:${it.email}`} className="text-xs text-pink-300 underline-offset-2 hover:underline">
                    {it.email}
                  </a>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-300">{it.message}</p>
                {Object.keys(it.meta ?? {}).length > 0 ? (
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                    {Object.entries(it.meta).map(([k, v]) => (
                      <span key={k}>
                        <span className="text-gray-600">{k}:</span> {String(v)}
                      </span>
                    ))}
                  </p>
                ) : null}
                <p className="mt-2 text-[11px] text-gray-600">{fmt(it.createdAt)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="text-[11px] text-gray-500">
                  {it.status === "new" ? "🟡 nuovo" : it.status === "read" ? "✓ letto" : "🗄 archiviato"}
                </span>
                <div className="flex gap-1.5">
                  {it.status !== "read" ? (
                    <button type="button" onClick={() => void setStatus(it.id, "read")} disabled={busy === it.id} className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-gray-300 hover:text-white disabled:opacity-40">
                      Letto
                    </button>
                  ) : null}
                  {it.status !== "archived" ? (
                    <button type="button" onClick={() => void setStatus(it.id, "archived")} disabled={busy === it.id} className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-gray-400 hover:text-white disabled:opacity-40">
                      Archivia
                    </button>
                  ) : (
                    <button type="button" onClick={() => void setStatus(it.id, "new")} disabled={busy === it.id} className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-gray-400 hover:text-white disabled:opacity-40">
                      Ripristina
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-xs text-gray-500">Nessun messaggio.</p>
        ) : null}
      </div>
    </div>
  );
}
