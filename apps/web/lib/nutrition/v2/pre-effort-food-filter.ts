/**
 * REGOLA 2 di Mario, PARTE MOTORE — niente fermentati né alimenti ricchi di fibre nei
 * pasti che cadono PRIMA dello sforzo, nei giorni di carico intenso e di gara.
 *
 * Parole di Mario (requisito di prodotto, non suggerimento):
 *   «Nei giorni di carico intenso e gara limitiamo apporto di fibre e prodotti fermentati
 *    nei pasti pre-allenamento/gara: niente yogurt, kefir, cereali integrali o altri
 *    elementi troppo ricchi di fibre. Restano comunque disponibili cereali classici,
 *    latte o latte vegetale.»
 *
 * DIVISIONE DEL LAVORO, la stessa del filtro allergeni: «è fermentato? è ricco di fibre?»
 * sta nei DATI (`menu-food-fiber-fermented.ts`: colonna `is_fermented` + soglia calibrata
 * su `fdc_food.fiber_100g`); QUANDO applicarlo — quali giorni, quali pasti — sta qui.
 * L'esito è un'ESCLUSIONE, non una penalità: un cibo escluso non è «meno preferito»,
 * per quel pasto non esiste.
 *
 * ── QUALI GIORNI ─────────────────────────────────────────────────────────────────────
 * «Carico intenso» non è un aggettivo nuovo: il motore classifica già le giornate con le
 * classi di Mario (`day-classification-engine.ts`, ratio = consumo/BMR):
 *   recupero  ratio < 1,55   → la regola NON scatta
 *   leggero   1,55–2,15      → allenamento normale, la regola NON scatta
 *   pesante   ratio ≥ 2,15   → È il carico intenso di Mario → la regola scatta
 * più i GIORNI GARA, che il day-engine non classifica di proposito (flag
 * `race_day_not_applied` in build-meal-plan-v2-production): il marcatore di gara è la
 * presenza di `racePreLunch`/`racePostRecovery` sul request.
 *
 * La classe arriva dal chiamante quando l'ha già calcolata (day-engine); quando manca
 * (day-engine «non applicabile» senza massa magra, o percorso preview) si ricava dallo
 * STESSO rapporto sulle energie del fabbisogno: (bmr + lifestyle + training)/bmr ≥ 2,15.
 * Un giorno senza seduta non può superarlo (ratio ~1,2-1,4 con training 0): il ripiego
 * non allarga la regola.
 *
 * Misura sui piani veri (prod, 437 giorni classificati): «pesante» esce 3-4 volte a
 * settimana per gli atleti con sedute pianificate e 0 nelle settimane senza sedute —
 * l'ordine di grandezza delle «2-3 colazioni a settimana» che Mario si aspetta.
 *
 * ── QUALI PASTI ──────────────────────────────────────────────────────────────────────
 * «Pre-allenamento» non è un elenco fisso di slot: dipende da quando l'atleta si allena.
 * Un pasto è pre-sforzo se il suo orario cade PRIMA dell'inizio della seduta e dentro la
 * finestra di {@link PRE_EFFORT_WINDOW_MINUTES} (3 h). Tre ore non è un numero inventato:
 * è la distanza che la regola del pasto pre-gara di Mario usa già
 * (`RaceDayPreRaceLunchRule.hoursBeforeRace = 3`).
 *
 * Conseguenza voluta (il caso da non sbagliare): chi si allena alle 18:00 tiene lo yogurt
 * a colazione — quella colazione è a otto ore dallo sforzo. Chi si allena alle 7:00 no.
 *
 * TUTTE le sedute del giorno, non solo la prima: chi si allena la mattina E il pomeriggio
 * (`has_training2` + `training2_start_time` nella routine: 3 atleti in prod) ha DUE finestre.
 * Guardare solo la prima lasciava scoperto il pasto che precede la seconda — per l'atleta
 * c2bd27ec del martedì, lo spuntino delle 16:30 a 90 minuti dalla seduta delle 18:00.
 * Gli inizi arrivano quindi come LISTA (`resolveSessionStartMinutes`), e la finestra è
 * l'unione delle finestre: un pasto è pre-sforzo se precede almeno una seduta di ≤ 3 h.
 *
 * ── IL GIORNO GARA NON HA FINESTRA: TUTTO CIÒ CHE PRECEDE LA PARTENZA ────────────────
 * Decisione di Mario dell'8 settembre 2026, arrivata guardando una gara di pomeriggio:
 *
 *   «Nel giorno della gara la colazione falla rimanere pulita» — a QUALUNQUE ora parta.
 *
 * Con la finestra a tempo una gara alle 13:30 lasciava fuori la colazione delle 08:00 (5 h
 * e mezza di distanza) e l'atleta poteva partire con yogurt e pane integrale addosso. In
 * gara quindi la finestra non c'è: è pre-sforzo OGNI pasto il cui orario precede la
 * partenza. La differenza con l'allenamento è voluta e sta nel rischio, non nella fisiologia
 * del transito: una colazione sbagliata prima di una ripetuta si paga con un'ora storta,
 * prima di una gara si paga con la gara.
 *
 * NEI GIORNI DI ALLENAMENTO LA FINESTRA RESTA COM'È: chi si allena alle 18:00 tiene lo
 * yogurt a colazione. È il caso che la finestra esiste per proteggere, e la decisione di
 * Mario parla solo della gara.
 *
 * Un giorno gara può avere ANCHE una seduta (scarico, riscaldamento pianificato): quella
 * seduta porta la sua finestra a tempo normale, la partenza gara porta la sua regola senza
 * finestra, e i pasti ristretti sono l'unione dei due insiemi.
 *
 * ── LA GERARCHIA: REGOLA 1 BATTE REGOLA 2 SUL PASTO PRE-GARA ─────────────────────────
 * Vedi {@link buildPreEffortFilterContext}: il pasto a protocollo è ESENTE da questo
 * filtro, per scelta, non per ordine delle chiamate.
 *
 * ── FAIL-CLOSED: SENZA I DATI LA REGOLA NON SI SPEGNE ────────────────────────────────
 * L'indice fermentato/fibra nasce dal CATALOGO (`nutrition_menu_foods`). Quando il catalogo
 * non risponde il compositore ricade sull'allowlist cablata, e lì l'indice è vuoto: prima
 * di questa chiusura nessun alimento risultava fermentato o integrale e la regola non
 * escludeva più niente — in silenzio. Misurato su una settimana con seduta alle 07:00 e
 * catalogo assente: «Pane integrale», «Yogurt greco», «Pane di segale», «Kefir», «Granola»
 * serviti a colazione, 6 giorni su 7.
 *
 * È lo stesso schema di fail-open tolto agli allergeni, e si chiude allo stesso modo:
 * quando la regola DEVE valere (giorno intenso o gara, pasto dentro la finestra) un
 * alimento che nessuna fonte sa classificare NON passa. «Classificato» = la riga porta le
 * colonne del catalogo (`isFermented`/`fiberPer100g`) oppure il suo fdcId sta nell'indice;
 * fibra non misurata su una riga del catalogo resta «non ricco di fibre» (sono carni, pesci
 * e latticini — vedi menu-food-fiber-fermented), perché quella riga UNA risposta ce l'ha.
 *
 * Il prezzo è dichiarato: con il catalogo irraggiungibile i pasti pre-sforzo dei giorni
 * intensi restano senza alimenti invece di riempirsi di roba non verificata. È un guasto
 * VISIBILE, e lascia una traccia: chi costruisce il contesto trova `sourceUnavailable` e
 * `evidence` da mettere su `empathy_events` (lo fa build-meal-plan-v2-production).
 */

