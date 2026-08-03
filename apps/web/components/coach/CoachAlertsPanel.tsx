"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { BellRing, Check, RefreshCw } from "lucide-react";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import type { AlertKind } from "@/lib/alerts/athlete-alerts";
import { ALERT_KIND_META, formatAlertTime, isAlertKind } from "@/lib/alerts/alerts-ui";
import { alertPayloadFacts } from "@/lib/alerts/alert-facts";
import { formatAthleteLabel, useCoachRoster } from "@/lib/coach/use-coach-roster";
import { cn } from "@/lib/cn";

/**
 * Lista alert degli atleti DEL COACH: una riga = un alert, come una tabella.
 * È il pezzo che mancava — finora il coach vedeva solo un badge numerico sulla dashboard,
 * cioè QUANTI ma non QUALI. Qui il capo è la lista, non il contatore.
 *
 * DB-first: lettura diretta browser→Supabase su `athlete_alerts`, abilitata dalla policy
 * `athlete_alerts_coach_read` (coach + EXISTS coach_athletes). Nessuna API route nuova.
 *
 * FINESTRA — scelta deliberata, diversa dal badge della dashboard (48h non letti):
 * quello è una spia, questa è una CODA DI LAVORO. Un alert non letto di cinque giorni fa
 * resta non letto: nasconderlo perché «vecchio» significherebbe che il coach torna da una
 * settimana di assenza e non vede più niente. Quindi NON letti = TUTTI, senza limite di
 * tempo. In più i LETTI delle ultime 24 ore, in coda e smorzati: fanno da conferma
 * («l'ho appena smaltito») e sopravvivono a un reload, invece di far sparire la riga nel
 * nulla al primo click.
 *
 * Nessun N+1 sui nomi: gli id vengono dal roster già caricato (`useCoachRoster`, cache
 * cross-mount condivisa con `CoachRosterCard`) e gli alert si leggono con UN `in()`.
 * L'errore viaggia come CODICE e si traduce al render: così le callback non dipendono
 * da `t` e non possono innescare refetch a catena.
 */

const SELECT = "id, athlete_id, kind, date, created_at, read_at, payload";

/** Tetto esplicito: coda operativa, non archivio. Raggiunto il tetto, si mostra il banner. */
const MAX_UNREAD = 200;
const MAX_READ = 30;

/** Finestra dei «letti di recente» tenuti a vista sotto la coda. */
const READ_WINDOW_MS = 24 * 60 * 60 * 1000;

type AlertRow = {
  id: string;
  athlete_id: string;
  kind: AlertKind;
  date: string;
  created_at: string;
  read_at: string | null;
  payload: Record<string, unknown> | null;
};

type LoadErrorCode = "load" | "network";

function toAlertRows(data: unknown): AlertRow[] {
  return ((data ?? []) as (Omit<AlertRow, "kind"> & { kind: string })[]).filter((row): row is AlertRow =>
    isAlertKind(row.kind),
  );
}

