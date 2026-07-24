/**
 * MOTORE L2 «builder» (VIRYA rework F3, blueprint sezione C): trasforma UNA
 * settimana dello scheletro L1 (già revisionata/approvata dal coach) in righe
 * `planned_workouts` col contratto Pro2 del Builder — per costruzione
 * indistinguibili da una seduta costruita a mano in Calendario/Oggi/Nutrizione.
 *
 * PRINCIPI (non negoziabili):
 * - Funzione PURA: config VIRYA (tabelle `virya_*`), profilo render REALE
 *   (FTP/soglie misurate) e cataloghi arrivano come INPUT dai loader — mai la
 *   copia hardcoded client, mai un default 250 W silenzioso nelle kcal.
 * - CONSUMA gli edit coach dello scheletro: objectives (stimoli enum),
 *   hours_target/budget_tss/sessions della riga `training_plan_week`, giorni
 *   disponibili dalla routine. I giorni dichiarati VINCONO sul pattern: mai più
 *   6 sedute a chi ne ha dichiarate 3.
 * - `type` per-family STABILE (blueprint C): `pro2_builder_aerobic` /
 *   `pro2_builder_strength` — il path `pro2_builder_${physiologicalTarget}` del
 *   motore engine NON si usa, altrimenti il replace per-type non matcha.
 * - notes = metaLine `[PRO2_BUILDER_PLAN]{…}` + contratto serializzato, SEMPRE
 *   attraverso `buildPlannedNotesWithSizeGuard`: comprimere-poi-fallire, mai
 *   troncare (un JSON a metà è corruzione silenziosa).
 * - Max 1 slot per famiglia per giorno: violazione = errore esplicito per quel
 *   giorno, MAI replace silenzioso (blueprint F11).
 *
 * Stessa funzione importata dal ramo in-process di `materializeTrainingMacro` e
 * dalla futura Edge Function `materialize-training-week` (bundle esbuild): il
 * motore È il contratto, i runtime cambiano solo il trasporto.
 */

import type {
  Pro2BuilderSessionContract,
} from "@/lib/training/builder/pro2-session-contract";
import { buildPro2GymRowsCatalogOnly } from "@/lib/training/builder/build-pro2-gym-rows-from-engine";
import { buildPro2GymSchedaSessionContract } from "@/lib/training/builder/pro2-gym-manual-plan";
import { disciplineToBlock1SportTag } from "@/lib/training/domain-blocks/block1-strength-functional";
import type { AdaptationTarget as EngineAdaptationTarget } from "@/lib/training/engine/types";
import {
  DEFAULT_STARTER_RENDER,
  buildStarterContractFromPreset,
  type AerobicStarterPreset,
} from "@/lib/training/library/starter-pack-aerobic-helpers";
import type { PlannedWorkoutInsertPayload } from "@/lib/training/planned/clamp-planned-row";
import { buildPlannedNotesWithSizeGuard } from "@/lib/training/planned/notes-size-guard";
import { WEEK_OBJECTIVE_KEY_TO_TARGET } from "@/lib/training/plan/plan-skeleton-mappers";
import type {
  AdaptationTarget,
  PlanPhase,
  WeekFamilyMix,
  WeekStimulus,
} from "@/lib/training/plan/plan-skeleton-types";
import {
  deriveViryaBuilderInstructions,
  gymDurationMinutesForBrief,
  kcalFromLoadTarget,
  type ViryaDerivedBuilderInstructions,
} from "@/lib/training/virya/derive-virya-builder-instructions";
import { scaleCatalogContractForViryaSlot } from "@/lib/training/virya/materialize-virya-aerobic-from-catalog";
import type {
  ViryaBuilderSessionBrief,
  ViryaSessionRole,
  ViryaWeekdayPatternId,
} from "@/lib/training/virya/virya-builder-session-brief";
import { viryaDisciplineToCatalogDiscipline } from "@/lib/training/virya/virya-catalog-discipline";
import { resolveViryaCatalogPreset } from "@/lib/training/virya/virya-catalog-preset-resolver";
import { normalizeWeeklyLoad } from "@/lib/training/virya/virya-load-normalize";
import type { AthleteRenderContext } from "@/lib/training/l2/athlete-render-profile";
import type { ViryaDbConfig } from "@/lib/training/l2/virya-db-config";
import type { BuilderCatalogExerciseRow } from "@/modules/training/services/training-builder-catalog-api";

