-- Archive or permanently delete any active wallet, including the current
-- default. When possible another active wallet is promoted in the same
-- transaction so new expenses keep a sensible payment source.
create or replace function public.manage_wallet(
  p_wallet_id uuid,
  p_action text
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_default boolean;
  v_replacement uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_action not in ('archive', 'delete') then raise exception 'unsupported wallet action'; end if;

  select is_default into v_is_default
  from public.wallets
  where id = p_wallet_id and user_id = v_user and status = 'active'
  for update;
  if not found then raise exception 'wallet not found'; end if;

  select id into v_replacement
  from public.wallets
  where user_id = v_user and status = 'active' and id <> p_wallet_id
  order by created_at
  limit 1
  for update;

  if v_is_default then
    update public.wallets set is_default = false where id = p_wallet_id;
  end if;

  if p_action = 'archive' then
    update public.wallets set status = 'archived', is_default = false where id = p_wallet_id;
  else
    delete from public.wallets where id = p_wallet_id;
  end if;

  if v_is_default and v_replacement is not null then
    update public.wallets set is_default = true where id = v_replacement;
  end if;
  return p_wallet_id;
end;
$$;

grant execute on function public.manage_wallet(uuid, text) to authenticated;
