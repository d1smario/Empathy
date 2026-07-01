"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, RefreshCw } from "lucide-react";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { coachOrgIdForClient } from "@/lib/coach-org-id";
import { cn } from "@/lib/cn";

const COPY = {
  eyebrow: "Dashboard · Coach",
  title: "Dashboard",
  descriptionBase: "Athletes, sessions of the week and commissions at a glance.",
  loading: "Loading data…",
  noSupabase: "Missing Supabase configuration (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
  noSession: "Session not found — sign in again to see your dashboard.",
  errPrefix: "Error",
  reload: "Reload",
  updatedAt: "Updated at",
  cardAthletes: "Athletes",
  cardAthletesSub: "linked to your account",
  cardPlanned: "Planned sessions",
  cardPlannedSub: "this week (Mon–Sun)",
  cardExecuted: "Completed workouts",
  cardExecutedSub: "in the last 7 days",
  cardCommissions: "Accrued commissions",
  cardCommissionsSubSuffix: "awaiting request",
  athletesTitle: "My athletes",
  athletesEmpty: "No athletes assigned — invite your athletes or wait for assignment.",
  athletePlanned: "planned this week",
  athleteExecuted: "completed in the last 7d",
  openCards: "Open cards",
  commissionsTitle: "Commissions",
  commissionsEmpty: "No commissions recorded — they will accrue with sales linked to your account.",
  colDate: "Date",
  colAmount: "Amount",
  colStatus: "Status",
  colActions: "Actions",
  actionRequest: "Request payment",
  actionRequestAll: "Request all",
  actionUnavailable: "Feature available soon (DB to be updated)",
} as const;

type AthleteRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

/** Riga leggera per i contatori: `date` è la colonna canonica di planned/executed_workouts. */
type WorkoutLite = {
  athlete_id: string;
  date: string | null;
};

type CommissionStatus = "accrued" | "requested" | "paid" | "cancelled";

type CommissionRow = {
  id: string;
  amount: number | null;
  currency: string | null;
  status: CommissionStatus;
  created_at: string;
};

const COMMISSION_STATUS_META: Record<CommissionStatus, { label: string; pill: string }> = {
  accrued: { label: "Accrued", pill: "border-white/15 bg-white/5 text-gray-300" },
  requested: { label: "Requested", pill: "border-amber-400/40 bg-amber-500/10 text-amber-200" },
  paid: { label: "Paid", pill: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" },
  cancelled: { label: "Cancelled", pill: "border-red-400/40 bg-red-500/10 text-red-300" },
};

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

/** "CHF 120.00 · EUR 50.00" — somme formattate per valuta, "—" se vuota. */
function fmtByCurrency(map: Map<string, number>): string {
  if (map.size === 0) return "—";
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cur, sum]) => fmtAmount(sum, cur))
    .join(" · ");
}

/** Chiave giorno locale YYYY-MM-DD (le colonne `date` dei workout sono date pure). */
function dayKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Settimana corrente lunedì→domenica in chiavi giorno locali. */
function currentWeekRange(): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: dayKey(monday), to: dayKey(sunday) };
}

/** Ultimi 7 giorni (oggi incluso) in chiavi giorno locali. */
function last7DaysRange(): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  return { from: dayKey(start), to: dayKey(today) };
}

function athleteLabel(a: AthleteRow): string {
  const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (a.email) return a.email;
  return a.id.slice(0, 8);
}

// Cache cross-mount della dashboard coach: ri-atterrando sulla pagina i dati
// compaiono subito (niente spinner/"Caricamento dati…"); il refetch parte sempre
// in background silenzioso, così le commissioni e i contatori restano freschi e le
// mutazioni (richiedi pagamento) si riflettono al successivo refresh. Keyed per
// utente coach (uid sessione): mai mostrare i dati di un coach a un altro.
let coachDashboardCacheId: string | null = null;
let coachDashboardCache: {
  firstName: string | null;
  athletes: AthleteRow[];
  planned: WorkoutLite[];
  executed: WorkoutLite[];
  commissions: CommissionRow[];
  updatedAt: string | null;
} | null = null;

