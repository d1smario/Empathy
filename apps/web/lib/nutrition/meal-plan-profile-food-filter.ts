import type {
  IntelligentMealPlanFoodOptionRef,
  IntelligentMealPlanFunctionalFoodGroup,
  IntelligentMealPlanRequest,
  IntelligentMealPlanRequestSlot,
} from "@/lib/nutrition/intelligent-meal-plan-types";

/** Frasi utente (intolleranza/allergia/esclusione) → sottostringhe da cercare nelle etichette. */
const PHRASE_TO_DENY_FRAGMENTS: Array<{ match: RegExp; fragments: string[] }> = [
  { match: /lattos|lactose|latteos|dairy|casein|caseina/i, fragments: [
      "latte", "lactose", "yogurt", "yoghurt", "ricotta", "mascarpone", "mozzarella",
      "parmigiano", "pecorino", "formaggio", "burro", "panna", "cream", "whey", "siero",
      "cottage", "kefir", "latticino",
    ] },
  { match: /glutin|gluten|celiac|celiaca|celiachia/i, fragments: [
      "glutine", "gluten", "grano", "wheat", "orzo", "barley", "segale", "rye", "farro",
      "spelt", "kamut", "triticale", "semola", "couscous", "bulgur", "frumento",
    ] },
  { match: /uov|egg|ovo/i, fragments: ["uov", "ovo", "album", "egg", "mayo", "maionese"] },
  { match: /arachid|peanut|groundnut/i, fragments: ["arachid", "peanut", "groundnut"] },
  { match: /frutta\s*a\s*guscio|tree\s*nut|nocciol|mandorl|noci\b|nocciole|pistacch|anacard|macadamia|pecan/i,
    fragments: ["mandorl", "nocciole", "noci", "pistacch", "anacard", "macadamia", "pecan", "noce "] },
  { match: /soia|soy|soja/i, fragments: ["soia", "soy", "soja", "tofu", "edamame", "miso"] },
  { match: /pesce|fish\b|ittic/i, fragments: ["pesce", "fish", "tonno", "salmone", "sgombro", "acciug", "merluzz", "gamber", "gambero", "calamar", "polpo", "cozze", "ostric"] },
  { match: /crostace|shellfish|mollusc/i, fragments: ["gamber", "aragost", "granchio", "cozze", "ostric", "calamar", "polpo"] },
  { match: /sesam|sesamo/i, fragments: ["sesam", "sesamo", "tahin"] },
  { match: /senap|mustard/i, fragments: ["senap", "mustard"] },
  { match: /sedan|celery|sedano/i, fragments: ["sedan", "celery", "sedano"] },
  { match: /lupin/i, fragments: ["lupin"] },
  { match: /mais|corn\b/i, fragments: ["mais", "corn", "cornmeal", "polenta"] },
];

const DIET_DENY: Record<string, string[]> = {
  vegan: [
    "pollo", "tacchino", "manzo", "maiale", "agnello", "prosciutto", "salame", "salsicc",
    "carne", "bresaola", "cotechino", "wurstel", "bacon", "pancetta",
    "pesce", "tonno", "salmone", "sgombro", "acciug", "merluzz", "gamber", "gambero",
    "calamar", "polpo", "cozze", "ostric",
    "uov", "ovo", "album",
    /** Latticini animali: NON includere "yogurt"/"yoghurt"/"latte"/"kefir" generici qui:
     *  il composer vegan emette "Yogurt vegetale", "Bevanda vegetale" che sono OK e
     *  contengono ancora le sottostringhe "yogurt"/"latte". La logica `breakfastDairyBlocked`
     *  + `dietType==="vegan"` nel composer redirige gia' allo specifico vegetale. */
    "formaggio", "burro", "panna", "ricotta", "parmigiano",
    "mozzarella", "mascarpone", "pecorino", "whey", "cottage",
    /** "Latte vaccino", "Latte di capra" usano specifico: il dietType="vegan" del composer
     *  filtra il pool BREAKFAST_BEVERAGES.animal=true a monte. */
    "latte vaccino", "latte di capra", "latte di pecora", "latte di mucca",
    "yogurt vaccino", "yogurt greco", "yogurt animale",
    "miele", "honey", "gelatina", "gelatin",
  ],
  vegetarian: [
    "pollo", "tacchino", "manzo", "maiale", "agnello", "prosciutto", "salame", "salsicc",
    "carne", "bresaola", "cotechino", "wurstel", "bacon", "pancetta",
    "pesce", "tonno", "salmone", "sgombro", "acciug", "merluzz", "gamber", "gambero",
    "calamar", "polpo", "cozze", "ostric",
  ],
  pescatarian: [
    "pollo", "tacchino", "manzo", "maiale", "agnello", "prosciutto", "salame", "salsicc",
    "carne", "bresaola", "cotechino", "wurstel", "bacon", "pancetta",
  ],
};

