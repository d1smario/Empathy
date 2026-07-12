import type { MetadataRoute } from "next";
import { getCanonicalSiteOrigin, isSiteIndexingDisabled } from "@/lib/site-url";

/** Produzione: allow `/`. Preview: `NEXT_PUBLIC_SITE_INDEX=0` → disallow tutto. */
export default function robots(): MetadataRoute.Robots {
  const host = getCanonicalSiteOrigin();

  if (isSiteIndexingDisabled()) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Aree app/admin/api e flussi privati: fuori dall'indice (i crawler verrebbero comunque rediretti).
      disallow: [
        "/api/",
        "/admin",
        "/m/",
        "/access",
        "/auth/",
        "/invite/",
        "/coach-invite/",
        "/preview",
        "/onboarding",
        "/dashboard",
        "/today",
        "/calendario",
        "/training",
        "/nutrition",
        "/health",
        "/physiology",
        "/bioenergetics",
        "/biomechanics",
        "/aerodynamics",
        "/longevity",
        "/analysis",
        "/athletes",
        "/commissioni",
        "/profile",
        "/settings",
      ],
    },
    sitemap: `${host}/sitemap.xml`,
  };
}
