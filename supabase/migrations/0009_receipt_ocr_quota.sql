-- A hard lifetime OCR allowance for student testing. The claim function is
-- atomic, so parallel requests cannot push one account past ten Google calls.
create table if not exists public.receipt_ocr_usage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  scans_used integer not null default 0 check (scans_used between 0 and 10),
  last_scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.receipt_ocr_usage enable row level security;

create or replace function public.claim_receipt_ocr_scan()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_used integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  insert into public.receipt_ocr_usage (user_id, scans_used, last_scanned_at)
  values (v_user, 1, now())
  on conflict (user_id) do nothing
  returning scans_used into v_used;

  if v_used is not null then
    return 10 - v_used;
  end if;

  update public.receipt_ocr_usage
  set scans_used = scans_used + 1,
      last_scanned_at = now(),
      updated_at = now()
  where user_id = v_user and scans_used < 10
  returning scans_used into v_used;

  if v_used is null then
    return -1;
  end if;
  return 10 - v_used;
end;
$$;

revoke all on function public.claim_receipt_ocr_scan() from public;
grant execute on function public.claim_receipt_ocr_scan() to authenticated;

