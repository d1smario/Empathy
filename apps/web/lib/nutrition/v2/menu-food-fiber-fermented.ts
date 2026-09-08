/**
 * REGOLA 2 di Mario — «niente fibre né fermentati prima dello sforzo», LATO DATI.
 *
 *   «Nei giorni di carico intenso e gara limitiamo apporto di fibre e prodotti fermentati
 *    nei pasti pre-allenamento/gara: niente yogurt, kefir, cereali integrali o altri elementi
 *    troppo ricchi di fibre. Restano comunque disponibili cereali classici, latte o latte
 *    vegetale.»
 *
 * Questo modulo risponde alle domande su UN alimento del catalogo — è fermentato? è un
 * cereale integrale? è troppo ricco di fibre? — e a nient'altro. QUANDO applicarle (quali
 * giorni, quali pasti) vive nel motore, in `pre-effort-food-filter.ts`. Stessa divisione del
 * filtro allergeni: il dato e il predicato di qua, la decisione di là.
 *
 * ── LE TRE CONDIZIONI SONO COMPLEMENTARI, NON ALTERNATIVE ────────────────────────────
 * Un alimento è fuori dai pasti pre-sforzo se è FERMENTATO **oppure** INTEGRALE **oppure**
 * oltre la soglia di fibra. Le tre non si sostituiscono a vicenda: prendono famiglie diverse
 * e ognuna lascia passare ciò che le altre fermano.
 *
 *   * FERMENTATO → `nutrition_menu_foods.is_fermented`, colonna curata a mano (migrazioni
 *     20260908150000/150100): 30 righe su 499 attive — yogurt in ogni forma, kefir,
 *     latticello, panna acida, tempeh, formaggi stagionati. Latte e bevande vegetali NON
 *     fermentate restano false: Mario le lascia esplicitamente disponibili.
 *   * INTEGRALE → `nutrition_menu_foods.is_wholegrain`, colonna curata a mano (migrazioni
 *     20260908160000/160100): 37 righe su 499. È DICHIARATA, non dedotta dalla fibra, perché
 *     sui dati veri la fibra non ci arriva (vedi sotto).
 *   * RICCO DI FIBRE → `nutrition_fdc_foods.fiber_100g`, misurata su 457 righe su 499. È la
 *     RETE RESIDUA, e vale SOLO dove il numero è confrontabile: nelle popolazioni di
 *     cereali/carboidrati e sui legumi (vedi {@link FIBER_NET_POOL_BASES}). Prende ciò che
 *     non è né fermentato né dichiarato integrale — orzo perlato, castagne, pasta di legumi,
 *     pasta di mais, ceci e fagioli. Fuori da quelle popolazioni tace: una soglia tarata sui
 *     cereali non sa giudicare un cornetto, una marmellata o una mandorla.
 *
 * ── PERCHÉ LA FIBRA NON BASTA PER GLI INTEGRALI ──────────────────────────────────────
 * Mario nomina i cereali integrali come CATEGORIA, non come «quelli sopra tot fibra». Sei
 * integrali del catalogo stanno sotto qualunque soglia sensata, e nessuna taratura li prende:
 *
 *   Riso integrale  1,60 g/100 g (cotto)   Miglio        1,30 g/100 g (cotto)
 *   Riso rosso      4,20 g/100 g (secco)   Grano saraceno 0,00 g/100 g (secco)
 *   Riso venere     4,18 g/100 g (secco)   Grano duro        n/d       (secco)
 *   Farro           3,90 g/100 g (secco)
 *
 * Abbassare la soglia fino a prenderli porterebbe via anche la pasta di semola (3,2), il
 * semolino (3,9) e la polenta (3,9), cioè esattamente i «cereali classici» che Mario lascia.
 * La proprietà si dichiara.
 *
 * ── PERCHÉ DUE SOGLIE: LA FIBRA È CIECA ALLA BASE DI PORZIONE ────────────────────────
 * `fiber_100g` è misurata sul prodotto nella base di porzione della riga
 * (`nutrition_menu_foods.serving_basis`), e le basi non sono confrontabili fra loro: 100 g di
 * pasta SECCA diventano ~230 g nel piatto, 100 g di riso COTTO sono già nel piatto. Nel
 * catalogo i pool cereali usano entrambe le basi (61 righe `dry_grams`, 17 `cooked_grams`),
 * quindi un'unica soglia confrontava numeri su scale diverse.
 *
 * La cura NON è normalizzare a «come si mangia»: servirebbe un fattore di resa per alimento
 * che il catalogo non ha, e la classe `dry_grams` mescola cibi che l'acqua la prendono (pasta,
 * riso, farro) con cibi che si mangiano così come sono (pane, fiocchi, fette biscottate).
 * Dividere il pane per un fattore di cottura sarebbe un numero inventato. Si confronta invece
 * DENTRO la stessa base, con una soglia calibrata su ciascuna popolazione reale.
 *
 *   BASE `dry_grams` — soglia 4,5 g/100 g
 *   AMMESSI (classici)                    │ ESCLUSI (ricchi)
 *   riso parboiled          1,8           │ pane di segale            5,8
 *   pane casereccio         2,1           │ pane integrale            6,0
 *   corn flakes             2,7           │ crackers integrali        6,9
 *   PASTA DI SEMOLA         3,2           │ pane multicereale         7,4
 *   pasta all'uovo          3,3           │ granola                   8,9
 *   semolino / polenta      3,9           │ fiocchi d'avena           9,4
 *   gallette di riso        4,2           │ muesli                    9,8
 *   pane all'uvetta         4,3           │ pasta integrale          10,1
 *                                         │ crusca di grano          42,8
 *   Non più in basso perché la pasta di semola (3,2) è l'alimento del pasto pre-gara di
 *   Mario (Regola 1), e con lei uscirebbero semolino e polenta. Non più in alto (es. il 6
 *   del Reg. CE 1924/2006) perché lascerebbe passare pane di segale e pane integrale.
 *
 *   BASE «come si mangia» (`cooked_grams`) — soglia 2,5 g/100 g, e SOLO nei pool dove quella
 *   base raccoglie cereali cotti: `lunch_carb`/`dinner_carb`, più i legumi ovunque stiano.
 *   AMMESSI                               │ ESCLUSI
 *   miglio                  1,3           │ lupini                    2,8
 *   cous cous               1,4           │ orzo perlato              3,8
 *   riso integrale*         1,6           │ bulgur*                   4,5
 *   gnocchi di patate      1,75           │ pasta di legumi           4,9
 *   PATATE                  2,2           │ castagne                  5,1
 *                                         │ ceci / fagioli         6,3-8,7
 *   (*) riso integrale e bulgur escono comunque da `is_wholegrain`: la colonna dichiarata
 *   non ha bisogno della soglia.
 *   Calibrata sulla stessa popolazione: da cotti i classici stanno ≤ 2,2 e i fibrosi
 *   ripartono da 2,8. Le patate — carboidrato pre-gara classico — restano dentro; l'orzo
 *   perlato, che da cotto porta più fibra della pasta integrale cotta, esce.
 *   Il CORNETTO (2,6, `cooked_grams`) sta in `breakfast_cho`, dove la base «come si mangia»
 *   raccoglie confetture, miele e sciroppi, non cereali cotti: lì la soglia non si applica e
 *   il cornetto resta. Nessuna riga `ml` supera 0,5 g/100 ml: latte e bevande vegetali
 *   restano disponibili, come dice Mario.
 *
 * Le due soglie non si derivano l'una dall'altra: ognuna è tarata sui valori della sua base.
 * Il rapporto che ne esce (4,5 : 2,5) è comunque coerente con l'acqua che i cereali del
 * catalogo prendono in cottura (~2÷3 volte il peso), ma è una verifica di plausibilità,
 * non la derivazione.
 *
 * ── EFFETTO MISURATO SUL CATALOGO (prod, 499 righe attive, 8 set 2026) ───────────────
 * Superstiti per pool con la regola completa, PRIMA e DOPO la restrizione della rete alla
 * sua popolazione:
 *
 *   pool             tot   prima   dopo
 *   breakfast_cho     46      26     28   (+ cornetto, crema di cacao e nocciole)
 *   breakfast_pro     40      27     29
 *   breakfast_fat     51      20     50   (+ frutta oleosa, semi, avocado, olive)
 *   lunch/dinner_carb 35      12     12   (INVARIATO: è la popolazione della rete)
 *   lunch/dinner_pro 171     136    136   (INVARIATO: i legumi restano fuori)
 *   lunch/dinner_veg  81      76     81   (+ pomodori secchi, carciofi, pastinaca…)
 *   snack_cho         69      53     68   (+ frutta secca ed essiccata)
 *   snack_pro         65      29     38
 *
 * I 12 superstiti dei pool carboidrati sono esattamente i classici di Mario: pasta di
 * semola/all'uovo/fresca, riso bianco/parboiled/arborio, polenta, cous cous, gnocchi,
 * patate, patate rosse, patata dolce.
 *
 * IL PREZZO, dichiarato: 52 righe rientrano nei pasti pre-sforzo — semi di chia (34,4),
 * semi di lino (27,3), mandorle (10,8), fichi secchi (9,8), pomodori secchi (12,3)… Sono
 * alimenti che nessuno ha DICHIARATO e il cui numero non è confrontabile con la soglia dei
 * cereali. Se Mario li vuole fuori la strada è una TERZA colonna curata a mano
 * (`is_high_fiber`, ~50 righe da rivedere), non una soglia allargata su una popolazione
 * sbagliata: è la stessa scelta già fatta per `is_wholegrain`.
 */

