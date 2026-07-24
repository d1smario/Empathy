"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { Pro2Button } from "@/components/ui/empathy";

/**
 * Sezione "Gare e obiettivi" (athlete_races) — vive nella tab Routine dell'editor
 * profilo, subito sotto i "Vincoli del piano": le gare sono il terzo input del
 * generatore (goal_event_date), stessa famiglia concettuale di giorni/settimana e
 * durata massima seduta. Non è una tab a sé: la lista è piccola e una tab nuova
 * avrebbe toccato barra tab + union di sezione per niente.
 *
 * Come Questionnaires/Devices è AUTONOMA (DB-first, browser→Supabase): la policy
 * F1 `athlete_races_access_scoped` è ALL per atleta own + coach in scope, quindi
 * lettura E scrittura dirette senza API route e SENZA read-only speciale per il
 * coach (a differenza dei questionari: qui il coach pianifica le gare col suo
 * atleta, è lavoro condiviso). Il salvataggio è separato dal submit del profilo:
 * tutti i bottoni sono type="button" perché viviamo dentro la <form> dell'editor.
 *
 * Regola motore (blueprint F1, sezione A.6): la prossima gara priority='A' FUTURA
 * per race_date asc è la gara obiettivo → badge "Obiettivo del piano". Una gara
 * passata NON è un errore: resta in lista come storico (nessuna validazione di
 * data futura, di proposito).
 */

type RacePriority = "A" | "B" | "C";

type RaceRow = {
  id: string;
  name: string;
  race_date: string; // YYYY-MM-DD
  priority: RacePriority;
  sport: string | null;
  target_note: string | null;
};

type RaceDraft = {
  name: string;
  race_date: string;
  priority: RacePriority;
  sport: string;
  target_note: string;
};

const EMPTY_DRAFT: RaceDraft = { name: "", race_date: "", priority: "B", sport: "", target_note: "" };

function isRacePriority(value: string): value is RacePriority {
  return value === "A" || value === "B" || value === "C";
}

/** Oggi in ISO LOCALE (mai toISOString: alle 00:30 CET sarebbe ancora "ieri" UTC). */
function localTodayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Chip priorità: A caldo (obiettivo), B intermedio, C neutro. */
const PRIORITY_CHIP_CLASS: Record<RacePriority, string> = {
  A: "border-amber-400/50 bg-amber-400/15 text-amber-200",
  B: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  C: "border-slate-400/30 bg-slate-400/10 text-slate-300",
};

