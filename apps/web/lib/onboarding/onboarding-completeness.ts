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
 *
 * DUE ASSI, non uno. `category` dice QUANTO pesa la voce nell'onboarding (è il gate di
 * `planReady`, cioè della sala d'attesa e del cron D3, e resta invariato); `blocks` dice
 * QUALE motore la consuma davvero. Servono entrambi perché una singola pagina di dominio
 * (Nutrizione) non deve bloccarsi su un dato che solo l'altro dominio (Training) legge:
 * era il bug per cui «Giorni di allenamento/settimana» impediva il piano ALIMENTARE pur
 * non essendo letto da una sola riga di `lib/nutrition`.
 */

import type { CalendarTrainingVolume } from "@/lib/training/calendar-training-volume";

export type OnboardingCategory = "required" | "recommended" | "optional";
/** Il piano che una voce mancante impedisce davvero di generare. */
export type OnboardingPlanKind = "training" | "nutrition";
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
  /**
   * Volume osservato nel CALENDARIO del coach (`planned_workouts`) — vedi
   * `lib/training/calendar-training-volume.ts` per finestra e conteggi. `null` = il
   * calendario non dice nulla nella finestra.
   *
   * Perché sta qui: un requisito è soddisfatto quando il sistema CONOSCE il dato, non
   * quando l'atleta l'ha digitato. Se il coach gli ha già scritto le sedute, chiedergli
   * «quanti giorni ti alleni?» è chiedere una cosa che sappiamo già — ed è ciò che teneva
   * l'atleta parcheggiato in `/onboarding`.
   */
  calendarVolume: CalendarTrainingVolume | null;
};

