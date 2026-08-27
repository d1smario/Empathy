-- Tibialis Raise: il muscolo in catalogo era sbagliato, ed era l'opposto di quello vero.
--
-- La riga `empathy-b1x-tibialisraise` aveva `muscle_groups = ['calves']`. Il calf raise
-- e il tibialis raise sono i due movimenti OPPOSTI della caviglia: il primo spinge sulle
-- punte e lavora il polpaccio (comparto posteriore), il secondo solleva le punte verso la
-- tibia e lavora il tibiale anteriore. Metterli sullo stesso muscolo non è un'imprecisione
-- di etichetta: fa sparire dal catalogo l'unico esercizio che allena l'antagonista, e chi
-- filtrasse per «polpacci» si troverebbe proposto un esercizio che i polpacci non li tocca.
--
-- Trovato scrivendo le istruzioni italiane: il testo diceva «il bruciore arriva davanti
-- alla tibia, non nel polpaccio» e contraddiceva il dato della sua stessa riga.
--
-- `tibialis_anterior` è un valore NUOVO per questo vocabolario (prima 24 valori, ora 25);
-- segue la forma degli altri composti già presenti — hip_flexors, posterior_chain,
-- rear_delt. Non esistono vincoli CHECK sulla colonna, quindi non c'è nient'altro da
-- aggiornare. Verificato che il caso è isolato: è l'unica riga del catalogo che nomina il
-- tibiale, e gli altri 20 esercizi marcati 'calves' (calf raise, salti, corsa, sled) lo
-- sono correttamente.
--
-- Rieseguibile: il WHERE filtra sul valore corrente, la seconda esecuzione è un no-op.
-- APPLICATA in produzione il 27 ago 2026.

update public.exercise
set muscle_groups = array['tibialis_anterior']
where id = 'empathy-b1x-tibialisraise'
  and muscle_groups = array['calves'];

-- CONTROLLO (atteso: tibialis_anterior, e 20 esercizi ancora su calves):
--   select name, muscle_groups from public.exercise where id = 'empathy-b1x-tibialisraise';
--   select count(*) from public.exercise where 'calves' = any(muscle_groups);
