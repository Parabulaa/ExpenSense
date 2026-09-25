-- Wallet-based accounting upgrade.
--   * Every money movement records a local time next to its date.
--   * "Allowance" is folded into income; cash-in is its own kind (wallet up,
--     never spending, never a budget change).
--   * Wallet transfers move money between two wallets, with an optional fee
--     that leaves the source wallet only.
--   * Receipts carry a fingerprint so one receipt can never change a wallet twice.
--   * Monthly budgets no longer have their own total: category limits are the
--     budget, and a month row only groups them.
--   * Default categories can be hidden per user.

-- Time of day ---------------------------------------------------------------
-- current_date is the server's UTC date; users ahead of UTC (Philippines is
-- UTC+8) would otherwise be unable to log anything between midnight and 8 AM.
alter table public.expenses drop constraint if exists expenses_transaction_date_check;
alter table public.expenses add constraint expenses_transaction_date_check check (transaction_date <= current_date + 1);
alter table public.expenses add column if not exists transaction_time time;
alter table public.wallet_income add column if not exists transaction_time time;

-- Income kinds ----------------------------------------------------------------
alter table public.wallet_income drop constraint if exists wallet_income_kind_check;
update public.wallet_income set kind = 'income' where kind = 'allowance';
alter table public.wallet_income add constraint wallet_income_kind_check check (kind in ('income', 'cash_in'));

-- Receipt links on money-in entries, so scanned cash-in receipts keep their image.
alter table public.wallet_income add column if not exists receipt_path text;
alter table public.wallet_income add column if not exists receipt_fingerprint text;
alter table public.expenses add column if not exists receipt_fingerprint text;

-- Transfers ---------------------------------------------------------------------
create table if not exists public.wallet_transfers (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  from_wallet_id        uuid not null references public.wallets (id) on delete cascade,
  to_wallet_id          uuid not null references public.wallets (id) on delete cascade,
  amount                numeric(12,2) not null check (amount > 0),
  fee                   numeric(12,2) not null default 0 check (fee >= 0),
  transaction_date      date not null default current_date,
  transaction_time      time,
  notes                 text check (notes is null or char_length(notes) <= 500),
  receipt_path          text,
  receipt_fingerprint   text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (from_wallet_id <> to_wallet_id)
);
create index if not exists wallet_transfers_user_date_idx on public.wallet_transfers (user_id, transaction_date desc);
create index if not exists wallet_transfers_from_idx on public.wallet_transfers (from_wallet_id);
create index if not exists wallet_transfers_to_idx on public.wallet_transfers (to_wallet_id);

alter table public.wallet_transfers enable row level security;
drop policy if exists "wallet_transfers_select_own" on public.wallet_transfers;
create policy "wallet_transfers_select_own" on public.wallet_transfers for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "wallet_transfers_insert_own" on public.wallet_transfers;
create policy "wallet_transfers_insert_own" on public.wallet_transfers for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.wallets w where w.id = from_wallet_id and w.user_id = (select auth.uid()))
    and exists (select 1 from public.wallets w where w.id = to_wallet_id and w.user_id = (select auth.uid()))
  );
drop policy if exists "wallet_transfers_update_own" on public.wallet_transfers;
create policy "wallet_transfers_update_own" on public.wallet_transfers for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.wallets w where w.id = from_wallet_id and w.user_id = (select auth.uid()))
    and exists (select 1 from public.wallets w where w.id = to_wallet_id and w.user_id = (select auth.uid()))
  );
drop policy if exists "wallet_transfers_delete_own" on public.wallet_transfers;
create policy "wallet_transfers_delete_own" on public.wallet_transfers for delete to authenticated
  using ((select auth.uid()) = user_id);

drop trigger if exists wallet_transfers_touch_updated_at on public.wallet_transfers;
create trigger wallet_transfers_touch_updated_at before update on public.wallet_transfers
  for each row execute function public.touch_updated_at();

-- Source loses amount + fee, destination gains amount. The old effect is
-- reversed first on edit/delete, so balances always equal the ledger.
create or replace function public.apply_wallet_transfer_balance() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.wallets set current_balance = current_balance + old.amount + old.fee
      where id = old.from_wallet_id and user_id = old.user_id;
    update public.wallets set current_balance = current_balance - old.amount
      where id = old.to_wallet_id and user_id = old.user_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.wallets set current_balance = current_balance - new.amount - new.fee
      where id = new.from_wallet_id and user_id = new.user_id;
    if not found then raise exception 'source wallet does not belong to transfer owner'; end if;
    update public.wallets set current_balance = current_balance + new.amount
      where id = new.to_wallet_id and user_id = new.user_id;
    if not found then raise exception 'destination wallet does not belong to transfer owner'; end if;
  end if;
  return coalesce(new, old);
end; $$;

drop trigger if exists wallet_transfers_apply_balance on public.wallet_transfers;
create trigger wallet_transfers_apply_balance
  after insert or update of amount, fee, from_wallet_id, to_wallet_id, user_id or delete on public.wallet_transfers
  for each row execute function public.apply_wallet_transfer_balance();

