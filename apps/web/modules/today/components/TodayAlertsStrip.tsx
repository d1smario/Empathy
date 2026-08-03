"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import type { AlertKind } from "@/lib/alerts/athlete-alerts";
import { ALERT_KIND_META, alertsSinceIso, formatAlertTime, isAlertKind } from "@/lib/alerts/alerts-ui";
import { cn } from "@/lib/cn";

/**
 * Strip alert dell'atleta su Oggi: query DIRETTA browser→Supabase su `athlete_alerts`
 * (RLS select-own), ultime 48h non lette, con «segna letto» via update di `read_at`
 * (unica colonna concessa in update ai client dalla migrazione). L'orario mostrato è
 * `created_at` reale: «gli alert sono di quando arrivano, non di quando guardi l'app».
 * Nessun alert → nessuna strip.
 */

type AlertRow = {
  id: string;
  kind: AlertKind;
  created_at: string;
};

export function TodayAlertsStrip({ athleteId }: { athleteId: string }) {
  const t = useTranslations("AthleteAlerts");
  const locale = useLocale();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) return;
    void (async () => {
      const { data, error } = await supabase
        .from("athlete_alerts")
        .select("id, kind, created_at")
        .eq("athlete_id", athleteId)
        .gte("created_at", alertsSinceIso())
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      // Silenzioso su errore: la strip è un extra, mai bloccare Oggi.
      if (cancelled || error) return;
      setAlerts(
        ((data ?? []) as { id: string; kind: string; created_at: string }[]).filter((row): row is AlertRow =>
          isAlertKind(row.kind),
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  const markRead = useCallback(
    async (id: string) => {
      const supabase = createEmpathyBrowserSupabase();
      if (!supabase) return;
      setBusyId(id);
      setActionErr(null);
      try {
        const { error } = await supabase
          .from("athlete_alerts")
          .update({ read_at: new Date().toISOString() })
          .eq("id", id);
        if (error) {
          setActionErr(t("markReadFailed"));
          return;
        }
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      } catch {
        setActionErr(t("markReadFailed"));
      } finally {
        setBusyId(null);
      }
    },
    [t],
  );

  const timeFmt = useMemo(() => (iso: string) => formatAlertTime(iso, locale), [locale]);

  if (alerts.length === 0 && !actionErr) return null;

  return (
    <section aria-label={t("stripAria")} className="space-y-2">
      {actionErr ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100" role="alert">
          {actionErr}
        </p>
      ) : null}
      <ul className="flex flex-wrap gap-2">
        {alerts.map((a) => {
          const meta = ALERT_KIND_META[a.kind];
          const Icon = meta.icon;
          const label = t(`kind.${a.kind}`);
          return (
            <li
              key={a.id}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm backdrop-blur-md",
                meta.tone,
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0">{label}</span>
              <span className="shrink-0 font-mono text-[0.65rem] uppercase tracking-wide opacity-70">
                {timeFmt(a.created_at)}
              </span>
              <button
                type="button"
                onClick={() => void markRead(a.id)}
                disabled={busyId === a.id}
                aria-label={t("markReadAria", { label })}
                title={t("markRead")}
                className="ml-1 shrink-0 rounded-lg border border-white/15 bg-white/5 p-1 transition hover:border-white/30 hover:bg-white/10 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
