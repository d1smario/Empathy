type Labels = { trainingTitle: string; power: string; hr: string };

/** Serie potenza & FC nel tempo (SVG illustrativo, stile dettaglio seduta). */
export function TrainingChart({ labels }: { labels: Labels }) {
  const power = "10,66 34,40 58,52 82,24 106,44 130,20 154,50 178,30 202,58 226,34 250,46 270,28";
  const hr = "10,80 34,72 58,74 82,58 106,64 130,52 154,66 178,56 202,70 226,58 250,62 270,54";
  return (
    <div className="rounded-[1.4rem] border border-white/10 bg-[#0b0b0f] p-5 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-white">{labels.trainingTitle}</span>
        <div className="flex gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-violet-300"><span className="h-1.5 w-1.5 rounded-full bg-violet-400" />{labels.power}</span>
          <span className="flex items-center gap-1 text-pink-300"><span className="h-1.5 w-1.5 rounded-full bg-pink-400" />{labels.hr}</span>
        </div>
      </div>
      <svg viewBox="0 0 280 104" className="w-full" role="img" aria-label={labels.trainingTitle}>
        {[26, 52, 78].map((y) => (
          <line key={y} x1="10" y1={y} x2="270" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}
        <polygon points={`${power} 270,96 10,96`} fill="#a78bfa" opacity="0.1" />
        <polyline points={power} fill="none" stroke="#a78bfa" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={hr} fill="none" stroke="#f472b6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      </svg>
    </div>
  );
}
