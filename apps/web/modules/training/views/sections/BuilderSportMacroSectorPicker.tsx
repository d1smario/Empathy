"use client";

import { LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Dispatch, SetStateAction } from "react";
import { SportDisciplineGlyph } from "@/components/training/SportDisciplineGlyph";
import { SPORT_MACRO_SECTORS, type SportMacroId } from "@/lib/training/builder/sport-macro-palette";
import { sportBelongsToMacro } from "@/lib/training/training-builder-rich-kit";

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
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => {
                    if (!sportBelongsToMacro(sport, m.id)) {
                      setSport(m.sports[0]?.sport ?? sport);
                    }
                  }}
                  className={`flex w-full min-h-[11rem] flex-col justify-between gap-4 rounded-2xl border-2 px-4 py-4 text-left transition sm:min-h-[12rem] sm:px-5 sm:py-5 ${m.macroIdle} ${sel ? m.macroActive : "opacity-95 hover:brightness-110 hover:opacity-100"}`}
                >
                  <div className="min-w-0">
                    <p className="text-base font-black leading-tight tracking-tight text-white sm:text-lg">{m.shortLabel}</p>
                    <p className="mt-1 line-clamp-2 text-[0.68rem] font-medium leading-snug text-white/80 sm:text-xs">{m.title}</p>
                  </div>
                  <div className="-mx-1 flex flex-row flex-nowrap items-center gap-2 overflow-x-auto border-t border-white/20 pt-3 [scrollbar-width:thin]">
                    {m.sports.map((s) => (
                      <span
                        key={s.sport}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/25 p-0.5 shadow-inner ring-1 ring-white/10 sm:h-11 sm:w-11"
                        title={s.label}
                        aria-hidden
                      >
                        <SportDisciplineGlyph glyph={s.glyph} className="h-8 w-8 sm:h-9 sm:w-9" />
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {(() => {
            const sector = SPORT_MACRO_SECTORS.find((x) => x.id === activeMacroId) ?? SPORT_MACRO_SECTORS[0];
            return (
              <div
                className={`mt-5 rounded-2xl border-2 border-white/10 bg-black/50 p-4 sm:p-5 ${
                  sector.id === "aerobic"
                    ? "shadow-[inset_0_0_40px_rgba(34,211,238,0.06)]"
                    : sector.id === "strength"
                      ? "shadow-[inset_0_0_40px_rgba(251,146,60,0.06)]"
                      : sector.id === "technical"
                        ? "shadow-[inset_0_0_40px_rgba(192,132,252,0.07)]"
                        : "shadow-[inset_0_0_40px_rgba(52,211,153,0.06)]"
                }`}
              >
                <p className="text-sm font-bold text-white">{sector.title}</p>
                <p className="mt-1 text-xs text-gray-500">{sector.blurb}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
                  {sector.sports.map((chip) => {
                    const active = sport.trim().toLowerCase() === chip.sport.trim().toLowerCase();
                    return (
                      <button
                        key={`${sector.id}-${chip.label}`}
                        type="button"
                        onClick={() => setSport(chip.sport)}
                        className={`group flex flex-col items-center gap-2 rounded-xl border border-transparent p-2 transition hover:border-white/15 hover:bg-white/[0.04] ${
                          active ? "border-white/25 bg-white/[0.08] ring-2 ring-white/30" : ""
                        }`}
                      >
                        <span
                          className={`flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-2xl border-2 bg-black/20 shadow-inner transition group-hover:scale-[1.04] ${chip.iconRing}`}
                        >
                          <SportDisciplineGlyph glyph={chip.glyph} className="h-9 w-9" />
                        </span>
                        <span className="text-center text-[0.65rem] font-bold leading-tight text-white">{chip.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </section>
  );
}
