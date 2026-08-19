-- Ricette: frequenza e tetto settimanale, come per gli alimenti (nutrition_menu_food_meal_roles
-- ha frequency/max_week). Lo SCORE resta sugli alimenti (la ricetta eredita l'eleggibilità
-- al pasto dai suoi ingredienti portanti); alla ricetta si dà solo quanto spesso può
-- comparire.
--
-- ADDITIVA e rieseguibile: default 'COMMON' così le 15 ricette Mario v5 restano valide
-- senza backfill. Il pannello admin sonda le colonne (42703 → le ignora) quindi funziona
-- sia prima sia dopo l'apply. Il motore (loadMenuRecipes) per ora NON le legge.
--
-- Applicare dall'editor SQL (MAI `supabase db push`, vedi drift della migration history).

alter table public.nutrition_recipes
  add column if not exists frequency text not null default 'COMMON'
    constraint nutrition_recipes_frequency_check
    check (frequency in ('COMMON', 'ROTATION', 'OCCASIONAL'));

alter table public.nutrition_recipes
  add column if not exists max_week smallint null
    constraint nutrition_recipes_max_week_check
    check (max_week is null or (max_week >= 1 and max_week <= 7));

comment on column public.nutrition_recipes.frequency is
  'Quanto spesso la ricetta può comparire: COMMON (ogni settimana) | ROTATION | OCCASIONAL. Stessa semantica di nutrition_menu_food_meal_roles.frequency.';
comment on column public.nutrition_recipes.max_week is
  'Tetto di comparse a settimana (1-7), NULL = nessun tetto esplicito.';
