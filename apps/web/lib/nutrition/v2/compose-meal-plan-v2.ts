import type {
  DailyNutritionRequirementsV2,
  MealPlanV2ComposedItem,
  MealPlanV2ComposedSlot,
  MealPlanV2DietSlotBudget,
  MealPlanV2ServingBasis,
} from "@empathy/contracts";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { isMainMealSlot } from "@/lib/nutrition/meal-composition-rules";
import type { MediterraneanDietType } from "@/lib/nutrition/mediterranean-meal-composer";
import {
  createMediterraneanDayContext,
  type MediterraneanDayContext,
} from "@/lib/nutrition/mediterranean-meal-composer";
import {
  composeRacePostRecoveryMeal,
  composeRacePreLunchMainMeal,
  isRacePreRaceMealSlot,
} from "@/lib/nutrition/race-day-pre-race-lunch";
import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import { filterFdcCandidates } from "@/lib/nutrition/v2/fdc-candidate-filter";
import { solveFdcMealPortions, type FdcAssemblyLine } from "@/lib/nutrition/v2/fdc-meal-macro-solver";
import { pickBestFdcForRole, type RolePickContext } from "@/lib/nutrition/v2/fdc-healthy-meal-scoring";
import {
  labelItForStaple,
  pickStapleForPool,
  servingBasisForCanonical,
  type StapleRegistryEntry,
} from "@/lib/nutrition/v2/fdc-staple-registry";
import type { MenuFoodEntry, MenuFoodMealRole, MenuFoodPoolMap } from "@/lib/nutrition/v2/menu-food-catalog-db";
import type { MenuRecipe } from "@/lib/nutrition/v2/menu-recipe-catalog-db";
import {
  GRAMMAR_BREAKFAST_SECONDARY_CHO_SHARE,
  GRAMMAR_BREAKFAST_SECONDARY_ROLES,
  GRAMMAR_BREAKFAST_SECONDARY_V6,
  GRAMMAR_MAIN_FAT_CONDIMENT_V6,
  GRAMMAR_MAIN_FAT_MAX_G,
  GRAMMAR_MAIN_FAT_MIN_G,
  GRAMMAR_MAIN_FAT_MIN_RESIDUAL_G,
  GRAMMAR_MAIN_FAT_STEP_G,
  GRAMMAR_RECIPE_KCAL_SHARE_WITH_COMPLEMENT,
  GRAMMAR_RECIPE_MIN_G,
  GRAMMAR_RECIPE_PROTEIN_COMPLEMENT_MIN_G,
  GRAMMAR_RECIPE_STEP_G,
  GRAMMAR_RECIPE_VEG_SHARE_MIN,
  GRAMMAR_ROLES_BY_POOL,
  GRAMMAR_SNACK_FRUIT_SIDE_MIN_CHO_G,
  GRAMMAR_SNACK_FRUIT_SIDE_V6,
  GRAMMAR_SNACK_PREP_SPEED_MIN,
  GRAMMAR_SNACK_PRO_EGG_MAX_G,
  GRAMMAR_SNACK_PRO_MAX_G,
  GRAMMAR_TEMPLATE_RECIPE_MIN_G,
  GRAMMAR_V6_ROLES_BY_POOL,
  breakfastSecondaryMenuEntries,
  chooseRecipeForSlot,
  grammarPoolMeal,
  lineDroppableBelowMinServed,
  mainMealFatCondimentEntries,
  mealForSlot,
  menuFoodEntryIndex,
  recipeCandidateToHit,
  recipeCandidatesForMeal,
  recipeHasAnchoredPowder,
  recipeLever,
  recipeOwnsCarb,
  scaleRecipe,
  snackFruitSideEntries,
  weekBreakfastSweetsCount,
  type GrammarPickFilter,
  type GrammarV6Axis,
  type RecipeCandidate,
} from "@/lib/nutrition/v2/meal-grammar";
import { mediterraneanMealToV2Items } from "@/lib/nutrition/v2/v2-mediterranean-meal-adapter";
import {
  MEAL_SLOT_ASSEMBLY,
  slotMacroTargetsFromDiet,
  type MealSlotAssemblyRole,
} from "@/lib/nutrition/v2/meal-slot-assembly-spec";

export type FdcPoolMap = Map<string, FdcFoodBrowseHit[]>;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function macrosFromHit(
  c: FdcFoodBrowseHit,
  grams: number,
): Omit<MealPlanV2ComposedItem, "fdcId" | "description" | "grams" | "canonicalKey" | "servingBasis"> {
  const f = grams / 100;
  return {
    kcal: round1(c.kcalPer100g * f),
    choG: round1(c.carbsPer100g * f),
    proG: round1(c.proteinPer100g * f),
    fatG: round1(c.fatPer100g * f) || round1(((c.kcalPer100g - c.carbsPer100g * 4 - c.proteinPer100g * 4) / 9) * f) || 0,
  };
}

function pickFromPoolFallback(
  pool: FdcFoodBrowseHit[],
  ctx: RolePickContext,
  denyFragments: string[],
  usedFdcIds: Set<number>,
  staplePenalty: (description: string) => number,
): FdcFoodBrowseHit | null {
  const filtered = filterFdcCandidates(pool, denyFragments);
  const pick = pickBestFdcForRole(filtered, ctx, denyFragments, usedFdcIds, staplePenalty);
  if (pick) return pick;

  if (isMainMealSlot(ctx.slot) && ctx.spec.foodRole === "cho_complex") {
    for (const hit of filtered) {
      if (usedFdcIds.has(hit.fdcId) || hit.carbsPer100g < 12) continue;
      if (/\b(rice cake|crackers?|cookie|cake|snack bar)\b/i.test(hit.description)) continue;
      if (/\b(pasta|riso\b|potato|quinoa|spaghetti)\b/i.test(hit.description) && !/\brice cake\b/i.test(hit.description)) {
        return hit;
      }
    }
  }
  return null;
}

export function portionHintIt(
  label: string,
  grams: number,
  spec: MealSlotAssemblyRole,
  servingBasis?: MealPlanV2ServingBasis,
): string {
  const g = Math.round(grams);
  const basis = servingBasis ?? "dry_grams";
  if (spec.foodRole === "cho_complex" && (/pasta|semola/i.test(label) || basis === "dry_grams" && /pasta/i.test(label))) {
    return `${g} g pasta di semola (peso a crudo)`;
  }
  if (spec.foodRole === "cho_complex" && (/riso/i.test(label) || /rice/i.test(label))) {
    return basis === "dry_grams" ? `${g} g riso (peso a crudo)` : `${g} g riso cotto`;
  }
  if (spec.foodRole === "cho_complex" && /patat/i.test(label)) {
    return `${g} g patate lesse o al forno`;
  }
  if (spec.foodRole === "protein_primary" && /uov/i.test(label)) {
    return `${Math.max(1, Math.round(g / 50))} uova medie (≈${g} g)`;
  }
  if (/grana|parmesan|pecorino|padano/i.test(label)) {
    return `${g} g grana grattugiato`;
  }
  if (spec.foodRole === "fat" && /olio/i.test(label)) {
    return `${g} ml olio EVO`;
  }
  if (/latte/i.test(label)) {
    return `${g} ml latte`;
  }
  if (basis === "ml") return `${g} ml ${label}`;
  if (basis === "cooked_grams") return `${g} g ${label} (cotto)`;
  return `${g} g ${label}`;
}