export type OnboardingItemSpec = {
  key: string;
  /** Etichetta breve mostrata all'atleta. */
  label: string;
  group: OnboardingGroup;
  category: OnboardingCategory;
  /**
   * Motori che leggono DAVVERO questo dato — verificato campo per campo con grep su
   * `lib/nutrition` e `lib/training`, non dedotto dall'etichetta. Array VUOTO = nessuno
   * dei due motori lo esige (resta un dato di onboarding, non un gate di dominio).
   * Usato da `itemsBlockingPlan` per il blocco di una singola pagina; NON entra in
   * `planReady`, che continua a pretendere tutti i `required` come prima.
   */
  blocks: readonly OnboardingPlanKind[];
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
  // `sex` → SOLO nutrizione: offset di Mifflin in lib/nutrition/daily-energy-solver.ts:186
  // (BMR di ripiego quando manca la massa grassa). Nessun file di lib/training lo legge.
  { key: "sex", label: "Sesso", group: "identity", category: "required", blocks: ["nutrition"],
    unlocks: "Metabolismo basale e frequenze cardiache di riferimento", href: "/profile#anagrafica",
    present: (s) => str(p(s).sex) },
  // `birth_date` → SOLO nutrizione: deriveAgeYears (daily-energy-solver.ts:141) → Mifflin
  // (riga 249). Nessun file di lib/training lo legge.
  { key: "birth_date", label: "Data di nascita", group: "identity", category: "required", blocks: ["nutrition"],
    unlocks: "Età → BMR e FC max teorica", href: "/profile#anagrafica",
    present: (s) => str(p(s).birth_date) },
  // `timezone` → SOLO nutrizione fra i due motori: confini del giorno nel loop adattivo
  // (lib/nutrition/reduction-run.ts:118, nowLocalMinutes). lib/training non lo legge.
  { key: "timezone", label: "Fuso orario", group: "identity", category: "required", blocks: ["nutrition"],
    unlocks: "Confini del giorno, orario della mail, sblocco del piano", href: "/profile#anagrafica",
    present: (s) => str(p(s).timezone) },
  // Corpo
  // `weight_kg` → SOLO nutrizione: ancora del BMR (daily-energy-solver.ts:169) e minimo
  // idrico peso×33 (lib/nutrition/hydration-target.ts:18). In lib/training i soli `weightKg`
  // sono i carichi in sala del Builder, non il peso corporeo.
  { key: "weight_kg", label: "Peso", group: "body", category: "required", blocks: ["nutrition"],
    unlocks: "BMR, fabbisogno energetico e idrico, porzioni", href: "/profile#corpo",
    present: (s) => num(p(s).weight_kg) },
  // `height_cm` → SOLO nutrizione: unico consumatore è Mifflin (daily-energy-solver.ts:182).
  { key: "height_cm", label: "Altezza", group: "body", category: "required", blocks: ["nutrition"],
    unlocks: "BMR (equazione di Mifflin)", href: "/profile#corpo",
    present: (s) => num(p(s).height_cm) },
  // `body_fat_pct` → nutrizione: massa magra per Katch-McArdle (daily-energy-solver.ts:171).
  { key: "body_fat_pct", label: "Massa grassa %", group: "body", category: "recommended", blocks: ["nutrition"],
    unlocks: "Affina il BMR (Katch-McArdle) e la composizione", href: "/profile#corpo",
    present: (s) => num(p(s).body_fat_pct) },
  // `muscle_mass_kg` → nutrizione: lib/nutrition/nutrition-module-daily-energy.ts:57.
  { key: "muscle_mass_kg", label: "Massa muscolare", group: "body", category: "recommended", blocks: ["nutrition"],
    unlocks: "Composizione corporea e ripartizione proteica", href: "/profile#corpo",
    present: (s) => num(p(s).muscle_mass_kg) },
  // Fisiologia (soglie FC — l'FTP vive nei lab, resta opzionale)
  // `resting_hr_bpm` → training: zone e recovery profile (lib/physiology/profile-resolver.ts:399
  // e :409). In lib/nutrition l'unico `restingHrBpm` è un campo del view-model della pagina
  // (nutrition-view-types.ts:26), alimentato dal device, non dal profilo: il motore non lo usa.
  { key: "resting_hr_bpm", label: "FC a riposo", group: "physiology", category: "required", blocks: ["training"],
    unlocks: "Zone di allenamento e baseline HRV", href: "/profile#fisiologia",
    present: (s) => num(p(s).resting_hr_bpm) },
  // `max_hr_bpm` → training: hrMax del render profile L2 (lib/training/l2/athlete-render-profile.ts:113,126).
  { key: "max_hr_bpm", label: "FC massima", group: "physiology", category: "required", blocks: ["training"],
    unlocks: "Zone di intensità del training", href: "/profile#fisiologia",
    present: (s) => num(p(s).max_hr_bpm) },
  // `threshold_hr_bpm` → training: header FC soglia dell'export seduta Wahoo
  // (lib/integrations/wahoo-plan-from-generated-session.ts:132). Zero letture in lib/nutrition.
  { key: "threshold_hr_bpm", label: "FC soglia", group: "physiology", category: "recommended", blocks: ["training"],
    unlocks: "Zone più precise attorno alla soglia", href: "/profile#fisiologia",
    present: (s) => num(p(s).threshold_hr_bpm) },
  // Device
  // `device` → NESSUN motore lo esige. Il piano alimentare DEGRADA senza: loadObservedActiveKcal
  // (lib/nutrition/load-observed-active-kcal.ts:22) torna null e il solver ricade sulla stima
  // pianificata (daily-energy-solver.ts:415). Resta `required` per l'onboarding (i consumi reali
  // sono la promessa del prodotto), ma non blocca la generazione di nessuno dei due piani.
  { key: "device", label: "Dispositivo collegato e attivo", group: "device", category: "required", blocks: [],
    unlocks: "Wellness reale (sonno, HRV, FC, kcal attive) e consumi effettivi", href: "/profile#devices",
    present: (s) => s.deviceFed },
  // Routine / obiettivo
  // `goals` → training: goalText della settimana (lib/training/generate-training-week-headless.ts:158),
  // materialize-training-macro.ts:265, propose-training-macro.ts:227. Zero letture in lib/nutrition.
  { key: "goals", label: "Obiettivo", group: "routine", category: "required", blocks: ["training"],
    unlocks: "Struttura e finalità del piano di allenamento", href: "/profile#routine",
    present: (s) => arr(p(s).goals) || str(p(s).goals) },
  // `training_days_per_week` → SOLO training: sessioni della settimana
  // (deriveTrainingWeekParams) e propose-training-macro.ts.
  // SODDISFATTO ANCHE DAL CALENDARIO: se il coach ha già messo sedute nella finestra
  // osservata, il numero di giorni allenabili è un FATTO, e chiedere all'atleta di
  // digitarlo significa chiedergli un dato che il sistema HA GIÀ (era la ragione per cui
  // restava parcheggiato in /onboarding). Affiancare, non sostituire: il campo di profilo
  // continua a soddisfare il requisito da solo, per l'atleta senza coach.
  //
  // Qui il calendario ha un ruolo DELIBERATAMENTE più debole che nel generatore: là la
  // domanda è «quale valore uso» (e la risposta è un `max`, vedi deriveTrainingWeekParams),
  // qui è solo «il sistema conosce il dato?» → OR puro. Essendo un OR, nessun atleta può
  // PERDERE la prontezza per questa modifica. E una soglia qui non serve: anche una sola
  // seduta in calendario sblocca la sala d'attesa, ma il piano che ne esce è dimensionato
  // sul pavimento dichiarato (il `max` del generatore), quindi non peggiore di quello di un
  // qualunque atleta senza questi campi. Sbloccare presto costa poco; tenere l'atleta
  // parcheggiato a chiedergli un dato già noto costava molto.
  { key: "training_days_per_week", label: "Giorni di allenamento/settimana", group: "routine", category: "required", blocks: ["training"],
    unlocks: "Volume settimanale del piano", href: "/profile#routine",
    present: (s) => num(p(s).training_days_per_week) || (s.calendarVolume?.daysPerWeek ?? 0) >= 1 },
  // `training_max_session_minutes` → SOLO training: hoursTarget (deriveTrainingWeekParams)
  // e cap durata L2 (l2/athlete-render-profile.ts:128).
  // SODDISFATTO ANCHE DAL CALENDARIO: la durata delle sedute pianificate dice quanto dura
  // una seduta di questo atleta. Attenzione alla differenza di RUOLO fra i due punti: qui
  // il calendario serve solo a dire «il dato esiste»; nel generatore il campo dichiarato
  // resta un TETTO e vince se è più restrittivo di quanto c'è in calendario.
  //
  // ⚠️ PORTATA ESATTA, per non promettere più del vero: dei due consumatori citati sopra,
  // il calendario raggiunge SOLO `deriveTrainingWeekParams`. Il cap L2
  // (`l2/athlete-render-profile.ts:128`) legge esclusivamente la colonna di profilo, quindi
  // per un atleta sbloccato dal solo calendario resta `null`, cioè «nessun cap esplicito».
  // È voluto e non è una svista: un cap è una RESTRIZIONE, e la legge di questa fonte è che
  // il calendario può solo AGGIUNGERE prova, mai toglierne — dedurre un tetto dalle sedute
  // osservate impedirebbe a L2 di proporre un lungo a chi finora ha fatto solo sedute brevi.
  // Quell'atleta resta quindi nello stesso stato della maggioranza (campo mai compilato),
  // che è esattamente ciò che il gate promette: il sistema sa abbastanza per costruire, non
  // che l'atleta abbia dichiarato un limite.
  { key: "training_max_session_minutes", label: "Durata max seduta", group: "routine", category: "required", blocks: ["training"],
    unlocks: "Durata e struttura delle sedute", href: "/profile#routine",
    present: (s) => num(p(s).training_max_session_minutes) || num(s.calendarVolume?.maxSessionMinutes) },
  // Nutrizione
  // `diet_type` → SOLO nutrizione: vincoli MANDATORY del composer
  // (lib/nutrition/deterministic-meal-plan-from-request.ts:144) e deny-fragments
  // (meal-plan-profile-food-filter.ts:99).
  { key: "diet_type", label: "Tipo di dieta", group: "nutrition", category: "required", blocks: ["nutrition"],
    unlocks: "Selezione degli alimenti del motore nutrizione", href: "/profile#nutrizione",
    present: (s) => str(p(s).diet_type) },
  // `preferred_meal_count` → nutrizione: lib/nutrition/nutrition-module-profile-merge.ts:126.
  { key: "preferred_meal_count", label: "Numero di pasti", group: "nutrition", category: "recommended", blocks: ["nutrition"],
    unlocks: "Ripartizione del piano nei pasti", href: "/profile#nutrizione",
    present: (s) => num(p(s).preferred_meal_count) },
  // `intolerances/allergies/food_exclusions/food_preferences` → nutrizione:
  // meal-plan-profile-food-filter.ts (denyFragments del composer).
  { key: "food_constraints", label: "Intolleranze / allergie / esclusioni", group: "nutrition", category: "recommended", blocks: ["nutrition"],
    unlocks: "Esclusioni e preferenze applicate al piano", href: "/profile#nutrizione",
    present: (s) => arr(p(s).intolerances) || arr(p(s).allergies) || arr(p(s).food_exclusions) || arr(p(s).food_preferences) },
  // Opzionali (arricchiscono l'analisi, non il piano generato — fuori dal progresso)
  // `ftp` → ENTRAMBI: nutrizione via loadNutritionAthleteProfile.ftpWatts nel solver
  // (daily-energy-solver.ts:203,406) e training via l2/athlete-render-profile.ts:125.
  { key: "ftp", label: "FTP / soglia metabolica", group: "physiology", category: "optional", blocks: ["training", "nutrition"],
    unlocks: "Qualità reale del training (oggi dai lab Physiology)", href: "/physiology",
    present: (s) => s.hasFtp },
  // `blood_panel` → nutrizione: ponte micronutrienti (lib/nutrition/health-lab-pathway-bridge.ts:131).
  { key: "blood_panel", label: "Analisi del sangue", group: "body", category: "optional", blocks: ["nutrition"],
    unlocks: "Arricchisce l'analisi biologica (non cambia il piano)", href: "/health",
    present: (s) => s.hasBloodPanel },
] as const;

export type OnboardingItemResult = {
  key: string;
  label: string;
  group: OnboardingGroup;
  category: OnboardingCategory;
  /** Copia di `OnboardingItemSpec.blocks`: serve a filtrare i mancanti per dominio. */
  blocks: readonly OnboardingPlanKind[];
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
    blocks: spec.blocks,
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

/**
 * Filtra un elenco di voci tenendo SOLO quelle che vincolano il piano indicato.
 *
 * Perché non è dentro `computeOnboardingCompleteness`: il risultato del motore è lo stesso
 * di prima per tutti (sala d'attesa, mail, cron D3 — che continuano a leggere `required`
 * per intero e `planReady`). Chi blocca UNA superficie di dominio, invece, passa di qui:
 *   itemsBlockingPlan(completeness.required.missing, "nutrition")
 * Puro e generico sull'elemento: si testa anche su voci sintetiche.
 */
export function itemsBlockingPlan<T extends { blocks: readonly OnboardingPlanKind[] }>(
  items: readonly T[],
  plan: OnboardingPlanKind,
): T[] {
  return items.filter((i) => i.blocks.includes(plan));
}
