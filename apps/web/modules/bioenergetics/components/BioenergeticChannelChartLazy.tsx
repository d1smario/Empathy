"use client";

import dynamic from "next/dynamic";

/**
 * Carica il grafico recharts del canale solo quando serve (chunk separato, no SSR).
 * Il chiamante avvolge in un div con altezza fissa → niente layout shift mentre il
 * chunk si carica (il fallback è vuoto). Su mobile (sparkline) recharts non viene
 * scaricato finché non si apre un modale.
 */
export const BioenergeticChannelChartLazy = dynamic(
  () => import("./BioenergeticChannelChartRecharts").then((m) => m.BioenergeticChannelChartRecharts),
  { ssr: false, loading: () => null },
);
