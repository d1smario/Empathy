/**
 * Grammatica dei pasti del nutrizionista (file Mario v6, regole GENERATIVE_RULES_V2)
 * dentro il compositore V2: «la grammatica di Mario, i nostri numeri». Qui vivono le
 * parti PURE (nessun I/O):
 *
 *  - il gate `NUTRITION_MEAL_GRAMMAR_MODE` (off | shadow | on, default shadow);
 *  - il filtro secco per pasto (score 0 → fuori; ruolo v6 per asse — B01/B06/B07,
 *    M02/M03, S01/S03 — con fallback al vocabolario v5 per le entry senza dati v6;
 *    max_week; tetto dolci B05) applicato DENTRO il pool di assemblaggio — e sotto
 *    grammatica un pool del catalogo svuotato NON ricade mai sul pool USDA grezzo (vedi
 *    pickLineForRole nel compositore: ripiego «relaxWeekCaps», poi linea saltata + flag);
 *  - l'ORDINAMENTO a chiavi (B03/M04, decisione 3): mediterranean_priority poi score del
 *    pasto poi la rotazione esistente — mai penalità sottrattiva, mai peso fine;
 *  - le ricette come matrice mista (L04/V02): eleggibilità per pasto, esclusioni sugli
 *    INGREDIENTI, macro per 100 g calcolate dagli ingredienti del catalogo, scala grammi;
 *  - le sostituzioni R01/R02: preferenza per stesso substitution_group / sostituti
 *    espliciti nei punti in cui il motore GIÀ sostituisce, equivalenza in grammi a kcal;
 *  - la provenienza vecchia-vs-nuova per `nutrition_plan.inputs_provenance.meal_grammar`.
 *
 * PERCHÉ il pool resta lo slot e il ruolo è un filtro in più: i pool del catalogo sono già
 * slot×macro (lunch_pro, breakfast_cho…) e in prod combaciano quasi 1:1 con i ruoli di
 * Mario per quel pasto (lunch_pro → PRO_PRIMARY 144 / PRO_SECONDARY 25 / COMPOSITE 2;
 * lunch_veg → FIBER_VEG 33 / FIBER_MICRO_PRIMARY 49; breakfast_cho → CHO_PRIMARY 36,
 * EXCLUDE 3…). Sostituire il pool con il ruolo avrebbe voluto dire rifare l'assemblaggio
 * per 11 pool che funzionano; affiancarlo restringe solo ciò che Mario vieta o declassa.
 *
 * Il modello LOCKED (Katch-McArdle, classi, quote, fueling) NON viene toccato: qui cambia
 * QUALI cibi entrano nel piatto, non QUANTO si mangia (i target di slot restano quelli).
 */

import type { MealPlanV2ComposedSlot, MealPlanV2RecipeComponent } from "@empathy/contracts";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import type { MediterraneanDietType } from "@/lib/nutrition/mediterranean-meal-composer";
import { ROTATION_MAX_WEEK_USES, ROTATION_TARGET_WEEK_USES } from "@/lib/nutrition/meal-composition-rules";
import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import {
  mealRolesHasV6,
  type MenuFoodEntry,
  type MenuFoodMealRole,
  type MenuFoodMealRoles,
  type MenuFoodMediterraneanPriority,
  type MenuFoodPoolMap,
  type MenuFoodRoleMeal,
  type MenuFoodSubstitutionMode,
} from "@/lib/nutrition/v2/menu-food-catalog-db";
import type { MenuRecipe } from "@/lib/nutrition/v2/menu-recipe-catalog-db";

// ── Gate ─────────────────────────────────────────────────────────────────────────────

export type NutritionMealGrammarMode = "off" | "shadow" | "on";

/**
 * `NUTRITION_MEAL_GRAMMAR_MODE`: off | shadow | on.
 *
 * **Default (assente/ignoto) = `on` dal 24 ago 2026**: finito il rollout, la grammatica È
 * il motore — Mario ha approvato la settimana generata (24-30 ago) e il proprietario ha
 * chiesto di servirla a tutti. Prima il default era `shadow` (calcola la composizione
 * nuova, registra il confronto, ma SERVE la vecchia).
 *
 * Il default sta nel CODICE e non in una variabile d'ambiente per una ragione misurata su
 * questo progetto: la configurazione vive in DUE posti (env di Vercel per il cron e i
 * server Next, secret Supabase per la Edge Function) e una delle due si è già persa in un
 * deploy passato (GARMIN_ACTIVITY_BLOBS_BUCKET), lasciando una funzione viva ma cieca. Col
 * default nel codice i due veicoli non possono divergere: `_build.sh` bundla questo stesso
 * file. Per spegnere resta `NUTRITION_MEAL_GRAMMAR_MODE=off` (o `shadow` per tornare al
 * confronto in ombra), impostabile su entrambi i veicoli senza toccare il codice.
 *
 * In `shadow`, `NUTRITION_MEAL_GRAMMAR_ATHLETES` (csv di athlete_id) accende «on» per
 * singoli atleti — la scala di rollout resta disponibile per la prossima feature.
 */
