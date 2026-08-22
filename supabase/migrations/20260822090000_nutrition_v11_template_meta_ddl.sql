-- DDL v11 (D1a): UNA colonna jsonb per i metadati template delle ricette-colazione/
-- spuntino v11 (primary_carb_family, protein_base_family, fruit_family,
-- fat_addon_family, variant_group, standard_serving_g). NULL per le ricette
-- non-template (le 82 v9 restano intatte). Niente colonne dedicate: il motore la
-- legge come blob (loader a stadi con retry 42703, come per le colonne v9).
--
-- Generata da scratchpad/gen_v11_migrations.py. Rieseguibile (IF NOT EXISTS).

alter table public.nutrition_recipes
  add column if not exists template_meta jsonb;

comment on column public.nutrition_recipes.template_meta is
  'Metadati template v11 (colazione/spuntino): primary_carb_family, protein_base_family, fruit_family, fat_addon_family, variant_group, standard_serving_g. NULL = ricetta non-template.';
