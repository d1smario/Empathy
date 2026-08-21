-- DDL v9 (file EMPATHY_FOOD_KNOWLEDGE_BASE_v9_PROTEIN_SHAKE_RECIPES): tier generativo
-- CORE-first + shake proteici. Due tabelle toccate:
--
--  1. nutrition_menu_food_meal_roles: 5 colonne nuove del sistema v7/v9 —
--     generative_tier (PRIMA chiave d'ordinamento del pick: CORE < ROTATION < OCCASIONAL
--     < VARIETY; EXCLUDE_DEFAULT = verdetto, mai generato di default), default_enabled
--     (false = verdetto: mai pescabile da solo — P01 per le polveri proteiche, oli di
--     semi, verdure rare), selection_weight (peso dal file di Mario: PERSISTITO e
--     editabile in admin, oggi NON consumato dal motore — colonna dichiaratamente
--     dormiente), substitution_mode (R-v9: PORTION_EQUIVALENT = stessi grammi per le
--     verdure, ENERGY_EQUIVALENT = kcal-equivalenza per le macro; null = default
--     energy), substitute_pool (pool di sostituzione del file, preferenza SOFT).
--     LE COLONNE v5 E v6 RESTANO INTATTE.
--
--  2. nutrition_recipes: family (tetti settimanali PER FAMIGLIA: lasagne/crespelle/
--     pizza/burger <= 1/settimana — V7-C02/V8-M02; null = nessun tetto famiglia), tier
--     (CORE|ROTATION|OCCASIONAL: rank di scelta, fallback frequency), selection_weight
--     (come sopra, dormiente), meals (slot ammessi: array jsonb fra
--     breakfast|snack|lunch|dinner — gli shake dicono Colazione/Spuntino, le 3 ricette
--     breakfast v6 dicono breakfast, il resto lunch+dinner; default lunch+dinner così
--     le righe esistenti restano pasti principali).
--
-- I DEFAULT rendono il DDL sicuro PRIMA dei dati (ogni riga esistente diventa
-- VARIETY/enabled, cioè il comportamento più conservativo) e il retry 42703 a stadi dei
-- loader copre l'ambiente pre-DDL.
--
-- Autocontenuta e rieseguibile: add column if not exists + drop constraint if exists.
-- Applicare dall'editor SQL (MAI `supabase db push`, vedi drift della migration history).

alter table public.nutrition_menu_food_meal_roles
  add column if not exists generative_tier text not null default 'VARIETY';
alter table public.nutrition_menu_food_meal_roles
  add column if not exists default_enabled boolean not null default true;
alter table public.nutrition_menu_food_meal_roles
  add column if not exists selection_weight smallint null;
alter table public.nutrition_menu_food_meal_roles
  add column if not exists substitution_mode text null;
alter table public.nutrition_menu_food_meal_roles
  add column if not exists substitute_pool text null;

alter table public.nutrition_menu_food_meal_roles
  drop constraint if exists nutrition_menu_food_meal_roles_generative_tier_check;
alter table public.nutrition_menu_food_meal_roles
  add constraint nutrition_menu_food_meal_roles_generative_tier_check check (generative_tier in
    ('CORE','ROTATION','OCCASIONAL','VARIETY','EXCLUDE_DEFAULT'));

alter table public.nutrition_menu_food_meal_roles
  drop constraint if exists nutrition_menu_food_meal_roles_substitution_mode_check;
alter table public.nutrition_menu_food_meal_roles
  add constraint nutrition_menu_food_meal_roles_substitution_mode_check check (
    substitution_mode is null or substitution_mode in ('ENERGY_EQUIVALENT','PORTION_EQUIVALENT'));

comment on column public.nutrition_menu_food_meal_roles.generative_tier is
  'Tier generativo v9 (CORE-first): prima chiave d''ordinamento del pick. EXCLUDE_DEFAULT = mai generato di default.';
comment on column public.nutrition_menu_food_meal_roles.default_enabled is
  'false = verdetto: mai pescabile da solo (P01 polveri proteiche, oli di semi, verdure rare). Dentro le ricette resta usabile.';
comment on column public.nutrition_menu_food_meal_roles.selection_weight is
  'Peso di selezione dal file v9. Persistito ed editabile, NON ancora consumato dal motore (colonna dormiente).';

-- ── nutrition_recipes ────────────────────────────────────────────────────────────────

alter table public.nutrition_recipes
  add column if not exists family text null;
alter table public.nutrition_recipes
  add column if not exists tier text null;
alter table public.nutrition_recipes
  add column if not exists selection_weight smallint null;
alter table public.nutrition_recipes
  add column if not exists meals jsonb not null default '["lunch","dinner"]'::jsonb;

alter table public.nutrition_recipes
  drop constraint if exists nutrition_recipes_tier_check;
alter table public.nutrition_recipes
  add constraint nutrition_recipes_tier_check check (
    tier is null or tier in ('CORE','ROTATION','OCCASIONAL'));

alter table public.nutrition_recipes
  drop constraint if exists nutrition_recipes_meals_check;
alter table public.nutrition_recipes
  add constraint nutrition_recipes_meals_check check (jsonb_typeof(meals) = 'array');

comment on column public.nutrition_recipes.family is
  'Famiglia v9 (PASTA, FISH_DISH, PROTEIN_SHAKE_*…): base dei tetti settimanali per famiglia (lasagne/crespelle/pizza/burger <= 1). NULL = nessuna famiglia.';
comment on column public.nutrition_recipes.meals is
  'Slot ammessi (array jsonb di breakfast|snack|lunch|dinner). Gli shake v9 sono breakfast+snack; default lunch+dinner.';

-- CONTROLLO (eseguire dopo l'apply; atteso: 5 colonne su meal_roles, 4 su recipes, tutte le righe VARIETY/enabled):
--   select count(*) filter (where generative_tier = 'VARIETY') as variety_default,
--          count(*) filter (where default_enabled) as enabled_default,
--          count(*) as tot
--   from public.nutrition_menu_food_meal_roles;
--   select count(*) filter (where meals = '["lunch","dinner"]'::jsonb) as meals_default, count(*) as tot
--   from public.nutrition_recipes;
