import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "food-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Estensioni ammesse; usata anche per ripulire le varianti precedenti dello stesso alimento. */
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
 * POST /api/admin/foods/upload-image — multipart/form-data { file, fdcId }
 * Upload diretto dalla console: valida (image/*, max 5MB), carica con service role su
 * `food-images` al path `fdc/<fdcId>.<ext>` (upsert), aggiorna `fdc_food.image_url`
 * con la public URL (con `?v=` anti-cache per i re-upload) e la ritorna.
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

  const fdcId = Number(form.get("fdcId"));
  if (!Number.isFinite(fdcId) || fdcId <= 0) {
    return NextResponse.json({ ok: false as const, error: "fdcId mancante o non valido." }, { status: 400 });
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
    return NextResponse.json(
      { ok: false as const, error: "Immagine troppo grande: massimo 5 MB." },
      { status: 400 },
    );
  }
  const ext = resolveExtension(file);
  if (!ext) {
    return NextResponse.json(
      { ok: false as const, error: `Formato non supportato: usa ${ALLOWED_EXTENSIONS.join(", ")}.` },
      { status: 400 },
    );
  }

  // Verifica che l'alimento esista PRIMA dell'upload (evita file orfani nel bucket).
  const { data: food, error: foodErr } = await admin
    .from("fdc_food")
    .select("fdc_id")
    .eq("fdc_id", fdcId)
    .maybeSingle();
  if (foodErr) {
    return NextResponse.json({ ok: false as const, error: foodErr.message }, { status: 500 });
  }
  if (!food) {
    return NextResponse.json({ ok: false as const, error: "Alimento non trovato." }, { status: 404 });
  }

  const path = `fdc/${fdcId}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadErr) {
    return NextResponse.json({ ok: false as const, error: uploadErr.message }, { status: 500 });
  }

  // `?v=` anti-cache: il path è stabile (upsert), senza version i re-upload resterebbero
  // invisibili a browser/CDN che hanno già la vecchia immagine in cache.
  const base = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const publicUrl = `${base}?v=${Date.now()}`;

  const { error: updateErr } = await admin
    .from("fdc_food")
    .update({ image_url: publicUrl })
    .eq("fdc_id", fdcId);
  if (updateErr) {
    return NextResponse.json({ ok: false as const, error: updateErr.message }, { status: 500 });
  }

  // Best-effort: rimuove eventuali varianti con estensione diversa caricate in passato.
  const stale = ALLOWED_EXTENSIONS.filter((e) => e !== ext && e !== "jpeg").map(
    (e) => `fdc/${fdcId}.${e}`,
  );
  await admin.storage.from(BUCKET).remove(stale).then(
    () => undefined,
    () => undefined,
  );

  return NextResponse.json({ ok: true as const, publicUrl, path });
}