import type { MealPlanV2ServingBasis } from "@empathy/contracts";

/**
 * Soglia sulla base `dry_grams` (secco/crudo: pasta, riso, farine, pane, fiocchi).
 * Vedi la tabella nel commento del modulo per la calibrazione sui valori veri.
 */
export const MENU_FOOD_HIGH_FIBER_THRESHOLD_DRY_G = 4.5;

/**
 * Soglia sul prodotto COME SI MANGIA (basi `cooked_grams` e `ml`). Più bassa della soglia
 * sul secco perché il denominatore contiene l'acqua della cottura: confrontare i due numeri
 * fra loro non è un confronto.
 */
export const MENU_FOOD_HIGH_FIBER_THRESHOLD_AS_EATEN_G = 2.5;

/** La soglia che vale per una base di porzione. Base ignota → nessuna soglia applicabile. */
export function fiberThresholdForBasis(basis: MealPlanV2ServingBasis): number {
  return basis === "dry_grams" ? MENU_FOOD_HIGH_FIBER_THRESHOLD_DRY_G : MENU_FOOD_HIGH_FIBER_THRESHOLD_AS_EATEN_G;
}

const SERVING_BASES: ReadonlySet<string> = new Set<MealPlanV2ServingBasis>(["dry_grams", "cooked_grams", "ml"]);

