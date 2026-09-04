"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, Loader2, RefreshCw, RotateCcw, Search, Send, Undo2 } from "lucide-react";

import { cn } from "@/lib/cn";

type LocaleValue = {
  base: string;
  isFallback: boolean;
  draft: string | null;
  published: string | null;
};

type TextItem = {
  key: string;
  namespace: string;
  values: Record<string, LocaleValue>;
  hasPending: boolean;
  hasOverride: boolean;
};

type Scope = "vetrina" | "app";

type ApiList = {
  ok: boolean;
  error?: string;
  scope: Scope;
  locales: string[];
  total: number;
  offset: number;
  limit: number;
  items: TextItem[];
  pendingByScope: Record<Scope, number>;
};

const LOCALE_LABEL: Record<string, string> = {
  it: "Italiano",
  en: "English",
  fr: "Français",
  de: "Deutsch",
  tr: "Türkçe",
  es: "Español",
};

const PAGE = 40;

/** Stato di una lingua per una chiave: decide badge e colore. */
function statusOf(v: LocaleValue): "draft" | "published" | "original" {
  if (v.draft !== null && v.draft !== v.published) return "draft";
  if (v.published !== null) return "published";
  return "original";
}

function effectiveValue(v: LocaleValue): string {
  return v.draft ?? v.published ?? v.base;
}

