import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  allKnownFdcIds,
  CANONICAL_FOOD_TO_FDC_ID,
} from "@/lib/nutrition/canonical-food-fdc-aliases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mappa `canonicalKey → imageUrl` per il thumb del Piano alimentare.
 *
 * Risoluzione (per ogni chiave canonica con un fdc_id noto):
 *   1. `fdc_food.image_url` specifica (impostata in Admin → Alimenti) →
 *   2. immagine della `food_category` (`fdc_food_category_image`) →
 *   3. assente → il client cade sull'icona lucide deterministica.
 *
 * `fdc_food` è RLS solo-admin: si legge col service role. La mappa è identica
 * per tutti gli utenti e contiene solo URL pubblici, quindi è cache-abile a lungo.
 */
export async function GET() {
  const empty = NextResponse.json({ byKey: {} as Record<string, string> });
  empty.headers.set("Cache-Control", "private, max-age=300");

  // Solo utenti autenticati: l'endpoint legge fdc_food (RLS solo-admin) col
  // service role, quindi non deve essere anonimo. La mappa non è per-utente.
  const session = createServerSupabaseClient();
  const { data: userData } = await session.auth.getUser();
  if (!userData?.user) return empty;

  const admin = createSupabaseAdminClient();
  if (!admin) return empty; // niente service key → nessuna regressione, solo icone

  const fdcIds = allKnownFdcIds();
  if (!fdcIds.length) return empty;

  const [foodsRes, catsRes] = await Promise.all([
    admin.from("fdc_food").select("fdc_id, image_url, food_category").in("fdc_id", fdcIds),
    admin.from("fdc_food_category_image").select("food_category, image_url"),
  ]);

  if (foodsRes.error) return empty;

  const categoryImage = new Map<string, string>();
  for (const row of catsRes.data ?? []) {
    if (row.food_category && row.image_url) categoryImage.set(row.food_category, row.image_url);
  }

  const imageByFdcId = new Map<number, { specific: string | null; category: string | null }>();
  for (const row of foodsRes.data ?? []) {
    const fdcId = Number(row.fdc_id);
    if (!Number.isFinite(fdcId)) continue;
    imageByFdcId.set(fdcId, {
      specific: typeof row.image_url === "string" && row.image_url.trim() ? row.image_url.trim() : null,
      category: row.food_category ? categoryImage.get(row.food_category) ?? null : null,
    });
  }

  const byKey: Record<string, string> = {};
  for (const [canonicalKey, fdcId] of Object.entries(CANONICAL_FOOD_TO_FDC_ID)) {
    if (typeof fdcId !== "number") continue;
    const hit = imageByFdcId.get(fdcId);
    const url = hit?.specific ?? hit?.category ?? null;
    if (url) byKey[canonicalKey] = url;
  }

  const res = NextResponse.json({ byKey });
  res.headers.set("Cache-Control", "private, max-age=300");
  return res;
}
