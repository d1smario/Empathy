import { NextRequest, NextResponse } from "next/server";
import { loadUnifiedExerciseCatalogFromDb } from "@/lib/training/exercise-library/catalog-db";
import { renderExerciseArtSvg } from "@/lib/training/builder/exercise-art";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Thumb esercizio per la scheda palestra / catalogo.
 *
 * Priorità:
 *   1. **Foto reale** impostata in Admin → Esercizi (`exercise.image_url`) →
 *   2. arte procedurale SVG (`renderExerciseArtSvg`), sempre disponibile come fallback.
 *
 * `exercise_catalog.id === exercise.id` (join verificato), quindi lo stesso
 * `catalogExerciseId` usato dal builder risolve entrambe le tabelle. `exercise`
 * è RLS solo-admin → si legge col service role. Nessuna foto in DB ⇒ resta l'SVG,
 * quindi zero regressioni finché non si caricano immagini dall'Admin.
 */
export async function GET(req: NextRequest) {
  const catalogExerciseId = (req.nextUrl.searchParams.get("catalogExerciseId") ?? "").trim();
  if (!catalogExerciseId) {
    return NextResponse.json({ error: "Missing catalogExerciseId" }, { status: 400 });
  }

  // 1) Foto reale (Admin) ha priorità sull'arte procedurale.
  const admin = createSupabaseAdminClient();
  if (admin) {
    const { data } = await admin
      .from("exercise")
      .select("image_url")
      .eq("id", catalogExerciseId)
      .maybeSingle();
    const imageUrl = typeof data?.image_url === "string" ? data.image_url.trim() : "";
    if (imageUrl) return NextResponse.redirect(imageUrl, 302);
  }

  // 2) Fallback: arte procedurale SVG dal catalogo unificato.
  const catalog = await loadUnifiedExerciseCatalogFromDb();
  const record = catalog.exercises.find((x) => x.id === catalogExerciseId);
  if (!record) {
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  }

  const svg = renderExerciseArtSvg(record);
  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