export function ProfileRacesSection({ athleteId }: { athleteId: string | null }) {
  const t = useTranslations("ProfileRacesSection");
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [races, setRaces] = useState<RaceRow[]>([]);
  // reloadKey: refetch dopo ogni mutazione — la lista riflette il DB, non uno
  // stato ottimistico che può divergere (es. coach e atleta aperti in parallelo).
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RaceDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<"missing" | "save" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState(false);

  useEffect(() => {
    if (!athleteId) {
      setRaces([]);
      setLoading(false);
      return;
    }
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      setLoadError(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    void (async () => {
      const { data, error } = await supabase
        .from("athlete_races")
        .select("id, name, race_date, priority, sport, target_note")
        .eq("athlete_id", athleteId)
        .order("race_date", { ascending: true });
      if (cancelled) return;
      if (error) {
        setLoadError(true);
        setLoading(false);
        return;
      }
      const rows: RaceRow[] = ((data ?? []) as {
        id: string;
        name: string;
        race_date: string;
        priority: string;
        sport: string | null;
        target_note: string | null;
      }[]).map((row) => ({
        id: row.id,
        name: row.name,
        race_date: row.race_date,
        priority: isRacePriority(row.priority) ? row.priority : "B",
        sport: row.sport,
        target_note: row.target_note,
      }));
      setRaces(rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId, reloadKey]);

  // Gara obiettivo = PRIMA priority='A' con data >= oggi (lista già asc per data):
  // stessa regola che proposeTrainingMacro userà per risolvere goal_event_date.
  const today = localTodayIsoDate();
  const goalRaceId = races.find((race) => race.priority === "A" && race.race_date >= today)?.id ?? null;

  function openNewForm() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFormError(null);
    setFormOpen(true);
  }

  function openEditForm(race: RaceRow) {
    setEditingId(race.id);
    setDraft({
      name: race.name,
      race_date: race.race_date,
      priority: race.priority,
      sport: race.sport ?? "",
      target_note: race.target_note ?? "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFormError(null);
  }

  async function saveRace() {
    if (!athleteId || saving) return;
    const name = draft.name.trim();
    // Solo nome+data obbligatori; NESSUN vincolo "data futura": una gara passata
    // è storico legittimo (decisione D6, il motore filtra da solo sul futuro).
    if (!name || !draft.race_date) {
      setFormError("missing");
      return;
    }
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setFormError("save");
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = {
      name,
      race_date: draft.race_date,
      priority: draft.priority,
      sport: draft.sport.trim() || null,
      target_note: draft.target_note.trim() || null,
    };
    const { error } = editingId
      ? await supabase.from("athlete_races").update(payload).eq("id", editingId)
      : await supabase.from("athlete_races").insert({ ...payload, athlete_id: athleteId });
    setSaving(false);
    if (error) {
      setFormError("save");
      return;
    }
    closeForm();
    setReloadKey((k) => k + 1);
  }

  async function deleteRace(race: RaceRow) {
    if (deletingId) return;
    // window.confirm: stesso pattern di ProfileDevicesSection (disconnessione Garmin).
    if (!window.confirm(t("confirmDelete", { name: race.name }))) return;
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) return;
    setDeletingId(race.id);
    setDeleteError(false);
    const { error } = await supabase.from("athlete_races").delete().eq("id", race.id);
    setDeletingId(null);
    if (error) {
      setDeleteError(true);
      return;
    }
    // Se stavamo editando proprio la gara eliminata, il form non ha più senso.
    if (editingId === race.id) closeForm();
    setReloadKey((k) => k + 1);
  }

  function formatRaceDate(isoDate: string): string {
    const parsed = new Date(`${isoDate}T00:00:00`); // T00 locale: niente slittamenti UTC
    if (Number.isNaN(parsed.getTime())) return isoDate;
    return parsed.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
  }

  return (
    <div className="mt-5">
      <h3 className="profile-section-band tone-amber">
        <span className="profile-kpi-dot" />
        {t("sectionTitle")}
      </h3>
      <p className="mb-3 text-xs text-gray-400">{t("sectionHint")}</p>

      {loading ? (
        <p className="muted-copy text-sm">{t("loading")}</p>
      ) : loadError ? (
        <p className="text-sm text-rose-400/90">{t("loadError")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {races.length === 0 ? (
            <p className="muted-copy text-sm">{t("noRaces")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {races.map((race) => {
                const isPast = race.race_date < today;
                return (
                  <div
                    key={race.id}
                    className={`profile-subpanel tone-amber ${isPast ? "opacity-70" : ""}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${PRIORITY_CHIP_CLASS[race.priority]}`}
                        title={t(`priority${race.priority}`)}
                      >
                        {race.priority}
                      </span>
                      <span className="text-sm font-semibold text-gray-100">{race.name}</span>
                      <span className="text-xs text-gray-400">{formatRaceDate(race.race_date)}</span>
                      {race.sport ? (
                        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-gray-300">
                          {race.sport}
                        </span>
                      ) : null}
                      {race.id === goalRaceId ? (
                        <span className="rounded-full border border-emerald-400/40 bg-emerald-400/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-200">
                          {t("planGoalBadge")}
                        </span>
                      ) : null}
                      {isPast ? (
                        <span className="text-[0.65rem] uppercase tracking-wide text-gray-500">{t("pastRace")}</span>
                      ) : null}
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-gray-300 transition hover:bg-white/10"
                          onClick={() => openEditForm(race)}
                        >
                          {t("editRace")}
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === race.id}
                          className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-xs text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                          onClick={() => void deleteRace(race)}
                        >
                          {t("deleteRace")}
                        </button>
                      </div>
                    </div>
                    {race.target_note ? <p className="mt-1.5 text-xs text-gray-400">{race.target_note}</p> : null}
                  </div>
                );
              })}
            </div>
          )}
          {deleteError ? <p className="text-sm text-rose-400/90">{t("deleteError")}</p> : null}

          {formOpen ? (
            <div className="profile-subpanel tone-amber">
              <h4 className="profile-editor-subtitle">
                <span className="profile-kpi-dot" />
                {editingId ? t("formTitleEdit") : t("formTitleNew")}
              </h4>
              <div className="profile-editor-grid profile-editor-grid-compact mt-2">
                <div className="form-group">
                  <label className="form-label">
                    {t("nameLabel")}
                    <span className="text-rose-300"> *</span>
                  </label>
                  <input
                    className="form-input"
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    {t("dateLabel")}
                    <span className="text-rose-300"> *</span>
                  </label>
                  <input
                    className="form-input"
                    type="date"
                    value={draft.race_date}
                    onChange={(e) => setDraft((d) => ({ ...d, race_date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t("priorityLabel")}</label>
                  <select
                    className="form-select profile-dark-select"
                    value={draft.priority}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (isRacePriority(value)) setDraft((d) => ({ ...d, priority: value }));
                    }}
                  >
                    <option value="A">{t("priorityA")}</option>
                    <option value="B">{t("priorityB")}</option>
                    <option value="C">{t("priorityC")}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t("sportLabel")}</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder={t("sportPlaceholder")}
                    value={draft.sport}
                    onChange={(e) => setDraft((d) => ({ ...d, sport: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-group mt-2">
                <label className="form-label">{t("targetNoteLabel")}</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder={t("targetNotePlaceholder")}
                  value={draft.target_note}
                  onChange={(e) => setDraft((d) => ({ ...d, target_note: e.target.value }))}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {/* type=button OBBLIGATORIO: siamo dentro la <form> dell'editor profilo,
                    un submit implicito farebbe partire "Aggiorna profilo". */}
                <Pro2Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  className="border border-amber-500/35 bg-amber-500/10 text-amber-50 hover:bg-amber-500/20"
                  onClick={() => void saveRace()}
                >
                  {saving ? t("saving") : t("save")}
                </Pro2Button>
                <Pro2Button
                  type="button"
                  variant="secondary"
                  className="border border-white/20 bg-white/5 hover:bg-white/10"
                  onClick={closeForm}
                >
                  {t("cancel")}
                </Pro2Button>
                {formError === "missing" ? (
                  <span className="text-sm text-rose-400/90">{t("missingFields")}</span>
                ) : null}
                {formError === "save" ? <span className="text-sm text-rose-400/90">{t("saveError")}</span> : null}
              </div>
            </div>
          ) : (
            <div>
              <Pro2Button
                type="button"
                variant="secondary"
                disabled={!athleteId}
                className="border border-amber-500/35 bg-amber-500/10 text-amber-50 hover:bg-amber-500/20"
                onClick={openNewForm}
              >
                {t("addRace")}
              </Pro2Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
