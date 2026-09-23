-- Wallets are the source of truth for available money. New wallet-linked
-- expenses reduce a balance; income and allowance entries increase it.
alter table public.wallets drop constraint if exists wallets_current_balance_check;

create table if not exists public.wallet_income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  kind text not null check (kind in ('income','allowance')),
  source varchar(100) not null check (char_length(btrim(source)) > 0),
  transaction_date date not null default current_date,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wallet_income_user_date_idx on public.wallet_income (user_id, transaction_date desc);
create index if not exists wallet_income_wallet_idx on public.wallet_income (wallet_id);
alter table public.wallet_income enable row level security;
create policy "wallet_income_select_own" on public.wallet_income for select to authenticated using ((select auth.uid()) = user_id);
create policy "wallet_income_insert_own" on public.wallet_income for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.wallets w where w.id = wallet_id and w.user_id = (select auth.uid())));
create policy "wallet_income_update_own" on public.wallet_income for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and exists (select 1 from public.wallets w where w.id = wallet_id and w.user_id = (select auth.uid())));
create policy "wallet_income_delete_own" on public.wallet_income for delete to authenticated using ((select auth.uid()) = user_id);
drop trigger if exists wallet_income_touch_updated_at on public.wallet_income;
create trigger wallet_income_touch_updated_at before update on public.wallet_income for each row execute function public.touch_updated_at();

create or replace function public.apply_wallet_expense_balance() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE','DELETE') and old.wallet_id is not null then
    update public.wallets set current_balance = current_balance + old.amount
      where id = old.wallet_id and user_id = old.user_id;
  end if;
  if tg_op in ('INSERT','UPDATE') and new.wallet_id is not null then
    update public.wallets set current_balance = current_balance - new.amount
      where id = new.wallet_id and user_id = new.user_id;
    if not found then raise exception 'wallet does not belong to expense owner'; end if;
  end if;
  return coalesce(new, old);
end; $$;

drop trigger if exists expenses_apply_wallet_balance on public.expenses;
create trigger expenses_apply_wallet_balance after insert or update of amount, wallet_id, user_id or delete on public.expenses
for each row execute function public.apply_wallet_expense_balance();

create or replace function public.apply_wallet_income_balance() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE','DELETE') then
    update public.wallets set current_balance = current_balance - old.amount
      where id = old.wallet_id and user_id = old.user_id;
  end if;
  if tg_op in ('INSERT','UPDATE') then
    update public.wallets set current_balance = current_balance + new.amount
      where id = new.wallet_id and user_id = new.user_id;
    if not found then raise exception 'wallet does not belong to income owner'; end if;
  end if;
  return coalesce(new, old);
end; $$;

drop trigger if exists wallet_income_apply_balance on public.wallet_income;
create trigger wallet_income_apply_balance after insert or update of amount, wallet_id, user_id or delete on public.wallet_income
for each row execute function public.apply_wallet_income_balance();

-- Receipt saves now accept a wallet so scanned expenses follow the same balance flow.
create or replace function public.save_receipt_expense(
  p_merchant text, p_amount numeric, p_category_id text, p_transaction_date date,
  p_notes text, p_receipt_path text, p_receipt_confidence integer,
  p_receipt_subtotal numeric, p_receipt_tax numeric, p_items jsonb, p_wallet_id uuid default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_user uuid := auth.uid(); v_expense uuid; v_item jsonb;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_amount <= 0 or length(trim(p_merchant)) = 0 or length(trim(p_category_id)) = 0 then raise exception 'invalid receipt expense'; end if;
  if p_wallet_id is not null and not exists (select 1 from public.wallets where id = p_wallet_id and user_id = v_user and status = 'active') then raise exception 'invalid wallet'; end if;
  insert into public.expenses (user_id, amount, merchant, category_id, wallet_id, transaction_date, notes, source, receipt_path, receipt_confidence, receipt_subtotal, receipt_tax)
  values (v_user, p_amount, trim(p_merchant), p_category_id, p_wallet_id, p_transaction_date, nullif(trim(p_notes), ''), 'receipt', p_receipt_path, p_receipt_confidence, p_receipt_subtotal, p_receipt_tax)
  returning id into v_expense;
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    insert into public.expense_items (expense_id, user_id, name, quantity, line_total)
    values (v_expense, v_user, trim(v_item->>'name'), greatest((v_item->>'quantity')::numeric, 0.01), greatest((v_item->>'line_total')::numeric, 0));
  end loop;
  return v_expense;
end; $$;
grant execute on function public.save_receipt_expense(text,numeric,text,date,text,text,integer,numeric,numeric,jsonb,uuid) to authenticated;
