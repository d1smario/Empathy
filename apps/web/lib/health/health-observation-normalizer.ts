import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { HEALTH_MARKERS, MICROBIOTA_TAXA } from "@/lib/health/health-ontology";
import type { HealthPanelTypeForParse } from "@/lib/health/lab-text-extractors";
import { recordEmpathyEvent } from "@/lib/observability/empathy-event-trace";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DbClient = SupabaseClient;

/** Evento ops emesso quando il grafo causale non riesce a nascere: cercabile su `empathy_events`. */
const LINEAGE_FAILED_EVENT = "health.observation_lineage.insert_failed";

/**
 * `metadata` è OBBLIGATORIO, e non per pignoleria di tipi.
 *
 * `observation_lineage.metadata` è `jsonb NOT NULL DEFAULT '{}'`, ma quel DEFAULT protegge
 * la colonna ASSENTE, non il NULL esplicito. postgrest-js, su `.insert(array)`, calcola
 * l'unione delle chiavi di tutte le righe e la manda come `?columns=...`; con
 * `defaultToNull` (il suo default) le righe che quella chiave non ce l'hanno la ricevono
 * come NULL. Un array misto — una riga con `metadata`, le altre senza — faceva quindi
 * saltare l'INTERO batch con 23502, e con lui ogni traccia di lineage del referto.
 *
 * Marcandolo non-opzionale il compilatore chiude la porta: una riga senza `metadata` non
 * si può più costruire. Il caso «non ho niente da dire» si scrive `{}`, che è esattamente
 * ciò che il DEFAULT avrebbe messo.
 */
type LineageRow = {
  athlete_id: string;
  extraction_run_id: string | null;
  source_table: string;
  source_id: string | null;
  target_table: string;
  target_id: string | null;
  relation: string;
  metadata: Record<string, unknown>;
};