type PickLine = FdcAssemblyLine & { staple?: StapleRegistryEntry; recipe?: RecipeCandidate };

/**
 * Selezione ruoli per un pick: vocabolario v5 e/o asse v6 (il filtro applica il v6 alle
 * entry che portano dati v6 e il v5 alle altre — decisione 2, degradazione inclusa).
 */
type GrammarRolesOverride = {
  v5?: readonly MenuFoodMealRole[];
  v6?: { axis: GrammarV6Axis; roles: readonly string[] };
};

/**
 * Filtro grammatica per un pick dentro `slotKey`: pasto dello slot + ruoli ammessi nel
 * pool (v5 E v6, o quelli passati) + prep_speed minimo agli spuntini (S01) + conteggio
 * dolci per B05 a colazione. L'asse v6 del pool si applica SOLO nel suo pasto naturale
 * (la regola 7 usa breakfast_cho a pranzo: lì resta il v5). Solo con grammatica attiva.
 */
function grammarFilterFor(
  ctx: ComposeContext,
  slotKey: MealSlotKey,
  poolKey: string,
  rolesOverride?: GrammarRolesOverride,
  relaxWeekCaps?: boolean,
): GrammarPickFilter | undefined {
  if (!ctx.grammar) return undefined;
  const meal = mealForSlot(slotKey);
  const v5Roles = rolesOverride ? rolesOverride.v5 : GRAMMAR_ROLES_BY_POOL[poolKey]?.primary;
  const poolV6 = GRAMMAR_V6_ROLES_BY_POOL[poolKey];
  const v6 = rolesOverride
    ? rolesOverride.v6
    : poolV6 && grammarPoolMeal(poolKey) === meal
      ? { axis: poolV6.axis, roles: poolV6.primary }
      : undefined;
  return {
    meal,
    ...(v5Roles ? { allowedRoles: new Set(v5Roles) } : {}),
    ...(v6 ? { v6: { axis: v6.axis, allowed: new Set(v6.roles) } } : {}),
    ...(meal === "breakfast" ? { sweetsWeekCount: ctx.grammar.sweetsWeekCount } : {}),
    ...(meal === "snack" ? { prepSpeedMin: GRAMMAR_SNACK_PREP_SPEED_MIN } : {}),
    ...(relaxWeekCaps ? { relaxWeekCaps: true } : {}),
    // V7-03 (v9): dopo il primo VARIETY dello slot TUTTE le linee successive (B02,
    // condimento M01, re-pick regola 7) ereditano il blocco — il filtro si costruisce a
    // ogni pick, quindi legge lo stato aggiornato.
    ...(ctx.grammar.varietyUsedInSlot ? { varietyBlocked: true } : {}),
  };
}

type PickLineOptions = {
  /** Ruoli ammessi al posto dei primari del pool (es. B02: CHO secondaria v5+v6). */
  rolesOverride?: GrammarRolesOverride;
  /** Entry del catalogo da usare al posto di `menuPools.get(spec.poolKey)` (es. B02: pool virtuale). */
  menuEntriesOverride?: MenuFoodEntry[];
  /**
   * Linea facoltativa: se la grammatica non trova nulla la linea SALTA senza ripiego
   * «relaxWeekCaps» (B02: la quota secondaria «può» coprire il residuo, non deve).
   */
  optional?: boolean;
  /**
   * Ignora da subito il tetto di rotazione di famiglia (condimento M01: l'olio EVO si
   * ripete per natura, non è un piatto da ruotare). Il max_week di Mario resta duro.
   */
  relaxWeekCaps?: boolean;
  /**
   * Non registrare il pick in usedFdcIds/dayUsedCanonicalKeys/famiglie (condimento M01:
   * lo stesso EVO deve poter condire pranzo E cena dello stesso giorno).
   */
  skipUsageRegistration?: boolean;
};

