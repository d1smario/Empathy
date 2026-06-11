import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Admin → Esercizi (public.exercise — catalogo unificato del motore allenamenti).
 * GET: lista paginata con ricerca su `name` e filtro `domain` (+ `meta=1` per enum/suggerimenti reali).
 * POST: crea esercizio (id slug univoco, name+domain obbligatori, enum whitelist, array text[] trim+dedupe).
 * PATCH: { id, patch } con whitelist rigida dei campi.
 * DELETE: { id } — rifiuta 409 se referenziato da workout_block_exercise.
 */

// ── Enum noti (verificati sui dati reali di public.exercise) ────────────────

const KNOWN_DOMAINS = ["gym", "endurance", "team_sport", "combat", "mind_body", "crossfit", "hyrox"] as const;
const KNOWN_CATEGORIES = [
  "strength",
  "accessory",
  "conditioning",
  "skill",
  "gym",
  "endurance",
  "mind_body",
  "combat",
  "team_sport",
  "crossfit",
  "hyrox",
] as const;
const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
const LEVELS = ["low", "medium", "high"] as const;
const ENERGY_SYSTEMS = ["aerobic", "mixed", "anaerobic_alactic", "anaerobic_lactic"] as const;
const LOAD_BANDS = ["low", "moderate", "high", "very_high"] as const;
const PRIMARY_SYSTEMS = [
  "neuromuscular_strength",
  "neuromuscular_power",
  "neuromuscular_endurance",
  "hypertrophy",
  "anaerobic_lactic",
  "aerobic",
  "stability",
  "coordination",
  "skill",
  "mobility",
] as const;
const TECHNICAL_SCOPES = ["generic", "sport_specific"] as const;

/** id = slug minuscolo: a-z, 0-9, `-` e `_`, 2-80 caratteri. */
const SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,79}$/;

// ── Whitelist campi ─────────────────────────────────────────────────────────

/** Campi enum (testo singolo) → valori ammessi. */
const ENUM_FIELDS: Record<string, readonly string[]> = {
  domain: KNOWN_DOMAINS,
  category: KNOWN_CATEGORIES,
  difficulty: DIFFICULTIES,
  primary_system: PRIMARY_SYSTEMS,
  energy_system: ENERGY_SYSTEMS,
  load_band: LOAD_BANDS,
  lactate_impact: LEVELS,
  cns_load: LEVELS,
  coordination: LEVELS,
  balance: LEVELS,
  technique: LEVELS,
  technical_scope: TECHNICAL_SCOPES,
};

/** Campi testo libero. */
const TEXT_FIELDS = ["name", "slug", "movement_pattern", "image_url", "source"] as const;

/** Campi text[] (NOT NULL default '{}' in DB). */
const ARRAY_FIELDS = [
  "sport_tags",
  "muscle_groups",
  "equipment",
  "secondary_systems",
  "adaptation_targets",
  "functional_goals",
  "metabolic_goals",
  "technical_sports",
  "technical_tags",
  "gym_channels",
  "gym_contractions",
] as const;

const EDITABLE_FIELDS = new Set<string>([...TEXT_FIELDS, ...Object.keys(ENUM_FIELDS), ...ARRAY_FIELDS, "payload"]);

const SELECT_COLUMNS = [
  "id",
  "slug",
  "name",
  "category",
  "domain",
  "sport_tags",
  "movement_pattern",
  "muscle_groups",
  "equipment",
  "difficulty",
  "primary_system",
  "secondary_systems",
  "adaptation_targets",
  "energy_system",
  "load_band",
  "lactate_impact",
  "cns_load",
  "coordination",
  "balance",
  "technique",
  "functional_goals",
  "metabolic_goals",
  "technical_scope",
  "technical_sports",
  "technical_tags",
  "gym_channels",
  "gym_contractions",
  "image_url",
  "source",
  "payload",
  "created_at",
].join(", ");

// ── Validazione campi ───────────────────────────────────────────────────────

type FieldResult = { ok: true; value: unknown } | { ok: false; error: string };

function normText(field: string, raw: unknown, required: boolean): FieldResult {
  if (raw == null) {
    return required ? { ok: false, error: `Campo "${field}" obbligatorio.` } : { ok: true, value: null };
  }
  if (typeof raw !== "string") return { ok: false, error: `Campo "${field}" deve essere una stringa.` };
  const v = raw.trim();
  if (!v) {
    return required ? { ok: false, error: `Campo "${field}" obbligatorio.` } : { ok: true, value: null };
  }
  if (v.length > 500) return { ok: false, error: `Campo "${field}" troppo lungo (max 500 caratteri).` };
  return { ok: true, value: v };
}

function normEnum(field: string, raw: unknown, allowed: readonly string[], required: boolean): FieldResult {
  const base = normText(field, raw, required);
  if (!base.ok || base.value === null) return base;
  const v = base.value as string;
  if (!allowed.includes(v)) {
    return { ok: false, error: `Campo "${field}" non valido: "${v}". Valori ammessi: ${allowed.join(", ")}.` };
  }
  return { ok: true, value: v };
}

