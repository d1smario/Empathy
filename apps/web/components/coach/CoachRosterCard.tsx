"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { LayoutGrid, Search } from "lucide-react";
import { dedupeAthletesByEmail, type CanonicalAthleteRow } from "@/lib/athletes/canonical-profile";
import { filterRowsByQuery } from "@/lib/admin/table-search";
import { coachOrgIdForClient } from "@/lib/coach-org-id";
import { coachOperationalApproved } from "@/lib/platform-coach-status";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";

type RosterOk = {
  ok: true;
  role: "private" | "coach";
  athletes: CanonicalAthleteRow[];
  coachActivation?: "pending" | "suspended" | null;
};
type RosterErr = { ok: false; error?: string };

const ROSTER_SELECT =
  "id, email, first_name, last_name, height_cm, weight_kg, sex, diet_type, training_days_per_week, training_max_session_minutes, created_at";

/**
 * Elenco atleti visibili al contesto corrente, letto direttamente dal browser
 * (private: collegato; coach: `coach_athletes` filtrato per `org_id`) — RLS fa da guardia,
 * i filtri espliciti restano identici alla vecchia API `/api/athletes` roster.
 */
async function loadRoster(): Promise<RosterOk | RosterErr> {
  const supabase = createEmpathyBrowserSupabase();
  if (!supabase) {
    return { ok: false, error: "supabase_unconfigured" };
  }

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return { ok: false, error: "unauthorized" };
  }

  const { data: profileData, error: profileError } = await supabase
    .from("app_user_profiles")
    .select("role, athlete_id, platform_coach_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  const prof = profileData as { role?: string; athlete_id?: string | null; platform_coach_status?: string | null } | null;
  let role: "private" | "coach" = "private";
  if (prof?.role === "coach" || prof?.role === "private") {
    role = prof.role;
  }

  let athleteIds: string[] = [];

  if (role === "coach") {
    if (!coachOperationalApproved("coach", prof?.platform_coach_status)) {
      return {
        ok: true,
        role,
        athletes: [],
        coachActivation: (prof?.platform_coach_status as "pending" | "suspended" | null) ?? "pending",
      };
    }
    const { data: linkedRows, error: linkedError } = await supabase
      .from("coach_athletes")
      .select("athlete_id")
      .eq("coach_user_id", user.id)
      .eq("org_id", coachOrgIdForClient());
    if (linkedError) {
      return { ok: false, error: linkedError.message };
    }
    athleteIds = Array.from(
      new Set(
        (linkedRows ?? [])
          .map((row) => String((row as { athlete_id?: string }).athlete_id ?? "").trim())
          .filter(Boolean),
      ),
    );
  } else if (prof?.athlete_id) {
    athleteIds = [String(prof.athlete_id)];
  }

  if (!athleteIds.length) {
    return { ok: true, role, athletes: [] };
  }

  const { data, error } = await supabase
    .from("athlete_profiles")
    .select(ROSTER_SELECT)
    .in("id", athleteIds)
    .order("created_at", { ascending: false });
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, role, athletes: dedupeAthletesByEmail((data ?? []) as CanonicalAthleteRow[]) };
}

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
 * "Apri schede" porta a `${basePath}/[id]/dashboard` con la barra contestuale sopra.
 * `basePath` = `/athletes` su desktop, `/m/athletes` nella shell mobile coach.
 */
export function CoachRosterCard({ basePath = "/athletes" }: { basePath?: string }) {
  const t = useTranslations("CoachRosterCard");
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
        const json = await loadRoster();
        if (c) return;
        if (!json.ok) {
          if (!rosterCache) {
            setAthletes([]);
            setErr(("error" in json && json.error) || t("errorLoadList"));
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
        if (!c && !rosterCache) setErr(t("errorNetwork"));
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
      aria-label={t("athletes")}
    >
      <div className="relative">
        <h2 className="text-lg font-bold text-white">{t("athletes")}</h2>
        <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>

        {loading ? <div className="mt-6 h-2 w-40 animate-pulse rounded-full bg-white/10" /> : null}

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
                  href={`${basePath}/${a.id}/dashboard`}
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
