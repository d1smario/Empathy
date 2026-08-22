-- QA fix c (verifica avversariale, 22 ago): nei dati v11 i due template spuntino
-- pane_casereccio_* stanno nel catch-all MIXED ma la loro base glucidica REALE è il
-- pane (BREAD, come gli altri 33 template a base pane). Con la rotazione per base
-- (fix c del codice) MIXED è trattata come «senza base»: riclassificarli a BREAD li
-- fa partecipare alla rotazione della base giusta invece di restare fuori rotazione.
--
-- Rieseguibile: il WHERE filtra sul valore corrente, la seconda esecuzione è un no-op.
-- NB: da applicare dall'editor SQL (migration history drift: MAI supabase db push).

update public.nutrition_recipes
set template_meta = jsonb_set(template_meta, '{primary_carb_family}', '"BREAD"')
where source_version = 'mario_v11'
  and recipe_key in ('pane_casereccio_bresaola_e_grana', 'pane_casereccio_prosciutto_crudo')
  and template_meta ->> 'primary_carb_family' = 'MIXED';
