/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { erpEngine } from './erpEngine';
import {
  ORDERABLE_SOFTWARE_CATALOG,
  SYS_CONFIG,
  appendMemberOrderReceipt,
  getMemberModuleSubscriptions,
  getMemberUnlockedPacks,
  loadMemberDynamicRecords,
  saveMemberModuleSubscriptions,
  saveMemberUnlockedPacks,
} from './memberFiveStarConfig';
import { notifyNodesUpdated } from './softwareNodeSync';
import { apiProvisionMemberCloudWorkspace } from './confidentialApiClient';
import { Member } from '../types/erp';

export const CLOUD_VAULT_UPDATED_EVENT = 'ais-cloud-vault-updated';

const VAULT_STORAGE_KEY = 'AIS_MEMBER_CLOUD_VAULTS_V1';

export interface MemberCloudSheetTab {
  moduleKey: string;
  sysType: string;
  tabName: string;
  title: string;
  recordCount: number;
  canView: boolean;
  canCreate: boolean;
  isExpired: boolean;
  isNotOrdered: boolean;
  statusLabel: string;
  expiresAt?: string;
}

export interface MemberCloudWorkspace {
  memberMid: string;
  memberName: string;
  folderId: string;
  folderName: string;
  folderUrl: string;
  spreadsheetId: string;
  spreadsheetName: string;
  spreadsheetUrl: string;
  provisionMode: 'LIVE_GAS_DRIVE' | 'AUTO_PROVISIONED_LOCAL';
  createdAt: string;
  lastSyncedAt: string;
  sheetTabs: MemberCloudSheetTab[];
}

export interface ModuleWritePermission {
  baseKey: string;
  softwareTitle: string;
  status: string;
  expiresAt?: string;
  daysRemaining: number;
  canView: boolean;
  canCreate: boolean;
  isExpired: boolean;
  isNotOrdered: boolean;
  readOnlyReason?: string;
}

function normalizeBaseKey(rawKey: string): string {
  const upper = (rawKey || 'CONTACT').trim().toUpperCase();
  if (upper === 'TODO_BOARD') return 'TODO';
  if (upper.endsWith('_M') || upper.endsWith('_T')) {
    return upper.slice(0, -2);
  }
  return upper;
}

export function isRealGoogleSheetId(id?: string): boolean {
  const s = (id || '').trim();
  if (!s) return false;
  if (s.startsWith('GSHEET-') || s.startsWith('GDRV-')) return false;
  return /^[A-Za-z0-9_-]{15,120}$/.test(s);
}

export function isRealGoogleFolderId(id?: string): boolean {
  const s = (id || '').trim();
  if (!s) return false;
  if (s.startsWith('GDRV-') || s.startsWith('GSHEET-')) return false;
  return /^[A-Za-z0-9_-]{15,120}$/.test(s);
}

export function isSafeGoogleCloudUrl(rawUrl?: string): boolean {
  const s = (rawUrl || '').trim();
  if (!s) return false;
  try {
    const parsed = new URL(s);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host !== 'docs.google.com' && host !== 'drive.google.com') return false;
    if (parsed.pathname.includes('/GSHEET-') || parsed.pathname.includes('/GDRV-')) return false;
    return true;
  } catch {
    return false;
  }
}

function makeDeterministicDriveIds(mid: string, name: string) {
  const clean = mid.replace(/[^A-Z0-9]/gi, '');
  const folderId = `GDRV-${clean}`;
  const spreadsheetId = `GSHEET-${clean}`;
  const folderName = `【AIS-ERP 會員雲端】${mid} ${name}`;
  const spreadsheetName = `${mid}_${name}_AI軟體專屬試算表`;
  return {
    folderId,
    folderName,
    folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
    spreadsheetId,
    spreadsheetName,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  };
}

function loadStoredVaultMap(): Record<string, Partial<MemberCloudWorkspace>> {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as Record<string, Partial<MemberCloudWorkspace>>;
    }
  } catch {
    // ignore
  }
  return {};
}

function saveStoredVaultMap(map: Record<string, Partial<MemberCloudWorkspace>>) {
  try {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function notifyCloudVaultUpdated(memberMid?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(CLOUD_VAULT_UPDATED_EVENT, { detail: { memberMid } })
    );
  }
}

/**
 * 檢查指定會員的某套 AI 軟體是否仍在授權效期內（未續約 / 已到期 => 僅能查看舊資料，不能新增資料）
 */
