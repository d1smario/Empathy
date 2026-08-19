-- Ricette del nutrizionista (file Mario v5) come REGOLE DI COMBINAZIONE su ingredienti
-- del catalogo `nutrition_menu_foods` — MAI alimenti chiusi con macro propri.
--
-- PERCHÉ componenti e non macro: i valori nutrizionali di una ricetta si CALCOLANO al
-- momento dagli ingredienti (fdc_id del catalogo → nutrition_fdc_foods / fdc_food), così
-- il solver può scalare la pasta senza scalare il guanciale e le esclusioni dell'atleta
-- (niente maiale) filtrano DENTRO la ricetta invece che sul nome del piatto.
--
-- Ogni componente pesa `grams_per_100g` di piatto COTTO; per ricetta sommano a 100.
-- Il componente NEUTRO («Acqua / brodo neutro»: canonical_key/fdc_id NULL, zero
-- nutrienti) esiste solo per far tornare il peso del piatto cotto.
--
-- Il vincolo «somma per ricetta in [99, 101]» NON è un CHECK di riga (Postgres non sa
-- vincolare un aggregato per gruppo): è una funzione di validazione qui sotto, usata dalla
-- query di controllo della migrazione DATI e dal loader/test TS che scarta le ricette fuori
-- tolleranza.
--
-- FK verso nutrition_menu_foods su canonical_key: è la PK della tabella (verificato in prod:
-- nutrition_menu_foods_pkey). ON DELETE RESTRICT (default) di proposito: un alimento usato
-- da una ricetta non si cancella, si disattiva (is_active).
--
-- Autocontenuta e rieseguibile (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).

create table if not exists public.nutrition_recipes (
  id uuid primary key default gen_random_uuid(),
  -- Chiave stabile leggibile (slug), usata da codice e refresh dati.
  recipe_key text not null unique,
  label_it text not null,
  is_active boolean not null default true,
  note text null,
  -- Riferimento all'id nel file sorgente del nutrizionista (es. EMP_RECIPE_001).
  source_ref text null,
  source_version text not null default 'mario_v5',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.nutrition_recipes is
  'Ricette come regole di combinazione su ingredienti di nutrition_menu_foods (niente macro proprie: si calcolano dai componenti). Write solo service-role.';

create table if not exists public.nutrition_recipe_components (
  id bigint generated always as identity primary key,
  recipe_id uuid not null references public.nutrition_recipes (id) on delete cascade,
  position smallint not null check (position >= 1),
  -- NULL solo per il componente neutro (acqua/brodo).
  canonical_key text null references public.nutrition_menu_foods (canonical_key) on update cascade,
  -- Snapshot dell'fdc_id del catalogo al momento dell'import: i nutrienti si leggono
  -- comunque via canonical_key → catalogo, questo serve a rilevare derive (fdc cambiato).
  fdc_id bigint null,
  label_it text not null,
  -- Grammi di questo ingrediente per 100 g di piatto cotto.
  grams_per_100g numeric(6,2) not null check (grams_per_100g > 0 and grams_per_100g <= 100),
  is_neutral boolean not null default false,
  unique (recipe_id, position),
  -- Neutro ⇔ senza alimento; non neutro ⇒ deve puntare a un alimento del catalogo.
  constraint nutrition_recipe_components_neutral_check check (
    (is_neutral and canonical_key is null and fdc_id is null)
    or (not is_neutral and canonical_key is not null)
  )
);

comment on table public.nutrition_recipe_components is
  'Componenti di nutrition_recipes: grammi per 100 g di piatto cotto per ingrediente del catalogo (canonical_key); is_neutral = acqua/brodo a zero nutrienti.';

create index if not exists idx_nutrition_recipe_components_recipe
  on public.nutrition_recipe_components (recipe_id, position);
create index if not exists idx_nutrition_recipe_components_canonical_key
  on public.nutrition_recipe_components (canonical_key);

-- Validazione «somma componenti ≈ 100 g» per ricetta (tolleranza [99, 101]).
create or replace function public.nutrition_recipe_grams_ok(p_recipe_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(sum(grams_per_100g), 0) between 99 and 101
  from public.nutrition_recipe_components
  where recipe_id = p_recipe_id;
$$;

comment on function public.nutrition_recipe_grams_ok(uuid) is
  'True se i grams_per_100g dei componenti della ricetta sommano in [99, 101]. Vincolo di aggregato: non imponibile come CHECK di riga, si verifica dopo l''import.';

alter table public.nutrition_recipes enable row level security;
alter table public.nutrition_recipe_components enable row level security;

-- Stesse policy di nutrition_menu_foods: SELECT per gli autenticati, nessuna policy di
-- scrittura (scrive solo il service-role, che bypassa RLS).
drop policy if exists nutrition_recipes_select_authenticated on public.nutrition_recipes;
create policy nutrition_recipes_select_authenticated on public.nutrition_recipes
  for select to authenticated using (true);

drop policy if exists nutrition_recipe_components_select_authenticated on public.nutrition_recipe_components;
create policy nutrition_recipe_components_select_authenticated on public.nutrition_recipe_components
  for select to authenticated using (true);
