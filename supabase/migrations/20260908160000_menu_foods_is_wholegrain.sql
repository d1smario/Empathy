-- REGOLA 2 di Mario, ramo «CEREALI INTEGRALI»: la proprietà diventa DICHIARATA.
--
--   «Nei giorni di carico intenso e gara limitiamo apporto di fibre e prodotti fermentati
--    nei pasti pre-allenamento/gara: niente yogurt, kefir, CEREALI INTEGRALI o altri elementi
--    troppo ricchi di fibre. Restano comunque disponibili cereali classici, latte o latte
--    vegetale.»
--
-- Perché una colonna e non la soglia sulla fibra che c'è già: sui dati veri le due cose NON
-- coincidono. `nutrition_fdc_foods.fiber_100g` misura il prodotto sulla base di porzione della
-- riga (`serving_basis`), e per i cereali cotti quella base contiene acqua:
--
--   Riso integrale   1,60 g/100 g  base cooked_grams  → sotto qualunque soglia ragionevole
--   Riso rosso       4,20 g/100 g  base dry_grams     → sotto la soglia 4,5
--   Riso venere      4,18 g/100 g  base dry_grams     → sotto la soglia 4,5
--   Farro            3,90 g/100 g  base dry_grams     → sotto la soglia 4,5
--   Miglio           1,30 g/100 g  base cooked_grams  → sotto la soglia
--   Grano duro          n/d        base dry_grams     → fibra non misurata: nessuna soglia lo prende
--
-- Sei cereali integrali che una soglia sulla fibra non può escludere, per quanto la si tari.
-- «Integrale» è una proprietà del PRODOTTO (chicco intero: crusca + germe + endosperma), non
-- un numero: si dichiara.
--
-- La colonna nasce false, come `is_fermented`: una riga nuova non è integrale finché qualcuno
-- non la esamina. Non serve un flag «esaminato» in stile allergeni — un integrale non
-- classificato costa una colazione meno comoda, non un rischio sanitario, e chiudere in
-- assenza di dato svuoterebbe i pool invece di proteggere qualcuno.

alter table public.nutrition_menu_foods
  add column if not exists is_wholegrain boolean not null default false;

-- Il filtro chiede «gli integrali di questo pool»: indice parziale sul poco che è true
-- (37 righe su 499), gemello di nutrition_menu_foods_is_fermented_idx.
create index if not exists nutrition_menu_foods_is_wholegrain_idx
  on public.nutrition_menu_foods (canonical_key)
  where is_wholegrain;

comment on column public.nutrition_menu_foods.is_wholegrain is
  'true = cereale (o pseudo-cereale) INTEGRALE nel senso della Regola 2 di Mario, cioè prodotto dal chicco intero o da una sua frazione fibrosa: pasta/pane/panino/crackers/muffin integrali, riso integrale/rosso/venere/selvaggio, farro, orzo decorticato, avena in ogni forma (fiocchi, crusca, pane d''avena), muesli, granola, segale, pane multicereale, crusca e germe di grano, grano duro in chicchi, grano soffiato, bulgur, kamut, quinoa, amaranto, teff, sorgo, miglio, grano saraceno, popcorn. NON lo sono i cereali «classici» che Mario lascia esplicitamente disponibili: pasta di semola/all''uovo/fresca, riso bianco/parboiled/arborio, corn flakes, pane comune/casereccio/pita, gallette di riso e di mais, polenta, semolino, cous cous, grissini, riso soffiato, orzo perlato (perlatura = crusca rimossa). Non lo sono nemmeno le bevande vegetali: la bevanda di avena resta disponibile.';
