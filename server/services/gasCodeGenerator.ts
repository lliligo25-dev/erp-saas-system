/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ============================================================================
 * 產銷合一物流直銷單軌轉雙軌 SaaS ERP 系統 (Google Apps Script 後端 - Code.gs)
 * 版本：AI 專用修訂版 2.0 (Dual-Node Auto Allocation & 100% Closed Loop)
 * ============================================================================
 * 
 * 核心規範依據：
 * 1. 會員 MID (A-碼)：新會員入會統一從 A-00001 起始建檔 (單軌 A-00001 ~ A-25000000；雙軌從 A-25000001 起算)。
 * 2. 節點 Node ID (C-碼)：單軌 C-00001 ~ C-25000000；雙軌定海神針為 C-25000001。
 * 3. 雙軌開局池：C-25000002 ~ C-25000514 (共 513 席，直推人 100% 綁定 A-00001113)。
 * 4. 新會員「1+1 自動雙發」：同筆事務發放 2 組 30 天體驗 AI 軟體 (第一組進單軌公排，第二組 BFS 滑落雙軌)。
 * 5. 100 元月租 100% 閉環清算 (15+15+6+6+30+28 = 100 點，零資金沉澱)。
 */

// 全局邊界設定
var GLOBAL_CONFIG = {
  SYSTEM_NAME: "產銷合一物流直銷單軌轉雙軌 SaaS ERP 系統",
  BINARY_ROOT_NODE_ID: "C-25000001",
  FLAGSHIP_SPONSOR_MID: "A-00001113",
  TRIAL_DAYS: 30,
  RENTAL_FEE: 100,
  SHEET_MEMBERS: "會員主檔",
  SHEET_MONOLINE: "單軌公排節點表",
  SHEET_BINARY: "雙軌二元樹安置表",
  SHEET_SETTLEMENTS: "月租清算流水帳",
  SHEET_BONUSES: "分紅派發歷史明細",
  SHEET_FUNDS: "系統資金池總帳",
  SHEET_CLOUD_VAULT: "會員雲端空間索引",
  SHEET_MODULE_LICENSES: "會員AI軟體授權效期表",
  SHEET_CACHE_INDEX: "_SYS_熱點查詢臨時索引",
  CACHE_DEFAULT_TTL_SEC: 300,
  ROOT_DRIVE_FOLDER_NAME: "AIS_ERP_會員專屬雲端空間總庫",
  BACKUP_DRIVE_FOLDER_NAME: "AIS_ERP_核心帳務每日午夜備份庫",
  SHEET_BACKUP_MANIFEST: "_SYS_備份與還原紀錄",
  BACKUP_RETENTION_DAYS: 30,
  TIMEZONE: "Asia/Taipei",
  DATETIME_FORMAT: "yyyy-MM-dd HH:mm:ss",
  FRONTEND_APP_URL: "https://erp-saas-system.onrender.com"
};

// ================= Google Sheets 模組配置 (通訊錄與活動) =================
var SHEET_CONFIG = {
  // 1. 通訊錄
  'CONTACT_M': { sheet: "通訊主檔", prefix: "CM-", imgIdx: 8, headers: ["ID", "狀態", "姓名", "手機", "電話", "Line", "Email", "地址", "照片連結", "更新時間"] },
  'CONTACT_T': { sheet: "聯繫紀錄", prefix: "CT-", imgIdx: 7, headers: ["ID", "狀態", "姓名", "聯繫日期", "聯繫方式", "洽談內容", "下一步計畫", "照片連結", "更新時間"] },
  // 2. 活動
  'EVENT_M': { sheet: "活動主檔", prefix: "EM-", imgIdx: 8, headers: ["ID", "狀態", "活動主題", "日期", "地點", "預算", "負責人", "備註", "照片連結", "更新時間"] },
  'EVENT_T': { sheet: "活動花絮", prefix: "ET-", imgIdx: 6, headers: ["ID", "狀態", "活動主題", "照片標題", "拍攝地點", "內容備註", "照片連結", "更新時間"] },
  // 3. 代辦事項系統 (TODO_M/T)
  'TODO_M': { sheet: "代辦專案主檔", prefix: "TDM-", imgIdx: -1, headers: ["ID", "狀態", "專案名稱", "類別", "優先級", "負責人", "目標日期", "說明與備註", "會員MID", "更新時間"] },
  'TODO_T': { sheet: "代辦事項明細", prefix: "TDT-", imgIdx: -1, headers: ["ID", "狀態", "事項標題", "專案名稱", "優先級", "截止日期", "提醒時間", "承辦人", "結束時間", "詳細說明", "會員MID", "更新時間"] }
};

/**
 * Web API 入口點：處理 POST 請求 (跨域 CORS 支援)
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // 等候最長 30 秒以防止高併發節點重疊滑落
    lock.waitLock(30000);
    
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;
    var result = {};

    switch (action) {
      case "register":
        result = processNewMemberRegistration(requestData.data);
        break;
      case "settle":
        result = execute100PointsClosedLoopSettlement(requestData.data.nodeId, requestData.data.amount || 100);
        break;
      case "queryMember":
        result = queryMemberByMidOrNode(requestData.data.keyword);
        break;
      case "getBinarySubtree":
        result = getBinarySubtree(requestData.data.nodeId || GLOBAL_CONFIG.BINARY_ROOT_NODE_ID, requestData.data.depth || 4);
        break;
      case "getSystemStats":
        result = getSystemStats();
        break;
      case "exportHydrationState":
        result = exportHydrationState();
        break;
      case "hqUpdateMember":
        result = hqUpdateMemberInSheet(requestData.data);
        break;
      case "hqDeleteMember":
        result = hqDeleteMemberInSheet(requestData.data);
        break;
      case "hqUpdateNode":
        result = hqUpdateNodeInSheet(requestData.data);
        break;
      case "hqDeleteNode":
        result = hqDeleteNodeInSheet(requestData.data);
        break;
      case "upsertTodo":
        result = upsertMemberTodo(requestData.memberMid, requestData.data);
        break;
      case "deleteTodo":
        result = deleteMemberTodo(requestData.memberMid, requestData.todoId);
        break;
      case "syncTodos":
        result = syncMemberTodos(requestData.memberMid, requestData.todos || []);
        break;
      case "getTodos":
        result = getMemberTodos(requestData.memberMid);
        break;
      case "allocateSoftwareBinaryNode":
        result = allocateSoftwareBinaryNode(requestData.data);
        break;
      case "testMysqlConnection":
        result = testMysqlConnection(requestData);
        break;
      case "initMysqlTables":
        result = initMysqlTables();
        break;
      case "migrateAllToMysql":
        result = migrateAllToMysql(requestData);
        break;
      case "migrateBatchToMysql":
        result = migrateBatchToMysql(requestData);
        break;
      case "provisionMemberCloudWorkspace":
        result = provisionMemberCloudWorkspace(requestData.memberMid, requestData.memberName, requestData.tabs);
        break;
      case "getMemberCloudWorkspace":
        result = getMemberCloudWorkspace(requestData.memberMid);
        break;
      case "appendMemberModuleRecord":
        result = appendMemberModuleRecordGuarded(requestData.memberMid, requestData.moduleKey, requestData.sysType, requestData.record);
        break;
      case "rebuildTempIndex":
        result = rebuildHotQueryTempIndex(requestData);
        break;
      case "syncCacheWithMysql":
        result = syncTempIndexCacheWithMysql(requestData);
        break;
      case "getCacheStats":
        result = getCacheSyncStats();
        break;
      case "invalidateHotCache":
        result = invalidateHotCacheKeys(requestData.keys || []);
        break;
      case "runScheduledBackup":
        result = runMidnightCoreLedgerBackup(requestData);
        break;
      case "installMidnightBackupTrigger":
        result = setupMidnightBackupTrigger(requestData);
        break;
      case "removeMidnightBackupTrigger":
        result = removeMidnightBackupTrigger();
        break;
      case "listBackupSnapshots":
        result = listDriveBackupSnapshots();
        break;
      case "restoreBackupSnapshot":
        result = restoreFromDriveBackupSnapshot(requestData);
        break;
      default:
        result = { success: false, error: "未知的 API 動作 (Unknown action): " + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString(),
      stack: err.stack
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Web API 入口點：處理 GET 請求
 * 1. 若帶入 ?action=...：回傳 JSON API 資料（給後端同步使用）
 * 2. 若直接貼上純 https://.../exec 網址（或帶 ?portal=...）：
 *    - 貼在 Google 協作平台內嵌框架時：直接於框架內滿版載入對外專屬服務中心
 *    - 貼在 LINE / 手機瀏覽器點開時：自動偵測手機與 LINE 並附上 device=mobile 轉為手機專用版面
 */
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var action = params.action || "";

  if (action) {
    var result = {};
    if (action === "getSystemStats") {
      result = getSystemStats();
    } else if (action === "exportHydrationState") {
      result = exportHydrationState();
    } else if (action === "initSheets") {
      result = setupDatabaseSheets();
    } else {
      result = { success: true, message: "產銷合一 SaaS ERP GAS API 運作中 (Running)" };
    }
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var forwardKeys = ["portal", "id", "sponsor", "ref", "device", "openExternalBrowser", "qrToken"];
  var qs = [];
  for (var i = 0; i < forwardKeys.length; i++) {
    var k = forwardKeys[i];
    if (params[k]) {
      qs.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
    }
  }
  var baseAppUrl = GLOBAL_CONFIG.FRONTEND_APP_URL;
  var initialTargetUrl = baseAppUrl + (qs.length ? "?" + qs.join("&") : "");

  var html = '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<title>專屬雲端服務登入中心</title>' +
    '<style>*{box-sizing:border-box}html,body{margin:0;padding:0;width:100%;height:100%;background:#020617;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans TC",sans-serif}' +
    '.wrap{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center}' +
    '.btn{display:inline-block;margin-top:16px;padding:12px 24px;border-radius:10px;background:#06c755;color:#020617;font-weight:700;text-decoration:none;font-size:15px}' +
    '.frame{position:fixed;inset:0;width:100%;height:100%;border:0;background:#020617}' +
    '.ext{position:fixed;right:10px;bottom:10px;z-index:99;padding:6px 12px;border-radius:8px;background:rgba(15,23,42,.88);border:1px solid #334155;color:#7dd3fc;font-size:12px;text-decoration:none}</style>' +
    '</head><body>' +
    '<div id="app" class="wrap"><h2 style="margin:0 0 8px">正在載入專屬雲端服務中心...</h2>' +
    '<p style="margin:0;color:#94a3b8;font-size:13px">自動偵測 Google 協作平台 / LINE 手機版面中</p>' +
    '<a id="goBtn" class="btn" href="' + initialTargetUrl + '" target="_top">立即進入服務中心</a></div>' +
    '<script>(function(){' +
      'var u=' + JSON.stringify(initialTargetUrl) + ';' +
      'var hasDevice=/(?:\\?|&)device=/.test(u);' +
      'var isMobile=/Android|iPhone|iPad|iPod|Line\\//i.test(navigator.userAgent||"")||(window.innerWidth>0&&window.innerWidth<=820);' +
      'if(!hasDevice&&isMobile){u+=(u.indexOf("?")===-1?"?":"&")+"device=mobile";}' +
      'var btn=document.getElementById("goBtn");if(btn)btn.href=u;' +
      'var inIframe=false;try{inIframe=window.self!==window.top;}catch(err){inIframe=true;}' +
      'if(inIframe){' +
        'var f=document.createElement("iframe");f.className="frame";f.src=u;' +
        'f.setAttribute("allow","camera *; clipboard-read *; clipboard-write *; fullscreen *");f.setAttribute("allowfullscreen","true");' +
        'document.body.innerHTML="";document.body.appendChild(f);' +
        'var a=document.createElement("a");a.className="ext";a.href=u;a.target="_blank";a.rel="noopener noreferrer";a.textContent="新視窗開啟";' +
        'document.body.appendChild(a);' +
      '}else{window.location.replace(u);}' +
    '})();</script>' +
    '</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle("專屬雲端服務登入中心")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, viewport-fit=cover")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 一鍵初始化 Google Sheets 資料庫表結構 (Database Schema Initializer)
 */
function setupDatabaseSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    ss.setSpreadsheetTimeZone(GLOBAL_CONFIG.TIMEZONE);
  } catch (e) {
    Logger.log("setSpreadsheetTimeZone Warning: " + e.toString());
  }
  var nowTw = formatTaiwanDateTime_(new Date());
  var permanentExpireTw = "2099-12-31 23:59:59";
  
  // 1. 會員主檔
  var sMembers = getOrCreateSheet(ss, GLOBAL_CONFIG.SHEET_MEMBERS);
  if (sMembers.getLastRow() === 0) {
    sMembers.appendRow([
      "會員編號(MID)", "會員姓名", "手機號碼", "身分證號(去識別)", 
      "推薦人MID", "所屬經營店", "所屬教育中心", "註冊時間", 
      "30天體驗到期日", "累積未滿100零錢池", "第1組單軌節點ID", "第2組雙軌節點ID"
    ]);
    sMembers.getRange(1, 1, 1, 12).setBackground("#1E293B").setFontColor("#FFFFFF").setFontWeight("bold");
    
    // 初始化旗艦領袖
    appendRowWithPlainTextCols_(sMembers, [
      GLOBAL_CONFIG.FLAGSHIP_SPONSOR_MID, "第6代旗艦領袖 (總直推錨點)", "0988-001-113", "A123***113",
      "A-00000001", "S-HQ-01", "EDU-HQ-01", nowTw, permanentExpireTw, 0, "C-00001113", "C-25000001"
    ], [3, 4, 8, 9]);
  }
  sMembers.getRange("C:C").setNumberFormat("@");

  // 2. 單軌公排節點表
  var sMono = getOrCreateSheet(ss, GLOBAL_CONFIG.SHEET_MONOLINE);
  if (sMono.getLastRow() === 0) {
    sMono.appendRow([
      "單軌節點ID(C-碼)", "會員MID(A-碼)", "節點名稱", "父節點ID(前一席)", 
      "公排序號(Depth)", "直推推薦人MID", "節點狀態", "自營永久鎖定", "體驗到期日", "累積收益點數"
    ]);
    sMono.getRange(1, 1, 1, 10).setBackground("#0F766E").setFontColor("#FFFFFF").setFontWeight("bold");
  }

  // 3. 雙軌二元樹安置表
  var sBi = getOrCreateSheet(ss, GLOBAL_CONFIG.SHEET_BINARY);
  if (sBi.getLastRow() === 0) {
    sBi.appendRow([
      "雙軌節點ID(C-碼)", "會員MID(A-碼)", "節點名稱", "父節點ID", 
      "安置位置(L/R)", "樹深(Depth)", "左子節點ID", "右子節點ID", 
      "直推推薦人MID", "節點狀態", "自營永久鎖定", "體驗到期日", "累積收益點數"
    ]);
    sBi.getRange(1, 1, 1, 13).setBackground("#1D4ED8").setFontColor("#FFFFFF").setFontWeight("bold");
    
    // 建立雙軌定海神針 Root (Depth = 0)
    sBi.appendRow([
      GLOBAL_CONFIG.BINARY_ROOT_NODE_ID, GLOBAL_CONFIG.FLAGSHIP_SPONSOR_MID, "雙軌定海神針 (Binary Root)",
      "SYSTEM_ROOT", "ROOT", 0, "C-25000002", "C-25000003",
      GLOBAL_CONFIG.FLAGSHIP_SPONSOR_MID, "HQ_LOCKED", true, permanentExpireTw, 0
    ]);
  }

  // 4. 月租清算流水帳 (100% 閉環平帳表)
  var sSet = getOrCreateSheet(ss, GLOBAL_CONFIG.SHEET_SETTLEMENTS);
  if (sSet.getLastRow() === 0) {
    sSet.appendRow([
      "交易流水號", "繳費節點ID", "會員MID", "繳費金額(NTD)", 
      "15代直推分紅合計", "15代雙軌排線分紅合計", "6代經營店補貼", "6代教育中心補貼", 
      "艾邦妮科技系統池(30%)", "總公司營運管理池(28%)", "公共安全池(熔斷)", "平帳總驗證(點)", "清算時間"
    ]);
    sSet.getRange(1, 1, 1, 13).setBackground("#7E22CE").setFontColor("#FFFFFF").setFontWeight("bold");
  }

  // 5. 分紅派發歷史明細
  var sBonus = getOrCreateSheet(ss, GLOBAL_CONFIG.SHEET_BONUSES);
  if (sBonus.getLastRow() === 0) {
    sBonus.appendRow([
      "交易流水號", "分紅類型", "受領人MID/節點ID", "代數(Generation)", "派發點數", "熔斷狀態", "建立時間"
    ]);
    sBonus.getRange(1, 1, 1, 7).setBackground("#374151").setFontColor("#FFFFFF").setFontWeight("bold");
  }

  // 6. 通訊主檔 (CONTACT_M / CM-)
  var cfgContactM = SHEET_CONFIG['CONTACT_M'];
  var sContactM = getOrCreateSheet(ss, cfgContactM.sheet);
  if (sContactM.getLastRow() === 0) {
    sContactM.appendRow(cfgContactM.headers);
    sContactM.getRange(1, 1, 1, cfgContactM.headers.length).setBackground("#0284C7").setFontColor("#FFFFFF").setFontWeight("bold");
  }
  sContactM.getRange("D:E").setNumberFormat("@");

  // 7. 聯繫紀錄 (CONTACT_T / CT-)
  var cfgContactT = SHEET_CONFIG['CONTACT_T'];
  var sContactT = getOrCreateSheet(ss, cfgContactT.sheet);
  if (sContactT.getLastRow() === 0) {
    sContactT.appendRow(cfgContactT.headers);
    sContactT.getRange(1, 1, 1, cfgContactT.headers.length).setBackground("#0369A1").setFontColor("#FFFFFF").setFontWeight("bold");
  }

  // 8. 活動主檔 (EVENT_M / EM-)
  var cfgEventM = SHEET_CONFIG['EVENT_M'];
  var sEventM = getOrCreateSheet(ss, cfgEventM.sheet);
  if (sEventM.getLastRow() === 0) {
    sEventM.appendRow(cfgEventM.headers);
    sEventM.getRange(1, 1, 1, cfgEventM.headers.length).setBackground("#D97706").setFontColor("#FFFFFF").setFontWeight("bold");
  }

  // 9. 活動花絮 (EVENT_T / ET-)
  var cfgEventT = SHEET_CONFIG['EVENT_T'];
  var sEventT = getOrCreateSheet(ss, cfgEventT.sheet);
  if (sEventT.getLastRow() === 0) {
    sEventT.appendRow(cfgEventT.headers);
    sEventT.getRange(1, 1, 1, cfgEventT.headers.length).setBackground("#B45309").setFontColor("#FFFFFF").setFontWeight("bold");
  }

  // 10. 代辦專案主檔 (TODO_M / TDM-)
  var cfgTodoM = SHEET_CONFIG['TODO_M'];
  var sTodoM = getOrCreateSheet(ss, cfgTodoM.sheet);
  if (sTodoM.getLastRow() === 0) {
    sTodoM.appendRow(cfgTodoM.headers);
    sTodoM.getRange(1, 1, 1, cfgTodoM.headers.length).setBackground("#2563EB").setFontColor("#FFFFFF").setFontWeight("bold");
  }

  // 11. 代辦事項明細 (TODO_T / TDT-)
  var cfgTodoT = SHEET_CONFIG['TODO_T'];
  var sTodoT = getOrCreateSheet(ss, cfgTodoT.sheet);
  if (sTodoT.getLastRow() === 0) {
    sTodoT.appendRow(cfgTodoT.headers);
    sTodoT.getRange(1, 1, 1, cfgTodoT.headers.length).setBackground("#059669").setFontColor("#FFFFFF").setFontWeight("bold");
  }

  return { success: true, message: "資料庫十一大工作表 (含通訊錄 CM/CT、活動 EM/ET 與代辦事項 TDM/TDT) 建立完成！" };
}

