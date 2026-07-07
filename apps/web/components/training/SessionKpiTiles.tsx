import type { ExecutedWorkout } from "@empathy/domain-training";
import type { SessionKpiTile } from "@/lib/training/session-detail-summary";

/** Classi per accento KPI: bordo vivace + sfumatura colorata + glow → sezione energica. */
export const ACCENT_TILE: Record<
  NonNullable<SessionKpiTile["accent"]>,
  { ring: string; grad: string; label: string; glow: string }
> = {
  fuchsia: { ring: "border-fuchsia-400/50", grad: "from-fuchsia-500/25", label: "text-fuchsia-200", glow: "shadow-fuchsia-500/20" },
  violet: { ring: "border-violet-400/50", grad: "from-violet-500/25", label: "text-violet-200", glow: "shadow-violet-500/20" },
  orange: { ring: "border-orange-400/50", grad: "from-orange-500/25", label: "text-orange-200", glow: "shadow-orange-500/20" },
  cyan: { ring: "border-cyan-400/50", grad: "from-cyan-500/25", label: "text-cyan-200", glow: "shadow-cyan-500/20" },
  emerald: { ring: "border-emerald-400/50", grad: "from-emerald-500/25", label: "text-emerald-200", glow: "shadow-emerald-500/20" },
  sky: { ring: "border-sky-400/50", grad: "from-sky-500/25", label: "text-sky-200", glow: "shadow-sky-500/20" },
};

type TileSize = "md" | "sm";

const SIZE: Record<TileSize, { box: string; value: string; unit: string }> = {
  md: { box: "px-4 py-3", value: "text-2xl", unit: "text-xs" },
  sm: { box: "px-3 py-2", value: "text-lg", unit: "text-[0.65rem]" },
};

/** Tile KPI performance con accento colorato per canale. `size="sm"` per l'anteprima compatta. */
export function KpiTile({ tile, size = "md" }: { tile: SessionKpiTile; size?: TileSize }) {
  const a = ACCENT_TILE[tile.accent ?? "orange"];
  const s = SIZE[size];
  return (
    <div className={`rounded-2xl border ${a.ring} bg-gradient-to-br ${a.grad} via-black/30 to-black/50 ${s.box} shadow-lg ${a.glow}`}>
      <p className={`font-mono text-[0.6rem] font-bold uppercase tracking-[0.2em] ${a.label}`}>{tile.label}</p>
      <p className={`mt-1 font-mono ${s.value} font-bold tabular-nums text-white`}>
        {tile.value}
        {tile.unit ? <span className={`ml-1 ${s.unit} font-medium text-gray-400`}>{tile.unit}</span> : null}
      </p>
    </div>
  );
}

/** Tile biomarcatore (lattato/glicemia/SmO₂): fucsia acceso, distinto dai KPI performance. */
export function BiomarkerTile({ tile, size = "md" }: { tile: SessionKpiTile; size?: TileSize }) {
  const s = SIZE[size];
  return (
    <div className={`rounded-2xl border border-fuchsia-400/50 bg-gradient-to-br from-fuchsia-500/25 via-black/30 to-black/50 ${s.box} shadow-lg shadow-fuchsia-500/20`}>
      <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.2em] text-fuchsia-200">{tile.label}</p>
      <p className={`mt-1 font-mono ${s.value} font-bold tabular-nums text-white`}>
        {tile.value}
        {tile.unit ? <span className={`ml-1 ${s.unit} font-medium text-gray-400`}>{tile.unit}</span> : null}
      </p>
    </div>
  );
}

/** Biomarcatori seduta da colonne `executed_workouts` (lattato/glicemia/SmO₂). Adattivo: solo valori presenti. */
export function sessionBiomarkerTiles(workout: ExecutedWorkout): SessionKpiTile[] {
  const tiles: SessionKpiTile[] = [];
  const lac = Number(workout.lactateMmoll);
  const glu = Number(workout.glucoseMmol);
  const smo = Number(workout.smo2);
  if (Number.isFinite(lac) && lac > 0) tiles.push({ label: "Lattato", value: lac.toFixed(1), unit: "mmol/L" });
  if (Number.isFinite(glu) && glu > 0) tiles.push({ label: "Glicemia", value: glu.toFixed(1), unit: "mmol/L" });
  if (Number.isFinite(smo) && smo > 0) tiles.push({ label: "SmO₂", value: smo.toFixed(0), unit: "%" });
  return tiles;
}
