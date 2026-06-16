"use client";

import { formatAthleteProfileStrip, type AthleteProfileRowView } from "@/lib/profile/athlete-profile-strip";
import { useEffect, useState } from "react";
import { useActiveAthlete } from "@/lib/use-active-athlete";

type ApiOk = { ok: true; athleteId: string; profile: AthleteProfileRowView | null };
type ApiErr = { ok: false; error?: string };

// Cache cross-mount dell'anagrafica atleta: ri-atterrando sulla pagina i dati
// compaiono subito (niente spinner/"refresh"); il refetch parte comunque in
// background silenzioso, così le modifiche al profilo restano riflesse.
let athleteCardCacheId: string | null = null;
let athleteCardCache: { profile: AthleteProfileRowView | null; err: string | null } | null = null;

export function ProfileAthleteCard() {
  const { athleteId, loading: ctxLoading } = useActiveAthlete();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AthleteProfileRowView | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (ctxLoading) return;
    if (!athleteId) {
      setProfile(null);
      setErr("Nessun atleta attivo.");
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
        const res = await fetch(`/api/profile/athlete-row?athleteId=${encodeURIComponent(athleteId)}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as ApiOk | ApiErr;
        if (c) return;
        if (!res.ok || !json.ok) {
          setProfile(null);
          const nextErr = ("error" in json && json.error) || "Lettura non riuscita.";
          setErr(nextErr);
          athleteCardCache = { profile: null, err: nextErr };
          athleteCardCacheId = athleteId;
          return;
        }
        setProfile(json.profile);
        setErr(null);
        athleteCardCache = { profile: json.profile, err: null };
        athleteCardCacheId = athleteId;
      } catch {
        if (!c) setErr("Errore di rete.");
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
      aria-label="Profilo atleta"
    >
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-violet-300">Profile · dati reali</p>
      <h2 className="mt-2 text-lg font-bold text-white">Anagrafica & disponibilità</h2>

      {ctxLoading || loading ? (
        <div className="mt-4 h-2 w-40 animate-pulse rounded-full bg-white/10" />
      ) : null}

      {!ctxLoading && !loading && err ? (
        <p className="mt-4 text-sm text-amber-300/90" role="alert">
          {err}
        </p>
      ) : null}

      {!ctxLoading && !loading && !err && !profile ? (
        <p className="mt-4 text-sm text-gray-500">Nessuna riga in athlete_profiles per questo id.</p>
      ) : null}

      {!ctxLoading && !loading && !err && profile ? (
        <p className="mt-4 text-sm leading-relaxed text-gray-200">{formatAthleteProfileStrip(profile)}</p>
      ) : null}
    </section>
  );
}
