/**
 * Academic Curriculum Center — Google Drive RPS upload endpoint
 *
 * Deploy as Web App:
 *   Execute as: Me (the Drive owner)
 *   Who has access: Anyone (or your institution's approved audience)
 *
 * The endpoint writes PDF files into the configured folder and stores
 * upload tracking records in Script Properties. Do not put OAuth tokens,
 * service account keys, or private credentials in the frontend.
 */
const FOLDER_ID = "10ZyeVqwooNk0xERDuWqc04auCQyn6SBe";
const TRACKING_KEY = "ACC_RPS_DRIVE_UPLOADS";

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const required = ["file_name", "course_id", "uploader_id", "uploader_email", "file_base64"];
    required.forEach(k => { if (!payload[k]) throw new Error("Field wajib tidak tersedia: " + k); });

    if (payload.file_base64.length > 22 * 1024 * 1024) {
      throw new Error("File terlalu besar untuk dikirim. Maksimal PDF 15 MB.");
    }
    const bytes = Utilities.base64Decode(payload.file_base64);
    if (bytes.length > 15 * 1024 * 1024) throw new Error("Ukuran PDF maksimal 15 MB.");
    const mime = payload.mime_type || "application/pdf";
    if (mime !== "application/pdf") throw new Error("Hanya file PDF yang diperbolehkan.");

    const folder = DriveApp.getFolderById(FOLDER_ID);
    const safeName = String(payload.file_name).replace(/[\\/:*?"<>|]/g, "_").slice(0, 150);
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");
    const blob = Utilities.newBlob(bytes, mime, stamp + "_" + safeName);
    const file = folder.createFile(blob);
    file.setDescription([
      "Academic Curriculum Center RPS upload",
      "Course: " + (payload.course_name || payload.course_id),
      "Uploader: " + payload.uploader_email,
      "Uploader ID: " + payload.uploader_id,
      "Notes: " + (payload.notes || "")
    ].join("\n"));

    const record = {
      id: file.getId(),
      drive_file_id: file.getId(),
      file_name: safeName,
      course_id: String(payload.course_id),
      course_name: String(payload.course_name || payload.course_id),
      uploader_id: String(payload.uploader_id),
      uploader_email: String(payload.uploader_email),
      uploader_name: String(payload.uploader_name || payload.uploader_email),
      notes: String(payload.notes || ""),
      status: "Menunggu Review",
      created_at: new Date().toISOString(),
      webViewLink: file.getUrl()
    };
    const all = getRecords_();
    all.unshift(record);
    PropertiesService.getScriptProperties().setProperty(TRACKING_KEY, JSON.stringify(all));
    return json_({ success: true, id: file.getId(), webViewLink: file.getUrl(), created_at: record.created_at });
  } catch (err) {
    return json_({ success: false, error: String(err && err.message || err) });
  }
}

function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action;
    if (action === "list") return json_({ success: true, files: getRecords_() });
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

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