function pickLineForRole(
  spec: MealSlotAssemblyRole,
  slotKey: MealSlotKey,
  pools: FdcPoolMap,
  ctx: ComposeContext,
  opts?: PickLineOptions,
): PickLine | null {
  const roleCtx: RolePickContext = { slot: slotKey, poolKey: spec.poolKey, spec };
  const seed = ctx.seed + spec.poolKey.length;
  const rolesOverride = opts?.rolesOverride;

  // Catalogo DB prima: se il pool del menù esiste ed è non-vuoto, pickStapleForPool usa
  // SOLO quello (il catalogo contiene già tutti gli alimenti pescabili: se il pick torna
  // null per penalità NON ritentiamo l'allowlist — il fallback resta il rawPool taggato).
  const menuEntries = opts?.menuEntriesOverride ?? ctx.menuPools?.get(spec.poolKey);
  const hasMenuPool = !!menuEntries && menuEntries.length > 0;

  const pickArgs = {
    poolKey: spec.poolKey,
    seed,
    dietType: ctx.dietType,
    denyFragments: ctx.denyFragments,
    dayCtx: ctx.dayCtx,
    usedCarbFamilies: ctx.usedCarbFamilies,
    usedFdcIds: ctx.usedFdcIds,
    menuEntries: hasMenuPool ? menuEntries : undefined,
  };
  let staplePick = pickStapleForPool({
    ...pickArgs,
    grammar: grammarFilterFor(ctx, slotKey, spec.poolKey, rolesOverride, opts?.relaxWeekCaps),
  });
  // Grammatica: se nessun ruolo primario è disponibile (es. dieta vegana a pranzo), i
  // ruoli di ripiego del pool possono diventare la fonte — v5 (PRO_SECONDARY/MIXED, L02)
  // e v6 (M03: SECONDARY_PROTEIN/legumi; M02: SECONDARY_CARB/patate; B06: affettati; B07:
  // semi/grassi animali) insieme: per ogni entry vale il suo vocabolario.
  const fallbackRoles = GRAMMAR_ROLES_BY_POOL[spec.poolKey]?.fallback;
  const fallbackV6 = GRAMMAR_V6_ROLES_BY_POOL[spec.poolKey]?.fallback;
  const poolV6 = GRAMMAR_V6_ROLES_BY_POOL[spec.poolKey];
  const v6InMeal = poolV6 && grammarPoolMeal(spec.poolKey) === mealForSlot(slotKey);
  if (!staplePick && ctx.grammar && !rolesOverride && (fallbackRoles || (v6InMeal && fallbackV6))) {
    staplePick = pickStapleForPool({
      ...pickArgs,
      grammar: grammarFilterFor(ctx, slotKey, spec.poolKey, {
        ...(fallbackRoles ? { v5: fallbackRoles } : {}),
        ...(v6InMeal && fallbackV6 ? { v6: { axis: poolV6.axis, roles: fallbackV6 } } : {}),
      }, opts?.relaxWeekCaps),
    });
  }
  if (!staplePick && ctx.grammar && hasMenuPool) {
    // La grammatica ha SVUOTATO il pool del catalogo (rotazione settimanale/max_week esauriti).
    // Il rawPool USDA (inglese, senza canonical_key, senza score) non è mai una risposta
    // sotto grammatica: prima si ritenta ignorando il solo tetto di rotazione di famiglia
    // (ontologia e max_week di Mario intatti), e se non basta la linea salta e lo si
    // registra in provenienza.
    if (!opts?.optional) {
      const v5All = rolesOverride
        ? rolesOverride.v5
        : [...(GRAMMAR_ROLES_BY_POOL[spec.poolKey]?.primary ?? []), ...(fallbackRoles ?? [])];
      const v6All = rolesOverride
        ? rolesOverride.v6
        : v6InMeal
          ? { axis: poolV6.axis, roles: [...poolV6.primary, ...(fallbackV6 ?? [])] }
          : undefined;
      staplePick = pickStapleForPool({
        ...pickArgs,
        grammar: grammarFilterFor(
          ctx,
          slotKey,
          spec.poolKey,
          {
            ...(v5All && v5All.length > 0 ? { v5: v5All } : {}),
            ...(v6All ? { v6: v6All } : {}),
          },
          true,
        ),
      });
      if (staplePick) ctx.grammar.flags.push(`week_caps_relaxed:${slotKey}:${spec.poolKey}`);
    }
    if (!staplePick) {
      ctx.grammar.flags.push(`${opts?.optional ? "optional_line_skipped" : "pool_exhausted"}:${slotKey}:${spec.poolKey}`);
      return null;
    }
  }

  if (staplePick) {
    // V7-03 (v9): il pick VARIETY consuma il budget varietà dello slot. ANCHE con
    // skipUsageRegistration (condimento M01): la regola non deve dipendere dai dati
    // (l'EVO è CORE oggi, ma un condimento VARIETY conterebbe comunque).
    if (ctx.grammar && (staplePick.entry as MenuFoodEntry).mealRoles?.generativeTier === "VARIETY") {
      ctx.grammar.varietyUsedInSlot = true;
    }
    if (!opts?.skipUsageRegistration) {
      if (staplePick.entry.rotationKey) {
        ctx.usedCarbFamilies.add(staplePick.entry.rotationKey);
        ctx.dayCtx.usedStaples.add(staplePick.entry.rotationKey);
      } else if (staplePick.entry.carbFamily) {
        ctx.usedCarbFamilies.add(staplePick.entry.carbFamily);
      }
      if (staplePick.hit.fdcId > 0) ctx.usedFdcIds.add(staplePick.hit.fdcId);
      ctx.dayCtx.dayUsedCanonicalKeys?.add(staplePick.entry.canonicalKey);
    }
    return { spec, hit: staplePick.hit, staple: staplePick.entry };
  }

  const rawPool = pools.get(spec.poolKey) ?? [];
  const hit = pickFromPoolFallback(rawPool, roleCtx, ctx.denyFragments, ctx.usedFdcIds, ctx.staplePenalty);
  if (!hit) return null;
  ctx.usedFdcIds.add(hit.fdcId);
  return { spec, hit };
}

type ComposeContext = {
  seed: number;
  dietType?: MediterraneanDietType;
  denyFragments: string[];
  dayCtx: MediterraneanDayContext;
  usedFdcIds: Set<number>;
  usedCarbFamilies: Set<string>;
  staplePenalty: (description: string) => number;
  request?: IntelligentMealPlanRequest;
  /** Pool dal catalogo DB nutrition_menu_foods (null/assente → allowlist hardcoded). */
  menuPools?: MenuFoodPoolMap | null;
  /** Grammatica dei pasti attiva (mode shadow/on): assente → composizione storica. */
  grammar?: GrammarComposeState;
};

type GrammarComposeState = {
  recipes: readonly MenuRecipe[];
  /** canonical_key → entry del catalogo, per risolvere gli ingredienti delle ricette. */
  entryIndex: Map<string, MenuFoodEntry>;
  /** Al massimo una ricetta al giorno NEI PASTI PRINCIPALI (pranzo/cena). */
  recipeUsedToday: boolean;
  /**
   * v11 (era `shakeUsedToday`, uno al giorno): il percorso colazione/spuntino è
   * template-FIRST e per-slot — colazione E spuntini possono avere ciascuno il proprio
   * template lo stesso giorno (V10_B01/S01: il template È il pasto standard). Il dedupe
   * giornaliero è sulla RICETTA (mai lo stesso template due volte oggi), non
   * sull'ingrediente: il latte della colazione non deve affamare i template dello
   * spuntino (dedupe ingredienti per-slot, non per-giorno).
   */
  dayUsedRecipeKeys: Set<string>;
  /** V11_B02 (tie-break): protein_base_family dei template già scelti oggi. */
  dayUsedProteinBaseFamilies: Set<string>;
  /** V7-03 (v9): lo slot corrente ha già servito un alimento VARIETY (reset a inizio slot). */
  varietyUsedInSlot: boolean;
  /** B05: dolci da colazione già serviti in settimana (conteggio cumulato sul marcatore). */
  sweetsWeekCount: number;
  /**
   * Diagnostica della composizione (pool svuotati, tetti allentati, linee saltate): il
   * chiamante la passa in `mealGrammar.diagnostics` e la scrive nei flag di provenienza,
   * così in shadow si VEDE quando la grammatica ha dovuto ripiegare.
   */
  flags: string[];
};

/**
 * Regola L04/V02: a pranzo e cena il compositore può scegliere una ricetta come matrice
 * mista PRIMA di comporre per ruoli. Ritorna la linea-ricetta (hit = macro per 100 g di
 * piatto cotto calcolate dagli ingredienti) e registra gli ingredienti come «usati oggi».
 * `null` = niente ricetta in questo slot (nessuna candidata, roll del seed, tetti).
 */
