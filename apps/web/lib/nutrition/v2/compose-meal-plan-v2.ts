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
  GRAMMAR_RECIPE_KCAL_SHARE_WITH_COMPLEMENT,
  GRAMMAR_RECIPE_MIN_G,
  GRAMMAR_RECIPE_PROTEIN_COMPLEMENT_MIN_G,
  GRAMMAR_RECIPE_STEP_G,
  GRAMMAR_RECIPE_VEG_SHARE_MIN,
  GRAMMAR_ROLES_BY_POOL,
  GRAMMAR_SNACK_PREP_SPEED_MIN,
  breakfastSecondaryMenuEntries,
  chooseRecipeForSlot,
  mealForSlot,
  menuFoodEntryIndex,
  recipeCandidateToHit,
  recipeCandidatesForMeal,
  recipeLever,
  scaleRecipe,
  type GrammarPickFilter,
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
 * Filtro grammatica per un pick dentro `slotKey`: pasto dello slot + ruoli ammessi nel pool
 * (o quelli passati) + prep_speed minimo agli spuntini (S01). Solo con grammatica attiva.
 */
function grammarFilterFor(
  ctx: ComposeContext,
  slotKey: MealSlotKey,
  poolKey: string,
  rolesOverride?: readonly MenuFoodMealRole[],
  relaxWeekCaps?: boolean,
): GrammarPickFilter | undefined {
  if (!ctx.grammar) return undefined;
  const roles = rolesOverride ?? GRAMMAR_ROLES_BY_POOL[poolKey]?.primary;
  const meal = mealForSlot(slotKey);
  return {
    meal,
    ...(roles ? { allowedRoles: new Set(roles) } : {}),
    ...(meal === "snack" ? { prepSpeedMin: GRAMMAR_SNACK_PREP_SPEED_MIN } : {}),
    ...(relaxWeekCaps ? { relaxWeekCaps: true } : {}),
  };
}

