-- Classificazione allergeni del catalogo curato `nutrition_menu_foods` (pool del motore V2).
--
-- PRIMA: la tabella aveva solo is_meat/is_fish/is_animal_product e il filtro di sicurezza
-- lavorava per SOTTOSTRINGA sulla descrizione → «Frutta secca mista tostata» passava a un
-- allergico alla frutta a guscio e «Latticello» a un intollerante al lattosio.
--
-- DOPO: due colonne con semantica esatta, su cui il filtro si appoggia.
--   * allergen_classes    → vocabolario CHIUSO dei 14 allergeni EU (Allegato II Reg. 1169/2011)
--                            in snake_case italiano. Vincolato da CHECK.
--   * allergens_reviewed  → «esaminato e senza allergeni» ≠ «mai guardato»: una riga con
--                            elenco vuoto è sicura SOLO se qualcuno l'ha davvero esaminata.
--                            Le righe nuove nascono false: vanno riviste prima di essere fidate.

alter table public.nutrition_menu_foods
  add column if not exists allergen_classes text[] not null default '{}'::text[],
  add column if not exists allergens_reviewed boolean not null default false;

alter table public.nutrition_menu_foods
  drop constraint if exists nutrition_menu_foods_allergen_classes_vocab;

alter table public.nutrition_menu_foods
  add constraint nutrition_menu_foods_allergen_classes_vocab
  check (
    allergen_classes <@ array[
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
  );

-- Il filtro interroga per sovrapposizione (`allergen_classes && '{latte,glutine}'`): GIN.
create index if not exists nutrition_menu_foods_allergen_classes_gin
  on public.nutrition_menu_foods using gin (allergen_classes);

comment on column public.nutrition_menu_foods.allergen_classes is
  'Allergeni EU (Allegato II Reg. 1169/2011), vocabolario CHIUSO di 14 token snake_case IT: glutine, crostacei, uova, pesce, arachidi, soia, latte, frutta_a_guscio, sedano, senape, sesamo, solfiti, lupini, molluschi. Vuoto = nessun allergene (significativo solo con allergens_reviewed = true).';

comment on column public.nutrition_menu_foods.allergens_reviewed is
  'true = riga esaminata alimento per alimento da un classificatore. false = MAI guardata: il filtro di sicurezza non può fidarsi del suo elenco vuoto.';