function pickRecipeLine(
  slotKey: MealSlotKey,
  target: { kcal: number },
  ctx: ComposeContext,
): PickLine | null {
  const g = ctx.grammar;
  if (!g) return null;
  // v9 (D3.5) + v11: due percorsi SEPARATI — pasti principali (pranzo/cena: lasagne,
  // pizza…, roll 1/3 + budget settimanale) vs colazione/spuntini (TEMPLATE-first,
  // V10_G01: tentativo sistematico, per-slot). Uno shake al mattino non brucia la
  // ricetta di pranzo, e viceversa.
  const isMain = isMainMealSlot(slotKey);
  if (isMain && g.recipeUsedToday) return null;
  const candidatesAll = recipeCandidatesForMeal({
    recipes: g.recipes,
    entryIndex: g.entryIndex,
    meal: mealForSlot(slotKey),
    dietType: ctx.dietType,
    denyFragments: ctx.denyFragments,
    weekStapleCounts: ctx.dayCtx.weekStapleCounts,
    ...(isMain ? {} : { dayUsedProteinBaseFamilies: g.dayUsedProteinBaseFamilies }),
  });
  // Dedupe giornaliero per percorso: nei pasti principali resta quello sugli
  // INGREDIENTI (mai la pancetta due volte oggi); nel percorso template il dedupe è
  // sulla RICETTA (V10_B02: il template è il pasto, non un ingrediente di sponda) — il
  // filtro-ingredienti affamerebbe gli spuntini: il latte/yogurt della colazione
  // escluderebbe quasi tutti i template del pomeriggio.
  const candidates = isMain
    ? candidatesAll.filter((c) => !c.ingredients.some(({ entry }) => ctx.usedFdcIds.has(entry.fdcId)))
    : candidatesAll.filter((c) => !g.dayUsedRecipeKeys.has(c.recipe.recipeKey));
  // Budget settimanale del percorso: le ricette che possono servire questo tipo di slot
  // (legacy senza `meals` = pasti principali). Nel percorso template il budget non si
  // applica (systematic, V10_G02): resta solo per pranzo/cena.
  const weeklyCapRecipes = g.recipes.filter((r) => {
    const meals = r.meals;
    if (!meals || meals.length === 0) return isMain;
    return isMain
      ? meals.includes("lunch") || meals.includes("dinner")
      : meals.includes("breakfast") || meals.includes("snack");
  });
  const cand = chooseRecipeForSlot({
    candidates,
    seed: ctx.seed,
    slotKey,
    weekStapleCounts: ctx.dayCtx.weekStapleCounts,
    recipeAlreadyToday: isMain ? g.recipeUsedToday : false,
    weeklyCapRecipes,
    // V10_G01 (template-first): a colazione/spuntino niente roll 1/3 e niente budget
    // settimanale — il template si tenta SEMPRE; il fallback a linee resta per
    // costruzione quando non c'è nessuna candidata.
    systematic: !isMain,
  });
  if (!cand) return null;
  const templateMeta = !isMain ? (cand.recipe.templateMeta ?? null) : null;

  // Tetto: la ricetta copre AL MASSIMO l'intero slot (kcal) — sotto la porzione minima
  // sensata non ha senso servirla. Per i template la minima è più bassa (90 g: mezza
  // piadina farcita) — coi 150 g dei pasti principali gli spuntini salati densi
  // verrebbero rifiutati prima ancora di provarli.
  const minRecipeG = isMain ? GRAMMAR_RECIPE_MIN_G : GRAMMAR_TEMPLATE_RECIPE_MIN_G;
  const kcalCapG = Math.floor(((target.kcal * 100) / cand.per100.kcal) / GRAMMAR_RECIPE_STEP_G) * GRAMMAR_RECIPE_STEP_G;
  if (kcalCapG < minRecipeG) return null;

  if (isMain) {
    g.recipeUsedToday = true;
  } else {
    g.dayUsedRecipeKeys.add(cand.recipe.recipeKey);
    if (templateMeta?.proteinBaseFamily) g.dayUsedProteinBaseFamilies.add(templateMeta.proteinBaseFamily);
    if (templateMeta) g.flags.push(`template_first:${slotKey}:${cand.recipe.recipeKey}`);
  }
  // V7-03: una ricetta con almeno un ingrediente VARIETY consuma il budget varietà
  // dello slot (decisione: sì, un solo flag — mai 2 VARIETY nel pasto, nemmeno uno in
  // ricetta e uno da pick).
  if (cand.ingredients.some(({ entry }) => entry.mealRoles?.generativeTier === "VARIETY")) {
    g.varietyUsedInSlot = true;
  }
  // P02 + V11_G01: la polvere è ancorata in scaleRecipe — riconoscimento per COMPONENTE
  // (recipeHasAnchoredPowder), non per famiglia: così il flag di provenienza (misura in
  // shadow la deriva dal solver lineare) copre anche i template v11 con polvere fuori
  // dalle famiglie *PROTEIN* (PORRIDGE, SWEET_FAST) e resta allineato all'ancora reale.
  if (recipeHasAnchoredPowder(cand)) {
    g.flags.push(`shake_powder_anchored:${slotKey}:${cand.recipe.recipeKey}`);
  }
  for (const { entry } of cand.ingredients) {
    if (entry.fdcId > 0) ctx.usedFdcIds.add(entry.fdcId);
    ctx.dayCtx.dayUsedCanonicalKeys?.add(entry.canonicalKey);
    if (entry.rotationKey) {
      ctx.usedCarbFamilies.add(entry.rotationKey);
      ctx.dayCtx.usedStaples.add(entry.rotationKey);
    } else if (entry.carbFamily) {
      ctx.usedCarbFamilies.add(entry.carbFamily);
    }
  }
  // R-A (v11): ai pasti principali la leva è ONTOLOGICA prima che macro — se la ricetta
  // contiene una fonte CHO dichiarata (recipeOwnsCarb) possiede il carboidrato e prende
  // la leva cho (la linea CHO separata si sopprime per lever-match); altrimenti decide
  // la quota kcal-CHO storica. Il flag registra i casi in cui R-A ha CAMBIATO l'esito.
  const ownsCarb = isMain && recipeOwnsCarb(cand);
  if (ownsCarb && recipeLever(cand.per100) === "protein") {
    g.flags.push(`recipe_owns_carb:${slotKey}:${cand.recipe.recipeKey}`);
  }
  return {
    spec: {
      foodRole: "composite_dish",
      // Matrice a base CHO → è il primo (leva cho); piatto proteico (cotoletta, senza
      // fonte CHO dichiarata) → è il secondo (leva protein) e il primo resta.
      // A colazione/spuntino: template con base glucidica (primary_carb_family, V10_B02)
      // → leva cho (il template occupa CHO+PRO dello slot); ricetta senza template_meta
      // → protein (P04: lo shake RIMPIAZZA la sola linea proteica primaria — CHO
      // complesso, frutta e grassi restano).
      lever: isMain
        ? ownsCarb
          ? "cho"
          : recipeLever(cand.per100)
        : templateMeta?.primaryCarbFamily
          ? "cho"
          : "protein",
      poolKey: "recipe",
      minG: minRecipeG,
      maxG: kcalCapG,
      stepG: GRAMMAR_RECIPE_STEP_G,
    },
    hit: recipeCandidateToHit(cand),
    recipe: cand,
  };
}

/**
 * B01/B02: a colazione la CHO secondaria (frutta/miele/marmellata) copre ~15% dei CHO
 * dello slot come porzione fissa; la primaria (leva del solver) chiude il resto → 80-90%.
 */
