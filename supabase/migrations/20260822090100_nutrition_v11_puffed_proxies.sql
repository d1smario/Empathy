-- PROXY v11 (D1b / V11_B04): farro soffiato e quinoa soffiata come alimenti da
-- colazione. Le MACRO sono COPIATE dall'alimento sorgente riusandone il fdc_id
-- (farro_dry 169746, quinoa_dry 168874: il loader risolve le macro da
-- nutrition_fdc_foods per fdc_id, quindi nessun valore inventato) — nota REVIEW nel
-- generative_note, da sostituire quando arriva il dato analitico del soffiato.
--
-- Ruoli/score dal FOOD_MASTER v11 (EMP_V11_FOOD_001/002): col 8.5, spu 3, pre 7,
-- post 6; bcho PRIMARY_COMPLEX; tier ROTATION; max_week 3; weight 40; substitution_group
-- BREAKFAST_COMPLEX_CARB; substitute_pool BREAKFAST_CEREAL_PUFFED.
-- NON rappresentabili (fuori CHECK di prod, lasciati al default): snack_role_v2
-- 'BREAKFAST_ONLY' del file -> snack_role resta 'NONE'; substitution_mode
-- 'ROLE_EQUIVALENT' del file -> NULL. main_meal_role resta 'NONE' (alimento
-- breakfast-only, pool breakfast_cho; D1b non lo richiede). I ruoli v5 (role_*)
-- restano NONE come per gli EMP_ADD v9. substitutes del file (Pasta di semola/Riso/
-- Patate ecc.) NON importati: incoerenti per un cereale da colazione, resta [].
--
-- Generata da scratchpad/gen_v11_migrations.py; verificata da
-- scratchpad/verify_v11_migrations.py (parser indipendente su xlsx + prod).
-- Rieseguibile: ON CONFLICT DO NOTHING. Prerequisito: nessuno (la 090200 dipende
-- da QUESTA per i canonical_key dei componenti proxy).

insert into public.nutrition_menu_foods (canonical_key, fdc_id, label_it, serving_basis, pool_keys, rotation_key, is_meat, is_fish, is_animal_product, sort_priority, is_active) values
('farro_puffed', 169746, 'Farro soffiato', 'dry_grams', array['breakfast_cho'], 'breakfast:cereali', false, false, false, 200, true),
('quinoa_puffed', 168874, 'Quinoa soffiata', 'dry_grams', array['breakfast_cho'], 'breakfast:cereali', false, false, false, 200, true)
on conflict (canonical_key) do nothing;

insert into public.nutrition_menu_food_meal_roles (canonical_key, score_breakfast, score_snack, score_lunch, score_dinner, score_pre_workout, score_post_workout, macro_role, frequency, max_week, breakfast_cho_role, mediterranean_priority, substitution_group, generative_note, generative_tier, default_enabled, selection_weight, substitute_pool, source_version) values
('farro_puffed', 8.5, 3, 0, 0, 7, 6, 'CHO_PRIMARY', 'ROTATION', 3, 'PRIMARY_COMPLEX', 'ROTATION', 'BREAKFAST_COMPLEX_CARB', 'PROXY (V11_B04): macro copiate da farro_dry (fdc_id 169746), in attesa di dato analitico — REVIEW.', 'ROTATION', true, 40, 'BREAKFAST_CEREAL_PUFFED', 'mario_v11'),
('quinoa_puffed', 8.5, 3, 0, 0, 7, 6, 'CHO_PRIMARY', 'ROTATION', 3, 'PRIMARY_COMPLEX', 'ROTATION', 'BREAKFAST_COMPLEX_CARB', 'PROXY (V11_B04): macro copiate da quinoa_dry (fdc_id 168874), in attesa di dato analitico — REVIEW.', 'ROTATION', true, 40, 'BREAKFAST_CEREAL_PUFFED', 'mario_v11')
on conflict (canonical_key) do nothing;

-- CONTROLLO (eseguire dopo l'apply; atteso: menu = 2 con fdc dei sorgenti, roles = 2
-- entrambi ROTATION/enabled con nota PROXY):
--   select m.canonical_key, m.fdc_id, m.pool_keys, m.rotation_key,
--          r.generative_tier, r.default_enabled, r.max_week, r.generative_note
--   from public.nutrition_menu_foods m
--   join public.nutrition_menu_food_meal_roles r using (canonical_key)
--   where m.canonical_key in ('farro_puffed', 'quinoa_puffed');
