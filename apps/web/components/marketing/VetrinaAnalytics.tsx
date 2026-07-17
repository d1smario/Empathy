"use client";

import { Analytics } from "@vercel/analytics/react";

/**
 * Prefissi delle rotte "vetrina" (marketing pubblico) da tracciare. Modifica qui
 * per aggiungere/togliere pagine. La home "/" è inclusa a parte.
 */
const VETRINA_PREFIXES = ["/come-funziona", "/faq", "/contatti", "/pricing", "/privacy", "/termini"];

function isVetrinaPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return VETRINA_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Vercel Web Analytics limitato alle SOLE pagine vetrina. È montato una volta nel
 * root layout, ma `beforeSend` SCARTA ogni evento la cui URL non è una rotta vetrina
 * (app loggata sotto (shell), /admin, /access, ecc. → nessun tracking, nessun dato
 * personale). Ritornare `null` da beforeSend impedisce l'invio dell'evento.
 */
export function VetrinaAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        try {
          const pathname = new URL(event.url).pathname;
          return isVetrinaPath(pathname) ? event : null;
        } catch {
          return null;
        }
      }}
    />
  );
}
