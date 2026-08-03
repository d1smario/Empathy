"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BellRing,
  Check,
  Moon,
  MoonStar,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import type { AlertKind } from "@/lib/alerts/athlete-alerts";
import { alertsSinceIso, formatAlertTime, isAlertKind } from "@/lib/alerts/alerts-ui";
import { formatAlertAthleteName, formatAlertPayloadDetail } from "@/lib/alerts/admin-alerts-format";
import { cn } from "@/lib/cn";

/**
 * Alert di TUTTA la piattaforma per il platform admin: taglio che non esiste da nessuna
 * altra parte (il coach vede solo i propri atleti, l'atleta solo i suoi). Lettura DIRETTA
 * browser→Supabase (DB-first, nessuna API route nuova): la abilita la policy
 * `athlete_alerts_admin_read` (20260803120000) — prima di quella migrazione qui non arrivava
 * NESSUNA riga, in silenzio.
 *
 * Volume: la piattaforma ha decine di atleti, quindi mai una query per riga. Sono 3 query in
 * tutto, con l'insieme di id ricavato dagli alert stessi (≤ MAX_ROWS): alert → profili atleta
 * (nome) → app_user_profiles (userId per il deep-link alla scheda utente). Nessun N+1.
 *
 * Finestra identica a quella di atleta e coach (48h, non letti): stessa fonte, stesso taglio,
 * così il conteggio dell'admin coincide con quello che vede il coach sul proprio roster.
 *
 * Copy IT hardcoded come nel resto dell'area admin (non tradotta).
 */

const COPY = {
  loading: "Caricamento alert…",
  noSupabase: "Configurazione Supabase mancante (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
  errPrefix: "Errore",
  reload: "Ricarica",
  updatedAt: "Aggiornato alle",
  empty: "Nessun alert non letto nelle ultime 48 ore su tutta la piattaforma.",
  summaryOne: "alert non letto",
  summaryMany: "alert non letti",
  athletesOne: "atleta coinvolto",
  athletesMany: "atleti coinvolti",
  window: "ultime 48 ore",
  capped: "Mostrati i più recenti: ci sono altri alert oltre questa soglia.",
  openAthlete: "Apri scheda «Oggi»",
  markRead: "Segna letto",
  markReadFailed: "Impossibile segnare l'alert come letto.",
  unknownAthlete: "Atleta senza profilo",
  dayLabel: "giorno",
} as const;

/** Tetto di righe: la lista è una coda operativa, non un archivio. Oltre, si smaltisce. */
const MAX_ROWS = 200;

/**
 * Etichette in TERZA persona: quelle i18n di `AthleteAlerts` sono scritte per l'atleta
 * («Hai dormito meno del dovuto») e in una lista admin sarebbero fuori voce.
 */
const KIND_META: Record<AlertKind, { label: string; icon: LucideIcon; tone: string }> = {
  sleep_low: {
    label: "Sonno sotto il target",
    icon: Moon,
    tone: "border-violet-400/30 bg-violet-500/10 text-violet-200",
  },
  training_over: {
    label: "Allenamento sopra il pianificato",
    icon: TrendingUp,
    tone: "border-orange-400/30 bg-orange-500/10 text-orange-200",
  },
  training_under: {
    label: "Allenamento sotto il pianificato",
    icon: TrendingDown,
    tone: "border-sky-400/30 bg-sky-500/10 text-sky-200",
  },
  plan_adjusted: {
    label: "Piano nutrizionale adattato",
    icon: UtensilsCrossed,
    tone: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  },
  sleep_missing: {
    label: "Dati del sonno mancanti",
    icon: MoonStar,
    tone: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  },
};

type AlertRow = {
  id: string;
  athlete_id: string;
  kind: AlertKind;
  date: string;
  created_at: string;
  payload: Record<string, unknown> | null;
};

type AthleteRow = { id: string; first_name: string | null; last_name: string | null; email: string | null };

/** Nessun profilo/nome: meglio un id parziale che una riga anonima, così l'alert resta tracciabile. */
function athleteLabel(a: AthleteRow | undefined, athleteId: string): string {
  return formatAlertAthleteName(a) ?? `${COPY.unknownAthlete} · ${athleteId.slice(0, 8)}`;
}

const dayFmt = new Intl.DateTimeFormat("it-CH", { day: "2-digit", month: "2-digit" });

function fmtDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : dayFmt.format(d);
}

