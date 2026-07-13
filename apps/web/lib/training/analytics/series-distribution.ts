import { formatElapsedLabel, resampleToLength } from "@/lib/training/calendar-analyzer-helpers";

/** Serie di canale minima (HR, cadenza, potenza…): valori campione allineati per indice. */
export type ChannelValues = { channel: string; unit?: string; values: number[] };

export type HistogramBin = {
  /** Estremo basso del bucket (es. 140 per il bucket 140–145). */
  low: number;
  high: number;
  /** Etichetta asse X (estremo basso). */
  label: string;
  /** Minuti trascorsi in questo bucket. */
  minutes: number;
};

/**
 * Istogramma «minuti nel bucket» per una serie scalare (frequenza cardiaca, cadenza…).
 *
 * I campioni sono persistiti equi-spaziati nel tempo (`sampleEvenly` in import-parser),
 * quindi OGNI campione rappresenta la stessa fetta di tempo: `durationMinutes / N`.
 * Perciò `minuti_bucket = (conteggio_bucket / N) × durationMinutes` — esatto, senza
 * assumere un intervallo di campionamento (che NON è memorizzato). Vedi mappa A2.
 */
export function buildMinutesHistogram(
  values: number[],
  durationMinutes: number,
  opts?: { bucketWidth?: number; excludeZero?: boolean; min?: number; max?: number },
): HistogramBin[] {
  const bucketWidth = Math.max(1, Math.round(opts?.bucketWidth ?? 5));
  const totalSamples = values.length;
  if (totalSamples === 0) return [];
  const clean = values.filter(
    (v) => Number.isFinite(v) && (!opts?.excludeZero || v > 0),
  );
  if (clean.length === 0) return [];

  const dataMin = Math.min(...clean);
  const dataMax = Math.max(...clean);
  const lo = opts?.min ?? Math.floor(dataMin / bucketWidth) * bucketWidth;
  const hi = opts?.max ?? Math.ceil(dataMax / bucketWidth) * bucketWidth;
  const nBuckets = Math.max(1, Math.round((hi - lo) / bucketWidth));

  const counts = new Array<number>(nBuckets).fill(0);
  for (const v of clean) {
    let idx = Math.floor((v - lo) / bucketWidth);
    if (idx < 0) idx = 0;
    if (idx >= nBuckets) idx = nBuckets - 1;
    counts[idx] += 1;
  }

  // Denominatore = TUTTI i campioni (= durata totale): i minuti dei bucket sommano
  // alla durata reale (meno il tempo escluso da excludeZero / campioni non finiti).
  const perSampleMin = durationMinutes > 0 ? durationMinutes / totalSamples : 0;

  return counts.map((c, i) => {
    const low = lo + i * bucketWidth;
    return {
      low,
      high: low + bucketWidth,
      label: String(low),
      minutes: c * perSampleMin,
    };
  });
}

export type DataGridColumn = { channel: string; label: string; unit: string; decimals: number };
export type DataGridRow = { time: string; cells: Array<number | null> };

const GRID_CHANNEL_ORDER: Array<{ channel: string; label: string; unit: string; decimals: number }> = [
  { channel: "speed", label: "Speed", unit: "km/h", decimals: 1 },
  { channel: "hr", label: "HR", unit: "bpm", decimals: 0 },
  { channel: "cadence", label: "Cad", unit: "rpm", decimals: 0 },
  { channel: "power", label: "Power", unit: "W", decimals: 0 },
  { channel: "altitude", label: "Elev", unit: "m", decimals: 0 },
  { channel: "temperature", label: "Temp", unit: "°C", decimals: 0 },
];

/**
 * Griglia dati (Time × canali) per il dettaglio seduta. I canali possono avere
 * lunghezze diverse (verificato: hr 1016 vs speed 1200), quindi ri-campiona TUTTI a
 * `rowCount` righe equi-spaziate prima di allineare per indice (niente zip ingenuo).
 * Il tempo è sintetizzato (nessuna colonna time memorizzata), come l'overlay.
 */
export function buildSessionDataGridRows(
  series: ChannelValues[],
  durationMinutes: number,
  rowCount = 60,
): { columns: DataGridColumn[]; rows: DataGridRow[] } {
  const present = GRID_CHANNEL_ORDER.filter((c) =>
    series.some((s) => s.channel === c.channel && s.values.some((v) => Number.isFinite(v))),
  );
  if (present.length === 0) return { columns: [], rows: [] };

  const n = Math.max(2, Math.min(rowCount, 200));
  const resampled = present.map((col) => {
    const raw = series.find((s) => s.channel === col.channel)?.values ?? [];
    return resampleToLength(raw.filter((v) => Number.isFinite(v)), n);
  });

  const rows: DataGridRow[] = Array.from({ length: n }, (_, i) => ({
    time: formatElapsedLabel(i, n, durationMinutes),
    cells: resampled.map((vals) => {
      const v = vals[i];
      return Number.isFinite(v) ? (v as number) : null;
    }),
  }));

  const columns: DataGridColumn[] = present.map((c) => ({
    channel: c.channel,
    label: c.label,
    unit: c.unit,
    decimals: c.decimals,
  }));
  return { columns, rows };
}
