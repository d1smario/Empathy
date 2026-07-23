"use client";

import { useMemo } from "react";
import type { PlannedWorkout } from "@empathy/domain-training";
import { SessionBlockIntensityChart } from "@/components/training/SessionBlockIntensityChart";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import {
  parsePro2BuilderSessionFromNotes,
  pro2BuilderContractToChartSegments,
} from "@/lib/training/builder/pro2-session-notes";

/**
 * Anteprima compatta di una seduta PIANIFICATA dentro la riga del calendario
 * (specchio di `SessionRowPreview` per le eseguite): parse del contratto builder
 * dalle `notes` → segmenti espansi → grafico blocchi/intensità compatto.
 * Niente per strength (la scheda palestra vive nel dettaglio) o senza contratto.
 * SVG/DIV non interattivi: sicuro dentro il <Link> della riga.
 */
export function PlannedRowPreview({ workout }: { workout: PlannedWorkout }) {
  const contract = useMemo(
    () => parsePro2BuilderSessionFromNotes(workout.notes ?? null) as unknown as Pro2BuilderSessionContract | null,
    [workout.notes],
  );
  const segments = useMemo(
    () => (contract ? pro2BuilderContractToChartSegments(contract) : []),
    [contract],
  );

  if (!contract || contract.family === "strength" || segments.length === 0) return null;

  return (
    <div className="mt-2 border-t border-white/[0.06] pt-2">
      <SessionBlockIntensityChart segments={segments} compact />
    </div>
  );
}