export function CoachAlertsPanel({ basePath = "/athletes" }: { basePath?: string }) {
  const t = useTranslations("CoachAlerts");
  const locale = useLocale();
  const { athletes, loading: rosterLoading, error: rosterError } = useCoachRoster();

  const [unread, setUnread] = useState<AlertRow[]>([]);
  const [read, setRead] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errCode, setErrCode] = useState<LoadErrorCode | null>(null);
  const [actionFailed, setActionFailed] = useState(false);
  /** Tetto raggiunto al caricamento (non ricalcolato sulla lista corrente): vedi `load`. */
  const [capped, setCapped] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Chiave stabile: il roster restituisce un array nuovo a ogni fetch anche quando gli
  // atleti sono gli stessi, e senza chiave il caricamento ripartirebbe a ogni render.
  const athleteIdsKey = useMemo(
    () =>
      athletes
        .map((a) => a.id)
        .sort()
        .join(","),
    [athletes],
  );

  const athleteById = useMemo(() => {
    const map = new Map<string, (typeof athletes)[number]>();
    for (const a of athletes) map.set(a.id, a);
    return map;
  }, [athletes]);

  const load = useCallback(async () => {
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setErrCode("load");
      setLoading(false);
      return;
    }
    const ids = athleteIdsKey ? athleteIdsKey.split(",") : [];
    if (ids.length === 0) {
      setUnread([]);
      setRead([]);
      setCapped(false);
      setErrCode(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrCode(null);
    setActionFailed(false);
    try {
      const readSince = new Date(Date.now() - READ_WINDOW_MS).toISOString();
      // Due query invece di un `or()` con timestamp inline: ognuna ha il suo tetto
      // esplicito e non c'è nessuna stringa di filtro da comporre a mano.
      const [unreadRes, readRes] = await Promise.all([
        supabase
          .from("athlete_alerts")
          .select(SELECT)
          .in("athlete_id", ids)
          .is("read_at", null)
          .order("created_at", { ascending: false })
          .limit(MAX_UNREAD),
        supabase
          .from("athlete_alerts")
          .select(SELECT)
          .in("athlete_id", ids)
          .not("read_at", "is", null)
          .gte("read_at", readSince)
          .order("read_at", { ascending: false })
          .limit(MAX_READ),
      ]);
      if (unreadRes.error) {
        setErrCode("load");
        return;
      }
      const unreadRows = toAlertRows(unreadRes.data);
      // Tetto catturato AL CARICAMENTO: confrontare la lunghezza corrente farebbe
      // sparire il banner appena si segna letto un alert, pur essendocene altri oltre.
      setCapped(unreadRows.length >= MAX_UNREAD);
      setUnread(unreadRows);
      // I letti sono contorno: se falliscono, la coda si vede lo stesso.
      setRead(readRes.error ? [] : toAlertRows(readRes.data));
    } catch {
      setErrCode("network");
    } finally {
      setLoading(false);
    }
  }, [athleteIdsKey]);

  useEffect(() => {
    if (rosterLoading) return;
    void load();
  }, [rosterLoading, load]);

  const markRead = useCallback(async (row: AlertRow) => {
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) return;
    setBusyId(row.id);
    setActionFailed(false);
    try {
      // Solo `read_at`: unica colonna concessa in update ai client (grant di colonna della
      // migrazione athlete_alerts); la riga la concede la policy `athlete_alerts_update_coach`.
      const readAt = new Date().toISOString();
      // `.select("id")`: senza, un diniego RLS torna error=null con 0 righe toccate e la
      // spunta comparirebbe pur non essendo stata salvata (bugia scoperta solo al reload).
      const { data, error } = await supabase
        .from("athlete_alerts")
        .update({ read_at: readAt })
        .eq("id", row.id)
        .select("id");
      if (error || !data || data.length === 0) {
        setActionFailed(true);
        return;
      }
      setUnread((prev) => prev.filter((r) => r.id !== row.id));
      // Spostata, non sparita: il coach vede che l'azione ha avuto effetto.
      setRead((prev) => [{ ...row, read_at: readAt }, ...prev].slice(0, MAX_READ));
    } catch {
      setActionFailed(true);
    } finally {
      setBusyId(null);
    }
  }, []);

  const dayFmt = useMemo(() => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }), [locale]);
  const formatDay = useCallback(
    (iso: string) => {
      const d = new Date(`${iso}T12:00:00Z`);
      return Number.isNaN(d.getTime()) ? iso : dayFmt.format(d);
    },
    [dayFmt],
  );

  const athleteName = useCallback(
    (athleteId: string) => {
      const a = athleteById.get(athleteId);
      // Alert di un atleta fuori roster (es. altra org): id parziale, mai riga anonima.
      return a ? formatAthleteLabel(a) : `${t("unknownAthlete")} · ${athleteId.slice(0, 8)}`;
    },
    [athleteById, t],
  );

  const detailText = useCallback(
    (row: AlertRow): string | null => {
      const facts = alertPayloadFacts(row.kind, row.payload);
      if (!facts) return null;
      if (facts.detail === "sleep") {
        // Numeri passati già formattati: l'arrotondamento lo decide il dominio, non l'ICU.
        return t("detail.sleep", { slept: facts.sleptHours.toFixed(1), target: facts.targetHours.toFixed(1) });
      }
      if (facts.detail === "training") {
        return t("detail.training", {
          executed: facts.executed.toFixed(0),
          planned: facts.planned.toFixed(0),
          unit: t(`unit.${facts.basis}`),
        });
      }
      return t("detail.adjustments", { kinds: facts.kinds.join(" + ") });
    },
    [t],
  );

  const hasAthletes = athleteIdsKey.length > 0;
  const pending = rosterLoading || (loading && unread.length === 0 && read.length === 0);
  const shownError = errCode
    ? t(errCode === "network" ? "errorNetwork" : "errorLoad")
    : !rosterLoading && rosterError
      ? t("errorLoad")
      : null;

  function renderRow(row: AlertRow, isRead: boolean) {
    const meta = ALERT_KIND_META[row.kind];
    const Icon = meta.icon;
    const kindLabel = t(`kind.${row.kind}`);
    const name = athleteName(row.athlete_id);
    const detail = detailText(row);
    return (
      <li
        key={row.id}
        className={cn(
          "relative flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-white/10 bg-black/25 px-4 py-3 transition",
          isRead ? "opacity-55" : "hover:border-white/25 hover:bg-black/40",
        )}
      >
        {/* Tutta la riga porta alla scheda dell'atleta: link «steso» SOTTO ai contenuti, così
            «segna letto» resta un bottone vero (niente <button> annidato in <a>). Alla ROOT
            `${basePath}/${id}`: è la index dell'atleta a scegliere la scheda di atterraggio. */}
        <Link
          href={`${basePath}/${row.athlete_id}`}
          aria-label={t("openAthlete", { athlete: name })}
          className="absolute inset-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400"
        />

        {/* Niente `shrink-0` sul badge: su `/m/athletes` (contenitore max-w-lg) un'etichetta
            lunga come «Si è allenato più del pianificato» resterebbe a max-content e
            sfonderebbe la colonna. Così invece va a capo dentro il badge. */}
        <span
          className={cn(
            "pointer-events-none relative inline-flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-medium",
            meta.tone,
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {kindLabel}
        </span>

        <div className="pointer-events-none relative min-w-0 flex-1 basis-40">
          <p className="truncate font-medium text-white">{name}</p>
          {detail ? <p className="truncate text-xs text-gray-400">{detail}</p> : null}
        </div>

        {/* QUANDO: orario reale di arrivo (created_at) + giorno a cui il dato si riferisce. */}
        <span className="pointer-events-none relative shrink-0 font-mono text-[0.65rem] uppercase tracking-wide text-gray-400">
          {formatAlertTime(row.created_at, locale)}
          <span className="ml-2 text-gray-600">
            {t("dayLabel")} {formatDay(row.date)}
          </span>
        </span>

        {isRead ? (
          <span className="pointer-events-none relative shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[0.65rem] uppercase tracking-wide text-gray-400">
            {t("readMark")}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => void markRead(row)}
            disabled={busyId === row.id}
            title={t("markRead")}
            aria-label={t("markReadAria", { kind: kindLabel, athlete: name })}
            className="relative z-10 shrink-0 rounded-lg border border-white/15 bg-white/5 p-1.5 text-gray-300 transition hover:border-white/30 hover:bg-white/10 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </li>
    );
  }

  return (
    <section
      className="relative min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-xl sm:p-6"
      aria-label={t("title")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("title")}</h2>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || rosterLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-purple-400/40 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
          {t("reload")}
        </button>
      </div>

      {/* Solo con almeno un non letto: a zero il messaggio lo dà già lo stato vuoto,
          e due frasi identiche in fila sono rumore. */}
      {!pending && !shownError && unread.length > 0 ? (
        <p className="mt-2 text-sm text-gray-400">{t("summary", { count: unread.length })}</p>
      ) : null}

      {shownError ? (
        <p
          className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
          role="alert"
        >
          {shownError}
        </p>
      ) : null}
      {actionFailed ? (
        <p
          className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
          role="alert"
        >
          {t("markReadFailed")}
        </p>
      ) : null}

      {pending ? (
        <p className="py-10 text-center text-sm text-gray-500">{t("loading")}</p>
      ) : shownError ? null : !hasAthletes ? (
        <p className="mt-4 text-sm text-gray-500">{t("emptyNoAthletes")}</p>
      ) : (
        // Altezza propria: la colonna alert non deve allungare la pagina all'infinito né
        // trascinarsi dietro la colonna atleti — scrolla dentro di sé.
        <div className="mt-4 max-h-[26rem] space-y-4 overflow-y-auto pr-1 sm:max-h-[34rem]">
          {unread.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-gray-500">
              {t("empty")}
            </p>
          ) : (
            <ul className="space-y-2">{unread.map((row) => renderRow(row, false))}</ul>
          )}

          {capped ? (
            <p className="flex items-center gap-2 text-xs text-amber-200/80">
              <BellRing className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t("capped", { count: MAX_UNREAD })}
            </p>
          ) : null}

          {read.length > 0 ? (
            <div className="space-y-2">
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-gray-600">{t("readTitle")}</p>
              <ul className="space-y-2">{read.map((row) => renderRow(row, true))}</ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
