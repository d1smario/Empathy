"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { dedupeAthletesByEmail, type CanonicalAthleteRow } from "@/lib/athletes/canonical-profile";
import {
  AppRole,
  clearActiveAthleteId,
  clearPro2ClientSessionKeys,
  readActiveAthleteId,
  writeActiveAthleteId,
  writeAuditUserId,
} from "@/lib/app-session";
import { coachOrgIdForClient } from "@/lib/coach-org-id";
import { coachOperationalApproved } from "@/lib/platform-coach-status";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";

type AthleteOption = Pick<
  CanonicalAthleteRow,
  | "id"
  | "email"
  | "first_name"
  | "last_name"
  | "height_cm"
  | "weight_kg"
  | "body_fat_pct"
  | "muscle_mass_kg"
  | "resting_hr_bpm"
  | "max_hr_bpm"
  | "threshold_hr_bpm"
  | "diet_type"
  | "training_days_per_week"
  | "training_max_session_minutes"
  | "routine_config"
  | "nutrition_config"
  | "supplement_config"
  | "goals"
  | "intolerances"
  | "allergies"
  | "food_preferences"
  | "food_exclusions"
  | "supplements"
  | "created_at"
>;

type UserProfileRow = {
  role: AppRole;
  athlete_id: string | null;
  platform_coach_status?: string | null;
  is_platform_admin?: boolean | null;
};

const ATHLETE_SELECT =
  "id, email, first_name, last_name, height_cm, weight_kg, body_fat_pct, muscle_mass_kg, resting_hr_bpm, max_hr_bpm, threshold_hr_bpm, diet_type, training_days_per_week, training_max_session_minutes, routine_config, nutrition_config, supplement_config, goals, intolerances, allergies, food_preferences, food_exclusions, supplements, created_at";

export type ActiveAthleteContextValue = {
  athleteId: string | null;
  activeAthleteId: string | null;
  role: AppRole;
  /** Stato abilitazione piattaforma per ruolo coach (`null` se private). */
  platformCoachStatus: string | null;
  /** Inviti / roster operativi solo se coach approvato. */
  coachOperationalApproved: boolean;
  athletes: AthleteOption[];
  loading: boolean;
  signedIn: boolean;
  userId: string | null;
  setActiveAthleteId: (id: string | null) => void;
  refresh: () => void;
  /** true nelle schede admin (/admin/utenti/[id]/...): scope imposto dall'URL — le viste riusate disattivano i link verso la shell coach. */
  adminScoped: boolean;
  /** true SOLO in scope admin: distingue l'admin dal coach (entrambi hanno adminScoped=true). Per azioni riservate allo staff (es. generazione piano pasti). */
  platformAdminView: boolean;
  /**
   * userId dell'utente SELEZIONATO in scope admin (chiave dell'URL /admin/utenti/[userId]/...),
   * non l'admin loggato (che è in `userId`). Le rotte admin sono chiavate su userId, quindi
   * serve per ricostruire gli href admin (/admin/utenti/[userId]/<module>[/staging/<runId>])
   * dalle viste riusate, che conoscono solo l'athleteId. `null` fuori dallo scope admin.
   */
  scopeOwnerUserId: string | null;
};

const ActiveAthleteContext = createContext<ActiveAthleteContextValue | null>(null);

/**
 * Un solo store atleta per albero React: evita N fetch `ensure-profile` / Supabase e stati divergenti tra shell e moduli.
 * Montare nel layout root (`ClientRootProviders`).
 */
export function ActiveAthleteProvider({ children }: { children: ReactNode }) {
  const providerValue = useActiveAthleteState();
  return <ActiveAthleteContext.Provider value={providerValue}>{children}</ActiveAthleteContext.Provider>;
}

export function useActiveAthlete(): ActiveAthleteContextValue {
  const ctx = useContext(ActiveAthleteContext);
  if (!ctx) {
    throw new Error(
      "useActiveAthlete richiede ActiveAthleteProvider nel layout root (vedi app/client-root-providers.tsx).",
    );
  }
  return ctx;
}

