-- Sistema ruoli v6 del nutrizionista (file EMPATHY_FOOD_KNOWLEDGE_BASE_v6_MEDITERRANEAN_GENERATIVE)
-- su nutrition_menu_food_meal_roles: la v6 SOSTITUISCE il sistema ruoli v5 con ruoli
-- per-asse a colazione (CHO / proteine / grassi), un ruolo unico per pranzo+cena
-- (main_meal_role), un ruolo spuntino, la priorità mediterranea e i sostituti espliciti.
--
-- LE COLONNE v5 RESTANO INTATTE (role_breakfast, role_snack, role_lunch, role_dinner,
-- macro_role, frequency, max_week, prep_speed): sono SUPERATE dalla v6 — la grammatica
-- legge le colonne nuove — ma non si rimuovono finché esistono lettori (fallback e
-- confronto shadow). Nessun gate nuovo: resta NUTRITION_MEAL_GRAMMAR_MODE.
--
-- Enumerazioni = valori OSSERVATI nel file v6 (492 alimenti FOOD). Un valore nuovo in un
-- futuro file di Mario = estendere il CHECK con una nuova migrazione (drop + add sotto).
--
-- Autocontenuta e rieseguibile: add column if not exists + drop constraint if exists.
-- Applicare dall'editor SQL (MAI `supabase db push`, vedi drift della migration history).

alter table public.nutrition_menu_food_meal_roles
  add column if not exists breakfast_cho_role text not null default 'NONE';
alter table public.nutrition_menu_food_meal_roles
  add column if not exists breakfast_protein_role text not null default 'NONE';
alter table public.nutrition_menu_food_meal_roles
  add column if not exists breakfast_fat_role text not null default 'NONE';
alter table public.nutrition_menu_food_meal_roles
  add column if not exists main_meal_role text not null default 'NONE';
alter table public.nutrition_menu_food_meal_roles
  add column if not exists snack_role text not null default 'NONE';
alter table public.nutrition_menu_food_meal_roles
  add column if not exists mediterranean_priority text not null default 'COMMON';
-- NULL ammesso: un alimento nuovo inserito dall'admin non ha ancora un gruppo assegnato
-- da Mario; il refresh dati (migrazione DATI v6) valorizza tutti i 492 correnti.
alter table public.nutrition_menu_food_meal_roles
  add column if not exists substitution_group text null;
-- Nota generativa testuale di Mario (colonna generative_constraints_v2 del file, 144 alimenti).
alter table public.nutrition_menu_food_meal_roles
  add column if not exists generative_note text null;
-- Sostituti espliciti in ordine di preferenza: array jsonb di canonical_key del catalogo.
-- L'equivalenza in grammi NON è persistita (le colonne eq_g del file v6 sono vuote):
-- si calcola a runtime con grams_sost = grams_orig * kcal100_orig / kcal100_sost.
alter table public.nutrition_menu_food_meal_roles
  add column if not exists substitutes jsonb not null default '[]'::jsonb;

-- CHECK sulle enumerazioni osservate (drop + add per idempotenza e per poterli
-- estendere rieseguendo una versione aggiornata di questo blocco).

alter table public.nutrition_menu_food_meal_roles
  drop constraint if exists nutrition_menu_food_meal_roles_breakfast_cho_role_check;
alter table public.nutrition_menu_food_meal_roles
  add constraint nutrition_menu_food_meal_roles_breakfast_cho_role_check check (breakfast_cho_role in
    ('PRIMARY_COMPLEX','SECONDARY_SIMPLE','SECONDARY_MIXED','NONE'));

alter table public.nutrition_menu_food_meal_roles
  drop constraint if exists nutrition_menu_food_meal_roles_breakfast_protein_role_check;
alter table public.nutrition_menu_food_meal_roles
  add constraint nutrition_menu_food_meal_roles_breakfast_protein_role_check check (breakfast_protein_role in
    ('PRIMARY','SECONDARY','SECONDARY_SAVOURY','NONE'));

alter table public.nutrition_menu_food_meal_roles
  drop constraint if exists nutrition_menu_food_meal_roles_breakfast_fat_role_check;
alter table public.nutrition_menu_food_meal_roles
  add constraint nutrition_menu_food_meal_roles_breakfast_fat_role_check check (breakfast_fat_role in
    ('PRIMARY','SECONDARY','NONE'));

alter table public.nutrition_menu_food_meal_roles
  drop constraint if exists nutrition_menu_food_meal_roles_main_meal_role_check;
alter table public.nutrition_menu_food_meal_roles
  add constraint nutrition_menu_food_meal_roles_main_meal_role_check check (main_meal_role in
    ('PRIMARY_PROTEIN','SECONDARY_PROTEIN','PRIMARY_OR_SECONDARY_PROTEIN','PRIMARY_COMPLEX_CARB',
     'SECONDARY_CARB','FIBER_SIDE','SECONDARY_FAT','FAT_CONDIMENT','COMPOSITE_MAIN','NONE'));

