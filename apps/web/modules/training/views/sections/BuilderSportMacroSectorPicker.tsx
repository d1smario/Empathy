"use client";

import { LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Dispatch, SetStateAction } from "react";
import { SportDisciplineGlyph } from "@/components/training/SportDisciplineGlyph";
import { SPORT_MACRO_SECTORS, type SportMacroId } from "@/lib/training/builder/sport-macro-palette";

/**
 * Griglia macro-settori (Sport per settore A→D) del builder seduta
 * (decomposizione del God-component TrainingBuilderRichPageView).
 * Render-only: stato nel padre, passato via props.
 */
export type BuilderSportMacroSectorPickerProps = {
  activeMacroId: SportMacroId;
  sport: string;
  setSport: Dispatch<SetStateAction<string>>;
};

export function BuilderSportMacroSectorPicker({
  activeMacroId,
  sport,
  setSport,
}: BuilderSportMacroSectorPickerProps) {
  const t = useTranslations("BuilderSportMacroSectorPicker");
  return (
        <section
          aria-label={t("sessionFamiliesAriaLabel")}
          className="rounded-2xl border border-orange-500/25 bg-gradient-to-br from-orange-950/[0.12] via-black/60 to-black/85 p-4 shadow-inner sm:p-5 lg:p-6"
        >
          <div className="mb-5 flex flex-wrap items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-orange-400/45 bg-orange-500/35 text-orange-50 shadow-[0_0_16px_rgba(251,146,60,0.35)]">
              <LayoutGrid className="h-5 w-5" strokeWidth={2.35} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-white">
                {t("sportBySectorTitle")}
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                {t("sportBySectorDescription")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {SPORT_MACRO_SECTORS.map((m) => {
              const sel = activeMacroId === m.id;
              return (
                <div
                  key={m.id}
                  className={`flex w-full min-h-[11rem] flex-col justify-between gap-4 rounded-2xl border-2 px-4 py-4 text-left transition sm:min-h-[12rem] sm:px-5 sm:py-5 ${m.macroIdle} ${sel ? m.macroActive : "opacity-95 hover:brightness-110 hover:opacity-100"}`}
                >
                  <div className="min-w-0">
                    <p className="text-base font-black leading-tight tracking-tight text-white sm:text-lg">{m.shortLabel}</p>
                    <p className="mt-1 line-clamp-2 text-[0.68rem] font-medium leading-snug text-white/80 sm:text-xs">{m.title}</p>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 border-t border-white/20 pt-3 sm:grid-cols-5">
                    {m.sports.map((s) => {
                      const active = sport.trim().toLowerCase() === s.sport.trim().toLowerCase();
                      return (
                        <button
                          key={s.sport}
                          type="button"
                          aria-pressed={active}
                          title={s.label}
                          onClick={() => setSport(s.sport)}
                          className={`group flex flex-col items-center gap-1 rounded-lg border border-transparent p-1 transition hover:border-white/15 hover:bg-white/[0.04] ${
                            active ? "border-white/25 bg-white/[0.08] ring-2 ring-white/30" : ""
                          }`}
                        >
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 bg-black/20 shadow-inner transition group-hover:scale-[1.04] sm:h-10 sm:w-10 ${s.iconRing}`}
                          >
                            <SportDisciplineGlyph glyph={s.glyph} className="h-6 w-6 sm:h-7 sm:w-7" />
                          </span>
                          <span className="text-center text-[0.55rem] font-bold leading-tight text-white sm:text-[0.6rem]">{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
  );
}
