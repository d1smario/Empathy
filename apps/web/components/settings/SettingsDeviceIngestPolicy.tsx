"use client";

import { useCallback, useEffect, useState } from "react";
import { useActiveAthlete } from "@/lib/use-active-athlete";

type ProviderPayload = {
  provider: string;
  linked: true;
  streams: Record<string, boolean>;
};

const STREAM_LABELS: Record<string, string> = {
  whoop_sleep: "Sleep",
  whoop_recovery: "Recovery",
  whoop_workout: "Workout (training)",
  wahoo_workout: "Workout cloud",
  garmin_activity_summary: "Activity summary",
};

const PROVIDER_LABELS: Record<string, string> = {
  whoop: "WHOOP",
  wahoo: "Wahoo",
  garmin: "Garmin",
  garmin_connectiq: "Garmin Connect IQ",
};

function labelForStream(key: string): string {
  return STREAM_LABELS[key] ?? key;
}

function labelForProvider(p: string): string {
  return PROVIDER_LABELS[p] ?? p;
}

/**
 * Toggle ingest per stream (policy DB + default). WHOOP workout e Wahoo workout sono disattivati di default
 * per ridurre doppioni se il training arriva da Garmin o altro canale.
 */
export function SettingsDeviceIngestPolicy() {
  const { loading: ctxLoading, signedIn, athleteId } = useActiveAthlete();
  const [providers, setProviders] = useState<ProviderPayload[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!athleteId) {
      setProviders([]);
      return;
    }
    setErr(null);
    try {
      const res = await fetch(`/api/settings/device-ingest-policy?athleteId=${encodeURIComponent(athleteId)}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as { ok?: boolean; providers?: ProviderPayload[]; error?: string };
      if (!res.ok || json.ok !== true || !Array.isArray(json.providers)) {
        setErr(json.error ?? "Unable to load the ingest policy.");
        setProviders(null);
        return;
      }
      setProviders(json.providers);
    } catch {
      setErr("Request failed.");
      setProviders(null);
    }
  }, [athleteId]);

  useEffect(() => {
    if (ctxLoading || !signedIn) return;
    void load();
  }, [ctxLoading, signedIn, load]);

  const toggle = async (provider: string, streamKey: string, next: boolean) => {
    if (!athleteId) return;
    const opKey = `${provider}:${streamKey}`;
    setBusyKey(opKey);
    setErr(null);
    try {
      const res = await fetch("/api/settings/device-ingest-policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, provider, streams: { [streamKey]: next } }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok !== true) {
        setErr(json.error ?? "Save failed.");
        return;
      }
      await load();
    } catch {
      setErr("Save failed.");
    } finally {
      setBusyKey(null);
    }
  };

  if (ctxLoading) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl sm:p-8">
        <div className="h-2 w-48 animate-pulse rounded-full bg-white/10" />
      </section>
    );
  }

  if (!signedIn || !athleteId) {
    return null;
  }

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl sm:p-8"
      aria-label="Device ingest policy"
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500/80 via-teal-500/80 to-cyan-500/80 opacity-70"
        aria-hidden
      />
      <div className="relative">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-emerald-300">
          Data to sync
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Choose which data each device can sync (sleep, recovery, workouts). Leave
          {" "}<strong className="font-normal text-gray-300">«Workout»</strong> off on WHOOP/Wahoo if workouts already
          come from Garmin or Strava, so you avoid duplicates.
        </p>

        {err ? (
          <p className="mt-4 text-sm text-red-400" role="alert">
            {err}
          </p>
        ) : null}

        {providers === null && !err ? (
          <div className="mt-6 space-y-2">
            <div className="h-2 w-52 animate-pulse rounded-full bg-white/10" />
            <div className="h-2 w-40 animate-pulse rounded-full bg-white/10" />
          </div>
        ) : null}

        {providers && providers.length === 0 ? (
          <p className="mt-6 text-sm text-gray-500">No provider linked (WHOOP, Wahoo or Garmin).</p>
        ) : null}

        {providers && providers.length > 0 ? (
          <div className="mt-6 space-y-8">
            {providers.map((p) => (
              <div key={p.provider} className="border-b border-white/5 pb-6 last:border-0 last:pb-0">
                <p className="font-mono text-xs font-semibold text-gray-200">{labelForProvider(p.provider)}</p>
                <ul className="mt-3 space-y-3">
                  {Object.entries(p.streams).map(([key, on]) => {
                    const busy = busyKey === `${p.provider}:${key}`;
                    return (
                      <li key={key} className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm text-gray-400">{labelForStream(key)}</span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void toggle(p.provider, key, !on)}
                          className={
                            on
                              ? "rounded-full border border-emerald-500/50 bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
                              : "rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-gray-400 hover:bg-white/10 disabled:opacity-50"
                          }
                        >
                          {busy ? "…" : on ? "On" : "Off"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
