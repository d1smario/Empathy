-- ESERCIZI IN ITALIANO — tre colonne nuove su public.exercise.
--
-- Il catalogo ha 233 esercizi con metadati fisiologici ricchi (carico nervoso, sistema
-- energetico, impatto lattato, obiettivi di adattamento) ma **zero descrizioni e tutti i
-- nomi in inglese**: l'atleta apre la scheda e legge «Cable Pull-Through» senza sapere
-- cosa sia né come si esegue. È l'anello debole vero — più delle immagini, che almeno
-- hanno già un ripiego (arte procedurale SVG in /api/training/builder/exercise-art).
--
--  * name_it           — il nome che un istruttore italiano userebbe DAVVERO («panca
--                        piana», non «pressa da panca»); resta l'inglese dove è il nome
--                        corrente anche da noi (burpee, kettlebell swing, thruster).
--  * how_to_it         — 2-3 frasi: posizione di partenza, movimento, dove arriva lo
--                        sforzo. MAI serie, ripetizioni, carichi o percentuali: quelli
--                        sono competenza del coach, non del catalogo.
--  * common_mistake_it — una frase sull'errore tipico di QUEL gesto.
--
-- ⚠️ IL NOME INGLESE `name` NON SI TOCCA: è la CHIAVE con cui i piani già salvati
-- ritrovano l'esercizio. Nei `planned_workouts.notes` c'è solo «"label":"Back Squat"»,
-- nessun id (verificato: 0 occorrenze di exerciseId su 348 piani con esercizi). Tradurre
-- `name` scollegherebbe 1.163 riferimenti in un colpo solo. Il nome italiano è un campo
-- che si AFFIANCA e vale solo per ciò che si mostra a schermo.
--
-- NULL ovunque per gli esercizi non ancora tradotti: la UI mostra il nome inglese, come
-- prima. Nessun default, nessuna regressione.
--
-- Rieseguibile (add column if not exists). Applicare dall'editor SQL — MAI `supabase db
-- push`: la migration history del repo non è registrata in remoto.

alter table public.exercise
  add column if not exists name_it text null;
alter table public.exercise
  add column if not exists how_to_it text null;
alter table public.exercise
  add column if not exists common_mistake_it text null;

comment on column public.exercise.name_it is
  'Nome dell''esercizio in italiano, come lo direbbe un istruttore (non traduzione letterale). NULL = si mostra `name` inglese. `name` resta la chiave di aggancio dei piani salvati e non va tradotto.';
comment on column public.exercise.how_to_it is
  'Come si esegue: posizione di partenza, movimento, dove arriva lo sforzo. Mai serie/ripetizioni/carichi (competenza del coach).';
comment on column public.exercise.common_mistake_it is
  'Errore tipico di questo gesto, in una frase.';

-- CONTROLLO (dopo l'apply; atteso 3 colonne, tutte NULL sulle 233 righe esistenti):
--   select count(*) filter (where name_it is not null) as tradotti,
--          count(*) filter (where how_to_it is not null) as con_istruzioni,
--          count(*) as totale
--   from public.exercise;
