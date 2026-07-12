import type { MetadataRoute } from "next";
import { getCanonicalSiteOrigin, isSiteIndexingDisabled } from "@/lib/site-url";

/**
 * Sitemap statico: SOLO pagine pubbliche. Le rotte app (/dashboard, /health, /training, …)
 * sono autenticate e role-gated → fuori dalla sitemap (i crawler verrebbero comunque
 * rediretti; tenerle qui sarebbe solo rumore SEO). Base da `NEXT_PUBLIC_APP_URL`/`VERCEL_URL`.
 * `/preview` è noindex a livello pagina — non in sitemap.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (isSiteIndexingDisabled()) {
    return [];
  }

  const base = getCanonicalSiteOrigin();
  const now = new Date();
  const paths = ["/", "/come-funziona", "/faq", "/contatti", "/registrati", "/pricing", "/privacy", "/termini"];

  return paths.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "/" ? 1 : path === "/come-funziona" || path === "/faq" ? 0.8 : 0.6,
  }));
}
