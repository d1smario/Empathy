"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Inbox, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 50;

const COPY = {
  loading: "Caricamento eventi…",
  emptyNoFilters: "Nessuna email registrata.",
  emptyNoFiltersSub: "Gli eventi del webhook Postmark compariranno qui appena arrivano.",
  emptyFiltered: "Nessun evento trovato con i filtri correnti.",
  errPrefix: "Errore",
  reload: "Ricarica",
  searchPh: "Cerca per destinatario o oggetto…",
  allTypes: "Tutti",
  allStreams: "Tutti gli stream",
  noSubject: "(senza oggetto)",
  noDetails: "Nessun dettaglio testuale per questo evento.",
  noPayload: "Nessun payload registrato.",
  detailsLabel: "Dettagli",
  payloadLabel: "Payload webhook",
  prev: "Precedenti",
  next: "Successivi",
  results: (from: number, to: number, total: number) =>
    total === 0 ? "0 eventi" : `${from}–${to} di ${total.toLocaleString("it-IT")} eventi`,
  thRecipient: "Destinatario",
  thSubject: "Oggetto",
  thType: "Tipo",
  thStreamTag: "Stream / Tag",
  thOccurredAt: "Occorso il",
} as const;

type MailLogRow = {
  id: number;
  message_id: string | null;
  record_type: string | null;
  recipient: string | null;
  message_stream: string | null;
  tag: string | null;
  subject: string | null;
  details: string | null;
  payload: unknown;
  occurred_at: string | null;
  created_at: string;
};

type MailLogJson = {
  ok?: boolean;
  entries?: MailLogRow[];
  total?: number;
  recordTypes?: string[];
  streams?: string[];
  error?: string;
};

/**
 * Badge record_type secondo il design system Console v2:
 * Delivery=emerald, Open=sky, Click=violet, Bounce=rose, SpamComplaint=orange, altro=zinc.
 */
const RECORD_TYPE_BADGE: Record<string, string> = {
  Delivery: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  Open: "bg-sky-400/10 text-sky-300 border-sky-400/30",
  Click: "bg-violet-400/10 text-violet-300 border-violet-400/30",
  Bounce: "bg-rose-400/10 text-rose-300 border-rose-400/30",
  SpamComplaint: "bg-orange-400/10 text-orange-300 border-orange-400/30",
};
const BADGE_FALLBACK = "bg-zinc-400/10 text-zinc-300 border-zinc-400/30";

/** Pill di filtro attiva, stessa famiglia colore del badge corrispondente. */
const RECORD_TYPE_PILL_ACTIVE: Record<string, string> = {
  Delivery: "border-emerald-400/60 bg-emerald-400/15 text-emerald-200",
  Open: "border-sky-400/60 bg-sky-400/15 text-sky-200",
  Click: "border-violet-400/60 bg-violet-400/15 text-violet-200",
  Bounce: "border-rose-400/60 bg-rose-400/15 text-rose-200",
  SpamComplaint: "border-orange-400/60 bg-orange-400/15 text-orange-200",
};
const PILL_ACTIVE_FALLBACK = "border-zinc-400/60 bg-zinc-400/15 text-zinc-200";
const PILL_ACTIVE_ACCENT = "border-indigo-400/60 bg-indigo-400/15 text-indigo-200";
const PILL_IDLE = "border-white/10 bg-white/5 text-zinc-400 hover:border-white/25 hover:text-zinc-200";

function recordTypeBadgeClass(recordType: string | null): string {
  return RECORD_TYPE_BADGE[recordType ?? ""] ?? BADGE_FALLBACK;
}

function recordTypePillActiveClass(recordType: string): string {
  return RECORD_TYPE_PILL_ACTIVE[recordType] ?? PILL_ACTIVE_FALLBACK;
}

function formatOccurredAt(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "—", time: "" };
  return {
    date: d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }),
    time: d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
}

