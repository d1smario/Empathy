-- Redenzione promo ATOMICA (applicata in prod via MCP). Un solo UPDATE con guard su
-- max_redemptions → niente read-modify-write (race) né superamento del limite.
-- Usata da: stripe-checkout-session (ramo gratuito) e stripe-webhook (checkout.session.completed).
create or replace function public.redeem_promo_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.promo_codes
  set redemption_count = coalesce(redemption_count, 0) + 1,
      updated_at = now()
  where code = p_code
    and (max_redemptions is null or coalesce(redemption_count, 0) < max_redemptions);
  return found;
end;
$fn$;

revoke all on function public.redeem_promo_code(text) from public;
grant execute on function public.redeem_promo_code(text) to service_role;
