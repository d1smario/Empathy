"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveAthlete } from "@/lib/use-active-athlete";

/**
 * Permette al cliente di scegliere il provider canonico per dominio.
 *
 * Domini:
 *   - wellness_sleep    → ore sonno + stage hypnogram (mostrato in Calendar/Wellness/Day)
 *   - wellness_recovery → HRV / RHR / recovery score / readiness
 *   - training_activity → workout eseguiti (filtra `executed_workouts.source`)
 *
 * Default: nessuna scelta = comportamento storico (mix di tutti i provider connessi).
 *
 * API: GET/PUT /api/settings/data-source-preference
 */

type DataSourceDomain = "wellness_sleep" | "wellness_recovery" | "training_activity";

type Preferences = Partial<Record<DataSourceDomain, string>>;

const DOMAIN_META: Array<{
  id: DataSourceDomain;
  title: string;
  hint: string;
  options: Array<{ value: string; label: string }>;
}> = [
  {
    id: "wellness_sleep",
    title: "Sleep",
    hint: "Sleep hours, stages (deep/light/REM), hypnogram. Only this provider writes the Sleep KPI. If the device does not expose structured sleep via Empathy for that provider, the panel may stay empty.",
    options: [
      { value: "", label: "Auto (mix of all providers)" },
      { value: "whoop", label: "WHOOP" },
      { value: "garmin", label: "Garmin" },
      { value: "wahoo", label: "Wahoo" },
      { value: "strava", label: "Strava" },
    ],
  },
  {
    id: "wellness_recovery",
    title: "Recovery / HRV",
    hint: "HRV, resting heart rate, recovery and readiness score. Same note: an Empathy export recognized as recovery is required for that provider.",
    options: [
      { value: "", label: "Auto (mix of all providers)" },
      { value: "whoop", label: "WHOOP" },
      { value: "garmin", label: "Garmin" },
      { value: "wahoo", label: "Wahoo" },
      { value: "strava", label: "Strava" },
    ],
  },
  {
    id: "training_activity",
    title: "Training (activity)",
    hint: "Executed workouts (runs, rides, gym, …). Filters calendar, analytics and Core CTL/TSS by the `api_sync:<provider>:` prefix. If the real device is Garmin but here you choose Strava, activities stay in the DB but do not count toward load — use Auto or the correct provider.",
    options: [
      { value: "", label: "Auto (mix of all providers)" },
      { value: "garmin", label: "Garmin" },
      { value: "wahoo", label: "Wahoo" },
      { value: "strava", label: "Strava" },
      { value: "whoop", label: "WHOOP" },
    ],
  },
];

export function SettingsDataSourcePreference() {
  const { loading: ctxLoading, signedIn, athleteId } = useActiveAthlete();
  const [pref, setPref] = useState<Preferences | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyDomain, setBusyDomain] = useState<DataSourceDomain | null>(null);

  const load = useCallback(async () => {
    if (!athleteId) {
      setPref({});
      return;
    }
    setErr(null);
    try {
      const res = await fetch(`/api/settings/data-source-preference?athleteId=${encodeURIComponent(athleteId)}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as { ok?: boolean; preferences?: Preferences; error?: string };
      if (!res.ok || json.ok !== true) {
        setErr(json.error ?? "Unable to load provider preferences.");
        setPref(null);
        return;
      }
      setPref(json.preferences ?? {});
    } catch {
      setErr("Request failed.");
      setPref(null);
    }
  }, [athleteId]);

  useEffect(() => {
    if (ctxLoading || !signedIn) return;
    void load();
  }, [ctxLoading, signedIn, load]);

  const save = async (domain: DataSourceDomain, value: string) => {
    if (!athleteId) return;
    setBusyDomain(domain);
    setErr(null);
    try {
      const res = await fetch("/api/settings/data-source-preference", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId,
          domain,
          primary_provider: value === "" ? null : value,
        }),
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
      setBusyDomain(null);
    }
  };

  const items = useMemo(() => DOMAIN_META, []);

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
      aria-label="Provider choice per domain"
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fuchsia-500/80 via-violet-500/80 to-orange-500/80 opacity-70"
        aria-hidden
      />
      <div className="relative">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-fuchsia-300">
          Canonical provider per domain
        </p>
        <h3 className="mt-2 text-lg font-semibold text-white">Which device drives what</h3>
        <p className="mt-2 text-sm text-gray-400">
          Choose which device to take each data group from. Example: <em>Sleep → WHOOP</em>,{" "}
          <em>Training → Garmin</em>. When a preference is set, the other integrations keep ingesting
          (the athlete memory stays canonical) but on read the KPIs use only the chosen provider: no more inconsistent
          mixing across devices.
        </p>
        <p className="mt-1 text-[0.65rem] text-gray-600">
          API:{" "}
          <code className="rounded border border-white/10 bg-black/40 px-1 font-mono text-[0.65rem] text-pink-300">
            GET/PUT /api/settings/data-source-preference
          </code>
        </p>

        {err ? (
          <p className="mt-4 text-sm text-red-400" role="alert">
            {err}
          </p>
        ) : null}

        {pref === null && !err ? (
          <div className="mt-6 space-y-2">
            <div className="h-2 w-52 animate-pulse rounded-full bg-white/10" />
            <div className="h-2 w-40 animate-pulse rounded-full bg-white/10" />
            <div className="h-2 w-44 animate-pulse rounded-full bg-white/10" />
          </div>
        ) : null}

        {pref ? (
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {items.map((item) => {
              const current = pref[item.id] ?? "";
              const busy = busyDomain === item.id;
              return (
                <li
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:border-white/20"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-300">{item.title}</p>
                  <p className="mt-1 text-[0.7rem] leading-snug text-gray-500">{item.hint}</p>

                  <label className="mt-3 block text-[0.65rem] uppercase tracking-wide text-gray-500">
                    Chosen provider
                  </label>
                  <select
                    aria-label={`Provider ${item.title}`}
                    disabled={busy}
                    value={current}
                    onChange={(ev) => void save(item.id, ev.currentTarget.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-gray-100 outline-none transition focus:border-fuchsia-400/60 disabled:opacity-50"
                  >
                    {item.options.map((opt) => (
                      <option key={opt.value || "_auto"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {busy ? (
                    <p className="mt-2 text-[0.65rem] text-gray-500">Saving…</p>
                  ) : current ? (
                    <p className="mt-2 text-[0.65rem] text-emerald-300/80">
                      Active: the {item.title.toLowerCase()} KPIs come only from <strong>{current}</strong>.
                    </p>
                  ) : (
                    <p className="mt-2 text-[0.65rem] text-gray-500">No choice: automatic behavior.</p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
