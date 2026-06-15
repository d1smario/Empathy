import type { HealthPanelTimelineRow } from "@/modules/health/services/health-module-api";

/** Build produzione: niente KPI / grafici riempiti con serie demo quando mancano referti. */
export const SHOW_HEALTH_DEMO_FALLBACK_DATA = process.env.NODE_ENV !== "production";

export const DEMO_INFLAMMATION_RADAR = [
  { subject: "PCR-us", A: 78, fullMark: 100 },
  { subject: "IL-6", A: 72, fullMark: 100 },
  { subject: "TNF-α", A: 68, fullMark: 100 },
  { subject: "Omocisteina", A: 74, fullMark: 100 },
  { subject: "LDL-ox", A: 70, fullMark: 100 },
];

export const DEMO_MICROBIOTA_RADAR = [
  { subject: "Firmicutes", A: 44, fullMark: 100 },
  { subject: "Bacteroidetes", A: 38, fullMark: 100 },
  { subject: "Proteobacteria", A: 8, fullMark: 100 },
  { subject: "Actinobacteria", A: 6, fullMark: 100 },
  { subject: "Diversità", A: 72, fullMark: 100 },
];

export const DEMO_HORMONES_BAR = [
  { name: "Cortisolo AM", val: 16 },
  { name: "Cortisolo PM", val: 11 },
  { name: "Testosterone", val: 520 },
  { name: "TSH", val: 1.6 },
  { name: "T3 libera", val: 3.9 },
  { name: "T4 libera", val: 1.2 },
];

export const DEMO_BLOOD_TREND = [
  { label: "Ott 2025", emoglobina: 15.2, ferritina: 78, vit_d: 32, b12: 380, glicemia: 88 },
  { label: "Nov 2025", emoglobina: 15.8, ferritina: 82, vit_d: 38, b12: 400, glicemia: 86 },
  { label: "Dic 2025", emoglobina: 16.1, ferritina: 90, vit_d: 42, b12: 430, glicemia: 85 },
  { label: "Gen 2026", emoglobina: 16.3, ferritina: 95, vit_d: 45, b12: 450, glicemia: 84 },
  { label: "Feb 2026", emoglobina: 16.4, ferritina: 97, vit_d: 47, b12: 465, glicemia: 83 },
  { label: "Mar 2026", emoglobina: 16.5, ferritina: 98, vit_d: 48, b12: 470, glicemia: 83 },
];

export const EPIGENETIC_RINGS = [
  { name: "Metilazione", value: 85, fill: "#a855f7" },
  { name: "Età biologica", value: 72, fill: "#ec4899" },
  { name: "Stress oss.", value: 65, fill: "#f97316" },
  { name: "Detox", value: 78, fill: "#22c55e" },
  { name: "Riparazione", value: 88, fill: "#3b82f6" },
];

/** Radar “pathway” epigenetici (0–100, score qualitativo). */
export const DEMO_EPIGENETIC_RADAR = [
  { subject: "Metilazione", A: 82, fullMark: 100 },
  { subject: "Longevità", A: 76, fullMark: 100 },
  { subject: "Infiamm. cronica", A: 71, fullMark: 100 },
  { subject: "Detox genico", A: 79, fullMark: 100 },
  { subject: "Riparazione DNA", A: 86, fullMark: 100 },
];

export const DEMO_EPIGENETIC_TREND = [
  { label: "Set", metilazione: 78, detox: 72, riparazione: 84 },
  { label: "Ott", metilazione: 80, detox: 74, riparazione: 85 },
  { label: "Nov", metilazione: 81, detox: 76, riparazione: 86 },
  { label: "Dic", metilazione: 83, detox: 77, riparazione: 87 },
  { label: "Gen", metilazione: 84, detox: 78, riparazione: 87 },
  { label: "Feb", metilazione: 85, detox: 78, riparazione: 88 },
];

