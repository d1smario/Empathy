"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, UserPlus } from "lucide-react";
import type { AdminCoachRow } from "@/lib/admin/coach-list-types";
import type { AdminDirectoryUserRow } from "@/lib/admin/user-directory-types";
import { filterRowsByQuery, rowMatchesQuery } from "@/lib/admin/table-search";
import { Pro2Button } from "@/components/ui/empathy";
import { cn } from "@/lib/cn";

/* ── Copy (admin area: italiano hardcoded) ─────────────────────────────── */
const COPY = {
  coachesHeading: "Coach della piattaforma",
  coachesSub: "Approva, metti in attesa, sospendi o revoca il ruolo.",
  reload: "Ricarica",
  thEmail: "Email",
  thStatus: "Stato",
  thActions: "Azioni",
  emptyCoaches: "Nessun coach sulla piattaforma. Nomina il primo dall'elenco utenti qui sotto.",
  emptyCoachesFiltered: "Nessun coach per questa ricerca.",
  searchAll: "Cerca in tutti i campi…",
  statusActive: "Attivo",
  statusPending: "In attesa",
  statusSuspended: "Sospeso",
  approve: "Approva",
  pending: "In attesa",
  suspend: "Sospendi",
  demote: "Rendi utente",
  promoteHeading: "Nomina un nuovo coach",
  promoteSub:
    "Con la porta unica nessuno si auto-candida: il coach lo nomini tu, scegliendolo dagli utenti registrati.",
  promoteSearch: "Cerca in tutti i campi…",
  promoteCta: "Promuovi a coach",
  promoteEmpty: "Nessun utente promuovibile per questo filtro.",
  promoteLoading: "Caricamento utenti…",
  errGeneric: "Operazione non riuscita.",
  errNetwork: "Rete non disponibile. Riprova.",
} as const;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-CH", { dateStyle: "medium" }).format(d);
}

/**
 * Pannello Coach admin, flusso porta-unica:
 * 1) Elenco coach con azioni di stato (approva / attesa / sospendi / rendi utente);
 * 2) "Nomina un nuovo coach": elenco utenti registrati (directory) con filtro →
 *    promozione diretta, senza cercare email a memoria.
 * Il gate admin è a monte (app/admin/layout.tsx).
 */
