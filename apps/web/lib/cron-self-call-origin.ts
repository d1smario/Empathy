/**
 * Origine da usare quando un cron chiama UN'ALTRA rotta della stessa app.
 *
 * Non è un doppione di `getCanonicalSiteOrigin()` (lib/site-url.ts): quella serve a
 * metadata, sitemap e Open Graph e ripiega su `VERCEL_URL`, che è l'URL del DEPLOYMENT
 * (`*.vercel.app`). Per una chiamata interna quel ripiego è veleno, ed è il motivo per cui
 * i job notturni non hanno lavorato per due settimane senza che nessuno se ne accorgesse:
 *
 *   il progetto ha la protezione SSO di Vercel attiva con `all_except_custom_domains`;
 *   gli URL `*.vercel.app` rispondono 302 verso il login e la richiesta NON raggiunge mai
 *   l'applicazione, mentre il dominio custom risponde normalmente (401 applicativo senza
 *   bearer, 200 con). Misurato il 25 ago 2026 sul deployment di produzione.
 *
 * Il dispatcher usava `req.nextUrl.origin`, cioè l'host su cui Vercel invoca il cron: le
 * fetch figlie finivano sul redirect e ogni job moriva prima di iniziare. Il sintomo era
 * invisibile perché il dispatcher raccoglie `res.ok` e non lo scrive da nessuna parte, e
 * l'unico pezzo che lasciava traccia (gli alert «sonno mancante») sta DOPO i job e girava
 * regolarmente: dall'esterno sembrava che il cron funzionasse.
 *
 * Ordine: variabile esplicita, poi il dominio pubblico noto. `VERCEL_URL` non compare per
 * costruzione — se un domani il dominio cambiasse, la variabile `NEXT_PUBLIC_APP_URL` è la
 * leva per correggerlo senza deploy (stesso pattern già usato dal cron delle email di
 * onboarding, che infatti ha sempre funzionato).
 */
export const PUBLIC_SITE_ORIGIN_FALLBACK = "https://d1s-empathy.com";

export function cronSelfCallOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    const withProtocol = /^https?:\/\//.test(explicit) ? explicit : `https://${explicit}`;
    return withProtocol.replace(/\/+$/, "");
  }
  return PUBLIC_SITE_ORIGIN_FALLBACK;
}

/** true se l'origine è un URL di deployment Vercel, cioè protetto da SSO: mai per le chiamate interne. */
export function isVercelDeploymentOrigin(origin: string): boolean {
  return /\.vercel\.app$/i.test(new URL(origin).hostname);
}
