-- CORREZIONE v9 delle 10 RIGHE AVVELENATE del file sorgente (slittamenti da match di
-- sottostringa nel processo di classificazione, identici alla v6 — Mario NON li ha
-- corretti in v9): anacardi x3 / semi di zucca x2 / pasta agli spinaci = VERDURE-fibra;
-- rana pescatrice e melanzane = FRUTTA da colazione; edamame = FORMAGGIO; bevanda di
-- riso = cereale da pasto. Valori corretti = quelli v9 dei FRATELLI nel file stesso
-- (Mandorle per la frutta secca; Semi di girasole per i semi; Pasta di semola per la
-- pasta; Zucchine per le melanzane; Sogliola per la rana pescatrice; Soia per
-- l'edamame; Bevanda di avena per quella di riso), INCLUSI tier/enabled/weight/mode/
-- pool v9 dei fratelli. substitutes = liste per-alimento della correzione v6 (riviste,
-- si conservano). Nessun valore inventato. Da riportare a Mario per il fix in v10.
--
-- Generata da scratchpad/gen_v9_meal_roles_migration.py; verifica indipendente in
-- scratchpad/verify_v9_migrations.py.
-- Prerequisito: applicare DOPO 20260821090100_nutrition_meal_roles_v9_data.sql
-- (quell'update ri-avvelena le 10 righe; questa le corregge).

update public.nutrition_menu_food_meal_roles r set
  score_breakfast        = v.score_breakfast,
  score_snack            = v.score_snack,
  score_lunch            = v.score_lunch,
  score_dinner           = v.score_dinner,
  score_pre_workout      = v.score_pre_workout,
  score_post_workout     = v.score_post_workout,
  breakfast_cho_role     = v.breakfast_cho_role,
  breakfast_protein_role = v.breakfast_protein_role,
  breakfast_fat_role     = v.breakfast_fat_role,
  main_meal_role         = v.main_meal_role,
  snack_role             = v.snack_role,
  mediterranean_priority = v.mediterranean_priority,
  substitution_group     = v.substitution_group,
  generative_note        = v.generative_note,
  substitutes            = v.substitutes,
  generative_tier        = v.generative_tier,
  default_enabled        = v.default_enabled,
  selection_weight       = v.selection_weight,
  substitution_mode      = v.substitution_mode,
  substitute_pool        = v.substitute_pool,
  source_version         = 'mario_v9_fix_slittamento',
  updated_at             = now()
from (values
('cashew_butter', 9, 9, 0, 0, 0, 0, 'NONE', 'NONE', 'PRIMARY', 'SECONDARY_FAT', 'FAST_FAT_PRO', 'COMMON', 'BREAKFAST_FAT_NUTS', NULL, '["cashews_roasted","cashews","almond_butter"]'::jsonb, 'CORE', true, 100, 'ENERGY_EQUIVALENT', 'BREAKFAST_FAT'),
('cashews', 9, 9, 0, 0, 0, 0, 'NONE', 'NONE', 'PRIMARY', 'SECONDARY_FAT', 'FAST_FAT_PRO', 'COMMON', 'BREAKFAST_FAT_NUTS', NULL, '["cashews_roasted","cashew_butter","mixed_nuts_roasted"]'::jsonb, 'CORE', true, 100, 'ENERGY_EQUIVALENT', 'BREAKFAST_FAT'),
('cashews_roasted', 9, 9, 0, 0, 0, 0, 'NONE', 'NONE', 'PRIMARY', 'SECONDARY_FAT', 'FAST_FAT_PRO', 'COMMON', 'BREAKFAST_FAT_NUTS', NULL, '["cashews","cashew_butter","mixed_nuts_roasted"]'::jsonb, 'CORE', true, 100, 'ENERGY_EQUIVALENT', 'BREAKFAST_FAT'),
('edamame', 0, 0, 2.8, 2.8, 0, 0, 'NONE', 'NONE', 'NONE', 'PRIMARY_OR_SECONDARY_PROTEIN', 'LOW', 'ROTATION', 'PLANT_PROTEIN', NULL, '["soybeans_cooked","tofu_firm","lupins"]'::jsonb, 'VARIETY', true, 8, NULL, NULL),
('eggplant', 0, 0, 10, 10, 0, 0, 'NONE', 'NONE', 'NONE', 'FIBER_SIDE', 'LOW', 'COMMON', 'VEGETABLE', NULL, '["zucchini_raw","bell_pepper_red","tomato_raw"]'::jsonb, 'CORE', true, 100, 'PORTION_EQUIVALENT', 'VEGETABLE'),
('monkfish', 0, 0, 7.5, 7.5, 0, 5.2, 'NONE', 'NONE', 'NONE', 'PRIMARY_PROTEIN', 'LOW', 'PRIMARY', 'FISH_LEAN', NULL, '["sole","turbot","john_dory"]'::jsonb, 'ROTATION', true, 40, NULL, NULL),
('pasta_spinach', 0, 0, 10, 10, 4, 5, 'NONE', 'NONE', 'NONE', 'PRIMARY_COMPLEX_CARB', 'LOW', 'PRIMARY', 'MAIN_COMPLEX_CARB', NULL, '["pasta_dry","pasta_whole","pasta_egg"]'::jsonb, 'CORE', true, 100, 'ENERGY_EQUIVALENT', 'MAIN_CARB'),
('pumpkin_seeds_raw', 4.5, 6.8, 0, 0, 0, 0, 'NONE', 'NONE', 'SECONDARY', 'SECONDARY_FAT', 'FAST_FAT_PRO', 'SECOND_CHOICE', 'BREAKFAST_FAT_SEEDS', 'Seconda scelta rispetto a frutta oleosa/creme; usare come complemento', '["pumpkin_seeds_roasted","sunflower_seeds","sesame_seeds"]'::jsonb, 'ROTATION', true, 40, NULL, NULL),
('pumpkin_seeds_roasted', 4.5, 6.8, 0, 0, 0, 0, 'NONE', 'NONE', 'SECONDARY', 'SECONDARY_FAT', 'FAST_FAT_PRO', 'SECOND_CHOICE', 'BREAKFAST_FAT_SEEDS', 'Seconda scelta rispetto a frutta oleosa/creme; usare come complemento', '["pumpkin_seeds_raw","sunflower_seeds_roasted","sesame_seeds"]'::jsonb, 'ROTATION', true, 40, NULL, NULL),
('rice_drink', 3.5, 0, 0, 0, 2.8, 2.8, 'PRIMARY_COMPLEX', 'NONE', 'NONE', 'NONE', 'LOW', 'ROTATION', 'BREAKFAST_COMPLEX_CARB', NULL, '["oat_drink","rice_cream","puffed_rice"]'::jsonb, 'VARIETY', true, 8, NULL, NULL)
) as v (canonical_key, score_breakfast, score_snack, score_lunch, score_dinner, score_pre_workout, score_post_workout,
        breakfast_cho_role, breakfast_protein_role, breakfast_fat_role, main_meal_role, snack_role,
        mediterranean_priority, substitution_group, generative_note, substitutes,
        generative_tier, default_enabled, selection_weight, substitution_mode, substitute_pool)
where r.canonical_key = v.canonical_key
;

-- CONTROLLO (eseguire dopo l'apply; atteso: fix = 10, v9 = 482):
--   select count(*) filter (where source_version = 'mario_v9_fix_slittamento') as fix,
--          count(*) filter (where source_version = 'mario_v9') as v9
--   from public.nutrition_menu_food_meal_roles;