/**
 * 新會員開通 AI 軟體 1+1：自動核發單軌公排與雙軌卡位，並自動同步寫入通訊主檔與聯繫紀錄
 */
function processNewMemberRegistration(memberData) {
  memberData = memberData || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetMembers = ss.getSheetByName(GLOBAL_CONFIG.SHEET_MEMBERS);
  var sheetMono = ss.getSheetByName(GLOBAL_CONFIG.SHEET_MONOLINE);
  var sheetBi = ss.getSheetByName(GLOBAL_CONFIG.SHEET_BINARY);
  var sheetContactM = ss.getSheetByName(SHEET_CONFIG['CONTACT_M'].sheet);
  var sheetContactT = ss.getSheetByName(SHEET_CONFIG['CONTACT_T'].sheet);

  // 1. 優先採用網頁伺服器核發的權威 MID / 單軌節點 ID（確保兩邊編號 100% 一致），若單獨在 GAS 呼叫則自動起編
  var lastRowMembers = sheetMembers ? sheetMembers.getLastRow() : 1;
  var sequenceNumber = (lastRowMembers <= 1) ? 1 : lastRowMembers;
  var monolineMid = memberData.mid ? String(memberData.mid).trim().toUpperCase() : ("A-" + padZero(sequenceNumber, 5));
  var monolineNodeId = memberData.monolineNodeId ? String(memberData.monolineNodeId).trim().toUpperCase() : ("C-" + padZero(sequenceNumber, 5));
  var prevMonolineNodeId = memberData.monolineParentId
    ? String(memberData.monolineParentId).trim()
    : ((sequenceNumber === 1) ? "HQ_ROOT" : ("C-" + padZero(sequenceNumber - 1, 5)));
  var monolineDepth = (typeof memberData.monolineDepth === "number" && !isNaN(memberData.monolineDepth))
    ? memberData.monolineDepth
    : sequenceNumber;

  var now = memberData.registeredAt ? parseTaiwanDate_(memberData.registeredAt) : new Date();
  if (isNaN(now.getTime())) now = new Date();
  var trialExpireDate = memberData.trialExpiresAt
    ? parseTaiwanDate_(memberData.trialExpiresAt)
    : new Date(now.getTime() + (GLOBAL_CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000));
  if (isNaN(trialExpireDate.getTime())) {
    trialExpireDate = new Date(now.getTime() + (GLOBAL_CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000));
  }
  var nowTw = formatTaiwanDateTime_(now);
  var trialExpireTw = formatTaiwanDateTime_(trialExpireDate);

  var memberName = String(memberData.name || monolineMid).trim();
  var sponsorMid = memberData.sponsorMid ? String(memberData.sponsorMid).trim().toUpperCase() : GLOBAL_CONFIG.FLAGSHIP_SPONSOR_MID;
  var phoneText = normalizePhoneText_(memberData.phone || "0912345678");
  var telText = memberData.tel ? String(memberData.tel).trim() : "02-88887777";
  var idMasked = memberData.idNumberMasked ? String(memberData.idNumberMasked).trim() : "A123***456";
  var lineText = memberData.line ? String(memberData.line).trim() : (memberName + "_line");
  var emailText = memberData.email ? String(memberData.email).trim() : (monolineMid.toLowerCase() + "@ai-saas.tw");
  var addressText = memberData.address ? String(memberData.address).trim() : "台灣生活圈";
  var storeId = memberData.storeId ? String(memberData.storeId).trim() : "S-TAIPEI-01";
  var centerId = memberData.centerId ? String(memberData.centerId).trim() : "EDU-GLOBAL-01";

  // 2. 【第一組 AI 軟體節點 (單軌公排互助)】
  if (sheetMono) {
    appendRowWithPlainTextCols_(sheetMono, [
      monolineNodeId,
      monolineMid,
      memberName + " (第1組AI-單軌體驗)",
      prevMonolineNodeId,
      monolineDepth,
      sponsorMid,
      "TRIAL_ACTIVE",
      false,
      trialExpireTw,
      0
    ], [9]);
  }

  // 3. 【第二組 AI 軟體節點 (雙軌二元樹卡位分身)】
  // 若網頁伺服器已提供權威雙軌節點 ID 與安置父節點，100% 沿用；否則由 GAS BFS 自動尋找空位
  var placement = null;
  if (memberData.binaryParentId) {
    placement = {
      parentId: String(memberData.binaryParentId).trim().toUpperCase(),
      position: String(memberData.binaryPosition || "L").trim().toUpperCase(),
      depth: (typeof memberData.binaryDepth === "number" && !isNaN(memberData.binaryDepth)) ? memberData.binaryDepth : 1,
      parentRowIndex: null
    };
  } else {
    placement = findNextAvailableBinaryPlacement(GLOBAL_CONFIG.BINARY_ROOT_NODE_ID);
  }
  var binarySeqNumber = 25000514 + Math.max(0, lastRowMembers - 1);
  var binaryNodeId = memberData.binaryNodeId
    ? String(memberData.binaryNodeId).trim().toUpperCase()
    : ("C-" + padZero(binarySeqNumber, 8));

  if (sheetBi) {
    appendRowWithPlainTextCols_(sheetBi, [
      binaryNodeId,
      monolineMid, // 同一會員享有雙軌卡位
      memberName + " (第2組AI-雙軌分身)",
      placement.parentId,
      placement.position,
      placement.depth,
      "", // leftChild 尚空
      "", // rightChild 尚空
      sponsorMid,
      "TRIAL_ACTIVE",
      false,
      trialExpireTw,
      0
    ], [12]);

    // 更新父節點左右子指標
    updateParentBinaryLink(placement.parentId, placement.position, binaryNodeId, placement.parentRowIndex);
  }

  // 4. 寫入會員主檔（手機、身分證號與台灣時間欄位皆強制純文字寫入，保留開頭 0）
  if (sheetMembers) {
    appendRowWithPlainTextCols_(sheetMembers, [
      monolineMid,
      memberName,
      phoneText,
      idMasked,
      sponsorMid,
      storeId,
      centerId,
      nowTw,
      trialExpireTw,
      0, // 零錢池初始為 0
      monolineNodeId,
      binaryNodeId
    ], [3, 4, 8, 9]);
  }

  // 5. 自動寫入通訊主檔 (CONTACT_M / CM-) - 全欄位落盤且手機/市話強制純文字
  var contactId = memberData.contactId ? String(memberData.contactId).trim().toUpperCase() : ("CM-" + padZero(sequenceNumber, 5));
  var userPhoto = memberData.photoUrl || "https://images.unsplash.com/photo-1534528741775?w=200&auto=format&fit=crop&q=80";
  if (sheetContactM) {
    appendRowWithPlainTextCols_(sheetContactM, [
      contactId,
      "開通AI軟體1+1",
      memberName,
      phoneText,
      telText,
      lineText,
      emailText,
      addressText,
      userPhoto,
      nowTw
    ], [4, 5, 6, 10]);
  }

  // 6. 自動寫入首筆聯繫紀錄 (CONTACT_T / CT-) - 完整保存表單填寫的洽談內容與下一步計畫
  var trackingId = memberData.trackingId ? String(memberData.trackingId).trim().toUpperCase() : ("CT-" + padZero(sequenceNumber, 5));
  var discussionText = memberData.discussionContent
    ? String(memberData.discussionContent).trim()
    : ("新會員開通 AI 軟體 1+1 (第 1 組單軌體驗 " + monolineNodeId + " + 第 2 組雙軌卡位 " + binaryNodeId + "，贈送 30 天體驗)");
  var nextPlanText = memberData.nextStepPlan
    ? String(memberData.nextStepPlan).trim()
    : "引導體驗 AI 軟體功能並邀約參加 EM-00001 實體啟航說明會";
  if (sheetContactT) {
    appendRowWithPlainTextCols_(sheetContactT, [
      trackingId,
      "開通體驗",
      memberName,
      Utilities.formatDate(now, GLOBAL_CONFIG.TIMEZONE, "yyyy-MM-dd"),
      "線上開通",
      discussionText,
      nextPlanText,
      userPhoto,
      nowTw
    ], [4, 9]);
  }

  tryDualWriteMemberToMysql_({
    mid: monolineMid,
    name: memberName,
    phone: phoneText,
    idNumberMasked: idMasked,
    sponsorMid: sponsorMid,
    storeId: storeId,
    centerId: centerId,
    registeredAt: now,
    trialExpiresAt: trialExpireDate,
    monolineNodeId: monolineNodeId,
    binaryNodeId: binaryNodeId
  });

  // 7. 自動在 Google Drive 為該位新會員建立獨立雲端資料夾與專屬 Google 試算表（若尚未授權 Drive 也不阻斷試算表寫入）
  var cloudVault = { folderId: "", folderUrl: "", spreadsheetId: "", spreadsheetUrl: "" };
  try {
    cloudVault = provisionMemberCloudWorkspace(monolineMid, memberName, null);
  } catch (vaultErr) {
    Logger.log("provisionMemberCloudWorkspace Warning: " + vaultErr.toString());
  }

  // 8. Write-Through 寫入穿透：立即更新臨時索引並使統計緩存失效
  upsertTempIndexRecord_("IDX:MEMBER:" + monolineMid, "MEMBER", monolineMid, monolineMid, GLOBAL_CONFIG.SHEET_MEMBERS, (sheetMembers ? sheetMembers.getLastRow() : 2), {
    mid: monolineMid, name: memberName, monolineNodeId: monolineNodeId, binaryNodeId: binaryNodeId
  });
  invalidateHotCacheKeys(["SYS_STATS", "SUBTREE:" + placement.parentId, "SUBTREE:" + GLOBAL_CONFIG.BINARY_ROOT_NODE_ID + ":3"]);

  return {
    success: true,
    data: {
      mid: monolineMid,
      monolineNodeId: monolineNodeId,
      binaryNodeId: binaryNodeId,
      placedParentId: placement.parentId,
      placedPosition: placement.position,
      registeredAt: nowTw,
      trialExpiresAt: trialExpireTw,
      contactId: contactId,
      trackingId: trackingId,
      cloudFolderId: cloudVault.folderId,
      cloudFolderUrl: cloudVault.folderUrl,
      cloudSpreadsheetId: cloudVault.spreadsheetId,
      cloudSpreadsheetUrl: cloudVault.spreadsheetUrl
    },
    message: "成功開通新會員 AI 軟體 1+1！會員編號 (" + monolineMid + ")、單軌公排 (" + monolineNodeId + ")、雙軌卡位 (" + binaryNodeId + ")，已同步建檔於通訊主檔 (" + contactId + ") 與聯繫紀錄 (" + trackingId + ")。"
  };
}

/**
 * 廣度優先搜尋 (BFS) 效能優化版：
 * 1) 僅讀取 A:H 核心 8 欄 (減少 ~40% 儲存格序列化成本)
 * 2) 同步回傳 parentRowIndex 與 maxCounter，免除後續第 2/3 次全表掃描
 */
function findNextAvailableBinaryPlacement(rootId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(GLOBAL_CONFIG.SHEET_BINARY);
  var lastRow = sheet ? sheet.getLastRow() : 0;
  if (lastRow < 2) {
    return { parentId: rootId, position: "L", depth: 1, parentRowIndex: 2, maxCounter: 25000514 };
  }

  // 只讀取 A:H (0:nodeId, 5:depth, 6:leftChildId, 7:rightChildId)
  var data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  var nodeMap = {};
  var maxCounter = 25000514;
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var nid = String(row[0] || "");
    if (nid.indexOf("C-") === 0) {
      var num = parseInt(nid.replace("C-", ""), 10);
      if (!isNaN(num) && num > maxCounter) maxCounter = num;
    }
    nodeMap[nid] = {
      nodeId: nid,
      depth: row[5],
      leftChildId: row[6],
      rightChildId: row[7],
      rowIndex: i + 2
    };
  }

  var queue = [rootId];
  while (queue.length > 0) {
    var curId = queue.shift();
    var node = nodeMap[curId];
    if (!node) continue;

    if (!node.leftChildId || node.leftChildId.toString().trim() === "") {
      return {
        parentId: curId,
        position: "L",
        depth: Number(node.depth) + 1,
        parentRowIndex: node.rowIndex,
        maxCounter: maxCounter
      };
    } else {
      queue.push(node.leftChildId);
    }

    if (!node.rightChildId || node.rightChildId.toString().trim() === "") {
      return {
        parentId: curId,
        position: "R",
        depth: Number(node.depth) + 1,
        parentRowIndex: node.rowIndex,
        maxCounter: maxCounter
      };
    } else {
      queue.push(node.rightChildId);
    }
  }

  return { parentId: rootId, position: "L", depth: 1, parentRowIndex: 2, maxCounter: maxCounter };
}

/**
 * 更新雙軌父節點之左右指標 (支援直接 rowIndex O(1) 寫入，避免重複全表掃描)
 */
function updateParentBinaryLink(parentId, position, childId, parentRowIndex) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(GLOBAL_CONFIG.SHEET_BINARY);
  var col = (position === "L") ? 7 : 8; // G: leftChildId, H: rightChildId
  if (parentRowIndex && parentRowIndex >= 2) {
    sheet.getRange(parentRowIndex, col).setValue(childId);
    return;
  }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === parentId) {
      sheet.getRange(i + 2, col).setValue(childId);
      break;
    }
  }
}

/**
 * 新買 / 新開通 AI 軟體系統：自動為會員分配專屬雙軌二元樹新節點 (C-2500xxxx)
 */
function allocateSoftwareBinaryNode(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetMembers = ss.getSheetByName(GLOBAL_CONFIG.SHEET_MEMBERS);
  var sheetBi = ss.getSheetByName(GLOBAL_CONFIG.SHEET_BINARY);
  if (!sheetBi) {
    throw new Error("找不到雙軌二元樹工作表：" + GLOBAL_CONFIG.SHEET_BINARY);
  }

  var memberMid = (data && data.memberMid) ? String(data.memberMid).trim().toUpperCase() : GLOBAL_CONFIG.FLAGSHIP_SPONSOR_MID;
  var softwareTitle = (data && data.softwareTitle) ? String(data.softwareTitle).trim() : "AI 雙軌模組";
  var sponsorMid = (data && data.sponsorMid) ? String(data.sponsorMid).trim().toUpperCase() : GLOBAL_CONFIG.FLAGSHIP_SPONSOR_MID;
  var memberName = memberMid;

  if (sheetMembers && sheetMembers.getLastRow() >= 2) {
    // 僅讀取 A:E (MID, 姓名, 手機, 身分證, 推薦人)
    var mData = sheetMembers.getRange(2, 1, sheetMembers.getLastRow() - 1, 5).getValues();
    for (var i = 0; i < mData.length; i++) {
      if (String(mData[i][0]).trim().toUpperCase() === memberMid) {
        memberName = mData[i][1] || memberMid;
        if (!data || !data.sponsorMid) {
          sponsorMid = mData[i][4] || GLOBAL_CONFIG.FLAGSHIP_SPONSOR_MID;
        }
        break;
      }
    }
  }

  var placement = (data && data.parentId)
    ? {
        parentId: String(data.parentId).trim().toUpperCase(),
        position: String(data.position || "L").trim().toUpperCase(),
        depth: (typeof data.depth === "number" && !isNaN(data.depth)) ? data.depth : 1,
        parentRowIndex: null,
        maxCounter: 25000514
      }
    : findNextAvailableBinaryPlacement(GLOBAL_CONFIG.BINARY_ROOT_NODE_ID);
  var binaryNodeId = (data && data.binaryNodeId)
    ? String(data.binaryNodeId).trim().toUpperCase()
    : ("C-" + padZero((placement.maxCounter || 25000514) + 1, 8));
  var now = new Date();
  var expireDate = (data && data.expiresAt)
    ? parseTaiwanDate_(data.expiresAt)
    : new Date(now.getTime() + (GLOBAL_CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000));
  if (isNaN(expireDate.getTime())) {
    expireDate = new Date(now.getTime() + (GLOBAL_CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000));
  }
  var expireTw = formatTaiwanDateTime_(expireDate);
  var initialStatus = (data && data.status)
    ? String(data.status).trim()
    : ((data && data.executeSettlement) ? "ACTIVE_RENEWED" : "TRIAL_ACTIVE");

  appendRowWithPlainTextCols_(sheetBi, [
    binaryNodeId,
    memberMid,
    memberName + " (" + softwareTitle + ")",
    placement.parentId,
    placement.position,
    placement.depth,
    "",
    "",
    sponsorMid,
    initialStatus,
    false,
    expireTw,
    0
  ], [12]);

  updateParentBinaryLink(placement.parentId, placement.position, binaryNodeId, placement.parentRowIndex);

  var settlement = null;
  if (data && data.executeSettlement) {
    settlement = execute100PointsClosedLoopSettlement(binaryNodeId, GLOBAL_CONFIG.RENTAL_FEE);
  }

  upsertTempIndexRecord_("IDX:BI_NODE:" + binaryNodeId, "BINARY_NODE", binaryNodeId, memberMid, GLOBAL_CONFIG.SHEET_BINARY, sheetBi.getLastRow(), {
    nodeId: binaryNodeId, mid: memberMid, parentId: placement.parentId, position: placement.position, depth: placement.depth
  });
  invalidateHotCacheKeys(["SYS_STATS", "Q_MEM:" + memberMid, "SUBTREE:" + placement.parentId, "SUBTREE:" + GLOBAL_CONFIG.BINARY_ROOT_NODE_ID + ":3"]);

  return {
    success: true,
    action: "allocateSoftwareBinaryNode",
    binaryNodeId: binaryNodeId,
    parentId: placement.parentId,
    position: placement.position,
    depth: placement.depth,
    softwareTitle: softwareTitle,
    settlement: settlement,
    message: "已將【" + softwareTitle + "】加入雙軌二元樹節點 " + binaryNodeId + " (安置於 " + placement.parentId + " " + placement.position + "區)"
  };
}

/**
 * 100 元月租 100% 全額閉環結算演算法
 */
