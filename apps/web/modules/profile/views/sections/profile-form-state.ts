/**
 * Forma del draft `form` dell'editor profilo (ProfilePageView).
 *
 * Tipo strutturalmente identico all'oggetto della `useState(form)` nel padre
 * (tutti i campi sono string). Le sezioni render-only lo usano per tipizzare le
 * props `form`/`setForm` senza importare dal padre (no cicli) e senza cast: il
 * padre può passare il suo `typeof form` direttamente.
 */
/**
 * Chips canonici «Obiettivo / focus» (valori IT come persistiti in
 * `athlete_profiles.goals` string[]; il generatore settimana li legge via
 * `deriveTrainingWeekParams` / onboarding-completeness). Le etichette UI sono
 * chiavi i18n in `ProfilePersonalSection.goalOption*`.
 */
export const PROFILE_GOAL_OPTIONS = ["performance", "salute", "dimagrimento", "gara", "resistenza"] as const;

export type ProfileFormState = {
  first_name: string;
  last_name: string;
  email: string;
  birth_date: string;
  sex: string;
  timezone: string;
  activity_level: string;
  /** Obiettivi canonici selezionati (CSV di valori `PROFILE_GOAL_OPTIONS`). */
  goals: string;
  /** Obiettivo/focus in testo libero (facoltativo, entra in `goals` al salvataggio). */
  goal_note: string;
  height_cm: string;
  weight_kg: string;
  body_fat_pct: string;
  muscle_mass_kg: string;
  resting_hr_bpm: string;
  max_hr_bpm: string;
  threshold_hr_bpm: string;
  training_days_per_week: string;
  training_max_session_minutes: string;
  wake_time: string;
  sleep_time: string;
  breakfast_time: string;
  lunch_time: string;
  dinner_time: string;
  training_slot: string;
  second_session: string;
  race_day: string;
  training_duration_minutes: string;
  training1_start_time: string;
  training1_duration_minutes: string;
  training2_start_time: string;
  training2_duration_minutes: string;
  meal_strategy: string;
  caloric_split_breakfast: string;
  caloric_split_lunch: string;
  caloric_split_dinner: string;
  caloric_split_snacks: string;
  macro_carbs_pct: string;
  macro_protein_pct: string;
  macro_fat_pct: string;
  routine_summary: string;
  lifestyle_activity_class: string;
  diet_type: string;
  cuisines: string;
  preferred_meal_count: string;
  prep_time_minutes: string;
  cooking_skill: string;
  home_cooked_preference: string;
  /**
   * SENZA CAMPO DI SCRITTURA nel tab Alimentazione (riordino di agosto): restano nello
   * stato per il ROUND-TRIP — vengono idratati dal profilo e riscritti al salvataggio,
   * altrimenti il primo salvataggio azzererebbe il dato in DB. Il motore continua a
   * leggerli invariato, ma NON tutti dallo stesso punto: `intolerances` e
   * `food_exclusions` finiscono nel deny (`buildMealPlanFoodDenyFragments` in
   * lib/nutrition/meal-plan-profile-food-filter.ts), mentre `food_preferences` ha un
   * unico consumatore diverso — `lib/nutrition/meal-plan-solver-basis.ts`, che ne fa la
   * riga «Preferenze: …» del solverBasis (superficie tecnica coach/admin).
   *
   *   - food_preferences → l'input CSV era l'unico modo di scrivere qui a mano, ma sulla
   *     STESSA colonna scrivono anche i chip «Cucine preferite». Il campo residuo tiene i
   *     token che NON corrispondono a un chip (`splitFoodPreferences`), così il
   *     salvataggio li riscrive identici e i chip restano deselezionabili: senza quella
   *     divisione l'unione al salvataggio renderebbe la colonna append-only.
   *   - intolerances    → si dichiara con le «classi» allergeniche (nutrition_config);
   *     i valori storici restano visibili e TOGLIBILI dal pannello «Esclusioni salvate
   *     in precedenza».
   *   - food_exclusions → si dichiara col picker «Alimenti da evitare (dal database)»
   *     (nutrition_config.excluded_fdc_foods, colonna DIVERSA). Questa colonna ha ancora
   *     uno scrittore vivo (bottone staff nella scheda pasto), perciò lo stesso pannello
   *     la rende rimuovibile: senza, sarebbe un cricchetto a senso unico.
   */
  food_preferences: string;
  food_exclusions: string;
  intolerances: string;
  /**
   * L'unico testo libero ancora scrivibile del gruppo. ATTENZIONE al contratto: questa
   * colonna è già renderizzata VERBATIM all'atleta come pillola «Allergie: …» nel modulo
   * Nutrizione (lib/nutrition/nutrition-adaptation-sector-strip.ts), quindi la UI qui
   * dev'essere allergen-scoped — serve per gli allergeni che le classi non coprono
   * (crostacei, sesamo, senape, sedano, mais), NON per «il cibo che non mi piace»: quello
   * ha il picker sul catalogo, che non finisce in quella pillola.
   */
  allergies: string;
  supplements: string;
  supplement_brands: string;
};

/**
 * Rimozioni PENDENTI sulle esclusioni storiche (`intolerances` / `food_exclusions`).
 *
 * Perché non si tolgono direttamente da `form`: sono le uniche liste dell'editor che il
 * salvataggio può ACCORCIARE, e l'ultima rimozione scrive NULL sulla colonna — un dato che
 * nessuna UI sa più recuperare. Tenendo l'intenzione separata, `form` resta la copia fedele
 * del DB, la × è annullabile (bottone «ripristina») finché non si preme Salva, e il salvataggio
 * è l'unico punto in cui il dato sparisce davvero.
 */
export type LegacyExclusionRemovals = {
  intolerances: readonly string[];
  food_exclusions: readonly string[];
};

export const EMPTY_LEGACY_REMOVALS: LegacyExclusionRemovals = { intolerances: [], food_exclusions: [] };

/** Campi su cui il pannello «Esclusioni salvate in precedenza» può agire. */
export type LegacyExclusionField = keyof LegacyExclusionRemovals;

/** CSV del form → token puliti e deduplicati (mai null: semplifica il render). */
export function csvTokens(value: string): string[] {
  return [...new Set(value.split(",").map((s) => s.trim()).filter(Boolean))];
}

/** CSV del form meno i token marcati per la rimozione → CSV da salvare. */
export function applyLegacyRemovals(value: string, removed: readonly string[]): string {
  return csvTokens(value).filter((t) => !removed.includes(t)).join(", ");
}

/** Marca/smarca un token: la × è sempre annullabile prima del salvataggio. */
export function toggleLegacyRemoval(
  state: LegacyExclusionRemovals,
  field: LegacyExclusionField,
  token: string,
): LegacyExclusionRemovals {
  const current = state[field];
  const next = current.includes(token) ? current.filter((t) => t !== token) : [...current, token];
  return { ...state, [field]: next };
}