/** `serving_basis` dal DB → base valida, oppure `null` (valore assente o sconosciuto). */
export function normalizeServingBasis(raw: unknown): MealPlanV2ServingBasis | null {
  return typeof raw === "string" && SERVING_BASES.has(raw) ? (raw as MealPlanV2ServingBasis) : null;
}

/**
 * ── DOVE LA RETE SULLA FIBRA PUÒ MISURARE ────────────────────────────────────────────
 * Una soglia sulla fibra è un CONFRONTO DENTRO UNA POPOLAZIONE: «più fibrosa della pasta
 * di semola» ha senso fra cereali, non fra un cereale e una marmellata. La base di porzione
 * da sola non basta a definire la popolazione — `serving_basis` non è un asse crudo/cotto,
 * è come il catalogo pesa quell'alimento — e usarla come se lo fosse produceva verdetti
 * sbagliati sul CORNETTO: 2,6 g/100 g su base `cooked_grams`, cioè un cornetto intero, finiva
 * oltre la soglia dei cereali cotti (2,5) e usciva dalla colazione pre-sforzo. Un cornetto
 * non è né un cereale integrale né un alimento ricco di fibre: usciva per un artefatto.
 *
 * La popolazione è quindi la coppia (POOL, BASE), e la rete vale solo dove quella coppia
 * raccoglie cereali/carboidrati confrontabili fra loro — più i legumi, che sono ricchi di
 * fibre per definizione in qualunque pool stiano. Sul catalogo vero (499 righe attive, prod
 * 8 set 2026) le popolazioni sono queste:
 *
 *   breakfast_cho × dry_grams   35 righe  pane, fette, fiocchi, corn flakes, crusche → 4,5
 *   breakfast_cho × cooked_grams 8 righe  confetture, miele, sciroppo, crema di cacao,
 *                                         CORNETTO, waffle → NON è una popolazione di
 *                                         cereali: nessuna soglia (decidono le colonne)
 *   breakfast_cho × ml           3 righe  bevande vegetali (max 0,5 g/100 ml): niente da
 *                                         confrontare, la soglia non morderebbe comunque
 *   lunch_carb/dinner_carb × dry 26 righe pasta, riso, farro, farine → 4,5
 *   lunch_carb/dinner_carb × cotto 9 righe riso/orzo/miglio/bulgur cotti, patate, gnocchi,
 *                                         castagne, pasta di legumi → 2,5
 *   legumi (ovunque)                      ceci, fagioli, lenticchie, piselli, fave, lupini,
 *                                         soia, hummus → soglia della loro base
 *
 * Fuori da qui la rete TACE e decidono le due colonne dichiarate (`is_fermented`,
 * `is_wholegrain`), che sono curate a mano e non stimate. Il prezzo è dichiarato e misurato
 * (vedi il report di F2): frutta secca/oleosa, semi e verdure fibrose rientrano nei pasti
 * pre-sforzo, perché nessuno le ha dichiarate e il loro numero non è confrontabile con la
 * soglia dei cereali. Se Mario le vuole fuori serve una TERZA colonna dichiarata, non una
 * soglia allargata su una popolazione sbagliata.
 */
