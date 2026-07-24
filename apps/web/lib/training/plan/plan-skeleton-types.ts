/**
 * Contratto L1 — lo scheletro di piano che il coach revisiona (VIRYA rework F1).
 *
 * Fonte: blueprint `docs/virya-rework-blueprint-f1.md` sezione B. Questi tipi
 * modellano ESATTAMENTE le tabelle DB appena migrate (`training_plan`,
 * `training_plan_mesocycle`, `training_plan_week`) nella loro forma "normalizzata":
 * lo scheletro è mesocicli + settimane, mai più il jsonb `phases` deprecato.
 *
 * REGOLA CHIAVE (blueprint B): il vocabolario degli stimoli è SOLO l'enum
 * `AdaptationTarget` — i 14 `adaptation_target` reali di `training_adaptation_rule`.
 * Il contratto persiste SOLO enum, mai testo libero, mai `goal_text` regex. Gli 8
 * chip UI `WeekObjectiveKey` sono una MAPPA di presentazione verso questi enum
 * (vedi `WEEK_OBJECTIVE_KEY_TO_TARGET` nei mapper), non un secondo vocabolario.
 *
 * Questo modulo è di soli tipi + costanti pure: nessun import applicativo, così è
 * bundle-abile anche dentro l'Edge Function di materializzazione (sezione C).
 */

/** Fasi del macrociclo — CHECK identico a `training_plan_mesocycle.phase`. */
export type PlanPhase = "base" | "build" | "refine" | "peak" | "deload" | "second_peak";

/** Stato revisione — CHECK identico a `training_plan.status`. */
export type PlanStatus = "draft" | "approved" | "active" | "archived";

/**
 * Stimolo/adattamento allenante — i 14 valori REALI di
 * `select distinct adaptation_target from training_adaptation_rule`.
 * Unico vocabolario ammesso negli `objectives` di settimana.
 */
export type AdaptationTarget =
  | "hypertrophy_mixed"
  | "hypertrophy_myofibrillar"
  | "hypertrophy_sarcoplasmic"
  | "lactate_clearance"
  | "lactate_tolerance"
  | "max_strength"
  | "mitochondrial_density"
  | "mobility_capacity"
  | "movement_quality"
  | "neuromuscular_adaptation"
  | "power_output"
  | "recovery"
  | "skill_transfer"
  | "vo2_max_support";

/**
 * Elenco runtime dei 14 target — sorgente unica per la validazione difensiva nei
 * mapper (`isAdaptationTarget`). `as const` così il tipo derivato coincide con
 * `AdaptationTarget` e un drift tra i due rompe il typecheck.
 */
export const ADAPTATION_TARGETS = [
  "hypertrophy_mixed",
  "hypertrophy_myofibrillar",
  "hypertrophy_sarcoplasmic",
  "lactate_clearance",
  "lactate_tolerance",
  "max_strength",
  "mitochondrial_density",
  "mobility_capacity",
  "movement_quality",
  "neuromuscular_adaptation",
  "power_output",
  "recovery",
  "skill_transfer",
  "vo2_max_support",
] as const satisfies readonly AdaptationTarget[];

/** Elenco runtime delle 6 fasi — per la validazione difensiva dei mapper. */
export const PLAN_PHASES = [
  "base",
  "build",
  "refine",
  "peak",
  "deload",
  "second_peak",
] as const satisfies readonly PlanPhase[];

/** Elenco runtime dei 4 stati — per la validazione difensiva dei mapper. */
export const PLAN_STATUSES = [
  "draft",
  "approved",
  "active",
  "archived",
] as const satisfies readonly PlanStatus[];

/**
 * Stimoli espliciti della settimana (shape del jsonb `training_plan_week.objectives`,
 * chiavi snake_case identiche in DB). `primary` è lo stimolo dominante; `avoid`
 * rende esplicite le esclusioni (es. `lactate_tolerance` in fase base).
 */
