/**
 * PRO2 — **Inserimento manuale di un referto** (logica pura).
 *
 * Perché esiste: la pipeline `health-document-pipeline` estrae valori solo dai PDF **testuali**.
 * Una foto del referto o un PDF scansionato finiscono in `needs_manual_review` con `parsed = {}`,
 * senza staging run e senza nessuna via per recuperare il dato (audit Health 2026-09: 4 upload
 * reali su 4 finiti così). Questo modulo è quella via: l'atleta digita i valori che ha sul foglio.
 *
 * **L'unità non è decorativa.** `health-observation-normalizer` scrive in `lab_observations.unit`
 * l'unità *canonica* del marcatore (`HealthMarkerDefinition.unit`) **qualunque** sia il numero che
 * riceve: se entra «156» perché il referto diceva `156 g/L`, il sistema lo archivia come
 * `156 g/dL` e le soglie cliniche (scritte in g/dL) non scattano più. Qui la conversione avviene
 * **prima** della scrittura: chi inserisce sceglie l'unità che ha sul referto e il valore che
 * esce è già nell'unità canonica, così l'assunzione del normalizzatore diventa vera.
 *
 * **Convertibile non vuol dire sensato.** La prima stesura offriva come unità *tutto ciò che
 * l'algebra sapeva convertire*: all'emoglobina proponeva 16 voci, fra cui `mg/dL` (15.6 → 0.0156)
 * e `pg/dL` (15.6 → 0). Numeri finti che passavano ogni controllo e arrivavano al coach come
 * valore proposto. Da qui le due regole di questo file:
 *   1. il menù per marcatore è **curato** (`MARKER_UNIT_MENU`): solo le scritture che si vedono
 *      davvero sui referti, tipicamente 1-3 — e il server accetta SOLO quelle;
 *   2. ogni marcatore ha un **intervallo di plausibilità** (`MARKER_PLAUSIBLE_RANGE`), largo,
 *      nell'unità canonica. Non serve a fare diagnosi: serve a fermare un ematocrito di 4500 %
 *      (45 dichiarato in `L/L`) prima che diventi un dato clinico.
 * Il principio dietro entrambe: **un numero plausibile ma falso è peggio di un numero assente**.
 *
 * File **puro** di proposito (niente `server-only`, niente Supabase, niente React): è testabile
 * con `node:test` ed è la sola definizione di «cosa è un inserimento manuale valido», condivisa
 * fra la rotta `app/api/health/manual-entry` e la UI.
 *
 * Il vocabolario dei marcatori NON è ridefinito qui: arriva da fuori (`HEALTH_MARKERS` in
 * `lib/health/health-ontology`, la stessa lista che vive anche in `health_marker_dictionary`),
 * così non nasce una seconda ontologia. Questo file aggiunge a quelle chiavi solo ciò che
 * l'ontologia non dice: quali unità si vedono sul foglio e dentro quale intervallo un numero
 * è ancora un numero di laboratorio.
 */

/** Forma minima di un marcatore: `HEALTH_MARKERS` la soddisfa. */
export type ManualMarkerSource = {
  key: string;
  panelType: string;
  label: string;
  unit?: string;
};

/** Intervallo di PLAUSIBILITÀ (non di riferimento clinico), nell'unità canonica. */
export type ManualPlausibleRange = { min: number; max: number };

export type ManualMarkerOption = {
  key: string;
  panelType: string;
  label: string;
  /** Unità in cui il dato viene archiviato (quella che il normalizzatore assume). */
  canonicalUnit: string | null;
  /**
   * Unità che l'utente può scegliere, canonica per prima — e **le sole** che il server
   * accetta. Vuoto quando il marcatore è adimensionale: in quel caso l'unità **non** va indicata.
   */
  acceptedUnits: string[];
  /**
   * Confine di plausibilità nell'unità canonica, `null` quando il marcatore è un punteggio di
   * scala ignota (là resta solo il tetto anti-refuso `MAX_ABS_LAB_VALUE`).
   */
  plausibleRange: ManualPlausibleRange | null;
};

export type ManualLabEntryInput = {
  markerKey: string;
  /** Come arriva dal form: stringa (virgola decimale ammessa) o numero. */
  value: string | number | null | undefined;
  unit?: string | null;
};

export type ManualLabEntryErrorCode =
  | "no_entries"
  | "too_many_entries"
  | "unknown_marker"
  | "marker_panel_mismatch"
  | "duplicate_marker"
  | "unit_required"
  | "unit_not_expected"
  | "unit_not_accepted"
  | "unit_not_convertible"
  | "invalid_value"
  | "ambiguous_number_format"
  | "negative_value"
  | "value_out_of_plausible_range"
  | "value_out_of_scale"
  | "invalid_sample_date"
  | "future_sample_date";

export type ManualLabEntryError = {
  code: ManualLabEntryErrorCode;
  /** Campo del form a cui appartiene l'errore: serve alla UI per evidenziarlo. */
  field: "marker" | "unit" | "value" | "sampleDate" | "entries";
  /** Messaggio già in italiano: la rotta lo rimanda tale e quale, la UI lo mostra. */
  message: string;
  /** Indice nella lista di inserimenti (solo nel batch). */
  index?: number;
  markerKey?: string;
};