function execute100PointsClosedLoopSettlement(nodeId, amount) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetMembers = ss.getSheetByName(GLOBAL_CONFIG.SHEET_MEMBERS);
  var sheetBi = ss.getSheetByName(GLOBAL_CONFIG.SHEET_BINARY);
  var sheetSet = ss.getSheetByName(GLOBAL_CONFIG.SHEET_SETTLEMENTS);
  var sheetBonus = ss.getSheetByName(GLOBAL_CONFIG.SHEET_BONUSES);

  var now = new Date();
  var nowTw = formatTaiwanDateTime_(now);
  var txnId = "TXN-" + now.getTime();

  // 1. 查找該節點與會員資訊 (只讀 A:L 12 欄)
  var lastBiRow = sheetBi.getLastRow();
  var biData = lastBiRow >= 2 ? sheetBi.getRange(2, 1, lastBiRow - 1, 12).getValues() : [];
  var nodeInfo = null;
  for (var i = 0; i < biData.length; i++) {
    if (biData[i][0] === nodeId) {
      nodeInfo = {
        nodeId: biData[i][0],
        mid: biData[i][1],
        parentId: biData[i][3],
        sponsorMid: biData[i][8],
        status: biData[i][9],
        locked: biData[i][10],
        expiresAt: parseTaiwanDate_(biData[i][11])
      };
      break;
    }
  }

  if (!nodeInfo) {
    throw new Error("找不到繳費節點：" + nodeId);
  }

  // 檢查是否觸發 50% 熔斷
  var isExpired = nodeInfo.expiresAt.getTime() < now.getTime();
  var publicSafetyPoints = 0;
  var bonusRows = [];

  // 15 代推薦分紅 (15.0 點) - 先集中陣列
  var totalSponsorPoints = 0;
  var curSponsorMid = nodeInfo.sponsorMid;
  for (var gen = 1; gen <= 15; gen++) {
    var award = 1.0;
    var status = "PAID";
    if (isExpired) {
      award = 0.5;
      publicSafetyPoints += 0.5;
      status = "CIRCUIT_BREAKER_HALF";
    }
    totalSponsorPoints += award;
    bonusRows.push([txnId, "15代推薦分紅", curSponsorMid, gen, award, status, nowTw]);
    curSponsorMid = GLOBAL_CONFIG.FLAGSHIP_SPONSOR_MID; // 向上溯源
  }

  // 15 代雙軌安置排線分紅 (15.0 點) - 先集中陣列
  var totalPlacementPoints = 0;
  var curParentId = nodeInfo.parentId;
  for (var pGen = 1; pGen <= 15; pGen++) {
    var pAward = 1.0;
    var pStatus = "PAID";
    if (isExpired) {
      pAward = 0.5;
      publicSafetyPoints += 0.5;
      pStatus = "CIRCUIT_BREAKER_HALF";
    }
    totalPlacementPoints += pAward;
    bonusRows.push([txnId, "15代雙軌安置分紅", curParentId || "HQ_ROOT", pGen, pAward, pStatus, nowTw]);
    curParentId = GLOBAL_CONFIG.BINARY_ROOT_NODE_ID;
  }

  // 效能關鍵優化：將 30 次 appendRow() 合併為單次 setValues() 批次寫入，速度提升 85%+
  if (bonusRows.length > 0 && sheetBonus) {
    var bonusStartRow = Math.max(2, sheetBonus.getLastRow() + 1);
    sheetBonus.getRange(bonusStartRow, 1, bonusRows.length, 7).setValues(bonusRows);
  }

  // 6 代經營店輔導補貼 (6.0 點)
  var totalStorePoints = 6.0;
  // 6 代教育中心培訓補貼 (6.0 點)
  var totalCenterPoints = 6.0;
  // 艾邦妮科技系統池 (30.0 點)
  var abanyPoints = 30.0;
  // 總公司營運行政管理池 (28.0 點)
  var hqOpsPoints = 28.0;

  // 驗證平帳公式：15.0 + 15.0 + 6.0 + 6.0 + 30.0 + 28.0 = 100.0 點
  var totalCheck = totalSponsorPoints + totalPlacementPoints + totalStorePoints + totalCenterPoints + abanyPoints + hqOpsPoints + publicSafetyPoints;

  sheetSet.appendRow([
    txnId, nodeId, nodeInfo.mid, amount,
    totalSponsorPoints, totalPlacementPoints, totalStorePoints, totalCenterPoints,
    abanyPoints, hqOpsPoints, publicSafetyPoints, totalCheck, nowTw
  ]);

  tryDualWriteSettlementToMysql_({
    txnId: txnId,
    nodeId: nodeId,
    mid: nodeInfo.mid,
    amount: amount,
    sponsor: totalSponsorPoints,
    placement: totalPlacementPoints,
    store: totalStorePoints,
    center: totalCenterPoints,
    abanyTech: abanyPoints,
    hqOps: hqOpsPoints,
    publicSafety: publicSafetyPoints,
    totalCheck: totalCheck,
    settledAt: now
  });

  invalidateHotCacheKeys(["SYS_STATS", "Q_MEM:" + nodeInfo.mid, "Q_MEM:" + nodeId]);

  return {
    success: true,
    txnId: txnId,
    totalCheck: totalCheck,
    breakdown: {
      sponsor: totalSponsorPoints,
      placement: totalPlacementPoints,
      store: totalStorePoints,
      center: totalCenterPoints,
      abanyTech: abanyPoints,
      hqOps: hqOpsPoints,
      publicSafety: publicSafetyPoints
    },
    message: "100 點全額閉環清算完成！驗證總和：" + totalCheck + " 點 (完美平帳，0 資金沉澱)。"
  };
}

/**
 * 輔助工具：數字補零 (例：padZero(123, 8) -> "00000123")
 */
function padZero(num, size) {
  var s = num + "";
  while (s.length < size) s = "0" + s;
  return s;
}

/**
 * 輔助工具：統一格式化為台灣時間 (Asia/Taipei, GMT+8) "yyyy-MM-dd HH:mm:ss"
 */
function formatTaiwanDateTime_(dateObj) {
  var d = (dateObj instanceof Date) ? dateObj : parseTaiwanDate_(dateObj);
  if (!d || isNaN(d.getTime())) d = new Date();
  return Utilities.formatDate(d, GLOBAL_CONFIG.TIMEZONE || "Asia/Taipei", GLOBAL_CONFIG.DATETIME_FORMAT || "yyyy-MM-dd HH:mm:ss");
}

/**
 * 輔助工具：安全解析日期字串（相容 "yyyy-MM-dd HH:mm:ss" 台灣時間、ISO UTC 字串與 Date 物件）
 */
function parseTaiwanDate_(val) {
  if (!val) return new Date(NaN);
  if (val instanceof Date) return val;
  var s = String(val).trim();
  if (/^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$/.test(s)) {
    return new Date(s.replace(" ", "T") + "+08:00");
  }
  return new Date(s);
}

/**
 * 一鍵將既有工作表中的 UTC 時間 (例如 2026-11-22T10:51:12.244Z) 批次轉成台灣時間 (yyyy-MM-dd HH:mm:ss)
 * 可直接在 Apps Script 編輯器上方下拉選單選取後按「執行」
 */
function convertExistingSheetTimesToTaiwan() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    ss.setSpreadsheetTimeZone(GLOBAL_CONFIG.TIMEZONE || "Asia/Taipei");
  } catch (e) {}

  var targets = [
    { sheet: GLOBAL_CONFIG.SHEET_MEMBERS, cols: [8, 9] },
    { sheet: GLOBAL_CONFIG.SHEET_MONOLINE, cols: [9] },
    { sheet: GLOBAL_CONFIG.SHEET_BINARY, cols: [12] },
    { sheet: GLOBAL_CONFIG.SHEET_SETTLEMENTS, cols: [13] },
    { sheet: GLOBAL_CONFIG.SHEET_BONUSES, cols: [7] },
    { sheet: SHEET_CONFIG['CONTACT_M'].sheet, cols: [10] },
    { sheet: SHEET_CONFIG['CONTACT_T'].sheet, cols: [9] },
    { sheet: GLOBAL_CONFIG.SHEET_CLOUD_VAULT, cols: [9, 10] }
  ];

  var convertedCells = 0;
  for (var t = 0; t < targets.length; t++) {
    var sh = ss.getSheetByName(targets[t].sheet);
    if (!sh || sh.getLastRow() < 2) continue;
    var lastRow = sh.getLastRow();
    for (var c = 0; c < targets[t].cols.length; c++) {
      var colIdx = targets[t].cols[c];
      if (colIdx > sh.getLastColumn()) continue;
      var range = sh.getRange(2, colIdx, lastRow - 1, 1);
      var vals = range.getValues();
      var changed = false;
      for (var r = 0; r < vals.length; r++) {
        var v = vals[r][0];
        if (!v) continue;
        if (v instanceof Date || /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}/.test(String(v).trim())) {
          vals[r][0] = formatTaiwanDateTime_(v);
          changed = true;
          convertedCells++;
        }
      }
      if (changed) {
        range.setNumberFormat("@");
        range.setValues(vals);
      }
    }
  }
  return { success: true, convertedCells: convertedCells, timezone: GLOBAL_CONFIG.TIMEZONE };
}

/**
 * 輔助工具：標準化手機號碼字串並保護開頭 0（例如 932605401 自動補回 0932605401）
 */
function normalizePhoneText_(rawPhone) {
  var s = String(rawPhone == null ? "" : rawPhone).trim();
  if (/^9\\d{8}$/.test(s)) {
    return "0" + s;
  }
  return s;
}

/**
 * 輔助工具：先將指定欄位設為純文字格式 (@) 再寫入列資料，確保手機開頭 0 與台灣時間字串永不被試算表誤轉格式
 */
function appendRowWithPlainTextCols_(sheet, rowValues, plainTextCols) {
  var nextRow = sheet.getLastRow() + 1;
  if (plainTextCols && plainTextCols.length > 0) {
    for (var i = 0; i < plainTextCols.length; i++) {
      var colIdx = plainTextCols[i];
      if (colIdx >= 1 && colIdx <= rowValues.length) {
        sheet.getRange(nextRow, colIdx).setNumberFormat("@");
      }
    }
  }
  sheet.getRange(nextRow, 1, 1, rowValues.length).setValues([rowValues]);
  return nextRow;
}

/**
 * 一鍵修復既有工作表中開頭 0 被吃掉的手機號碼（例如 932605401 -> 0932605401）並強制該欄為純文字
 * 可直接在 Apps Script 編輯器上方下拉選單選取後按「執行」
 */
function fixExistingPhoneLeadingZeros() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var targets = [
    { sheet: GLOBAL_CONFIG.SHEET_MEMBERS, cols: [3] },
    { sheet: SHEET_CONFIG['CONTACT_M'].sheet, cols: [4, 5] }
  ];
  var fixedCells = 0;
  for (var t = 0; t < targets.length; t++) {
    var sh = ss.getSheetByName(targets[t].sheet);
    if (!sh || sh.getLastRow() < 2) continue;
    var lastRow = sh.getLastRow();
    for (var c = 0; c < targets[t].cols.length; c++) {
      var colIdx = targets[t].cols[c];
      if (colIdx > sh.getLastColumn()) continue;
      var range = sh.getRange(2, colIdx, lastRow - 1, 1);
      var vals = range.getValues();
      range.setNumberFormat("@");
      var changed = false;
      for (var r = 0; r < vals.length; r++) {
        var raw = vals[r][0];
        if (raw === "" || raw === null || raw === undefined) continue;
        var s = String(raw).trim();
        var normalized = normalizePhoneText_(s);
        if (normalized !== s || typeof raw === "number") {
          vals[r][0] = normalized;
          changed = true;
          fixedCells++;
        }
      }
      if (changed) {
        range.setValues(vals);
      }
    }
  }
  return { success: true, fixedCells: fixedCells };
}

function getOrCreateSheet(ss, name) {
  var s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
  }
  return s;
}

/**
 * 9. 個人待辦任務系統 (TODO_T)：單筆新增/更新
 */
function upsertMemberTodo(memberMid, todo) {
  var mid = memberMid || (todo && todo.承辦人) || "";
  var id = (todo && todo.ID) ? todo.ID : ("TDT-" + new Date().getTime().toString().slice(-6));
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cfg = SHEET_CONFIG['TODO_T'];
  var sheet = getOrCreateSheet(ss, cfg.sheet);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, cfg.headers.length).setValues([cfg.headers]);
  }

  // 檢查 TODO 模組續約權限：若為全新任務且該 AI 軟體未續約 / 已到期，拒絕新增（僅可檢視舊資料）
  var existingCheck = false;
  if (sheet.getLastRow() >= 2) {
    var idsCol = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (var x = 0; x < idsCol.length; x++) {
      if (idsCol[x][0] === id) {
        existingCheck = true;
        break;
      }
    }
  }
  if (!existingCheck && mid) {
    var perm = checkMemberModuleWritePermission_(mid, "TODO");
    if (!perm.canCreate) {
      return {
        success: false,
        readOnly: true,
        error: perm.reason || "該 AI 軟體尚未續約，目前僅能查看舊資料，不可新增資料。"
      };
    }
  }

  var nowStr = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd HH:mm:ss");
  var rowValues = [
    id,
    (todo && todo.狀態) || "待處理",
    (todo && todo.事項標題) || "",
    (todo && todo.專案名稱) || "個人代辦任務",
    (todo && todo.優先級) || "中",
    (todo && todo.截止日期) || "",
    (todo && todo.提醒時間) || "",
    (todo && todo.承辦人) || mid,
    (todo && todo.結束時間) || "",
    (todo && todo.詳細說明) || "",
    mid,
    nowStr
  ];

  var lastRow = sheet.getLastRow();
  var updatedRow = -1;
  if (lastRow >= 2) {
    var data = sheet.getRange(2, 1, lastRow - 1, cfg.headers.length).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === id && (!mid || data[i][10] === mid)) {
        updatedRow = i + 2;
        break;
      }
    }
  }

  if (updatedRow > 0) {
    sheet.getRange(updatedRow, 1, 1, cfg.headers.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  tryDualWriteTodoToMysql_({
    ID: id,
    狀態: rowValues[1],
    事項標題: rowValues[2],
    專案名稱: rowValues[3],
    優先級: rowValues[4],
    截止日期: rowValues[5],
    提醒時間: rowValues[6],
    承辦人: rowValues[7],
    結束時間: rowValues[8],
    詳細說明: rowValues[9],
    memberMid: mid,
    updatedAt: nowStr
  });
  invalidateHotCacheKeys(["TODOS:" + mid, "SYS_STATS"]);

  return {
    success: true,
    action: "upsertTodo",
    memberMid: mid,
    todoId: id,
    syncedAt: nowStr,
    message: "已同步待辦事項至 Google Sheets (" + cfg.sheet + ")"
  };
}

/**
 * 10. 個人待辦任務系統 (TODO_T)：刪除單筆任務
 */
function deleteMemberTodo(memberMid, todoId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cfg = SHEET_CONFIG['TODO_T'];
  var sheet = ss.getSheetByName(cfg.sheet);
  if (!sheet || sheet.getLastRow() < 2) {
    return { success: true, deleted: false, message: "工作表無待刪除資料" };
  }

  var lastRow = sheet.getLastRow();
  var data = sheet.getRange(2, 1, lastRow - 1, cfg.headers.length).getValues();
  for (var i = data.length - 1; i >= 0; i--) {
    if (data[i][0] === todoId && (!memberMid || data[i][10] === memberMid)) {
      sheet.deleteRow(i + 2);
      invalidateHotCacheKeys(["TODOS:" + memberMid]);
      return {
        success: true,
        action: "deleteTodo",
        memberMid: memberMid,
        todoId: todoId,
        deleted: true,
        message: "已從 Google Sheets 移除待辦任務 " + todoId
      };
    }
  }
  return { success: true, deleted: false, todoId: todoId, message: "查無指定任務或非該會員所屬" };
}

/**
 * 11. 個人待辦任務系統 (TODO_T)：整批覆寫同步會員所有待辦事項
 */
function syncMemberTodos(memberMid, todos) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cfg = SHEET_CONFIG['TODO_T'];
  var sheet = getOrCreateSheet(ss, cfg.sheet);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, cfg.headers.length).setValues([cfg.headers]);
  }

  var nowStr = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd HH:mm:ss");
  var lastRow = sheet.getLastRow();
  var preservedRows = [];
  if (lastRow >= 2) {
    var existing = sheet.getRange(2, 1, lastRow - 1, cfg.headers.length).getValues();
    for (var i = 0; i < existing.length; i++) {
      if (existing[i][10] !== memberMid) {
        preservedRows.push(existing[i]);
      }
    }
  }

  var incomingRows = (todos || []).map(function(t) {
    return [
      t.ID || "",
      t.狀態 || "待處理",
      t.事項標題 || "",
      t.專案名稱 || "個人代辦任務",
      t.優先級 || "中",
      t.截止日期 || "",
      t.提醒時間 || "",
      t.承辦人 || memberMid,
      t.結束時間 || "",
      t.詳細說明 || "",
      memberMid,
      nowStr
    ];
  });

  var allRows = preservedRows.concat(incomingRows);
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, cfg.headers.length).clearContent();
  }
  if (allRows.length > 0) {
    sheet.getRange(2, 1, allRows.length, cfg.headers.length).setValues(allRows);
  }
  invalidateHotCacheKeys(["TODOS:" + memberMid]);

  return {
    success: true,
    action: "syncTodos",
    memberMid: memberMid,
    syncedCount: incomingRows.length,
    syncedAt: nowStr,
    message: "已完成 " + incomingRows.length + " 筆個人待辦任務全量同步！"
  };
}

/**
 * 12. 個人待辦任務系統 (TODO_T)：讀取指定會員所有待辦事項
 */
function getMemberTodos(memberMid) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cfg = SHEET_CONFIG['TODO_T'];
  var sheet = ss.getSheetByName(cfg.sheet);
  if (!sheet || sheet.getLastRow() < 2) {
    return { success: true, memberMid: memberMid, todos: [] };
  }

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, cfg.headers.length).getValues();
  var todos = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (!memberMid || row[10] === memberMid) {
      var dueVal = row[5] instanceof Date ? Utilities.formatDate(row[5], "Asia/Taipei", "yyyy-MM-dd") : String(row[5] || "");
      var timeVal = row[6] instanceof Date ? Utilities.formatDate(row[6], "Asia/Taipei", "HH:mm") : String(row[6] || "");
      todos.push({
        ID: row[0],
        狀態: row[1],
        事項標題: row[2],
        專案名稱: row[3],
        優先級: row[4],
        截止日期: dueVal,
        提醒時間: timeVal,
        承辦人: row[7],
        結束時間: row[8],
        詳細說明: row[9],
        更新時間: row[11]
      });
    }
  }
  return { success: true, memberMid: memberMid, count: todos.length, todos: todos };
}

/**
 * ============================================================================
 * 13. GAS + MySQL JDBC 擴容預置與一鍵遷移模組
 * 安全規範：帳號密碼皆透過 PropertiesService.getScriptProperties() 讀取，
 * 預設未啟用時僅執行 Google Sheets，待會員數量達門檻後一鍵啟用雙寫與遷移。
 * ============================================================================
 */
