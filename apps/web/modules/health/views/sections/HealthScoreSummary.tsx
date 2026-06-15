import { SHOW_HEALTH_DEMO_FALLBACK_DATA } from "@/modules/health/lib/health-panel-readers";

export interface HealthGlobalScores {
  ematici: number | null;
  microbiota: number | null;
  epigenetica: number | null;
  totale: number | null;
}

/** Sintesi unica dello stato di salute (health score globale). */
export function HealthScoreSummary({ scores }: { scores: HealthGlobalScores }) {
  return (
    <section
      id="mod-score"
      className="scroll-mt-28 rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-950/[0.14] via-pink-950/[0.08] to-black/85 p-6 shadow-inner"
      aria-label="Stato di salute"
    >
      <h2 className="text-center font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-rose-400">
        Stato di salute · sintesi
      </h2>
      {!SHOW_HEALTH_DEMO_FALLBACK_DATA ? (
        <p className="mx-auto mt-3 max-w-lg text-center text-sm text-gray-400">
          I punteggi sintetici compaiono quando sono presenti nei referti caricati.
        </p>
      ) : null}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          { k: "Ematici", v: scores.ematici },
          { k: "Microbiota", v: scores.microbiota },
          { k: "Epigenetica", v: scores.epigenetica },
          { k: "Score totale", v: scores.totale },
        ] satisfies Array<{ k: string; v: number | null }>).map((c) => (
          <div
            key={c.k}
            className="rounded-xl border border-rose-500/25 bg-rose-500/[0.08] px-4 py-5 text-center shadow-inner"
          >
            <div className="font-mono text-3xl font-black tabular-nums tracking-tight text-rose-50 sm:text-4xl">
              {c.v ?? "—"}
            </div>
            <div className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{c.k}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
