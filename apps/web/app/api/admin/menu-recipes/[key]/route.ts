import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateRecipeComponents, validateRecipeFrequency } from "@/lib/admin/menu-recipe-validation";
import {
  componentsInsertPayload,
  isUndefinedColumnError,
  loadAdminMenuRecipes,
  loadRecipeCatalog,
  recipeExtraColumnsAvailable,
} from "../route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Admin → Ricette, riga singola (recipe_key = [key]).
 * PATCH: label/note/is_active/frequency/max_week + SOSTITUZIONE componenti (delete +
 * reinsert, come la migration dati). DELETE: a cascata sui componenti, ma 409 se la
 * ricetta è già stata SERVITA (meal_item.recipe_key = key): i piani storici la citano,
 * va disattivata, non cancellata. Il recipe_key NON è modificabile (è l'identità che i
 * piani persistiti citano).
 */

const NO_STORE = { "Cache-Control": "no-store" as const };

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false as const, error }, { status, headers: NO_STORE });
}

type ExistingComponent = {
  position: number;
  canonical_key: string | null;
  fdc_id: number | null;
  label_it: string;
  grams_per_100g: number;
  is_neutral: boolean;
};

/** PATCH /api/admin/menu-recipes/[key] */
export async function PATCH(req: Request, { params }: { params: { key: string } }) {
  const session = await requirePlatformAdminSession();
  if (!session) return jsonError("Non autorizzato.", 403);
  const admin = createSupabaseAdminClient();
  if (!admin) return jsonError("Manca SUPABASE_SERVICE_ROLE_KEY.", 503);
  const key = (params.key ?? "").trim();
  if (!key) return jsonError("key mancante.", 400);

  const { data: found, error: findErr } = await admin
    .from("nutrition_recipes")
    .select("id")
    .eq("recipe_key", key)
    .maybeSingle();
  if (findErr) return jsonError(findErr.message, 500);
  const recipeId = (found as { id?: string } | null)?.id;
  if (!recipeId) return jsonError("Ricetta non trovata.", 404);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const update: Record<string, unknown> = {};

  if ("label_it" in body) {
    if (typeof body.label_it !== "string" || !body.label_it.trim()) {
      return jsonError("label_it non può essere vuota.", 400);
    }
    update.label_it = body.label_it.trim();
  }
  if ("note" in body) {
    if (body.note !== null && typeof body.note !== "string") return jsonError("note: deve essere testo o null.", 400);
    update.note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  }
  if ("is_active" in body) {
    if (typeof body.is_active !== "boolean") return jsonError("is_active: deve essere booleano.", 400);
    update.is_active = body.is_active;
  }

  const hasExtraColumns = await recipeExtraColumnsAvailable(admin);
  if ("frequency" in body || "max_week" in body) {
    const freq = validateRecipeFrequency(body.frequency, body.max_week);
    if (!freq.ok) return jsonError(freq.error, 400);
    if (hasExtraColumns) {
      if ("frequency" in body) update.frequency = freq.frequency;
      if ("max_week" in body) update.max_week = freq.max_week;
    }
    // Colonne assenti: campi accettati ma ignorati (la UI lo sa da hasFrequencyColumns).
  }

  // Sostituzione componenti: validata per intero contro il catalogo, poi delete+reinsert.
  let newComponents: ReturnType<typeof componentsInsertPayload> | null = null;
  if ("components" in body) {
    const rawComponents = Array.isArray(body.components) ? (body.components as Record<string, unknown>[]) : [];
    const keys = rawComponents
      .map((c) => (typeof c?.canonical_key === "string" ? c.canonical_key.trim() : ""))
      .filter((k) => k);
    const { map: catalog, error: catErr } = await loadRecipeCatalog(admin, keys);
    if (catErr) return jsonError(catErr, 500);
    const comps = validateRecipeComponents(body.components, (k) => catalog.get(k) ?? null);
    if (!comps.ok) return jsonError(comps.error, 400);
    newComponents = componentsInsertPayload(recipeId, comps.value);
  }

  if (Object.keys(update).length === 0 && !newComponents) {
    return jsonError("Nessun campo da aggiornare.", 400);
  }

  if (Object.keys(update).length > 0) {
    update.updated_at = new Date().toISOString();
    const { error: updErr } = await admin.from("nutrition_recipes").update(update).eq("id", recipeId);
    if (updErr) {
      if (isUndefinedColumnError(updErr)) {
        return jsonError("Colonne frequency/max_week non ancora migrate: applica la migration e riprova.", 409);
      }
      return jsonError(updErr.message, 500);
    }
  }

  if (newComponents) {
    // Snapshot dei componenti attuali per ripristinarli se il reinsert fallisce
    // (niente transazione via PostgREST: best effort, e lo diciamo nell'errore).
    const { data: oldData, error: oldErr } = await admin
      .from("nutrition_recipe_components")
      .select("position, canonical_key, fdc_id, label_it, grams_per_100g, is_neutral")
      .eq("recipe_id", recipeId);
    if (oldErr) return jsonError(oldErr.message, 500);
    const oldComponents = ((oldData ?? []) as ExistingComponent[]).map((c) => ({ ...c, recipe_id: recipeId }));

    const { error: delErr } = await admin.from("nutrition_recipe_components").delete().eq("recipe_id", recipeId);
    if (delErr) return jsonError(delErr.message, 500);

    const { error: insErr } = await admin.from("nutrition_recipe_components").insert(newComponents);
    if (insErr) {
      const { error: restoreErr } = await admin.from("nutrition_recipe_components").insert(oldComponents);
      const restoreNote = restoreErr
        ? ` Ripristino dei componenti precedenti NON riuscito (${restoreErr.message}): la ricetta è senza componenti, correggila subito.`
        : " I componenti precedenti sono stati ripristinati.";
      return jsonError(`Reinsert componenti non riuscito: ${insErr.message}.${restoreNote}`, 500);
    }
    // updated_at anche quando cambiano solo i componenti: il pannello ordina/mostra l'ultima modifica.
    await admin.from("nutrition_recipes").update({ updated_at: new Date().toISOString() }).eq("id", recipeId);
  }

  const loaded = await loadAdminMenuRecipes(admin, { recipeKey: key });
  if (!loaded.ok) return jsonError(loaded.error, 500);
  const recipe = loaded.recipes[0];
  if (!recipe) return jsonError("Ricetta non trovata dopo l'aggiornamento.", 404);
  return NextResponse.json(
    { ok: true as const, recipe, hasFrequencyColumns: loaded.hasExtraColumns },
    { headers: NO_STORE },
  );
}