export function AdminCoachManagement() {
  const [coaches, setCoaches] = useState<AdminCoachRow[]>([]);
  const [candidates, setCandidates] = useState<AdminDirectoryUserRow[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [coachQuery, setCoachQuery] = useState("");

  const reloadCoaches = useCallback(async () => {
    const res = await fetch("/api/admin/coaches", { cache: "no-store" });
    const j = (await res.json()) as { ok?: boolean; coaches?: AdminCoachRow[]; error?: string };
    if (!res.ok || !j.ok) {
      setErr(j.error ?? COPY.errGeneric);
      setCoaches([]);
      return;
    }
    setCoaches(j.coaches ?? []);
  }, []);

  const reloadCandidates = useCallback(async () => {
    setLoadingCandidates(true);
    try {
      const collected: AdminDirectoryUserRow[] = [];
      for (let page = 1; page <= 10; page += 1) {
        const res = await fetch(`/api/admin/users/directory?page=${page}&perPage=100`, { cache: "no-store" });
        const j = (await res.json()) as {
          ok?: boolean;
          users?: AdminDirectoryUserRow[];
          hasMore?: boolean;
          error?: string;
        };
        if (!res.ok || !j.ok) {
          setErr(j.error ?? COPY.errGeneric);
          return;
        }
        collected.push(...(j.users ?? []));
        if (!j.hasMore) break;
      }
      // Promuovibili: utenti non-coach e non-admin.
      setCandidates(collected.filter((u) => u.role !== "coach" && !u.isPlatformAdmin));
    } catch {
      setErr(COPY.errNetwork);
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  useEffect(() => {
    void reloadCoaches();
    void reloadCandidates();
  }, [reloadCoaches, reloadCandidates]);

  const reloadAll = useCallback(async () => {
    setErr(null);
    await Promise.all([reloadCoaches(), reloadCandidates()]);
  }, [reloadCoaches, reloadCandidates]);

  /** Stato coach esistente (approve/pending/suspend) via API coaches. */
  const setCoachStatus = useCallback(
    async (userId: string, action: "approve" | "suspend" | "pending") => {
      setBusyId(userId);
      setErr(null);
      try {
        const res = await fetch(`/api/admin/coaches/${encodeURIComponent(userId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const j = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setErr(j.error ?? COPY.errGeneric);
          return;
        }
        await reloadAll();
      } catch {
        setErr(COPY.errNetwork);
      } finally {
        setBusyId(null);
      }
    },
    [reloadAll],
  );

  /** Cambia ruolo via app-profile: promozione (coach approved) o revoca (private). */
  const setRole = useCallback(
    async (userId: string, targetRole: "coach" | "private") => {
      setBusyId(userId);
      setErr(null);
      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/app-profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            targetRole === "coach" ? { targetRole, platformCoachStatus: "approved" } : { targetRole },
          ),
        });
        const j = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setErr(j.error ?? COPY.errGeneric);
          return;
        }
        await reloadAll();
      } catch {
        setErr(COPY.errNetwork);
      } finally {
        setBusyId(null);
      }
    },
    [reloadAll],
  );

  const sortedCoaches = useMemo(() => {
    const rank = (s: string | null | undefined) => {
      const v = s ?? "pending";
      if (v === "pending") return 0;
      if (v === "suspended") return 1;
      return 2;
    };
    return [...coaches].sort((a, b) => {
      const d = rank(a.platformCoachStatus) - rank(b.platformCoachStatus);
      if (d !== 0) return d;
      return (a.email ?? a.userId).localeCompare(b.email ?? b.userId);
    });
  }, [coaches]);

  /** Coach visibili: "cerca in tutti i campi" sull'elenco ordinato. */
  const visibleCoaches = useMemo(
    () => filterRowsByQuery(sortedCoaches, coachQuery),
    [sortedCoaches, coachQuery],
  );

  const visibleCandidates = useMemo(() => {
    const q = query.trim();
    // Direttiva piattaforma: anche i candidati si filtrano su tutti i campi, non solo l'email.
    const list = q ? candidates.filter((u) => rowMatchesQuery(u, q)) : candidates;
    return list.slice(0, 12);
  }, [candidates, query]);

  return (
    <div className="space-y-12">
      {err ? (
        <p className="rounded-xl border border-amber-500/35 bg-amber-950/20 px-4 py-3 text-sm text-amber-200" role="alert">
          {err}
        </p>
      ) : null}

      {/* ── 1. Elenco coach ─────────────────────────────────────────────── */}
      <section aria-labelledby="admin-coaches-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="admin-coaches-heading" className="text-lg font-semibold text-white">
              {COPY.coachesHeading}
            </h2>
            <p className="mt-1 text-sm text-gray-500">{COPY.coachesSub}</p>
          </div>
          <Pro2Button type="button" variant="secondary" disabled={!!busyId} onClick={() => void reloadAll()}>
            {COPY.reload}
          </Pro2Button>
        </div>

        <div className="relative sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" aria-hidden />
          <input
            type="search"
            value={coachQuery}
            onChange={(e) => setCoachQuery(e.target.value)}
            placeholder={COPY.searchAll}
            className="w-full rounded-lg border border-white/10 bg-black/30 py-1.5 pl-8 pr-2 text-xs text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/25">
          <table className="min-w-full text-left text-sm text-gray-300">
            <thead className="border-b border-white/10 bg-white/5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">{COPY.thEmail}</th>
                <th className="px-4 py-3 font-semibold">{COPY.thStatus}</th>
                <th className="px-4 py-3 font-semibold">{COPY.thActions}</th>
              </tr>
            </thead>
            <tbody>
              {visibleCoaches.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm leading-relaxed text-gray-500">
                    {coaches.length === 0 ? COPY.emptyCoaches : COPY.emptyCoachesFiltered}
                  </td>
                </tr>
              ) : (
                visibleCoaches.map((c) => {
                  const busy = busyId === c.userId;
                  const st = c.platformCoachStatus ?? "pending";
                  const stLabel =
                    st === "approved" ? COPY.statusActive : st === "suspended" ? COPY.statusSuspended : COPY.statusPending;
                  return (
                    <tr key={c.userId} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3 text-sm text-gray-200">{c.email ?? c.userId}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            st === "approved"
                              ? "bg-emerald-500/15 text-emerald-200"
                              : st === "suspended"
                                ? "bg-rose-500/15 text-rose-200"
                                : "bg-amber-500/15 text-amber-200"
                          }`}
                        >
                          {stLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Pro2Button
                            type="button"
                            className="px-3 py-1.5 text-xs"
                            disabled={busy || st === "approved"}
                            onClick={() => void setCoachStatus(c.userId, "approve")}
                          >
                            {COPY.approve}
                          </Pro2Button>
                          <Pro2Button
                            type="button"
                            className="px-3 py-1.5 text-xs"
                            variant="secondary"
                            disabled={busy || st === "pending"}
                            onClick={() => void setCoachStatus(c.userId, "pending")}
                          >
                            {COPY.pending}
                          </Pro2Button>
                          <Pro2Button
                            type="button"
                            className="border-rose-500/30 px-3 py-1.5 text-xs text-rose-200 hover:border-rose-400/50"
                            variant="secondary"
                            disabled={busy || st === "suspended"}
                            onClick={() => void setCoachStatus(c.userId, "suspend")}
                          >
                            {COPY.suspend}
                          </Pro2Button>
                          <Pro2Button
                            type="button"
                            className="border-white/15 px-3 py-1.5 text-xs text-gray-300"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void setRole(c.userId, "private")}
                          >
                            {COPY.demote}
                          </Pro2Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 2. Nomina un nuovo coach (dagli utenti, non da email a memoria) ── */}
      <section aria-labelledby="admin-coach-promote-heading" className="space-y-4">
        <div>
          <h2 id="admin-coach-promote-heading" className="text-lg font-semibold text-white">
            {COPY.promoteHeading}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">{COPY.promoteSub}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2 border-b border-white/10 p-3">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={COPY.promoteSearch}
                className="w-full rounded-lg border border-white/10 bg-black/30 py-1.5 pl-8 pr-2 text-xs text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => void reloadCandidates()}
              disabled={loadingCandidates}
              title={COPY.reload}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:border-white/25 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loadingCandidates && "animate-spin")} aria-hidden />
            </button>
          </div>

          {loadingCandidates && candidates.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-gray-500">{COPY.promoteLoading}</p>
          ) : visibleCandidates.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-gray-500">{COPY.promoteEmpty}</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {visibleCandidates.map((u) => {
                const busy = busyId === u.userId;
                return (
                  <li key={u.userId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-200">{u.email ?? u.userId}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Registrato {fmtDate(u.createdAt)} · {u.entitlement.label}
                      </p>
                    </div>
                    <Pro2Button
                      type="button"
                      className="px-3 py-1.5 text-xs"
                      disabled={busy}
                      onClick={() => void setRole(u.userId, "coach")}
                    >
                      <UserPlus className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
                      {COPY.promoteCta}
                    </Pro2Button>
                  </li>
                );
              })}
            </ul>
          )}
          {candidates.length > 12 && visibleCandidates.length === 12 ? (
            <p className="border-t border-white/10 px-4 py-2.5 text-xs text-gray-600">
              Mostro i primi 12 — affina il filtro per trovare l&apos;utente.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
