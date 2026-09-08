-- Classificazione INTEGRALI del catalogo curato `nutrition_menu_foods` (499 righe attive).
--
-- Fatta alimento per alimento leggendo canonical_key + label_it, non con una regex: «Riso
-- venere», «Grano duro (in chicchi)» e «Orzo decorticato» non contengono la parola integrale,
-- e «Bevanda di avena» la evocherebbe senza essere un cereale. 37 righe su 499.
--
-- CRITERIO: il prodotto arriva in tavola col CHICCO INTERO (crusca + germe + endosperma), o è
-- una frazione fibrosa del chicco (crusca, germe). Non conta la fibra misurata: quella è
-- l'altra metà della regola, e sui cotti mente (vedi la migrazione DDL gemella).
--
--   * frumento integrale in ogni forma: pasta, pane, panino, crackers, muffin inglese,
--     pane multicereale, bulgur (grano spezzato integrale), kamut, grano duro in chicchi,
--     grano soffiato (si soffia il chicco intero), crusca e germe di grano — 12 righe;
--   * avena: fiocchi, crusca, pane d'avena, muesli, granola, fiocchi di cereali misti — 6;
--   * riso NON raffinato: integrale, rosso, venere, selvaggio — 4;
--   * segale: chicco, pane, crispbread — 3;
--   * altri cereali e pseudo-cereali che si mangiano interi: farro (e farro soffiato), orzo
--     decorticato, miglio, sorgo, teff, amaranto, quinoa (e quinoa soffiata), grano saraceno
--     (e farina di grano saraceno), popcorn — 12.
--
-- NON integrali, e non per distrazione — sono i «cereali classici» che Mario lascia
-- esplicitamente disponibili:
--   * pasta di semola, all'uovo, fresca; riso bianco, parboiled, arborio; corn flakes;
--     pane comune, casereccio, pita, all'uvetta; panino (rosetta); focaccia; grissini;
--     gallette di riso e di mais; polenta; semolino; cous cous; riso soffiato; crema di riso;
--     fette biscottate; bagel; tortilla; cornetto; pancake; waffle;
--   * ORZO PERLATO: la perlatura toglie crusca e germe — è un cereale raffinato, per quanto
--     resti fibroso da cotto (3,8 g/100 g). Se deve uscire dai pasti pre-sforzo lo fa per la
--     fibra, non per una dichiarazione falsa. DECISIONE UMANA;
--   * PASTA DI MAIS senza glutine e PASTA AGLI SPINACI: semola di mais raffinata e semola +
--     spinaci. Escono comunque per fibra (11,0 e 6,8 g/100 g secco);
--   * PASTA DI LEGUMI, castagne, ceci, fagioli, lupini, hummus: legumi e frutti, non cereali.
--     Escono per fibra, che è la rete giusta per loro;
--   * SEITAN (glutine isolato), farina di ceci, mais dolce: nessun chicco intero;
--   * BEVANDA DI AVENA e le altre bevande vegetali: Mario le lascia disponibili, punto.
--
-- DECISIONI DA FAR CONFERMARE A MARIO (segnate qui perché non restino silenziose):
--   1. MIGLIO e GRANO SARACENO: integrali per lavorazione (si decortica soltanto), ma da cotti
--      portano 1,3 g e 0,0 g di fibra per 100 g. Marcarli integrali li toglie dal pre-gara pur
--      essendo fra i cereali più leggeri che esistano.
--   2. QUINOA e AMARANTO: pseudo-cereali sempre interi. Stessa domanda del punto 1.
--   3. POPCORN: mais integrale per definizione, ma nessuno lo chiama «cereale integrale».
--   4. GERME DI GRANO: è una frazione del chicco, non il chicco intero. Marcato true perché
--      appartiene alla stessa famiglia di crusca e fibra concentrata (13,2 g/100 g).
--   5. GRANO SOFFIATO (4,4 g/100 g) e PANE D'AVENA (4,0): passavano la soglia 4,5 per un soffio.
--      Ora escono dalla dichiarazione, non dal numero.

update public.nutrition_menu_foods
   set is_wholegrain = true
 where canonical_key in (
   -- frumento integrale e frazioni del chicco
   'pasta_whole', 'bread_whole_wheat', 'roll_whole_wheat', 'crackers_whole',
   'english_muffin_whole', 'bread_multigrain', 'bulgur', 'kamut_dry', 'wheat_durum',
   'puffed_wheat', 'wheat_bran', 'wheat_germ',
   -- avena
   'oat_dry', 'oat_bran', 'bread_oatmeal', 'muesli', 'granola', 'cereal_flakes_mix',
   -- riso non raffinato
   'rice_brown', 'rice_red', 'rice_black', 'rice_wild',
   -- segale
   'rye_grain', 'bread_rye', 'crispbread_rye',
   -- altri cereali e pseudo-cereali interi
   'farro_dry', 'farro_puffed', 'barley_hulled', 'millet', 'sorghum', 'teff', 'amaranth',
   'quinoa_dry', 'quinoa_puffed', 'buckwheat', 'buckwheat_flour', 'popcorn_airpopped'
 );