function appendObservationLineage(
  rows: LineageRow[],
  input: { athleteId: string; extractionRunId: string | null; tableName: string; relation: string; ids: string[] },
) {
  for (const id of input.ids) {
    rows.push({
      athlete_id: input.athleteId,
      extraction_run_id: input.extractionRunId,
      source_table: "extraction_runs",
      source_id: input.extractionRunId,
      target_table: input.tableName,
      target_id: id,
      relation: input.relation,
      metadata: {},
    });
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractionStatusFromParsed(parsed: Record<string, unknown>, sourceKind: "pdf" | "image" | "other") {
  const keys = Object.keys(parsed);
  if (!keys.length) return sourceKind === "image" ? "needs_manual_review" : "failed";
  const hasStructured = keys.some((k) => k.endsWith("_taxa") || k.endsWith("_hits") || k.endsWith("_flags"));
  return hasStructured ? "parsed_full" : "parsed_partial";
}

export async function persistNormalizedObservations(input: {
  db: DbClient;
  athleteId: string;
  panelId: string;
  panelType: HealthPanelTypeForParse;
  parsed: Record<string, unknown>;
  sampleDate: string;
  sourceKind: "pdf" | "image" | "other";
  parserVersion: string;
  sourceHash?: string | null;
  qualityReport?: Record<string, unknown>;
}): Promise<{
  extractionRunId: string | null;
  inserted: number;
  lineageInserted: number;
  /** Messaggio del fallimento del lineage (già tracciato su `empathy_events`), `null` se è andata. */
  lineageError: string | null;
}> {
  const status = extractionStatusFromParsed(input.parsed, input.sourceKind);
  const { data: runRow, error: runErr } = await input.db
    .from("extraction_runs")
    .insert({
      athlete_id: input.athleteId,
      panel_id: input.panelId,
      source_kind: input.sourceKind,
      parser_version: input.parserVersion,
      status,
      source_hash: input.sourceHash ?? null,
      quality_report: input.qualityReport ?? {},
    })
    .select("id")
    .maybeSingle();
  if (runErr) throw new Error(runErr.message);
  const extractionRunId = runRow?.id ?? null;
  const lineageRows: LineageRow[] = [];
  if (extractionRunId) {
    lineageRows.push({
      athlete_id: input.athleteId,
      extraction_run_id: extractionRunId,
      source_table: "biomarker_panels",
      source_id: input.panelId,
      target_table: "extraction_runs",
      target_id: extractionRunId,
      relation: "created_extraction_run",
      metadata: { parser_version: input.parserVersion, source_kind: input.sourceKind },
    });
  }

  const markerByKey = new Map(
    HEALTH_MARKERS.filter((m) => m.panelType === input.panelType).map((m) => [m.key, m] as const),
  );

  let inserted = 0;
  const labRows: Array<Record<string, unknown>> = [];
  const hormoneRows: Array<Record<string, unknown>> = [];
  for (const [key, value] of Object.entries(input.parsed)) {
    if (key === "microbiota_taxa" || key === "epigenetic_gene_hits" || key === "epigenetic_methylation_flags") continue;
    const marker = markerByKey.get(key);
    if (!marker) continue;
    const valueNum = toNumber(value);
    const common = {
      athlete_id: input.athleteId,
      panel_id: input.panelId,
      extraction_run_id: extractionRunId,
      marker_key: key,
      value_num: valueNum,
      value_text: valueNum == null && value != null ? String(value) : null,
      unit: marker.unit ?? null,
      raw_label: marker.label,
      observed_at: input.sampleDate,
      confidence: 0.85,
    };
    labRows.push(common);
    if (input.panelType === "hormones") {
      const axis =
        key.startsWith("cortisol") || key === "dhea"
          ? "hpa"
          : key === "testosterone" || key === "free_testosterone" || key === "lh" || key === "fsh"
            ? "hpg"
            : key === "tsh" || key === "t3" || key === "t4"
              ? "thyroid"
              : "other";
      hormoneRows.push({
        athlete_id: input.athleteId,
        panel_id: input.panelId,
        extraction_run_id: extractionRunId,
        axis,
        marker_key: key,
        value_num: valueNum,
        unit: marker.unit ?? null,
        observed_at: input.sampleDate,
        confidence: 0.85,
      });
    }
  }
  if (labRows.length) {
    const { data, error } = await input.db.from("lab_observations").insert(labRows).select("id");
    if (error) throw new Error(error.message);
    appendObservationLineage(lineageRows, {
      athleteId: input.athleteId,
      extractionRunId,
      tableName: "lab_observations",
      relation: "extracted_observation",
      ids: ((data ?? []) as Array<{ id: string }>).map((row) => row.id),
    });
    inserted += labRows.length;
  }
  if (hormoneRows.length) {
    const { data, error } = await input.db.from("hormone_observations").insert(hormoneRows).select("id");
    if (error) throw new Error(error.message);
    appendObservationLineage(lineageRows, {
      athleteId: input.athleteId,
      extractionRunId,
      tableName: "hormone_observations",
      relation: "extracted_observation",
      ids: ((data ?? []) as Array<{ id: string }>).map((row) => row.id),
    });
    inserted += hormoneRows.length;
  }

  const taxaRaw = input.parsed.microbiota_taxa;
  if (Array.isArray(taxaRaw) && taxaRaw.length) {
    const taxaRows = taxaRaw
      .map((row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const r = row as Record<string, unknown>;
        const key = String(r.key ?? "").trim().toLowerCase();
        if (!key) return null;
        const dict = MICROBIOTA_TAXA.find((t) => t.key === key);
        return {
          athlete_id: input.athleteId,
          panel_id: input.panelId,
          extraction_run_id: extractionRunId,
          taxon_key: key,
          taxon_rank: (dict?.rank ?? String(r.rank ?? "other")) as string,
          domain_kind: (dict?.kind ?? String(r.kind ?? "other")) as string,
          abundance_pct: toNumber(r.pct),
          value_num: toNumber(r.value_num),
          unit: typeof r.unit === "string" ? r.unit : "%",
          observed_at: input.sampleDate,
          confidence: 0.8,
          metadata: { label: dict?.label ?? r.label ?? key },
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    if (taxaRows.length) {
      const { data, error } = await input.db.from("microbiota_observations").insert(taxaRows).select("id");
      if (error) throw new Error(error.message);
      appendObservationLineage(lineageRows, {
        athleteId: input.athleteId,
        extractionRunId,
        tableName: "microbiota_observations",
        relation: "extracted_observation",
        ids: ((data ?? []) as Array<{ id: string }>).map((row) => row.id),
      });
      inserted += taxaRows.length;
    }
  }

  const geneHitsRaw = input.parsed.epigenetic_gene_hits;
  const methylationFlagsRaw = input.parsed.epigenetic_methylation_flags;
  const epiRows: Array<Record<string, unknown>> = [];
  if (Array.isArray(geneHitsRaw)) {
    for (const gene of geneHitsRaw) {
      const symbol = String(gene ?? "").trim().toUpperCase();
      if (!symbol) continue;
      epiRows.push({
        athlete_id: input.athleteId,
        panel_id: input.panelId,
        extraction_run_id: extractionRunId,
        gene_symbol: symbol,
        direction: "risk",
        observed_at: input.sampleDate,
        confidence: 0.7,
        metadata: { source: "gene_hit" },
      });
    }
  }
  if (Array.isArray(methylationFlagsRaw)) {
    for (const flag of methylationFlagsRaw) {
      const label = String(flag ?? "").trim();
      if (!label) continue;
      epiRows.push({
        athlete_id: input.athleteId,
        panel_id: input.panelId,
        extraction_run_id: extractionRunId,
        methylation_flag: label,
        direction: label.includes("hypo") || label.includes("ipo") ? "down" : "up",
        observed_at: input.sampleDate,
        confidence: 0.65,
        metadata: { source: "methylation_keyword" },
      });
    }
  }
  if (epiRows.length) {
    const { data, error } = await input.db.from("epigenetic_observations").insert(epiRows).select("id");
    if (error) throw new Error(error.message);
    appendObservationLineage(lineageRows, {
      athleteId: input.athleteId,
      extractionRunId,
      tableName: "epigenetic_observations",
      relation: "extracted_observation",
      ids: ((data ?? []) as Array<{ id: string }>).map((row) => row.id),
    });
    inserted += epiRows.length;
  }

  let lineageInserted = 0;
  let lineageError: string | null = null;
  if (lineageRows.length) {
    const { error } = await input.db.from("observation_lineage").insert(lineageRows);
    if (error) {
      /**
       * Il lineage è memoria del percorso, non il percorso: le osservazioni sono già a
       * terra e non si buttano via. Prima invece si lanciava, e la `runHealthDeterministic-
       * PostProcess` che sta a monte incassava l'eccezione in un `catch` che la riduceva a
       * una stringa nella risposta HTTP: bruciava anche il grafo causale e lo staging run
       * che venivano DOPO, e un'ora più tardi non ne restava nulla da nessuna parte (la
       * ritenzione dei log runtime su Vercel è di circa un'ora).
       *
       * Quindi: non blocca, ma non sparisce. La traccia va su `empathy_events` come per i
       * cron. In scrittura la RLS di quella tabella ammette solo i platform admin, perciò
       * serve il client service role: quello del chiamante è la sessione dell'atleta o del
       * coach. Se il service role non è configurato, `recordEmpathyEvent` ripiega sul log.
       */
      lineageError = error.message;
      const tracer = createSupabaseAdminClient() ?? input.db;
      await recordEmpathyEvent(tracer, {
        eventType: LINEAGE_FAILED_EVENT,
        payload: {
          athlete_id: input.athleteId,
          panel_id: input.panelId,
          panel_type: input.panelType,
          extraction_run_id: extractionRunId,
          parser_version: input.parserVersion,
          rows_attempted: lineageRows.length,
          observations_inserted: inserted,
          relations: [...new Set(lineageRows.map((row) => row.relation))],
          error: error.message,
          error_code: (error as { code?: string }).code ?? null,
        },
      });
    } else {
      lineageInserted = lineageRows.length;
    }
  }

  return { extractionRunId, inserted, lineageInserted, lineageError };
}
