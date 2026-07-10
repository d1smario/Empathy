import { getTranslations } from "next-intl/server";
import { Reveal } from "./Reveal";

/**
 * Il cerchio adattivo: Orologio → Twin → Esercizio → Nutrizione, loop continuo.
 * SVG con anello rotante (CSS, rispetta reduced-motion) + didascalie accessibili.
 */
export async function VetrinaAdaptiveCircle() {
  const t = await getTranslations("Vetrina.home");
  const nodes = [
    { key: "watch", label: t("circleWatch"), body: t("circleWatchBody"), color: "#f9a8d4", angle: -90 },
    { key: "exercise", label: t("circleExercise"), body: t("circleExerciseBody"), color: "#c4b5fd", angle: 30 },
    { key: "nutrition", label: t("circleNutrition"), body: t("circleNutritionBody"), color: "#67e8f9", angle: 150 },
  ];
  const R = 120;
  const cx = 160;
  const cy = 160;
  const pos = (deg: number) => {
    const r = (deg * Math.PI) / 180;
    return { x: cx + R * Math.cos(r), y: cy + R * Math.sin(r) };
  };

  return (
    <section className="mx-auto mt-28 max-w-5xl px-1">
      <style>{`@media (prefers-reduced-motion: no-preference){@keyframes vetrinaSpin{to{transform:rotate(360deg)}}}`}</style>
      <Reveal className="text-center">
        <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{t("circleTitle")}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-400 sm:text-base">{t("circleSub")}</p>
      </Reveal>

      <div className="mt-12 grid items-center gap-10 md:grid-cols-2">
        <Reveal className="flex justify-center">
          <svg viewBox="0 0 320 320" className="h-72 w-72 sm:h-80 sm:w-80" role="img" aria-label={t("circleTitle")}>
            <defs>
              <radialGradient id="vetrinaHub" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#ec4899" stopOpacity="0.5" />
              </radialGradient>
            </defs>
            {/* anello rotante */}
            <g style={{ transformOrigin: "160px 160px", animation: "vetrinaSpin 22s linear infinite" }}>
              <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="4 10" />
            </g>
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="28" />
            {/* connessioni al centro */}
            {nodes.map((n) => {
              const p = pos(n.angle);
              return <line key={`l-${n.key}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />;
            })}
            {/* hub centrale: Twin */}
            <circle cx={cx} cy={cy} r="46" fill="url(#vetrinaHub)" />
            <text x={cx} y={cy - 3} textAnchor="middle" className="fill-white" fontSize="13" fontWeight="700">
              {t("circleTwin")}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="8">
              twin
            </text>
            {/* nodi */}
            {nodes.map((n) => {
              const p = pos(n.angle);
              return (
                <g key={n.key}>
                  <circle cx={p.x} cy={p.y} r="30" fill="#0b0b0f" stroke={n.color} strokeWidth="1.5" />
                  <text x={p.x} y={p.y + 4} textAnchor="middle" fill={n.color} fontSize="11" fontWeight="600">
                    {n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </Reveal>

        <div className="space-y-4">
          <Reveal delay={60}>
            <div className="rounded-2xl border border-purple-400/25 bg-purple-400/5 p-5">
              <p className="text-sm font-bold text-white">{t("circleTwin")}</p>
              <p className="mt-1 text-sm text-gray-400">{t("circleTwinBody")}</p>
            </div>
          </Reveal>
          {nodes.map((n, i) => (
            <Reveal key={n.key} delay={120 + i * 70}>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: n.color }} aria-hidden />
                <div>
                  <p className="text-sm font-bold text-white">{n.label}</p>
                  <p className="mt-0.5 text-sm text-gray-400">{n.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