export function resolveMealGrammarMode(
  env: Record<string, string | undefined>,
  athleteId: string | null | undefined,
): NutritionMealGrammarMode {
  const raw = (env.NUTRITION_MEAL_GRAMMAR_MODE ?? "").trim().toLowerCase();
  const globalMode: NutritionMealGrammarMode = raw === "off" ? "off" : raw === "shadow" ? "shadow" : "on";
  if (globalMode !== "shadow") return globalMode;
  const allow = (env.NUTRITION_MEAL_GRAMMAR_ATHLETES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const id = (athleteId ?? "").trim();
  if (id && allow.includes(id)) return "on";
  return "shadow";
}

// ── Pasto ↔ slot ─────────────────────────────────────────────────────────────────────

/** Gli score/ruoli di Mario sono per PASTO (4), gli slot del piano sono 6: gli spuntini condividono. */
export function mealForSlot(slot: MealSlotKey | string): MenuFoodRoleMeal {
  if (slot === "breakfast") return "breakfast";
  if (slot === "lunch") return "lunch";
  if (slot === "dinner") return "dinner";
  return "snack";
}

// ── Ruoli ammessi per pool ───────────────────────────────────────────────────────────

export type GrammarPoolRoles = {
  /** Ruoli che possono coprire il pool come fonte principale. */
  primary: readonly MenuFoodMealRole[];
  /** Ruoli ammessi SOLO se nessun primario è disponibile (es. legumi vegani a pranzo, L02). */
  fallback?: readonly MenuFoodMealRole[];
};

/**
 * Regole B01/B03/B04, L01/L02/L03, S01/S02, D01 (cena = pranzo) tradotte in «quale ruolo
 * di Mario può stare in quale pool». Il pool `breakfast_cho` come fonte CHO primaria (B01);
 * la linea CHO secondaria di colazione (B02) usa `GRAMMAR_BREAKFAST_SECONDARY_ROLES`.
 * `COMPOSITE_MAIN` (piatti chiusi tipo lasagne pronte) non entra mai come fonte proteica:
 * i piatti composti li fanno le ricette (L04).
 */
export const GRAMMAR_ROLES_BY_POOL: Readonly<Record<string, GrammarPoolRoles>> = {
  breakfast_cho: { primary: ["CHO_PRIMARY"] },
  breakfast_pro: { primary: ["PRO_PRIMARY"] },
  breakfast_fat: { primary: ["FAT_COMPLEMENT"] },
  lunch_carb: { primary: ["CHO_PRIMARY"] },
  lunch_pro: { primary: ["PRO_PRIMARY"], fallback: ["PRO_SECONDARY", "MIXED"] },
  lunch_veg: { primary: ["FIBER_VEG", "FIBER_MICRO_PRIMARY"] },
  dinner_carb: { primary: ["CHO_PRIMARY"] },
  dinner_pro: { primary: ["PRO_PRIMARY"], fallback: ["PRO_SECONDARY", "MIXED"] },
  dinner_veg: { primary: ["FIBER_VEG", "FIBER_MICRO_PRIMARY"] },
  snack_cho: { primary: ["CHO_PRIMARY", "CHO_SECONDARY", "MIXED"] },
  snack_pro: { primary: ["PRO_PRIMARY", "PRO_SECONDARY"] },
};

// ── Ruoli v6 per pool (B01/B06/B07, M01-M04, S01/S03) ────────────────────────────────

/** Asse del sistema ruoli v6 su cui un pool filtra (una colonna per asse). */
export type GrammarV6Axis = "breakfast_cho" | "breakfast_protein" | "breakfast_fat" | "main" | "snack";

export type GrammarPoolRolesV6 = {
  axis: GrammarV6Axis;
  /** Ruoli v6 che possono coprire il pool come fonte principale. */
  primary: readonly string[];
  /** Ruoli v6 ammessi SOLO quando nessun primario è disponibile (pool svuotato). */
  fallback?: readonly string[];
};

/**
 * Le regole v6 tradotte in «quale ruolo v6 può stare in quale pool» (vince sul v5 dove
 * l'entry porta dati v6, decisione 2):
 *  - B01: la CHO primaria di colazione SOLO da breakfast_cho_role='PRIMARY_COMPLEX';
 *  - B06: proteina colazione PRIMARY (latte/yogurt/kefir/uova); i formaggi sono NONE nei
 *    DATI, nessun hardcode; ripiego salato SECONDARY_SAVOURY (affettati) a pool svuotato;
 *  - B07: grassi PRIMARY (frutta oleosa/creme) prima di SECONDARY (semi/grassi animali);
 *    gli oli liquidi sono ESCLUSI dai dati (score_colazione 0 → filtro secco);
 *  - M02: CHO principale PRIMARY_COMPLEX_CARB, patate e derivati (SECONDARY_CARB) come
 *    alternativa; M03: proteina PRIMARY_PROTEIN, legumi come alternativa (fallback);
 *  - S01/S03: spuntino SOLO snack_role FAST_* (+MEDIUM = uova, ripiego dei dati): i pasti
 *    completi cucinati sono LOW/NONE e restano fuori per ruolo.
 */
export const GRAMMAR_V6_ROLES_BY_POOL: Readonly<Record<string, GrammarPoolRolesV6>> = {
  breakfast_cho: { axis: "breakfast_cho", primary: ["PRIMARY_COMPLEX"] },
  breakfast_pro: { axis: "breakfast_protein", primary: ["PRIMARY"], fallback: ["SECONDARY_SAVOURY", "SECONDARY"] },
  breakfast_fat: { axis: "breakfast_fat", primary: ["PRIMARY"], fallback: ["SECONDARY"] },
  lunch_carb: { axis: "main", primary: ["PRIMARY_COMPLEX_CARB"], fallback: ["SECONDARY_CARB"] },
  lunch_pro: { axis: "main", primary: ["PRIMARY_PROTEIN"], fallback: ["SECONDARY_PROTEIN", "PRIMARY_OR_SECONDARY_PROTEIN"] },
  lunch_veg: { axis: "main", primary: ["FIBER_SIDE"] },
  dinner_carb: { axis: "main", primary: ["PRIMARY_COMPLEX_CARB"], fallback: ["SECONDARY_CARB"] },
  dinner_pro: { axis: "main", primary: ["PRIMARY_PROTEIN"], fallback: ["SECONDARY_PROTEIN", "PRIMARY_OR_SECONDARY_PROTEIN"] },
  dinner_veg: { axis: "main", primary: ["FIBER_SIDE"] },
  snack_cho: { axis: "snack", primary: ["FAST_CARB"] },
  snack_pro: { axis: "snack", primary: ["FAST_PROTEIN", "FAST_FAT_PRO", "MEDIUM"] },
};

/**
 * Pasto «naturale» di un pool: l'asse v6 si applica SOLO quando il pool viene usato nel
 * suo pasto (la regola 7 pesca il pane da breakfast_cho a PRANZO: lì vale il vocabolario
 * v5 — role_lunch/score_lunch — non l'asse colazione, che a pranzo non significa nulla).
 */
export function grammarPoolMeal(poolKey: string): MenuFoodRoleMeal | null {
  if (poolKey.startsWith("breakfast_")) return "breakfast";
  if (poolKey.startsWith("lunch_")) return "lunch";
  if (poolKey.startsWith("dinner_")) return "dinner";
  if (poolKey.startsWith("snack_")) return "snack";
  return null;
}

/** Valore dell'asse v6 sulla riga di score (NONE quando la colonna manca — select v5). */
export function grammarV6RoleFor(mr: MenuFoodMealRoles, axis: GrammarV6Axis): string {
  switch (axis) {
    case "breakfast_cho":
      return mr.breakfastChoRole ?? "NONE";
    case "breakfast_protein":
      return mr.breakfastProteinRole ?? "NONE";
    case "breakfast_fat":
      return mr.breakfastFatRole ?? "NONE";
    case "main":
      return mr.mainMealRole ?? "NONE";
    case "snack":
      return mr.snackRole ?? "NONE";
  }
}

/** B02: la quota CHO secondaria di colazione (frutta, miele, marmellata) — vocabolario v5. */
export const GRAMMAR_BREAKFAST_SECONDARY_ROLES: readonly MenuFoodMealRole[] = ["CHO_SECONDARY"];

/**
 * B02 v6: la linea secondaria ammette la quota semplice (frutta/confettura/miele/succo,
 * SECONDARY_SIMPLE) E i dolci occasionali (SECONDARY_MIXED) — così un dolce non può MAI
 * essere l'unica fonte CHO (B04): la sua linea esiste solo accanto a una PRIMARY_COMPLEX
 * già scelta, e il tetto B05 + il tier OCCASIONAL lo tengono raro.
 */
export const GRAMMAR_BREAKFAST_SECONDARY_V6: { axis: GrammarV6Axis; roles: readonly string[] } = {
  axis: "breakfast_cho",
  roles: ["SECONDARY_SIMPLE", "SECONDARY_MIXED"],
};

/** M01/M04 v6: la quarta riga del pasto principale — il condimento grasso (EVO preferenziale). */
export const GRAMMAR_MAIN_FAT_CONDIMENT_V6: { axis: GrammarV6Axis; roles: readonly string[] } = {
  axis: "main",
  roles: ["FAT_CONDIMENT"],
};

/**
 * B02 («Frutta, miele, marmellata»): in prod la frutta vive nel pool `snack_cho`, non in
 * `breakfast_cho` (che ha SOLO miele e crema cacao-nocciole come CHO_SECONDARY, entrambi
 * ROTATION). Il ruolo di Mario decide, non il pool: la linea secondaria pesca da
 * breakfast_cho ∪ (snack_cho con ruolo colazione CHO_SECONDARY esplicito), così la
 * frutta COMMON vince e miele/crema restano la rotazione che sono nei dati.
 */
export const GRAMMAR_BREAKFAST_SECONDARY_EXTRA_POOLS: readonly string[] = ["snack_cho"];

export function breakfastSecondaryMenuEntries(pools: MenuFoodPoolMap | null | undefined): MenuFoodEntry[] {
  if (!pools) return [];
  const out: MenuFoodEntry[] = [];
  const seen = new Set<string>();
  for (const e of pools.get("breakfast_cho") ?? []) {
    if (!seen.has(e.canonicalKey)) {
      seen.add(e.canonicalKey);
      out.push(e);
    }
  }
  for (const pk of GRAMMAR_BREAKFAST_SECONDARY_EXTRA_POOLS) {
    for (const e of pools.get(pk) ?? []) {
      // Dagli altri pool entra SOLO chi Mario ha marcato come quota secondaria di
      // colazione (un alimento senza score in snack_cho non diventa colazione per
      // omissione): v6 breakfast_cho_role SECONDARY_SIMPLE/SECONDARY_MIXED (B02), o il
      // v5 CHO_SECONDARY per le entry senza dati v6.
      if (seen.has(e.canonicalKey) || !isBreakfastSecondaryEntry(e)) continue;
      seen.add(e.canonicalKey);
      out.push(e);
    }
  }
  return out;
}

/** True se l'entry è marcata quota CHO secondaria di colazione (B02): v6 prima, v5 come fallback. */
export function isBreakfastSecondaryEntry(e: Pick<MenuFoodEntry, "mealRoles">): boolean {
  const mr = e.mealRoles;
  if (!mr) return false;
  if (mealRolesHasV6(mr)) {
    return mr.breakfastChoRole === "SECONDARY_SIMPLE" || mr.breakfastChoRole === "SECONDARY_MIXED";
  }
  return mr.roles.breakfast === "CHO_SECONDARY";
}

/**
 * B01/B02 (v6, HARD): 80-85% dei CHO della colazione da fonti complesse (PRIMARY_COMPLEX),
 * 10-15% dalla quota semplice → la linea secondaria copre 0,15 (punto medio della somma
 * dei due vincoli, tolleranza ±5pp per decisione 5), la primaria — leva del solver —
 * chiude il resto. La verifica post-compose sta in `buildMealGrammarProvenance`
 * (flag `b01_share_out`): verifica, non correzione.
 */
export const GRAMMAR_BREAKFAST_SECONDARY_CHO_SHARE = 0.15;

/** B01 (decisione 5): forbetta ammessa per la quota primaria = 80-85% ± 5pp. */
export const GRAMMAR_B01_PRIMARY_SHARE_MIN = 0.75;
export const GRAMMAR_B01_PRIMARY_SHARE_MAX = 0.9;

/**
 * B05 (SOFT→tetto): dolci breakfast max 2/settimana. Il marcatore REALE nei dati v6 è
 * `breakfast_cho_role='SECONDARY_MIXED'` (coincide 1:1 con substitution_group
 * 'BREAKFAST_SWEET_OCCASIONAL' e food_subcategory 'DOLCE_OCCASIONALE': oggi 2 alimenti,
 * cornetto e waffle). Il max_week per-alimento NON basta (il waffle nei dati ha
 * max_week 7, in contrasto con la sua stessa nota «Max 1-2 volte/settimana» — incoerenza
 * segnalata a Mario, i dati si importano così come sono). Il «soprattutto in giorni ad
 * alta richiesta» resta NON modellato: nessun aggancio al day-engine, semplificazione
 * dichiarata.
 */
export const GRAMMAR_BREAKFAST_SWEETS_MAX_WEEK = 2;

/** True se l'entry è un dolce da colazione (marcatore B04/B05). */
export function isBreakfastSweetEntry(e: Pick<MenuFoodEntry, "mealRoles">): boolean {
  return e.mealRoles?.breakfastChoRole === "SECONDARY_MIXED";
}

/**
 * Conteggio settimanale CUMULATO dei dolci da colazione (B05): somma dei conteggi di
 * famiglia degli alimenti marcati, dedupe sulla chiave contata (una famiglia condivisa
 * da due dolci conta una volta). Calcolato una volta per composizione dal compositore.
 */
export function weekBreakfastSweetsCount(
  entryIndex: Map<string, MenuFoodEntry>,
  week?: Record<string, number>,
): number {
  if (!week) return 0;
  let n = 0;
  const counted = new Set<string>();
  for (const e of entryIndex.values()) {
    if (!isBreakfastSweetEntry(e)) continue;
    const countKey = e.rotationKey && (week[e.rotationKey] ?? 0) > 0 ? e.rotationKey : e.canonicalKey;
    if (counted.has(countKey)) continue;
    counted.add(countKey);
    n += Math.max(week[e.canonicalKey] ?? 0, e.rotationKey ? (week[e.rotationKey] ?? 0) : 0);
  }
  return n;
}

/** S01 (HARD): spuntino pratico → prep_speed minimo (valore_default del file regole). */
export const GRAMMAR_SNACK_PREP_SPEED_MIN = 7;

/**
 * R-C (regola di commestibilità del proprietario, v11): la porzione proteica dello
 * spuntino ha un TETTO leggibile — 150 g (yogurt/fiocchi), 120 g per le uova (≈2 uova):
 * il solver, senza tetto, chiude le proteine con 200 g di yogurt magro, che non è uno
 * spuntino. Implementato come clamp del maxG della linea `snack_pro` (il solver compensa
 * da solo sulle altre leve); il deficit proteico residuo resta scoperto come per ogni
 * altro cap — nessuna compensazione inventata.
 */
export const GRAMMAR_SNACK_PRO_MAX_G = 150;
export const GRAMMAR_SNACK_PRO_EGG_MAX_G = 120;

/**
 * R-B (regola di commestibilità del proprietario, v11): nessuna linea SERVITA sotto
 * questa soglia — una riga da 9 g di merluzzo non è un piatto, è un errore di stampa.
 * Se il solver risolve una linea sotto soglia, la linea si ELIMINA e il solver
 * ri-risolve senza (le altre leve compensano). Non si applica ai condimenti (lever
 * `fat`: 5-20 g di olio sono normali), alle linee a grammi fissi (mai sotto il loro
 * fixedG clampato) né ai componenti INTERNI delle ricette (le proporzioni del piatto
 * sono della ricetta, non del solver).
 */
export const GRAMMAR_LINE_MIN_SERVED_G = 12;

/** R-B: la linea è eliminabile? (vedi GRAMMAR_LINE_MIN_SERVED_G — esporta il criterio per i test). */
export function lineDroppableBelowMinServed(
  line: { spec: { lever: string }; recipe?: unknown },
  grams: number,
): boolean {
  return grams < GRAMMAR_LINE_MIN_SERVED_G && line.spec.lever !== "fat" && line.spec.lever !== "fixed" && !line.recipe;
}

/**
 * V10_S01 (HARD): allo spuntino template-led la frutta può entrare SOLO come SIDE
 * separato per chiudere i CHO residui, e solo quando il residuo vale una porzione
 * (≥ 15 g CHO) — mai come pairing principale accanto ad affettati/salmone.
 */
export const GRAMMAR_SNACK_FRUIT_SIDE_MIN_CHO_G = 15;

/** V10_S01: ruoli ammessi per la linea frutta-side dello spuntino (asse snack, v6). */
export const GRAMMAR_SNACK_FRUIT_SIDE_V6: { axis: GrammarV6Axis; roles: readonly string[] } = {
  axis: "snack",
  roles: ["FAST_CARB"],
};

/**
 * V10_S01: true se l'entry è FRUTTA candidabile come side dello spuntino. Il marcatore è
 * doppio perché FAST_CARB da solo include anche pane/gallette: la quota «semplice» di
 * colazione (SECONDARY_SIMPLE, B02) è nei dati il marcatore della frutta/miele — la
 * stessa distinzione usata da isBreakfastSecondaryEntry. Entry senza dati v6 → v5:
 * CHO_SECONDARY allo spuntino (frutta nelle fixture storiche).
 */
export function isSnackFruitSideEntry(e: Pick<MenuFoodEntry, "mealRoles">): boolean {
  const mr = e.mealRoles;
  if (!mr) return false;
  if (mealRolesHasV6(mr)) {
    return mr.snackRole === "FAST_CARB" && mr.breakfastChoRole === "SECONDARY_SIMPLE";
  }
  return mr.roles.snack === "CHO_SECONDARY";
}

/** V10_S01: pool virtuale della frutta-side (entry di snack_cho marcate frutta). */
export function snackFruitSideEntries(pools: MenuFoodPoolMap | null | undefined): MenuFoodEntry[] {
  if (!pools) return [];
  const out: MenuFoodEntry[] = [];
  const seen = new Set<string>();
  for (const e of pools.get("snack_cho") ?? []) {
    if (seen.has(e.canonicalKey) || !isSnackFruitSideEntry(e)) continue;
    seen.add(e.canonicalKey);
    out.push(e);
  }
  return out;
}

/**
 * Penalità di priorità per frequenza (mai esclusione). Dal sistema v6 l'ordinamento del
 * pick è a CHIAVI (grammarOrderingKeys: la frequenza v5 diventa il tier per le entry
 * senza dati v6) e questo valore non viene più sottratto dal punteggio: resta il
 * contratto informativo di `grammarPenaltyForEntry` (0 = COMMON, >0 = declassato,
 * null = escluso) usato dai chiamanti come verdetto.
 */
export const GRAMMAR_FREQUENCY_PENALTY: Readonly<Record<string, number>> = {
  COMMON: 0,
  ROTATION: 200,
  OCCASIONAL: 400,
};

/**
 * D02 (SOFT): «privilegiare grassi insaturi e fonti ittiche/oleose nel bilancio
 * settimanale». Non è un vincolo, è una spinta: a CENA, se nella settimana non è ancora
 * comparso pesce, il pesce riceve un bonus che lo porta in cima (dal v6 è la chiave di
 * ordinamento più alta dopo la preferenza di sostituzione R01) ma perde contro le
 * esclusioni e i tetti (che sono verdetti, non punteggi). Appena una famiglia ittica è
 * nella memoria settimanale, il bonus
 * si spegne: due pesci in settimana non sono un obiettivo, uno sì. Non si tocca il
 * «quanto» (i grassi restano quelli del modello), solo QUALE proteina viene scelta.
 * Perché solo a cena: è dove Mario la colloca (D02 sta sotto CENA), e a pranzo la scelta
 * è già occupata dalle matrici L04. Perché non l'olio: le linee grasso hanno un ruolo
 * FAT_COMPLEMENT proprio, e «non aggiungere olio se il pasto è già ricco» (nota di D02) è
 * già la regola B04 (grasso come delta).
 */
export const GRAMMAR_D02_FISH_DINNER_BONUS = 450;
/** Prefisso delle famiglie ittiche in rotation_key (es. `prot:pesce`, `prot:pesce_azzurro`). */
const FISH_FAMILY_PREFIX = "prot:pesce";

/** True se la memoria settimanale contiene già una famiglia ittica. */
export function weekHasFish(week?: Record<string, number>): boolean {
  if (!week) return false;
  for (const [k, v] of Object.entries(week)) {
    if (v > 0 && k.startsWith(FISH_FAMILY_PREFIX)) return true;
  }
  return false;
}

/**
 * D02 come bonus di priorità (positivo) o 0. Vale solo per pick a cena su un alimento
 * ittico, e solo finché la settimana è senza pesce.
 */
export function grammarD02FishBonus(
  entry: Pick<MenuFoodEntry, "isFish">,
  filter: Pick<GrammarPickFilter, "meal">,
  week?: Record<string, number>,
): number {
  if (filter.meal !== "dinner" || !entry.isFish) return 0;
  return weekHasFish(week) ? 0 : GRAMMAR_D02_FISH_DINNER_BONUS;
}

export type GrammarPickFilter = {
  meal: MenuFoodRoleMeal;
  /** Ruoli v5 ammessi nel pool per questo pick; assente = solo il filtro score/EXCLUDE. */
  allowedRoles?: ReadonlySet<MenuFoodMealRole>;
  /**
   * Ruoli v6 ammessi sull'asse del pool. Quando l'entry porta dati v6 (mealRolesHasV6)
   * questo VINCE sul vocabolario v5 (decisione 2); un'entry senza dati v6 ricade su
   * `allowedRoles` — così con dati v5 e codice v6 nulla si svuota.
   */
  v6?: { axis: GrammarV6Axis; allowed: ReadonlySet<string> };
  /** B05: conteggio settimanale cumulato dei dolci da colazione (weekBreakfastSweetsCount). */
  sweetsWeekCount?: number;
  /**
   * R01: preferenza di sostituzione — nei re-pick (regola 7) le entry con lo stesso
   * substitution_group dell'alimento sostituito vengono prima, poi i sostituti espliciti
   * in ordine, poi il resto del pool con ruolo ammesso. Mai sostituzione per sole kcal:
   * il filtro ontologico (ruolo/score) resta comunque il verdetto (V01).
   * V7-R01 (v9): dentro un re-pick i sostituti automatici vengono SOLO da CORE/ROTATION
   * (verdetto sulle entry con tier v9); `substitutePool` (se noto) raffina la preferenza
   * in grammarSubstituteRank, SOFT, mai verdetto.
   */
  substituteFor?: {
    substitutionGroup: string | null;
    substitutes: readonly string[];
    substitutePool?: string | null;
  };
  /**
   * V7-03 (v9): massimo UN alimento VARIETY per pasto. Quando lo slot ha già servito un
   * VARIETY, le entry VARIETY successive diventano verdetto (null), non penalità.
   */
  varietyBlocked?: boolean;
  /** S01: prep_speed minimo (solo spuntini). null/assente sul cibo → passa. */
  prepSpeedMin?: number;
  /**
   * Ultima spiaggia quando la grammatica ha svuotato il pool del catalogo: si ignora il
   * tetto di rotazione NOSTRO (ROTATION_MAX_WEEK_USES, famiglia) ma MAI il filtro ontologico
   * (score 0 / EXCLUDE / ruolo non ammesso / dieta / esclusioni) né il `max_week` ESPLICITO
   * di Mario. Meglio ripetere un legume al vegano che servirgli un alimento USDA grezzo in
   * inglese o niente proteina.
   */
  relaxWeekCaps?: boolean;
  /**
   * M01/M04 (condimento): salta il blocco «già usato oggi» (isCanonicalKeyUsedToday
   * −5000 e usedFdcIds −4000) per QUESTO pick. L'EVO dentro le ricette del giorno viene
   * registrato in dayUsedCanonicalKeys → al pick condimento prendeva −5000 e vinceva
   * SEMPRE avocado; ma M04 dice EVO condimento quotidiano standard. Solo priorità di
   * scoring: verdetti ontologici, dieta, max_week e tetti restano intatti — l'avocado
   * resta possibile quando l'EVO è escluso (dieta/deny).
   */
  ignoreUsedToday?: boolean;
};

/**
 * Verdetto della grammatica su un'entry del catalogo dentro un pick.
 * `null` = ESCLUSA (filtro secco); numero = penalità di priorità (0 = nessuna).
 *
 * Un'entry SENZA `mealRoles` (alimento inserito da admin dopo l'import, senza riga di score)
 * passa senza penalità: il proprietario ha deciso lo score come filtro, e un filtro non può
 * cancellare un alimento di cui non sa nulla — sarebbe il catalogo a decidere per omissione.
 *
 * `weekCount` è il conteggio settimanale di FAMIGLIA (max fra canonical_key e rotation_key,
 * come tutta la memoria settimanale): il `max_week` di Mario è per alimento, ma la memoria
 * persistita conta le famiglie (R01), quindi la famiglia è il limite superiore disponibile —
 * più restrittivo, mai più permissivo. Nei dati v5 la differenza è nulla: i 7 alimenti con
 * max_week 2 hanno rotation_key senza fratelli o nessuna rotation_key (conteggio = alimento),
 * e max_week 3 coincide con ROTATION_MAX_WEEK_USES che vale già per famiglia.
 */
export function grammarPenaltyForEntry(
  entry: MenuFoodEntry,
  filter: GrammarPickFilter,
  weekCount: number,
): number | null {
  const mr = entry.mealRoles;
  if (!mr) return 0;
  // v9, VERDETTI di tier (prima di tutto il resto): EXCLUDE_DEFAULT = mai generato di
  // default; default_enabled=false = mai pescabile da solo (P01: polveri proteiche, oli
  // di semi, verdure rare). NON si applica agli ingredienti DENTRO le ricette
  // (recipeCandidatesForMeal non passa da qui): P01 vuole le polveri «mai da sole», ma
  // dentro gli shake sì — estendere questo verdetto lì ucciderebbe tutte le ricette shake.
  if (mr.generativeTier === "EXCLUDE_DEFAULT" || mr.defaultEnabled === false) return null;
  // V7-03: slot che ha già servito un VARIETY → le altre entry VARIETY sono fuori.
  if (filter.varietyBlocked && mr.generativeTier === "VARIETY") return null;
  // V7-R01: in un re-pick di sostituzione i sostituti automatici vengono SOLO da
  // CORE/ROTATION (le entry senza tier v9 degradano al comportamento v6: nessun verdetto).
  if (
    filter.substituteFor &&
    mr.generativeTier != null &&
    mr.generativeTier !== "CORE" &&
    mr.generativeTier !== "ROTATION"
  ) {
    return null;
  }
  const score = mr.scores[filter.meal];
  if (!(score > 0)) return null;
  // Ruolo: asse v6 quando il filtro lo chiede E l'entry porta dati v6 (lì la v6 VINCE sul
  // v5, EXCLUDE compreso — decisione 2); altrimenti il vocabolario v5 storico.
  if (filter.v6 && mealRolesHasV6(mr)) {
    if (!filter.v6.allowed.has(grammarV6RoleFor(mr, filter.v6.axis))) return null;
  } else {
    const role = mr.roles[filter.meal];
    if (role === "EXCLUDE") return null;
    if (filter.allowedRoles && !filter.allowedRoles.has(role)) return null;
  }
  // B05: i dolci da colazione hanno un tetto CUMULATO settimanale proprio (il max_week
  // per-alimento non basta: waffle max_week 7 nei dati).
  if (
    filter.meal === "breakfast" &&
    isBreakfastSweetEntry(entry) &&
    (filter.sweetsWeekCount ?? 0) >= GRAMMAR_BREAKFAST_SWEETS_MAX_WEEK
  ) {
    return null;
  }
  if (mr.maxWeek != null && weekCount >= mr.maxWeek) return null;
  if (filter.prepSpeedMin != null && mr.prepSpeed != null && mr.prepSpeed < filter.prepSpeedMin) return null;
  return GRAMMAR_FREQUENCY_PENALTY[mr.frequency] ?? 0;
}

// ── Ordinamento a chiavi (B03/M04, decisione 3) ──────────────────────────────────────

/**
 * B03/M04 (SOFT): le gerarchie si applicano come ORDINAMENTO a chiavi separate, MAI come
 * penalità sottrattiva — il floor `Math.max(1, score - penalty)` del punteggio di
 * rotazione schiaccerebbe tutti i tier oltre il primo a parità 1. Tier più basso = viene
 * prima. Le entry senza dati v6 usano la frequenza v5 come tier (stessa semantica).
 */
export const GRAMMAR_MEDITERRANEAN_PRIORITY_RANK: Readonly<Record<MenuFoodMediterraneanPriority, number>> = {
  PRIMARY: 0,
  COMMON: 1,
  ROTATION: 2,
  SECOND_CHOICE: 3,
  LIMITED: 4,
  OCCASIONAL: 5,
};

const GRAMMAR_V5_FREQUENCY_RANK: Readonly<Record<string, number>> = { COMMON: 1, ROTATION: 2, OCCASIONAL: 5 };

/**
 * v9 (CORE-first): il tier generativo è la PRIMA chiave d'ordinamento quando presente
 * (sostituisce mediterranean_priority; fallback: priorità v6, poi frequenza v5).
 * EXCLUDE_DEFAULT non ha rank: è un VERDETTO (grammarPenaltyForEntry → null), mai un tier.
 * NOTA dichiarata: le tre scale (v9 0-3, v6 0-5, v5 1/2/5) convivono nello stesso campo
 * `tier` — in un pool misto (alimento admin senza tier accanto ai 492 migrati) un v6
 * LIMITED (4) perde contro un v9 VARIETY (3) per costruzione. Dopo l'import ogni riga
 * porta il default DB VARIETY, quindi il caso è marginale; fissato da un test.
 */
export const GRAMMAR_V9_TIER_RANK: Readonly<Record<string, number>> = {
  CORE: 0,
  ROTATION: 1,
  OCCASIONAL: 2,
  VARIETY: 3,
};

/**
 * B03: nei dati v6 cereali e pane hanno ENTRAMBI priority=PRIMARY e score_colazione=10 —
 * la gerarchia «cereali > pane e derivati» della regola non è derivabile da priority/score,
 * quindi il substitution_group fa da tiebreak (solo a colazione).
 */
const GRAMMAR_B03_GROUP_RANK: Readonly<Record<string, number>> = {
  BREAKFAST_COMPLEX_CARB: 0,
  BREAD_BASED_CARB: 1,
};

/** Rango di preferenza R01 dentro un re-pick: stesso gruppo (0) < sostituto esplicito (1+i) < resto. */
export function grammarSubstituteRank(
  entry: Pick<MenuFoodEntry, "canonicalKey" | "mealRoles">,
  substituteFor: NonNullable<GrammarPickFilter["substituteFor"]>,
): number {
  const group = entry.mealRoles?.substitutionGroup ?? null;
  if (group != null && substituteFor.substitutionGroup != null && group === substituteFor.substitutionGroup) return 0;
  // v9: lo stesso substitute_pool del sostituito vale come lo stesso gruppo (preferenza
  // SOFT aggiuntiva, mai verdetto — il verdetto V7-R01 sta in grammarPenaltyForEntry).
  const pool = entry.mealRoles?.substitutePool ?? null;
  if (pool != null && substituteFor.substitutePool != null && pool === substituteFor.substitutePool) return 0;
  const idx = substituteFor.substitutes.indexOf(entry.canonicalKey);
  if (idx >= 0) return 1 + idx;
  return 1000;
}

export type GrammarOrderingKeys = {
  /** R01: preferenza di sostituzione (asc). 0 quando il pick non è una sostituzione. */
  subRank: number;
  /** D02: bonus pesce a cena (desc) — conservato dalla v1, resta la chiave più alta. */
  d02: number;
  /** Tier mediterranean_priority v6 (asc); frequenza v5 per le entry senza dati v6. */
  tier: number;
  /**
   * QA 24-30 ago (varietà DENTRO il tier): conteggio settimanale di FAMIGLIA a bucket
   * (min(count, ROTATION_MAX_WEEK_USES), asc — meno usato prima). Nei CORE di Mario quasi
   * tutto è a score 10/10: senza questa chiave decideva l'ultima (seed offset, fino a
   * ~500 punti) che DOMINA la penalità settimanale del punteggio di rotazione (80-120) →
   * corn flakes 3 colazioni/7. Il tier decide chi può entrare (familiarità), l'uso
   * settimanale ordina dentro il tier (varietà), lo score fa da gerarchia a parità di uso.
   */
  weekBucket: number;
  /** Score del pasto (desc): dentro lo stesso tier decide la gerarchia fine di Mario. */
  mealScore: number;
  /** B03: tiebreak cereali-prima-del-pane a colazione (asc). */
  groupRank: number;
};

/**
 * Chiavi di ordinamento della grammatica per un'entry già ammessa dal filtro secco
 * (grammarPenaltyForEntry ≠ null). Il punteggio di rotazione esistente (seed offset +
 * penalità settimanali) resta l'ULTIMA chiave, nel chiamante: a parità di tier e score
 * la varietà continua a farla la rotazione, come prima.
 */
export function grammarOrderingKeys(
  entry: MenuFoodEntry,
  filter: GrammarPickFilter,
  week?: Record<string, number>,
): GrammarOrderingKeys {
  const mr = entry.mealRoles;
  // Catena a tre (v9 → v6 → v5): tier generativo v9 quando presente, altrimenti la
  // priorità mediterranea v6, altrimenti la frequenza v5 — stessa semantica di fallback
  // del filtro per ruolo (decisione 2).
  const tier =
    mr?.generativeTier != null && GRAMMAR_V9_TIER_RANK[mr.generativeTier] != null
      ? GRAMMAR_V9_TIER_RANK[mr.generativeTier]!
      : mr && mealRolesHasV6(mr) && mr.mediterraneanPriority
        ? GRAMMAR_MEDITERRANEAN_PRIORITY_RANK[mr.mediterraneanPriority]
        : (GRAMMAR_V5_FREQUENCY_RANK[mr?.frequency ?? "COMMON"] ?? 1);
  return {
    subRank: filter.substituteFor ? grammarSubstituteRank(entry, filter.substituteFor) : 0,
    d02: grammarD02FishBonus(entry, filter, week),
    tier,
    // Stessa semantica max(canonical_key, rotation_key) di ingredientWeekCountFor /
    // weekStapleCountForEntry (ROTATION_MAX_WEEK_USES arriva da meal-composition-rules,
    // modulo foglia: nessun ciclo di import). Nel pick condimento (ignoreUsedToday,
    // M01/M04) il bucket è NEUTRO: l'EVO sta in ~tutte le ricette → satura la memoria
    // settimanale dal giorno 2, e con i tier in parità (fallback v6/v5 senza
    // generative_tier) il bucket regalerebbe il condimento all'avocado a giorni
    // alterni — l'esatto guasto che l'esenzione corregge, reintrodotto a livello
    // settimana. «EVO quotidiano» non deve dipendere dai dati di catalogo.
    weekBucket: filter.ignoreUsedToday
      ? 0
      : Math.min(ingredientWeekCountFor(entry, week), ROTATION_MAX_WEEK_USES),
    mealScore: mr?.scores[filter.meal] ?? 0,
    groupRank:
      filter.meal === "breakfast" ? (GRAMMAR_B03_GROUP_RANK[mr?.substitutionGroup ?? ""] ?? 0) : 0,
  };
}

/** Comparatore delle chiavi (a prima di b se < 0). L'ordine delle chiavi è il contratto. */
export function compareGrammarOrderingKeys(a: GrammarOrderingKeys, b: GrammarOrderingKeys): number {
  if (a.subRank !== b.subRank) return a.subRank - b.subRank;
  if (a.d02 !== b.d02) return b.d02 - a.d02;
  if (a.tier !== b.tier) return a.tier - b.tier;
  // DOPO il tier, PRIMA dello score: la memoria settimanale ordina dentro il tier.
  if (a.weekBucket !== b.weekBucket) return a.weekBucket - b.weekBucket;
  if (a.mealScore !== b.mealScore) return b.mealScore - a.mealScore;
  if (a.groupRank !== b.groupRank) return a.groupRank - b.groupRank;
  return 0;
}

// ── Sostituzioni (R01/R02) ───────────────────────────────────────────────────────────

/**
 * R02 (HARD): grammatura del sostituto a parità di ENERGIA —
 * grams_sost = grams_orig × kcal100_orig / kcal100_sost (le colonne eq_g del file v6
 * sono vuote: l'equivalenza si calcola a runtime). Vale SOLO per le linee a grammi
 * FISSI: sulle linee a leva il solver ri-risolve a target macro, che è più preciso
 * della sola equivalenza kcal — applicarla lì sarebbe lavoro sovrascritto.
 */
export function substituteGramsByKcal(gramsOrig: number, kcal100Orig: number, kcal100Sub: number): number {
  if (!(gramsOrig > 0) || !(kcal100Orig > 0) || !(kcal100Sub > 0)) return gramsOrig;
  return round1((gramsOrig * kcal100Orig) / kcal100Sub);
}

/**
 * v9: dispatcher per `substitution_mode` — PORTION_EQUIVALENT (verdure: stessi grammi)
 * vs ENERGY_EQUIVALENT/assente (macro: kcal-equivalenza, R02). Vale per le sole linee a
 * grammi FISSI, come substituteGramsByKcal: sulle linee a leva il solver ri-risolve.
 */
export function substituteGramsForMode(
  mode: MenuFoodSubstitutionMode | null | undefined,
  gramsOrig: number,
  kcal100Orig: number,
  kcal100Sub: number,
): number {
  if (mode === "PORTION_EQUIVALENT") return gramsOrig;
  return substituteGramsByKcal(gramsOrig, kcal100Orig, kcal100Sub);
}

// ── Condimento grasso dei pasti principali (M01/M04) ─────────────────────────────────

/**
 * M01 (HARD): pranzo e cena hanno QUATTRO righe — CHO complesso, proteina, contorno
 * fibra e CONDIMENTO GRASSO. La linea condimento pesca dal pool virtuale dei
 * main_meal_role='FAT_CONDIMENT' (EVO, avocado, altri oli); i grammi li decide il
 * solver dentro [5, 20] g e vengono CONTATI nelle macro del pasto. D02-v1: se il pasto
 * è già ricco di grassi (ricetta composita, proteina grassa) la linea si salta — sotto
 * questo residuo di grassi target un condimento non avrebbe spazio.
 */
export const GRAMMAR_MAIN_FAT_MIN_G = 5;
export const GRAMMAR_MAIN_FAT_MAX_G = 20;
export const GRAMMAR_MAIN_FAT_STEP_G = 5;
export const GRAMMAR_MAIN_FAT_MIN_RESIDUAL_G = 4;

/** Pool virtuale del condimento: le entry del catalogo con main_meal_role='FAT_CONDIMENT'. */
export function mainMealFatCondimentEntries(entryIndex: Map<string, MenuFoodEntry>): MenuFoodEntry[] {
  const out: MenuFoodEntry[] = [];
  for (const e of entryIndex.values()) {
    if (e.mealRoles?.mainMealRole === "FAT_CONDIMENT") out.push(e);
  }
  return out;
}

// ── Ricette (L04/V02) ────────────────────────────────────────────────────────────────

/** Ordine di preferenza per frequenza della ricetta (più basso = preferito). */
const RECIPE_FREQUENCY_RANK: Readonly<Record<string, number>> = { COMMON: 0, ROTATION: 1, OCCASIONAL: 2 };

/** v9: rank del tier ricetta — stessa scala della frequenza, così il fallback è coerente. */
const RECIPE_TIER_RANK: Readonly<Record<string, number>> = { CORE: 0, ROTATION: 1, OCCASIONAL: 2 };

/**
 * Rank di scelta della ricetta: tier v9 quando presente, altrimenti frequency (stessa
 * semantica di fallback degli alimenti). USATA sia dal sort delle candidate sia dal
 * tier di sorteggio in chooseRecipeForSlot: le due DEVONO coincidere, altrimenti il
 * sorteggio col seed mescola CORE e ROTATION a parità di conteggio.
 */
export function recipeRank(r: Pick<MenuRecipe, "tier" | "frequency">): number {
  if (r.tier != null && RECIPE_TIER_RANK[r.tier] != null) return RECIPE_TIER_RANK[r.tier]!;
  return RECIPE_FREQUENCY_RANK[r.frequency] ?? 0;
}

/**
 * V7-C02 / V8-M02 (v9): tetto settimanale PER FAMIGLIA, indipendente dal numero di
 * varianti (12 pizze diverse restano UNA pizza a settimana). I nomi famiglia sono i
 * valori ESATTI della colonna `family` del file v9 (verificati su v9_recipes.json:
 * PIZZA 12, BURGER 5, LASAGNE 5, CRESPELLE 4). Il conteggio famiglia si ricostruisce a
 * runtime dalle ricette caricate (la memoria settimanale conosce solo chiavi
 * `recipe:<key>`): una ricetta disattivata DOPO essere stata servita sparisce dal
 * conteggio — deriva accettata e dichiarata.
 */
export const GRAMMAR_RECIPE_FAMILY_MAX_WEEK: Readonly<Record<string, number>> = {
  LASAGNE: 1,
  CRESPELLE: 1,
  PIZZA: 1,
  BURGER: 1,
};

/** Conteggio settimanale per famiglia: Σ dei weekStapleCounts `recipe:<key>` delle ricette della famiglia. */
export function recipeFamilyWeekCounts(
  recipes: readonly MenuRecipe[] | null | undefined,
  weekStapleCounts?: Record<string, number>,
): Map<string, number> {
  const counts = new Map<string, number>();
  if (!weekStapleCounts) return counts;
  for (const r of recipes ?? []) {
    if (!r.family) continue;
    const c = weekStapleCounts[recipeRotationKey(r.recipeKey)] ?? 0;
    if (c > 0) counts.set(r.family, (counts.get(r.family) ?? 0) + c);
  }
  return counts;
}

/**
 * QA 24-30 ago (fix c): la rotazione dei template deve girare sulla BASE glucidica
 * (template_meta.primary_carb_family: CORN_FLAKES, OATS, BREAD…), non su variant_group —
 * che nel file di Mario è l'etichetta del LOTTO d'import ("V10_EXISTING"/"V11_EXPANDED"):
 * tutti i corn flakes condividono la base ma NON il gruppo → nessuna rotazione reale
 * (corn flakes 3 colazioni/7 misurate). Tetto settimanale per base = 2 (stesso target
 * della rotazione famiglie, ROTATION_TARGET_WEEK_USES).
 */
export const GRAMMAR_TEMPLATE_BASE_MAX_WEEK = ROTATION_TARGET_WEEK_USES;

/**
 * QA fix c-bis (verifica avversariale): nei dati v11 `MIXED` non è una base glucidica,
 * è il CATCH-ALL dei template senza base comune — 22/27 spuntini (smoothie, yogurt+
 * frutta+noci, kefir+banana, whey+fragole… e perfino i panini col prosciutto, che nei
 * dati stanno lì per errore di classificazione). Trattarla come base ruotabile spegne
 * il percorso template a metà settimana: col tetto duro 2/sett e ~14 slot spuntino,
 * dopo 2 «yogurt di soia» TUTTI i 22 MIXED sarebbero fuori (panino compreso) e il
 * resto della settimana ricadrebbe sul pool non-template — peggio di prima del fix.
 * MIXED = «senza base»: nessun verdetto, bucket 0, nessuna de-preferenza di giorno;
 * la varietà DENTRO il gruppo la fanno le chiavi successive (variant_group, base
 * proteica, conteggio ricetta) + i tetti sugli ingredienti. NB: vale SOLO per la
 * rotazione — la leva del template (primary_carb_family presente → leva cho) NON
 * passa da qui e non cambia.
 */
export const GRAMMAR_TEMPLATE_CATCH_ALL_BASES: ReadonlySet<string> = new Set(["MIXED"]);

/** Base glucidica ai fini della ROTAZIONE: null per base assente o catch-all (MIXED). */
export function templateRotationBase(recipe: Pick<MenuRecipe, "templateMeta">): string | null {
  const base = recipe.templateMeta?.primaryCarbFamily ?? null;
  return base && !GRAMMAR_TEMPLATE_CATCH_ALL_BASES.has(base) ? base : null;
}

/**
 * Conteggio settimanale per BASE glucidica dei template: Σ dei weekStapleCounts
 * `recipe:<key>` delle ricette attive con lo stesso primary_carb_family (stesso pattern
 * di recipeFamilyWeekCounts). Null-safe: ricette senza template_meta, senza base o a
 * base catch-all (MIXED, fix c-bis) semplicemente non contano.
 */
export function templateBaseWeekCounts(
  recipes: readonly MenuRecipe[] | null | undefined,
  weekStapleCounts?: Record<string, number>,
): Map<string, number> {
  const counts = new Map<string, number>();
  if (!weekStapleCounts) return counts;
  for (const r of recipes ?? []) {
    const base = templateRotationBase(r);
    if (!base) continue;
    const c = weekStapleCounts[recipeRotationKey(r.recipeKey)] ?? 0;
    if (c > 0) counts.set(base, (counts.get(base) ?? 0) + c);
  }
  return counts;
}

/** Prefisso della chiave di rotazione settimanale di una ricetta (una ricetta È un rotation_key). */
export const RECIPE_ROTATION_PREFIX = "recipe:";

export function recipeRotationKey(recipeKey: string): string {
  return `${RECIPE_ROTATION_PREFIX}${recipeKey}`;
}

/** Ricette al massimo in UN pasto principale al giorno e non più di tante a settimana. */
export const GRAMMAR_MAX_RECIPES_PER_WEEK = 3;
/**
 * Quota deterministica di pasti principali che TENTANO una ricetta (roll sul seed
 * atleta+data+slot): ~1 su 3. Non è casualità: stesso atleta, stessa data → stesso piatto.
 */
export const GRAMMAR_RECIPE_SLOT_SHARE_PCT = 34;
/** Sotto questa quota (g/100 g) di componenti FIBER_VEG/FIBER_MICRO_PRIMARY si aggiunge il contorno (L03). */
export const GRAMMAR_RECIPE_VEG_SHARE_MIN = 15;
/** Residuo proteico oltre il quale, DOPO la ricetta (V02), si aggiunge una fonte PRO_PRIMARY (L02). */
export const GRAMMAR_RECIPE_PROTEIN_COMPLEMENT_MIN_G = 15;
/** Porzione minima sensata di piatto cotto (g) — pasti principali. */
export const GRAMMAR_RECIPE_MIN_G = 150;
/**
 * v11: porzione minima per i TEMPLATE di colazione/spuntino. I 150 g dei pasti
 * principali ucciderebbero i template salati densi (SAVOURY_FAST: bresaola+gallette,
 * kcal/100 g alta → il tetto kcal dello slot scende sotto 150 g e il template verrebbe
 * rifiutato prima ancora di provarlo). 90 g = mezza piadina farcita, porzione reale.
 */
export const GRAMMAR_TEMPLATE_RECIPE_MIN_G = 90;
/**
 * Quando la ricetta a leva CHO avrà un complemento proteico (V02), il suo tetto in kcal
 * non è più l'intero slot ma questa quota: il resto è lo spazio del secondo. Senza questo
 * il risotto veniva risolto a tutto lo slot e la trota si AGGIUNGEVA sopra: pasto a +20-38%
 * sul target (misurato in verifica: risotto 520 g + trota 120 g → 1120/930 kcal). Il valore
 * riflette la proporzione di un primo+secondo italiano (il primo è ~2/3 dell'energia); il
 * solver poi riequilibra dentro il tetto, quindi la ricetta può comunque scendere.
 */
export const GRAMMAR_RECIPE_KCAL_SHARE_WITH_COMPLEMENT = 0.68;
/**
 * Sotto questa quota di kcal da CHO la ricetta NON è una matrice a base di carboidrati
 * (es. cotoletta di pollo: 14%) → nel pasto prende il posto della FONTE PROTEICA e il primo
 * (pasta/riso/patate) resta; sopra (pizza 45%, carbonara 47%, lasagne 38%) prende il posto
 * del primo e la proteina si aggiunge solo sul residuo (V02).
 */
export const GRAMMAR_RECIPE_CHO_LED_MIN_SHARE = 0.3;

/** Leva del solver con cui la ricetta entra nel pasto: «cho» = è il primo, «protein» = è il secondo. */
export function recipeLever(per100: { cho: number; pro: number; fat: number }): "cho" | "protein" {
  const total = per100.cho * 4 + per100.pro * 4 + per100.fat * 9;
  if (!(total > 0)) return "cho";
  return (per100.cho * 4) / total >= GRAMMAR_RECIPE_CHO_LED_MIN_SHARE ? "cho" : "protein";
}

/**
 * R-A (regola di commestibilità del proprietario, v11): RICETTA-O-PIATTO ai pasti
 * principali. La soglia kcal di recipeLever guarda le MACRO: una ricetta con una vera
 * fonte CHO ma proteica in macro (bocconcini con patate) entrava come «secondo» e il
 * primo (pasta) restava — due fonti CHO nello stesso piatto. Qui il criterio è
 * ONTOLOGICO: se un componente ha un ruolo glucidico dichiarato da Mario
 * (main_meal_role PRIMARY_COMPLEX_CARB/SECONDARY_CARB, o breakfast_cho_role
 * PRIMARY_COMPLEX), la ricetta POSSIEDE il carboidrato → prende la leva cho e la linea
 * CHO separata si sopprime (il complemento proteico V02 resta com'è). Entry senza dati
 * v6 → false: il criterio macro storico continua a decidere (degradazione, mai svuotare).
 */
export function recipeOwnsCarb(cand: Pick<RecipeCandidate, "ingredients">): boolean {
  return cand.ingredients.some(({ entry }) => {
    const mr = entry.mealRoles;
    if (!mr) return false;
    return (
      mr.mainMealRole === "PRIMARY_COMPLEX_CARB" ||
      mr.mainMealRole === "SECONDARY_CARB" ||
      mr.breakfastChoRole === "PRIMARY_COMPLEX"
    );
  });
}
export const GRAMMAR_RECIPE_STEP_G = 10;

/**
 * QA 24-30 ago (fix d, R-A esteso alla PROTEINA): quota minima (g di componente per
 * 100 g di piatto) perché un componente a ruolo proteico conti come «la ricetta possiede
 * la proteina». Il confronto è STRETTO (>): a-o-sotto la soglia (pecorino 8/100, uovo
 * della carbonara 14/100, e il manzo del ragù a ESATTAMENTE 15,00/100 in pasta_al_ragu
 * e lasagne_al_ragu — verifica avversariale) il componente è un condimento o un legante,
 * non il secondo del pasto.
 */
export const GRAMMAR_RECIPE_PROTEIN_OWN_MIN_SHARE_G = 15;

/**
 * Pavimento di DENSITÀ PROTEICA del piatto (g pro per 100 g cotti) perché la ricetta
 * possa possedere il secondo (verifica avversariale sul fix d): il criterio
 * ruolo-di-catalogo + quota componente NON codifica la densità, e un piatto diluito
 * sopprime un complemento che il solver non può compensare (il target proteico dello
 * slot resta sottoservito, stessa classe di guasto dell'audit 12 ago). Taratura sui
 * dati di prod (SELECT sui componenti attivi pranzo/cena, 22 ago): lato «possiede»
 * il minimo è risotto_gamberi_e_zucchine 9,17 g pro/100 (riso_tacchino_e_carote,
 * soppressione VOLUTA dal QA di Mario, sta a 9,44); lato «non possiede» il massimo è
 * risotto_salmone_e_zucchine 8,53 (poi farro_tonno 8,29, pasta_al_ragu 7,70,
 * cozze_al_pomodoro_con_pane 7,21). Il pavimento a 9 cade nel varco [8,53–9,17].
 */
export const GRAMMAR_RECIPE_PROTEIN_OWN_MIN_DISH_PRO_100G = 9;

/**
 * QA fix d: R-A esteso alla PROTEINA — «ricetta-O-piatto» vale anche per il secondo.
 * Una ricetta primaria che contiene già una proteina «vera» (main_meal_role
 * PRIMARY_PROTEIN, oppure macro_role PRO_PRIMARY) con quota
 * > GRAMMAR_RECIPE_PROTEIN_OWN_MIN_SHARE_G g/100 di piatto, E il cui piatto regge il
 * target (per100.pro ≥ GRAMMAR_RECIPE_PROTEIN_OWN_MIN_DISH_PRO_100G), POSSIEDE la
 * proteina: il complemento V02 si sopprime (riso_tacchino_e_carote NON riceve 80 g di
 * manzo accanto). Stesso pattern di ispezione componenti di recipeHasAnchoredPowder;
 * entry senza mealRoles → false (mai possedere per omissione). Il chiamante lo applica
 * SOLO quando la ricetta è la linea PRIMARIA del pasto principale (leva cho): una
 * ricetta che È il complemento proteico (merluzzo al pomodoro accanto al riso) non
 * passa da qui.
 *
 * PRIMARY_OR_SECONDARY_PROTEIN NON basta (verifica avversariale): quel ruolo esiste per
 * il ripiego vegano dei legumi (L02) e un legume dentro la ricetta NON è il secondo del
 * pasto per gli onnivori — riso_piselli_e_parmigiano (8,4 g pro/100, 11% kcal proteiche)
 * «possedeva» la proteina via piselli e sopprimeva un complemento che il solver non può
 * compensare (servire ~35 g pro dal piatto = ~1.270 kcal, fuori budget slot → target
 * proteico sottoservito). Un legume che è DAVVERO la proteina del piatto passa comunque
 * dal ramo macro_role=PRO_PRIMARY — ma anche lui sotto il pavimento di densità NON
 * possiede: un piatto a 4 g pro/100 sottoserve il target qualunque sia l'ideologia.
 *
 * Seconda verifica avversariale (22 ago): la sola soglia ruolo+quota ammetteva piatti a
 * densità pari o inferiore a riso_piselli (pasta_al_ragu 7,7 g pro/100, cozze 7,2,
 * risotto_salmone 8,5) — stessa matematica dell'esclusione di riso_piselli. Da qui i due
 * giri di vite: quota componente STRETTA (il manzo-condimento a 15,00 esatti di
 * pasta/lasagne al ragù torna ad avere il complemento) + pavimento di densità del piatto.
 */
export function recipeOwnsProtein(cand: Pick<RecipeCandidate, "per100" | "ingredients">): boolean {
  if (!(cand.per100.pro >= GRAMMAR_RECIPE_PROTEIN_OWN_MIN_DISH_PRO_100G)) return false;
  return cand.ingredients.some(({ gramsPer100g, entry }) => {
    const mr = entry.mealRoles;
    if (!mr) return false;
    const proteinRole = mr.mainMealRole === "PRIMARY_PROTEIN" || mr.macroRole === "PRO_PRIMARY";
    return proteinRole && gramsPer100g > GRAMMAR_RECIPE_PROTEIN_OWN_MIN_SHARE_G;
  });
}

export type RecipeCandidate = {
  recipe: MenuRecipe;
  rotationKey: string;
  /** Macro del piatto per 100 g cotti = Σ componenti (neutro = 0). */
  per100: { kcal: number; cho: number; pro: number; fat: number };
  /** Componenti non neutri con la loro entry del catalogo (stesso ordine della ricetta). */
  ingredients: Array<{ gramsPer100g: number; entry: MenuFoodEntry }>;
  /** g/100 g di componenti con ruolo verdura nel pasto (per decidere il contorno). */
  vegShare: number;
  weekCount: number;
  /**
   * D3 (v11): chiavi d'ordinamento del percorso TEMPLATE (colazione/spuntino), calcolate
   * da recipeCandidatesForMeal e usate IDENTICHE dal sort e dal gruppo di sorteggio di
   * chooseRecipeForSlot (stesso contratto del commento su recipeRank: le due devono
   * coincidere). Assente per i pasti principali (ordinamento storico).
   */
  templateOrdering?: {
    /**
     * QA 24-30 ago (fix c): conteggio settimana+giorno della BASE glucidica
     * (primary_carb_family) — PRIMA chiave, prima del tier: una base già servita di
     * recente retrocede tutto il suo gruppo di template, qualunque sia il lotto
     * (variant_group) da cui vengono. Template senza template_meta, senza base o a
     * base catch-all (MIXED, fix c-bis) → 0 (null-safe: nessun verdetto, nessuna
     * penalità).
     */
    baseCount: number;
    /** Tier (CORE < ROTATION): il pasto standard prima delle rotazioni. */
    tierRank: number;
    /**
     * Conteggio settimanale del GRUPPO-VARIANTE (variant_group in template_meta, D3):
     * Σ dei `recipe:<key>` delle ricette dello stesso gruppo, ricostruito a runtime come
     * recipeFamilyWeekCounts. Ricetta senza template_meta → il suo weekCount.
     */
    variantWeekCount: number;
    /**
     * V11_B02 (SOFT, tie-break): uso settimana+giorno della protein_base_family — una
     * base proteica non ancora usata di recente viene prima, a parità delle chiavi sopra.
     */
    proteinBaseCount: number;
  };
};

/** Indice canonical_key → entry a partire dai pool (la stessa entry vive in più pool). */
export function menuFoodEntryIndex(pools: MenuFoodPoolMap | null | undefined): Map<string, MenuFoodEntry> {
  const idx = new Map<string, MenuFoodEntry>();
  if (!pools) return idx;
  for (const list of pools.values()) {
    for (const e of list) if (!idx.has(e.canonicalKey)) idx.set(e.canonicalKey, e);
  }
  return idx;
}

function denyHitEntry(entry: MenuFoodEntry, denyFragments: readonly string[]): boolean {
  const l = entry.labelIt.toLowerCase();
  const k = entry.canonicalKey.toLowerCase();
  return denyFragments.some((f) => {
    const d = f.toLowerCase();
    return d.length > 0 && (l.includes(d) || k.includes(d));
  });
}

function dietExcludesEntry(entry: MenuFoodEntry, dietType?: MediterraneanDietType): boolean {
  if (dietType === "pescatarian") return entry.isMeat;
  if (dietType === "vegetarian") return entry.isMeat || entry.isFish;
  if (dietType === "vegan") return entry.isMeat || entry.isFish || entry.isAnimalProduct;
  return false;
}

const VEG_ROLES: ReadonlySet<MenuFoodMealRole> = new Set(["FIBER_VEG", "FIBER_MICRO_PRIMARY"]);
const CARRIER_ROLES: ReadonlySet<MenuFoodMealRole> = new Set([
  "CHO_PRIMARY",
  "CHO_SECONDARY",
  "PRO_PRIMARY",
  "PRO_SECONDARY",
  "MIXED",
  "COMPOSITE_MAIN",
]);

/**
 * Eleggibilità della ricetta per un pasto:
 *  - v9: quando la ricetta porta la colonna `meals`, la lista ESPLICITA decide (gli
 *    shake dicono breakfast+snack, le lasagne lunch+dinner);
 *  - legacy (righe senza colonna): deduzione dagli ingredienti — la ricetta va bene per
 *    il pasto M se almeno un ingrediente «portante» (ruolo CHO/PRO/MIXED per M) ha
 *    score_M ≥ 7. Così porridge/smoothie/pancake restano fuori da pranzo e cena, mentre
 *    pizza (mozzarella PRO_SECONDARY 7) e carbonara (pasta CHO_PRIMARY 10) entrano.
 *    A COLAZIONE e SPUNTINO la deduzione NON si applica: una ricetta legacy non diventa
 *    colazione per omissione — serve la dichiarazione esplicita di Mario (v9).
 * Non si chiede che TUTTI gli ingredienti abbiano score > 0: l'olio è EXCLUDE a pranzo
 * come alimento a sé ma è dentro quasi ogni ricetta.
 */
export function recipeEligibleForMeal(
  cand: Pick<RecipeCandidate, "ingredients"> & { recipe?: Pick<MenuRecipe, "meals"> },
  meal: MenuFoodRoleMeal,
): boolean {
  const meals = cand.recipe?.meals;
  if (meals && meals.length > 0) return meals.includes(meal);
  if (meal === "breakfast" || meal === "snack") return false;
  return cand.ingredients.some(({ entry }) => {
    const mr = entry.mealRoles;
    if (!mr) return false;
    return CARRIER_ROLES.has(mr.roles[meal]) && mr.scores[meal] >= 7;
  });
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Candidate ricetta per un pasto: risolte sugli ingredienti del catalogo, filtrate per
 * dieta/esclusioni SUGLI INGREDIENTI (un ingrediente vietato → ricetta vietata), per
 * eleggibilità al pasto e per tetto settimanale. Ordinate per conteggio settimanale
 * crescente poi recipe_key (deterministico).
 */
/**
 * Conteggio settimanale di un ingrediente: max fra chiave canonica e famiglia (rotation_key).
 * È la stessa semantica di `weekStapleCountForEntry` in fdc-staple-registry — replicata qui
 * e non importata perché quel modulo importa GIÀ questo (ciclo).
 */
function ingredientWeekCountFor(
  entry: Pick<MenuFoodEntry, "canonicalKey" | "rotationKey">,
  week?: Record<string, number>,
): number {
  if (!week) return 0;
  return Math.max(week[entry.canonicalKey] ?? 0, entry.rotationKey ? (week[entry.rotationKey] ?? 0) : 0);
}

export function recipeCandidatesForMeal(input: {
  recipes: readonly MenuRecipe[] | null | undefined;
  entryIndex: Map<string, MenuFoodEntry>;
  meal: MenuFoodRoleMeal;
  dietType?: MediterraneanDietType;
  denyFragments?: readonly string[];
  weekStapleCounts?: Record<string, number>;
  /**
   * V11_B02 (tie-break): protein_base_family dei template già scelti OGGI (la memoria
   * settimanale non vede i pick della stessa composizione). Solo colazione/spuntino.
   */
  dayUsedProteinBaseFamilies?: ReadonlySet<string>;
  /**
   * QA 24-30 ago (fix c, livello GIORNO): primary_carb_family dei template già scelti
   * OGGI — la de-preferenza «non ripetere» che prima passava da variant_group (etichetta
   * di lotto nei dati) ora gira sulla BASE. Solo colazione/spuntino.
   */
  dayUsedTemplateBases?: ReadonlySet<string>;
}): RecipeCandidate[] {
  const out: RecipeCandidate[] = [];
  const deny = input.denyFragments ?? [];
  const isTemplateMeal = input.meal === "breakfast" || input.meal === "snack";
  // Tetto per FAMIGLIA (V7-C02/V8-M02): conteggio ricostruito a runtime dalle ricette
  // caricate, una volta per chiamata.
  const familyCounts = recipeFamilyWeekCounts(input.recipes, input.weekStapleCounts);
  // QA fix c: conteggio settimanale per BASE glucidica dei template (una volta per chiamata).
  const baseCounts = isTemplateMeal ? templateBaseWeekCounts(input.recipes, input.weekStapleCounts) : null;
  for (const recipe of input.recipes ?? []) {
    const ingredients: RecipeCandidate["ingredients"] = [];
    let resolvable = true;
    let banned = false;
    for (const c of recipe.components) {
      if (c.isNeutral) continue;
      const entry = c.canonicalKey ? input.entryIndex.get(c.canonicalKey) : undefined;
      if (!entry || !(entry.kcalPer100g > 0)) {
        // Ingrediente non nel catalogo attivo (o senza macro): la ricetta non è calcolabile.
        resolvable = false;
        break;
      }
      if (denyHitEntry(entry, deny) || dietExcludesEntry(entry, input.dietType)) {
        banned = true;
        break;
      }
      // Gli INGREDIENTI portano i loro vincoli settimanali dentro la ricetta: il max_week
      // di Mario e il tetto di famiglia (R01) valgono anche quando l'alimento arriva «di
      // sponda» da una ricetta, altrimenti la carbonara servirebbe la pancetta una terza
      // volta a un atleta che il pick semplice ha già bloccato a due. Stessa funzione del
      // pick semplice (grammarPenaltyForEntry), stesso conteggio (weekStapleCountForEntry):
      // una sola regola, due percorsi.
      const ingredientWeekCount = ingredientWeekCountFor(entry, input.weekStapleCounts);
      const ingredientRoles = entry.mealRoles;
      if (ingredientRoles?.maxWeek != null && ingredientWeekCount >= ingredientRoles.maxWeek) {
        banned = true;
        break;
      }
      if (entry.rotationKey && ingredientWeekCount >= ROTATION_MAX_WEEK_USES) {
        banned = true;
        break;
      }
      ingredients.push({ gramsPer100g: c.gramsPer100g, entry });
    }
    if (!resolvable || banned || ingredients.length === 0) continue;

    const per100 = ingredients.reduce(
      (acc, { gramsPer100g, entry }) => {
        const f = gramsPer100g / 100;
        acc.kcal += entry.kcalPer100g * f;
        acc.cho += entry.carbsPer100g * f;
        acc.pro += entry.proteinPer100g * f;
        acc.fat += entry.fatPer100g * f;
        return acc;
      },
      { kcal: 0, cho: 0, pro: 0, fat: 0 },
    );
    if (!(per100.kcal > 0)) continue;

    const cand: RecipeCandidate = {
      recipe,
      rotationKey: recipeRotationKey(recipe.recipeKey),
      per100: {
        kcal: round1(per100.kcal),
        cho: round1(per100.cho),
        pro: round1(per100.pro),
        fat: round1(per100.fat),
      },
      ingredients,
      vegShare: ingredients.reduce(
        (s, { gramsPer100g, entry }) =>
          s + (entry.mealRoles && VEG_ROLES.has(entry.mealRoles.roles[input.meal]) ? gramsPer100g : 0),
        0,
      ),
      weekCount: input.weekStapleCounts?.[recipeRotationKey(recipe.recipeKey)] ?? 0,
    };
    if (!recipeEligibleForMeal(cand, input.meal)) continue;
    if (cand.weekCount >= ROTATION_MAX_WEEK_USES) continue;
    // max_week della RICETTA (pannello admin / Mario): un tetto esplicito, più stretto di
    // quello di famiglia quando c'è. È un verdetto, come max_week sugli alimenti.
    if (recipe.maxWeek != null && cand.weekCount >= recipe.maxWeek) continue;
    // Tetto per FAMIGLIA (v9): la lasagna al ragù di lunedì blocca le lasagne alle
    // verdure di giovedì — il tetto conta la famiglia, non la variante.
    const familyCap = recipe.family != null ? GRAMMAR_RECIPE_FAMILY_MAX_WEEK[recipe.family] : undefined;
    if (familyCap != null && (familyCounts.get(recipe.family!) ?? 0) >= familyCap) continue;
    // QA fix c (VERDETTO): base glucidica già servita GRAMMAR_TEMPLATE_BASE_MAX_WEEK
    // volte in settimana → template fuori, qualunque sia il variant_group (etichetta di
    // lotto nei dati di Mario, non la base). Verdetto duro come i tetti famiglia sopra
    // (il percorso ricette non ha un ripiego relaxWeekCaps: i tetti famiglia esistenti
    // si comportano allo stesso modo). Null-safe: senza template_meta, senza base o a
    // base catch-all (MIXED, fix c-bis) la logica si salta.
    if (baseCounts) {
      const base = templateRotationBase(recipe);
      if (base && (baseCounts.get(base) ?? 0) >= GRAMMAR_TEMPLATE_BASE_MAX_WEEK) continue;
    }
    out.push(cand);
  }
  const byKey = (a: RecipeCandidate, b: RecipeCandidate) =>
    a.recipe.recipeKey < b.recipe.recipeKey ? -1 : a.recipe.recipeKey > b.recipe.recipeKey ? 1 : 0;
  if (isTemplateMeal) {
    // D3 (v11) + QA fix c, percorso TEMPLATE: BASE glucidica non usata di recente
    // (settimana + oggi — la rotazione REALE, per bucket) → tier (il pasto standard CORE
    // precede le rotazioni anche quando la rotazione è a zero) → conteggio settimanale
    // del gruppo-variante → base proteica non usata di recente (V11_B02, tie-break) →
    // conteggio della singola ricetta (evita il bis del giorno prima) → chiave.
    // I conteggi di gruppo sono ricostruiti a runtime dai `recipe:<key>` della memoria
    // settimanale (stesso pattern di recipeFamilyWeekCounts) — V10_G02: oltre al tetto
    // per base (verdetto sopra), il max-ripetizioni esistente resta la rotazione dura.
    const variantCounts = new Map<string, number>();
    const proteinBaseWeekCounts = new Map<string, number>();
    for (const r of input.recipes ?? []) {
      const meta = r.templateMeta;
      if (!meta) continue;
      const c = input.weekStapleCounts?.[recipeRotationKey(r.recipeKey)] ?? 0;
      if (c <= 0) continue;
      if (meta.variantGroup) variantCounts.set(meta.variantGroup, (variantCounts.get(meta.variantGroup) ?? 0) + c);
      if (meta.proteinBaseFamily) {
        proteinBaseWeekCounts.set(meta.proteinBaseFamily, (proteinBaseWeekCounts.get(meta.proteinBaseFamily) ?? 0) + c);
      }
    }
    for (const cand of out) {
      const meta = cand.recipe.templateMeta ?? null;
      const pb = meta?.proteinBaseFamily ?? null;
      // Fix c-bis: la base catch-all (MIXED) non ruota — bucket 0, come «senza base».
      const base = templateRotationBase(cand.recipe);
      cand.templateOrdering = {
        // Bucket: conteggio settimanale della base (già cappato dal verdetto) + 1 se la
        // base è già stata servita OGGI (stesso pattern «+1 day» di proteinBaseCount).
        baseCount: base
          ? Math.min(baseCounts?.get(base) ?? 0, GRAMMAR_TEMPLATE_BASE_MAX_WEEK) +
            (input.dayUsedTemplateBases?.has(base) ? 1 : 0)
          : 0,
        tierRank: recipeRank(cand.recipe),
        variantWeekCount: meta?.variantGroup ? (variantCounts.get(meta.variantGroup) ?? 0) : cand.weekCount,
        proteinBaseCount: pb
          ? (proteinBaseWeekCounts.get(pb) ?? 0) + (input.dayUsedProteinBaseFamilies?.has(pb) ? 1 : 0)
          : 0,
      };
    }
    out.sort((a, b) => {
      const ta = a.templateOrdering!;
      const tb = b.templateOrdering!;
      if (ta.baseCount !== tb.baseCount) return ta.baseCount - tb.baseCount;
      if (ta.tierRank !== tb.tierRank) return ta.tierRank - tb.tierRank;
      if (ta.variantWeekCount !== tb.variantWeekCount) return ta.variantWeekCount - tb.variantWeekCount;
      if (ta.proteinBaseCount !== tb.proteinBaseCount) return ta.proteinBaseCount - tb.proteinBaseCount;
      if (a.weekCount !== b.weekCount) return a.weekCount - b.weekCount;
      return byKey(a, b);
    });
    return out;
  }
  // Pasti principali — ordine STORICO invariato: chi è stato servito meno in settimana
  // viene prima; a parità, il RANK della ricetta (tier v9 quando c'è, altrimenti
  // frequenza); a parità ancora, la chiave per determinismo.
  out.sort((a, b) =>
    a.weekCount !== b.weekCount
      ? a.weekCount - b.weekCount
      : recipeRank(a.recipe) !== recipeRank(b.recipe)
        ? recipeRank(a.recipe) - recipeRank(b.recipe)
        : byKey(a, b),
  );
  return out;
}

/** Ricette già servite nella settimana (chiavi `recipe:*` della memoria settimanale). */
export function weekRecipeCount(weekStapleCounts?: Record<string, number>): number {
  if (!weekStapleCounts) return 0;
  let n = 0;
  for (const [k, v] of Object.entries(weekStapleCounts)) {
    if (k.startsWith(RECIPE_ROTATION_PREFIX) && v > 0) n += v;
  }
  return n;
}

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Sceglie (o no) la ricetta per uno slot principale. Deterministica su (seed, slot):
 *  - il roll sul seed decide se lo slot TENTA una ricetta (~1/3 dei pasti principali);
 *  - una sola ricetta al giorno; tetto settimanale GRAMMAR_MAX_RECIPES_PER_WEEK;
 *  - tra le candidate vince il conteggio settimanale più basso, a parità ruota col seed.
 */
export function chooseRecipeForSlot(input: {
  candidates: readonly RecipeCandidate[];
  seed: number;
  slotKey: MealSlotKey | string;
  weekStapleCounts?: Record<string, number>;
  recipeAlreadyToday: boolean;
  /**
   * v9: quando presente, il tetto settimanale GRAMMAR_MAX_RECIPES_PER_WEEK conta SOLO
   * queste ricette — così i due percorsi (ricette dei pasti principali vs shake di
   * colazione/spuntino) hanno budget settimanali separati e uno shake al mattino non
   * brucia la lasagna di pranzo. Assente = conteggio storico su tutte le `recipe:*`.
   */
  weeklyCapRecipes?: readonly MenuRecipe[];
  /**
   * v11 (V10_G01, template-first): true = tentativo SISTEMATICO — niente roll 1/3 e
   * niente budget settimanale GRAMMAR_MAX_RECIPES_PER_WEEK. A colazione/spuntino il
   * template È il pasto standard, non un'eccezione contingentata: col roll da mercoledì
   * tutte le colazioni ricadrebbero a linee (il budget da 3 si esaurisce in 2 giorni).
   * V10_G02: la rotazione dura resta SOLO il max-ripetizioni esistente (max_week della
   * ricetta + ROTATION_MAX_WEEK_USES, verificati in recipeCandidatesForMeal).
   */
  systematic?: boolean;
}): RecipeCandidate | null {
  if (input.candidates.length === 0 || input.recipeAlreadyToday) return null;
  if (!input.systematic) {
    const weeklyCount = input.weeklyCapRecipes
      ? input.weeklyCapRecipes.reduce(
          (s, r) => s + (input.weekStapleCounts?.[recipeRotationKey(r.recipeKey)] ?? 0),
          0,
        )
      : weekRecipeCount(input.weekStapleCounts);
    if (weeklyCount >= GRAMMAR_MAX_RECIPES_PER_WEEK) return null;
    const roll = (fnv1a(`${input.seed}|${input.slotKey}`) >>> 0) % 100;
    if (roll >= GRAMMAR_RECIPE_SLOT_SHARE_PCT) return null;
  }
  // Il «tier» fra cui si ruota col seed è il gruppo di candidate EQUIVALENTI per le
  // chiavi del sort — LE STESSE chiavi, per contratto (commento su recipeRank): pasti
  // principali = conteggio settimanale minimo E rank migliore; percorso template (D3,
  // candidate con templateOrdering) = tier, conteggio gruppo-variante, base proteica e
  // conteggio ricetta uguali alla prima. I candidati arrivano già ordinati.
  const first = input.candidates[0]!;
  const sameOrderingGroup = (a: RecipeCandidate, b: RecipeCandidate): boolean => {
    const ta = a.templateOrdering;
    const tb = b.templateOrdering;
    if (ta && tb) {
      return (
        ta.baseCount === tb.baseCount &&
        ta.tierRank === tb.tierRank &&
        ta.variantWeekCount === tb.variantWeekCount &&
        ta.proteinBaseCount === tb.proteinBaseCount &&
        a.weekCount === b.weekCount
      );
    }
    return a.weekCount === b.weekCount && recipeRank(a.recipe) === recipeRank(b.recipe);
  };
  const tier = input.candidates.filter((c) => sameOrderingGroup(c, first));
  // PASTI PRINCIPALI: il tier è un PESO, non un cancello (25 ago 2026).
  //
  // Il gruppo qui sopra tiene solo i candidati col rank MIGLIORE, quindi una ROTATION
  // entra solo quando ogni singola CORE è già stata servita in settimana. Con 38 CORE
  // disponibili e ~3 piatti-ricetta a settimana per atleta quel momento non arriva mai:
  // misurato su 182 piani reali, CORE v9 16/19 e CORE v12 13/19 servite, ma **ROTATION
  // 0/60 e OCCASIONAL 0/20** — ottanta ricette di Mario in catalogo e mai in tavola.
  // Per lui «peso 35» e «occasionale» vogliono dire meno spesso, non mai.
  //
  // Ora CORE e ROTATION stanno nello STESSO gruppo e si sorteggia in proporzione al peso
  // che Mario ha già scritto per ogni ricetta (selection_weight: 100 le paste, 35 gnocchi
  // risotti e torte). Col catalogo di oggi fa circa un piatto su tre, cioè una ROTATION a
  // settimana: se un domani decide che i risotti valgono 60, cambia il foglio e il motore
  // lo segue senza toccare il codice.
  //
  // Restano fuori le OCCASIONAL (pizza, burger, lasagne): per quelle Mario ha chiesto
  // «una o due al MESE» e la memoria qui è settimanale — a peso pieno uscirebbero ~4
  // volte troppo. Rientreranno quando il conteggio guarderà 30 giorni invece di 7.
  //
  // Il resto della gerarchia NON si tocca: la memoria settimanale resta la prima chiave
  // (`sameOrderingGroup` confronta `weekCount`), quindi una ricetta già servita non torna
  // prima di quelle mai uscite; i verdetti (max_week, tetti di famiglia, tetto per base)
  // hanno già filtrato le candidate a monte.
  const weighted = input.candidates.filter((c) => sameWeeklyUseAndWeighable(c, first));
  const pool = weighted.length > tier.length ? weighted : tier;
  const roll = (fnv1a(`${input.seed}|${input.slotKey}|recipe`) >>> 0) % 100_000;
  return pickByWeight(pool, roll) ?? tier[0] ?? null;
}

/**
 * Peso di sorteggio di una ricetta: `selection_weight` di Mario quando c'è, altrimenti il
 * valore che lui stesso usa per quel tier nel foglio (CORE 100, ROTATION 35). Mai zero o
 * negativo: una ricetta candidata deve poter uscire, altrimenti sarebbe un verdetto
 * travestito da preferenza — e i verdetti stanno altrove, espliciti.
 */
export const GRAMMAR_RECIPE_TIER_WEIGHT: Readonly<Record<number, number>> = { 0: 100, 1: 35, 2: 10 };

export function recipeSelectionWeight(r: Pick<MenuRecipe, "tier" | "frequency" | "selectionWeight">): number {
  const declared = r.selectionWeight;
  if (typeof declared === "number" && Number.isFinite(declared) && declared > 0) return declared;
  return GRAMMAR_RECIPE_TIER_WEIGHT[recipeRank(r)] ?? 10;
}

/**
 * Stesso uso settimanale E rank sorteggiabile insieme (CORE e ROTATION, non OCCASIONAL).
 * Solo per i pasti principali: il percorso template (colazione/spuntino) ha il suo
 * ordinamento — base, tier, variante, base proteica — e non passa di qui.
 */
const GRAMMAR_WEIGHTED_MAX_RANK = 1; // 0 = CORE, 1 = ROTATION

function sameWeeklyUseAndWeighable(a: RecipeCandidate, b: RecipeCandidate): boolean {
  if (a.templateOrdering || b.templateOrdering) return false;
  if (a.weekCount !== b.weekCount) return false;
  return recipeRank(a.recipe) <= GRAMMAR_WEIGHTED_MAX_RANK && recipeRank(b.recipe) <= GRAMMAR_WEIGHTED_MAX_RANK;
}

/**
 * Estrazione pesata DETERMINISTICA: `roll` è già derivato dal seed (atleta+data+slot), qui
 * si mappa sull'intervallo cumulativo dei pesi. Deterministico non è un dettaglio: se la
 * stessa giornata rigenerata desse piatti diversi, l'atleta vedrebbe cambiare la cena
 * sotto gli occhi a ogni apertura della pagina.
 */
export function pickByWeight(pool: readonly RecipeCandidate[], roll: number): RecipeCandidate | null {
  if (pool.length === 0) return null;
  const weights = pool.map((c) => recipeSelectionWeight(c.recipe));
  const total = weights.reduce((s, w) => s + w, 0);
  if (!(total > 0)) return pool[0] ?? null;
  let acc = 0;
  const target = (roll % total) + 1; // 1..total: nessun candidato con quota nulla
  for (let i = 0; i < pool.length; i += 1) {
    acc += weights[i]!;
    if (target <= acc) return pool[i]!;
  }
  return pool[pool.length - 1] ?? null;
}

/** La ricetta come «hit» per il solver: macro per 100 g di piatto cotto, fdcId 0 (non è un alimento). */
export function recipeCandidateToHit(cand: RecipeCandidate): FdcFoodBrowseHit {
  return {
    fdcId: 0,
    description: cand.recipe.labelIt,
    kcalPer100g: cand.per100.kcal,
    proteinPer100g: cand.per100.pro,
    carbsPer100g: cand.per100.cho,
    fatPer100g: cand.per100.fat,
    tags: {
      mealCourse: [],
      foodFamily: [],
      macroDominant: [],
      slotFit: [],
      dietProfile: ["omnivore"],
      dietExclude: [],
      mealRole: [],
      aminoProfile: [],
      nutrientDensity: [],
      classifierVersion: "meal_grammar_recipe",
    },
    tagSource: "db",
  };
}

/** food_role di un ingrediente per Oggi/meal_item: dal macro_role di Mario, altrimenti dalle macro. */
export function foodRoleForRecipeIngredient(entry: MenuFoodEntry): string {
  const m = entry.mealRoles?.macroRole ?? null;
  if (m === "CHO_PRIMARY" || m === "CHO_SECONDARY") return "cho_complex";
  if (m === "PRO_PRIMARY") return "protein_primary";
  if (m === "PRO_SECONDARY" || m === "MIXED" || m === "PRO_FAT_MIXED") return "protein_secondary";
  if (m === "FAT_PRIMARY") return "fat";
  if (m === "FIBER_MICRO") return "veg_condiment";
  const c = entry.carbsPer100g * 4;
  const p = entry.proteinPer100g * 4;
  const f = entry.fatPer100g * 9;
  if (f >= c && f >= p) return "fat";
  if (p >= c) return "protein_primary";
  return "cho_complex";
}

/**
 * P02 (v9): nelle famiglie shake/crema proteica la POLVERE è ancorata a questa forbice
 * (grammi assoluti); a scalare per i target sono liquido e frutta.
 */
export const GRAMMAR_SHAKE_POWDER_MIN_G = 20;
export const GRAMMAR_SHAKE_POWDER_MAX_G = 35;

/**
 * Densità proteica minima (g/100 g) perché un componente marcato P01 conti come POLVERE
 * proteica da ancorare. Serve perché in prod `default_enabled=false` NON è esclusivo
 * delle polveri: lo portano anche oli (sesame_oil, coconut_oil…), germogli e verdure
 * rare — alfalfa_sprouts è perfino PRO_PRIMARY (3,99 g/100). Le polveri reali stanno a
 * 47,6-82 g/100 (la più bassa è soy_protein_powder 47,6): 40 le separa tutte con margine.
 */
export const GRAMMAR_POWDER_PROTEIN_MIN_PER_100G = 40;

/**
 * V11_G01 (fix del buco famiglia): il componente-polvere si riconosce a livello di
 * COMPONENTE, non dal nome della famiglia ricetta. Il vecchio gate
 * `/PROTEIN/ && /(SHAKE|CREAM|SMOOTHIE|PORRIDGE)/` mancava i template v11 con polvere
 * fuori dalle famiglie *PROTEIN* (EMP_RECIPE_210 family PORRIDGE, EMP_RECIPE_249/250
 * family SWEET_FAST): lì la polvere scalava proporzionalmente e poteva uscire da
 * [20, 35] g. Criterio: marcatore P01 (`defaultEnabled === false`, mai standalone)
 * + ruolo macro PRO_PRIMARY + densità proteica da polvere (vedi soglia sopra).
 */
export function isAnchoredPowderEntry(entry: MenuFoodEntry): boolean {
  const mr = entry.mealRoles;
  return (
    mr?.defaultEnabled === false &&
    mr.macroRole === "PRO_PRIMARY" &&
    entry.proteinPer100g >= GRAMMAR_POWDER_PROTEIN_MIN_PER_100G
  );
}

/** True se la ricetta contiene un componente-polvere da ancorare (V11_G01, family-agnostico). */
export function recipeHasAnchoredPowder(cand: RecipeCandidate): boolean {
  return cand.ingredients.some(({ entry }) => isAnchoredPowderEntry(entry));
}

/**
 * Scala la ricetta a `grams` di piatto cotto: componenti con grammi e macro calcolati
 * dall'entry del catalogo (fdc), totali = Σ componenti (così «macro = somma ingredienti»
 * vale esattamente anche dopo l'arrotondamento).
 *
 * P02 (v9) + V11_G01: il componente-polvere — riconosciuto per COMPONENTE da
 * isAnchoredPowderEntry (marcatore P01 + PRO_PRIMARY + densità), family-agnostico, non
 * da chiavi hardcoded né dal nome famiglia — resta ancorato a [20, 35] g; il residuo lo assorbono
 * proporzionalmente gli altri componenti (liquido/frutta), così il totale resta `grams`.
 * NOTA dichiarata: il solver ha risolto i grammi sulle macro LINEARI per 100 g
 * (recipeCandidateToHit) — con l'ancora le macro reali del piatto deviano dal lineare;
 * deriva piccola (polvere 20-35 g su 250-380) e misurabile in shadow (il flag
 * `shake_powder_anchored` la segnala dal compositore).
 */
export function scaleRecipe(
  cand: RecipeCandidate,
  grams: number,
): { components: MealPlanV2RecipeComponent[]; totals: { kcal: number; choG: number; proG: number; fatG: number } } {
  const gramsFor = cand.ingredients.map(({ gramsPer100g }) => (grams * gramsPer100g) / 100);
  const powderIdx = cand.ingredients.findIndex(({ entry }) => isAnchoredPowderEntry(entry));
  if (powderIdx >= 0) {
    const naive = gramsFor[powderIdx]!;
    const anchored = Math.min(GRAMMAR_SHAKE_POWDER_MAX_G, Math.max(GRAMMAR_SHAKE_POWDER_MIN_G, naive));
    const othersNaive = gramsFor.reduce((s, g, i) => (i === powderIdx ? s : s + g), 0);
    const factor = othersNaive > 0 ? (othersNaive + (naive - anchored)) / othersNaive : 1;
    if (anchored !== naive && factor > 0) {
      for (let i = 0; i < gramsFor.length; i += 1) {
        gramsFor[i] = i === powderIdx ? anchored : gramsFor[i]! * factor;
      }
    }
  }
  const components: MealPlanV2RecipeComponent[] = cand.ingredients.map(({ entry }, i) => {
    const g = round1(gramsFor[i]!);
    const f = g / 100;
    return {
      canonicalKey: entry.canonicalKey,
      fdcId: entry.fdcId,
      labelIt: entry.labelIt,
      grams: g,
      kcal: round1(entry.kcalPer100g * f),
      choG: round1(entry.carbsPer100g * f),
      proG: round1(entry.proteinPer100g * f),
      fatG: round1(entry.fatPer100g * f),
      ...(entry.rotationKey ? { rotationKey: entry.rotationKey } : {}),
      foodRole: foodRoleForRecipeIngredient(entry),
    };
  });
  const totals = components.reduce(
    (acc, c) => ({
      kcal: round1(acc.kcal + c.kcal),
      choG: round1(acc.choG + c.choG),
      proG: round1(acc.proG + c.proG),
      fatG: round1(acc.fatG + c.fatG),
    }),
    { kcal: 0, choG: 0, proG: 0, fatG: 0 },
  );
  return { components, totals };
}

// ── Provenienza (canale QA) ──────────────────────────────────────────────────────────

export type MealGrammarProvenanceItem = { label: string; grams: number; kcal: number; recipe?: string };
export type MealGrammarProvenanceSlot = {
  key: string;
  before: { items: MealGrammarProvenanceItem[]; kcal: number; choG: number; proG: number; fatG: number } | null;
  after: { items: MealGrammarProvenanceItem[]; kcal: number; choG: number; proG: number; fatG: number } | null;
  changed: boolean;
  deltaKcal: number;
  recipe?: string;
};
export type MealGrammarProvenance = {
  engine: "meal_grammar_v1";
  mode: "shadow" | "on";
  /** true SOLO quando la composizione servita è quella con la grammatica. */
  applied: boolean;
  recipesAvailable: number;
  changedSlots: number;
  flags: string[];
  slots: MealGrammarProvenanceSlot[];
};

function slotSummary(s: MealPlanV2ComposedSlot | undefined) {
  if (!s) return null;
  return {
    items: s.items.map((it) => ({
      label: it.description,
      grams: Math.round(it.grams),
      kcal: Math.round(it.kcal),
      ...(it.recipe ? { recipe: it.recipe.recipeKey } : {}),
    })),
    kcal: Math.round(s.totals.kcal),
    choG: round1(s.totals.choG),
    proG: round1(s.totals.proG),
    fatG: round1(s.totals.fatG),
  };
}

/**
 * B01 (decisione 5): verifica post-compose della quota CHO complessa a colazione —
 * forbetta 80-85% ± 5pp → [0,75, 0,90]. Si valuta SOLO quando entrambe le linee
 * esistono (la B02 saltata ha già il suo flag `optional_line_skipped`). È una VERIFICA,
 * non una correzione: fuori forbetta → flag.
 *
 * R-D (v11, decisione del proprietario): il DENOMINATORE è la somma CHO delle sole
 * linee/componenti a ruolo GLUCIDICO (cho_complex + cho_simple, frutta compresa), NON il
 * CHO totale del pasto: la regola di Mario ripartisce la BASE glucidica della colazione
 * (cereali vs quota semplice) e il lattosio del latte/yogurt non c'entra — col totale a
 * denominatore uno yogurt zuccherino faceva flaggare colazioni perfettamente a regola.
 * Quando la colazione è template-led i CHO glucidici vivono nei COMPONENTI della
 * ricetta (foodRole per componente): si sommano quelli.
 */
function b01ShareFlags(after: MealPlanV2ComposedSlot[]): string[] {
  const flags: string[] = [];
  const glucidic = (foodRole: string | undefined) => foodRole === "cho_complex" || foodRole === "cho_simple";
  for (const s of after) {
    if (mealForSlot(s.slot) !== "breakfast") continue;
    const choP = s.items.filter((it) => !it.recipe && it.foodRole === "cho_complex").reduce((a, it) => a + it.choG, 0);
    const choS = s.items.filter((it) => !it.recipe && it.foodRole === "cho_simple").reduce((a, it) => a + it.choG, 0);
    const choTot = s.items.reduce((a, it) => {
      if (it.recipe) {
        return a + it.recipe.components.reduce((b, c) => b + (glucidic(c.foodRole) ? c.choG : 0), 0);
      }
      return a + (glucidic(it.foodRole) ? it.choG : 0);
    }, 0);
    if (!(choP > 0) || !(choS > 0) || !(choTot > 0)) continue;
    const share = choP / choTot;
    if (share < GRAMMAR_B01_PRIMARY_SHARE_MIN || share > GRAMMAR_B01_PRIMARY_SHARE_MAX) {
      flags.push(`b01_share_out:${s.slot}:${Math.round(share * 100)}`);
    }
  }
  return flags;
}

/**
 * Confronto compatto vecchia-vs-nuova composizione, da scrivere in
 * `nutrition_plan.inputs_provenance.meal_grammar` (accanto a `day_engine`, mai al suo posto).
 */
export function buildMealGrammarProvenance(input: {
  mode: "shadow" | "on";
  applied: boolean;
  before: MealPlanV2ComposedSlot[];
  after: MealPlanV2ComposedSlot[];
  recipesAvailable: number;
  flags?: string[];
}): MealGrammarProvenance {
  const keys = [...new Set([...input.before.map((s) => s.slot), ...input.after.map((s) => s.slot)])];
  const slots: MealGrammarProvenanceSlot[] = keys.map((key) => {
    const b = input.before.find((s) => s.slot === key);
    const a = input.after.find((s) => s.slot === key);
    const before = slotSummary(b);
    const after = slotSummary(a);
    const sig = (x: ReturnType<typeof slotSummary>) => (x ? x.items.map((i) => `${i.label}:${i.grams}`).join("|") : "");
    const recipe = a?.items.find((it) => it.recipe)?.recipe?.recipeKey;
    return {
      key,
      before,
      after,
      changed: sig(before) !== sig(after),
      deltaKcal: (after?.kcal ?? 0) - (before?.kcal ?? 0),
      ...(recipe ? { recipe } : {}),
    };
  });
  return {
    engine: "meal_grammar_v1",
    mode: input.mode,
    applied: input.applied,
    recipesAvailable: input.recipesAvailable,
    changedSlots: slots.filter((s) => s.changed).length,
    flags: [...(input.flags ?? []), ...b01ShareFlags(input.after)],
    slots,
  };
}
