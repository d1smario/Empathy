-- Nome canonico su app_user_profiles (2026-07-15)
-- ------------------------------------------------------------------------
-- Problema: il nome dell'account non aveva un posto canonico. Per un atleta
-- vive in athlete_profiles; ma un coach ha athlete_id=null e, alla promozione
-- ad allenatore, il suo athlete_profiles viene SCOLLEGATO → il nome resta orfano
-- e il display (es. banner "invitato da <coach>") cadeva sull'email.
-- Fix: colonna canonica per-account, popolata al bootstrap per atleti E coach,
-- fonte unica del display name. Applicata via MCP apply_migration + execute_sql;
-- versionata qui per tracciabilità.

-- 1) Colonne
alter table public.app_user_profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

comment on column public.app_user_profiles.first_name is
  'Nome canonico dell''account (una riga per utente, sempre presente). Fonte unica per il display name, indipendente da athlete_profiles (che si scollega alla promozione a coach).';
comment on column public.app_user_profiles.last_name is
  'Cognome canonico dell''account. Vedi first_name.';

-- 2) Backfill dai nomi esistenti (metadata → billing → athlete_profiles
--    collegato → athlete_profiles orfano per email).
with resolved as (
  select p.user_id,
    coalesce(
      nullif(btrim(u.raw_user_meta_data->>'first_name'),''),
      nullif(btrim(bp.first_name),''),
      nullif(btrim(ap.first_name),''),
      nullif(btrim(apo.first_name),'')
    ) as first_name,
    coalesce(
      nullif(btrim(u.raw_user_meta_data->>'last_name'),''),
      nullif(btrim(bp.last_name),''),
      nullif(btrim(ap.last_name),''),
      nullif(btrim(apo.last_name),'')
    ) as last_name
  from public.app_user_profiles p
  join auth.users u on u.id = p.user_id
  left join public.user_billing_profiles bp on bp.user_id = p.user_id
  left join public.athlete_profiles ap on ap.id = p.athlete_id
  left join lateral (
    select a.first_name, a.last_name
    from public.athlete_profiles a
    where lower(a.email) = lower(u.email)
    order by a.created_at asc
    limit 1
  ) apo on true
)
update public.app_user_profiles p
set first_name = r.first_name, last_name = r.last_name
from resolved r
where r.user_id = p.user_id
  and (p.first_name is null or p.last_name is null);
