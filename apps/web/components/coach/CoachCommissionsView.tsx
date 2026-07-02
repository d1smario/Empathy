"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { HandCoins, RefreshCw, Search } from "lucide-react";
import { filterRowsByQuery } from "@/lib/admin/table-search";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { Pro2Button } from "@/components/ui/empathy";
import { cn } from "@/lib/cn";

const SALE_UNKNOWN = "—";

type CommissionStatus = "accrued" | "requested" | "paid" | "cancelled";

type SaleRef = {
  product_name: string | null;
  amount: number | null;
  currency: string | null;
  created_at: string | null;
} | null;

type CommissionRow = {
  id: string;
  amount: number | null;
  currency: string | null;
  status: CommissionStatus;
  note: string | null;
  created_at: string;
  requested_at: string | null;
  paid_at: string | null;
  sale: SaleRef;
};

const STATUS_PILL: Record<CommissionStatus, string> = {
  accrued: "border-white/15 bg-white/5 text-gray-300",
  requested: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  paid: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
  cancelled: "border-red-400/40 bg-red-500/10 text-red-300",
};

const FILTER_KEYS = ["tutte", "accrued", "requested", "paid", "cancelled"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-CH", { dateStyle: "medium" }).format(d);
}

function fmtAmount(amount: number | null | undefined, currency: string | null | undefined): string {
  const cur = (currency ?? "CHF").trim().toUpperCase() || "CHF";
  const value = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat("it-CH", { style: "currency", currency: cur }).format(value);
  } catch {
    return `${value.toFixed(2)} ${cur}`;
  }
}

function fmtByCurrency(map: Map<string, number>): string {
  if (map.size === 0) return "—";
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cur, sum]) => fmtAmount(sum, cur))
    .join(" · ");
}

/** Etichetta vendita: prodotto dal join sale (se la policy lo consente) o note. */
function saleLabel(row: CommissionRow): string {
  if (row.sale?.product_name) return row.sale.product_name;
  if (row.note) return row.note;
  return SALE_UNKNOWN;
}

/**
 * Pagina Commissioni del coach (voce account): TUTTE le proprie commissioni
 * (la dashboard ne mostra solo le ultime), con filtri di stato, cerca-tutto e
 * richiesta pagamento (singola o cumulativa). DB-first: RLS beneficiary per
 * commissions; il dettaglio vendita arriva dal join `sale` (policy
 * sales_coach_read) con fallback sulla note quando assente.
 */
