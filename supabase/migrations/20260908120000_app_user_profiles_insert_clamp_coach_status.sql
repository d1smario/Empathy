-- C1 — INSERT: platform_coach_status FORZATO, non piu solo "riempito se NULL".
--
-- Buco chiuso: il ramo INSERT metteva 'pending' solo quando il campo arrivava NULL
-- (`if new.role = 'coach' and new.platform_coach_status is null`). Chi passava
-- esplicitamente 'approved' se lo teneva. Con la policy `app_user_profiles_insert_own`
-- (che consente di inserire la PROPRIA riga) un account senza riga profilo poteva
-- quindi crearsela gia coach approvato, e superare il gate applicativo delle rotte
-- referti che si fida di `platform_coach_status = 'approved'` come fatto non falsificabile.
--
-- Ora, per ogni chiamante diverso da service_role, sul ramo INSERT il valore e imposto
-- dal trigger qualunque cosa arrivi dal client: 'pending' se role='coach', NULL se
-- role='private' (stessa regola gia applicata dal ramo UPDATE).
--
-- Il ramo UPDATE resta IDENTICO: li la protezione funzionava gia.
--
-- Flussi legittimi non toccati:
--   * bootstrapAppUserProfile (apps/web/lib/auth/bootstrap-app-user-profile.ts) inserisce
--     con service_role quando configurato (esente dal trigger) e, nel fallback al client
--     utente, scrive esattamente `role === "coach" ? "pending" : null` — cioe gli stessi
--     valori che il clamp impone;
--   * accept_coach_referral() fa `insert into app_user_profiles (user_id, role) values (v_uid,'coach')`
--     delegando gia al trigger l'assegnazione di 'pending'.
create or replace function public.app_user_profiles_protect_platform_fields()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    if auth.role() = 'service_role' then
      return new;
    end if;

    if coalesce(new.is_platform_admin, false) = true then
      new.is_platform_admin := false;
    end if;

    -- FORZATO, non piu condizionato all'arrivo di un NULL.
    if new.role = 'coach' then
      new.platform_coach_status := 'pending';
    else
      new.platform_coach_status := null;
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if auth.role() = 'service_role' then
      return new;
    end if;

    new.is_platform_admin := old.is_platform_admin;

    if new.role = 'private' then
      new.platform_coach_status := null;
    elsif new.platform_coach_status is distinct from old.platform_coach_status then
      if old.role = 'private' and new.role = 'coach' and new.platform_coach_status = 'pending' then
        null;
      elsif old.role = 'coach' and new.role = 'coach' and old.platform_coach_status = 'pending' and new.platform_coach_status = 'pending' then
        null;
      else
        new.platform_coach_status := old.platform_coach_status;
      end if;
    end if;

    return new;
  end if;

  return new;
end;
$function$;
