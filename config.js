/* Public browser configuration only. Never put a Supabase service_role key here. */
window.ACC_SUPABASE_CONFIG = {
  url: "https://sgrchkowpispihwxddwv.supabase.co",
  anonKey: "sb_publishable_YgBr9Z4iZIHGDlfa5RFXtw_TzWnvBW4"
};

/*
 * Google Drive RPS upload configuration.
 * Deploy the Apps Script in google-drive/Code.gs as a Web App,
 * execute as the Drive owner, allow access to the relevant users,
 * then paste its /exec URL below. Keep this URL public only if the
 * Apps Script validates the upload payload and is intended for public callers.
 */
window.ACC_DRIVE_CONFIG = {
  uploadEndpoint: "https://script.google.com/macros/s/AKfycbxpTEwHQT-qRiiyZmpoP8nnUkOCsZxSzyThW0-MUC2BFG25caUNKX1QOihXs281ihWPZA/exec"
};