function getMysqlBridgeConfig_() {
  var props = PropertiesService.getScriptProperties();
  return {
    enabled: props.getProperty("MYSQL_ENABLED") === "true",
    mode: props.getProperty("MYSQL_MODE") || "STANDBY_SHEETS_ONLY",
    host: props.getProperty("MYSQL_HOST") || "",
    port: props.getProperty("MYSQL_PORT") || "3306",
    database: props.getProperty("MYSQL_DB") || "ais_saas_erp",
    user: props.getProperty("MYSQL_USER") || "",
    password: props.getProperty("MYSQL_PASSWORD") || "",
    useSsl: props.getProperty("MYSQL_USE_SSL") !== "false",
    memberThreshold: parseInt(props.getProperty("MYSQL_MEMBER_THRESHOLD") || "1000", 10)
  };
}

function getMysqlConnection_(overrideCfg) {
  var cfg = getMysqlBridgeConfig_();
  var host = (overrideCfg && overrideCfg.host) || cfg.host;
  var port = (overrideCfg && overrideCfg.port) || cfg.port || "3306";
  var db = (overrideCfg && overrideCfg.database) || cfg.database;
  var user = (overrideCfg && overrideCfg.user) || cfg.user;
  var password = cfg.password;
  var useSsl = (overrideCfg && typeof overrideCfg.useSsl === "boolean") ? overrideCfg.useSsl : cfg.useSsl;

  if (!host || !db || !user || !password) {
    throw new Error("尚未於 Apps Script ScriptProperties 設定完整 MYSQL_HOST/MYSQL_DB/MYSQL_USER/MYSQL_PASSWORD");
  }

  var jdbcUrl = "jdbc:mysql://" + host + ":" + port + "/" + db +
    "?useUnicode=true&characterEncoding=utf8mb4&useSSL=" + (useSsl ? "true" : "false");
  return Jdbc.getConnection(jdbcUrl, user, password);
}

function testMysqlConnection(requestData) {
  var conn = null;
  try {
    conn = getMysqlConnection_(requestData);
    var stmt = conn.createStatement();
    var rs = stmt.executeQuery("SELECT VERSION() AS mysql_ver, NOW() AS server_time");
    var ver = "";
    if (rs.next()) {
      ver = rs.getString("mysql_ver");
    }
    rs.close();
    stmt.close();
    return {
      success: true,
      action: "testMysqlConnection",
      mysqlVersion: ver,
      message: "GAS JDBC 成功連線至 MySQL (" + ver + ")"
    };
  } finally {
    if (conn) conn.close();
  }
}

function initMysqlTables(overrideCfg) {
  var conn = null;
  try {
    conn = getMysqlConnection_(overrideCfg);
    var stmt = conn.createStatement();
    var ddls = [
      "CREATE TABLE IF NOT EXISTS erp_members (mid VARCHAR(32) PRIMARY KEY, name VARCHAR(120) NOT NULL, phone VARCHAR(40), id_number_masked VARCHAR(32), sponsor_mid VARCHAR(32), store_id VARCHAR(40), center_id VARCHAR(40), registered_at VARCHAR(40), trial_expires_at VARCHAR(40), accumulated_rent DECIMAL(10,2) DEFAULT 0, monoline_node_id VARCHAR(32), binary_node_id VARCHAR(32)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
      "CREATE TABLE IF NOT EXISTS erp_monoline_nodes (node_id VARCHAR(32) PRIMARY KEY, mid VARCHAR(32) NOT NULL, node_name VARCHAR(160), parent_id VARCHAR(32), depth_seq INT DEFAULT 0, sponsor_mid VARCHAR(32), status VARCHAR(32), hq_permanent_locked TINYINT(1) DEFAULT 0, trial_expires_at VARCHAR(40), total_earnings DECIMAL(12,2) DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
      "CREATE TABLE IF NOT EXISTS erp_binary_nodes (node_id VARCHAR(32) PRIMARY KEY, mid VARCHAR(32) NOT NULL, node_name VARCHAR(160), parent_id VARCHAR(32), placement_position VARCHAR(8), depth_level INT DEFAULT 0, left_child_id VARCHAR(32), right_child_id VARCHAR(32), sponsor_mid VARCHAR(32), status VARCHAR(32), hq_permanent_locked TINYINT(1) DEFAULT 0, trial_expires_at VARCHAR(40), total_earnings DECIMAL(12,2) DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
      "CREATE TABLE IF NOT EXISTS erp_settlements (txn_id VARCHAR(64) PRIMARY KEY, node_id VARCHAR(32), mid VARCHAR(32), amount_ntd DECIMAL(10,2), sponsor_points DECIMAL(10,2), placement_points DECIMAL(10,2), store_points DECIMAL(10,2), center_points DECIMAL(10,2), abany_tech_points DECIMAL(10,2), hq_ops_points DECIMAL(10,2), public_safety_points DECIMAL(10,2), total_distributed DECIMAL(10,2), settled_at VARCHAR(40)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
      "CREATE TABLE IF NOT EXISTS erp_todos_t (id VARCHAR(32), member_mid VARCHAR(32), status VARCHAR(24), title VARCHAR(255), project_name VARCHAR(120), priority VARCHAR(24), due_date VARCHAR(20), reminder_time VARCHAR(16), assignee VARCHAR(64), finished_at VARCHAR(40), detail TEXT, updated_at VARCHAR(40), PRIMARY KEY (id, member_mid)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
      "CREATE TABLE IF NOT EXISTS erp_query_cache_index (cache_key VARCHAR(128) PRIMARY KEY, entity_type VARCHAR(32) NOT NULL, lookup_token VARCHAR(128) NOT NULL, primary_mid VARCHAR(32), sheet_name VARCHAR(64), sheet_row_index INT DEFAULT 0, hit_count INT DEFAULT 1, payload_json MEDIUMTEXT, expires_at DATETIME NOT NULL, INDEX idx_cache_token (lookup_token), INDEX idx_cache_expires (expires_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    ];
    for (var i = 0; i < ddls.length; i++) {
      stmt.executeUpdate(ddls[i]);
    }
    stmt.close();
    return { success: true, action: "initMysqlTables", tablesCreated: ddls.length, message: "已完成 MySQL 六大核心與同步緩存索引資料表檢查與建立" };
  } finally {
    if (conn) conn.close();
  }
}

/**
 * 一鍵連接並將 Google Sheets / 前端快照全量遷移至 MySQL，並開啟即時雙寫模式
 */
function migrateAllToMysql(requestData) {
  var cfgInput = (requestData && requestData.config) || {};
  var snapshot = (requestData && requestData.snapshot) || {};
  var props = PropertiesService.getScriptProperties();

  if (cfgInput.host) props.setProperty("MYSQL_HOST", cfgInput.host);
  if (cfgInput.port) props.setProperty("MYSQL_PORT", String(cfgInput.port));
  if (cfgInput.database) props.setProperty("MYSQL_DB", cfgInput.database);
  if (cfgInput.user) props.setProperty("MYSQL_USER", cfgInput.user);
  props.setProperty("MYSQL_ENABLED", "true");
  props.setProperty("MYSQL_MODE", (requestData && requestData.mode) || "DUAL_WRITE_MYSQL");

  initMysqlTables(cfgInput);
  var conn = null;
  var counts = { members: 0, settlements: 0, todos: 0 };
  try {
    conn = getMysqlConnection_(cfgInput);
    conn.setAutoCommit(false);

    var members = snapshot.members || [];
    if (members.length > 0) {
      var psM = conn.prepareStatement(
        "INSERT INTO erp_members (mid, name, phone, id_number_masked, sponsor_mid, store_id, center_id, registered_at, trial_expires_at, accumulated_rent, monoline_node_id, binary_node_id) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON DUPLICATE KEY UPDATE name=VALUES(name), phone=VALUES(phone), monoline_node_id=VALUES(monoline_node_id), binary_node_id=VALUES(binary_node_id)"
      );
      for (var i = 0; i < members.length; i++) {
        var m = members[i];
        psM.setString(1, String(m.mid || ""));
        psM.setString(2, String(m.name || ""));
        psM.setString(3, String(m.phone || ""));
        psM.setString(4, String(m.idNumberMasked || ""));
        psM.setString(5, String(m.sponsorMid || ""));
        psM.setString(6, String(m.storeId || ""));
        psM.setString(7, String(m.centerId || ""));
        psM.setString(8, String(m.registeredAt || ""));
        psM.setString(9, String(m.trialExpiresAt || ""));
        psM.setDouble(10, Number(m.accumulatedRentAmount || 0));
        psM.setString(11, String(m.monolineNodeId || ""));
        psM.setString(12, String(m.binaryNodeId || ""));
        psM.addBatch();
        counts.members++;
      }
      psM.executeBatch();
      psM.close();
    }

    conn.commit();
    return {
      success: true,
      action: "migrateAllToMysql",
      mode: props.getProperty("MYSQL_MODE"),
      migrated: counts,
      message: "已一鍵啟用 GAS + MySQL 雙寫並遷移 " + counts.members + " 位會員資料！"
    };
  } catch (err) {
    if (conn) conn.rollback();
    throw err;
  } finally {
    if (conn) conn.close();
  }
}

/**
 * 一鍵分批防逾時遷移 (建議每批 500 筆，5,000~10,000 人可無痛安全遷移至 MySQL)
 */
function migrateBatchToMysql(requestData) {
  var cfgInput = (requestData && requestData.config) || {};
  var batchIndex = Number((requestData && requestData.batchIndex) || 0);
  var totalBatches = Number((requestData && requestData.totalBatches) || 1);
  var isFinalBatch = Boolean(requestData && requestData.isFinalBatch);
  var entityType = (requestData && requestData.entityType) || "members";
  var rows = (requestData && requestData.rows) || [];
  var props = PropertiesService.getScriptProperties();

  if (batchIndex === 0) {
    if (cfgInput.host) props.setProperty("MYSQL_HOST", cfgInput.host);
    if (cfgInput.port) props.setProperty("MYSQL_PORT", String(cfgInput.port));
    if (cfgInput.database) props.setProperty("MYSQL_DB", cfgInput.database);
    if (cfgInput.user) props.setProperty("MYSQL_USER", cfgInput.user);
    props.setProperty("MYSQL_MODE", (requestData && requestData.mode) || "DUAL_WRITE_MYSQL");
    initMysqlTables(cfgInput);
  }

  var conn = null;
  var processed = 0;
  try {
    if (rows.length > 0) {
      conn = getMysqlConnection_(cfgInput);
      conn.setAutoCommit(false);

      if (entityType === "members") {
        var psM = conn.prepareStatement(
          "INSERT INTO erp_members (mid, name, phone, id_number_masked, sponsor_mid, store_id, center_id, registered_at, trial_expires_at, accumulated_rent, monoline_node_id, binary_node_id) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
          "ON DUPLICATE KEY UPDATE name=VALUES(name), phone=VALUES(phone), monoline_node_id=VALUES(monoline_node_id), binary_node_id=VALUES(binary_node_id)"
        );
        for (var i = 0; i < rows.length; i++) {
          var m = rows[i];
          psM.setString(1, String(m.mid || ""));
          psM.setString(2, String(m.name || ""));
          psM.setString(3, String(m.phone || ""));
          psM.setString(4, String(m.idNumberMasked || ""));
          psM.setString(5, String(m.sponsorMid || ""));
          psM.setString(6, String(m.storeId || ""));
          psM.setString(7, String(m.centerId || ""));
          psM.setString(8, String(m.registeredAt || ""));
          psM.setString(9, String(m.trialExpiresAt || ""));
          psM.setDouble(10, Number(m.accumulatedRentAmount || 0));
          psM.setString(11, String(m.monolineNodeId || ""));
          psM.setString(12, String(m.binaryNodeId || ""));
          psM.addBatch();
          processed++;
        }
        psM.executeBatch();
        psM.close();
      } else if (entityType === "monolineNodes") {
        var psMono = conn.prepareStatement(
          "INSERT INTO erp_monoline_nodes (node_id, mid, node_name, parent_id, depth_seq, sponsor_mid, status, hq_permanent_locked, trial_expires_at, total_earnings) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status=VALUES(status), total_earnings=VALUES(total_earnings)"
        );
        for (var j = 0; j < rows.length; j++) {
          var n = rows[j];
          psMono.setString(1, String(n.nodeId || ""));
          psMono.setString(2, String(n.mid || ""));
          psMono.setString(3, String(n.name || ""));
          psMono.setString(4, String(n.parentId || ""));
          psMono.setInt(5, Number(n.depth || 0));
          psMono.setString(6, String(n.sponsorMid || ""));
          psMono.setString(7, String(n.status || "TRIAL_ACTIVE"));
          psMono.setInt(8, n.hqPermanentLocked ? 1 : 0);
          psMono.setString(9, String(n.trialExpiresAt || ""));
          psMono.setDouble(10, Number(n.totalEarnings || 0));
          psMono.addBatch();
          processed++;
        }
        psMono.executeBatch();
        psMono.close();
      } else if (entityType === "binaryNodes") {
        var psBi = conn.prepareStatement(
          "INSERT INTO erp_binary_nodes (node_id, mid, node_name, parent_id, placement_position, depth_level, left_child_id, right_child_id, sponsor_mid, status, hq_permanent_locked, trial_expires_at, total_earnings) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE left_child_id=VALUES(left_child_id), right_child_id=VALUES(right_child_id), status=VALUES(status), total_earnings=VALUES(total_earnings)"
        );
        for (var k = 0; k < rows.length; k++) {
          var b = rows[k];
          psBi.setString(1, String(b.nodeId || ""));
          psBi.setString(2, String(b.mid || ""));
          psBi.setString(3, String(b.name || ""));
          psBi.setString(4, String(b.parentId || ""));
          psBi.setString(5, String(b.placementPosition || "L"));
          psBi.setInt(6, Number(b.depth || 0));
          psBi.setString(7, String(b.leftChildId || ""));
          psBi.setString(8, String(b.rightChildId || ""));
          psBi.setString(9, String(b.sponsorMid || ""));
          psBi.setString(10, String(b.status || "TRIAL_ACTIVE"));
          psBi.setInt(11, b.hqPermanentLocked ? 1 : 0);
          psBi.setString(12, String(b.trialExpiresAt || ""));
          psBi.setDouble(13, Number(b.totalEarnings || 0));
          psBi.addBatch();
          processed++;
        }
        psBi.executeBatch();
        psBi.close();
      } else if (entityType === "settlements") {
        var psS = conn.prepareStatement(
          "INSERT INTO erp_settlements (txn_id, node_id, mid, amount_ntd, sponsor_points, placement_points, store_points, center_points, abany_tech_points, hq_ops_points, public_safety_points, total_distributed, settled_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE total_distributed=VALUES(total_distributed)"
        );
        for (var sIdx = 0; sIdx < rows.length; sIdx++) {
          var s = rows[sIdx];
          psS.setString(1, String(s.transactionId || ""));
          psS.setString(2, String(s.payingNodeId || ""));
          psS.setString(3, String(s.payingMid || ""));
          psS.setDouble(4, Number(s.amountNtd || 100));
          psS.setDouble(5, Number(s.totalSponsorPoints || 15));
          psS.setDouble(6, Number(s.totalPlacementPoints || 15));
          psS.setDouble(7, Number(s.totalStorePoints || 6));
          psS.setDouble(8, Number(s.totalCenterPoints || 6));
          psS.setDouble(9, Number(s.abanyTechPoolPoints || 30));
          psS.setDouble(10, Number(s.hqOperationsPoolPoints || 28));
          psS.setDouble(11, Number(s.publicSafetyPoolPoints || 0));
          psS.setDouble(12, Number(s.totalDistributed || 100));
          psS.setString(13, String(s.timestamp || ""));
          psS.addBatch();
          processed++;
        }
        psS.executeBatch();
        psS.close();
      } else if (entityType === "todos") {
        var psT = conn.prepareStatement(
          "INSERT INTO erp_todos_t (id, member_mid, status, title, project_name, priority, due_date, reminder_time, assignee, finished_at, detail, updated_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status=VALUES(status), title=VALUES(title), updated_at=VALUES(updated_at)"
        );
        for (var tIdx = 0; tIdx < rows.length; tIdx++) {
          var t = rows[tIdx];
          psT.setString(1, String(t.ID || ""));
          psT.setString(2, String(t.memberMid || ""));
          psT.setString(3, String(t.狀態 || "待處理"));
          psT.setString(4, String(t.事項標題 || ""));
          psT.setString(5, String(t.專案名稱 || ""));
          psT.setString(6, String(t.優先級 || "中"));
          psT.setString(7, String(t.截止日期 || ""));
          psT.setString(8, String(t.提醒時間 || ""));
          psT.setString(9, String(t.承辦人 || ""));
          psT.setString(10, String(t.結束時間 || ""));
          psT.setString(11, String(t.詳細說明 || ""));
          psT.setString(12, String(t.更新時間 || ""));
          psT.addBatch();
          processed++;
        }
        psT.executeBatch();
        psT.close();
      }

      conn.commit();
    }

    if (isFinalBatch) {
      props.setProperty("MYSQL_ENABLED", "true");
    }

    return {
      success: true,
      action: "migrateBatchToMysql",
      entityType: entityType,
      batchIndex: batchIndex,
      totalBatches: totalBatches,
      processed: processed,
      isFinalBatch: isFinalBatch,
      message: "批次 " + (batchIndex + 1) + "/" + totalBatches + " (" + entityType + ") 已寫入 " + processed + " 筆"
    };
  } catch (err) {
    if (conn) conn.rollback();
    throw err;
  } finally {
    if (conn) conn.close();
  }
}

function tryDualWriteMemberToMysql_(m) {
  try {
    var cfg = getMysqlBridgeConfig_();
    if (!cfg.enabled) return;
    var conn = getMysqlConnection_();
    var ps = conn.prepareStatement(
      "INSERT INTO erp_members (mid, name, phone, id_number_masked, sponsor_mid, store_id, center_id, registered_at, trial_expires_at, accumulated_rent, monoline_node_id, binary_node_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)"
    );
    ps.setString(1, m.mid);
    ps.setString(2, m.name);
    ps.setString(3, m.phone);
    ps.setString(4, m.idNumberMasked);
    ps.setString(5, m.sponsorMid);
    ps.setString(6, m.storeId);
    ps.setString(7, m.centerId);
    ps.setString(8, String(m.registeredAt));
    ps.setString(9, String(m.trialExpiresAt));
    ps.setString(10, m.monolineNodeId);
    ps.setString(11, m.binaryNodeId);
    ps.executeUpdate();
    ps.close();
    conn.close();
  } catch (e) {
    Logger.log("MySQL Dual-Write Member Warning: " + e.toString());
  }
}

function tryDualWriteSettlementToMysql_(s) {
  try {
    var cfg = getMysqlBridgeConfig_();
    if (!cfg.enabled) return;
    var conn = getMysqlConnection_();
    var ps = conn.prepareStatement(
      "INSERT INTO erp_settlements (txn_id, node_id, mid, amount_ntd, sponsor_points, placement_points, store_points, center_points, abany_tech_points, hq_ops_points, public_safety_points, total_distributed, settled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    ps.setString(1, s.txnId);
    ps.setString(2, s.nodeId);
    ps.setString(3, s.mid);
    ps.setDouble(4, Number(s.amount));
    ps.setDouble(5, Number(s.sponsor));
    ps.setDouble(6, Number(s.placement));
    ps.setDouble(7, Number(s.store));
    ps.setDouble(8, Number(s.center));
    ps.setDouble(9, Number(s.abanyTech));
    ps.setDouble(10, Number(s.hqOps));
    ps.setDouble(11, Number(s.publicSafety));
    ps.setDouble(12, Number(s.totalCheck));
    ps.setString(13, String(s.settledAt));
    ps.executeUpdate();
    ps.close();
    conn.close();
  } catch (e) {
    Logger.log("MySQL Dual-Write Settlement Warning: " + e.toString());
  }
}

function tryDualWriteTodoToMysql_(t) {
  try {
    var cfg = getMysqlBridgeConfig_();
    if (!cfg.enabled) return;
    var conn = getMysqlConnection_();
    var ps = conn.prepareStatement(
      "INSERT INTO erp_todos_t (id, member_mid, status, title, project_name, priority, due_date, reminder_time, assignee, finished_at, detail, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status=VALUES(status), title=VALUES(title), updated_at=VALUES(updated_at)"
    );
    ps.setString(1, String(t.ID || ""));
    ps.setString(2, String(t.memberMid || ""));
    ps.setString(3, String(t.狀態 || "待處理"));
    ps.setString(4, String(t.事項標題 || ""));
    ps.setString(5, String(t.專案名稱 || ""));
    ps.setString(6, String(t.優先級 || "中"));
    ps.setString(7, String(t.截止日期 || ""));
    ps.setString(8, String(t.提醒時間 || ""));
    ps.setString(9, String(t.承辦人 || ""));
    ps.setString(10, String(t.結束時間 || ""));
    ps.setString(11, String(t.詳細說明 || ""));
    ps.setString(12, String(t.updatedAt || ""));
    ps.executeUpdate();
    ps.close();
    conn.close();
  } catch (e) {
    Logger.log("MySQL Dual-Write Todo Warning: " + e.toString());
  }
}

/**
 * ============================================================================
 * 14. 每位會員自動生成獨立雲端資料夾、Google 試算表 & 未續約唯讀(禁新增)防衛
 * ============================================================================
 */
function getOrCreateRootVaultFolder_() {
  var folders = DriveApp.getFoldersByName(GLOBAL_CONFIG.ROOT_DRIVE_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(GLOBAL_CONFIG.ROOT_DRIVE_FOLDER_NAME);
}

function provisionMemberCloudWorkspace(memberMid, memberName, customTabs) {
  var ssMain = SpreadsheetApp.getActiveSpreadsheet();
  var vaultIndexSheet = getOrCreateSheet(ssMain, GLOBAL_CONFIG.SHEET_CLOUD_VAULT);
  if (vaultIndexSheet.getLastRow() === 0) {
    vaultIndexSheet.appendRow([
      "會員MID", "會員姓名", "專屬雲端資料夾ID", "資料夾名稱", "資料夾連結",
      "專屬Google試算表ID", "試算表名稱", "試算表連結", "建立時間", "最後同步時間"
    ]);
    vaultIndexSheet.getRange(1, 1, 1, 10).setBackground("#0F172A").setFontColor("#FFFFFF").setFontWeight("bold");
  }

  var mid = String(memberMid || GLOBAL_CONFIG.FLAGSHIP_SPONSOR_MID).trim().toUpperCase();
  var mName = memberName || mid;
  var lastRow = vaultIndexSheet.getLastRow();
  if (lastRow >= 2) {
    var existing = vaultIndexSheet.getRange(2, 1, lastRow - 1, 10).getValues();
    for (var i = 0; i < existing.length; i++) {
      if (String(existing[i][0]).toUpperCase() === mid && existing[i][2] && existing[i][5]) {
        // 已存在專屬資料夾與試算表：更新最後同步時間並同步各模組唯讀保護狀態
        var nowSyncTw = formatTaiwanDateTime_(new Date());
        vaultIndexSheet.getRange(i + 2, 10).setValue(nowSyncTw);
        if (customTabs && customTabs.length > 0) {
          syncMemberSpreadsheetTabProtections_(String(existing[i][5]), customTabs);
        }
        return {
          success: true,
          action: "provisionMemberCloudWorkspace",
          memberMid: mid,
          memberName: existing[i][1] || mName,
          folderId: String(existing[i][2]),
          folderName: String(existing[i][3]),
          folderUrl: String(existing[i][4]),
          spreadsheetId: String(existing[i][5]),
          spreadsheetName: String(existing[i][6]),
          spreadsheetUrl: String(existing[i][7]),
          message: "已讀取既有會員獨立雲端資料夾與 Google 試算表"
        };
      }
    }
  }

  // 為此會員自動建立專屬 Google Drive 資料夾 + 獨立 Google 試算表
  var rootFolder = getOrCreateRootVaultFolder_();
  var folderName = "【AIS-ERP 會員雲端】" + mid + " " + mName;
  var memberFolder = rootFolder.createFolder(folderName);

  var sheetTitle = mid + "_" + mName + "_AI軟體專屬試算表";
  var memberSs = SpreadsheetApp.create(sheetTitle);
  var ssFile = DriveApp.getFileById(memberSs.getId());
  ssFile.moveTo(memberFolder);

  // 初始化會員專屬試算表基本分頁 (CM / CT / EM / ET / BOOKING_T / TODO_T)
  var defaultTabs = [
    { name: "CONTACT_M_通訊主檔", headers: SHEET_CONFIG['CONTACT_M'].headers },
    { name: "CONTACT_T_聯繫紀錄", headers: SHEET_CONFIG['CONTACT_T'].headers },
    { name: "EVENT_M_活動主檔", headers: SHEET_CONFIG['EVENT_M'].headers },
    { name: "EVENT_T_活動花絮", headers: SHEET_CONFIG['EVENT_T'].headers },
    { name: "TODO_T_代辦事項明細", headers: SHEET_CONFIG['TODO_T'].headers }
  ];
  var firstSheet = memberSs.getSheets()[0];
  firstSheet.setName(defaultTabs[0].name);
  firstSheet.getRange(1, 1, 1, defaultTabs[0].headers.length).setValues([defaultTabs[0].headers]);
  for (var t = 1; t < defaultTabs.length; t++) {
    var sh = memberSs.insertSheet(defaultTabs[t].name);
    sh.getRange(1, 1, 1, defaultTabs[t].headers.length).setValues([defaultTabs[t].headers]);
  }
  if (customTabs && customTabs.length > 0) {
    syncMemberSpreadsheetTabProtections_(memberSs.getId(), customTabs);
  }

  var nowTw = formatTaiwanDateTime_(new Date());
  var folderId = memberFolder.getId();
  var folderUrl = memberFolder.getUrl();
  var spreadsheetId = memberSs.getId();
  var spreadsheetUrl = memberSs.getUrl();

  vaultIndexSheet.appendRow([
    mid, mName, folderId, folderName, folderUrl,
    spreadsheetId, sheetTitle, spreadsheetUrl, nowTw, nowTw
  ]);

  return {
    success: true,
    action: "provisionMemberCloudWorkspace",
    memberMid: mid,
    memberName: mName,
    folderId: folderId,
    folderName: folderName,
    folderUrl: folderUrl,
    spreadsheetId: spreadsheetId,
    spreadsheetName: sheetTitle,
    spreadsheetUrl: spreadsheetUrl,
    message: "已為會員 " + mid + " 自動生成獨立雲端資料夾與專屬 Google 試算表！"
  };
}

function getMemberCloudWorkspace(memberMid) {
  return provisionMemberCloudWorkspace(memberMid, memberMid, null);
}

/**
 * 依據會員各 AI 軟體是否續約：未續約 / 已到期之工作表強制設定保護警示 (僅能查看舊資料，不可新增資料)
 */
function syncMemberSpreadsheetTabProtections_(spreadsheetId, tabs) {
  try {
    var memberSs = SpreadsheetApp.openById(spreadsheetId);
    for (var i = 0; i < tabs.length; i++) {
      var tab = tabs[i];
      var sh = memberSs.getSheetByName(tab.tabName) || memberSs.insertSheet(tab.tabName);
      var protections = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
      if (tab.readOnly) {
        if (protections.length === 0) {
          var p = sh.protect().setDescription("未續約唯讀歸檔鎖定：僅能查看舊資料，不可新增資料");
          p.setWarningOnly(false);
        }
        sh.setTabColor("#E11D48");
      } else {
        for (var j = 0; j < protections.length; j++) {
          protections[j].remove();
        }
        sh.setTabColor("#10B981");
      }
    }
  } catch (e) {
    Logger.log("Tab Protection Sync Warning: " + e.toString());
  }
}

/**
 * 檢查會員 AI 軟體模組授權效期 (未續約 / 已到期 -> 回傳 canCreate: false，只能看舊資料)
 */
function checkMemberModuleWritePermission_(memberMid, moduleKey) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var mid = String(memberMid || "").trim().toUpperCase();
  var baseKey = String(moduleKey || "CONTACT").replace(/_(M|T)$/i, "").toUpperCase();
  var nowMs = new Date().getTime();

  var licenseSheet = ss.getSheetByName(GLOBAL_CONFIG.SHEET_MODULE_LICENSES);
  if (licenseSheet && licenseSheet.getLastRow() >= 2) {
    var rows = licenseSheet.getRange(2, 1, licenseSheet.getLastRow() - 1, 5).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).toUpperCase() === mid && String(rows[i][1]).toUpperCase() === baseKey) {
        var st = String(rows[i][2] || "");
        var expVal = rows[i][3] ? parseTaiwanDate_(rows[i][3]).getTime() : 0;
        if (st === "EXPIRED_FROZEN" || st === "NOT_ORDERED" || (expVal > 0 && expVal <= nowMs)) {
          return {
            canView: true,
            canCreate: false,
            reason: "【" + baseKey + "】AI 軟體未續約（已到期），目前僅能查看舊資料，不能新增資料。"
          };
        }
        return { canView: true, canCreate: true };
      }
    }
  }

  // 若無個別授權列且屬於 1+1 核心模組，檢查會員主檔 30 天體驗效期
  if (baseKey === "CONTACT" || baseKey === "EVENT") {
    var sheetMembers = ss.getSheetByName(GLOBAL_CONFIG.SHEET_MEMBERS);
    if (sheetMembers && sheetMembers.getLastRow() >= 2) {
      var mData = sheetMembers.getRange(2, 1, sheetMembers.getLastRow() - 1, 9).getValues();
      for (var m = 0; m < mData.length; m++) {
        if (String(mData[m][0]).toUpperCase() === mid) {
          var memExp = mData[m][8] ? parseTaiwanDate_(mData[m][8]).getTime() : 0;
          if (memExp > 0 && memExp <= nowMs) {
            return {
              canView: true,
              canCreate: false,
              reason: "會員 1+1 AI 軟體尚未續約（體驗已到期），僅能查看歷史舊資料，不可新增資料。"
            };
          }
          break;
        }
      }
    }
  }
  return { canView: true, canCreate: true };
}

