"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Pro2Button } from "@/components/ui/empathy";
import { useActiveAthlete } from "@/lib/use-active-athlete";

/**
 * Card "Il tuo codice": il coach genera/mostra/ruota il proprio codice coach corto.
 * L'atleta lo inserisce a registrazione per essere collegato (ESCLUSIVO) a questo coach.
 */
export function CoachCodeCard() {
  const t = useTranslations("CoachCodeCard");
  const { role, coachOperationalApproved, loading: ctxLoading } = useActiveAthlete();
  const disabled = ctxLoading || role !== "coach" || (role === "coach" && !coachOperationalApproved);
  const [busy, setBusy] = useState(false);
  const [loadingCode, setLoadingCode] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (disabled) {
      setLoadingCode(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/coach/code", { method: "GET" });
        const j = (await res.json()) as { ok?: boolean; code?: string | null; error?: string };
        if (cancelled) return;
        if (res.ok && j.ok) {
          setCode(j.code ?? null);
        } else {
          setErr(j.error ?? t("errorRead"));
        }
      } catch {
        if (!cancelled) setErr(t("errorNetwork"));
      } finally {
        if (!cancelled) setLoadingCode(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [disabled]);

  const generate = useCallback(async () => {
    setErr(null);
    setCopied(false);
    setBusy(true);
    try {
      const res = await fetch("/api/coach/code", { method: "POST" });
      const j = (await res.json()) as { ok?: boolean; code?: string; error?: string };
      if (!res.ok || !j.ok || !j.code) {
        setErr(j.error ?? t("errorGenerate"));
        return;
      }
      setCode(j.code);
    } catch {
      setErr(t("errorNetwork"));
    } finally {
      setBusy(false);
    }
  }, []);

  const copy = useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr(t("errorCopy"));
    }
  }, [code]);

  if (!ctxLoading && role === "private") {
    return null;
  }

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-xl sm:p-6"
      aria-label={t("ariaLabel")}
    >
      <div className="relative">
        <h2 className="text-lg font-bold text-white">{t("title")}</h2>
        <p className="mt-1 text-sm text-gray-500">
          {disabled && role === "coach"
            ? t("approvalHint")
            : t("shareHint")}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Pro2Button type="button" disabled={busy || disabled || loadingCode} onClick={() => void generate()}>
            {busy ? t("generating") : code ? t("regenerate") : t("generate")}
          </Pro2Button>
          {code ? (
            <Pro2Button type="button" variant="secondary" onClick={() => void copy()}>
              {copied ? t("copied") : t("copy")}
            </Pro2Button>
          ) : null}
        </div>

        {err ? (
          <p className="mt-3 text-sm text-amber-200/90" role="alert">
            {err}
          </p>
        ) : null}

        {code ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-left">
            <p className="font-mono text-lg font-bold uppercase tracking-[0.25em] text-white">{code}</p>
            <p className="mt-2 text-xs text-gray-500">
              {t("regenerateNote")}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