export type ValidatedManualLabEntry = {
  markerKey: string;
  label: string;
  panelType: string;
  /**
   * La stringa **così com'è stata digitata** (ripulita solo degli spazi ai bordi). È quella che
   * finisce nella nota di audit: senza, il coach vede solo il numero già interpretato e non ha
   * modo di accorgersi di una lettura sbagliata della scrittura.
   */
  enteredText: string;
  /** Il numero che quella stringa vuol dire, nell'unità scelta da chi scrive. */
  enteredValue: number;
  enteredUnit: string | null;
  /** Quello che finisce nel sistema: già nell'unità canonica del marcatore. */
  canonicalValue: number;
  canonicalUnit: string | null;
  converted: boolean;
};

/** Un referto a mano non è un import massivo: il tetto tiene onesta la rotta. */
export const MANUAL_ENTRY_MAX_ENTRIES = 40;

/**
 * Ultima rete, per i marcatori a cui non sappiamo dare un intervallo (punteggi di scala ignota):
 * oltre questa soglia non è un valore di laboratorio ma un errore di battitura.
 */
const MAX_ABS_LAB_VALUE = 1e7;

/* ------------------------------------------------------------------ */
/* Algebra delle unità                                                  */
/* ------------------------------------------------------------------ */

/**
 * Tabelle come `Map` e non come oggetti: `"constructor" in {}` è `true`, e un lookup su un
 * oggetto letterale restituiva la funzione della catena dei prototipi al posto di un fattore
 * (`convertLabValueToCanonicalUnit({ markerKey: "constructor", … })` lanciava un TypeError, e
 * `fromUnit: "constructor"` produceva NaN). Le `Map` non hanno catena: una chiave che non è
 * stata scritta qui semplicemente non c'è.
 */
const MASS_G = new Map<string, number>([
  ["kg", 1e3],
  ["g", 1],
  ["dg", 1e-1],
  ["cg", 1e-2],
  ["mg", 1e-3],
  ["ug", 1e-6],
  ["ng", 1e-9],
  ["pg", 1e-12],
  ["fg", 1e-15],
]);

const SUBSTANCE_MOL = new Map<string, number>([
  ["mol", 1],
  ["mmol", 1e-3],
  ["umol", 1e-6],
  ["nmol", 1e-9],
  ["pmol", 1e-12],
  ["fmol", 1e-15],
]);

const VOLUME_L = new Map<string, number>([
  ["l", 1],
  ["dm^3", 1],
  ["dl", 1e-1],
  ["cl", 1e-2],
  ["ml", 1e-3],
  ["cm^3", 1e-3],
  ["ul", 1e-6],
  ["mm^3", 1e-6],
  ["nl", 1e-9],
  ["pl", 1e-12],
  ["fl", 1e-15],
  ["um^3", 1e-15],
]);

const ACTIVITY_IU = new Map<string, number>([
  ["iu", 1],
  ["u", 1],
  ["kiu", 1e3],
  ["ku", 1e3],
  ["miu", 1e-3],
  ["mu", 1e-3],
  ["uiu", 1e-6],
  ["uu", 1e-6],
]);

type ScalarKind = "count" | "mass" | "substance" | "volume" | "activity";
type Scalar = { kind: ScalarKind; factor: number };

type UnitDimension =
  | "count_per_volume"
  | "mass_per_volume"
  | "substance_per_volume"
  | "activity_per_volume"
  | "fraction"
  | "molar_ratio"
  | "count"
  | "mass"
  | "substance"
  | "volume"
  | "activity";

type UnitSpec = { dimension: UnitDimension; factor: number };

/**
 * Riduce a un token confrontabile: micro in ogni sua grafia, apici, spazi, maiuscole,
 * `10E3`/`10*3`/`x10^3`, `mcg`, `/cmm` dei referti italiani.
 */
export function normalizeUnitToken(raw: string | null | undefined): string {
  if (raw == null) return "";
  let s = String(raw).trim().toLowerCase();
  if (!s) return "";
  s = s
    .replace(/[µμ]/g, "u")
    .replace(/¹²/g, "^12")
    .replace(/³/g, "^3")
    .replace(/⁶/g, "^6")
    .replace(/⁹/g, "^9")
    .replace(/×/g, "x")
    .replace(/\s+/g, "");
  s = s.replace(/^x/, "");
  s = s.replace(/10e(\d+)/g, "10^$1").replace(/10\*(\d+)/g, "10^$1");
  s = s.replace(/mcmol/g, "umol").replace(/mcg/g, "ug");
  s = s.replace(/cmm/g, "mm^3");
  if (s === "cc") s = "cm^3";
  s = s.replace(/mm3/g, "mm^3").replace(/cm3/g, "cm^3").replace(/um3/g, "um^3").replace(/dm3/g, "dm^3");
  if (s === "percent" || s === "perc" || s === "pct") s = "%";
  return s;
}

function resolveScalar(token: string): Scalar | null {
  if (token === "") return { kind: "count", factor: 1 };
  const power = /^10\^(-?\d+)$/.exec(token);
  if (power) return { kind: "count", factor: Math.pow(10, Number(power[1])) };
  if (token === "k") return { kind: "count", factor: 1e3 };
  const mass = MASS_G.get(token);
  if (mass != null) return { kind: "mass", factor: mass };
  const substance = SUBSTANCE_MOL.get(token);
  if (substance != null) return { kind: "substance", factor: substance };
  const volume = VOLUME_L.get(token);
  if (volume != null) return { kind: "volume", factor: volume };
  const activity = ACTIVITY_IU.get(token);
  if (activity != null) return { kind: "activity", factor: activity };
  return null;
}