function pickBreakfastSecondaryChoLine(
  target: { carbsG: number },
  pools: FdcPoolMap,
  ctx: ComposeContext,
): PickLine | null {
  const spec: MealSlotAssemblyRole = {
    foodRole: "cho_simple",
    lever: "fixed",
    poolKey: "breakfast_cho",
    minG: 20,
    maxG: 150,
    stepG: 5,
    fixedG: 20,
  };
  // Pool virtuale B02: breakfast_cho ∪ frutta di snack_cho (ruolo colazione CHO_SECONDARY).
  // Linea facoltativa: senza candidata la colazione resta B01 + PRO + FAT (mai USDA grezzo).
  const secondaryEntries = breakfastSecondaryMenuEntries(ctx.menuPools);
  if (secondaryEntries.length === 0) return null;
  const line = pickLineForRole(spec, "breakfast", pools, ctx, {
    // v5 CHO_SECONDARY per le entry storiche, v6 SECONDARY_SIMPLE/SECONDARY_MIXED (B02;
    // i dolci SECONDARY_MIXED entrano SOLO da qui: mai come fonte principale — B04).
    rolesOverride: { v5: GRAMMAR_BREAKFAST_SECONDARY_ROLES, v6: GRAMMAR_BREAKFAST_SECONDARY_V6 },
    menuEntriesOverride: secondaryEntries,
    optional: true,
  });
  if (!line || !(line.hit.carbsPer100g > 0)) return null;
  const wantedChoG = target.carbsG * GRAMMAR_BREAKFAST_SECONDARY_CHO_SHARE;
  const grams = (wantedChoG * 100) / line.hit.carbsPer100g;
  const fixedG = Math.max(spec.minG, Math.min(spec.maxG, Math.round(grams / spec.stepG) * spec.stepG));
  return { ...line, spec: { ...spec, fixedG } };
}

/**
 * V10_S01 (v11): allo spuntino template-led la frutta entra SOLO come SIDE separato per
 * chiudere i CHO residui (≥ 15 g dopo il primo solve con la sola ricetta) — mai come
 * pairing casuale accanto ad affettati/salmone. Linea a grammi FISSI dimensionata sul
 * residuo; pool virtuale = frutta di snack_cho (marcatore isSnackFruitSideEntry).
 */
function pickSnackFruitSideLine(
  slotKey: MealSlotKey,
  residualChoG: number,
  pools: FdcPoolMap,
  ctx: ComposeContext,
): PickLine | null {
  const spec: MealSlotAssemblyRole = {
    foodRole: "cho_simple",
    lever: "fixed",
    poolKey: "snack_cho",
    minG: 50,
    maxG: 250,
    stepG: 10,
    fixedG: 100,
  };
  const entries = snackFruitSideEntries(ctx.menuPools);
  if (entries.length === 0) return null;
  const line = pickLineForRole(spec, slotKey, pools, ctx, {
    rolesOverride: { v5: GRAMMAR_BREAKFAST_SECONDARY_ROLES, v6: GRAMMAR_SNACK_FRUIT_SIDE_V6 },
    menuEntriesOverride: entries,
    // Linea facoltativa: senza frutta disponibile lo spuntino resta il solo template
    // (il residuo CHO resta scoperto, come per qualunque pool esaurito — mai USDA).
    optional: true,
  });
  if (!line || !(line.hit.carbsPer100g > 0)) return null;
  const grams = (residualChoG * 100) / line.hit.carbsPer100g;
  const fixedG = Math.max(spec.minG, Math.min(spec.maxG, Math.round(grams / spec.stepG) * spec.stepG));
  return { ...line, spec: { ...spec, fixedG } };
}

/**
 * M01/M04 (v6): la QUARTA riga del pasto principale — il condimento grasso. Pool virtuale
 * dei main_meal_role='FAT_CONDIMENT' (EVO, avocado, altri oli): l'ordinamento
 * priority+score fa da solo la gerarchia di M04 (EVO COMMON/10 > avocado COMMON/8 > oli
 * LIMITED/4), zero liste hardcoded. Grammi solver-controlled 5-20 g, contati nelle macro
 * del pasto. D02-v1 («non aggiungere olio a un pasto già ricco»): se al first-pass i
 * grassi delle altre linee coprono già ~il target dello slot, la linea si salta (flag).
 */
function pickMainMealFatCondimentLine(
  slotKey: MealSlotKey,
  target: { kcal: number; carbsG: number; proteinG: number; fatG: number },
  lines: PickLine[],
  pools: FdcPoolMap,
  ctx: ComposeContext,
): PickLine | null {
  const g = ctx.grammar;
  if (!g) return null;
  const entries = mainMealFatCondimentEntries(g.entryIndex);
  // Nessun condimento nel catalogo (dati v5): nessuna linea e nessun flag — il pasto
  // resta a tre righe come prima della v6.
  if (entries.length === 0) return null;
  if (lines.length > 0) {
    const firstPass = solveFdcMealPortions(lines, target);
    const fatCovered = lines.reduce((s, l, i) => s + ((firstPass[i] ?? 0) * l.hit.fatPer100g) / 100, 0);
    if (target.fatG - fatCovered < GRAMMAR_MAIN_FAT_MIN_RESIDUAL_G) {
      g.flags.push(`fat_condiment_skipped:${slotKey}`);
      return null;
    }
  }
  const spec: MealSlotAssemblyRole = {
    foodRole: "fat",
    lever: "fat",
    poolKey: "main_fat",
    minG: GRAMMAR_MAIN_FAT_MIN_G,
    maxG: GRAMMAR_MAIN_FAT_MAX_G,
    stepG: GRAMMAR_MAIN_FAT_STEP_G,
  };
  return pickLineForRole(spec, slotKey, pools, ctx, {
    rolesOverride: { v6: GRAMMAR_MAIN_FAT_CONDIMENT_V6 },
    menuEntriesOverride: entries,
    optional: true,
    // L'EVO condisce pranzo E cena tutti i giorni: niente tetto di rotazione di famiglia
    // e niente dedupe giornaliero (il max_week esplicito di Mario resta duro).
    relaxWeekCaps: true,
    skipUsageRegistration: true,
  });
}

