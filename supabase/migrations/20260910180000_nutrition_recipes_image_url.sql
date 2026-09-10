-- Le ricette non avevano dove mettere una fotografia: la colonna mancava del tutto, quindi
-- «manca l'immagine» non era un file da caricare ma un posto da creare. Stessa forma di
-- `fdc_food.image_url` e di `nutrition_menu_foods`: un indirizzo, non il file.
alter table public.nutrition_recipes
  add column if not exists image_url text;

comment on column public.nutrition_recipes.image_url is
  'Indirizzo della fotografia della ricetta (bucket food-images). NULL = da produrre.';
