"use client";

import { cn } from "@/lib/cn";
import {
  MENU_FOOD_BREAKFAST_CHO_ROLES,
  MENU_FOOD_BREAKFAST_FAT_ROLES,
  MENU_FOOD_BREAKFAST_PROTEIN_ROLES,
  MENU_FOOD_FREQUENCIES,
  MENU_FOOD_GENERATIVE_TIERS,
  MENU_FOOD_MACRO_ROLES,
  MENU_FOOD_MAIN_MEAL_ROLES,
  MENU_FOOD_MEAL_ROLES,
  MENU_FOOD_MEDITERRANEAN_PRIORITIES,
  MENU_FOOD_ROLE_MEALS,
  MENU_FOOD_SNACK_ROLES,
  MENU_FOOD_SUBSTITUTION_MODES,
  type MenuFoodMealRolesInput,
} from "@/lib/admin/menu-food-meal-roles-validation";
import {
  BREAKFAST_CHO_ROLE_LABELS,
  BREAKFAST_FAT_ROLE_LABELS,
  BREAKFAST_PROTEIN_ROLE_LABELS,
  FREQUENCY_LABELS,
  GENERATIVE_TIER_LABELS,
  MACRO_ROLE_LABELS,
  MAIN_MEAL_ROLE_LABELS,
  MEAL_ROLE_LABELS,
  MEDITERRANEAN_PRIORITY_LABELS,
  ROLE_MEAL_LABELS,
  SNACK_ROLE_LABELS,
  SUBSTITUTION_MODE_LABELS,
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
  sectionV6: "Ruoli v6 (sistema Mario v6)",
  hintV6:
    "Il motore legge QUESTI ruoli (v6): i ruoli per pasto qui sopra restano come storico v5. «Nessuno» = l'alimento non copre quell'asse.",
  bChoRole: "Colazione — asse CHO",
  bProRole: "Colazione — asse proteico",
  bFatRole: "Colazione — asse grassi",
  mainRole: "Pranzo e cena (ruolo unico)",
  snackRole: "Spuntino",
  medPriority: "Priorità mediterranea (ordinamento)",
  substitutionGroup: "Gruppo di sostituzione",
  substitutionGroupPh: "es. FRUIT, FISH_LEAN (vuoto = nessuno)",
  generativeNote: "Nota generativa (Mario)",
  generativeNotePh: "vincolo testuale, informativo",
  sectionV9: "Generativo (v9, CORE-first)",
  hintV9:
    "Il tier è la prima chiave di scelta (Core prima di tutto, Varietà max 1 per pasto, Escluso mai generato). «Abilitato: No» = mai da solo, ma resta usabile dentro le ricette. Il peso è salvato ma non ancora usato dal motore.",
  generativeTier: "Tier generativo",
  defaultEnabled: "Abilitato di default",
  enabledYes: "Sì",
  enabledNo: "No (solo in ricetta)",
  selectionWeight: "Peso di selezione 0-100",
  selectionWeightPh: "vuoto = n/d",
  substitutionMode: "Modalità di sostituzione",
  substitutionModeNone: "Default (kcal)",
  substitutePool: "Pool sostituti",
  substitutePoolPh: "es. MAIN_PROTEIN (vuoto = nessuno)",
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
  // v6
  breakfast_cho_role: string;
  breakfast_protein_role: string;
  breakfast_fat_role: string;
  main_meal_role: string;
  snack_role: string;
  mediterranean_priority: string;
  substitution_group: string;
  generative_note: string;
  // v9
  generative_tier: string;
  default_enabled: string;
  selection_weight: string;
  substitution_mode: string;
  substitute_pool: string;
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
    // v6: una riga v5 (senza colonne nuove) parte dai default DB, mai undefined nel form.
    breakfast_cho_role: v.breakfast_cho_role ?? "NONE",
    breakfast_protein_role: v.breakfast_protein_role ?? "NONE",
    breakfast_fat_role: v.breakfast_fat_role ?? "NONE",
    main_meal_role: v.main_meal_role ?? "NONE",
    snack_role: v.snack_role ?? "NONE",
    mediterranean_priority: v.mediterranean_priority ?? "COMMON",
    substitution_group: v.substitution_group ?? "",
    generative_note: v.generative_note ?? "",
    // v9: stessi default DB della DDL 20260821090000.
    generative_tier: v.generative_tier ?? "VARIETY",
    default_enabled: v.default_enabled === false ? "false" : "true",
    selection_weight: v.selection_weight == null ? "" : String(v.selection_weight),
    substitution_mode: v.substitution_mode ?? "",
    substitute_pool: v.substitute_pool ?? "",
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
    breakfast_cho_role: d.breakfast_cho_role,
    breakfast_protein_role: d.breakfast_protein_role,
    breakfast_fat_role: d.breakfast_fat_role,
    main_meal_role: d.main_meal_role,
    snack_role: d.snack_role,
    mediterranean_priority: d.mediterranean_priority,
    substitution_group: d.substitution_group.trim() === "" ? null : d.substitution_group,
    generative_note: d.generative_note.trim() === "" ? null : d.generative_note,
    generative_tier: d.generative_tier,
    default_enabled: d.default_enabled === "false" ? false : true,
    selection_weight: d.selection_weight.trim() === "" ? null : d.selection_weight,
    substitution_mode: d.substitution_mode.trim() === "" ? null : d.substitution_mode,
    substitute_pool: d.substitute_pool.trim() === "" ? null : d.substitute_pool,
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

      {/* Ruoli v6 (sistema Mario v6): il motore legge questi */}
      <div className="space-y-3 rounded-xl border border-sky-400/20 bg-sky-500/[0.04] p-3">
        <p className={SECTION}>{COPY.sectionV6}</p>
        <p className="text-[0.65rem] text-gray-600">{COPY.hintV6}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(
            [
              ["breakfast_cho_role", COPY.bChoRole, MENU_FOOD_BREAKFAST_CHO_ROLES, BREAKFAST_CHO_ROLE_LABELS],
              ["breakfast_protein_role", COPY.bProRole, MENU_FOOD_BREAKFAST_PROTEIN_ROLES, BREAKFAST_PROTEIN_ROLE_LABELS],
              ["breakfast_fat_role", COPY.bFatRole, MENU_FOOD_BREAKFAST_FAT_ROLES, BREAKFAST_FAT_ROLE_LABELS],
              ["main_meal_role", COPY.mainRole, MENU_FOOD_MAIN_MEAL_ROLES, MAIN_MEAL_ROLE_LABELS],
              ["snack_role", COPY.snackRole, MENU_FOOD_SNACK_ROLES, SNACK_ROLE_LABELS],
              ["mediterranean_priority", COPY.medPriority, MENU_FOOD_MEDITERRANEAN_PRIORITIES, MEDITERRANEAN_PRIORITY_LABELS],
            ] as const
          ).map(([field, label, values, labels]) => (
            <div key={field}>
              <label className={LABEL} htmlFor={`${idPrefix}-${field}`}>
                {label}
              </label>
              <select
                id={`${idPrefix}-${field}`}
                value={draft[field]}
                onChange={(e) => set(field, e.target.value)}
                className={INPUT}
              >
                {values.map((v) => (
                  <option key={v} value={v}>
                    {(labels as Record<string, string>)[v] ?? v}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div>
            <label className={LABEL} htmlFor={`${idPrefix}-substitution_group`}>
              {COPY.substitutionGroup}
            </label>
            <input
              id={`${idPrefix}-substitution_group`}
              type="text"
              value={draft.substitution_group}
              onChange={(e) => set("substitution_group", e.target.value)}
              placeholder={COPY.substitutionGroupPh}
              className={cn(INPUT, "font-mono text-xs uppercase")}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor={`${idPrefix}-generative_note`}>
              {COPY.generativeNote}
            </label>
            <input
              id={`${idPrefix}-generative_note`}
              type="text"
              value={draft.generative_note}
              onChange={(e) => set("generative_note", e.target.value)}
              placeholder={COPY.generativeNotePh}
              className={INPUT}
            />
          </div>
        </div>
      </div>

      {/* Generativo v9 (tier CORE-first): il motore ordina i pick su questo tier */}
      <div className="space-y-3 rounded-xl border border-violet-400/20 bg-violet-500/[0.04] p-3">
        <p className={SECTION}>{COPY.sectionV9}</p>
        <p className="text-[0.65rem] text-gray-600">{COPY.hintV9}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor={`${idPrefix}-generative_tier`}>
              {COPY.generativeTier}
            </label>
            <select
              id={`${idPrefix}-generative_tier`}
              value={draft.generative_tier}
              onChange={(e) => set("generative_tier", e.target.value)}
              className={INPUT}
            >
              {MENU_FOOD_GENERATIVE_TIERS.map((t) => (
                <option key={t} value={t}>
                  {GENERATIVE_TIER_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor={`${idPrefix}-default_enabled`}>
              {COPY.defaultEnabled}
            </label>
            <select
              id={`${idPrefix}-default_enabled`}
              value={draft.default_enabled}
              onChange={(e) => set("default_enabled", e.target.value)}
              className={INPUT}
            >
              <option value="true">{COPY.enabledYes}</option>
              <option value="false">{COPY.enabledNo}</option>
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor={`${idPrefix}-selection_weight`}>
              {COPY.selectionWeight}
            </label>
            <input
              id={`${idPrefix}-selection_weight`}
              type="number"
              min={0}
              max={100}
              step={1}
              value={draft.selection_weight}
              onChange={(e) => set("selection_weight", e.target.value)}
              placeholder={COPY.selectionWeightPh}
              className={cn(INPUT, "text-right font-mono tabular-nums")}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor={`${idPrefix}-substitution_mode`}>
              {COPY.substitutionMode}
            </label>
            <select
              id={`${idPrefix}-substitution_mode`}
              value={draft.substitution_mode}
              onChange={(e) => set("substitution_mode", e.target.value)}
              className={INPUT}
            >
              <option value="">{COPY.substitutionModeNone}</option>
              {MENU_FOOD_SUBSTITUTION_MODES.map((m) => (
                <option key={m} value={m}>
                  {SUBSTITUTION_MODE_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor={`${idPrefix}-substitute_pool`}>
              {COPY.substitutePool}
            </label>
            <input
              id={`${idPrefix}-substitute_pool`}
              type="text"
              value={draft.substitute_pool}
              onChange={(e) => set("substitute_pool", e.target.value)}
              placeholder={COPY.substitutePoolPh}
              className={cn(INPUT, "font-mono text-xs uppercase")}
            />
          </div>
        </div>
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
