-- Allergeni del catalogo `nutrition_menu_foods`: la TERZA VIA («incerto») e il vocabolario senza duplicati.
--
-- PERCHÉ. La migrazione dati 20260908090100 ha marcato `allergens_reviewed = true` su tutte
-- le 499 righe attive. Nella sua intestazione dichiarava però di NON aver classificato alcune
-- famiglie («salumi/wurstel/mortadella: allergeni dipendenti dalla marca») e poi le scriveva
-- comunque come esaminate con elenco vuoto. Dati e documentazione si contraddicevano, e il
-- risultato pratico era peggiore della contraddizione: mortadella, wurstel, salame e salsiccia
-- risultavano «esaminati e senza allergeni», cioè SICURI, e il fail-closed del filtro
-- (`isAllergenExcludedInfo`, ramo b) smetteva di scattare su di loro. Il difetto che il filtro
-- per classi doveva chiudere rientrava dai dati.
--
-- COSA DECIDE QUESTA MIGRAZIONE. Le 267 righe attive che erano `allergens_reviewed = true` con
-- `allergen_classes = {}` sono state riesaminate una per una. Gli esiti possibili sono TRE, e
-- sono tre cose diverse:
--   1. CLASSIFICATA        → classi piene + reviewed = true;
--   2. GENUINAMENTE PULITA → `{}` + reviewed = true. È un fatto verificato: mela, riso, olio EVO,
--                            petto di pollo fresco, verdure, legumi secchi, carni e pesci freschi
--                            non portano allergeni dell'Allegato II;
--   3. INCERTA             → `{}` + reviewed = FALSE. La lista ingredienti dipende dalla MARCA o
--                            dalla RICETTA: non è «senza allergeni», è «non lo sappiamo». Con
--                            reviewed = false il fail-closed la esclude per chi ha dichiarato
--                            un'allergia, invece di dichiararla sicura. Nel dubbio si sceglie
--                            questa terza via.
--
-- ESITO REALE DEL RIESAME: 0 righe da classificare (nessuna delle 267 porta un allergene CERTO
-- non ancora scritto), 246 confermate genuinamente pulite, 21 spostate su «incerta». Il buco era
-- tutto nella terza via mancante, non in classi dimenticate.
--
-- LE 21 RIGHE INCERTE, con il motivo per famiglia:
--   * salumi, affettati e carni conservate (14) — bresaola, chicken_breast_deli, coppa,
--     corned_beef_canned, ham_cooked, mortadella, pork_belly_cured, prosciutto_crudo,
--     roast_beef_deli, salame, salsiccia, speck, turkey_breast_deli, wurstel.
--     Nella realtà italiana questi prodotti contengono con altissima frequenza lattosio (latte),
--     derivati della soia, senape e solfiti; la mortadella porta spesso pistacchi
--     (frutta a guscio). Quali di questi ci siano dipende dalla singola etichetta: non si può
--     rispondere per la categoria. Il prosciutto crudo DOP sarebbe carne e sale, ma la voce di
--     catalogo è generica e segue la sorte della famiglia.
--   * voci generiche (3) — legumes_cooked («Legumi»), jam_preserves («Confettura»),
--     pasta_legumes («Pasta di legumi»). Denotano una CLASSE di alimenti, non un alimento: soia e
--     lupini sono legumi, e una pasta di legumi può esserne fatta. La voce, da sola, non
--     determina gli ingredienti.
--   * conserve di frutta zuccherate (2) — jam_apricot, marmalade_orange. La frutta di partenza
--     può essere solfitata (i solfiti residui vanno dichiarati) e gli ingredienti variano.
--   * cereali soffiati da colazione (1) — puffed_rice. Il malto d'orzo (glutine) è additivo di
--     prassi: è la stessa ragione per cui corn_flakes era già stato classificato «glutine».
--   * frutta essiccata (1) — dates_medjool. La solfitazione dipende dal produttore, e tutta la
--     famiglia frutta essiccata (albicocche, mele, pere, prugne, fichi, uvetta…) era già stata
--     classificata «solfiti»: i datteri erano l'unica rimasta fuori.
--
-- RIGHE RIESAMINATE E LASCIATE PULITE DI PROPOSITO (perché la domanda è già stata posta):
--   * chestnuts (castagne) e coconut / coconut_oil (cocco): sono state ESAMINATE e NON portano
--     allergeni dell'Allegato II — castagne e cocco non sono nell'elenco EU della frutta a guscio
--     (il cocco è tree nut solo per la FDA). `{}` + reviewed = true qui è una classificazione, non
--     un'astensione. Questa riga di commento sostituisce la formula «NON classificati» della
--     migrazione precedente, che faceva sembrare non guardato ciò che era stato deciso.
--   * coconut_milk e rice_drink: formulazioni industriali, ma il prodotto con quel nome ha una
--     lista ingredienti costantemente priva di allergeni EU; restano puliti anche perché il filtro
--     deve continuare a NON toglierli a un allergico al latte (è il falso positivo da sottostringa
--     che il lavoro precedente ha corretto).
--   * quinoa_puffed: resta pulita anche perché condivide `fdc_id` con quinoa_dry (168874), e
--     l'indice del filtro è per fdcId: marcarla incerta trascinerebbe la quinoa secca.
--   * rice_cakes, corn_cakes, pasta_corn_gf: monocereale/senza glutine dichiarato.
--
-- IDEMPOTENTE: ogni UPDATE riscrive l'intero valore; rieseguirla non cambia nulla.

