import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { canAccessAthleteData } from "@/lib/athlete/can-access-athlete-data";
import { assertPlatformEntitlementForApi } from "@/lib/billing/assert-platform-entitlement";
import { getSupabasePublicConfig } from "@/lib/integrations/integration-status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

/** Errore auth/allenamento — stesso ruolo di V1 `RequestAuthError` per route training. */
export class TrainingRouteAuthError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "TrainingRouteAuthError";
    this.status = status;
  }
}

function readBearer(req: NextRequest): string | null {
  const raw = (req.headers.get("authorization") ?? "").trim();
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export type AuthenticatedTrainingUser = {
  userId: string;
  /** Client con JWT utente (o cookie session): letture profilo / coach-athletes con RLS. */
  rlsClient: SupabaseClient;
};

/**
 * Micro-cache di processo per il gate per-richiesta: al load della pagina
 * nutrition/training partono 4-5 chiamate API e OGNUNA ripagava 3-4 round-trip
 * seriali identici (entitlement piattaforma + accesso atleta) — audit 2026-07.
 * In cache entrano SOLO gli esiti positivi (TTL 60 s): un permesso revocato
 * torna effettivo entro un minuto, un accesso negato si riverifica sempre.
 */
const AUTH_GATE_OK_TTL_MS = 60_000;
const AUTH_GATE_CACHE_MAX = 5000;
const entitlementOkAt = new Map<string, number>();
const athleteAccessOkAt = new Map<string, number>();

/** Ruolo del CALLER (non del target): serve alle route per l'enforcement dei campi coach-only. */
export type CallerRoleInfo = {
  role: string | null;
  isPlatformAdmin: boolean;
};

const callerRoleInfoCache = new Map<string, { at: number; info: CallerRoleInfo }>();

/**
 * Ruolo + is_platform_admin del caller da `app_user_profiles` (RLS: la propria riga è leggibile,
 * stesso pattern di `getSessionProfile`). Micro-cache 60 s come gli altri gate; su errore di
 * query NON cachiamo e degradiamo a non-privilegiato (least privilege), così un errore
 * transitorio non blocca un coach per un minuto intero.
 */
async function resolveCallerRoleInfoCached(userId: string, rlsClient: SupabaseClient): Promise<CallerRoleInfo> {
  const hit = callerRoleInfoCache.get(userId);
  if (hit && Date.now() - hit.at < AUTH_GATE_OK_TTL_MS) return hit.info;
  const { data, error } = await rlsClient
    .from("app_user_profiles")
    .select("role, is_platform_admin")
    .eq("user_id", userId)
    .maybeSingle();
  const p = data as { role?: string | null; is_platform_admin?: boolean | null } | null;
  const info: CallerRoleInfo = {
    role: typeof p?.role === "string" ? p.role : null,
    isPlatformAdmin: p?.is_platform_admin === true,
  };
  if (!error) {
    if (callerRoleInfoCache.size > AUTH_GATE_CACHE_MAX) callerRoleInfoCache.clear();
    callerRoleInfoCache.set(userId, { at: Date.now(), info });
  }
  return info;
}

async function assertPlatformEntitlementCached(userId: string, rlsClient: SupabaseClient): Promise<void> {
  const at = entitlementOkAt.get(userId);
  if (at != null && Date.now() - at < AUTH_GATE_OK_TTL_MS) return;
  await assertPlatformEntitlementForApi(userId, rlsClient);
  if (entitlementOkAt.size > AUTH_GATE_CACHE_MAX) entitlementOkAt.clear();
  entitlementOkAt.set(userId, Date.now());
}

async function canAccessAthleteDataCached(
  rlsClient: SupabaseClient,
  userId: string,
  athleteId: string,
): Promise<boolean> {
  const key = `${userId}:${athleteId}`;
  const at = athleteAccessOkAt.get(key);
  if (at != null && Date.now() - at < AUTH_GATE_OK_TTL_MS) return true;
  const allowed = await canAccessAthleteData(rlsClient, userId, athleteId, null);
  if (allowed) {
    if (athleteAccessOkAt.size > AUTH_GATE_CACHE_MAX) athleteAccessOkAt.clear();
    athleteAccessOkAt.set(key, Date.now());
  }
  return allowed;
}

/**
 * Utente autenticato: header `Authorization: Bearer` (come V1 `training-write-api`) oppure cookie session.
 */
export async function requireAuthenticatedTrainingUser(req: NextRequest): Promise<AuthenticatedTrainingUser> {
  const config = getSupabasePublicConfig();
  if (!config) {
    throw new TrainingRouteAuthError(503, "supabase_unconfigured");
  }

  const bearer = readBearer(req);
  if (bearer) {
    const verifier = createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: got, error } = await verifier.auth.getUser(bearer);
    if (error || !got.user) {
      throw new TrainingRouteAuthError(401, "unauthorized");
    }
    const rlsClient = createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    return { userId: got.user.id, rlsClient };
  }

  const cookieClient = createSupabaseCookieClient();
  if (!cookieClient) {
    throw new TrainingRouteAuthError(503, "supabase_unconfigured");
  }
  const { data: got, error } = await cookieClient.auth.getUser();
  if (error || !got.user) {
    throw new TrainingRouteAuthError(401, "unauthorized");
  }
  return { userId: got.user.id, rlsClient: cookieClient };
}