/** `null` quando il token non è riconosciuto: in quel caso resta possibile solo l'identità. */
function parseUnitSpec(token: string): UnitSpec | null {
  if (token === "%") return { dimension: "fraction", factor: 0.01 };
  const parts = token.split("/");
  if (parts.length > 2) return null;
  if (parts.length === 1) {
    const scalar = resolveScalar(parts[0]);
    if (!scalar || parts[0] === "") return null;
    return { dimension: scalar.kind, factor: scalar.factor };
  }
  const num = resolveScalar(parts[0]);
  const den = resolveScalar(parts[1]);
  if (!num || !den) return null;
  // Rapporti fra grandezze omogenee PRIMA del per-volume: `L/L` è una frazione, non un
  // «volume per volume». `mmol/mol` resta una dimensione a sé, così non si converte da sola
  // in `%` (per HbA1c la relazione è affine, vive in SPECIAL_MARKER_CONVERSIONS).
  if (num.kind === den.kind) {
    if (num.kind === "substance") {
      return { dimension: "molar_ratio", factor: num.factor / den.factor };
    }
    return { dimension: "fraction", factor: num.factor / den.factor };
  }
  if (den.kind === "volume") {
    switch (num.kind) {
      case "count":
        return { dimension: "count_per_volume", factor: num.factor / den.factor };
      case "mass":
        return { dimension: "mass_per_volume", factor: num.factor / den.factor };
      case "substance":
        return { dimension: "substance_per_volume", factor: num.factor / den.factor };
      case "activity":
        return { dimension: "activity_per_volume", factor: num.factor / den.factor };
      default:
        return null;
    }
  }
  return null;
}

/**
 * Masse molari usate SOLO per fare da ponte fra unità di massa e unità molari.
 *
 * Sono i marcatori per cui i referti europei usano davvero le molari. Chi manca resta senza
 * ponte di proposito: meglio rifiutare un'unità che convertirla con una massa molare inventata
 * (es. `dhea` in ug/dL è quasi sempre DHEA-S, massa diversa: nessun ponte).
 */
const MARKER_MOLAR_MASS_G_PER_MOL = new Map<string, number>([
  ["glicemia", 180.156],
  /**
   * Monomero eme, non il tetramero: è la base del fattore clinico 0.6206 usato dai referti
   * che riportano l'emoglobina in mmol/L (15.6 g/dL ≈ 9.68 mmol/L).
   */
  ["emoglobina", 16114.5],
  ["vit_d", 400.64],
  ["b12", 1355.37],
  ["cortisol_am", 362.46],
  ["cortisol_pm", 362.46],
  ["testosterone", 288.42],
  ["free_testosterone", 288.42],
  ["estradiol", 272.38],
  ["progesterone", 314.46],
  ["homocysteine", 135.16],
  ["t3", 650.98],
  ["t4", 776.87],
  ["igf1", 7649],
]);

/**
 * Conversioni **affini** (non un semplice fattore): stanno fuori dall'algebra generica.
 * HbA1c NGSP (%) ↔ IFCC (mmol/mol) è l'unico caso reale.
 */
const SPECIAL_MARKER_CONVERSIONS = new Map<string, Array<{ from: string; to: string; convert: (v: number) => number }>>([
  [
    "hba1c",
    [
      { from: "mmol/mol", to: "%", convert: (v) => v / 10.929 + 2.15 },
      { from: "%", to: "mmol/mol", convert: (v) => (v - 2.15) * 10.929 },
    ],
  ],
]);