/**
 * Scope atleta IMPOSTO (schede admin /admin/utenti/[id]/...): stesso context del
 * provider globale, ma con athleteId fissato dall'URL — le viste modulo del coach
 * si riusano identiche ("fotocopia") senza saperne nulla. La lettura del profilo
 * atleta avviene diretta dal browser: la policy `platform_admin_all` autorizza.
 * Montato DENTRO il provider globale: il context più vicino vince.
 */
export function ActiveAthleteScopeProvider({
  athleteId,
  scope = "coach",
  scopeOwnerUserId = null,
  children,
}: {
  athleteId: string;
  scope?: "admin" | "coach";
  /** userId dell'utente selezionato (solo scope admin): serve a ricostruire gli href admin. */
  scopeOwnerUserId?: string | null;
  children: ReactNode;
}) {
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      return () => {
        active = false;
      };
    }
    void (async () => {
      setLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!active) return;
        setSignedIn(Boolean(session?.user));
        setUserId(session?.user?.id ?? null);
        const { data } = await supabase
          .from("athlete_profiles")
          .select(ATHLETE_SELECT)
          .eq("id", athleteId)
          .maybeSingle();
        if (!active) return;
        setAthletes(data ? [data as AthleteOption] : []);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [athleteId, reloadToken]);

  /** La selezione è l'URL: i tentativi di cambio da UI riusata sono no-op. */
  const setActiveAthleteId = useCallback((_id: string | null) => {}, []);

  const value: ActiveAthleteContextValue = {
    athleteId,
    activeAthleteId: athleteId,
    // Vista "da coach" per le viste riusate: rami coach abilitati.
    role: "coach",
    platformCoachStatus: "approved",
    coachOperationalApproved: true,
    athletes,
    loading,
    signedIn,
    userId,
    setActiveAthleteId,
    refresh,
    adminScoped: true,
    platformAdminView: scope === "admin",
    scopeOwnerUserId: scope === "admin" ? scopeOwnerUserId : null,
  };

  return <ActiveAthleteContext.Provider value={value}>{children}</ActiveAthleteContext.Provider>;
}

/**
 * Allineato a V1: Supabase browser + `POST /api/access/ensure-profile` (cookie, no Bearer).
 * Merge duplicati email server-side (`/api/athletes/repair`) non incluso: richiede service role V1.
 */