/** DELETE /api/admin/menu-recipes/[key] */
export async function DELETE(_req: Request, { params }: { params: { key: string } }) {
  const session = await requirePlatformAdminSession();
  if (!session) return jsonError("Non autorizzato.", 403);
  const admin = createSupabaseAdminClient();
  if (!admin) return jsonError("Manca SUPABASE_SERVICE_ROLE_KEY.", 503);
  const key = (params.key ?? "").trim();
  if (!key) return jsonError("key mancante.", 400);

  // Ricetta già servita in un piano → i meal_item storici la citano per recipe_key:
  // si disattiva, non si cancella. (Colonna meal_item.recipe_key: migration
  // 20260819100000_meal_item_recipe_ref; se mancasse, 42703 → trattiamo come «mai servita».)
  const { count, error: servedErr } = await admin
    .from("meal_item")
    .select("id", { count: "exact", head: true })
    .eq("recipe_key", key);
  if (servedErr && !isUndefinedColumnError(servedErr)) return jsonError(servedErr.message, 500);
  if ((count ?? 0) > 0) {
    return jsonError(
      `La ricetta «${key}» è già stata servita in ${count} righe di piano: disattivala invece di cancellarla.`,
      409,
    );
  }

  const { data: deleted, error } = await admin
    .from("nutrition_recipes")
    .delete()
    .eq("recipe_key", key)
    .select("id");
  if (error) return jsonError(error.message, 500);
  if (!deleted || deleted.length === 0) return jsonError("Ricetta non trovata.", 404);
  return NextResponse.json({ ok: true as const }, { headers: NO_STORE });
}