function formatPayload(payload: unknown): string | null {
  if (payload === null || payload === undefined) return null;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

/**
 * Mail Log (public.email_log, eventi webhook Postmark) in stile Console v2 — accento indigo.
 * Ricerca server-side con debounce su destinatario/oggetto, pill per record_type
 * (colori semantici dei badge) e message_stream, tabella con riga espandibile
 * (details + payload JSON) e paginazione. Tutto via /api/admin/mail-log.
 */
export function AdminMailLogManager() {
  const [rows, setRows] = useState<MailLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [recordType, setRecordType] = useState("");
  const [stream, setStream] = useState("");
  const [recordTypes, setRecordTypes] = useState<string[]>([]);
  const [streams, setStreams] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const metaLoadedRef = useRef(false);

  // Ricerca con debounce: al cambio query si riparte dalla prima pagina.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setOffset(0);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const loadEntries = useCallback(
    async (params: { q: string; recordType: string; stream: string; offset: number }) => {
      setLoading(true);
      setErr(null);
      try {
        const sp = new URLSearchParams();
        if (params.q) sp.set("q", params.q);
        if (params.recordType) sp.set("recordType", params.recordType);
        if (params.stream) sp.set("stream", params.stream);
        sp.set("limit", String(PAGE_SIZE));
        sp.set("offset", String(params.offset));
        if (!metaLoadedRef.current) sp.set("include", "meta");
        const res = await fetch(`/api/admin/mail-log?${sp.toString()}`, { cache: "no-store" });
        const j = (await res.json()) as MailLogJson;
        if (!res.ok || !j.ok) {
          setErr(`${COPY.errPrefix}: ${j.error ?? "impossibile caricare il mail log."}`);
          setRows([]);
          setTotal(0);
          return;
        }
        setRows(j.entries ?? []);
        setTotal(j.total ?? 0);
        setExpandedId(null);
        if (j.recordTypes || j.streams) {
          setRecordTypes(j.recordTypes ?? []);
          setStreams(j.streams ?? []);
          metaLoadedRef.current = true;
        }
      } catch {
        setErr(`${COPY.errPrefix}: richiesta non riuscita.`);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadEntries({ q: debouncedQ, recordType, stream, offset });
  }, [loadEntries, debouncedQ, recordType, stream, offset]);

  const changeRecordType = useCallback((next: string) => {
    setRecordType(next);
    setOffset(0);
  }, []);

  const changeStream = useCallback((next: string) => {
    setStream(next);
    setOffset(0);
  }, []);

  const pageFrom = total === 0 ? 0 : offset + 1;
  const pageTo = Math.min(offset + PAGE_SIZE, total);
  const hasFilters = Boolean(debouncedQ || recordType || stream);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
        {/* Toolbar: ricerca + ricarica */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
              aria-hidden
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={COPY.searchPh}
              className="w-56 rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-zinc-600 focus:border-indigo-400/60 focus:outline-none sm:w-72"
            />
          </div>
          <p className="font-mono text-[0.65rem] tabular-nums text-zinc-500">
            {COPY.results(pageFrom, pageTo, total)}
          </p>
          <div className="ml-auto">
            <button
              type="button"
              onClick={() => void loadEntries({ q: debouncedQ, recordType, stream, offset })}
              disabled={loading}
              title={COPY.reload}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition hover:border-indigo-400/40 hover:text-indigo-200 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
            </button>
          </div>
        </div>

        {/* Filtri a pill: record_type (colori badge) + message_stream */}
        <div className="space-y-2 border-b border-white/10 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => changeRecordType("")}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-medium transition",
                recordType === "" ? PILL_ACTIVE_ACCENT : PILL_IDLE,
              )}
            >
              {COPY.allTypes}
            </button>
            {recordTypes.map((rt) => (
              <button
                key={rt}
                type="button"
                onClick={() => changeRecordType(rt)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-medium transition",
                  recordType === rt ? recordTypePillActiveClass(rt) : PILL_IDLE,
                )}
              >
                {rt}
              </button>
            ))}
          </div>
          {streams.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => changeStream("")}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-medium transition",
                  stream === "" ? PILL_ACTIVE_ACCENT : PILL_IDLE,
                )}
              >
                {COPY.allStreams}
              </button>
              {streams.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => changeStream(s)}
                  className={cn(
                    "rounded-full border px-3 py-1 font-mono text-[11px] font-medium transition",
                    stream === s ? PILL_ACTIVE_ACCENT : PILL_IDLE,
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {err ? (
          <p className="px-4 py-4 text-sm text-rose-400" role="alert">
            {err}
          </p>
        ) : null}

        {/* Tabella eventi */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">{COPY.thRecipient}</th>
                <th className="px-4 py-3 font-medium">{COPY.thSubject}</th>
                <th className="px-4 py-3 font-medium">{COPY.thType}</th>
                <th className="px-4 py-3 font-medium">{COPY.thStreamTag}</th>
                <th className="px-4 py-3 text-right font-medium">{COPY.thOccurredAt}</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    {loading ? (
                      <span className="text-xs text-zinc-500">{COPY.loading}</span>
                    ) : (
                      <span className="inline-flex flex-col items-center gap-2">
                        <span className="rounded-lg bg-indigo-400/10 p-2 text-indigo-300">
                          <Inbox className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="text-sm font-medium text-white">
                          {hasFilters ? COPY.emptyFiltered : COPY.emptyNoFilters}
                        </span>
                        {!hasFilters ? (
                          <span className="text-xs text-zinc-500">{COPY.emptyNoFiltersSub}</span>
                        ) : null}
                      </span>
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => {
                  const expanded = expandedId === row.id;
                  const occurred = formatOccurredAt(row.occurred_at);
                  const payloadText = formatPayload(row.payload);
                  const zebra = idx % 2 === 1 ? "bg-white/[0.015]" : "";
                  return (
                    <MailLogRowGroup
                      key={row.id}
                      row={row}
                      expanded={expanded}
                      occurred={occurred}
                      payloadText={payloadText}
                      zebraClass={zebra}
                      onToggle={() => setExpandedId(expanded ? null : row.id)}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginazione */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-3">
          <p className="font-mono text-[0.65rem] tabular-nums text-zinc-500">
            {COPY.results(pageFrom, pageTo, total)}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/25 hover:text-white disabled:opacity-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              {COPY.prev}
            </button>
            <button
              type="button"
              disabled={loading || offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/25 hover:text-white disabled:opacity-50"
            >
              {COPY.next}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Riga evento + riga espansa (details + payload JSON) con zebra e hover coerenti. */
function MailLogRowGroup({
  row,
  expanded,
  occurred,
  payloadText,
  zebraClass,
  onToggle,
}: {
  row: MailLogRow;
  expanded: boolean;
  occurred: { date: string; time: string };
  payloadText: string | null;
  zebraClass: string;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={cn("cursor-pointer border-b border-white/5 transition hover:bg-white/[0.04]", zebraClass)}
      >
        <td className="px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-white">{row.recipient ?? "—"}</p>
            {row.message_id ? (
              <p className="truncate font-mono text-[11px] text-zinc-500">{row.message_id}</p>
            ) : null}
          </div>
        </td>
        <td className="max-w-[18rem] px-4 py-3">
          {row.subject ? (
            <p className="truncate text-xs text-zinc-300">{row.subject}</p>
          ) : (
            <p className="text-xs italic text-zinc-600">{COPY.noSubject}</p>
          )}
        </td>
        <td className="px-4 py-3">
          <span
            className={cn(
              "inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
              recordTypeBadgeClass(row.record_type),
            )}
          >
            {row.record_type ?? "—"}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {row.message_stream ? (
              <span className="inline-block rounded-full border border-zinc-400/30 bg-zinc-400/10 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-300">
                {row.message_stream}
              </span>
            ) : null}
            {row.tag ? (
              <span className="inline-block rounded-full border border-zinc-400/30 bg-zinc-400/10 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-400">
                {row.tag}
              </span>
            ) : null}
            {!row.message_stream && !row.tag ? <span className="text-[11px] text-zinc-600">—</span> : null}
          </div>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs tabular-nums text-zinc-400">
          {occurred.date}
          {occurred.time ? <span className="ml-1.5 text-zinc-500">{occurred.time}</span> : null}
        </td>
        <td className="px-4 py-3 text-right">
          <ChevronDown
            className={cn(
              "ml-auto h-3.5 w-3.5 text-zinc-500 transition-transform",
              expanded && "rotate-180 text-indigo-300",
            )}
            aria-hidden
          />
        </td>
      </tr>
      {expanded ? (
        <tr className={cn("border-b border-white/5", zebraClass)}>
          <td colSpan={6} className="px-4 pb-4 pt-1">
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">{COPY.detailsLabel}</p>
                <p className="mt-1 text-xs text-zinc-300">{row.details ?? COPY.noDetails}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">{COPY.payloadLabel}</p>
                {payloadText ? (
                  <pre className="mt-1 max-h-64 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
                    {payloadText}
                  </pre>
                ) : (
                  <p className="mt-1 text-xs text-zinc-600">{COPY.noPayload}</p>
                )}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