export function getModuleWritePermission(
  memberMid: string,
  moduleOrSysKey: string
): ModuleWritePermission {
  const baseKey = normalizeBaseKey(moduleOrSysKey);
  const member = erpEngine.getMemberById(memberMid);
  const cat = ORDERABLE_SOFTWARE_CATALOG.find((c) => c.key === baseKey);
  const softwareTitle = cat?.title || baseKey;
  const nowMs = Date.now();

  if (baseKey === 'BOOKING') {
    const bk = erpEngine.getBookingProfile(memberMid);
    if (!bk || bk.status === 'NOT_ACTIVATED') {
      return {
        baseKey,
        softwareTitle,
        status: 'NOT_ORDERED',
        daysRemaining: 0,
        canView: true,
        canCreate: false,
        isExpired: false,
        isNotOrdered: true,
        readOnlyReason: `「${softwareTitle}」尚未開通或續約，僅供檢視既有紀錄，請先開通 30 天免費體驗或月租 100 元續約以啟用新增權限。`,
      };
    }

    const expMs = bk.expiresAt ? new Date(bk.expiresAt).getTime() : 0;
    const isExpired = bk.status === 'EXPIRED_FROZEN' || (Boolean(bk.expiresAt) && expMs <= nowMs);
    const daysRemaining = isExpired
      ? 0
      : Math.max(1, Math.ceil((expMs - nowMs) / (24 * 3600 * 1000)));

    return {
      baseKey,
      softwareTitle,
      status: isExpired ? 'EXPIRED_FROZEN' : bk.status,
      expiresAt: bk.expiresAt,
      daysRemaining,
      canView: true,
      canCreate: !isExpired,
      isExpired,
      isNotOrdered: false,
      readOnlyReason: isExpired
        ? `「${softwareTitle}」尚未續約（授權已到期），已自動轉為唯讀歸檔模式：僅可查看歷史舊資料，不可新增資料。`
        : undefined,
    };
  }

  const subs = getMemberModuleSubscriptions(memberMid, member?.trialExpiresAt);
  const sub = subs[baseKey];

  if (!sub || sub.status === 'NOT_ORDERED') {
    // 若屬於 1+1 標配卻無 sub 紀錄，退回 member.trialExpiresAt 判定
    if (cat?.isCore1Plus1 && member?.trialExpiresAt) {
      const expMs = new Date(member.trialExpiresAt).getTime();
      const isExpired = expMs <= nowMs;
      return {
        baseKey,
        softwareTitle,
        status: isExpired ? 'EXPIRED_FROZEN' : 'TRIAL_ACTIVE',
        expiresAt: member.trialExpiresAt,
        daysRemaining: isExpired ? 0 : Math.max(1, Math.ceil((expMs - nowMs) / (24 * 3600 * 1000))),
        canView: true,
        canCreate: !isExpired,
        isExpired,
        isNotOrdered: false,
        readOnlyReason: isExpired
          ? `「${softwareTitle}」尚未續約（體驗已到期），目前僅能查看舊資料，不能新增資料。`
          : undefined,
      };
    }

    return {
      baseKey,
      softwareTitle,
      status: 'NOT_ORDERED',
      daysRemaining: 0,
      canView: true,
      canCreate: false,
      isExpired: false,
      isNotOrdered: true,
      readOnlyReason: `「${softwareTitle}」尚未訂購或未續約，目前僅供檢視既有歷史資料，不可新增資料。`,
    };
  }

  // 對 1+1 核心模組若會員主檔已被設定過期也一併檢查
  const subExpMs = sub.expiresAt ? new Date(sub.expiresAt).getTime() : 0;
  const memExpMs =
    cat?.isCore1Plus1 && member?.trialExpiresAt
      ? new Date(member.trialExpiresAt).getTime()
      : subExpMs;
  const effectiveExpIso =
    cat?.isCore1Plus1 && member?.trialExpiresAt && memExpMs < subExpMs
      ? member.trialExpiresAt
      : sub.expiresAt;
  const effectiveExpMs = effectiveExpIso ? new Date(effectiveExpIso).getTime() : 0;

  const isExpired =
    sub.status === 'EXPIRED_FROZEN' ||
    (Boolean(effectiveExpIso) && effectiveExpMs <= nowMs);
  const daysRemaining = isExpired
    ? 0
    : effectiveExpMs > nowMs
    ? Math.max(1, Math.ceil((effectiveExpMs - nowMs) / (24 * 3600 * 1000)))
    : 30;

  return {
    baseKey,
    softwareTitle,
    status: isExpired ? 'EXPIRED_FROZEN' : sub.status,
    expiresAt: effectiveExpIso,
    daysRemaining,
    canView: true,
    canCreate: !isExpired,
    isExpired,
    isNotOrdered: false,
    readOnlyReason: isExpired
      ? `「${softwareTitle}」尚未續約（授權已到期），已進入唯讀模式：只能查看舊資料，不能新增資料。`
      : undefined,
  };
}

