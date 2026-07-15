"use client";

import { useEffect, useState } from "react";
import { dedupeAthletesByEmail, type CanonicalAthleteRow } from "@/lib/athletes/canonical-profile";
import { coachOrgIdForClient } from "@/lib/coach-org-id";
import { coachOperationalApproved } from "@/lib/platform-coach-status";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";

export type CoachRosterRole = "private" | "coach";
export type CoachActivation = "pending" | "suspended" | null;
export type CoachRosterError = { kind: "load" | "network"; message: string | null };

type RosterOk = {
  ok: true;
  role: CoachRosterRole;
  athletes: CanonicalAthleteRow[];
  coachActivation?: CoachActivation;
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
  let role: CoachRosterRole = "private";
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

/** Etichetta atleta: nome+cognome → email → id troncato. Condivisa da roster card e board calendario. */
export function formatAthleteLabel(a: CanonicalAthleteRow): string {
  const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (a.email) return a.email;
  return a.id.slice(0, 8);
}

// Cache cross-mount del roster coach: ri-atterrando sulla pagina i dati compaiono subito
// (niente spinner/placeholder); il refetch avviene in background silenzioso, così restano
// visibili anche le variazioni del roster dopo un invito.
let rosterCache: { role: CoachRosterRole; athletes: CanonicalAthleteRow[]; coachActivation: CoachActivation } | null = null;

export type CoachRosterState = {
  role: CoachRosterRole;
  athletes: CanonicalAthleteRow[];
  loading: boolean;
  error: CoachRosterError | null;
  coachActivation: CoachActivation;
};

/**
 * Hook condiviso per il roster coach (estratto da `CoachRosterCard`): stessa query DB-first
 * (getUser → app_user_profiles → coach_athletes → athlete_profiles → dedupeAthletesByEmail),
 * stessa cache cross-mount e stesso refetch in background. L'errore torna come codice
 * (`load` / `network`) così il consumer decide la copia tradotta.
 */
export function useCoachRoster(): CoachRosterState {
  const [role, setRole] = useState<CoachRosterRole>("private");
  const [athletes, setAthletes] = useState<CanonicalAthleteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<CoachRosterError | null>(null);
  const [coachActivation, setCoachActivation] = useState<CoachActivation>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (rosterCache) {
        // Mostra subito i dati in cache (niente spinner/placeholder); refresh in background sotto.
        setRole(rosterCache.role);
        setAthletes(rosterCache.athletes);
        setCoachActivation(rosterCache.coachActivation);
        setError(null);
        setLoading(false);
      } else {
        setLoading(true);
        setError(null);
        setCoachActivation(null);
      }
      try {
        const json = await loadRoster();
        if (cancelled) return;
        if (!json.ok) {
          if (!rosterCache) {
            setAthletes([]);
            setError({ kind: "load", message: ("error" in json && json.error) || null });
          }
          return;
        }
        setRole(json.role);
        setAthletes(json.athletes);
        setCoachActivation(json.coachActivation ?? null);
        setError(null);
        rosterCache = {
          role: json.role,
          athletes: json.athletes,
          coachActivation: json.coachActivation ?? null,
        };
      } catch {
        if (!cancelled && !rosterCache) setError({ kind: "network", message: null });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { role, athletes, loading, error, coachActivation };
}
