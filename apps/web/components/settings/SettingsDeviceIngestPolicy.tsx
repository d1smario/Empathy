"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useActiveAthlete } from "@/lib/use-active-athlete";

type ProviderPayload = {
  provider: string;
  linked: true;
  streams: Record<string, boolean>;
};

const STREAM_LABEL_KEYS: Record<string, string> = {
  whoop_sleep: "streamWhoopSleep",
  whoop_recovery: "streamWhoopRecovery",
  whoop_workout: "streamWhoopWorkout",
  wahoo_workout: "streamWahooWorkout",
  garmin_activity_summary: "streamGarminActivitySummary",
};

const PROVIDER_LABELS: Record<string, string> = {
  whoop: "WHOOP",
  wahoo: "Wahoo",
  garmin: "Garmin",
  garmin_connectiq: "Garmin Connect IQ",
};

function labelForProvider(p: string): string {
  return PROVIDER_LABELS[p] ?? p;
}

/**
 * Toggle ingest per stream (policy DB + default). WHOOP workout e Wahoo workout sono disattivati di default
 * per ridurre doppioni se il training arriva da Garmin o altro canale.
 */
export function SettingsDeviceIngestPolicy() {
  const t = useTranslations("SettingsDeviceIngestPolicy");
  const { loading: ctxLoading, signedIn, athleteId } = useActiveAthlete();

  const labelForStream = (key: string): string => {
    const labelKey = STREAM_LABEL_KEYS[key];
    return labelKey ? t(labelKey) : key;
  };
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
        setErr(json.error ?? t("errorLoadPolicy"));
        setProviders(null);
        return;
      }
      setProviders(json.providers);
    } catch {
      setErr(t("errorRequestFailed"));
      setProviders(null);
    }
  }, [athleteId, t]);

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
        setErr(json.error ?? t("errorSaveFailed"));
        return;
      }
      await load();
    } catch {
      setErr(t("errorSaveFailed"));
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
      aria-label={t("sectionAriaLabel")}
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500/80 via-teal-500/80 to-cyan-500/80 opacity-70"
        aria-hidden
      />
      <div className="relative">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-emerald-300">
          {t("dataToSyncLabel")}
        </p>
        <p className="mt-2 text-sm text-gray-400">
          {t.rich("description", {
            b: (chunks) => <strong className="font-normal text-gray-300">{chunks}</strong>,
          })}
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
          <p className="mt-6 text-sm text-gray-500">{t("noProviderLinked")}</p>
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
                          {busy ? "…" : on ? t("toggleOn") : t("toggleOff")}
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
