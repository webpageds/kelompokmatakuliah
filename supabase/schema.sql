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


-- RPS lecturer submissions, private PDF storage, and admin notifications.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('rps-documents','rps-documents',false,15728640,array['application/pdf'])
on conflict (id) do update set public=false,file_size_limit=15728640,allowed_mime_types=array['application/pdf'];

create table if not exists public.rps_documents (
 id uuid primary key default gen_random_uuid(),
 course_id text not null,
 file_name text not null,
 storage_path text not null unique,
 uploader_id uuid not null references auth.users(id) on delete cascade,
 uploader_email text,
 uploader_name text,
 notes text not null default '',
 status text not null default 'Menunggu Review' check (status in ('Menunggu Review','Disetujui','Perlu Revisi')),
 admin_notes text not null default '',
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id)
);
alter table public.rps_documents enable row level security;
revoke all on public.rps_documents from anon, authenticated;
grant select,insert,update on public.rps_documents to authenticated;
drop policy if exists "RPS uploader and admins can read" on public.rps_documents;
create policy "RPS uploader and admins can read" on public.rps_documents for select to authenticated
using (uploader_id=auth.uid() or (select auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists "Lecturers can upload own RPS" on public.rps_documents;
create policy "Lecturers can upload own RPS" on public.rps_documents for insert to authenticated
with check (uploader_id=auth.uid() and (select auth.jwt()->'app_metadata'->>'role')='lecturer');
drop policy if exists "Admins can review RPS" on public.rps_documents;
create policy "Admins can review RPS" on public.rps_documents for update to authenticated
using ((select auth.jwt()->'app_metadata'->>'role')='admin')
with check ((select auth.jwt()->'app_metadata'->>'role')='admin');

create table if not exists public.rps_notifications (
 id uuid primary key default gen_random_uuid(),
 document_id uuid references public.rps_documents(id) on delete cascade,
 title text not null,
 message text not null,
 is_read boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.rps_notifications enable row level security;
revoke all on public.rps_notifications from anon, authenticated;
grant select,update on public.rps_notifications to authenticated;
drop policy if exists "Admins can read RPS notifications" on public.rps_notifications;
create policy "Admins can read RPS notifications" on public.rps_notifications for select to authenticated
using ((select auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists "Admins can update RPS notifications" on public.rps_notifications;
create policy "Admins can update RPS notifications" on public.rps_notifications for update to authenticated
using ((select auth.jwt()->'app_metadata'->>'role')='admin')
with check ((select auth.jwt()->'app_metadata'->>'role')='admin');

create or replace function public.notify_admin_new_rps_upload()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.rps_notifications(document_id,title,message)
 values (new.id,'RPS baru diunggah',coalesce(new.uploader_name,new.uploader_email,'Dosen')||' mengunggah RPS untuk mata kuliah '||new.course_id);
 return new;
end;
$$;
drop trigger if exists rps_upload_notification on public.rps_documents;
create trigger rps_upload_notification after insert on public.rps_documents
for each row execute function public.notify_admin_new_rps_upload();

drop policy if exists "RPS uploader and admins can read own files" on storage.objects;
create policy "RPS uploader and admins can read own files" on storage.objects
for select to authenticated using (
 bucket_id='rps-documents' and (
  (storage.foldername(name))[1]=auth.uid()::text or
  (select auth.jwt()->'app_metadata'->>'role')='admin'
 )
);
drop policy if exists "Lecturers can upload own RPS files" on storage.objects;
create policy "Lecturers can upload own RPS files" on storage.objects
for insert to authenticated with check (
 bucket_id='rps-documents' and
 (storage.foldername(name))[1]=auth.uid()::text and
 (select auth.jwt()->'app_metadata'->>'role')='lecturer'
);
drop policy if exists "Admins can delete RPS files" on storage.objects;
create policy "Admins can delete RPS files" on storage.objects
for delete to authenticated using (
 bucket_id='rps-documents' and (select auth.jwt()->'app_metadata'->>'role')='admin'
);
do $$ begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='rps_documents') then
  alter publication supabase_realtime add table public.rps_documents;
 end if;
end $$;
