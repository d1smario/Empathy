-- REGOLA 2 di Mario, parte DATI: «niente fibre né fermentati prima dello sforzo».
--
--   «Nei giorni di carico intenso e gara limitiamo apporto di fibre e prodotti fermentati
--    nei pasti pre-allenamento/gara: niente yogurt, kefir, cereali integrali o altri elementi
--    troppo ricchi di fibre. Restano comunque disponibili cereali classici, latte o latte
--    vegetale.»
--
-- Per applicarla servono due risposte su ogni alimento del catalogo:
--   * è RICCO DI FIBRE? → il dato c'è già e non va curato a mano: `nutrition_fdc_foods.fiber_100g`
--     (misurata su 457 delle 499 righe attive). Le soglie vivono nel codice
--     (`lib/nutrition/v2/menu-food-fiber-fermented.ts`: una per base di porzione, 4,5 g/100 g
--     sul secco e 2,5 sul prodotto come si mangia), NON in una colonna: cambiare un numero non
--     deve richiedere una migrazione dati.
--   * è FERMENTATO? → il dato NON c'è. Lo aggiunge questa colonna.
--   * è un CEREALE INTEGRALE? → nemmeno quello c'è, e la fibra non lo sa dire (riso integrale
--     cotto: 1,6 g/100 g). Lo aggiunge la colonna `is_wholegrain`, migrazione 20260908160000.
--
-- La colonna nasce false: una riga nuova non è fermentata finché qualcuno non la esamina.
-- Al contrario di `allergens_reviewed`, qui non serve un flag «esaminato»: un fermentato non
-- classificato non è un rischio sanitario (peggio: una colazione meno comoda), e chiudere in
-- assenza di dato svuoterebbe i pool invece di proteggere qualcuno.

alter table public.nutrition_menu_foods
  add column if not exists is_fermented boolean not null default false;

-- Il filtro interroga «gli alimenti fermentati di questo pool»: indice parziale sul poco
-- che è true (30 righe su 499), non un indice su tutta la tabella.
create index if not exists nutrition_menu_foods_is_fermented_idx
  on public.nutrition_menu_foods (canonical_key)
  where is_fermented;

comment on column public.nutrition_menu_foods.is_fermented is
  'true = prodotto ottenuto per fermentazione microbica, nel senso della Regola 2 di Mario (niente fermentati nei pasti pre-allenamento/gara): yogurt in ogni forma (greco, vegetale, di capra, di pecora), kefir, latticello, panna acida, tempeh, formaggi stagionati / a crosta fiorita / erborinati. NON lo sono il latte e le bevande vegetali non fermentate (Mario le lascia esplicitamente disponibili), i formaggi freschi (mozzarella, ricotta, fiocchi di latte) e il tofu (latte di soia coagulato, non fermentato: il tempeh sì).';
