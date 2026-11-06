# Academic Curriculum Center

Online academic curriculum workspace for Program Studi Akuntansi, Universitas Pamulang PSDKU Serang.

## Features
- Welcome screen with separate Admin and Dosen sign-in paths.
- Supabase Auth email/password login.
- Admin: full editing access for curriculum data and RPS.
- Dosen: read-only access to curriculum data and RPS upload form.
- Supabase PostgreSQL remains the shared source of truth for curriculum mapping and RPS development progress.
- Realtime synchronization for the curriculum state.
- JSON backup export.
- RPS upload is separated from Supabase Storage and is routed to Google Drive through Google Apps Script.
- Upload tracking and notifications are returned from the Google Apps Script endpoint.

## Setup — Supabase curriculum database
1. Create/open the Supabase project at https://supabase.com/dashboard.
2. Run the core SQL in `supabase/schema.sql` to create `public.curriculum_state`.
3. Set `url` and the public publishable/anon key in `config.js`.
4. Create admin and lecturer accounts in Supabase Authentication > Users.
5. Assign roles in immutable `app_metadata.role` using SQL, then sign out/in so JWTs refresh:
   ```sql
   update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||'{"role":"admin"}'::jsonb where email='admin@kampus.ac.id';
   update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||'{"role":"lecturer"}'::jsonb where email='dosen@kampus.ac.id';
   ```
6. Enable GitHub Pages for the `main` branch and repository root.

## Setup — Google Drive RPS uploads
RPS document uploads (PDF, Word, Excel, PowerPoint, images, and other file types up to 15 MB) no longer use Supabase Storage or the Supabase `rps_documents` table. They are sent to the Google Drive folder configured in `google-drive/Code.gs`.

1. Open https://script.google.com/ and create a new Apps Script project.
2. Copy all contents of `google-drive/Code.gs` into the Apps Script editor.
3. Save the project.
4. Deploy > New deployment > Select type: Web app.
5. Set **Execute as: Me** (the owner of the destination folder).
6. Set **Who has access** to an audience appropriate for your institution. "Anyone" allows the public URL to accept requests, so use it only after deciding that this endpoint may receive PDF uploads from your authenticated app users. The script validates required fields, PDF MIME type, and a 15 MB maximum, but the web-app URL itself is a public endpoint.
7. Copy the Web App URL ending in `/exec`.
8. Paste it into `window.ACC_DRIVE_CONFIG.uploadEndpoint` in `config.js` and commit the change.
9. Ensure the Google account that deploys the script has Editor access to the destination folder.

The script stores upload tracking metadata in Apps Script Properties and saves the actual file in the Google Drive folder. The app shows upload records and links returned by Drive. The endpoint's `?action=list` action is used to refresh tracking across devices.

**Important:** The app does not mark an upload successful until the Apps Script endpoint returns `success: true`. Without the deployed endpoint URL in `config.js`, the upload button stays disabled rather than pretending the file was uploaded.

## Security notes
- Only Supabase publishable/anon keys may be present in frontend config. Never expose a Supabase `service_role` key.
- Protect the deployed Apps Script endpoint URL. If stronger access control is required, add an allowlist or a signed request check before using this workflow with a public deployment.
- The Drive folder must be accessible to the Google account running the Apps Script deployment.

## Deployment
The frontend is hosted as a static GitHub Pages site. Supabase provides Auth and the curriculum database. Google Apps Script handles RPS file uploads and tracking.


## Admin verification and file naming
- Uploaded files are named from the selected course name, preserving the source file extension.
- Admin review statuses: Menunggu Review, Sedang Diverifikasi, Disetujui, Perlu Revisi, and Tidak Disetujui.
- Review notes and reviewer/time are stored by the Apps Script service, so lecturer accounts see updated status when they refresh/synchronize.
- Admin can move a rejected/unwanted upload to Google Drive Trash; the record is removed from the shared tracking list.
- After changing `google-drive/Code.gs`, update the Apps Script deployment to a new version (Manage deployments > Edit > New version > Deploy). The /exec URL can remain the same when updating the existing deployment.
