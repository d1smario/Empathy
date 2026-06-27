/**
 * Forma del draft `form` dell'editor profilo (ProfilePageView).
 *
 * Tipo strutturalmente identico all'oggetto della `useState(form)` nel padre
 * (tutti i campi sono string). Le sezioni render-only lo usano per tipizzare le
 * props `form`/`setForm` senza importare dal padre (no cicli) e senza cast: il
 * padre può passare il suo `typeof form` direttamente.
 */
export type ProfileFormState = {
  first_name: string;
  last_name: string;
  email: string;
  birth_date: string;
  sex: string;
  timezone: string;
  activity_level: string;
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
  food_preferences: string;
  food_exclusions: string;
  intolerances: string;
  allergies: string;
  supplements: string;
  supplement_brands: string;
};
