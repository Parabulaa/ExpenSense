-- Lets the app show how many of the ten lifetime receipt scans are left
-- before the user starts one. Read-only: claiming a scan still goes through
-- claim_receipt_ocr_scan() inside the process-receipt function.
create or replace function public.receipt_ocr_scans_remaining()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0, 10 - coalesce(
    (select scans_used from public.receipt_ocr_usage where user_id = auth.uid()),
    0
  ));
$$;

revoke all on function public.receipt_ocr_scans_remaining() from public;
grant execute on function public.receipt_ocr_scans_remaining() to authenticated;
