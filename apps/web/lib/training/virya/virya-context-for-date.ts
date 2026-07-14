/**
 * Contesto Virya (lungo periodo) per una singola data — alimenta la striscia
 * anteprima nel Builder. Puro: riceve le righe `[VIRYA:]` del calendario atleta e
 * deriva fase, settimana, carico-target e posizione della seduta nella settimana.
 * Nessun accesso rete: il fetch vive in `training-planned-api`.
 */

export type ViryaCalendarRow = {
  /** Tag piano `[VIRYA:...]` estratto dalle note. */
  tag: string;
  /** Data ISO `YYYY-MM-DD`. */
  date: string;
  /** `tss_target` della riga (Carico della seduta). 0 se assente. */
  tssTarget: number;
  /** Note grezze della `planned_workouts` (contengono il contratto BUILDER_SESSION_JSON). */
  notes: string | null;
};

export type ViryaDayContext = {
  planName: string;
  /** Settimana della data nel piano (1-based). */
  weekIndex: number;
  /** Settimane totali del piano. */
  totalWeeks: number;
  /** Fase (Base/Costruzione/…) della seduta in questa data, se ricavabile. */
  phaseLabel: string | null;
  /** Somma dei Carico-target delle sedute della settimana (arrotondata). */
  weekLoadTarget: number;
  /** Numero di sedute pianificate nella settimana. */
  sessionsThisWeek: number;
  /** Posizione della data nella settimana (1-based, tra le sedute pianificate). */
  positionInWeek: number;
};

const DAY_MS = 86_400_000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function toUTC(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

function planNameFromTag(tag: string): string {
  const m = tag.match(/\[VIRYA:([^\]]+)\]/);
  return (m?.[1] ?? "").trim();
}

const PHASE_CODE_TO_LABEL: Record<string, string> = {
  base: "Base",
  build: "Costruzione",
  costruzione: "Costruzione",
  refine: "Rifinitura",
  rifinitura: "Rifinitura",
  peak: "Forma",
  forma: "Forma",
  taper: "Scarico",
  deload: "Scarico",
  scarico: "Scarico",
  recovery: "Recupero",
  recupero: "Recupero",
};

function cleanPhase(raw: string): string {
  const k = raw.trim().toLowerCase();
  if (PHASE_CODE_TO_LABEL[k]) return PHASE_CODE_TO_LABEL[k];
  return raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1);
}

/** Estrae la fase dal contratto `BUILDER_SESSION_JSON::` (campo `phase`, fallback `sessionName`). */
export function extractViryaPhaseFromNotes(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/BUILDER_SESSION_JSON::([^\s\n]+)/);
  if (!m) return null;
  try {
    const obj = JSON.parse(decodeURIComponent(m[1])) as { phase?: unknown; sessionName?: unknown };
    if (typeof obj.phase === "string" && obj.phase.trim()) return cleanPhase(obj.phase);
    if (typeof obj.sessionName === "string") {
      for (const seg of obj.sessionName.split("·").map((s) => s.trim())) {
        if (seg && PHASE_CODE_TO_LABEL[seg.toLowerCase()]) return cleanPhase(seg);
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Deriva il contesto Virya per `isoDate`. Sceglie il piano `[VIRYA:]` la cui finestra
 * di date contiene la data; se nessuno la contiene ritorna null (la striscia non compare).
 */
export function deriveViryaContextForDate(rows: ViryaCalendarRow[], isoDate: string): ViryaDayContext | null {
  if (!ISO_RE.test(isoDate)) return null;
  const target = toUTC(isoDate);
  if (Number.isNaN(target)) return null;

  const byTag = new Map<string, ViryaCalendarRow[]>();
  for (const r of rows) {
    if (!r.tag || !ISO_RE.test(r.date)) continue;
    const arr = byTag.get(r.tag);
    if (arr) arr.push(r);
    else byTag.set(r.tag, [r]);
  }

  let chosen: { tag: string; rows: ViryaCalendarRow[]; min: number; max: number } | null = null;
  for (const [tag, planRows] of byTag) {
    let min = Infinity;
    let max = -Infinity;
    for (const r of planRows) {
      const d = toUTC(r.date);
      if (d < min) min = d;
      if (d > max) max = d;
    }
    if (target >= min && target <= max) {
      chosen = { tag, rows: planRows, min, max };
      break;
    }
  }
  if (!chosen) return null;

  const totalWeeks = Math.floor((chosen.max - chosen.min) / (7 * DAY_MS)) + 1;
  const weekIndex = Math.floor((target - chosen.min) / (7 * DAY_MS)) + 1;
  const weekStart = chosen.min + (weekIndex - 1) * 7 * DAY_MS;
  const weekEnd = weekStart + 6 * DAY_MS;

  const weekRows = chosen.rows
    .filter((r) => {
      const d = toUTC(r.date);
      return d >= weekStart && d <= weekEnd;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const weekLoadTarget = Math.round(
    weekRows.reduce((s, r) => s + (Number.isFinite(r.tssTarget) ? r.tssTarget : 0), 0),
  );
  const sessionsThisWeek = weekRows.length;
  const positionInWeek = weekRows.filter((r) => toUTC(r.date) <= target).length || 1;

  const onDate = weekRows.find((r) => r.date === isoDate) ?? weekRows[0] ?? null;
  const phaseLabel = onDate ? extractViryaPhaseFromNotes(onDate.notes) : null;

  return {
    planName: planNameFromTag(chosen.tag),
    weekIndex,
    totalWeeks,
    phaseLabel,
    weekLoadTarget,
    sessionsThisWeek,
    positionInWeek,
  };
}