function useActiveAthleteState(): ActiveAthleteContextValue {
  const lastAuthenticatedUserIdRef = useRef<string | null>(null);
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole>("private");
  const [platformCoachStatus, setPlatformCoachStatus] = useState<string | null>(null);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const setActiveAthleteId = useCallback((id: string | null) => {
    if (id) writeActiveAthleteId(id);
    else clearActiveAthleteId();
    setAthleteId(id);
  }, []);

  const [reloadToken, setReloadToken] = useState(0);
  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    const supabase = createEmpathyBrowserSupabase();

    async function readStableUser() {
      if (!supabase) return null;
      const attempts = 2;
      for (let index = 0; index < attempts; index += 1) {
        const { data } = await supabase.auth.getUser();
        if (data.user) return data.user;
        await new Promise((resolve) => setTimeout(resolve, 80 + index * 60));
      }
      return null;
    }

    /**
     * Env pubblico Supabase assente: niente client browser e (stessa config
     * `NEXT_PUBLIC_*`) nemmeno cookie client lato server → stato signed-out.
     */
    async function loadNoSupabaseClient() {
      setLoading(true);
      try {
        if (!active) return;
        setSignedIn(false);
        setUserId(null);
        setRole("private");
        setAthletes([]);
        setAthleteId(null);
        clearPro2ClientSessionKeys();
      } finally {
        if (active) setLoading(false);
      }
    }

    async function load() {
      if (!supabase) {
        await loadNoSupabaseClient();
        return;
      }
      try {
        if (!active) return;
        setLoading(true);

        const user = await readStableUser();
        if (!active) return;

        if (!user) {
          setAthleteId(null);
          setAthletes([]);
          setRole("private");
          setPlatformCoachStatus(null);
          setSignedIn(false);
          setUserId(null);
          lastAuthenticatedUserIdRef.current = null;
          clearPro2ClientSessionKeys();
          setLoading(false);
          return;
        }

        const prevUserId = lastAuthenticatedUserIdRef.current;
        if (prevUserId && prevUserId !== user.id) {
          clearPro2ClientSessionKeys();
          setAthleteId(null);
          setAthletes([]);
        }
        lastAuthenticatedUserIdRef.current = user.id;

        setSignedIn(true);
        setUserId(user.id);

        const { data: profileData } = await supabase
          .from("app_user_profiles")
          .select("role, athlete_id, platform_coach_status, is_platform_admin")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!active) return;

        const profile = (profileData as UserProfileRow | null) ?? null;
        const profileRole = profile?.role ?? "private";
        setRole(profileRole);
        const coachStatusRow = profileRole === "coach" ? (profile?.platform_coach_status ?? null) : null;
        setPlatformCoachStatus(coachStatusRow);

        /**
         * Platform admin: NESSUN bootstrap atleta (non è un atleta — è la piattaforma).
         * Senza questo skip il provider riproverebbe `ensure-profile` a ogni mount,
         * tentando di creare un athlete_profile per l'account admin.
         */
        if (profile?.is_platform_admin === true) {
          setAthletes([]);
          setAthleteId(null);
          writeAuditUserId(user.id);
          setLoading(false);
          return;
        }

        if (profileRole === "coach") {
          if (!coachOperationalApproved("coach", coachStatusRow)) {
            setAthletes([]);
            clearActiveAthleteId();
            setAthleteId(null);
            writeAuditUserId(user.id);
            setLoading(false);
            return;
          }
          const { data: linked } = await supabase
            .from("coach_athletes")
            .select("athlete_id")
            .eq("coach_user_id", user.id)
            .eq("org_id", coachOrgIdForClient());
          if (!active) return;
          const linkedAthleteIds = Array.from(
            new Set((linked ?? []).map((row) => String((row as { athlete_id?: string }).athlete_id ?? "").trim()).filter(Boolean)),
          );
          if (!linkedAthleteIds.length) {
            setAthletes([]);
            clearActiveAthleteId();
            setAthleteId(null);
            writeAuditUserId(user.id);
            setLoading(false);
            return;
          }
          const { data: coachProfiles } = await supabase
            .from("athlete_profiles")
            .select(ATHLETE_SELECT)
            .in("id", linkedAthleteIds)
            .order("created_at", { ascending: false });
          if (!active) return;
          const coachList = dedupeAthletesByEmail((coachProfiles as AthleteOption[]) ?? []);
          setAthletes(coachList);
          /**
           * Coach: la selezione atleta vive NELL'URL (/athletes/[id]/[module],
           * stesso pattern dell'admin — vedi ActiveAthleteScopeProvider).
           * Il context globale del coach resta senza atleta: niente localStorage,
           * niente gruppo atleta in sidebar.
           */
          clearActiveAthleteId();
          setAthleteId(null);
          writeAuditUserId(user.id);
          setLoading(false);
          return;
        }

        /**
         * Private: **non** elencare tutti gli `athlete_profiles` visibili da RLS (su DB condivisi/demo può
         * esporre altri atleti → contesto UI sbagliato). Solo email dell’account o riga già collegata.
         */
        let rawList: AthleteOption[] = [];
        if (profile?.athlete_id) {
          const { data: oneRow } = await supabase
            .from("athlete_profiles")
            .select(ATHLETE_SELECT)
            .eq("id", profile.athlete_id)
            .maybeSingle();
          rawList = oneRow ? ([oneRow] as AthleteOption[]) : [];
        } else if (user.email) {
          const { data: listData } = await supabase
            .from("athlete_profiles")
            .select(ATHLETE_SELECT)
            .eq("email", user.email)
            .order("created_at", { ascending: false })
            .limit(50);
          rawList = (listData as AthleteOption[]) ?? [];
        }
        const list = dedupeAthletesByEmail(rawList);
        if (!active) return;
        setAthletes(list);

        const storedActiveAthleteId = readActiveAthleteId();
        /**
         * Private: il canone è `app_user_profiles.athlete_id`.
         * Un id locale stale (es. cambio account/browser) non deve sovrascrivere il mapping DB,
         * altrimenti le API training rispondono `forbidden` per atleta non autorizzato.
         */
        let resolvedAthleteId = profile?.athlete_id ?? storedActiveAthleteId ?? null;
        const guessedFirstName =
          typeof user.user_metadata?.first_name === "string" ? user.user_metadata.first_name : null;
        const guessedLastName =
          typeof user.user_metadata?.last_name === "string" ? user.user_metadata.last_name : null;

        if (!profile?.athlete_id) {
          const bootstrap = await fetch("/api/access/ensure-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              userId: user.id,
              role: "private",
              athleteId: resolvedAthleteId,
              email: user.email ?? null,
              firstName: guessedFirstName,
              lastName: guessedLastName,
            }),
          })
            .then(async (response) => {
              if (!response.ok) return null;
              return (await response.json()) as { athleteId?: string | null; role?: AppRole };
            })
            .catch(() => null);
          if (!active) return;
          resolvedAthleteId = bootstrap?.athleteId ?? resolvedAthleteId;
        }

        /**
         * Identità canonica: non ricalcolare l'atleta attivo scansionando athlete_profiles per email.
         * La sorgente unica è `app_user_profiles.athlete_id` (eventualmente riallineata da ensure-profile).
         * Evita switch silenziosi di contesto al reload quando esistono duplicati storici.
         */

        if (resolvedAthleteId) {
          writeActiveAthleteId(resolvedAthleteId);
        } else {
          clearPro2ClientSessionKeys();
        }

        if (!active) return;
        setAthleteId(resolvedAthleteId);
        writeAuditUserId(user.id);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    if (!supabase) {
      return () => {
        active = false;
      };
    }

    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
        if (event === "SIGNED_OUT") {
        setAthleteId(null);
        setAthletes([]);
        setRole("private");
        setPlatformCoachStatus(null);
        setSignedIn(false);
        setUserId(null);
        lastAuthenticatedUserIdRef.current = null;
        clearPro2ClientSessionKeys();
        setLoading(false);
        return;
      }
      if (session?.user) {
        // Ricarica SOLO se l'utente autenticato è cambiato davvero. Supabase emette
        // TOKEN_REFRESHED (~ogni ora) e ri-emette SIGNED_IN a ogni ritorno sulla tab:
        // rifare il bootstrap su quegli eventi ricaricava l'intera shell — percepito
        // come "auto refresh" periodico delle pagine. Il cambio atleta tra tab resta
        // coperto dal listener storage qui sotto.
        if (session.user.id !== lastAuthenticatedUserIdRef.current) {
          void load();
        }
      }
    });

    const handleStorage = (event: StorageEvent) => {
      if (!active) return;
      if (event.key !== "empathy_active_athlete_id") return;
      /** Rivalida roster / `app_user_profiles.athlete_id` — evita id stale da altro tab (coach). */
      void load();
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      active = false;
      authSub.subscription.unsubscribe();
      window.removeEventListener("storage", handleStorage);
    };
  }, [reloadToken]);

  return {
    athleteId,
    activeAthleteId: athleteId,
    role,
    platformCoachStatus,
    coachOperationalApproved: coachOperationalApproved(role, platformCoachStatus),
    athletes,
    loading,
    signedIn,
    userId,
    setActiveAthleteId,
    refresh,
    adminScoped: false,
    platformAdminView: false,
    scopeOwnerUserId: null,
  };
}
