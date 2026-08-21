-- I 5 INGREDIENT del file v9 (EMP_ADD_001..005): bevanda di mandorla senza zuccheri +
-- 4 polveri proteiche (whey ultrafiltrate, whey, soia, caseina micellare).
-- fdc_id SINTETICI 910000001-910000005 (range verificato libero in prod il 21 ago; gli
-- id FNDDS del file non esistono nel dataset locale). Macro dal foglio INGREDIENTS.
--
-- P01 (HARD): le polveri NON sono mai generabili da sole -> default_enabled=false nella
-- riga meal_roles (verdetto del motore); restano dentro i pool (breakfast_pro/snack_pro)
-- perche' l'entryIndex delle ricette shake nasce dai pool. La bevanda di mandorla resta
-- enabled=true (rotation_key 'breakfast:latte', gemella di oat_drink).
-- P06 (REVIEW): la caseina ha profilo EMPATHY generico, non un'etichetta di prodotto —
-- le 2 ricette che la usano portano la nota REVIEW (migrazione 090400).
-- selection_weight 45/35/35/35/20 dal piano dati concordato (il foglio INGREDIENTS non
-- porta pesi propri).
--
-- Generata da scratchpad/gen_v9_ingredients_migration.py.
-- Rieseguibile: ON CONFLICT DO NOTHING ovunque.
-- Prerequisito: 20260821090000_nutrition_v9_tier_ddl.sql applicata.

insert into public.fdc_food (fdc_id, description, data_type, kcal_100g, carbs_100g, protein_100g, fat_100g, fiber_100g, sugars_100g, sodium_mg_100g) values
(910000001, 'Bevanda di mandorla senza zuccheri', 'empathy_v9', 15, 0.34, 0.55, 1.22, 0, 0, 60),
(910000002, 'Proteine whey ultrafiltrate (generiche USDA)', 'empathy_v9', 352, 6.25, 78.1, 1.56, 3.1, 0, 156),
(910000003, 'Proteine whey in polvere (generiche USDA)', 'empathy_v9', 385, 18, 66.7, 5.13, 0, 5.13, 385),
(910000004, 'Proteine vegetali di soia in polvere (generiche USDA)', 'empathy_v9', 405, 43.9, 47.6, 3.57, 0, 40.5, 452),
(910000005, 'Caseina micellare in polvere (profilo EMPATHY generico)', 'empathy_v9', 370, 7, 82, 2.5, 0, 3, NULL)
on conflict (fdc_id) do nothing;

insert into public.nutrition_fdc_foods (fdc_id, description, data_type, kcal_100g, carbs_100g, protein_100g, fat_100g, fiber_100g, sugars_100g, sodium_mg_100g) values
(910000001, 'Bevanda di mandorla senza zuccheri', 'empathy_v9', 15, 0.34, 0.55, 1.22, 0, 0, 60),
(910000002, 'Proteine whey ultrafiltrate (generiche USDA)', 'empathy_v9', 352, 6.25, 78.1, 1.56, 3.1, 0, 156),
(910000003, 'Proteine whey in polvere (generiche USDA)', 'empathy_v9', 385, 18, 66.7, 5.13, 0, 5.13, 385),
(910000004, 'Proteine vegetali di soia in polvere (generiche USDA)', 'empathy_v9', 405, 43.9, 47.6, 3.57, 0, 40.5, 452),
(910000005, 'Caseina micellare in polvere (profilo EMPATHY generico)', 'empathy_v9', 370, 7, 82, 2.5, 0, 3, NULL)
on conflict (fdc_id) do nothing;

insert into public.nutrition_menu_foods (canonical_key, fdc_id, label_it, serving_basis, pool_keys, rotation_key, is_meat, is_fish, is_animal_product, sort_priority, is_active) values
('almond_drink_unsweetened', 910000001, 'Bevanda di mandorla senza zuccheri', 'ml', array['breakfast_cho'], 'breakfast:latte', false, false, false, 200, true),
('whey_protein_ultrafiltered', 910000002, 'Proteine whey ultrafiltrate (generiche USDA)', 'dry_grams', array['breakfast_pro', 'snack_pro'], NULL, false, false, true, 200, true),
('whey_protein_powder', 910000003, 'Proteine whey in polvere (generiche USDA)', 'dry_grams', array['breakfast_pro', 'snack_pro'], NULL, false, false, true, 200, true),
('soy_protein_powder', 910000004, 'Proteine vegetali di soia in polvere (generiche USDA)', 'dry_grams', array['breakfast_pro', 'snack_pro'], NULL, false, false, false, 200, true),
('casein_micellar', 910000005, 'Caseina micellare in polvere (profilo EMPATHY generico)', 'dry_grams', array['breakfast_pro', 'snack_pro'], NULL, false, false, true, 200, true)
on conflict (canonical_key) do nothing;

-- Ruoli v5 (role_*) restano al default NONE come da piano dati: questi alimenti
-- vivono da ingredienti di ricetta, non da pick per-ruolo. macro_role e' NOT NULL
-- senza default -> valorizzato (MIXED bevanda, PRO_PRIMARY polveri).
insert into public.nutrition_menu_food_meal_roles (canonical_key, score_breakfast, score_snack, score_lunch, score_dinner, score_pre_workout, score_post_workout, macro_role, generative_tier, default_enabled, selection_weight, source_version) values
('almond_drink_unsweetened', 6, 7, 0, 0, 5, 6, 'MIXED', 'ROTATION', true, 45, 'mario_v9'),
('whey_protein_ultrafiltered', 8, 9, 0, 0, 5, 10, 'PRO_PRIMARY', 'ROTATION', false, 35, 'mario_v9'),
('whey_protein_powder', 8, 9, 0, 0, 5, 10, 'PRO_PRIMARY', 'ROTATION', false, 35, 'mario_v9'),
('soy_protein_powder', 8, 9, 0, 0, 5, 10, 'PRO_PRIMARY', 'ROTATION', false, 35, 'mario_v9'),
('casein_micellar', 6, 7, 0, 0, 2, 5, 'PRO_PRIMARY', 'ROTATION', false, 20, 'mario_v9')
on conflict (canonical_key) do nothing;

-- CONTROLLO (eseguire dopo l'apply; atteso: 5/5/5/5, disabled_powders = 4):
--   select (select count(*) from public.fdc_food where fdc_id between 910000001 and 910000005) as ff,
--          (select count(*) from public.nutrition_fdc_foods where fdc_id between 910000001 and 910000005) as nff,
--          (select count(*) from public.nutrition_menu_foods where fdc_id between 910000001 and 910000005) as menu,
--          (select count(*) from public.nutrition_menu_food_meal_roles where canonical_key in
--            ('almond_drink_unsweetened','whey_protein_ultrafiltered','whey_protein_powder','soy_protein_powder','casein_micellar')) as roles,
--          (select count(*) from public.nutrition_menu_food_meal_roles where not default_enabled and canonical_key in
--            ('whey_protein_ultrafiltered','whey_protein_powder','soy_protein_powder','casein_micellar')) as disabled_powders;
