"use client";

import { useState } from "react";

type PhaseStatus = "done" | "active" | "planned";

const PHASES: Array<{
  id: string;
  title: string;
  summary: string;
  status: PhaseStatus;
}> = [
  {
    id: "p1",
    title: "Phase 1 — Monorepo, shell, module routing",
    summary: "Workspaces, App Router, sidebar, generative / standard placeholders.",
    status: "done",
  },
  {
    id: "p2",
    title: "Phase 2 — Stripe billing (demo)",
    summary: "checkout-config, optional anonymous checkout-session, webhook signature + log.",
    status: "done",
  },
  {
    id: "p3",
    title: "Phase 3 — Diagnostics in Settings",
    summary: "Billing and integrations flags without exposing secrets; terminal commands below.",
    status: "done",
  },
  {
    id: "p4",
    title: "Phase 4 — Auth + athlete context (Supabase)",
    summary:
      "Login + shell gate; `useActiveAthlete` aligned with V1 (query `athlete_profiles` / `app_user_profiles` / `coach_athletes`, `POST /api/access/ensure-profile` cookie).",
    status: "done",
  },
  {
    id: "p5",
    title: "Phase 5 — First module with real data",
    summary:
      "Dashboard `athlete-hub`, Profile `athlete-row`, Training / Nutrition / Physiology / Health (API + card), Athletes `roster`, coach roster filtered in `useActiveAthlete`. Next: session detail or Phase 6 knowledge.",
    status: "active",
  },
  {
    id: "p6",
    title: "Phase 6 — Knowledge / traces",
    summary: "Evidence pipeline and research traces linked to the twin and modules.",
    status: "planned",
  },
];

function StatusPill({ status }: { status: PhaseStatus }) {
  const label =
    status === "done" ? "Done" : status === "active" ? "In progress" : "Planned";
  const cls =
    status === "done"
      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
      : status === "active"
        ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
        : "border-white/10 bg-white/5 text-gray-500";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[0.65rem] font-bold uppercase ${cls}`}>
      {label}
    </span>
  );
}

/** Blocco comandi: path generico; sostituisci la cartella se il clone è altrove. */
const TERMINAL_SNIPPET = `cd "C:\\Users\\rovam\\OneDrive\\Documenti\\EMPATHY\\empathy-pro-2-cursor"
# Chiudi altri dev server (porte 3000/3020). Opzionale: Stop-Process -Name node -Force
npm run dev:clean
npm install
npm run verify
npm run dev
# Windows: build dev in apps/.empathy-pro2-next-dev (NEXT_DIST_DIR relativo). URL: localhost:3020 o porta in console`;

export function SettingsBuildPhasesCard() {
  const [open, setOpen] = useState(true);

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl sm:p-8"
      aria-label="Empathy Pro 2 build roadmap"
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500/80 via-fuchsia-500/80 to-rose-500/80 opacity-70"
        aria-hidden
      />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-fuchsia-300">
              Roadmap · phases
            </p>
            <p className="mt-2 max-w-xl text-sm text-gray-400">
              High-level status of the Pro 2 scaffold. Update the labels in code when you close a phase.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-gray-300 hover:border-white/25"
          >
            {open ? "Collapse" : "Expand"}
          </button>
        </div>

        {open ? (
          <ol className="mt-8 space-y-4">
            {PHASES.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 sm:px-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={p.status} />
                  <h2 className="text-base font-bold text-white">{p.title}</h2>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{p.summary}</p>
              </li>
            ))}
          </ol>
        ) : null}

        <div className="mt-10 border-t border-white/10 pt-8">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-300">
            Terminal commands (copy when you return)
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Adjust the path if the repo is not under Documents. On OneDrive, if the build fails with readlink, delete{" "}
            <code className="text-gray-400">apps/web/.next</code> before <code className="text-gray-400">npm run verify</code>.
          </p>
          <pre className="mt-4 max-h-64 overflow-auto rounded-2xl border border-white/10 bg-black/50 p-4 font-mono text-[0.7rem] leading-relaxed text-gray-300 select-all">
            {TERMINAL_SNIPPET}
          </pre>
        </div>
      </div>
    </section>
  );
}
