-- Academic Curriculum Center: Supabase schema and access control
-- Run this entire file in Supabase Dashboard > SQL Editor.
create table if not exists public.curriculum_state (
  id text primary key check (id = 'main'),
  courses jsonb not null default '[]'::jsonb,
  rps jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  origin_id text,
  updated_at timestamptz not null default now()
);
alter table public.curriculum_state enable row level security;
revoke all on table public.curriculum_state from anon, authenticated;
grant select, insert, update on table public.curriculum_state to authenticated;

drop policy if exists "Signed-in users can read curriculum" on public.curriculum_state;
create policy "Signed-in users can read curriculum" on public.curriculum_state for select to authenticated using (true);
drop policy if exists "Admins can initialize curriculum" on public.curriculum_state;
create policy "Admins can initialize curriculum" on public.curriculum_state for insert to authenticated
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "Admins can update curriculum" on public.curriculum_state;
create policy "Admins can update curriculum" on public.curriculum_state for update to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create or replace function public.set_curriculum_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists curriculum_state_updated_at on public.curriculum_state;
create trigger curriculum_state_updated_at before update on public.curriculum_state
for each row execute function public.set_curriculum_updated_at();

do $$
begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='curriculum_state') then
  alter publication supabase_realtime add table public.curriculum_state;
 end if;
end;
$$;

-- Create users in Authentication > Users, then assign roles in app_metadata.
-- Replace the email addresses and run the matching statement:
-- update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||'{"role":"admin"}'::jsonb where email='admin@kampus.ac.id';
-- update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||'{"role":"lecturer"}'::jsonb where email='dosen@kampus.ac.id';
-- Sign out and sign in again after changing roles so the JWT is refreshed.