/**
 * Verifica accesso atleta (private / coach) poi restituisce client DB per mutazioni.
 * Se è configurato `SUPABASE_SERVICE_ROLE_KEY`, usa service role per insert/update/delete (parity V1 `createServerSupabaseClient`).
 */
export async function requireTrainingAthleteWriteContext(
  req: NextRequest,
  athleteId: string,
): Promise<{ userId: string; db: SupabaseClient; role: string | null; isPlatformAdmin: boolean }> {
  const target = athleteId.trim();
  if (!target) {
    throw new TrainingRouteAuthError(400, "Missing athleteId");
  }

  const { userId, rlsClient } = await requireAuthenticatedTrainingUser(req);
  // Indipendenti tra loro: in parallelo (prima 2 stadi seriali per richiesta).
  // Il ruolo del caller viaggia insieme al gate (micro-cache 60 s) così le route che
  // devono distinguere atleta vs coach/admin (enforcement % nutrizione) non ripetono la query.
  const [, allowed, roleInfo] = await Promise.all([
    assertPlatformEntitlementCached(userId, rlsClient),
    canAccessAthleteDataCached(rlsClient, userId, target),
    resolveCallerRoleInfoCached(userId, rlsClient),
  ]);
  if (!allowed) {
    throw new TrainingRouteAuthError(403, "forbidden");
  }

  const admin = createSupabaseAdminClient();
  const db = admin ?? rlsClient;
  return { userId, db, role: roleInfo.role, isPlatformAdmin: roleInfo.isPlatformAdmin };
}

/** Lettura “forte” dopo auth utente: preferisci service role se disponibile (es. DELETE guard su id). */
export function supabaseForTrainingReadAfterAuth(rlsClient: SupabaseClient): SupabaseClient {
  return createSupabaseAdminClient() ?? rlsClient;
}

/**
 * Auth training (Bearer o cookie) + `canAccessAthleteData` + client DB per letture tabella.
 * **Import canonico lato app:** `@/lib/auth/athlete-read-context` → `requireAthleteReadContext`.
 */
export async function requireTrainingAthleteReadContext(
  req: NextRequest,
  athleteId: string,
): Promise<{ userId: string; rlsClient: SupabaseClient; db: SupabaseClient }> {
  const target = athleteId.trim();
  if (!target) {
    throw new TrainingRouteAuthError(400, "missing_athleteId");
  }

  const { userId, rlsClient } = await requireAuthenticatedTrainingUser(req);
  // Indipendenti tra loro: in parallelo (prima 2 stadi seriali per richiesta).
  const [, allowed] = await Promise.all([
    assertPlatformEntitlementCached(userId, rlsClient),
    canAccessAthleteDataCached(rlsClient, userId, target),
  ]);
  if (!allowed) {
    throw new TrainingRouteAuthError(403, "forbidden");
  }

  const db = supabaseForTrainingReadAfterAuth(rlsClient);
  return { userId, rlsClient, db };
}
