"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ShieldCheck, X } from "lucide-react";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2Button, Pro2Link } from "@/components/ui/empathy";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";
import { coachAthleteModuleHref } from "@/lib/athlete-scope/scoped-athlete-href";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { biomarkerLabelIt, humanizePayloadKey } from "@/modules/health/lib/health-panel-readers";
import {
  applyHealthStagingPatches,
  fetchHealthStagingRunDetail,
  patchHealthStagingRun,
  type HealthStagingApplyPatch,
  type HealthStagingPanelSnapshot,
  type HealthStagingRunDetail,
} from "@/modules/health/services/health-module-api";

type EditableField = {
  field: string;
  proposedValue: number | string | null;
  value: number | string | null;
  unit: string | null;
  confidence: number;
  notes: string | null;
  rangeLow: number | null;
  rangeHigh: number | null;
  enabled: boolean;
};

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function fieldFromPatch(p: Record<string, unknown>): EditableField | null {
  const field = String(p.field ?? "").trim().toLowerCase();
  if (!field) return null;
  const proposed =
    typeof p.proposed_value === "number" && Number.isFinite(p.proposed_value)
      ? p.proposed_value
      : typeof p.proposed_value === "string" && p.proposed_value.trim()
        ? p.proposed_value.trim()
        : null;
  const unit = typeof p.unit === "string" && p.unit.trim() ? p.unit.trim() : null;
  const confidenceRaw = typeof p.confidence === "number" ? p.confidence : 0.4;
  const confidence = Math.max(0, Math.min(1, confidenceRaw));
  const notes = typeof p.notes === "string" && p.notes.trim() ? p.notes.trim() : null;
  const rrRaw =
    p.reference_range && typeof p.reference_range === "object" && !Array.isArray(p.reference_range)
      ? (p.reference_range as Record<string, unknown>)
      : {};
  return {
    field,
    proposedValue: proposed,
    value: proposed,
    unit,
    confidence,
    notes,
    rangeLow: asNumber(rrRaw.low),
    rangeHigh: asNumber(rrRaw.high),
    enabled: confidence >= 0.4,
  };
}