alter table public.nutrition_menu_food_meal_roles
  drop constraint if exists nutrition_menu_food_meal_roles_snack_role_check;
alter table public.nutrition_menu_food_meal_roles
  add constraint nutrition_menu_food_meal_roles_snack_role_check check (snack_role in
    ('FAST_CARB','FAST_PROTEIN','FAST_FAT_PRO','MEDIUM','LOW','NONE'));

alter table public.nutrition_menu_food_meal_roles
  drop constraint if exists nutrition_menu_food_meal_roles_mediterranean_priority_check;
alter table public.nutrition_menu_food_meal_roles
  add constraint nutrition_menu_food_meal_roles_mediterranean_priority_check check (mediterranean_priority in
    ('PRIMARY','COMMON','ROTATION','SECOND_CHOICE','LIMITED','OCCASIONAL'));

alter table public.nutrition_menu_food_meal_roles
  drop constraint if exists nutrition_menu_food_meal_roles_substitution_group_check;
alter table public.nutrition_menu_food_meal_roles
  add constraint nutrition_menu_food_meal_roles_substitution_group_check check (substitution_group is null or substitution_group in
    ('VEGETABLE','FRUIT','FISH_LEAN','FISH_FATTY','RED_MEAT','WHITE_MEAT','MAIN_COMPLEX_CARB',
     'BREAD_BASED_CARB','CHEESE_PROTEIN','PLANT_PROTEIN','EGG_PROTEIN','GENERIC_PROTEIN',
     'SNACK_CURED_PROTEIN','BREAKFAST_PROTEIN_DAIRY','BREAKFAST_FAT_NUTS','BREAKFAST_FAT_SEEDS',
     'BREAKFAST_COMPLEX_CARB','BREAKFAST_SIMPLE_CARB','BREAKFAST_SWEET_OCCASIONAL',
     'FAT_CONDIMENT','ANIMAL_FAT','COMPOSITE_DISH','GENERIC'));

alter table public.nutrition_menu_food_meal_roles
  drop constraint if exists nutrition_menu_food_meal_roles_substitutes_check;
alter table public.nutrition_menu_food_meal_roles
  add constraint nutrition_menu_food_meal_roles_substitutes_check check (jsonb_typeof(substitutes) = 'array');

comment on column public.nutrition_menu_food_meal_roles.breakfast_cho_role is
  'v6: ruolo CHO a colazione. PRIMARY_COMPLEX (base glucidica) | SECONDARY_SIMPLE (quota semplice) | SECONDARY_MIXED | NONE.';
comment on column public.nutrition_menu_food_meal_roles.breakfast_protein_role is
  'v6: ruolo proteico a colazione. PRIMARY | SECONDARY | SECONDARY_SAVOURY (salato) | NONE.';
comment on column public.nutrition_menu_food_meal_roles.breakfast_fat_role is
  'v6: ruolo lipidico a colazione. PRIMARY | SECONDARY | NONE.';
comment on column public.nutrition_menu_food_meal_roles.main_meal_role is
  'v6: ruolo a pranzo E cena (un ruolo unico per i pasti principali). FAT_CONDIMENT = condimento (es. olio EVO), quarta riga del pasto.';
comment on column public.nutrition_menu_food_meal_roles.snack_role is
  'v6: idoneità spuntino. FAST_* = pronto e funzionale; MEDIUM/LOW = ripiego; NONE = mai.';
comment on column public.nutrition_menu_food_meal_roles.mediterranean_priority is
  'v6: gerarchia mediterranea SOFT — si usa come ORDINAMENTO (poi score), mai come peso fine. PRIMARY > COMMON > ROTATION > SECOND_CHOICE > LIMITED > OCCASIONAL.';
comment on column public.nutrition_menu_food_meal_roles.substitution_group is
  'v6: gruppo di sostituzione/rotazione (si scambia solo dentro lo stesso gruppo, equivalenza kcal a runtime).';
comment on column public.nutrition_menu_food_meal_roles.generative_note is
  'v6: vincolo generativo testuale di Mario (colonna generative_constraints_v2 del file), informativo.';
comment on column public.nutrition_menu_food_meal_roles.substitutes is
  'v6: array jsonb ordinato di canonical_key sostituti (substitute_1..3 del file). Grammi equivalenti calcolati a runtime via kcal/100g.';

comment on table public.nutrition_menu_food_meal_roles is
  'Score (0-10) e ruoli per pasto del nutrizionista sugli alimenti di nutrition_menu_foods (1:1 su canonical_key). Dal file v6: ruoli per-asse colazione + main_meal_role + snack_role + mediterranean_priority + substitution_group + substitutes. Le colonne v5 role_breakfast/role_snack/role_lunch/role_dinner/macro_role restano ma sono SUPERATE dalla v6. Write solo service-role; refresh = migrazione DATI.';
