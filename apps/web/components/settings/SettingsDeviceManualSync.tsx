"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ManualIntegrationPullButton } from "@/components/integrations/ManualIntegrationPullButton";
import { Pro2Link } from "@/components/ui/empathy";
import { useActiveAthlete } from "@/lib/use-active-athlete";

type LinkRow = { linked: boolean; error?: string };

/**
 * Sync manuale attività (Strava 14g → executed_workouts). OAuth resta in Profilo.
 */
export function SettingsDeviceManualSync() {
  const t = useTranslations("SettingsDeviceManualSync");
  const { loading: ctxLoading, signedIn, athleteId } = useActiveAthlete();
  const [strava, setStrava] = useState<LinkRow | null>(null);
  const [wahoo, setWahoo] = useState<LinkRow | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!athleteId) {
      setStrava(null);
      setWahoo(null);
      return;
    }
    setErr(null);
    try {
      const q = encodeURIComponent(athleteId);
      const [rStrava, rWahoo] = await Promise.all([
        fetch(`/api/integrations/strava/link-status?athleteId=${q}`, { cache: "no-store" }),
        fetch(`/api/integrations/wahoo/link-status?athleteId=${q}`, { cache: "no-store" }),
      ]);
      const jStrava = (await rStrava.json()) as { linked?: boolean; error?: string };
      const jWahoo = (await rWahoo.json()) as { linked?: boolean; error?: string };
      setStrava({ linked: Boolean(jStrava.linked), error: jStrava.error });
      setWahoo({ linked: Boolean(jWahoo.linked), error: jWahoo.error });
    } catch {
      setErr(t("errVerify"));
      setStrava(null);
      setWahoo(null);
    }
  }, [athleteId, t]);

  useEffect(() => {
    if (ctxLoading || !signedIn) return;
    void load();
  }, [ctxLoading, signedIn, load]);

  if (ctxLoading) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl sm:p-8">
        <div className="h-2 w-48 animate-pulse rounded-full bg-white/10" />
      </section>
    );
  }

  if (!signedIn || !athleteId) return null;

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl sm:p-8"
      aria-label={t("sectionAria")}
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500/80 via-rose-500/80 to-fuchsia-500/80 opacity-70"
        aria-hidden
      />
      <div className="relative">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-300">
          {t("eyebrow")}
        </p>
        <p className="mt-2 text-sm text-gray-400">
          {t.rich("description", {
            code: (chunks) => <code className="text-gray-500">{chunks}</code>,
            link: (chunks) => <Pro2Link href="/profile">{chunks}</Pro2Link>,
          })}
        </p>

        {err ? (
          <p className="mt-4 text-sm text-red-400" role="alert">
            {err}
          </p>
        ) : null}

        <ul className="mt-6 space-y-6">
          <li className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-sm font-semibold text-white">Strava</p>
            <p className="mt-1 text-xs text-gray-500">
              {t.rich("stravaEndpoint", {
                code: (chunks) => <code className="text-gray-600">{chunks}</code>,
              })}
            </p>
            {strava?.error ? <p className="mt-2 text-xs text-amber-300/90">{strava.error}</p> : null}
            <ManualIntegrationPullButton
              className="mt-3"
              athleteId={athleteId}
              linked={Boolean(strava?.linked)}
              endpoint="/api/integrations/strava/pull/run"
              label={t("stravaButton")}
            />
            {!strava?.linked ? (
              <p className="mt-2 text-xs text-gray-500">{t("stravaNotConnected")}</p>
            ) : null}
          </li>

          <li className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-sm font-semibold text-white">Wahoo</p>
            <p className="mt-1 text-xs text-gray-500">{t("wahooDescription")}</p>
            {wahoo?.error ? <p className="mt-2 text-xs text-amber-300/90">{wahoo.error}</p> : null}
            <ManualIntegrationPullButton
              className="mt-3"
              athleteId={athleteId}
              linked={Boolean(wahoo?.linked)}
              endpoint="/api/integrations/wahoo/pull/run"
              label={t("wahooButton")}
            />
          </li>
        </ul>
      </div>
    </section>
  );
}
