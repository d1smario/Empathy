"use client";

import Link from "next/link";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { Pro2Link } from "@/components/ui/empathy";

/**
 * Solo informativa: ruolo coach / privato si imposta in fase di accesso (`/access`), non da Impostazioni.
 * Abilitazione operativa coach da console Admin (`/admin`).
 */
export function SettingsCoachAccountCard() {
  const { role, signedIn, coachOperationalApproved, platformCoachStatus } = useActiveAthlete();

  if (!signedIn) {
    return (
      <section
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl sm:p-8"
        aria-label="Coach account"
      >
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-violet-300">Coach · account</p>
        <p className="mt-3 text-sm text-gray-400">
          Sign in to see your account role. The athlete / coach type is chosen on the{" "}
          <Pro2Link href="/access" variant="secondary" className="inline-flex border border-white/15 px-2 py-0.5 text-xs">
            Access
          </Pro2Link>{" "}
          page (not here).
        </p>
      </section>
    );
  }

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl sm:p-8"
      aria-label="Coach account"
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500/80 via-fuchsia-500/80 to-cyan-500/80 opacity-70"
        aria-hidden
      />
      <div className="relative">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-violet-300">Coach · account</p>
        <h2 className="mt-2 text-xl font-bold text-white">Account role</h2>
        <p className="mt-2 text-sm text-gray-400">
          Current account type: <strong className="text-gray-200">{role === "coach" ? "coach" : "athlete (private)"}</strong>.
          The choice between <strong className="text-gray-300">Athlete</strong> and <strong className="text-gray-300">Coach</strong> must
          be made on the{" "}
          <Link href="/access" className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200">
            access page
          </Link>{" "}
          (login or sign-up): the role <strong className="text-gray-300">cannot</strong> be changed from Settings, so
          administration has a single control point besides the{" "}
          <code className="text-gray-500">/admin</code> console.
        </p>

        {role === "coach" ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-gray-400">
            <p>
              Platform status:{" "}
              <strong className="text-gray-200">{platformCoachStatus ?? "pending"}</strong>
              {coachOperationalApproved ? (
                <span className="text-emerald-300/90"> — operational (invites and roster active).</span>
              ) : (
                <span className="text-amber-200/90"> — awaiting administrator approval.</span>
              )}
            </p>
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4 text-xs text-gray-500">
          <p className="font-mono text-[0.6rem] uppercase tracking-wider text-gray-600">Coach operations</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Roster and invites: <strong className="text-gray-400">Athletes</strong> module (<code className="text-gray-500">/athletes</code>).</li>
            <li>Enablement from <strong className="text-gray-400">Admin · Platform</strong> (<code className="text-gray-400">approved</code> status).</li>
            <li>
              Server: <code className="text-pink-300">SUPABASE_SERVICE_ROLE_KEY</code>, tables{" "}
              <code className="text-gray-400">coach_invitations</code>, org <code className="text-gray-400">EMPATHY_COACH_ATHLETES_ORG_ID</code>.
            </li>
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Pro2Link
            href="/athletes"
            variant="secondary"
            className="justify-center border border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
          >
            Athletes
          </Pro2Link>
          <Pro2Link href="/access" variant="ghost" className="justify-center border border-white/15 text-gray-300">
            Access page (change account)
          </Pro2Link>
        </div>
      </div>
    </section>
  );
}
