-- Questionari per gli atleti: l'admin definisce questionari + domande, l'atleta risponde.
-- Decisioni prodotto: il COACH VEDE le risposte dell'atleta; la risposta è UNA SOLA e si
-- SOVRASCRIVE (ultima-vince via unique(athlete_id, question_id) + upsert onConflict, nessuno storico).
-- Scrittura questionari/domande SOLO via service-role (API admin): nessuna policy write client.

-- ── Questionari ────────────────────────────────────────────────────────────────
create table if not exists public.questionnaires (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text null,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz default now()
);

comment on table public.questionnaires is 'Questionari definiti dall''admin (titolo/descrizione/attivo/ordine). Write solo via service-role; la UI atleta filtra is_active.';

-- ── Domande ────────────────────────────────────────────────────────────────────
create table if not exists public.questionnaire_questions (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references public.questionnaires(id) on delete cascade,
  prompt text not null,
  kind text not null check (kind in ('text', 'number', 'boolean', 'choice')),
  options jsonb null,
  required boolean not null default false,
  sort_order int not null default 100,
  created_at timestamptz default now()
);

comment on table public.questionnaire_questions is 'Domande di un questionario. kind in text/number/boolean/choice; options = array JSON di stringhe per kind=choice.';

create index if not exists idx_questionnaire_questions_questionnaire
  on public.questionnaire_questions (questionnaire_id, sort_order);

-- ── Risposte (ultima-vince) ────────────────────────────────────────────────────
create table if not exists public.questionnaire_answers (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null,
  question_id uuid not null references public.questionnaire_questions(id) on delete cascade,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  unique (athlete_id, question_id)
);

comment on table public.questionnaire_answers is 'Risposte atleta: UNA per (athlete_id, question_id), sovrascritta con upsert onConflict (ultima-vince, nessuno storico).';

create index if not exists idx_questionnaire_answers_athlete
  on public.questionnaire_answers (athlete_id);

-- ── RLS ────────────────────────────────────────────────────────────────────────
alter table public.questionnaires enable row level security;
alter table public.questionnaire_questions enable row level security;
alter table public.questionnaire_answers enable row level security;

-- Questionari e domande: SELECT per tutti gli autenticati (tutte le righe; il filtro
-- is_active lo fa la UI atleta). NESSUNA policy write: l'admin scrive via service-role.
drop policy if exists questionnaires_select_authenticated on public.questionnaires;
create policy questionnaires_select_authenticated on public.questionnaires
  for select to authenticated using (true);

drop policy if exists questionnaire_questions_select_authenticated on public.questionnaire_questions;
create policy questionnaire_questions_select_authenticated on public.questionnaire_questions
  for select to authenticated using (true);

-- Risposte — SELECT own: stesso pattern di athlete_alerts_select_own (20260715230000).
drop policy if exists questionnaire_answers_select_own on public.questionnaire_answers;
create policy questionnaire_answers_select_own on public.questionnaire_answers
  for select using (
    athlete_id in (select athlete_id from public.app_user_profiles where user_id = auth.uid())
  );

-- Risposte — INSERT own (per l'upsert onConflict lato atleta).
drop policy if exists questionnaire_answers_insert_own on public.questionnaire_answers;
create policy questionnaire_answers_insert_own on public.questionnaire_answers
  for insert with check (
    athlete_id in (select athlete_id from public.app_user_profiles where user_id = auth.uid())
  );

-- Risposte — UPDATE own (la riga deve restare dell'atleta: with check).
drop policy if exists questionnaire_answers_update_own on public.questionnaire_answers;
create policy questionnaire_answers_update_own on public.questionnaire_answers
  for update using (
    athlete_id in (select athlete_id from public.app_user_profiles where user_id = auth.uid())
  ) with check (
    athlete_id in (select athlete_id from public.app_user_profiles where user_id = auth.uid())
  );

-- Risposte — SELECT coach: stesso pattern di athlete_alerts_coach_read (20260715230000),
-- link via coach_athletes. DECISIONE prodotto: il coach VEDE le risposte dell'atleta.
drop policy if exists questionnaire_answers_coach_read on public.questionnaire_answers;
create policy questionnaire_answers_coach_read on public.questionnaire_answers
  for select using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = (select auth.uid())
        and aup.role = 'coach'
        and exists (
          select 1
          from public.coach_athletes ca
          where ca.coach_user_id = (select auth.uid())
            and ca.athlete_id = questionnaire_answers.athlete_id
        )
    )
  );

-- Risposte — admin piattaforma: lettura/scrittura totale via is_platform_admin()
-- (stesso pattern di coach_workout_library, 20260714120000).
drop policy if exists questionnaire_answers_admin_all on public.questionnaire_answers;
create policy questionnaire_answers_admin_all on public.questionnaire_answers
  for all using (is_platform_admin()) with check (is_platform_admin());