function countModuleRecords(member: Member | undefined, sysType: string): number {
  if (!member) return 0;
  if (sysType === 'CONTACT_M') {
    return erpEngine
      .getAllContacts()
      .filter((c) => c.ownerMid === member.mid || c.memberMid === member.mid).length;
  }
  if (sysType === 'CONTACT_T') {
    return erpEngine
      .getAllContactTrackings()
      .filter((t) => t.ownerMid === member.mid || t.memberMid === member.mid).length;
  }
  if (sysType === 'EVENT_M') {
    return erpEngine.getAllEvents().length;
  }
  if (sysType === 'EVENT_T') {
    return erpEngine.getAllEventTrackings().length;
  }
  if (sysType === 'BOOKING_T') {
    return erpEngine.getAppointmentsByOwner(member.mid).length;
  }
  return loadMemberDynamicRecords(member.mid, sysType).length;
}

export interface MemberSheetTabData {
  sysType: string;
  tabName: string;
  title: string;
  columns: string[];
  rows: Array<Record<string, string>>;
  recordCount: number;
}

function formatDateTimeCell(raw?: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw);
  return d.toLocaleString('zh-TW', { hour12: false });
}

/**
 * 讀取指定會員某個試算表工作表分頁的完整即時欄位與資料列（供系統內試算表檢視器、CSV 匯出與 GAS 同步使用）
 */
