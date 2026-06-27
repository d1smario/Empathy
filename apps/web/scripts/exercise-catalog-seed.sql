-- ============================================================================
-- exercise_catalog : catalogo esercizi DB-first (ex import statico nel bundle)
-- Dato pubblico non per-utente: RLS read pubblico (anon, authenticated),
-- scritture solo service_role. Naming coerente con nutrition_product_catalog.
-- ============================================================================

create table if not exists public.exercise_catalog (
  id                text primary key,
  slug              text not null,
  name              text not null,
  category          text not null,
  sport_tags        text[] not null default '{}',
  movement_pattern  text not null,
  muscle_groups     text[] not null default '{}',
  equipment         text[] not null default '{}',
  difficulty        text not null,
  primary_system    text not null,
  energy_system     text not null,
  physiology        jsonb not null,
  skills            jsonb not null,
  purpose           jsonb,
  provenance        jsonb not null default '[]'::jsonb,
  media             jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists exercise_catalog_slug_idx on public.exercise_catalog (slug);
create index if not exists exercise_catalog_category_idx on public.exercise_catalog (category);
create index if not exists exercise_catalog_movement_pattern_idx on public.exercise_catalog (movement_pattern);
create index if not exists exercise_catalog_primary_system_idx on public.exercise_catalog (primary_system);
create index if not exists exercise_catalog_energy_system_idx on public.exercise_catalog (energy_system);
create index if not exists exercise_catalog_sport_tags_gin on public.exercise_catalog using gin (sport_tags);
create index if not exists exercise_catalog_muscle_groups_gin on public.exercise_catalog using gin (muscle_groups);

alter table public.exercise_catalog enable row level security;

-- Catalogo pubblico: lettura per anon + authenticated.
drop policy if exists exercise_catalog_read_anon on public.exercise_catalog;
create policy exercise_catalog_read_anon
  on public.exercise_catalog
  for select
  to anon, authenticated
  using (true);

-- Scritture (insert/update/delete) riservate al service_role.
drop policy if exists exercise_catalog_write_service on public.exercise_catalog;
create policy exercise_catalog_write_service
  on public.exercise_catalog
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================================
-- Seed idempotente (ON CONFLICT (id) DO UPDATE)
-- ============================================================================

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-backsquat',
  'backsquat',
  'Back Squat',
  'strength',
  array['gym', 'crossfit', 'hyrox', 'powerlifting'],
  'squat',
  array['quadriceps', 'glutes'],
  array['barbell', 'rack'],
  'intermediate',
  'neuromuscular_strength',
  'anaerobic_lactic',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"anaerobic_lactic","lactateImpact":"high","cnsLoad":"high"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"high"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["anaerobic_lactic","anabolic"],"technicalScope":"sport_specific","technicalSports":["crossfit","hyrox","powerlifting"],"technicalTags":["strength_sport_specific"]}'::jsonb,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-deadlift',
  'deadlift',
  'Deadlift',
  'strength',
  array['gym', 'powerlifting', 'crossfit'],
  'hinge',
  array['posterior_chain', 'glutes'],
  array['barbell'],
  'intermediate',
  'neuromuscular_strength',
  'anaerobic_alactic',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_alactic","energySystem":"anaerobic_alactic","lactateImpact":"medium","cnsLoad":"high"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"high"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["anaerobic_alactic","anabolic"],"technicalScope":"sport_specific","technicalSports":["powerlifting","crossfit"],"technicalTags":["strength_sport_specific"]}'::jsonb,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-bench',
  'benchpress',
  'Bench Press',
  'strength',
  array['gym', 'powerlifting', 'crossfit'],
  'push',
  array['chest', 'shoulders', 'triceps'],
  array['barbell', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"low","balance":"medium","technique":"high"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"sport_specific","technicalSports":["powerlifting","crossfit"],"technicalTags":["strength_sport_specific"]}'::jsonb,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-pause-squat',
  'pausesquat',
  'Paused Squat',
  'strength',
  array['powerlifting', 'gym'],
  'squat',
  array['quadriceps', 'glutes', 'core'],
  array['barbell', 'rack'],
  'advanced',
  'neuromuscular_strength',
  'anaerobic_lactic',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"anaerobic_lactic","lactateImpact":"medium","cnsLoad":"high"}'::jsonb,
  '{"coordination":"medium","balance":"high","technique":"high"}'::jsonb,
  '{"functionalGoals":["strength","skill"],"metabolicGoals":["anaerobic_lactic","anabolic"],"technicalScope":"sport_specific","technicalSports":["powerlifting"],"technicalTags":["strength_sport_specific","technical_skill"]}'::jsonb,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-rdl',
  'romaniandeadlift',
  'Romanian Deadlift',
  'strength',
  array['gym', 'powerlifting', 'hyrox'],
  'hinge',
  array['posterior_chain', 'hamstrings'],
  array['barbell', 'dumbbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"high"}'::jsonb,
  '{"functionalGoals":["strength","hypertrophy"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-legpress',
  'legpress',
  'Leg Press',
  'strength',
  array['gym'],
  'squat',
  array['quadriceps', 'glutes'],
  array['leg_press'],
  'beginner',
  'neuromuscular_strength',
  'anaerobic_lactic',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"anaerobic_lactic","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength","hypertrophy"],"metabolicGoals":["anaerobic_lactic","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-latpulldown',
  'latpulldown',
  'Lat Pulldown',
  'strength',
  array['gym'],
  'pull',
  array['lats', 'biceps'],
  array['cable', 'machine'],
  'beginner',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"low","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength","hypertrophy"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-thruster',
  'thruster',
  'Thruster',
  'conditioning',
  array['crossfit'],
  'squat',
  array['quadriceps', 'shoulders', 'full_body'],
  array['barbell', 'dumbbell'],
  'intermediate',
  'anaerobic_lactic',
  'anaerobic_lactic',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"anaerobic_lactic","lactateImpact":"high","cnsLoad":"high"}'::jsonb,
  '{"coordination":"high","balance":"medium","technique":"high"}'::jsonb,
  '{"functionalGoals":["power","muscular_endurance"],"metabolicGoals":["anaerobic_lactic","catabolic"],"technicalScope":"sport_specific","technicalSports":["crossfit"],"technicalTags":["mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-wallball',
  'wallball',
  'Wall Ball',
  'conditioning',
  array['crossfit', 'hyrox'],
  'squat',
  array['quadriceps', 'shoulders', 'core'],
  array['medicine_ball', 'wall_target'],
  'intermediate',
  'anaerobic_lactic',
  'anaerobic_lactic',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"anaerobic_lactic","lactateImpact":"high","cnsLoad":"high"}'::jsonb,
  '{"coordination":"high","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["power","muscular_endurance","coordination"],"metabolicGoals":["anaerobic_lactic","catabolic"],"technicalScope":"sport_specific","technicalSports":["crossfit","hyrox"],"technicalTags":["mixed_modal_specific","race_specific"]}'::jsonb,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-kbswing',
  'kettlebellswing',
  'Kettlebell Swing',
  'conditioning',
  array['crossfit', 'gym', 'hyrox'],
  'hinge',
  array['posterior_chain', 'glutes'],
  array['kettlebell'],
  'intermediate',
  'neuromuscular_power',
  'anaerobic_lactic',
  '{"primarySystem":"neuromuscular_power","secondarySystem":"anaerobic_lactic","energySystem":"anaerobic_lactic","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["power","muscular_endurance"],"metabolicGoals":["anaerobic_lactic","catabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-ttb',
  'toestobar',
  'Toes-to-Bar',
  'skill',
  array['crossfit'],
  'pull',
  array['core', 'lats', 'hip_flexors'],
  array['pullup_bar'],
  'advanced',
  'coordination',
  'anaerobic_alactic',
  '{"primarySystem":"coordination","secondarySystem":"neuromuscular_strength","energySystem":"anaerobic_alactic","lactateImpact":"low","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"high"}'::jsonb,
  '{"functionalGoals":["coordination","skill","stability_neuro"],"metabolicGoals":["anaerobic_alactic"],"technicalScope":"sport_specific","technicalSports":["crossfit"],"technicalTags":["technical_skill","mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-burpee',
  'burpee',
  'Burpee',
  'conditioning',
  array['crossfit', 'hyrox', 'gym'],
  'locomotion',
  array['full_body'],
  array['bodyweight'],
  'intermediate',
  'anaerobic_lactic',
  'anaerobic_lactic',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"anaerobic_lactic","lactateImpact":"high","cnsLoad":"high"}'::jsonb,
  '{"coordination":"high","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["power","muscular_endurance"],"metabolicGoals":["anaerobic_lactic","catabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-sledpush',
  'sledpush',
  'Sled Push',
  'conditioning',
  array['hyrox', 'crossfit', 'gym'],
  'carry',
  array['quadriceps', 'glutes', 'calves'],
  array['sled'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"aerobic","energySystem":"mixed","lactateImpact":"high","cnsLoad":"high"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength","muscular_endurance"],"metabolicGoals":["mixed","catabolic"],"technicalScope":"sport_specific","technicalSports":["hyrox","crossfit"],"technicalTags":["race_specific","mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-farmer',
  'farmercarry',
  'Farmer Carry',
  'conditioning',
  array['hyrox', 'crossfit', 'gym'],
  'carry',
  array['forearms', 'traps', 'core'],
  array['dumbbell', 'kettlebell', 'handles'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"aerobic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength","stability_neuro","muscular_endurance"],"metabolicGoals":["mixed","catabolic"],"technicalScope":"sport_specific","technicalSports":["hyrox","crossfit"],"technicalTags":["race_specific","mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-skierg',
  'skierg',
  'Ski Erg',
  'endurance',
  array['hyrox', 'crossfit'],
  'locomotion',
  array['back', 'lats', 'triceps', 'core'],
  array['ski_erg'],
  'intermediate',
  'aerobic',
  'aerobic',
  '{"primarySystem":"aerobic","secondarySystem":"anaerobic_lactic","energySystem":"aerobic","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"medium","balance":"low","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance"],"metabolicGoals":["aerobic","catabolic"],"technicalScope":"sport_specific","technicalSports":["hyrox","crossfit"],"technicalTags":["race_specific","mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-rowerg',
  'rowerg',
  'Row Erg',
  'endurance',
  array['hyrox', 'crossfit', 'gym'],
  'locomotion',
  array['back', 'legs', 'full_body'],
  array['rower'],
  'intermediate',
  'aerobic',
  'aerobic',
  '{"primarySystem":"aerobic","secondarySystem":"anaerobic_lactic","energySystem":"aerobic","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"medium","balance":"low","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance"],"metabolicGoals":["aerobic","catabolic"],"technicalScope":"sport_specific","technicalSports":["hyrox","crossfit"],"technicalTags":["race_specific","mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-wlunge',
  'walkinglunge',
  'Walking Lunge',
  'strength',
  array['hyrox', 'gym', 'crossfit'],
  'squat',
  array['quadriceps', 'glutes'],
  array['dumbbell', 'barbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"stability","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength","stability_neuro"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-plank',
  'plank',
  'Plank',
  'accessory',
  array['gym', 'hyrox', 'crossfit', 'powerlifting'],
  'push',
  array['core', 'shoulders'],
  array['bodyweight'],
  'beginner',
  'stability',
  'aerobic',
  '{"primarySystem":"stability","secondarySystem":"mobility","energySystem":"aerobic","lactateImpact":"low","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"high","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro","mobility"],"metabolicGoals":["aerobic","recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-intervalrun',
  'intervalrun',
  'Interval Run',
  'endurance',
  array['hyrox', 'running'],
  'locomotion',
  array['legs', 'full_body'],
  array['shoes'],
  'intermediate',
  'aerobic',
  'aerobic',
  '{"primarySystem":"aerobic","secondarySystem":"anaerobic_lactic","energySystem":"aerobic","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"medium","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["muscular_endurance"],"metabolicGoals":["aerobic","catabolic"],"technicalScope":"sport_specific","technicalSports":["hyrox","running"],"technicalTags":["race_specific"]}'::jsonb,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-ohpress',
  'overheadpress',
  'Overhead Press',
  'strength',
  array['gym', 'powerlifting'],
  'push',
  array['shoulders', 'triceps', 'core'],
  array['barbell', 'dumbbell'],
  'intermediate',
  'neuromuscular_strength',
  'anaerobic_alactic',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_alactic","energySystem":"anaerobic_alactic","lactateImpact":"low","cnsLoad":"high"}'::jsonb,
  '{"coordination":"medium","balance":"high","technique":"high"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["anaerobic_alactic","anabolic"],"technicalScope":"sport_specific","technicalSports":["powerlifting"],"technicalTags":["strength_sport_specific"]}'::jsonb,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-inclinedbpress',
  'inclinedumbbellpress',
  'Incline Dumbbell Press',
  'strength',
  array['gym', 'hyrox'],
  'push',
  array['chest', 'shoulders', 'triceps'],
  array['dumbbell', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-machinechestpress',
  'machinechestpress',
  'Machine Chest Press',
  'strength',
  array['gym'],
  'push',
  array['chest', 'triceps', 'shoulders'],
  array['machine'],
  'beginner',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"low","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-cablefly',
  'cablefly',
  'Cable Fly',
  'accessory',
  array['gym'],
  'push',
  array['chest', 'shoulders'],
  array['cable'],
  'beginner',
  'hypertrophy',
  'mixed',
  '{"primarySystem":"hypertrophy","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-weighteddip',
  'weighteddip',
  'Weighted Dip',
  'strength',
  array['gym', 'crossfit'],
  'push',
  array['chest', 'triceps', 'shoulders'],
  array['bodyweight', 'dip_belt'],
  'advanced',
  'neuromuscular_strength',
  'anaerobic_alactic',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_alactic","energySystem":"anaerobic_alactic","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"high"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-lateralraise',
  'lateralraise',
  'Lateral Raise',
  'accessory',
  array['gym'],
  'push',
  array['shoulders'],
  array['dumbbell'],
  'beginner',
  'hypertrophy',
  'mixed',
  '{"primarySystem":"hypertrophy","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-reardeltfly',
  'reardeltfly',
  'Rear Delt Fly',
  'accessory',
  array['gym'],
  'pull',
  array['upper_back', 'shoulders'],
  array['dumbbell', 'machine'],
  'beginner',
  'hypertrophy',
  'mixed',
  '{"primarySystem":"hypertrophy","secondarySystem":"stability","energySystem":"mixed","lactateImpact":"low","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-barbellrow',
  'barbellrow',
  'Barbell Row',
  'strength',
  array['gym', 'powerlifting', 'crossfit'],
  'pull',
  array['lats', 'upper_back', 'biceps'],
  array['barbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-seatedcablerow',
  'seatedcablerow',
  'Seated Cable Row',
  'strength',
  array['gym'],
  'pull',
  array['lats', 'upper_back', 'biceps'],
  array['cable'],
  'beginner',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"low","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-weightedpullup',
  'weightedpullup',
  'Weighted Pull-Up',
  'strength',
  array['gym', 'crossfit'],
  'pull',
  array['lats', 'biceps', 'core'],
  array['bodyweight', 'dip_belt', 'pullup_bar'],
  'advanced',
  'neuromuscular_strength',
  'anaerobic_alactic',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_alactic","energySystem":"anaerobic_alactic","lactateImpact":"medium","cnsLoad":"high"}'::jsonb,
  '{"coordination":"high","balance":"medium","technique":"high"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-facepull',
  'facepull',
  'Face Pull',
  'accessory',
  array['gym', 'crossfit'],
  'pull',
  array['upper_back', 'shoulders', 'forearms'],
  array['cable'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"hypertrophy","energySystem":"mixed","lactateImpact":"low","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-barbellcurl',
  'barbellcurl',
  'Barbell Curl',
  'accessory',
  array['gym'],
  'pull',
  array['biceps', 'forearms'],
  array['barbell', 'e-z_curl_bar'],
  'beginner',
  'hypertrophy',
  'mixed',
  '{"primarySystem":"hypertrophy","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-hammercurl',
  'hammercurl',
  'Hammer Curl',
  'accessory',
  array['gym'],
  'pull',
  array['biceps', 'forearms'],
  array['dumbbell'],
  'beginner',
  'hypertrophy',
  'mixed',
  '{"primarySystem":"hypertrophy","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-tricepspushdown',
  'tricepspushdown',
  'Triceps Pushdown',
  'accessory',
  array['gym'],
  'push',
  array['triceps'],
  array['cable'],
  'beginner',
  'hypertrophy',
  'mixed',
  '{"primarySystem":"hypertrophy","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-skullcrusher',
  'skullcrusher',
  'Skull Crusher',
  'accessory',
  array['gym'],
  'push',
  array['triceps'],
  array['barbell', 'e-z_curl_bar', 'bench'],
  'intermediate',
  'hypertrophy',
  'mixed',
  '{"primarySystem":"hypertrophy","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"medium"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-frontsquat',
  'frontsquat',
  'Front Squat',
  'strength',
  array['gym', 'crossfit', 'weightlifting'],
  'squat',
  array['quadriceps', 'core', 'glutes'],
  array['barbell', 'rack'],
  'advanced',
  'neuromuscular_strength',
  'anaerobic_alactic',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_alactic","energySystem":"anaerobic_alactic","lactateImpact":"medium","cnsLoad":"high"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"high"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-bulgarian',
  'bulgariansplitsquat',
  'Bulgarian Split Squat',
  'strength',
  array['gym', 'hyrox'],
  'squat',
  array['quadriceps', 'glutes', 'core'],
  array['dumbbell', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"stability","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"medium"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-legextension',
  'legextension',
  'Leg Extension',
  'accessory',
  array['gym'],
  'squat',
  array['quadriceps'],
  array['machine'],
  'beginner',
  'hypertrophy',
  'mixed',
  '{"primarySystem":"hypertrophy","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-legcurl',
  'lyinglegcurl',
  'Lying Leg Curl',
  'accessory',
  array['gym'],
  'hinge',
  array['hamstrings'],
  array['machine'],
  'beginner',
  'hypertrophy',
  'mixed',
  '{"primarySystem":"hypertrophy","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-hipthrust',
  'hipthrust',
  'Hip Thrust',
  'strength',
  array['gym', 'powerlifting', 'hyrox'],
  'hinge',
  array['glutes', 'hamstrings', 'posterior_chain'],
  array['barbell', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-standingcalfraise',
  'standingcalfraise',
  'Standing Calf Raise',
  'accessory',
  array['gym', 'hyrox'],
  'squat',
  array['calves'],
  array['machine', 'bodyweight'],
  'beginner',
  'hypertrophy',
  'mixed',
  '{"primarySystem":"hypertrophy","secondarySystem":"aerobic","energySystem":"mixed","lactateImpact":"low","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"medium","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-seatedcalfraise',
  'seatedcalfraise',
  'Seated Calf Raise',
  'accessory',
  array['gym'],
  'squat',
  array['calves'],
  array['machine'],
  'beginner',
  'hypertrophy',
  'mixed',
  '{"primarySystem":"hypertrophy","secondarySystem":"aerobic","energySystem":"mixed","lactateImpact":"low","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-hangingkneeraise',
  'hangingkneeraise',
  'Hanging Knee Raise',
  'accessory',
  array['gym', 'crossfit'],
  'core_control',
  array['core', 'hip_flexors'],
  array['pullup_bar', 'bodyweight'],
  'intermediate',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"coordination","energySystem":"mixed","lactateImpact":"low","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-abwheel',
  'abwheelrollout',
  'Ab Wheel Rollout',
  'accessory',
  array['gym', 'crossfit'],
  'core_control',
  array['core', 'shoulders'],
  array['ab_wheel', 'bodyweight'],
  'intermediate',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"neuromuscular_strength","energySystem":"mixed","lactateImpact":"low","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"high","technique":"medium"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-boxjump',
  'boxjump',
  'Box Jump',
  'conditioning',
  array['crossfit', 'hyrox', 'gym'],
  'jump_landing',
  array['quadriceps', 'glutes', 'calves'],
  array['bodyweight', 'plyo_box'],
  'intermediate',
  'neuromuscular_power',
  'anaerobic_alactic',
  '{"primarySystem":"neuromuscular_power","secondarySystem":"anaerobic_alactic","energySystem":"anaerobic_alactic","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"medium","technique":"medium"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-pushup',
  'pushup',
  'Push-Up',
  'strength',
  array['gym', 'hyrox', 'crossfit'],
  'push',
  array['chest', 'triceps', 'core'],
  array['bodyweight'],
  'beginner',
  'neuromuscular_endurance',
  'mixed',
  '{"primarySystem":"neuromuscular_endurance","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-closegripbench',
  'closegripbenchpress',
  'Close-Grip Bench Press',
  'strength',
  array['gym', 'powerlifting'],
  'push',
  array['triceps', 'chest', 'shoulders'],
  array['barbell', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-pecdeck',
  'pecdeck',
  'Pec Deck',
  'accessory',
  array['gym'],
  'push',
  array['chest'],
  array['machine'],
  'beginner',
  'hypertrophy',
  'mixed',
  '{"primarySystem":"hypertrophy","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-chestsupportedrow',
  'chestsupportedrow',
  'Chest-Supported Row',
  'strength',
  array['gym'],
  'pull',
  array['upper_back', 'lats', 'biceps'],
  array['dumbbell', 'bench', 'machine'],
  'beginner',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"low","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-tbarrow',
  'tbarrow',
  'T-Bar Row',
  'strength',
  array['gym'],
  'pull',
  array['lats', 'upper_back', 'biceps'],
  array['barbell', 'machine'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"low","technique":"medium"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-straightarmpulldown',
  'straightarmpulldown',
  'Straight-Arm Pulldown',
  'accessory',
  array['gym'],
  'pull',
  array['lats', 'upper_back'],
  array['cable'],
  'beginner',
  'hypertrophy',
  'mixed',
  '{"primarySystem":"hypertrophy","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-preachercurl',
  'preachercurl',
  'Preacher Curl',
  'accessory',
  array['gym'],
  'pull',
  array['biceps', 'forearms'],
  array['e-z_curl_bar', 'bench', 'machine'],
  'beginner',
  'hypertrophy',
  'mixed',
  '{"primarySystem":"hypertrophy","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-reversecurl',
  'reversecurl',
  'Reverse Curl',
  'accessory',
  array['gym'],
  'pull',
  array['forearms', 'biceps'],
  array['barbell', 'e-z_curl_bar'],
  'beginner',
  'hypertrophy',
  'mixed',
  '{"primarySystem":"hypertrophy","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-goodmorning',
  'goodmorning',
  'Good Morning',
  'strength',
  array['gym', 'powerlifting'],
  'hinge',
  array['posterior_chain', 'hamstrings', 'glutes'],
  array['barbell'],
  'advanced',
  'neuromuscular_strength',
  'anaerobic_alactic',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_alactic","energySystem":"anaerobic_alactic","lactateImpact":"medium","cnsLoad":"high"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"high"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-singlelegrdl',
  'singlelegrdl',
  'Single-Leg Romanian Deadlift',
  'strength',
  array['gym', 'hyrox'],
  'hinge',
  array['hamstrings', 'glutes', 'core'],
  array['dumbbell', 'kettlebell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"stability","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"medium"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-glutebridge',
  'glutebridge',
  'Glute Bridge',
  'accessory',
  array['gym', 'hyrox'],
  'hinge',
  array['glutes', 'hamstrings'],
  array['bodyweight', 'barbell'],
  'beginner',
  'hypertrophy',
  'mixed',
  '{"primarySystem":"hypertrophy","secondarySystem":"stability","energySystem":"mixed","lactateImpact":"low","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"medium","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-sissyquat',
  'sissyquat',
  'Sissy Squat',
  'accessory',
  array['gym'],
  'squat',
  array['quadriceps'],
  array['bodyweight'],
  'intermediate',
  'hypertrophy',
  'mixed',
  '{"primarySystem":"hypertrophy","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-gobletsquat',
  'gobletsquat',
  'Goblet Squat',
  'strength',
  array['gym', 'hyrox', 'crossfit'],
  'squat',
  array['quadriceps', 'glutes', 'core'],
  array['dumbbell', 'kettlebell'],
  'beginner',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-stepup',
  'stepup',
  'Step-Up',
  'strength',
  array['gym', 'hyrox'],
  'squat',
  array['quadriceps', 'glutes', 'calves'],
  array['bodyweight', 'dumbbell', 'bench'],
  'beginner',
  'neuromuscular_endurance',
  'mixed',
  '{"primarySystem":"neuromuscular_endurance","secondarySystem":"stability","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-seatedabduction',
  'seatedhipabduction',
  'Seated Hip Abduction',
  'accessory',
  array['gym'],
  'hinge',
  array['glutes'],
  array['machine'],
  'beginner',
  'hypertrophy',
  'mixed',
  '{"primarySystem":"hypertrophy","secondarySystem":"stability","energySystem":"mixed","lactateImpact":"low","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-copenhagensideplank',
  'copenhagensideplank',
  'Copenhagen Side Plank',
  'accessory',
  array['gym', 'performance'],
  'core_control',
  array['core', 'hip_flexors', 'glutes'],
  array['bodyweight', 'bench'],
  'advanced',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"coordination","energySystem":"mixed","lactateImpact":"low","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"medium"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-russiantwist',
  'russiantwist',
  'Russian Twist',
  'accessory',
  array['gym', 'crossfit'],
  'core_control',
  array['core'],
  array['bodyweight', 'medicine_ball'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"low","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"medium","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-vup',
  'vup',
  'V-Up',
  'accessory',
  array['gym', 'crossfit'],
  'core_control',
  array['core', 'hip_flexors'],
  array['bodyweight'],
  'intermediate',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"coordination","energySystem":"mixed","lactateImpact":"low","cnsLoad":"low"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"low"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-jumprope',
  'jumprope',
  'Jump Rope',
  'conditioning',
  array['crossfit', 'hyrox', 'gym'],
  'locomotion',
  array['calves', 'full_body'],
  array['bodyweight', 'rope'],
  'beginner',
  'aerobic',
  'aerobic',
  '{"primarySystem":"aerobic","secondarySystem":"anaerobic_lactic","energySystem":"aerobic","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"high","balance":"medium","technique":"medium"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1-sledpull',
  'sledpull',
  'Sled Pull',
  'conditioning',
  array['hyrox', 'crossfit', 'gym'],
  'carry',
  array['posterior_chain', 'forearms', 'upper_back'],
  array['sled', 'rope'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"aerobic","energySystem":"mixed","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  null,
  '[{"source":"empathy_seed_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-hacksquat',
  'hacksquat',
  'Hack Squat',
  'strength',
  array['gym'],
  'squat',
  array['quadriceps', 'glutes'],
  array['machine'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-beltsquat',
  'beltsquat',
  'Belt Squat',
  'strength',
  array['gym'],
  'squat',
  array['quadriceps', 'glutes'],
  array['machine', 'belt'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-pendulumsquat',
  'pendulumsquat',
  'Pendulum Squat',
  'strength',
  array['gym'],
  'squat',
  array['quadriceps', 'glutes'],
  array['machine'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-smithsquat',
  'smithmachinesquat',
  'Smith Machine Squat',
  'strength',
  array['gym'],
  'squat',
  array['quadriceps', 'glutes'],
  array['machine'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-heelselevatedsquat',
  'heelselevatedsquat',
  'Heels-Elevated Squat',
  'strength',
  array['gym'],
  'squat',
  array['quadriceps', 'glutes'],
  array['bodyweight', 'dumbbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-landminesquat',
  'landminesquat',
  'Landmine Squat',
  'strength',
  array['gym'],
  'squat',
  array['quadriceps', 'glutes', 'core'],
  array['barbell', 'landmine'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-zerchersquat',
  'zerchersquat',
  'Zercher Squat',
  'strength',
  array['gym'],
  'squat',
  array['quadriceps', 'glutes', 'core'],
  array['barbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-safetybarsquat',
  'safetybarsquat',
  'Safety Bar Squat',
  'strength',
  array['gym', 'powerlifting'],
  'squat',
  array['quadriceps', 'glutes', 'core'],
  array['barbell', 'rack'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-reverselunge',
  'reverselunge',
  'Reverse Lunge',
  'strength',
  array['gym'],
  'squat',
  array['quadriceps', 'glutes'],
  array['dumbbell', 'barbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-laterallunge',
  'laterallunge',
  'Lateral Lunge',
  'strength',
  array['gym'],
  'squat',
  array['glutes', 'quadriceps', 'adductors'],
  array['bodyweight', 'dumbbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-cossacksquat',
  'cossacksquat',
  'Cossack Squat',
  'strength',
  array['gym'],
  'squat',
  array['glutes', 'quadriceps', 'adductors'],
  array['bodyweight'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-stepdown',
  'stepdown',
  'Step-Down',
  'strength',
  array['gym'],
  'squat',
  array['quadriceps', 'glutes'],
  array['bodyweight', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-pistolsquat',
  'pistolsquat',
  'Pistol Squat',
  'strength',
  array['gym', 'crossfit'],
  'squat',
  array['quadriceps', 'glutes', 'core'],
  array['bodyweight'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-spanishsquat',
  'spanishsquat',
  'Spanish Squat',
  'strength',
  array['gym'],
  'squat',
  array['quadriceps'],
  array['band'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-cyclistsquat',
  'cyclistsquat',
  'Cyclist Squat',
  'strength',
  array['gym'],
  'squat',
  array['quadriceps'],
  array['bodyweight', 'dumbbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-trapbardeadlift',
  'trapbardeadlift',
  'Trap Bar Deadlift',
  'strength',
  array['gym', 'hyrox'],
  'hinge',
  array['posterior_chain', 'glutes', 'quadriceps'],
  array['trap_bar'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-deficitdeadlift',
  'deficitdeadlift',
  'Deficit Deadlift',
  'strength',
  array['gym', 'powerlifting'],
  'hinge',
  array['posterior_chain', 'hamstrings', 'glutes'],
  array['barbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-sumodeadlift',
  'sumodeadlift',
  'Sumo Deadlift',
  'strength',
  array['gym', 'powerlifting'],
  'hinge',
  array['posterior_chain', 'glutes', 'adductors'],
  array['barbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-stifflegdeadlift',
  'stifflegdeadlift',
  'Stiff-Leg Deadlift',
  'strength',
  array['gym'],
  'hinge',
  array['hamstrings', 'posterior_chain'],
  array['barbell', 'dumbbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-nordiccurl',
  'nordiccurl',
  'Nordic Curl',
  'strength',
  array['gym'],
  'hinge',
  array['hamstrings'],
  array['bodyweight'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-glutehamraise',
  'glutehamraise',
  'Glute-Ham Raise',
  'strength',
  array['gym'],
  'squat',
  array['hamstrings', 'glutes'],
  array['machine'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-seatedlegcurl',
  'seatedlegcurl',
  'Seated Leg Curl',
  'strength',
  array['gym'],
  'hinge',
  array['hamstrings'],
  array['machine'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-singlelegpress',
  'singlelegpress',
  'Single-Leg Press',
  'strength',
  array['gym'],
  'squat',
  array['quadriceps', 'glutes'],
  array['leg_press'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-singlelegextension',
  'singlelegextension',
  'Single-Leg Extension',
  'strength',
  array['gym'],
  'squat',
  array['quadriceps'],
  array['machine'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-cablepullthrough',
  'cablepullthrough',
  'Cable Pull-Through',
  'strength',
  array['gym'],
  'squat',
  array['glutes', 'hamstrings'],
  array['cable'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-frogpump',
  'frogpump',
  'Frog Pump',
  'strength',
  array['gym'],
  'squat',
  array['glutes'],
  array['bodyweight', 'dumbbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-donkeycalfraise',
  'donkeycalfraise',
  'Donkey Calf Raise',
  'strength',
  array['gym'],
  'squat',
  array['calves'],
  array['machine', 'bodyweight'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-tibialisraise',
  'tibialisraise',
  'Tibialis Raise',
  'strength',
  array['gym'],
  'squat',
  array['calves'],
  array['bodyweight', 'machine'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-smithsplitsquat',
  'smithsplitsquat',
  'Smith Split Squat',
  'strength',
  array['gym'],
  'squat',
  array['quadriceps', 'glutes'],
  array['machine'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-frontfootelevatedsplit',
  'frontfootelevatedsplitsquat',
  'Front-Foot Elevated Split Squat',
  'strength',
  array['gym'],
  'squat',
  array['quadriceps', 'glutes'],
  array['dumbbell', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-inclinebarbellpress',
  'inclinebarbellpress',
  'Incline Barbell Press',
  'strength',
  array['gym'],
  'push',
  array['chest', 'shoulders', 'triceps'],
  array['barbell', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-declinebenchpress',
  'declinebenchpress',
  'Decline Bench Press',
  'strength',
  array['gym'],
  'push',
  array['chest', 'triceps'],
  array['barbell', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-dumbbellbenchpress',
  'dumbbellbenchpress',
  'Dumbbell Bench Press',
  'strength',
  array['gym'],
  'push',
  array['chest', 'shoulders', 'triceps'],
  array['dumbbell', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-dumbbellshoulderpress',
  'dumbbellshoulderpress',
  'Dumbbell Shoulder Press',
  'strength',
  array['gym'],
  'push',
  array['shoulders', 'triceps', 'core'],
  array['dumbbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-arnoldpress',
  'arnoldpress',
  'Arnold Press',
  'strength',
  array['gym'],
  'push',
  array['shoulders', 'triceps'],
  array['dumbbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-landminepress',
  'landminepress',
  'Landmine Press',
  'strength',
  array['gym'],
  'push',
  array['shoulders', 'chest', 'core'],
  array['barbell', 'landmine'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-pushpress',
  'pushpress',
  'Push Press',
  'strength',
  array['crossfit', 'gym'],
  'push',
  array['shoulders', 'triceps', 'quadriceps'],
  array['barbell', 'dumbbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-machineshoulderpress',
  'machineshoulderpress',
  'Machine Shoulder Press',
  'strength',
  array['gym'],
  'push',
  array['shoulders', 'triceps'],
  array['machine'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-smithbenchpress',
  'smithbenchpress',
  'Smith Bench Press',
  'strength',
  array['gym'],
  'push',
  array['chest', 'triceps', 'shoulders'],
  array['machine', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-floorpress',
  'floorpress',
  'Floor Press',
  'strength',
  array['gym', 'powerlifting'],
  'push',
  array['chest', 'triceps'],
  array['barbell', 'dumbbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-neutralgripdbpress',
  'neutralgripdumbbellpress',
  'Neutral-Grip Dumbbell Press',
  'strength',
  array['gym'],
  'push',
  array['chest', 'triceps'],
  array['dumbbell', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-cablechestpress',
  'cablechestpress',
  'Cable Chest Press',
  'strength',
  array['gym'],
  'push',
  array['chest', 'triceps', 'shoulders'],
  array['cable'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-ringpushup',
  'ringpushup',
  'Ring Push-Up',
  'strength',
  array['gym', 'crossfit'],
  'push',
  array['chest', 'triceps', 'core'],
  array['rings', 'bodyweight'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-pikepushup',
  'pikepushup',
  'Pike Push-Up',
  'strength',
  array['gym'],
  'push',
  array['shoulders', 'triceps', 'core'],
  array['bodyweight'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-handstandpushup',
  'handstandpushup',
  'Handstand Push-Up',
  'strength',
  array['crossfit', 'gym'],
  'push',
  array['shoulders', 'triceps', 'core'],
  array['bodyweight'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-inclinepushup',
  'inclinepushup',
  'Incline Push-Up',
  'strength',
  array['gym'],
  'push',
  array['chest', 'triceps'],
  array['bodyweight', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-declinepushup',
  'declinepushup',
  'Decline Push-Up',
  'strength',
  array['gym'],
  'push',
  array['chest', 'shoulders', 'triceps'],
  array['bodyweight', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-assisteddip',
  'assisteddip',
  'Assisted Dip',
  'strength',
  array['gym'],
  'push',
  array['chest', 'triceps', 'shoulders'],
  array['machine'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-machinefly',
  'machinefly',
  'Machine Fly',
  'strength',
  array['gym'],
  'push',
  array['chest'],
  array['machine'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-lowtohighfly',
  'lowtohighcablefly',
  'Low-to-High Cable Fly',
  'strength',
  array['gym'],
  'push',
  array['chest', 'shoulders'],
  array['cable'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-hightolowfly',
  'hightolowcablefly',
  'High-to-Low Cable Fly',
  'strength',
  array['gym'],
  'push',
  array['chest'],
  array['cable'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-platefrontraise',
  'platefrontraise',
  'Plate Front Raise',
  'strength',
  array['gym'],
  'push',
  array['shoulders'],
  array['weight_plate'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-benchdip',
  'benchdip',
  'Bench Dip',
  'strength',
  array['gym'],
  'push',
  array['triceps', 'shoulders'],
  array['bench', 'bodyweight'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-overheadtricepsext',
  'overheadtricepsextension',
  'Overhead Triceps Extension',
  'strength',
  array['gym'],
  'push',
  array['triceps'],
  array['dumbbell', 'cable'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-cableoverheadtriceps',
  'cableoverheadtricepsextension',
  'Cable Overhead Triceps Extension',
  'strength',
  array['gym'],
  'push',
  array['triceps'],
  array['cable'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-dumbbellkickback',
  'dumbbellkickback',
  'Dumbbell Kickback',
  'strength',
  array['gym'],
  'push',
  array['triceps'],
  array['dumbbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-jmpress',
  'jmpress',
  'JM Press',
  'strength',
  array['gym', 'powerlifting'],
  'push',
  array['triceps', 'chest'],
  array['barbell', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-guillotinepress',
  'guillotinepress',
  'Guillotine Press',
  'strength',
  array['gym'],
  'push',
  array['chest', 'shoulders'],
  array['barbell', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-chinup',
  'chinup',
  'Chin-Up',
  'strength',
  array['gym'],
  'pull',
  array['lats', 'biceps', 'core'],
  array['bodyweight', 'pullup_bar'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-assistedpullup',
  'assistedpullup',
  'Assisted Pull-Up',
  'strength',
  array['gym'],
  'pull',
  array['lats', 'biceps'],
  array['machine'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-neutralgrippulldown',
  'neutralgrippulldown',
  'Neutral-Grip Pulldown',
  'strength',
  array['gym'],
  'pull',
  array['lats', 'biceps'],
  array['cable', 'machine'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-singlearmpulldown',
  'singlearmpulldown',
  'Single-Arm Pulldown',
  'strength',
  array['gym'],
  'pull',
  array['lats', 'biceps'],
  array['cable'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-singlearmrow',
  'singlearmdumbbellrow',
  'Single-Arm Dumbbell Row',
  'strength',
  array['gym'],
  'pull',
  array['lats', 'upper_back', 'biceps'],
  array['dumbbell', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-sealrow',
  'sealrow',
  'Seal Row',
  'strength',
  array['gym'],
  'pull',
  array['upper_back', 'lats', 'biceps'],
  array['barbell', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-invertedrow',
  'invertedrow',
  'Inverted Row',
  'strength',
  array['gym'],
  'pull',
  array['upper_back', 'lats', 'biceps'],
  array['bodyweight', 'barbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-meadowsrow',
  'meadowsrow',
  'Meadows Row',
  'strength',
  array['gym'],
  'pull',
  array['lats', 'upper_back'],
  array['barbell', 'landmine'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-machinehighrow',
  'machinehighrow',
  'Machine High Row',
  'strength',
  array['gym'],
  'pull',
  array['upper_back', 'lats'],
  array['machine'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-machinelowrow',
  'machinelowrow',
  'Machine Low Row',
  'strength',
  array['gym'],
  'pull',
  array['lats', 'upper_back'],
  array['machine'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-cablepullover',
  'cablepullover',
  'Cable Pullover',
  'strength',
  array['gym'],
  'pull',
  array['lats', 'upper_back'],
  array['cable'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-machinepullover',
  'machinepullover',
  'Machine Pullover',
  'strength',
  array['gym'],
  'pull',
  array['lats', 'chest'],
  array['machine'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-shrug',
  'barbellshrug',
  'Barbell Shrug',
  'strength',
  array['gym'],
  'pull',
  array['upper_back', 'forearms'],
  array['barbell', 'dumbbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-inclinecurl',
  'inclinecurl',
  'Incline Curl',
  'strength',
  array['gym'],
  'pull',
  array['biceps'],
  array['dumbbell', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-concentrationcurl',
  'concentrationcurl',
  'Concentration Curl',
  'strength',
  array['gym'],
  'pull',
  array['biceps'],
  array['dumbbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-spidercurl',
  'spidercurl',
  'Spider Curl',
  'strength',
  array['gym'],
  'pull',
  array['biceps'],
  array['dumbbell', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-cablecurl',
  'cablecurl',
  'Cable Curl',
  'strength',
  array['gym'],
  'pull',
  array['biceps', 'forearms'],
  array['cable'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-preacherhammercurl',
  'preacherhammercurl',
  'Preacher Hammer Curl',
  'strength',
  array['gym'],
  'pull',
  array['biceps', 'forearms'],
  array['dumbbell', 'bench'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-wristcurl',
  'wristcurl',
  'Wrist Curl',
  'strength',
  array['gym'],
  'pull',
  array['forearms'],
  array['barbell', 'dumbbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-reversewristcurl',
  'reversewristcurl',
  'Reverse Wrist Curl',
  'strength',
  array['gym'],
  'pull',
  array['forearms'],
  array['barbell', 'dumbbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-zottmancurl',
  'zottmancurl',
  'Zottman Curl',
  'strength',
  array['gym'],
  'pull',
  array['biceps', 'forearms'],
  array['dumbbell'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-trapbarshrug',
  'trapbarshrug',
  'Trap Bar Shrug',
  'strength',
  array['gym'],
  'pull',
  array['upper_back', 'forearms'],
  array['trap_bar'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-yraise',
  'yraise',
  'Y Raise',
  'strength',
  array['gym'],
  'pull',
  array['upper_back', 'shoulders'],
  array['dumbbell', 'cable'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-bandpullapart',
  'bandpullapart',
  'Band Pull-Apart',
  'strength',
  array['gym'],
  'pull',
  array['upper_back', 'shoulders'],
  array['band'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-scappullup',
  'scappullup',
  'Scap Pull-Up',
  'strength',
  array['gym', 'crossfit'],
  'pull',
  array['lats', 'upper_back'],
  array['bodyweight', 'pullup_bar'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-widegripseatedrow',
  'widegripseatedrow',
  'Wide-Grip Seated Row',
  'strength',
  array['gym'],
  'pull',
  array['upper_back', 'lats'],
  array['cable'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-ropehammercurl',
  'ropehammercurl',
  'Rope Hammer Curl',
  'strength',
  array['gym'],
  'pull',
  array['biceps', 'forearms'],
  array['cable'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-rackpull',
  'rackpull',
  'Rack Pull',
  'strength',
  array['gym', 'powerlifting'],
  'pull',
  array['posterior_chain', 'upper_back'],
  array['barbell', 'rack'],
  'intermediate',
  'neuromuscular_strength',
  'mixed',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["strength"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-deadbug',
  'deadbug',
  'Dead Bug',
  'accessory',
  array['gym'],
  'core_control',
  array['core'],
  array['bodyweight'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro"],"metabolicGoals":["recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-hollowhold',
  'hollowhold',
  'Hollow Hold',
  'accessory',
  array['gym', 'crossfit'],
  'core_control',
  array['core'],
  array['bodyweight'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro"],"metabolicGoals":["recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-pallofpress',
  'pallofpress',
  'Pallof Press',
  'accessory',
  array['gym'],
  'core_control',
  array['core', 'obliques'],
  array['cable', 'band'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro"],"metabolicGoals":["recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-sideplank',
  'sideplank',
  'Side Plank',
  'accessory',
  array['gym'],
  'core_control',
  array['core', 'obliques'],
  array['bodyweight'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro"],"metabolicGoals":["recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-weightedsitup',
  'weightedsitup',
  'Weighted Sit-Up',
  'accessory',
  array['gym'],
  'core_control',
  array['core', 'hip_flexors'],
  array['bodyweight', 'weight_plate'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro"],"metabolicGoals":["recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-hanginglegraise',
  'hanginglegraise',
  'Hanging Leg Raise',
  'accessory',
  array['gym', 'crossfit'],
  'core_control',
  array['core', 'hip_flexors'],
  array['pullup_bar', 'bodyweight'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro"],"metabolicGoals":["recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-cablecrunch',
  'cablecrunch',
  'Cable Crunch',
  'accessory',
  array['gym'],
  'core_control',
  array['core'],
  array['cable'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro"],"metabolicGoals":["recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-reversecrunch',
  'reversecrunch',
  'Reverse Crunch',
  'accessory',
  array['gym'],
  'core_control',
  array['core', 'hip_flexors'],
  array['bodyweight'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro"],"metabolicGoals":["recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-mountainclimber',
  'mountainclimber',
  'Mountain Climber',
  'accessory',
  array['gym', 'crossfit'],
  'core_control',
  array['core', 'hip_flexors'],
  array['bodyweight'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro"],"metabolicGoals":["recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-birddog',
  'birddog',
  'Bird Dog',
  'accessory',
  array['gym'],
  'core_control',
  array['core', 'glutes'],
  array['bodyweight'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro"],"metabolicGoals":["recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-suitcasecarry',
  'suitcasecarry',
  'Suitcase Carry',
  'accessory',
  array['gym', 'hyrox'],
  'core_control',
  array['core', 'forearms'],
  array['dumbbell', 'kettlebell'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro"],"metabolicGoals":["recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-waitercarry',
  'waitercarry',
  'Waiter Carry',
  'accessory',
  array['gym'],
  'core_control',
  array['core', 'shoulders'],
  array['dumbbell', 'kettlebell'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro"],"metabolicGoals":["recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-stirthepot',
  'stirthepot',
  'Stir the Pot',
  'accessory',
  array['gym'],
  'core_control',
  array['core', 'shoulders'],
  array['exercise_ball'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro"],"metabolicGoals":["recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-bodysaw',
  'bodysaw',
  'Body Saw',
  'accessory',
  array['gym'],
  'core_control',
  array['core', 'shoulders'],
  array['bodyweight', 'slide_disc'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro"],"metabolicGoals":["recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-dragonflag',
  'dragonflag',
  'Dragon Flag',
  'accessory',
  array['gym'],
  'core_control',
  array['core', 'hip_flexors'],
  array['bodyweight', 'bench'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro"],"metabolicGoals":["recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-landminerotation',
  'landminerotation',
  'Landmine Rotation',
  'accessory',
  array['gym'],
  'core_control',
  array['core', 'obliques'],
  array['barbell', 'landmine'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro"],"metabolicGoals":["recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-woodchop',
  'woodchop',
  'Wood Chop',
  'accessory',
  array['gym'],
  'core_control',
  array['core', 'obliques'],
  array['cable'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro"],"metabolicGoals":["recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-backextension',
  'backextension',
  'Back Extension',
  'accessory',
  array['gym'],
  'core_control',
  array['posterior_chain', 'glutes'],
  array['machine', 'bodyweight'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro"],"metabolicGoals":["recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-supermanhold',
  'supermanhold',
  'Superman Hold',
  'accessory',
  array['gym'],
  'core_control',
  array['posterior_chain', 'core'],
  array['bodyweight'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro"],"metabolicGoals":["recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-openhagenadduction',
  'copenhagenadduction',
  'Copenhagen Adduction',
  'accessory',
  array['gym'],
  'core_control',
  array['core', 'adductors'],
  array['bodyweight', 'bench'],
  'beginner',
  'stability',
  'mixed',
  '{"primarySystem":"stability","secondarySystem":"anaerobic_lactic","energySystem":"mixed","lactateImpact":"medium","cnsLoad":"low"}'::jsonb,
  '{"coordination":"low","balance":"low","technique":"low"}'::jsonb,
  '{"functionalGoals":["stability_neuro"],"metabolicGoals":["recovery"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-assaultbike',
  'assaultbikesprint',
  'Assault Bike Sprint',
  'conditioning',
  array['crossfit', 'hyrox'],
  'locomotion',
  array['full_body'],
  array['air_bike'],
  'intermediate',
  'anaerobic_lactic',
  'mixed',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"mixed","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance"],"metabolicGoals":["mixed","catabolic"],"technicalScope":"sport_specific","technicalSports":["crossfit","hyrox"],"technicalTags":["race_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-echobike',
  'echobike',
  'Echo Bike',
  'conditioning',
  array['crossfit', 'hyrox'],
  'locomotion',
  array['full_body'],
  array['air_bike'],
  'intermediate',
  'anaerobic_lactic',
  'mixed',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"mixed","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance"],"metabolicGoals":["mixed","catabolic"],"technicalScope":"sport_specific","technicalSports":["crossfit","hyrox"],"technicalTags":["race_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-battleropes',
  'battleropes',
  'Battle Ropes',
  'conditioning',
  array['gym', 'crossfit'],
  'locomotion',
  array['shoulders', 'core', 'full_body'],
  array['rope'],
  'intermediate',
  'anaerobic_lactic',
  'anaerobic_lactic',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"anaerobic_lactic","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance"],"metabolicGoals":["aerobic","anaerobic_lactic","catabolic"],"technicalScope":"sport_specific","technicalSports":["crossfit"],"technicalTags":["mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-shuttlerun',
  'shuttlerun',
  'Shuttle Run',
  'conditioning',
  array['hyrox', 'crossfit', 'gym'],
  'locomotion',
  array['full_body', 'calves'],
  array['bodyweight'],
  'intermediate',
  'anaerobic_lactic',
  'mixed',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"mixed","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance"],"metabolicGoals":["mixed","catabolic"],"technicalScope":"sport_specific","technicalSports":["hyrox","crossfit"],"technicalTags":["race_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-bearcrawl',
  'bearcrawl',
  'Bear Crawl',
  'conditioning',
  array['crossfit', 'gym'],
  'locomotion',
  array['core', 'shoulders', 'full_body'],
  array['bodyweight'],
  'intermediate',
  'anaerobic_lactic',
  'anaerobic_lactic',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"anaerobic_lactic","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance"],"metabolicGoals":["aerobic","anaerobic_lactic","catabolic"],"technicalScope":"sport_specific","technicalSports":["crossfit"],"technicalTags":["mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-crabwalk',
  'crabwalk',
  'Crab Walk',
  'conditioning',
  array['gym'],
  'locomotion',
  array['core', 'shoulders', 'glutes'],
  array['bodyweight'],
  'intermediate',
  'anaerobic_lactic',
  'anaerobic_lactic',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"anaerobic_lactic","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance"],"metabolicGoals":["aerobic","anaerobic_lactic","catabolic"],"technicalScope":"generic","technicalSports":[],"technicalTags":[]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-boxstepover',
  'boxstepover',
  'Box Step-Over',
  'conditioning',
  array['hyrox', 'crossfit'],
  'locomotion',
  array['quadriceps', 'glutes', 'core'],
  array['plyo_box', 'bodyweight'],
  'intermediate',
  'anaerobic_lactic',
  'mixed',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"mixed","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance"],"metabolicGoals":["mixed","catabolic"],"technicalScope":"sport_specific","technicalSports":["hyrox","crossfit"],"technicalTags":["race_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-broadjump',
  'broadjump',
  'Broad Jump',
  'conditioning',
  array['crossfit', 'gym'],
  'jump_landing',
  array['glutes', 'quadriceps', 'calves'],
  array['bodyweight'],
  'intermediate',
  'anaerobic_lactic',
  'anaerobic_lactic',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"anaerobic_lactic","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance","power"],"metabolicGoals":["aerobic","anaerobic_lactic","catabolic"],"technicalScope":"sport_specific","technicalSports":["crossfit"],"technicalTags":["mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-sleddragbackward',
  'backwardsleddrag',
  'Backward Sled Drag',
  'conditioning',
  array['hyrox', 'gym'],
  'locomotion',
  array['quadriceps', 'calves'],
  array['sled', 'rope'],
  'intermediate',
  'anaerobic_lactic',
  'mixed',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"mixed","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance"],"metabolicGoals":["mixed","catabolic"],"technicalScope":"sport_specific","technicalSports":["hyrox"],"technicalTags":["race_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-sandbagcarry',
  'sandbagcarry',
  'Sandbag Carry',
  'conditioning',
  array['hyrox', 'crossfit'],
  'locomotion',
  array['core', 'full_body'],
  array['sandbag'],
  'intermediate',
  'anaerobic_lactic',
  'mixed',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"mixed","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance"],"metabolicGoals":["mixed","catabolic"],"technicalScope":"sport_specific","technicalSports":["hyrox","crossfit"],"technicalTags":["race_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-sandbaglunge',
  'sandbaglunge',
  'Sandbag Lunge',
  'conditioning',
  array['hyrox', 'crossfit'],
  'locomotion',
  array['quadriceps', 'glutes', 'core'],
  array['sandbag'],
  'intermediate',
  'anaerobic_lactic',
  'mixed',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"mixed","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance"],"metabolicGoals":["mixed","catabolic"],"technicalScope":"sport_specific","technicalSports":["hyrox","crossfit"],"technicalTags":["race_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-devilpress',
  'devilpress',
  'Devil Press',
  'conditioning',
  array['crossfit'],
  'locomotion',
  array['full_body', 'shoulders', 'core'],
  array['dumbbell'],
  'intermediate',
  'anaerobic_lactic',
  'anaerobic_lactic',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"anaerobic_lactic","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance"],"metabolicGoals":["aerobic","anaerobic_lactic","catabolic"],"technicalScope":"sport_specific","technicalSports":["crossfit"],"technicalTags":["mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-dumbbellsnatch',
  'dumbbellsnatch',
  'Dumbbell Snatch',
  'conditioning',
  array['crossfit', 'gym'],
  'locomotion',
  array['full_body', 'shoulders', 'glutes'],
  array['dumbbell'],
  'intermediate',
  'anaerobic_lactic',
  'anaerobic_lactic',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"anaerobic_lactic","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance","power"],"metabolicGoals":["aerobic","anaerobic_lactic","catabolic"],"technicalScope":"sport_specific","technicalSports":["crossfit"],"technicalTags":["mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-powerclean',
  'powerclean',
  'Power Clean',
  'conditioning',
  array['crossfit', 'weightlifting'],
  'locomotion',
  array['full_body', 'posterior_chain'],
  array['barbell'],
  'intermediate',
  'anaerobic_lactic',
  'anaerobic_lactic',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"anaerobic_lactic","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance","power"],"metabolicGoals":["aerobic","anaerobic_lactic","catabolic"],"technicalScope":"sport_specific","technicalSports":["crossfit","weightlifting"],"technicalTags":["mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-hangpowerclean',
  'hangpowerclean',
  'Hang Power Clean',
  'conditioning',
  array['crossfit', 'weightlifting'],
  'locomotion',
  array['full_body', 'posterior_chain'],
  array['barbell'],
  'intermediate',
  'anaerobic_lactic',
  'anaerobic_lactic',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"anaerobic_lactic","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance","power"],"metabolicGoals":["aerobic","anaerobic_lactic","catabolic"],"technicalScope":"sport_specific","technicalSports":["crossfit","weightlifting"],"technicalTags":["mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-wallwalk',
  'wallwalk',
  'Wall Walk',
  'conditioning',
  array['crossfit'],
  'locomotion',
  array['shoulders', 'core'],
  array['bodyweight'],
  'intermediate',
  'anaerobic_lactic',
  'anaerobic_lactic',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"anaerobic_lactic","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance"],"metabolicGoals":["aerobic","anaerobic_lactic","catabolic"],"technicalScope":"sport_specific","technicalSports":["crossfit"],"technicalTags":["mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-skibound',
  'skibound',
  'Ski Bound',
  'conditioning',
  array['hyrox', 'gym'],
  'jump_landing',
  array['glutes', 'calves', 'core'],
  array['bodyweight'],
  'intermediate',
  'anaerobic_lactic',
  'mixed',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"mixed","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance"],"metabolicGoals":["mixed","catabolic"],"technicalScope":"sport_specific","technicalSports":["hyrox"],"technicalTags":["race_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-medballslam',
  'medicineballslam',
  'Medicine Ball Slam',
  'conditioning',
  array['crossfit', 'gym'],
  'locomotion',
  array['core', 'lats', 'full_body'],
  array['medicine_ball'],
  'intermediate',
  'anaerobic_lactic',
  'anaerobic_lactic',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"anaerobic_lactic","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance"],"metabolicGoals":["aerobic","anaerobic_lactic","catabolic"],"technicalScope":"sport_specific","technicalSports":["crossfit"],"technicalTags":["mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-cleanandjerk',
  'cleanandjerk',
  'Clean and Jerk',
  'conditioning',
  array['crossfit', 'weightlifting'],
  'locomotion',
  array['full_body', 'shoulders', 'glutes'],
  array['barbell'],
  'intermediate',
  'anaerobic_lactic',
  'anaerobic_lactic',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"anaerobic_lactic","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance","power"],"metabolicGoals":["aerobic","anaerobic_lactic","catabolic"],"technicalScope":"sport_specific","technicalSports":["crossfit","weightlifting"],"technicalTags":["mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-snatchbalance',
  'snatchbalance',
  'Snatch Balance',
  'conditioning',
  array['crossfit', 'weightlifting'],
  'locomotion',
  array['full_body', 'shoulders', 'quadriceps'],
  array['barbell'],
  'intermediate',
  'anaerobic_lactic',
  'anaerobic_lactic',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"anaerobic_lactic","lactateImpact":"high","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"medium","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["muscular_endurance","power"],"metabolicGoals":["aerobic","anaerobic_lactic","catabolic"],"technicalScope":"sport_specific","technicalSports":["crossfit","weightlifting"],"technicalTags":["mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-competitionsquat',
  'competitionsquat',
  'Competition Squat',
  'skill',
  array['powerlifting'],
  'squat',
  array['quadriceps', 'glutes', 'core'],
  array['barbell', 'rack'],
  'advanced',
  'neuromuscular_strength',
  'anaerobic_alactic',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_alactic","energySystem":"anaerobic_alactic","lactateImpact":"low","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"high"}'::jsonb,
  '{"functionalGoals":["strength","skill"],"metabolicGoals":["anaerobic_alactic","anabolic"],"technicalScope":"sport_specific","technicalSports":["powerlifting"],"technicalTags":["strength_sport_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-competitionbench',
  'competitionbenchpress',
  'Competition Bench Press',
  'skill',
  array['powerlifting'],
  'push',
  array['chest', 'triceps', 'shoulders'],
  array['barbell', 'bench'],
  'advanced',
  'neuromuscular_strength',
  'anaerobic_alactic',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_alactic","energySystem":"anaerobic_alactic","lactateImpact":"low","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"high"}'::jsonb,
  '{"functionalGoals":["strength","skill"],"metabolicGoals":["anaerobic_alactic","anabolic"],"technicalScope":"sport_specific","technicalSports":["powerlifting"],"technicalTags":["strength_sport_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-competitiondeadlift',
  'competitiondeadlift',
  'Competition Deadlift',
  'skill',
  array['powerlifting'],
  'hinge',
  array['posterior_chain', 'glutes'],
  array['barbell'],
  'advanced',
  'neuromuscular_strength',
  'anaerobic_alactic',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"anaerobic_alactic","energySystem":"anaerobic_alactic","lactateImpact":"low","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"high"}'::jsonb,
  '{"functionalGoals":["strength","skill"],"metabolicGoals":["anaerobic_alactic","anabolic"],"technicalScope":"sport_specific","technicalSports":["powerlifting"],"technicalTags":["strength_sport_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-pinsquat',
  'pinsquat',
  'Pin Squat',
  'skill',
  array['powerlifting'],
  'squat',
  array['quadriceps', 'glutes', 'core'],
  array['barbell', 'rack'],
  'advanced',
  'neuromuscular_strength',
  'anaerobic_alactic',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"neuromuscular_strength","energySystem":"anaerobic_alactic","lactateImpact":"low","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"high"}'::jsonb,
  '{"functionalGoals":["strength","skill"],"metabolicGoals":["anaerobic_alactic","anabolic"],"technicalScope":"sport_specific","technicalSports":["powerlifting"],"technicalTags":["strength_sport_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-boardpress',
  'boardpress',
  'Board Press',
  'skill',
  array['powerlifting'],
  'push',
  array['chest', 'triceps'],
  array['barbell', 'bench'],
  'advanced',
  'neuromuscular_strength',
  'anaerobic_alactic',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"neuromuscular_strength","energySystem":"anaerobic_alactic","lactateImpact":"low","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"high"}'::jsonb,
  '{"functionalGoals":["strength","skill"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"sport_specific","technicalSports":["powerlifting"],"technicalTags":["strength_sport_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-spotopress',
  'spotopress',
  'Spoto Press',
  'skill',
  array['powerlifting'],
  'push',
  array['chest', 'triceps', 'shoulders'],
  array['barbell', 'bench'],
  'advanced',
  'neuromuscular_strength',
  'anaerobic_alactic',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"neuromuscular_strength","energySystem":"anaerobic_alactic","lactateImpact":"low","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"high"}'::jsonb,
  '{"functionalGoals":["strength","skill"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"sport_specific","technicalSports":["powerlifting"],"technicalTags":["strength_sport_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-blockpull',
  'blockpull',
  'Block Pull',
  'skill',
  array['powerlifting'],
  'hinge',
  array['posterior_chain', 'glutes'],
  array['barbell', 'blocks'],
  'advanced',
  'neuromuscular_strength',
  'anaerobic_alactic',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"neuromuscular_strength","energySystem":"anaerobic_alactic","lactateImpact":"low","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"high"}'::jsonb,
  '{"functionalGoals":["strength","skill"],"metabolicGoals":["anaerobic_alactic","anabolic"],"technicalScope":"sport_specific","technicalSports":["powerlifting"],"technicalTags":["strength_sport_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-pausedeadlift',
  'pausedeadlift',
  'Pause Deadlift',
  'skill',
  array['powerlifting'],
  'hinge',
  array['posterior_chain', 'glutes'],
  array['barbell'],
  'advanced',
  'neuromuscular_strength',
  'anaerobic_alactic',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"neuromuscular_strength","energySystem":"anaerobic_alactic","lactateImpact":"low","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"high"}'::jsonb,
  '{"functionalGoals":["strength","skill"],"metabolicGoals":["mixed","anabolic"],"technicalScope":"sport_specific","technicalSports":["powerlifting"],"technicalTags":["strength_sport_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-burpeebroadjump',
  'burpeebroadjump',
  'Burpee Broad Jump',
  'skill',
  array['hyrox'],
  'jump_landing',
  array['full_body', 'quadriceps', 'core'],
  array['bodyweight'],
  'advanced',
  'anaerobic_lactic',
  'anaerobic_alactic',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"anaerobic_alactic","lactateImpact":"low","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"medium","technique":"medium"}'::jsonb,
  '{"functionalGoals":["power","muscular_endurance"],"metabolicGoals":["anaerobic_lactic","catabolic"],"technicalScope":"sport_specific","technicalSports":["hyrox"],"technicalTags":["race_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-sandbagfrontcarry',
  'sandbagfrontcarry',
  'Sandbag Front Carry',
  'skill',
  array['hyrox'],
  'carry',
  array['core', 'full_body'],
  array['sandbag'],
  'advanced',
  'neuromuscular_strength',
  'anaerobic_alactic',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"aerobic","energySystem":"anaerobic_alactic","lactateImpact":"low","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"high"}'::jsonb,
  '{"functionalGoals":["strength","muscular_endurance"],"metabolicGoals":["mixed","catabolic"],"technicalScope":"sport_specific","technicalSports":["hyrox"],"technicalTags":["race_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-sleddrag',
  'sleddrag',
  'Sled Drag',
  'skill',
  array['hyrox'],
  'carry',
  array['posterior_chain', 'forearms', 'quadriceps'],
  array['sled', 'rope'],
  'advanced',
  'neuromuscular_strength',
  'anaerobic_alactic',
  '{"primarySystem":"neuromuscular_strength","secondarySystem":"aerobic","energySystem":"anaerobic_alactic","lactateImpact":"low","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"high"}'::jsonb,
  '{"functionalGoals":["strength","muscular_endurance"],"metabolicGoals":["mixed","catabolic"],"technicalScope":"sport_specific","technicalSports":["hyrox"],"technicalTags":["race_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-muscleup',
  'muscleup',
  'Muscle-Up',
  'skill',
  array['crossfit'],
  'technical_sequence',
  array['lats', 'triceps', 'core'],
  array['rings', 'pullup_bar'],
  'advanced',
  'coordination',
  'anaerobic_alactic',
  '{"primarySystem":"coordination","secondarySystem":"neuromuscular_strength","energySystem":"anaerobic_alactic","lactateImpact":"low","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"high"}'::jsonb,
  '{"functionalGoals":["coordination","skill","strength"],"metabolicGoals":["anaerobic_alactic"],"technicalScope":"sport_specific","technicalSports":["crossfit"],"technicalTags":["technical_skill","mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-chesttobar',
  'chesttobarpullup',
  'Chest-to-Bar Pull-Up',
  'skill',
  array['crossfit'],
  'technical_sequence',
  array['lats', 'biceps', 'core'],
  array['pullup_bar', 'bodyweight'],
  'advanced',
  'coordination',
  'anaerobic_alactic',
  '{"primarySystem":"coordination","secondarySystem":"neuromuscular_strength","energySystem":"anaerobic_alactic","lactateImpact":"low","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"high"}'::jsonb,
  '{"functionalGoals":["coordination","skill","strength"],"metabolicGoals":["anaerobic_alactic"],"technicalScope":"sport_specific","technicalSports":["crossfit"],"technicalTags":["technical_skill","mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-doubleunder',
  'doubleunder',
  'Double Under',
  'skill',
  array['crossfit'],
  'technical_sequence',
  array['calves', 'full_body'],
  array['rope', 'bodyweight'],
  'advanced',
  'coordination',
  'aerobic',
  '{"primarySystem":"coordination","secondarySystem":"neuromuscular_strength","energySystem":"aerobic","lactateImpact":"low","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"high"}'::jsonb,
  '{"functionalGoals":["coordination","skill","muscular_endurance"],"metabolicGoals":["aerobic","catabolic"],"technicalScope":"sport_specific","technicalSports":["crossfit"],"technicalTags":["technical_skill","mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-sandbagshouldering',
  'sandbagshouldering',
  'Sandbag Shouldering',
  'skill',
  array['hyrox', 'crossfit'],
  'technical_sequence',
  array['full_body', 'glutes', 'core'],
  array['sandbag'],
  'advanced',
  'neuromuscular_power',
  'anaerobic_alactic',
  '{"primarySystem":"neuromuscular_power","secondarySystem":"neuromuscular_strength","energySystem":"anaerobic_alactic","lactateImpact":"low","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"high"}'::jsonb,
  '{"functionalGoals":["strength","power","skill"],"metabolicGoals":["mixed","catabolic"],"technicalScope":"sport_specific","technicalSports":["hyrox","crossfit"],"technicalTags":["race_specific","mixed_modal_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();

insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  'empathy-b1x-wallballshot',
  'wallballshot',
  'Wall Ball Shot',
  'skill',
  array['crossfit', 'hyrox'],
  'technical_sequence',
  array['quadriceps', 'shoulders', 'core'],
  array['medicine_ball', 'wall_target'],
  'advanced',
  'anaerobic_lactic',
  'anaerobic_alactic',
  '{"primarySystem":"anaerobic_lactic","secondarySystem":"neuromuscular_power","energySystem":"anaerobic_alactic","lactateImpact":"low","cnsLoad":"medium"}'::jsonb,
  '{"coordination":"high","balance":"high","technique":"high"}'::jsonb,
  '{"functionalGoals":["coordination","power","muscular_endurance"],"metabolicGoals":["anaerobic_lactic","catabolic"],"technicalScope":"sport_specific","technicalSports":["crossfit","hyrox"],"technicalTags":["mixed_modal_specific","race_specific"]}'::jsonb,
  '[{"source":"empathy_generated_block1"}]'::jsonb,
  null
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();
