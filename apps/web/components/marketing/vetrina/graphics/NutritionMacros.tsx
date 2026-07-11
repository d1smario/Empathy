type Labels = { nutritionTitle: string; carbs: string; protein: string; fat: string; calories: string };

/** Macro del giorno: donut carbo/proteine/grassi + kcal + barre. SVG illustrativo. */
export function NutritionMacros({ labels }: { labels: Labels }) {
  const macros = [
    { label: labels.carbs, grams: 320, pct: 52, color: "#22d3ee" },
    { label: labels.protein, grams: 145, pct: 26, color: "#f472b6" },
    { label: labels.fat, grams: 70, pct: 22, color: "#fbbf24" },
  ];
  const C = 2 * Math.PI * 34;
  let offset = 0;
  return (
    <div className="rounded-[1.4rem] border border-white/10 bg-[#0b0b0f] p-5 shadow-2xl">
      <span className="text-xs font-semibold text-white">{labels.nutritionTitle}</span>
      <div className="mt-3 flex items-center gap-5">
        <svg viewBox="0 0 90 90" className="h-24 w-24 shrink-0" role="img" aria-label={labels.nutritionTitle}>
          <circle cx="45" cy="45" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
          {macros.map((m) => {
            const len = (m.pct / 100) * C;
            const el = (
              <circle
                key={m.label}
                cx="45"
                cy="45"
                r="34"
                fill="none"
                stroke={m.color}
                strokeWidth="12"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 45 45)"
                strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
          <text x="45" y="43" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="800">2 640</text>
          <text x="45" y="55" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="7">{labels.calories}</text>
        </svg>
        <div className="flex-1 space-y-2">
          {macros.map((m) => (
            <div key={m.label}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-gray-300">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                  {m.label}
                </span>
                <span className="font-mono text-gray-400">{m.grams} g</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full" style={{ width: `${m.pct}%`, backgroundColor: m.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
