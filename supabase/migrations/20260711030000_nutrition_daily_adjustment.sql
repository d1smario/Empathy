-- Delta additivi al piano nutrizione del giorno (loop adattivo breve periodo).
-- Non riscrive il piano base: è un EXTRA (kcal/carbo/acqua) sopra, con motivo, reversibile.
-- kind: 'reintegration' (delta positivo, post-allenamento) | 'reduction' (negativo, giorno corrente).
-- Applicato in prod via MCP il 2026-07-11 (idempotente).
create table if not exists public.nutrition_daily_adjustment (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles(id) on delete cascade,
  date date not null,
  kind text not null default 'reintegration',
  extra_kcal integer not null default 0,
  extra_carbs_g integer not null default 0,
  extra_water_ml integer not null default 0,
  reason text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, date, kind)
);

comment on table public.nutrition_daily_adjustment is 'Delta additivi al piano nutrizione del giorno (loop adattivo): reintegro/riduzione. Reversibile via upsert su (athlete_id,date,kind). Letto da Oggi/Nutrizione come extra.';

alter table public.nutrition_daily_adjustment enable row level security;

drop policy if exists nutrition_daily_adjustment_select_own on public.nutrition_daily_adjustment;
create policy nutrition_daily_adjustment_select_own on public.nutrition_daily_adjustment
  for select using (
    athlete_id in (select athlete_id from public.app_user_profiles where user_id = auth.uid())
  );