import type { DailyNutritionRequirementsV2 } from "@empathy/contracts";
import type { IntelligentMealPlanRequest, MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { parseLocalTimeToMinutes } from "@/lib/nutrition/nutrition-meal-times-training-coherence";
import { isRacePreRaceMealSlot } from "@/lib/nutrition/race-day-pre-race-lunch";
import { DAY_CLASS_BANDS, type NutritionDayClass } from "@/lib/nutrition/v2/day-classification-engine";
import {
  isPreEffortExcludedByFacts,
  menuFoodFiberFermentedInfo,
  type MenuFoodFiberFermentedIndex,
  type MenuFoodFiberFermentedInfo,
} from "@/lib/nutrition/v2/menu-food-fiber-fermented";

/** Finestra «prima dello sforzo»: stessa distanza del pasto pre-gara di Mario (3 h). */
export const PRE_EFFORT_WINDOW_MINUTES = 180;

/** Ratio consumo/BMR da cui la giornata è «pesante» per Mario (banda 3 del day-engine). */
export const PRE_EFFORT_INTENSE_RATIO_MIN = DAY_CLASS_BANDS[2]!.ratioMin;

/**
 * Restrizione attiva su UNO slot: il gemello di `AllergenFilterContext` per il pick.
 * `foodIndex` è l'indice fdcId → fermentato/fibra del catalogo
 * (`buildMenuFoodFiberFermentedIndex`), l'unica chiave comune con i candidati grezzi.
 */
export type PreEffortSlotRestriction = {
  foodIndex: MenuFoodFiberFermentedIndex;
  /** Diagnostica leggibile (giorno + inizio sforzo + slot) per i flag di provenienza. */
  why: string;
};

/**
 * Prove che la fonte di classificazione RISPONDE davvero, contate una volta sull'indice.
 * Servono due prove diverse perché i due verdetti hanno due origini diverse: la colonna
 * `is_fermented` del catalogo e la fibra di `fdc_food`. Se ne manca una, quel mezzo
 * verdetto è muto — e un indice muto che dice «nessuno è fermentato» è indistinguibile da
 * un indice che dice «li ho guardati tutti e nessuno lo è».
 *
 * Catalogo sano (prod, 8 set 2026): 499 righe attive, 30 fermentate, 457 con fibra misurata.
 */
export type PreEffortIndexEvidence = {
  /** Alimenti nell'indice (0 = catalogo assente → allowlist cablata). */
  entries: number;
  /** Righe con `is_fermented = true`. */
  fermented: number;
  /** Righe con `is_wholegrain = true` (osservabilità: la colonna è in rollout). */
  wholegrain: number;
  /** Righe con fibra misurata E confrontabile (≠ «fibra zero»). */
  fiberMeasured: number;
  /**
   * Le due prove che devono esserci ENTRAMBE: `fermented > 0` (la colonna del catalogo
   * arriva) e `fiberMeasured > 0` (la fibra di fdc_food arriva). `wholegrain` resta fuori
   * dal cancello di proposito finché quella colonna è in rollout: pretenderla armerebbe il
   * fail-closed su un catalogo sano che non l'ha ancora popolata.
   */
  usable: boolean;
};

/** Restrizione del GIORNO: quali slot sono pre-sforzo + l'indice degli alimenti. */
export type PreEffortFilterContext = PreEffortSlotRestriction & {
  slots: ReadonlySet<MealSlotKey>;
  /** Inizi sforzo (minuti da mezzanotte) che hanno generato le finestre: gara + sedute. */
  effortStartMinutes: readonly number[];
  /**
   * Partenze gara (minuti da mezzanotte): quelle che NON hanno finestra — prendono ogni
   * pasto che le precede. Vuoto fuori dai giorni gara.
   */
  raceStartMinutes: readonly number[];
  /**
   * Pasto a protocollo pre-gara (Regola 1) tolto dagli slot ristretti, quando c'è.
   * È la gerarchia dichiarata di {@link buildPreEffortFilterContext}, non un residuo.
   */
  raceProtocolSlotExempt: MealSlotKey | null;
  evidence: PreEffortIndexEvidence;
  /**
   * `true` = la regola deve valere ma la fonte non risponde. Non cambia la DECISIONE
   * (il non classificato non passa comunque), è il segnale da tracciare: qui il piano
   * perde alimenti perché il catalogo è giù, non perché Mario li vieta.
   */
  sourceUnavailable: boolean;
};

/** Conta le prove sull'indice: vedi {@link PreEffortIndexEvidence}. */
export function preEffortIndexEvidence(index: MenuFoodFiberFermentedIndex): PreEffortIndexEvidence {
  let fermented = 0;
  let wholegrain = 0;
  let fiberMeasured = 0;
  for (const info of index.values()) {
    if (info.fermented) fermented += 1;
    if (info.wholegrain) wholegrain += 1;
    if (info.fiberPer100g != null) fiberMeasured += 1;
  }
  return {
    entries: index.size,
    fermented,
    wholegrain,
    fiberMeasured,
    usable: fermented > 0 && fiberMeasured > 0,
  };
}

function finite(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Le risposte lette DALLA RIGA, quando la riga le porta (le entry del catalogo:
 * `isFermented`, `isWholegrain`, `fiberPer100g` + la base di porzione). `null` = riga senza
 * nessuno di quei campi (allowlist storica hardcoded): decide l'indice per fdcId, e se
 * nemmeno l'indice risponde scatta il fail-closed.
 */
function factsOnRow(food: unknown): MenuFoodFiberFermentedInfo | null {
  if (!food || typeof food !== "object") return null;
  const f = food as {
    isFermented?: unknown;
    isWholegrain?: unknown;
    fiberPer100g?: unknown;
    servingBasis?: unknown;
  };
  if (f.isFermented === undefined && f.isWholegrain === undefined && f.fiberPer100g === undefined) return null;
  // La base di porzione viaggia con la riga: senza, la fibra non è confrontabile con nessuna
  // soglia (vedi menu-food-fiber-fermented) e il verdetto tornerebbe monco.
  return menuFoodFiberFermentedInfo(f.isFermented, f.fiberPer100g, {
    isWholegrain: f.isWholegrain,
    servingBasis: f.servingBasis,
  });
}

const excluded = isPreEffortExcludedByFacts;

/**
 * Una risposta su questo alimento esiste? È la domanda del fail-closed, e ha due sole
 * fonti: le colonne sulla riga (entry del catalogo) o l'fdcId nell'indice. Una riga del
 * catalogo con fibra non misurata È classificata — la sua risposta è «non fermentato, e
 * di fibra non ne ha misurata nessuno» (carni, pesci, latticini): è la scelta documentata
 * in menu-food-fiber-fermented, e non va confusa con «di questo alimento non so nulla».
 */
function preEffortClassification(
  food: unknown,
  restriction: PreEffortSlotRestriction,
  fdcId?: number | null,
): { own: MenuFoodFiberFermentedInfo | null; indexed: MenuFoodFiberFermentedInfo | undefined; known: boolean } {
  const own = factsOnRow(food);
  const id = typeof fdcId === "number" ? fdcId : finite((food as { fdcId?: unknown })?.fdcId);
  const indexed = id == null ? undefined : restriction.foodIndex.get(id);
  return { own, indexed, known: own != null || indexAnswers(indexed) };
}

/**
 * Dall'INDICE (unica chiave: l'fdcId) una risposta arriva solo se la riga porta davvero un
 * dato: fermentato dichiarato, oppure fibra misurata. Una voce `{fermented:false, fiber:null}`
 * NON è una risposta — è quello che l'indice restituisce anche quando le colonne della
 * Regola 2 non sono state selezionate (bundle vecchio, migrazione non ancora applicata):
 * un indice pieno di voci mute direbbe «nessuno è fermentato» con la stessa faccia di un
 * indice che li ha guardati tutti.
 *
 * Sulla RIGA invece la stessa coppia È una risposta (`own`): quella riga viene dal catalogo,
 * il flag fermentato è esplicito e la fibra non misurata resta «non ricco di fibre» — sono
 * carni, pesci e latticini, e il latte Mario lo lascia disponibile per iscritto.
 */
function indexAnswers(info: MenuFoodFiberFermentedInfo | undefined): boolean {
  return info != null && (info.fermented || info.wholegrain || info.fiberPer100g != null);
}

/**
 * Riga di catalogo (staple registry, ingrediente di ricetta): il verdetto viaggia sulla
 * riga; se la riga non porta la fibra si ripiega sull'indice per fdcId (righe diverse con
 * lo stesso fdcId sono già fuse in chiusura dall'indice).
 *
 * FAIL-CLOSED (vedi header): dentro un pasto pre-sforzo di un giorno intenso o di gara, un
 * alimento che nessuna delle due fonti sa classificare NON passa. È il caso dell'allowlist
 * cablata quando il catalogo non risponde: prima passavano tutti — yogurt e pane integrale
 * compresi — perché l'indice vuoto non escludeva nessuno.
 */
export function isPreEffortExcludedFood(
  food: unknown,
  restriction: PreEffortSlotRestriction | null | undefined,
  fdcId?: number | null,
): boolean {
  if (!restriction) return false;
  const { own, indexed, known } = preEffortClassification(food, restriction, fdcId);
  if (excluded(own)) return true;
  if (own && own.fiberPer100g != null) return false;
  if (excluded(indexed)) return true;
  return !known;
}

/**
 * Candidato USDA grezzo (pool di ripiego, senza riga di catalogo): decide l'indice per
 * fdcId — l'unica chiave comune — e in subordine il tag di tassonomia `fiber_dense`,
 * l'unico segnale di fibra che quel pool porta con sé. Il flag `is_fermented` vive solo
 * sul catalogo, per contratto: fuori dal catalogo copre gli fdcId condivisi.
 *
 * Stesso fail-closed della riga di catalogo: un fdcId che il catalogo non conosce non è
 * «probabilmente innocuo», è ignoto — e in un pasto pre-sforzo l'ignoto non si serve.
 * `fiber_dense` resta come rete, non come permesso: escludere ciò che tagga, non ammettere
 * ciò che non tagga (quel tag si accende solo sotto il 45% di carboidrati, quindi l'avena
 * e il pane integrale non lo portano mai).
 */
export function isPreEffortExcludedHit(
  hit: { fdcId: number; tags?: { macroDominant?: readonly string[] } },
  restriction: PreEffortSlotRestriction | null | undefined,
): boolean {
  if (!restriction) return false;
  const indexed = restriction.foodIndex.get(hit.fdcId);
  if (excluded(indexed)) return true;
  if ((hit.tags?.macroDominant ?? []).includes("fiber_dense")) return true;
  return !indexAnswers(indexed);
}

/** Giorno «di carico intenso o gara»? Vedi header per la definizione e le fonti. */
export function isPreEffortIntenseDay(input: {
  dayClass?: NutritionDayClass | null;
  raceDay?: boolean;
  energy?: { bmrKcal?: number | null; lifestyleKcal?: number | null; trainingKcal?: number | null } | null;
}): { intense: boolean; why: string } {
  if (input.raceDay) return { intense: true, why: "gara" };
  if (input.dayClass) {
    return input.dayClass === "pesante"
      ? { intense: true, why: "day_class:pesante" }
      : { intense: false, why: `day_class:${input.dayClass}` };
  }
  const bmr = finite(input.energy?.bmrKcal);
  const lifestyle = finite(input.energy?.lifestyleKcal) ?? 0;
  const training = finite(input.energy?.trainingKcal) ?? 0;
  if (bmr == null || bmr <= 0) return { intense: false, why: "ratio_non_calcolabile" };
  const ratio = (bmr + lifestyle + training) / bmr;
  return ratio >= PRE_EFFORT_INTENSE_RATIO_MIN
    ? { intense: true, why: `ratio:${ratio.toFixed(2)}` }
    : { intense: false, why: `ratio:${ratio.toFixed(2)}` };
}

/** Normalizza «un inizio o una lista di inizi» in una lista ordinata e senza doppioni. */
export function normalizeEffortStartMinutes(
  value: number | readonly number[] | null | undefined,
): number[] {
  const raw = value == null ? [] : typeof value === "number" ? [value] : [...value];
  const seen = new Set<number>();
  for (const n of raw) {
    if (typeof n === "number" && Number.isFinite(n)) seen.add(n);
  }
  return [...seen].sort((a, b) => a - b);
}

/**
 * Slot pre-sforzo. Due criteri, uno per tipo di sforzo — e la differenza è la decisione di
 * Mario sul giorno gara (vedi header):
 *
 *   ALLENAMENTO (`effortStartMinutes`) → finestra a tempo: il pasto entra se precede l'inizio
 *     di UNA QUALSIASI seduta del giorno di non più di {@link PRE_EFFORT_WINDOW_MINUTES}.
 *     Chi si allena due volte ha due finestre; chi si allena alle 18 tiene lo yogurt a
 *     colazione.
 *   GARA (`raceStartMinutes`) → nessuna finestra: entra OGNI pasto che precede la partenza,
 *     anche a otto ore di distanza.
 *
 * Senza nessun inizio (giorno senza seduta né gara, o routine senza orari espliciti)
 * l'insieme è VUOTO: no-op esplicito.
 */
export function preEffortSlotsFromTimes(input: {
  /** Inizi delle SEDUTE di allenamento: finestra a tempo. */
  effortStartMinutes: number | readonly number[] | null | undefined;
  /** Partenze GARA: nessuna finestra, tutto ciò che precede. */
  raceStartMinutes?: number | readonly number[] | null;
  mealTimesBySlot: Partial<Record<MealSlotKey, string>>;
  windowMinutes?: number;
}): Set<MealSlotKey> {
  const out = new Set<MealSlotKey>();
  const trainingStarts = normalizeEffortStartMinutes(input.effortStartMinutes);
  const raceStarts = normalizeEffortStartMinutes(input.raceStartMinutes);
  if (trainingStarts.length === 0 && raceStarts.length === 0) return out;
  const window = input.windowMinutes ?? PRE_EFFORT_WINDOW_MINUTES;
  for (const [slot, time] of Object.entries(input.mealTimesBySlot)) {
    if (typeof time !== "string" || time.trim() === "") continue;
    const m = parseLocalTimeToMinutes(time);
    if (m == null) continue;
    const preTraining = trainingStarts.some((start) => m <= start && start - m <= window);
    const preRace = raceStarts.some((start) => m <= start);
    if (preTraining || preRace) out.add(slot as MealSlotKey);
  }
  return out;
}

/**
 * Contesto per una composizione. `null` = niente da decidere (giorno non intenso, o
 * nessun pasto nella finestra): il compositore si comporta ESATTAMENTE come oggi.
 *
 * ── GERARCHIA DICHIARATA: REGOLA 1 BATTE REGOLA 2 SUL PASTO PRE-GARA ────────────────
 * Le due regole di Mario si contraddicono su un piatto solo, e non per sbaglio:
 *
 *   R1 (pasto pre-gara fisso) PRESCRIVE il grana padano — «3 g/kg di CHO da pasta o riso,
 *      15-20 g di olio, grana padano», tre voci e basta.
 *   R2 (niente fermentati prima dello sforzo) VIETEREBBE il grana: un formaggio a lunga
 *      stagionatura è un fermentato (`is_fermented = true` in catalogo, come lo yogurt).
 *
 * Vince R1. Mario ha scritto quel protocollo — grana compreso — conoscendo la sua stessa
 * regola sui fermentati: è un protocollo clinico su un pasto singolo, non una preferenza
 * che il motore possa «migliorare» in nessuna delle due direzioni. Il motore non ha titolo
 * per togliere il grana, né per rimpiazzarlo con qualcos'altro.
 *
 * Quindi il pasto a protocollo esce QUI dall'insieme degli slot ristretti, in modo esplicito
 * e leggibile. Farlo qui, e non lasciarlo accadere per l'ordine delle chiamate del
 * compositore (che oggi compone gli slot gara in un ramo separato, prima e senza pool),
 * è il punto: chi riordina quel ramo domani non deve poter riaprire la contraddizione
 * senza accorgersene.
 *
 * DUE COSE CHE L'ESENZIONE **NON** TOCCA:
 *   * gli ALTRI pasti del giorno gara — la colazione, quando non è lei il pasto a
 *     protocollo — restano pienamente soggetti a R2;
 *   * il filtro ALLERGENI, che è un'altra cosa e resta l'ultima parola: il protocollo lo
 *     attraversa comunque (`composeRacePreLunchMainMeal` riceve le classi escluse), e a un
 *     allergico al latte il grana non arriva.
 */
export function buildPreEffortFilterContext(input: {
  requirements?: Pick<DailyNutritionRequirementsV2, "energy"> | null;
  request?: IntelligentMealPlanRequest | null;
  /** Classe del giorno dal day-engine, quando il chiamante l'ha già calcolata. */
  dayClass?: NutritionDayClass | null;
  /**
   * Minuti da mezzanotte degli inizi seduta della routine — TUTTE le sedute del giorno
   * (`resolveSessionStartMinutes`), non solo la prima. Sono gli sforzi con FINESTRA a tempo.
   * La partenza gara NON arriva da qui: si legge da `request.racePreLunch.raceStartMinutes`
   * e vale con l'altro criterio (tutto ciò che la precede). Un giorno di gara può avere
   * anche una seduta di scarico: i due insiemi si sommano.
   */
  trainingStartMinutes?: number | readonly number[] | null;
  /** Indice fdcId → fermentato/fibra dal catalogo già caricato. */
  foodIndex: MenuFoodFiberFermentedIndex;
}): PreEffortFilterContext | null {
  const request = input.request ?? null;
  const racePreLunch = request?.racePreLunch ?? null;
  const raceDay = Boolean(racePreLunch || request?.racePostRecovery);

  const day = isPreEffortIntenseDay({
    dayClass: input.dayClass ?? null,
    raceDay,
    energy: input.requirements?.energy ?? null,
  });
  if (!day.intense) return null;

  // I due tipi di sforzo restano SEPARATI fin qui, perché hanno due criteri diversi:
  // la partenza gara non ha finestra, le sedute sì (vedi preEffortSlotsFromTimes).
  const raceStartMinutes = normalizeEffortStartMinutes(racePreLunch?.raceStartMinutes ?? null);
  const trainingStartMinutes = normalizeEffortStartMinutes(input.trainingStartMinutes ?? null);

  const mealTimesBySlot: Partial<Record<MealSlotKey, string>> = {};
  for (const s of request?.slots ?? []) {
    const t = s.scheduledTimeLocal?.trim();
    if (t) mealTimesBySlot[s.slot] = t;
  }
  const slots = preEffortSlotsFromTimes({
    effortStartMinutes: trainingStartMinutes,
    raceStartMinutes,
    mealTimesBySlot,
  });

  // ── R1 > R2: il pasto a protocollo pre-gara esce dal filtro ────────────────────────
  // Scelta dichiarata (vedi il commento della funzione), non effetto dell'ordine delle
  // chiamate: il protocollo di Mario prescrive il grana padano, che è un fermentato, e il
  // motore non ha titolo per correggere un protocollo clinico. Gli ALTRI pasti del giorno
  // gara restano soggetti a R2; il filtro allergeni resta l'ultima parola sul protocollo.
  // `isRacePreRaceMealSlot` è lo stesso predicato che usa il compositore per riconoscerlo:
  // la definizione di «pasto a protocollo» resta una sola.
  let raceProtocolSlotExempt: MealSlotKey | null = null;
  for (const slot of [...slots]) {
    if (!isRacePreRaceMealSlot(slot, racePreLunch)) continue;
    slots.delete(slot);
    raceProtocolSlotExempt = slot;
  }

  if (slots.size === 0) return null;

  const effortStartMinutes = normalizeEffortStartMinutes([...raceStartMinutes, ...trainingStartMinutes]);
  const evidence = preEffortIndexEvidence(input.foodIndex);
  return {
    slots,
    effortStartMinutes,
    raceStartMinutes,
    raceProtocolSlotExempt,
    evidence,
    sourceUnavailable: !evidence.usable,
    foodIndex: input.foodIndex,
    why: `${day.why}|start:${effortStartMinutes.join(",")}${
      raceStartMinutes.length ? `|gara:${raceStartMinutes.join(",")}` : ""
    }|slots:${[...slots].join("+")}${
      raceProtocolSlotExempt ? `|r1_protocollo_esente:${raceProtocolSlotExempt}` : ""
    }${evidence.usable ? "" : `|fail_closed:catalogo(entries:${evidence.entries})`}`,
  };
}

/** Restrizione per UNO slot: `null` quando quello slot non è pre-sforzo (no-op esplicito). */
export function preEffortRestrictionForSlot(
  ctx: PreEffortFilterContext | null | undefined,
  slot: MealSlotKey,
): PreEffortSlotRestriction | null {
  if (!ctx || !ctx.slots.has(slot)) return null;
  return { foodIndex: ctx.foodIndex, why: `${ctx.why}|slot:${slot}` };
}