type PickLineOptions = {
  /** Ruoli ammessi al posto dei primari del pool (es. B02: CHO_SECONDARY). */
  rolesOverride?: readonly MenuFoodMealRole[];
  /** Entry del catalogo da usare al posto di `menuPools.get(spec.poolKey)` (es. B02: pool virtuale). */
  menuEntriesOverride?: MenuFoodEntry[];
  /**
   * Linea facoltativa: se la grammatica non trova nulla la linea SALTA senza ripiego
   * «relaxWeekCaps» (B02: la quota secondaria «può» coprire il residuo, non deve).
   */
  optional?: boolean;
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
  let staplePick = pickStapleForPool({ ...pickArgs, grammar: grammarFilterFor(ctx, slotKey, spec.poolKey, rolesOverride) });
  // Grammatica: se nessun ruolo primario è disponibile (es. dieta vegana a pranzo), i ruoli
  // di ripiego del pool (PRO_SECONDARY/MIXED, regola L02) possono diventare la fonte.
  const fallbackRoles = GRAMMAR_ROLES_BY_POOL[spec.poolKey]?.fallback;
  if (!staplePick && ctx.grammar && !rolesOverride && fallbackRoles) {
    staplePick = pickStapleForPool({ ...pickArgs, grammar: grammarFilterFor(ctx, slotKey, spec.poolKey, fallbackRoles) });
  }
  if (!staplePick && ctx.grammar && hasMenuPool) {
    // La grammatica ha SVUOTATO il pool del catalogo (rotazione settimanale/max_week esauriti).
    // Il rawPool USDA (inglese, senza canonical_key, senza score) non è mai una risposta
    // sotto grammatica: prima si ritenta ignorando il solo tetto di rotazione di famiglia
    // (ontologia e max_week di Mario intatti), e se non basta la linea salta e lo si
    // registra in provenienza.
    if (!opts?.optional) {
      const roles = rolesOverride ?? [
        ...(GRAMMAR_ROLES_BY_POOL[spec.poolKey]?.primary ?? []),
        ...(fallbackRoles ?? []),
      ];
      staplePick = pickStapleForPool({
        ...pickArgs,
        grammar: grammarFilterFor(ctx, slotKey, spec.poolKey, roles.length > 0 ? roles : undefined, true),
      });
      if (staplePick) ctx.grammar.flags.push(`week_caps_relaxed:${slotKey}:${spec.poolKey}`);
    }
    if (!staplePick) {
      ctx.grammar.flags.push(`${opts?.optional ? "optional_line_skipped" : "pool_exhausted"}:${slotKey}:${spec.poolKey}`);
      return null;
    }
  }

  if (staplePick) {
    if (staplePick.entry.rotationKey) {
      ctx.usedCarbFamilies.add(staplePick.entry.rotationKey);
      ctx.dayCtx.usedStaples.add(staplePick.entry.rotationKey);
    } else if (staplePick.entry.carbFamily) {
      ctx.usedCarbFamilies.add(staplePick.entry.carbFamily);
    }
    if (staplePick.hit.fdcId > 0) ctx.usedFdcIds.add(staplePick.hit.fdcId);
    ctx.dayCtx.dayUsedCanonicalKeys?.add(staplePick.entry.canonicalKey);
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
  /** Al massimo una ricetta al giorno. */
  recipeUsedToday: boolean;
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
  if (!g || !isMainMealSlot(slotKey) || g.recipeUsedToday) return null;
  const candidates = recipeCandidatesForMeal({
    recipes: g.recipes,
    entryIndex: g.entryIndex,
    meal: mealForSlot(slotKey),
    dietType: ctx.dietType,
    denyFragments: ctx.denyFragments,
    weekStapleCounts: ctx.dayCtx.weekStapleCounts,
  }).filter((c) => !c.ingredients.some(({ entry }) => ctx.usedFdcIds.has(entry.fdcId)));
  const cand = chooseRecipeForSlot({
    candidates,
    seed: ctx.seed,
    slotKey,
    weekStapleCounts: ctx.dayCtx.weekStapleCounts,
    recipeAlreadyToday: g.recipeUsedToday,
  });
  if (!cand) return null;

  // Tetto: la ricetta copre AL MASSIMO l'intero slot (kcal) — sotto la porzione minima
  // sensata non ha senso servirla.
  const kcalCapG = Math.floor(((target.kcal * 100) / cand.per100.kcal) / GRAMMAR_RECIPE_STEP_G) * GRAMMAR_RECIPE_STEP_G;
  if (kcalCapG < GRAMMAR_RECIPE_MIN_G) return null;

  g.recipeUsedToday = true;
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
  return {
    spec: {
      foodRole: "composite_dish",
      // Matrice a base CHO → è il primo (leva cho); piatto proteico (cotoletta) → è il
      // secondo (leva protein) e il primo resta.
      lever: recipeLever(cand.per100),
      poolKey: "recipe",
      minG: GRAMMAR_RECIPE_MIN_G,
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
    rolesOverride: GRAMMAR_BREAKFAST_SECONDARY_ROLES,
    menuEntriesOverride: secondaryEntries,
    optional: true,
  });
  if (!line || !(line.hit.carbsPer100g > 0)) return null;
  const wantedChoG = target.carbsG * GRAMMAR_BREAKFAST_SECONDARY_CHO_SHARE;
  const grams = (wantedChoG * 100) / line.hit.carbsPer100g;
  const fixedG = Math.max(spec.minG, Math.min(spec.maxG, Math.round(grams / spec.stepG) * spec.stepG));
  return { ...line, spec: { ...spec, fixedG } };
}

function composeSlotFromAssembly(slot: MealPlanV2DietSlotBudget, pools: FdcPoolMap, ctx: ComposeContext): MealPlanV2ComposedSlot {
  const slotKey = slot.key as MealSlotKey;
  const roles = MEAL_SLOT_ASSEMBLY[slotKey] ?? MEAL_SLOT_ASSEMBLY.snack_am;
  const target = slotMacroTargetsFromDiet(slot);

  const lines: PickLine[] = [];
  // Grammatica, L04: la ricetta (se scelta) occupa una leva del pasto principale — il primo
  // se è una matrice CHO (pasta, pizza, lasagne), il secondo se è un piatto proteico
  // (cotoletta). Nel primo caso la proteina si decide DOPO aver sottratto quella della
  // ricetta (V02); il contorno si aggiunge solo se la ricetta non ha già la sua verdura (L03).
  const recipeLine = ctx.grammar ? pickRecipeLine(slotKey, target, ctx) : null;
  const recipeIsCho = recipeLine?.spec.lever === "cho";
  let proteinSpec: MealSlotAssemblyRole | null = null;
  if (recipeLine) lines.push(recipeLine);
  for (const spec of roles) {
    if (recipeLine) {
      // La ricetta occupa la SUA leva: primo (cho) o secondo (protein).
      if (spec.lever === recipeLine.spec.lever) continue;
      if (recipeIsCho && spec.lever === "protein") {
        proteinSpec = spec;
        continue;
      }
      if (spec.foodRole === "veg_condiment" && recipeLine.recipe!.vegShare >= GRAMMAR_RECIPE_VEG_SHARE_MIN) continue;
    }
    const line = pickLineForRole(spec, slotKey, pools, ctx);
    if (line) lines.push(line);
    // B02: subito dopo la CHO primaria di colazione, la quota secondaria (fissa, ~15%).
    if (ctx.grammar && slotKey === "breakfast" && spec.lever === "cho" && line) {
      const secondary = pickBreakfastSecondaryChoLine(target, pools, ctx);
      if (secondary) lines.push(secondary);
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

  const grams = solveFdcMealPortions(lines, target);
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
      grammar: grammarFilterFor(ctx, slotKey, choLine.spec.poolKey),
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
          grammar: {
            recipes: options.mealGrammar.recipes ?? [],
            entryIndex: menuFoodEntryIndex(options?.menuFoodPools),
            recipeUsedToday: false,
            flags: options.mealGrammar.diagnostics ?? [],
          },
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