function composeSlotFromAssembly(slot: MealPlanV2DietSlotBudget, pools: FdcPoolMap, ctx: ComposeContext): MealPlanV2ComposedSlot {
  const slotKey = slot.key as MealSlotKey;
  const roles = MEAL_SLOT_ASSEMBLY[slotKey] ?? MEAL_SLOT_ASSEMBLY.snack_am;
  const target = slotMacroTargetsFromDiet(slot);

  // V7-03 (v9): il budget varietà è PER SLOT — reset in testa, prima di qualunque pick.
  if (ctx.grammar) ctx.grammar.varietyUsedInSlot = false;

  const lines: PickLine[] = [];
  // Grammatica, L04: la ricetta (se scelta) occupa una leva del pasto principale — il primo
  // se è una matrice CHO (pasta, pizza, lasagne), il secondo se è un piatto proteico
  // (cotoletta). Nel primo caso la proteina si decide DOPO aver sottratto quella della
  // ricetta (V02); il contorno si aggiunge solo se la ricetta non ha già la sua verdura (L03).
  const recipeLine = ctx.grammar ? pickRecipeLine(slotKey, target, ctx) : null;
  const recipeIsCho = recipeLine?.spec.lever === "cho";
  // v11 (V10_B01/B02/S01): template di colazione/spuntino con base glucidica — la
  // ricetta occupa le linee CHO **e** PRO dello slot («il template occupa gli slot che
  // copre: niente aggiunte casuali dopo»); grassi (B02 fat) e frutta si aggiungono SOLO
  // quando il template non li porta già (fat_addon_family/fruit_family null).
  const templateMeta =
    recipeLine && !isMainMealSlot(slotKey) ? (recipeLine.recipe?.recipe.templateMeta ?? null) : null;
  const templateOwnsSlot = !!templateMeta?.primaryCarbFamily;
  let proteinSpec: MealSlotAssemblyRole | null = null;
  if (recipeLine) lines.push(recipeLine);
  for (const spec of roles) {
    if (recipeLine) {
      // La ricetta occupa la SUA leva: primo (cho) o secondo (protein).
      if (spec.lever === recipeLine.spec.lever) continue;
      if (templateOwnsSlot && spec.lever === "protein") {
        // V10_B02: il template copre anche la proteina — nessuna linea separata e
        // NESSUN complemento V02 (proteinSpec resta null di proposito).
        continue;
      }
      if (templateOwnsSlot && spec.foodRole === "fat" && templateMeta!.fatAddonFamily) continue;
      if (recipeIsCho && spec.lever === "protein") {
        proteinSpec = spec;
        continue;
      }
      if (spec.foodRole === "veg_condiment" && recipeLine.recipe!.vegShare >= GRAMMAR_RECIPE_VEG_SHARE_MIN) continue;
    }
    const line = pickLineForRole(spec, slotKey, pools, ctx);
    // R-C (v11): tetto leggibile della porzione proteica dello spuntino — clamp del
    // maxG DOPO il pick (per distinguere le uova) e PRIMA del solver, su una COPIA
    // della spec (MEAL_SLOT_ASSEMBLY è condivisa col path off: mai mutarla in place).
    if (ctx.grammar && line && spec.poolKey === "snack_pro" && mealForSlot(slotKey) === "snack") {
      const cap = line.staple?.canonicalKey?.startsWith("egg")
        ? GRAMMAR_SNACK_PRO_EGG_MAX_G
        : GRAMMAR_SNACK_PRO_MAX_G;
      if (line.spec.maxG > cap) line.spec = { ...line.spec, maxG: cap };
    }
    if (line) lines.push(line);
    // B02: subito dopo la CHO primaria di colazione, la quota secondaria (fissa, ~15%).
    if (ctx.grammar && slotKey === "breakfast" && spec.lever === "cho" && line) {
      const secondary = pickBreakfastSecondaryChoLine(target, pools, ctx);
      if (secondary) lines.push(secondary);
    }
  }
  // B02 con template (v11): il template ha assorbito la linea CHO, ma se non porta
  // frutta propria (fruit_family null) la quota semplice di colazione resta dovuta
  // (B01/B02: 10-15% dei CHO dalla quota semplice).
  if (ctx.grammar && slotKey === "breakfast" && templateOwnsSlot && !templateMeta!.fruitFamily) {
    const secondary = pickBreakfastSecondaryChoLine(target, pools, ctx);
    if (secondary) lines.push(secondary);
  }
  // V10_S01 (v11): spuntino template-led — frutta SIDE solo per chiudere CHO residui
  // (≥ 15 g dopo il primo solve con le linee correnti), dimensionata sul residuo.
  if (ctx.grammar && templateOwnsSlot && mealForSlot(slotKey) === "snack" && lines.length > 0) {
    const firstPass = solveFdcMealPortions(lines, target);
    const choCovered = lines.reduce((s, l, i) => s + ((firstPass[i] ?? 0) * l.hit.carbsPer100g) / 100, 0);
    const residualChoG = target.carbsG - choCovered;
    if (residualChoG >= GRAMMAR_SNACK_FRUIT_SIDE_MIN_CHO_G) {
      const fruit = pickSnackFruitSideLine(slotKey, residualChoG, pools, ctx);
      if (fruit) {
        lines.push(fruit);
        ctx.grammar.flags.push(`fruit_side_added:${slotKey}`);
      }
    }
  }
  if (recipeLine && recipeIsCho && proteinSpec) {
    // V02: prima si risolve la ricetta, poi si guarda quanta proteina manca davvero.
    const firstPass = solveFdcMealPortions(lines, target);
    const recipeProG = ((firstPass[0] ?? 0) * recipeLine.hit.proteinPer100g) / 100;
    if (target.proteinG - recipeProG >= GRAMMAR_RECIPE_PROTEIN_COMPLEMENT_MIN_G) {
      const proLine = pickLineForRole(proteinSpec, slotKey, pools, ctx);
      if (proLine) {
        // Il secondo entra: la ricetta non può più occupare l'intero slot, altrimenti il
        // complemento si somma SOPRA il target invece di starci dentro. Il tetto della
        // ricetta scende alla sua quota da primo; il solver riequilibra sotto quel tetto.
        const kcalPer100 = recipeLine.hit.kcalPer100g;
        if (kcalPer100 > 0) {
          const shareCapG =
            Math.floor(((target.kcal * GRAMMAR_RECIPE_KCAL_SHARE_WITH_COMPLEMENT * 100) / kcalPer100) / GRAMMAR_RECIPE_STEP_G) *
            GRAMMAR_RECIPE_STEP_G;
          recipeLine.spec = {
            ...recipeLine.spec,
            maxG: Math.max(GRAMMAR_RECIPE_MIN_G, Math.min(recipeLine.spec.maxG, shareCapG)),
          };
        }
        lines.splice(1, 0, proLine);
      }
    }
  }

  // M01 (v6): quarta riga FAT_CONDIMENT nei pasti principali, DOPO ricetta/complementi
  // così il residuo grassi tiene conto di tutto il piatto (D02-v1: skip a pasto già ricco).
  if (ctx.grammar && isMainMealSlot(slotKey) && lines.length > 0) {
    const condiment = pickMainMealFatCondimentLine(slotKey, target, lines, pools, ctx);
    if (condiment) lines.push(condiment);
  }

  if (lines.length === 0) {
    return {
      slot: slot.key,
      labelIt: slot.label,
      targetKcal: slot.kcal,
      items: [],
      totals: { kcal: 0, choG: 0, proG: 0, fatG: 0 },
    };
  }

  // Regola 7 (pane) ragiona sulla linea CHO staple: con una ricetta come primo
  // (pizza/piadina hanno già il loro pane) non si applica.
  if (!recipeIsCho) applyRegola7Cho(lines, target, slotKey, ctx);

  let grams = solveFdcMealPortions(lines, target);
  // R-B (v11): nessuna linea SERVITA sotto 12 g — a punto fisso: la linea sotto soglia
  // si ELIMINA e il solver RI-risolve (le altre leve compensano), invece della vecchia
  // sparizione silenziosa a macro sballate. Esenti: condimenti (lever fat), linee a
  // grammi fissi e ricette (i loro componenti interni sono proporzioni del piatto).
  // Solo sotto grammatica: il path off resta bit-identico (soglie 4/8 in emissione).
  if (ctx.grammar) {
    for (let guard = lines.length; guard > 0; guard -= 1) {
      const dropIdx = lines.findIndex((l, i) => lineDroppableBelowMinServed(l, grams[i] ?? 0));
      if (dropIdx < 0) break;
      ctx.grammar.flags.push(`line_dropped_min_g:${slotKey}:${lines[dropIdx]!.spec.poolKey}`);
      lines.splice(dropIdx, 1);
      if (lines.length === 0) break;
      grams = solveFdcMealPortions(lines, target);
    }
  }
  const items: MealPlanV2ComposedItem[] = [];

  lines.forEach((line, i) => {
    const g = grams[i] ?? 0;
    const minG = line.spec.lever === "fat" ? 4 : 8;
    if (g < minG) return;
    if (line.recipe) {
      const scaled = scaleRecipe(line.recipe, g);
      items.push({
        fdcId: 0,
        description: line.recipe.recipe.labelIt,
        grams: g,
        servingBasis: "cooked_grams",
        rotationKey: line.recipe.rotationKey,
        foodRole: line.spec.foodRole,
        recipe: {
          recipeKey: line.recipe.recipe.recipeKey,
          labelIt: line.recipe.recipe.labelIt,
          components: scaled.components,
        },
        ...scaled.totals,
      });
      return;
    }
    const canonicalKey = line.staple?.canonicalKey;
    const servingBasis = line.staple?.servingBasis ?? (canonicalKey ? servingBasisForCanonical(canonicalKey) : undefined);
    const label = line.staple?.labelIt ?? line.hit.description;
    items.push({
      fdcId: line.hit.fdcId,
      description: label,
      grams: g,
      canonicalKey,
      servingBasis,
      // La rotation key viaggia sull'item: la memoria settimanale conta la famiglia
      // anche per i cibi del catalogo DB ignoti alla costante hardcoded.
      rotationKey: line.staple?.rotationKey,
      // Con la grammatica l'ordine delle voci non è più quello di MEAL_SLOT_ASSEMBLY:
      // il ruolo viaggia sull'item (assente → i lettori ricadono sulla posizione).
      ...(ctx.grammar ? { foodRole: line.spec.foodRole } : {}),
      ...macrosFromHit(line.hit, g),
    });
  });

  const totals = items.reduce(
    (acc, it) => ({
      kcal: round1(acc.kcal + it.kcal),
      choG: round1(acc.choG + it.choG),
      proG: round1(acc.proG + it.proG),
      fatG: round1(acc.fatG + it.fatG),
    }),
    { kcal: 0, choG: 0, proG: 0, fatG: 0 },
  );

  // V7-01 (v9): quota CORE del pasto — MISURATA (flag di provenienza), mai forzata:
  // l'ordinamento per tier la rende emergente. Conta per NUMERO di componenti (come la
  // regola) i soli componenti classificati v9 (tier presente): con dati v6 non c'è tier
  // → nessun flag, nessun rumore.
  if (ctx.grammar && items.length > 0) {
    let classified = 0;
    let core = 0;
    lines.forEach((line, i) => {
      const g = grams[i] ?? 0;
      if (g < (line.spec.lever === "fat" ? 4 : 8)) return;
      if (line.recipe) {
        for (const { entry } of line.recipe.ingredients) {
          const t = entry.mealRoles?.generativeTier;
          if (!t) continue;
          classified += 1;
          if (t === "CORE") core += 1;
        }
        return;
      }
      const t = (line.staple as MenuFoodEntry | undefined)?.mealRoles?.generativeTier;
      if (!t) return;
      classified += 1;
      if (t === "CORE") core += 1;
    });
    if (classified > 0) {
      ctx.grammar.flags.push(`core_share:${slotKey}:${Math.round((core / classified) * 100)}`);
    }
  }

  return {
    slot: slot.key,
    labelIt: slot.label,
    targetKcal: slot.kcal,
    items,
    totals,
  };
}

