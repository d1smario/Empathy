import { ImageResponse } from "next/og";
import { EMPATHY_WORDMARK_DATA_URI } from "@/lib/og-logo";

export const runtime = "edge";

/**
 * OG image brandizzata 1200×630 (logo Empathy + claim su sfondo scuro), generata dal sito.
 * URL stabile /og → referenziata da metadata openGraph/twitter (lib/seo.ts, app/layout.tsx).
 */
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0f",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: 8,
            backgroundImage: "linear-gradient(90deg,#22d3ee,#a78bfa,#f472b6)",
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={EMPATHY_WORDMARK_DATA_URI} width={620} height={160} alt="Empathy" />
        <div style={{ marginTop: 40, fontSize: 42, color: "#e5e7eb" }}>Trasforma i dati in performance</div>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: 8,
            backgroundImage: "linear-gradient(90deg,#f472b6,#a78bfa,#22d3ee)",
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "cache-control": "public, max-age=86400, s-maxage=86400, immutable" },
    },
  );
}