/** Toglie il rumore in coda del floating point senza inventare precisione. */
function roundLabValue(value: number): number {
  const rounded = Math.round(value * 1e6) / 1e6;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export type LabUnitConversionResult =
  | { ok: true; value: number; converted: boolean }
  | { ok: false; reason: "unparsable_unit" | "incompatible_units" | "non_finite_result" };

/**
 * Converte un valore verso l'unità canonica del marcatore. Non indovina mai: se le due unità
 * non sono riconducibili l'una all'altra (con la massa molare quando serve), fallisce.
 */
export function convertLabValueToCanonicalUnit(input: {
  markerKey: string;
  value: number;
  fromUnit: string | null | undefined;
  toUnit: string | null | undefined;
}): LabUnitConversionResult {
  if (!Number.isFinite(input.value)) return { ok: false, reason: "non_finite_result" };
  const markerKey = String(input.markerKey ?? "");
  const from = normalizeUnitToken(input.fromUnit);
  const to = normalizeUnitToken(input.toUnit);
  if (from === to) return { ok: true, value: roundLabValue(input.value), converted: false };

  const specials = SPECIAL_MARKER_CONVERSIONS.get(markerKey) ?? [];
  for (const rule of specials) {
    if (normalizeUnitToken(rule.from) === from && normalizeUnitToken(rule.to) === to) {
      return finiteConversion(rule.convert(input.value), true);
    }
  }

  const fromSpec = parseUnitSpec(from);
  const toSpec = parseUnitSpec(to);
  if (!fromSpec || !toSpec) return { ok: false, reason: "unparsable_unit" };

  if (fromSpec.dimension === toSpec.dimension) {
    return finiteConversion((input.value * fromSpec.factor) / toSpec.factor, true);
  }

  const molarMass = MARKER_MOLAR_MASS_G_PER_MOL.get(markerKey);
  if (molarMass != null && molarMass > 0) {
    if (fromSpec.dimension === "substance_per_volume" && toSpec.dimension === "mass_per_volume") {
      const molPerL = input.value * fromSpec.factor;
      return finiteConversion((molPerL * molarMass) / toSpec.factor, true);
    }
    if (fromSpec.dimension === "mass_per_volume" && toSpec.dimension === "substance_per_volume") {
      const gPerL = input.value * fromSpec.factor;
      return finiteConversion(gPerL / molarMass / toSpec.factor, true);
    }
  }
  return { ok: false, reason: "incompatible_units" };
}

/** Un NaN/Infinity non esce mai da qui come «valore»: diventa un fallimento esplicito. */
function finiteConversion(value: number, converted: boolean): LabUnitConversionResult {
  const rounded = roundLabValue(value);
  if (!Number.isFinite(rounded)) return { ok: false, reason: "non_finite_result" };
  return { ok: true, value: rounded, converted };
}

/* ------------------------------------------------------------------ */
/* Cosa si legge davvero su un referto                                  */
/* ------------------------------------------------------------------ */

/**
 * **Menù curato per marcatore**: le unità con cui quel marcatore compare sui referti (canonica
 * per prima), non tutte quelle matematicamente convertibili. Sono anche le SOLE che il server
 * accetta: una scrittura fuori da qui è rifiutata nominando l'unità, non il valore.
 *
 * La chiave è quella di `HEALTH_MARKERS` / `health_marker_dictionary`: nessun marcatore nuovo
 * nasce qui. Se un marcatore con unità canonica non compare in questa tabella il test
 * «ogni marcatore … ha una lista curata» diventa rosso — meglio un test rotto che un menù
 * silenziosamente ridotto alla sola unità canonica.
 */
const MARKER_UNIT_MENU = new Map<string, readonly string[]>([
  // — emocromo e chimica clinica ————————————————————————————————
  ["hba1c", ["%", "mmol/mol"]],
  ["emoglobina", ["g/dL", "g/L", "mmol/L"]],
  ["rbc", ["10^6/uL", "10^12/L", "/uL", "/mm^3"]],
  ["wbc", ["10^3/uL", "10^9/L", "/uL", "/mm^3"]],
  ["hct", ["%", "L/L"]],
  ["mcv", ["fL", "um^3"]],
  ["mch", ["pg"]],
  ["mchc", ["g/dL", "g/L"]],
  ["plt", ["10^3/uL", "10^9/L", "/uL", "/mm^3"]],
  ["rdw", ["%"]],
  ["ferritina", ["ng/mL", "ug/L"]],
  ["vit_d", ["ng/mL", "nmol/L", "ug/L"]],
  ["b12", ["pg/mL", "ng/L", "pmol/L"]],
  ["glicemia", ["mg/dL", "mmol/L", "g/L"]],
  // — ormoni ————————————————————————————————————————————————
  ["cortisol_am", ["ug/dL", "nmol/L", "ng/mL"]],
  ["cortisol_pm", ["ug/dL", "nmol/L", "ng/mL"]],
  ["testosterone", ["ng/dL", "ng/mL", "nmol/L"]],
  ["free_testosterone", ["pg/mL", "pmol/L", "ng/dL"]],
  ["estradiol", ["pg/mL", "pmol/L", "ng/L"]],
  ["progesterone", ["ng/mL", "nmol/L", "ug/L"]],
  ["lh", ["mIU/mL", "IU/L"]],
  ["fsh", ["mIU/mL", "IU/L"]],
  ["tsh", ["uIU/mL", "mIU/L"]],
  ["t3", ["pg/mL", "pmol/L", "ng/L"]],
  ["t4", ["ng/dL", "pmol/L", "ng/L"]],
  /** DHEA/DHEA-S: nessun ponte molare (masse diverse), solo scritture di massa su volume. */
  ["dhea", ["ug/dL", "ng/mL", "ug/L"]],
  ["igf1", ["ng/mL", "ug/L", "nmol/L"]],
  // — infiammazione ——————————————————————————————————————————
  ["crp_mg_l", ["mg/L", "mg/dL"]],
  ["il6", ["pg/mL", "ng/L"]],
  ["tnf_alpha", ["pg/mL", "ng/L"]],
  ["homocysteine", ["umol/L", "mg/L"]],
  ["oxidized_ldl", ["U/L", "IU/L"]],
  // — stress ossidativo ——————————————————————————————————————
  ["roms_carr", ["Carr U"]],
  ["bap_umol", ["umol/L"]],
]);

/**
 * **Plausibilità, non riferimento clinico.** Nell'unità canonica, volutamente larghi: devono
 * lasciar passare qualunque referto vero (anche patologico: una ferritina da emocromatosi, un
 * TSH da mixedema) e fermare i numeri che *non possono essere quel marcatore* — 4500 % di
 * ematocrito, un'emoglobina di 0.0156 g/dL, uno zero.
 *
 * Non è una diagnosi e non deve diventarlo: nessun valore dentro l'intervallo viene giudicato.
 * I marcatori assenti (punteggi epigenetici, glutatione, SOD, catalasi) sono scale di cui non
 * conosciamo l'ordine di grandezza: dichiarare un intervallo lì sarebbe inventare.
 */
const MARKER_PLAUSIBLE_RANGE = new Map<string, ManualPlausibleRange>([
  ["hba1c", { min: 2, max: 20 }],
  ["emoglobina", { min: 2, max: 30 }],
  ["rbc", { min: 0.5, max: 12 }],
  ["wbc", { min: 0.1, max: 500 }],
  ["hct", { min: 5, max: 75 }],
  ["mcv", { min: 30, max: 180 }],
  ["mch", { min: 5, max: 60 }],
  ["mchc", { min: 15, max: 50 }],
  ["plt", { min: 1, max: 3000 }],
  ["rdw", { min: 5, max: 60 }],
  ["ferritina", { min: 0.1, max: 50000 }],
  ["vit_d", { min: 1, max: 400 }],
  ["b12", { min: 20, max: 50000 }],
  ["glicemia", { min: 10, max: 1500 }],
  ["cortisol_am", { min: 0.1, max: 200 }],
  ["cortisol_pm", { min: 0.1, max: 200 }],
  ["testosterone", { min: 0.5, max: 3000 }],
  ["free_testosterone", { min: 0.1, max: 1000 }],
  ["estradiol", { min: 0.5, max: 50000 }],
  ["progesterone", { min: 0.05, max: 500 }],
  ["lh", { min: 0.05, max: 300 }],
  ["fsh", { min: 0.05, max: 300 }],
  ["tsh", { min: 0.005, max: 500 }],
  ["t3", { min: 0.1, max: 100 }],
  ["t4", { min: 0.05, max: 50 }],
  ["dhea", { min: 0.05, max: 5000 }],
  ["igf1", { min: 5, max: 3000 }],
  ["crp_mg_l", { min: 0.01, max: 1000 }],
  ["il6", { min: 0.01, max: 10000 }],
  ["tnf_alpha", { min: 0.01, max: 10000 }],
  ["homocysteine", { min: 0.5, max: 500 }],
  ["oxidized_ldl", { min: 0.1, max: 10000 }],
  ["roms_carr", { min: 50, max: 2000 }],
  ["bap_umol", { min: 100, max: 10000 }],
  /** Delta di età biologica: anni, e qui il segno negativo è il caso normale. */
  ["biological_age_delta", { min: -60, max: 60 }],
]);

/**
 * L'intervallo di plausibilità di un marcatore, o `null` se non lo conosciamo — lì dichiararlo
 * sarebbe inventare. Esportato perché la stessa regola deve valere anche quando un valore viene
 * corretto in fase di conferma, non solo quando viene digitato.
 */
export function manualPlausibleRangeFor(markerKey: string): ManualPlausibleRange | null {
  return MARKER_PLAUSIBLE_RANGE.get(String(markerKey ?? "").trim().toLowerCase()) ?? null;
}

/**
 * Unità offerte per un marcatore. Il menù è la lista curata, deduplicata sul token normalizzato
 * (`µg/L`, `ug/l` e ` UG / L ` sono la stessa voce). Un marcatore che una lista non ce l'ha
 * riceve **solo** la sua unità canonica: porta stretta, mai un pool indovinato.
 */
function acceptedUnitsFor(markerKey: string, canonicalUnit: string | null): string[] {
  if (!canonicalUnit) return [];
  const curated = MARKER_UNIT_MENU.get(markerKey) ?? [];
  const out: string[] = [canonicalUnit];
  const seen = new Set<string>([normalizeUnitToken(canonicalUnit)]);
  for (const candidate of curated) {
    const token = normalizeUnitToken(candidate);
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(candidate);
  }
  return out;
}

/** Vocabolario per la UI e per la rotta: marcatori noti + unità accettabili per ciascuno. */
export function buildManualMarkerCatalog(
  markers: readonly ManualMarkerSource[],
  panelType?: string | null,
): ManualMarkerOption[] {
  const wanted = panelType ? String(panelType).trim() : "";
  return markers
    .filter((m) => (wanted ? m.panelType === wanted : true))
    .map((m) => {
      const canonicalUnit = m.unit && m.unit.trim() ? m.unit.trim() : null;
      return {
        key: m.key,
        panelType: m.panelType,
        label: m.label,
        canonicalUnit,
        acceptedUnits: acceptedUnitsFor(m.key, canonicalUnit),
        plausibleRange: MARKER_PLAUSIBLE_RANGE.get(m.key) ?? null,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "it"));
}

/* ------------------------------------------------------------------ */
/* Lettura del numero digitato                                          */
/* ------------------------------------------------------------------ */

type ParsedEnteredNumber =
  | { ok: true; value: number }
  | { ok: false; reason: "not_a_number" }
  /** Scrittura che vuol dire due cose diverse: `separator` è il carattere che la rende ambigua. */
  | { ok: false; reason: "ambiguous_thousands"; separator: string; asThousands: string; asDecimal: string };

const THOUSANDS_GROUPS = (sep: string) => new RegExp(`^\\d{1,3}(?:\\${sep}\\d{3})+$`);

/**
 * Legge il numero **come lo scrive una persona**, e si ferma quando la scrittura è ambigua.
 *
 * Il caso che ha imposto questa funzione: «250.000» — esattamente come un emocromo italiano
 * stampa le piastrine — diventava `0.25` ×10³/µL, cioè una trombocitopenia catastrofica al
 * posto di un valore normale, mentre «4.500.000» veniva rifiutato: due comportamenti diversi
 * per lo stesso separatore.
 *
 * Le regole, in ordine:
 *  - due separatori diversi («1.234,56», «1,234.56»): l'ultimo è il decimale, l'altro le migliaia;
 *  - lo stesso separatore ripetuto («4.500.000»): sono migliaia, e i gruppi devono essere da tre;
 *  - un solo PUNTO con **esattamente tre cifre** dopo e una parte intera che non comincia per
 *    zero («250.000», «1.234»): **ambiguo**, e qui non si indovina — vuol dire 250000 o 250?
 *    Si rifiuta indicando le due riscritture che ambigue non sono («250000» oppure «250,000»);
 *  - la virgola è sempre il decimale («15,6», «250,000» → 250): è la convenzione italiana, ed è
 *    l'unica scrittura che resta disponibile per dire «tre decimali». Chi arriva dall'inglese e
 *    scrive le migliaia con la virgola non passa in silenzio: il valore che ne esce cade fuori
 *    dall'intervallo di plausibilità del marcatore e viene fermato lì;
 *  - in ogni altro caso il separatore è il decimale («0.45», «1.05»).
 */
function parseEnteredNumber(raw: string | number | null | undefined): ParsedEnteredNumber {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? { ok: true, value: raw } : { ok: false, reason: "not_a_number" };
  }
  if (typeof raw !== "string") return { ok: false, reason: "not_a_number" };
  // Spazi (anche fini/insecabili) e apostrofo svizzero sono solo separatori visivi.
  const compact = raw.replace(/[\s   ']/g, "");
  if (!compact) return { ok: false, reason: "not_a_number" };
  const shape = /^([+-]?)([\d.,]*\d)(?:[eE]([+-]?\d+))?$/.exec(compact);
  if (!shape) return { ok: false, reason: "not_a_number" };
  const [, sign, body, exponent] = shape;
  if (exponent != null && !/^\d*\.?\d+$/.test(body)) return { ok: false, reason: "not_a_number" };

  const resolved = resolveDecimalSeparator(body);
  if (!resolved.ok) return resolved;
  const n = Number(`${sign}${resolved.text}${exponent != null ? `e${exponent}` : ""}`);
  return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, reason: "not_a_number" };
}

function resolveDecimalSeparator(body: string): { ok: true; text: string } | Extract<ParsedEnteredNumber, { ok: false }> {
  const lastDot = body.lastIndexOf(".");
  const lastComma = body.lastIndexOf(",");
  if (lastDot < 0 && lastComma < 0) return { ok: true, text: body };

  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandsSep = decimalSep === "." ? "," : ".";
    const head = body.slice(0, decimalSep === "." ? lastDot : lastComma);
    const tail = body.slice((decimalSep === "." ? lastDot : lastComma) + 1);
    if (!/^\d+$/.test(tail)) return { ok: false, reason: "not_a_number" };
    if (!THOUSANDS_GROUPS(thousandsSep).test(head)) return { ok: false, reason: "not_a_number" };
    return { ok: true, text: `${head.split(thousandsSep).join("")}.${tail}` };
  }

  const sep = lastDot >= 0 ? "." : ",";
  const occurrences = body.split(sep).length - 1;
  if (occurrences >= 2) {
    if (!THOUSANDS_GROUPS(sep).test(body)) return { ok: false, reason: "not_a_number" };
    return { ok: true, text: body.split(sep).join("") };
  }

  const [head, tail] = body.split(sep);
  if (!/^\d+$/.test(head) || !/^\d+$/.test(tail)) return { ok: false, reason: "not_a_number" };
  // Solo il punto è ambiguo: la virgola resta il decimale, altrimenti «tre decimali» diventerebbe
  // una cosa che non si può più scrivere in nessun modo (la riscrittura suggerita sarebbe a sua
  // volta ambigua, e l'utente girerebbe in tondo). L'errore all'inglese «250,000» lo deve fermare
  // il controllo di plausibilità del marcatore — verificato sotto.
  if (sep === "." && tail.length === 3 && /^[1-9]\d{0,2}$/.test(head)) {
    return {
      ok: false,
      reason: "ambiguous_thousands",
      separator: sep,
      asThousands: `${head}${tail}`,
      asDecimal: `${head},${tail}`,
    };
  }
  return { ok: true, text: `${head}.${tail}` };
}

/* ------------------------------------------------------------------ */
/* Validazione                                                          */
/* ------------------------------------------------------------------ */

/** Solo i delta possono essere negativi: una concentrazione negativa è un errore di battitura. */
function markerAllowsNegative(markerKey: string): boolean {
  return markerKey.endsWith("_delta");
}

function err(
  code: ManualLabEntryErrorCode,
  field: ManualLabEntryError["field"],
  message: string,
  extra?: { index?: number; markerKey?: string },
): ManualLabEntryError {
  return { code, field, message, ...(extra ?? {}) };
}

function formatUnitSuffix(unit: string | null): string {
  return unit ? ` ${unit}` : "";
}

export type ManualLabEntryResult =
  | { ok: true; entry: ValidatedManualLabEntry }
  | { ok: false; error: ManualLabEntryError };

export function validateManualLabEntry(
  input: ManualLabEntryInput,
  catalog: readonly ManualMarkerOption[],
  options?: { panelType?: string | null; index?: number },
): ManualLabEntryResult {
  const index = options?.index;
  const markerKey = String(input.markerKey ?? "").trim().toLowerCase();
  if (!markerKey) {
    return { ok: false, error: err("unknown_marker", "marker", "Scegli un marcatore dall'elenco.", { index }) };
  }
  const marker = catalog.find((m) => m.key === markerKey);
  if (!marker) {
    return {
      ok: false,
      error: err("unknown_marker", "marker", `Marcatore «${markerKey}» non riconosciuto.`, { index, markerKey }),
    };
  }
  const wantedPanel = options?.panelType ? String(options.panelType).trim() : "";
  if (wantedPanel && marker.panelType !== wantedPanel) {
    return {
      ok: false,
      error: err(
        "marker_panel_mismatch",
        "marker",
        `«${marker.label}» appartiene all'esame «${marker.panelType}», non a «${wantedPanel}».`,
        { index, markerKey },
      ),
    };
  }

  const unitRaw = typeof input.unit === "string" ? input.unit.trim() : "";
  if (marker.canonicalUnit && !unitRaw) {
    return {
      ok: false,
      error: err(
        "unit_required",
        "unit",
        `Indica l'unità di misura di «${marker.label}» come è scritta sul referto (canonica: ${marker.canonicalUnit}).`,
        { index, markerKey },
      ),
    };
  }
  if (!marker.canonicalUnit && unitRaw) {
    return {
      ok: false,
      error: err(
        "unit_not_expected",
        "unit",
        `«${marker.label}» è un punteggio senza unità di misura: lascia il campo unità vuoto.`,
        { index, markerKey },
      ),
    };
  }

  /**
   * Il menù è anche il filtro. Prima si accettava qualunque unità l'algebra sapesse convertire:
   * l'emoglobina in `mg/dL` entrava come 0.0156 e in `pg/dL` come 0 — numeri finti che superavano
   * ogni controllo a valle. Un'unità che sui referti non esiste è un errore **dell'unità**, e il
   * messaggio lo dice guardando il campo giusto.
   */
  if (marker.canonicalUnit) {
    const token = normalizeUnitToken(unitRaw);
    const accepted = marker.acceptedUnits.some((u) => normalizeUnitToken(u) === token);
    if (!accepted) {
      return {
        ok: false,
        error: err(
          "unit_not_accepted",
          "unit",
          `«${marker.label}» sui referti non si scrive in «${unitRaw}». ` +
            `Unità ammesse: ${marker.acceptedUnits.join(", ")}.`,
          { index, markerKey },
        ),
      };
    }
  }

  const enteredText = typeof input.value === "string" ? input.value.trim() : String(input.value ?? "");
  const parsed = parseEnteredNumber(input.value);
  if (!parsed.ok) {
    if (parsed.reason === "ambiguous_thousands") {
      return {
        ok: false,
        error: err(
          "ambiguous_number_format",
          "value",
          `«${enteredText}»: non è chiaro se «${parsed.separator}» separa le migliaia o i decimali — ` +
            `${parsed.asThousands} e ${parsed.asDecimal} sono due valori diversi. ` +
            `Riscrivilo senza separatore delle migliaia (${parsed.asThousands}) oppure con la virgola ` +
            `solo davanti ai decimali (${parsed.asDecimal}).`,
          { index, markerKey },
        ),
      };
    }
    return {
      ok: false,
      error: err("invalid_value", "value", `Valore di «${marker.label}» non è un numero.`, { index, markerKey }),
    };
  }
  const enteredValue = parsed.value;
  if (enteredValue < 0 && !markerAllowsNegative(markerKey)) {
    return {
      ok: false,
      error: err("negative_value", "value", `«${marker.label}» non può essere negativo.`, { index, markerKey }),
    };
  }

  let canonicalValue = roundLabValue(enteredValue);
  let converted = false;
  if (marker.canonicalUnit) {
    const conv = convertLabValueToCanonicalUnit({
      markerKey,
      value: enteredValue,
      fromUnit: unitRaw,
      toUnit: marker.canonicalUnit,
    });
    if (!conv.ok) {
      return {
        ok: false,
        error: err(
          "unit_not_convertible",
          "unit",
          `L'unità «${unitRaw}» non è convertibile in ${marker.canonicalUnit} per «${marker.label}». ` +
            `Unità ammesse: ${marker.acceptedUnits.join(", ")}.`,
          { index, markerKey },
        ),
      };
    }
    canonicalValue = conv.value;
    converted = conv.converted;
  }
  if (!Number.isFinite(canonicalValue)) {
    return {
      ok: false,
      error: err("invalid_value", "value", `Valore di «${marker.label}» non è un numero.`, { index, markerKey }),
    };
  }

  /**
   * Ultimo cancello, e quello che conta: il numero è arrivato nell'unità canonica, quindi qui si
   * può dire se è ancora quel marcatore. Quando non lo è, la causa più probabile è l'unità
   * sbagliata (45 letto come `L/L` diventa 4500 %), e il messaggio la nomina.
   */
  if (marker.plausibleRange) {
    const { min, max } = marker.plausibleRange;
    if (canonicalValue < min || canonicalValue > max) {
      const unitSuffix = formatUnitSuffix(marker.canonicalUnit);
      const unitHint = unitRaw
        ? ` Controlla il numero e soprattutto l'unità: hai indicato «${unitRaw}».`
        : " Controlla il numero.";
      return {
        ok: false,
        error: err(
          "value_out_of_plausible_range",
          "value",
          `«${marker.label}»: ${canonicalValue}${unitSuffix} non è un valore possibile ` +
            `(atteso fra ${min} e ${max}${unitSuffix}).${unitHint}`,
          { index, markerKey },
        ),
      };
    }
  } else if (Math.abs(canonicalValue) > MAX_ABS_LAB_VALUE) {
    return {
      ok: false,
      error: err("value_out_of_scale", "value", `Valore di «${marker.label}» fuori scala: ricontrolla il referto.`, {
        index,
        markerKey,
      }),
    };
  }

  return {
    ok: true,
    entry: {
      markerKey,
      label: marker.label,
      panelType: marker.panelType,
      enteredText,
      enteredValue: roundLabValue(enteredValue),
      enteredUnit: unitRaw || null,
      canonicalValue,
      canonicalUnit: marker.canonicalUnit,
      converted,
    },
  };
}

export type ManualLabEntryBatchResult =
  | { ok: true; entries: ValidatedManualLabEntry[] }
  | { ok: false; errors: ManualLabEntryError[] };

export function validateManualLabEntryBatch(
  inputs: readonly ManualLabEntryInput[],
  catalog: readonly ManualMarkerOption[],
  options?: { panelType?: string | null },
): ManualLabEntryBatchResult {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return {
      ok: false,
      errors: [err("no_entries", "entries", "Inserisci almeno un valore prima di salvare.")],
    };
  }
  if (inputs.length > MANUAL_ENTRY_MAX_ENTRIES) {
    return {
      ok: false,
      errors: [
        err("too_many_entries", "entries", `Massimo ${MANUAL_ENTRY_MAX_ENTRIES} valori per referto.`),
      ],
    };
  }
  const entries: ValidatedManualLabEntry[] = [];
  const errors: ManualLabEntryError[] = [];
  const seen = new Set<string>();
  inputs.forEach((input, index) => {
    const res = validateManualLabEntry(input, catalog, { panelType: options?.panelType, index });
    if (!res.ok) {
      errors.push(res.error);
      return;
    }
    if (seen.has(res.entry.markerKey)) {
      errors.push(
        err("duplicate_marker", "marker", `«${res.entry.label}» è stato inserito due volte.`, {
          index,
          markerKey: res.entry.markerKey,
        }),
      );
      return;
    }
    seen.add(res.entry.markerKey);
    entries.push(res.entry);
  });
  if (errors.length) return { ok: false, errors };
  return { ok: true, entries };
}