/* ── contratto pubblico ── */

/** Prefisso metaLine notes delle righe L2 (blueprint C). */
export const PRO2_BUILDER_PLAN_NOTES_PREFIX = "[PRO2_BUILDER_PLAN]";

/** Type canonico STABILE per-family (blueprint C, deciso). v1: aerobic + gym. */
export const PRO2_BUILDER_PLAN_TYPE_BY_FAMILY = {
  aerobic: "pro2_builder_aerobic",
  strength: "pro2_builder_strength",
} as const;

export type BuilderEngineFamily = keyof typeof PRO2_BUILDER_PLAN_TYPE_BY_FAMILY;

/** Settimana scheletro L1 come la vede il motore (riga `training_plan_week` + routine). */
export type BuilderEngineSkeletonWeek = {
  weekStart: string; // ISO, lunedì
  phase: PlanPhase;
  /** budget_tss — eventualmente già rifinito dal coach. */
  loadTarget: number;
  /** sessions — eventualmente già rifinito dal coach. */
  sessionsTarget: number;
  /**
   * hours_target: monte-ore settimanale editato dal coach nel pannello revisione.
   * CONSUMATO dal motore: le durate delle sedute vengono scalate perché la somma
   * si avvicini a hoursTarget*60 (clamp di sicurezza 0.5–1.6, poi cap per-seduta
   * maxSessionMinutes). null → durate naturali della catena.
   */
  hoursTarget: number | null;
  /** objectives jsonb → stimoli espliciti (contratto L1). */
  stimulus: WeekStimulus;
  /** family_mix jsonb → quota famiglie. */
  familyMix: WeekFamilyMix;
  /** Giorni allenabili dalla routine (offset 0..6, 0=lunedì). Vuoto = routine non compilata. */
  availableDays: number[];
};

export type BuilderEngineSlot = {
  slotSeq: number;
  dayOffset: number;
  date: string;
  role: ViryaSessionRole;
  family: BuilderEngineFamily;
  loadTarget: number;
};

export type BuilderEngineSlotError = { date: string; dayOffset: number; error: string };

export type MaterializeWeekBuilderEngineInput = {
  planId: string;
  athleteId: string;
  discipline: string;
  week: BuilderEngineSkeletonWeek;
  profile: AthleteRenderContext;
  config: ViryaDbConfig;
  catalogs: {
    aerobicPresets: AerobicStarterPreset[];
    gymCatalogRows: BuilderCatalogExerciseRow[];
  };
};

export type MaterializeWeekBuilderEngineResult = {
  rows: PlannedWorkoutInsertPayload[];
  slots: BuilderEngineSlot[];
  errors: BuilderEngineSlotError[];
};

/* ── helper puri ── */

/**
 * Stessa aritmetica UTC di `propose-training-macro.addDaysIso`, ridefinita in
 * locale per NON trascinare quel modulo (e la sua catena publish/RPC) nel
 * bundle Edge Function: qui servono solo 4 righe di calendario.
 */