/** Stress ossidativo — assi da referto (d-ROMs, BAP, glutatione, …). */
export const DEMO_OXIDATIVE_RADAR = [
  { subject: "d-ROMs ↓", A: 68, fullMark: 100 },
  { subject: "BAP ↑", A: 74, fullMark: 100 },
  { subject: "Glutatione", A: 70, fullMark: 100 },
  { subject: "SOD", A: 72, fullMark: 100 },
  { subject: "Catalasi", A: 69, fullMark: 100 },
];

/** Equilibrio endocrino (assi funzionali, 0–100). */
export const DEMO_ENDOCRINE_RADAR = [
  { subject: "Asse HPA", A: 73, fullMark: 100 },
  { subject: "Asse HPG", A: 78, fullMark: 100 },
  { subject: "Tiroide", A: 81, fullMark: 100 },
  { subject: "Surreni / DHEA", A: 75, fullMark: 100 },
  { subject: "GH / IGF-1", A: 71, fullMark: 100 },
];

export function coerceFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(String(v).replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Legge un numero da `panel.values` con la stessa pipe per:
 *  1. campi piatti canonici (es. `crp_mg_l: 1.2`) post-conferma o seed
 *  2. fallback su `vlm_proposals[]` quando il panel ha proposte VLM
 *     non ancora confermate (campo + valore + unità). Le card e i grafici
 *     popolano i numeri "shadow" senza mai scrivere in DB: la conferma
 *     resta esplicita in /health/staging/<id> e promuove la proposta a
 *     valore canonico in `values.<field>`.
 */
export function readNum(obj: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!obj) return null;
  for (const k of keys) {
    const direct = coerceFiniteNumber(obj[k]);
    if (direct != null) return direct;
  }
  const proposals = obj.vlm_proposals;
  if (Array.isArray(proposals)) {
    for (const k of keys) {
      for (const p of proposals) {
        if (!p || typeof p !== "object" || Array.isArray(p)) continue;
        const rec = p as Record<string, unknown>;
        if (rec.field === k) {
          const n = coerceFiniteNumber(rec.value);
          if (n != null) return n;
        }
      }
    }
  }
  return null;
}

export function sortPanelsNewestFirst(list: HealthPanelTimelineRow[]): HealthPanelTimelineRow[] {
  return [...list].sort((a, b) => {
    const da = `${a.sample_date ?? ""}\t${a.created_at ?? ""}`;
    const db = `${b.sample_date ?? ""}\t${b.created_at ?? ""}`;
    return db.localeCompare(da);
  });
}

export function humanizePayloadKey(key: string): string {
  if (!key.trim()) return key;
  const spaced = key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatScalarForDisplay(val: unknown): string {
  if (val == null) return "—";
  if (typeof val === "number" && Number.isFinite(val))
    return String(val).includes(".") ? String(val) : String(val);
  if (typeof val === "boolean") return val ? "Sì" : "No";
  if (typeof val === "string") {
    const t = val.trim();
    return t.length ? t : "—";
  }
  if (typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch {
      return "—";
    }
  }
  return String(val);
}

export function panelRawDisplayRows(
  panel: HealthPanelTimelineRow,
): Array<{ key: string; label: string; value: string }> {
  const v = panel.values;
  if (!v || typeof v !== "object") return [];
  const rec = v as Record<string, unknown>;
  const flat = Object.keys(rec)
    .filter((k) => k !== "import" && k !== "vlm_proposals" && k !== "vlm_pending_validation")
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({
      key,
      label: humanizePayloadKey(key),
      value: formatScalarForDisplay(rec[key]),
    }));
  const proposals = rec.vlm_proposals;
  if (!Array.isArray(proposals) || proposals.length === 0) return flat;
  // Append VLM proposals as virtual rows (clearly tagged) so the inline "Apri"
  // toggle and the cards above stay coherent: same data, single panel.values.
  const seenFields = new Set(flat.map((r) => r.key));
  const proposed = proposals
    .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === "object" && !Array.isArray(p))
    .map((p) => {
      const field = typeof p.field === "string" ? p.field : "";
      const unit = typeof p.unit === "string" && p.unit.trim() ? ` ${p.unit}` : "";
      return {
        key: field || `proposal_${Math.random().toString(36).slice(2, 8)}`,
        label: `${humanizePayloadKey(field || "—")} · proposto`,
        value: `${formatScalarForDisplay(p.value)}${unit}`,
      };
    })
    .filter((r) => !seenFields.has(r.key));
  return [...flat, ...proposed];
}

