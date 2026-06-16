"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Search, Tag } from "lucide-react";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { filterRowsByQuery } from "@/lib/admin/table-search";
import { cn } from "@/lib/cn";
import {
  AdminPromoCodeFormDialog,
  type PromoProductOption,
} from "@/components/admin/promo-codes/AdminPromoCodeFormDialog";
import {
  fmtPromoDate,
  fmtRedemptions,
  PROMO_KIND_LABEL,
  promoEffectLabel,
  type PromoCodeRow,
} from "@/components/admin/promo-codes/promo-code-types";

const COPY = {
  heading: "Codici promo",
  sub: "Un solo campo codice per due usi: sconto (percentuale o importo) e sblocco di un prodotto nascosto.",
  loading: "Caricamento codici…",
  emptyAll: "Nessun codice promo: aggiungi il primo con il bottone qui sopra.",
  emptyFiltered: "Nessun codice per questo filtro o ricerca.",
  errPrefix: "Errore",
  noSupabase: "Configurazione Supabase mancante: impossibile caricare i codici promo.",
  reload: "Ricarica",
  add: "Aggiungi codice",
  edit: "Modifica",
  searchPh: "Cerca in tutti i campi…",
  active: "Attivo",
  inactive: "Disattivo",
  activate: "Attiva codice",
  deactivate: "Disattiva codice",
  colProduct: "Prodotto",
  colExpires: "Scadenza",
  colUsage: "Utilizzi",
  noProduct: "—",
  toggleErrPrefix: "Aggiornamento stato non riuscito",
} as const;

type KindFilter = "tutti" | "discount" | "unlock" | "attivi" | "disattivi";

const FILTERS: { key: KindFilter; label: string }[] = [
  { key: "tutti", label: "Tutti" },
  { key: "discount", label: "Sconto" },
  { key: "unlock", label: "Sblocco" },
  { key: "attivi", label: "Attivi" },
  { key: "disattivi", label: "Disattivi" },
];

const KIND_PILL: Record<PromoCodeRow["kind"], string> = {
  discount: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
  unlock: "border-amber-400/40 bg-amber-500/10 text-amber-200",
};

type FormTarget = { mode: "create" } | { mode: "edit"; promo: PromoCodeRow };

/**
 * Gestione codici promo admin (DB-first): lista da `promo_codes` via Supabase
 * browser (RLS platform_admin), creazione/modifica con form completo, toggle
 * attivo rapido, filtri con contatori e cerca-in-tutti-i-campi. Sezione DENTRO
 * la pagina Vendite, stesso scaffolding del catalogo prodotti.
 */
export function AdminPromoCodesManager() {
  const supabase = useMemo(() => createEmpathyBrowserSupabase(), []);
  const [rows, setRows] = useState<PromoCodeRow[]>([]);
  const [productOptions, setProductOptions] = useState<PromoProductOption[]>([]);
  const [productNameById, setProductNameById] = useState<Map<string, string>>(new Map());
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
      const [promoRes, prodRes] = await Promise.all([
        supabase
          .from("promo_codes")
          .select("*")
          .order("created_at", { ascending: false }),
        // Catalogo per il picker target: include anche i prodotti nascosti
        // (necessari per i codici di sblocco), gestiti dall'admin via RLS.
        supabase
          .from("products")
          .select("id, code, name, is_hidden")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
      ]);
      if (promoRes.error) {
        setErr(`${COPY.errPrefix}: ${promoRes.error.message}`);
        return;
      }
      setRows((promoRes.data ?? []) as PromoCodeRow[]);
      const options = (prodRes.data ?? []) as PromoProductOption[];
      setProductOptions(options);
      setProductNameById(new Map(options.map((p) => [p.id, `${p.name} (${p.code})`])));
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
    async (p: PromoCodeRow) => {
      if (!supabase) return;
      setTogglingId(p.id);
      try {
        const { error } = await supabase
          .from("promo_codes")
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
    const c: Record<KindFilter, number> = {
      tutti: rows.length,
      discount: 0,
      unlock: 0,
      attivi: 0,
      disattivi: 0,
    };
    for (const r of rows) {
      if (r.kind === "discount") c.discount += 1;
      else if (r.kind === "unlock") c.unlock += 1;
      if (r.is_active) c.attivi += 1;
      else c.disattivi += 1;
    }
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const byFilter = rows.filter((p) => {
      if (filter === "discount") return p.kind === "discount";
      if (filter === "unlock") return p.kind === "unlock";
      if (filter === "attivi") return p.is_active;
      if (filter === "disattivi") return !p.is_active;
      return true;
    });
    return filterRowsByQuery(byFilter, query);
  }, [rows, filter, query]);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-purple-300" aria-hidden />
        <h2 className="text-lg font-bold text-white">{COPY.heading}</h2>
      </div>
      <p className="text-sm text-gray-400">{COPY.sub}</p>

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
                "grid gap-3 border-b border-white/5 px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-center",
                !p.is_active && "opacity-60",
              )}
            >
              {/* Codice + tipo + effetto */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-mono font-semibold text-gray-100">{p.code}</span>
                  <span className={cn("inline-block rounded-full border px-2 py-0.5 text-[0.65rem] font-medium", KIND_PILL[p.kind])}>
                    {PROMO_KIND_LABEL[p.kind]}
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
                </div>
                <p className="mt-1 text-xs text-gray-400">{promoEffectLabel(p)}</p>
              </div>

              {/* Prodotto target */}
              <div className="min-w-0">
                <span className={LABEL_INLINE}>{COPY.colProduct}</span>
                <p className="truncate text-sm text-gray-200">
                  {p.target_product_id ? productNameById.get(p.target_product_id) ?? p.target_product_id : COPY.noProduct}
                </p>
              </div>

              {/* Validità + utilizzi */}
              <div>
                <span className={LABEL_INLINE}>
                  {COPY.colExpires} · {COPY.colUsage}
                </span>
                <p className="font-mono text-xs text-gray-300">
                  {fmtPromoDate(p.expires_at)} · {fmtRedemptions(p)}
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
                  onClick={() => setFormTarget({ mode: "edit", promo: p })}
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
          <AdminPromoCodeFormDialog
            supabase={supabase}
            promo={formTarget.mode === "edit" ? formTarget.promo : null}
            products={productOptions}
            onClose={() => setFormTarget(null)}
            onSaved={() => {
              setFormTarget(null);
              void load();
            }}
          />
        ) : null}
      </div>
    </section>
  );
}

const LABEL_INLINE = "block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500 lg:hidden";
