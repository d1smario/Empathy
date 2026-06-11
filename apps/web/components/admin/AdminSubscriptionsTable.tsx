"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Gift, Hourglass, Layers, RefreshCw } from "lucide-react";
import type { AdminDirectoryUserRow } from "@/lib/admin/user-directory-types";
import { filterRowsByQuery } from "@/lib/admin/table-search";
import { cn } from "@/lib/cn";

const COPY = {
  loading: "Caricamento abbonamenti…",
  empty: "Nessun accesso attivo per questo filtro.",
  errPrefix: "Errore",
  reload: "Ricarica",
  searchPlaceholder: "Cerca in tutti i campi…",
  cardActive: "Attivi",
  cardTrial: "In prova",
  cardFree: "Gratis (grant)",
  cardTotal: "Totale righe",
  colUser: "Utente",
  colPlan: "Piano",
  colSource: "Fonte",
  colStatus: "Stato",
  colUntil: "Scadenza",
} as const;

type PlanFilter = "tutti" | "silver" | "gold" | "gratis";

const FILTERS: { key: PlanFilter; label: string }[] = [
  { key: "tutti", label: "Tutti" },
  { key: "silver", label: "Silver" },
  { key: "gold", label: "Gold" },
  { key: "gratis", label: "Gratis" },
];

type StatusFilter = "tutti" | "attivi" | "prova" | "gratis";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "tutti", label: "Tutti" },
  { key: "attivi", label: "Attivi" },
  { key: "prova", label: "In prova" },
  { key: "gratis", label: "Gratis" },
];

type SubscriptionRow = {
  key: string;
  email: string;
  plan: "silver" | "gold" | "gratis" | "altro";
  planLabel: string;
  source: "Stripe" | "Grant";
  status: string;
  until: string | null;
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-CH", { dateStyle: "medium" }).format(d);
}

/** true se la riga rientra nel filtro stato (combinabile col filtro piano). */
function rowMatchesStatus(r: SubscriptionRow, f: StatusFilter): boolean {
  if (f === "tutti") return true;
  if (f === "attivi") return r.status === "Attivo";
  if (f === "prova") return r.status === "In prova";
  return r.source === "Grant";
}

/** Badge base (Console v2): pill compatta con bordo. */
const BADGE_BASE = "inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium";

/** Piani come badge cyan (Console v2). */
const PLAN_BADGE = "border-cyan-400/30 bg-cyan-400/10 text-cyan-300";

/** Stato abbonamento: attivo=emerald, trial=sky, scaduto/cancellato=rose, altro=zinc. */
function statusBadgeClass(status: string): string {
  if (status === "Attivo") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (status === "In prova") return "border-sky-400/30 bg-sky-400/10 text-sky-300";
  const s = status.toLowerCase();
  if (["canceled", "cancelled", "incomplete_expired", "past_due", "unpaid", "expired", "paused"].includes(s)) {
    return "border-rose-400/30 bg-rose-400/10 text-rose-300";
  }
  return "border-zinc-400/30 bg-zinc-400/10 text-zinc-300";
}

/** Deriva le righe abbonamento (Stripe + grant) dalla directory utenti admin. */
function rowsFromDirectory(users: AdminDirectoryUserRow[]): SubscriptionRow[] {
  const rows: SubscriptionRow[] = [];
  for (const u of users) {
    const email = u.email ?? u.userId;
    for (const [i, s] of u.stripeSubscriptions.entries()) {
      const plan = s.basePlanId === "silver" ? "silver" : s.basePlanId === "gold" ? "gold" : "altro";
      rows.push({
        key: `${u.userId}:stripe:${i}`,
        email,
        plan,
        planLabel: s.basePlanId ? s.basePlanId.charAt(0).toUpperCase() + s.basePlanId.slice(1) : "Piano",
        source: "Stripe",
        status: s.status === "trialing" ? "In prova" : s.status === "active" ? "Attivo" : s.status,
        until: s.currentPeriodEnd,
      });
    }
    if (u.entitlement.source === "grant_active") {
      rows.push({
        key: `${u.userId}:grant`,
        email,
        plan: "gratis",
        planLabel: u.entitlement.label || "Accesso gratuito",
        source: "Grant",
        status: "Attivo",
        until: u.entitlement.validUntil,
      });
    }
  }
  // Stripe prima (trial/attivi), poi grant; dentro al gruppo per scadenza più vicina.
  return rows.sort((a, b) => {
    if (a.source !== b.source) return a.source === "Stripe" ? -1 : 1;
    return (a.until ?? "9999").localeCompare(b.until ?? "9999");
  });
}

/**
 * Abbonamenti admin: vista unica degli accessi attivi — piani venduti via Stripe
 * (Silver/Gold, attivi o in prova) e accessi gratuiti concessi (grant).
 * Fonte dati: la stessa directory utenti della pagina Utenti.
 */
