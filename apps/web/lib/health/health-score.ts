/**
 * I punteggi di sintesi della Salute, calcolati da noi.
 *
 * Prima la pagina cercava dentro il referto una chiave che valesse già il punteggio
 * (`health_score_ematici`). Nessun laboratorio al mondo la scrive, quindi le quattro caselle
 * mostravano sempre un trattino.
 *
 * Il metodo qui non inventa soglie: usa gli INTERVALLI DI RIFERIMENTO che il laboratorio
 * stampa accanto a ogni valore e che sono già dentro il referto salvato. È la scelta migliore
 * disponibile — quegli intervalli tengono già conto di sesso, età, metodo di misura e
 * strumento del laboratorio, cose che una tabella generica scritta da noi non saprebbe.
 *
 * Tre regole, e nient'altro:
 *
 *  1. Un marcatore DENTRO il suo intervallo vale 100. Non c'è un «centro migliore del bordo»:
 *     l'intervallo di riferimento è già la definizione di normale.
 *  2. Fuori, il punteggio scende in modo lineare fino a 0. La scala del giudizio è la più
 *     severa fra due: la larghezza dell'intervallo, e la distanza del limite dallo zero.
 *     Servono entrambe. Con la sola larghezza, una ferritina a 0 su un intervallo 24-336
 *     perderebbe appena otto punti — l'intervallo è largo — mentre «zero ferritina» è la
 *     cosa peggiore che quel marcatore possa dire. Con la sola distanza dallo zero,
 *     un'emoglobina a 10 su 13-17 ne perderebbe pochi, e invece è anemia.
 *  3. Il punteggio dell'area è la media dei suoi marcatori E il peggiore, in parti uguali.
 *     Con la sola media un valore fuori norma sparisce dietro venti valori a posto — ed è
 *     esattamente il caso in cui un numero di sintesi dovrebbe servire a qualcosa.
 *
 * Un marcatore senza intervallo non entra nel conto: si vede, ma non pesa. E senza marcatori
 * utilizzabili NON esce un punteggio — meglio nessuna risposta di una inventata.
 */

export type MarkerRange = { low: number | null; high: number | null };

export type ScorableMarker = {
  field: string;
  value: number;
  range: MarkerRange;
};

export type MarkerScore = { field: string; value: number; score: number; inRange: boolean };

export type AreaScore = {
  /** 0-100, oppure `null` se non c'era niente di misurabile. */
  score: number | null;
  /** Su quanti marcatori è stato calcolato: va mostrato, non nascosto. */
  markerCount: number;
  /** Il marcatore che ha pesato di più verso il basso, per spiegare il numero. */
  worst: MarkerScore | null;
  /** Marcatori fuori dal loro intervallo. */
  outOfRange: MarkerScore[];
};

function clamp01to100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/**
 * La scala su cui si misura lo scostamento: la più severa fra la larghezza dell'intervallo
 * e la distanza del limite superato dallo zero. Prendere la più piccola significa prendere
 * il giudizio più severo — che su un valore del sangue è la direzione giusta in cui sbagliare.
 */
function severeScale(width: number, limit: number): number {
  const byLimit = Math.abs(limit);
  const candidates = [width, byLimit].filter((v) => Number.isFinite(v) && v > 0);
  return candidates.length ? Math.min(...candidates) : 1;
}

/**
 * Punteggio di un singolo marcatore. Un intervallo aperto da un lato (es. «< 5,0») si giudica
 * solo sul lato che ha: senza il secondo estremo non esiste una larghezza, e allora si usa il
 * limite stesso come scala — è l'unica grandezza omogenea a disposizione.
 */
export function scoreMarker(value: number, range: MarkerRange): number | null {
  if (!Number.isFinite(value)) return null;
  const { low, high } = range;
  const hasLow = typeof low === "number" && Number.isFinite(low);
  const hasHigh = typeof high === "number" && Number.isFinite(high);
  if (!hasLow && !hasHigh) return null;

  if (hasLow && hasHigh) {
    if ((low as number) >= (high as number)) return null;
    if (value >= (low as number) && value <= (high as number)) return 100;
    const width = (high as number) - (low as number);
    const superato = value < (low as number) ? (low as number) : (high as number);
    const distance = Math.abs(value - superato);
    return clamp01to100(100 * (1 - distance / severeScale(width, superato)));
  }

  const limit = (hasLow ? low : high) as number;
  if (hasHigh && value <= limit) return 100;
  if (hasLow && value >= limit) return 100;
  const distance = Math.abs(value - limit);
  // Intervallo aperto: la larghezza non esiste, resta la distanza del limite dallo zero.
  return clamp01to100(100 * (1 - distance / (Math.abs(limit) || 1)));
}

/** Punteggio di un'area: media e peggiore in parti uguali. Nessun marcatore utile → `null`. */
export function scoreArea(markers: readonly ScorableMarker[]): AreaScore {
  const scored: MarkerScore[] = [];
  for (const m of markers) {
    const s = scoreMarker(m.value, m.range);
    if (s == null) continue;
    scored.push({ field: m.field, value: m.value, score: s, inRange: s >= 100 });
  }
  if (!scored.length) return { score: null, markerCount: 0, worst: null, outOfRange: [] };

  const mean = scored.reduce((a, s) => a + s.score, 0) / scored.length;
  const worst = scored.reduce((a, s) => (s.score < a.score ? s : a), scored[0] as MarkerScore);
  return {
    score: Math.round((mean + worst.score) / 2),
    markerCount: scored.length,
    worst: worst.score >= 100 ? null : worst,
    outOfRange: scored.filter((s) => !s.inRange).sort((a, b) => a.score - b.score),
  };
}

/**
 * Il punteggio totale è la stessa regola applicata alle aree che hanno un numero: media e
 * peggiore in parti uguali. Un'area senza dati non abbassa il totale — non sapere non è
 * una cattiva notizia.
 */
export function scoreTotal(areas: ReadonlyArray<number | null>): number | null {
  const values = areas.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!values.length) return null;
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  return Math.round((mean + Math.min(...values)) / 2);
}

type ProposalLike = {
  field?: unknown;
  value?: unknown;
  reference_range?: unknown;
  referenceRange?: unknown;
};

function asNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function readRange(raw: unknown): MarkerRange | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const low = asNum(r.low);
  const high = asNum(r.high);
  if (low == null && high == null) return null;
  return { low, high };
}

/**
 * Estrae valore + intervallo dal referto salvato.
 *
 * Gli intervalli vivono accanto alle proposte del lettore (`vlm_proposals`, e la copia
 * archiviata dopo la conferma): è lì che il laboratorio li ha stampati e il lettore li ha
 * trascritti. Si guardano entrambe le liste perché un pannello confermato conserva l'archivio
 * e non sempre le proposte vive.
 */
export function extractScorableMarkers(panelValues: unknown): ScorableMarker[] {
  if (!panelValues || typeof panelValues !== "object") return [];
  const v = panelValues as Record<string, unknown>;
  const importBlock = v.import && typeof v.import === "object" ? (v.import as Record<string, unknown>) : {};

  const lists: unknown[] = [v.vlm_proposals, importBlock.vlm_proposals_archived, importBlock.ocr_proposals];
  const byField = new Map<string, ScorableMarker>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const raw of list as ProposalLike[]) {
      const field = typeof raw?.field === "string" ? raw.field.trim() : "";
      if (!field || byField.has(field)) continue;
      const value = asNum(raw?.value);
      const range = readRange(raw?.reference_range ?? raw?.referenceRange);
      if (value == null || !range) continue;
      byField.set(field, { field, value, range });
    }
  }
  return [...byField.values()];
}
