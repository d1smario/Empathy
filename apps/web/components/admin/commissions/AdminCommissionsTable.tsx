"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleCheck, HandCoins, Hourglass, RefreshCw, type LucideIcon } from "lucide-react";
import type { AdminDirectoryUserRow } from "@/lib/admin/user-directory-types";
import { filterRowsByQuery } from "@/lib/admin/table-search";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/cn";

const COPY = {
  loading: "Caricamento commissioni…",
  emptyAll:
    "Nessuna commissione registrata. Le commissioni nascono dalle vendite (coach Empathy / promoter) secondo gli importi fissi configurati in Prodotti; le richieste di pagamento dei beneficiari appariranno qui.",
  emptyFilter: "Nessuna commissione per questo filtro.",
  errPrefix: "Errore",
  noSupabase: "Supabase non configurato: impossibile caricare le commissioni.",
  reload: "Ricarica",
  searchPlaceholder: "Cerca in tutti i campi…",
  cardAccrued: "Maturate",
  cardRequested: "Richieste",
  cardPaid: "Pagate",
  colDate: "Data",
  colSale: "Vendita",
  colBeneficiary: "Beneficiario",
  colAmount: "Importo",
  colStatus: "Stato",
  colActions: "Azioni",
  actionMarkPaid: "Segna pagata",
  actionCancel: "Annulla",
  noEmail: "email non trovata",
} as const;

type CommissionStatus = "accrued" | "requested" | "paid" | "cancelled";

type CommissionSale = {
  product_name: string | null;
  product_code: string | null;
  amount: number | null;
  currency: string | null;
  user_id: string | null;
  created_at: string | null;
};

type CommissionRow = {
  id: string;
  sale_id: string | null;
  beneficiary_kind: "coach" | "promoter";
  beneficiary_user_id: string | null;
  amount: number;
  currency: string;
  status: CommissionStatus;
  requested_at: string | null;
  paid_at: string | null;
  note: string | null;
  created_at: string;
  sale: CommissionSale | null;
};

/** Riga arricchita con le email risolte (entrano anche nel "cerca in tutti i campi"). */
type CommissionView = CommissionRow & {
  clientEmail: string | null;
  beneficiaryEmail: string | null;
};

type StatusFilter = "tutte" | CommissionStatus;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "tutte", label: "Tutte" },
  { key: "accrued", label: "Maturate" },
  { key: "requested", label: "Richieste" },
  { key: "paid", label: "Pagate" },
  { key: "cancelled", label: "Annullate" },
];

const STATUS_META: Record<CommissionStatus, { label: string; pill: string }> = {
  accrued: { label: "Maturata", pill: "border-white/15 bg-white/5 text-zinc-400" },
  requested: { label: "Richiesta", pill: "border-amber-400/30 bg-amber-400/10 text-amber-300" },
  paid: { label: "Pagata", pill: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  cancelled: { label: "Annullata", pill: "border-rose-400/30 bg-rose-400/10 text-rose-300" },
};

const KIND_LABEL: Record<CommissionRow["beneficiary_kind"], string> = {
  coach: "Coach",
  promoter: "Promoter",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-CH", { dateStyle: "medium" }).format(d);
}

function fmtAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("it-CH", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Somma gli importi di uno stato raggruppando per valuta → "CHF 120.00 · EUR 50.00". */
function sumByCurrency(rows: CommissionRow[], status: CommissionStatus): string {
  const byCurrency = new Map<string, number>();
  for (const r of rows) {
    if (r.status !== status) continue;
    const cur = r.currency || "CHF";
    byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + (Number.isFinite(r.amount) ? r.amount : 0));
  }
  if (byCurrency.size === 0) return "—";
  return [...byCurrency.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cur, sum]) => fmtAmount(sum, cur))
    .join(" · ");
}

/**
 * Commissioni admin (DB-first): legge `commissions` + vendita collegata da Supabase
 * direttamente dal browser (RLS platform_admin_all), risolve le email cliente/beneficiario
 * con la directory utenti admin e consente le azioni di stato (segna pagata / annulla).
 */
