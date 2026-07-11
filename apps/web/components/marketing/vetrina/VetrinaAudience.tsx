import { getTranslations } from "next-intl/server";
import { Reveal } from "./Reveal";

type Card = { key: string; titleKey: string; bodyKey: string; pointsKey: string; accent: string; icon: string };

const CARDS: Card[] = [
  { key: "athlete", titleKey: "audienceAthleteTitle", bodyKey: "audienceAthleteBody", pointsKey: "audienceAthletePoints", accent: "pink", icon: "⚡" },
  { key: "coach", titleKey: "audienceCoachTitle", bodyKey: "audienceCoachBody", pointsKey: "audienceCoachPoints", accent: "violet", icon: "◎" },
  { key: "team", titleKey: "audienceTeamTitle", bodyKey: "audienceTeamBody", pointsKey: "audienceTeamPoints", accent: "cyan", icon: "⬡" },
];

const ACCENT: Record<string, { ring: string; chip: string; dot: string }> = {
  pink: { ring: "hover:border-pink-400/40", chip: "bg-pink-400/10 text-pink-200 border-pink-400/30", dot: "text-pink-300" },
  violet: { ring: "hover:border-violet-400/40", chip: "bg-violet-400/10 text-violet-200 border-violet-400/30", dot: "text-violet-300" },
  cyan: { ring: "hover:border-cyan-400/40", chip: "bg-cyan-400/10 text-cyan-200 border-cyan-400/30", dot: "text-cyan-300" },
};

/** "Per chi è Empathy" — doppio pubblico: atleta, coach, team. */
export async function VetrinaAudience() {
  const t = await getTranslations("Vetrina.home");
  return (
    <section className="mx-auto -mt-8 max-w-6xl px-1 sm:-mt-12">
      <Reveal className="text-center">
        <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{t("audienceTitle")}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-400 sm:text-base">{t("audienceSub")}</p>
      </Reveal>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {CARDS.map((c, i) => {
          const a = ACCENT[c.accent]!;
          const points = t.raw(c.pointsKey) as string[];
          return (
            <Reveal key={c.key} delay={i * 90}>
              <div className={`h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors ${a.ring}`}>
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border text-lg ${a.chip}`}>{c.icon}</div>
                <h3 className="mt-4 text-lg font-bold text-white">{t(c.titleKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{t(c.bodyKey)}</p>
                <ul className="mt-4 space-y-2">
                  {points.map((p, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className={`mt-0.5 ${a.dot}`}>✓</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