export function CoachCommissionsView() {
  const t = useTranslations("CoachCommissionsView");
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("tutte");
  const [query, setQuery] = useState("");

  const statusLabel = useCallback((status: CommissionStatus) => t(`status_${status}`), [t]);

  const load = useCallback(async () => {
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setErr(t("noSupabase"));
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) {
        setErr(`${t("errPrefix")}: ${t("noSession")}`);
        return;
      }
      const { data, error } = await supabase
        .from("commissions")
        .select(
          "id, amount, currency, status, note, created_at, requested_at, paid_at, sale:sales(product_name, amount, currency, created_at)",
        )
        .eq("beneficiary_user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) {
        setErr(`${t("errPrefix")}: ${error.message}`);
        return;
      }
      setRows((data ?? []) as unknown as CommissionRow[]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  /** "Richiedi pagamento": stesso contratto della dashboard (policy + trigger accrued→requested). */
  const requestPayment = useCallback(async (commissionIds: string[]) => {
    if (commissionIds.length === 0) return;
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setActionErr(t("noSupabase"));
      return;
    }
    setBusy(true);
    setActionErr(null);
    try {
      const { data, error } = await supabase
        .from("commissions")
        .update({ status: "requested" })
        .in("id", commissionIds)
        .eq("status", "accrued")
        .select("id");
      if (error || !data || data.length === 0) {
        setActionErr(t("actionUnavailable"));
        return;
      }
      const updated = new Set(data.map((row) => (row as { id: string }).id));
      setRows((prev) => prev.map((c) => (updated.has(c.id) ? { ...c, status: "requested" as const } : c)));
    } catch {
      setActionErr(t("actionUnavailable"));
    } finally {
      setBusy(false);
    }
  }, [t]);

  const sums = useMemo(() => {
    const by = (status: CommissionStatus) => {
      const m = new Map<string, number>();
      for (const c of rows) {
        if (c.status !== status) continue;
        const cur = (c.currency ?? "CHF").toUpperCase();
        m.set(cur, (m.get(cur) ?? 0) + Number(c.amount ?? 0));
      }
      return m;
    };
    return { accrued: by("accrued"), requested: by("requested"), paid: by("paid") };
  }, [rows]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { tutte: rows.length, accrued: 0, requested: 0, paid: 0, cancelled: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const base = filter === "tutte" ? rows : rows.filter((r) => r.status === filter);
    return filterRowsByQuery(
      base.map((r) => ({ ...r, _saleLabel: saleLabel(r), _statusLabel: statusLabel(r.status) })),
      query,
    );
  }, [rows, filter, query, statusLabel]);

  const accruedIds = useMemo(() => rows.filter((r) => r.status === "accrued").map((r) => r.id), [rows]);

  const summaryCards = [
    { label: t("cardAccrued"), value: fmtByCurrency(sums.accrued), tone: "text-gray-200", border: "border-white/15" },
    { label: t("cardRequested"), value: fmtByCurrency(sums.requested), tone: "text-amber-300", border: "border-amber-400/30" },
    { label: t("cardPaid"), value: fmtByCurrency(sums.paid), tone: "text-emerald-300", border: "border-emerald-400/30" },
  ];

  return (
    <div className="space-y-4">
      {/* Contatori */}
      <div className="grid gap-3 sm:grid-cols-3">
        {summaryCards.map((c) => (
          <div key={c.label} className={cn("rounded-xl border bg-white/[0.03] p-3", c.border)}>
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">{c.label}</p>
            <p className={cn("mt-1 text-lg font-bold tabular-nums", c.tone)}>{loading ? "—" : c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
        {/* Filtri + ricerca + azioni */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
          {FILTER_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                filter === key
                  ? "border-transparent bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                  : "border-white/10 bg-white/5 text-gray-400 hover:border-purple-500/40 hover:text-gray-200",
              )}
            >
              {t(`filter_${key}`)} <span className="opacity-60">{counts[key]}</span>
            </button>
          ))}
          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
            <div className="relative w-full min-w-0 sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="w-full rounded-lg border border-white/10 bg-black/30 py-1.5 pl-8 pr-2 text-xs text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none"
              />
            </div>
            {accruedIds.length > 1 ? (
              <Pro2Button
                type="button"
                className="px-3 py-1.5 text-xs"
                disabled={busy}
                onClick={() => void requestPayment(accruedIds)}
              >
                <HandCoins className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
                {t("requestAll")}
              </Pro2Button>
            ) : null}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              title={t("reload")}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:border-white/25 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
            </button>
          </div>
        </div>

        {err ? (
          <p className="px-4 py-3 text-sm text-red-400" role="alert">
            {err}
          </p>
        ) : null}
        {actionErr ? (
          <p className="px-4 py-3 text-sm text-amber-300" role="alert">
            {actionErr}
          </p>
        ) : null}

        {loading && rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">{t("loading")}</p>
        ) : visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">
            {rows.length === 0 ? t("empty") : t("emptyFiltered")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-gray-300">
              <thead className="border-b border-white/10 bg-white/5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("colDate")}</th>
                  <th className="px-4 py-3 font-semibold">{t("colSale")}</th>
                  <th className="px-4 py-3 font-semibold">{t("colAmount")}</th>
                  <th className="px-4 py-3 font-semibold">{t("colStatus")}</th>
                  <th className="px-4 py-3 font-semibold">{t("colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => {
                  const pill = STATUS_PILL[c.status];
                  return (
                    <tr key={c.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(c.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className="text-gray-200">{saleLabel(c)}</span>
                        {c.sale?.amount != null ? (
                          <span className="ml-2 text-xs text-gray-500">
                            ({fmtAmount(c.sale.amount, c.sale.currency)})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">{fmtAmount(c.amount, c.currency)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", pill)}>
                          {statusLabel(c.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {c.status === "accrued" ? (
                          <Pro2Button
                            type="button"
                            variant="secondary"
                            className="px-3 py-1.5 text-xs"
                            disabled={busy}
                            onClick={() => void requestPayment([c.id])}
                          >
                            {t("requestOne")}
                          </Pro2Button>
                        ) : c.status === "requested" ? (
                          <span className="text-xs text-gray-500">{t("beingProcessed")}</span>
                        ) : c.status === "paid" ? (
                          <span className="text-xs text-gray-500">{t("settled", { date: fmtDate(c.paid_at) })}</span>
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
        )}
      </div>
    </div>
  );
}