export const FIBER_NET_POOL_BASES: Readonly<Record<string, readonly MealPlanV2ServingBasis[]>> = {
  breakfast_cho: ["dry_grams"],
  lunch_carb: ["dry_grams", "cooked_grams"],
  dinner_carb: ["dry_grams", "cooked_grams"],
};

/**
 * `nutrition_menu_food_meal_roles.substitution_group` dei legumi e derivati vegetali
 * (26 righe: ceci, fagioli, lenticchie, piselli, fave, lupini, soia, hummus + tofu, seitan,
 * tempeh). Non è una lista di legumi cablata: è la dichiarazione che il catalogo già porta.
 * Tofu e seitan ci stanno dentro senza danno — la loro fibra è 0,2÷2,3 g/100 g, sotto ogni
 * soglia — e il tempeh esce comunque da fermentato.
 */
export const FIBER_NET_LEGUME_SUBSTITUTION_GROUP = "PLANT_PROTEIN";

/**
 * Famiglie di rotazione dei legumi: la RETE PER IL DEGRADO. `substitution_group` è una
 * colonna v6 della tabella dei ruoli, e la select ha un retry che ricade su v5; se quel
 * ramo scatta, i legumi resterebbero senza la loro dichiarazione. `rotation_key` invece sta
 * nella select BASE del catalogo e c'è sempre. Copre tutti i legumi del catalogo tranne
 * l'hummus, che non ha rotation_key.
 */
export const FIBER_NET_LEGUME_ROTATION_KEYS: ReadonlySet<string> = new Set([
  "prot:legumi",
  "prot:fagioli",
  "prot:ceci",
  "prot:lenticchie",
  "prot:piselli",
  "prot:fave",
  "prot:lupini",
  "prot:soia",
  "prot:edamame",
]);

