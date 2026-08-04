-- Tabella sorgente CIQUAL 2025 (ANSES, Francia).
-- Licenza: Licence Ouverte / Open Licence 2.0 (Etalab) — uso commerciale e
-- redistribuzione permessi, nessuno share-alike, ATTRIBUZIONE OBBLIGATORIA.
-- Fonte: ANSES, Table de composition nutritionnelle Ciqual 2025,
-- deposito Recherche Data Gouv DOI 10.57745/RDMHWY.
--
-- Perche esiste: il dataset USDA locale (nutrition_fdc_foods) e esaurito come
-- bacino di CONCETTI nuovi per un menu italiano — contiene gia l'intero
-- SR Legacy e non ha formaggi, salumi e ortaggi mediterranei. CIQUAL copre
-- quel buco (148 formaggi, 175 salumi, con Parmigiano, Mozzarella di bufala,
-- Ricotta, Gorgonzola, Pecorino, Jambon de Parme, Coppa, Bresaola, Pancetta).
--
-- Come si aggancia al motore: NON si tocca il motore. Le righe che scegliamo
-- vengono copiate in nutrition_fdc_foods con un fdc_id sintetico
-- (900000000 + ciqual_code) e data_type='CIQUAL 2025', cosi il join esistente
-- nutrition_menu_foods.fdc_id -> nutrition_fdc_foods continua a funzionare
-- senza nessuna modifica di codice ne redeploy della Edge Function.
create table if not exists public.nutrition_ciqual_foods (
  ciqual_code          text primary key,
  nom_fr               text not null,
  nom_sci              text,
  groupe               text,
  sous_groupe          text,
  sous_sous_groupe     text,
  kcal_100g            numeric,
  protein_100g         numeric,
  carbs_100g           numeric,
  fat_100g             numeric,
  sugars_100g          numeric,
  fiber_100g           numeric,
  sodium_mg_100g       numeric,
  salt_g_100g          numeric,
  water_100g           numeric,
  sat_fat_100g         numeric,
  cholesterol_mg_100g  numeric,
  calcium_mg_100g      numeric,
  iron_mg_100g         numeric,
  potassium_mg_100g    numeric,
  imported_at          timestamptz not null default now()
);

comment on table public.nutrition_ciqual_foods is
  'CIQUAL 2025 (ANSES) sotto Licence Ouverte Etalab 2.0. Attribuzione obbligatoria: "ANSES - Table Ciqual 2025". Bacino di curazione per nutrition_menu_foods; le righe scelte vengono copiate in nutrition_fdc_foods con fdc_id 900000000+ciqual_code.';

create index if not exists nutrition_ciqual_foods_nom_idx
  on public.nutrition_ciqual_foods using gin (to_tsvector('french', nom_fr));
create index if not exists nutrition_ciqual_foods_groupe_idx
  on public.nutrition_ciqual_foods (groupe);

alter table public.nutrition_ciqual_foods enable row level security;

-- Stessa postura di nutrition_fdc_foods: lettura per gli utenti autenticati,
-- scrittura solo service-role (nessuna policy di write = nessuno scrive via API).
drop policy if exists nutrition_ciqual_foods_select on public.nutrition_ciqual_foods;
create policy nutrition_ciqual_foods_select
  on public.nutrition_ciqual_foods for select to authenticated using (true);
