"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Copy, Gift, Plus, RefreshCw, ShoppingCart, Wallet } from "lucide-react";
import { filterRowsByQuery } from "@/lib/admin/table-search";
import { cn } from "@/lib/cn";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { Pro2Button } from "@/components/ui/empathy";
import { CreateSaleDialog } from "./CreateSaleDialog";
import {
  type DirectoryEntry,
  type SaleRow,
  SOURCE_LABEL,
  STATUS_LABEL,
  STATUS_PILL,
  fmtAmount,
  fmtDate,
  loadAdminDirectoryMap,
} from "./sales-shared";

const COPY = {
  loading: "Caricamento vendite…",
  empty: "Nessuna vendita ancora — arriveranno dal checkout Stripe o da Genera vendita.",
  emptyFiltered: "Nessuna vendita per questi filtri.",
  errNoSupabase: "Configurazione Supabase mancante (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
  reload: "Ricarica",
  generate: "Genera vendita",
  saleCreated: "Vendita registrata.",
  searchPlaceholder: "Cerca in tutti i campi…",
  fromLabel: "Da",
  toLabel: "A",
  coachLabel: "Coach",
  coachAll: "Tutti",
  statTotal: "Totale vendite",
  statRevenue: "Incasso totale",
  statLast30: "Ultimi 30 giorni",
  statFree: "Vendite gratuite",
  colDate: "Data",
  colClient: "Cliente",
  colProduct: "Prodotto",
  colAmount: "Importo",
  colStatus: "Stato",
  colSource: "Fonte",
  colTx: "Transazione",
  colCoach: "Coach",
  copyTx: "Copia negli appunti",
} as const;

type EnrichedSale = SaleRow & {
  clientEmail: string;
  coachEmail: string;
  statusLabel: string;
  sourceLabel: string;
  txId: string;
};

function truncateTx(tx: string): string {
  return tx.length > 18 ? `${tx.slice(0, 18)}…` : tx;
}

/**
 * Vendite admin: fonte unica delle vendite (tabella `sales`, lettura diretta
 * supabase dal browser, RLS platform_admin_all). Contatori, filtri data/coach,
 * ricerca su tutti i campi e creazione vendita manuale via dialog.
 */
