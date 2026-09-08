"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Keyboard, Plus, Save, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Pro2Button } from "@/components/ui/empathy";
import {
  fetchHealthManualMarkerCatalog,
  submitHealthManualEntry,
  type HealthManualEntryFieldError,
  type HealthManualMarkerOption,
} from "@/modules/health/services/health-module-api";

/**
 * Inserimento manuale di un referto cartaceo/fotografato.
 *
 * È la via di recupero quando l'upload non estrae nulla (foto, PDF scansionato): la pipeline
 * legge solo i PDF testuali, e senza questa sezione il referto resta fuori dal sistema.
 *
 * Regole che questa UI si limita a **rispettare** (la verità sta nel server, in
 * `lib/health/manual-lab-entry.ts` e nella rotta `/api/health/manual-entry`):
 * - l'unità di misura è obbligatoria e si sceglie da un menù curato per marcatore (solo le
 *   scritture che si vedono davvero sui referti): la conversione nell'unità canonica avviene
 *   lato server prima di salvare;
 * - ogni marcatore ha un intervallo di plausibilità: qui lo mostriamo come suggerimento, così
 *   l'errore si vede **prima** di salvare invece di tornare indietro come messaggio rosso;
 * - quello che si salva è una **proposta** in `pending_validation`; la conferma è del coach.
 *
 * I messaggi di errore arrivano dal server già scritti (come nel resto delle API di Health) e
 * vengono mostrati tali e quali: il testo di *questa* vista invece passa da `next-intl`, come
 * ogni altra vista del modulo.
 */

/**
 * `plausibleRange` viaggia già nel JSON del catalogo (`buildManualMarkerCatalog`); il tipo
 * specchio nel service non lo dichiara ancora, quindi lo si allarga qui invece di duplicare
 * il tipo o di rinunciare al suggerimento.
 */
type MarkerOption = HealthManualMarkerOption & {
  plausibleRange?: { min: number; max: number } | null;
};

type DraftRow = {
  /** Chiave locale stabile: le righe si riordinano/eliminano senza rimontare gli input. */
  uid: string;
  markerKey: string;
  value: string;
  unit: string;
};

let rowCounter = 0;
function newRow(): DraftRow {
  rowCounter += 1;
  return { uid: `row-${rowCounter}`, markerKey: "", value: "", unit: "" };
}

export interface HealthManualEntrySectionProps {
  athleteId: string | null;
  sampleDate: string;
  onSampleDateChange: (value: string) => void;
  /**
   * Contatore: ogni incremento apre la sezione e ci porta l'utente. La pagina lo alza quando
   * l'upload non ha estratto nulla, così la via di recupero non va cercata.
   */
  openSignal?: number;
  /** Chiamata dopo il salvataggio: la pagina ricarica l'archivio e porta alla review. */
  onSubmitted: (reviewUrl: string | null) => void;
}