export function AdminAlertsView() {
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [athletes, setAthletes] = useState<AthleteRow[]>([]);
  const [userIdByAthlete, setUserIdByAthlete] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setErr(COPY.noSupabase);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    setActionErr(null);
    try {
      const { data, error } = await supabase
        .from("athlete_alerts")
        .select("id, athlete_id, kind, date, created_at, payload")
        .gte("created_at", alertsSinceIso())
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(MAX_ROWS);
      if (error) {
        setErr(`${COPY.errPrefix}: ${error.message}`);
        return;
      }
      const alerts = ((data ?? []) as (Omit<AlertRow, "kind"> & { kind: string })[]).filter(
        (row): row is AlertRow => isAlertKind(row.kind),
      );

      // Un solo `in()` per tabella sull'insieme (piccolo) degli atleti che hanno alert:
      // niente lettura dell'intero roster e nessuna query per riga.
      const ids = Array.from(new Set(alerts.map((a) => a.athlete_id)));
      let nextAthletes: AthleteRow[] = [];
      const nextLinks: Record<string, string> = {};
      if (ids.length > 0) {
        const [profilesRes, linksRes] = await Promise.all([
          supabase.from("athlete_profiles").select("id, first_name, last_name, email").in("id", ids),
          supabase.from("app_user_profiles").select("user_id, athlete_id").in("athlete_id", ids),
        ]);
        // Nome e deep-link sono contorno: se falliscono, gli alert si vedono comunque
        // (fallback su id parziale) invece di sparire tutti per un errore accessorio.
        nextAthletes = (profilesRes.data ?? []) as AthleteRow[];
        for (const link of (linksRes.data ?? []) as { user_id: string; athlete_id: string | null }[]) {
          if (link.athlete_id) nextLinks[link.athlete_id] = link.user_id;
        }
      }
      setRows(alerts);
      setAthletes(nextAthletes);
      setUserIdByAthlete(nextLinks);
      setUpdatedAt(new Intl.DateTimeFormat("it-CH", { timeStyle: "short" }).format(new Date()));
    } catch (e) {
      setErr(`${COPY.errPrefix}: ${e instanceof Error ? e.message : "request failed."}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = useCallback(async (id: string) => {
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) return;
    setBusyId(id);
    setActionErr(null);
    try {
      // Solo `read_at`: è l'unica colonna concessa in update ai client (grant di colonna
      // della migrazione athlete_alerts); la policy admin_update dà la riga.
      const { error } = await supabase.from("athlete_alerts").update({ read_at: new Date().toISOString() }).eq("id", id);
      if (error) {
        setActionErr(COPY.markReadFailed);
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setActionErr(COPY.markReadFailed);
    } finally {
      setBusyId(null);
    }
  }, []);

  const athleteById = useMemo(() => {
    const map = new Map<string, AthleteRow>();
    for (const a of athletes) map.set(a.id, a);
    return map;
  }, [athletes]);

  const athleteCount = useMemo(() => new Set(rows.map((r) => r.athlete_id)).size, [rows]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-400">
          <span className="font-semibold text-white tabular-nums">{rows.length}</span>{" "}
          {rows.length === 1 ? COPY.summaryOne : COPY.summaryMany} · {COPY.window} ·{" "}
          <span className="font-semibold text-white tabular-nums">{athleteCount}</span>{" "}
          {athleteCount === 1 ? COPY.athletesOne : COPY.athletesMany}
        </p>
        <div className="flex items-center gap-3">
          {updatedAt ? (
            <span className="font-mono text-[0.65rem] uppercase tracking-wide text-gray-500">
              {COPY.updatedAt} {updatedAt}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-rose-400/40 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
            {COPY.reload}
          </button>
        </div>
      </div>

      {err ? (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
          {err}
        </p>
      ) : null}
      {actionErr ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" role="alert">
          {actionErr}
        </p>
      ) : null}

      {loading && rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-500">{COPY.loading}</p>
      ) : rows.length === 0 && !err ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-gray-500">
          {COPY.empty}
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {rows.map((row) => {
              const meta = KIND_META[row.kind];
              const Icon = meta.icon;
              const athlete = athleteById.get(row.athlete_id);
              const label = athleteLabel(athlete, row.athlete_id);
              const userId = userIdByAthlete[row.athlete_id];
              const detail = formatAlertPayloadDetail(row.kind, row.payload);
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/10 bg-black/25 px-4 py-3"
                >
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-medium",
                      meta.tone,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {meta.label}
                  </span>

                  <div className="min-w-0 flex-1">
                    {/* DI CHI è l'alert: nome atleta + link alla sua scheda «Oggi» in scope admin. */}
                    {userId ? (
                      <Link
                        href={`/admin/utenti/${userId}/today`}
                        title={COPY.openAthlete}
                        className="truncate font-medium text-white underline-offset-4 transition hover:text-rose-200 hover:underline"
                      >
                        {label}
                      </Link>
                    ) : (
                      <span className="truncate font-medium text-white">{label}</span>
                    )}
                    {detail ? <p className="truncate text-xs text-gray-400">{detail}</p> : null}
                  </div>

                  {/* QUANDO: orario reale di arrivo (created_at) + giorno a cui il dato si riferisce. */}
                  <span className="shrink-0 font-mono text-[0.65rem] uppercase tracking-wide text-gray-400">
                    {formatAlertTime(row.created_at, "it-CH")}
                    <span className="ml-2 text-gray-600">
                      {COPY.dayLabel} {fmtDay(row.date)}
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() => void markRead(row.id)}
                    disabled={busyId === row.id}
                    title={COPY.markRead}
                    aria-label={`${COPY.markRead}: ${meta.label} · ${label}`}
                    className="shrink-0 rounded-lg border border-white/15 bg-white/5 p-1.5 text-gray-300 transition hover:border-white/30 hover:bg-white/10 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          {rows.length >= MAX_ROWS ? (
            <p className="flex items-center gap-2 text-xs text-amber-200/80">
              <BellRing className="h-3.5 w-3.5" aria-hidden />
              {COPY.capped}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
