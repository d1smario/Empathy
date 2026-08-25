-- RICETTE v12 — PRIMI PIATTI (47 delle 97 del foglio RECIPE_LIBRARY_V12): 19 PASTA,
-- 12 RISOTTO, 6 GNOCCHI, 10 TORTA_SALATA. Tutte hanno il carboidrato DENTRO il piatto,
-- cioè la stessa struttura delle ricette v9/v11 che il motore serve già ogni giorno:
-- entrano come DATI, senza una riga di codice nuovo e senza toccare la composizione.
--
-- LE ALTRE 50 RESTANO FUORI, per due ragioni diverse:
--   * 15 per i DATI (decisione del proprietario, 24 ago): 9 nomi che promettono
--     ingredienti assenti, 2 duplicati esatti di ricette v9 attive, 2 cloni interni,
--     2 «basmati» che come ingrediente usano rice_arborio;
--   * 35 per il MOTORE: 17 piatti completi (proteina + contorno) e 18 zuppe recovery.
--     Misurato su 652 slot reali: non stanno nell'impalcatura del pasto, che assume
--     quattro linee con minimi fissi (primo 45 g, secondo 80 g, contorno, condimento).
--     Ogni vincolo che li fa rientrare ne rompe un altro — il tetto sui grassi affama la
--     proteina (20 slot su 49 sotto l'85% del target), e sulle cene piccole i pavimenti
--     delle linee portano il pasto a 1,45x. Serve lavoro strutturale, da fare con Mario.
--
-- QUINDICI RICETTE DEL FOGLIO SONO ESCLUSE (decisione del proprietario, 24 ago). Non sono
-- state corrette d'ufficio: correggerle avrebbe voluto dire inventare grammature o nomi al
-- posto di Mario. Vanno rimandate a lui per il prossimo file.
--   - arrosto_di_tacchino_con_patate_e_zucchine — nome: zucchine assenti
--   - arrosto_di_vitello_con_patate_e_carote — nome: carote assenti
--   - spezzatino_di_manzo_con_patate_e_carote — nome: carote assenti
--   - spezzatino_di_pollo_con_patate_e_zucchine — nome: zucchine assenti
--   - trota_al_forno_con_patate_e_zucchine — nome: zucchine assenti
--   - calamari_alla_griglia_con_patate_e_insalata — nome: insalata assente
--   - cotoletta_di_pollo_con_patate_e_insalata — nome: insalata assente
--   - hamburger_di_manzo_con_patate_al_forno_e_insalata — nome: insalata assente
--   - cordon_bleu_con_insalata_e_pomodori — nome: pomodori/prosciutto/formaggio assenti
--   - merluzzo_al_forno_con_patate_e_pomodorini — duplicato di merluzzo_con_patate_e_pomodori (v9 attiva)
--   - scaloppine_di_pollo_al_limone_con_zucchine — duplicato di pollo_con_zucchine (v9 attiva)
--   - pollo_al_forno_con_patate_e_rosmarino — clone di pollo_alla_griglia_con_patate_e_pomodori (e il rosmarino non c e)
--   - tacchino_al_forno_con_verdure_grigliate — clone di tacchino_alla_griglia_con_zucchine_e_carote
--   - riso_basmati_pollo_e_verdure — nome: basmati, ingrediente rice_arborio
--   - riso_basmati_salmone_e_zucchine — nome: basmati, ingrediente rice_arborio
--
-- Verifiche fatte PRIMA di generare (script scratchpad/gen_v12_migrations.py, che le
-- ri-esegue a ogni run e aborta se saltano):
--   * somma grammi per ricetta in [99, 101] su tutte e 97 (stessa tolleranza della
--     funzione SQL nutrition_recipe_grams_ok);
--   * position contigue 1..n, grammi in (0, 100];
--   * 50 canonical_key usate, TUTTE presenti e attive in nutrition_menu_foods con
--     fdc_id non nullo (dump prod 24 ago);
--   * unico ingredient_food_id senza mapping: TECH_WATER («Acqua / brodo neutro») → è il
--     COMPONENTE NEUTRO previsto dallo schema (is_neutral true, canonical_key/fdc_id NULL,
--     33 righe; in prod ci sono già 25 componenti neutri);
--   * slug (snake_case del nome) senza collisioni con le 261 ricette esistenti
--     (82 mario_v9 + 179 mario_v11) — verificato su prod.
--
-- SCELTE dichiarate, perché il foglio v12 NON porta questi campi:
--   * frequency/max_week dal tier, con la STESSA convenzione dei piatti principali v9 già
--     in prod: CORE → COMMON / max_week 2, ROTATION → ROTATION / max_week 1. Così una
--     ricetta v12 non può comparire più spesso della sua omologa v9.
--   * meals da meal_scope: «Pranzo · Cena» → ["lunch","dinner"], «Cena» → ["dinner"]
--     (le 18 zuppe sono SOLO cena — è la metà «cena» di V12_S01, imposta dai DATI; le
--     altre due metà, stagione e giorno di recupero, le impone il motore leggendo
--     season/day_type).
--   * fdc_id dei componenti NON scritto a mano: sub-select su nutrition_menu_foods per
--     canonical_key, così lo snapshot è per costruzione quello del catalogo al momento
--     dell'apply (il neutro resta NULL).
--   * note REVIEW (V12_T01) sulle 10 TORTA_SALATA: base = tortilla/wrap come proxy della
--     pasta brisée. È una NOTA, non una regola: nessuna logica nel motore.
--
-- Rieseguibile: upsert su recipe_key (DO UPDATE su tutte le colonne del file);
-- componenti in delete+insert per le SOLE chiavi di questo file.
-- Prerequisito: 20260824090000 (generative_role/season/day_type) applicata.
-- Niente begin/commit: il wrapper transazionale di chi applica va in conflitto.

insert into public.nutrition_recipes
  (recipe_key, label_it, is_active, source_ref, source_version, frequency, max_week,
   family, tier, selection_weight, meals, note, generative_role, season, day_type)
values
('spaghetti_tonno_e_pomodorini', 'Spaghetti tonno e pomodorini', true, 'EMP_RECIPE_263', 'mario_v12', 'COMMON', 2, 'PASTA', 'CORE', 100, '["lunch","dinner"]'::jsonb, NULL, 'CORE_MAIN_DISH', 'ALL', 'ALL'),
('pasta_tonno_olive_e_capperi', 'Pasta tonno olive e capperi', true, 'EMP_RECIPE_264', 'mario_v12', 'COMMON', 2, 'PASTA', 'CORE', 100, '["lunch","dinner"]'::jsonb, NULL, 'CORE_MAIN_DISH', 'ALL', 'ALL'),
('pasta_tonno_e_zucchine', 'Pasta tonno e zucchine', true, 'EMP_RECIPE_265', 'mario_v12', 'COMMON', 2, 'PASTA', 'CORE', 100, '["lunch","dinner"]'::jsonb, NULL, 'CORE_MAIN_DISH', 'ALL', 'ALL'),
('spaghetti_gamberi_e_pomodorini', 'Spaghetti gamberi e pomodorini', true, 'EMP_RECIPE_266', 'mario_v12', 'COMMON', 2, 'PASTA', 'CORE', 100, '["lunch","dinner"]'::jsonb, NULL, 'CORE_MAIN_DISH', 'ALL', 'ALL'),
('spaghetti_gamberi_e_zucchine', 'Spaghetti gamberi e zucchine', true, 'EMP_RECIPE_267', 'mario_v12', 'COMMON', 2, 'PASTA', 'CORE', 100, '["lunch","dinner"]'::jsonb, NULL, 'CORE_MAIN_DISH', 'ALL', 'ALL'),
('linguine_salmone_e_zucchine', 'Linguine salmone e zucchine', true, 'EMP_RECIPE_268', 'mario_v12', 'COMMON', 2, 'PASTA', 'CORE', 100, '["lunch","dinner"]'::jsonb, NULL, 'CORE_MAIN_DISH', 'ALL', 'ALL'),
('pasta_salmone_e_pomodorini', 'Pasta salmone e pomodorini', true, 'EMP_RECIPE_269', 'mario_v12', 'COMMON', 2, 'PASTA', 'CORE', 100, '["lunch","dinner"]'::jsonb, NULL, 'CORE_MAIN_DISH', 'ALL', 'ALL'),
('pasta_merluzzo_e_pomodoro', 'Pasta merluzzo e pomodoro', true, 'EMP_RECIPE_270', 'mario_v12', 'COMMON', 2, 'PASTA', 'CORE', 100, '["lunch","dinner"]'::jsonb, NULL, 'CORE_MAIN_DISH', 'ALL', 'ALL'),
('pasta_cozze_e_pomodorini', 'Pasta cozze e pomodorini', true, 'EMP_RECIPE_271', 'mario_v12', 'COMMON', 2, 'PASTA', 'CORE', 100, '["lunch","dinner"]'::jsonb, NULL, 'CORE_MAIN_DISH', 'ALL', 'ALL'),
('pasta_vongole_e_zucchine', 'Pasta vongole e zucchine', true, 'EMP_RECIPE_272', 'mario_v12', 'COMMON', 2, 'PASTA', 'CORE', 100, '["lunch","dinner"]'::jsonb, NULL, 'CORE_MAIN_DISH', 'ALL', 'ALL'),
('pasta_pollo_e_zucchine', 'Pasta pollo e zucchine', true, 'EMP_RECIPE_273', 'mario_v12', 'COMMON', 2, 'PASTA', 'CORE', 100, '["lunch","dinner"]'::jsonb, NULL, 'CORE_MAIN_DISH', 'ALL', 'ALL'),
('pasta_tacchino_e_pomodoro', 'Pasta tacchino e pomodoro', true, 'EMP_RECIPE_274', 'mario_v12', 'COMMON', 2, 'PASTA', 'CORE', 100, '["lunch","dinner"]'::jsonb, NULL, 'CORE_MAIN_DISH', 'ALL', 'ALL'),
('pasta_salsiccia_e_zucchine', 'Pasta salsiccia e zucchine', true, 'EMP_RECIPE_275', 'mario_v12', 'COMMON', 2, 'PASTA', 'CORE', 100, '["lunch","dinner"]'::jsonb, NULL, 'CORE_MAIN_DISH', 'ALL', 'ALL'),
('pasta_salsiccia_e_pomodoro', 'Pasta salsiccia e pomodoro', true, 'EMP_RECIPE_276', 'mario_v12', 'COMMON', 2, 'PASTA', 'CORE', 100, '["lunch","dinner"]'::jsonb, NULL, 'CORE_MAIN_DISH', 'ALL', 'ALL'),
('pasta_ricotta_e_zucchine', 'Pasta ricotta e zucchine', true, 'EMP_RECIPE_277', 'mario_v12', 'COMMON', 2, 'PASTA', 'CORE', 100, '["lunch","dinner"]'::jsonb, NULL, 'CORE_MAIN_DISH', 'ALL', 'ALL'),
('pasta_piselli_e_prosciutto', 'Pasta piselli e prosciutto', true, 'EMP_RECIPE_278', 'mario_v12', 'COMMON', 2, 'PASTA', 'CORE', 100, '["lunch","dinner"]'::jsonb, NULL, 'CORE_MAIN_DISH', 'ALL', 'ALL'),
('pasta_broccoli_e_parmigiano', 'Pasta broccoli e parmigiano', true, 'EMP_RECIPE_279', 'mario_v12', 'COMMON', 2, 'PASTA', 'CORE', 100, '["lunch","dinner"]'::jsonb, NULL, 'CORE_MAIN_DISH', 'ALL', 'ALL'),
('pasta_cavolfiore_e_parmigiano', 'Pasta cavolfiore e parmigiano', true, 'EMP_RECIPE_280', 'mario_v12', 'COMMON', 2, 'PASTA', 'CORE', 100, '["lunch","dinner"]'::jsonb, NULL, 'CORE_MAIN_DISH', 'ALL', 'ALL'),
('pasta_melanzane_e_pomodoro', 'Pasta melanzane e pomodoro', true, 'EMP_RECIPE_281', 'mario_v12', 'COMMON', 2, 'PASTA', 'CORE', 100, '["lunch","dinner"]'::jsonb, NULL, 'CORE_MAIN_DISH', 'ALL', 'ALL'),
('gnocchi_burro_e_parmigiano', 'Gnocchi burro e parmigiano', true, 'EMP_RECIPE_282', 'mario_v12', 'ROTATION', 1, 'GNOCCHI', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, NULL, 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('gnocchi_pomodoro_e_mozzarella', 'Gnocchi pomodoro e mozzarella', true, 'EMP_RECIPE_283', 'mario_v12', 'ROTATION', 1, 'GNOCCHI', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, NULL, 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('gnocchi_al_ragu_leggero', 'Gnocchi al ragù leggero', true, 'EMP_RECIPE_284', 'mario_v12', 'ROTATION', 1, 'GNOCCHI', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, NULL, 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('gnocchi_zucchine_e_parmigiano', 'Gnocchi zucchine e parmigiano', true, 'EMP_RECIPE_285', 'mario_v12', 'ROTATION', 1, 'GNOCCHI', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, NULL, 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('gnocchi_ricotta_e_spinaci', 'Gnocchi ricotta e spinaci', true, 'EMP_RECIPE_286', 'mario_v12', 'ROTATION', 1, 'GNOCCHI', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, NULL, 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('gnocchi_salmone_e_zucchine', 'Gnocchi salmone e zucchine', true, 'EMP_RECIPE_287', 'mario_v12', 'ROTATION', 1, 'GNOCCHI', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, NULL, 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('risotto_salsiccia_e_zucchine', 'Risotto salsiccia e zucchine', true, 'EMP_RECIPE_288', 'mario_v12', 'ROTATION', 1, 'RISOTTO', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, NULL, 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('risotto_salsiccia_e_piselli', 'Risotto salsiccia e piselli', true, 'EMP_RECIPE_289', 'mario_v12', 'ROTATION', 1, 'RISOTTO', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, NULL, 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('risotto_pollo_e_zucchine', 'Risotto pollo e zucchine', true, 'EMP_RECIPE_290', 'mario_v12', 'ROTATION', 1, 'RISOTTO', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, NULL, 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('risotto_pollo_e_funghi', 'Risotto pollo e funghi', true, 'EMP_RECIPE_291', 'mario_v12', 'ROTATION', 1, 'RISOTTO', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, NULL, 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('risotto_tacchino_e_carote', 'Risotto tacchino e carote', true, 'EMP_RECIPE_292', 'mario_v12', 'ROTATION', 1, 'RISOTTO', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, NULL, 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('risotto_gamberi_e_pomodorini', 'Risotto gamberi e pomodorini', true, 'EMP_RECIPE_293', 'mario_v12', 'ROTATION', 1, 'RISOTTO', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, NULL, 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('risotto_gamberi_e_piselli', 'Risotto gamberi e piselli', true, 'EMP_RECIPE_294', 'mario_v12', 'ROTATION', 1, 'RISOTTO', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, NULL, 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('risotto_salmone_e_piselli', 'Risotto salmone e piselli', true, 'EMP_RECIPE_295', 'mario_v12', 'ROTATION', 1, 'RISOTTO', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, NULL, 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('risotto_tonno_e_zucchine', 'Risotto tonno e zucchine', true, 'EMP_RECIPE_296', 'mario_v12', 'ROTATION', 1, 'RISOTTO', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, NULL, 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('risotto_zucca_e_parmigiano', 'Risotto zucca e parmigiano', true, 'EMP_RECIPE_297', 'mario_v12', 'ROTATION', 1, 'RISOTTO', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, NULL, 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('risotto_carote_e_piselli', 'Risotto carote e piselli', true, 'EMP_RECIPE_298', 'mario_v12', 'ROTATION', 1, 'RISOTTO', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, NULL, 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('risotto_broccoli_e_parmigiano', 'Risotto broccoli e parmigiano', true, 'EMP_RECIPE_299', 'mario_v12', 'ROTATION', 1, 'RISOTTO', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, NULL, 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('torta_salata_ricotta_e_spinaci', 'Torta salata ricotta e spinaci', true, 'EMP_RECIPE_302', 'mario_v12', 'ROTATION', 1, 'TORTA_SALATA', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, 'REVIEW (V12_T01): base strutturale con tortilla/wrap come PROXY della pasta brisée/sfoglia — sostituire con il dato specifico quando disponibile in catalogo.', 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('torta_salata_prosciutto_e_zucchine', 'Torta salata prosciutto e zucchine', true, 'EMP_RECIPE_303', 'mario_v12', 'ROTATION', 1, 'TORTA_SALATA', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, 'REVIEW (V12_T01): base strutturale con tortilla/wrap come PROXY della pasta brisée/sfoglia — sostituire con il dato specifico quando disponibile in catalogo.', 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('torta_salata_pollo_e_verdure', 'Torta salata pollo e verdure', true, 'EMP_RECIPE_304', 'mario_v12', 'ROTATION', 1, 'TORTA_SALATA', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, 'REVIEW (V12_T01): base strutturale con tortilla/wrap come PROXY della pasta brisée/sfoglia — sostituire con il dato specifico quando disponibile in catalogo.', 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('torta_salata_tonno_e_pomodoro', 'Torta salata tonno e pomodoro', true, 'EMP_RECIPE_305', 'mario_v12', 'ROTATION', 1, 'TORTA_SALATA', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, 'REVIEW (V12_T01): base strutturale con tortilla/wrap come PROXY della pasta brisée/sfoglia — sostituire con il dato specifico quando disponibile in catalogo.', 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('torta_salata_salmone_e_zucchine', 'Torta salata salmone e zucchine', true, 'EMP_RECIPE_306', 'mario_v12', 'ROTATION', 1, 'TORTA_SALATA', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, 'REVIEW (V12_T01): base strutturale con tortilla/wrap come PROXY della pasta brisée/sfoglia — sostituire con il dato specifico quando disponibile in catalogo.', 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('torta_salata_mozzarella_e_pomodoro', 'Torta salata mozzarella e pomodoro', true, 'EMP_RECIPE_307', 'mario_v12', 'ROTATION', 1, 'TORTA_SALATA', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, 'REVIEW (V12_T01): base strutturale con tortilla/wrap come PROXY della pasta brisée/sfoglia — sostituire con il dato specifico quando disponibile in catalogo.', 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('torta_salata_prosciutto_e_mozzarella', 'Torta salata prosciutto e mozzarella', true, 'EMP_RECIPE_308', 'mario_v12', 'ROTATION', 1, 'TORTA_SALATA', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, 'REVIEW (V12_T01): base strutturale con tortilla/wrap come PROXY della pasta brisée/sfoglia — sostituire con il dato specifico quando disponibile in catalogo.', 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('torta_salata_broccoli_e_ricotta', 'Torta salata broccoli e ricotta', true, 'EMP_RECIPE_309', 'mario_v12', 'ROTATION', 1, 'TORTA_SALATA', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, 'REVIEW (V12_T01): base strutturale con tortilla/wrap come PROXY della pasta brisée/sfoglia — sostituire con il dato specifico quando disponibile in catalogo.', 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('torta_salata_zucca_e_ricotta', 'Torta salata zucca e ricotta', true, 'EMP_RECIPE_310', 'mario_v12', 'ROTATION', 1, 'TORTA_SALATA', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, 'REVIEW (V12_T01): base strutturale con tortilla/wrap come PROXY della pasta brisée/sfoglia — sostituire con il dato specifico quando disponibile in catalogo.', 'ROTATION_MAIN_DISH', 'ALL', 'ALL'),
('torta_salata_verdure_miste', 'Torta salata verdure miste', true, 'EMP_RECIPE_311', 'mario_v12', 'ROTATION', 1, 'TORTA_SALATA', 'ROTATION', 35, '["lunch","dinner"]'::jsonb, 'REVIEW (V12_T01): base strutturale con tortilla/wrap come PROXY della pasta brisée/sfoglia — sostituire con il dato specifico quando disponibile in catalogo.', 'ROTATION_MAIN_DISH', 'ALL', 'ALL')
on conflict (recipe_key) do update set
  label_it = excluded.label_it,
  is_active = excluded.is_active,
  source_ref = excluded.source_ref,
  source_version = excluded.source_version,
  frequency = excluded.frequency,
  max_week = excluded.max_week,
  family = excluded.family,
  tier = excluded.tier,
  selection_weight = excluded.selection_weight,
  meals = excluded.meals,
  note = excluded.note,
  generative_role = excluded.generative_role,
  season = excluded.season,
  day_type = excluded.day_type,
  updated_at = now();

-- Componenti: delete+insert per le sole ricette di questo file (idempotenza).
delete from public.nutrition_recipe_components
where recipe_id in (
  select id from public.nutrition_recipes where recipe_key in (
    'spaghetti_tonno_e_pomodorini', 'pasta_tonno_olive_e_capperi', 'pasta_tonno_e_zucchine', 'spaghetti_gamberi_e_pomodorini', 'spaghetti_gamberi_e_zucchine', 'linguine_salmone_e_zucchine',
    'pasta_salmone_e_pomodorini', 'pasta_merluzzo_e_pomodoro', 'pasta_cozze_e_pomodorini', 'pasta_vongole_e_zucchine', 'pasta_pollo_e_zucchine', 'pasta_tacchino_e_pomodoro',
    'pasta_salsiccia_e_zucchine', 'pasta_salsiccia_e_pomodoro', 'pasta_ricotta_e_zucchine', 'pasta_piselli_e_prosciutto', 'pasta_broccoli_e_parmigiano', 'pasta_cavolfiore_e_parmigiano',
    'pasta_melanzane_e_pomodoro', 'gnocchi_burro_e_parmigiano', 'gnocchi_pomodoro_e_mozzarella', 'gnocchi_al_ragu_leggero', 'gnocchi_zucchine_e_parmigiano', 'gnocchi_ricotta_e_spinaci',
    'gnocchi_salmone_e_zucchine', 'risotto_salsiccia_e_zucchine', 'risotto_salsiccia_e_piselli', 'risotto_pollo_e_zucchine', 'risotto_pollo_e_funghi', 'risotto_tacchino_e_carote',
    'risotto_gamberi_e_pomodorini', 'risotto_gamberi_e_piselli', 'risotto_salmone_e_piselli', 'risotto_tonno_e_zucchine', 'risotto_zucca_e_parmigiano', 'risotto_carote_e_piselli',
    'risotto_broccoli_e_parmigiano', 'torta_salata_ricotta_e_spinaci', 'torta_salata_prosciutto_e_zucchine', 'torta_salata_pollo_e_verdure', 'torta_salata_tonno_e_pomodoro', 'torta_salata_salmone_e_zucchine',
    'torta_salata_mozzarella_e_pomodoro', 'torta_salata_prosciutto_e_mozzarella', 'torta_salata_broccoli_e_ricotta', 'torta_salata_zucca_e_ricotta', 'torta_salata_verdure_miste'
  )
);

insert into public.nutrition_recipe_components
  (recipe_id, position, canonical_key, fdc_id, label_it, grams_per_100g, is_neutral)
select r.id, v.position, v.canonical_key,
       -- Snapshot fdc_id dal catalogo (NULL per il neutro e, per costruzione, mai
       -- inventato a mano): i nutrienti si leggono comunque via canonical_key.
       (select f.fdc_id from public.nutrition_menu_foods f where f.canonical_key = v.canonical_key),
       v.label_it, v.grams_per_100g, v.is_neutral
from (values
  ('spaghetti_tonno_e_pomodorini', 1::smallint, 'pasta_dry'::text, 'Pasta di semola', 42::numeric(6,2), false::boolean),
  ('spaghetti_tonno_e_pomodorini', 2, 'tuna_canned_water', 'Tonno al naturale', 22, false),
  ('spaghetti_tonno_e_pomodorini', 3, 'tomato_raw', 'Pomodori', 28, false),
  ('spaghetti_tonno_e_pomodorini', 4, 'olive_oil', 'Olio EVO', 5, false),
  ('spaghetti_tonno_e_pomodorini', 5, 'onion', 'Cipolla', 3, false),
  ('pasta_tonno_olive_e_capperi', 1, 'pasta_dry', 'Pasta di semola', 43, false),
  ('pasta_tonno_olive_e_capperi', 2, 'tuna_canned_water', 'Tonno al naturale', 22, false),
  ('pasta_tonno_olive_e_capperi', 3, 'tomato_raw', 'Pomodori', 20, false),
  ('pasta_tonno_olive_e_capperi', 4, 'olive_oil', 'Olio EVO', 6, false),
  ('pasta_tonno_olive_e_capperi', 5, 'onion', 'Cipolla', 4, false),
  ('pasta_tonno_olive_e_capperi', 6, 'arugula_raw', 'Rucola', 5, false),
  ('pasta_tonno_e_zucchine', 1, 'pasta_dry', 'Pasta di semola', 43, false),
  ('pasta_tonno_e_zucchine', 2, 'tuna_canned_water', 'Tonno al naturale', 22, false),
  ('pasta_tonno_e_zucchine', 3, 'zucchini_raw', 'Zucchine', 28, false),
  ('pasta_tonno_e_zucchine', 4, 'olive_oil', 'Olio EVO', 5, false),
  ('pasta_tonno_e_zucchine', 5, 'onion', 'Cipolla', 2, false),
  ('spaghetti_gamberi_e_pomodorini', 1, 'pasta_dry', 'Pasta di semola', 43, false),
  ('spaghetti_gamberi_e_pomodorini', 2, 'shrimp', 'Gamberi', 22, false),
  ('spaghetti_gamberi_e_pomodorini', 3, 'tomato_raw', 'Pomodori', 28, false),
  ('spaghetti_gamberi_e_pomodorini', 4, 'olive_oil', 'Olio EVO', 5, false),
  ('spaghetti_gamberi_e_pomodorini', 5, 'onion', 'Cipolla', 2, false),
  ('spaghetti_gamberi_e_zucchine', 1, 'pasta_dry', 'Pasta di semola', 43, false),
  ('spaghetti_gamberi_e_zucchine', 2, 'shrimp', 'Gamberi', 22, false),
  ('spaghetti_gamberi_e_zucchine', 3, 'zucchini_raw', 'Zucchine', 28, false),
  ('spaghetti_gamberi_e_zucchine', 4, 'olive_oil', 'Olio EVO', 5, false),
  ('spaghetti_gamberi_e_zucchine', 5, 'onion', 'Cipolla', 2, false),
  ('linguine_salmone_e_zucchine', 1, 'pasta_dry', 'Pasta di semola', 43, false),
  ('linguine_salmone_e_zucchine', 2, 'fish_white', 'Salmone', 20, false),
  ('linguine_salmone_e_zucchine', 3, 'zucchini_raw', 'Zucchine', 29, false),
  ('linguine_salmone_e_zucchine', 4, 'olive_oil', 'Olio EVO', 5, false),
  ('linguine_salmone_e_zucchine', 5, 'onion', 'Cipolla', 3, false),
  ('pasta_salmone_e_pomodorini', 1, 'pasta_dry', 'Pasta di semola', 43, false),
  ('pasta_salmone_e_pomodorini', 2, 'fish_white', 'Salmone', 20, false),
  ('pasta_salmone_e_pomodorini', 3, 'tomato_raw', 'Pomodori', 29, false),
  ('pasta_salmone_e_pomodorini', 4, 'olive_oil', 'Olio EVO', 5, false),
  ('pasta_salmone_e_pomodorini', 5, 'onion', 'Cipolla', 3, false),
  ('pasta_merluzzo_e_pomodoro', 1, 'pasta_dry', 'Pasta di semola', 43, false),
  ('pasta_merluzzo_e_pomodoro', 2, 'cod_raw', 'Merluzzo', 22, false),
  ('pasta_merluzzo_e_pomodoro', 3, 'tomato_raw', 'Pomodori', 28, false),
  ('pasta_merluzzo_e_pomodoro', 4, 'olive_oil', 'Olio EVO', 5, false),
  ('pasta_merluzzo_e_pomodoro', 5, 'onion', 'Cipolla', 2, false),
  ('pasta_cozze_e_pomodorini', 1, 'pasta_dry', 'Pasta di semola', 43, false),
  ('pasta_cozze_e_pomodorini', 2, 'mussels', 'Cozze', 24, false),
  ('pasta_cozze_e_pomodorini', 3, 'tomato_raw', 'Pomodori', 26, false),
  ('pasta_cozze_e_pomodorini', 4, 'olive_oil', 'Olio EVO', 5, false),
  ('pasta_cozze_e_pomodorini', 5, 'onion', 'Cipolla', 2, false),
  ('pasta_vongole_e_zucchine', 1, 'pasta_dry', 'Pasta di semola', 43, false),
  ('pasta_vongole_e_zucchine', 2, 'clams', 'Vongole', 24, false),
  ('pasta_vongole_e_zucchine', 3, 'zucchini_raw', 'Zucchine', 26, false),
  ('pasta_vongole_e_zucchine', 4, 'olive_oil', 'Olio EVO', 5, false),
  ('pasta_vongole_e_zucchine', 5, 'onion', 'Cipolla', 2, false),
  ('pasta_pollo_e_zucchine', 1, 'pasta_dry', 'Pasta di semola', 43, false),
  ('pasta_pollo_e_zucchine', 2, 'chicken_breast', 'Petto di pollo', 22, false),
  ('pasta_pollo_e_zucchine', 3, 'zucchini_raw', 'Zucchine', 28, false),
  ('pasta_pollo_e_zucchine', 4, 'olive_oil', 'Olio EVO', 5, false),
  ('pasta_pollo_e_zucchine', 5, 'onion', 'Cipolla', 2, false),
  ('pasta_tacchino_e_pomodoro', 1, 'pasta_dry', 'Pasta di semola', 43, false),
  ('pasta_tacchino_e_pomodoro', 2, 'turkey_breast', 'Petto di tacchino', 22, false),
  ('pasta_tacchino_e_pomodoro', 3, 'tomato_raw', 'Pomodori', 28, false),
  ('pasta_tacchino_e_pomodoro', 4, 'olive_oil', 'Olio EVO', 5, false),
  ('pasta_tacchino_e_pomodoro', 5, 'onion', 'Cipolla', 2, false),
  ('pasta_salsiccia_e_zucchine', 1, 'pasta_dry', 'Pasta di semola', 42, false),
  ('pasta_salsiccia_e_zucchine', 2, 'salsiccia', 'Salsiccia', 20, false),
  ('pasta_salsiccia_e_zucchine', 3, 'zucchini_raw', 'Zucchine', 30, false),
  ('pasta_salsiccia_e_zucchine', 4, 'olive_oil', 'Olio EVO', 5, false),
  ('pasta_salsiccia_e_zucchine', 5, 'onion', 'Cipolla', 3, false),
  ('pasta_salsiccia_e_pomodoro', 1, 'pasta_dry', 'Pasta di semola', 42, false),
  ('pasta_salsiccia_e_pomodoro', 2, 'salsiccia', 'Salsiccia', 20, false),
  ('pasta_salsiccia_e_pomodoro', 3, 'tomato_raw', 'Pomodori', 30, false),
  ('pasta_salsiccia_e_pomodoro', 4, 'olive_oil', 'Olio EVO', 5, false),
  ('pasta_salsiccia_e_pomodoro', 5, 'onion', 'Cipolla', 3, false),
  ('pasta_ricotta_e_zucchine', 1, 'pasta_dry', 'Pasta di semola', 45, false),
  ('pasta_ricotta_e_zucchine', 2, 'ricotta_cheese', 'Ricotta', 20, false),
  ('pasta_ricotta_e_zucchine', 3, 'zucchini_raw', 'Zucchine', 28, false),
  ('pasta_ricotta_e_zucchine', 4, 'olive_oil', 'Olio EVO', 5, false),
  ('pasta_ricotta_e_zucchine', 5, 'parmigiano_reggiano', 'Parmigiano Reggiano', 2, false),
  ('pasta_piselli_e_prosciutto', 1, 'pasta_dry', 'Pasta di semola', 44, false),
  ('pasta_piselli_e_prosciutto', 2, 'peas_green', 'Piselli', 22, false),
  ('pasta_piselli_e_prosciutto', 3, 'ham_cooked', 'Prosciutto cotto', 18, false),
  ('pasta_piselli_e_prosciutto', 4, 'olive_oil', 'Olio EVO', 5, false),
  ('pasta_piselli_e_prosciutto', 5, 'parmigiano_reggiano', 'Parmigiano Reggiano', 4, false),
  ('pasta_piselli_e_prosciutto', 6, 'onion', 'Cipolla', 7, false),
  ('pasta_broccoli_e_parmigiano', 1, 'pasta_dry', 'Pasta di semola', 46, false),
  ('pasta_broccoli_e_parmigiano', 2, 'broccoli_raw', 'Broccoli', 36, false),
  ('pasta_broccoli_e_parmigiano', 3, 'parmigiano_reggiano', 'Parmigiano Reggiano', 8, false),
  ('pasta_broccoli_e_parmigiano', 4, 'olive_oil', 'Olio EVO', 6, false),
  ('pasta_broccoli_e_parmigiano', 5, 'onion', 'Cipolla', 4, false),
  ('pasta_cavolfiore_e_parmigiano', 1, 'pasta_dry', 'Pasta di semola', 46, false),
  ('pasta_cavolfiore_e_parmigiano', 2, 'cauliflower', 'Cavolfiore', 36, false),
  ('pasta_cavolfiore_e_parmigiano', 3, 'parmigiano_reggiano', 'Parmigiano Reggiano', 8, false),
  ('pasta_cavolfiore_e_parmigiano', 4, 'olive_oil', 'Olio EVO', 6, false),
  ('pasta_cavolfiore_e_parmigiano', 5, 'onion', 'Cipolla', 4, false),
  ('pasta_melanzane_e_pomodoro', 1, 'pasta_dry', 'Pasta di semola', 44, false),
  ('pasta_melanzane_e_pomodoro', 2, 'eggplant', 'Melanzane', 28, false),
  ('pasta_melanzane_e_pomodoro', 3, 'tomato_raw', 'Pomodori', 20, false),
  ('pasta_melanzane_e_pomodoro', 4, 'olive_oil', 'Olio EVO', 6, false),
  ('pasta_melanzane_e_pomodoro', 5, 'parmigiano_reggiano', 'Parmigiano Reggiano', 2, false),
  ('gnocchi_burro_e_parmigiano', 1, 'gnocchi_potato', 'Gnocchi di patate', 78, false),
  ('gnocchi_burro_e_parmigiano', 2, 'butter_unsalted', 'Burro', 7, false),
  ('gnocchi_burro_e_parmigiano', 3, 'parmigiano_reggiano', 'Parmigiano Reggiano', 15, false),
  ('gnocchi_pomodoro_e_mozzarella', 1, 'gnocchi_potato', 'Gnocchi di patate', 65, false),
  ('gnocchi_pomodoro_e_mozzarella', 2, 'tomato_raw', 'Pomodori', 20, false),
  ('gnocchi_pomodoro_e_mozzarella', 3, 'mozzarella', 'Mozzarella', 10, false),
  ('gnocchi_pomodoro_e_mozzarella', 4, 'olive_oil', 'Olio EVO', 5, false),
  ('gnocchi_al_ragu_leggero', 1, 'gnocchi_potato', 'Gnocchi di patate', 65, false),
  ('gnocchi_al_ragu_leggero', 2, 'beef_top_round', 'Fesa di manzo', 16, false),
  ('gnocchi_al_ragu_leggero', 3, 'tomatoes_canned', 'Pomodori pelati', 14, false),
  ('gnocchi_al_ragu_leggero', 4, 'olive_oil', 'Olio EVO', 5, false),
  ('gnocchi_zucchine_e_parmigiano', 1, 'gnocchi_potato', 'Gnocchi di patate', 68, false),
  ('gnocchi_zucchine_e_parmigiano', 2, 'zucchini_raw', 'Zucchine', 22, false),
  ('gnocchi_zucchine_e_parmigiano', 3, 'parmigiano_reggiano', 'Parmigiano Reggiano', 6, false),
  ('gnocchi_zucchine_e_parmigiano', 4, 'olive_oil', 'Olio EVO', 4, false),
  ('gnocchi_ricotta_e_spinaci', 1, 'gnocchi_potato', 'Gnocchi di patate', 62, false),
  ('gnocchi_ricotta_e_spinaci', 2, 'ricotta_cheese', 'Ricotta', 18, false),
  ('gnocchi_ricotta_e_spinaci', 3, 'spinach_raw', 'Spinaci', 15, false),
  ('gnocchi_ricotta_e_spinaci', 4, 'parmigiano_reggiano', 'Parmigiano Reggiano', 5, false),
  ('gnocchi_salmone_e_zucchine', 1, 'gnocchi_potato', 'Gnocchi di patate', 62, false),
  ('gnocchi_salmone_e_zucchine', 2, 'fish_white', 'Salmone', 17, false),
  ('gnocchi_salmone_e_zucchine', 3, 'zucchini_raw', 'Zucchine', 16, false),
  ('gnocchi_salmone_e_zucchine', 4, 'olive_oil', 'Olio EVO', 5, false),
  ('risotto_salsiccia_e_zucchine', 1, 'rice_arborio', 'Riso Arborio', 45, false),
  ('risotto_salsiccia_e_zucchine', 2, 'salsiccia', 'Salsiccia', 16, false),
  ('risotto_salsiccia_e_zucchine', 3, 'zucchini_raw', 'Zucchine', 24, false),
  ('risotto_salsiccia_e_zucchine', 4, 'parmigiano_reggiano', 'Parmigiano Reggiano', 5, false),
  ('risotto_salsiccia_e_zucchine', 5, 'olive_oil', 'Olio EVO', 4, false),
  ('risotto_salsiccia_e_zucchine', 6, 'onion', 'Cipolla', 3, false),
  ('risotto_salsiccia_e_zucchine', 7, NULL, 'Acqua / brodo neutro', 3, true),
  ('risotto_salsiccia_e_piselli', 1, 'rice_arborio', 'Riso Arborio', 45, false),
  ('risotto_salsiccia_e_piselli', 2, 'salsiccia', 'Salsiccia', 16, false),
  ('risotto_salsiccia_e_piselli', 3, 'peas_green', 'Piselli', 24, false),
  ('risotto_salsiccia_e_piselli', 4, 'parmigiano_reggiano', 'Parmigiano Reggiano', 5, false),
  ('risotto_salsiccia_e_piselli', 5, 'olive_oil', 'Olio EVO', 4, false),
  ('risotto_salsiccia_e_piselli', 6, 'onion', 'Cipolla', 3, false),
  ('risotto_salsiccia_e_piselli', 7, NULL, 'Acqua / brodo neutro', 3, true),
  ('risotto_pollo_e_zucchine', 1, 'rice_arborio', 'Riso Arborio', 46, false),
  ('risotto_pollo_e_zucchine', 2, 'chicken_breast', 'Petto di pollo', 18, false),
  ('risotto_pollo_e_zucchine', 3, 'zucchini_raw', 'Zucchine', 22, false),
  ('risotto_pollo_e_zucchine', 4, 'parmigiano_reggiano', 'Parmigiano Reggiano', 4, false),
  ('risotto_pollo_e_zucchine', 5, 'olive_oil', 'Olio EVO', 4, false),
  ('risotto_pollo_e_zucchine', 6, 'onion', 'Cipolla', 3, false),
  ('risotto_pollo_e_zucchine', 7, NULL, 'Acqua / brodo neutro', 3, true),
  ('risotto_pollo_e_funghi', 1, 'rice_arborio', 'Riso Arborio', 46, false),
  ('risotto_pollo_e_funghi', 2, 'chicken_breast', 'Petto di pollo', 18, false),
  ('risotto_pollo_e_funghi', 3, 'mushrooms_white', 'Funghi champignon', 22, false),
  ('risotto_pollo_e_funghi', 4, 'parmigiano_reggiano', 'Parmigiano Reggiano', 4, false),
  ('risotto_pollo_e_funghi', 5, 'olive_oil', 'Olio EVO', 4, false),
  ('risotto_pollo_e_funghi', 6, 'onion', 'Cipolla', 3, false),
  ('risotto_pollo_e_funghi', 7, NULL, 'Acqua / brodo neutro', 3, true),
  ('risotto_tacchino_e_carote', 1, 'rice_arborio', 'Riso Arborio', 46, false),
  ('risotto_tacchino_e_carote', 2, 'turkey_breast', 'Petto di tacchino', 18, false),
  ('risotto_tacchino_e_carote', 3, 'carrot_raw', 'Carote', 22, false),
  ('risotto_tacchino_e_carote', 4, 'parmigiano_reggiano', 'Parmigiano Reggiano', 4, false),
  ('risotto_tacchino_e_carote', 5, 'olive_oil', 'Olio EVO', 4, false),
  ('risotto_tacchino_e_carote', 6, 'onion', 'Cipolla', 3, false),
  ('risotto_tacchino_e_carote', 7, NULL, 'Acqua / brodo neutro', 3, true),
  ('risotto_gamberi_e_pomodorini', 1, 'rice_arborio', 'Riso Arborio', 46, false),
  ('risotto_gamberi_e_pomodorini', 2, 'shrimp', 'Gamberi', 18, false),
  ('risotto_gamberi_e_pomodorini', 3, 'tomato_raw', 'Pomodori', 22, false),
  ('risotto_gamberi_e_pomodorini', 4, 'parmigiano_reggiano', 'Parmigiano Reggiano', 3, false),
  ('risotto_gamberi_e_pomodorini', 5, 'olive_oil', 'Olio EVO', 5, false),
  ('risotto_gamberi_e_pomodorini', 6, 'onion', 'Cipolla', 3, false),
  ('risotto_gamberi_e_pomodorini', 7, NULL, 'Acqua / brodo neutro', 3, true),
  ('risotto_gamberi_e_piselli', 1, 'rice_arborio', 'Riso Arborio', 46, false),
  ('risotto_gamberi_e_piselli', 2, 'shrimp', 'Gamberi', 18, false),
  ('risotto_gamberi_e_piselli', 3, 'peas_green', 'Piselli', 22, false),
  ('risotto_gamberi_e_piselli', 4, 'parmigiano_reggiano', 'Parmigiano Reggiano', 3, false),
  ('risotto_gamberi_e_piselli', 5, 'olive_oil', 'Olio EVO', 5, false),
  ('risotto_gamberi_e_piselli', 6, 'onion', 'Cipolla', 3, false),
  ('risotto_gamberi_e_piselli', 7, NULL, 'Acqua / brodo neutro', 3, true),
  ('risotto_salmone_e_piselli', 1, 'rice_arborio', 'Riso Arborio', 46, false),
  ('risotto_salmone_e_piselli', 2, 'fish_white', 'Salmone', 18, false),
  ('risotto_salmone_e_piselli', 3, 'peas_green', 'Piselli', 22, false),
  ('risotto_salmone_e_piselli', 4, 'parmigiano_reggiano', 'Parmigiano Reggiano', 3, false),
  ('risotto_salmone_e_piselli', 5, 'olive_oil', 'Olio EVO', 5, false),
  ('risotto_salmone_e_piselli', 6, 'onion', 'Cipolla', 3, false),
  ('risotto_salmone_e_piselli', 7, NULL, 'Acqua / brodo neutro', 3, true),
  ('risotto_tonno_e_zucchine', 1, 'rice_arborio', 'Riso Arborio', 46, false),
  ('risotto_tonno_e_zucchine', 2, 'tuna_canned_water', 'Tonno al naturale', 18, false),
  ('risotto_tonno_e_zucchine', 3, 'zucchini_raw', 'Zucchine', 22, false),
  ('risotto_tonno_e_zucchine', 4, 'parmigiano_reggiano', 'Parmigiano Reggiano', 3, false),
  ('risotto_tonno_e_zucchine', 5, 'olive_oil', 'Olio EVO', 5, false),
  ('risotto_tonno_e_zucchine', 6, 'onion', 'Cipolla', 3, false),
  ('risotto_tonno_e_zucchine', 7, NULL, 'Acqua / brodo neutro', 3, true),
  ('risotto_zucca_e_parmigiano', 1, 'rice_arborio', 'Riso Arborio', 48, false),
  ('risotto_zucca_e_parmigiano', 2, 'butternut_squash', 'Zucca', 30, false),
  ('risotto_zucca_e_parmigiano', 3, 'parmigiano_reggiano', 'Parmigiano Reggiano', 8, false),
  ('risotto_zucca_e_parmigiano', 4, 'olive_oil', 'Olio EVO', 5, false),
  ('risotto_zucca_e_parmigiano', 5, 'onion', 'Cipolla', 4, false),
  ('risotto_zucca_e_parmigiano', 6, NULL, 'Acqua / brodo neutro', 5, true),
  ('risotto_carote_e_piselli', 1, 'rice_arborio', 'Riso Arborio', 48, false),
  ('risotto_carote_e_piselli', 2, 'carrot_raw', 'Carote', 20, false),
  ('risotto_carote_e_piselli', 3, 'peas_green', 'Piselli', 18, false),
  ('risotto_carote_e_piselli', 4, 'parmigiano_reggiano', 'Parmigiano Reggiano', 6, false),
  ('risotto_carote_e_piselli', 5, 'olive_oil', 'Olio EVO', 4, false),
  ('risotto_carote_e_piselli', 6, 'onion', 'Cipolla', 2, false),
  ('risotto_carote_e_piselli', 7, NULL, 'Acqua / brodo neutro', 2, true),
  ('risotto_broccoli_e_parmigiano', 1, 'rice_arborio', 'Riso Arborio', 48, false),
  ('risotto_broccoli_e_parmigiano', 2, 'broccoli_raw', 'Broccoli', 30, false),
  ('risotto_broccoli_e_parmigiano', 3, 'parmigiano_reggiano', 'Parmigiano Reggiano', 8, false),
  ('risotto_broccoli_e_parmigiano', 4, 'olive_oil', 'Olio EVO', 5, false),
  ('risotto_broccoli_e_parmigiano', 5, 'onion', 'Cipolla', 4, false),
  ('risotto_broccoli_e_parmigiano', 6, NULL, 'Acqua / brodo neutro', 5, true),
  ('torta_salata_ricotta_e_spinaci', 1, 'tortilla_flour', 'Tortilla di frumento (wrap)', 38, false),
  ('torta_salata_ricotta_e_spinaci', 2, 'ricotta_cheese', 'Ricotta', 25, false),
  ('torta_salata_ricotta_e_spinaci', 3, 'spinach_raw', 'Spinaci', 25, false),
  ('torta_salata_ricotta_e_spinaci', 4, 'egg_whole', 'Uova', 8, false),
  ('torta_salata_ricotta_e_spinaci', 5, 'parmigiano_reggiano', 'Parmigiano Reggiano', 4, false),
  ('torta_salata_prosciutto_e_zucchine', 1, 'tortilla_flour', 'Tortilla di frumento (wrap)', 38, false),
  ('torta_salata_prosciutto_e_zucchine', 2, 'ham_cooked', 'Prosciutto cotto', 22, false),
  ('torta_salata_prosciutto_e_zucchine', 3, 'zucchini_raw', 'Zucchine', 27, false),
  ('torta_salata_prosciutto_e_zucchine', 4, 'egg_whole', 'Uova', 8, false),
  ('torta_salata_prosciutto_e_zucchine', 5, 'parmigiano_reggiano', 'Parmigiano Reggiano', 5, false),
  ('torta_salata_pollo_e_verdure', 1, 'tortilla_flour', 'Tortilla di frumento (wrap)', 38, false),
  ('torta_salata_pollo_e_verdure', 2, 'chicken_breast', 'Petto di pollo', 22, false),
  ('torta_salata_pollo_e_verdure', 3, 'zucchini_raw', 'Zucchine', 15, false),
  ('torta_salata_pollo_e_verdure', 4, 'carrot_raw', 'Carote', 12, false),
  ('torta_salata_pollo_e_verdure', 5, 'egg_whole', 'Uova', 8, false),
  ('torta_salata_pollo_e_verdure', 6, 'parmigiano_reggiano', 'Parmigiano Reggiano', 5, false),
  ('torta_salata_tonno_e_pomodoro', 1, 'tortilla_flour', 'Tortilla di frumento (wrap)', 38, false),
  ('torta_salata_tonno_e_pomodoro', 2, 'tuna_canned_water', 'Tonno al naturale', 22, false),
  ('torta_salata_tonno_e_pomodoro', 3, 'tomato_raw', 'Pomodori', 25, false),
  ('torta_salata_tonno_e_pomodoro', 4, 'egg_whole', 'Uova', 10, false),
  ('torta_salata_tonno_e_pomodoro', 5, 'parmigiano_reggiano', 'Parmigiano Reggiano', 5, false),
  ('torta_salata_salmone_e_zucchine', 1, 'tortilla_flour', 'Tortilla di frumento (wrap)', 38, false),
  ('torta_salata_salmone_e_zucchine', 2, 'fish_white', 'Salmone', 20, false),
  ('torta_salata_salmone_e_zucchine', 3, 'zucchini_raw', 'Zucchine', 27, false),
  ('torta_salata_salmone_e_zucchine', 4, 'egg_whole', 'Uova', 10, false),
  ('torta_salata_salmone_e_zucchine', 5, 'parmigiano_reggiano', 'Parmigiano Reggiano', 5, false),
  ('torta_salata_mozzarella_e_pomodoro', 1, 'tortilla_flour', 'Tortilla di frumento (wrap)', 38, false),
  ('torta_salata_mozzarella_e_pomodoro', 2, 'mozzarella', 'Mozzarella', 24, false),
  ('torta_salata_mozzarella_e_pomodoro', 3, 'tomato_raw', 'Pomodori', 28, false),
  ('torta_salata_mozzarella_e_pomodoro', 4, 'egg_whole', 'Uova', 7, false),
  ('torta_salata_mozzarella_e_pomodoro', 5, 'olive_oil', 'Olio EVO', 3, false),
  ('torta_salata_prosciutto_e_mozzarella', 1, 'tortilla_flour', 'Tortilla di frumento (wrap)', 38, false),
  ('torta_salata_prosciutto_e_mozzarella', 2, 'ham_cooked', 'Prosciutto cotto', 22, false),
  ('torta_salata_prosciutto_e_mozzarella', 3, 'mozzarella', 'Mozzarella', 24, false),
  ('torta_salata_prosciutto_e_mozzarella', 4, 'egg_whole', 'Uova', 10, false),
  ('torta_salata_prosciutto_e_mozzarella', 5, 'olive_oil', 'Olio EVO', 6, false),
  ('torta_salata_broccoli_e_ricotta', 1, 'tortilla_flour', 'Tortilla di frumento (wrap)', 38, false),
  ('torta_salata_broccoli_e_ricotta', 2, 'broccoli_raw', 'Broccoli', 25, false),
  ('torta_salata_broccoli_e_ricotta', 3, 'ricotta_cheese', 'Ricotta', 22, false),
  ('torta_salata_broccoli_e_ricotta', 4, 'egg_whole', 'Uova', 10, false),
  ('torta_salata_broccoli_e_ricotta', 5, 'parmigiano_reggiano', 'Parmigiano Reggiano', 5, false),
  ('torta_salata_zucca_e_ricotta', 1, 'tortilla_flour', 'Tortilla di frumento (wrap)', 38, false),
  ('torta_salata_zucca_e_ricotta', 2, 'butternut_squash', 'Zucca', 25, false),
  ('torta_salata_zucca_e_ricotta', 3, 'ricotta_cheese', 'Ricotta', 22, false),
  ('torta_salata_zucca_e_ricotta', 4, 'egg_whole', 'Uova', 10, false),
  ('torta_salata_zucca_e_ricotta', 5, 'parmigiano_reggiano', 'Parmigiano Reggiano', 5, false),
  ('torta_salata_verdure_miste', 1, 'tortilla_flour', 'Tortilla di frumento (wrap)', 38, false),
  ('torta_salata_verdure_miste', 2, 'zucchini_raw', 'Zucchine', 15, false),
  ('torta_salata_verdure_miste', 3, 'carrot_raw', 'Carote', 12, false),
  ('torta_salata_verdure_miste', 4, 'bell_pepper_red', 'Peperoni', 12, false),
  ('torta_salata_verdure_miste', 5, 'egg_whole', 'Uova', 13, false),
  ('torta_salata_verdure_miste', 6, 'parmigiano_reggiano', 'Parmigiano Reggiano', 5, false),
  ('torta_salata_verdure_miste', 7, 'olive_oil', 'Olio EVO', 5, false)
) as v(recipe_key, position, canonical_key, label_it, grams_per_100g, is_neutral)
join public.nutrition_recipes r on r.recipe_key = v.recipe_key;

-- CONTROLLO (dopo l'apply; atteso: 97 ricette, 488 componenti, 0 fuori tolleranza,
-- 0 componenti non neutri senza fdc_id):
--   select count(*) from public.nutrition_recipes where source_version = 'mario_v12';
--   select count(*) from public.nutrition_recipe_components c
--     join public.nutrition_recipes r on r.id = c.recipe_id
--    where r.source_version = 'mario_v12';
--   select count(*) from public.nutrition_recipes r
--    where r.source_version = 'mario_v12' and not public.nutrition_recipe_grams_ok(r.id);
--   select count(*) from public.nutrition_recipe_components c
--     join public.nutrition_recipes r on r.id = c.recipe_id
--    where r.source_version = 'mario_v12' and not c.is_neutral and c.fdc_id is null;