/**
 * Home operativa del coach (DB-first): roster da `coach_athletes` → `athlete_profiles`,
 * contatori settimana/7gg da `planned_workouts` / `executed_workouts` (colonna `date`,
 * RLS coach sui propri atleti) e commissioni proprie (policy beneficiary) con richiesta
 * di pagamento via update di stato — tutto con query Supabase dirette dal browser.
 */
export function CoachDashboardView() {
  const [firstName, setFirstName] = useState<string | null>(null);
  const [athletes, setAthletes] = useState<AthleteRow[]>([]);
  const [planned, setPlanned] = useState<WorkoutLite[]>([]);
  const [executed, setExecuted] = useState<WorkoutLite[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setActionErr(null);
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setErr(COPY.noSupabase);
      setLoading(false);
      return;
    }
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      const session = sessionData?.session ?? null;
      if (sessionErr || !session) {
        setErr(COPY.noSession);
        setLoading(false);
        return;
      }
      const uid = session.user.id;
      const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
      setFirstName(typeof meta.first_name === "string" && meta.first_name.trim() ? meta.first_name.trim() : null);

      // Cache per QUESTO coach (uid): mostra subito i dati (niente spinner) e
      // prosegui comunque col refetch in background per tenerli freschi.
      const cached = coachDashboardCacheId === uid ? coachDashboardCache : null;
      if (cached) {
        setFirstName(cached.firstName);
        setAthletes(cached.athletes);
        setPlanned(cached.planned);
        setExecuted(cached.executed);
        setCommissions(cached.commissions);
        setUpdatedAt(cached.updatedAt);
        setLoaded(true);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const { data: linkRows, error: linkErr } = await supabase
        .from("coach_athletes")
        .select("athlete_id")
        .eq("org_id", coachOrgIdForClient())
        .eq("coach_user_id", uid)
        .limit(1000);
      if (linkErr) {
        setErr(`${COPY.errPrefix}: ${linkErr.message}`);
        return;
      }
      const ids = Array.from(
        new Set(
          (linkRows ?? [])
            .map((row) => String((row as { athlete_id?: string | null }).athlete_id ?? "").trim())
            .filter(Boolean),
        ),
      );

      const week = currentWeekRange();
      const last7 = last7DaysRange();

      // Limit 500 (non 10): il KPI somma TUTTE le maturate, la lista mostra le prime 10.
      const commissionsQuery = supabase
        .from("commissions")
        .select("id, amount, currency, status, created_at")
        .eq("beneficiary_user_id", uid)
        .order("created_at", { ascending: false })
        .limit(500);

      let nextAthletes: AthleteRow[] = [];
      let nextPlanned: WorkoutLite[] = [];
      let nextExecuted: WorkoutLite[] = [];
      let nextCommissions: CommissionRow[] = [];

      if (ids.length === 0) {
        const commissionsRes = await commissionsQuery;
        if (commissionsRes.error) {
          setErr(`${COPY.errPrefix}: ${commissionsRes.error.message}`);
          return;
        }
        nextAthletes = [];
        nextPlanned = [];
        nextExecuted = [];
        nextCommissions = (commissionsRes.data ?? []) as CommissionRow[];
      } else {
        const [profilesRes, plannedRes, executedRes, commissionsRes] = await Promise.all([
          supabase.from("athlete_profiles").select("id, first_name, last_name, email").in("id", ids),
          supabase
            .from("planned_workouts")
            .select("athlete_id, date")
            .in("athlete_id", ids)
            .gte("date", week.from)
            .lte("date", week.to)
            .limit(5000),
          supabase
            .from("executed_workouts")
            .select("athlete_id, date")
            .in("athlete_id", ids)
            .gte("date", last7.from)
            .lte("date", last7.to)
            .limit(5000),
          commissionsQuery,
        ]);
        const firstError = profilesRes.error ?? plannedRes.error ?? executedRes.error ?? commissionsRes.error;
        if (firstError) {
          setErr(`${COPY.errPrefix}: ${firstError.message}`);
          return;
        }
        nextAthletes = (profilesRes.data ?? []) as AthleteRow[];
        nextPlanned = (plannedRes.data ?? []) as WorkoutLite[];
        nextExecuted = (executedRes.data ?? []) as WorkoutLite[];
        nextCommissions = (commissionsRes.data ?? []) as CommissionRow[];
      }
      setAthletes(nextAthletes);
      setPlanned(nextPlanned);
      setExecuted(nextExecuted);
      setCommissions(nextCommissions);
      setLoaded(true);
      const nextUpdatedAt = new Intl.DateTimeFormat("it-CH", { timeStyle: "short" }).format(new Date());
      setUpdatedAt(nextUpdatedAt);
      const nextFirstName =
        typeof meta.first_name === "string" && meta.first_name.trim() ? meta.first_name.trim() : null;
      coachDashboardCache = {
        firstName: nextFirstName,
        athletes: nextAthletes,
        planned: nextPlanned,
        executed: nextExecuted,
        commissions: nextCommissions,
        updatedAt: nextUpdatedAt,
      };
      coachDashboardCacheId = uid;
    } catch {
      setErr(`${COPY.errPrefix}: request failed.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** "Richiedi pagamento": update di stato sulle proprie maturate (policy beneficiary + trigger). */
  const requestPayment = useCallback(async (commissionIds: string[]) => {
    if (commissionIds.length === 0) return;
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setActionErr(COPY.noSupabase);
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
      // Errore di policy/trigger O nessuna riga toccata (RLS silenziosa) → DB non ancora pronto.
      if (error || !data || data.length === 0) {
        setActionErr(COPY.actionUnavailable);
        return;
      }
      const updated = new Set(data.map((row) => (row as { id: string }).id));
      setCommissions((prev) => prev.map((c) => (updated.has(c.id) ? { ...c, status: "requested" } : c)));
      // Tieni allineata la cache cross-mount così la mutazione resta riflessa
      // anche ri-atterrando dalla cache, prima che il refetch in background giri.
      if (coachDashboardCache) {
        coachDashboardCache = {
          ...coachDashboardCache,
          commissions: coachDashboardCache.commissions.map((c) =>
            updated.has(c.id) ? { ...c, status: "requested" } : c,
          ),
        };
      }
    } catch {
      setActionErr(COPY.actionUnavailable);
    } finally {
      setBusy(false);
    }
  }, []);

  const plannedByAthlete = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of planned) m.set(w.athlete_id, (m.get(w.athlete_id) ?? 0) + 1);
    return m;
  }, [planned]);

  const executedByAthlete = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of executed) m.set(w.athlete_id, (m.get(w.athlete_id) ?? 0) + 1);
    return m;
  }, [executed]);

  const accrued = useMemo(() => commissions.filter((c) => c.status === "accrued"), [commissions]);

  const accruedByCurrency = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of accrued) {
      const cur = (c.currency ?? "CHF").trim().toUpperCase() || "CHF";
      const value = Number(c.amount ?? 0);
      if (!Number.isFinite(value)) continue;
      m.set(cur, (m.get(cur) ?? 0) + value);
    }
    return m;
  }, [accrued]);

  const lastCommissions = useMemo(() => commissions.slice(0, 10), [commissions]);

  const pending = loading && !loaded;
  const dash = (v: string | number) => (pending ? "—" : String(v));

  const cards: { label: string; value: string; sub: string; tone: string }[] = [
    {
      label: COPY.cardAthletes,
      value: dash(athletes.length),
      sub: COPY.cardAthletesSub,
      tone: "text-violet-300",
    },
    {
      label: COPY.cardPlanned,
      value: dash(planned.length),
      sub: COPY.cardPlannedSub,
      tone: "text-orange-300",
    },
    {
      label: COPY.cardExecuted,
      value: dash(executed.length),
      sub: COPY.cardExecutedSub,
      tone: "text-emerald-300",
    },
    {
      label: COPY.cardCommissions,
      value: pending ? "—" : fmtByCurrency(accruedByCurrency),
      sub: pending ? "—" : `${accrued.length} ${COPY.cardCommissionsSubSuffix}`,
      tone: "text-amber-300",
    },
  ];

  return (
    <Pro2ModulePageShell
      eyebrow={COPY.eyebrow}
      eyebrowClassName="text-violet-400"
      title={COPY.title}
      description={firstName ? `Hi ${firstName} — ${COPY.descriptionBase.toLowerCase()}` : COPY.descriptionBase}
      headerActions={
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-gray-300 transition hover:border-white/25 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
          {COPY.reload}
        </button>
      }
    >
      <div className="space-y-6">
        {updatedAt ? (
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-600">
            {COPY.updatedAt} {updatedAt}
          </p>
        ) : null}

        {err ? (
          <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">
            {err}
          </p>
        ) : null}

        {/* KPI */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">{c.label}</p>
              <p className={cn("mt-1 truncate text-xl font-bold tabular-nums", c.tone)} title={c.value}>
                {c.value}
              </p>
              <p className="mt-0.5 truncate text-[0.7rem] text-gray-500" title={c.sub}>
                {c.sub}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* I miei atleti */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-md">
            <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{COPY.athletesTitle}</h2>
            {pending ? (
              <p className="py-8 text-center text-xs text-gray-500">{COPY.loading}</p>
            ) : athletes.length === 0 ? (
              <p className="py-8 text-center text-xs text-gray-500">{COPY.athletesEmpty}</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {athletes.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{athleteLabel(a)}</p>
                      {a.email ? <p className="truncate text-xs text-gray-500">{a.email}</p> : null}
                      <p className="mt-1 text-xs text-gray-400">
                        <span className="font-mono text-orange-300">{plannedByAthlete.get(a.id) ?? 0}</span>{" "}
                        {COPY.athletePlanned} ·{" "}
                        <span className="font-mono text-emerald-300">{executedByAthlete.get(a.id) ?? 0}</span>{" "}
                        {COPY.athleteExecuted}
                      </p>
                    </div>
                    <Link
                      href={`/athletes/${a.id}/health`}
                      className="empathy-btn-gradient flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold text-white shadow-md shadow-purple-500/20 sm:w-auto"
                    >
                      <LayoutGrid className="h-4 w-4" aria-hidden />
                      {COPY.openCards}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Commissioni */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
              <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
                {COPY.commissionsTitle}
              </h2>
              {!pending && accrued.length > 1 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void requestPayment(accrued.map((c) => c.id))}
                  className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-[0.65rem] font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
                >
                  {COPY.actionRequestAll}
                </button>
              ) : null}
            </div>

            {actionErr ? (
              <p className="px-4 py-2 text-xs text-amber-200" role="alert">
                {actionErr}
              </p>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">
                    <th className="px-4 py-2.5 font-medium">{COPY.colDate}</th>
                    <th className="px-3 py-2.5 font-medium">{COPY.colAmount}</th>
                    <th className="px-3 py-2.5 font-medium">{COPY.colStatus}</th>
                    <th className="px-3 py-2.5 font-medium">{COPY.colActions}</th>
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
                  {!pending && lastCommissions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-500">
                        {COPY.commissionsEmpty}
                      </td>
                    </tr>
                  ) : null}
                  {!pending &&
                    lastCommissions.map((c) => {
                      const meta = COMMISSION_STATUS_META[c.status] ?? COMMISSION_STATUS_META.accrued;
                      return (
                        <tr key={c.id} className="border-b border-white/5">
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">{fmtDate(c.created_at)}</td>
                          <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-gray-200">
                            {fmtAmount(c.amount, c.currency)}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={cn(
                                "inline-block rounded-full border px-2 py-0.5 text-[0.65rem] font-medium",
                                meta.pill,
                              )}
                            >
                              {meta.label}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {c.status === "accrued" ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void requestPayment([c.id])}
                                className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-[0.65rem] font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
                              >
                                {COPY.actionRequest}
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
          </section>
        </div>
      </div>
    </Pro2ModulePageShell>
  );
}