/** Più basso è il marker infiammatorio, più alto è lo score (0–100, euristica). */
export function inflammationAxisScore(value: number | null, refHigh: number, demo: number): number {
  if (value == null) return demo;
  const ratio = value / refHigh;
  return Math.max(8, Math.min(100, 100 - ratio * 85));
}

export function capPercentDisplay(value: number | null, demo: number): number {
  if (value == null) return demo;
  return Math.max(0, Math.min(100, value));
}

export function inflammationRadarFromPanel(panel: HealthPanelTimelineRow | undefined) {
  const v = (panel?.values as Record<string, unknown> | null) ?? null;
  const crp = readNum(v, ["crp_mg_l", "crp", "pcr", "pcr_us", "hs_crp", "hs-crp", "c_reactive_protein"]);
  const il6 = readNum(v, ["il6", "il_6", "interleukin_6"]);
  const tnf = readNum(v, ["tnf_alpha", "tnf", "tnfa"]);
  const hcy = readNum(v, ["homocysteine", "omocisteina"]);
  const ox = readNum(v, ["oxidized_ldl", "ldl_ox", "ldl_oxidized", "ox_ldl"]);
  const hasAny = [crp, il6, tnf, hcy, ox].some((x) => x != null);
  const d = DEMO_INFLAMMATION_RADAR;
  if (!hasAny) {
    return SHOW_HEALTH_DEMO_FALLBACK_DATA ? { rows: d, isDemo: true as const } : { rows: [], isDemo: false as const };
  }
  return {
    rows: [
      { subject: "PCR-us", A: inflammationAxisScore(crp, 5, d[0].A), fullMark: 100 },
      { subject: "IL-6", A: inflammationAxisScore(il6, 10, d[1].A), fullMark: 100 },
      { subject: "TNF-α", A: inflammationAxisScore(tnf, 25, d[2].A), fullMark: 100 },
      { subject: "Omocisteina", A: inflammationAxisScore(hcy, 20, d[3].A), fullMark: 100 },
      { subject: "LDL-ox", A: inflammationAxisScore(ox, 80, d[4].A), fullMark: 100 },
    ],
    isDemo: false as const,
  };
}

export function microbiotaRadarFromPanel(panel: HealthPanelTimelineRow | undefined) {
  const v = (panel?.values as Record<string, unknown> | null) ?? null;
  const f = readNum(v, ["firmicutes_pct", "firmicutes", "firmicutes_phylum", "phylum_firmicutes"]);
  const b = readNum(v, ["bacteroidetes_pct", "bacteroidetes", "bacteroidetes_phylum", "phylum_bacteroidetes"]);
  const p = readNum(v, ["proteobacteria_pct", "proteobacteria", "proteobacteria_phylum", "phylum_proteobacteria"]);
  const a = readNum(v, ["actinobacteria_pct", "actinobacteria", "actinobacteria_phylum", "phylum_actinobacteria"]);
  const div = readNum(v, [
    "diversity_shannon",
    "diversity",
    "alpha_diversity",
    "shannon",
    "shannon_index",
    "diversita_shannon",
  ]);
  const hasAny = [f, b, p, a, div].some((x) => x != null);
  const d = DEMO_MICROBIOTA_RADAR;
  if (!hasAny) {
    return SHOW_HEALTH_DEMO_FALLBACK_DATA ? { rows: d, isDemo: true as const } : { rows: [], isDemo: false as const };
  }
  const divScore = div != null ? Math.max(0, Math.min(100, (div / 4.5) * 100)) : d[4].A;
  return {
    rows: [
      { subject: "Firmicutes", A: capPercentDisplay(f, d[0].A), fullMark: 100 },
      { subject: "Bacteroidetes", A: capPercentDisplay(b, d[1].A), fullMark: 100 },
      { subject: "Proteobacteria", A: capPercentDisplay(p, d[2].A), fullMark: 100 },
      { subject: "Actinobacteria", A: capPercentDisplay(a, d[3].A), fullMark: 100 },
      { subject: "Diversità", A: divScore, fullMark: 100 },
    ],
    isDemo: false as const,
  };
}

