import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLIC_SITE_ORIGIN_FALLBACK,
  cronSelfCallOrigin,
  isVercelDeploymentOrigin,
} from "@/lib/cron-self-call-origin";

/**
 * L'INVARIANTE che vale la pena difendere con un test: un cron che chiama sé stesso non
 * deve MAI finire su un URL `*.vercel.app`. Il progetto ha la protezione SSO con
 * `all_except_custom_domains`: quegli URL rispondono 302 verso il login, la richiesta non
 * raggiunge l'applicazione e il job muore prima di iniziare — senza errori visibili,
 * perché il dispatcher non traccia l'esito dei figli (misurato 25 ago 2026: due settimane
 * di cron notturni a vuoto, zero piani generati, nessun allarme).
 */

const ENV_KEYS = ["NEXT_PUBLIC_APP_URL", "VERCEL_URL"] as const;

function withEnv(vars: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>, fn: () => void) {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  try {
    for (const k of ENV_KEYS) {
      const v = vars[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fn();
  } finally {
    for (const k of ENV_KEYS) {
      const v = saved[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("cron self-call: senza configurazione usa il dominio pubblico, MAI l'URL del deployment", () => {
  // Il caso vero in produzione oggi: NEXT_PUBLIC_APP_URL non impostata, VERCEL_URL sì.
  withEnv({ NEXT_PUBLIC_APP_URL: undefined, VERCEL_URL: "empathy-ng8kbnhlc-empathy-s-projects1.vercel.app" }, () => {
    const origin = cronSelfCallOrigin();
    assert.equal(origin, PUBLIC_SITE_ORIGIN_FALLBACK);
    assert.equal(isVercelDeploymentOrigin(origin), false, "il ripiego non deve essere un URL di deployment");
  });
  // Anche senza nessuna variabile: il dominio pubblico, non localhost (siamo in un cron).
  withEnv({ NEXT_PUBLIC_APP_URL: undefined, VERCEL_URL: undefined }, () => {
    assert.equal(cronSelfCallOrigin(), PUBLIC_SITE_ORIGIN_FALLBACK);
  });
});

test("cron self-call: la variabile esplicita vince ed è normalizzata (protocollo, slash finale)", () => {
  withEnv({ NEXT_PUBLIC_APP_URL: "https://staging.example.com/" }, () => {
    assert.equal(cronSelfCallOrigin(), "https://staging.example.com");
  });
  withEnv({ NEXT_PUBLIC_APP_URL: "staging.example.com" }, () => {
    assert.equal(cronSelfCallOrigin(), "https://staging.example.com", "senza protocollo si assume https");
  });
  withEnv({ NEXT_PUBLIC_APP_URL: "  https://a.b.com  " }, () => {
    assert.equal(cronSelfCallOrigin(), "https://a.b.com");
  });
});

test("riconoscimento degli origin di deployment (quelli protetti da SSO)", () => {
  assert.equal(isVercelDeploymentOrigin("https://empathy-ng8kbnhlc-empathy-s-projects1.vercel.app"), true);
  assert.equal(isVercelDeploymentOrigin("https://empathy-web-git-main-empathy-s-projects1.vercel.app"), true);
  assert.equal(isVercelDeploymentOrigin("https://d1s-empathy.com"), false);
  assert.equal(isVercelDeploymentOrigin("http://localhost:3000"), false);
});
