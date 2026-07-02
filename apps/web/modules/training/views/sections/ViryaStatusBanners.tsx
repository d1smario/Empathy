"use client";

import { useTranslations } from "next-intl";

export type ViryaStatusBannersProps = {
  error: string | null;
  success: string | null;
  contextLoading: boolean;
};

export function ViryaStatusBanners({
  error,
  success,
  contextLoading,
}: ViryaStatusBannersProps) {
  const t = useTranslations("ViryaStatusBanners");
  return (
    <>
      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {success}
        </div>
      ) : null}
      {contextLoading ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {t("contextSyncing")}
        </div>
      ) : null}
    </>
  );
}
