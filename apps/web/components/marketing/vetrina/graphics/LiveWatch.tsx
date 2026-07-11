"use client";

import { Smartwatch } from "@/components/marketing/WatchLabSection";
import { useLiveMetrics } from "./useLiveMetrics";

/**
 * Orologio con metriche live realistiche (battito/velocità/potenza/cadenza che
 * saltano come dati veri). Riusa lo Smartwatch della sezione "orologio-laboratorio".
 */
export function LiveWatch() {
  const metrics = useLiveMetrics();
  return (
    <div className="flex justify-center">
      <Smartwatch metrics={metrics} />
    </div>
  );
}
