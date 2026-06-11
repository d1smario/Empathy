import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Admin → Mail Log (public.email_log, eventi webhook Postmark).
 * GET: lista paginata con ricerca su destinatario/oggetto e filtri per
 * record_type e message_stream; include=meta aggiunge i distinct per le pill.
 */

const SELECT_COLUMNS =
  "id, message_id, record_type, recipient, message_stream, tag, subject, details, payload, occurred_at, created_at";

/** Escape per pattern ILIKE dentro un valore quotato del filtro `or` di PostgREST. */
function toQuotedIlikePattern(q: string): string {
  const likeEscaped = q.replace(/[\\%_]/g, "\\$&");
  const quoteEscaped = likeEscaped.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `%${quoteEscaped}%`;
}

/**
 * GET /api/admin/mail-log?q=&recordType=&stream=&limit=50&offset=0&include=meta
 * - q: ricerca ilike su recipient e subject.
 * - recordType: match esatto su record_type (Delivery, Open, Bounce, …).
 * - stream: match esatto su message_stream (outbound, broadcast, …).
 * - include=meta: aggiunge i distinct record_type/message_stream per i filtri a pill.
 * Risposta: { ok, entries, total, limit, offset, recordTypes?, streams? }
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
  const recordType = (url.searchParams.get("recordType") ?? "").trim();
  const stream = (url.searchParams.get("stream") ?? "").trim();
  const includeMeta = (url.searchParams.get("include") ?? "") === "meta";

  const limitRaw = Number(url.searchParams.get("limit") ?? 50);
  const offsetRaw = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;

  let query = admin
    .from("email_log")
    .select(SELECT_COLUMNS, { count: "exact" })
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    const pattern = toQuotedIlikePattern(q);
    query = query.or(`recipient.ilike."${pattern}",subject.ilike."${pattern}"`);
  }
  if (recordType) query = query.eq("record_type", recordType);
  if (stream) query = query.eq("message_stream", stream);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
  }

  let recordTypes: string[] | undefined;
  let streams: string[] | undefined;
  if (includeMeta) {
    const { data: metaRows, error: metaErr } = await admin
      .from("email_log")
      .select("record_type, message_stream")
      .limit(20000);
    if (!metaErr && metaRows) {
      const rows = metaRows as { record_type: string | null; message_stream: string | null }[];
      recordTypes = [...new Set(rows.map((r) => (r.record_type ?? "").trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "it"),
      );
      streams = [...new Set(rows.map((r) => (r.message_stream ?? "").trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "it"),
      );
    }
  }

  return NextResponse.json({
    ok: true as const,
    entries: data ?? [],
    total: count ?? 0,
    limit,
    offset,
    ...(recordTypes ? { recordTypes } : {}),
    ...(streams ? { streams } : {}),
  });
}
