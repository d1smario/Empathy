-- Classificazione FERMENTATI del catalogo curato `nutrition_menu_foods` (499 righe attive).
--
-- Fatta alimento per alimento leggendo canonical_key + label_it, NON con una regex sul nome:
-- «Latticello» e «Panna acida» non contengono la parola yogurt, e «Latte di soia» e «Latte di
-- cocco» la conterrebbero senza essere fermentati. La famiglia è più larga dei due nomi che
-- Mario cita (yogurt, kefir): 30 righe su 499.
--
-- CRITERIO: la fermentazione microbica è un passaggio che DEFINISCE il prodotto, e il prodotto
-- arriva in tavola con quella fermentazione addosso (colture vive o lunga maturazione).
--
--   * yogurt in OGNI forma (bianco, magro, greco in 4 varianti, alla frutta, di capra, di
--     pecora, di soia) — 9 righe;
--   * kefir, latticello (buttermilk), panna acida (crema acidificata con fermenti lattici) — 3;
--   * tempeh (soia fermentata con Rhizopus) — 1. Il TOFU no: è latte di soia coagulato, non
--     fermentato — la distinzione è metà del valore di questa colonna;
--   * formaggi stagionati, a crosta fiorita, erborinati e in salamoia: Parmigiano Reggiano,
--     Grana Padano, pecorino romano, provolone, gruyère, emmental, edam, gouda, cheddar,
--     fontina, taleggio, gorgonzola, brie, camembert, caciotta, feta, caprino stagionato — 17.
--
-- NON fermentati, e non per distrazione:
--   * LATTE (vaccino intero/scremato/parzialmente scremato, di capra, di pecora) e BEVANDE
--     VEGETALI non fermentate (soia, avena, riso, mandorla, cocco): Mario le lascia
--     esplicitamente disponibili nel pre-gara, e la Regola 2 non deve toglierle;
--   * formaggi FRESCHI: mozzarella, fiordilatte, mozzarella per pizza, burrata, ricotta,
--     ricotta magra, fiocchi di latte (tutte le varianti), formaggio spalmabile. Usano colture
--     lattiche in lavorazione ma non maturano: non sono il carico che la regola vuole evitare;
--   * germogli (di soia, di erba medica, di lenticchie): germinati, non fermentati;
--   * salumi (salame, coppa, speck, bresaola, prosciutto crudo, pancetta, salsiccia,
--     mortadella, wurstel): il salame è tecnicamente un insaccato fermentato, ma né Mario né
--     il vocabolario della regola li includono — DECISIONE UMANA, lasciata a false e scritta
--     qui perché si possa rivedere in un colpo solo;
--   * olive da tavola: spesso lattofermentate in salamoia, spesso solo deamarizzate in soda —
--     dal catalogo non si distingue. Lasciate a false: vedi sopra, è una scelta da rivedere;
--   * cioccolato fondente (le fave di cacao fermentano in lavorazione, il prodotto finito non è
--     un fermentato), pane a lievitazione (Mario ammette esplicitamente i «cereali classici»).
--
-- ASSENTI dal catalogo, quindi niente da classificare: crauti, kimchi, kombucha, miso, salsa di
-- soia, natto, aceto. Se un domani entrano, vanno marcati true.
--
-- ATTENZIONE (collisione fra le due regole di Mario): il Grana Padano è marcato fermentato
-- perché lo è (9+ mesi di stagionatura), ma la REGOLA 1 lo mette nel pasto pre-gara FISSO
-- (pasta o riso 3 g/kg + 15-20 g di olio + grana padano). Chi consuma questa colonna non deve
-- applicarla al pasto pre-gara fisso: lì comanda la Regola 1. Nei pool il Grana sta solo in
-- `snack_pro`, quindi la marcatura non tocca colazione, pranzo né cena.
--
-- Idempotente: la prima UPDATE riazzera tutte le righe attive, la seconda rialza le 30. Si può
-- rieseguire senza effetti collaterali.

update public.nutrition_menu_foods
set is_fermented = false
where is_active and is_fermented;

update public.nutrition_menu_foods
set is_fermented = true
where is_active
  and canonical_key = any (array[
    -- yogurt in ogni forma (9)
    'yogurt_plain', 'yogurt_lowfat', 'yogurt_greek', 'yogurt_greek_fruit', 'yogurt_greek_nonfat',
    'yogurt_greek_whole', 'goat_yogurt', 'sheep_yogurt', 'soy_yogurt',
    -- altri latticini fermentati (3)
    'kefir', 'buttermilk', 'sour_cream',
    -- soia fermentata (1) — il tofu NON è qui
    'tempeh',
    -- formaggi stagionati / a crosta fiorita / erborinati / in salamoia (17)
    'parmigiano_reggiano', 'cheese_hard', 'pecorino_romano', 'provolone', 'gruyere', 'emmental',
    'edam', 'gouda', 'cheddar', 'fontina', 'taleggio', 'gorgonzola', 'brie', 'camembert',
    'caciotta', 'feta', 'goat_cheese_aged'
  ]);
