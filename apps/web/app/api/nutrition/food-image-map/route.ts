import { NextResponse } from "next/server";
import { createSupabaseCookieClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  allKnownFdcIds,
  CANONICAL_FOOD_TO_FDC_ID,
} from "@/lib/nutrition/canonical-food-fdc-aliases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mappe immagini-cibo per il thumb del Piano alimentare.
 *
 * - `byFdcId`: `fdc_id → imageUrl` per OGNI riga `fdc_food` con foto specifica
 *   caricata (l'intera libreria, non solo i canonici). Risoluzione PRIMARIA:
 *   un item che porta il suo fdc_id (`compositionKey = "fdc:NNN"`, piano V2)
 *   mostra la SUA foto, qualunque alimento sia.
 * - `byKey`: `canonicalKey → imageUrl` — per gli item senza fdc_id risolti via
 *   nome→chiave canonica:
 *   1. `fdc_food.image_url` specifica (impostata in Admin → Alimenti) →
 *   2. immagine della `food_category` (`fdc_food_category_image`) →
 *   3. assente → il client cade sull'icona lucide deterministica.
 *
 * `fdc_food` è RLS solo-admin: si legge col service role. Le mappe sono identiche
 * per tutti gli utenti e contengono solo URL pubblici, quindi cache-abili a lungo.
 */
export async function GET() {
  const empty = NextResponse.json({
    byKey: {} as Record<string, string>,
    byFdcId: {} as Record<string, string>,
  });
  empty.headers.set("Cache-Control", "private, max-age=300");

  // Solo utenti autenticati: l'endpoint legge fdc_food (RLS solo-admin) col
  // service role, quindi non deve essere anonimo. La mappa non è per-utente.
  // NB: serve il client COOKIE-aware (legge la sessione dalla richiesta); il
  // vecchio createServerSupabaseClient (service/anon senza cookie) faceva
  // sempre getUser()=null → byKey vuoto → nessuna foto nel Piano.
  const session = createSupabaseCookieClient();
  const { data: userData } = session
    ? await session.auth.getUser()
    : { data: { user: null } };
  if (!userData?.user) return empty;

  const admin = createSupabaseAdminClient();
  if (!admin) return empty; // niente service key → nessuna regressione, solo icone

  const fdcIds = allKnownFdcIds();
  if (!fdcIds.length) return empty;

  const [foodsRes, catsRes, allWithImageRes] = await Promise.all([
    admin.from("fdc_food").select("fdc_id, image_url, food_category").in("fdc_id", fdcIds),
    admin.from("fdc_food_category_image").select("food_category, image_url"),
    // Libreria completa: ogni alimento con foto specifica, a prescindere dai canonici.
    admin.from("fdc_food").select("fdc_id, image_url").not("image_url", "is", null),
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

  const byFdcId: Record<string, string> = {};
  for (const row of allWithImageRes.data ?? []) {
    const fdcId = Number(row.fdc_id);
    const url = typeof row.image_url === "string" ? row.image_url.trim() : "";
    if (Number.isFinite(fdcId) && url) byFdcId[String(fdcId)] = url;
  }

  const res = NextResponse.json({ byKey, byFdcId });
  res.headers.set("Cache-Control", "private, max-age=300");
  return res;
}
