/**
 * Motore di completezza onboarding — DETERMINISTICO e PURO (nessun I/O, nessuna AI).
 *
 * Data una fotografia dei dati dell'atleta (profilo + segnali device/lab), dice cosa è
 * completo e cosa manca, diviso per priorità. È la FONTE UNICA consumata sia dalla
 * «sala d'attesa» dei 3 giorni (UI) sia dalla mail giornaliera (Postmark) — così le due
 * superfici non possono mai divergere.
 *
 * Priorità:
 *  - required     → blocca la generazione del piano (planReady = false finché mancano)
 *  - recommended  → migliora il piano, non blocca; conta a parte
 *  - optional     → arricchisce l'analisi (FTP, sangue), fuori dal denominatore di progresso
 *
 * La spec dei campi è un ARRAY unico (ONBOARDING_ITEMS): UI ed email disegnano da qui.
 */

export type OnboardingCategory = "required" | "recommended" | "optional";
export type OnboardingGroup = "identity" | "body" | "physiology" | "device" | "routine" | "nutrition";

/** Sottoinsieme di athlete_profiles rilevante per l'onboarding (nomi colonna DB). */
export type OnboardingProfileFields = {
  sex?: string | null;
  birth_date?: string | null;
  timezone?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  body_fat_pct?: number | null;
  muscle_mass_kg?: number | null;
  resting_hr_bpm?: number | null;
  max_hr_bpm?: number | null;
  threshold_hr_bpm?: number | null;
  goals?: unknown;
  training_days_per_week?: number | null;
  training_max_session_minutes?: number | null;
  diet_type?: string | null;
  preferred_meal_count?: number | null;
  intolerances?: unknown;
  allergies?: unknown;
  food_exclusions?: unknown;
  food_preferences?: unknown;
};

/** Fotografia assemblata dal loader (M1.2). Il device è due segnali distinti:
 *  «collegato» (OAuth attivo) e «alimentato» (righe recenti in device_sync_exports). */
export type OnboardingSnapshot = {
  profile: OnboardingProfileFields | null;
  deviceConnected: boolean;
  deviceFed: boolean;
  hasFtp: boolean;
  hasBloodPanel: boolean;
};

export type OnboardingItemSpec = {
  key: string;
  /** Etichetta breve mostrata all'atleta. */
  label: string;
  group: OnboardingGroup;
  category: OnboardingCategory;
  /** Cosa sblocca o migliora — mostrato come «perché serve». */
  unlocks: string;
  /** Deep-link relativo alla superficie dove si completa (per la UI). */
  href: string;
  present: (s: OnboardingSnapshot) => boolean;
};

/* ── helper di presenza (robusti ai null e alle stringhe vuote) ── */
function num(v: unknown): boolean {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0;
}
function str(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}
function arr(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0;
}
function p(s: OnboardingSnapshot): OnboardingProfileFields {
  return s.profile ?? {};
}

/**
 * Spec unica dei campi onboarding. L'ordine è quello di presentazione.
 * `required` = il set minimo per generare un piano credibile sui dati reali (decisioni A/B/C).
 */
