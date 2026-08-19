/**
 * Grammatica dei pasti del nutrizionista (file Mario v5) dentro il compositore V2:
 * «la grammatica di Mario, i nostri numeri». Qui vivono le parti PURE (nessun I/O):
 *
 *  - il gate `NUTRITION_MEAL_GRAMMAR_MODE` (off | shadow | on, default shadow);
 *  - il filtro secco per pasto (score 0 / ruolo EXCLUDE → fuori; max_week; frequenza
 *    come priorità) applicato DENTRO il pool di assemblaggio — e sotto grammatica un pool
 *    del catalogo svuotato NON ricade mai sul pool USDA grezzo (vedi pickLineForRole nel
 *    compositore: ripiego «relaxWeekCaps» sull'ontologia intatta, poi linea saltata + flag);
 *  - le ricette come matrice mista (L04/V02): eleggibilità per pasto, esclusioni sugli
 *    INGREDIENTI, macro per 100 g calcolate dagli ingredienti del catalogo, scala grammi;
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
import { ROTATION_MAX_WEEK_USES } from "@/lib/nutrition/meal-composition-rules";
import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import type {
  MenuFoodEntry,
  MenuFoodMealRole,
  MenuFoodPoolMap,
  MenuFoodRoleMeal,
} from "@/lib/nutrition/v2/menu-food-catalog-db";
import type { MenuRecipe } from "@/lib/nutrition/v2/menu-recipe-catalog-db";

// ── Gate ─────────────────────────────────────────────────────────────────────────────

export type NutritionMealGrammarMode = "off" | "shadow" | "on";

/**
 * `NUTRITION_MEAL_GRAMMAR_MODE`: off | shadow | on. Default (assente/ignoto) = shadow: si
 * calcola la composizione nuova e la si registra, ma si SERVE la vecchia. In shadow,
 * `NUTRITION_MEAL_GRAMMAR_ATHLETES` (csv di athlete_id) accende «on» per singoli atleti —
 * stesso schema del day-engine, così il rollout si fa per gradi senza deploy.
 */
export function resolveMealGrammarMode(
  env: Record<string, string | undefined>,
  athleteId: string | null | undefined,
): NutritionMealGrammarMode {
  const raw = (env.NUTRITION_MEAL_GRAMMAR_MODE ?? "").trim().toLowerCase();
  const globalMode: NutritionMealGrammarMode = raw === "off" ? "off" : raw === "on" ? "on" : "shadow";
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

/** B02: la quota CHO secondaria di colazione (frutta, miele, marmellata). */
export const GRAMMAR_BREAKFAST_SECONDARY_ROLES: readonly MenuFoodMealRole[] = ["CHO_SECONDARY"];

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
      // Dagli altri pool entra SOLO chi Mario ha marcato CHO_SECONDARY a colazione (un
      // alimento senza score in snack_cho non diventa colazione per omissione).
      if (seen.has(e.canonicalKey) || e.mealRoles?.roles.breakfast !== "CHO_SECONDARY") continue;
      seen.add(e.canonicalKey);
      out.push(e);
    }
  }
  return out;
}

/**
 * B01/B02: quota della CHO di colazione coperta dal CHO_PRIMARY (0,80-0,90) → la linea
 * secondaria copre il complemento (0,10-0,20). Punto medio 0,15, così anche con lo
 * step di 5 g la primaria resta dentro la forbetta.
 */
export const GRAMMAR_BREAKFAST_SECONDARY_CHO_SHARE = 0.15;

/** S01 (HARD): spuntino pratico → prep_speed minimo (valore_default del file regole). */
export const GRAMMAR_SNACK_PREP_SPEED_MIN = 7;

/**
 * Penalità di priorità per frequenza (mai esclusione): più grandi dell'offset massimo di
 * rotazione per seed (pool ≤ 40 → 390) così un OCCASIONAL perde contro qualunque COMMON
 * disponibile e un ROTATION contro la maggior parte, ma entrambi restano pescabili quando
 * i COMMON sono esauriti da rotazione/tetti settimanali.
 */
export const GRAMMAR_FREQUENCY_PENALTY: Readonly<Record<string, number>> = {
  COMMON: 0,
  ROTATION: 200,
  OCCASIONAL: 400,
};

/**
 * D02 (SOFT): «privilegiare grassi insaturi e fonti ittiche/oleose nel bilancio
 * settimanale». Non è un vincolo, è una spinta: a CENA, se nella settimana non è ancora
 * comparso pesce, il pesce riceve un bonus di priorità che vince l'offset di rotazione per
 * seed (max 390 nei pool ≤40) ma perde contro le esclusioni e i tetti (che sono già
 * verdetti, non punteggi). Appena una famiglia ittica è nella memoria settimanale, il bonus
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
  /** Ruoli ammessi nel pool per questo pick; assente = solo il filtro score/EXCLUDE. */
  allowedRoles?: ReadonlySet<MenuFoodMealRole>;
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
  const role = mr.roles[filter.meal];
  const score = mr.scores[filter.meal];
  if (role === "EXCLUDE" || !(score > 0)) return null;
  if (filter.allowedRoles && !filter.allowedRoles.has(role)) return null;
  if (mr.maxWeek != null && weekCount >= mr.maxWeek) return null;
  if (filter.prepSpeedMin != null && mr.prepSpeed != null && mr.prepSpeed < filter.prepSpeedMin) return null;
  return GRAMMAR_FREQUENCY_PENALTY[mr.frequency] ?? 0;
}

