"use client";

import { formatAthleteProfileStrip, type AthleteProfileRowView } from "@/lib/profile/athlete-profile-strip";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { mapAthleteProfileRow } from "@/lib/profile/map-athlete-profile-row";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { useActiveAthlete } from "@/lib/use-active-athlete";

/** Stesse colonne della vecchia API `athlete-row` (nessuna colonna in più). */
const ATHLETE_ROW_SELECT =
  "id, first_name, last_name, email, birth_date, sex, timezone, activity_level, height_cm, weight_kg, training_days_per_week, training_max_session_minutes, updated_at";

// Cache cross-mount dell'anagrafica atleta: ri-atterrando sulla pagina i dati
// compaiono subito (niente spinner/"refresh"); il refetch parte comunque in
// background silenzioso, così le modifiche al profilo restano riflesse.
let athleteCardCacheId: string | null = null;
let athleteCardCache: { profile: AthleteProfileRowView | null; err: string | null } | null = null;

export function ProfileAthleteCard() {
  const t = useTranslations("ProfileAthleteCard");
  const { athleteId, loading: ctxLoading } = useActiveAthlete();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AthleteProfileRowView | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (ctxLoading) return;
    if (!athleteId) {
      setProfile(null);
      setErr(t("noActiveAthlete"));
      setLoading(false);
      return;
    }
    let c = false;
    (async () => {
      // Se i dati di questo atleta sono già in cache, mostrali SUBITO (niente
      // spinner); il refetch in background sotto aggiorna comunque stato+cache.
      const cached = athleteCardCacheId === athleteId ? athleteCardCache : null;
      if (cached) {
        setProfile(cached.profile);
        setErr(cached.err);
        setLoading(false);
      } else {
        setLoading(true);
        setErr(null);
      }
      try {
        // Lettura diretta dal browser (RLS fa da guardia): stessa select e stesso
        // mapping al view-model della vecchia API `athlete-row`.
        const supabase = createEmpathyBrowserSupabase();
        if (!supabase) {
          if (c) return;
          setProfile(null);
          const nextErr = "supabase_unconfigured";
          setErr(nextErr);
          athleteCardCache = { profile: null, err: nextErr };
          athleteCardCacheId = athleteId;
          return;
        }
        const { data: row, error } = await supabase
          .from("athlete_profiles")
          .select(ATHLETE_ROW_SELECT)
          .eq("id", athleteId)
          .maybeSingle();
        if (c) return;
        if (error) {
          setProfile(null);
          const nextErr = error.message || t("readFailed");
          setErr(nextErr);
          athleteCardCache = { profile: null, err: nextErr };
          athleteCardCacheId = athleteId;
          return;
        }
        const nextProfile = mapAthleteProfileRow(row);
        setProfile(nextProfile);
        setErr(null);
        athleteCardCache = { profile: nextProfile, err: null };
        athleteCardCacheId = athleteId;
      } catch {
        if (!c) setErr(t("networkError"));
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [athleteId, ctxLoading]);

  return (
    <section
      className="w-full max-w-lg rounded-2xl border border-white/10 bg-black/30 p-6 text-left backdrop-blur-md"
      aria-label={t("ariaLabel")}
    >
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-violet-300">{t("realDataLabel")}</p>
      <h2 className="mt-2 text-lg font-bold text-white">{t("heading")}</h2>

      {ctxLoading || loading ? (
        <div className="mt-4 h-2 w-40 animate-pulse rounded-full bg-white/10" />
      ) : null}

      {!ctxLoading && !loading && err ? (
        <p className="mt-4 text-sm text-amber-300/90" role="alert">
          {err}
        </p>
      ) : null}

      {!ctxLoading && !loading && !err && !profile ? (
        <p className="mt-4 text-sm text-gray-500">{t("noRow")}</p>
      ) : null}

      {!ctxLoading && !loading && !err && profile ? (
        <p className="mt-4 text-sm leading-relaxed text-gray-200">{formatAthleteProfileStrip(profile)}</p>
      ) : null}
    </section>
  );
}