/**
 * La fibra di QUESTA riga è confrontabile con una soglia? Vedi {@link FIBER_NET_POOL_BASES}.
 * Risposta negativa = il numero c'è ma non lo si giudica: l'alimento resta affidato alle due
 * colonne dichiarate, non viene né escluso né promosso dalla fibra.
 */
export function fiberNetApplies(input: {
  poolKeys?: readonly string[] | null;
  servingBasis?: unknown;
  substitutionGroup?: unknown;
  rotationKey?: unknown;
}): boolean {
  if (input.substitutionGroup === FIBER_NET_LEGUME_SUBSTITUTION_GROUP) return true;
  if (typeof input.rotationKey === "string" && FIBER_NET_LEGUME_ROTATION_KEYS.has(input.rotationKey)) return true;
  const basis = normalizeServingBasis(input.servingBasis);
  if (!basis) return false;
  for (const pool of input.poolKeys ?? []) {
    if (FIBER_NET_POOL_BASES[pool]?.includes(basis)) return true;
  }
  return false;
}

/** Le risposte per alimento, più i verdetti già calcolati. */
export type MenuFoodFiberFermentedInfo = {
  /**
   * Le DUE COLONNE DICHIARATE sono arrivate su questa riga. `false` = la fonte non ha
   * risposto (select degradata su un ambiente senza le colonne, riga NULL, fixture monca):
   * l'alimento NON è classificato, e nel pasto pre-sforzo il non classificato non passa
   * ({@link isPreEffortExcludedByFacts}). Senza questo campo «colonna assente» tornava
   * indistinguibile da «guardato: non fermentato, non integrale», ed è così che lo yogurt
   * rientrava nel piatto pre-sforzo su un ambiente non migrato.
   */
  classified: boolean;
  /** `nutrition_menu_foods.is_fermented`. */
  fermented: boolean;
  /** `nutrition_menu_foods.is_wholegrain`: proprietà DICHIARATA, non dedotta dalla fibra. */
  wholegrain: boolean;
  /**
   * Fibra per 100 g MISURATA, quando la riga ne porta una: serve alla diagnostica e a
   * dire «di questo alimento una risposta ce l'ho». NON è, da sola, il verdetto: quello lo
   * dà {@link MenuFoodFiberFermentedInfo.overFiberThreshold}, che il numero lo confronta solo
   * dove il confronto ha senso. `null` quando non è misurata **oppure** quando la base è
   * ignota: un numero senza base non è confrontabile con nessuna soglia.
   */
  fiberPer100g: number | null;
  /** La base su cui `fiberPer100g` è misurata; `null` quando la fibra non è utilizzabile. */
  fiberBasis: MealPlanV2ServingBasis | null;
  /** `fiberPer100g` oltre la soglia DELLA SUA BASE. Fibra non confrontabile → false. */
  overFiberThreshold: boolean;
  /**
   * Verdetto del ramo FIBRE della regola: `wholegrain || overFiberThreshold`. Un cereale
   * integrale è «troppo ricco di fibre» nel senso di Mario anche quando la misura sulla sua
   * base dice il contrario (riso integrale cotto: 1,6 g/100 g) — è la misura a essere
   * annacquata, non l'alimento a essere leggero.
   */
  highFiber: boolean;
};

/** fdcId → risposte dell'alimento, costruito dai pool del catalogo già caricati. */
export type MenuFoodFiberFermentedIndex = ReadonlyMap<number, MenuFoodFiberFermentedInfo>;

/**
 * Fibra ignota (o senza base) → false. NON è un fail-closed come per gli allergeni: lì il
 * rischio è sanitario e chiudere protegge, qui chiudere sulle 42 righe senza fibra misurata
 * (quasi tutte carni, pesci e latticini, che fibra non ne hanno) toglierebbe alimenti
 * innocenti dai pasti pre-gara senza guadagnare niente. Gli integrali senza fibra misurata
 * — il grano duro in chicchi — li prende la colonna dichiarata, non questa soglia.
 */
