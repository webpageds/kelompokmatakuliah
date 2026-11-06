/**
 * Academic Curriculum Center — Drive document upload + review API.
 * Deploy as Web App: Execute as Drive owner; access limited as institution requires.
 */
const FOLDER_ID = "10ZyeVqwooNk0xERDuWqc04auCQyn6SBe";
const TRACKING_KEY = "ACC_RPS_DRIVE_UPLOADS";
const MAX_FILE_BYTES = 15 * 1024 * 1024;

function doPost(e) {
  try {
    const p = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = p.action || "upload";
    if (action === "upload") return uploadFile_(p);
    if (action === "list") return json_({ success:true, files:getRecords_() });
    if (action === "review") return reviewFile_(p);
    if (action === "delete") return deleteFile_(p);
    throw new Error("Aksi tidak dikenal.");
  } catch(err) { return json_({success:false,error:String(err && err.message || err)}); }
}
function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action === "list") return json_({success:true,files:getRecords_()});
    return json_({success:true,message:"Academic Curriculum Center Drive endpoint ready."});
  } catch(err) { return json_({success:false,error:String(err && err.message || err)}); }
}
function uploadFile_(p) {
  ["file_name","course_id","uploader_id","uploader_email","file_base64"].forEach(k=>{if(!p[k])throw new Error("Field wajib tidak tersedia: "+k)});
  const bytes=Utilities.base64Decode(p.file_base64);
  if(bytes.length>MAX_FILE_BYTES)throw new Error("Ukuran file maksimal 15 MB.");
  const mime=String(p.mime_type||"application/octet-stream").split(";")[0].trim();
  const name=sanitizeFileName_(p.file_name);
  const folder=DriveApp.getFolderById(FOLDER_ID);
  const file=folder.createFile(Utilities.newBlob(bytes,mime,name));
  file.setDescription(["Academic Curriculum Center document upload","Course: "+(p.course_name||p.course_id),"Uploader: "+p.uploader_email,"Uploader ID: "+p.uploader_id,"Notes: "+(p.notes||"")].join("\\n"));
  const row={id:file.getId(),drive_file_id:file.getId(),file_name:name,original_file_name:String(p.original_file_name||name),mime_type:mime,course_id:String(p.course_id),course_name:String(p.course_name||p.course_id),uploader_id:String(p.uploader_id),uploader_email:String(p.uploader_email),uploader_name:String(p.uploader_name||p.uploader_email),notes:String(p.notes||""),status:"Menunggu Review",created_at:new Date().toISOString(),webViewLink:file.getUrl(),admin_notes:""};
  const rows=getRecords_();rows.unshift(row);saveRecords_(rows);
  return json_({success:true,id:file.getId(),webViewLink:file.getUrl(),created_at:row.created_at,file_name:name});
}
function reviewFile_(p) {
  if(!p.id||!p.status)throw new Error("ID dokumen dan status wajib diisi.");
  const rows=getRecords_(),idx=rows.findIndex(x=>x.id===p.id);if(idx<0)throw new Error("Dokumen tidak ditemukan.");
  const allowed=["Menunggu Review","Sedang Diverifikasi","Disetujui","Perlu Revisi","Tidak Disetujui"];
  if(allowed.indexOf(p.status)<0)throw new Error("Status review tidak valid.");
  rows[idx].status=p.status;rows[idx].admin_notes=String(p.admin_notes||"");rows[idx].reviewed_by=String(p.reviewed_by||"Admin");rows[idx].reviewed_at=new Date().toISOString();
  saveRecords_(rows);return json_({success:true,file:rows[idx]});
}
function deleteFile_(p) {
  if(!p.id)throw new Error("ID dokumen wajib diisi.");
  const rows=getRecords_(),idx=rows.findIndex(x=>x.id===p.id);if(idx<0)throw new Error("Dokumen tidak ditemukan.");
  const row=rows[idx];DriveApp.getFileById(row.drive_file_id||row.id).setTrashed(true);
  rows.splice(idx,1);saveRecords_(rows);return json_({success:true,deleted_id:p.id});
}
function getRecords_(){const raw=PropertiesService.getScriptProperties().getProperty(TRACKING_KEY);if(!raw)return [];try{return JSON.parse(raw)}catch(_){return []}}
function saveRecords_(rows){PropertiesService.getScriptProperties().setProperty(TRACKING_KEY,JSON.stringify(rows))}
function sanitizeFileName_(v){return String(v||"document").replace(/[\\/:*?"<>|]/g,"_").slice(0,150)}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}