export function AdminTextsManager() {
  const [scope, setScope] = useState<Scope>("vetrina");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [onlyOverridden, setOnlyOverridden] = useState(false);
  const [offset, setOffset] = useState(0);

  const [data, setData] = useState<ApiList | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busyCell, setBusyCell] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(id);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope, offset: String(offset), limit: String(PAGE) });
      if (debouncedQ) params.set("q", debouncedQ);
      if (onlyPending) params.set("pending", "1");
      if (onlyOverridden) params.set("overridden", "1");
      const res = await fetch(`/api/admin/testi?${params.toString()}`, { cache: "no-store" });
      const j = (await res.json()) as ApiList;
      if (!res.ok || !j.ok) {
        setMsg({ tone: "err", text: j.error ?? "Caricamento non riuscito." });
        setData(null);
      } else {
        setData(j);
      }
    } catch {
      setMsg({ tone: "err", text: "Errore di rete." });
    } finally {
      setLoading(false);
    }
  }, [scope, offset, debouncedQ, onlyPending, onlyOverridden]);

  useEffect(() => {
    void load();
  }, [load]);

  // Cambiando tab o filtri si riparte dalla prima pagina.
  useEffect(() => {
    setOffset(0);
    setExpanded(null);
  }, [scope, debouncedQ, onlyPending, onlyOverridden]);

  const locales = data?.locales ?? ["it", "en"];
  const pending = data?.pendingByScope ?? { vetrina: 0, app: 0 };
  const pendingHere = pending[scope] ?? 0;

  const saveCell = useCallback(
    async (key: string, locale: string, value: string) => {
      const cell = `${key}::${locale}`;
      setBusyCell(cell);
      setMsg(null);
      try {
        const res = await fetch("/api/admin/testi", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, locale, value }),
        });
        const j = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setMsg({ tone: "err", text: j.error ?? "Salvataggio non riuscito." });
          return;
        }
        setEdits((prev) => {
          const next = { ...prev };
          delete next[cell];
          return next;
        });
        setMsg({ tone: "ok", text: "Bozza salvata. Non è ancora online: premi «Pubblica»." });
        await load();
      } catch {
        setMsg({ tone: "err", text: "Errore di rete." });
      } finally {
        setBusyCell(null);
      }
    },
    [load],
  );

  const resetCell = useCallback(
    async (key: string, locale: string) => {
      const cell = `${key}::${locale}`;
      setBusyCell(cell);
      try {
        const res = await fetch("/api/admin/testi", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, locale, reset: true }),
        });
        const j = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setMsg({ tone: "err", text: j.error ?? "Ripristino non riuscito." });
          return;
        }
        setEdits((prev) => {
          const next = { ...prev };
          delete next[cell];
          return next;
        });
        setMsg({ tone: "ok", text: "Testo riportato all'originale." });
        await load();
      } finally {
        setBusyCell(null);
      }
    },
    [load],
  );

  const runPublish = useCallback(
    async (action: "publish" | "discard") => {
      if (action === "discard" && !window.confirm(`Scartare le ${pendingHere} modifiche non pubblicate?`)) return;
      setPublishing(true);
      setMsg(null);
      try {
        const res = await fetch("/api/admin/testi/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope, action }),
        });
        const j = (await res.json()) as { ok?: boolean; error?: string; changed?: number };
        if (!res.ok || !j.ok) {
          setMsg({ tone: "err", text: j.error ?? "Operazione non riuscita." });
          return;
        }
        setMsg({
          tone: "ok",
          text:
            action === "publish"
              ? `${j.changed ?? 0} testi pubblicati. Online entro un minuto.`
              : `${j.changed ?? 0} bozze scartate.`,
        });
        await load();
      } catch {
        setMsg({ tone: "err", text: "Errore di rete." });
      } finally {
        setPublishing(false);
      }
    },
    [scope, pendingHere, load],
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageInfo = useMemo(() => {
    if (!total) return "0 testi";
    const from = offset + 1;
    const to = Math.min(offset + PAGE, total);
    return `${from}–${to} di ${total}`;
  }, [offset, total]);

  return (
    <div className="space-y-4">
      {/* Tab: vetrina e app restano separati per non confondere il sito pubblico con la piattaforma. */}
      <div className="flex flex-wrap items-center gap-2">
        {(["vetrina", "app"] as Scope[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScope(s)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
              scope === s
                ? "border-rose-400/60 bg-rose-400/10 text-rose-100"
                : "border-white/10 bg-white/5 text-gray-400 hover:border-white/25 hover:text-gray-200",
            )}
          >
            {s === "vetrina" ? "Vetrina (sito pubblico)" : "App (piattaforma)"}
            {(pending[s] ?? 0) > 0 ? (
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 font-mono text-[0.65rem] text-amber-200">
                {pending[s]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-gray-500">
        {scope === "vetrina"
          ? "Testi di home, come funziona, FAQ, contatti, navbar e footer. Modifica, poi premi «Pubblica»: il sito si aggiorna senza deploy."
          : "Testi della piattaforma interna. Attenzione: molte stringhe contengono segnaposto {…} e tag <…> che il codice usa per nome — vanno mantenuti identici (il salvataggio lo verifica)."}
      </p>

      {/* Filtri */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca nel testo o nella chiave…"
            className="w-full rounded-lg border border-white/10 bg-black/30 py-2 pl-8 pr-2 text-sm text-white placeholder:text-gray-600 focus:border-rose-400/50 focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} className="h-4 w-4 accent-amber-400" />
          Solo bozze
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input type="checkbox" checked={onlyOverridden} onChange={(e) => setOnlyOverridden(e.target.checked)} className="h-4 w-4 accent-emerald-400" />
          Solo modificati
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:text-white disabled:opacity-50"
          title="Ricarica"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
        </button>
      </div>

      {msg ? (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-xs",
            msg.tone === "ok" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-red-400/25 bg-red-400/10 text-red-200",
          )}
          role="status"
        >
          {msg.text}
        </p>
      ) : null}

      {/* Elenco chiavi */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        {loading && !items.length ? (
          <p className="px-4 py-10 text-center text-xs text-gray-500">Caricamento…</p>
        ) : null}
        {!loading && !items.length ? (
          <p className="px-4 py-10 text-center text-xs text-gray-500">Nessun testo con questi filtri.</p>
        ) : null}

        <ul className="divide-y divide-white/5">
          {items.map((item) => {
            const open = expanded === item.key;
            const itVal = item.values.it ?? item.values[locales[0]];
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : item.key)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                >
                  <span className="mt-1 flex shrink-0 gap-1">
                    {item.hasPending ? <span className="h-2 w-2 rounded-full bg-amber-400" title="Bozza da pubblicare" /> : null}
                    {item.hasOverride ? <span className="h-2 w-2 rounded-full bg-emerald-400" title="Testo modificato online" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-gray-200">{itVal ? effectiveValue(itVal) : ""}</span>
                    <span className="mt-0.5 block truncate font-mono text-[0.65rem] text-gray-600">{item.key}</span>
                  </span>
                  <Eye className={cn("mt-1 h-3.5 w-3.5 shrink-0 transition", open ? "text-rose-300" : "text-gray-600")} aria-hidden />
                </button>

                {open ? (
                  <div className="space-y-3 border-t border-white/5 bg-black/20 px-4 py-4">
                    {locales.map((loc) => {
                      const v = item.values[loc];
                      if (!v) return null;
                      const cell = `${item.key}::${loc}`;
                      const current = edits[cell] ?? effectiveValue(v);
                      const dirty = edits[cell] !== undefined && edits[cell] !== effectiveValue(v);
                      const st = statusOf(v);
                      return (
                        <div key={loc} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-white">{LOCALE_LABEL[loc] ?? loc}</span>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 font-mono text-[0.6rem] uppercase",
                                st === "draft" && "bg-amber-400/15 text-amber-200",
                                st === "published" && "bg-emerald-400/15 text-emerald-200",
                                st === "original" && "bg-white/5 text-gray-500",
                              )}
                            >
                              {st === "draft" ? "bozza" : st === "published" ? "online" : "originale"}
                            </span>
                            {v.isFallback ? (
                              <span className="rounded-full bg-sky-400/10 px-2 py-0.5 font-mono text-[0.6rem] text-sky-300" title="Non tradotto in questa lingua: mostra l'inglese">
                                da inglese
                              </span>
                            ) : null}
                          </div>
                          <textarea
                            value={current}
                            onChange={(e) => setEdits((p) => ({ ...p, [cell]: e.target.value }))}
                            rows={Math.min(6, Math.max(2, Math.ceil(current.length / 70)))}
                            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm leading-relaxed text-white focus:border-rose-400/50 focus:outline-none"
                          />
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={!dirty || busyCell === cell}
                              onClick={() => void saveCell(item.key, loc, current)}
                              className="flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-400/20 disabled:opacity-40"
                            >
                              {busyCell === cell ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Check className="h-3 w-3" aria-hidden />}
                              Salva bozza
                            </button>
                            {dirty ? (
                              <button
                                type="button"
                                onClick={() => setEdits((p) => { const n = { ...p }; delete n[cell]; return n; })}
                                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 transition hover:text-white"
                              >
                                <Undo2 className="h-3 w-3" aria-hidden />
                                Annulla
                              </button>
                            ) : null}
                            {st !== "original" ? (
                              <button
                                type="button"
                                disabled={busyCell === cell}
                                onClick={() => void resetCell(item.key, loc)}
                                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-400 transition hover:text-white disabled:opacity-40"
                                title="Elimina la modifica e torna al testo del repo"
                              >
                                <RotateCcw className="h-3 w-3" aria-hidden />
                                Ripristina originale
                              </button>
                            ) : null}
                          </div>
                          {st !== "original" ? (
                            <p className="mt-2 font-mono text-[0.6rem] leading-relaxed text-gray-600">originale: {v.base}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5 text-xs text-gray-500">
          <span>{pageInfo}</span>
          <span className="flex gap-2">
            <button
              type="button"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE))}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 transition hover:text-white disabled:opacity-40"
            >
              Indietro
            </button>
            <button
              type="button"
              disabled={offset + PAGE >= total || loading}
              onClick={() => setOffset(offset + PAGE)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 transition hover:text-white disabled:opacity-40"
            >
              Avanti
            </button>
          </span>
        </div>
      </div>

      {/* Barra pubblicazione: sempre presente, così si sa cosa è in attesa. */}
      <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-950/90 p-3 backdrop-blur-xl">
        <p className="text-xs text-gray-400">
          {pendingHere > 0 ? (
            <>
              <span className="font-bold text-amber-200">{pendingHere}</span> modifiche in bozza su{" "}
              {scope === "vetrina" ? "Vetrina" : "App"} — non ancora visibili al pubblico.
            </>
          ) : (
            "Nessuna modifica in attesa: quello che vedi online è aggiornato."
          )}
        </p>
        <span className="flex gap-2">
          <button
            type="button"
            disabled={pendingHere === 0 || publishing}
            onClick={() => void runPublish("discard")}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 transition hover:text-white disabled:opacity-40"
          >
            Scarta bozze
          </button>
          <button
            type="button"
            disabled={pendingHere === 0 || publishing}
            onClick={() => void runPublish("publish")}
            className="flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/20 px-4 py-2 text-xs font-bold text-rose-50 transition hover:bg-rose-500/30 disabled:opacity-40"
          >
            {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
            Pubblica
          </button>
        </span>
      </div>
    </div>
  );
}
