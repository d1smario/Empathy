import type { Metadata } from "next";
import { getCanonicalSiteOrigin, isSiteIndexingDisabled } from "@/lib/site-url";

/** Immagine Open Graph di default (poster dell'hero, on-brand). URL assoluto → corretto anche fuori da metadataBase. */
const OG_IMAGE = { url: `${getCanonicalSiteOrigin()}/hero/cyclist-poster.jpg`, width: 2048, height: 952, alt: "Empathy" };

/**
 * Metadata SEO condivisa per le pagine pubbliche (vetrina): title/description +
 * canonical + Open Graph + Twitter con immagine. `path` è la rotta canonica (es. "/come-funziona").
 * Rispetta NEXT_PUBLIC_SITE_INDEX=0 (preview → noindex).
 */
export function publicPageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    robots: isSiteIndexingDisabled() ? { index: false, follow: false } : { index: true, follow: true },
    alternates: { canonical: path },
    openGraph: { type: "website", url: path, siteName: "Empathy", title, description, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE.url] },
  };
}
