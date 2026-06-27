-- Hardening accesso coach (audit lato coach 2026-06-28). Applicato in prod via MCP.
-- Idempotente. Vedi anche app-level gate: lib/athlete/can-access-athlete-data.ts.

-- (1) Helper: coach approvato (SECURITY DEFINER → legge lo stato bypassando RLS).
create or replace function public._is_approved_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.app_user_profiles
    where user_id = auth.uid()
      and role = 'coach'
      and platform_coach_status = 'approved'
  );
$fn$;

-- (2) SELECT su coach_athletes solo per coach APPROVATI. Ogni policy a valle (inline o via
-- _can_read_athlete) e le letture browser-dirette fanno exists(select from coach_athletes)
-- soggetto a RLS → un coach sospeso/in-attesa è negato in blocco, senza perdere i legami.
alter policy coach_athletes_select_own on public.coach_athletes
  using (((select auth.uid()) = coach_user_id) and public._is_approved_coach());

-- (3) Niente self-write del coach su coach_athletes (i legami si creano solo via service-role
-- o RPC SECURITY DEFINER). La INSERT del coach consentiva self-grant verso atleti arbitrari.
drop policy if exists coach_athletes_insert_own on public.coach_athletes;
drop policy if exists coach_athletes_delete_own on public.coach_athletes;

-- (4) Il coach beneficiario di una commissione può leggere la sale collegata (CoachCommissionsView).
do $policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sales' and policyname='sales_coach_read') then
    create policy sales_coach_read on public.sales
      for select to authenticated
      using (exists (select 1 from public.commissions c where c.sale_id = sales.id and c.beneficiary_user_id = (select auth.uid())));
  end if;
end
$policy$;
