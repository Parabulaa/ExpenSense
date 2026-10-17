-- The adviser persona and intensity follow the account, so a change on the
-- phone shows up on the web (and back) without a reload.
alter table public.profiles add column if not exists adviser_persona text;
alter table public.profiles add column if not exists adviser_intensity text
  check (adviser_intensity is null or adviser_intensity in ('low', 'medium', 'high'));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