export function AdminSalesView() {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [dirMap, setDirMap] = useState<Map<string, DirectoryEntry>>(new Map());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [dirErr, setDirErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [coachFilter, setCoachFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setErr(COPY.errNoSupabase);
      setLoading(false);
      return;
    }
    try {
      // Vendite + directory (email) in parallelo; la directory è best-effort.
      const [salesRes, dirRes] = await Promise.all([
        supabase.from("sales").select("*").order("created_at", { ascending: false }).limit(1000),
        loadAdminDirectoryMap().catch((e: unknown) => (e instanceof Error ? e : new Error("directory"))),
      ]);
      if (salesRes.error) {
        setErr(`Errore caricamento vendite: ${salesRes.error.message}`);
        return;
      }
      setRows((salesRes.data ?? []) as SaleRow[]);
      if (dirRes instanceof Error) {
        setDirErr(`Email utenti non risolte (${dirRes.message}): vedrai gli ID al posto delle email.`);
      } else {
        setDirMap(dirRes);
        setDirErr(null);
      }
    } catch {
      setErr("Errore: richiesta non riuscita.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const emailOf = useCallback(
    (userId: string | null): string => {
      if (!userId) return "";
      return dirMap.get(userId)?.email ?? `${userId.slice(0, 8)}…`;
    },
    [dirMap],
  );

  const enriched = useMemo<EnrichedSale[]>(
    () =>
      rows.map((s) => ({
        ...s,
        clientEmail: emailOf(s.user_id),
        coachEmail: emailOf(s.coach_user_id),
        statusLabel: STATUS_LABEL[s.status] ?? s.status,
        sourceLabel: SOURCE_LABEL[s.source] ?? s.source,
        txId: s.stripe_session_id ?? s.stripe_payment_intent_id ?? "",
      })),
    [rows, emailOf],
  );

  const stats = useMemo(() => {
    const revenue = new Map<string, number>();
    let free = 0;
    let last30 = 0;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const s of rows) {
      if (s.status === "free") free += 1;
      const ts = new Date(s.created_at).getTime();
      if (!Number.isNaN(ts) && ts >= cutoff) last30 += 1;
      // Incasso: somma amount per valuta (esclusi rimborsi e pagamenti falliti).
      if (s.status !== "refunded" && s.status !== "failed") {
        const cur = (s.currency ?? "CHF").trim().toUpperCase() || "CHF";
        revenue.set(cur, (revenue.get(cur) ?? 0) + Number(s.amount ?? 0));
      }
    }
    return { total: rows.length, revenue: Array.from(revenue.entries()), free, last30 };
  }, [rows]);

  const coachOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const s of rows) {
      if (s.coach_user_id) ids.add(s.coach_user_id);
    }
    return Array.from(ids)
      .map((id) => ({ id, email: emailOf(id) }))
      .sort((a, b) => a.email.localeCompare(b.email));
  }, [rows, emailOf]);

  const visible = useMemo(() => {
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    let list = enriched;
    if (fromTs != null && !Number.isNaN(fromTs)) {
      list = list.filter((r) => new Date(r.created_at).getTime() >= fromTs);
    }
    if (toTs != null && !Number.isNaN(toTs)) {
      list = list.filter((r) => new Date(r.created_at).getTime() <= toTs);
    }
    if (coachFilter) {
      list = list.filter((r) => r.coach_user_id === coachFilter);
    }
    return filterRowsByQuery(list, query);
  }, [enriched, dateFrom, dateTo, coachFilter, query]);

  const copyTx = useCallback(async (saleId: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(saleId);
      window.setTimeout(() => setCopiedId((cur) => (cur === saleId ? null : cur)), 1500);
    } catch {
      // Clipboard non disponibile (permessi/contesto non sicuro): nessun feedback.
    }
  }, []);

  const onSaleCreated = useCallback(
    ({ warning }: { warning: string | null }) => {
      setDialogOpen(false);
      setInfo(COPY.saleCreated);
      setWarn(warning);
      void load();
    },
    [load],
  );

  return (
    <div className="space-y-5">
      {err ? (
        <p className="rounded-xl border border-red-500/35 bg-red-950/20 px-4 py-3 text-sm text-red-300" role="alert">
          {err}
        </p>
      ) : null}
      {dirErr ? (
        <p className="rounded-xl border border-amber-500/35 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
          {dirErr}
        </p>
      ) : null}
      {warn ? (
        <p className="rounded-xl border border-amber-500/35 bg-amber-950/20 px-4 py-3 text-sm text-amber-200" role="alert">
          {warn}
        </p>
      ) : null}
      {info ? (
        <p className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          {info}
        </p>
      ) : null}

      {/* Contatori */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <span className="rounded-lg bg-emerald-400/10 p-2 text-emerald-300">
            <ShoppingCart className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-wider text-zinc-500">{COPY.statTotal}</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-white">{stats.total}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <span className="rounded-lg bg-emerald-400/10 p-2 text-emerald-300">
            <Wallet className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-wider text-zinc-500">{COPY.statRevenue}</p>
            {stats.revenue.length === 0 ? (
              <p className="mt-0.5 text-2xl font-semibold text-white">—</p>
            ) : (
              <div className="mt-0.5 space-y-0.5">
                {stats.revenue.map(([cur, total]) => (
                  <p key={cur} className="font-mono text-xl font-semibold leading-tight tabular-nums text-emerald-300">
                    {fmtAmount(total, cur)}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <span className="rounded-lg bg-sky-400/10 p-2 text-sky-300">
            <CalendarClock className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-wider text-zinc-500">{COPY.statLast30}</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-white">{stats.last30}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <span className="rounded-lg bg-cyan-400/10 p-2 text-cyan-300">
            <Gift className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-wider text-zinc-500">{COPY.statFree}</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-white">{stats.free}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
        {/* Filtri */}
        <div className="flex flex-wrap items-end gap-3 border-b border-white/10 p-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={COPY.searchPlaceholder}
            className="min-w-[12rem] flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
          />
          <label className="text-[11px] uppercase tracking-wider text-zinc-500">
            {COPY.fromLabel}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 block rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-sm text-white outline-none [color-scheme:dark] focus:border-emerald-400/60"
            />
          </label>
          <label className="text-[11px] uppercase tracking-wider text-zinc-500">
            {COPY.toLabel}
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 block rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-sm text-white outline-none [color-scheme:dark] focus:border-emerald-400/60"
            />
          </label>
          <label className="text-[11px] uppercase tracking-wider text-zinc-500">
            {COPY.coachLabel}
            <select
              value={coachFilter}
              onChange={(e) => setCoachFilter(e.target.value)}
              className="mt-1 block rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-emerald-400/60"
            >
              <option value="">{COPY.coachAll}</option>
              {coachOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.email}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            title={COPY.reload}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:border-white/25 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
          </button>
          <Pro2Button
            type="button"
            className="px-4 py-2 text-xs"
            onClick={() => {
              setInfo(null);
              setWarn(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            {COPY.generate}
          </Pro2Button>
        </div>

        {/* Tabella */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-2.5 font-medium">{COPY.colDate}</th>
                <th className="px-3 py-2.5 font-medium">{COPY.colClient}</th>
                <th className="px-3 py-2.5 font-medium">{COPY.colProduct}</th>
                <th className="px-3 py-2.5 text-right font-medium text-emerald-400/70">{COPY.colAmount}</th>
                <th className="px-3 py-2.5 font-medium">{COPY.colStatus}</th>
                <th className="px-3 py-2.5 font-medium">{COPY.colSource}</th>
                <th className="px-3 py-2.5 font-medium">{COPY.colTx}</th>
                <th className="px-3 py-2.5 font-medium">{COPY.colCoach}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-zinc-500">
                    {COPY.loading}
                  </td>
                </tr>
              ) : null}
              {!loading && visible.length === 0 && !err ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-zinc-500">
                    {rows.length === 0 ? COPY.empty : COPY.emptyFiltered}
                  </td>
                </tr>
              ) : null}
              {visible.map((r) => (
                <tr key={r.id} className="border-b border-white/5 transition-colors even:bg-white/[0.015] hover:bg-white/[0.04]">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-400">{fmtDate(r.created_at)}</td>
                  <td className="max-w-[14rem] truncate px-3 py-3 font-medium text-white">
                    {r.clientEmail || "—"}
                  </td>
                  <td className="max-w-[12rem] truncate px-3 py-3 text-zinc-300">{r.product_name ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    {Number(r.amount ?? 0) === 0 ? (
                      <span
                        className={cn(
                          "inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          STATUS_PILL.free,
                        )}
                      >
                        {STATUS_LABEL.free}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "font-mono font-medium tabular-nums",
                          Number(r.amount ?? 0) < 0 ? "text-rose-400" : "text-emerald-300",
                        )}
                      >
                        {fmtAmount(r.amount, r.currency)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        "inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        STATUS_PILL[r.status] ?? "border-zinc-400/30 bg-zinc-400/10 text-zinc-300",
                      )}
                    >
                      {r.statusLabel}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-zinc-400">{r.sourceLabel}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {r.txId ? (
                      <span className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] text-zinc-500">{truncateTx(r.txId)}</span>
                        <button
                          type="button"
                          onClick={() => void copyTx(r.id, r.txId)}
                          title={COPY.copyTx}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/5 text-gray-400 transition hover:border-white/25 hover:text-white"
                        >
                          {copiedId === r.id ? (
                            <Check className="h-3 w-3 text-emerald-300" aria-hidden />
                          ) : (
                            <Copy className="h-3 w-3" aria-hidden />
                          )}
                        </button>
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="max-w-[12rem] truncate px-3 py-3 text-xs text-zinc-400">{r.coachEmail || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dialogOpen ? (
        <CreateSaleDialog directory={dirMap} onClose={() => setDialogOpen(false)} onCreated={onSaleCreated} />
      ) : null}
    </div>
  );
}
