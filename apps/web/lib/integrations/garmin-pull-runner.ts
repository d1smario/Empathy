import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { readOptionalServiceRoleKey } from "@/lib/supabase-env";

import {
  persistGarminPullBinaryToStorage,
  shouldTreatGarminPullResponseAsBinary,
} from "./garmin-activity-blob-storage";
import { ensureFreshGarminAccessTokenForAthlete } from "./garmin-access-token";
import { tryParseGarminApiErrorMessage } from "./garmin-api-error-body";
import { queueGarminActivityEnrichmentAfterActivitiesPull } from "./garmin-activity-follow-up-pull-queue";
import {
  type GarminBinaryEnrichRunSummary,
  tryEnrichExecutedWorkoutFromGarminBinaryBlob,
} from "./garmin-binary-route-enrich";
import { materializeGarminActivitiesFromPullResponse } from "./garmin-activity-materialize";
import { buildGarminSignedGetHeaders } from "./garmin-oauth1-client";
import {
  materializeGarminWellnessFromPullResponse,
  shouldMaterializeGarminWellness,
} from "./garmin-wellness-materialize";

type PullJobRow = {
  id: string;
  callback_url: string;
  user_access_token: string | null;
  athlete_id: string | null;
  endpoint_kind: string;
  stream_key: string | null;
  receipt_id: string | null;
  query_snapshot: unknown;
};

function nowIso() {
  return new Date().toISOString();
}

/** Garmin risponde 403 con `errorMessage` tipo "Unknown UserAccessToken" quando l’OAuth1 user token della push non è più valido (OAuth2-first, token revocato, ecc.) ma il GET accetta ancora `Bearer` + `token=` sulla URL. */
function shouldRetryGarminPullWithOAuth2Bearer(
  httpStatus: number,
  responseUtf8: string,
  hadOAuth1UserToken: boolean,
  athleteId: string | null,
): boolean {
  if (!hadOAuth1UserToken || !athleteId?.trim()) return false;
  if (httpStatus !== 403) return false;
  const msg = (tryParseGarminApiErrorMessage(responseUtf8) ?? responseUtf8).toLowerCase();
  return msg.includes("unknown useraccesstoken") || msg.includes("unknown user access token");
}

async function safeJsonBody(text: string): Promise<unknown> {
  const slice = text.slice(0, 900_000);
  try {
    return JSON.parse(slice) as unknown;
  } catch {
    return { _nonJson: true, raw: slice };
  }
}

/**
 * Esegue fino a `limit` job in stato `pending`: OAuth1 (token push) oppure Bearer OAuth2 se token assente e `athlete_id` risolto.
 * Chiamare da `POST /api/integrations/garmin/pull/run` o `GET /api/integrations/garmin/pull/cron` (Vercel Cron) con segreto.
 */
