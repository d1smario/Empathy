"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type StatusPayload = {
  configured: boolean;
  reachable: boolean | null;
  message: string;
};

/**
 * Stato Replicate lato server (nessun segreto in UI). Informativo per asset esercizi — non blocca il builder.
 */
export function ReplicateStatusStrip() {
  const t = useTranslations("ReplicateStatusStrip");
  const [data, setData] = useState<StatusPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/training/builder/replicate-status", { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json()) as StatusPayload;
        if (!cancelled) setData(j);
      })
      .catch(() => {
        if (!cancelled) setErr(t("unreachable"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const borderClass =
    data?.configured && data?.reachable === true
      ? "border-emerald-500/45"
      : data?.configured && data?.reachable === false
        ? "border-amber-500/45"
        : "border-white/15";

  const label =
    data == null
      ? t("assets")
      : data.configured && data.reachable === true
        ? t("assetsConnected")
        : data.configured
          ? t("assetsTokenNetwork")
          : t("assetsNotConfigured");

  return (
    <div
      role="status"
      className={`rounded-xl border bg-black/40 px-3 py-2.5 text-xs leading-relaxed text-gray-400 ${borderClass}`}
    >
      <p className="font-bold text-gray-200">{label}</p>
      {err ? <p className="mt-1 text-amber-200/90">{err}</p> : null}
      {data && !err ? <p className="mt-1">{data.message}</p> : null}
      {data == null && !err ? <p className="mt-1 opacity-80">{t("checking")}</p> : null}
      <p className="mt-2 text-[0.65rem] opacity-75">
        {t.rich("pngBatch", {
          code: (chunks) => <code className="text-gray-500">{chunks}</code>,
        })}
      </p>
    </div>
  );
}