export function hormonesBarFromPanel(panel: HealthPanelTimelineRow | undefined) {
  const v = (panel?.values as Record<string, unknown> | null) ?? null;
  const am = readNum(v, [
    "cortisol_am",
    "cortisol_morning",
    "cortisolo_am",
    "cortisolo_mattina",
    "cortisol_ug_dl",
    "cortisol",
    "cortisolo",
  ]);
  const pm = readNum(v, ["cortisol_pm", "cortisol_evening", "cortisolo_pm", "cortisolo_sera"]);
  const tt = readNum(v, ["testosterone", "testosterone_total", "testosterone_totale", "testosterone_ng_dl"]);
  const tsh = readNum(v, ["tsh", "tsh_miu_l"]);
  const t3 = readNum(v, ["ft3", "t3_free", "t3_libero", "t3_libera", "t3", "free_t3_pg_ml"]);
  const t4 = readNum(v, ["ft4", "t4_free", "t4_libero", "t4_libera", "t4", "free_t4_ng_dl"]);
  const d = DEMO_HORMONES_BAR;
  const hasAny = [am, pm, tt, tsh, t3, t4].some((x) => x != null);
  if (!hasAny)
    return SHOW_HEALTH_DEMO_FALLBACK_DATA ? { rows: d, isDemo: true as const } : { rows: [], isDemo: false as const };
  return {
    rows: [
      { name: "Cortisolo AM", val: am ?? d[0].val },
      { name: "Cortisolo PM", val: pm ?? d[1].val },
      { name: "Testosterone", val: tt ?? d[2].val },
      { name: "TSH", val: tsh ?? d[3].val },
      { name: "T3 libera", val: t3 ?? d[4].val },
      { name: "T4 libera", val: t4 ?? d[5].val },
    ],
    isDemo: false as const,
  };
}

export function biologicalAgeRingScore(deltaYears: number | null, demo: number): number {
  if (deltaYears == null) return demo;
  return Math.max(12, Math.min(100, 100 - Math.abs(deltaYears) * 9));
}

