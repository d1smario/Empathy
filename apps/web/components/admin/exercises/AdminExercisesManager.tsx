"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { AdminExerciseFormDialog } from "@/components/admin/exercises/AdminExerciseFormDialog";
import {
  DIFFICULTY_LABEL,
  DIFFICULTY_PILL,
  domainLabel,
  domainPillClass,
  FALLBACK_META,
  type ExerciseMeta,
  type ExerciseRow,
} from "@/components/admin/exercises/exercise-types";

const PAGE_SIZE = 50;

const COPY = {
  loading: "Caricamento catalogo…",
  emptyAll: "Nessun esercizio nel catalogo: aggiungi il primo con il bottone qui sopra.",
  emptyFiltered: "Nessun esercizio per questo filtro o ricerca.",
  errLoad: "Caricamento esercizi non riuscito.",
  errNetwork: "Errore di rete: richiesta non riuscita.",
  errDeletePrefix: "Eliminazione non riuscita",
  reload: "Ricarica",
  add: "Aggiungi esercizio",
  edit: "Modifica",
  remove: "Elimina",
  searchPh: "Cerca per nome…",
  allDomains: "Tutti",
  colName: "Nome",
  colDomain: "Dominio",
  colPattern: "Pattern movimento",
  colMuscles: "Gruppi muscolari",
  colDifficulty: "Difficoltà",
  colActions: "Azioni",
  prevPage: "Pagina precedente",
  nextPage: "Pagina successiva",
  created: "Esercizio creato.",
  updated: (name: string) => `Esercizio "${name}" aggiornato.`,
  deleted: (name: string) => `Esercizio "${name}" eliminato.`,
  confirmDelete: (name: string, id: string) =>
    `Eliminare definitivamente "${name}" (${id})?\nL'operazione non è reversibile.`,
  pageOf: (page: number, totalPages: number, total: number) =>
    `Pagina ${page} di ${totalPages} · ${total} esercizi`,
} as const;

type FormTarget = { mode: "create" } | { mode: "edit"; exercise: ExerciseRow };

type ListResponse = {
  ok?: boolean;
  exercises?: ExerciseRow[];
  total?: number;
  meta?: ExerciseMeta;
  error?: string;
};

/**
 * Catalogo esercizi admin (API-first): lista paginata da /api/admin/exercises,
 * ricerca server su nome (debounce), filtro dominio a pill con contatori,
 * creazione/modifica via modale completa, eliminazione con conferma (409 se referenziato).
 */
