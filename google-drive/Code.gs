/**
 * Academic Curriculum Center — Google Drive document upload endpoint
 * Deploy as Web App: Execute as Me; grant access to intended app users.
 * Files are saved to the Academic Curriculum Center destination folder.
 */
const FOLDER_ID = "10ZyeVqwooNk0xERDuWqc04auCQyn6SBe";
const TRACKING_KEY = "ACC_RPS_DRIVE_UPLOADS";
const MAX_FILE_BYTES = 15 * 1024 * 1024;

function doPost(e) {
  try {
    const p = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    ["file_name", "course_id", "uploader_id", "uploader_email", "file_base64"].forEach(k => {
      if (!p[k]) throw new Error("Field wajib tidak tersedia: " + k);
    });
    const bytes = Utilities.base64Decode(p.file_base64);
    if (bytes.length > MAX_FILE_BYTES) throw new Error("Ukuran file maksimal 15 MB.");
    const mime = String(p.mime_type || "application/octet-stream").split(";")[0].trim();
    const name = sanitizeFileName_(p.file_name);
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");
    const file = folder.createFile(Utilities.newBlob(bytes, mime, stamp + "_" + name));
    file.setDescription([
      "Academic Curriculum Center document upload",
      "Course: " + (p.course_name || p.course_id),
      "Uploader: " + p.uploader_email,
      "Uploader ID: " + p.uploader_id,
      "Notes: " + (p.notes || "")
    ].join("\n"));

    const row = {
      id: file.getId(), drive_file_id: file.getId(), file_name: name,
      mime_type: mime, course_id: String(p.course_id),
      course_name: String(p.course_name || p.course_id),
      uploader_id: String(p.uploader_id), uploader_email: String(p.uploader_email),
      uploader_name: String(p.uploader_name || p.uploader_email),
      notes: String(p.notes || ""), status: "Menunggu Review",
      created_at: new Date().toISOString(), webViewLink: file.getUrl()
    };
    const rows = getRecords_();
    rows.unshift(row);
    PropertiesService.getScriptProperties().setProperty(TRACKING_KEY, JSON.stringify(rows));
    return json_({ success: true, id: file.getId(), webViewLink: file.getUrl(), created_at: row.created_at });
  } catch (err) {
    return json_({ success: false, error: String(err && err.message || err) });
  }
}

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action === "list") return json_({ success: true, files: getRecords_() });
    return json_({ success: true, message: "Academic Curriculum Center Drive endpoint ready." });
  } catch (err) {
    return json_({ success: false, error: String(err && err.message || err) });
  }
}

function getRecords_() {
  const raw = PropertiesService.getScriptProperties().getProperty(TRACKING_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (_) { return []; }
}
function sanitizeFileName_(v) {
  return String(v || "document").replace(/[\\/:*?"<>|]/g, "_").slice(0, 150);
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
