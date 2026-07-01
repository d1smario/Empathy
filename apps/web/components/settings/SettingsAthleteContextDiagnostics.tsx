"use client";

import { useActiveAthlete } from "@/lib/use-active-athlete";
import { Pro2Link } from "@/components/ui/empathy";

function maskId(id: string | null): string {
  if (!id) return "—";
  if (id.length <= 12) return "•••";
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-2.5 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="font-mono text-xs text-gray-300">{value}</span>
    </div>
  );
}

/**
 * Stato atleta attivo (locale, stessa chiave V1). Nessun schema generativo qui — solo contesto operativo.
 */
export function SettingsAthleteContextDiagnostics() {
  const { loading, signedIn, userId, athleteId, role, athletes } = useActiveAthlete();

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl sm:p-8"
      aria-label="Active athlete context"
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500/80 via-pink-500/80 to-purple-500/80 opacity-70"
        aria-hidden
      />
      <div className="relative">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-300">
          Athlete · context (Pro 2)
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Same data flow as V1 (lists from Supabase, bootstrap <code className="text-gray-500">/api/access/ensure-profile</code>
          ). Coach local key: <code className="text-pink-300">empathy_active_athlete_id</code>. Server-side email duplicate merge
          stays on V1 (<code className="text-gray-500">/api/athletes/repair</code>, service role).
        </p>

        {loading ? (
          <div className="mt-6 space-y-2">
            <div className="h-2 w-44 animate-pulse rounded-full bg-white/10" />
            <div className="h-2 w-52 animate-pulse rounded-full bg-white/10" />
          </div>
        ) : (
          <div className="mt-6 font-mono text-xs">
            <Row label="Session" value={signedIn ? "active" : "absent"} />
            <Row label="User id (masked)" value={maskId(userId)} />
            <Row label="Role" value={role} />
            <Row label="Active athlete (resolved)" value={maskId(athleteId)} />
            <Row label="Visible profiles (list)" value={String(athletes.length)} />
            {signedIn && role === "private" ? (
              <div className="mt-5 border-t border-white/10 pt-5">
                <p className="text-left text-sm font-sans text-gray-400">
                  You are <strong className="text-gray-200">private</strong> (athlete linked to your account). For a{" "}
                  <strong className="text-gray-200">coach</strong> account you need to sign in choosing <strong className="text-gray-200">Coach</strong>{" "}
                  during login/registration on{" "}
                  <Pro2Link href="/access" variant="secondary" className="inline-flex border border-white/15 px-2 py-0.5 text-xs">
                    /access
                  </Pro2Link>{" "}
                  (you cannot change role from Settings).
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