export const ONBOARDING_ITEMS: readonly OnboardingItemSpec[] = [
  // Identità
  { key: "sex", label: "Sesso", group: "identity", category: "required",
    unlocks: "Metabolismo basale e frequenze cardiache di riferimento", href: "/profile#anagrafica",
    present: (s) => str(p(s).sex) },
  { key: "birth_date", label: "Data di nascita", group: "identity", category: "required",
    unlocks: "Età → BMR e FC max teorica", href: "/profile#anagrafica",
    present: (s) => str(p(s).birth_date) },
  { key: "timezone", label: "Fuso orario", group: "identity", category: "required",
    unlocks: "Confini del giorno, orario della mail, sblocco del piano", href: "/profile#anagrafica",
    present: (s) => str(p(s).timezone) },
  // Corpo
  { key: "weight_kg", label: "Peso", group: "body", category: "required",
    unlocks: "BMR, fabbisogno energetico e idrico, porzioni", href: "/profile#corpo",
    present: (s) => num(p(s).weight_kg) },
  { key: "height_cm", label: "Altezza", group: "body", category: "required",
    unlocks: "BMR (equazione di Mifflin)", href: "/profile#corpo",
    present: (s) => num(p(s).height_cm) },
  { key: "body_fat_pct", label: "Massa grassa %", group: "body", category: "recommended",
    unlocks: "Affina il BMR (Katch-McArdle) e la composizione", href: "/profile#corpo",
    present: (s) => num(p(s).body_fat_pct) },
  { key: "muscle_mass_kg", label: "Massa muscolare", group: "body", category: "recommended",
    unlocks: "Composizione corporea e ripartizione proteica", href: "/profile#corpo",
    present: (s) => num(p(s).muscle_mass_kg) },
  // Fisiologia (soglie FC — l'FTP vive nei lab, resta opzionale)
  { key: "resting_hr_bpm", label: "FC a riposo", group: "physiology", category: "required",
    unlocks: "Zone di allenamento e baseline HRV", href: "/profile#fisiologia",
    present: (s) => num(p(s).resting_hr_bpm) },
  { key: "max_hr_bpm", label: "FC massima", group: "physiology", category: "required",
    unlocks: "Zone di intensità del training", href: "/profile#fisiologia",
    present: (s) => num(p(s).max_hr_bpm) },
  { key: "threshold_hr_bpm", label: "FC soglia", group: "physiology", category: "recommended",
    unlocks: "Zone più precise attorno alla soglia", href: "/profile#fisiologia",
    present: (s) => num(p(s).threshold_hr_bpm) },
  // Device
  { key: "device", label: "Dispositivo collegato e attivo", group: "device", category: "required",
    unlocks: "Wellness reale (sonno, HRV, FC, kcal attive) e consumi effettivi", href: "/profile#devices",
    present: (s) => s.deviceFed },
  // Routine / obiettivo
  { key: "goals", label: "Obiettivo", group: "routine", category: "required",
    unlocks: "Struttura e finalità del piano di allenamento", href: "/profile#routine",
    present: (s) => arr(p(s).goals) || str(p(s).goals) },
  { key: "training_days_per_week", label: "Giorni di allenamento/settimana", group: "routine", category: "required",
    unlocks: "Volume settimanale del piano", href: "/profile#routine",
    present: (s) => num(p(s).training_days_per_week) },
  { key: "training_max_session_minutes", label: "Durata max seduta", group: "routine", category: "required",
    unlocks: "Durata e struttura delle sedute", href: "/profile#routine",
    present: (s) => num(p(s).training_max_session_minutes) },
  // Nutrizione
  { key: "diet_type", label: "Tipo di dieta", group: "nutrition", category: "required",
    unlocks: "Selezione degli alimenti del motore nutrizione", href: "/profile#nutrizione",
    present: (s) => str(p(s).diet_type) },
  { key: "preferred_meal_count", label: "Numero di pasti", group: "nutrition", category: "recommended",
    unlocks: "Ripartizione del piano nei pasti", href: "/profile#nutrizione",
    present: (s) => num(p(s).preferred_meal_count) },
  { key: "food_constraints", label: "Intolleranze / allergie / esclusioni", group: "nutrition", category: "recommended",
    unlocks: "Esclusioni e preferenze applicate al piano", href: "/profile#nutrizione",
    present: (s) => arr(p(s).intolerances) || arr(p(s).allergies) || arr(p(s).food_exclusions) || arr(p(s).food_preferences) },
  // Opzionali (arricchiscono l'analisi, non il piano generato — fuori dal progresso)
  { key: "ftp", label: "FTP / soglia metabolica", group: "physiology", category: "optional",
    unlocks: "Qualità reale del training (oggi dai lab Physiology)", href: "/physiology",
    present: (s) => s.hasFtp },
  { key: "blood_panel", label: "Analisi del sangue", group: "body", category: "optional",
    unlocks: "Arricchisce l'analisi biologica (non cambia il piano)", href: "/health",
    present: (s) => s.hasBloodPanel },
] as const;

export type OnboardingItemResult = {
  key: string;
  label: string;
  group: OnboardingGroup;
  category: OnboardingCategory;
  unlocks: string;
  href: string;
  done: boolean;
};

export type OnboardingCompleteness = {
  items: OnboardingItemResult[];
  required: { done: number; total: number; missing: OnboardingItemResult[] };
  recommended: { done: number; total: number };
  optional: { done: number; total: number };
  /** Progresso 0–100 basato SOLO sugli obbligatori (è il gate del piano). */
  progressPct: number;
  /** True quando tutti gli obbligatori sono presenti → il piano può essere generato. */
  planReady: boolean;
};

/** Calcolo puro: nessun effetto collaterale, stesso input → stesso output. */
export function computeOnboardingCompleteness(snapshot: OnboardingSnapshot): OnboardingCompleteness {
  const items: OnboardingItemResult[] = ONBOARDING_ITEMS.map((spec) => ({
    key: spec.key,
    label: spec.label,
    group: spec.group,
    category: spec.category,
    unlocks: spec.unlocks,
    href: spec.href,
    done: spec.present(snapshot),
  }));

  const byCat = (c: OnboardingCategory) => items.filter((i) => i.category === c);
  const req = byCat("required");
  const rec = byCat("recommended");
  const opt = byCat("optional");

  const reqDone = req.filter((i) => i.done).length;
  const progressPct = req.length > 0 ? Math.round((reqDone / req.length) * 100) : 100;

  return {
    items,
    required: { done: reqDone, total: req.length, missing: req.filter((i) => !i.done) },
    recommended: { done: rec.filter((i) => i.done).length, total: rec.length },
    optional: { done: opt.filter((i) => i.done).length, total: opt.length },
    progressPct,
    planReady: reqDone === req.length,
  };
}
