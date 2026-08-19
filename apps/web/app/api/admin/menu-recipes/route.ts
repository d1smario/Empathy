import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchFdcMacros } from "@/app/api/admin/menu-foods/route";
import {
  computeRecipeMacrosPer100g,
  inheritRecipeDietFlags,
  recipeGramsSumMessage,
  sumRecipeGrams,
  validateRecipeInput,
  type RecipeCatalogFood,
  type RecipeComponentClean,
} from "@/lib/admin/menu-recipe-validation";
import type { AdminMenuRecipeComponentRow, AdminMenuRecipeRow } from "@/components/admin/foods/menu-recipe-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Admin → Ricette (public.nutrition_recipes + nutrition_recipe_components): le regole di
 * combinazione su ingredienti del catalogo `nutrition_menu_foods` che il motore V2 legge
 * con `loadMenuRecipes`. Scrittura SOLO service-role (gate platform admin) come menu-foods.
 *
 * «Grammatica di Mario, numeri nostri»: la ricetta NON ha macro proprie. Qui le
 * CALCOLIAMO server-side dagli ingredienti (canonical_key → nutrition_menu_foods.fdc_id →
 * nutrition_fdc_foods, riusando `fetchFdcMacros` di menu-foods) e le restituiamo al client.
 *
 * `frequency`/`max_week` vivono in una migration ADDITIVA non ancora applicata
 * (20260819110000_nutrition_recipes_frequency.sql): la route sonda le colonne e, se
 * mancano (42703), legge/scrive senza — la UI mostra i campi ma li salva solo quando esistono.
 */

const NO_STORE = { "Cache-Control": "no-store" as const };

const RECIPE_BASE_COLUMNS = "id, recipe_key, label_it, is_active, note, source_ref, source_version, updated_at";
const RECIPE_EXTRA_COLUMNS = "frequency, max_week";
const COMPONENT_COLUMNS = "recipe_id, position, canonical_key, fdc_id, label_it, grams_per_100g, is_neutral";
const CATALOG_COLUMNS = "canonical_key, fdc_id, label_it, is_active, is_meat, is_fish, is_animal_product";
const IN_CHUNK = 200;

/** Errore Postgres «colonna inesistente» (migration frequency/max_week non applicata). */
const PG_UNDEFINED_COLUMN = "42703";

/**
 * True se l'errore PostgREST è «colonna inesistente». Guardiamo code E messaggio perché
 * (come nota persist-v2-plan-to-db.ts) il code non è sempre propagato dal client.
 */
export function isUndefinedColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === PG_UNDEFINED_COLUMN) return true;
  return /column .* does not exist|could not find the .* column/i.test(error.message ?? "");
}

type RecipeRow = {
  id: string;
  recipe_key: string;
  label_it: string;
  is_active: boolean | null;
  note: string | null;
  source_ref: string | null;
  source_version: string | null;
  updated_at: string | null;
  frequency?: string | null;
  max_week?: number | null;
};

type ComponentRow = {
  recipe_id: string;
  position: number;
  canonical_key: string | null;
  fdc_id: number | null;
  label_it: string;
  grams_per_100g: number | string;
  is_neutral: boolean | null;
};

type CatalogRow = {
  canonical_key: string;
  fdc_id: number;
  label_it: string;
  is_active: boolean | null;
  is_meat: boolean | null;
  is_fish: boolean | null;
  is_animal_product: boolean | null;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false as const, error }, { status, headers: NO_STORE });
}

/**
 * Sonda una volta per richiesta se `frequency`/`max_week` esistono: SELECT con le colonne
 * extra, 42703 → false. Niente cache di processo: la migration può essere applicata a
 * caldo e la route deve vederla al primo giro.
 */
export async function recipeExtraColumnsAvailable(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.from("nutrition_recipes").select(RECIPE_EXTRA_COLUMNS).limit(1);
  if (!error) return true;
  if (isUndefinedColumnError(error)) return false;
  // Altro errore: lo lasciamo emergere alla query vera (qui rispondiamo «no» per prudenza).
  return false;
}

/**
 * Carica il catalogo degli alimenti citati (o TUTTO se `keys` è null) nella shape del
 * validatore, con le macro joinate via fdc_id. Ritorna mappa canonical_key → alimento.
 */