// ── Ricette (L04/V02) ────────────────────────────────────────────────────────────────

/** Ordine di preferenza per frequenza della ricetta (più basso = preferito). */
const RECIPE_FREQUENCY_RANK: Readonly<Record<string, number>> = { COMMON: 0, ROTATION: 1, OCCASIONAL: 2 };

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
/** Porzione minima sensata di piatto cotto (g). */
export const GRAMMAR_RECIPE_MIN_G = 150;
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
export const GRAMMAR_RECIPE_STEP_G = 10;

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
 * Le ricette del catalogo NON hanno un pasto dichiarato: l'eleggibilità si deduce dagli
 * ingredienti — una ricetta va bene per il pasto M se almeno un ingrediente «portante»
 * (ruolo CHO/PRO/MIXED per M) ha score_M ≥ 7. Così porridge/smoothie/pancake (tutti gli
 * ingredienti EXCLUDE/NONE a pranzo) restano fuori da pranzo e cena, mentre pizza
 * (mozzarella PRO_SECONDARY 7) e carbonara (pasta CHO_PRIMARY 10) entrano. Non si chiede
 * che TUTTI gli ingredienti abbiano score > 0: l'olio, ad esempio, è EXCLUDE a pranzo come
 * alimento a sé ma è dentro quasi ogni ricetta di Mario.
 */
export function recipeEligibleForMeal(cand: Pick<RecipeCandidate, "ingredients">, meal: MenuFoodRoleMeal): boolean {
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
}): RecipeCandidate[] {
  const out: RecipeCandidate[] = [];
  const deny = input.denyFragments ?? [];
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
    out.push(cand);
  }
  // Ordine: chi è stato servito meno in settimana viene prima; a parità, la FREQUENZA della
  // ricetta (stessa semantica degli alimenti: COMMON prima di ROTATION prima di OCCASIONAL
  // — abbassa la priorità, non esclude); a parità ancora, la chiave per determinismo.
  out.sort((a, b) =>
    a.weekCount !== b.weekCount
      ? a.weekCount - b.weekCount
      : RECIPE_FREQUENCY_RANK[a.recipe.frequency] !== RECIPE_FREQUENCY_RANK[b.recipe.frequency]
        ? RECIPE_FREQUENCY_RANK[a.recipe.frequency] - RECIPE_FREQUENCY_RANK[b.recipe.frequency]
        : a.recipe.recipeKey < b.recipe.recipeKey
          ? -1
          : a.recipe.recipeKey > b.recipe.recipeKey
            ? 1
            : 0,
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
}): RecipeCandidate | null {
  if (input.candidates.length === 0 || input.recipeAlreadyToday) return null;
  if (weekRecipeCount(input.weekStapleCounts) >= GRAMMAR_MAX_RECIPES_PER_WEEK) return null;
  const roll = (fnv1a(`${input.seed}|${input.slotKey}`) >>> 0) % 100;
  if (roll >= GRAMMAR_RECIPE_SLOT_SHARE_PCT) return null;
  // Il «tier» fra cui si ruota col seed è: conteggio settimanale minimo E frequenza migliore
  // fra quelle a quel conteggio. Così una pizza OCCASIONAL non entra in sorteggio contro
  // una pasta al pomodoro COMMON finché entrambe sono a zero — esce solo quando le COMMON
  // sono già state usate (o non ce ne sono). I candidati arrivano già ordinati.
  const first = input.candidates[0]!;
  const tier = input.candidates.filter(
    (c) => c.weekCount === first.weekCount && RECIPE_FREQUENCY_RANK[c.recipe.frequency] === RECIPE_FREQUENCY_RANK[first.recipe.frequency],
  );
  const offset = (fnv1a(`${input.seed}|${input.slotKey}|recipe`) >>> 0) % tier.length;
  return tier[offset] ?? null;
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
 * Scala la ricetta a `grams` di piatto cotto: componenti con grammi e macro calcolati
 * dall'entry del catalogo (fdc), totali = Σ componenti (così «macro = somma ingredienti»
 * vale esattamente anche dopo l'arrotondamento).
 */
export function scaleRecipe(
  cand: RecipeCandidate,
  grams: number,
): { components: MealPlanV2RecipeComponent[]; totals: { kcal: number; choG: number; proG: number; fatG: number } } {
  const components: MealPlanV2RecipeComponent[] = cand.ingredients.map(({ gramsPer100g, entry }) => {
    const g = round1((grams * gramsPer100g) / 100);
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
    flags: [...(input.flags ?? [])],
    slots,
  };
}