/** Array text[]: trim, scarta vuoti, dedupe, limiti dimensione. */
function normArray(field: string, raw: unknown): FieldResult {
  if (raw == null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) {
    return { ok: false, error: `Campo "${field}" deve essere un array di stringhe.` };
  }
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") {
      return { ok: false, error: `Campo "${field}": ogni elemento deve essere una stringa.` };
    }
    const v = item.trim();
    if (!v) continue;
    if (v.length > 120) return { ok: false, error: `Campo "${field}": elemento troppo lungo (max 120 caratteri).` };
    if (!out.includes(v)) out.push(v);
  }
  if (out.length > 100) return { ok: false, error: `Campo "${field}": troppi elementi (max 100).` };
  return { ok: true, value: out };
}

function normPayload(raw: unknown): FieldResult {
  if (raw == null) return { ok: true, value: {} };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: `Campo "payload" deve essere un oggetto JSON.` };
  }
  return { ok: true, value: raw };
}

/**
 * Valida un singolo campo whitelisted.
 * `create`: name/domain/source obbligatori; `patch`: name/source non svuotabili, enum annullabili.
 */
function normalizeField(field: string, raw: unknown, mode: "create" | "patch"): FieldResult {
  if (field === "payload") return normPayload(raw);
  if ((ARRAY_FIELDS as readonly string[]).includes(field)) return normArray(field, raw);
  if (field in ENUM_FIELDS) {
    const required = mode === "create" && field === "domain";
    return normEnum(field, raw, ENUM_FIELDS[field], required);
  }
  if ((TEXT_FIELDS as readonly string[]).includes(field)) {
    const required = field === "name" || field === "source";
    return normText(field, raw, required);
  }
  return { ok: false, error: `Campo "${field}" non modificabile.` };
}

// ── Meta (enum/suggerimenti reali per la UI) ────────────────────────────────

type MetaRow = Record<string, unknown>;

function distinctScalars(rows: MetaRow[], key: string, seed: readonly string[] = []): string[] {
  const set = new Set<string>(seed);
  for (const r of rows) {
    const v = r[key];
    if (typeof v === "string" && v.trim()) set.add(v.trim());
  }
  return [...set].sort();
}

function distinctFromArrays(rows: MetaRow[], key: string): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const v = r[key];
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === "string" && item.trim()) set.add(item.trim());
      }
    }
  }
  return [...set].sort();
}

// ── Handlers ────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/exercises?q=&domain=&page=1&pageSize=50&meta=1
 * - q: ricerca ilike su name.
 * - domain: match esatto.
 * - meta=1: enum reali + suggerimenti distinct (chips) + conteggi per dominio.
 * Risposta: { ok, exercises, total, page, pageSize, meta? }
 */
export async function GET(req: Request) {
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

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const domain = (url.searchParams.get("domain") ?? "").trim();
  const includeMeta = (url.searchParams.get("meta") ?? "") === "1";

  const pageRaw = Number(url.searchParams.get("page") ?? 1);
  const pageSizeRaw = Number(url.searchParams.get("pageSize") ?? 50);
  const page = Number.isFinite(pageRaw) ? Math.max(Math.trunc(pageRaw), 1) : 1;
  const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(Math.trunc(pageSizeRaw), 1), 200) : 50;
  const offset = (page - 1) * pageSize;

  let query = admin
    .from("exercise")
    .select(SELECT_COLUMNS, { count: "exact" })
    .order("name", { ascending: true })
    .range(offset, offset + pageSize - 1);
  if (q) query = query.ilike("name", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  if (domain) query = query.eq("domain", domain);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
  }

  let meta: Record<string, unknown> | undefined;
  if (includeMeta) {
    const { data: metaRows, error: metaErr } = await admin
      .from("exercise")
      .select(
        "domain, category, difficulty, primary_system, energy_system, load_band, movement_pattern, source, muscle_groups, equipment, adaptation_targets, sport_tags",
      )
      .limit(2000);
    if (metaErr) {
      return NextResponse.json({ ok: false as const, error: metaErr.message }, { status: 500 });
    }
    const rows = (metaRows ?? []) as MetaRow[];
    const domainCounts: Record<string, number> = {};
    for (const r of rows) {
      const d = typeof r.domain === "string" && r.domain.trim() ? r.domain.trim() : null;
      if (d) domainCounts[d] = (domainCounts[d] ?? 0) + 1;
    }
    meta = {
      domains: distinctScalars(rows, "domain", KNOWN_DOMAINS),
      categories: distinctScalars(rows, "category", KNOWN_CATEGORIES),
      difficulties: distinctScalars(rows, "difficulty", DIFFICULTIES),
      primarySystems: distinctScalars(rows, "primary_system", PRIMARY_SYSTEMS),
      energySystems: distinctScalars(rows, "energy_system", ENERGY_SYSTEMS),
      loadBands: distinctScalars(rows, "load_band", LOAD_BANDS),
      levels: [...LEVELS],
      technicalScopes: [...TECHNICAL_SCOPES],
      movementPatterns: distinctScalars(rows, "movement_pattern"),
      sources: distinctScalars(rows, "source"),
      muscleGroups: distinctFromArrays(rows, "muscle_groups"),
      equipment: distinctFromArrays(rows, "equipment"),
      adaptationTargets: distinctFromArrays(rows, "adaptation_targets"),
      sportTags: distinctFromArrays(rows, "sport_tags"),
      domainCounts,
      countAll: rows.length,
    };
  }

  return NextResponse.json({
    ok: true as const,
    exercises: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
    ...(meta ? { meta } : {}),
  });
}

