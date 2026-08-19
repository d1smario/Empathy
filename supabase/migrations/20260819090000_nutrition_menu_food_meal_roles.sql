-- Score e ruoli per pasto del nutrizionista (file Mario v5) sui 492 alimenti del
-- catalogo vivo `nutrition_menu_foods`.
--
-- PERCHÉ una tabella 1:1 AFFIANCATA e non nuove colonne su nutrition_menu_foods:
--   1. chi legge il catalogo oggi (menu-food-catalog-db.ts, admin/menu-foods/route.ts)
--      fa SELECT/INSERT con colonne esplicite: allargare la tabella con NOT NULL
--      romperebbe l'insert admin, allargarla con NULL sporcherebbe il contratto
--      «un alimento = una riga di pool» con 15 colonne che il resto del codice ignora;
--   2. il proprietario dei dati è DIVERSO: pool/flag dieta/rotazione li cura l'admin da
--      /admin/alimenti, score/ruoli li aggiorna Mario da file. Con una tabella a parte
--      il refresh di Mario è un upsert su questa sola tabella (nuova migrazione DATI),
--      senza toccare pool, flag o is_active del catalogo;
--   3. il seed di backup 20260724120000_nutrition_menu_foods_seed.sql resta valido
--      così com'è (nessuna colonna nuova da rigenerare).
-- La FK su canonical_key (PK di nutrition_menu_foods, verificato: nutrition_menu_foods_pkey)
-- garantisce che ogni riga di score punti a un alimento del catalogo; ON DELETE CASCADE
-- perché uno score senza alimento non ha senso.
--
-- I VALORI NUTRIZIONALI restano quelli del catalogo (fdc_id → nutrition_fdc_foods /
-- fdc_food): qui entra solo la «grammatica» (quando e come usare l'alimento).
--
-- Autocontenuta e rieseguibile (IF NOT EXISTS / DROP POLICY IF EXISTS): nel repo NON
-- si usa `supabase db push`, si applica dall'editor SQL una migrazione alla volta.

create table if not exists public.nutrition_menu_food_meal_roles (
  canonical_key text primary key
    references public.nutrition_menu_foods (canonical_key) on delete cascade on update cascade,

  -- Idoneità 0-10 per momento della giornata (10 = alimento tipico di quel pasto).
  -- numeric(3,1) e non smallint: oggi sono interi, ma Mario deve poter dare 7,5.
  score_breakfast     numeric(3,1) not null default 0 check (score_breakfast    between 0 and 10),
  score_snack         numeric(3,1) not null default 0 check (score_snack        between 0 and 10),
  score_lunch         numeric(3,1) not null default 0 check (score_lunch        between 0 and 10),
  score_dinner        numeric(3,1) not null default 0 check (score_dinner       between 0 and 10),
  score_pre_workout   numeric(3,1) not null default 0 check (score_pre_workout  between 0 and 10),
  score_post_workout  numeric(3,1) not null default 0 check (score_post_workout between 0 and 10),

  -- Ruolo dell'alimento DENTRO il pasto (grammatica di composizione): che quota copre.
  -- EXCLUDE = vietato in quel pasto; NONE = nessun ruolo (non lo si propone lì).
  role_breakfast text not null default 'NONE',
  role_snack     text not null default 'NONE',
  role_lunch     text not null default 'NONE',
  role_dinner    text not null default 'NONE',

  -- Ruolo macro dominante dell'alimento, indipendente dal pasto.
  macro_role text not null,

  -- Frequenza d'uso: COMMON senza limiti, ROTATION/OCCASIONAL con tetto settimanale.
  frequency text not null default 'COMMON',
  -- Massimo numero di apparizioni a settimana (NULL = nessun tetto esplicito).
  max_week smallint null check (max_week between 1 and 7),
  -- Velocità di preparazione 0-10 (10 = pronto da mangiare).
  prep_speed smallint null check (prep_speed between 0 and 10),

  -- Versione della fonte (file del nutrizionista) da cui vengono i valori.
  source_version text not null default 'mario_v5',
  updated_at timestamptz not null default now(),

  constraint nutrition_menu_food_meal_roles_role_breakfast_check check (role_breakfast in
    ('CHO_PRIMARY','CHO_SECONDARY','PRO_PRIMARY','PRO_SECONDARY','FAT_COMPLEMENT','FIBER_VEG','FIBER_MICRO_PRIMARY','MIXED','COMPOSITE_MAIN','EXCLUDE','NONE')),
  constraint nutrition_menu_food_meal_roles_role_snack_check check (role_snack in
    ('CHO_PRIMARY','CHO_SECONDARY','PRO_PRIMARY','PRO_SECONDARY','FAT_COMPLEMENT','FIBER_VEG','FIBER_MICRO_PRIMARY','MIXED','COMPOSITE_MAIN','EXCLUDE','NONE')),
  constraint nutrition_menu_food_meal_roles_role_lunch_check check (role_lunch in
    ('CHO_PRIMARY','CHO_SECONDARY','PRO_PRIMARY','PRO_SECONDARY','FAT_COMPLEMENT','FIBER_VEG','FIBER_MICRO_PRIMARY','MIXED','COMPOSITE_MAIN','EXCLUDE','NONE')),
  constraint nutrition_menu_food_meal_roles_role_dinner_check check (role_dinner in
    ('CHO_PRIMARY','CHO_SECONDARY','PRO_PRIMARY','PRO_SECONDARY','FAT_COMPLEMENT','FIBER_VEG','FIBER_MICRO_PRIMARY','MIXED','COMPOSITE_MAIN','EXCLUDE','NONE')),
  constraint nutrition_menu_food_meal_roles_macro_role_check check (macro_role in
    ('CHO_PRIMARY','CHO_SECONDARY','PRO_PRIMARY','PRO_SECONDARY','FAT_PRIMARY','FIBER_MICRO','MIXED','PRO_FAT_MIXED')),
  constraint nutrition_menu_food_meal_roles_frequency_check check (frequency in
    ('COMMON','ROTATION','OCCASIONAL'))
);

comment on table public.nutrition_menu_food_meal_roles is
  'Score (0-10) e ruoli per pasto del nutrizionista sugli alimenti di nutrition_menu_foods (1:1 su canonical_key). Grammatica di composizione dei piatti: i valori nutrizionali restano nel catalogo. Write solo service-role; refresh = migrazione DATI con upsert.';

alter table public.nutrition_menu_food_meal_roles enable row level security;

-- Stesse policy di nutrition_menu_foods (verificato in prod: una sola policy,
-- nutrition_menu_foods_select_authenticated, SELECT using(true) per authenticated;
-- nessuna policy di scrittura → scrive solo il service-role che bypassa RLS).
drop policy if exists nutrition_menu_food_meal_roles_select_authenticated on public.nutrition_menu_food_meal_roles;
create policy nutrition_menu_food_meal_roles_select_authenticated on public.nutrition_menu_food_meal_roles
  for select to authenticated using (true);
