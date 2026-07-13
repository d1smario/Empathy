-- Libreria sedute del COACH (M2): il coach salva gli allenamenti preparati nella
-- PROPRIA libreria (coach_user_id, NON legata all'atleta) e li riusa con altri atleti.
-- Le tabelle esistono già in produzione (create fuori-repo): questa migrazione è
-- IDEMPOTENTE (IF NOT EXISTS) e serve a rendere lo schema riproducibile da repo.

create table if not exists public.coach_workout_library_folders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  coach_user_id uuid not null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_workout_library_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  coach_user_id uuid not null,
  folder_id uuid references public.coach_workout_library_folders(id) on delete set null,
  title text not null,
  description text not null default '',
  family text not null,
  discipline text not null default '',
  sport_tags text[] not null default '{}'::text[],
  duration_minutes integer not null default 0,
  tss_target integer not null default 0,
  contract_json jsonb not null,
  source_planned_workout_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_coach_workout_library_folders_coach on public.coach_workout_library_folders using btree (coach_user_id, sort_order);
create index if not exists idx_cwl_folders_org on public.coach_workout_library_folders using btree (org_id);
create index if not exists idx_coach_workout_library_items_coach_folder on public.coach_workout_library_items using btree (coach_user_id, folder_id);
create index if not exists idx_coach_workout_library_items_family_duration on public.coach_workout_library_items using btree (coach_user_id, family, duration_minutes, tss_target);
create index if not exists idx_coach_workout_library_items_metadata on public.coach_workout_library_items using gin (metadata);
create index if not exists idx_cwl_items_folder on public.coach_workout_library_items using btree (folder_id);
create index if not exists idx_cwl_items_org on public.coach_workout_library_items using btree (org_id);

alter table public.coach_workout_library_folders enable row level security;
alter table public.coach_workout_library_items enable row level security;

-- RLS: ogni coach vede/scrive SOLO la propria libreria; il platform admin tutto.
drop policy if exists coach_workout_library_folders_own on public.coach_workout_library_folders;
create policy coach_workout_library_folders_own on public.coach_workout_library_folders
  for all using ((select auth.uid()) = coach_user_id) with check ((select auth.uid()) = coach_user_id);

drop policy if exists platform_admin_all on public.coach_workout_library_folders;
create policy platform_admin_all on public.coach_workout_library_folders
  for all using (is_platform_admin()) with check (is_platform_admin());

drop policy if exists coach_workout_library_items_own on public.coach_workout_library_items;
create policy coach_workout_library_items_own on public.coach_workout_library_items
  for all using ((select auth.uid()) = coach_user_id) with check ((select auth.uid()) = coach_user_id);

drop policy if exists platform_admin_all on public.coach_workout_library_items;
create policy platform_admin_all on public.coach_workout_library_items
  for all using (is_platform_admin()) with check (is_platform_admin());
