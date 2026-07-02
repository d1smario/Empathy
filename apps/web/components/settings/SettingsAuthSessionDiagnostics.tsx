"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Pro2Link } from "@/components/ui/empathy";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";

type SessionPayload =
  | {
      ok: true;
      configured: boolean;
      signedIn: boolean;
      userId: string | null;
      authError?: boolean;
    }
  | { ok?: false };

function BoolPill({ value }: { value: boolean }) {
  const t = useTranslations("SettingsAuthSessionDiagnostics");
  return (
    <span
      className={
        value
          ? "rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-200"
          : "rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-gray-500"
      }
    >
      {value ? t("yes") : t("no")}
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-2.5 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function maskUserId(id: string | null): string {
  if (!id) return "—";
  if (id.length <= 12) return "•••";
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

/**
 * Probe sessione direttamente dal browser (`supabase.auth.getUser()`) —
 * niente PII oltre a un id mascherato opzionale.
 */
export function SettingsAuthSessionDiagnostics() {
  const t = useTranslations("SettingsAuthSessionDiagnostics");
  const [data, setData] = useState<SessionPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createEmpathyBrowserSupabase();
        if (!supabase) {
          if (!cancelled) setData({ ok: true, configured: false, signedIn: false, userId: null });
          return;
        }
        const { data: got, error } = await supabase.auth.getUser();
        if (cancelled) return;
        if (error) {
          setData({ ok: true, configured: true, signedIn: false, userId: null, authError: true });
          return;
        }
        setData({ ok: true, configured: true, signedIn: Boolean(got.user), userId: got.user?.id ?? null });
      } catch {
        if (!cancelled) setErr(t("errorRequestFailed"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl sm:p-8"
      aria-label={t("ariaLabel")}
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-green-500/80 via-teal-500/80 to-emerald-500/80 opacity-70"
        aria-hidden
      />
      <div className="relative">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-teal-300">
          {t("header")}
        </p>
        <p className="mt-2 text-sm text-gray-400">
          {t.rich("endpointDescription", {
            endpoint: () => (
              <code className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-xs text-pink-300">
                supabase.auth.getUser()
              </code>
            ),
            env: () => <code className="text-gray-500">NEXT_PUBLIC_SUPABASE_*</code>,
          })}
        </p>

        {err ? (
          <p className="mt-4 text-sm text-red-400" role="alert">
            {err}
          </p>
        ) : null}

        {!err && !data ? (
          <div className="mt-6 space-y-2">
            <div className="h-2 w-40 animate-pulse rounded-full bg-white/10" />
            <div className="h-2 w-56 animate-pulse rounded-full bg-white/10" />
          </div>
        ) : null}

        {data && data.ok ? (
          <div className="mt-6 font-mono text-xs">
            <Row label={t("rowConfigured")}>
              <BoolPill value={data.configured} />
            </Row>
            <Row label={t("rowValidSession")}>
              <BoolPill value={data.signedIn} />
            </Row>
            {"authError" in data && data.authError ? (
              <p className="mt-3 text-amber-400">
                {t("authErrorWarning")}
              </p>
            ) : null}
            {data.signedIn && data.userId ? (
              <p className="mt-3 text-gray-500">
                {t.rich("maskedUserId", {
                  id: () => (
                    <span className="text-gray-400">{maskUserId(data.userId)}</span>
                  ),
                })}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8 border-t border-white/10 pt-6">
          <Pro2Link href="/access" variant="secondary" className="justify-center">
            {t("accessPage")}
          </Pro2Link>
        </div>
      </div>
    </section>
  );
}
