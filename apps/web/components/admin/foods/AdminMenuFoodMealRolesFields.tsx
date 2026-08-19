"use client";

import { cn } from "@/lib/cn";
import {
  MENU_FOOD_FREQUENCIES,
  MENU_FOOD_MACRO_ROLES,
  MENU_FOOD_MEAL_ROLES,
  MENU_FOOD_ROLE_MEALS,
  type MenuFoodMealRolesInput,
} from "@/lib/admin/menu-food-meal-roles-validation";
import {
  FREQUENCY_LABELS,
  MACRO_ROLE_LABELS,
  MEAL_ROLE_LABELS,
  ROLE_MEAL_LABELS,
} from "@/components/admin/foods/menu-food-meal-role-labels";

const COPY = {
  section: "Ruoli e punteggi per pasto (grammatica)",
  hint: "Score 0 o «Escluso» = l'alimento non entra in quel pasto; il resto lo fa entrare (il punteggio non pesa nella scelta).",
  hintDefaults:
    "Questo alimento è fuori dalla grammatica: il motore lo tratta senza ruolo. I valori qui sotto sono proposti dai pool scelti: controllali e salva.",
  copyLunchToDinner: "Copia pranzo → cena",
  role: "Ruolo",
  score: "Score 0-10",
  preWorkout: "Score pre-allenamento",
  postWorkout: "Score post-allenamento",
  macroRole: "Ruolo macro dominante",
  frequency: "Frequenza",
  maxWeek: "Max volte / settimana",
  maxWeekPh: "vuoto = nessun tetto",
  prepSpeed: "Velocità di preparazione 0-10",
  prepSpeedPh: "vuoto = n/d",
  sourceLine: (source: string, updated: string | null) =>
    `Fonte: ${source}${updated ? ` · aggiornato ${updated}` : ""}`,
} as const;

const INPUT =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-amber-400/60 focus:outline-none";
const LABEL = "mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-500";
const SECTION = "font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-400";

/**
 * Stato form della grammatica: stringhe per gli input numerici (così l'utente può
 * svuotare il campo mentre digita), stringhe per le select. La conversione verso il
 * body `meal_roles` e la validazione vera stanno in `mealRolesDraftToBody` +
 * `validateMenuFoodMealRoles` (lib/admin).
 */
export type MealRolesDraft = {
  score_breakfast: string;
  score_snack: string;
  score_lunch: string;
  score_dinner: string;
  score_pre_workout: string;
  score_post_workout: string;
  role_breakfast: string;
  role_snack: string;
  role_lunch: string;
  role_dinner: string;
  macro_role: string;
  frequency: string;
  max_week: string;
  prep_speed: string;
};

export function mealRolesDraftFromInput(v: MenuFoodMealRolesInput): MealRolesDraft {
  return {
    score_breakfast: String(v.score_breakfast),
    score_snack: String(v.score_snack),
    score_lunch: String(v.score_lunch),
    score_dinner: String(v.score_dinner),
    score_pre_workout: String(v.score_pre_workout),
    score_post_workout: String(v.score_post_workout),
    role_breakfast: v.role_breakfast,
    role_snack: v.role_snack,
    role_lunch: v.role_lunch,
    role_dinner: v.role_dinner,
    macro_role: v.macro_role,
    frequency: v.frequency,
    max_week: v.max_week == null ? "" : String(v.max_week),
    prep_speed: v.prep_speed == null ? "" : String(v.prep_speed),
  };
}

/** Draft → oggetto grezzo da passare a `validateMenuFoodMealRoles` / al body API. */
export function mealRolesDraftToBody(d: MealRolesDraft): Record<string, unknown> {
  return {
    score_breakfast: d.score_breakfast,
    score_snack: d.score_snack,
    score_lunch: d.score_lunch,
    score_dinner: d.score_dinner,
    score_pre_workout: d.score_pre_workout,
    score_post_workout: d.score_post_workout,
    role_breakfast: d.role_breakfast,
    role_snack: d.role_snack,
    role_lunch: d.role_lunch,
    role_dinner: d.role_dinner,
    macro_role: d.macro_role,
    frequency: d.frequency,
    max_week: d.max_week.trim() === "" ? null : d.max_week,
    prep_speed: d.prep_speed.trim() === "" ? null : d.prep_speed,
  };
}

/**
 * Sezione «Ruoli e punteggi per pasto» condivisa dai dialog Aggiungi/Modifica
 * (stessa UI, stessi hint, stessa conversione). `idPrefix` distingue gli id degli
 * input quando due dialog convivono nella pagina.
 */