export async function runGarminPullJobs(limit: number): Promise<{
  processed: number;
  completed: number;
  failed: number;
  errors: string[];
  activitiesUpserted: number;
  activityBlobsStored: number;
  wellnessExportsUpserted: number;
}> {
  if (!readOptionalServiceRoleKey()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY richiesta per la coda pull Garmin.");
  }

  const supabase = createServerSupabaseClient();
  const { data: jobs, error } = await supabase
    .from("garmin_pull_jobs")
    .select("id, callback_url, user_access_token, athlete_id, endpoint_kind, stream_key, receipt_id, query_snapshot")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  const list = (jobs ?? []) as PullJobRow[];

  let completed = 0;
  let failed = 0;
  let activitiesUpserted = 0;
  let activityBlobsStored = 0;
  let wellnessExportsUpserted = 0;
  const errors: string[] = [];

  for (const job of list) {
    const t = nowIso();
    await supabase.from("garmin_pull_jobs").update({ status: "fetching", updated_at: t }).eq("id", job.id);

    try {
      const userTok = job.user_access_token?.trim() ?? "";
      const hadOAuth1UserToken = Boolean(userTok);

      // OAuth2 Bearer PREFERITO: il user_access_token OAuth1 del push è spesso stale dopo
      // la migrazione OAuth2-first → 403 "Unknown UserAccessToken" (causa principale dei
      // fallimenti). Se l'atleta ha un link OAuth2 valido usiamo il Bearer fresco; se non
      // è disponibile (env OAuth2 assente / atleta non collegato) fallback sul token OAuth1
      // firmato del push. Strettamente non-regressivo: senza OAuth2 il comportamento è quello
      // di prima. Fallback incrociato sotto per coprire l'endpoint che non onora un metodo.
      const oauth2 = job.athlete_id
        ? await ensureFreshGarminAccessTokenForAthlete(supabase, job.athlete_id)
        : ({ error: "no_athlete_id" } as const);
      const oauth2Token = "error" in oauth2 ? null : oauth2.accessToken;

      const oauth1Headers = (): Record<string, string> => ({
        ...buildGarminSignedGetHeaders({ url: job.callback_url, userAccessToken: userTok }),
        Accept: "*/*",
      });

      let usedBearer = false;
      let fetchHeaders: Record<string, string>;
      if (oauth2Token) {
        fetchHeaders = { Authorization: `Bearer ${oauth2Token}`, Accept: "*/*" };
        usedBearer = true;
      } else if (userTok) {
        fetchHeaders = oauth1Headers();
      } else if (job.athlete_id) {
        throw new Error(`oauth2_pull: ${"error" in oauth2 ? oauth2.error : "no_token"}`);
      } else {
        throw new Error("pull_job_senza_user_access_token né athlete_id");
      }

      const doFetch = async (headers: Record<string, string>) => {
        const r = await fetch(job.callback_url, {
          method: "GET",
          headers,
          cache: "no-store",
          signal: AbortSignal.timeout(90_000),
        });
        return { r, b: Buffer.from(await r.arrayBuffer()) };
      };

      let { r: res, b: buf } = await doFetch(fetchHeaders);

      // Fallback incrociato sui fallimenti di auth (401/403):
      // - Bearer fallito ma c'è un token OAuth1 → ritenta OAuth1 (preserva le pull che
      //   storicamente funzionavano in OAuth1);
      // - OAuth1 fallito con "Unknown UserAccessToken" e OAuth2 disponibile → ritenta Bearer.
      if (!res.ok && (res.status === 401 || res.status === 403)) {
        if (usedBearer && userTok) {
          ({ r: res, b: buf } = await doFetch(oauth1Headers()));
        } else if (
          !usedBearer &&
          oauth2Token == null &&
          shouldRetryGarminPullWithOAuth2Bearer(res.status, buf.toString("utf8"), hadOAuth1UserToken, job.athlete_id)
        ) {
          const tok = await ensureFreshGarminAccessTokenForAthlete(supabase, job.athlete_id!);
          if (!("error" in tok)) {
            ({ r: res, b: buf } = await doFetch({ Authorization: `Bearer ${tok.accessToken}`, Accept: "*/*" }));
          }
        }
      }

      const hdrCtRaw = res.headers.get("content-type");
      const contentDispositionRaw = res.headers.get("content-disposition");
      const ok = res.ok;

      /** Evita `.toString('utf8')` su blob multi‑MB (FIT) se archiviamo come binario. */
      let responseTextCache: string | undefined;
      const responseText = () => (responseTextCache ??= buf.toString("utf8"));

      let body: unknown;
      let enrichRun: GarminBinaryEnrichRunSummary | null = null;
      const binaryPersist = shouldTreatGarminPullResponseAsBinary(ok, hdrCtRaw, buf);
      if (binaryPersist && ok) {
        const persisted = await persistGarminPullBinaryToStorage({
          supabase,
          pullJobId: job.id,
          athleteId: job.athlete_id,
          endpointKind: job.endpoint_kind,
          callbackUrl: job.callback_url,
          buffer: buf,
          contentType: hdrCtRaw,
          contentDispositionHeader: contentDispositionRaw,
        });
        if (!persisted.stored) {
          throw new Error(`garmin_pull_binary_archive: ${persisted.reason}`);
        }
        activityBlobsStored += 1;
        if (job.athlete_id) {
          try {
            const qs =
              job.query_snapshot && typeof job.query_snapshot === "object" && !Array.isArray(job.query_snapshot)
                ? (job.query_snapshot as Record<string, unknown>)
                : null;
            enrichRun = await tryEnrichExecutedWorkoutFromGarminBinaryBlob({
              supabase,
              athleteId: job.athlete_id,
              callbackUrl: job.callback_url,
              buffer: buf,
              extension: persisted.extension,
              contentType: persisted.upload_content_type,
              querySnapshot: qs,
            });
          } catch (enrichErr) {
            enrichRun = {
              callback_activity_id: null,
              candidate_ids: [],
              resolved_external_id: null,
              executed_workout_id: null,
              outcome: "parse_error",
              message: enrichErr instanceof Error ? enrichErr.message : String(enrichErr),
            };
          }
        }
        body = {
          garminWellnessBinaryResponse: true as const,
          stored: true as const,
          storage_bucket: persisted.bucket,
          storage_path: persisted.path,
          sha256_hex: persisted.sha256_hex,
          byteLength: persisted.byte_length,
          contentType: persisted.upload_content_type,
          extension: persisted.extension,
          fit_extract_summary: persisted.fit_extract,
          blob_row_id: persisted.row_id ?? null,
          ...(enrichRun ? { garmin_binary_enrich_run: enrichRun } : {}),
        };
      } else {
        body = await safeJsonBody(responseText());
      }
      if (ok) completed += 1;
      else failed += 1;

      const errDetail = !ok ? tryParseGarminApiErrorMessage(responseText()) ?? responseText().slice(0, 4000) : null;

      await supabase
        .from("garmin_pull_jobs")
        .update({
          status: ok ? "completed" : "failed",
          updated_at: nowIso(),
          http_status: res.status,
          response_body: body as Record<string, unknown>,
          error_message: errDetail,
        })
        .eq("id", job.id);

      if (ok && job.athlete_id) {
        try {
          const { upserted } = await materializeGarminActivitiesFromPullResponse({
            athleteId: job.athlete_id,
            endpointKind: job.endpoint_kind,
            streamKey: job.stream_key,
            responseBody: body,
          });
          activitiesUpserted += upserted;
        } catch {
          /* materializzazione best-effort */
        }
        if (
          shouldMaterializeGarminWellness({
            streamKey: job.stream_key,
            endpointKind: job.endpoint_kind,
            responseBody: body,
          })
        ) {
          try {
            const { persisted } = await materializeGarminWellnessFromPullResponse({
              athleteId: job.athlete_id,
              streamKey: job.stream_key,
              responseBody: body,
            });
            wellnessExportsUpserted += persisted;
          } catch {
            /* wellness export best-effort */
          }
        }

        if (ok && !binaryPersist) {
          try {
            await queueGarminActivityEnrichmentAfterActivitiesPull({
              supabase,
              job,
              responseBody: body,
            });
          } catch {
            /* follow-up queue best-effort */
          }
        }
      }
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : "Pull fallito.";
      errors.push(`${job.id}: ${msg}`);
      await supabase
        .from("garmin_pull_jobs")
        .update({
          status: "failed",
          updated_at: nowIso(),
          error_message: msg.slice(0, 4000),
        })
        .eq("id", job.id);
    }
  }

  return {
    processed: list.length,
    completed,
    failed,
    errors,
    activitiesUpserted,
    activityBlobsStored,
    wellnessExportsUpserted,
  };
}
