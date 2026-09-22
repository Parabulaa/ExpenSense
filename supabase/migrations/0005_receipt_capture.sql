-- Phase 4 receipt capture. Receipt images are private and paths—not public URLs—are stored.
alter table public.expenses add column if not exists receipt_path text;
alter table public.expenses add column if not exists receipt_confidence integer check (receipt_confidence between 0 and 100);
alter table public.expenses add column if not exists receipt_subtotal numeric(12,2);
alter table public.expenses add column if not exists receipt_tax numeric(12,2);

create table if not exists public.expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  quantity numeric(8,2) not null default 1 check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);
alter table public.expense_items enable row level security;
create policy "expense_items_select_own" on public.expense_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "expense_items_insert_own" on public.expense_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "expense_items_update_own" on public.expense_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "expense_items_delete_own" on public.expense_items for delete to authenticated using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 6291456, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "receipt_images_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "receipt_images_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "receipt_images_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.save_receipt_expense(
  p_merchant text, p_amount numeric, p_category_id text, p_transaction_date date,
  p_notes text, p_receipt_path text, p_receipt_confidence integer,
  p_receipt_subtotal numeric, p_receipt_tax numeric, p_items jsonb
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_user uuid := auth.uid(); v_expense uuid; v_item jsonb;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_amount <= 0 or length(trim(p_merchant)) = 0 or length(trim(p_category_id)) = 0 then raise exception 'invalid receipt expense'; end if;
  insert into public.expenses (user_id, amount, merchant, category_id, transaction_date, notes, source, receipt_path, receipt_confidence, receipt_subtotal, receipt_tax)
  values (v_user, p_amount, trim(p_merchant), p_category_id, p_transaction_date, nullif(trim(p_notes), ''), 'receipt', p_receipt_path, p_receipt_confidence, p_receipt_subtotal, p_receipt_tax)
  returning id into v_expense;
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    insert into public.expense_items (expense_id, user_id, name, quantity, line_total)
    values (v_expense, v_user, trim(v_item->>'name'), greatest((v_item->>'quantity')::numeric, 0.01), greatest((v_item->>'line_total')::numeric, 0));
  end loop;
  return v_expense;
end; $$;
grant execute on function public.save_receipt_expense(text,numeric,text,date,text,text,integer,numeric,numeric,jsonb) to authenticated;
