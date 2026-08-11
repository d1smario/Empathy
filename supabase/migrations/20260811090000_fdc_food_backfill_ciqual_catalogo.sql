-- Backfill in `fdc_food` degli alimenti di catalogo che vivono solo in `nutrition_fdc_foods`.
--
-- IL GUASTO CHE CHIUDE (misurato in produzione l'11 agosto 2026):
-- `meal_item.fdc_id` ha il vincolo `meal_item_fdc_id_fkey FOREIGN KEY (fdc_id) REFERENCES fdc_food(fdc_id)`,
-- ma il motore sceglie gli alimenti da `nutrition_menu_foods`, le cui composizioni stanno in
-- `nutrition_fdc_foods` — che è un SOVRAINSIEME di `fdc_food` (8211 righe contro 8159).
-- L'import CIQUAL (commit 6268eb0) ha copiato le righe francesi in `nutrition_fdc_foods` con
-- fdc_id sintetico 900000000+codice, dichiarando che «il join nutrition_menu_foods -> nutrition_fdc_foods
-- regge invariato». Regge per la LETTURA, non per la SCRITTURA: 24 alimenti attivi del catalogo non
-- esistevano in `fdc_food`, quindi la FK rifiutava la riga.
--
-- Poiché gli item di un giorno si scrivono in un colpo solo, UN alimento rifiutato faceva cadere
-- l'INTERA lista: restavano i `meal` (che non hanno quella FK) con ZERO `meal_item`. Risultato
-- visibile: la pagina Nutrizione mostrava il piano (legge `nutrition_plan.response_payload`) mentre
-- la pagina Oggi restava vuota (legge meal/meal_item). Erano 16 i piani senza alimenti dal 4 agosto.
--
-- PERCHÉ COPIARE E NON CAMBIARE IL VINCOLO: 10 righe CIQUAL erano GIÀ state copiate in `fdc_food`
-- (data_type 'CIQUAL 2025', source_dataset 'ciqual_2025'). Questa migration completa quel lavoro
-- rimasto a metà invece di introdurre un secondo criterio: nessuna modifica di schema, nessun
-- cambio di semantica per i lettori esistenti, reversibile con una DELETE mirata.
--
-- Additiva e idempotente: `ON CONFLICT DO NOTHING` e il filtro NOT EXISTS la rendono rieseguibile.
-- La selezione è DINAMICA (non 24 id scritti a mano) così chiude anche i casi che si ripresentassero
-- fra la scrittura e l'applicazione.

insert into public.fdc_food (
  fdc_id, description, data_type, source_dataset, publication_date, food_category,
  kcal_100g, carbs_100g, protein_100g, fat_100g,
  fiber_100g, sugars_100g, sodium_mg_100g,
  glycemic_index_estimate, insulin_index_estimate, glycemic_load_100g, insulin_load_100g,
  metabolic_indices, vitamins, minerals, amino_acids, fatty_acids, other_nutrients, nutrients_raw,
  source_payload
)
select
  n.fdc_id,
  n.description,
  n.data_type,
  -- Stessa etichetta di provenienza delle 10 righe CIQUAL già presenti, così le due infornate
  -- restano indistinguibili per chi filtra su source_dataset.
  case when n.data_type = 'CIQUAL 2025' then 'ciqual_2025' else 'nutrition_fdc_foods' end,
  n.publication_date,
  n.food_category,
  coalesce(n.kcal_100g, 0),
  coalesce(n.carbs_100g, 0),
  coalesce(n.protein_100g, 0),
  coalesce(n.fat_100g, 0),
  n.fiber_100g,
  n.sugars_100g,
  n.sodium_mg_100g,
  n.glycemic_index_estimate,
  n.insulin_index_estimate,
  n.glycemic_load_100g,
  n.insulin_load_100g,
  coalesce(n.metabolic_indices, '{}'::jsonb),
  coalesce(n.vitamins, '[]'::jsonb),
  coalesce(n.minerals, '[]'::jsonb),
  coalesce(n.amino_acids, '[]'::jsonb),
  coalesce(n.fatty_acids, '[]'::jsonb),
  coalesce(n.other_nutrients, '[]'::jsonb),
  coalesce(n.nutrients_raw, '[]'::jsonb),
  n.source_payload
from public.nutrition_fdc_foods n
where exists (
        select 1 from public.nutrition_menu_foods c
        where c.fdc_id = n.fdc_id and c.is_active
      )
  and not exists (
        select 1 from public.fdc_food f where f.fdc_id = n.fdc_id
      )
on conflict (fdc_id) do nothing;
