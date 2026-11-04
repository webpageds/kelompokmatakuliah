# Academic Curriculum Center

Online academic curriculum workspace for Program Studi Akuntansi, Universitas Pamulang PSDKU Serang.

## Features
- Welcome screen with separate Admin and Dosen sign-in paths.
- Supabase Auth email/password login.
- Admin: full editing access for curriculum data and RPS.
- Dosen: read-only access.
- Supabase PostgreSQL as the shared source of truth.
- Realtime synchronization across signed-in devices.
- Preserves the existing KBK, course, lecturer, RPS, and template features.
- JSON backup export.
- First-admin initialization migrates existing browser localStorage data if the cloud database is empty.

## Setup
1. Create a project at https://supabase.com/dashboard.
2. Run all SQL in `supabase/schema.sql` using Supabase Dashboard > SQL Editor.
3. Open `config.js` and set `url` and `anonKey` from Supabase Project Settings > API.
4. In Supabase Authentication > Users, create accounts for the admin and lecturers.
5. Set each account's immutable `app_metadata.role` using SQL (replace the example email):
   ```sql
   update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||'{"role":"admin"}'::jsonb where email='admin@kampus.ac.id';
   update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||'{"role":"lecturer"}'::jsonb where email='dosen@kampus.ac.id';
   ```
6. Sign out and sign in again after role assignment.
7. Enable GitHub Pages for the `main` branch and repository root.

**Security:** Only the Supabase publishable/anon key belongs in `config.js`. Never expose a `service_role` key or secret API key in this public repository. Database RLS enforces that only `app_metadata.role = 'admin'` can write. Lecturer users can read only.

## Data migration
When the cloud table is empty, the first admin login initializes it from the existing browser's saved `acc_courses` and `acc_rps` data, combined with the repository seed dataset. If the cloud row already exists, that cloud data is authoritative. If old local data exists only on another device, export a JSON backup from that device before first initialization and verify the migration before clearing browser storage.

## Deployment note
The static frontend is hosted by GitHub Pages; authentication, database, and realtime are provided by Supabase. Supabase project setup, SQL execution, `config.js` configuration, account creation, role assignment, and Pages enablement are required before the live login can work.