export type WeekStimulus = {
  /** Stimolo dominante della settimana. */
  primary: AdaptationTarget;
  /** Stimolo secondario, o null se la settimana è mono-focus. */
  secondary: AdaptationTarget | null;
  /** Richiami di mantenimento (cap 2 — vedi mapper). */
  maintenance: AdaptationTarget[];
  /** Esclusioni esplicite (stimoli da NON allenare questa settimana). */
  avoid: AdaptationTarget[];
};

/**
 * Ripartizione per famiglia (jsonb `training_plan_week.family_mix`).
 * v1: somma 100. Chiavi DB snake_case `{aerobic_pct, gym_pct}`.
 */
export type WeekFamilyMix = {
  aerobicPct: number;
  gymPct: number;
};

/** Una settimana dello scheletro (riga `training_plan_week` + join mesociclo). */
export type PlanSkeletonWeek = {
  /** `training_plan_week.id`. */
  id: string;
  /** `week_start` (ISO date, lunedì). */
  weekStart: string;
  /** `phase`. */
  phase: PlanPhase;
  /** `week_in_phase`. */
  weekInPhase: number;
  /** `training_plan_mesocycle.seq` risolto via `mesocycle_id`; null se orfana. */
  mesocycleSeq: number | null;
  /** `hours_target`. */
  hoursTarget: number | null;
  /** `budget_tss` — «Carico» (etichetta VIRYA_LOAD_LABEL). */
  loadTarget: number;
  /** `sessions`. */
  sessionsTarget: number;
  /** `objectives` jsonb → stimoli espliciti (default derivato da fase se `'{}'`). */
  stimulus: WeekStimulus;
  /** `family_mix` jsonb → ripartizione famiglia. */
  familyMix: WeekFamilyMix;
  /** `coach_notes`. */
  coachNotes: string | null;
  /**
   * RUNTIME, NON persistito: giorni allenabili (offset 0..6 dal weekStart, 0=lunedì)
   * letti live da `routine_config.week_plan` in materializzazione. Fonte unica: mai
   * uno snapshot che diverge. Il mapper NON lo popola (resta undefined).
   */
  availableDays?: number[];
};

/** Un mesociclo dello scheletro (riga `training_plan_mesocycle`). */
export type PlanSkeletonMesocycle = {
  /** `training_plan_mesocycle.id`. */
  id: string;
  /** `seq` (1-based, ordinale nel piano). */
  seq: number;
  /** `phase`. */
  phase: PlanPhase;
  /** `label` (es. 'Mesociclo 2 · Costruzione'). */
  label: string | null;
  /** `weeks`. */
  weeks: number;
  /** `load_weeks` (ratio carico:scarico). */
  loadWeeks: number;
  /** `deload_weeks`. */
  deloadWeeks: number;
  /** `weekly_tss_target` (seed budget; null = default fase). */
  weeklyTssTarget: number | null;
  /** `sessions_target`. */
  sessionsTarget: number | null;
  /** `objective` (macroObjective). */
  objective: string | null;
  /** `notes`. */
  notes: string | null;
};

/** Scheletro L1 completo (riga `training_plan` + mesocicli + settimane). */
export type PlanSkeleton = {
  /** `training_plan.id`. */
  id: string;
  /** `athlete_id`. */
  athleteId: string;
  /** `name`. */
  name: string | null;
  /** `status`. */
  status: PlanStatus;
  /** `approved_by` (auth user id). */
  approvedBy: string | null;
  /** `approved_at` (ISO). */
  approvedAt: string | null;
  /** `discipline`. */
  discipline: string;
  /** `start_date` (ISO date). */
  startDate: string;
  /** `end_date` (ISO date). */
  endDate: string;
  /** `goal_event_date` (ancora del taper, da gara A). */
  goalEventDate: string | null;
  /** `training_plan_mesocycle` ordinati per `seq`. */
  mesocycles: PlanSkeletonMesocycle[];
  /** `training_plan_week` ordinate per `week_start`. */
  weeks: PlanSkeletonWeek[];
};
