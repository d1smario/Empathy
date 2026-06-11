"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  HandCoins,
  KeyRound,
  RefreshCw,
  ShoppingCart,
  UserCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  type SaleStatus,
  STATUS_LABEL,
  STATUS_PILL,
  fmtAmount,
  fmtDate,
} from "@/components/admin/sales/sales-shared";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/cn";

const COPY = {
  loading: "Caricamento dati piattaforma…",
  noSupabase: "Configurazione Supabase mancante (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
  errPrefix: "Errore",
  reload: "Ricarica",
  updatedAt: "Aggiornato alle",
  cardUsers: "Utenti",
  cardUsersSub: "negli ultimi 30 giorni",
  cardCoaches: "Coach attivi",
  cardCoachesSub: "in attesa di approvazione",
  cardSales: "Vendite",
  cardSalesSub: "negli ultimi 30 giorni",
  cardRevenue: "Incasso totale",
  cardRevenueSub: "Ultimi 30 giorni:",
  cardAccess: "Accessi attivi",
  cardAccessStripe: "Stripe",
  cardAccessTrial: "in prova",
  cardAccessGrant: "grant",
  cardCommissions: "Commissioni maturate",
  cardCommissionsRequested: "Richieste:",
  cardCommissionsPaid: "Pagate:",
  trendTitle: "Trend vendite · 30 giorni",
  trendEmpty: "Nessun incasso negli ultimi 30 giorni — il grafico si popolerà con le prime vendite.",
  trendNoRevenue: "Nessun incasso",
  lastSalesTitle: "Ultime vendite",
  lastSalesEmpty: "Nessuna vendita registrata finora — arriveranno dal checkout Stripe o da Genera vendita.",
  lastSalesAll: "Vedi tutte →",
  colDate: "Data",
  colProduct: "Prodotto",
  colAmount: "Importo",
  colStatus: "Stato",
  productsTitle: "Ripartizione per prodotto",
  productsEmpty: "Nessun prodotto venduto finora — la ripartizione apparirà con le prime vendite.",
  productsSalesUnit: "vendite",
  productsSaleUnit: "vendita",
  unknownProduct: "Prodotto sconosciuto",
} as const;

type ProfileRow = {
  role: "private" | "coach" | null;
  platform_coach_status: string | null;
  created_at: string | null;
};

type SaleLite = {
  id: string;
  product_code: string | null;
  product_name: string | null;
  amount: number | null;
  currency: string | null;
  status: SaleStatus;
  created_at: string;
};

type SubscriptionLite = {
  status: string | null;
  current_period_end: string | null;
};

type GrantLite = {
  ends_at: string | null;
  revoked_at: string | null;
};

type CommissionLite = {
  amount: number | null;
  currency: string | null;
  status: "accrued" | "requested" | "paid" | "cancelled";
};

type DashboardData = {
  profiles: ProfileRow[];
  sales: SaleLite[];
  subscriptions: SubscriptionLite[];
  grants: GrantLite[];
  commissions: CommissionLite[];
};

const EMPTY_DATA: DashboardData = { profiles: [], sales: [], subscriptions: [], grants: [], commissions: [] };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** true se la vendita conta negli incassi (esclude rimborsate e fallite). */
function countsAsRevenue(s: SaleLite): boolean {
  return s.status === "paid" || s.status === "free";
}

/** Accumula un importo nella mappa valuta → somma (valuta normalizzata, default CHF). */
function addAmount(map: Map<string, number>, currency: string | null | undefined, amount: number | null | undefined) {
  const cur = (currency ?? "CHF").trim().toUpperCase() || "CHF";
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value)) return;
  map.set(cur, (map.get(cur) ?? 0) + value);
}

/** "CHF 120.00 · EUR 50.00" — somme formattate per valuta, "—" se vuota. */
function fmtByCurrency(map: Map<string, number>): string {
  if (map.size === 0) return "—";
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cur, sum]) => fmtAmount(sum, cur))
    .join(" · ");
}

/** Chiave giorno locale YYYY-MM-DD (per bucketizzare il trend). */
function dayKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

type TrendDay = {
  key: string;
  label: string;
  total: number;
  byCurrency: Map<string, number>;
};

type ProductAgg = {
  key: string;
  name: string;
  count: number;
  total: number;
  byCurrency: Map<string, number>;
};

/**
 * Dashboard admin (DB-first): KPI piattaforma, trend vendite 30 giorni, ultime
 * vendite e ripartizione per prodotto — tutto calcolato client-side da query
 * Supabase dirette dal browser (RLS platform_admin_all).
 */
