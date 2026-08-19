-- DATI: le 15 ricette del nutrizionista (file Mario v5), 85 componenti.
-- Generato da mario_recipes.json. Verificato in prod prima di generare: tutti i 34
-- canonical_key distinti usati esistono in nutrition_menu_foods, attivi, con lo stesso
-- fdc_id del file e con macro utilizzabili in nutrition_fdc_foods; le 15 somme = 100.
--
-- Rieseguibile: le ricette si upsertano su recipe_key; i componenti si SOSTITUISCONO in
-- blocco per ricetta (delete + insert) così un refresh che toglie un ingrediente non lascia
-- righe orfane. Un refresh futuro = nuova migrazione con lo stesso metodo.
--
-- Prerequisiti: 20260819090200_nutrition_recipes.sql applicata; catalogo con i 34 alimenti
-- (la FK su canonical_key fa fallire — di proposito — l'intera migrazione se ne manca uno).

begin;

insert into public.nutrition_recipes (recipe_key, label_it, is_active, source_ref, source_version) values
('pizza_margherita', 'Pizza Margherita', true, 'EMP_RECIPE_001', 'mario_v5'),
('pasta_alla_carbonara', 'Pasta alla carbonara', true, 'EMP_RECIPE_002', 'mario_v5'),
('pasta_al_ragu', 'Pasta al ragù', true, 'EMP_RECIPE_003', 'mario_v5'),
('lasagne_al_ragu', 'Lasagne al ragù', true, 'EMP_RECIPE_004', 'mario_v5'),
('hamburger_completo', 'Hamburger completo', true, 'EMP_RECIPE_005', 'mario_v5'),
('cotoletta_di_pollo', 'Cotoletta di pollo', true, 'EMP_RECIPE_006', 'mario_v5'),
('piadina_prosciutto_e_mozzarella', 'Piadina prosciutto e mozzarella', true, 'EMP_RECIPE_007', 'mario_v5'),
('risotto_al_parmigiano', 'Risotto al parmigiano', true, 'EMP_RECIPE_008', 'mario_v5'),
('pasta_al_tonno_e_pomodoro', 'Pasta al tonno e pomodoro', true, 'EMP_RECIPE_009', 'mario_v5'),
('gnocchi_al_pomodoro', 'Gnocchi al pomodoro', true, 'EMP_RECIPE_010', 'mario_v5'),
('pasta_al_pesto', 'Pasta al pesto', true, 'EMP_RECIPE_011', 'mario_v5'),
('toast_prosciutto_e_formaggio', 'Toast prosciutto e formaggio', true, 'EMP_RECIPE_012', 'mario_v5'),
('porridge_avena_e_banana', 'Porridge avena e banana', true, 'EMP_RECIPE_013', 'mario_v5'),
('smoothie_yogurt_e_frutti_rossi', 'Smoothie yogurt e frutti rossi', true, 'EMP_RECIPE_014', 'mario_v5'),
('pancake_avena_e_uova', 'Pancake avena e uova', true, 'EMP_RECIPE_015', 'mario_v5')
on conflict (recipe_key) do update set
  label_it = excluded.label_it,
  source_ref = excluded.source_ref,
  source_version = excluded.source_version,
  updated_at = now();

delete from public.nutrition_recipe_components c
using public.nutrition_recipes r
where c.recipe_id = r.id and r.recipe_key in ('pizza_margherita', 'pasta_alla_carbonara', 'pasta_al_ragu', 'lasagne_al_ragu', 'hamburger_completo', 'cotoletta_di_pollo', 'piadina_prosciutto_e_mozzarella', 'risotto_al_parmigiano', 'pasta_al_tonno_e_pomodoro', 'gnocchi_al_pomodoro', 'pasta_al_pesto', 'toast_prosciutto_e_formaggio', 'porridge_avena_e_banana', 'smoothie_yogurt_e_frutti_rossi', 'pancake_avena_e_uova');

insert into public.nutrition_recipe_components (recipe_id, position, canonical_key, fdc_id, label_it, grams_per_100g, is_neutral)
select r.id, v.position, v.canonical_key, v.fdc_id, v.label_it, v.grams_per_100g, v.is_neutral
from (values
('pizza_margherita', 1, 'bread_white', 174925, 'Pane', 45, false),
('pizza_margherita', 2, 'tomatoes_canned', 170138, 'Pomodori pelati', 20, false),
('pizza_margherita', 3, 'mozzarella', 170847, 'Mozzarella', 18, false),
('pizza_margherita', 4, 'olive_oil', 171413, 'Olio EVO', 4, false),
('pizza_margherita', 5, 'parmigiano_reggiano', 170848, 'Parmigiano Reggiano', 3, false),
('pizza_margherita', 6, NULL, NULL, 'Acqua / brodo neutro', 10, true),
('pasta_alla_carbonara', 1, 'pasta_dry', 168927, 'Pasta di semola', 35, false),
('pasta_alla_carbonara', 2, 'egg_whole', 171287, 'Uova', 14, false),
('pasta_alla_carbonara', 3, 'pecorino_romano', 171249, 'Pecorino romano', 8, false),
('pasta_alla_carbonara', 4, 'pork_belly_cured', 168277, 'Pancetta', 13, false),
('pasta_alla_carbonara', 5, NULL, NULL, 'Acqua / brodo neutro', 30, true),
('pasta_al_ragu', 1, 'pasta_dry', 168927, 'Pasta di semola', 35, false),
('pasta_al_ragu', 2, 'beef_ground', 174030, 'Macinato di manzo', 15, false),
('pasta_al_ragu', 3, 'tomatoes_canned', 170138, 'Pomodori pelati', 12, false),
('pasta_al_ragu', 4, 'onion', 170000, 'Cipolla', 3, false),
('pasta_al_ragu', 5, 'carrot_raw', 170393, 'Carote', 2, false),
('pasta_al_ragu', 6, 'olive_oil', 171413, 'Olio EVO', 3, false),
('pasta_al_ragu', 7, NULL, NULL, 'Acqua / brodo neutro', 30, true),
('lasagne_al_ragu', 1, 'pasta_egg', 169731, 'Pasta all''uovo', 25, false),
('lasagne_al_ragu', 2, 'beef_ground', 174030, 'Macinato di manzo', 15, false),
('lasagne_al_ragu', 3, 'tomatoes_canned', 170138, 'Pomodori pelati', 15, false),
('lasagne_al_ragu', 4, 'mozzarella', 170847, 'Mozzarella', 10, false),
('lasagne_al_ragu', 5, 'parmigiano_reggiano', 170848, 'Parmigiano Reggiano', 4, false),
('lasagne_al_ragu', 6, 'milk_whole', 746782, 'Latte', 8, false),
('lasagne_al_ragu', 7, 'butter_unsalted', 173430, 'Burro', 2, false),
('lasagne_al_ragu', 8, 'onion', 170000, 'Cipolla', 2, false),
('lasagne_al_ragu', 9, 'carrot_raw', 170393, 'Carote', 1, false),
('lasagne_al_ragu', 10, 'olive_oil', 171413, 'Olio EVO', 2, false),
('lasagne_al_ragu', 11, NULL, NULL, 'Acqua / brodo neutro', 16, true),
('hamburger_completo', 1, 'bread_white', 174925, 'Pane', 32, false),
('hamburger_completo', 2, 'beef_ground', 174030, 'Macinato di manzo', 34, false),
('hamburger_completo', 3, 'mozzarella', 170847, 'Mozzarella', 8, false),
('hamburger_completo', 4, 'tomato_raw', 170457, 'Pomodori', 8, false),
('hamburger_completo', 5, 'lettuce_romaine', 169247, 'Lattuga romana', 5, false),
('hamburger_completo', 6, 'olive_oil', 171413, 'Olio EVO', 3, false),
('hamburger_completo', 7, NULL, NULL, 'Acqua / brodo neutro', 10, true),
('cotoletta_di_pollo', 1, 'chicken_breast', 171077, 'Petto di pollo', 60, false),
('cotoletta_di_pollo', 2, 'egg_whole', 171287, 'Uova', 8, false),
('cotoletta_di_pollo', 3, 'bread_white', 174925, 'Pane', 12, false),
('cotoletta_di_pollo', 4, 'olive_oil', 171413, 'Olio EVO', 8, false),
('cotoletta_di_pollo', 5, NULL, NULL, 'Acqua / brodo neutro', 12, true),
('piadina_prosciutto_e_mozzarella', 1, 'tortilla_flour', 167535, 'Tortilla di frumento (wrap)', 45, false),
('piadina_prosciutto_e_mozzarella', 2, 'ham_cooked', 332397, 'Prosciutto cotto', 25, false),
('piadina_prosciutto_e_mozzarella', 3, 'mozzarella', 170847, 'Mozzarella', 22, false),
('piadina_prosciutto_e_mozzarella', 4, 'tomato_raw', 170457, 'Pomodori', 5, false),
('piadina_prosciutto_e_mozzarella', 5, 'olive_oil', 171413, 'Olio EVO', 3, false),
('risotto_al_parmigiano', 1, 'rice_arborio', 168931, 'Riso Arborio', 28, false),
('risotto_al_parmigiano', 2, 'parmigiano_reggiano', 170848, 'Parmigiano Reggiano', 8, false),
('risotto_al_parmigiano', 3, 'butter_unsalted', 173430, 'Burro', 4, false),
('risotto_al_parmigiano', 4, 'olive_oil', 171413, 'Olio EVO', 2, false),
('risotto_al_parmigiano', 5, NULL, NULL, 'Acqua / brodo neutro', 58, true),
('pasta_al_tonno_e_pomodoro', 1, 'pasta_dry', 168927, 'Pasta di semola', 35, false),
('pasta_al_tonno_e_pomodoro', 2, 'tuna_canned_water', 171986, 'Tonno al naturale', 18, false),
('pasta_al_tonno_e_pomodoro', 3, 'tomatoes_canned', 170138, 'Pomodori pelati', 15, false),
('pasta_al_tonno_e_pomodoro', 4, 'olive_oil', 171413, 'Olio EVO', 3, false),
('pasta_al_tonno_e_pomodoro', 5, NULL, NULL, 'Acqua / brodo neutro', 29, true),
('gnocchi_al_pomodoro', 1, 'gnocchi_potato', 900025510, 'Gnocchi di patate', 60, false),
('gnocchi_al_pomodoro', 2, 'tomatoes_canned', 170138, 'Pomodori pelati', 25, false),
('gnocchi_al_pomodoro', 3, 'parmigiano_reggiano', 170848, 'Parmigiano Reggiano', 5, false),
('gnocchi_al_pomodoro', 4, 'olive_oil', 171413, 'Olio EVO', 3, false),
('gnocchi_al_pomodoro', 5, NULL, NULL, 'Acqua / brodo neutro', 7, true),
('pasta_al_pesto', 1, 'pasta_dry', 168927, 'Pasta di semola', 35, false),
('pasta_al_pesto', 2, 'olive_oil', 171413, 'Olio EVO', 6, false),
('pasta_al_pesto', 3, 'parmigiano_reggiano', 170848, 'Parmigiano Reggiano', 5, false),
('pasta_al_pesto', 4, 'pine_nuts', 2346392, 'Pinoli', 3, false),
('pasta_al_pesto', 5, NULL, NULL, 'Acqua / brodo neutro', 51, true),
('toast_prosciutto_e_formaggio', 1, 'bread_white', 174925, 'Pane', 55, false),
('toast_prosciutto_e_formaggio', 2, 'ham_cooked', 332397, 'Prosciutto cotto', 25, false),
('toast_prosciutto_e_formaggio', 3, 'cream_cheese_light', 172207, 'Formaggio spalmabile magro', 15, false),
('toast_prosciutto_e_formaggio', 4, 'olive_oil', 171413, 'Olio EVO', 1, false),
('toast_prosciutto_e_formaggio', 5, NULL, NULL, 'Acqua / brodo neutro', 4, true),
('porridge_avena_e_banana', 1, 'oat_dry', 172989, 'Fiocchi d''avena', 25, false),
('porridge_avena_e_banana', 2, 'milk_semi_skimmed', 746778, 'Latte parzialmente scremato', 45, false),
('porridge_avena_e_banana', 3, 'banana', 173944, 'Banana', 20, false),
('porridge_avena_e_banana', 4, 'honey', 169640, 'Miele', 5, false),
('porridge_avena_e_banana', 5, 'almonds_raw', 2346393, 'Mandorle', 5, false),
('smoothie_yogurt_e_frutti_rossi', 1, 'yogurt_greek_nonfat', 330137, 'Yogurt greco 0%', 35, false),
('smoothie_yogurt_e_frutti_rossi', 2, 'banana', 173944, 'Banana', 20, false),
('smoothie_yogurt_e_frutti_rossi', 3, 'strawberries_raw', 167762, 'Fragole', 25, false),
('smoothie_yogurt_e_frutti_rossi', 4, 'blueberries_raw', 2346411, 'Mirtilli', 15, false),
('smoothie_yogurt_e_frutti_rossi', 5, 'honey', 169640, 'Miele', 5, false),
('pancake_avena_e_uova', 1, 'pancakes_plain', 175009, 'Pancake', 60, false),
('pancake_avena_e_uova', 2, 'yogurt_greek_nonfat', 330137, 'Yogurt greco 0%', 20, false),
('pancake_avena_e_uova', 3, 'banana', 173944, 'Banana', 15, false),
('pancake_avena_e_uova', 4, 'honey', 169640, 'Miele', 5, false)) as v (recipe_key, position, canonical_key, fdc_id, label_it, grams_per_100g, is_neutral)
join public.nutrition_recipes r on r.recipe_key = v.recipe_key;

commit;

-- CONTROLLO (eseguire dopo l'apply; atteso: 15 righe, tutte grams_ok = true, somma = 100,
-- fdc_drift = 0 — cioè l'fdc_id snapshot coincide ancora con quello del catalogo):
--   select r.recipe_key, count(c.id) as componenti, sum(c.grams_per_100g) as somma,
--          public.nutrition_recipe_grams_ok(r.id) as grams_ok,
--          count(*) filter (where m.canonical_key is not null and m.fdc_id <> c.fdc_id) as fdc_drift
--   from public.nutrition_recipes r
--   join public.nutrition_recipe_components c on c.recipe_id = r.id
--   left join public.nutrition_menu_foods m on m.canonical_key = c.canonical_key
--   group by r.recipe_key, r.id order by r.recipe_key;