export type ManualSampleDateResult =
  | { ok: true; date: string }
  | { ok: false; error: ManualLabEntryError };

function isoDatePlusDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map((p) => Number(p));
  const probe = new Date(Date.UTC(y, m - 1, d));
  probe.setUTCDate(probe.getUTCDate() + days);
  return probe.toISOString().slice(0, 10);
}

/**
 * Data del prelievo: ISO, esistente, non nel futuro, non prima del 1900.
 *
 * «Oggi» è il giorno UTC **più uno**, e non per larghezza di manica: il server non conosce il
 * fuso di chi scrive. In Italia alle 00:30 del 9 settembre a Greenwich sono ancora le 22:30
 * dell'8, e con la soglia a UTC il prelievo *di oggi* veniva rifiutato come futuro. Un giorno è
 * lo scarto massimo possibile fra un fuso qualsiasi e UTC (da UTC−12 a UTC+14), quindi è la
 * soglia più stretta che non rifiuta mai un «oggi» vero. Il `today` esplicito serve ai test.
 */
export function validateManualSampleDate(raw: string | null | undefined, today?: string): ManualSampleDateResult {
  const value = String(raw ?? "").trim();
  const invalid = err("invalid_sample_date", "sampleDate", "Data del prelievo non valida (formato atteso AAAA-MM-GG).");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false, error: invalid };
  const [y, m, d] = value.split("-").map((p) => Number(p));
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d ||
    y < 1900
  ) {
    return { ok: false, error: invalid };
  }
  const todayUtc = today && /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : new Date().toISOString().slice(0, 10);
  if (value > isoDatePlusDays(todayUtc, 1)) {
    return {
      ok: false,
      error: err("future_sample_date", "sampleDate", "La data del prelievo non può essere nel futuro."),
    };
  }
  return { ok: true, date: value };
}