export function AdminMenuFoodMealRolesFields({
  draft,
  onChange,
  idPrefix,
  showDefaultsWarning,
  sourceVersion,
  updatedAt,
}: {
  draft: MealRolesDraft;
  onChange: (next: MealRolesDraft) => void;
  idPrefix: string;
  /** true quando l'alimento NON ha riga di score e i valori vengono da `defaultMealRolesFromPools`. */
  showDefaultsWarning: boolean;
  sourceVersion?: string | null;
  updatedAt?: string | null;
}) {
  const set = <K extends keyof MealRolesDraft>(key: K, value: string) => onChange({ ...draft, [key]: value });

  const copyLunchToDinner = () =>
    onChange({ ...draft, role_dinner: draft.role_lunch, score_dinner: draft.score_lunch });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={SECTION}>{COPY.section}</p>
        <button
          type="button"
          onClick={copyLunchToDinner}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[0.65rem] font-medium text-gray-300 transition hover:border-white/25 hover:text-white"
        >
          {COPY.copyLunchToDinner}
        </button>
      </div>
      <p className="text-[0.65rem] text-gray-600">{COPY.hint}</p>
      {showDefaultsWarning ? (
        <p
          className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
          role="status"
        >
          {COPY.hintDefaults}
        </p>
      ) : sourceVersion ? (
        <p className="font-mono text-[0.6rem] text-zinc-600">
          {COPY.sourceLine(sourceVersion, updatedAt ? updatedAt.slice(0, 10) : null)}
        </p>
      ) : null}

      {/* 4 pasti: ruolo + score */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {MENU_FOOD_ROLE_MEALS.map((meal) => {
          const roleKey = `role_${meal}` as const;
          const scoreKey = `score_${meal}` as const;
          const excluded = draft[roleKey] === "EXCLUDE" || Number(draft[scoreKey]) === 0;
          return (
            <div
              key={meal}
              className={cn(
                "rounded-xl border p-3",
                excluded ? "border-white/5 bg-white/[0.02]" : "border-emerald-400/20 bg-emerald-500/[0.04]",
              )}
            >
              <p className="mb-2 text-xs font-semibold text-white">{ROLE_MEAL_LABELS[meal]}</p>
              <div className="grid grid-cols-[1fr_5rem] gap-2">
                <div>
                  <label className={LABEL} htmlFor={`${idPrefix}-${roleKey}`}>
                    {COPY.role}
                  </label>
                  <select
                    id={`${idPrefix}-${roleKey}`}
                    value={draft[roleKey]}
                    onChange={(e) => set(roleKey, e.target.value)}
                    className={INPUT}
                  >
                    {MENU_FOOD_MEAL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {MEAL_ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL} htmlFor={`${idPrefix}-${scoreKey}`}>
                    {COPY.score}
                  </label>
                  <input
                    id={`${idPrefix}-${scoreKey}`}
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={draft[scoreKey]}
                    onChange={(e) => set(scoreKey, e.target.value)}
                    className={cn(INPUT, "text-right font-mono tabular-nums")}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pre/post workout: solo score */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(
          [
            ["score_pre_workout", COPY.preWorkout],
            ["score_post_workout", COPY.postWorkout],
          ] as const
        ).map(([field, label]) => (
          <div key={field}>
            <label className={LABEL} htmlFor={`${idPrefix}-${field}`}>
              {label}
            </label>
            <input
              id={`${idPrefix}-${field}`}
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={draft[field]}
              onChange={(e) => set(field, e.target.value)}
              className={cn(INPUT, "text-right font-mono tabular-nums")}
            />
          </div>
        ))}
      </div>

      {/* Macro role, frequenza, tetto, velocità */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor={`${idPrefix}-macro_role`}>
            {COPY.macroRole}
          </label>
          <select
            id={`${idPrefix}-macro_role`}
            value={draft.macro_role}
            onChange={(e) => set("macro_role", e.target.value)}
            className={INPUT}
          >
            {MENU_FOOD_MACRO_ROLES.map((r) => (
              <option key={r} value={r}>
                {MACRO_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor={`${idPrefix}-frequency`}>
            {COPY.frequency}
          </label>
          <select
            id={`${idPrefix}-frequency`}
            value={draft.frequency}
            onChange={(e) => set("frequency", e.target.value)}
            className={INPUT}
          >
            {MENU_FOOD_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor={`${idPrefix}-max_week`}>
            {COPY.maxWeek}
          </label>
          <input
            id={`${idPrefix}-max_week`}
            type="number"
            min={1}
            max={7}
            step={1}
            value={draft.max_week}
            onChange={(e) => set("max_week", e.target.value)}
            placeholder={COPY.maxWeekPh}
            className={cn(INPUT, "text-right font-mono tabular-nums")}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor={`${idPrefix}-prep_speed`}>
            {COPY.prepSpeed}
          </label>
          <input
            id={`${idPrefix}-prep_speed`}
            type="number"
            min={0}
            max={10}
            step={1}
            value={draft.prep_speed}
            onChange={(e) => set("prep_speed", e.target.value)}
            placeholder={COPY.prepSpeedPh}
            className={cn(INPUT, "text-right font-mono tabular-nums")}
          />
        </div>
      </div>
    </section>
  );
}
