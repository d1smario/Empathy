/**
 * Tipi e helper condivisi per la gestione del catalogo esercizi admin.
 * Specchio della tabella `public.exercise` (colonne flat + payload jsonb) — zero hardcode di catalogo:
 * gli enum reali arrivano da /api/admin/exercises?meta=1, qui solo i fallback e le etichette UI.
 */

export type ExerciseRow = {
  id: string;
  slug: string | null;
  name: string;
  category: string | null;
  domain: string | null;
  sport_tags: string[];
  movement_pattern: string | null;
  muscle_groups: string[];
  equipment: string[];
  difficulty: string | null;
  primary_system: string | null;
  secondary_systems: string[];
  adaptation_targets: string[];
  energy_system: string | null;
  load_band: string | null;
  lactate_impact: string | null;
  cns_load: string | null;
  coordination: string | null;
  balance: string | null;
  technique: string | null;
  functional_goals: string[];
  metabolic_goals: string[];
  technical_scope: string | null;
  technical_sports: string[];
  technical_tags: string[];
  gym_channels: string[];
  gym_contractions: string[];
  image_url: string | null;
  source: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type ExerciseMeta = {
  domains: string[];
  categories: string[];
  difficulties: string[];
  primarySystems: string[];
  energySystems: string[];
  loadBands: string[];
  levels: string[];
  technicalScopes: string[];
  movementPatterns: string[];
  sources: string[];
  muscleGroups: string[];
  equipment: string[];
  adaptationTargets: string[];
  sportTags: string[];
  domainCounts: Record<string, number>;
  countAll: number;
};

/** Fallback finché il meta reale non è caricato (stessi enum della route API). */
export const FALLBACK_META: ExerciseMeta = {
  domains: ["gym", "endurance", "team_sport", "combat", "mind_body", "crossfit", "hyrox"],
  categories: [
    "strength",
    "accessory",
    "conditioning",
    "skill",
    "gym",
    "endurance",
    "mind_body",
    "combat",
    "team_sport",
    "crossfit",
    "hyrox",
  ],
  difficulties: ["beginner", "intermediate", "advanced"],
  primarySystems: [
    "neuromuscular_strength",
    "neuromuscular_power",
    "neuromuscular_endurance",
    "hypertrophy",
    "anaerobic_lactic",
    "aerobic",
    "stability",
    "coordination",
    "skill",
    "mobility",
  ],
  energySystems: ["aerobic", "mixed", "anaerobic_alactic", "anaerobic_lactic"],
  loadBands: ["low", "moderate", "high", "very_high"],
  levels: ["low", "medium", "high"],
  technicalScopes: ["generic", "sport_specific"],
  movementPatterns: [],
  sources: [],
  muscleGroups: [],
  equipment: [],
  adaptationTargets: [],
  sportTags: [],
  domainCounts: {},
  countAll: 0,
};

/** Etichette italiane per i domini noti; fallback al valore grezzo per quelli nuovi. */
export const DOMAIN_LABEL: Record<string, string> = {
  gym: "Gym",
  endurance: "Endurance",
  team_sport: "Sport di squadra",
  combat: "Combat",
  mind_body: "Mind & Body",
  crossfit: "CrossFit",
  hyrox: "Hyrox",
};

export function domainLabel(domain: string): string {
  return DOMAIN_LABEL[domain] ?? domain;
}

export const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: "Base",
  intermediate: "Intermedio",
  advanced: "Avanzato",
};

/** Classi badge difficoltà (design system Console v2: beginner=emerald, intermediate=amber, advanced=rose). */
export const DIFFICULTY_PILL: Record<string, string> = {
  beginner: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  intermediate: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  advanced: "border-rose-400/30 bg-rose-400/10 text-rose-300",
};

/** Badge dominio (Console v2): un colore per dominio, fallback zinc per domini nuovi. */
export const DOMAIN_PILL: Record<string, string> = {
  gym: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  endurance: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  team_sport: "border-orange-400/30 bg-orange-400/10 text-orange-300",
  combat: "border-red-400/30 bg-red-400/10 text-red-300",
  mind_body: "border-teal-400/30 bg-teal-400/10 text-teal-300",
  crossfit: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  hyrox: "border-pink-400/30 bg-pink-400/10 text-pink-300",
};

export const DOMAIN_PILL_FALLBACK = "border-white/15 bg-white/5 text-zinc-300";

export function domainPillClass(domain: string): string {
  return DOMAIN_PILL[domain] ?? DOMAIN_PILL_FALLBACK;
}

/** id = slug minuscolo: a-z, 0-9, `-` e `_`, 2-80 caratteri (specchio della route API). */
export const EXERCISE_SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,79}$/;