/* ------------------------------------------------------------------ */
/* Staging                                                              */
/* ------------------------------------------------------------------ */

export type ManualStagingPatch = {
  target: string;
  action: "set_field";
  field: string;
  proposed_value: number;
  unit: string | null;
  reference_range: null;
  confidence: number;
  notes: string;
  /** La stringa digitata: è l'unico modo, per il coach, di vedere una lettura sbagliata. */
  entered_text: string;
  entered_value: number;
  entered_unit: string | null;
  source: "manual_entry";
};

function formatValueWithUnit(value: number | string, unit: string | null): string {
  return unit ? `${value} ${unit}` : `${value}`;
}

/**
 * Patch nella **stessa forma** che `HealthStagingReviewView` legge e che
 * `POST /api/health/staging-runs/[id]/apply` sa già promuovere: l'inserimento manuale entra
 * dalla porta principale (staging run → conferma del coach), non da una porta laterale.
 *
 * `confidence: 1` perché il numero l'ha letto una persona sul foglio, non un modello: resta
 * comunque una **proposta**, la conferma è del coach approvato / platform admin.
 *
 * La nota riporta la scrittura ORIGINALE fra virgolette, non il numero già interpretato: se
 * qualcuno ha digitato «0,45» dove il referto diceva 45, si vede.
 */
export function buildManualStagingPatches(
  entries: readonly ValidatedManualLabEntry[],
  panelType: string,
): ManualStagingPatch[] {
  return entries.map((e) => ({
    target: `health.${panelType}`,
    action: "set_field" as const,
    field: e.markerKey,
    proposed_value: e.canonicalValue,
    unit: e.canonicalUnit,
    reference_range: null,
    confidence: 1,
    notes: e.converted
      ? `Inserito a mano: «${e.enteredText}»${formatUnitSuffix(e.enteredUnit)} → ${formatValueWithUnit(e.canonicalValue, e.canonicalUnit)}`
      : `Inserito a mano: «${e.enteredText}»${formatUnitSuffix(e.enteredUnit)}`,
    entered_text: e.enteredText,
    entered_value: e.enteredValue,
    entered_unit: e.enteredUnit,
    source: "manual_entry" as const,
  }));
}