-- Duplicate-receipt protection ----------------------------------------------------
create unique index if not exists expenses_receipt_fingerprint_idx
  on public.expenses (user_id, receipt_fingerprint) where receipt_fingerprint is not null;
create unique index if not exists wallet_income_receipt_fingerprint_idx
  on public.wallet_income (user_id, receipt_fingerprint) where receipt_fingerprint is not null;
create unique index if not exists wallet_transfers_receipt_fingerprint_idx
  on public.wallet_transfers (user_id, receipt_fingerprint) where receipt_fingerprint is not null;

-- One atomic entry point for a confirmed receipt of any type. Nothing is
-- written until the user confirms, and a fingerprint already used by any
-- transaction type is rejected before a wallet can move.
create or replace function public.save_receipt_transaction(
  p_type text,
  p_amount numeric,
  p_fee numeric,
  p_merchant text,
  p_category_id text,
  p_wallet_id uuid,
  p_destination_wallet_id uuid,
  p_transaction_date date,
  p_transaction_time time,
  p_notes text,
  p_receipt_path text,
  p_receipt_confidence integer,
  p_receipt_subtotal numeric,
  p_receipt_tax numeric,
  p_items jsonb,
  p_fingerprint text
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_user uuid := auth.uid(); v_id uuid; v_item jsonb;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid amount'; end if;
  if p_fingerprint is null or length(trim(p_fingerprint)) = 0 then raise exception 'missing receipt fingerprint'; end if;
  if exists (select 1 from public.expenses where user_id = v_user and receipt_fingerprint = p_fingerprint)
    or exists (select 1 from public.wallet_income where user_id = v_user and receipt_fingerprint = p_fingerprint)
    or exists (select 1 from public.wallet_transfers where user_id = v_user and receipt_fingerprint = p_fingerprint) then
    raise exception 'duplicate receipt';
  end if;
  if p_wallet_id is not null and not exists (select 1 from public.wallets where id = p_wallet_id and user_id = v_user and status = 'active') then
    raise exception 'invalid wallet';
  end if;

  if p_type = 'expense' then
    if length(trim(coalesce(p_merchant, ''))) = 0 or length(trim(coalesce(p_category_id, ''))) = 0 then raise exception 'invalid receipt expense'; end if;
    insert into public.expenses (user_id, amount, merchant, category_id, wallet_id, transaction_date, transaction_time, notes, source,
      receipt_path, receipt_confidence, receipt_subtotal, receipt_tax, receipt_fingerprint)
    values (v_user, p_amount, trim(p_merchant), p_category_id, p_wallet_id, p_transaction_date, p_transaction_time, nullif(trim(p_notes), ''), 'receipt',
      p_receipt_path, p_receipt_confidence, p_receipt_subtotal, p_receipt_tax, p_fingerprint)
    returning id into v_id;
    for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
      insert into public.expense_items (expense_id, user_id, name, quantity, line_total)
      values (v_id, v_user, trim(v_item->>'name'), greatest((v_item->>'quantity')::numeric, 0.01), greatest((v_item->>'line_total')::numeric, 0));
    end loop;
  elsif p_type = 'cash_in' then
    if p_wallet_id is null then raise exception 'cash-in needs a wallet'; end if;
    insert into public.wallet_income (user_id, wallet_id, amount, kind, source, transaction_date, transaction_time, notes, receipt_path, receipt_fingerprint)
    values (v_user, p_wallet_id, p_amount, 'cash_in', coalesce(nullif(trim(p_merchant), ''), 'Cash-in'), p_transaction_date, p_transaction_time,
      nullif(trim(p_notes), ''), p_receipt_path, p_fingerprint)
    returning id into v_id;
  elsif p_type = 'transfer' then
    if p_wallet_id is null or p_destination_wallet_id is null or p_wallet_id = p_destination_wallet_id then raise exception 'transfer needs two different wallets'; end if;
    if not exists (select 1 from public.wallets where id = p_destination_wallet_id and user_id = v_user and status = 'active') then raise exception 'invalid wallet'; end if;
    insert into public.wallet_transfers (user_id, from_wallet_id, to_wallet_id, amount, fee, transaction_date, transaction_time, notes, receipt_path, receipt_fingerprint)
    values (v_user, p_wallet_id, p_destination_wallet_id, p_amount, greatest(coalesce(p_fee, 0), 0), p_transaction_date, p_transaction_time,
      nullif(trim(p_notes), ''), p_receipt_path, p_fingerprint)
    returning id into v_id;
  else
    raise exception 'unsupported transaction type';
  end if;
  return v_id;
end; $$;
grant execute on function public.save_receipt_transaction(text,numeric,numeric,text,text,uuid,uuid,date,time,text,text,integer,numeric,numeric,jsonb,text) to authenticated;

-- Budgets: category limits only ------------------------------------------------
-- The month row stays as the container category limits hang off, but its own
-- amount is no longer a budget and is always zero for new months.
alter table public.budgets drop constraint if exists budgets_amount_check;
alter table public.budgets alter column amount set default 0;
alter table public.budgets add constraint budgets_amount_check check (amount >= 0);
update public.budgets set amount = 0;

-- Hidden default categories -----------------------------------------------------
alter table public.profiles add column if not exists hidden_category_ids text[] not null default '{}';
