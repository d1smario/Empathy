"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Search } from "lucide-react";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { filterRowsByQuery } from "@/lib/admin/table-search";
import { cn } from "@/lib/cn";
import { AdminProductFormDialog } from "@/components/admin/products/AdminProductFormDialog";
import {
  fmtDate,
  fmtPrice,
  intervalLabel,
  KIND_LABEL,
  type ProductRow,
} from "@/components/admin/products/product-types";

const COPY = {
  loading: "Caricamento catalogo…",
  emptyAll: "Nessun prodotto nel catalogo: aggiungi il primo con il bottone qui sopra.",
  emptyFiltered: "Nessun prodotto per questo filtro o ricerca.",
  errPrefix: "Errore",
  noSupabase: "Configurazione Supabase mancante: impossibile caricare il catalogo prodotti.",
  reload: "Ricarica",
  add: "Aggiungi prodotto",
  edit: "Modifica",
  searchPh: "Cerca in tutti i campi…",
  active: "Attivo",
  inactive: "Disattivo",
  hidden: "Nascosto",
  activate: "Attiva prodotto",
  deactivate: "Disattiva prodotto",
  flagOwnCoach: "Coach proprio",
  flagEmpathyCoach: "Coach Empathy",
  flagShowAddons: "Add-on visibili",
  commissionCoach: "Commissione coach",
  commissionPromoter: "Commissione promoter",
  sortOrder: "Ordine",
  updatedAt: "Aggiornato",
  toggleErrPrefix: "Aggiornamento stato non riuscito",
} as const;

type KindFilter = "tutti" | "base" | "addon" | "attivi" | "disattivi";

const FILTERS: { key: KindFilter; label: string }[] = [
  { key: "tutti", label: "Tutti" },
  { key: "base", label: "Base" },
  { key: "addon", label: "Add-on" },
  { key: "attivi", label: "Attivi" },
  { key: "disattivi", label: "Disattivi" },
];

const KIND_PILL: Record<ProductRow["kind"], string> = {
  base: "border-sky-400/40 bg-sky-500/10 text-sky-200",
  addon: "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-200",
};

type FormTarget = { mode: "create" } | { mode: "edit"; product: ProductRow };

/**
 * Catalogo prodotti admin (DB-first): lista da `products` via Supabase browser,
 * creazione/modifica con form completo, toggle attivo rapido,
 * filtri con contatori e cerca-in-tutti-i-campi.
 */
