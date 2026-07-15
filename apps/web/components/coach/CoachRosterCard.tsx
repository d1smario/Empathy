"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { LayoutGrid, Search } from "lucide-react";
import { filterRowsByQuery } from "@/lib/admin/table-search";
import { formatAthleteLabel, useCoachRoster } from "@/lib/coach/use-coach-roster";

/**
 * Roster coach: la selezione vive nell'URL (stesso pattern dell'admin) —
 * "Apri schede" porta alla ROOT `${basePath}/[id]`: è la index page dell'atleta a
 * decidere la scheda di atterraggio (oggi Analisi). Non hardcodare il modulo qui:
 * quando «dashboard» è diventata «analysis» il link hardcoded è finito in 404.
 * `basePath` = `/athletes` su desktop, `/m/athletes` nella shell mobile coach.
 */
export function CoachRosterCard({ basePath = "/athletes" }: { basePath?: string }) {
  const t = useTranslations("CoachRosterCard");
  const { role, athletes, loading, error, coachActivation } = useCoachRoster();
  const [query, setQuery] = useState("");

  // Errore tradotto nel consumer (stessa copia di prima): `load` → messaggio DB o fallback lista, `network` → rete.
  const err = error ? (error.kind === "network" ? t("errorNetwork") : error.message || t("errorLoadList")) : null;

  /** Direttiva piattaforma: "cerca in tutti i campi" su ogni tabella/elenco. */
  const visibleAthletes = useMemo(() => filterRowsByQuery(athletes, query), [athletes, query]);

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-xl sm:p-6"
      aria-label={t("athletes")}
    >
      <div className="relative">
        {/* Titolo/sottotitolo rimossi: duplicavano l'intestazione «Atleti» della card
            a monte. L'aria-label sulla section resta per l'accessibilità. */}
        {loading ? <div className="h-2 w-40 animate-pulse rounded-full bg-white/10" /> : null}

        {!loading && coachActivation === "suspended" ? (
          <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-sm text-rose-100" role="status">
            {t("suspended")}
          </p>
        ) : null}

        {!loading && err ? (
          <p className="mt-4 text-sm text-amber-200/90" role="alert">
            {err}
          </p>
        ) : null}

        {!loading && !err && athletes.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            {role === "coach" ? t("emptyCoach") : t("emptyPrivate")}
          </p>
        ) : null}

        {!loading && !err && athletes.length > 0 ? (
          <div className="relative mt-5 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none"
            />
          </div>
        ) : null}

        {!loading && !err && athletes.length > 0 && visibleAthletes.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">{t("noSearchResults")}</p>
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
                  href={`${basePath}/${a.id}`}
                  className="empathy-btn-gradient flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold text-white shadow-md shadow-purple-500/20 sm:w-auto"
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden />
                  {t("openDashboards")}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
