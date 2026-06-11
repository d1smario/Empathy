"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, RefreshCw, Search, ShieldCheck, UserRound } from "lucide-react";
import { AdminUserDetailPanel } from "@/components/admin/AdminUserDetailPanel";
import {
  adminUserFunnelStatus,
  type AdminDirectoryUserRow,
  type AdminUserFunnelStatus,
} from "@/lib/admin/user-directory-types";
import { rowMatchesQuery } from "@/lib/admin/table-search";
import { cn } from "@/lib/cn";

/* ── Copy (admin area: italiano hardcoded) ─────────────────────────────── */
const COPY = {
  searchPlaceholder: "Cerca in tutti i campi…",
  reload: "Ricarica",
  loadMore: "Carica altri",
  loading: "Caricamento utenti…",
  empty: "Nessun utente per questo filtro.",
  errPrefix: "Errore",
  colUser: "Utente",
  colStatus: "Stato",
  colPlan: "Piano",
  colCoach: "Coach",
  colAccess: "Accesso",
  colCreated: "Registrato",
  colLastSeen: "Ultimo accesso",
  coachFilterAria: "Filtra per coach",
  coachFilterAll: "Tutti",
  panelHint: "Seleziona un utente dalla tabella per vedere account e anagrafica.",
  openUserModules: "Apri schede utente",
  noAthleteForModules: "Nessun profilo atleta: le schede sarebbero vuote. Account e anagrafica sono qui sotto.",
} as const;

const FILTERS: { key: "tutti" | AdminUserFunnelStatus; label: string }[] = [
  { key: "tutti", label: "Tutti" },
  { key: "registrato", label: "Registrati" },
  { key: "prova", label: "In prova" },
  { key: "cliente", label: "Clienti" },
  { key: "coach", label: "Coach" },
];

const STATUS_PILL: Record<AdminUserFunnelStatus, { label: string; cls: string }> = {
  admin: { label: "Admin", cls: "border-rose-400/30 bg-rose-400/10 text-rose-300" },
  coach: { label: "Coach", cls: "border-violet-400/30 bg-violet-400/10 text-violet-300" },
  cliente: { label: "Cliente", cls: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" },
  prova: { label: "In prova", cls: "border-amber-400/30 bg-amber-400/10 text-amber-300" },
  registrato: { label: "Registrato", cls: "border-white/15 bg-white/5 text-zinc-400" },
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-CH", { dateStyle: "medium" }).format(d);
}

function planLabel(row: AdminDirectoryUserRow): string {
  const ids = Array.from(
    new Set(row.stripeSubscriptions.map((s) => s.basePlanId).filter((p): p is string => Boolean(p))),
  );
  if (!ids.length) return "—";
  return ids.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" + ");
}

/**
 * Tabella clienti admin: directory utenti con filtro funnel
 * (Registrati / In prova / Clienti / Coach), selettore coach, ricerca
 * "in tutti i campi" e pannello anagrafica+account per l'utente selezionato.
 */
