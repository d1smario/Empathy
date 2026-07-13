-- Fonte unica completa: meal_item deve poter contenere ANCHE gli item canonici
-- (staple senza alias FDC) e i placeholder, non solo cibi con fdc_id.
-- Applicata su prod ggmpegwnzbrjkeiydwqu il 2026-07-13 via MCP apply_migration.
ALTER TABLE public.meal_item ALTER COLUMN fdc_id DROP NOT NULL;
ALTER TABLE public.meal_item ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE public.meal_item ADD COLUMN IF NOT EXISTS canonical_key text;
COMMENT ON COLUMN public.meal_item.label IS 'Etichetta cibo quando fdc_id è null (item canonico/staple senza alias FDC).';
COMMENT ON COLUMN public.meal_item.canonical_key IS 'Chiave canonica dello staple (per ricomporre/immagine di categoria quando manca fdc_id).';