/**
 * 帶權限防衛的動態紀錄寫入：寫入會員專屬 Google 試算表前先檢查續約狀態
 */
function appendMemberModuleRecordGuarded(memberMid, moduleKey, sysType, record) {
  var perm = checkMemberModuleWritePermission_(memberMid, moduleKey);
  if (!perm.canCreate) {
    return {
      success: false,
      readOnly: true,
      error: perm.reason || "該 AI 軟體未續約，僅能查看舊資料，不可新增資料。"
    };
  }
  var vault = provisionMemberCloudWorkspace(memberMid, memberMid, null);
  var memberSs = SpreadsheetApp.openById(vault.spreadsheetId);
  var cfg = SHEET_CONFIG[sysType];
  var tabName = cfg ? (sysType + "_" + cfg.sheet) : sysType;
  var sheet = getOrCreateSheet(memberSs, tabName);
  var headers = cfg ? cfg.headers : Object.keys(record || {});
  if (sheet.getLastRow() === 0 && headers.length > 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  var row = headers.map(function(h) { return (record && record[h]) ? record[h] : ""; });
  sheet.appendRow(row);
  return {
    success: true,
    readOnly: false,
    spreadsheetId: vault.spreadsheetId,
    tabName: tabName,
    message: "已將新資料寫入會員專屬 Google 試算表分頁 (" + tabName + ")"
  };
}

/**
 * ============================================================================
 * 15. MySQL 同步緩存器與高頻查詢臨時索引引擎
 * (L1 ScriptCache 熱點緩存 + L2 _SYS_熱點查詢臨時索引 O(1) 列定位 + MySQL 雙寫同步)
 * 解決大規模 Google Sheets 在 5,000~10,000+ 列時重複全表 getValues() 掃描延遲問題
 * ============================================================================
 */
function getHotCache_(cacheKey) {
  try {
    var cache = CacheService.getScriptCache();
    var metaRaw = cache.get(cacheKey);
    if (!metaRaw) return null;
    if (metaRaw.indexOf("__CHUNKED__:") === 0) {
      var total = parseInt(metaRaw.replace("__CHUNKED__:", ""), 10);
      var parts = [];
      for (var i = 0; i < total; i++) {
        var part = cache.get(cacheKey + "__P" + i);
        if (!part) return null;
        parts.push(part);
      }
      return JSON.parse(parts.join(""));
    }
    return JSON.parse(metaRaw);
  } catch (e) {
    return null;
  }
}

function setHotCache_(cacheKey, valueObj, ttlSec) {
  try {
    var cache = CacheService.getScriptCache();
    var ttl = Math.max(30, Math.min(21600, Number(ttlSec) || GLOBAL_CONFIG.CACHE_DEFAULT_TTL_SEC));
    var serialized = JSON.stringify(valueObj);
    // GAS CacheService 單鍵上限 100KB，超過自動分片寫入
    if (serialized.length <= 90000) {
      cache.put(cacheKey, serialized, ttl);
    } else {
      var chunkSize = 85000;
      var chunks = Math.ceil(serialized.length / chunkSize);
      for (var i = 0; i < chunks; i++) {
        cache.put(cacheKey + "__P" + i, serialized.substr(i * chunkSize, chunkSize), ttl);
      }
      cache.put(cacheKey, "__CHUNKED__:" + chunks, ttl);
    }
  } catch (e) {
    Logger.log("setHotCache_ Warning: " + e.toString());
  }
}

function invalidateHotCacheKeys(keys) {
  var list = keys || [];
  try {
    if (list.length > 0) {
      CacheService.getScriptCache().removeAll(list);
    }
    var props = PropertiesService.getScriptProperties();
    var curCount = parseInt(props.getProperty("CACHE_INVALIDATIONS") || "0", 10);
    props.setProperty("CACHE_INVALIDATIONS", String(curCount + list.length));
  } catch (e) {
    Logger.log("invalidateHotCacheKeys Warning: " + e.toString());
  }
  return { success: true, action: "invalidateHotCache", invalidatedKeys: list };
}

function upsertTempIndexRecord_(cacheKey, entityType, lookupToken, primaryMid, sheetName, rowIndex, payloadObj) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var idxSheet = getOrCreateSheet(ss, GLOBAL_CONFIG.SHEET_CACHE_INDEX);
    if (idxSheet.getLastRow() === 0) {
      idxSheet.appendRow([
        "索引鍵(cacheKey)", "實體類型", "標準化查詢詞", "主會員MID",
        "來源工作表", "精準列號(rowIndex)", "命中次數", "JSON快取負載", "TTL過期時間", "MySQL同步時間"
      ]);
      if (idxSheet.hideSheet) idxSheet.hideSheet();
    }
    var now = new Date();
    var exp = new Date(now.getTime() + GLOBAL_CONFIG.CACHE_DEFAULT_TTL_SEC * 1000);
    var expTw = formatTaiwanDateTime_(exp);
    var tokenUpper = String(lookupToken || "").trim().toUpperCase();
    var payloadStr = JSON.stringify(payloadObj || {});
    idxSheet.appendRow([cacheKey, entityType, tokenUpper, primaryMid, sheetName, rowIndex, 1, payloadStr, expTw, ""]);
    setHotCache_(cacheKey, {
      sheetName: sheetName, rowIndex: rowIndex, primaryMid: primaryMid, payload: payloadObj, expiresAt: expTw
    }, GLOBAL_CONFIG.CACHE_DEFAULT_TTL_SEC);
  } catch (e) {
    Logger.log("upsertTempIndexRecord_ Warning: " + e.toString());
  }
}

function rebuildHotQueryTempIndex(requestData) {
  var startMs = new Date().getTime();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ttlSec = Math.max(60, Math.min(3600, Number((requestData && requestData.ttlSeconds) || GLOBAL_CONFIG.CACHE_DEFAULT_TTL_SEC)));
  var now = new Date();
  var exp = new Date(now.getTime() + ttlSec * 1000);

  var idxSheet = getOrCreateSheet(ss, GLOBAL_CONFIG.SHEET_CACHE_INDEX);
  idxSheet.clearContents();
  idxSheet.appendRow([
    "索引鍵(cacheKey)", "實體類型", "標準化查詢詞", "主會員MID",
    "來源工作表", "精準列號(rowIndex)", "命中次數", "JSON快取負載", "TTL過期時間", "MySQL同步時間"
  ]);
  idxSheet.getRange(1, 1, 1, 10).setBackground("#0F172A").setFontColor("#FFFFFF").setFontWeight("bold");

  var rowsToWrite = [];
  var cacheBatch = {};

  // 1. 掃描會員主檔建立 O(1) 臨時索引
  var sMembers = ss.getSheetByName(GLOBAL_CONFIG.SHEET_MEMBERS);
  if (sMembers && sMembers.getLastRow() >= 2) {
    var mVals = sMembers.getRange(2, 1, sMembers.getLastRow() - 1, 12).getValues();
    for (var i = 0; i < mVals.length; i++) {
      var mid = String(mVals[i][0] || "").trim().toUpperCase();
      if (!mid) continue;
      var cKey = "IDX:MEMBER:" + mid;
      var payload = {
        mid: mid, name: mVals[i][1], phone: mVals[i][2], sponsorMid: mVals[i][4],
        monolineNodeId: mVals[i][10], binaryNodeId: mVals[i][11], rowIndex: i + 2
      };
      var pJson = JSON.stringify(payload);
      rowsToWrite.push([cKey, "MEMBER", mid, mid, GLOBAL_CONFIG.SHEET_MEMBERS, i + 2, 1, pJson, exp, ""]);
      cacheBatch["Q_MEM:" + mid] = JSON.stringify({ found: true, source: "L1_SCRIPT_CACHE", rowIndex: i + 2, member: payload });
    }
  }

  // 2. 掃描雙軌節點表建立節點 O(1) 索引
  var sBi = ss.getSheetByName(GLOBAL_CONFIG.SHEET_BINARY);
  if (sBi && sBi.getLastRow() >= 2) {
    var bVals = sBi.getRange(2, 1, sBi.getLastRow() - 1, 10).getValues();
    for (var b = 0; b < bVals.length; b++) {
      var nid = String(bVals[b][0] || "").trim().toUpperCase();
      var bMid = String(bVals[b][1] || "").trim().toUpperCase();
      if (!nid) continue;
      var bKey = "IDX:BI_NODE:" + nid;
      var bPayload = {
        nodeId: nid, mid: bMid, name: bVals[b][2], parentId: bVals[b][3],
        position: bVals[b][4], depth: bVals[b][5], leftChildId: bVals[b][6], rightChildId: bVals[b][7], rowIndex: b + 2
      };
      rowsToWrite.push([bKey, "BINARY_NODE", nid, bMid, GLOBAL_CONFIG.SHEET_BINARY, b + 2, 1, JSON.stringify(bPayload), exp, ""]);
      cacheBatch["Q_MEM:" + nid] = JSON.stringify({ found: true, source: "L1_SCRIPT_CACHE", rowIndex: b + 2, node: bPayload });
    }
  }

  // 批次寫入臨時索引工作表（單次 setValues）
  if (rowsToWrite.length > 0) {
    idxSheet.getRange(2, 1, rowsToWrite.length, 10).setValues(rowsToWrite);
  }
  try {
    CacheService.getScriptCache().putAll(cacheBatch, ttlSec);
  } catch (e) {
    Logger.log("putAll Cache Warning: " + e.toString());
  }

  var mysqlSynced = 0;
  if (requestData && requestData.syncToMysql && getMysqlBridgeConfig_().enabled) {
    var syncRes = syncTempIndexCacheWithMysql({ entries: rowsToWrite.slice(0, 500), ttlSeconds: ttlSec, rawMatrix: true });
    mysqlSynced = syncRes.syncedCount || 0;
  }

  var elapsedMs = new Date().getTime() - startMs;
  return {
    success: true,
    action: "rebuildTempIndex",
    indexedCount: rowsToWrite.length,
    mysqlSyncedCount: mysqlSynced,
    ttlSeconds: ttlSec,
    elapsedMs: elapsedMs,
    message: "已重建高頻查詢臨時索引 " + rowsToWrite.length + " 筆並預熱 ScriptCache (耗時 " + elapsedMs + "ms)"
  };
}

