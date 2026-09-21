-- Phase 6: one monthly budget per user, with optional per-category limits.
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_month date not null check (period_month = date_trunc('month', period_month)::date),
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_month)
);

create table if not exists public.category_budgets (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id text not null,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_id, category_id)
);

create index if not exists budgets_user_period_idx on public.budgets (user_id, period_month desc);
create index if not exists category_budgets_user_budget_idx on public.category_budgets (user_id, budget_id);

alter table public.budgets enable row level security;
alter table public.category_budgets enable row level security;

create policy "budgets_select_own" on public.budgets for select to authenticated using ((select auth.uid()) = user_id);
create policy "budgets_insert_own" on public.budgets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "budgets_update_own" on public.budgets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "budgets_delete_own" on public.budgets for delete to authenticated using ((select auth.uid()) = user_id);

create policy "category_budgets_select_own" on public.category_budgets for select to authenticated using ((select auth.uid()) = user_id);
create policy "category_budgets_insert_own" on public.category_budgets for insert to authenticated with check (
  (select auth.uid()) = user_id and exists (
    select 1 from public.budgets b where b.id = budget_id and b.user_id = (select auth.uid())
  )
);
create policy "category_budgets_update_own" on public.category_budgets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "category_budgets_delete_own" on public.category_budgets for delete to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists budgets_touch_updated_at on public.budgets;
create trigger budgets_touch_updated_at before update on public.budgets
  for each row execute function public.touch_updated_at();
drop trigger if exists category_budgets_touch_updated_at on public.category_budgets;
create trigger category_budgets_touch_updated_at before update on public.category_budgets
  for each row execute function public.touch_updated_at();