function normalizePhrase(s: string): string {
  return s.trim().toLowerCase();
}

function collectFragmentsFromUserList(entries: string[] | null | undefined, out: Set<string>): void {
  for (const raw of entries ?? []) {
    const phrase = normalizePhrase(String(raw));
    if (phrase.length < 2) continue;
    out.add(phrase);
    for (const row of PHRASE_TO_DENY_FRAGMENTS) {
      if (row.match.test(phrase)) {
        for (const f of row.fragments) out.add(f);
      }
    }
  }
}

function dietDenyFragments(dietType: string | null | undefined): string[] {
  const d = normalizePhrase(dietType ?? "");
  if (!d || d === "omnivore" || d === "other") return [];
  if (d === "vegan") return [...DIET_DENY.vegan];
  if (d === "vegetarian") return [...DIET_DENY.vegetarian];
  if (d === "pescatarian") return [...DIET_DENY.pescatarian];
  if (d.includes("vegan")) return [...DIET_DENY.vegan];
  if (d.includes("veget")) return [...DIET_DENY.vegetarian];
  if (d.includes("pesc")) return [...DIET_DENY.pescatarian];
  return [];
}

/** Sottostringhe vietate (lowercase, lunghezza ≥ 2) da applicare a label + rationale opzioni. */
export function buildMealPlanFoodDenyFragments(req: IntelligentMealPlanRequest): string[] {
  const set = new Set<string>();
  collectFragmentsFromUserList(req.allergies ?? undefined, set);
  collectFragmentsFromUserList(req.intolerances ?? undefined, set);
  collectFragmentsFromUserList(req.foodExclusions ?? undefined, set);
  for (const f of dietDenyFragments(req.dietType)) set.add(f);
  return [...set].filter((s) => s.length >= 2);
}

function textMatchesDeny(text: string, fragments: string[]): boolean {
  const t = text.toLowerCase();
  return fragments.some((f) => t.includes(f));
}

/**
 * Estrae in modo difensivo gli fdcId da `nutrition_config.excluded_fdc_foods`
 * (`[{ fdcId, label }]`, globale). Tollera JSON malformato / chiavi extra, tiene solo
 * fdcId numerici finiti e deduplica. Con input assente/vuoto → `[]` (nessun effetto).
 */