export function epigeneticRingsFromPanel(
  panel: HealthPanelTimelineRow | undefined,
): Array<{ name: string; value: number; fill: string }> {
  const missingPanel = !panel?.values || typeof panel.values !== "object";
  if (missingPanel && !SHOW_HEALTH_DEMO_FALLBACK_DATA) {
    return [];
  }
  const v = (panel?.values as Record<string, unknown> | null) ?? null;
  const meth = readNum(v, [
    "methylation_score",
    "metilazione",
    "methylation",
    "score_metilazione",
    "metilazione_score",
    "metabolic_methylation_score",
    "inflammation_methylation_index",
  ]);
  const directDelta = readNum(v, [
    "biological_age_delta",
    "epigenetic_age_delta",
    "eta_bio_vs_crono",
    "age_delta_years",
    "gap_anni",
  ]);
  const epiAge = readNum(v, ["epigenetic_age_years", "biological_age_years", "eta_biologica"]);
  const chronoAge = readNum(v, ["chronological_age_years", "age_years", "eta_cronologica"]);
  const delta = directDelta ?? (epiAge != null && chronoAge != null ? Number((epiAge - chronoAge).toFixed(2)) : null);
  const ox = readNum(v, ["epigenetic_oxidative_stress", "stress_oss_epigenetico", "oxidative_epigenetic", "oxidative_methylation"]);
  const detox = readNum(v, ["epigenetic_detox", "detox_score", "detox_epigenetico"]);
  const repair = readNum(v, [
    "epigenetic_repair",
    "repair_score",
    "dna_repair",
    "dna_repair_score",
    "mitochondrial_resilience_index",
  ]);
  return EPIGENETIC_RINGS.map((r) => {
    if (r.name === "Metilazione") return { ...r, value: Math.round(capPercentDisplay(meth, r.value)) };
    if (r.name === "Età biologica") return { ...r, value: Math.round(biologicalAgeRingScore(delta, r.value)) };
    if (r.name === "Stress oss.") return { ...r, value: Math.round(capPercentDisplay(ox, r.value)) };
    if (r.name === "Detox") return { ...r, value: Math.round(capPercentDisplay(detox, r.value)) };
    if (r.name === "Riparazione") return { ...r, value: Math.round(capPercentDisplay(repair, r.value)) };
    return r;
  });
}

export function epigeneticRadarFromPanel(panel: HealthPanelTimelineRow | undefined) {
  const rings = epigeneticRingsFromPanel(panel);
  const v = (panel?.values as Record<string, unknown> | null) ?? null;
  const epiAge = readNum(v, ["epigenetic_age_years", "biological_age_years", "eta_biologica"]);
  const chronoAge = readNum(v, ["chronological_age_years", "age_years", "eta_cronologica"]);
  const hasNumeric = [
    readNum(v, [
      "methylation_score",
      "metilazione",
      "methylation",
      "metilazione_score",
      "metabolic_methylation_score",
      "inflammation_methylation_index",
    ]),
    readNum(v, ["biological_age_delta", "epigenetic_age_delta", "gap_anni"]) ??
      (epiAge != null && chronoAge != null ? epiAge - chronoAge : null),
    readNum(v, ["epigenetic_oxidative_stress", "stress_oss_epigenetico", "oxidative_methylation"]),
    readNum(v, ["epigenetic_detox", "detox_score"]),
    readNum(v, ["epigenetic_repair", "repair_score", "dna_repair_score", "mitochondrial_resilience_index"]),
  ].some((x) => x != null);
  const d = DEMO_EPIGENETIC_RADAR;
  if (!hasNumeric) {
    return SHOW_HEALTH_DEMO_FALLBACK_DATA ? { rows: d, isDemo: true as const } : { rows: [], isDemo: false as const };
  }
  const subjects = ["Metilazione", "Longevità", "Infiamm. cronica", "Detox genico", "Riparazione DNA"];
  return {
    rows: rings.map((r, i) => ({
      subject: subjects[i] ?? r.name,
      A: capPercentDisplay(r.value, d[i]?.A ?? 72),
      fullMark: 100,
    })),
    isDemo: false as const,
  };
}

export function rowFromEpigeneticTrendPanel(panel: HealthPanelTimelineRow): {
  label: string;
  metilazione: number | null;
  detox: number | null;
  riparazione: number | null;
} | null {
  const v = panel.values;
  if (!v || typeof v !== "object") return null;
  const rec = v as Record<string, unknown>;
  const metilazione = readNum(rec, [
    "methylation_score",
    "metilazione",
    "methylation",
    "metilazione_score",
    "metabolic_methylation_score",
    "inflammation_methylation_index",
  ]);
  const detox = readNum(rec, ["epigenetic_detox", "detox_score"]);
  const riparazione = readNum(rec, [
    "epigenetic_repair",
    "repair_score",
    "dna_repair_score",
    "mitochondrial_resilience_index",
  ]);
  if (metilazione == null && detox == null && riparazione == null) return null;
  const label = panel.sample_date
    ? new Date(panel.sample_date).toLocaleDateString("it-IT", { month: "short", year: "2-digit" })
    : (panel.created_at?.slice(0, 7) ?? "n/d");
  return { label, metilazione, detox, riparazione };
}

