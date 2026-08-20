-- Frequenze v6 delle 15 ricette di Mario su nutrition_recipes (colonne frequency/max_week
-- create da 20260819110000_nutrition_recipes_frequency.sql con default 'COMMON'/NULL:
-- in prod erano ancora TUTTE al default perche' la v5 non dava frequenze esplicite).
--
-- Il file v6 le da': 5 ricette OCCASIONAL max 1/settimana (i piatti "sgarro":
-- pizza, carbonara, lasagne, hamburger, cotoletta) e 10 ROTATION max 2/settimana.
-- recipe_key = slug gia' in prod (vedi 20260819090300_nutrition_recipes_data.sql).
-- Gli ingredienti/componenti NON cambiano (v6 = stesse 15 ricette della v5).
--
-- Rieseguibile: stesso esito a ogni apply (updated_at a parte).
-- Applicare dall'editor SQL (MAI `supabase db push`, vedi drift della migration history).

update public.nutrition_recipes r set
  frequency      = v.frequency,
  max_week       = v.max_week,
  source_version = 'mario_v6',
  updated_at     = now()
from (values
  ('pizza_margherita',                'OCCASIONAL', 1),
  ('pasta_alla_carbonara',            'OCCASIONAL', 1),
  ('lasagne_al_ragu',                 'OCCASIONAL', 1),
  ('hamburger_completo',              'OCCASIONAL', 1),
  ('cotoletta_di_pollo',              'OCCASIONAL', 1),
  ('pasta_al_ragu',                   'ROTATION',   2),
  ('piadina_prosciutto_e_mozzarella', 'ROTATION',   2),
  ('risotto_al_parmigiano',           'ROTATION',   2),
  ('pasta_al_tonno_e_pomodoro',       'ROTATION',   2),
  ('gnocchi_al_pomodoro',             'ROTATION',   2),
  ('pasta_al_pesto',                  'ROTATION',   2),
  ('toast_prosciutto_e_formaggio',    'ROTATION',   2),
  ('porridge_avena_e_banana',         'ROTATION',   2),
  ('smoothie_yogurt_e_frutti_rossi',  'ROTATION',   2),
  ('pancake_avena_e_uova',            'ROTATION',   2)
) as v (recipe_key, frequency, max_week)
where r.recipe_key = v.recipe_key;

-- CONTROLLO (eseguire dopo l'apply; atteso: occasional_1 = 5, rotation_2 = 10, common_residue = 0):
--   select count(*) filter (where frequency = 'OCCASIONAL' and max_week = 1) as occasional_1,
--          count(*) filter (where frequency = 'ROTATION' and max_week = 2) as rotation_2,
--          count(*) filter (where frequency = 'COMMON') as common_residue
--   from public.nutrition_recipes;