export function AdminExercisesManager() {
  const [rows, setRows] = useState<ExerciseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<ExerciseMeta>(FALLBACK_META);
  const [metaLoaded, setMetaLoaded] = useState(false);

  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);

  // Ref per invalidare le risposte fuori ordine (ricerca con debounce).
  const requestSeq = useRef(0);

  const load = useCallback(
    async (opts: { page?: number; q?: string; domain?: string; forceMeta?: boolean } = {}) => {
      const nextPage = opts.page ?? 1;
      const nextQ = (opts.q ?? query).trim();
      const nextDomain = opts.domain ?? domainFilter;
      const seq = ++requestSeq.current;
      setLoading(true);
      setErr(null);
      try {
        const params = new URLSearchParams();
        if (nextQ) params.set("q", nextQ);
        if (nextDomain) params.set("domain", nextDomain);
        params.set("page", String(nextPage));
        params.set("pageSize", String(PAGE_SIZE));
        if (!metaLoaded || opts.forceMeta) params.set("meta", "1");
        const res = await fetch(`/api/admin/exercises?${params.toString()}`, { cache: "no-store" });
        const j = (await res.json().catch(() => ({}))) as ListResponse;
        if (seq !== requestSeq.current) return;
        if (!res.ok || !j.ok) {
          setErr(j.error ?? COPY.errLoad);
          setRows([]);
          setTotal(0);
          return;
        }
        setRows(j.exercises ?? []);
        setTotal(j.total ?? 0);
        setPage(nextPage);
        if (j.meta) {
          setMeta(j.meta);
          setMetaLoaded(true);
        }
      } catch {
        if (seq === requestSeq.current) setErr(COPY.errNetwork);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [query, domainFilter, metaLoaded],
  );

  // Primo caricamento (con meta).
  useEffect(() => {
    void load({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ricerca con debounce: riparte da pagina 1 a ogni modifica della query.
  const firstSearch = useRef(true);
  useEffect(() => {
    if (firstSearch.current) {
      firstSearch.current = false;
      return;
    }
    const t = setTimeout(() => void load({ page: 1, q: query }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const setDomain = useCallback(
    (d: string) => {
      setDomainFilter(d);
      void load({ page: 1, domain: d });
    },
    [load],
  );

  const remove = useCallback(
    async (row: ExerciseRow) => {
      if (!window.confirm(COPY.confirmDelete(row.name, row.id))) return;
      setBusy(true);
      setErr(null);
      setInfo(null);
      try {
        const res = await fetch("/api/admin/exercises", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: row.id }),
        });
        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setErr(j.error ?? `${COPY.errDeletePrefix}.`);
          return;
        }
        setInfo(COPY.deleted(row.name));
        const lastPage = Math.max(1, Math.ceil((total - 1) / PAGE_SIZE));
        await load({ page: Math.min(page, lastPage), forceMeta: true });
      } catch {
        setErr(COPY.errNetwork);
      } finally {
        setBusy(false);
      }
    },
    [load, page, total],
  );

  const domainPills = useMemo(
    () => [
      { key: "", label: COPY.allDomains, count: meta.countAll || undefined },
      ...meta.domains.map((d) => ({ key: d, label: domainLabel(d), count: meta.domainCounts[d] })),
    ],
    [meta],
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
      {/* Toolbar: filtro dominio a pill con contatori, ricerca, ricarica, aggiungi */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
        {domainPills.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setDomain(p.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
              domainFilter === p.key
                ? "border-violet-400/60 bg-violet-500/15 text-violet-100"
                : "border-white/10 bg-white/5 text-gray-400 hover:border-white/25 hover:text-gray-200",
            )}
          >
            {p.label}
            {p.count != null ? (
              <span className="ml-1.5 font-mono text-[0.65rem] tabular-nums text-zinc-500">{p.count}</span>
            ) : null}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={COPY.searchPh}
            className="w-48 rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-gray-600 focus:border-violet-400/60 focus:outline-none sm:w-64"
          />
        </div>
        <button
          type="button"
          onClick={() => void load({ page, forceMeta: true })}
          disabled={loading}
          title={COPY.reload}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:border-white/25 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setFormTarget({ mode: "create" })}
          className="flex items-center gap-1.5 rounded-lg border border-violet-400/60 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500/25"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {COPY.add}
        </button>
      </div>

      {err ? (
        <p className="px-4 py-4 text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}
      {info ? <p className="px-4 py-4 text-sm text-emerald-300">{info}</p> : null}

      {loading && rows.length === 0 && !err ? (
        <p className="px-4 py-8 text-center text-xs text-gray-500">{COPY.loading}</p>
      ) : null}
      {!loading && rows.length === 0 && !err ? (
        <p className="px-4 py-8 text-center text-xs text-gray-500">
          {total === 0 && !query.trim() && !domainFilter ? COPY.emptyAll : COPY.emptyFiltered}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3 font-medium">{COPY.colName}</th>
                <th className="px-4 py-3 font-medium">{COPY.colDomain}</th>
                <th className="px-4 py-3 font-medium">{COPY.colPattern}</th>
                <th className="px-4 py-3 font-medium">{COPY.colMuscles}</th>
                <th className="px-4 py-3 font-medium">{COPY.colDifficulty}</th>
                <th className="px-4 py-3 text-right font-medium">{COPY.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-white/5 transition-colors even:bg-white/[0.015] last:border-b-0 hover:bg-white/[0.04]"
                >
                  <td className="max-w-[18rem] px-4 py-3">
                    <p className="truncate font-medium text-white">{row.name}</p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">{row.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    {row.domain ? (
                      <span
                        className={cn(
                          "inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          domainPillClass(row.domain),
                        )}
                      >
                        {domainLabel(row.domain)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                    {row.category ? <p className="mt-0.5 text-[0.7rem] text-zinc-500">{row.category}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{row.movement_pattern ?? "—"}</td>
                  <td className="max-w-[16rem] px-4 py-3">
                    {(row.muscle_groups ?? []).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {row.muscle_groups.slice(0, 4).map((m) => (
                          <span
                            key={m}
                            className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-zinc-300"
                          >
                            {m}
                          </span>
                        ))}
                        {row.muscle_groups.length > 4 ? (
                          <span className="font-mono text-[0.65rem] tabular-nums text-zinc-500">
                            +{row.muscle_groups.length - 4}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.difficulty ? (
                      <span
                        className={cn(
                          "inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          DIFFICULTY_PILL[row.difficulty] ?? "border-white/15 bg-white/5 text-zinc-300",
                        )}
                      >
                        {DIFFICULTY_LABEL[row.difficulty] ?? row.difficulty}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setFormTarget({ mode: "edit", exercise: row })}
                        disabled={busy}
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/25 hover:text-white disabled:opacity-50"
                      >
                        <Pencil className="h-3 w-3" aria-hidden />
                        {COPY.edit}
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(row)}
                        disabled={busy}
                        title={COPY.remove}
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-400 transition hover:border-rose-500/40 hover:text-rose-300 disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden />
                        {COPY.remove}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Paginazione */}
      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={() => void load({ page: page - 1 })}
          disabled={loading || page <= 1}
          title={COPY.prevPage}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:border-white/25 hover:text-white disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        </button>
        <span className="font-mono text-[0.65rem] tabular-nums text-zinc-500">{COPY.pageOf(page, totalPages, total)}</span>
        <button
          type="button"
          onClick={() => void load({ page: page + 1 })}
          disabled={loading || page >= totalPages}
          title={COPY.nextPage}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:border-white/25 hover:text-white disabled:opacity-40"
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {formTarget ? (
        <AdminExerciseFormDialog
          exercise={formTarget.mode === "edit" ? formTarget.exercise : null}
          meta={meta}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            const created = formTarget.mode === "create";
            setFormTarget(null);
            setErr(null);
            setInfo(created ? COPY.created : COPY.updated(formTarget.exercise.name));
            void load({ page: created ? 1 : page, forceMeta: true });
          }}
        />
      ) : null}
    </div>
  );
}
