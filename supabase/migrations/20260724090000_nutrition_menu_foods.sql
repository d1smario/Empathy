-- Catalogo alimenti approvati per i menù generati (meal plan V2).
-- Sostituisce la allowlist hardcoded STAPLE_ALLOWLIST_BY_POOL come fonte dei pool:
-- il motore carica da qui; la lista nel codice resta solo come fallback se la
-- tabella è vuota/irraggiungibile. Arricchire il menù = INSERT (niente deploy).
-- Ogni riga è UN alimento-concetto (un solo fdc_id rappresentativo, niente
-- varianti duplicate): label italiana, base di pesatura coerente con lo stato
-- della riga FDC (crudo/secco → dry_grams, cotto → cooked_grams, liquidi → ml).
-- Scrittura SOLO via service-role (curazione/admin): nessuna policy write client.

create table if not exists public.nutrition_menu_foods (
  canonical_key text primary key,
  fdc_id bigint not null,
  label_it text not null,
  serving_basis text not null check (serving_basis in ('dry_grams', 'cooked_grams', 'ml')),
  -- Pool di assemblaggio (meal-slot-assembly-spec): breakfast_cho/pro/fat,
  -- lunch_carb/pro/veg, dinner_carb/pro/veg, snack_cho/pro.
  pool_keys text[] not null,
  -- Famiglia di rotazione settimanale (es. carb:pasta, prot:pesce) — varianti
  -- dello stesso concetto condividono la chiave e contano come un solo uso.
  rotation_key text null,
  -- Famiglia carb per il vincolo "no stesso amido pranzo+cena nello stesso giorno".
  carb_family text null,
  -- Flag dieta espliciti (niente inferenza dai tag): pescatarian esclude is_meat;
  -- vegetarian esclude is_meat+is_fish; vegan esclude anche is_animal_product
  -- (latticini, uova, miele e compositi che li contengono).
  is_meat boolean not null default false,
  is_fish boolean not null default false,
  is_animal_product boolean not null default false,
  -- Ordine di preferenza nel pool: 100 classici mediterranei, 200 comuni, 300 varietà.
  sort_priority int not null default 200,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

comment on table public.nutrition_menu_foods is 'Alimenti approvati per i menù del meal plan V2: fonte dei pool del motore (label IT, serving basis, flag dieta). Write solo service-role; arricchire il menù = INSERT.';

create index if not exists idx_nutrition_menu_foods_active
  on public.nutrition_menu_foods (is_active, sort_priority);

alter table public.nutrition_menu_foods enable row level security;

-- SELECT per tutti gli autenticati (catalogo di sola lettura lato client);
-- il motore lato server usa comunque il service-role.
drop policy if exists nutrition_menu_foods_select_authenticated on public.nutrition_menu_foods;
create policy nutrition_menu_foods_select_authenticated on public.nutrition_menu_foods
  for select to authenticated using (true);