/**
 * POST /api/admin/exercises
 * Body: { id, name, domain, ...campi whitelisted }
 * Crea un esercizio nuovo: `id` slug univoco (409 se esiste), `name` + `domain` obbligatori.
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

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const idRaw = typeof body.id === "string" ? body.id.trim() : "";
  if (!idRaw) {
    return NextResponse.json({ ok: false as const, error: 'Campo "id" (slug) obbligatorio.' }, { status: 400 });
  }
  if (!SLUG_RE.test(idRaw)) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "id non valido: usare uno slug minuscolo (a-z, 0-9, trattini o underscore), 2-80 caratteri.",
      },
      { status: 400 },
    );
  }

  const insert: Record<string, unknown> = { id: idRaw };
  for (const field of EDITABLE_FIELDS) {
    const alwaysValidated =
      field === "name" ||
      field === "domain" ||
      field === "source" ||
      field === "payload" ||
      (ARRAY_FIELDS as readonly string[]).includes(field);
    if (body[field] === undefined && !alwaysValidated) continue;
    // Sorgente di default per gli inserimenti da console.
    const raw = field === "source" && body[field] === undefined ? "admin_console" : body[field];
    const res = normalizeField(field, raw, "create");
    if (!res.ok) {
      return NextResponse.json({ ok: false as const, error: res.error }, { status: 400 });
    }
    insert[field] = res.value;
  }

  // Unicità id verificata prima dell'insert (messaggio chiaro invece dell'errore PK opaco).
  const { data: existing, error: existErr } = await admin
    .from("exercise")
    .select("id")
    .eq("id", idRaw)
    .maybeSingle();
  if (existErr) {
    return NextResponse.json({ ok: false as const, error: existErr.message }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json(
      { ok: false as const, error: `Esiste già un esercizio con id "${idRaw}".` },
      { status: 409 },
    );
  }

  const { data, error } = await admin.from("exercise").insert(insert).select(SELECT_COLUMNS).maybeSingle();
  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json({ ok: false as const, error: error.message }, { status });
  }

  return NextResponse.json({ ok: true as const, exercise: data });
}

/**
 * PATCH /api/admin/exercises
 * Body: { id, patch: { ...campi whitelisted } } — qualsiasi campo fuori whitelist → 400.
 */
export async function PATCH(req: Request) {
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

  const body = (await req.json().catch(() => ({}))) as { id?: unknown; patch?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ ok: false as const, error: 'Campo "id" obbligatorio.' }, { status: 400 });
  }
  const patch = body.patch;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return NextResponse.json({ ok: false as const, error: 'Campo "patch" mancante o non valido.' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  for (const [field, raw] of Object.entries(patch as Record<string, unknown>)) {
    if (!EDITABLE_FIELDS.has(field)) {
      return NextResponse.json(
        { ok: false as const, error: `Campo "${field}" non modificabile (whitelist).` },
        { status: 400 },
      );
    }
    const res = normalizeField(field, raw, "patch");
    if (!res.ok) {
      return NextResponse.json({ ok: false as const, error: res.error }, { status: 400 });
    }
    update[field] = res.value;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false as const, error: "Nessun campo da aggiornare." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("exercise")
    .update(update)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false as const, error: `Esercizio "${id}" non trovato.` }, { status: 404 });
  }

  return NextResponse.json({ ok: true as const, exercise: data });
}

/**
 * DELETE /api/admin/exercises
 * Body: { id } — elimina SOLO se non referenziato da workout_block_exercise (altrimenti 409).
 */
export async function DELETE(req: Request) {
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

  const body = (await req.json().catch(() => ({}))) as { id?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ ok: false as const, error: 'Campo "id" obbligatorio.' }, { status: 400 });
  }

  const { count, error: refErr } = await admin
    .from("workout_block_exercise")
    .select("id", { count: "exact", head: true })
    .eq("exercise_id", id);
  if (refErr) {
    return NextResponse.json({ ok: false as const, error: refErr.message }, { status: 500 });
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        ok: false as const,
        error: `Impossibile eliminare: l'esercizio è usato in ${count} blocchi allenamento. Rimuovi prima i riferimenti dai workout.`,
      },
      { status: 409 },
    );
  }

  const { data, error } = await admin.from("exercise").delete().eq("id", id).select("id").maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false as const, error: `Esercizio "${id}" non trovato.` }, { status: 404 });
  }

  return NextResponse.json({ ok: true as const, deletedId: id });
}