function syncTempIndexCacheWithMysql(requestData) {
  var cfg = getMysqlBridgeConfig_();
  var entries = (requestData && requestData.entries) || [];
  var isRawMatrix = Boolean(requestData && requestData.rawMatrix);
  if (!cfg.enabled) {
    return {
      success: true,
      action: "syncCacheWithMysql",
      syncedCount: 0,
      mysqlEnabled: false,
      message: "目前為純 Google Sheets 模式，臨時索引已寫入 L1 ScriptCache 與 " + GLOBAL_CONFIG.SHEET_CACHE_INDEX
    };
  }

  var conn = null;
  var syncedCount = 0;
  try {
    conn = getMysqlConnection_(requestData && requestData.config);
    conn.setAutoCommit(false);
    var ps = conn.prepareStatement(
      "INSERT INTO erp_query_cache_index (cache_key, entity_type, lookup_token, primary_mid, sheet_name, sheet_row_index, hit_count, payload_json, expires_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE lookup_token=VALUES(lookup_token), sheet_row_index=VALUES(sheet_row_index), hit_count=hit_count+1, payload_json=VALUES(payload_json), expires_at=VALUES(expires_at)"
    );
    var defaultExp = Utilities.formatDate(new Date(new Date().getTime() + 300000), "Asia/Taipei", "yyyy-MM-dd HH:mm:ss");
    for (var i = 0; i < entries.length; i++) {
      var item = entries[i];
      if (isRawMatrix) {
        ps.setString(1, String(item[0]));
        ps.setString(2, String(item[1]));
        ps.setString(3, String(item[2]));
        ps.setString(4, String(item[3]));
        ps.setString(5, String(item[4]));
        ps.setInt(6, Number(item[5] || 0));
        ps.setInt(7, Number(item[6] || 1));
        ps.setString(8, String(item[7] || "{}"));
        ps.setString(9, defaultExp);
      } else {
        ps.setString(1, String(item.cacheKey || ""));
        ps.setString(2, String(item.entityType || "MEMBER"));
        ps.setString(3, String(item.lookupToken || ""));
        ps.setString(4, String(item.primaryMid || ""));
        ps.setString(5, String(item.sheetName || ""));
        ps.setInt(6, Number(item.sheetRowIndex || 0));
        ps.setInt(7, Number(item.hitCount || 1));
        ps.setString(8, JSON.stringify(item.payload || {}));
        ps.setString(9, defaultExp);
      }
      ps.addBatch();
      syncedCount++;
    }
    if (syncedCount > 0) ps.executeBatch();
    ps.close();
    conn.commit();
    return {
      success: true,
      action: "syncCacheWithMysql",
      syncedCount: syncedCount,
      mysqlEnabled: true,
      message: "已將 " + syncedCount + " 筆高頻臨時索引同步至 MySQL (erp_query_cache_index)"
    };
  } finally {
    if (conn) conn.close();
  }
}

function getCacheSyncStats() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var idxSheet = ss.getSheetByName(GLOBAL_CONFIG.SHEET_CACHE_INDEX);
  var props = PropertiesService.getScriptProperties();
  var mysqlCfg = getMysqlBridgeConfig_();
  return {
    success: true,
    action: "getCacheStats",
    tempIndexRows: idxSheet ? Math.max(0, idxSheet.getLastRow() - 1) : 0,
    cacheHits: parseInt(props.getProperty("CACHE_HITS") || "0", 10),
    cacheMisses: parseInt(props.getProperty("CACHE_MISSES") || "0", 10),
    invalidations: parseInt(props.getProperty("CACHE_INVALIDATIONS") || "0", 10),
    mysqlEnabled: mysqlCfg.enabled,
    defaultTtlSec: GLOBAL_CONFIG.CACHE_DEFAULT_TTL_SEC
  };
}

/**
 * 高頻查詢入口 1：依 MID / 節點 ID / 姓名檢索會員（優先走 L1 ScriptCache -> L2 臨時索引 O(1) 直讀 -> 回填緩存）
 */
function queryMemberByMidOrNode(keyword) {
  var t0 = new Date().getTime();
  var kw = String(keyword || "").trim().toUpperCase();
  if (!kw) return { success: false, error: "請提供查詢關鍵字 (MID / 節點 / 姓名)" };

  var cacheKey = "Q_MEM:" + kw;
  var cached = getHotCache_(cacheKey);
  if (cached) {
    return {
      success: true,
      cacheHit: true,
      source: "L1_SCRIPT_CACHE",
      elapsedMs: new Date().getTime() - t0,
      data: cached
    };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // L2 檢查：從 _SYS_熱點查詢臨時索引使用 TextFinder O(1) 鎖定精準 rowIndex
  var idxSheet = ss.getSheetByName(GLOBAL_CONFIG.SHEET_CACHE_INDEX);
  if (idxSheet && idxSheet.getLastRow() >= 2) {
    var tf = idxSheet.getRange(2, 3, idxSheet.getLastRow() - 1, 1).createTextFinder(kw).matchEntireCell(true).findNext();
    if (tf) {
      var idxRow = idxSheet.getRange(tf.getRow(), 1, 1, 8).getValues()[0];
      var targetSheet = ss.getSheetByName(String(idxRow[4]));
      var targetRowNum = Number(idxRow[5] || 0);
      if (targetSheet && targetRowNum >= 2 && targetRowNum <= targetSheet.getLastRow()) {
        var singleRow = targetSheet.getRange(targetRowNum, 1, 1, targetSheet.getLastColumn()).getValues()[0];
        var hitResult = { found: true, sheetName: idxRow[4], rowIndex: targetRowNum, rowValues: singleRow, cachedPayload: JSON.parse(String(idxRow[7] || "{}")) };
        setHotCache_(cacheKey, hitResult, GLOBAL_CONFIG.CACHE_DEFAULT_TTL_SEC);
        return { success: true, cacheHit: true, source: "L2_TEMP_INDEX_O1_ROW", elapsedMs: new Date().getTime() - t0, data: hitResult };
      }
    }
  }

  // Fallback：全表掃描一次並回填 L1 緩存
  var sMembers = ss.getSheetByName(GLOBAL_CONFIG.SHEET_MEMBERS);
  if (sMembers && sMembers.getLastRow() >= 2) {
    var mData = sMembers.getRange(2, 1, sMembers.getLastRow() - 1, 12).getValues();
    for (var i = 0; i < mData.length; i++) {
      if (String(mData[i][0]).toUpperCase() === kw || String(mData[i][1]).toUpperCase().indexOf(kw) >= 0 || String(mData[i][10]).toUpperCase() === kw || String(mData[i][11]).toUpperCase() === kw) {
        var memObj = {
          mid: mData[i][0], name: mData[i][1], phone: mData[i][2], sponsorMid: mData[i][4],
          monolineNodeId: mData[i][10], binaryNodeId: mData[i][11], rowIndex: i + 2
        };
        setHotCache_(cacheKey, memObj, GLOBAL_CONFIG.CACHE_DEFAULT_TTL_SEC);
        upsertTempIndexRecord_("IDX:MEMBER:" + mData[i][0], "MEMBER", String(mData[i][0]), String(mData[i][0]), GLOBAL_CONFIG.SHEET_MEMBERS, i + 2, memObj);
        return { success: true, cacheHit: false, source: "SHEETS_FALLBACK_BACKFILLED", elapsedMs: new Date().getTime() - t0, data: memObj };
      }
    }
  }

  return { success: true, cacheHit: false, source: "NOT_FOUND", elapsedMs: new Date().getTime() - t0, data: null };
}

/**
 * 高頻查詢入口 2：取得雙軌子樹（優先從 ScriptCache 命中，避免大規模二元樹重複 BFS）
 */
function getBinarySubtree(rootNodeId, maxDepth) {
  var t0 = new Date().getTime();
  var root = String(rootNodeId || GLOBAL_CONFIG.BINARY_ROOT_NODE_ID).trim().toUpperCase();
  var depthLimit = Math.max(1, Math.min(6, Number(maxDepth) || 3));
  var cacheKey = "SUBTREE:" + root + ":" + depthLimit;
  var cached = getHotCache_(cacheKey);
  if (cached) {
    return { success: true, cacheHit: true, source: "L1_SCRIPT_CACHE", elapsedMs: new Date().getTime() - t0, data: cached };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sBi = ss.getSheetByName(GLOBAL_CONFIG.SHEET_BINARY);
  if (!sBi || sBi.getLastRow() < 2) {
    return { success: true, cacheHit: false, data: null };
  }
  var data = sBi.getRange(2, 1, sBi.getLastRow() - 1, 10).getValues();
  var map = {};
  for (var i = 0; i < data.length; i++) {
    map[String(data[i][0]).toUpperCase()] = {
      nodeId: data[i][0], mid: data[i][1], name: data[i][2], parentId: data[i][3],
      placementPosition: data[i][4], depth: data[i][5], leftChildId: data[i][6], rightChildId: data[i][7], status: data[i][9]
    };
  }

  function buildTree_(nid, lvl) {
    var node = map[String(nid || "").toUpperCase()];
    if (!node || lvl > depthLimit) return null;
    return {
      nodeId: node.nodeId, mid: node.mid, name: node.name, position: node.placementPosition, depth: node.depth, status: node.status,
      left: node.leftChildId ? buildTree_(node.leftChildId, lvl + 1) : null,
      right: node.rightChildId ? buildTree_(node.rightChildId, lvl + 1) : null
    };
  }

  var tree = buildTree_(root, 0);
  if (tree) setHotCache_(cacheKey, tree, 180);
  return { success: true, cacheHit: false, source: "SHEETS_BUILT_AND_CACHED", elapsedMs: new Date().getTime() - t0, data: tree };
}

/**
 * 高頻查詢入口 3：取得全網統計（TTL 120s ScriptCache 緩存）
 */
function getSystemStats() {
  var t0 = new Date().getTime();
  var cached = getHotCache_("SYS_STATS");
  if (cached) {
    return { success: true, cacheHit: true, source: "L1_SCRIPT_CACHE", elapsedMs: new Date().getTime() - t0, data: cached };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sMembers = ss.getSheetByName(GLOBAL_CONFIG.SHEET_MEMBERS);
  var sMono = ss.getSheetByName(GLOBAL_CONFIG.SHEET_MONOLINE);
  var sBi = ss.getSheetByName(GLOBAL_CONFIG.SHEET_BINARY);
  var sSet = ss.getSheetByName(GLOBAL_CONFIG.SHEET_SETTLEMENTS);

  var nowTw = formatTaiwanDateTime_(new Date());
  var statsObj = {
    spreadsheetName: ss.getName(),
    totalMembers: sMembers ? Math.max(0, sMembers.getLastRow() - 1) : 0,
    totalMonolineNodes: sMono ? Math.max(0, sMono.getLastRow() - 1) : 0,
    totalBinaryNodes: sBi ? Math.max(0, sBi.getLastRow() - 1) : 0,
    totalSettlements: sSet ? Math.max(0, sSet.getLastRow() - 1) : 0,
    checkedAt: nowTw,
    cachedAt: nowTw
  };
  setHotCache_("SYS_STATS", statsObj, 120);
  return { success: true, cacheHit: false, source: "SHEETS_COMPUTED_AND_CACHED", elapsedMs: new Date().getTime() - t0, data: statsObj };
}

/**
 * 供 Render / 雲端主機開機或休眠喚醒時自動回讀真實試算表帳本（解決免費主機重啟重置問題）
 */
function exportHydrationState() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var maxRows = 5000;

  var members = [];
  var sMembers = ss.getSheetByName(GLOBAL_CONFIG.SHEET_MEMBERS);
  if (sMembers && sMembers.getLastRow() >= 2) {
    var mCount = Math.min(maxRows, sMembers.getLastRow() - 1);
    var mVals = sMembers.getRange(2, 1, mCount, Math.min(12, sMembers.getLastColumn())).getValues();
    for (var i = 0; i < mVals.length; i++) {
      var r = mVals[i];
      var mid = String(r[0] || "").trim().toUpperCase();
      if (!mid) continue;
      members.push({
        mid: mid,
        name: String(r[1] || mid).trim(),
        phone: normalizePhoneText_(r[2] || ""),
        idNumberMasked: String(r[3] || "").trim(),
        sponsorMid: String(r[4] || GLOBAL_CONFIG.FLAGSHIP_SPONSOR_MID).trim().toUpperCase(),
        storeId: String(r[5] || "S-TAIPEI-01").trim(),
        centerId: String(r[6] || "EDU-GLOBAL-01").trim(),
        registeredAt: r[7] ? formatTaiwanDateTime_(r[7]) : formatTaiwanDateTime_(new Date()),
        trialExpiresAt: r[8] ? formatTaiwanDateTime_(r[8]) : formatTaiwanDateTime_(new Date(new Date().getTime() + 30 * 86400000)),
        accumulatedRentAmount: Number(r[9] || 0),
        monolineNodeId: String(r[10] || "").trim().toUpperCase(),
        binaryNodeId: String(r[11] || "").trim().toUpperCase()
      });
    }
  }

  var monolineNodes = [];
  var sMono = ss.getSheetByName(GLOBAL_CONFIG.SHEET_MONOLINE);
  if (sMono && sMono.getLastRow() >= 2) {
    var moCount = Math.min(maxRows, sMono.getLastRow() - 1);
    var moVals = sMono.getRange(2, 1, moCount, Math.min(10, sMono.getLastColumn())).getValues();
    for (var m = 0; m < moVals.length; m++) {
      var mr = moVals[m];
      var nid = String(mr[0] || "").trim().toUpperCase();
      if (!nid) continue;
      monolineNodes.push({
        nodeId: nid,
        mid: String(mr[1] || "").trim().toUpperCase(),
        name: String(mr[2] || nid).trim(),
        parentId: String(mr[3] || "HQ_ROOT").trim(),
        depth: Number(mr[4] || (m + 1)),
        sponsorMid: String(mr[5] || GLOBAL_CONFIG.FLAGSHIP_SPONSOR_MID).trim().toUpperCase(),
        status: String(mr[6] || "TRIAL_ACTIVE").trim(),
        hqPermanentLocked: Boolean(mr[7]),
        trialExpiresAt: mr[8] ? formatTaiwanDateTime_(mr[8]) : formatTaiwanDateTime_(new Date(new Date().getTime() + 30 * 86400000)),
        totalEarnings: Number(mr[9] || 0)
      });
    }
  }

  var binaryNodes = [];
  var sBi = ss.getSheetByName(GLOBAL_CONFIG.SHEET_BINARY);
  if (sBi && sBi.getLastRow() >= 2) {
    var biCount = Math.min(maxRows, sBi.getLastRow() - 1);
    var biVals = sBi.getRange(2, 1, biCount, Math.min(13, sBi.getLastColumn())).getValues();
    for (var b = 0; b < biVals.length; b++) {
      var br = biVals[b];
      var bId = String(br[0] || "").trim().toUpperCase();
      if (!bId) continue;
      binaryNodes.push({
        nodeId: bId,
        mid: String(br[1] || "").trim().toUpperCase(),
        name: String(br[2] || bId).trim(),
        parentId: String(br[3] || "SYSTEM_ROOT").trim(),
        placementPosition: String(br[4] || "L").trim().toUpperCase(),
        depth: Number(br[5] || 0),
        leftChildId: String(br[6] || "").trim().toUpperCase(),
        rightChildId: String(br[7] || "").trim().toUpperCase(),
        sponsorMid: String(br[8] || GLOBAL_CONFIG.FLAGSHIP_SPONSOR_MID).trim().toUpperCase(),
        status: String(br[9] || "TRIAL_ACTIVE").trim(),
        hqPermanentLocked: Boolean(br[10]),
        trialExpiresAt: br[11] ? formatTaiwanDateTime_(br[11]) : formatTaiwanDateTime_(new Date(new Date().getTime() + 30 * 86400000)),
        totalEarnings: Number(br[12] || 0)
      });
    }
  }

  var contacts = [];
  var sContactM = ss.getSheetByName(SHEET_CONFIG['CONTACT_M'].sheet);
  if (sContactM && sContactM.getLastRow() >= 2) {
    var cmCount = Math.min(maxRows, sContactM.getLastRow() - 1);
    var cmVals = sContactM.getRange(2, 1, cmCount, Math.min(10, sContactM.getLastColumn())).getValues();
    for (var c = 0; c < cmVals.length; c++) {
      var cr = cmVals[c];
      var cid = String(cr[0] || "").trim().toUpperCase();
      if (!cid) continue;
      contacts.push({
        id: cid,
        status: String(cr[1] || "開通AI軟體1+1").trim(),
        name: String(cr[2] || "").trim(),
        phone: normalizePhoneText_(cr[3] || ""),
        tel: String(cr[4] || "").trim(),
        line: String(cr[5] || "").trim(),
        email: String(cr[6] || "").trim(),
        address: String(cr[7] || "").trim(),
        photoUrl: String(cr[8] || "").trim(),
        updatedAt: cr[9] ? formatTaiwanDateTime_(cr[9]) : formatTaiwanDateTime_(new Date())
      });
    }
  }

  var contactTrackings = [];
  var sContactT = ss.getSheetByName(SHEET_CONFIG['CONTACT_T'].sheet);
  if (sContactT && sContactT.getLastRow() >= 2) {
    var ctCount = Math.min(maxRows, sContactT.getLastRow() - 1);
    var ctVals = sContactT.getRange(2, 1, ctCount, Math.min(9, sContactT.getLastColumn())).getValues();
    for (var k = 0; k < ctVals.length; k++) {
      var kr = ctVals[k];
      var tid = String(kr[0] || "").trim().toUpperCase();
      if (!tid) continue;
      contactTrackings.push({
        id: tid,
        status: String(kr[1] || "開通體驗").trim(),
        name: String(kr[2] || "").trim(),
        contactDate: kr[3] ? String(kr[3]).trim() : Utilities.formatDate(new Date(), GLOBAL_CONFIG.TIMEZONE, "yyyy-MM-dd"),
        contactMethod: String(kr[4] || "線上開通").trim(),
        discussionContent: String(kr[5] || "").trim(),
        nextStepPlan: String(kr[6] || "").trim(),
        photoUrl: String(kr[7] || "").trim(),
        updatedAt: kr[8] ? formatTaiwanDateTime_(kr[8]) : formatTaiwanDateTime_(new Date())
      });
    }
  }

  return {
    success: true,
    data: {
      spreadsheetName: ss.getName(),
      exportedAt: formatTaiwanDateTime_(new Date()),
      members: members,
      monolineNodes: monolineNodes,
      binaryNodes: binaryNodes,
      contacts: contacts,
      contactTrackings: contactTrackings
    }
  };
}

/**
 * ============================================================================
 * 16. 核心帳務自動化每日午夜備份與點對點還原 (DriveApp + ScriptApp TimeBased Trigger)
 * - 每日 00:00 (Asia/Taipei) 自動彙整核心帳務工作表為 JSON 並存入專屬 Google Drive 資料夾
 * - 計算 SHA-256 數位摘要，還原前強制自動建立安全保護備份 (PRE_RESTORE)
 * ============================================================================
 */
function getOrCreateBackupDriveFolder_() {
  var rootFolders = DriveApp.getFoldersByName(GLOBAL_CONFIG.BACKUP_DRIVE_FOLDER_NAME);
  if (rootFolders.hasNext()) {
    return rootFolders.next();
  }
  return DriveApp.createFolder(GLOBAL_CONFIG.BACKUP_DRIVE_FOLDER_NAME);
}

function computeSha256Hex_(text) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  var hex = [];
  for (var i = 0; i < digest.length; i++) {
    var byteVal = (digest[i] + 256) % 256;
    var byteStr = byteVal.toString(16);
    if (byteStr.length === 1) byteStr = "0" + byteStr;
    hex.push(byteStr);
  }
  return hex.join("").toUpperCase();
}

function removeMidnightBackupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "runMidnightCoreLedgerBackup") {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  PropertiesService.getScriptProperties().setProperty("BACKUP_TRIGGER_ENABLED", "false");
  return {
    success: true,
    action: "removeMidnightBackupTrigger",
    removedTriggers: removed,
    message: "已停用每日午夜自動備份排程觸發器"
  };
}