export function AdminUsersDirectoryTable() {
  const [rows, setRows] = useState<AdminDirectoryUserRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("tutti");
  const [coachFilter, setCoachFilter] = useState<string>("tutti");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadPage = useCallback(async (pageToLoad: number, replace: boolean) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/users/directory?page=${pageToLoad}&perPage=100`, { cache: "no-store" });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        users?: AdminDirectoryUserRow[];
        hasMore?: boolean;
        totalUsers?: number;
      };
      if (!res.ok || !data.ok) {
        setErr(data.error ?? `${COPY.errPrefix} ${res.status}`);
        return;
      }
      setRows((prev) => (replace ? (data.users ?? []) : [...prev, ...(data.users ?? [])]));
      setHasMore(Boolean(data.hasMore));
      setTotal(typeof data.totalUsers === "number" ? data.totalUsers : null);
      setPage(pageToLoad);
    } catch {
      setErr(`${COPY.errPrefix}: richiesta non riuscita.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(1, true);
  }, [loadPage]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { tutti: rows.length };
    for (const f of FILTERS) if (f.key !== "tutti") c[f.key] = 0;
    for (const r of rows) {
      const s = adminUserFunnelStatus(r);
      // Admin contati solo in "Tutti" (nessun chip dedicato).
      if (s in c) c[s] += 1;
    }
    return c;
  }, [rows]);

  /** Email coach distinte presenti nelle righe caricate (per il dropdown). */
  const coachOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) for (const e of r.coachEmails ?? []) set.add(e);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const visible = useMemo(() => {
    return rows.filter((r) => {
      if (filter !== "tutti" && adminUserFunnelStatus(r) !== filter) return false;
      if (coachFilter !== "tutti" && !(r.coachEmails ?? []).includes(coachFilter)) return false;
      // Direttiva piattaforma: la ricerca matcha TUTTI i campi della riga (coach inclusi).
      return rowMatchesQuery(r, query);
    });
  }, [rows, filter, coachFilter, query]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      {/* ── Tabella ─────────────────────────────────────────────────────── */}
      <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                filter === f.key
                  ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200"
                  : "border-white/10 bg-white/5 text-gray-400 hover:border-white/25 hover:text-gray-200",
              )}
            >
              {f.label}
              <span className="ml-1.5 font-mono text-[0.65rem] text-gray-500">{counts[f.key] ?? 0}</span>
            </button>
          ))}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              value={coachFilter}
              onChange={(e) => setCoachFilter(e.target.value)}
              aria-label={COPY.coachFilterAria}
              title={COPY.coachFilterAria}
              className="max-w-[11rem] rounded-lg border border-white/10 bg-black/30 py-1.5 pl-2 pr-6 text-xs text-white focus:border-cyan-400/50 focus:outline-none [&>option]:bg-zinc-900"
            >
              <option value="tutti">{COPY.coachFilterAll}</option>
              {coachOptions.map((email) => (
                <option key={email} value={email}>
                  {email}
                </option>
              ))}
            </select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={COPY.searchPlaceholder}
                className="w-44 rounded-lg border border-white/10 bg-black/30 py-1.5 pl-8 pr-2 text-xs text-white placeholder:text-gray-600 focus:border-cyan-400/50 focus:outline-none sm:w-56"
              />
            </div>
            <button
              type="button"
              onClick={() => void loadPage(1, true)}
              disabled={loading}
              title={COPY.reload}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:border-white/25 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
            </button>
          </div>
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
                <th className="px-3 py-2.5 font-medium">{COPY.colStatus}</th>
                <th className="px-3 py-2.5 font-medium">{COPY.colPlan}</th>
                <th className="px-3 py-2.5 font-medium">{COPY.colCoach}</th>
                <th className="px-3 py-2.5 font-medium">{COPY.colAccess}</th>
                <th className="px-3 py-2.5 font-medium">{COPY.colCreated}</th>
                <th className="px-3 py-2.5 font-medium">{COPY.colLastSeen}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-500">
                    {COPY.loading}
                  </td>
                </tr>
              ) : null}
              {!loading && visible.length === 0 && !err ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-500">
                    {COPY.empty}
                  </td>
                </tr>
              ) : null}
              {visible.map((r) => {
                const status = adminUserFunnelStatus(r);
                const pill = STATUS_PILL[status];
                const selected = selectedId === r.userId;
                return (
                  <tr
                    key={r.userId}
                    onClick={() => setSelectedId(selected ? null : r.userId)}
                    className={cn(
                      "cursor-pointer border-b border-white/5 transition",
                      selected ? "bg-cyan-500/10" : "even:bg-white/[0.015] hover:bg-white/[0.04]",
                    )}
                  >
                    <td className="max-w-[16rem] px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-white">{r.email ?? r.userId}</span>
                        {r.isPlatformAdmin ? (
                          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-rose-300" aria-label="Platform admin" />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium", pill.cls)}>
                        {pill.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-300">{planLabel(r)}</td>
                    <td className="max-w-[14rem] truncate px-3 py-3 font-mono text-[11px] text-zinc-400">
                      {(r.coachEmails ?? []).length ? (r.coachEmails ?? []).join(", ") : "—"}
                    </td>
                    <td className="max-w-[12rem] truncate px-3 py-3 text-xs text-zinc-400">{r.entitlement.label}</td>
                    <td className="px-3 py-3 text-xs text-zinc-500">{fmtDate(r.createdAt)}</td>
                    <td className="px-3 py-3 text-xs text-zinc-500">{fmtDate(r.lastSignInAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5 text-xs text-gray-500">
          <span>
            <span className="font-mono tabular-nums text-zinc-200">{visible.length}</span> /{" "}
            <span className="font-mono tabular-nums text-zinc-200">{total ?? rows.length}</span> utenti
          </span>
          {hasMore ? (
            <button
              type="button"
              onClick={() => void loadPage(page + 1, false)}
              disabled={loading}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-medium text-gray-300 transition hover:border-white/25 hover:text-white disabled:opacity-50"
            >
              {COPY.loadMore}
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Pannello dettaglio / anagrafica ────────────────────────────── */}
      <aside className="min-w-0">
        {!selectedId ? (
          <div className="flex h-full min-h-[12rem] items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
            <div>
              <UserRound className="mx-auto h-6 w-6 text-cyan-400/50" aria-hidden />
              <p className="mt-3 text-xs leading-relaxed text-gray-500">{COPY.panelHint}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Apertura schede solo se l'utente ha un profilo atleta: senza, sarebbero vuote.
                Atterraggio diretto sulla prima scheda (Health & Bio); Panoramica resta come tab. */}
            {rows.find((r) => r.userId === selectedId)?.athleteId ? (
              <Link
                href={`/admin/utenti/${selectedId}/health`}
                className="flex items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2.5 text-sm font-bold text-cyan-100 shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-500/25"
              >
                <LayoutGrid className="h-4 w-4" aria-hidden />
                {COPY.openUserModules}
              </Link>
            ) : (
              <div>
                <div
                  className="flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-gray-600"
                  aria-disabled
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden />
                  {COPY.openUserModules}
                </div>
                <p className="mt-2 text-center text-[0.7rem] leading-relaxed text-gray-600">
                  {COPY.noAthleteForModules}
                </p>
              </div>
            )}
            <AdminUserDetailPanel userId={selectedId} />
          </div>
        )}
      </aside>
    </div>
  );
}