-- ── 1. Il CHECK del vocabolario accettava i duplicati ────────────────────────────────────────
-- `allergen_classes <@ vocabolario` dice solo «ogni elemento appartiene all'elenco»: array
-- ['latte','latte'] passava (verificato in produzione con un UPDATE poi annullato). Un elenco con
-- ripetizioni non è sbagliato per il filtro, che ragiona per insiemi, ma è un dato malformato che
-- nessuno intercetta e che falsa qualsiasi conteggio. Qui il vincolo diventa: nessun elemento
-- NULL, ogni elemento nel vocabolario, ogni token AL PIÙ UNA VOLTA — la somma dei 14 token
-- presenti deve coincidere con la lunghezza dell'array. Espressione pura (niente sottoquery,
-- niente funzioni esterne): un CHECK deve restare autosufficiente.
alter table public.nutrition_menu_foods
  drop constraint if exists nutrition_menu_foods_allergen_classes_vocab;

alter table public.nutrition_menu_foods
  add constraint nutrition_menu_foods_allergen_classes_vocab
  check (
    array_position(allergen_classes, null::text) is null
    and allergen_classes <@ array[
      'glutine',
      'crostacei',
      'uova',
      'pesce',
      'arachidi',
      'soia',
      'latte',
      'frutta_a_guscio',
      'sedano',
      'senape',
      'sesamo',
      'solfiti',
      'lupini',
      'molluschi'
    ]::text[]
    and cardinality(allergen_classes) =
        (case when 'glutine'         = any (allergen_classes) then 1 else 0 end)
      + (case when 'crostacei'       = any (allergen_classes) then 1 else 0 end)
      + (case when 'uova'            = any (allergen_classes) then 1 else 0 end)
      + (case when 'pesce'           = any (allergen_classes) then 1 else 0 end)
      + (case when 'arachidi'        = any (allergen_classes) then 1 else 0 end)
      + (case when 'soia'            = any (allergen_classes) then 1 else 0 end)
      + (case when 'latte'           = any (allergen_classes) then 1 else 0 end)
      + (case when 'frutta_a_guscio' = any (allergen_classes) then 1 else 0 end)
      + (case when 'sedano'          = any (allergen_classes) then 1 else 0 end)
      + (case when 'senape'          = any (allergen_classes) then 1 else 0 end)
      + (case when 'sesamo'          = any (allergen_classes) then 1 else 0 end)
      + (case when 'solfiti'         = any (allergen_classes) then 1 else 0 end)
      + (case when 'lupini'          = any (allergen_classes) then 1 else 0 end)
      + (case when 'molluschi'       = any (allergen_classes) then 1 else 0 end)
  );

-- ── 2. Le 21 righe incerte tornano non fidate ────────────────────────────────────────────────
-- salumi, affettati e carni conservate (14): lattosio/soia/senape/solfiti dipendono dall'etichetta.
update public.nutrition_menu_foods
set allergen_classes = array[]::text[],
    allergens_reviewed = false
where is_active
  and canonical_key = any (array[
    'bresaola', 'chicken_breast_deli', 'coppa', 'corned_beef_canned', 'ham_cooked', 'mortadella',
    'pork_belly_cured', 'prosciutto_crudo', 'roast_beef_deli', 'salame', 'salsiccia', 'speck',
    'turkey_breast_deli', 'wurstel'
  ]::text[]);

-- voci generiche (3): denotano una classe di alimenti, non un alimento (soia e lupini sono legumi).
update public.nutrition_menu_foods
set allergen_classes = array[]::text[],
    allergens_reviewed = false
where is_active
  and canonical_key = any (array[
    'legumes_cooked', 'jam_preserves', 'pasta_legumes'
  ]::text[]);

-- conserve di frutta zuccherate (2): frutta di partenza eventualmente solfitata, ricetta variabile.
update public.nutrition_menu_foods
set allergen_classes = array[]::text[],
    allergens_reviewed = false
where is_active
  and canonical_key = any (array[
    'jam_apricot', 'marmalade_orange'
  ]::text[]);

-- cereali soffiati da colazione (1): il malto d'orzo (glutine) è additivo di prassi.
update public.nutrition_menu_foods
set allergen_classes = array[]::text[],
    allergens_reviewed = false
where is_active
  and canonical_key = 'puffed_rice';

-- frutta essiccata (1): la solfitazione dipende dal produttore; il resto della famiglia è già «solfiti».
update public.nutrition_menu_foods
set allergen_classes = array[]::text[],
    allergens_reviewed = false
where is_active
  and canonical_key = 'dates_medjool';

comment on column public.nutrition_menu_foods.allergens_reviewed is
  'true = riga esaminata alimento per alimento: l''elenco allergen_classes (anche se vuoto) è un fatto verificato e il filtro può fidarsene. false = riga di cui NON sappiamo l''elenco — mai esaminata, oppure esaminata e giudicata INCERTA perché gli ingredienti dipendono da marca o ricetta (salumi, voci generiche, conserve). Il fail-closed esclude le righe false per chi ha dichiarato un''allergia.';
