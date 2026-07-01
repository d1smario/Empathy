"use client";

import type { Dispatch, SetStateAction } from "react";

/**
 * Banner d'ingresso da VIRYA (?src=virya) del builder seduta.
 * Decomposizione del God-component TrainingBuilderRichPageView.
 * Render-only: stato nel padre, passato via props.
 */
export type BuilderViryaEntryBannerProps = {
  viryaEntry: boolean;
  dismissViryaEntryBanner: boolean;
  setDismissViryaEntryBanner: Dispatch<SetStateAction<boolean>>;
};

export function BuilderViryaEntryBanner({
  viryaEntry,
  dismissViryaEntryBanner,
  setDismissViryaEntryBanner,
}: BuilderViryaEntryBannerProps) {
  return (
    <>
        {viryaEntry && !dismissViryaEntryBanner ? (
          <div
            className="rounded-xl border border-orange-500/35 bg-orange-950/20 px-4 py-3 text-sm text-orange-100/95 shadow-[inset_0_1px_0_rgba(251,146,60,0.12)]"
            role="status"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="max-w-3xl leading-relaxed">
                Path from <strong className="text-orange-200">VIRYA</strong>: here you materialize the{" "}
                <strong className="text-orange-200">single session</strong> with the builder engine. The calendar updates only after
                explicit save.
              </p>
              <button
                type="button"
                className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-xs text-gray-300 hover:border-white/30 hover:text-white"
                onClick={() => setDismissViryaEntryBanner(true)}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
    </>
  );
}
