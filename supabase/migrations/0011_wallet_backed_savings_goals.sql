-- Wallet-backed savings goals with an auditable contribution ledger.
alter table public.savings_goals drop constraint if exists savings_goals_status_check;
alter table public.savings_goals add constraint savings_goals_status_check check (status in ('active','completed','archived'));

create or replace function public.sync_savings_goal_status() returns trigger language plpgsql set search_path = public as $$
begin
  if new.status <> 'archived' then new.status := case when new.current_amount >= new.target_amount then 'completed' else 'active' end; end if;
  return new;
end; $$;
drop trigger if exists savings_goals_sync_status on public.savings_goals;
create trigger savings_goals_sync_status before insert or update of current_amount, target_amount on public.savings_goals for each row execute function public.sync_savings_goal_status();

create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.savings_goals (id) on delete cascade,
  wallet_id uuid not null references public.wallets (id) on delete restrict,
  direction text not null check (direction in ('contribution','withdrawal')),
  amount numeric(12,2) not null check (amount > 0),
  goal_balance_after numeric(12,2) not null check (goal_balance_after >= 0),
  created_at timestamptz not null default now()
);
create index if not exists goal_contributions_goal_created_idx on public.goal_contributions (goal_id, created_at desc);
alter table public.goal_contributions enable row level security;
create policy "goal_contributions_select_own" on public.goal_contributions for select to authenticated using ((select auth.uid()) = user_id);
create policy "goal_contributions_insert_own" on public.goal_contributions for insert to authenticated with check ((select auth.uid()) = user_id);

create or replace function public.move_goal_money(p_goal_id uuid, p_wallet_id uuid, p_amount numeric, p_direction text)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_goal public.savings_goals%rowtype;
  v_wallet public.wallets%rowtype;
  v_next numeric(12,2);
  v_id uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid amount'; end if;
  if p_direction not in ('contribution','withdrawal') then raise exception 'invalid direction'; end if;

  select * into v_goal from public.savings_goals where id = p_goal_id and user_id = v_user and status <> 'archived' for update;
  if not found then raise exception 'goal not found'; end if;
  select * into v_wallet from public.wallets where id = p_wallet_id and user_id = v_user and status = 'active' for update;
  if not found then raise exception 'wallet not found'; end if;

  if p_direction = 'contribution' then
    if v_wallet.current_balance < p_amount then raise exception 'insufficient wallet balance'; end if;
    if v_goal.current_amount + p_amount > v_goal.target_amount then raise exception 'contribution exceeds remaining goal amount'; end if;
    v_next := v_goal.current_amount + p_amount;
    update public.wallets set current_balance = current_balance - p_amount where id = p_wallet_id;
  else
    if v_goal.current_amount < p_amount then raise exception 'withdrawal exceeds goal balance'; end if;
    v_next := v_goal.current_amount - p_amount;
    update public.wallets set current_balance = current_balance + p_amount where id = p_wallet_id;
  end if;

  update public.savings_goals set current_amount = v_next, status = case when v_next >= target_amount then 'completed' else 'active' end where id = p_goal_id;
  insert into public.goal_contributions (user_id, goal_id, wallet_id, direction, amount, goal_balance_after)
  values (v_user, p_goal_id, p_wallet_id, p_direction, p_amount, v_next) returning id into v_id;
  return v_id;
end; $$;
grant execute on function public.move_goal_money(uuid,uuid,numeric,text) to authenticated;

update public.savings_goals set status = 'completed' where status = 'active' and current_amount >= target_amount;
