"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, CircleDashed, Sparkles } from "lucide-react";
import type { OnboardingCompleteness, OnboardingItemResult } from "@/lib/onboarding/onboarding-completeness";

export type OnboardingPageViewProps = {
  athleteId: string;
  firstName: string | null;
  completeness: OnboardingCompleteness;
};

function ItemRow({ item, tone }: { item: OnboardingItemResult; tone: "essential" | "improve" | "optional" }) {
  const accent =
    tone === "essential"
      ? "border-amber-500/30 bg-amber-500/[0.06]"
      : tone === "improve"
        ? "border-cyan-500/20 bg-cyan-500/[0.04]"
        : "border-white/10 bg-white/[0.02]";
  return (
    <li className={`flex items-start gap-3 rounded-xl border ${accent} p-3.5`}>
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/30">
        <CircleDashed className="h-3.5 w-3.5 text-gray-400" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{item.label}</p>
        <p className="mt-0.5 text-xs text-gray-400">{item.unlocks}</p>
      </div>
      <Link
        href={item.href}
        className="inline-flex shrink-0 items-center gap-1 self-center rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/10"
      >
        Completa <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </li>
  );
}

export function OnboardingPageView({ firstName, completeness }: OnboardingPageViewProps) {
  const router = useRouter();
  const tzSyncedRef = useRef(false);
  const [tzSyncing, setTzSyncing] = useState(false);

  // Cattura automatica del fuso dal browser (IANA esatto) se manca — poi ricarica.
  useEffect(() => {
    if (tzSyncedRef.current) return;
    const tzItem = completeness.items.find((i) => i.key === "timezone");
    if (!tzItem || tzItem.done) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    tzSyncedRef.current = true;
    setTzSyncing(true);
    void fetch("/api/onboarding/timezone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: tz }),
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j?.changed) router.refresh();
      })
      .catch(() => {})
      .finally(() => setTzSyncing(false));
  }, [completeness.items, router]);

  const essentialTodo = completeness.items.filter((i) => i.category === "required" && !i.done);
  const improveTodo = completeness.items.filter((i) => i.category === "recommended" && !i.done);
  const optionalTodo = completeness.items.filter((i) => i.category === "optional" && !i.done);
  const doneItems = completeness.items.filter((i) => i.done);

  const { progressPct, planReady, required } = completeness;
  const greeting = firstName ? `Ciao ${firstName}` : "Ciao";

  return (
    <div className="min-h-screen bg-black px-4 pb-24 pt-6 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Prepariamo il tuo piano</p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{greeting}, ci siamo quasi.</h1>
          <p className="mt-2 max-w-prose text-sm text-gray-400">
            Completa i dati essenziali: appena ci sono tutti, Empathy genera il tuo piano di allenamento e
            alimentare sui tuoi numeri reali. I dati «consigliati» lo rendono più preciso.
          </p>
        </header>

        {/* Progresso */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">Dati essenziali</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-white">
                {required.done}<span className="text-gray-500">/{required.total}</span>
              </p>
            </div>
            <p className="text-3xl font-bold tabular-nums text-cyan-300">{progressPct}%</p>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-[width] duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {tzSyncing ? (
            <p className="mt-2 text-xs text-gray-500">Rilevo il tuo fuso orario…</p>
          ) : null}
        </section>

        {planReady ? (
          <section className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
            <div>
              <p className="text-sm font-bold text-emerald-100">Tutto pronto.</p>
              <p className="mt-1 text-sm text-emerald-200/80">
                Hai completato i dati essenziali: il tuo piano sta per essere generato. Nel frattempo puoi
                aggiungere i dati consigliati per renderlo ancora più preciso.
              </p>
            </div>
          </section>
        ) : null}

        {essentialTodo.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-300">Da completare</h2>
            <ul className="space-y-2.5">
              {essentialTodo.map((i) => (
                <ItemRow key={i.key} item={i} tone="essential" />
              ))}
            </ul>
          </section>
        ) : null}

        {improveTodo.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-300">Migliora il piano</h2>
            <ul className="space-y-2.5">
              {improveTodo.map((i) => (
                <ItemRow key={i.key} item={i} tone="improve" />
              ))}
            </ul>
          </section>
        ) : null}

        {optionalTodo.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Opzionali</h2>
            <ul className="space-y-2.5">
              {optionalTodo.map((i) => (
                <ItemRow key={i.key} item={i} tone="optional" />
              ))}
            </ul>
          </section>
        ) : null}

        {doneItems.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
              Completati · {doneItems.length}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {doneItems.map((i) => (
                <li
                  key={i.key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-100"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden /> {i.label}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