export function AdminCommissionsTable() {
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [emailByUserId, setEmailByUserId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("tutte");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const supabase = createEmpathyBrowserSupabase();
      if (!supabase) {
        setErr(COPY.noSupabase);
        return;
      }
      const { data, error } = await supabase
        .from("commissions")
        .select("*, sale:sales(product_name, product_code, amount, currency, user_id, created_at)")
        .order("created_at", { ascending: false });
      if (error) {
        setErr(`${COPY.errPrefix}: ${error.message}`);
        return;
      }
      setRows((data ?? []) as CommissionRow[]);
    } catch {
      setErr(`${COPY.errPrefix}: richiesta non riuscita.`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Mappa userId → email dalla directory admin (come in Vendite); best-effort, non blocca la tabella.
  const loadDirectory = useCallback(async () => {
    try {
      const map: Record<string, string> = {};
      for (let page = 1; page <= 10; page += 1) {
        const res = await fetch(`/api/admin/users/directory?page=${page}&perPage=100`, { cache: "no-store" });
        const data = (await res.json()) as { ok?: boolean; users?: AdminDirectoryUserRow[]; hasMore?: boolean };
        if (!res.ok || !data.ok) return;
        for (const u of data.users ?? []) {
          if (u.email) map[u.userId] = u.email;
        }
        if (!data.hasMore) break;
      }
      setEmailByUserId(map);
    } catch {
      // Silenzioso: senza email la tabella resta usabile (mostra "email non trovata").
    }
  }, []);

  useEffect(() => {
    void load();
    void loadDirectory();
  }, [load, loadDirectory]);

  const viewRows = useMemo<CommissionView[]>(
    () =>
      rows.map((r) => ({
        ...r,
        clientEmail: r.sale?.user_id ? emailByUserId[r.sale.user_id] ?? null : null,
        beneficiaryEmail: r.beneficiary_user_id ? emailByUserId[r.beneficiary_user_id] ?? null : null,
      })),
    [rows, emailByUserId],
  );

  const statusCounts = useMemo(() => {
    const c: Record<StatusFilter, number> = { tutte: rows.length, accrued: 0, requested: 0, paid: 0, cancelled: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const base = viewRows.filter((r) => statusFilter === "tutte" || r.status === statusFilter);
    return filterRowsByQuery(base, query);
  }, [viewRows, statusFilter, query]);

  const summaryCards: { label: string; value: string; tone: string; chip: string; icon: LucideIcon }[] = [
    {
      label: COPY.cardAccrued,
      value: sumByCurrency(rows, "accrued"),
      tone: "text-orange-300",
      chip: "bg-orange-400/10 text-orange-300",
      icon: Hourglass,
    },
    {
      label: COPY.cardRequested,
      value: sumByCurrency(rows, "requested"),
      tone: "text-amber-300",
      chip: "bg-amber-400/10 text-amber-300",
      icon: HandCoins,
    },
    {
      label: COPY.cardPaid,
      value: sumByCurrency(rows, "paid"),
      tone: "text-emerald-300",
      chip: "bg-emerald-400/10 text-emerald-300",
      icon: CircleCheck,
    },
  ];

  const updateStatus = useCallback(async (row: CommissionRow, next: "paid" | "cancelled") => {
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setActionErr(COPY.noSupabase);
      return;
    }
    setBusyId(row.id);
    setActionErr(null);
    try {
      const nowIso = new Date().toISOString();
      const patch: { status: CommissionStatus; requested_at?: string; paid_at?: string } =
        next === "paid"
          ? { status: "paid", requested_at: row.requested_at ?? nowIso, paid_at: nowIso }
          : { status: "cancelled" };
      const { error } = await supabase.from("commissions").update(patch).eq("id", row.id);
      if (error) {
        setActionErr(`${COPY.errPrefix}: ${error.message}`);
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...patch } : r)));
    } catch {
      setActionErr(`${COPY.errPrefix}: aggiornamento non riuscito.`);
    } finally {
      setBusyId(null);
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {summaryCards.map((c) => (
          <div key={c.label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <span className={cn("shrink-0 rounded-lg p-2", c.chip)}>
              <c.icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">{c.label}</p>
              <p className={cn("mt-0.5 truncate font-mono text-xl font-bold tabular-nums", c.tone)}>
                {loading && rows.length === 0 ? "—" : c.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                statusFilter === f.key
                  ? "border-orange-400/60 bg-orange-400/10 text-orange-200"
                  : "border-white/10 bg-white/5 text-gray-400 hover:border-white/25 hover:text-gray-200",
              )}
            >
              {f.label}
              <span className="ml-1.5 font-mono text-[0.65rem] text-gray-500">{statusCounts[f.key]}</span>
            </button>
          ))}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={COPY.searchPlaceholder}
            aria-label={COPY.searchPlaceholder}
            className="min-w-[11rem] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-200 placeholder:text-gray-600 focus:border-orange-400/50 focus:outline-none sm:max-w-xs"
          />
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            title={COPY.reload}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:border-white/25 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
          </button>
        </div>

        {err ? (
          <p className="px-4 py-6 text-sm text-red-400" role="alert">
            {err}
          </p>
        ) : null}
        {actionErr ? (
          <p className="px-4 py-2 text-xs text-red-400" role="alert">
            {actionErr}
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-2.5 font-medium">{COPY.colDate}</th>
                <th className="px-3 py-2.5 font-medium">{COPY.colSale}</th>
                <th className="px-3 py-2.5 font-medium">{COPY.colBeneficiary}</th>
                <th className="px-3 py-2.5 text-right font-medium text-emerald-400/70">{COPY.colAmount}</th>
                <th className="px-3 py-2.5 font-medium">{COPY.colStatus}</th>
                <th className="px-3 py-2.5 font-medium">{COPY.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-500">
                    {COPY.loading}
                  </td>
                </tr>
              ) : null}
              {!loading && !err && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-500">
                    {COPY.emptyAll}
                  </td>
                </tr>
              ) : null}
              {!loading && !err && rows.length > 0 && visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-500">
                    {COPY.emptyFilter}
                  </td>
                </tr>
              ) : null}
              {visible.map((r) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.accrued;
                const busy = busyId === r.id;
                return (
                  <tr key={r.id} className="border-b border-white/5 transition even:bg-white/[0.015] hover:bg-white/[0.04]">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-400">{fmtDate(r.created_at)}</td>
                    <td className="max-w-[18rem] px-3 py-3">
                      <p className="truncate font-medium text-white">
                        {r.sale?.product_name ?? r.sale?.product_code ?? "—"}
                      </p>
                      <p className="truncate font-mono text-[11px] text-zinc-500">{r.clientEmail ?? COPY.noEmail}</p>
                    </td>
                    <td className="max-w-[16rem] px-3 py-3">
                      <p>
                        <span
                          className={cn(
                            "inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            r.beneficiary_kind === "coach"
                              ? "border-violet-400/30 bg-violet-400/10 text-violet-300"
                              : "border-sky-400/30 bg-sky-400/10 text-sky-300",
                          )}
                        >
                          {KIND_LABEL[r.beneficiary_kind] ?? r.beneficiary_kind}
                        </span>
                      </p>
                      <p className="mt-1 truncate font-mono text-[11px] text-zinc-500">{r.beneficiaryEmail ?? COPY.noEmail}</p>
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-3 py-3 text-right font-mono text-xs tabular-nums",
                        r.amount < 0 ? "text-rose-400" : "text-emerald-300",
                      )}
                    >
                      {fmtAmount(r.amount, r.currency)}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium", meta.pill)}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {r.status === "requested" ? (
                        <span className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void updateStatus(r, "paid")}
                            className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-[0.65rem] font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
                          >
                            {COPY.actionMarkPaid}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void updateStatus(r, "cancelled")}
                            className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-2.5 py-1 text-[0.65rem] font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                          >
                            {COPY.actionCancel}
                          </button>
                        </span>
                      ) : r.status === "accrued" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void updateStatus(r, "cancelled")}
                          className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-2.5 py-1 text-[0.65rem] font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                        >
                          {COPY.actionCancel}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