export function readExcludedFdcIds(nutritionConfig: unknown): number[] {
  const rec =
    nutritionConfig && typeof nutritionConfig === "object" && !Array.isArray(nutritionConfig)
      ? (nutritionConfig as Record<string, unknown>)
      : null;
  const raw = rec?.excluded_fdc_foods;
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = Number(r.fdcId ?? r.fdc_id);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Estrae le `label` da `nutrition_config.excluded_fdc_foods` (`[{ fdcId, label }]`, globale).
 * Parallelo a {@link readExcludedFdcIds}: serve a far rientrare i cibi esclusi dal picker anche
 * nel deny testuale (`buildMealPlanFoodDenyFragments` → composizione/arricchimento pasti), non solo
 * nel filtro opzioni per fdcId. Tollera JSON malformato, fa trim, scarta le vuote e deduplica
 * (case-insensitive). Con input assente/vuoto → `[]` (nessun effetto, retro-compat).
 */
export function readExcludedFoodLabels(nutritionConfig: unknown): string[] {
  const rec =
    nutritionConfig && typeof nutritionConfig === "object" && !Array.isArray(nutritionConfig)
      ? (nutritionConfig as Record<string, unknown>)
      : null;
  const raw = rec?.excluded_fdc_foods;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const label = String(r.label ?? "").trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

function optionAllowed(
  o: IntelligentMealPlanFoodOptionRef,
  fragments: string[],
  excludedFdcIds: Set<number>,
): boolean {
  if (o.fdcId != null && excludedFdcIds.has(o.fdcId)) return false;
  if (textMatchesDeny(o.label, fragments)) return false;
  if (o.rationale && textMatchesDeny(o.rationale, fragments)) return false;
  return true;
}

function filterGroup(
  g: IntelligentMealPlanFunctionalFoodGroup,
  fragments: string[],
  excludedFdcIds: Set<number>,
): IntelligentMealPlanFunctionalFoodGroup | null {
  const options = g.options.filter((o) => optionAllowed(o, fragments, excludedFdcIds));
  if (options.length === 0) return null;
  return { ...g, options };
}

function filterSlot(
  slot: IntelligentMealPlanRequestSlot,
  fragments: string[],
  excludedFdcIds: Set<number>,
): IntelligentMealPlanRequestSlot {
  const groups = slot.functionalFoodGroups
    .map((g) => filterGroup(g, fragments, excludedFdcIds))
    .filter((g): g is IntelligentMealPlanFunctionalFoodGroup => g != null);
  const nutrientIds = new Set(groups.map((g) => g.nutrientId));
  const functionalTargets = slot.functionalTargets.filter((t) => nutrientIds.has(t.nutrientId));
  const foodCandidates = slot.foodCandidates.filter((c) => !textMatchesDeny(c, fragments));
  return {
    ...slot,
    functionalFoodGroups: groups,
    functionalTargets,
    foodCandidates: [...new Set(foodCandidates)],
  };
}

/**
 * Rimuove opzioni/candidati che urtano allergie, intolleranze, esclusioni e tipo di dieta dichiarato.
 * Euristica per sottostringhe su etichette curate/USDA (non sostituisce validazione clinica).
 */
export function filterIntelligentMealPlanRequestFoods(req: IntelligentMealPlanRequest): IntelligentMealPlanRequest {
  const fragments = buildMealPlanFoodDenyFragments(req);
  const excludedFdcIds = new Set<number>((req.excludedFdcIds ?? []).filter((n) => Number.isFinite(n)));
  if (fragments.length === 0 && excludedFdcIds.size === 0) return req;
  return {
    ...req,
    slots: req.slots.map((s) => filterSlot(s, fragments, excludedFdcIds)),
  };
}

// ── Classi allergeniche (vocabolario CHIUSO) ─────────────────────────────────────────
// Contratto condiviso con le colonne `nutrition_menu_foods.allergen_classes text[]` e
// `nutrition_menu_foods.allergens_reviewed boolean`: 14 token, gli allergeni ad
// etichettatura obbligatoria (Reg. UE 1169/2011 All. II). Solo le frasi CLINICHE che
// l'atleta scrive nel Profilo (allergie e intolleranze) vengono mappate a queste classi:
// il filtro del meal-plan decide sulle CLASSI, non sulle sottostringhe della descrizione
// (che restano solo come rete secondaria — vedi fdc-candidate-filter). Le esclusioni per
// GUSTO restano invece dov'erano: `buildMealPlanFoodDenyFragments`, filtro per etichetta.
export const ALLERGEN_CLASS_TOKENS = [
  "glutine",
  "crostacei",
  "uova",
  "pesce",
  "arachidi",
  "soia",
  "latte",
  "frutta_a_guscio",
  "sedano",
  "senape",
  "sesamo",
  "solfiti",
  "lupini",
  "molluschi",
] as const;

export type AllergenClassToken = (typeof ALLERGEN_CLASS_TOKENS)[number];

const ALLERGEN_CLASS_TOKEN_SET: ReadonlySet<string> = new Set<string>(ALLERGEN_CLASS_TOKENS);

/** Rimuove i diacritici e abbassa: "Frutta à Guscio" → "frutta a guscio". */
function foldPhrase(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Normalizza un valore letto dal DB (o scritto a mano in admin) verso un token del
 * vocabolario chiuso: tollera maiuscole, accenti, spazi/trattini al posto di `_`
 * ("Frutta a guscio" → `frutta_a_guscio`). Valore fuori vocabolario → null (SCARTATO:
 * un token inventato non deve poter “assolvere” un alimento).
 */
export function normalizeAllergenClassToken(raw: unknown): AllergenClassToken | null {
  if (typeof raw !== "string") return null;
  const key = foldPhrase(raw).replace(/[\s\-.]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return ALLERGEN_CLASS_TOKEN_SET.has(key) ? (key as AllergenClassToken) : null;
}

/** Normalizza una lista di token (DB / input utente): scarta gli ignoti e deduplica. */
export function normalizeAllergenClassList(raw: unknown): AllergenClassToken[] {
  if (!Array.isArray(raw)) return [];
  const out: AllergenClassToken[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const token = normalizeAllergenClassToken(item);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

// ── Falsi amici: BASE ambigua + MODIFICATORE ─────────────────────────────────────────
// Alcune parole, da sole, non dicono a quale classe appartiene un alimento: «latte»,
// «burro»/«butter», «noce», «grano», «malto» sono BASI ambigue, e a smentirle è il
// MODIFICATORE che compare nella stessa voce («di mandorla», «almond», «saraceno»,
// «di cocco»). Elencare a mano le locuzioni non regge: ogni giro ne restava fuori una
// (l'ordine inglese «almond milk», i connettori «alle/agli», le parole in mezzo
// «di soia biologico», «burro di cacao»). Qui il riconoscimento è POSIZIONALE-LIBERO:
// se un modificatore noto compare da qualche parte nella stessa voce, la base ambigua
// non conta come classe e viene tolta prima del match. Il modificatore resta e produce
// la SUA classe: «latte di mandorle» → solo `frutta_a_guscio`.
//
// Il rovescio — «latte e mandorle», due allergeni ELENCATI insieme, che devono restare
// due — è tenuto distinto dalla SEGMENTAZIONE: la frase viene prima spezzata sui
// separatori d'elenco (virgola, «e», «con», «/», …) e ogni voce si disambigua da sola.
// Quindi «latte e mandorle» → latte + frutta_a_guscio, «latte di mandorle» → solo il secondo.
//
// Un falso positivo qui non è prudenza: la classe accesa per sbaglio arma anche il
// fail-closed di `fdc-candidate-filter`, e all'atleta sparisce pure ogni alimento non
// ancora classificato. Per questo le basi sono SOLO le parole davvero ambigue: il resto
// del vocabolario del latte (lattosio, caseina, ricotta, mozzarella, whey, kefir…) non
// è neutralizzabile da nessun modificatore.

type FalseFriendBase = "dairy" | "fat" | "nut" | "grano" | "malto";

/** Le parole ambigue, per base. Sono le uniche che un modificatore può togliere. */
const FALSE_FRIEND_BASE_WORDS: Record<FalseFriendBase, RegExp> = {
  dairy: /\b(?:latte|milk|yogh?urt|panna|cream|cheese|formagg\w*)\b/g,
  fat: /\b(?:burro|butter)\b/g,
  nut: /\bnoc[ei]\b/g,
  grano: /\bgrano\b/g,
  malto: /\bmalto\b/g,
};

/**
 * Modificatori noti e quali basi smentiscono, in italiano e in inglese, in qualunque
 * posizione della voce. Casi verificati eseguendo la funzione, uno per uno a test:
 *   - i derivati VEGETALI non sono latte: «latte di mandorla», «almond milk», «soy yogurt»;
 *   - il cocco non è né latte né frutta a guscio (fuori dai 14 allergeni UE): «noce di cocco»;
 *   - «burro di cacao» e «shea butter» sono grassi, non latticini — ma il cacao smentisce
 *     SOLO il grasso: «latte al cacao» resta latte (ed è quello che dice il catalogo);
 *   - «grano saraceno»/«grano turco» non sono frumento, «malto di riso»/«di mais» non
 *     hanno glutine (il malto d'orzo sì);
 *   - «noce moscata» è una spezia e «pesca noce» è una pesca.
 */
const FALSE_FRIEND_MODIFIERS: Array<{
  pattern: RegExp;
  neutralizes: FalseFriendBase[];
  /** Qualifica la base direttamente, senza connettore: «grano saraceno», «noce moscata». */
  aggettivo?: boolean;
}> = [
  // Frutta a guscio, arachidi, semi: la classe la mettono loro, non la base.
  { pattern: /\bmandorl\w*\b|\balmonds?\b/, neutralizes: ["dairy", "fat"] },
  { pattern: /\banacard\w*\b|\bcashews?\b/, neutralizes: ["dairy", "fat"] },
  { pattern: /\bnocciol\w*\b|\bhazelnuts?\b/, neutralizes: ["dairy", "fat"] },
  { pattern: /\bpistacch\w*\b|\bpistachios?\b/, neutralizes: ["dairy", "fat"] },
  {
    pattern: /\bmacadamia\b|\bpecans?\b|\bpinol\w*\b|\bpine ?nuts?\b|\bcastagn\w*\b|\bchestnuts?\b/,
    neutralizes: ["dairy", "fat"],
  },
  { pattern: /\bnoc[ei]\b|\bwalnuts?\b/, neutralizes: ["dairy", "fat"] },
  { pattern: /\barachid\w*\b|\bpeanuts?\b|\bgroundnuts?\b/, neutralizes: ["dairy", "fat"] },
  { pattern: /\bsesamo\b|\bsesame\b|\btahin\w*\b/, neutralizes: ["dairy", "fat"] },
  // «semi» solo davanti al complemento («semi di girasole»): «latte semi-scremato» è latte.
  {
    pattern: /\bsemi\s+d[ie]\b|\bseeds?\b|\bgirasole\b|\bsunflower\b|\bzucca\b|\bpumpkin\b|\bflax\w*\b/,
    neutralizes: ["dairy", "fat"],
  },
  // Legumi e cereali: bevande e «burri» vegetali.
  { pattern: /\bsoia\b|\bsoja\b|\bsoy\w*\b/, neutralizes: ["dairy", "fat"] },
  { pattern: /\bavena\b|\boats?\b/, neutralizes: ["dairy", "fat"] },
  { pattern: /\briso\b|\brice\b/, neutralizes: ["dairy", "fat", "malto"] },
  { pattern: /\bmais\b|\bcorn\w*\b/, neutralizes: ["malto"] },
  { pattern: /\bcanapa\b|\bhemp\b|\bquinoa\b|\bmiglio\b|\bmillet\b/, neutralizes: ["dairy", "fat"] },
  { pattern: /\bcocco\b|\bcoconut\b|\bcocos\b/, neutralizes: ["dairy", "fat", "nut"] },
  // Grassi non caseari. Solo il grasso, mai il latte: vedi «latte al cacao».
  { pattern: /\bcacao\b|\bcocoa\b|\bkarit\w*\b|\bshea\b/, neutralizes: ["fat"] },
  // Dichiarazione esplicita di prodotto vegetale.
  { pattern: /\bvegetal\w*\b|\bvegan\w*\b|\bplant ?based\b/, neutralizes: ["dairy", "fat"], aggettivo: true },
  // Il grano che non è frumento e le noci che non sono frutta a guscio.
  { pattern: /\bsaracen\w*\b|\bbuckwheat\b|\bturco\b/, neutralizes: ["grano"], aggettivo: true },
  { pattern: /\bmoscat[ae]\b|\bnutmegs?\b/, neutralizes: ["nut"], aggettivo: true },
  { pattern: /\bpesc(?:a|he)\b|\bnettarin\w*\b|\bnectarines?\b/, neutralizes: ["nut"], aggettivo: true },
];

/**
 * Frase libera → voci d'elenco. Minuscole, via i diacritici, apostrofi e parentesi
 * diventano spazio, poi si spezza sui separatori d'elenco. La segmentazione è ciò che
 * tiene separato l'ELENCO («latte e mandorle» = due allergeni) dal MODIFICATORE
 * («latte di mandorle» = uno solo).
 */
function splitFoodPhraseIntoItems(raw: string): string[] {
  const folded = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’ʼ`()[\]{}"«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return folded
    .split(/\s*[,;/|+&]\s*|\s+(?:e|ed|o|od|oppure|con|and|or|with|plus)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

/**
 * Toglie da UNA voce d'elenco le basi ambigue smentite dai modificatori presenti nella
 * voce stessa. Non tocca il resto: la classe del modificatore sopravvive.
 *
 * LA REGOLA È POSIZIONALE, e in italiano è netta: **`di` compone, `al` insaporisce.**
 *   «latte DI mandorla» → non è latte      «riso AL latte» → è latte
 *   «yogurt DI soia»    → non è latte      «yogurt AL cocco» → è latte
 * Quindi la base viene tolta SOLO quando il modificatore la segue introdotto da `di/d'`
 * (composizione), mai da `al/alla/agli/…` (aroma). In inglese il modificatore PRECEDE la
 * base senza connettore («almond milk», «shea butter»), e quella forma vale come `di`.
 *
 * Perché il vincolo di posizione non si può togliere: senza, un modificatore ovunque nella
 * frase cancella la base e si producono FALSI NEGATIVI su alimenti che l'allergene ce
 * l'hanno davvero — «riso al latte» → nessuna classe. Fra i due errori possibili questo è
 * quello che fa male: un falso positivo restringe il pool, un falso negativo mette in
 * tavola l'allergene. Nel dubbio la base RESTA.
 */
function neutralizeFalseFriends(item: string): string {
  let out = item;
  for (const { pattern, neutralizes, aggettivo } of FALSE_FRIEND_MODIFIERS) {
    const mod = pattern.source;
    for (const base of neutralizes) {
      const baseSrc = FALSE_FRIEND_BASE_WORDS[base].source;
      // IT: base + «di/d'» + (fino a 2 parole) + modificatore → composizione.
      // `d'` è già stato ripiegato a spazio dalla segmentazione: «burro d'arachidi» arriva
      // qui come «burro d arachidi», quindi il connettore vale anche nella forma tronca.
      const composto = new RegExp(
        `(${baseSrc})(\\s+(?:\\w+\\s+){0,2}d(?:i)?\\s+(?:\\w+\\s+){0,2}(?:${mod}))`,
        "g",
      );
      // EN: modificatore + (eventuale trattino/spazio) + base → «almond milk», «shea butter».
      const inglese = new RegExp(`((?:${mod})[\\s-]+)(${baseSrc})`, "g");
      out = out.replace(composto, (_m, _b, coda) => ` ${coda}`).replace(inglese, (_m, testa) => `${testa} `);
      if (aggettivo) {
        // Terza forma: la base + l'aggettivo che la smentisce, senza connettore.
        out = out.replace(new RegExp(`(${baseSrc})(\\s+(?:${mod}))`, "g"), (_m, _b, coda) => ` ${coda}`);
      }
    }
  }
  return out;
}

/**
 * Frase libera dell'atleta → classi. Estende `PHRASE_TO_DENY_FRAGMENTS` (che resta la
 * rete per sottostringhe): stesse famiglie, ma il risultato ora è una CLASSE.
 * Trappole reali coperte dai pattern:
 *   - "pesca"/"pesche"/"pesca noce" NON sono `pesce` (\bpesc[ei]\b);
 *   - "peanut" NON è `frutta_a_guscio` (\bnuts?\b non aggancia "peanut"/"coconut").
 * Le basi ambigue ("burro di arachidi", "grano saraceno", "latte di cocco", "noce
 * moscata") sono già state tolte PRIMA da {@link neutralizeFalseFriends}: qui arriva
 * una voce d'elenco per volta, senza le parole smentite dai suoi modificatori.
 */
const PHRASE_TO_ALLERGEN_CLASSES: Array<{ match: RegExp; classes: AllergenClassToken[] }> = [
  {
    match:
      /glutin|gluten|celiac|celiach|coeliac|frumento|\bwheat\b|\bgrano\b|\borzo\b|barley|segale|\brye\b|\bfarro\b|\bspelt\b|kamut|triticale|semola|semolino|cous ?cous|couscous|bulgur|seitan|\bmalto\b/,
    classes: ["glutine"],
  },
  {
    match:
      /lattos|lactose|\blatte\b|latticin|latticell|\bdairy\b|casein|\bmilk\b|formaggio|formaggi\b|cheese|yogurt|yoghurt|\bpanna\b|\bcream\b|ricotta|mozzarella|parmigian|pecorino|mascarpone|\bwhey\b|siero di latte|kefir|cottage|\bburro\b|\bbutter\b/,
    classes: ["latte"],
  },
  { match: /\buov[ao]\b|\buova\b|\bovo\b|albume|tuorlo|\begg/, classes: ["uova"] },
  {
    match:
      /\bpesc[ei]\b|\bfish\b|\bittic|\btonno\b|\btuna\b|salmon|merluzz|\bcod\b|sgombro|mackerel|acciug|anchov|sardin|\btrota\b|\btrout\b|branzino|\borata\b|spigola|aringa|herring|nasello|platessa|baccal|\bsogliola\b|pesce spada/,
    classes: ["pesce"],
  },
  {
    match:
      /crostace|crustace|shellfish|gamber|\bshrimp\b|\bprawn|aragost|lobster|granchio|\bcrab\b|scampi|\bastice\b|mazzancoll|\bkrill\b/,
    classes: ["crostacei"],
  },
  {
    match:
      /mollusc|\bclam\b|vongol|\bcozze\b|mussel|ostrich?e\b|\boyster|calamar|\bsquid\b|\bpolpo\b|octopus|\bseppi[ae]\b|capesant|scallop|lumach|\bsnail/,
    classes: ["molluschi"],
  },
  { match: /arachid|peanut|groundnut/, classes: ["arachidi"] },
  {
    match:
      /frutta a guscio|frutta secca|tree ?nuts?|\bnuts?\b|\bnoci\b|\bnoce\b|nocciol|mandorl|almond|hazelnut|anacard|cashew|pistacch|pistachio|macadamia|\bpecan\b|\bpinol|pine ?nut|walnut|noce del brasile|brazil ?nut/,
    classes: ["frutta_a_guscio"],
  },
  { match: /\bsoia\b|\bsoy\b|soybean|\bsoja\b|\btofu\b|edamame|\bmiso\b|tempeh|tamari|\bshoyu\b/, classes: ["soia"] },
  { match: /\bsedan[oi]\b|\bcelery\b|celeriac/, classes: ["sedano"] },
  { match: /\bsenap|mustard/, classes: ["senape"] },
  { match: /sesam|tahin|gomasio/, classes: ["sesamo"] },
  { match: /solfit|sulphite|sulfite|anidride solforosa|\bso2\b|metabisolfit/, classes: ["solfiti"] },
  { match: /\blupin/, classes: ["lupini"] },
];

/**
 * FUNZIONE PURA — frasi libere → classi del vocabolario chiuso, dedup e in ordine di
 * catalogo. Ogni frase viene prima spezzata in voci d'elenco e ogni voce disambiguata
 * dai suoi modificatori, così una frase può produrre più classi ("noci e latte" →
 * frutta_a_guscio + latte) senza che il modificatore di una voce ne assolva un'altra.
 * Una frase che non mappa nulla ("paprika", "kiwi") non produce classi: resta al filtro
 * per sottostringa (rete secondaria), esattamente come oggi.
 */
export function mapFoodPhrasesToAllergenClasses(
  phrases: ReadonlyArray<string | null | undefined> | null | undefined,
): AllergenClassToken[] {
  const found = new Set<AllergenClassToken>();
  for (const raw of phrases ?? []) {
    if (typeof raw !== "string") continue;
    for (const item of splitFoodPhraseIntoItems(raw)) {
      const text = neutralizeFalseFriends(item);
      for (const row of PHRASE_TO_ALLERGEN_CLASSES) {
        if (row.match.test(text)) {
          for (const c of row.classes) found.add(c);
        }
      }
    }
  }
  return ALLERGEN_CLASS_TOKENS.filter((t) => found.has(t));
}

export type AthleteAllergenClasses = {
  /** Classi da ALLERGIE + INTOLLERANZE: le uniche che armano classi e fail-closed. */
  allergyClasses: AllergenClassToken[];
  /**
   * SEMPRE VUOTO. Le esclusioni alimentari sono una preferenza di GUSTO, non una
   * diagnosi: non devono togliere un'intera famiglia di cibi né armare il fail-closed
   * sui cibi non ancora classificati. Campo tenuto per i chiamanti che lo passano
   * ancora a `createAllergenFilterContext` (dove è opzionale).
   * @deprecated le esclusioni si applicano per etichetta, non per classe.
   */
  exclusionClasses: AllergenClassToken[];
  /** Alias di `allergyClasses` (ordine di catalogo). */
  all: AllergenClassToken[];
};

/**
 * Classi CLINICHE dichiarate dall'atleta: solo allergie e intolleranze.
 *
 * Le esclusioni per gusto (`foodExclusions`) restano dove sono sempre state — il filtro
 * morbido per etichetta di `buildMealPlanFoodDenyFragments` — perché mapparle a classi
 * cambierebbe due volte il loro significato: chi scrive «noci» perché non gli piacciono
 * si vedrebbe sparire tutta la frutta a guscio e, con il fail-closed armato, anche ogni
 * alimento non ancora classificato.
 */
export function buildAthleteAllergenClasses(
  req: Pick<IntelligentMealPlanRequest, "allergies" | "intolerances" | "foodExclusions"> | null | undefined,
): AthleteAllergenClasses {
  const allergyClasses = mapFoodPhrasesToAllergenClasses([
    ...(req?.allergies ?? []),
    ...(req?.intolerances ?? []),
  ]);
  return { allergyClasses, exclusionClasses: [], all: [...allergyClasses] };
}
