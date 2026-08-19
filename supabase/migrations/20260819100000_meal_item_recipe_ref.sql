-- Grammatica dei pasti (Mario v5), regola L04/V02: una ricetta nel piano si persiste come
-- i suoi INGREDIENTI in `meal_item` (uno per riga, ciascuno col proprio fdc_id del catalogo,
-- così la FK meal_item.fdc_id → fdc_food regge), con il riferimento alla ricetta madre.
--
-- PERCHÉ una colonna e non una riga «piatto»: una riga per il piatto chiuso avrebbe
-- raddoppiato le kcal della giornata (piatto + ingredienti) o richiesto un fdc_id inventato;
-- il payload della pagina Nutrizione mostra UN item «Pasta alla carbonara» ricostruito
-- dagli stessi ingredienti (Σ kcal identiche: invariante «una sola giornata alimentare»).
--
-- La chiave è testuale (recipe_key di nutrition_recipes) e NON una FK: le ricette possono
-- essere disattivate/rinominate senza toccare i piani storici, e il persist deve poter
-- scrivere anche se la tabella ricette è vuota. La memoria settimanale di rotazione legge
-- questa colonna per contare `recipe:<key>` come famiglia (meal-rotation-week-db.ts).
--
-- Il codice ha la cintura di rollout (retry senza colonna se 42703): applicare quando si
-- vuole, dall'editor SQL (MAI `supabase db push`, vedi drift della migration history).

alter table public.meal_item
  add column if not exists recipe_key text null;

comment on column public.meal_item.recipe_key is
  'Grammatica dei pasti: recipe_key di nutrition_recipes quando la riga è un ingrediente di una ricetta (le righe della stessa ricetta nello stesso meal condividono la chiave). NULL = alimento a sé.';

create index if not exists idx_meal_item_recipe_key
  on public.meal_item (recipe_key)
  where recipe_key is not null;