export async function loadRecipeCatalog(
  admin: SupabaseClient,
  keys: string[] | null,
): Promise<{ map: Map<string, RecipeCatalogFood>; error: string | null }> {
  const map = new Map<string, RecipeCatalogFood>();
  const rows: CatalogRow[] = [];
  if (keys === null) {
    const { data, error } = await admin.from("nutrition_menu_foods").select(CATALOG_COLUMNS);
    if (error) return { map, error: error.message };
    rows.push(...((data ?? []) as CatalogRow[]));
  } else {
    const unique = [...new Set(keys.filter((k) => typeof k === "string" && k))];
    for (let i = 0; i < unique.length; i += IN_CHUNK) {
      const { data, error } = await admin
        .from("nutrition_menu_foods")
        .select(CATALOG_COLUMNS)
        .in("canonical_key", unique.slice(i, i + IN_CHUNK));
      if (error) return { map, error: error.message };
      rows.push(...((data ?? []) as CatalogRow[]));
    }
  }
  const { map: macroMap, error: macroErr } = await fetchFdcMacros(
    admin,
    rows.map((r) => Number(r.fdc_id)),
  );
  if (macroErr) return { map, error: macroErr };
  for (const r of rows) {
    const m = macroMap.get(Number(r.fdc_id));
    map.set(r.canonical_key, {
      canonical_key: r.canonical_key,
      fdc_id: Number(r.fdc_id),
      label_it: r.label_it,
      is_active: r.is_active !== false,
      is_meat: r.is_meat === true,
      is_fish: r.is_fish === true,
      is_animal_product: r.is_animal_product === true,
      macro: {
        kcal: m?.kcal_100g ?? null,
        carbs: m?.carbs_100g ?? null,
        protein: m?.protein_100g ?? null,
        fat: m?.fat_100g ?? null,
      },
    });
  }
  return { map, error: null };
}

/** Mapping ricetta + componenti + catalogo → shape client (fonte unica del contratto). */
export function toAdminMenuRecipeRow(
  recipe: RecipeRow,
  components: ComponentRow[],
  catalog: Map<string, RecipeCatalogFood>,
  hasExtraColumns: boolean,
): AdminMenuRecipeRow {
  const comps: AdminMenuRecipeComponentRow[] = components
    .map((c) => {
      const food = c.canonical_key ? catalog.get(c.canonical_key) : undefined;
      return {
        position: Number(c.position),
        canonical_key: c.canonical_key ?? null,
        fdc_id: c.fdc_id == null ? null : Number(c.fdc_id),
        label_it: c.label_it,
        grams_per_100g: Number(c.grams_per_100g),
        is_neutral: c.is_neutral === true,
        catalog_label_it: food?.label_it ?? null,
        catalog_is_active: food ? food.is_active : null,
      };
    })
    .sort((a, b) => a.position - b.position);

  const macro = computeRecipeMacrosPer100g(comps, (k) => catalog.get(k)?.macro ?? null);
  const diet = inheritRecipeDietFlags(comps, (k) => catalog.get(k) ?? null);
  const total = sumRecipeGrams(comps);

  // Stesse regole di scarto di mapMenuRecipeRows (menu-recipe-catalog-db.ts), più «alimento
  // disattivato» che il loader del catalogo toglie a monte: l'admin deve vederlo.
  let engineIssue: string | null = null;
  if (comps.length === 0) engineIssue = "nessun componente.";
  else if (comps.some((c) => !c.is_neutral && !c.canonical_key)) engineIssue = "componente non neutro senza alimento.";
  else if (comps.some((c) => !(c.grams_per_100g > 0))) engineIssue = "componente con grammi non positivi.";
  else {
    const sumMsg = recipeGramsSumMessage(total);
    if (sumMsg) engineIssue = sumMsg;
    else {
      const gone = comps.find((c) => !c.is_neutral && c.canonical_key && !catalog.get(c.canonical_key));
      const inactive = comps.find((c) => !c.is_neutral && c.catalog_is_active === false);
      if (gone) engineIssue = `«${gone.canonical_key}» non esiste più nel catalogo menù.`;
      else if (inactive) engineIssue = `«${inactive.canonical_key}» è disattivato nel catalogo menù.`;
    }
  }

  const freqRaw = hasExtraColumns ? recipe.frequency : null;
  return {
    id: recipe.id,
    recipe_key: recipe.recipe_key,
    label_it: recipe.label_it,
    is_active: recipe.is_active !== false,
    note: recipe.note ?? null,
    source_ref: recipe.source_ref ?? null,
    source_version: recipe.source_version ?? null,
    frequency:
      freqRaw === "COMMON" || freqRaw === "ROTATION" || freqRaw === "OCCASIONAL" ? freqRaw : hasExtraColumns ? "COMMON" : null,
    max_week: hasExtraColumns && typeof recipe.max_week === "number" ? recipe.max_week : null,
    updated_at: recipe.updated_at ?? null,
    components: comps,
    grams_total: Number(total.toFixed(2)),
    macro: {
      kcal: Number(macro.kcal.toFixed(1)),
      carbs: Number(macro.carbs.toFixed(1)),
      protein: Number(macro.protein.toFixed(1)),
      fat: Number(macro.fat.toFixed(1)),
    },
    macro_missing: macro.missing,
    diet,
    engine_ok: engineIssue == null,
    engine_issue: engineIssue,
  };
}

