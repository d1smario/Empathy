"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import type { AerodynamicsScenarioCompareV1 } from "@empathy/contracts";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2Button, Pro2Link, pro2ButtonClassName } from "@/components/ui/empathy";
import { scopedShellHref } from "@/lib/athlete-scope/scoped-athlete-href";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import {
  applyAerodynamicsStagingRun,
  fetchAerodynamicsStagingRunDetail,
  rejectAerodynamicsStagingRun,
} from "@/modules/aerodynamics/services/aerodynamics-module-api";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export default function AerodynamicsStagingReviewView({ runId }: { runId: string }) {
  const { adminScoped, role, athleteId, platformAdminView, scopeOwnerUserId } = useActiveAthlete();
  const showTech = role === "coach" || adminScoped;
  // Back-link al modulo: scoped in scope coach/admin, globale per l'atleta.
  const backHref = scopedShellHref("/aerodynamics", { athleteId, adminScoped, platformAdminView, scopeOwnerUserId });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "confirm" | "reject">(null);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [scenarioCompare, setScenarioCompare] = useState<AerodynamicsScenarioCompareV1 | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState("baseline");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const detail = await fetchAerodynamicsStagingRunDetail(runId);
      if (cancelled) return;
      if (!detail.ok) {
        setError(detail.error ?? "Review not available");
        setLoading(false);
        return;
      }
      setSignedUrl(detail.signedUrl ?? null);
      const compare = detail.scenarioCompare ?? null;
      setScenarioCompare(compare);
      setSelectedScenarioId(compare?.selectedScenarioId ?? "baseline");

      const patches = asRecord(detail.run?.proposed_structured_patches);
      const proposal = asRecord(patches?.aeroGeometryProposal);
      const conf = typeof proposal?.confidence01 === "number" ? Math.round(proposal.confidence01 * 100) : null;
      setSummary(
        `Surrogate model · CV confidence ${conf ?? "—"}% · provider ${String(proposal?.provider ?? "—")} · ${compare?.candidates.length ?? 0} scenarios`,
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  async function onConfirm() {
    setBusy("confirm");
    setError(null);
    const result = await applyAerodynamicsStagingRun(runId, selectedScenarioId);
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? "Confirmation failed");
      return;
    }
    setDone(true);
  }

  async function onReject() {
    setBusy("reject");
    setError(null);
    const result = await rejectAerodynamicsStagingRun(runId);
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? "Rejection failed");
      return;
    }
    setDone(true);
  }

  return (
    <Pro2ModulePageShell
      eyebrow={showTech ? "Aerodynamics · CV Review" : "Aerodynamics · Position"}
      eyebrowClassName="text-cyan-300"
      title={showTech ? "Geometry proposal validation" : "Your position is under review"}
      description={
        showTech
          ? "Choose the position scenario to promote. The deterministic engine computes CdA and score."
          : "We reconstructed a few scenarios of your riding position. They are awaiting validation from the coach."
      }
      headerActions={
        backHref ? (
          <Pro2Link href={backHref} variant="secondary" className="justify-center border border-white/15">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Aerodynamics
          </Pro2Link>
        ) : (
          // Fallback inerte: solo se l'href scoped non è ricostruibile (scope coach senza
          // athleteId / admin senza scopeOwnerUserId). Via le rotte scoped non accade.
          <span
            className={pro2ButtonClassName("secondary", "justify-center border border-white/15 cursor-default opacity-50")}
            title="Available in the dedicated tab (v2)"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Aerodynamics
          </span>
        )
      }
    >
      {loading ? <p className="text-sm text-gray-400">Loading review...</p> : null}
      {showTech ? (
        summary ? (
          <p className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">{summary}</p>
        ) : null
      ) : !loading ? (
        <p className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          Your data is under review. The scenarios of your position are awaiting validation from the coach.
        </p>
      ) : null}
      {scenarioCompare?.candidates.length ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm text-gray-200">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Scenario</th>
                <th className="px-3 py-2">CdA m²</th>
                <th className="px-3 py-2">
                  {showTech ? `ΔW @ ${scenarioCompare.referenceSpeedKph} km/h` : `Watt savings @ ${scenarioCompare.referenceSpeedKph} km/h`}
                </th>
                {showTech ? <th className="px-3 py-2">Select</th> : null}
              </tr>
            </thead>
            <tbody>
              {scenarioCompare.candidates.map((row) => (
                <tr key={row.id} className="border-b border-white/5">
                  <td className="px-3 py-2">{row.label}</td>
                  <td className="px-3 py-2">{row.cdaM2.toFixed(3)}</td>
                  <td className="px-3 py-2">{row.wattSavingsVsBaseline.toFixed(1)} W</td>
                  {showTech ? (
                    <td className="px-3 py-2">
                      <input
                        type="radio"
                        name="scenario"
                        checked={selectedScenarioId === row.id}
                        onChange={() => setSelectedScenarioId(row.id)}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {signedUrl ? (
        <p className="mt-3 text-xs text-gray-400">
          Media:{" "}
          <Link href={signedUrl} target="_blank" className="text-cyan-200 underline">
            open capture
          </Link>
        </p>
      ) : null}
      {error ? <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
      {showTech ? (
        done ? (
          <p className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            Review closed. Go back to the module to see updated tests and twin.
          </p>
        ) : (
          <div className="mt-6 flex flex-wrap gap-3">
            <Pro2Button onClick={onConfirm} disabled={busy != null || loading} className="justify-center">
              <Check className="mr-2 h-4 w-4" />
              {busy === "confirm" ? "Confirming..." : "Confirm scenario"}
            </Pro2Button>
            <Pro2Button variant="secondary" onClick={onReject} disabled={busy != null || loading} className="justify-center">
              <X className="mr-2 h-4 w-4" />
              {busy === "reject" ? "Rejecting..." : "Reject"}
            </Pro2Button>
          </div>
        )
      ) : (
        <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-300">
          When the coach validates the position, the test becomes final and you&apos;ll find the CdA in the Aerodynamics module.
        </p>
      )}
    </Pro2ModulePageShell>
  );
}
