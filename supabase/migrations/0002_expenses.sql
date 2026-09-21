-- Phase 3: user-owned manual expenses. Amounts use an exact decimal type;
-- transaction_date is a date (not a timestamp) so local dates never shift.

create table if not exists public.expenses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  amount           numeric(12, 2) not null check (amount > 0 and amount <= 9999999999.99),
  merchant         varchar(120) not null check (char_length(btrim(merchant)) > 0),
  category_id      text not null check (
    category_id in (
      'food', 'transport', 'bills', 'shopping', 'school',
      'travel', 'health', 'entertainment', 'groceries'
    )
  ),
  transaction_date date not null check (transaction_date <= current_date),
  notes            varchar(500),
  source           text not null default 'manual' check (source in ('manual', 'receipt')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists expenses_user_date_idx
  on public.expenses (user_id, transaction_date desc, created_at desc);

alter table public.expenses enable row level security;

drop policy if exists "expenses_select_own" on public.expenses;
create policy "expenses_select_own" on public.expenses
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "expenses_insert_own" on public.expenses;
create policy "expenses_insert_own" on public.expenses
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "expenses_update_own" on public.expenses;
create policy "expenses_update_own" on public.expenses
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "expenses_delete_own" on public.expenses;
create policy "expenses_delete_own" on public.expenses
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop trigger if exists expenses_touch_updated_at on public.expenses;
create trigger expenses_touch_updated_at
  before update on public.expenses
  for each row execute function public.touch_updated_at();
