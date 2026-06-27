-- public.aerobic_starter_presets — schema DDL (DB-first, fallback statico AEROBIC_STARTER_PRESETS).
-- Dato pubblico non per-utente: anon SELECT, service_role write.
-- Seed dati: scripts/seed-aerobic-starter-presets.ts (500 preset dal catalogo statico).
-- Loader app: lib/training/library/starter-pack-aerobic-db.ts

create table if not exists public.aerobic_starter_presets (
  preset_id text primary key,
  discipline text not null,
  adaptation_target text,
  phase text,
  title text not null,
  planned_minutes integer,
  tss integer,
  tags text[] not null default '{}',
  sort_order integer not null default 0,   -- preserva l'ordine dell'array statico
  data jsonb not null,                     -- AerobicStarterPreset completo
  updated_at timestamptz not null default now()
);

create index if not exists aerobic_starter_presets_discipline_idx on public.aerobic_starter_presets (discipline);
create index if not exists aerobic_starter_presets_tags_idx on public.aerobic_starter_presets using gin (tags);
create index if not exists aerobic_starter_presets_sort_idx on public.aerobic_starter_presets (sort_order);

alter table public.aerobic_starter_presets enable row level security;

do $policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='aerobic_starter_presets' and policyname='aerobic_starter_presets_read_anon') then
    create policy aerobic_starter_presets_read_anon on public.aerobic_starter_presets for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='aerobic_starter_presets' and policyname='aerobic_starter_presets_write_service') then
    create policy aerobic_starter_presets_write_service on public.aerobic_starter_presets for all to service_role using (true) with check (true);
  end if;
end
$policy$;