/** Regola 7: CHO >100g → no pane primario; CHO ≥130g → pane secondario fisso. */
function applyRegola7Cho(lines: PickLine[], target: { carbsG: number }, slotKey: MealSlotKey, ctx: ComposeContext): void {
  if (!isMainMealSlot(slotKey)) return;
  const choIdx = lines.findIndex((l) => l.spec.lever === "cho");
  if (choIdx < 0) return;
  const choLine = lines[choIdx]!;
  if (target.carbsG > 100 && choLine.staple?.canonicalKey === "bread_white") {
    const altMenuEntries = ctx.menuPools?.get(choLine.spec.poolKey);
    // R01 (v6): il sostituto preferito viene dallo stesso substitution_group del pane
    // sostituito, in subordine dai suoi substitutes espliciti in ordine — mai una
    // sostituzione cross-gruppo per sole kcal: il filtro ruolo/score resta il verdetto (V01).
    const swapRoles = (choLine.staple as MenuFoodEntry | undefined)?.mealRoles;
    const baseFilter = grammarFilterFor(ctx, slotKey, choLine.spec.poolKey);
    const alt = pickStapleForPool({
      poolKey: choLine.spec.poolKey,
      seed: ctx.seed + 17,
      dietType: ctx.dietType,
      denyFragments: ctx.denyFragments,
      dayCtx: ctx.dayCtx,
      usedCarbFamilies: ctx.usedCarbFamilies,
      usedFdcIds: ctx.usedFdcIds,
      menuEntries: altMenuEntries && altMenuEntries.length > 0 ? altMenuEntries : undefined,
      // Sotto grammatica anche il sostituto passa dal filtro del pasto (V01).
      grammar: baseFilter
        ? {
            ...baseFilter,
            ...(swapRoles
              ? {
                  substituteFor: {
                    substitutionGroup: swapRoles.substitutionGroup ?? null,
                    substitutes: swapRoles.substitutes ?? [],
                    // v9: il pool di sostituzione del sostituito raffina la preferenza
                    // (SOFT, grammarSubstituteRank); il verdetto V7-R01 vive nel filtro.
                    substitutePool: swapRoles.substitutePool ?? null,
                  },
                }
              : {}),
          }
        : undefined,
    });
    if (alt && alt.entry.canonicalKey !== "bread_white") {
      lines[choIdx] = { spec: choLine.spec, hit: alt.hit, staple: alt.entry };
    }
  }
  if (target.carbsG >= 130 && !lines.some((l) => l.staple?.canonicalKey === "bread_white")) {
    const breadMenuEntries = ctx.menuPools?.get("breakfast_cho");
    const breadHit = pickStapleForPool({
      poolKey: "breakfast_cho",
      seed: ctx.seed + 31,
      dietType: ctx.dietType,
      denyFragments: ctx.denyFragments,
      dayCtx: ctx.dayCtx,
      usedCarbFamilies: ctx.usedCarbFamilies,
      usedFdcIds: ctx.usedFdcIds,
      menuEntries: breadMenuEntries && breadMenuEntries.length > 0 ? breadMenuEntries : undefined,
      // Sotto grammatica il pane secondario deve avere score > 0 nel pasto dello slot (V01):
      // nei dati v5 il pane è NONE/0 a pranzo e cena, quindi la regola 7 non aggiunge pane.
      grammar: grammarFilterFor(ctx, slotKey, "breakfast_cho"),
    });
    if (breadHit?.entry.canonicalKey === "bread_white") {
      lines.push({
        spec: {
          foodRole: "cho_simple",
          lever: "fixed",
          poolKey: "breakfast_cho",
          minG: 40,
          maxG: 90,
          stepG: 5,
          fixedG: target.carbsG >= 180 ? 80 : 55,
        },
        hit: breadHit.hit,
        staple: breadHit.entry,
      });
    }
  }
}

