import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "exercise-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "avif"] as const;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function resolveExtension(file: File): string | null {
  const fromName = (file.name.split(".").pop() ?? "").toLowerCase();
  if ((ALLOWED_EXTENSIONS as readonly string[]).includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  return MIME_TO_EXT[file.type] ?? null;
}

/**
 * POST /api/admin/exercises/upload-image — multipart/form-data { file, exerciseId }
 * Carica una foto esercizio dalla console: valida (image/*, max 5MB), upload con
 * service role su `exercise-images` al path `catalog/<exerciseId>.<ext>` (upsert),
 * aggiorna `exercise.image_url` con la public URL (`?v=` anti-cache) e la ritorna.
 * La foto poi fluisce alla scheda palestra via `exercise-art` (redirect a image_url).
 * Risposta: { ok, publicUrl, path }
 */
export async function POST(req: Request) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { ok: false as const, error: "Body non valido: attesa una form multipart/form-data." },
      { status: 400 },
    );
  }

  const exerciseId = String(form.get("exerciseId") ?? "").trim();
  if (!exerciseId) {
    return NextResponse.json({ ok: false as const, error: "exerciseId mancante." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false as const, error: "file mancante." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { ok: false as const, error: "Il file deve essere un'immagine (image/*)." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false as const, error: "Immagine troppo grande: massimo 5 MB." }, { status: 400 });
  }
  const ext = resolveExtension(file);
  if (!ext) {
    return NextResponse.json(
      { ok: false as const, error: `Formato non supportato: usa ${ALLOWED_EXTENSIONS.join(", ")}.` },
      { status: 400 },
    );
  }

  // Verifica che l'esercizio esista PRIMA dell'upload (evita file orfani nel bucket).
  const { data: exercise, error: exErr } = await admin
    .from("exercise")
    .select("id")
    .eq("id", exerciseId)
    .maybeSingle();
  if (exErr) {
    return NextResponse.json({ ok: false as const, error: exErr.message }, { status: 500 });
  }
  if (!exercise) {
    return NextResponse.json({ ok: false as const, error: "Esercizio non trovato." }, { status: 404 });
  }

  // Path sicuro: l'id catalogo può contenere caratteri non-URL → codifica in base a-z0-9-_.
  const safeId = exerciseId.replace(/[^a-zA-Z0-9-_]/g, "_");
  const path = `catalog/${safeId}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadErr) {
    return NextResponse.json({ ok: false as const, error: uploadErr.message }, { status: 500 });
  }

  // `?v=` anti-cache: path stabile (upsert), senza version i re-upload resterebbero invisibili.
  const base = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const publicUrl = `${base}?v=${Date.now()}`;

  const { error: updateErr } = await admin.from("exercise").update({ image_url: publicUrl }).eq("id", exerciseId);
  if (updateErr) {
    return NextResponse.json({ ok: false as const, error: updateErr.message }, { status: 500 });
  }

  // Best-effort: rimuove varianti con estensione diversa caricate in passato.
  const stale = ALLOWED_EXTENSIONS.filter((e) => e !== ext && e !== "jpeg").map((e) => `catalog/${safeId}.${e}`);
  await admin.storage.from(BUCKET).remove(stale).then(
    () => undefined,
    () => undefined,
  );

  return NextResponse.json({ ok: true as const, publicUrl, path });
}
