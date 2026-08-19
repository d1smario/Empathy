/**
 * Data Cache di Next sulle GET PostgREST (bug 19 ago: sedute reali invisibili al motore
 * nutrizione perché la stessa URL `planned_workouts?…&date=eq.X` veniva servita dalla cache
 * di un'invocazione precedente). Qui si verifica, senza rete, che:
 *  a. `withNoStoreCache` aggiunge `cache: "no-store"` e conserva il resto dell'init;
 *  b. il client server (`createNodeSupabaseServicePreferred`, base di
 *     `createServerSupabaseClient`) invia OGNI richiesta PostgREST con `cache: "no-store"`,
 *     così il patch di Next non può salvarla nella Data Cache.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { withNoStoreCache } from "@/lib/supabase/no-store-fetch";

test("withNoStoreCache: aggiunge cache=no-store e conserva metodo/header/signal", async () => {
  const seen: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fake = withNoStoreCache(async (input, init) => {
    seen.push({ input, init });
    return new Response("[]", { status: 200 });
  });
  const ac = new AbortController();
  await fake("https://x.test/rest/v1/planned_workouts?date=eq.2026-08-25", {
    method: "GET",
    headers: { authorization: "Bearer svc" },
    signal: ac.signal,
  });
  assert.equal(seen.length, 1);
  assert.equal(seen[0]!.init?.cache, "no-store");
  assert.equal(seen[0]!.init?.method, "GET");
  assert.equal((seen[0]!.init?.headers as Record<string, string>).authorization, "Bearer svc");
  assert.equal(seen[0]!.init?.signal, ac.signal);
  // init assente → comunque no-store
  await fake("https://x.test/a");
  assert.equal(seen[1]!.init?.cache, "no-store");
});

test("client server Supabase: ogni GET PostgREST parte con cache=no-store", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { createNodeSupabaseServicePreferred } = await import("@/lib/supabase-node-client");

  const calls: Array<{ url: string; cache: RequestCache | undefined; method: string | undefined }> = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), cache: init?.cache, method: init?.method });
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const db = createNodeSupabaseServicePreferred();
    const { data, error } = await db
      .from("planned_workouts")
      .select("duration_minutes")
      .eq("athlete_id", "ath-1")
      .eq("date", "2026-08-25");
    assert.equal(error, null);
    assert.deepEqual(data, []);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(calls.length, 1, "una sola richiesta PostgREST attesa");
  assert.match(calls[0]!.url, /\/rest\/v1\/planned_workouts\?/);
  assert.equal(calls[0]!.method, "GET");
  assert.equal(calls[0]!.cache, "no-store");
});
