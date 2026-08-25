-- DDL v12 (foglio GENERATIVE_RULES_V8): tre colonne nuove su public.nutrition_recipes.
-- Verificato su prod (information_schema, 24 ago) che family, tier, selection_weight,
-- meals, template_meta, frequency, max_week, note, source_ref, source_version ESISTONO
-- già: qui si aggiunge SOLO ciò che manca.
--
--  * generative_role  — il ruolo che la ricetta occupa nel pasto secondo Mario:
--      CORE_MAIN_DISH            (V12_M01: le paste ricetta, selezionabili di frequente)
--      ROTATION_MAIN_DISH        (V12_M02: gnocchi/risotti/lasagne/crespelle/torte salate)
--      COMPLETE_PROTEIN_MEAL     (V12_P01/V12_C01: proteina + contorno già nel piatto —
--                                 il compositore NON aggiunge un secondo contorno/proteina)
--      LOW_ENERGY_EVENING_RECOVERY (V12_S01: minestroni/zuppe/creme/vellutate)
--    È un dato DICHIARATO: batte le euristiche di possesso del motore
--    (recipeOwnsProtein), che restano per le ricette senza il campo.
--  * season           — ALL | AUTUMN_WINTER (V12_S01: le zuppe solo in autunno/inverno).
--  * day_type         — ALL | REST_RECOVERY (V12_S01: le zuppe solo nei giorni recupero).
--
-- NULL ovunque per le 261 ricette v9/v11 esistenti = «nessun vincolo dichiarato»: il
-- comportamento di quelle righe non cambia di un bit. Nessun default: un default
-- riempirebbe di senso righe che quel senso non ce l'hanno.
--
-- Generata da scratchpad/gen_v12_migrations.py. Rieseguibile (add column if not exists +
-- drop constraint if exists). Applicare dall'editor SQL (MAI `supabase db push`, vedi
-- drift della migration history).

alter table public.nutrition_recipes
  add column if not exists generative_role text null;
alter table public.nutrition_recipes
  add column if not exists season text null;
alter table public.nutrition_recipes
  add column if not exists day_type text null;

alter table public.nutrition_recipes
  drop constraint if exists nutrition_recipes_generative_role_check;
alter table public.nutrition_recipes
  add constraint nutrition_recipes_generative_role_check check (
    generative_role is null or generative_role in
      ('CORE_MAIN_DISH','ROTATION_MAIN_DISH','COMPLETE_PROTEIN_MEAL','LOW_ENERGY_EVENING_RECOVERY'));

alter table public.nutrition_recipes
  drop constraint if exists nutrition_recipes_season_check;
alter table public.nutrition_recipes
  add constraint nutrition_recipes_season_check check (
    season is null or season in ('ALL','AUTUMN_WINTER','SPRING_SUMMER'));

alter table public.nutrition_recipes
  drop constraint if exists nutrition_recipes_day_type_check;
alter table public.nutrition_recipes
  add constraint nutrition_recipes_day_type_check check (
    day_type is null or day_type in ('ALL','REST_RECOVERY','TRAINING'));

comment on column public.nutrition_recipes.generative_role is
  'Ruolo generativo v12 (V12_M01/M02/P01/C01/S01): CORE_MAIN_DISH | ROTATION_MAIN_DISH | COMPLETE_PROTEIN_MEAL | LOW_ENERGY_EVENING_RECOVERY. NULL = nessun ruolo dichiarato (le euristiche del motore decidono, come prima).';
comment on column public.nutrition_recipes.season is
  'Stagionalità dichiarata (V12_S01): ALL | AUTUMN_WINTER | SPRING_SUMMER. NULL/ALL = nessun vincolo.';
comment on column public.nutrition_recipes.day_type is
  'Classe di giornata ammessa (V12_S01): ALL | REST_RECOVERY | TRAINING. NULL/ALL = nessun vincolo. REST_RECOVERY = solo giorni di recupero (day-engine dayClass «recupero»).';

-- CONTROLLO (dopo l'apply; atteso 3 colonne, tutte NULL sulle righe esistenti):
--   select count(*) filter (where generative_role is not null) as with_role,
--          count(*) filter (where season is not null) as with_season,
--          count(*) filter (where day_type is not null) as with_day_type,
--          count(*) as tot
--   from public.nutrition_recipes;