/**
 * Carica ricette (tutte o una per recipe_key) con componenti + catalogo + macro.
 * Ritorna anche `hasExtraColumns` così il client sa se frequency/max_week sono salvabili.
 */
export async function loadAdminMenuRecipes(
  admin: SupabaseClient,
  opts: { recipeKey?: string } = {},
): Promise<
  | { ok: true; recipes: AdminMenuRecipeRow[]; hasExtraColumns: boolean }
  | { ok: false; error: string }
> {
  const hasExtraColumns = await recipeExtraColumnsAvailable(admin);
  const columns = hasExtraColumns ? `${RECIPE_BASE_COLUMNS}, ${RECIPE_EXTRA_COLUMNS}` : RECIPE_BASE_COLUMNS;
  let q = admin.from("nutrition_recipes").select(columns).order("label_it", { ascending: true });
  if (opts.recipeKey) q = q.eq("recipe_key", opts.recipeKey);
  const { data: recipeData, error: recipeErr } = await q;
  if (recipeErr) return { ok: false, error: recipeErr.message };
  const recipes = (recipeData ?? []) as unknown as RecipeRow[];
  if (recipes.length === 0) return { ok: true, recipes: [], hasExtraColumns };

  const ids = recipes.map((r) => r.id);
  const components: ComponentRow[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const { data, error } = await admin
      .from("nutrition_recipe_components")
      .select(COMPONENT_COLUMNS)
      .in("recipe_id", ids.slice(i, i + IN_CHUNK));
    if (error) return { ok: false, error: error.message };
    components.push(...((data ?? []) as ComponentRow[]));
  }

  const keys = components.map((c) => c.canonical_key).filter((k): k is string => typeof k === "string" && !!k);
  const { map: catalog, error: catErr } = await loadRecipeCatalog(admin, keys);
  if (catErr) return { ok: false, error: catErr };

  const byRecipe = new Map<string, ComponentRow[]>();
  for (const c of components) {
    const list = byRecipe.get(c.recipe_id) ?? [];
    list.push(c);
    byRecipe.set(c.recipe_id, list);
  }
  return {
    ok: true,
    recipes: recipes.map((r) => toAdminMenuRecipeRow(r, byRecipe.get(r.id) ?? [], catalog, hasExtraColumns)),
    hasExtraColumns,
  };
}

/** Payload per l'INSERT dei componenti di una ricetta. */
export function componentsInsertPayload(recipeId: string, components: RecipeComponentClean[]) {
  return components.map((c) => ({
    recipe_id: recipeId,
    position: c.position,
    canonical_key: c.canonical_key,
    fdc_id: c.fdc_id,
    label_it: c.label_it,
    grams_per_100g: c.grams_per_100g,
    is_neutral: c.is_neutral,
  }));
}

/**
 * GET /api/admin/menu-recipes — tutte le ricette (anche is_active=false: l'admin deve
 * poter riattivare) con componenti, macro/100 g calcolate e flag dieta ereditati.
 */
