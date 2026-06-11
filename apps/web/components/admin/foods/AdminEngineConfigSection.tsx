"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import type { EngineConfigRow } from "@/components/admin/foods/food-types";

const COPY = {
  title: "Parametri motore menù",
  description:
    "Tuning della generazione menù (nutrition_engine_config). Le modifiche hanno effetto immediato sulla prossima generazione.",
  loading: "Caricamento parametri…",
  empty: "Nessun parametro configurato.",
  value: "Valore",
  save: "Salva",
  saving: "Salvataggio…",
  saved: "Salvato ✓",
  range: (min: number | null, max: number | null) => `range ${min ?? "—"} – ${max ?? "—"}`,
  errLoad: "Impossibile caricare i parametri del motore.",
  errNetwork: "Errore di rete.",
  errNotNumeric: (key: string) => `Valore non numerico per "${key}".`,
  errSave: "Salvataggio parametro fallito.",
  clamped: (key: string) => `Valore di "${key}" riportato nei limiti consentiti (min/max).`,
} as const;

const INPUT =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm placeholder:text-gray-600 focus:border-amber-400/60 focus:outline-none";
const LABEL = "mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-500";

/**
 * Parametri del motore menù (`nutrition_engine_config`): una riga per parametro con
 * label/descrizione italiane, input numerico con min/max e salvataggio per riga
 * (il server clampa comunque su [min_value, max_value]).
 */
export function AdminEngineConfigSection() {
  const [rows, setRows] = useState<EngineConfigRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/engine-config", { cache: "no-store" });
        const j = (await res.json()) as { ok?: boolean; config?: EngineConfigRow[]; error?: string };
        if (cancelled) return;
        if (!res.ok || !j.ok) {
          setErr(j.error ?? COPY.errLoad);
          return;
        }
        const config = j.config ?? [];
        setRows(config);
        setDrafts(Object.fromEntries(config.map((r) => [r.key, String(r.value)])));
      } catch {
        if (!cancelled) setErr(COPY.errNetwork);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveRow = useCallback(async (key: string, raw: string) => {
    const value = Number(raw.replace(",", "."));
    if (!Number.isFinite(value)) {
      setErr(COPY.errNotNumeric(key));
      return;
    }
    setBusyKey(key);
    setErr(null);
    setSavedKey(null);
    try {
      const res = await fetch("/api/admin/engine-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        row?: EngineConfigRow;
        clamped?: boolean;
        error?: string;
      };
      if (!res.ok || !j.ok || !j.row) {
        setErr(j.error ?? COPY.errSave);
        return;
      }
      const row = j.row;
      setRows((prev) => prev.map((r) => (r.key === key ? row : r)));
      setDrafts((prev) => ({ ...prev, [key]: String(row.value) }));
      setSavedKey(key);
      if (j.clamped) setErr(COPY.clamped(key));
    } catch {
      setErr(COPY.errNetwork);
    } finally {
      setBusyKey(null);
    }
  }, []);

  return (
    <section aria-labelledby="engine-config-heading" className="space-y-4">
      <div>
        <h2 id="engine-config-heading" className="text-lg font-bold text-white">
          {COPY.title}
        </h2>
        <p className="mt-1 text-sm text-gray-400">{COPY.description}</p>
      </div>

      {err ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="alert">
          {err}
        </p>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
        {loading ? (
          <p className="px-4 py-8 text-center text-xs text-gray-500">{COPY.loading}</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-gray-500">{COPY.empty}</p>
        ) : (
          <ul>
            {rows.map((r) => {
              const draft = drafts[r.key] ?? String(r.value);
              const dirty = draft.trim() !== String(r.value);
              return (
                <li
                  key={r.key}
                  className="grid gap-3 border-b border-white/5 px-4 py-4 transition-colors even:bg-white/[0.015] last:border-b-0 hover:bg-white/[0.04] lg:grid-cols-[minmax(0,1fr)_10rem_auto] lg:items-end"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-white">
                      {r.label_it ?? r.key}
                      <span className="ml-2 font-mono text-xs tabular-nums text-violet-300">{r.value}</span>
                    </p>
                    {r.description_it ? <p className="mt-0.5 text-xs text-gray-400">{r.description_it}</p> : null}
                    <p className="mt-1 font-mono text-[11px] text-zinc-500">
                      {r.key}
                      {r.min_value !== null || r.max_value !== null
                        ? ` · ${COPY.range(r.min_value, r.max_value)}`
                        : ""}
                    </p>
                  </div>
                  <div>
                    <span className={LABEL}>{COPY.value}</span>
                    <input
                      type="number"
                      step="any"
                      min={r.min_value ?? undefined}
                      max={r.max_value ?? undefined}
                      value={draft}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [r.key]: e.target.value }))}
                      className={cn(INPUT, "text-right font-mono tabular-nums text-violet-300")}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busyKey === r.key || !dirty}
                    onClick={() => void saveRow(r.key, draft)}
                    className={cn(
                      "rounded-lg border px-4 py-2 text-xs font-semibold transition disabled:opacity-50",
                      dirty
                        ? "border-amber-400/60 bg-amber-500/15 text-white hover:bg-amber-500/25"
                        : "border-white/10 bg-white/5 text-gray-300",
                    )}
                  >
                    {busyKey === r.key ? COPY.saving : savedKey === r.key && !dirty ? COPY.saved : COPY.save}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
