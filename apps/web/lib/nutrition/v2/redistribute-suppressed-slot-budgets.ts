/**
 * Slot soppressi nella finestra di allenamento: il pasto NON si serve (regola invariata,
 * l'atleta in quel momento sta mangiando il fueling), ma il suo BUDGET non può sparire.
 *
 * Il fabbisogno del giorno è già diviso in due borse separate a monte
 * (`daily-energy-solver`: `mealsKcal` e `fuelingKcal`): quando lo spuntino delle 10:30
 * cade dentro la seduta, il suo pezzo di `mealsKcal` non lo copre il fueling — che ha la
 * sua borsa — e finora veniva semplicemente lasciato cadere. Misurato sui piani di
 * produzione: 112 slot senza nemmeno una riga, 36.667 kcal, il 33% dell'intero scarto
 * servito/target; 72 di quei 112 erano soppressi.
 *
 * Qui il budget dello slot soppresso viene RIDISTRIBUITO sugli altri pasti in proporzione
 * alle loro kcal — la giornata torna a valere quanto il profilo Diet dice, senza che nulla
 * venga servito dentro la finestra. È esattamente la strada che il piano gara già percorre
 * per il residuo del pre-gara (`redistributeRacePreRaceBudgetSurplus`).
 */

export type SuppressedSlotBudgetRow = {
  key: string;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
};

/** Sotto questo budget non si sposta nulla: rumore di arrotondamento. */
export const SUPPRESSED_SLOT_REDISTRIBUTION_MIN_KCAL = 25;

/**
 * Quanto può CRESCERE un pasto che riceve. Il tetto non è un dettaglio prudenziale: è il
 * confine fra «la giornata arriva al target» e «il piatto non è servibile». Senza tetto,
 * su una giornata di gara con pranzo E spuntino dentro la finestra (2.000 kcal da
 * ricollocare su tre pasti) la cena passava da 903 a 2.119 kcal e usciva con 320 g di
 * branzino e 385 g di polenta, e lo spuntino con 560 g di «mela e noci»: numeri giusti,
 * porzioni che nessuno serve.
 *
 * Con il tetto, un pasto assorbe fino a +35% del proprio budget — abbondante per uno
 * spuntino soppresso su una giornata normale (250 kcal su 2.000 di riceventi = +12%) — e
 * quello che non ci sta RESTA FUORI, dichiarato: su quelle giornate il piano è
 * davvero più corto del fabbisogno, e fingere il contrario servendo porzioni impossibili
 * sarebbe peggio dello scarto.
 */
export const SUPPRESSED_SLOT_MAX_RECEIVER_GROWTH = 0.35;

export function redistributeSuppressedSlotBudgets<T extends SuppressedSlotBudgetRow>(
  slots: readonly T[],
  input: {
    suppressedKeys: readonly string[];
    /** Slot che il budget NON deve raggiungere (composizione a protocollo: pre-gara, recovery). */
    excludeKeys?: readonly string[];
  },
): T[] {
  const suppressed = new Set(input.suppressedKeys);
  if (suppressed.size === 0) return [...slots];

  const donorIdx = slots
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => suppressed.has(row.key) && row.kcal > 0);
  if (donorIdx.length === 0) return [...slots];

  const movedKcal = donorIdx.reduce((s, d) => s + d.row.kcal, 0);
  if (movedKcal < SUPPRESSED_SLOT_REDISTRIBUTION_MIN_KCAL) return [...slots];

  const blocked = new Set([...suppressed, ...(input.excludeKeys ?? [])]);
  const receivers = slots
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => !blocked.has(row.key) && row.kcal > 0);
  // Nessuno a cui darlo (giornata di sola seduta): si lascia tutto com'è — meglio uno
  // scarto onesto che un pasto inventato fuori dalle regole.
  if (receivers.length === 0) return [...slots];

  const totalReceiverKcal = receivers.reduce((s, r) => s + r.row.kcal, 0);
  if (totalReceiverKcal <= 0) return [...slots];

  /**
   * Quanto la giornata sa davvero assorbire: la somma dei tetti dei riceventi. Se il
   * budget da ricollocare la supera, si sposta solo la parte che ci sta e i donatori
   * TENGONO il resto — così lo scarto resta visibile dove nasce invece di trasformarsi in
   * porzioni impossibili.
   */
  const capacityKcal = receivers.reduce((s, r) => s + r.row.kcal * SUPPRESSED_SLOT_MAX_RECEIVER_GROWTH, 0);
  const placedKcal = Math.min(movedKcal, capacityKcal);
  if (placedKcal < SUPPRESSED_SLOT_REDISTRIBUTION_MIN_KCAL) return [...slots];
  /** Frazione del budget di ogni donatore che trova posto (il resto gli resta). */
  const placedShare = placedKcal / movedKcal;

  const next = slots.map((s) => ({ ...s }));
  for (const d of donorIdx) {
    const keep = 1 - placedShare;
    next[d.i] = {
      ...next[d.i]!,
      kcal: Math.round(d.row.kcal * keep),
      carbs: Math.round(d.row.carbs * keep),
      protein: Math.round(d.row.protein * keep),
      fat: Math.round(d.row.fat * keep),
    };
  }

  /** L'ultimo riceve il resto: nessuna kcal persa negli arrotondamenti. */
  let leftover = Math.round(placedKcal);
  receivers.forEach((r, n) => {
    const share =
      n === receivers.length - 1 ? leftover : Math.round((placedKcal * r.row.kcal) / totalReceiverKcal);
    leftover -= share;
    if (share <= 0) return;
    // I macro seguono le kcal nella stessa proporzione: la ripartizione dello slot non cambia.
    const ratio = (r.row.kcal + share) / r.row.kcal;
    next[r.i] = {
      ...next[r.i]!,
      kcal: Math.round(r.row.kcal + share),
      carbs: Math.round(r.row.carbs * ratio),
      protein: Math.round(r.row.protein * ratio),
      fat: Math.round(r.row.fat * ratio),
    };
  });

  return next;
}
