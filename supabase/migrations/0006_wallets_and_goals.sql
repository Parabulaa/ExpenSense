-- User-owned wallets and savings goals. Wallet balances are user-maintained
-- snapshots; expenses reference a payment source but do not mutate balances.
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name varchar(60) not null check (char_length(btrim(name)) > 0),
  type text not null default 'other' check (type in ('cash','gcash','maya','bank','other')),
  current_balance numeric(12,2) not null default 0 check (current_balance >= 0),
  icon text,
  color varchar(9),
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists wallets_one_default_per_user
  on public.wallets (user_id) where is_default and status = 'active';
create index if not exists wallets_user_status_idx on public.wallets (user_id, status, created_at);

alter table public.expenses add column if not exists wallet_id uuid references public.wallets (id) on delete set null;
create index if not exists expenses_wallet_idx on public.expenses (wallet_id);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name varchar(80) not null check (char_length(btrim(name)) > 0),
  target_amount numeric(12,2) not null check (target_amount > 0),
  current_amount numeric(12,2) not null default 0 check (current_amount >= 0),
  target_date date,
  icon text,
  category text,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists savings_goals_user_status_idx on public.savings_goals (user_id, status, created_at);

alter table public.wallets enable row level security;
alter table public.savings_goals enable row level security;

create policy "wallets_select_own" on public.wallets for select to authenticated using ((select auth.uid()) = user_id);
create policy "wallets_insert_own" on public.wallets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "wallets_update_own" on public.wallets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "wallets_delete_own" on public.wallets for delete to authenticated using ((select auth.uid()) = user_id);

create policy "goals_select_own" on public.savings_goals for select to authenticated using ((select auth.uid()) = user_id);
create policy "goals_insert_own" on public.savings_goals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "goals_update_own" on public.savings_goals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "goals_delete_own" on public.savings_goals for delete to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists wallets_touch_updated_at on public.wallets;
create trigger wallets_touch_updated_at before update on public.wallets for each row execute function public.touch_updated_at();
drop trigger if exists goals_touch_updated_at on public.savings_goals;
create trigger goals_touch_updated_at before update on public.savings_goals for each row execute function public.touch_updated_at();
