import { useTranslations } from "next-intl";
import { SHOW_HEALTH_DEMO_FALLBACK_DATA } from "@/modules/health/lib/health-panel-readers";

export interface HealthGlobalScores {
  ematici: number | null;
  microbiota: number | null;
  epigenetica: number | null;
  totale: number | null;
  /** Su quanti marcatori è stato calcolato. Un punteggio senza il suo denominatore è un'opinione. */
  markerCount?: number;
  /** Il marcatore che ha pesato di più verso il basso: spiega il numero invece di lasciarlo lì. */
  worstField?: string | null;
  outOfRangeCount?: number;
}

/** Sintesi unica dello stato di salute (health score globale). */
export function HealthScoreSummary({ scores }: { scores: HealthGlobalScores }) {
  const t = useTranslations("HealthScoreSummary");
  return (
    <section
      id="mod-score"
      className="scroll-mt-20 rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-950/[0.14] via-pink-950/[0.08] to-black/85 p-4 shadow-inner sm:scroll-mt-28 sm:p-6"
      aria-label={t("healthStatusAria")}
    >
      <h2 className="text-center font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-rose-400">
        {t("title")}
      </h2>
      {/*
        Il denominatore accanto al numero: «su 25 marcatori» dice quanto vale quel 100.
        Senza referti utilizzabili resta il suggerimento di prima — non un punteggio inventato.
      */}
      {scores.markerCount && scores.markerCount > 0 ? (
        <p className="mx-auto mt-3 max-w-lg text-center text-sm text-gray-400">
          {t("computedOn", { count: scores.markerCount })}
          {scores.outOfRangeCount && scores.outOfRangeCount > 0 ? (
            <>
              {" · "}
              <span className="text-amber-300/90">
                {t("outOfRange", { count: scores.outOfRangeCount })}
              </span>
            </>
          ) : null}
        </p>
      ) : !SHOW_HEALTH_DEMO_FALLBACK_DATA ? (
        <p className="mx-auto mt-3 max-w-lg text-center text-sm text-gray-400">{t("scoresHint")}</p>
      ) : null}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          { k: t("bloodLabel"), v: scores.ematici },
          { k: t("microbiotaLabel"), v: scores.microbiota },
          { k: t("epigeneticsLabel"), v: scores.epigenetica },
          { k: t("totalScoreLabel"), v: scores.totale },
        ] satisfies Array<{ k: string; v: number | null }>).map((c) => (
          <div
            key={c.k}
            className="rounded-xl border border-rose-500/25 bg-rose-500/[0.08] px-3 py-4 text-center shadow-inner sm:px-4 sm:py-5"
          >
            <div className="font-mono text-2xl font-black tabular-nums tracking-tight text-rose-50 sm:text-4xl">
              {c.v ?? "—"}
            </div>
            <div className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{c.k}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