export async function GET() {
  const session = await requirePlatformAdminSession();
  if (!session) return jsonError("Non autorizzato.", 403);
  const admin = createSupabaseAdminClient();
  if (!admin) return jsonError("Manca SUPABASE_SERVICE_ROLE_KEY.", 503);

  const loaded = await loadAdminMenuRecipes(admin);
  if (!loaded.ok) return jsonError(loaded.error, 500);
  return NextResponse.json(
    {
      ok: true as const,
      recipes: loaded.recipes,
      total: loaded.recipes.length,
      hasFrequencyColumns: loaded.hasExtraColumns,
    },
    { headers: NO_STORE },
  );
}

/**
 * POST /api/admin/menu-recipes — crea ricetta + componenti. Body:
 * { recipe_key, label_it, note?, is_active?, frequency?, max_week?,
 *   components: [{ position?, canonical_key?, label_it?, grams_per_100g, is_neutral? }] }
 *
 * Transazione «logica»: PostgREST non espone BEGIN/COMMIT, quindi insert ricetta →
 * insert componenti → se i componenti falliscono, DELETE della ricetta appena creata
 * (così non resta orfana: il loader la scarterebbe, ma l'admin la vedrebbe vuota).
 */
export async function POST(req: Request) {
  const session = await requirePlatformAdminSession();
  if (!session) return jsonError("Non autorizzato.", 403);
  const admin = createSupabaseAdminClient();
  if (!admin) return jsonError("Manca SUPABASE_SERVICE_ROLE_KEY.", 503);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Il validatore ha bisogno del catalogo per esistenza/attivo/fdc_id degli ingredienti.
  const rawComponents = Array.isArray(body.components) ? (body.components as Record<string, unknown>[]) : [];
  const keys = rawComponents
    .map((c) => (typeof c?.canonical_key === "string" ? c.canonical_key.trim() : ""))
    .filter((k) => k);
  const { map: catalog, error: catErr } = await loadRecipeCatalog(admin, keys);
  if (catErr) return jsonError(catErr, 500);

  const validated = validateRecipeInput(body, (k) => catalog.get(k) ?? null);
  if (!validated.ok) return jsonError(validated.error, 400);
  const value = validated.value;

  // Unicità recipe_key → 409 parlante (l'UNIQUE farebbe comunque fallire l'insert).
  const { data: existing, error: existErr } = await admin
    .from("nutrition_recipes")
    .select("id")
    .eq("recipe_key", value.recipe_key)
    .maybeSingle();
  if (existErr) return jsonError(existErr.message, 500);
  if (existing) return jsonError(`recipe_key "${value.recipe_key}" già presente.`, 409);

  const hasExtraColumns = await recipeExtraColumnsAvailable(admin);
  const insertRecipe: Record<string, unknown> = {
    recipe_key: value.recipe_key,
    label_it: value.label_it,
    note: value.note,
    is_active: value.is_active,
    source_ref: null,
    // Le ricette scritte dal pannello si distinguono dall'import Mario v5.
    source_version: "admin_panel",
  };
  if (hasExtraColumns) {
    insertRecipe.frequency = value.frequency;
    insertRecipe.max_week = value.max_week;
  }

  const { data: created, error: createErr } = await admin
    .from("nutrition_recipes")
    .insert(insertRecipe)
    .select("id")
    .maybeSingle();
  if (createErr) return jsonError(createErr.message, 500);
  const recipeId = (created as { id?: string } | null)?.id;
  if (!recipeId) return jsonError("Insert ricetta non riuscito.", 500);

  const { error: compErr } = await admin
    .from("nutrition_recipe_components")
    .insert(componentsInsertPayload(recipeId, value.components));
  if (compErr) {
    // Rollback manuale: niente ricetta orfana.
    await admin.from("nutrition_recipes").delete().eq("id", recipeId);
    return jsonError(`Insert componenti non riuscito (ricetta annullata): ${compErr.message}`, 500);
  }

  const loaded = await loadAdminMenuRecipes(admin, { recipeKey: value.recipe_key });
  if (!loaded.ok) return jsonError(loaded.error, 500);
  const recipe = loaded.recipes[0];
  if (!recipe) return jsonError("Ricetta creata ma non rileggibile.", 500);
  return NextResponse.json(
    { ok: true as const, recipe, hasFrequencyColumns: loaded.hasExtraColumns },
    { headers: NO_STORE },
  );
}