export function AdminProductsManager() {
  const supabase = useMemo(() => createEmpathyBrowserSupabase(), []);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<KindFilter>("tutti");
  const [query, setQuery] = useState("");
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) {
      setErr(COPY.noSupabase);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) {
        setErr(`${COPY.errPrefix}: ${error.message}`);
        return;
      }
      setRows((data ?? []) as ProductRow[]);
    } catch {
      setErr(`${COPY.errPrefix}: richiesta non riuscita.`);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleActive = useCallback(
    async (p: ProductRow) => {
      if (!supabase) return;
      setTogglingId(p.id);
      try {
        const { error } = await supabase
          .from("products")
          .update({ is_active: !p.is_active, updated_at: new Date().toISOString() })
          .eq("id", p.id);
        if (error) {
          setErr(`${COPY.toggleErrPrefix}: ${error.message}`);
          return;
        }
        await load();
      } catch {
        setErr(`${COPY.toggleErrPrefix}: richiesta non riuscita.`);
      } finally {
        setTogglingId(null);
      }
    },
    [supabase, load],
  );

  const counts = useMemo(() => {
    const c: Record<KindFilter, number> = { tutti: rows.length, base: 0, addon: 0, attivi: 0, disattivi: 0 };
    for (const r of rows) {
      if (r.kind === "base") c.base += 1;
      else if (r.kind === "addon") c.addon += 1;
      if (r.is_active) c.attivi += 1;
      else c.disattivi += 1;
    }
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const byFilter = rows.filter((p) => {
      if (filter === "base") return p.kind === "base";
      if (filter === "addon") return p.kind === "addon";
      if (filter === "attivi") return p.is_active;
      if (filter === "disattivi") return !p.is_active;
      return true;
    });
    return filterRowsByQuery(byFilter, query);
  }, [rows, filter, query]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
      {/* Toolbar: filtri con contatori, ricerca, ricarica, aggiungi */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
              filter === f.key
                ? "border-purple-400/60 bg-purple-500/15 text-white"
                : "border-white/10 bg-white/5 text-gray-400 hover:border-white/25 hover:text-gray-200",
            )}
          >
            {f.label}
            <span className="ml-1.5 font-mono text-[0.65rem] text-gray-500">{counts[f.key]}</span>
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={COPY.searchPh}
            className="w-48 rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-gray-600 focus:border-purple-400/60 focus:outline-none sm:w-64"
          />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || !supabase}
          title={COPY.reload}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:border-white/25 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setFormTarget({ mode: "create" })}
          disabled={!supabase}
          className="flex items-center gap-1.5 rounded-lg border border-purple-400/60 bg-purple-500/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-purple-500/25 disabled:opacity-50"
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

      {loading && rows.length === 0 && !err ? (
        <p className="px-4 py-8 text-center text-xs text-gray-500">{COPY.loading}</p>
      ) : null}
      {!loading && visible.length === 0 && !err ? (
        <p className="px-4 py-8 text-center text-xs text-gray-500">
          {rows.length === 0 ? COPY.emptyAll : COPY.emptyFiltered}
        </p>
      ) : null}

      <ul>
        {visible.map((p) => (
          <li
            key={p.id}
            className={cn(
              "grid gap-3 border-b border-white/5 px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] lg:items-center",
              !p.is_active && "opacity-60",
            )}
          >
            {/* Identità */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium text-gray-100">{p.name}</span>
                <span className={cn("inline-block rounded-full border px-2 py-0.5 text-[0.65rem] font-medium", KIND_PILL[p.kind])}>
                  {KIND_LABEL[p.kind]}
                </span>
                <span
                  className={cn(
                    "inline-block rounded-full border px-2 py-0.5 text-[0.65rem] font-medium",
                    p.is_active
                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                      : "border-white/15 bg-white/5 text-gray-400",
                  )}
                >
                  {p.is_active ? COPY.active : COPY.inactive}
                </span>
                {p.is_hidden ? (
                  <span className="inline-block rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[0.65rem] font-medium text-amber-200">
                    {COPY.hidden}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate font-mono text-[0.7rem] text-gray-500">{p.code}</p>
              {p.subtitle ? <p className="mt-0.5 truncate text-xs text-gray-400">{p.subtitle}</p> : null}
            </div>

            {/* Prezzo + intervallo */}
            <div>
              <p className="text-sm font-semibold text-gray-100">{fmtPrice(p.price, p.currency)}</p>
              <p className="mt-0.5 text-xs text-gray-500">{intervalLabel(p.billing_interval, p.duration_days)}</p>
            </div>

            {/* Flag + commissioni */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1">
                {p.includes_own_coach ? (
                  <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[0.65rem] text-gray-300">
                    {COPY.flagOwnCoach}
                  </span>
                ) : null}
                {p.includes_empathy_coach ? (
                  <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[0.65rem] text-gray-300">
                    {COPY.flagEmpathyCoach}
                  </span>
                ) : null}
                {p.show_addons ? (
                  <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[0.65rem] text-gray-300">
                    {COPY.flagShowAddons}
                  </span>
                ) : null}
                {!p.includes_own_coach && !p.includes_empathy_coach && !p.show_addons ? (
                  <span className="text-[0.65rem] text-gray-600">—</span>
                ) : null}
              </div>
              <p className="font-mono text-[0.65rem] text-gray-500">
                {COPY.commissionCoach}: {fmtPrice(p.commission_coach_amount ?? 0, p.commission_coach_currency)}
                {" · "}
                {COPY.commissionPromoter}: {fmtPrice(p.commission_promoter_amount ?? 0, p.commission_promoter_currency)}
              </p>
              <p className="font-mono text-[0.65rem] text-gray-600">
                {COPY.sortOrder} {p.sort_order} · {COPY.updatedAt} {fmtDate(p.updated_at)}
              </p>
            </div>

            {/* Azioni */}
            <div className="flex items-center gap-3 lg:justify-end">
              <button
                type="button"
                role="switch"
                aria-checked={p.is_active}
                onClick={() => void toggleActive(p)}
                disabled={togglingId === p.id || !supabase}
                title={p.is_active ? COPY.deactivate : COPY.activate}
                className={cn(
                  "relative h-5 w-9 shrink-0 rounded-full border transition",
                  p.is_active ? "border-emerald-400/50 bg-emerald-500/30" : "border-white/15 bg-white/10",
                  togglingId === p.id && "opacity-50",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all",
                    p.is_active ? "left-[1.15rem]" : "left-0.5",
                  )}
                />
              </button>
              <button
                type="button"
                onClick={() => setFormTarget({ mode: "edit", product: p })}
                disabled={!supabase}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/25 hover:text-white disabled:opacity-50"
              >
                <Pencil className="h-3 w-3" aria-hidden />
                {COPY.edit}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {formTarget && supabase ? (
        <AdminProductFormDialog
          supabase={supabase}
          product={formTarget.mode === "edit" ? formTarget.product : null}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
