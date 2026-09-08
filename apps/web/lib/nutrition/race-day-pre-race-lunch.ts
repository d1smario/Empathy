/**
 * Protocollo pre-gara canonico Empathy (deterministico, tutti gli atleti).
 *
 * In giorno gara: pranzo = start gara − 3 h, pasta o riso 3 g CHO/kg,
 * grana 15–20 g, olio 15–20 g; il resto segue il profilo Diet (kcal/% pasti).
 *
 * REGOLA 1 (Mario): il pasto pre-gara è FISSO — quelle tre voci e basta. La quota
 * proteica la porta il grana: il generativo NON aggiunge un'altra proteina e NON
 * riempie il divario kcal con un dolce. Se il protocollo costa meno del budget dello
 * slot Diet, il residuo va agli altri pasti del giorno
 * (`redistributeRacePreRaceBudgetSurplus`), mai a ristuffare il pre-gara.
 *
 * Vedi `.cursor/rules/empathy_nutrition_diet_meal_plan_generative.mdc` Regola 8.
 */

import type { AllergenClassToken } from "@/lib/nutrition/meal-plan-profile-food-filter";
import type { IntelligentMealPlanItemOut, MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { MEAL_SLOT_KEYS } from "@/lib/nutrition/intelligent-meal-plan-types";
import type { MediterraneanComposedMeal, MediterraneanDayContext } from "@/lib/nutrition/mediterranean-meal-composer";
import {
  formatMinutesToLocalHHmm,
  parseLocalTimeToMinutes,
} from "@/lib/nutrition/nutrition-meal-times-training-coherence";
import { profileWeekDayKeyFromIsoLocal } from "@/lib/nutrition/routine-week-plan-meal-times";

export type RaceDayPreRaceLunchRule = {
  hoursBeforeRace: number;
  carbsPerKgG: number;
  staple: "pasta_or_rice";
  granaPadanoG: { min: number; max: number };
  /**
   * «15-20 g di olio»: un INTERVALLO, esattamente come il grana. Era un numero fisso (15) —
   * l'unica delle due voci del protocollo a non ruotare, senza che il protocollo lo chieda.
   */
  oliveOilG: { min: number; max: number };
};

/** Protocollo classico pre-gara — identico per ogni atleta quando il calendario segnala una gara. */
export const RACE_DAY_PRE_RACE_LUNCH_PROTOCOL: RaceDayPreRaceLunchRule = {
  hoursBeforeRace: 3,
  carbsPerKgG: 3,
  staple: "pasta_or_rice",
  granaPadanoG: { min: 15, max: 20 },
  oliveOilG: { min: 15, max: 20 },
};

export function getRaceDayPreRaceLunchProtocol(): RaceDayPreRaceLunchRule {
  return RACE_DAY_PRE_RACE_LUNCH_PROTOCOL;
}

export type PlannedSessionForRaceDetection = {
  duration_minutes?: unknown;
  type?: unknown;
  notes?: unknown;
  sessionName?: unknown;
  adaptiveGoal?: unknown;
};

export type RaceSessionForDay = {
  id?: string;
  label: string;
  startMinutes: number;
  raceStartLocal: string;
  durationMinutes: number;
};

export type RacePreLunchDayContext = {
  weightKg: number;
  rule: RaceDayPreRaceLunchRule;
  raceLabel: string;
  raceStartLocal: string;
  /** Orario pasto pre-gara (= start gara − 3 h). */
  lunchTimeLocal: string;
  /** Slot Diet che ospita pasta/riso + grana + olio (colazione se gara mattutina, altrimenti pranzo). */
  mealSlot: MealSlotKey;
  raceStartMinutes: number;
  raceEndMinutes: number;
  preRaceMealMinutes: number;
};

export type RaceDayPostRecoveryRule = {
  choPerKgByDuration: {
    shortUnder120Min: number;
    medium120To180Min: number;
    longOver180Min: number;
  };
  proteinPerKgG: number;
  mctPerKgG: number;
};

export type RacePostRecoveryContext = {
  weightKg: number;
  raceLabel: string;
  raceEndMinutes: number;
  recoveryTimeLocal: string;
  mealSlot: MealSlotKey;
  choPerKgG: number;
  choG: number;
  proteinG: number;
  mctG: number;
  totalKcal: number;
};

const PRE_RACE_SLOT_LABEL_IT: Partial<Record<MealSlotKey, string>> = {
  breakfast: "colazione",
  lunch: "pranzo",
  dinner: "cena",
  snack_am: "spuntino mattina",
  snack_pm: "merenda",
  snack_evening: "spuntino serale",
};

const RACE_TEXT = /\b(gara|race|competition|gran fondo|granfondo|marathon|maratona|ironman|triathlon)\b/i;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function numFromUnknown(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function nonEmptyTime(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function textBlob(...parts: unknown[]): string {
  return parts
    .map((p) => (typeof p === "string" ? p : p != null ? String(p) : ""))
    .join(" ")
    .toLowerCase();
}

export function isPlannedSessionRaceLike(input: {
  type?: unknown;
  notes?: unknown;
  sessionName?: unknown;
  adaptiveGoal?: unknown;
  durationMinutes?: number;
  routineDayMode?: string | null;
}): boolean {
  if (input.routineDayMode === "race") return true;
  const blob = textBlob(input.type, input.notes, input.sessionName, input.adaptiveGoal);
  if (RACE_TEXT.test(blob)) return true;
  const t = textBlob(input.type);
  return t === "race" || t.includes("gara");
}

export function inferRaceStartMinutesFromRoutine(
  routineConfig: Record<string, unknown> | null | undefined,
  planDate: string,
): number | null {
  if (!routineConfig) return null;
  const wd = profileWeekDayKeyFromIsoLocal(planDate);
  const weekPlan = asRecord(routineConfig.week_plan);
  const day = asRecord(weekPlan[wd]);
  const startStr =
    nonEmptyTime(day.training1_start_time) ??
    nonEmptyTime(asRecord(routineConfig.training_1).start_time) ??
    nonEmptyTime(routineConfig.training1_start_time) ??
    null;
  if (!startStr) return null;
  return parseLocalTimeToMinutes(startStr);
}

export function detectPrimaryRaceSessionForDay(input: {
  planDate: string;
  routineConfig: Record<string, unknown> | null | undefined;
  plannedSessions: PlannedSessionForRaceDetection[];
}): RaceSessionForDay | null {
  const wd = profileWeekDayKeyFromIsoLocal(input.planDate);
  const weekPlan = asRecord(input.routineConfig?.week_plan);
  const dayRoutine = asRecord(weekPlan[wd]);
  const dayMode = nonEmptyTime(dayRoutine.day_mode) ?? null;
  const startMinutes = inferRaceStartMinutesFromRoutine(input.routineConfig, input.planDate);

  const candidates = input.plannedSessions
    .map((s, idx) => {
      const durationMinutes = numFromUnknown(s.duration_minutes, 0);
      const label = String(s.sessionName ?? s.type ?? `Sessione ${idx + 1}`).trim() || `Sessione ${idx + 1}`;
      const raceLike = isPlannedSessionRaceLike({
        type: s.type,
        notes: s.notes,
        sessionName: s.sessionName,
        adaptiveGoal: s.adaptiveGoal,
        durationMinutes,
        routineDayMode: dayMode,
      });
      if (!raceLike) return null;
      const start = startMinutes ?? 7 * 60 + 30;
      return {
        label,
        startMinutes: start,
        raceStartLocal: formatMinutesToLocalHHmm(start),
        durationMinutes: Math.max(durationMinutes, 0),
      };
    })
    .filter((c): c is Omit<RaceSessionForDay, "id"> => c != null);

  if (candidates.length === 0) {
    if (dayMode !== "race" || startMinutes == null) return null;
    return {
      label: "Gara (routine)",
      startMinutes,
      raceStartLocal: formatMinutesToLocalHHmm(startMinutes),
      durationMinutes: numFromUnknown(dayRoutine.training1_duration_minutes, 0),
    };
  }

  candidates.sort((a, b) => b.durationMinutes - a.durationMinutes || b.startMinutes - a.startMinutes);
  const best = candidates[0]!;
  return { ...best };
}

export function computePreRaceLunchMinutes(raceStartMinutes: number, hoursBeforeRace: number): number {
  return Math.max(6 * 60, raceStartMinutes - Math.round(hoursBeforeRace * 60));
}

const RACE_DAY_POST_RECOVERY_RULE: RaceDayPostRecoveryRule = {
  choPerKgByDuration: {
    shortUnder120Min: 1.0,
    medium120To180Min: 1.2,
    longOver180Min: 1.5,
  },
  proteinPerKgG: 0.6,
  mctPerKgG: 0.2,
};

export function getRaceDayPostRecoveryRule(): RaceDayPostRecoveryRule {
  return RACE_DAY_POST_RECOVERY_RULE;
}

export function choosePostRaceChoPerKg(durationMinutes: number, rule: RaceDayPostRecoveryRule): number {
  if (durationMinutes > 180) return rule.choPerKgByDuration.longOver180Min;
  if (durationMinutes >= 120) return rule.choPerKgByDuration.medium120To180Min;
  return rule.choPerKgByDuration.shortUnder120Min;
}

export function resolvePostRaceRecoveryMealSlot(input: {
  raceEndMinutes: number;
  activeSlots: readonly MealSlotKey[];
  mealTimesBySlot: Partial<Record<MealSlotKey, string>>;
}): MealSlotKey {
  const recoveryAt = input.raceEndMinutes + 15;
  const lunchMin = parseLocalTimeToMinutes(input.mealTimesBySlot.lunch ?? "");

  /**
   * Seduta/gara finisce PRIMA del pranzo di routine (es. 9:30→12:00, pranzo 13:00):
   * recovery = spuntino mattutino ~12:15; pranzo resta pasto mediterraneo completo.
   */
  if (input.activeSlots.includes("snack_am") && lunchMin != null && recoveryAt < lunchMin - 10) {
    return "snack_am";
  }

  const candidates = input.activeSlots
    .map((slot) => {
      const t = parseLocalTimeToMinutes(input.mealTimesBySlot[slot] ?? "");
      return t == null ? null : { slot, minutes: t };
    })
    .filter((row): row is { slot: MealSlotKey; minutes: number } => row != null)
    .filter((row) => {
      if (lunchMin != null && recoveryAt < lunchMin - 10 && row.slot === "lunch") return false;
      return row.minutes >= recoveryAt;
    })
    .sort((a, b) => a.minutes - b.minutes);
  if (candidates.length > 0) return candidates[0]!.slot;
  if (input.activeSlots.includes("snack_evening")) return "snack_evening";
  if (input.activeSlots.includes("dinner")) return "dinner";
  if (input.activeSlots.includes("snack_pm")) return "snack_pm";
  return input.activeSlots[0] ?? "dinner";
}

export function buildRacePostRecoveryContext(input: {
  weightKg: number | null | undefined;
  planDate: string;
  routineConfig: Record<string, unknown> | null | undefined;
  plannedSessions: PlannedSessionForRaceDetection[];
  activeMealSlots: readonly MealSlotKey[];
  mealTimesBySlot: Partial<Record<MealSlotKey, string>>;
}): RacePostRecoveryContext | null {
  const race = detectPrimaryRaceSessionForDay({
    planDate: input.planDate,
    routineConfig: input.routineConfig,
    plannedSessions: input.plannedSessions,
  });
  if (!race) return null;
  const weightKg = numFromUnknown(input.weightKg, 0);
  if (weightKg < 35) return null;
  const rule = getRaceDayPostRecoveryRule();
  const raceEndMinutes = race.startMinutes + Math.max(45, race.durationMinutes);
  const choPerKgG = choosePostRaceChoPerKg(race.durationMinutes, rule);
  const choG = Math.round(weightKg * choPerKgG);
  const proteinG = Math.round(weightKg * rule.proteinPerKgG);
  const mctG = Math.round(weightKg * rule.mctPerKgG);
  const totalKcal = Math.round(choG * 4 + proteinG * 4 + mctG * 8.3);
  const mealSlot = resolvePostRaceRecoveryMealSlot({
    raceEndMinutes,
    activeSlots: input.activeMealSlots,
    mealTimesBySlot: input.mealTimesBySlot,
  });
  return {
    weightKg,
    raceLabel: race.label,
    raceEndMinutes,
    recoveryTimeLocal: formatMinutesToLocalHHmm(raceEndMinutes + 15),
    mealSlot,
    choPerKgG,
    choG,
    proteinG,
    mctG,
    totalKcal,
  };
}

export type RacePostRecoveryMealRow = {
  key: string;
  label: string;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  timeLocal: string;
};

/** Ribilancia kcal/macros degli altri slot per tenere il totale giornaliero dopo il recovery post-gara. */
export function rebalanceMealRowsForRacePostRecovery(
  rows: RacePostRecoveryMealRow[],
  recoveryCtx: RacePostRecoveryContext,
): RacePostRecoveryMealRow[] {
  const idx = rows.findIndex((r) => r.key === recoveryCtx.mealSlot);
  if (idx < 0) return rows;
  const next = rows.map((r) => ({ ...r }));
  const before = Math.round(next[idx]!.kcal);
  next[idx] = {
    ...next[idx]!,
    kcal: recoveryCtx.totalKcal,
    carbs: recoveryCtx.choG,
    protein: recoveryCtx.proteinG,
    fat: recoveryCtx.mctG,
    timeLocal: recoveryCtx.recoveryTimeLocal,
  };
  let delta = recoveryCtx.totalKcal - before;
  if (Math.abs(delta) < 5) return next;

  const isMealSlotKey = (s: string): s is MealSlotKey =>
    (MEAL_SLOT_KEYS as readonly string[]).includes(s);

  const recoveryIsSnack = recoveryCtx.mealSlot.startsWith("snack");
  const candidates = next
    .map((row, i) => ({ row, i }))
    .filter(({ i, row }) => i !== idx && isMealSlotKey(row.key))
    .filter(({ row }) => !(recoveryIsSnack && row.key === "lunch"))
    .sort((a, b) => b.row.kcal - a.row.kcal);

  if (delta > 0) {
    for (const c of candidates) {
      const minKcal = c.row.key.startsWith("snack") ? 70 : 130;
      const reducible = Math.max(0, Math.round(c.row.kcal - minKcal));
      if (reducible <= 0) continue;
      const take = Math.min(delta, reducible);
      const ratio = Math.max(0.1, (c.row.kcal - take) / Math.max(1, c.row.kcal));
      c.row.kcal = Math.round(c.row.kcal - take);
      c.row.carbs = Math.round(c.row.carbs * ratio);
      c.row.protein = Math.round(c.row.protein * ratio);
      c.row.fat = Math.max(0, Math.round(c.row.fat * ratio));
      next[c.i] = { ...c.row };
      delta -= take;
      if (delta <= 0) break;
    }
  } else {
    const donor = candidates[0];
    if (donor) {
      const add = Math.abs(delta);
      const ratio = (donor.row.kcal + add) / Math.max(1, donor.row.kcal);
      donor.row.kcal = Math.round(donor.row.kcal + add);
      donor.row.carbs = Math.round(donor.row.carbs * ratio);
      donor.row.protein = Math.round(donor.row.protein * ratio);
      donor.row.fat = Math.max(0, Math.round(donor.row.fat * ratio));
      next[donor.i] = { ...donor.row };
    }
  }

  return next;
}

/**
 * Assegna il pasto pre-gara allo slot Diet corretto:
 * gara ~10 → pasta alle 7 in colazione; gara ~13–14 → pasta alle 10–11 in pranzo.
 */
export function resolvePreRaceMealSlot(
  preRaceMinutes: number,
  activeSlots: readonly MealSlotKey[],
): MealSlotKey {
  const set = new Set(activeSlots);
  if (preRaceMinutes < 9 * 60 + 15 && set.has("breakfast")) return "breakfast";
  if (set.has("lunch")) return "lunch";
  if (set.has("breakfast")) return "breakfast";
  return activeSlots[0] ?? "lunch";
}

/** Finestra Fueling in giorno gara: da 1 h prima dello start a 1 h dopo la fine (incluso post-workout). */
export const RACE_DAY_FUELING_LEAD_MINUTES = 60;
export const RACE_DAY_FUELING_TAIL_MINUTES = 60;

export function computeRaceDayFuelingWindow(ctx: RacePreLunchDayContext): { startMinutes: number; endMinutes: number } {
  return {
    startMinutes: ctx.raceStartMinutes - RACE_DAY_FUELING_LEAD_MINUTES,
    endMinutes: ctx.raceEndMinutes + RACE_DAY_FUELING_TAIL_MINUTES,
  };
}

/**
 * Slot nel meal plan che cadono nella finestra Fueling → placeholder in-ride (gel/idratazione).
 * Restano classici: colazione/pranzo pre-gara (mealSlot), cena/spuntino serale fuori finestra,
 * e lo slot recovery post-gara (pasto solido dedicato, non placeholder).
 */
export function computeRaceDaySuppressedSlots(input: {
  ctx: RacePreLunchDayContext;
  activeSlots: readonly MealSlotKey[];
  mealTimesBySlot: Partial<Record<MealSlotKey, string>>;
  postRecoveryMealSlot?: MealSlotKey | null;
}): MealSlotKey[] {
  const { startMinutes, endMinutes } = computeRaceDayFuelingWindow(input.ctx);
  const out: MealSlotKey[] = [];
  for (const slot of input.activeSlots) {
    if (slot === input.ctx.mealSlot) continue;
    if (input.postRecoveryMealSlot && slot === input.postRecoveryMealSlot) continue;
    const t = parseLocalTimeToMinutes(input.mealTimesBySlot[slot] ?? "");
    if (t == null) continue;
    if (t >= startMinutes && t <= endMinutes) out.push(slot);
  }
  return [...new Set(out)];
}

export function isRacePreRaceMealSlot(slot: MealSlotKey, ctx: RacePreLunchDayContext | null | undefined): boolean {
  return Boolean(ctx && slot === ctx.mealSlot);
}

export function mapPlannedSessionsForRaceDetection(
  sessions: Array<{
    duration_minutes?: unknown;
    type?: unknown;
    notes?: unknown;
    plannedSessionName?: unknown;
    plannedAdaptationTarget?: unknown;
    builderSession?: { sessionName?: string | null; adaptationTarget?: string | null } | null;
  }>,
): PlannedSessionForRaceDetection[] {
  return sessions.map((s) => ({
    duration_minutes: s.duration_minutes,
    type: s.type,
    notes: s.notes,
    sessionName: s.plannedSessionName ?? s.builderSession?.sessionName ?? null,
    adaptiveGoal: s.plannedAdaptationTarget ?? s.builderSession?.adaptationTarget ?? null,
  }));
}

export function buildRacePreLunchDayContext(input: {
  weightKg: number | null | undefined;
  planDate: string;
  routineConfig: Record<string, unknown> | null | undefined;
  plannedSessions: PlannedSessionForRaceDetection[];
  activeMealSlots?: readonly MealSlotKey[];
}): RacePreLunchDayContext | null {
  const rule = getRaceDayPreRaceLunchProtocol();
  const race = detectPrimaryRaceSessionForDay({
    planDate: input.planDate,
    routineConfig: input.routineConfig,
    plannedSessions: input.plannedSessions,
  });
  if (!race) return null;
  const weightKg = numFromUnknown(input.weightKg, 0);
  if (weightKg < 35) return null;
  const preRaceMealMinutes = computePreRaceLunchMinutes(race.startMinutes, rule.hoursBeforeRace);
  const activeSlots =
    input.activeMealSlots && input.activeMealSlots.length > 0
      ? input.activeMealSlots
      : (MEAL_SLOT_KEYS as readonly MealSlotKey[]);
  const mealSlot = resolvePreRaceMealSlot(preRaceMealMinutes, activeSlots);
  const raceEndMinutes = race.startMinutes + Math.max(45, race.durationMinutes);
  const preRaceTimeLocal = formatMinutesToLocalHHmm(preRaceMealMinutes);
  return {
    weightKg,
    rule,
    raceLabel: race.label,
    raceStartLocal: race.raceStartLocal,
    lunchTimeLocal: preRaceTimeLocal,
    mealSlot,
    raceStartMinutes: race.startMinutes,
    raceEndMinutes,
    preRaceMealMinutes,
  };
}

/** Numero in italiano con una decimale: 2.4 → «2,4». */
function formatGPerKgIt(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

export function racePreLunchContextLine(ctx: RacePreLunchDayContext): string {
  const cho = Math.round(ctx.weightKg * ctx.rule.carbsPerKgG);
  const slotLabel = PRE_RACE_SLOT_LABEL_IT[ctx.mealSlot] ?? ctx.mealSlot;
  // Il tetto di porzione morde solo oltre i 120 kg: quando succede lo si scrive anche nella
  // riga di contesto del giorno, non solo nel piatto — un piano che non rispetta il protocollo
  // non deve poter passare inosservato da nessuna delle due parti.
  const ceilingWarning =
    ctx.weightKg > RACE_STAPLE_MAX_PROTOCOL_WEIGHT_KG
      ? ` ATTENZIONE: con ${ctx.weightKg} kg i ${cho} g CHO non entrano in una porzione servibile ` +
        `(tetto ${raceStaplePortionCeilingDryG("pasta")} g di pasta secca, ${raceStaplePortionCeilingDryG("riso")} g di riso): ` +
        `il pasto serve il massimo e resta SOTTO il protocollo — verificare il peso in profilo.`
      : "";
  return (
    `Protocollo pre-gara: ${slotLabel} ${ctx.lunchTimeLocal} (${ctx.rule.hoursBeforeRace} h prima di ${ctx.raceStartLocal} · ${ctx.raceLabel}) — ` +
    `pasta o riso ${ctx.rule.carbsPerKgG} g CHO/kg (~${cho} g), grana ${ctx.rule.granaPadanoG.min}–${ctx.rule.granaPadanoG.max} g, ` +
    `olio ${ctx.rule.oliveOilG.min}–${ctx.rule.oliveOilG.max} g. ` +
    `Pasto FISSO: nessuna proteina aggiunta (la porta il grana) e nessun riempimento kcal; ` +
    `il residuo rispetto al target Diet va sugli altri pasti del giorno.` +
    ceilingWarning
  );
}

export function racePostRecoveryContextLine(ctx: RacePostRecoveryContext): string {
  return (
    `Recovery post-gara (${ctx.raceLabel}) nello slot ${ctx.mealSlot}: ` +
    `CHO ${ctx.choPerKgG.toFixed(1)} g/kg (~${ctx.choG} g), PRO 0.6 g/kg (~${ctx.proteinG} g), ` +
    `MCT 0.2 g/kg (~${ctx.mctG} g), totale ~${ctx.totalKcal} kcal.`
  );
}

type RaceStaple = "pasta" | "riso";

/** Classi allergeniche dei due amidi del protocollo. */
const RACE_STAPLE_CLASSES: Record<RaceStaple, readonly AllergenClassToken[]> = {
  pasta: ["glutine"],
  riso: [],
};

const RACE_D = {
  pastaDryKcalPerG: 3.71,
  pastaDryChoPerG: 0.75,
  pastaDryProtPerG: 0.13,
  riceDryKcalPerG: 3.65,
  riceDryChoPerG: 0.8,
  riceDryProtPerG: 0.071,
  granaKcalPerG: 4.0,
  granaProtPerG: 0.33,
  granaFatPerG: 0.28,
  // Olio EVO per GRAMMO (884 kcal e 100 g di grasso per 100 g), non per millilitro: il
  // protocollo prescrive grammi e la bilancia di cucina pesa grammi. La coppia
  // `oilKcalPerMl`/`oilFatPerMl` di prima portava questi stessi valori sotto il nome
  // sbagliato, e il piatto ci passava attraverso una conversione ml→g (×0,92) che toglieva
  // 1,2 g di grasso e spaccava le kcal della riga in due numeri diversi.
  oilKcalPerG: 8.84,
  oilFatPerG: 1.0,
};

// ── Allergeni nel protocollo gara ────────────────────────────────────────────────────
// Il giorno gara NON passa dal catalogo del menù: gli item sono scritti qui, non hanno
// fdcId, quindi il filtro per classi che protegge il resto del piano non li vede e la
// rete per sottostringhe non li riconosce («Grana Padano» non contiene "latte" né
// "formaggio"). La classe la dichiara l'item stesso, ed è OBBLIGATORIA: chi aggiunge un
// cibo al protocollo deve dirne le classi o non compila.

/** Item del protocollo gara con le classi allergeniche dichiarate. */
export type RaceMealItem = IntelligentMealPlanItemOut & {
  readonly allergenClasses: readonly AllergenClassToken[];
};

/**
 * Classi che l'atleta non tollera (allergie + intolleranze + esclusioni), come le porta
 * `AllergenFilterContext.athleteClasses`. Assente/vuoto → protocollo identico a oggi.
 */
export type RaceAllergenClasses = ReadonlySet<string> | null | undefined;

/** Una delle classi è vietata per questo atleta? */
export function raceClassBlocked(
  classes: readonly AllergenClassToken[],
  excluded: RaceAllergenClasses,
): boolean {
  if (!excluded || excluded.size === 0) return false;
  return classes.some((c) => excluded.has(c));
}

/**
 * Rete finale del protocollo: qualunque item porti una classe vietata esce dal pasto,
 * anche quando non c'era un'alternativa da scegliere (il grana, per esempio, è fisso).
 * Con atleta senza dichiarazioni è un no-op: stesso array, stesso ordine.
 */
function dropBlockedRaceItems(items: RaceMealItem[], excluded: RaceAllergenClasses): RaceMealItem[] {
  if (!excluded || excluded.size === 0) return items;
  return items.filter((it) => !raceClassBlocked(it.allergenClasses, excluded));
}

function raceMeal(items: RaceMealItem[]): MediterraneanComposedMeal {
  return {
    items,
    lines: items.map((i) => i.portionHint),
    totalApproxKcal: items.reduce((s, i) => s + i.approxKcal, 0),
  };
}

function clampStep(n: number, lo: number, hi: number, step = 5): number {
  const rounded = Math.round(n / step) * step;
  return Math.max(lo, Math.min(hi, rounded));
}

/**
 * Grammi di una voce del protocollo espressa come intervallo («grana 15-20 g», «olio
 * 15-20 g»): rotazione deterministica sul seed del giorno, passo 1 g, estremi inclusi.
 *
 * È il meccanismo che il grana usava già da solo. L'olio, che il protocollo scrive nella
 * stessa identica forma, era invece inchiodato al minimo: due voci gemelle con due
 * comportamenti diversi, senza che il nutrizionista lo abbia mai chiesto. Ora la regola è
 * una sola e la scrivono entrambe.
 *
 * `phase` distingue le due estrazioni: stesso seed e stessa regola, ma non la stessa
 * pescata — altrimenti l'olio sarebbe la copia carbone del grana, il che non è «ruotare».
 */
function protocolRangeGrams(seed: number, range: { min: number; max: number }, phase = 0): number {
  const span = Math.max(1, range.max - range.min + 1);
  return clampStep(range.min + ((Math.abs(seed) + phase) % span), range.min, range.max, 1);
}

function item(
  name: string,
  portionHint: string,
  approxKcal: number,
  role: IntelligentMealPlanItemOut["macroRole"],
  bridge: string,
  /** Classi allergeniche del cibo: obbligatorie — è l'unica cosa che lo qualifica qui. */
  allergenClasses: readonly AllergenClassToken[],
): RaceMealItem {
  return {
    name,
    portionHint,
    approxKcal: Math.max(8, Math.round(approxKcal)),
    macroRole: role,
    functionalBridge: bridge.slice(0, 500),
    allergenClasses,
  };
}

/**
 * Peso oltre il quale il protocollo NON viene più servito per intero — ed è l'unico motivo
 * per cui un tetto di porzione sopravvive qui.
 *
 * Il tetto che c'era prima (320 g di pasta, 300 g di riso) non era un numero del
 * nutrizionista: era la guardia generica del compositore, la stessa `clampStep` che tiene il
 * pollo fra 65 e 95 g, ereditata dal file com'era PRIMA che la Regola 1 esistesse. Sopra ~80
 * kg smetteva di essere una guardia e diventava lei il numero: l'atleta da 95 kg ha ricevuto
 * 320 g di pasta su 6 piani gara (21/08→06/09) e 300 g di riso su altri 6 (17/08→31/08) —
 * sempre il tetto, mai il protocollo — cioè 240 g di CHO, 2,53 g/kg invece di 3. Silenzioso:
 * la riga del piatto continuava a dichiarare «~285 g CHO (3 g/kg)».
 *
 * Il protocollo ora passa intero a qualunque peso realistico (a 110 kg sono 440 g di pasta
 * secca). Il tetto resta SOLO come difesa da un peso fuori scala — in profilo capita il peso
 * in libbre: 200 lb digitate come kg chiederebbero 800 g di pasta secca — ed è tarato sul
 * fabbisogno di un atleta da 120 kg, oltre qualunque peso di endurance reale (il più pesante
 * in piattaforma ne pesa 95). Quando morde non è muto: la riga dice i CHO davvero serviti,
 * quelli chiesti dal protocollo e i g/kg mancanti (vedi `composeRacePreLunchMainMeal`).
 */
export const RACE_STAPLE_MAX_PROTOCOL_WEIGHT_KG = 120;

/** Grammi a crudo che coprono 3 g/kg di un atleta da 120 kg: 480 g di pasta, 450 g di riso. */
export function raceStaplePortionCeilingDryG(staple: RaceStaple): number {
  const choPerG = staple === "pasta" ? RACE_D.pastaDryChoPerG : RACE_D.riceDryChoPerG;
  const maxCarbsG = RACE_STAPLE_MAX_PROTOCOL_WEIGHT_KG * RACE_DAY_PRE_RACE_LUNCH_PROTOCOL.carbsPerKgG;
  return Math.round(maxCarbsG / choPerG / 5) * 5;
}

/** Porzione minima servibile a crudo: sotto non è un piatto, è un cucchiaio. */
const RACE_STAPLE_MIN_DRY_G: Record<RaceStaple, number> = { pasta: 50, riso: 45 };

/**
 * Sotto questo divario (g CHO) il tetto non ha davvero morso: è l'arrotondamento della
 * porzione al passo da 5 g sulla bilancia, non un protocollo mancato.
 */
const RACE_STAPLE_CEILING_TOLERANCE_CHO_G = 2;

/** Porzione dello staple con il conto di quanto protocollo è arrivato nel piatto. */
export type RaceStapleServing = {
  staple: RaceStaple;
  /** Grammi a crudo serviti (passo 5 g, bilancia da cucina). */
  dryG: number;
  /** CHO chiesti dal protocollo (peso × g/kg). */
  targetCarbsG: number;
  /** CHO che quei grammi portano davvero. */
  servedCarbsG: number;
  /** Tetto di porzione dello staple, per la traccia. */
  ceilingDryG: number;
  /** true = il protocollo NON è stato raggiunto perché la porzione ha toccato il tetto. */
  cappedByPortionCeiling: boolean;
  /** g CHO mancanti al protocollo (0 quando è servito intero). */
  shortfallCarbsG: number;
};

/**
 * Grammi a crudo per i CHO del protocollo, CON il verdetto: servito intero o tappato.
 * È questa la funzione da usare quando il numero va mostrato o giudicato — quella che
 * restituisce solo i grammi non permette di accorgersi che il tetto ha morso.
 */
export function dryStapleServingForTargetCarbs(
  staple: RaceStaple,
  targetCarbsG: number,
): RaceStapleServing {
  const choPerG = staple === "pasta" ? RACE_D.pastaDryChoPerG : RACE_D.riceDryChoPerG;
  const ceilingDryG = raceStaplePortionCeilingDryG(staple);
  const raw = targetCarbsG / choPerG;
  const dryG = clampStep(raw, RACE_STAPLE_MIN_DRY_G[staple], ceilingDryG);
  const servedCarbsG = Math.round(dryG * choPerG);
  const wantedCarbsG = Math.round(targetCarbsG);
  const gap = Math.max(0, wantedCarbsG - servedCarbsG);
  const capped = raw > ceilingDryG && gap > RACE_STAPLE_CEILING_TOLERANCE_CHO_G;
  return {
    staple,
    dryG,
    targetCarbsG: wantedCarbsG,
    servedCarbsG,
    ceilingDryG,
    cappedByPortionCeiling: capped,
    shortfallCarbsG: capped ? gap : 0,
  };
}

/** Solo i grammi a crudo. Per la traccia del tetto usa `dryStapleServingForTargetCarbs`. */
export function dryStapleGramsForTargetCarbs(staple: RaceStaple, targetCarbsG: number): number {
  return dryStapleServingForTargetCarbs(staple, targetCarbsG).dryG;
}

type PreRaceMediterraneanProtein = "pollo" | "pesce" | "uova" | "tofu";

/** Classi allergeniche delle proteine del protocollo. */
const RACE_PROTEIN_CLASSES: Record<PreRaceMediterraneanProtein, readonly AllergenClassToken[]> = {
  pollo: [],
  pesce: ["pesce"],
  uova: ["uova"],
  tofu: ["soia"],
};

/**
 * `null` = nessuna proteina ammessa (tutte vietate per classe): il pasto la salta invece
 * di ripiegare sulle uova, che è esattamente ciò che un allergico non deve ricevere.
 */
export function pickPreRaceMediterraneanProtein(
  seed: number,
  dayCtx?: MediterraneanDayContext,
  excluded?: RaceAllergenClasses,
): PreRaceMediterraneanProtein | null {
  const diet = dayCtx?.dietType ?? "omnivore";
  let order: PreRaceMediterraneanProtein[] = ["pollo", "pesce", "uova"];
  if (diet === "pescatarian") order = ["pesce", "uova", "pollo"];
  else if (diet === "vegetarian") order = ["uova", "tofu"];
  else if (diet === "vegan") order = ["tofu"];

  const deny = (dayCtx?.denyFragments ?? []).join(" ").toLowerCase();
  order = order.filter((p) => {
    if (p === "pollo" && /\b(pollo|chicken|tacchino|turkey)\b/.test(deny)) return false;
    if (p === "pesce" && /\b(pesce|fish|salmone|merluzzo)\b/.test(deny)) return false;
    if (p === "uova" && /\b(uov|egg)\b/.test(deny)) return false;
    if (p === "tofu" && /\btofu\b/.test(deny)) return false;
    return true;
  });
  const fallback: PreRaceMediterraneanProtein[] = ["uova"];
  const pool = (order.length ? order : fallback).filter(
    (p) => !raceClassBlocked(RACE_PROTEIN_CLASSES[p], excluded),
  );
  if (pool.length === 0) return null;
  return pool[Math.abs(seed + 5) % pool.length] ?? "uova";
}

function preRaceMediterraneanProteinItem(
  kind: PreRaceMediterraneanProtein,
  seed: number,
): RaceMealItem {
  switch (kind) {
    case "pollo":
      return item(
        "Petto di pollo o tacchino",
        `${clampStep(70 + (seed % 3) * 10, 65, 95, 5)} g petto di pollo/tacchino (cottura semplice)`,
        120,
        "protein",
        "Pre-gara mediterraneo: proteina magra digeribile prima dello sforzo.",
        RACE_PROTEIN_CLASSES.pollo,
      );
    case "pesce":
      return item(
        "Pesce bianco",
        `${clampStep(80 + (seed % 2) * 15, 75, 110, 5)} g merluzzo o pesce bianco (al vapore/padella)`,
        95,
        "protein",
        "Pre-gara mediterraneo: pesce magro, basso carico lipidico.",
        RACE_PROTEIN_CLASSES.pesce,
      );
    case "tofu":
      return item(
        "Tofu",
        `${clampStep(90 + (seed % 2) * 15, 80, 120, 10)} g tofu compatto`,
        110,
        "protein",
        "Pre-gara mediterraneo: proteina vegetale.",
        RACE_PROTEIN_CLASSES.tofu,
      );
    default:
      return item(
        "Uova",
        `${2 + (seed % 2)} uova medie (≈${clampStep(100 + (seed % 2) * 25, 100, 130, 25)} g, strapazzate)`,
        140,
        "protein",
        "Pre-gara mediterraneo: uova, fonte proteica classica.",
        RACE_PROTEIN_CLASSES.uova,
      );
  }
}

export function pickRacePreLunchStaple(
  seed: number,
  ctx?: MediterraneanDayContext,
  excluded?: RaceAllergenClasses,
): RaceStaple {
  const order: RaceStaple[] = [];
  const deny = ctx?.denyFragments ?? [];
  const denyText = deny.join(" ").toLowerCase();
  if (!/\bpasta\b|\bglut/i.test(denyText) && !raceClassBlocked(RACE_STAPLE_CLASSES.pasta, excluded)) {
    order.push("pasta");
  }
  if (!/\briso\b|\brice/i.test(denyText) && !raceClassBlocked(RACE_STAPLE_CLASSES.riso, excluded)) {
    order.push("riso");
  }
  // Il riso resta l'ultima spiaggia storica: se anche lui è vietato per classe, il pasto
  // non deve inventarselo — l'item esce comunque dalla rete finale.
  const pool = order.length ? order : (["riso"] as RaceStaple[]);
  return pool[Math.abs(seed) % pool.length] ?? "pasta";
}

/**
 * Composizione FISSA pre-gara (REGOLA 1 di Mario): pasta o riso per 3 g CHO/kg,
 * olio 15–20 g, grana padano. Tre voci, punto.
 *
 * Niente proteina scelta dal generativo (la quota proteica la porta il grana) e niente
 * dolce di riempimento kcal: il pasto NON insegue il budget dello slot Diet. Il residuo
 * kcal lo raccolgono gli altri pasti del giorno — vedi
 * `redistributeRacePreRaceBudgetSurplus`, chiamato dal compositore V2.
 *
 * Resta l'unica sottrazione ammessa: `dropBlockedRaceItems`, cioè l'allergene. Un
 * allergico al latte riceve il pasto SENZA grana (due voci), non un sostituto.
 */
export function composeRacePreLunchMainMeal(
  slot: MealSlotKey,
  /**
   * Budget kcal/macro dello slot Diet. Il protocollo è fisso e NON lo insegue: resta nella
   * firma perché i chiamanti (compositore mediterraneo e V2) lo passano per ogni slot, ed è
   * il compositore a redistribuire il residuo sugli altri pasti.
   */
  m: { kcal: number; carbsG: number; proteinG: number; fatG: number },
  seed: number,
  raceCtx: RacePreLunchDayContext,
  dayCtx?: MediterraneanDayContext,
  /** Classi vietate all'atleta: assente/vuoto → protocollo identico per tutti. */
  excluded?: RaceAllergenClasses,
): MediterraneanComposedMeal {
  void slot;
  void m;
  const rule = raceCtx.rule;
  const targetCarbsG = Math.max(40, Math.round(raceCtx.weightKg * rule.carbsPerKgG));
  const staple = pickRacePreLunchStaple(seed, dayCtx, excluded);
  const serving = dryStapleServingForTargetCarbs(staple, targetCarbsG);
  const carbG = serving.dryG;
  const granaG = protocolRangeGrams(seed, rule.granaPadanoG);
  // Mezzo intervallo di sfasamento rispetto al grana (span 6 → phase 3): stessa regola e
  // stesso seed, ma le due voci non escono mai appaiate.
  const oilG = protocolRangeGrams(seed, rule.oliveOilG, 3);

  const stapleLabel = staple === "pasta" ? "pasta secca" : "riso";
  // Quando il tetto morde, la riga NON può continuare a dichiarare i CHO chiesti: dice quelli
  // serviti e, di seguito, quanto protocollo manca. È l'unica traccia che l'atleta e il coach
  // leggono davvero, perché viaggia con il piatto fin dentro al piano persistito.
  const carbLine = serving.cappedByPortionCeiling
    ? `${carbG} g ${stapleLabel} (peso a crudo) — ~${serving.servedCarbsG} g CHO ` +
      `(${formatGPerKgIt(serving.servedCarbsG / Math.max(1, raceCtx.weightKg))} g/kg): ` +
      `TETTO PORZIONE ${serving.ceilingDryG} g, protocollo ${rule.carbsPerKgG} g/kg NON raggiunto — ` +
      `chiesti ${serving.targetCarbsG} g CHO, ne mancano ${serving.shortfallCarbsG}. Verificare il peso in profilo.`
    : `${carbG} g ${stapleLabel} (peso a crudo) — ~${targetCarbsG} g CHO (${rule.carbsPerKgG} g/kg)`;
  const carbKcal = carbG * (staple === "pasta" ? RACE_D.pastaDryKcalPerG : RACE_D.riceDryKcalPerG);

  const items: RaceMealItem[] = [
    item(
      staple === "pasta" ? "Pasta" : "Riso",
      carbLine,
      carbKcal,
      "cho_heavy",
      serving.cappedByPortionCeiling
        ? `Protocollo pre-gara: porzione al tetto servibile (${serving.ceilingDryG} g a crudo). ` +
          `I ${rule.carbsPerKgG} g CHO/kg per ${raceCtx.weightKg} kg (${serving.targetCarbsG} g) non entrano in un piatto: ` +
          `serviti ${serving.servedCarbsG} g. Peso in profilo da verificare.`
        : "Protocollo pre-gara: amido complesso a densità CHO/kg (canonico piattaforma).",
      RACE_STAPLE_CLASSES[staple],
    ),
    item(
      "Grana Padano",
      `${granaG} g grana grattugiato`,
      granaG * RACE_D.granaKcalPerG,
      "protein",
      "Protocollo pre-gara: grana 15–20 g — è LUI la quota proteica del pasto.",
      ["latte"],
    ),
    item(
      "Olio extravergine d'oliva",
      // In GRAMMI e basta. La parentesi «(~16 ml)» che c'era prima non era un di più: a valle
      // il payload la ri-serviva come «15 ml», il finalize la riconvertiva in 13,8 g e il
      // piatto perdeva 1,2 g di grasso finendo SOTTO il minimo del protocollo.
      `${oilG} g olio EVO`,
      // Un piatto, un numero: le kcal sono quelle dei grammi serviti (8,84 kcal/g), le stesse
      // che la composizione canonica ricava dalla riga. Prima erano quelle di 16 ml (141) e
      // divergevano da quelle dei nutrienti della stessa voce (122).
      oilG * RACE_D.oilKcalPerG,
      "fat",
      `Protocollo pre-gara: olio ${rule.oliveOilG.min}–${rule.oliveOilG.max} g — ` +
        `${oilG} g, cioè ${Math.round(oilG * RACE_D.oilFatPerG)} g di grasso.`,
      [],
    ),
  ];

  return raceMeal(dropBlockedRaceItems(items, excluded));
}

/** Sotto questo residuo (kcal) non si tocca nulla: rumore di arrotondamento. */
export const RACE_PRE_RACE_BUDGET_SURPLUS_MIN_KCAL = 25;

/** Riga di budget di uno slot, come la porta il compositore V2. */
export type RaceSlotBudgetRow = {
  key: string;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
};

/**
 * Il pre-gara è fisso: quando costa MENO del budget del suo slot, il residuo va agli altri
 * pasti del giorno (proporzionale alle loro kcal) e il budget del pre-gara scende a quanto
 * il protocollo pesa davvero. Così il totale giornaliero resta quello del profilo Diet
 * senza che il generativo ristuffi il piatto pre-gara.
 *
 * Quando invece il protocollo SFORA il budget del suo slot (caso frequente: 3 g CHO/kg
 * pesano tanto), qui non si tocca niente — svuotare cena e colazione per far quadrare il
 * giorno è una decisione di prodotto che il nutrizionista non ha preso. In quel caso il
 * comportamento resta identico a prima.
 *
 * `excludeKeys` = slot che il residuo NON deve raggiungere: slot soppressi (finestra
 * fueling) e slot con composizione a protocollo (recovery post-gara), che il budget lo
 * ignorano.
 */
export function redistributeRacePreRaceBudgetSurplus<T extends RaceSlotBudgetRow>(
  slots: readonly T[],
  input: {
    preRaceSlotKey: string;
    preRaceTotals: { kcal: number; choG: number; proG: number; fatG: number };
    excludeKeys?: readonly string[];
  },
): T[] {
  const idx = slots.findIndex((s) => s.key === input.preRaceSlotKey);
  if (idx < 0) return [...slots];

  const budget = slots[idx]!;
  const surplus = Math.round(budget.kcal - input.preRaceTotals.kcal);
  if (surplus < RACE_PRE_RACE_BUDGET_SURPLUS_MIN_KCAL) return [...slots];

  const blocked = new Set(input.excludeKeys ?? []);
  const receivers = slots
    .map((row, i) => ({ row, i }))
    .filter(({ i, row }) => i !== idx && !blocked.has(row.key) && row.kcal > 0);
  if (receivers.length === 0) return [...slots];

  const next = slots.map((s) => ({ ...s }));
  next[idx] = {
    ...next[idx]!,
    kcal: Math.round(input.preRaceTotals.kcal),
    carbs: Math.round(input.preRaceTotals.choG),
    protein: Math.round(input.preRaceTotals.proG),
    fat: Math.round(input.preRaceTotals.fatG),
  };

  const totalReceiverKcal = receivers.reduce((s, r) => s + r.row.kcal, 0);
  if (totalReceiverKcal <= 0) return next;

  /** L'ultimo riceve il resto: nessuna kcal persa negli arrotondamenti. */
  let leftover = surplus;
  receivers.forEach((r, n) => {
    const share =
      n === receivers.length - 1
        ? leftover
        : Math.round((surplus * r.row.kcal) / totalReceiverKcal);
    leftover -= share;
    if (share <= 0) return;
    const ratio = (r.row.kcal + share) / r.row.kcal;
    next[r.i] = {
      ...next[r.i]!,
      kcal: Math.round(r.row.kcal + share),
      carbs: Math.round(r.row.carbs * ratio),
      protein: Math.round(r.row.protein * ratio),
      fat: Math.round(r.row.fat * ratio),
    };
  });

  return next;
}

function isSnackMealSlot(slot: MealSlotKey): boolean {
  return slot === "snack_am" || slot === "snack_pm" || slot === "snack_evening";
}

/** Spuntino post-seduta/gara: CHO + proteina mediterranea leggera (pranzo resta pasto completo). */
function composeMediterraneanPostWorkoutSnackMeal(
  ctx: RacePostRecoveryContext,
  seed: number,
  dayCtx?: MediterraneanDayContext,
  excluded?: RaceAllergenClasses,
): MediterraneanComposedMeal {
  const deny = (dayCtx?.denyFragments ?? []).join(" ").toLowerCase();
  const useBanana = !/\bbanana\b/.test(deny) && Math.abs(seed) % 2 === 0;
  const choItem = useBanana
    ? item(
        "Banana",
        `${clampStep(Math.max(80, Math.round(ctx.choG * 0.55)), 80, 140, 10)} g banana matura`,
        Math.round(ctx.choG * 0.55 * 4),
        "cho_heavy",
        "Post-workout: CHO rapido nello spuntino (pranzo alle 13 resta pasto completo).",
        [],
      )
    : item(
        "Riso bianco (post-workout)",
        `${Math.max(45, Math.round((ctx.choG * 0.55) / 0.8))} g riso cotto`,
        Math.round(ctx.choG * 0.55 * 4),
        "cho_heavy",
        "Post-workout: riso leggero nello spuntino.",
        [],
      );
  const proteinKind = pickPreRaceMediterraneanProtein(seed + 11, dayCtx, excluded);
  const proteinItem = proteinKind ? preRaceMediterraneanProteinItem(proteinKind, seed + 3) : null;
  if (proteinItem) proteinItem.approxKcal = Math.max(80, Math.round(ctx.proteinG * 3.5));
  const items: RaceMealItem[] = proteinItem ? [choItem, proteinItem] : [choItem];
  return raceMeal(dropBlockedRaceItems(items, excluded));
}

export function composeRacePostRecoveryMeal(
  slot: MealSlotKey,
  seed: number,
  ctx: RacePostRecoveryContext,
  dayCtx?: MediterraneanDayContext,
  /** Classi vietate all'atleta: assente/vuoto → protocollo identico a oggi. */
  excluded?: RaceAllergenClasses,
): MediterraneanComposedMeal {
  if (isSnackMealSlot(slot)) {
    return composeMediterraneanPostWorkoutSnackMeal(ctx, seed, dayCtx, excluded);
  }

  const deny = (dayCtx?.denyFragments ?? []).join(" ").toLowerCase();
  const preferRice = /\briso\b|\brice\b/.test(deny) ? false : Math.abs(seed) % 2 === 0;
  const choItem = preferRice
    ? item(
        "Riso bianco (post-gara)",
        `${Math.max(70, Math.round(ctx.choG / 0.8))} g riso (peso a crudo) per ~${ctx.choG} g CHO`,
        ctx.choG * 4,
        "cho_heavy",
        "Recovery post-gara: CHO rapidi/medi per ripristino glicogeno.",
        [],
      )
    : item(
        "Carbo Recovery Mix",
        `${ctx.choG} g CHO da miscela carbo recovery`,
        ctx.choG * 4,
        "cho_heavy",
        "Recovery post-gara: miscela carbo ad alta disponibilita.",
        [],
      );
  const proteinKind = pickPreRaceMediterraneanProtein(seed + 7, dayCtx, excluded);
  const proteinItem = proteinKind ? preRaceMediterraneanProteinItem(proteinKind, seed) : null;
  if (proteinItem) {
    proteinItem.approxKcal = Math.max(100, Math.round(ctx.proteinG * 4));
    proteinItem.functionalBridge = "Recovery post-gara: proteina mediterranea (carne/pesce/uova).";
  }
  const mctItem = item(
    "MCT oil",
    `${ctx.mctG} g MCT oil`,
    Math.round(ctx.mctG * 8.3),
    "fat",
    "Recovery post-gara: quota lipidica rapida da MCT.",
    [],
  );
  const items: RaceMealItem[] = proteinItem ? [choItem, proteinItem, mctItem] : [choItem, mctItem];
  return raceMeal(dropBlockedRaceItems(items, excluded));
}
