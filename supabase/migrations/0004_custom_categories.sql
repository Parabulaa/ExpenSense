-- Phase 6 custom categories. Default categories remain code-defined; this
-- table stores only authenticated user additions.
create table if not exists public.custom_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name varchar(40) not null check (length(trim(name)) between 1 and 40),
  icon text not null,
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists custom_categories_user_name_active_idx
  on public.custom_categories (user_id, lower(name)) where archived_at is null;
create index if not exists custom_categories_user_idx on public.custom_categories (user_id, created_at);

alter table public.custom_categories enable row level security;
create policy "custom_categories_select_own" on public.custom_categories for select to authenticated using ((select auth.uid()) = user_id);
create policy "custom_categories_insert_own" on public.custom_categories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "custom_categories_update_own" on public.custom_categories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "custom_categories_delete_own" on public.custom_categories for delete to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists custom_categories_touch_updated_at on public.custom_categories;
create trigger custom_categories_touch_updated_at before update on public.custom_categories
  for each row execute function public.touch_updated_at();

-- Custom category UUIDs are stored as text alongside stable default IDs.
alter table public.expenses drop constraint if exists expenses_category_id_check;
alter table public.expenses add constraint expenses_category_id_not_blank check (length(trim(category_id)) > 0);