export function getMemberCloudSheetTabData(memberMid: string, sysType: string): MemberSheetTabData {
  const normalizedMid = memberMid.trim().toUpperCase();
  const normalizedSys = sysType.trim().toUpperCase();
  const conf = SYS_CONFIG[normalizedSys];
  const baseKey = normalizeBaseKey(normalizedSys);
  const cat = ORDERABLE_SOFTWARE_CATALOG.find((c) => c.key === baseKey);
  const baseTitle = cat?.title || baseKey;
  const tabLabel = conf ? conf.name : normalizedSys === 'BOOKING_T' ? '2. 個人預約明細' : normalizedSys;
  const cleanLabel = tabLabel.replace(/^\d+\.\s*/, '');
  const tabName = `${normalizedSys}_${cleanLabel}`;
  const title = `${baseTitle} · ${cleanLabel}`;

  if (normalizedSys === 'CONTACT_M') {
    const columns = ['ID', '狀態', '姓名', '手機', '電話', 'LINE', 'Email', '住址', '照片連結', '最後更新'];
    const rows = erpEngine
      .getAllContacts()
      .filter((c) => c.ownerMid === normalizedMid || c.memberMid === normalizedMid)
      .map((c) => ({
        ID: c.id || '',
        狀態: c.status || '',
        姓名: c.name || '',
        手機: c.phone || '',
        電話: c.tel || '',
        LINE: c.line || '',
        Email: c.email || '',
        住址: c.address || '',
        照片連結: c.photoUrl || '',
        最後更新: formatDateTimeCell(c.updatedAt),
      }));
    return { sysType: normalizedSys, tabName, title, columns, rows, recordCount: rows.length };
  }

  if (normalizedSys === 'CONTACT_T') {
    const columns = ['ID', '狀態', '聯絡對象', '日期', '方式', '內容摘要', '下一步計畫', '照片連結', '紀錄時間'];
    const rows = erpEngine
      .getAllContactTrackings()
      .filter((t) => t.ownerMid === normalizedMid || t.memberMid === normalizedMid)
      .map((t) => ({
        ID: t.id || '',
        狀態: t.status || '',
        聯絡對象: t.name || '',
        日期: t.contactDate || '',
        方式: t.contactMethod || '',
        內容摘要: t.discussionContent || '',
        下一步計畫: t.nextStepPlan || '',
        照片連結: t.photoUrl || '',
        紀錄時間: formatDateTimeCell(t.updatedAt),
      }));
    return { sysType: normalizedSys, tabName, title, columns, rows, recordCount: rows.length };
  }

  if (normalizedSys === 'EVENT_M') {
    const columns = ['ID', '狀態', '活動主題', '日期', '地點', '預算', '負責人', '備註', '照片連結', '最後更新'];
    const rows = erpEngine.getAllEvents().map((e) => ({
      ID: e.id || '',
      狀態: e.status || '',
      活動主題: e.eventTheme || '',
      日期: e.date || '',
      地點: e.location || '',
      預算: e.budget !== undefined ? String(e.budget) : '',
      負責人: e.leader || '',
      備註: e.notes || '',
      照片連結: e.photoUrl || '',
      最後更新: formatDateTimeCell(e.updatedAt),
    }));
    return { sysType: normalizedSys, tabName, title, columns, rows, recordCount: rows.length };
  }

  if (normalizedSys === 'EVENT_T') {
    const columns = ['ID', '狀態', '活動主題', '照片標題', '拍攝地點', '內容說明', '照片連結', '紀錄時間'];
    const rows = erpEngine.getAllEventTrackings().map((t) => ({
      ID: t.id || '',
      狀態: t.status || '',
      活動主題: t.eventTheme || '',
      照片標題: t.photoTitle || '',
      拍攝地點: t.shootLocation || '',
      內容說明: t.contentNotes || '',
      照片連結: t.photoUrl || '',
      紀錄時間: formatDateTimeCell(t.updatedAt),
    }));
    return { sysType: normalizedSys, tabName, title, columns, rows, recordCount: rows.length };
  }

  if (normalizedSys === 'BOOKING_T') {
    const columns = ['預約編號', '狀態', '客戶姓名', '手機', '預約日期', '時段', '服務項目', '備註', '建立時間'];
    const rows = erpEngine.getAppointmentsByOwner(normalizedMid).map((a) => ({
      預約編號: a.appointmentId || '',
      狀態: a.status || '',
      客戶姓名: a.clientName || '',
      手機: a.clientPhone || '',
      預約日期: a.date || '',
      時段: a.timeSlot || '',
      服務項目: a.serviceTitle || '',
      備註: a.notes || a.reason || '',
      建立時間: formatDateTimeCell(a.createdAt),
    }));
    return { sysType: normalizedSys, tabName, title, columns, rows, recordCount: rows.length };
  }

  const dynRecords = loadMemberDynamicRecords(normalizedMid, normalizedSys);
  const baseCols = conf
    ? ['ID', '狀態', ...conf.fields.map((f) => f.id), '照片連結', '最後更新']
    : ['ID', '狀態', '名稱', '備註', '照片連結', '最後更新'];
  const colSet = new Set<string>(baseCols);
  dynRecords.forEach((rec) => {
    Object.keys(rec || {}).forEach((k) => {
      if (k && !k.startsWith('_')) colSet.add(k);
    });
  });
  const columns = Array.from(colSet);
  const rows = dynRecords.map((rec) => {
    const row: Record<string, string> = {};
    columns.forEach((col) => {
      const val = rec[col];
      row[col] = val === undefined || val === null ? '' : String(val);
    });
    return row;
  });
  return { sysType: normalizedSys, tabName, title, columns, rows, recordCount: rows.length };
}

/**
 * 產生安全可由 Excel / Google 試算表直接開啟的 UTF-8 BOM CSV 內容（含公式注入防護）
 */