function confidenceBadge(confidence: number): { label: string; className: string } {
  if (confidence >= 0.8) {
    return { label: "alta", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" };
  }
  if (confidence >= 0.55) {
    return { label: "media", className: "border-amber-500/40 bg-amber-500/10 text-amber-200" };
  }
  return { label: "bassa", className: "border-rose-500/40 bg-rose-500/10 text-rose-200" };
}

function formatPanelTitle(panel: HealthStagingPanelSnapshot | null): string {
  if (!panel) return "Referto";
  const t = panel.type ?? "";
  const labels: Record<string, string> = {
    blood: "Sangue",
    microbiota: "Microbiota",
    epigenetics: "Epigenetica",
    hormones: "Ormoni",
    inflammation: "Infiammazione",
    oxidative_stress: "Stress ossidativo",
  };
  const label = labels[t] ?? t;
  return panel.sampleDate ? `${label} · ${panel.sampleDate}` : label;
}

export default function HealthStagingReviewView({ runId }: { runId: string }) {
  const { adminScoped, role, athleteId, platformAdminView } = useActiveAthlete();
  // Atleta: role "private" + adminScoped false → showTech false.
  // Coach/admin (showTech true) vedono i dettagli tecnici e i bottoni di validazione.
  const showTech = role === "coach" || adminScoped;
  // Back-link scope-aware: atleta → /health; coach → scheda atleta scoped (resta nello scope);
  // admin → inert (lo staging scoped admin è separato, l'URL è chiavato su userId).
  const backToHealthHref = !adminScoped
    ? "/health"
    : !platformAdminView && athleteId
      ? coachAthleteModuleHref(athleteId, "health")
      : null;
  const [run, setRun] = useState<HealthStagingRunDetail | null>(null);
  const [panel, setPanel] = useState<HealthStagingPanelSnapshot | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<EditableField[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "confirm" | "reject">(null);
  const [toast, setToast] = useState<string | null>(null);
  const [done, setDone] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const r = await fetchHealthStagingRunDetail(runId);
      if (cancelled) return;
      if (!r.ok || !r.run) {
        setError(r.error ?? "Review non disponibile");
        setLoading(false);
        return;
      }
      setRun(r.run);
      setPanel(r.panel);
      setSignedUrl(r.signedUrl);
      const built: EditableField[] = [];
      for (const patch of r.run.proposedPatches) {
        const f = fieldFromPatch(patch);
        if (f) built.push(f);
      }
      setFields(built);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const overallConfidence = useMemo(() => {
    if (!fields.length) return 0;
    const sum = fields.reduce((acc, f) => acc + f.confidence, 0);
    return sum / fields.length;
  }, [fields]);

  const enabledCount = useMemo(() => fields.filter((f) => f.enabled).length, [fields]);

  function updateField(idx: number, patch: Partial<EditableField>) {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  async function handleConfirm() {
    if (!run) return;
    const confirmed: HealthStagingApplyPatch[] = fields
      .filter((f) => f.enabled && f.value != null && f.value !== "")
      .map((f) => ({
        field: f.field,
        value: typeof f.value === "string" ? asNumber(f.value) ?? f.value : f.value,
        unit: f.unit,
        confidence: f.confidence,
      }));
    if (!confirmed.length) {
      setToast("Nessun campo selezionato.");
      return;
    }
    setBusy("confirm");
    setToast(null);
    const res = await applyHealthStagingPatches({
      runId: run.id,
      confirmedPatches: confirmed,
      reason: "Conferma review referto",
    });
    setBusy(null);
    if (!res.ok) {
      setToast(res.error ?? "Conferma fallita");
      return;
    }
    setDone(true);
    setToast(`${res.confirmedCount ?? confirmed.length} parametri inseriti nell'archivio.`);
  }

  async function handleReject() {
    if (!run) return;
    setBusy("reject");
    setToast(null);
    const res = await patchHealthStagingRun({
      runId: run.id,
      status: "rejected",
      reason: "Rifiutato in review",
    });
    setBusy(null);
    if (!res.ok) {
      setToast(res.error ?? "Aggiornamento staging fallito");
      return;
    }
    setDone(true);
    setToast("Review rifiutata.");
  }

  const triggerSource = run?.triggerSource ?? null;
  const candidate = run?.candidateBundle ?? null;
  const detectedProvider = candidate ? String(candidate.detected_provider ?? "") || null : null;
  const vlmProvider = candidate ? String(candidate.vlm_provider ?? "") || null : null;
  const vlmModel = candidate ? String(candidate.vlm_model ?? "") || null : null;

  return (
    <Pro2ModulePageShell
      eyebrow="Health · Review referto"
      eyebrowClassName={moduleEyebrowClass("health")}
      title={formatPanelTitle(panel)}
      description={
        <span className="flex flex-wrap items-center gap-2 text-zinc-400">
          <ShieldCheck className="inline h-4 w-4 text-emerald-400" />
          {showTech ? (
            <span>
              Conferma assistita: l&apos;AI ha proposto i valori, tu li validi e diventano archivio. Niente entra in
              archivio senza il tuo ok.
            </span>
          ) : (
            <span>
              I tuoi referti sono in revisione. Qui sotto trovi i valori letti: diventano parte del tuo archivio dopo la
              validazione del coach.
            </span>
          )}
        </span>
      }
    >
      <div className="mb-6 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
        {backToHealthHref ? (
          <Link
            href={backToHealthHref}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-200 transition hover:border-fuchsia-500/40 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Torna a Health
          </Link>
        ) : (
          // Scope admin: lo staging scoped admin non esiste ancora → link inerte
          <span
            title="Disponibile nella scheda dedicata (v2)"
            className="inline-flex cursor-default items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-200 opacity-50 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Torna a Health
          </span>
        )}
        {showTech && detectedProvider ? (
          <span className="rounded-md border border-fuchsia-500/30 bg-fuchsia-950/40 px-2.5 py-1 text-[11px] uppercase tracking-wider text-fuchsia-200">
            Lab rilevato: {detectedProvider}
          </span>
        ) : null}
        {showTech && triggerSource ? (
          <span className="rounded-md border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] uppercase tracking-wider text-zinc-400">
            Source: {triggerSource}
          </span>
        ) : null}
        {showTech ? (
          <span className="rounded-md border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] uppercase tracking-wider text-zinc-400">
            Confidence media: {(overallConfidence * 100).toFixed(0)}%
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Caricamento review…</p>
      ) : error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">{error}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pane sinistro — file originale */}
          <section className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400">Documento originale</h2>
            {signedUrl ? (
              /\.pdf(\?|$)/i.test(signedUrl) ? (
                <iframe
                  src={signedUrl}
                  className="h-[60vh] max-h-[640px] min-h-[360px] w-full rounded-md border border-white/10 bg-white sm:h-[640px]"
                  title="Documento referto"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signedUrl}
                  alt="Referto caricato"
                  className="max-h-[640px] w-full rounded-md border border-white/10 bg-black object-contain"
                />
              )
            ) : showTech ? (
              <p className="text-xs text-zinc-500">
                File non disponibile nello storage (HEALTH_UPLOADS_BUCKET non configurato o file scaduto). Puoi comunque
                confermare i valori controllando le proposte sulla destra.
              </p>
            ) : (
              <p className="text-xs text-zinc-500">
                Il documento originale non è al momento disponibile. I valori letti dal referto sono mostrati qui a fianco.
              </p>
            )}
          </section>

          {/* Pane destro — campi proposti */}
          <section className="rounded-2xl border border-fuchsia-500/30 bg-black/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-fuchsia-200">
                {showTech ? `Valori proposti · ${fields.length} campi` : `Valori letti · ${fields.length} parametri`}
              </h2>
              {showTech ? <span className="text-[11px] text-zinc-500">{enabledCount} attivi</span> : null}
            </div>

            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1 sm:max-h-[600px]">
              {fields.map((f, i) => {
                const badge = confidenceBadge(f.confidence);
                const readableLabel = biomarkerLabelIt(f.field) ?? humanizePayloadKey(f.field);
                return (
                  <div
                    key={`${f.field}-${i}`}
                    className={`rounded-xl border bg-black/40 p-3 transition ${
                      showTech && !f.enabled ? "border-zinc-800/60 opacity-60" : "border-white/10"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {showTech ? (
                        <input
                          type="checkbox"
                          checked={f.enabled}
                          onChange={(e) => updateField(i, { enabled: e.target.checked })}
                          className="mt-1 h-4 w-4 accent-fuchsia-500"
                          aria-label={`Attiva campo ${f.field}`}
                        />
                      ) : null}
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {showTech ? (
                            <>
                              <span className="font-mono text-xs text-zinc-200">{f.field}</span>
                              <span className={`rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${badge.className}`}>
                                {badge.label} · {(f.confidence * 100).toFixed(0)}%
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-zinc-200">{readableLabel}</span>
                          )}
                          {f.unit ? (
                            <span className="text-[10px] text-zinc-500">{f.unit}</span>
                          ) : null}
                          {f.rangeLow != null || f.rangeHigh != null ? (
                            <span className="text-[10px] text-zinc-500">
                              ref {f.rangeLow ?? "—"}—{f.rangeHigh ?? "—"}
                            </span>
                          ) : null}
                        </div>
                        {showTech ? (
                          <div className="mt-1.5 flex items-center gap-2">
                            <input
                              type="text"
                              value={f.value == null ? "" : String(f.value)}
                              onChange={(e) => updateField(i, { value: e.target.value })}
                              disabled={!f.enabled}
                              className="w-full rounded-md border border-white/10 bg-black/60 px-2 py-1 font-mono text-xs text-white outline-none focus:border-fuchsia-500/50"
                            />
                            {f.value !== f.proposedValue ? (
                              <button
                                type="button"
                                onClick={() => updateField(i, { value: f.proposedValue })}
                                className="text-[10px] text-fuchsia-300 hover:text-fuchsia-200"
                                title="Ripristina valore proposto"
                              >
                                ↺
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <p className="mt-1 font-mono text-sm tabular-nums text-white">
                            {f.value == null || f.value === "" ? "—" : String(f.value)}
                          </p>
                        )}
                        {showTech && f.notes ? <p className="mt-1 text-[10px] text-zinc-500">{f.notes}</p> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
              {fields.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  {showTech ? "Nessuna proposta nel run di staging." : "Nessun valore letto dal referto."}
                </p>
              ) : null}
            </div>

            {showTech ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-zinc-500">
                  Solo i campi attivi e con valore vengono scritti in archivio.
                </span>
                <div className="flex gap-2">
                  <Pro2Button
                    type="button"
                    variant="secondary"
                    className="border-rose-500/40 bg-rose-950/30 text-rose-200 hover:bg-rose-900/40"
                    disabled={busy != null || done}
                    onClick={handleReject}
                  >
                    {busy === "reject" ? (
                      "Rifiuto…"
                    ) : (
                      <>
                        <X className="mr-1.5 h-4 w-4" /> Rifiuta
                      </>
                    )}
                  </Pro2Button>
                  <Pro2Button
                    type="button"
                    className="border-emerald-500/40 bg-gradient-to-r from-emerald-600/80 to-cyan-600/80 text-white hover:brightness-110"
                    disabled={busy != null || done || enabledCount === 0}
                    onClick={handleConfirm}
                  >
                    {busy === "confirm" ? (
                      "Salvo…"
                    ) : (
                      <>
                        <Check className="mr-1.5 h-4 w-4" /> Conferma {enabledCount ? `(${enabledCount})` : ""}
                      </>
                    )}
                  </Pro2Button>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-zinc-400">
                Questi valori sono in attesa di validazione dal tuo coach prima di entrare in archivio.
              </p>
            )}

            {showTech && toast ? (
              <p
                className={`mt-3 rounded-md border px-3 py-2 text-xs ${
                  done && !toast.toLowerCase().includes("rifiut")
                    ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-200"
                    : "border-amber-500/30 bg-amber-950/30 text-amber-200"
                }`}
              >
                {toast}
              </p>
            ) : null}

            {done ? (
              <div className="mt-4 text-right">
                {backToHealthHref ? (
                  <Pro2Link href={backToHealthHref} className="text-[11px] uppercase tracking-wider text-fuchsia-200 hover:text-white">
                    → Torna all&apos;archivio Health
                  </Pro2Link>
                ) : (
                  <span
                    title="Disponibile nella scheda dedicata (v2)"
                    className="cursor-default text-[11px] uppercase tracking-wider text-fuchsia-200 opacity-50"
                  >
                    → Torna all&apos;archivio Health
                  </span>
                )}
              </div>
            ) : null}
          </section>
        </div>
      )}
    </Pro2ModulePageShell>
  );
}