/** d-ROMs più basso = migliore (score alto). */
export function oxidativeRomsScore(val: number | null, demo: number): number {
  if (val == null) return demo;
  return Math.max(10, Math.min(100, 100 - val * 2.2));
}

export function oxidativeBapScore(val: number | null, demo: number): number {
  if (val == null) return demo;
  return Math.max(15, Math.min(100, (val / 3500) * 100));
}

export function oxidativeStressRadarFromPanel(panel: HealthPanelTimelineRow | undefined) {
  const v = (panel?.values as Record<string, unknown> | null) ?? null;
  const roms = readNum(v, ["d_roms", "roms_carr", "roms", "d_rom"]);
  const bap = readNum(v, ["bap", "bap_umol", "bap_score", "bap_uM"]);
  const gsh = readNum(v, ["glutathione", "glutatione", "gsh", "glutatione_ridotto"]);
  const sod = readNum(v, ["sod", "superoxide_dismutase"]);
  const cat = readNum(v, ["catalase", "catalasi"]);
  const hasAny = [roms, bap, gsh, sod, cat].some((x) => x != null);
  const d = DEMO_OXIDATIVE_RADAR;
  if (!hasAny) {
    return SHOW_HEALTH_DEMO_FALLBACK_DATA ? { rows: d, isDemo: true as const } : { rows: [], isDemo: false as const };
  }
  return {
    rows: [
      { subject: "d-ROMs ↓", A: oxidativeRomsScore(roms, d[0].A), fullMark: 100 },
      { subject: "BAP ↑", A: oxidativeBapScore(bap, d[1].A), fullMark: 100 },
      { subject: "Glutatione", A: capPercentDisplay(gsh, d[2].A), fullMark: 100 },
      { subject: "SOD", A: capPercentDisplay(sod, d[3].A), fullMark: 100 },
      { subject: "Catalasi", A: capPercentDisplay(cat, d[4].A), fullMark: 100 },
    ],
    isDemo: false as const,
  };
}

export function hpaAxisScore(am: number | null, pm: number | null, demo: number): number {
  if (am == null && pm == null) return demo;
  const base = am ?? pm ?? 12;
  const dist = Math.abs(base - 14);
  return Math.max(22, Math.min(100, 100 - dist * 5));
}

export function hpgAxisScore(testNgDl: number | null, demo: number): number {
  if (testNgDl == null) return demo;
  if (testNgDl < 200) return 38;
  if (testNgDl > 1000) return 78;
  return Math.min(100, 48 + (testNgDl - 200) / 25);
}

export function thyroidAxisScore(tsh: number | null, demo: number): number {
  if (tsh == null) return demo;
  const dist = Math.abs(tsh - 1.4);
  return Math.max(20, Math.min(100, 100 - dist * 28));
}

export function dheaAxisScore(dhea: number | null, demo: number): number {
  if (dhea == null) return demo;
  return Math.max(18, Math.min(100, (dhea / 350) * 100));
}

export function igfAxisScore(igf: number | null, demo: number): number {
  if (igf == null) return demo;
  return Math.max(20, Math.min(100, (igf / 280) * 100));
}

