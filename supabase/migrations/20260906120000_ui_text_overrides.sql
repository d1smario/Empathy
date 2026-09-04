-- Pannello Admin «Testi»: override dei testi UI editabili senza deploy (2026-09-06)
-- ---------------------------------------------------------------------------
-- I testi vivono in apps/web/messages/<locale>.json (bundlati al build). Questa
-- tabella permette di SOVRASCRIVERLI a runtime: i18n/request.ts fonde i valori
-- PUBBLICATI sopra il JSON a ogni richiesta.
--
-- Flusso a due stadi (richiesto dal prodotto):
--   draft_value      → modifica salvata ma NON visibile sul sito
--   published_value  → ciò che il sito serve davvero (solo questo è leggibile da anon)
-- Il pulsante «Pubblica» copia draft → published. Così una modifica sbagliata
-- non finisce online per errore.
--
-- ⚠️ Applicare dall'EDITOR SQL Supabase (o via MCP apply_migration) — MAI
-- `supabase db push`: la migration history del repo non è registrata in remoto.

create table if not exists public.ui_text_overrides (
  id uuid primary key default gen_random_uuid(),
  -- 'vetrina' = sito pubblico, 'app' = piattaforma interna. Serve solo ai due tab
  -- dell'admin: a runtime il merge non guarda lo scope.
  scope text not null check (scope in ('vetrina', 'app')),
  locale text not null,
  -- Percorso puntato dentro l'albero dei messaggi, es. 'Vetrina.home.heroTitle'.
  -- I segmenti numerici indicizzano gli array (es. 'Vetrina.home.audienceAthletePoints.0').
  text_key text not null,
  draft_value text,
  published_value text,
  published_at timestamptz,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (locale, text_key)
);

comment on table public.ui_text_overrides is
  'Override dei testi UI per lingua, gestiti da Admin → Testi. Solo published_value raggiunge il sito; draft_value è la bozza non pubblicata.';
comment on column public.ui_text_overrides.text_key is
  'Dot-path nell''albero dei messaggi next-intl; i segmenti numerici sono indici di array.';
comment on column public.ui_text_overrides.published_value is
  'Valore servito dal sito. NULL = nessun override attivo → vale il JSON del repo.';

-- Il runtime legge SOLO le righe pubblicate della lingua corrente: indice parziale.
create index if not exists ui_text_overrides_published_idx
  on public.ui_text_overrides (locale)
  where published_value is not null;

-- Coda «da pubblicare» del pannello admin.
create index if not exists ui_text_overrides_pending_idx
  on public.ui_text_overrides (scope)
  where draft_value is not null and draft_value is distinct from published_value;

drop trigger if exists set_ui_text_overrides_updated_at on public.ui_text_overrides;
create trigger set_ui_text_overrides_updated_at
  before update on public.ui_text_overrides
  for each row execute function public.set_updated_at();

alter table public.ui_text_overrides enable row level security;

-- Lettura pubblica delle SOLE righe pubblicate: i18n/request.ts gira con il client
-- anon a ogni render, anche per visitatori anonimi della vetrina. Le bozze restano invisibili.
drop policy if exists ui_text_overrides_read_published on public.ui_text_overrides;
create policy ui_text_overrides_read_published
  on public.ui_text_overrides
  for select
  to anon, authenticated
  using (published_value is not null);

-- Scrittura riservata al platform admin (stesso pattern di supported_locales/products).
drop policy if exists ui_text_overrides_admin_all on public.ui_text_overrides;
create policy ui_text_overrides_admin_all
  on public.ui_text_overrides
  for all
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));
