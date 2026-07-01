"use client";

import { useCallback, useEffect, useState } from "react";
import { Pro2Button } from "@/components/ui/empathy";
import { useActiveAthlete } from "@/lib/use-active-athlete";

/**
 * Card "Il tuo codice": il coach genera/mostra/ruota il proprio codice coach corto.
 * L'atleta lo inserisce a registrazione per essere collegato (ESCLUSIVO) a questo coach.
 */
export function CoachCodeCard() {
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
          setErr(j.error ?? "Unable to read the code.");
        }
      } catch {
        if (!cancelled) setErr("Network error.");
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
        setErr(j.error ?? "Unable to generate the code.");
        return;
      }
      setCode(j.code);
    } catch {
      setErr("Network error.");
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
      setErr("Copy failed.");
    }
  }, [code]);

  if (!ctxLoading && role === "private") {
    return null;
  }

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-xl sm:p-6"
      aria-label="Your coach code"
    >
      <div className="relative">
        <h2 className="text-lg font-bold text-white">Your code</h2>
        <p className="mt-1 text-sm text-gray-500">
          {disabled && role === "coach"
            ? "Available after administrator approval."
            : "Share it: the athlete enters it at registration to be linked to you."}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Pro2Button type="button" disabled={busy || disabled || loadingCode} onClick={() => void generate()}>
            {busy ? "Generating…" : code ? "Regenerate code" : "Generate code"}
          </Pro2Button>
          {code ? (
            <Pro2Button type="button" variant="secondary" onClick={() => void copy()}>
              {copied ? "Copied" : "Copy code"}
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
              Regenerating the code deactivates the previous one.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
