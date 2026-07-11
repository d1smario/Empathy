export type TodayEventType =
  | "wake"
  | "hydration"
  | "supplement"
  | "meal"
  | "snack"
  | "workout"
  | "sleep";

export type TodayEventStatus = "done" | "current" | "todo" | "skipped";

export type TodayEventAction = {
  key: string;
  label: string;
  i18nKey?: string;
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
};

export type TodayEvent = {
  id: string;
  type: TodayEventType;
  time: string | null; // HH:MM o null per eventi "floating"
  title: string;
  titleKey?: string;
  subtitle?: string;
  subtitleKey?: string;
  status: TodayEventStatus;
  accent?: "violet" | "orange" | "cyan" | "emerald" | "amber" | "fuchsia" | "slate";
  data?: Record<string, unknown>;
  items?: TodayFoodItem[];
  actions?: TodayEventAction[];
};

export type TodayHydration = {
  targetMl: number;
  currentMl: number;
  minDailyMl?: number | null;
};

export type TodayReadiness = {
  score: number | null;
  label: string | null;
};

export type TodayFoodItem = {
  mealSlot?: string;
  foodLabel: string;
  quantityG: number;
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  /** Ruolo macro sintetico (icona/colore di fallback quando manca l'immagine). */
  macroRole?: "cho_heavy" | "protein" | "fat" | "veg" | "mixed";
  /** Immagine alimento (libreria/fdc_food) se disponibile. */
  imageUrl?: string | null;
};

export type TodayFloatingWorkout = {
  id: string;
  title: string;
  subtitle?: string;
  durationMinutes: number;
};

/** Aggiustamento adattivo del giorno (reintegro/riduzione) — extra sopra il piano base. */
export type TodayAdjustment = {
  kind: "reintegration" | "reduction";
  extraKcal: number;
  extraCarbsG: number;
  extraWaterMl: number;
  supplements: string[];
  reason: string | null;
};

export type TomorrowPreview = {
  date: string;
  workoutTitle: string | null;
  workoutTime: string | null;
  mainMealTimes: string[];
};

export type TodayApiResponse =
  | {
      ok: true;
      date: string;
      athleteId: string;
      firstName: string | null;
      nutritionConfig: Record<string, unknown>;
      routineConfig: Record<string, unknown>;
      readiness: TodayReadiness;
      hydration: TodayHydration;
      events: TodayEvent[];
      floatingWorkout: TodayFloatingWorkout | null;
      tomorrow: TomorrowPreview | null;
      adjustments: TodayAdjustment[];
    }
  | {
      ok: false;
      error: string;
    };