export function AdminDashboardView() {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setErr(COPY.noSupabase);
      setLoading(false);
      return;
    }
    try {
      const [profilesRes, salesRes, subsRes, grantsRes, commissionsRes] = await Promise.all([
        supabase.from("app_user_profiles").select("role, platform_coach_status, created_at").limit(10000),
        supabase
          .from("sales")
          .select("id, product_code, product_name, amount, currency, status, created_at")
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase.from("billing_subscriptions").select("status, current_period_end").limit(5000),
        supabase.from("subscription_grants").select("ends_at, revoked_at").limit(5000),
        supabase.from("commissions").select("amount, currency, status").limit(5000),
      ]);
      const firstError =
        profilesRes.error ?? salesRes.error ?? subsRes.error ?? grantsRes.error ?? commissionsRes.error;
      if (firstError) {
        setErr(`${COPY.errPrefix}: ${firstError.message}`);
        return;
      }
      setData({
        profiles: (profilesRes.data ?? []) as ProfileRow[],
        sales: (salesRes.data ?? []) as SaleLite[],
        subscriptions: (subsRes.data ?? []) as SubscriptionLite[],
        grants: (grantsRes.data ?? []) as GrantLite[],
        commissions: (commissionsRes.data ?? []) as CommissionLite[],
      });
      setLoaded(true);
      setUpdatedAt(new Intl.DateTimeFormat("it-CH", { timeStyle: "short" }).format(new Date()));
    } catch {
      setErr(`${COPY.errPrefix}: richiesta non riuscita.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kpi = useMemo(() => {
    const now = Date.now();
    const cutoff = now - THIRTY_DAYS_MS;

    // Utenti (created_at verificato presente su app_user_profiles).
    const usersTotal = data.profiles.length;
    let usersNew30 = 0;
    let coachesApproved = 0;
    let coachesPending = 0;
    for (const p of data.profiles) {
      if (p.created_at && new Date(p.created_at).getTime() >= cutoff) usersNew30 += 1;
      if (p.role === "coach") {
        if (p.platform_coach_status === "approved") coachesApproved += 1;
        else if (p.platform_coach_status === "pending") coachesPending += 1;
      }
    }

    // Vendite e incassi (incassi senza rimborsate/fallite).
    const salesTotal = data.sales.length;
    let sales30 = 0;
    const revenueTotal = new Map<string, number>();
    const revenue30 = new Map<string, number>();
    for (const s of data.sales) {
      const t = new Date(s.created_at).getTime();
      const recent = Number.isFinite(t) && t >= cutoff;
      if (recent) sales30 += 1;
      if (!countsAsRevenue(s)) continue;
      addAmount(revenueTotal, s.currency, s.amount);
      if (recent) addAmount(revenue30, s.currency, s.amount);
    }

    // Accessi attivi: abbonamenti Stripe attivi/in prova non scaduti + grant attivi.
    let stripeActive = 0;
    let stripeTrial = 0;
    for (const sub of data.subscriptions) {
      const notExpired = sub.current_period_end ? new Date(sub.current_period_end).getTime() > now : false;
      if (!notExpired) continue;
      if (sub.status === "active") stripeActive += 1;
      else if (sub.status === "trialing") stripeTrial += 1;
    }
    let grantsActive = 0;
    for (const g of data.grants) {
      if (g.revoked_at) continue;
      if (g.ends_at && new Date(g.ends_at).getTime() > now) grantsActive += 1;
    }

    // Commissioni per stato (somme per valuta).
    const commAccrued = new Map<string, number>();
    const commRequested = new Map<string, number>();
    const commPaid = new Map<string, number>();
    for (const c of data.commissions) {
      if (c.status === "accrued") addAmount(commAccrued, c.currency, c.amount);
      else if (c.status === "requested") addAmount(commRequested, c.currency, c.amount);
      else if (c.status === "paid") addAmount(commPaid, c.currency, c.amount);
    }

    return {
      usersTotal,
      usersNew30,
      coachesApproved,
      coachesPending,
      salesTotal,
      sales30,
      revenueTotal,
      revenue30,
      stripeActive,
      stripeTrial,
      grantsActive,
      commAccrued,
      commRequested,
      commPaid,
    };
  }, [data]);

  // Trend ultimi 30 giorni: un bucket per giorno, incasso (no rimborsate/fallite).
  const trend = useMemo<TrendDay[]>(() => {
    const days: TrendDay[] = [];
    const byKey = new Map<string, TrendDay>();
    const labelFmt = new Intl.DateTimeFormat("it-CH", { day: "2-digit", month: "short" });
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const day: TrendDay = { key: dayKey(d), label: labelFmt.format(d), total: 0, byCurrency: new Map() };
      days.push(day);
      byKey.set(day.key, day);
    }
    for (const s of data.sales) {
      if (!countsAsRevenue(s)) continue;
      const d = new Date(s.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const bucket = byKey.get(dayKey(d));
      if (!bucket) continue;
      bucket.total += Number(s.amount ?? 0) || 0;
      addAmount(bucket.byCurrency, s.currency, s.amount);
    }
    return days;
  }, [data.sales]);

  const trendMax = useMemo(() => Math.max(...trend.map((d) => d.total), 0), [trend]);

  // Ripartizione per prodotto (group by product_code, incassi senza rimborsate/fallite).
  const products = useMemo<ProductAgg[]>(() => {
    const byCode = new Map<string, ProductAgg>();
    for (const s of data.sales) {
      if (!countsAsRevenue(s)) continue;
      const key = s.product_code ?? s.product_name ?? "—";
      let agg = byCode.get(key);
      if (!agg) {
        agg = { key, name: s.product_name ?? s.product_code ?? COPY.unknownProduct, count: 0, total: 0, byCurrency: new Map() };
        byCode.set(key, agg);
      }
      agg.count += 1;
      agg.total += Number(s.amount ?? 0) || 0;
      addAmount(agg.byCurrency, s.currency, s.amount);
    }
    return [...byCode.values()].sort((a, b) => b.total - a.total || b.count - a.count);
  }, [data.sales]);

  const productsMax = useMemo(
    () => Math.max(...products.map((p) => (p.total > 0 ? p.total : p.count)), 0),
    [products],
  );

  const lastSales = useMemo(() => data.sales.slice(0, 8), [data.sales]);

  const pending = loading && !loaded;
  const dash = (v: string | number) => (pending ? "—" : v);

  const cards: { label: string; value: string; sub: ReactNode; accent: string; chip: string; icon: LucideIcon }[] = [
    {
      label: COPY.cardUsers,
      value: String(dash(kpi.usersTotal)),
      sub: (
        <>
          <span className="font-mono tabular-nums text-emerald-300">+{pending ? "—" : kpi.usersNew30}</span>{" "}
          {COPY.cardUsersSub}
        </>
      ),
      accent: "border-cyan-400/30 bg-cyan-500/5",
      chip: "bg-cyan-400/10 text-cyan-300",
      icon: Users,
    },
    {
      label: COPY.cardCoaches,
      value: String(dash(kpi.coachesApproved)),
      sub: (
        <>
          <span className="font-mono tabular-nums text-amber-300">{pending ? "—" : kpi.coachesPending}</span>{" "}
          {COPY.cardCoachesSub}
        </>
      ),
      accent: "border-violet-400/30 bg-violet-500/5",
      chip: "bg-violet-400/10 text-violet-300",
      icon: UserCheck,
    },
    {
      label: COPY.cardSales,
      value: String(dash(kpi.salesTotal)),
      sub: (
        <>
          <span className="font-mono tabular-nums text-emerald-300">{pending ? "—" : kpi.sales30}</span>{" "}
          {COPY.cardSalesSub}
        </>
      ),
      accent: "border-orange-400/30 bg-orange-500/5",
      chip: "bg-orange-400/10 text-orange-300",
      icon: ShoppingCart,
    },
    {
      label: COPY.cardRevenue,
      value: pending ? "—" : fmtByCurrency(kpi.revenueTotal),
      sub: (
        <>
          {COPY.cardRevenueSub}{" "}
          <span className="font-mono tabular-nums text-emerald-300">{pending ? "—" : fmtByCurrency(kpi.revenue30)}</span>
        </>
      ),
      accent: "border-emerald-400/30 bg-emerald-500/5",
      chip: "bg-emerald-400/10 text-emerald-300",
      icon: Wallet,
    },
    {
      label: COPY.cardAccess,
      value: String(dash(kpi.stripeActive + kpi.stripeTrial + kpi.grantsActive)),
      sub: pending ? (
        "—"
      ) : (
        <>
          <span className="font-mono tabular-nums text-zinc-200">{kpi.stripeActive + kpi.stripeTrial}</span>{" "}
          {COPY.cardAccessStripe} (<span className="font-mono tabular-nums text-amber-300">{kpi.stripeTrial}</span>{" "}
          {COPY.cardAccessTrial}) ·{" "}
          <span className="font-mono tabular-nums text-zinc-200">{kpi.grantsActive}</span> {COPY.cardAccessGrant}
        </>
      ),
      accent: "border-sky-400/30 bg-sky-500/5",
      chip: "bg-sky-400/10 text-sky-300",
      icon: KeyRound,
    },
    {
      label: COPY.cardCommissions,
      value: pending ? "—" : fmtByCurrency(kpi.commAccrued),
      sub: pending ? (
        "—"
      ) : (
        <>
          {COPY.cardCommissionsRequested}{" "}
          <span className="font-mono tabular-nums text-amber-300">{fmtByCurrency(kpi.commRequested)}</span> ·{" "}
          {COPY.cardCommissionsPaid}{" "}
          <span className="font-mono tabular-nums text-emerald-300">{fmtByCurrency(kpi.commPaid)}</span>
        </>
      ),
      accent: "border-amber-400/30 bg-amber-500/5",
      chip: "bg-amber-400/10 text-amber-300",
      icon: HandCoins,
    },
  ];

  const hasTrendRevenue = trendMax > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {updatedAt ? (
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-600">
            {COPY.updatedAt} {updatedAt}
          </p>
        ) : null}
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
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className={cn("rounded-xl border p-3", c.accent)}>
            <div className="flex items-start gap-3">
              <span className={cn("mt-0.5 shrink-0 rounded-lg p-2", c.chip)}>
                <c.icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">{c.label}</p>
                <p className="mt-0.5 truncate text-xl font-semibold tabular-nums text-white" title={c.value}>
                  {c.value}
                </p>
                <p className="mt-0.5 truncate text-[0.7rem] text-zinc-500">{c.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Trend vendite 30 giorni */}
      <section className="rounded-2xl border border-orange-400/20 bg-white/[0.02] p-4 backdrop-blur-md">
        <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-orange-300">{COPY.trendTitle}</h2>
        {pending ? (
          <p className="py-8 text-center text-xs text-gray-500">{COPY.loading}</p>
        ) : hasTrendRevenue ? (
          <>
            <div className="mt-4 flex h-24 items-end gap-[2px]" role="img" aria-label={COPY.trendTitle}>
              {trend.map((d) => (
                <div
                  key={d.key}
                  className="flex h-full flex-1 items-end"
                  title={`${d.label} · ${d.total > 0 ? fmtByCurrency(d.byCurrency) : COPY.trendNoRevenue}`}
                >
                  <div
                    className={cn(
                      "w-full rounded-t-sm transition",
                      d.total > 0 ? "bg-orange-400/70 hover:bg-orange-300" : "bg-white/10",
                    )}
                    style={{ height: d.total > 0 ? `${Math.max((d.total / trendMax) * 100, 6)}%` : "2px" }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[0.6rem] text-gray-600">
              <span>{trend[0]?.label}</span>
              <span>{trend[trend.length - 1]?.label}</span>
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-xs text-gray-500">{COPY.trendEmpty}</p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Ultime vendite */}
        <section className="rounded-2xl border border-rose-400/20 bg-white/[0.02] backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-rose-300">{COPY.lastSalesTitle}</h2>
            <Link href="/admin/vendite" className="text-xs font-medium text-rose-300 transition hover:text-rose-200">
              {COPY.lastSalesAll}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-2.5 font-medium">{COPY.colDate}</th>
                  <th className="px-3 py-2.5 font-medium">{COPY.colProduct}</th>
                  <th className="px-3 py-2.5 text-right font-medium text-emerald-400/70">{COPY.colAmount}</th>
                  <th className="px-3 py-2.5 font-medium">{COPY.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {pending ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-500">
                      {COPY.loading}
                    </td>
                  </tr>
                ) : null}
                {!pending && lastSales.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-500">
                      {COPY.lastSalesEmpty}
                    </td>
                  </tr>
                ) : null}
                {!pending &&
                  lastSales.map((s) => (
                    <tr key={s.id} className="border-b border-white/5 transition even:bg-white/[0.015] hover:bg-white/[0.04]">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-400">{fmtDate(s.created_at)}</td>
                      <td className="max-w-[14rem] truncate px-3 py-3 font-medium text-white">
                        {s.product_name ?? s.product_code ?? "—"}
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-3 py-3 text-right font-mono text-xs tabular-nums",
                          s.status === "paid" || s.status === "free" ? "text-emerald-300" : "text-zinc-500",
                        )}
                      >
                        {fmtAmount(s.amount, s.currency)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            STATUS_PILL[s.status] ?? STATUS_PILL.paid,
                          )}
                        >
                          {STATUS_LABEL[s.status] ?? s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Ripartizione per prodotto */}
        <section className="rounded-2xl border border-sky-400/20 bg-white/[0.02] p-4 backdrop-blur-md">
          <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-sky-300">{COPY.productsTitle}</h2>
          {pending ? (
            <p className="py-8 text-center text-xs text-gray-500">{COPY.loading}</p>
          ) : products.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-500">{COPY.productsEmpty}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {products.map((p) => {
                const measure = p.total > 0 ? p.total : p.count;
                const width = productsMax > 0 ? Math.max((measure / productsMax) * 100, 4) : 4;
                return (
                  <li key={p.key}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-white" title={p.name}>
                        {p.name}
                      </p>
                      <p className="shrink-0 font-mono text-xs tabular-nums text-zinc-500">
                        <span className="text-zinc-200">{p.count}</span>{" "}
                        {p.count === 1 ? COPY.productsSaleUnit : COPY.productsSalesUnit} ·{" "}
                        <span className="text-emerald-300">{fmtByCurrency(p.byCurrency)}</span>
                      </p>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-sky-400/70" style={{ width: `${width}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