export function isHighFiberPer100g(
  fiberPer100g: number | null | undefined,
  basis: MealPlanV2ServingBasis | null | undefined,
): boolean {
  if (typeof fiberPer100g !== "number" || !Number.isFinite(fiberPer100g)) return false;
  const b = normalizeServingBasis(basis);
  if (!b) return false;
  return fiberPer100g >= fiberThresholdForBasis(b);
}

/**
 * Il verdetto completo della Regola 2: NON CLASSIFICATO oppure fermentato oppure fibra alta.
 *
 * Il primo ramo è il fail-closed, ed è quello che chiude il terzo buco della stessa famiglia
 * (dopo l'allowlist cablata e l'indice vuoto): quando le due colonne dichiarate non arrivano
 * — select degradata su un ambiente senza le migrazioni 20260908150000/160000 — la riga
 * rispondeva «non fermentata, non integrale» e lo yogurt tornava nel piatto pre-sforzo.
 * Assenza di dato non è assenza di problema: nel pasto pre-sforzo l'alimento che nessuno ha
 * classificato non si serve.
 */
export function isPreEffortExcludedByFacts(info: MenuFoodFiberFermentedInfo | null | undefined): boolean {
  return !!info && (!info.classified || info.fermented || info.highFiber);
}

function finiteNumber(raw: unknown): number | null {
  const n =
    typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalizza le colonne DB in {@link MenuFoodFiberFermentedInfo}. I booleani diventano true
 * SOLO su un true esplicito: «non classificato» non deve diventare «fermentato» né «integrale».
 * E «non classificato» resta riconoscibile: {@link MenuFoodFiberFermentedInfo.classified} è
 * true solo quando ENTRAMBE le colonne dichiarate arrivano come booleani veri — rispondono a
 * due metà diverse della regola (i fermentati e i cereali integrali), e mezza risposta non è
 * una risposta.
 *
 * `fiberPer100g` è la fibra CONFRONTABILE, cioè quella che la soglia può giudicare: chi
 * chiama decide se il numero appartiene a una popolazione confrontabile ({@link fiberNetApplies})
 * e passa `null` quando non lo è. `facts.measuredFiberPer100g` porta invece il numero grezzo
 * anche in quel caso: non entra nel verdetto, ma resta nell'indice come prova che
 * dell'alimento una misura esiste.
 *
 * `facts.servingBasis` è la base su cui la fibra è misurata. Chiamare senza è legittimo — è
 * il caso di chi ha in mano solo due numeri e non sa su che base siano — e in quel caso la
 * fibra torna `null`: non confrontabile, quindi non usata. Il verdetto lo dà allora l'indice
 * per fdcId (`buildMenuFoodFiberFermentedIndex`), che la base ce l'ha.
 */
export function menuFoodFiberFermentedInfo(
  isFermented: unknown,
  fiberPer100g: unknown,
  facts?: { isWholegrain?: unknown; servingBasis?: unknown; measuredFiberPer100g?: unknown },
): MenuFoodFiberFermentedInfo {
  const basis = normalizeServingBasis(facts?.servingBasis);
  const comparable = finiteNumber(fiberPer100g);
  // Senza base il numero non è confrontabile: si comporta come una fibra non misurata.
  const fiber = basis ? comparable : null;
  const wholegrain = facts?.isWholegrain === true;
  const overFiberThreshold = isHighFiberPer100g(fiber, basis);
  // La misura grezza vale come «risposta esiste» anche dove la soglia non si applica.
  const shown = fiber ?? (basis ? finiteNumber(facts?.measuredFiberPer100g) : null);
  return {
    classified: typeof isFermented === "boolean" && typeof facts?.isWholegrain === "boolean",
    fermented: isFermented === true,
    wholegrain,
    fiberPer100g: shown,
    fiberBasis: shown == null ? null : basis,
    overFiberThreshold,
    highFiber: wholegrain || overFiberThreshold,
  };
}