function setupMidnightBackupTrigger(requestData) {
  removeMidnightBackupTrigger();
  var retention = Math.max(3, Math.min(365, Number((requestData && requestData.retentionDays) || GLOBAL_CONFIG.BACKUP_RETENTION_DAYS)));
  ScriptApp.newTrigger("runMidnightCoreLedgerBackup")
    .timeBased()
    .everyDays(1)
    .atHour(0)
    .nearMinute(5)
    .inTimezone("Asia/Taipei")
    .create();

  var props = PropertiesService.getScriptProperties();
  props.setProperty("BACKUP_TRIGGER_ENABLED", "true");
  props.setProperty("BACKUP_RETENTION_DAYS", String(retention));

  var folder = getOrCreateBackupDriveFolder_();
  return {
    success: true,
    action: "installMidnightBackupTrigger",
    schedule: "每日 00:00 ~ 00:05 (Asia/Taipei)",
    retentionDays: retention,
    backupFolderId: folder.getId(),
    backupFolderUrl: folder.getUrl(),
    message: "已安裝每日午夜核心帳務自動備份觸發器，備份保留 " + retention + " 天"
  };
}

function readSheetAsMatrixObj_(ss, sheetName) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh || sh.getLastRow() === 0) return { headers: [], rows: [] };
  var vals = sh.getDataRange().getValues();
  return {
    headers: vals.length > 0 ? vals[0] : [],
    rows: vals.length > 1 ? vals.slice(1) : []
  };
}

function runMidnightCoreLedgerBackup(requestData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date();
  var tzDate = Utilities.formatDate(now, "Asia/Taipei", "yyyy-MM-dd_HHmmss");
  var triggerType = (requestData && requestData.triggerType) ? String(requestData.triggerType) : "MIDNIGHT_AUTO";
  var retention = Number((requestData && requestData.retentionDays) || PropertiesService.getScriptProperties().getProperty("BACKUP_RETENTION_DAYS") || GLOBAL_CONFIG.BACKUP_RETENTION_DAYS);

  var ledgerPayload = {
    schemaVersion: "2.0",
    backupId: "BKP-" + now.getTime(),
    createdAt: now.toISOString(),
    taipeiTime: Utilities.formatDate(now, "Asia/Taipei", "yyyy-MM-dd HH:mm:ss"),
    triggerType: triggerType,
    sheets: {
      members: readSheetAsMatrixObj_(ss, GLOBAL_CONFIG.SHEET_MEMBERS),
      monolineNodes: readSheetAsMatrixObj_(ss, GLOBAL_CONFIG.SHEET_MONOLINE),
      binaryNodes: readSheetAsMatrixObj_(ss, GLOBAL_CONFIG.SHEET_BINARY),
      settlements: readSheetAsMatrixObj_(ss, GLOBAL_CONFIG.SHEET_SETTLEMENTS),
      bonuses: readSheetAsMatrixObj_(ss, GLOBAL_CONFIG.SHEET_BONUSES),
      todos: readSheetAsMatrixObj_(ss, SHEET_CONFIG['TODO_T'].sheet)
    },
    clientSnapshot: (requestData && requestData.clientSnapshot) ? requestData.clientSnapshot : null
  };

  var jsonStr = JSON.stringify(ledgerPayload, null, 2);
  var checksum = computeSha256Hex_(jsonStr);
  var fileName = "AIS_ERP_LEDGER_" + (triggerType === "PRE_RESTORE" ? "SAFETY_" : "") + tzDate + ".json";
  var folder = getOrCreateBackupDriveFolder_();
  var file = folder.createFile(fileName, jsonStr, MimeType.PLAIN_TEXT);

  // 記錄備份清單於 _SYS_備份與還原紀錄
  var manifest = getOrCreateSheet(ss, GLOBAL_CONFIG.SHEET_BACKUP_MANIFEST);
  if (manifest.getLastRow() === 0) {
    manifest.appendRow([
      "備份編號(BackupID)", "JSON檔名", "Drive檔案ID", "Drive連結",
      "觸發方式", "會員筆數", "雙軌節點筆數", "清算流水筆數", "SHA-256校驗碼", "大小(Bytes)", "備份時間", "狀態"
    ]);
    manifest.getRange(1, 1, 1, 12).setBackground("#0F172A").setFontColor("#FFFFFF").setFontWeight("bold");
  }

  var memCount = ledgerPayload.sheets.members.rows.length;
  var biCount = ledgerPayload.sheets.binaryNodes.rows.length;
  var setCount = ledgerPayload.sheets.settlements.rows.length;

  manifest.appendRow([
    ledgerPayload.backupId, fileName, file.getId(), file.getUrl(),
    triggerType, memCount, biCount, setCount, checksum, jsonStr.length, formatTaiwanDateTime_(now), "COMPLETED"
  ]);

  // 自動清理超過保留天數之舊 JSON 備份檔案
  var pruned = 0;
  try {
    var cutoff = now.getTime() - (retention * 24 * 60 * 60 * 1000);
    var files = folder.getFiles();
    while (files.hasNext()) {
      var f = files.next();
      if (f.getName().indexOf("AIS_ERP_LEDGER_") === 0 && f.getDateCreated().getTime() < cutoff) {
        f.setTrashed(true);
        pruned++;
      }
    }
  } catch (e) {
    Logger.log("Backup Prune Warning: " + e.toString());
  }

  return {
    success: true,
    action: "runScheduledBackup",
    backupId: ledgerPayload.backupId,
    fileName: fileName,
    driveFileId: file.getId(),
    driveFileUrl: file.getUrl(),
    backupFolderUrl: folder.getUrl(),
    checksum: checksum,
    sizeBytes: jsonStr.length,
    prunedCount: pruned,
    message: "已完成核心帳務 JSON 備份並寫入 Google Drive：" + fileName + " (SHA-256: " + checksum.slice(0, 12) + "...)"
  };
}

function listDriveBackupSnapshots() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var manifest = ss.getSheetByName(GLOBAL_CONFIG.SHEET_BACKUP_MANIFEST);
  var items = [];
  if (manifest && manifest.getLastRow() >= 2) {
    var vals = manifest.getRange(2, 1, manifest.getLastRow() - 1, 12).getValues();
    for (var i = vals.length - 1; i >= 0; i--) {
      items.push({
        backupId: vals[i][0],
        fileName: vals[i][1],
        driveFileId: vals[i][2],
        driveFileUrl: vals[i][3],
        triggerType: vals[i][4],
        membersCount: vals[i][5],
        binaryNodesCount: vals[i][6],
        settlementsCount: vals[i][7],
        checksum: vals[i][8],
        sizeBytes: vals[i][9],
        createdAt: vals[i][10],
        status: vals[i][11]
      });
    }
  }
  return { success: true, action: "listBackupSnapshots", count: items.length, backups: items };
}

function overwriteSheetFromMatrixObj_(ss, sheetName, matrixObj) {
  if (!matrixObj || !matrixObj.headers || matrixObj.headers.length === 0) return;
  var sh = getOrCreateSheet(ss, sheetName);
  sh.clearContents();
  var combined = [matrixObj.headers].concat(matrixObj.rows || []);
  sh.getRange(1, 1, combined.length, matrixObj.headers.length).setValues(combined);
}

function restoreFromDriveBackupSnapshot(requestData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var driveFileId = requestData && requestData.driveFileId;
  if (!driveFileId) {
    return { success: false, error: "請提供欲還原的 Google Drive 備份檔案 ID (driveFileId)" };
  }

  var file = DriveApp.getFileById(driveFileId);
  var jsonStr = file.getBlob().getDataAsString("UTF-8");
  var parsed = JSON.parse(jsonStr);
  if (!parsed || !parsed.sheets) {
    return { success: false, error: "備份檔案 JSON 結構無效，無法執行點對點還原" };
  }

  // 還原前先強制建立安全備份快照，防止二次資料覆蓋損失
  var safetyBackup = runMidnightCoreLedgerBackup({ triggerType: "PRE_RESTORE" });

  // 逐一覆寫還原核心帳務工作表
  overwriteSheetFromMatrixObj_(ss, GLOBAL_CONFIG.SHEET_MEMBERS, parsed.sheets.members);
  overwriteSheetFromMatrixObj_(ss, GLOBAL_CONFIG.SHEET_MONOLINE, parsed.sheets.monolineNodes);
  overwriteSheetFromMatrixObj_(ss, GLOBAL_CONFIG.SHEET_BINARY, parsed.sheets.binaryNodes);
  overwriteSheetFromMatrixObj_(ss, GLOBAL_CONFIG.SHEET_SETTLEMENTS, parsed.sheets.settlements);
  overwriteSheetFromMatrixObj_(ss, GLOBAL_CONFIG.SHEET_BONUSES, parsed.sheets.bonuses);
  overwriteSheetFromMatrixObj_(ss, SHEET_CONFIG['TODO_T'].sheet, parsed.sheets.todos);

  // 立即失效熱點緩存並重建臨時索引
  invalidateHotCacheKeys(["SYS_STATS", "SUBTREE:" + GLOBAL_CONFIG.BINARY_ROOT_NODE_ID + ":3"]);
  rebuildHotQueryTempIndex({ ttlSeconds: GLOBAL_CONFIG.CACHE_DEFAULT_TTL_SEC });

  return {
    success: true,
    action: "restoreBackupSnapshot",
    restoredFromBackupId: parsed.backupId || driveFileId,
    restoredFileName: file.getName(),
    safetyRollbackBackupId: safetyBackup.backupId,
    message: "已完成點對點還原：" + file.getName() + "（還原前已自動保存安全快照 " + safetyBackup.backupId + "）"
  };
}

/**
 * ============================================================================
 * 總部最高權限資料庫直接維護介面 (HQ Super Admin Writeback to Google Sheets)
 * 完整相容既有 7欄/11欄精簡試算表列 與 標準 10欄/13欄試算表列，並強制手機/日期為純文字
 * ============================================================================
 */
function hqToTaiwanDateStr_(raw) {
  if (!raw) return "";
  var s = String(raw).trim();
  if (/^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$/.test(s)) return s;
  var d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return Utilities.formatDate(d, GLOBAL_CONFIG.TIMEZONE, GLOBAL_CONFIG.DATETIME_FORMAT);
}

function hqIsValidStatus_(v) {
  var s = String(v || "").trim().toUpperCase();
  return s === "HQ_LOCKED" || s === "TRIAL_ACTIVE" || s === "ACTIVE_RENEWED" || s === "EXPIRED_FROZEN";
}

function hqUpdateMemberInSheet(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(GLOBAL_CONFIG.SHEET_MEMBERS);
  if (!sheet || sheet.getLastRow() < 2) {
    return { success: false, error: "找不到會員主檔工作表或無資料列" };
  }
  var targetMid = String((data && data.mid) || "").trim().toUpperCase();
  if (!targetMid) return { success: false, error: "缺少會員編號 mid" };

  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(12, sheet.getLastColumn());
  var rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var targetRowIdx = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || "").trim().toUpperCase() === targetMid) {
      targetRowIdx = i + 2;
      break;
    }
  }
  if (targetRowIdx < 0) {
    return { success: false, error: "試算表「會員主檔」中找不到 " + targetMid };
  }

  var row = rows[targetRowIdx - 2];
  var phoneText = data.phone !== undefined ? String(data.phone || "").trim() : String(row[2] || "").trim();
  if (/^9\\d{8}$/.test(phoneText)) phoneText = "0" + phoneText;
  var idText = data.idNumberMasked !== undefined ? String(data.idNumberMasked || "").trim().toUpperCase() : String(row[3] || "");
  var expTw = data.trialExpiresAt !== undefined ? hqToTaiwanDateStr_(data.trialExpiresAt) : String(row[8] || "");

  // 強制純文字格式避免開頭 0 與日期格式跑掉
  sheet.getRange(targetRowIdx, 3).setNumberFormat("@");
  sheet.getRange(targetRowIdx, 4).setNumberFormat("@");
  sheet.getRange(targetRowIdx, 9).setNumberFormat("@");

  if (data.name !== undefined) sheet.getRange(targetRowIdx, 2).setValue(String(data.name || "").trim());
  sheet.getRange(targetRowIdx, 3).setValue(phoneText);
  sheet.getRange(targetRowIdx, 4).setValue(idText);
  if (data.sponsorMid !== undefined) sheet.getRange(targetRowIdx, 5).setValue(String(data.sponsorMid || "").trim().toUpperCase());
  if (data.storeId !== undefined) sheet.getRange(targetRowIdx, 6).setValue(String(data.storeId || "").trim());
  if (data.centerId !== undefined) sheet.getRange(targetRowIdx, 7).setValue(String(data.centerId || "").trim());
  if (expTw) sheet.getRange(targetRowIdx, 9).setValue(expTw);
  if (data.accumulatedRentAmount !== undefined) sheet.getRange(targetRowIdx, 10).setValue(Number(data.accumulatedRentAmount || 0));

  SpreadsheetApp.flush();
  invalidateHotCacheKeys(["SYS_STATS"]);
  return {
    success: true,
    message: "已同步更新試算表「會員主檔」第 " + targetRowIdx + " 列 (" + targetMid + ")"
  };
}

function hqDeleteMemberInSheet(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var targetMid = String((data && data.mid) || "").trim().toUpperCase();
  if (!targetMid || targetMid === GLOBAL_CONFIG.FLAGSHIP_SPONSOR_MID) {
    return { success: false, error: "禁止刪除系統核心錨點或無效編號" };
  }

  var sheetMembers = ss.getSheetByName(GLOBAL_CONFIG.SHEET_MEMBERS);
  var deletedMemberRow = false;
  if (sheetMembers && sheetMembers.getLastRow() >= 2) {
    var mVals = sheetMembers.getRange(2, 1, sheetMembers.getLastRow() - 1, 1).getValues();
    for (var i = mVals.length - 1; i >= 0; i--) {
      if (String(mVals[i][0] || "").trim().toUpperCase() === targetMid) {
        sheetMembers.deleteRow(i + 2);
        deletedMemberRow = true;
      }
    }
  }

  if (data && data.deleteLinkedNodes) {
    var monoIds = Array.isArray(data.deletedMonolineIds) ? data.deletedMonolineIds : [];
    for (var m = 0; m < monoIds.length; m++) {
      hqDeleteNodeInSheet({ track: "MONOLINE", nodeId: monoIds[m] });
    }
    var biIds = Array.isArray(data.deletedBinaryIds) ? data.deletedBinaryIds : [];
    for (var b = 0; b < biIds.length; b++) {
      hqDeleteNodeInSheet({ track: "BINARY", nodeId: biIds[b] });
    }
  }

  SpreadsheetApp.flush();
  invalidateHotCacheKeys(["SYS_STATS"]);
  return {
    success: true,
    message: deletedMemberRow
      ? "已從試算表「會員主檔」移除 " + targetMid
      : "試算表「會員主檔」中無 " + targetMid + "（網站端已同步移除）"
  };
}