export function buildMemberSheetTabCsv(tabData: MemberSheetTabData): string {
  const escapeCell = (raw: string): string => {
    let val = raw ?? '';
    if (val.startsWith('data:image/')) {
      val = '[系統相簿照片]';
    }
    if (/^[=+\-@\t\r]/.test(val)) {
      val = `'${val}`;
    }
    if (/[",\r\n]/.test(val)) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };
  const headerLine = tabData.columns.map(escapeCell).join(',');
  const bodyLines = tabData.rows.map((r) =>
    tabData.columns.map((col) => escapeCell(r[col] || '')).join(',')
  );
  return `\uFEFF${[headerLine, ...bodyLines].join('\r\n')}`;
}

/**
 * 自動為指定會員生成並維護獨立雲端資料夾與專屬 Google 試算表結構
 */
export function ensureMemberCloudWorkspace(memberMid: string): MemberCloudWorkspace {
  const normalizedMid = memberMid.trim().toUpperCase();
  const member = erpEngine.getMemberById(normalizedMid);
  const memberName = member?.name || normalizedMid;
  const fallbackIds = makeDeterministicDriveIds(normalizedMid, memberName);

  const vaultMap = loadStoredVaultMap();
  const existing = vaultMap[normalizedMid];

  // 優先採用伺服器回傳的真實 Google Drive / Google Sheets ID，避免被舊快取假 ID 蓋掉
  const memberHasRealSheet = isRealGoogleSheetId(member?.cloudSpreadsheetId);
  const existingHasRealSheet = isRealGoogleSheetId(existing?.spreadsheetId);
  const memberHasRealFolder = isRealGoogleFolderId(member?.cloudFolderId);
  const existingHasRealFolder = isRealGoogleFolderId(existing?.folderId);

  const folderId = memberHasRealFolder
    ? member!.cloudFolderId!
    : existingHasRealFolder
    ? existing!.folderId!
    : existing?.folderId || member?.cloudFolderId || fallbackIds.folderId;
  const folderName =
    (memberHasRealFolder ? member?.cloudFolderName : existing?.folderName) ||
    member?.cloudFolderName ||
    fallbackIds.folderName;
  const folderUrl =
    memberHasRealFolder && isSafeGoogleCloudUrl(member?.cloudFolderUrl)
      ? member!.cloudFolderUrl!
      : existingHasRealFolder && isSafeGoogleCloudUrl(existing?.folderUrl)
      ? existing!.folderUrl!
      : isRealGoogleFolderId(folderId)
      ? `https://drive.google.com/drive/folders/${folderId}`
      : fallbackIds.folderUrl;

  const spreadsheetId = memberHasRealSheet
    ? member!.cloudSpreadsheetId!
    : existingHasRealSheet
    ? existing!.spreadsheetId!
    : existing?.spreadsheetId || member?.cloudSpreadsheetId || fallbackIds.spreadsheetId;
  const spreadsheetName =
    (memberHasRealSheet ? member?.cloudSpreadsheetName : existing?.spreadsheetName) ||
    member?.cloudSpreadsheetName ||
    fallbackIds.spreadsheetName;
  const spreadsheetUrl =
    memberHasRealSheet && isSafeGoogleCloudUrl(member?.cloudSpreadsheetUrl)
      ? member!.cloudSpreadsheetUrl!
      : existingHasRealSheet && isSafeGoogleCloudUrl(existing?.spreadsheetUrl)
      ? existing!.spreadsheetUrl!
      : isRealGoogleSheetId(spreadsheetId)
      ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
      : fallbackIds.spreadsheetUrl;

  const isLiveGoogleDrive = isRealGoogleSheetId(spreadsheetId) && isSafeGoogleCloudUrl(spreadsheetUrl);

  const nowIso = new Date().toISOString();
  const unlocked = getMemberUnlockedPacks(normalizedMid);
  const subs = getMemberModuleSubscriptions(normalizedMid, member?.trialExpiresAt);

  // 收集會員名下所有應納入專屬試算表的工作表分頁 (核心 1+1 + 預約 + 待辦 + 已開通/已訂購模組)
  const moduleKeys = new Set<string>(['CONTACT', 'EVENT', ...unlocked]);
  Object.values(subs).forEach((s) => {
    if (s.status !== 'NOT_ORDERED') {
      moduleKeys.add(s.moduleKey);
    }
  });
  if (erpEngine.getBookingProfile(normalizedMid)) {
    moduleKeys.add('BOOKING');
  }

  const sheetTabs: MemberCloudSheetTab[] = [];
  moduleKeys.forEach((baseKey) => {
    const perm = getModuleWritePermission(normalizedMid, baseKey);
    const cat = ORDERABLE_SOFTWARE_CATALOG.find((c) => c.key === baseKey);
    const baseTitle = cat?.title || baseKey;

    [`${baseKey}_M`, `${baseKey}_T`].forEach((sysType) => {
      const conf = SYS_CONFIG[sysType];
      if (!conf && sysType !== 'BOOKING_T') return;
      const tabLabel = conf ? conf.name : '2. 個人預約明細';
      sheetTabs.push({
        moduleKey: baseKey,
        sysType,
        tabName: `${sysType}_${tabLabel.replace(/^\d+\.\s*/, '')}`,
        title: `${baseTitle} · ${tabLabel.replace(/^\d+\.\s*/, '')}`,
        recordCount: countModuleRecords(member, sysType),
        canView: true,
        canCreate: perm.canCreate,
        isExpired: perm.isExpired,
        isNotOrdered: perm.isNotOrdered,
        statusLabel: perm.canCreate
          ? '試算表唯讀檢視（系統可新增）'
          : perm.isExpired
          ? '未續約唯讀（僅查舊資料 · 禁新增）'
          : '尚未訂購（僅查舊資料 · 禁新增）',
        expiresAt: perm.expiresAt,
      });
    });
  });

  const workspace: MemberCloudWorkspace = {
    memberMid: normalizedMid,
    memberName,
    folderId,
    folderName,
    folderUrl,
    spreadsheetId,
    spreadsheetName,
    spreadsheetUrl,
    provisionMode: isLiveGoogleDrive ? 'LIVE_GAS_DRIVE' : 'AUTO_PROVISIONED_LOCAL',
    createdAt: existing?.createdAt || member?.registeredAt || nowIso,
    lastSyncedAt: nowIso,
    sheetTabs,
  };

  vaultMap[normalizedMid] = {
    folderId,
    folderName,
    folderUrl,
    spreadsheetId,
    spreadsheetName,
    spreadsheetUrl,
    provisionMode: workspace.provisionMode,
    createdAt: workspace.createdAt,
    lastSyncedAt: workspace.lastSyncedAt,
  };
  saveStoredVaultMap(vaultMap);

  return workspace;
}

/**
 * 批次確保全體會員皆已自動生成獨立雲端資料夾與 Google 試算表
 */
export function provisionAllMembersCloudWorkspaces(): number {
  const members = erpEngine.getAllMembers();
  members.forEach((m) => {
    ensureMemberCloudWorkspace(m.mid);
  });
  return members.length;
}

/**
 * 透過已驗證伺服器代理呼叫 GAS (Code.gs)，實際於 Google Drive 建立會員專屬資料夾與 Google 試算表並回傳真實 ID/連結
 */
export async function syncMemberCloudWorkspaceWithGas(memberMid: string): Promise<{
  success: boolean;
  workspace: MemberCloudWorkspace;
  message: string;
}> {
  const workspace = ensureMemberCloudWorkspace(memberMid);

  const rowsBySys: Record<
    string,
    { tabName: string; columns: string[]; rows: Array<Record<string, string>> }
  > = {};
  workspace.sheetTabs.forEach((tab) => {
    const tabData = getMemberCloudSheetTabData(workspace.memberMid, tab.sysType);
    rowsBySys[tab.sysType] = {
      tabName: tabData.tabName,
      columns: tabData.columns,
      rows: tabData.rows.map((r) => {
        const cleanRow: Record<string, string> = {};
        tabData.columns.forEach((col) => {
          const val = r[col] || '';
          cleanRow[col] = val.startsWith('data:image/') ? '[系統相簿照片]' : val;
        });
        return cleanRow;
      }),
    };
  });

  try {
    const res = await apiProvisionMemberCloudWorkspace(workspace.memberMid, {
      tabs: workspace.sheetTabs.map((t) => ({
        sysType: t.sysType,
        tabName: t.tabName,
        canCreate: t.canCreate,
        readOnly: !t.canCreate,
      })),
      rowsBySys,
    });

    if (res.ok && res.vault && isRealGoogleSheetId(res.vault.spreadsheetId)) {
      if (res.bootstrap) {
        erpEngine.hydrateFromServer(res.bootstrap);
      } else {
        erpEngine.updateMemberProfile(workspace.memberMid, {
          cloudFolderId: res.vault.folderId || workspace.folderId,
          cloudFolderName: res.vault.folderName || workspace.folderName,
          cloudFolderUrl: res.vault.folderUrl || workspace.folderUrl,
          cloudSpreadsheetId: res.vault.spreadsheetId,
          cloudSpreadsheetName: res.vault.spreadsheetName || workspace.spreadsheetName,
          cloudSpreadsheetUrl: res.vault.spreadsheetUrl,
        });
      }

      const vaultMap = loadStoredVaultMap();
      vaultMap[workspace.memberMid] = {
        ...vaultMap[workspace.memberMid],
        folderId: res.vault.folderId || workspace.folderId,
        folderName: res.vault.folderName || workspace.folderName,
        folderUrl: res.vault.folderUrl || workspace.folderUrl,
        spreadsheetId: res.vault.spreadsheetId,
        spreadsheetName: res.vault.spreadsheetName || workspace.spreadsheetName,
        spreadsheetUrl: res.vault.spreadsheetUrl,
        provisionMode: 'LIVE_GAS_DRIVE',
        lastSyncedAt: new Date().toISOString(),
      };
      saveStoredVaultMap(vaultMap);

      const updated = ensureMemberCloudWorkspace(memberMid);
      notifyCloudVaultUpdated(memberMid);

      return {
        success: true,
        workspace: updated,
        message:
          res.message ||
          `已建立真實 Google 試算表 (${updated.spreadsheetId}) 並寫入資料，可直接點擊開啟檢視！`,
      };
    }

    return {
      success: false,
      workspace,
      message:
        res.message ||
        res.error ||
        '目前尚未建立外部 Google 試算表實檔，您可直接點擊試算表 ID 於系統內預覽全部內容或匯出 CSV。',
    };
  } catch {
    return {
      success: false,
      workspace,
      message: '連線雲端試算表建檔伺服器暫時異常，您仍可先於系統內即時查看試算表內容。',
    };
  }
}

/**
 * 測試 / 示範切換指定 AI 軟體模組為「未續約到期 (僅可查看舊資料、不可新增)」或「恢復有效」
 */
export function setModuleExpiryStateForTest(
  memberMid: string,
  rawModuleKey: string,
  expireNow: boolean
): ModuleWritePermission {
  const normalizedMid = memberMid.trim().toUpperCase();
  const baseKey = normalizeBaseKey(rawModuleKey);
  const member = erpEngine.getMemberById(normalizedMid);
  const targetIso = expireNow
    ? new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

  if (baseKey === 'BOOKING') {
    const existingBk = erpEngine.getBookingProfile(normalizedMid);
    if (!existingBk && !expireNow) {
      erpEngine.activateBookingTrial(normalizedMid, { allocateBinaryNode: true });
    } else if (existingBk) {
      erpEngine.updateBookingProfile(normalizedMid, {
        status: expireNow ? 'EXPIRED_FROZEN' : 'ACTIVE_RENEWED',
        expiresAt: targetIso,
      });
    }
  } else {
    const unlocked = getMemberUnlockedPacks(normalizedMid);
    if (!unlocked.includes(baseKey)) {
      saveMemberUnlockedPacks(normalizedMid, [...unlocked, baseKey]);
    }
    const subs = getMemberModuleSubscriptions(normalizedMid, member?.trialExpiresAt);
    const cur = subs[baseKey] || {
      moduleKey: baseKey,
      licenseCode: `SW-${baseKey}-${normalizedMid.replace(/[^A-Z0-9]/gi, '')}`,
      status: 'TRIAL_ACTIVE',
      monthlyRentNtd: 100,
      totalRenewalsCount: 0,
    };
    subs[baseKey] = {
      ...cur,
      status: expireNow ? 'EXPIRED_FROZEN' : 'ACTIVE_RENEWED',
      activatedAt: cur.activatedAt || new Date().toISOString(),
      expiresAt: targetIso,
    };
    saveMemberModuleSubscriptions(normalizedMid, subs);

    if (member && (baseKey === 'CONTACT' || baseKey === 'EVENT')) {
      erpEngine.updateMemberProfile(normalizedMid, { trialExpiresAt: targetIso });
    }
  }

  ensureMemberCloudWorkspace(normalizedMid);
  notifyCloudVaultUpdated(normalizedMid);
  notifyNodesUpdated(normalizedMid);
  return getModuleWritePermission(normalizedMid, baseKey);
}

/**
 * 單模組一鍵續約 100 元/月 (+30天)，解除未續約唯讀限制並執行 100% 閉環分潤
 */
export function renewMemberModuleNow(memberMid: string, rawModuleKey: string): {
  permission: ModuleWritePermission;
  message: string;
} {
  const normalizedMid = memberMid.trim().toUpperCase();
  const baseKey = normalizeBaseKey(rawModuleKey);
  const member = erpEngine.getMemberById(normalizedMid);
  const cat = ORDERABLE_SOFTWARE_CATALOG.find((c) => c.key === baseKey);
  const title = cat?.title || baseKey;
  const now = new Date();

  if (baseKey === 'BOOKING') {
    const res = erpEngine.renewBookingMonthlyFee(normalizedMid);
    const unlocked = getMemberUnlockedPacks(normalizedMid);
    if (!unlocked.includes('BOOKING')) {
      saveMemberUnlockedPacks(normalizedMid, [...unlocked, 'BOOKING']);
    }
    appendMemberOrderReceipt(normalizedMid, {
      orderId: `ORD-${Date.now().toString().slice(-6)}`,
      memberMid: normalizedMid,
      items: [
        {
          moduleKey: 'BOOKING',
          title,
          codeLabel: `${res.profile.licenseId} · BOOKING_M/T`,
          action: 'PAID_RENEWAL',
          amountNtd: 100,
          newExpiresAt: res.profile.expiresAt || new Date(now.getTime() + 30 * 86400000).toISOString(),
          settlementTxnId: res.settlement.transactionId,
          binaryNodeId: res.binaryNode.nodeId,
          binaryParentId: res.binaryNode.parentId,
          binaryDepth: res.binaryNode.depth,
          isNewBinaryNode: res.isNewBinaryNode,
        },
      ],
      totalAmountNtd: 100,
      settlementBreakdowns: [res.settlement],
      createdAt: now.toISOString(),
    });
  } else if (baseKey === 'CONTACT' || baseKey === 'EVENT') {
    const settlement = erpEngine.renewMemberMonthlyFee(normalizedMid);
    const updatedMem = erpEngine.getMemberById(normalizedMid);
    const nextExp =
      updatedMem?.trialExpiresAt || new Date(now.getTime() + 30 * 86400000).toISOString();
    const subs = getMemberModuleSubscriptions(normalizedMid, nextExp);
    ['CONTACT', 'EVENT'].forEach((k) => {
      const cur = subs[k];
      if (cur) {
        subs[k] = {
          ...cur,
          status: 'ACTIVE_RENEWED',
          expiresAt: nextExp,
          totalRenewalsCount: (cur.totalRenewalsCount || 0) + (k === baseKey ? 1 : 0),
          lastSettlementTxnId: settlement?.transactionId,
        };
      }
    });
    saveMemberModuleSubscriptions(normalizedMid, subs);
  } else {
    const subs = getMemberModuleSubscriptions(normalizedMid, member?.trialExpiresAt);
    const cur = subs[baseKey] || {
      moduleKey: baseKey,
      licenseCode: `SW-${baseKey}-${normalizedMid.replace(/[^A-Z0-9]/gi, '')}`,
      status: 'NOT_ORDERED',
      monthlyRentNtd: 100,
      totalRenewalsCount: 0,
    };
    const allocated = erpEngine.allocateBinaryNodeForSoftware({
      memberMid: normalizedMid,
      softwareKey: baseKey,
      softwareTitle: title,
      existingBinaryNodeId: cur.binaryNodeId,
      status: 'ACTIVE_RENEWED',
      expiresAt: cur.expiresAt,
      executeSettlement: true,
    });
    const newExpIso = allocated.binaryNode.trialExpiresAt;
    subs[baseKey] = {
      ...cur,
      status: 'ACTIVE_RENEWED',
      activatedAt: cur.activatedAt || now.toISOString(),
      expiresAt: newExpIso,
      totalRenewalsCount: (cur.totalRenewalsCount || 0) + 1,
      lastSettlementTxnId: allocated.settlement?.transactionId,
      binaryNodeId: allocated.binaryNode.nodeId,
      binaryParentId: allocated.binaryNode.parentId,
      binaryDepth: allocated.binaryNode.depth,
    };
    saveMemberModuleSubscriptions(normalizedMid, subs);

    const unlocked = getMemberUnlockedPacks(normalizedMid);
    if (!unlocked.includes(baseKey)) {
      saveMemberUnlockedPacks(normalizedMid, [...unlocked, baseKey]);
    }
    if (allocated.settlement) {
      appendMemberOrderReceipt(normalizedMid, {
        orderId: `ORD-${Date.now().toString().slice(-6)}`,
        memberMid: normalizedMid,
        items: [
          {
            moduleKey: baseKey,
            title,
            codeLabel: cat?.codeLabel || `${baseKey}_M/T`,
            action: 'PAID_RENEWAL',
            amountNtd: 100,
            newExpiresAt: newExpIso,
            settlementTxnId: allocated.settlement.transactionId,
            binaryNodeId: allocated.binaryNode.nodeId,
            binaryParentId: allocated.binaryNode.parentId,
            binaryDepth: allocated.binaryNode.depth,
            isNewBinaryNode: allocated.isNewlyAllocated,
          },
        ],
        totalAmountNtd: 100,
        settlementBreakdowns: [allocated.settlement],
        createdAt: now.toISOString(),
      });
    }
  }

  ensureMemberCloudWorkspace(normalizedMid);
  notifyCloudVaultUpdated(normalizedMid);
  notifyNodesUpdated(normalizedMid);

  return {
    permission: getModuleWritePermission(normalizedMid, baseKey),
    message: `已完成「${title}」月租 100 元續約 (+30 天)！已解除唯讀限制，恢復試算表新增與寫入權限。`,
  };
}