function composeRaceSlot(
  slot: MealPlanV2DietSlotBudget,
  ctx: ComposeContext,
): MealPlanV2ComposedSlot | null {
  const slotKey = slot.key as MealSlotKey;
  const req = ctx.request;
  if (!req) return null;

  const slotMacros = {
    kcal: slot.kcal,
    carbsG: slot.carbs,
    proteinG: slot.protein,
    fatG: slot.fat,
  };

  if (isRacePreRaceMealSlot(slotKey, req.racePreLunch ?? null)) {
    const meal = composeRacePreLunchMainMeal(slotKey, slotMacros, ctx.seed, req.racePreLunch!, ctx.dayCtx);
    const items = mediterraneanMealToV2Items(meal);
    const totals = items.reduce(
      (acc, it) => ({
        kcal: round1(acc.kcal + it.kcal),
        choG: round1(acc.choG + it.choG),
        proG: round1(acc.proG + it.proG),
        fatG: round1(acc.fatG + it.fatG),
      }),
      { kcal: 0, choG: 0, proG: 0, fatG: 0 },
    );
    return { slot: slot.key, labelIt: slot.label, targetKcal: slot.kcal, items, totals };
  }

  if (req.racePostRecovery && slotKey === req.racePostRecovery.mealSlot) {
    const meal = composeRacePostRecoveryMeal(slotKey, ctx.seed, req.racePostRecovery, ctx.dayCtx);
    const items = mediterraneanMealToV2Items(meal);
    const totals = items.reduce(
      (acc, it) => ({
        kcal: round1(acc.kcal + it.kcal),
        choG: round1(acc.choG + it.choG),
        proG: round1(acc.proG + it.proG),
        fatG: round1(acc.fatG + it.fatG),
      }),
      { kcal: 0, choG: 0, proG: 0, fatG: 0 },
    );
    return { slot: slot.key, labelIt: slot.label, targetKcal: slot.kcal, items, totals };
  }

  return null;
}

/**
 * Seed deterministico per (atleta, data): hash FNV-1a 32-bit di `${athleteId}|${planDate}`.
 * Sostituisce il vecchio seed degenerato (somma delle parti della data, range ~0-40) con un
 * valore ben distribuito: atleti diversi e giorni diversi ruotano l'ordine dei pool staple.
 */
export function mealPlanSeedForAthleteDate(
  athleteId: string | null | undefined,
  planDate: string | null | undefined,
): number {
  const key = `${(athleteId ?? "").trim()}|${(planDate ?? "2026-01-01").trim()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function normalizeDietType(raw: string | null | undefined): MediterraneanDietType {
  const d = (raw ?? "").trim().toLowerCase();
  if (d === "vegan" || d.includes("vegan")) return "vegan";
  if (d === "vegetarian" || d.includes("veget")) return "vegetarian";
  if (d === "pescatarian" || d.includes("pesc")) return "pescatarian";
  return "omnivore";
}

export function composeMealPlanV2(
  requirements: DailyNutritionRequirementsV2,
  dietSlots: MealPlanV2DietSlotBudget[],
  pools: FdcPoolMap,
  options?: {
    denyFragments?: string[];
    weeklyStapleCounts?: Record<string, number>;
    suppressedSlots?: MealSlotKey[];
    request?: IntelligentMealPlanRequest;
    /** Pool dal catalogo DB nutrition_menu_foods — fonte primaria; null/assente → allowlist. */
    menuFoodPools?: MenuFoodPoolMap | null;
    /**
     * Grammatica dei pasti di Mario (score/ruoli per pasto + ricette). Assente/false →
     * composizione storica, BIT-IDENTICA. Il chiamante la passa solo in mode shadow/on
     * (in shadow per la composizione «ombra», mai per quella servita).
     */
    mealGrammar?: {
      enabled: boolean;
      recipes?: readonly MenuRecipe[] | null;
      /** Sink dei flag di composizione (pool svuotati, tetti allentati, linee saltate). */
      diagnostics?: string[];
    };
  },
): MealPlanV2ComposedSlot[] {
  void requirements;
  const denyFragments = options?.denyFragments ?? [];
  const suppressed = new Set(options?.suppressedSlots ?? []);
  const request = options?.request;
  const seed = mealPlanSeedForAthleteDate(request?.athleteId, request?.planDate);

  const dayCtx = createMediterraneanDayContext(
    request?.planDate ?? new Date().toISOString().slice(0, 10),
    options?.weeklyStapleCounts,
    request?.postWorkoutMealBySlot,
    normalizeDietType(request?.dietType),
    denyFragments,
    options?.suppressedSlots,
    request?.racePreLunch ?? undefined,
    request?.racePostRecovery ?? undefined,
  );

  const usedFdcIds = new Set<number>();
  const usedCarbFamilies = new Set<string>();

  const staplePenalty = (description: string): number => {
    const key = description.slice(0, 40).toLowerCase();
    return options?.weeklyStapleCounts?.[key] ?? 0;
  };

  const ctx: ComposeContext = {
    seed,
    dietType: normalizeDietType(request?.dietType),
    denyFragments,
    dayCtx,
    usedFdcIds,
    usedCarbFamilies,
    staplePenalty,
    request,
    menuPools: options?.menuFoodPools ?? null,
    ...(options?.mealGrammar?.enabled
      ? {
          grammar: (() => {
            const entryIndex = menuFoodEntryIndex(options?.menuFoodPools);
            return {
              recipes: options.mealGrammar.recipes ?? [],
              entryIndex,
              recipeUsedToday: false,
              dayUsedRecipeKeys: new Set<string>(),
              dayUsedProteinBaseFamilies: new Set<string>(),
              varietyUsedInSlot: false,
              // B05: conteggio cumulato dei dolci da colazione, una volta per composizione.
              sweetsWeekCount: weekBreakfastSweetsCount(entryIndex, options?.weeklyStapleCounts),
              flags: options.mealGrammar.diagnostics ?? [],
            };
          })(),
        }
      : {}),
  };

  return dietSlots.map((slot) => {
    if (suppressed.has(slot.key as MealSlotKey)) {
      return {
        slot: slot.key,
        labelIt: slot.label,
        targetKcal: slot.kcal,
        items: [],
        totals: { kcal: 0, choG: 0, proG: 0, fatG: 0 },
      };
    }
    const raceSlot = composeRaceSlot(slot, ctx);
    if (raceSlot) return raceSlot;
    return composeSlotFromAssembly(slot, pools, ctx);
  });
}

export { labelItForStaple };