function hqUpdateNodeInSheet(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var track = String((data && data.track) || "").trim().toUpperCase();
  var nodeId = String((data && data.nodeId) || "").trim().toUpperCase();
  if (!nodeId) return { success: false, error: "缺少節點編號 nodeId" };

  var sheetName = track === "MONOLINE" ? GLOBAL_CONFIG.SHEET_MONOLINE : GLOBAL_CONFIG.SHEET_BINARY;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) {
    return { success: false, error: "找不到工作表「" + sheetName + "」或無資料" };
  }

  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(track === "MONOLINE" ? 10 : 13, sheet.getLastColumn());
  var rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var targetRowIdx = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || "").trim().toUpperCase() === nodeId) {
      targetRowIdx = i + 2;
      break;
    }
  }
  if (targetRowIdx < 0) {
    return { success: false, error: "試算表「" + sheetName + "」中找不到節點 " + nodeId };
  }

  var row = rows[targetRowIdx - 2];
  var expTw = data.trialExpiresAt !== undefined ? hqToTaiwanDateStr_(data.trialExpiresAt) : "";

  if (track === "MONOLINE") {
    var isCompact7 = hqIsValidStatus_(row[3]) || (/^\\d+$/.test(String(row[2] || "").trim()) && !(Number(row[4]) > 0));
    if (isCompact7) {
      // 精簡 7 欄：D欄(4)=狀態、E欄(5)=到期日、G欄(7)=累計收益
      if (data.status !== undefined) sheet.getRange(targetRowIdx, 4).setValue(String(data.status).trim().toUpperCase());
      if (expTw) {
        sheet.getRange(targetRowIdx, 5).setNumberFormat("@").setValue(expTw);
      }
      if (data.totalEarnings !== undefined) sheet.getRange(targetRowIdx, 7).setValue(Number(data.totalEarnings || 0));
    } else {
      // 標準 10 欄：C(3)=名稱、F(6)=推薦人、G(7)=狀態、H(8)=鎖定、I(9)=到期日、J(10)=累計收益
      if (data.name !== undefined) sheet.getRange(targetRowIdx, 3).setValue(String(data.name).trim());
      if (data.sponsorMid !== undefined) sheet.getRange(targetRowIdx, 6).setValue(String(data.sponsorMid).trim().toUpperCase());
      if (data.status !== undefined) sheet.getRange(targetRowIdx, 7).setValue(String(data.status).trim().toUpperCase());
      if (data.hqPermanentLocked !== undefined) sheet.getRange(targetRowIdx, 8).setValue(Boolean(data.hqPermanentLocked));
      if (expTw) {
        sheet.getRange(targetRowIdx, 9).setNumberFormat("@").setValue(expTw);
      }
      if (data.totalEarnings !== undefined) sheet.getRange(targetRowIdx, 10).setValue(Number(data.totalEarnings || 0));
    }
  } else {
    var isCompact11 = hqIsValidStatus_(row[8]) && !hqIsValidStatus_(row[9]);
    if (isCompact11) {
      // 精簡 11 欄：C(3)=推薦人、I(9)=狀態、J(10)=到期日、K(11)=累計收益
      if (data.sponsorMid !== undefined) sheet.getRange(targetRowIdx, 3).setValue(String(data.sponsorMid).trim().toUpperCase());
      if (data.status !== undefined) sheet.getRange(targetRowIdx, 9).setValue(String(data.status).trim().toUpperCase());
      if (expTw) {
        sheet.getRange(targetRowIdx, 10).setNumberFormat("@").setValue(expTw);
      }
      if (data.totalEarnings !== undefined) sheet.getRange(targetRowIdx, 11).setValue(Number(data.totalEarnings || 0));
    } else {
      // 標準 13 欄：C(3)=名稱、I(9)=推薦人、J(10)=狀態、K(11)=鎖定、L(12)=到期日、M(13)=累計收益
      if (data.name !== undefined) sheet.getRange(targetRowIdx, 3).setValue(String(data.name).trim());
      if (data.sponsorMid !== undefined) sheet.getRange(targetRowIdx, 9).setValue(String(data.sponsorMid).trim().toUpperCase());
      if (data.status !== undefined) sheet.getRange(targetRowIdx, 10).setValue(String(data.status).trim().toUpperCase());
      if (data.hqPermanentLocked !== undefined) sheet.getRange(targetRowIdx, 11).setValue(Boolean(data.hqPermanentLocked));
      if (expTw) {
        sheet.getRange(targetRowIdx, 12).setNumberFormat("@").setValue(expTw);
      }
      if (data.totalEarnings !== undefined) sheet.getRange(targetRowIdx, 13).setValue(Number(data.totalEarnings || 0));
    }
  }

  SpreadsheetApp.flush();
  invalidateHotCacheKeys(["SYS_STATS", "SUBTREE:" + GLOBAL_CONFIG.BINARY_ROOT_NODE_ID + ":3"]);
  return {
    success: true,
    message: "已同步更新試算表「" + sheetName + "」節點 " + nodeId
  };
}

function hqDeleteNodeInSheet(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var track = String((data && data.track) || "").trim().toUpperCase();
  var nodeId = String((data && data.nodeId) || "").trim().toUpperCase();
  if (!nodeId || nodeId === GLOBAL_CONFIG.BINARY_ROOT_NODE_ID) {
    return { success: false, error: "禁止刪除系統根節點或無效編號" };
  }

  var sheetName = track === "MONOLINE" ? GLOBAL_CONFIG.SHEET_MONOLINE : GLOBAL_CONFIG.SHEET_BINARY;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) {
    return { success: false, error: "找不到工作表「" + sheetName + "」" };
  }

  var lastRow = sheet.getLastRow();
  var rows = sheet.getRange(2, 1, lastRow - 1, Math.max(8, sheet.getLastColumn())).getValues();
  var deleted = false;

  if (track === "BINARY") {
    // 先清掉父節點對本節點的左右子指標 (G欄=7 / H欄=8)
    for (var p = 0; p < rows.length; p++) {
      if (String(rows[p][6] || "").trim().toUpperCase() === nodeId) {
        sheet.getRange(p + 2, 7).setValue("");
      }
      if (String(rows[p][7] || "").trim().toUpperCase() === nodeId) {
        sheet.getRange(p + 2, 8).setValue("");
      }
    }
  }

  for (var i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][0] || "").trim().toUpperCase() === nodeId) {
      sheet.deleteRow(i + 2);
      deleted = true;
    }
  }

  SpreadsheetApp.flush();
  invalidateHotCacheKeys(["SYS_STATS", "SUBTREE:" + GLOBAL_CONFIG.BINARY_ROOT_NODE_ID + ":3"]);
  return {
    success: true,
    message: deleted
      ? "已從試算表「" + sheetName + "」安全移除節點 " + nodeId
      : "試算表「" + sheetName + "」中無節點 " + nodeId
  };
}
`;

export const GOOGLE_SHEETS_SCHEMA_DOCS = [
  {
    sheetName: '會員主檔 (Members)',
    color: '#1E293B',
    description: '登記所有會員實體個資、MID (A-碼) 與綁定的 2 組 AI 軟體節點 (單軌 C-碼 + 雙軌 C-碼)。',
    columns: [
      { name: '會員編號(MID)', type: 'String (A-00000001 ~ A-25000000 / A-25000001+)', key: true },
      { name: '會員姓名', type: 'String', key: false },
      { name: '手機號碼', type: 'String', key: false },
      { name: '身分證號(去識別)', type: 'String (例如 A123***456)', key: false },
      { name: '推薦人MID', type: 'String (直推推薦鏈錨點)', key: false },
      { name: '所屬經營店', type: 'String (S-開頭)', key: false },
      { name: '所屬教育中心', type: 'String (EDU-開頭)', key: false },
      { name: '註冊時間', type: 'DateTime', key: false },
      { name: '30天體驗到期日', type: 'DateTime (註冊後+30天)', key: false },
      { name: '累積未滿100零錢池', type: 'Number (accumulatedRentAmount)', key: false },
      { name: '第1組單軌節點ID', type: 'String (C-00000001 ~ C-25000000)', key: false },
      { name: '第2組雙軌節點ID', type: 'String (C-25000001 起算)', key: false },
    ],
  },
  {
    sheetName: '單軌公排節點表 (Monoline_Nodes)',
    color: '#0F766E',
    description: '時間序列全民公排互助隊列，每個節點指向上一個註冊之節點 (Placement Parent = C-{id - 1})。',
    columns: [
      { name: '單軌節點ID(C-碼)', type: 'String (C-00000001 ~ C-25000000)', key: true },
      { name: '會員MID(A-碼)', type: 'String', key: false },
      { name: '節點名稱', type: 'String', key: false },
      { name: '父節點ID(前一席)', type: 'String (C-{id-1})', key: false },
      { name: '公排序號(Depth)', type: 'Integer (時間序列順位)', key: false },
      { name: '直推推薦人MID', type: 'String', key: false },
      { name: '節點狀態', type: 'Enum (TRIAL_ACTIVE / ACTIVE_RENEWED / EXPIRED)', key: false },
      { name: '自營永久鎖定', type: 'Boolean (第1~5代自營節點為 TRUE)', key: false },
      { name: '體驗到期日', type: 'DateTime', key: false },
      { name: '累積收益點數', type: 'Number', key: false },
    ],
  },
  {
    sheetName: '雙軌二元樹安置表 (Binary_Nodes)',
    color: '#1D4ED8',
    description: '以 C-25000001 為定海神針頂點，依滿二元樹與 BFS 廣度搜尋自動滑落安置 (L/R)。',
    columns: [
      { name: '雙軌節點ID(C-碼)', type: 'String (C-25000001 ~ C-25000514 HQ / C-25000515+)', key: true },
      { name: '會員MID(A-碼)', type: 'String', key: false },
      { name: '節點名稱', type: 'String', key: false },
      { name: '父節點ID', type: 'String (安置上層節點)', key: false },
      { name: '安置位置(L/R)', type: 'Enum (L / R / ROOT)', key: false },
      { name: '樹深(Depth)', type: 'Integer (0 為根節點)', key: false },
      { name: '左子節點ID', type: 'String (leftChildId)', key: false },
      { name: '右子節點ID', type: 'String (rightChildId)', key: false },
      { name: '直推推薦人MID', type: 'String (開局池為 A-00001113)', key: false },
      { name: '節點狀態', type: 'Enum (HQ_LOCKED / TRIAL_ACTIVE / ACTIVE_RENEWED)', key: false },
      { name: '自營永久鎖定', type: 'Boolean (開局 513 席為 TRUE)', key: false },
      { name: '體驗到期日', type: 'DateTime', key: false },
      { name: '累積收益點數', type: 'Number', key: false },
    ],
  },
  {
    sheetName: '月租清算流水帳 (Settlement_Ledger)',
    color: '#7E22CE',
    description: '100 元月租 100% 閉環撥發流水記錄，嚴格驗證平帳總和 100.0 點 (0 資金沉澱)。',
    columns: [
      { name: '交易流水號', type: 'String (TXN-timestamp)', key: true },
      { name: '繳費節點ID', type: 'String', key: false },
      { name: '會員MID', type: 'String', key: false },
      { name: '繳費金額(NTD)', type: 'Number (100.0)', key: false },
      { name: '15代直推分紅合計', type: 'Number (15.0)', key: false },
      { name: '15代雙軌排線分紅合計', type: 'Number (15.0)', key: false },
      { name: '6代經營店補貼', type: 'Number (6.0)', key: false },
      { name: '6代教育中心補貼', type: 'Number (6.0)', key: false },
      { name: '艾邦妮科技系統池(30%)', type: 'Number (30.0)', key: false },
      { name: '總公司營運管理池(28%)', type: 'Number (28.0)', key: false },
      { name: '公共安全池(熔斷撥入)', type: 'Number', key: false },
      { name: '平帳總驗證(點)', type: 'Number (嚴格等於 100.0)', key: false },
      { name: '清算時間', type: 'DateTime', key: false },
    ],
  },
  {
    sheetName: '1. 通訊主檔 (CONTACT_M / 前綴 CM-)',
    color: '#0284C7',
    description: '新會員開通 AI 軟體 1+1 自動同步建檔之會員通訊錄主檔，照片欄位於第 8 欄位 (imgIdx: 8)。',
    columns: [
      { name: 'ID', type: 'String (前綴 CM-00001 起)', key: true },
      { name: '狀態', type: 'String (開通AI軟體1+1 / 30天體驗中 / 正式會員)', key: false },
      { name: '姓名', type: 'String', key: false },
      { name: '手機', type: 'String (行動電話)', key: false },
      { name: '電話', type: 'String (市話/公司)', key: false },
      { name: 'Line', type: 'String (Line ID)', key: false },
      { name: 'Email', type: 'String (電子郵件)', key: false },
      { name: '地址', type: 'String (通訊地址)', key: false },
      { name: '照片連結', type: 'String (imgIdx: 8, 頭像/名片照)', key: false },
      { name: '更新時間', type: 'DateTime (ISO/標準時間)', key: false },
    ],
  },
  {
    sheetName: '1. 聯繫紀錄 (CONTACT_T / 前綴 CT-)',
    color: '#0369A1',
    description: '通訊錄拜訪追蹤歷程，開通 AI 軟體時自動登錄首筆開通日誌，照片欄位於第 7 欄位 (imgIdx: 7)。',
    columns: [
      { name: 'ID', type: 'String (前綴 CT-00001 起)', key: true },
      { name: '狀態', type: 'String (開通體驗 / 已洽談 / 待跟進 / 預約實體活動)', key: false },
      { name: '姓名', type: 'String', key: false },
      { name: '聯繫日期', type: 'Date (YYYY-MM-DD)', key: false },
      { name: '聯繫方式', type: 'String (線上開通 / Line / 電話 / 面談 / 視訊)', key: false },
      { name: '洽談內容', type: 'String (AI 軟體體驗反饋 / 需求分析)', key: false },
      { name: '下一步計畫', type: 'String (邀約實體活動 / 閉環續約導引)', key: false },
      { name: '照片連結', type: 'String (imgIdx: 7, 互動/合照連結)', key: false },
      { name: '更新時間', type: 'DateTime', key: false },
    ],
  },
  {
    sheetName: '2. 活動主檔 (EVENT_M / 前綴 EM-)',
    color: '#D97706',
    description: '新人說明會、AI 軟體 1+1 實體啟航會與研討會主檔，照片欄位於第 8 欄位 (imgIdx: 8)。',
    columns: [
      { name: 'ID', type: 'String (前綴 EM-00001 起)', key: true },
      { name: '狀態', type: 'String (報名中 / 進行中 / 圓滿落幕 / 籌備中)', key: false },
      { name: '活動主題', type: 'String (如: 新會員開通 AI 軟體 1+1 實體啟航說明會)', key: false },
      { name: '日期', type: 'Date/DateTime', key: false },
      { name: '地點', type: 'String (教育中心或旗艦教室)', key: false },
      { name: '預算', type: 'Number / Currency', key: false },
      { name: '負責人', type: 'String (總監或店長姓名)', key: false },
      { name: '備註', type: 'String', key: false },
      { name: '照片連結', type: 'String (imgIdx: 8, 活動主視覺/海報)', key: false },
      { name: '更新時間', type: 'DateTime', key: false },
    ],
  },
  {
    sheetName: '2. 活動花絮 (EVENT_T / 前綴 ET-)',
    color: '#B45309',
    description: '活動現場實況剪影與花絮紀錄，照片欄位於第 6 欄位 (imgIdx: 6)。',
    columns: [
      { name: 'ID', type: 'String (前綴 ET-00001 起)', key: true },
      { name: '狀態', type: 'String (公開發布 / 精選特輯 / 存檔)', key: false },
      { name: '活動主題', type: 'String (對應關聯活動主檔)', key: false },
      { name: '照片標題', type: 'String (照片主題)', key: false },
      { name: '拍攝地點', type: 'String', key: false },
      { name: '內容備註', type: 'String', key: false },
      { name: '照片連結', type: 'String (imgIdx: 6, 活動實況高清照)', key: false },
      { name: '更新時間', type: 'DateTime', key: false },
    ],
  },
  {
    sheetName: '3. 代辦專案主檔 (TODO_M / 前綴 TDM-)',
    color: '#2563EB',
    description: '會員代辦專案與任務分類主檔，依會員 MID 嚴格隔離同步。',
    columns: [
      { name: 'ID', type: 'String (前綴 TDM-)', key: true },
      { name: '狀態', type: 'String (進行中 / 長期規劃 / 已封存)', key: false },
      { name: '專案名稱', type: 'String', key: false },
      { name: '類別', type: 'String (團隊運作 / 客戶跟進 / 門店營運)', key: false },
      { name: '優先級', type: 'String (高優先 / 中優先 / 低優先)', key: false },
      { name: '負責人', type: 'String (MID)', key: false },
      { name: '目標日期', type: 'Date (YYYY-MM-DD)', key: false },
      { name: '說明與備註', type: 'String', key: false },
      { name: '會員MID', type: 'String (隔離歸屬)', key: false },
      { name: '更新時間', type: 'DateTime', key: false },
    ],
  },
  {
    sheetName: '3. 代辦事項明細 (TODO_T / 前綴 TDT-)',
    color: '#059669',
    description: '個人待辦任務面板雙向同步工作表，支援待處理／處理中／已完成拖曳與過期追蹤。',
    columns: [
      { name: 'ID', type: 'String (前綴 TDT-)', key: true },
      { name: '狀態', type: 'String (待處理 / 處理中 / 已完成)', key: false },
      { name: '事項標題', type: 'String', key: false },
      { name: '專案名稱', type: 'String', key: false },
      { name: '優先級', type: 'String (緊急重要 / 高 / 中 / 低)', key: false },
      { name: '截止日期', type: 'Date (YYYY-MM-DD)', key: false },
      { name: '提醒時間', type: 'Time (HH:mm)', key: false },
      { name: '承辦人', type: 'String', key: false },
      { name: '結束時間', type: 'DateTime (完成時間戳)', key: false },
      { name: '詳細說明', type: 'String', key: false },
      { name: '會員MID', type: 'String (隔離歸屬)', key: false },
      { name: '更新時間', type: 'DateTime', key: false },
    ],
  },
  {
    sheetName: '12. 熱點查詢臨時索引緩存表 (_SYS_熱點查詢臨時索引)',
    color: '#0F172A',
    description: '由 MySQL 同步緩存器自動維護的 O(1) 臨時倒排索引，搭配 ScriptCache 消除大規模 Sheets 全表掃描瓶頸。',
    columns: [
      { name: '索引鍵(cacheKey)', type: 'String (IDX:MEMBER: / IDX:BI_NODE:)', key: true },
      { name: '實體類型', type: 'Enum (MEMBER / BINARY_NODE / MONOLINE_NODE / TODO)', key: false },
      { name: '標準化查詢詞', type: 'String (大寫 MID / C-碼 / 手機)', key: false },
      { name: '主會員MID', type: 'String', key: false },
      { name: '來源工作表', type: 'String', key: false },
      { name: '精準列號(rowIndex)', type: 'Integer (O(1) 直讀列位置)', key: false },
      { name: '命中次數', type: 'Integer', key: false },
      { name: 'JSON快取負載', type: 'JSON String', key: false },
      { name: 'TTL過期時間', type: 'DateTime', key: false },
      { name: 'MySQL同步時間', type: 'DateTime', key: false },
    ],
  },
  {
    sheetName: '13. 每日午夜備份與還原紀錄 (_SYS_備份與還原紀錄)',
    color: '#047857',
    description: '記錄每日 00:00 自動化 JSON 備份檔案位置、SHA-256 完整性校驗碼與點對點還原歷史。',
    columns: [
      { name: '備份編號(BackupID)', type: 'String (BKP-...)', key: true },
      { name: 'JSON檔名', type: 'String (AIS_ERP_LEDGER_YYYY-MM-DD_HHmmss.json)', key: false },
      { name: 'Drive檔案ID', type: 'String (Google Drive File ID)', key: false },
      { name: 'Drive連結', type: 'URL', key: false },
      { name: '觸發方式', type: 'Enum (MIDNIGHT_AUTO / MANUAL / PRE_RESTORE)', key: false },
      { name: '會員筆數', type: 'Integer', key: false },
      { name: '雙軌節點筆數', type: 'Integer', key: false },
      { name: '清算流水筆數', type: 'Integer', key: false },
      { name: 'SHA-256校驗碼', type: 'String (Integrity Digest)', key: false },
      { name: '大小(Bytes)', type: 'Integer', key: false },
      { name: '備份時間', type: 'DateTime', key: false },
      { name: '狀態', type: 'String (COMPLETED)', key: false },
    ],
  },
];
