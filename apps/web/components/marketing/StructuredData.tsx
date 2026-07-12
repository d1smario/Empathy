import { getCanonicalSiteOrigin } from "@/lib/site-url";

/**
 * JSON-LD per la home: Organization + WebSite + SoftwareApplication.
 * Aiuta i motori a capire il brand e il prodotto (rich results). Server component.
 */
export function StructuredData() {
  const origin = getCanonicalSiteOrigin();
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: "Empathy",
        url: origin,
        logo: `${origin}/brand/empathy-wordmark-white.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        url: origin,
        name: "Empathy",
        publisher: { "@id": `${origin}/#organization` },
        inLanguage: "it",
      },
      {
        "@type": "SoftwareApplication",
        name: "Empathy",
        applicationCategory: "HealthApplication",
        operatingSystem: "Web, iOS, Android",
        url: origin,
        description:
          "Piattaforma di performance e adattamento fisiologico: allenamento, nutrizione e recupero che si adattano a come stai, giorno per giorno.",
        offers: { "@type": "Offer", category: "subscription" },
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