export function endocrineRadarFromPanel(panel: HealthPanelTimelineRow | undefined) {
  const v = (panel?.values as Record<string, unknown> | null) ?? null;
  const am = readNum(v, [
    "cortisol_am",
    "cortisol_morning",
    "cortisolo_am",
    "cortisolo_mattina",
    "cortisol_ug_dl",
    "cortisol",
    "cortisolo",
  ]);
  const pm = readNum(v, ["cortisol_pm", "cortisol_evening", "cortisolo_pm", "cortisolo_sera"]);
  const tt = readNum(v, ["testosterone", "testosterone_total", "testosterone_totale", "testosterone_ng_dl"]);
  const tsh = readNum(v, ["tsh", "tsh_miu_l"]);
  const dhea = readNum(v, ["dhea_s", "dhea", "dehydroepiandrosterone", "dhea_s_ug_dl"]);
  const igf = readNum(v, ["igf1", "igf_1", "igf-1", "insulin_like_growth_factor_1"]);
  const hasAny = [am, pm, tt, tsh, dhea, igf].some((x) => x != null);
  const d = DEMO_ENDOCRINE_RADAR;
  if (!hasAny) {
    return SHOW_HEALTH_DEMO_FALLBACK_DATA ? { rows: d, isDemo: true as const } : { rows: [], isDemo: false as const };
  }
  return {
    rows: [
      { subject: "Asse HPA", A: hpaAxisScore(am, pm, d[0].A), fullMark: 100 },
      { subject: "Asse HPG", A: hpgAxisScore(tt, d[1].A), fullMark: 100 },
      { subject: "Tiroide", A: thyroidAxisScore(tsh, d[2].A), fullMark: 100 },
      { subject: "Surreni / DHEA", A: dheaAxisScore(dhea, d[3].A), fullMark: 100 },
      { subject: "GH / IGF-1", A: igfAxisScore(igf, d[4].A), fullMark: 100 },
    ],
    isDemo: false as const,
  };
}

export function isHormonePanelType(type: string | null | undefined): boolean {
  if (!type) return false;
  const t = type.trim().toLowerCase();
  return t === "hormones" || t === "hormonal" || t === "hormone";
}

export function structuredValuesFieldCount(values: Record<string, unknown> | null | undefined): number {
  if (!values || typeof values !== "object") return 0;
  const flat = Object.keys(values).filter(
    (k) => k !== "import" && k !== "vlm_proposals" && k !== "vlm_pending_validation",
  ).length;
  const proposals = (values as Record<string, unknown>).vlm_proposals;
  const proposed = Array.isArray(proposals) ? proposals.length : 0;
  return flat + proposed;
}

export type BloodPanelRow = {
  label: string;
  emoglobina: number | null;
  ferritina: number | null;
  vit_d: number | null;
  b12: number | null;
  glicemia: number | null;
};

export function rowFromBloodPanel(panel: HealthPanelTimelineRow): BloodPanelRow | null {
  const v = panel.values;
  if (!v || typeof v !== "object") return null;
  const rec = v as Record<string, unknown>;
  const emoglobina = readNum(rec, ["hb", "hemoglobin", "emoglobina", "hb_g_dl"]);
  const ferritina = readNum(rec, ["ferritin", "ferritina", "ferritina_ng_ml"]);
  const vit_d = readNum(rec, ["vit_d", "vitamin_d", "vitamina_d", "25_oh_d", "vitamina_d_25oh", "vitamin_d_25oh"]);
  const b12 = readNum(rec, ["b12", "vit_b12", "cobalamin", "vitamina_b12"]);
  const glicemiaMgDl = readNum(rec, ["glucose", "glicemia", "glucosio", "fasting_glucose_mg_dl", "blood_glucose"]);
  const glicemiaMmol = readNum(rec, ["glucose_mmol_l", "glucose_mmol", "glycemia_mmol_l"]);
  const glicemia = glicemiaMgDl ?? (glicemiaMmol != null ? Number((glicemiaMmol * 18.0182).toFixed(1)) : null);
  if (emoglobina == null && ferritina == null && vit_d == null && b12 == null && glicemia == null) return null;
  const label = panel.sample_date
    ? new Date(panel.sample_date).toLocaleDateString("it-IT", { month: "short", year: "numeric" })
    : (panel.created_at?.slice(0, 7) ?? "n/d");
  return { label, emoglobina, ferritina, vit_d, b12, glicemia };
}
