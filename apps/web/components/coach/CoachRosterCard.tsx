"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Search } from "lucide-react";
import type { CanonicalAthleteRow } from "@/lib/athletes/canonical-profile";
import { filterRowsByQuery } from "@/lib/admin/table-search";

type RosterOk = {
  ok: true;
  role: "private" | "coach";
  athletes: CanonicalAthleteRow[];
  coachActivation?: "pending" | "suspended" | null;
};
type RosterErr = { ok: false; error?: string };

function formatAthleteLabel(a: CanonicalAthleteRow): string {
  const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (a.email) return a.email;
  return a.id.slice(0, 8);
}

// Cache cross-mount del roster coach: ri-atterrando sulla pagina i dati
// compaiono subito (niente spinner/placeholder); il refetch avviene in background
// silenzioso, così restano visibili anche le variazioni del roster dopo un invito.
let rosterCache: { role: "private" | "coach"; athletes: CanonicalAthleteRow[]; coachActivation: "pending" | "suspended" | null } | null =
  null;

/**
 * Roster coach: la selezione vive nell'URL (stesso pattern dell'admin) —
 * "Apri schede" porta a /athletes/[id]/health con la barra contestuale sopra.
 * Niente più selezione in context/localStorage.
 */
export function CoachRosterCard() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"private" | "coach">("private");
  const [athletes, setAthletes] = useState<CanonicalAthleteRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [coachActivation, setCoachActivation] = useState<"pending" | "suspended" | null>(null);
  const [query, setQuery] = useState("");

  /** Direttiva piattaforma: "cerca in tutti i campi" su ogni tabella/elenco. */
  const visibleAthletes = useMemo(() => filterRowsByQuery(athletes, query), [athletes, query]);

  useEffect(() => {
    let c = false;
    (async () => {
      if (rosterCache) {
        // Mostra subito i dati in cache (niente spinner/placeholder); refresh in background sotto.
        setRole(rosterCache.role);
        setAthletes(rosterCache.athletes);
        setCoachActivation(rosterCache.coachActivation);
        setErr(null);
        setLoading(false);
      } else {
        setLoading(true);
        setErr(null);
        setCoachActivation(null);
      }
      try {
        const res = await fetch("/api/athletes/roster", { cache: "no-store" });
        const json = (await res.json()) as RosterOk | RosterErr;
        if (c) return;
        if (!res.ok || !json.ok) {
          if (!rosterCache) {
            setAthletes([]);
            setErr(("error" in json && json.error) || "Impossibile caricare l’elenco.");
          }
          return;
        }
        setRole(json.role);
        setAthletes(json.athletes);
        setCoachActivation(json.coachActivation ?? null);
        setErr(null);
        rosterCache = {
          role: json.role,
          athletes: json.athletes,
          coachActivation: json.coachActivation ?? null,
        };
      } catch {
        if (!c && !rosterCache) setErr("Errore di rete.");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-xl sm:p-6"
      aria-label="Atleti"
    >
      <div className="relative">
        <h2 className="text-lg font-bold text-white">Atleti</h2>
        <p className="mt-1 text-sm text-gray-500">Apri le schede dell&apos;atleta con cui stai lavorando.</p>

        {loading ? <div className="mt-6 h-2 w-40 animate-pulse rounded-full bg-white/10" /> : null}

        {!loading && coachActivation === "suspended" ? (
          <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-sm text-rose-100" role="status">
            Account coach sospeso: roster non disponibile.
          </p>
        ) : null}

        {!loading && err ? (
          <p className="mt-4 text-sm text-amber-200/90" role="alert">
            {err}
          </p>
        ) : null}

        {!loading && !err && athletes.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            {role === "coach" ? "Nessun atleta collegato. Usa «Invita atleta» qui sotto." : "Nessun profilo da mostrare."}
          </p>
        ) : null}

        {!loading && !err && athletes.length > 0 ? (
          <div className="relative mt-5 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca in tutti i campi…"
              className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none"
            />
          </div>
        ) : null}

        {!loading && !err && athletes.length > 0 && visibleAthletes.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">Nessun atleta per questa ricerca.</p>
        ) : null}

        {!loading && !err && visibleAthletes.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {visibleAthletes.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{formatAthleteLabel(a)}</p>
                  {a.email ? <p className="truncate text-xs text-gray-500">{a.email}</p> : null}
                </div>
                <Link
                  href={`/athletes/${a.id}/health`}
                  className="empathy-btn-gradient flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold text-white shadow-md shadow-purple-500/20 sm:w-auto"
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden />
                  Apri schede
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