export function AdminSubscriptionsTable() {
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<PlanFilter>("tutti");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("tutti");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const collected: AdminDirectoryUserRow[] = [];
      let page = 1;
      // Directory paginata: accumula fino a esaurimento (cap difensivo 10 pagine).
      for (; page <= 10; page += 1) {
        const res = await fetch(`/api/admin/users/directory?page=${page}&perPage=100`, { cache: "no-store" });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          users?: AdminDirectoryUserRow[];
          hasMore?: boolean;
        };
        if (!res.ok || !data.ok) {
          setErr(data.error ?? `${COPY.errPrefix} ${res.status}`);
          return;
        }
        collected.push(...(data.users ?? []));
        if (!data.hasMore) break;
      }
      setRows(rowsFromDirectory(collected));
    } catch {
      setErr(`${COPY.errPrefix}: richiesta non riuscita.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<PlanFilter, number> = { tutti: rows.length, silver: 0, gold: 0, gratis: 0 };
    for (const r of rows) {
      if (r.plan === "silver") c.silver += 1;
      else if (r.plan === "gold") c.gold += 1;
      else if (r.plan === "gratis") c.gratis += 1;
    }
    return c;
  }, [rows]);

  const statusCounts = useMemo(() => {
    const c: Record<StatusFilter, number> = { tutti: rows.length, attivi: 0, prova: 0, gratis: 0 };
    for (const r of rows) {
      if (r.status === "Attivo") c.attivi += 1;
      if (r.status === "In prova") c.prova += 1;
      if (r.source === "Grant") c.gratis += 1;
    }
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const base = rows.filter((r) => (filter === "tutti" || r.plan === filter) && rowMatchesStatus(r, statusFilter));
    return filterRowsByQuery(base, query);
  }, [rows, filter, statusFilter, query]);

  const summaryCards: { label: string; value: number; Icon: typeof BadgeCheck; chip: string }[] = [
    { label: COPY.cardActive, value: statusCounts.attivi, Icon: BadgeCheck, chip: "bg-emerald-400/10 text-emerald-300" },
    { label: COPY.cardTrial, value: statusCounts.prova, Icon: Hourglass, chip: "bg-sky-400/10 text-sky-300" },
    { label: COPY.cardFree, value: statusCounts.gratis, Icon: Gift, chip: "bg-cyan-400/10 text-cyan-300" },
    { label: COPY.cardTotal, value: rows.length, Icon: Layers, chip: "bg-sky-400/10 text-sky-300" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summaryCards.map((c) => (
          <div key={c.label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <span className={cn("rounded-lg p-2", c.chip)}>
              <c.Icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] uppercase tracking-wider text-zinc-500">{c.label}</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-white">{loading && rows.length === 0 ? "—" : c.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
              filter === f.key
                ? "border-sky-400/60 bg-sky-500/15 text-white"
                : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/25 hover:text-zinc-200",
            )}
          >
            {f.label}
            <span className="ml-1.5 font-mono text-[0.65rem] tabular-nums text-zinc-500">{counts[f.key]}</span>
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-white/10" aria-hidden />
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
              statusFilter === f.key
                ? "border-sky-400/60 bg-sky-500/15 text-white"
                : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/25 hover:text-zinc-200",
            )}
          >
            {f.label}
            <span className="ml-1.5 font-mono text-[0.65rem] tabular-nums text-zinc-500">{statusCounts[f.key]}</span>
          </button>
        ))}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={COPY.searchPlaceholder}
          aria-label={COPY.searchPlaceholder}
          className="min-w-[11rem] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/60 focus:outline-none sm:max-w-xs"
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

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-2.5 font-medium">{COPY.colUser}</th>
              <th className="px-3 py-2.5 font-medium">{COPY.colPlan}</th>
              <th className="px-3 py-2.5 font-medium">{COPY.colSource}</th>
              <th className="px-3 py-2.5 font-medium">{COPY.colStatus}</th>
              <th className="px-3 py-2.5 font-medium">{COPY.colUntil}</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-zinc-500">
                  {COPY.loading}
                </td>
              </tr>
            ) : null}
            {!loading && visible.length === 0 && !err ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-zinc-500">
                  {COPY.empty}
                </td>
              </tr>
            ) : null}
            {visible.map((r) => (
              <tr key={r.key} className="border-b border-white/5 transition-colors even:bg-white/[0.015] hover:bg-white/[0.04]">
                <td className="max-w-[16rem] truncate px-4 py-3 font-medium text-white">{r.email}</td>
                <td className="px-3 py-3">
                  <span className={cn(BADGE_BASE, PLAN_BADGE)}>
                    {r.plan === "gratis" ? "Gratis" : r.planLabel}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-zinc-400">{r.source}</td>
                <td className="px-3 py-3">
                  <span className={cn(BADGE_BASE, statusBadgeClass(r.status))}>{r.status}</span>
                </td>
                <td className="px-3 py-3 text-xs text-zinc-400">{fmtDate(r.until)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