export function HealthManualEntrySection({
  athleteId,
  sampleDate,
  onSampleDateChange,
  openSignal = 0,
  onSubmitted,
}: HealthManualEntrySectionProps) {
  const t = useTranslations("HealthManualEntrySection");
  const [open, setOpen] = useState(false);
  const [panelType, setPanelType] = useState<string>("blood");
  const [panelTypes, setPanelTypes] = useState<string[]>(["blood"]);
  const [markers, setMarkers] = useState<MarkerOption[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [rows, setRows] = useState<DraftRow[]>([newRow()]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<HealthManualEntryFieldError[]>([]);

  /** I tipi di esame sono chiavi note: quello che non lo è si mostra com'è, non si inventa. */
  const panelLabel = useCallback(
    (type: string) => {
      const known = ["blood", "hormones", "inflammation", "oxidative_stress", "epigenetics"];
      return known.includes(type) ? t(`panelTypes.${type}`) : type;
    },
    [t],
  );

  useEffect(() => {
    if (openSignal <= 0) return;
    setOpen(true);
    if (typeof document === "undefined") return;
    document.getElementById("mod-import-manuale")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [openSignal]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const res = await fetchHealthManualMarkerCatalog();
      if (cancelled) return;
      if (!res.ok) {
        setCatalogError(res.error ?? t("catalogUnavailable"));
        return;
      }
      setCatalogError(null);
      setMarkers(res.markers as MarkerOption[]);
      if (res.panelTypes.length) {
        setPanelTypes(res.panelTypes);
        if (!res.panelTypes.includes(panelType)) setPanelType(res.panelTypes[0]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Il catalogo è statico: si carica una volta all'apertura della sezione.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const markersForPanel = useMemo(
    () => markers.filter((m) => m.panelType === panelType),
    [markers, panelType],
  );

  const markerByKey = useMemo(() => {
    const map = new Map<string, MarkerOption>();
    for (const m of markers) map.set(m.key, m);
    return map;
  }, [markers]);

  const updateRow = useCallback((uid: string, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  }, []);

  const onMarkerChange = useCallback(
    (uid: string, key: string) => {
      const marker = markerByKey.get(key);
      updateRow(uid, { markerKey: key, unit: marker?.canonicalUnit ?? "" });
    },
    [markerByKey, updateRow],
  );

  /**
   * Gli errori del server sono indicizzati sull'array **inviato**, che salta le righe vuote:
   * senza questa mappa uid→indice inviato il messaggio finirebbe sulla riga sbagliata.
   */
  const [submittedUids, setSubmittedUids] = useState<string[]>([]);

  const errorFor = useCallback(
    (uid: string): HealthManualEntryFieldError | null => {
      const sentIndex = submittedUids.indexOf(uid);
      if (sentIndex < 0) return null;
      return fieldErrors.find((e) => e.index === sentIndex) ?? null;
    },
    [fieldErrors, submittedUids],
  );

  const generalErrors = useMemo(
    () => fieldErrors.filter((e) => e.index == null),
    [fieldErrors],
  );

  const filledRows = useMemo(
    () => rows.filter((r) => r.markerKey.trim() !== "" || r.value.trim() !== ""),
    [rows],
  );

  async function handleSave() {
    if (!athleteId) return;
    setFieldErrors([]);
    setFeedback(null);
    if (!filledRows.length) {
      setFeedback(t("atLeastOneValue"));
      return;
    }
    setBusy(true);
    setSubmittedUids(filledRows.map((r) => r.uid));
    const res = await submitHealthManualEntry({
      athleteId,
      panelType,
      sampleDate,
      entries: filledRows.map((r) => ({ markerKey: r.markerKey, value: r.value, unit: r.unit })),
    });
    setBusy(false);
    if (!res.ok) {
      setFieldErrors(res.errors ?? []);
      setFeedback(res.error ?? t("submitFailed"));
      return;
    }
    setFeedback(res.message ?? t("saved"));
    setRows([newRow()]);
    setSubmittedUids([]);
    onSubmitted(res.reviewUrl ?? null);
  }

  return (
    <section
      id="mod-import-manuale"
      className="scroll-mt-20 rounded-2xl border border-white/10 bg-black/40 p-4 sm:scroll-mt-28 sm:p-6"
      aria-label={t("title")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gray-500">
            {t("paperReportLabel")}
          </p>
          <h2 className="mt-1 text-base font-bold text-white">{t("title")}</h2>
          <p className="mt-1 max-w-xl text-sm text-gray-400">{t("intro")}</p>
        </div>
        <Pro2Button
          type="button"
          variant="secondary"
          className="shrink-0"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <Keyboard className="mr-2 h-4 w-4" strokeWidth={2} />
          {open ? t("close") : t("openManualEntry")}
        </Pro2Button>
      </div>

      {open ? (
        <div className="mt-5 space-y-4">
          {catalogError ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
              {catalogError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-gray-400">
              {t("examTypeLabel")}
              <select
                className="rounded-lg border border-white/15 bg-black/60 px-2 py-1 text-xs text-white outline-none focus:border-rose-500/50"
                value={panelType}
                onChange={(e) => {
                  setPanelType(e.target.value);
                  setRows([newRow()]);
                  setFieldErrors([]);
                }}
              >
                {panelTypes.map((type) => (
                  <option key={type} value={type}>
                    {panelLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-gray-400">
              {t("sampleDateLabel")}
              <input
                type="date"
                className="rounded-lg border border-white/15 bg-black/60 px-2 py-1 font-mono tabular-nums text-xs text-white outline-none focus:border-rose-500/50"
                value={sampleDate}
                onChange={(e) => onSampleDateChange(e.target.value)}
              />
            </label>
          </div>

          <div className="space-y-2">
            {rows.map((row) => {
              const marker = markerByKey.get(row.markerKey) ?? null;
              const rowError = errorFor(row.uid);
              const units = marker?.acceptedUnits ?? [];
              const range = marker?.plausibleRange ?? null;
              return (
                <div
                  key={row.uid}
                  className={`rounded-xl border p-3 ${rowError ? "border-rose-500/40 bg-rose-950/20" : "border-white/10 bg-white/[0.02]"}`}
                >
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                    <select
                      className="w-full rounded-lg border border-white/15 bg-black/60 px-2 py-1.5 text-xs text-white outline-none focus:border-rose-500/50"
                      value={row.markerKey}
                      onChange={(e) => onMarkerChange(row.uid, e.target.value)}
                      aria-label={t("markerAria")}
                    >
                      <option value="">{t("markerPlaceholder")}</option>
                      {markersForPanel.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={t("valuePlaceholder")}
                      className="w-full rounded-lg border border-white/15 bg-black/60 px-2 py-1.5 font-mono text-xs tabular-nums text-white outline-none focus:border-rose-500/50"
                      value={row.value}
                      onChange={(e) => updateRow(row.uid, { value: e.target.value })}
                      aria-label={t("valueAria")}
                    />
                    <select
                      className="w-full rounded-lg border border-white/15 bg-black/60 px-2 py-1.5 text-xs text-white outline-none focus:border-rose-500/50 disabled:opacity-40"
                      value={row.unit}
                      disabled={!marker || units.length === 0}
                      onChange={(e) => updateRow(row.uid, { unit: e.target.value })}
                      aria-label={t("unitAria")}
                    >
                      {units.length === 0 ? (
                        <option value="">{t("noUnit")}</option>
                      ) : (
                        <>
                          <option value="">{t("unitPlaceholder")}</option>
                          {units.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    <button
                      type="button"
                      className="justify-self-start rounded-lg border border-white/10 p-1.5 text-gray-500 transition hover:border-rose-500/40 hover:text-rose-300 sm:justify-self-auto"
                      onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.uid !== row.uid) : prev))}
                      aria-label={t("removeRowAria")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {marker && range ? (
                    <p className="mt-1.5 text-[11px] text-gray-500">
                      {marker.canonicalUnit
                        ? t("expectedRange", { min: range.min, max: range.max, unit: marker.canonicalUnit })
                        : t("expectedRangeNoUnit", { min: range.min, max: range.max })}
                    </p>
                  ) : null}
                  {marker && marker.canonicalUnit && row.unit && row.unit !== marker.canonicalUnit ? (
                    <p className="mt-1.5 text-[11px] text-gray-500">
                      {t("willBeConverted", { unit: marker.canonicalUnit })}
                    </p>
                  ) : null}
                  {rowError ? <p className="mt-1.5 text-[11px] text-rose-300">{rowError.message}</p> : null}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-gray-300 transition hover:border-rose-500/40 hover:text-rose-200"
            onClick={() => setRows((prev) => [...prev, newRow()])}
          >
            <Plus className="h-3.5 w-3.5" /> {t("addValue")}
          </button>

          {generalErrors.length ? (
            <ul className="space-y-1 rounded-lg border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-[11px] text-rose-200">
              {generalErrors.map((e, i) => (
                <li key={`${e.code}-${i}`}>{e.message}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-gray-500">{t("proposalNote")}</p>
            <Pro2Button
              type="button"
              className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 text-white hover:brightness-110"
              disabled={busy || !athleteId}
              onClick={handleSave}
            >
              <Save className="mr-2 h-4 w-4" strokeWidth={2.5} />
              {busy ? t("saving") : t("save")}
            </Pro2Button>
          </div>

          {feedback ? (
            <p className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-gray-300">{feedback}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