function addDaysIsoUtc(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function clampInt(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

/** Convenzione chiavi `virya_weekday_pattern.pattern_id` (righe DB verificate: 3d/4d/5d/6d). */
function patternIdForCount(n: number): ViryaWeekdayPatternId {
  if (n <= 3) return "3d";
  if (n === 4) return "4d";
  if (n === 5) return "5d";
  return "6d";
}

/**
 * Mappa inversa presentazione: AdaptationTarget → chip `WeekObjectiveKey`.
 * Derivata a runtime dalla mappa canonica dei mapper L1 (fonte unica, zero
 * seconda tabella): serve perché `pickAerobicSessionArchetype` restringe il pool
 * per chip, mentre il contratto L1 persiste solo enum.
 */
const TARGET_TO_WEEK_OBJECTIVE_CHIP: Partial<Record<AdaptationTarget, string>> = (() => {
  const out: Partial<Record<AdaptationTarget, string>> = {};
  for (const [chip, target] of Object.entries(WEEK_OBJECTIVE_KEY_TO_TARGET)) {
    out[target as AdaptationTarget] = chip;
  }
  return out;
})();

function weekObjectiveChipsFromStimulus(stimulus: WeekStimulus): string[] {
  const targets = [stimulus.primary, stimulus.secondary, ...stimulus.maintenance].filter(
    (t): t is AdaptationTarget => Boolean(t),
  );
  const chips: string[] = [];
  for (const target of targets) {
    const chip = TARGET_TO_WEEK_OBJECTIVE_CHIP[target];
    if (chip && !chips.includes(chip)) chips.push(chip);
  }
  return chips;
}

/* ── distribuzione settimanale (pura, testabile) ── */

function sanitizeAvailableDays(days: readonly number[]): number[] {
  return [...new Set(days.map((d) => Math.round(d)).filter((d) => d >= 0 && d <= 6))].sort(
    (a, b) => a - b,
  );
}

/**
 * Scelta giorni: i giorni DISPONIBILI vincono sempre (se il pattern chiede più
 * giorni di quelli dichiarati, le sedute si riducono). A parità, si preferiscono
 * i giorni del pattern config; i rimanenti si aggiungono massimizzando la
 * distanza dai già scelti (greedy deterministico) per non ammassare le sedute.
 */
function pickTrainingDays(availableDays: number[], n: number, config: ViryaDbConfig): number[] {
  const pattern = config.weekdayPatterns[patternIdForCount(n)] ?? [];

  if (!availableDays.length) {
    // Routine non compilata: pattern config come default, completato con gli
    // offset mancanti in ordine (mai duplicati → mai due slot lo stesso giorno).
    const out = [...new Set(pattern)].slice(0, n);
    for (let d = 0; d <= 6 && out.length < n; d += 1) {
      if (!out.includes(d)) out.push(d);
    }
    return out.sort((a, b) => a - b);
  }

  if (availableDays.length <= n) return [...availableDays];

  const chosen = availableDays.filter((d) => pattern.includes(d)).slice(0, n);
  const remaining = availableDays.filter((d) => !chosen.includes(d));
  while (chosen.length < n && remaining.length) {
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < remaining.length; i += 1) {
      const d = remaining[i]!;
      const score = chosen.length ? Math.min(...chosen.map((c) => Math.abs(c - d))) : 7;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    chosen.push(remaining.splice(bestIdx, 1)[0]!);
  }
  return chosen.sort((a, b) => a - b);
}

function isSessionRole(v: string): v is ViryaSessionRole {
  return v === "quality" || v === "volume" || v === "recovery";
}

/**
 * Sequenza ruoli dalla tabella `virya_role_sequence` (fonte unica). Fallback se
 * il count non è configurato: alternanza quality/volume (la forma di tutte le
 * sequenze DB). In deload si rimappa come il planner storico (mai quality),
 * ma la SORGENTE resta il DB.
 */
function rolesForWeek(n: number, phase: PlanPhase, config: ViryaDbConfig): ViryaSessionRole[] {
  const fromDb = (config.roleSequences[n] ?? []).filter(isSessionRole);
  const roles: ViryaSessionRole[] =
    fromDb.length >= n
      ? fromDb.slice(0, n)
      : Array.from({ length: n }, (_, i) => (i % 2 === 0 ? "quality" : "volume"));
  if (phase === "deload") {
    return roles.map((_, i) => (i % 2 === 1 ? "recovery" : "volume"));
  }
  return roles;
}

/**
 * Vincolo «mai 2 sedute intense in giorni consecutivi»: se due quality cadono su
 * offset adiacenti, la seconda si scambia col primo ruolo non-quality successivo.
 * Se non esiste (settimana quasi tutta quality) si lascia: meglio rispettare la
 * sequenza config che inventare ruoli.
 */
function spreadQualityRoles(days: number[], roles: ViryaSessionRole[]): ViryaSessionRole[] {
  const out = [...roles];
  for (let i = 1; i < out.length; i += 1) {
    if (out[i] !== "quality" || out[i - 1] !== "quality") continue;
    if ((days[i] ?? 0) - (days[i - 1] ?? 0) !== 1) continue;
    for (let j = i + 1; j < out.length; j += 1) {
      if (out[j] !== "quality") {
        const tmp = out[i]!;
        out[i] = out[j]!;
        out[j] = tmp;
        break;
      }
    }
  }
  return out;
}

function hasAdjacentQuality(days: number[], roles: ViryaSessionRole[]): boolean {
  for (let i = 1; i < roles.length; i += 1) {
    if (roles[i] === "quality" && roles[i - 1] === "quality" && (days[i]! - days[i - 1]!) === 1) {
      return true;
    }
  }
  return false;
}

/** Pesi ruolo×fase dalla tabella `virya_role_weight`; riga mancante → peso neutro 1 (config incompleta, non fatale). */
function distributeLoadFromConfig(
  roles: ViryaSessionRole[],
  phase: PlanPhase,
  budget: number,
  config: ViryaDbConfig,
): number[] {
  if (!roles.length) return [];
  const weights = roles.map((role) => {
    const w = config.roleWeights[`${role}|${phase}`];
    return Number.isFinite(w) && (w as number) > 0 ? (w as number) : 1;
  });
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (Math.max(0, budget) * w) / sumW);
  return normalizeWeeklyLoad(raw.map((x) => Math.max(1, Math.round(x))), budget);
}

/**
 * «Lungo nel weekend se disponibilità»: la seduta volume più carica si sposta su
 * sabato/domenica quando uno dei due è tra i giorni scelti. Lo swap si annulla se
 * creerebbe due quality adiacenti (il vincolo intensità prevale sul comfort).
 */
function moveLongSessionToWeekend(
  days: number[],
  roles: ViryaSessionRole[],
  loads: number[],
): { roles: ViryaSessionRole[]; loads: number[] } {
  const weekendIdx = days.map((d, i) => (d >= 5 ? i : -1)).filter((i) => i >= 0);
  if (!weekendIdx.length) return { roles, loads };

  let longIdx = -1;
  for (let i = 0; i < roles.length; i += 1) {
    if (roles[i] !== "volume") continue;
    if (longIdx === -1 || (loads[i] ?? 0) >= (loads[longIdx] ?? 0)) longIdx = i;
  }
  if (longIdx === -1 || weekendIdx.includes(longIdx)) return { roles, loads };

  const target = weekendIdx[weekendIdx.length - 1]!;
  const nextRoles = [...roles];
  const nextLoads = [...loads];
  [nextRoles[longIdx], nextRoles[target]] = [nextRoles[target]!, nextRoles[longIdx]!];
  [nextLoads[longIdx], nextLoads[target]] = [nextLoads[target]!, nextLoads[longIdx]!];
  if (hasAdjacentQuality(days, nextRoles)) return { roles, loads };
  return { roles: nextRoles, loads: nextLoads };
}

const STRENGTH_LIKE_TARGETS: ReadonlySet<AdaptationTarget> = new Set([
  "max_strength",
  "hypertrophy_mixed",
  "hypertrophy_myofibrillar",
  "hypertrophy_sarcoplasmic",
  "power_output",
  "neuromuscular_adaptation",
]);

/**
 * Assegnazione famiglie per quota `family_mix` (blueprint C): gym prende gli slot
 * quality se lo stimolo primario è strength-like (la seduta chiave È la palestra),
 * altrimenti la coda della settimana (la palestra è complemento).
 */
function assignFamilies(
  slots: Array<{ role: ViryaSessionRole }>,
  familyMix: WeekFamilyMix,
  stimulus: WeekStimulus,
): BuilderEngineFamily[] {
  const n = slots.length;
  const gymPct = clampInt(Number(familyMix.gymPct) || 0, 0, 100);
  const gymCount = clampInt((n * gymPct) / 100, 0, n);
  const families: BuilderEngineFamily[] = Array.from({ length: n }, () => "aerobic");
  if (gymCount <= 0) return families;

  const primaryIsStrength = STRENGTH_LIKE_TARGETS.has(stimulus.primary);
  if (primaryIsStrength) {
    const order = [
      ...slots.map((s, i) => (s.role === "quality" ? i : -1)).filter((i) => i >= 0),
      ...slots.map((s, i) => (s.role !== "quality" ? i : -1)).filter((i) => i >= 0),
    ];
    for (const idx of order.slice(0, gymCount)) families[idx] = "strength";
  } else {
    for (let k = 0; k < gymCount; k += 1) families[n - 1 - k] = "strength";
  }
  return families;
}

/**
 * Distribuzione settimanale pura (esportata per i test): giorni, ruoli, carichi,
 * famiglie. Rispetta giorni disponibili, vincolo quality-consecutive, lungo nel
 * weekend, quota famiglie. Un giorno duplicato (config pattern malformata)
 * produce un ERRORE esplicito per lo slot, mai un replace silenzioso [F11].
 */
export function planBuilderWeekSlots(args: {
  week: BuilderEngineSkeletonWeek;
  config: ViryaDbConfig;
}): { slots: BuilderEngineSlot[]; errors: BuilderEngineSlotError[] } {
  const { week, config } = args;
  const errors: BuilderEngineSlotError[] = [];

  const requested = clampInt(Number(week.sessionsTarget) || 1, 1, 7);
  const available = sanitizeAvailableDays(week.availableDays);
  // I giorni dichiarati VINCONO: mai più sedute dei giorni disponibili.
  const n = available.length ? Math.min(requested, available.length) : requested;

  const days = pickTrainingDays(available, n, config);
  let roles = spreadQualityRoles(days, rolesForWeek(days.length, week.phase, config));
  let loads = distributeLoadFromConfig(roles, week.phase, Math.max(0, Math.round(week.loadTarget)), config);
  ({ roles, loads } = moveLongSessionToWeekend(days, roles, loads));
  const families = assignFamilies(roles.map((role) => ({ role })), week.familyMix, week.stimulus);

  const seenDays = new Set<number>();
  const slots: BuilderEngineSlot[] = [];
  days.forEach((dayOffset, i) => {
    const date = addDaysIsoUtc(week.weekStart, dayOffset);
    if (seenDays.has(dayOffset)) {
      // [F11] assert esplicito: max 1 slot per giorno — il replace per-type di
      // insertSinglePlannedWorkout mangerebbe il primo slot senza traccia.
      errors.push({ date, dayOffset, error: "duplicate_day_slot" });
      return;
    }
    seenDays.add(dayOffset);
    slots.push({
      slotSeq: slots.length,
      dayOffset,
      date,
      role: roles[i] ?? "volume",
      family: families[i] ?? "aerobic",
      loadTarget: loads[i] ?? Math.max(1, Math.round(week.loadTarget / Math.max(1, days.length))),
    });
  });

  return { slots, errors };
}

/* ── materializzazione per-slot ── */

type SlotOutcome =
  | { ok: true; row: PlannedWorkoutInsertPayload }
  | { ok: false; error: string };

function capMinutes(minutes: number, maxSessionMinutes: number | null): number {
  const m = Math.max(20, Math.round(minutes));
  if (maxSessionMinutes != null && maxSessionMinutes >= 20) return Math.min(m, maxSessionMinutes);
  return m;
}

function resolveCatalogDiscipline(discipline: string, config: ViryaDbConfig): string {
  // Fonte unica DB (`virya_discipline_map`) quando curata; fallback alla mappa
  // storica della catena — un'etichetta non mappata non deve rompere la settimana.
  const fromDb = config.disciplineMap?.[discipline.trim().toLowerCase()];
  return fromDb ?? viryaDisciplineToCatalogDiscipline(discipline);
}

function buildRowFromContract(args: {
  input: MaterializeWeekBuilderEngineInput;
  slot: BuilderEngineSlot;
  family: BuilderEngineFamily;
  contract: Pro2BuilderSessionContract;
  fallbackMinutes: number;
}): SlotOutcome {
  const { input, slot, family, contract } = args;
  const metaLine = `${PRO2_BUILDER_PLAN_NOTES_PREFIX}${JSON.stringify({
    v: 1,
    family,
    discipline: contract.discipline,
    sessionName: contract.sessionName,
    planId: input.planId,
    weekStart: input.week.weekStart,
    slotSeq: slot.slotSeq,
  })}`;
  // Guard ≤32k condiviso: comprimere-poi-fallire. Il ramo {ok:false} fa fallire
  // la SINGOLA seduta con errore esplicito nel result, le altre procedono.
  const guarded = buildPlannedNotesWithSizeGuard({ metaLine, contract });
  if (!guarded.ok) return { ok: false, error: "contract_too_large" };

  const kj = contract.summary?.kj;
  return {
    ok: true,
    row: {
      athlete_id: input.athleteId,
      date: slot.date,
      type: PRO2_BUILDER_PLAN_TYPE_BY_FAMILY[family],
      duration_minutes: contract.plannedSessionDurationMinutes ?? args.fallbackMinutes,
      tss_target: Math.max(0, Math.round(contract.summary?.tss ?? slot.loadTarget)),
      kcal_target:
        contract.summary?.kcal != null && Number.isFinite(contract.summary.kcal)
          ? Math.round(contract.summary.kcal)
          : null,
      kj_target: kj != null && Number.isFinite(kj) && kj > 0 ? Math.round(kj) : null,
      plan_id: input.planId,
      notes: guarded.notes,
    },
  };
}

/**
 * Istruzioni aerobiche dallo slot: riusa la catena wizard (`deriveVirya…` →
 * archetipi/prescrizioni), ma con gli stimoli STRUTTURATI L1 come chip e con gli
 * `avoid` onorati in due passate: prima si ruota lo slotIndex DENTRO il pool
 * ristretto dai chip; se quel pool è tutto-escluso (es. chip «anaerobico» in una
 * settimana che vieta lactate_tolerance) si ripete SENZA chip sull'intera lista
 * di fase. Se anche la fase è tutta esclusa vince la config di fase (gli avoid
 * restringono, non azzerano — una settimana senza sedute sarebbe peggio).
 */
function deriveAerobicInstructionsForSlot(args: {
  input: MaterializeWeekBuilderEngineInput;
  slot: BuilderEngineSlot;
  sessionsInWeek: number;
  chips: string[];
}): ViryaDerivedBuilderInstructions {
  const { input, slot, sessionsInWeek, chips } = args;
  const avoid = new Set(input.week.stimulus.avoid);
  let first: ViryaDerivedBuilderInstructions | null = null;
  for (const weekObjectives of [chips, []]) {
    for (let attempt = 0; attempt <= sessionsInWeek + 1; attempt += 1) {
      const brief: ViryaBuilderSessionBrief = {
        version: 1,
        weekStart: input.week.weekStart,
        weekdayOffset: slot.dayOffset,
        slotIndex: slot.slotSeq + attempt,
        sessionsInWeek,
        weeklyBudgetLoad: Math.max(0, Math.round(input.week.loadTarget)),
        loadTarget: slot.loadTarget,
        sessionRole: slot.role,
        phase: input.week.phase,
        family: "aerobic",
        discipline: input.discipline,
        planName: "",
        phaseLabel: input.week.phase,
        sessionName: "",
        weekObjectives,
        weekdayPatternId: patternIdForCount(sessionsInWeek),
      };
      const derived = deriveViryaBuilderInstructions({ brief });
      first ??= derived;
      if (!avoid.has(derived.adaptationTarget as AdaptationTarget)) return derived;
    }
  }
  return first!;
}

function materializeAerobicSlot(
  input: MaterializeWeekBuilderEngineInput,
  slot: BuilderEngineSlot,
  sessionsInWeek: number,
  chips: string[],
  weekScale: number,
): SlotOutcome {
  const derived = deriveAerobicInstructionsForSlot({ input, slot, sessionsInWeek, chips });
  const ftpW = input.profile.renderProfile.ftpW;

  // Ore coach prima, cap profilo poi: la durata naturale della catena viene
  // scalata sul monte-ore settimanale (hours_target del pannello revisione) e
  // SOLO DOPO cappata da training_max_session_minutes. Se la durata cambia, il
  // carico segue in proporzione — un'ora in meno non può costare lo stesso TSS
  // (e un'ora in più deve costarlo).
  const scaledMinutes = Math.max(10, Math.round(derived.sessionMinutes * weekScale));
  const minutes = capMinutes(scaledMinutes, input.profile.maxSessionMinutes);
  const tss =
    minutes !== derived.sessionMinutes
      ? Math.max(10, Math.round(derived.tss * (minutes / Math.max(1, derived.sessionMinutes))))
      : derived.tss;
  const kcal = kcalFromLoadTarget(tss, minutes, ftpW);

  const catalogDiscipline = resolveCatalogDiscipline(input.discipline, input.config);
  const archetypeId = derived.aerobicPrescription?.archetypeId ?? "base_z2_volume";
  const preset = resolveViryaCatalogPreset(
    { archetypeId, discipline: catalogDiscipline, sessionIndexInWeek: slot.slotSeq },
    input.catalogs.aerobicPresets,
    input.config.archetypeRules ?? undefined,
  );
  if (!preset) return { ok: false, error: "aerobic_preset_not_found" };

  const sessionName = preset.title;
  let contract = buildStarterContractFromPreset({
    ...preset,
    title: sessionName,
    discipline: catalogDiscipline,
    phase: input.week.phase,
  });

  // renderProfile REALE PRIMA dello scaling: le metriche (kJ/kcal/avgPower) del
  // contratto finale devono nascere dall'FTP misurato, non dal 250 del preset.
  contract = {
    ...contract,
    renderProfile: {
      ...(contract.renderProfile ?? DEFAULT_STARTER_RENDER),
      ftpW,
      hrMax: input.profile.renderProfile.hrMax,
    },
  };
  contract = scaleCatalogContractForViryaSlot(contract, minutes, tss, kcal);

  const scheduledTime = input.profile.preferredTimeByOffset[slot.dayOffset];
  const structureMeta = [
    `l2=plan:${input.planId};week:${input.week.weekStart};slot:${slot.slotSeq};role:${slot.role}`,
    `catalogPreset=${preset.presetId}`,
    `archetype=${archetypeId}`,
    "origin=l2_builder",
  ].join(" · ");
  contract = {
    ...contract,
    sessionName,
    phase: input.week.phase,
    discipline: catalogDiscipline,
    adaptationTarget: derived.adaptationTarget,
    ...(scheduledTime ? { scheduledTime } : {}),
    blocks: (contract.blocks ?? []).map((b, i) =>
      i === 0 ? { ...b, notes: [structureMeta, b.notes].filter(Boolean).join(" | ") } : b,
    ),
  };

  return buildRowFromContract({ input, slot, family: "aerobic", contract, fallbackMinutes: minutes });
}

/** Etichette IT per il titolo seduta palestra (default: enum grezzo). */
const GYM_ADAPTATION_LABEL_IT: Partial<Record<EngineAdaptationTarget, string>> = {
  max_strength: "Forza massima",
  hypertrophy_mixed: "Ipertrofia",
  hypertrophy_sarcoplasmic: "Ipertrofia · volume",
  hypertrophy_myofibrillar: "Ipertrofia · densità",
  power_output: "Potenza",
  neuromuscular_adaptation: "Neuromuscolare",
  mobility_capacity: "Mobilità",
  movement_quality: "Qualità del movimento",
  recovery: "Recupero attivo",
  lactate_clearance: "Resistenza muscolare",
};

/**
 * Stimolo palestra dallo scheletro: primo target strength-like tra
 * primary/secondary/maintenance non escluso; altrimenti default per ruolo
 * (quality→forza, volume→ipertrofia, recovery→mobilità), sempre fuori da `avoid`.
 */
function gymAdaptationForSlot(stimulus: WeekStimulus, role: ViryaSessionRole): EngineAdaptationTarget {
  const avoid = new Set<AdaptationTarget>(stimulus.avoid);
  const declared = [stimulus.primary, stimulus.secondary, ...stimulus.maintenance].filter(
    (t): t is AdaptationTarget => Boolean(t),
  );
  for (const target of declared) {
    if (STRENGTH_LIKE_TARGETS.has(target) && !avoid.has(target)) {
      return target as EngineAdaptationTarget;
    }
  }
  const defaults: AdaptationTarget[] =
    role === "quality"
      ? ["max_strength", "power_output", "hypertrophy_mixed"]
      : role === "recovery"
        ? ["mobility_capacity", "movement_quality", "recovery"]
        : ["hypertrophy_mixed", "movement_quality", "max_strength"];
  for (const target of defaults) {
    if (!avoid.has(target)) return target as EngineAdaptationTarget;
  }
  return defaults[0] as EngineAdaptationTarget;
}

function materializeGymSlot(
  input: MaterializeWeekBuilderEngineInput,
  slot: BuilderEngineSlot,
  weekScale: number,
): SlotOutcome {
  const adaptation = gymAdaptationForSlot(input.week.stimulus, slot.role);
  // Il monte-ore coach scala anche la durata palestra; il TSS invece NON si
  // scala qui: per la palestra è la verità L1 (loadTarget dal budget settimana),
  // scalarlo per le ore lo conterebbe due volte.
  const minutes = capMinutes(
    Math.max(10, Math.round(gymDurationMinutesForBrief(slot.role, undefined) * weekScale)),
    input.profile.maxSessionMinutes,
  );
  const tss = Math.max(1, Math.round(slot.loadTarget));
  const kcal = kcalFromLoadTarget(tss, minutes, input.profile.renderProfile.ftpW);

  // Catalogo-first (blueprint C): niente chiamata al motore engine via API — il
  // pool esercizi arriva dal catalogo DB passato come input.
  const sportTag = disciplineToBlock1SportTag(input.discipline);
  const pickedRows = buildPro2GymRowsCatalogOnly({
    catalogRows: input.catalogs.gymCatalogRows,
    sportTag,
    adaptation,
    executionStyle: "Lento controllato",
  });
  if (!pickedRows.length) return { ok: false, error: "gym_catalog_empty" };
  // Id riga DETERMINISTICI: defaultPro2GymManualRow genera id random e il re-run
  // della stessa settimana produrrebbe contratti diversi a parità di input —
  // l'idempotenza (delete+reinsert identico) è un requisito del blueprint, non
  // un'ottimizzazione.
  const rows = pickedRows.map((row, i) => ({ ...row, id: `l2-gym-${slot.slotSeq}-${i + 1}` }));

  const scheduledTime = input.profile.preferredTimeByOffset[slot.dayOffset];
  const sessionName = `Palestra · ${GYM_ADAPTATION_LABEL_IT[adaptation] ?? adaptation}`;
  const scheda = buildPro2GymSchedaSessionContract({
    rows,
    renderProfile: input.profile.renderProfile,
    discipline: input.discipline.trim() || "Gym",
    sessionName,
    adaptationTarget: adaptation,
    phase: input.week.phase,
    plannedSessionDurationMinutes: minutes,
    scheduledTime,
  });
  // Il carico dello slot è la verità L1: il summary della scheda si allinea al
  // budget settimana (stessa semantica del materializzatore gym del wizard).
  const contract: Pro2BuilderSessionContract = {
    ...scheda,
    summary: {
      ...scheda.summary,
      tss,
      kcal: Math.max(0, Math.round(kcal)),
      kj: Math.max(0, Math.round(kcal * 4.184)),
    },
  };

  return buildRowFromContract({ input, slot, family: "strength", contract, fallbackMinutes: minutes });
}

/* ── entry point ── */

/**
 * Fattore di scala dal monte-ore coach: somma le durate NATURALI della settimana
 * (derivazione deterministica, quindi il doppio calcolo pre-pass+slot è innocuo)
 * e rapporta a hoursTarget*60. Clamp 0.5–1.6: rete di sicurezza contro sedute
 * assurde (stesso spirito del clamp 1.55 di scaleLibraryContract) — un target
 * fuori range viene onorato «fino al limite», mai ciecamente.
 */
function computeWeekHoursScale(
  input: MaterializeWeekBuilderEngineInput,
  slots: BuilderEngineSlot[],
  chips: string[],
): number {
  const hours = input.week.hoursTarget;
  if (hours == null || !Number.isFinite(hours) || hours <= 0 || slots.length === 0) return 1;
  let naturalTotal = 0;
  for (const slot of slots) {
    naturalTotal +=
      slot.family === "strength"
        ? gymDurationMinutesForBrief(slot.role, undefined)
        : deriveAerobicInstructionsForSlot({ input, slot, sessionsInWeek: slots.length, chips })
            .sessionMinutes;
  }
  if (naturalTotal <= 0) return 1;
  return Math.min(1.6, Math.max(0.5, (hours * 60) / naturalTotal));
}

export function materializeWeekWithBuilderEngine(
  input: MaterializeWeekBuilderEngineInput,
): MaterializeWeekBuilderEngineResult {
  const { slots, errors } = planBuilderWeekSlots({ week: input.week, config: input.config });
  const chips = weekObjectiveChipsFromStimulus(input.week.stimulus);
  const weekScale = computeWeekHoursScale(input, slots, chips);

  const rows: PlannedWorkoutInsertPayload[] = [];
  for (const slot of slots) {
    const outcome =
      slot.family === "strength"
        ? materializeGymSlot(input, slot, weekScale)
        : materializeAerobicSlot(input, slot, slots.length, chips, weekScale);
    if (outcome.ok) {
      rows.push(outcome.row);
    } else {
      // La singola seduta fallisce con errore esplicito, le altre procedono
      // (blueprint C: mai spazzatura persistita, mai settimana tutta-o-niente).
      errors.push({ date: slot.date, dayOffset: slot.dayOffset, error: outcome.error });
    }
  }

  return { rows, slots, errors };
}
