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
import { getGasTodoSyncState } from './gasTodoSyncService';
import { notifyNodesUpdated } from './softwareNodeSync';
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

  const folderId = existing?.folderId || member?.cloudFolderId || fallbackIds.folderId;
  const folderName = existing?.folderName || member?.cloudFolderName || fallbackIds.folderName;
  const folderUrl = existing?.folderUrl || member?.cloudFolderUrl || fallbackIds.folderUrl;
  const spreadsheetId =
    existing?.spreadsheetId || member?.cloudSpreadsheetId || fallbackIds.spreadsheetId;
  const spreadsheetName =
    existing?.spreadsheetName || member?.cloudSpreadsheetName || fallbackIds.spreadsheetName;
  const spreadsheetUrl =
    existing?.spreadsheetUrl || member?.cloudSpreadsheetUrl || fallbackIds.spreadsheetUrl;

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
          ? '可讀寫 (授權有效)'
          : perm.isExpired
          ? '未續約唯讀 (僅查舊資料 · 禁新增)'
          : '尚未訂購 (僅查舊資料 · 禁新增)',
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
    provisionMode: existing?.provisionMode || 'AUTO_PROVISIONED_LOCAL',
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
 * 呼叫 GAS Web App (Code.gs) 實際在 Google Drive 建立會員專屬資料夾與 Google 試算表
 */
export async function syncMemberCloudWorkspaceWithGas(memberMid: string): Promise<{
  success: boolean;
  workspace: MemberCloudWorkspace;
  message: string;
}> {
  const workspace = ensureMemberCloudWorkspace(memberMid);
  const gasState = getGasTodoSyncState(memberMid);
  const gasUrl = gasState.gasWebAppUrl?.trim();

  if (!gasUrl) {
    return {
      success: true,
      workspace,
      message: `已完成「${workspace.folderName}」與獨立試算表建檔（待設定 GAS URL 後可一鍵實機寫入 Google Drive）`,
    };
  }

  try {
    await fetch(gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'provisionMemberCloudWorkspace',
        memberMid: workspace.memberMid,
        memberName: workspace.memberName,
        folderName: workspace.folderName,
        spreadsheetName: workspace.spreadsheetName,
        tabs: workspace.sheetTabs.map((t) => ({
          sysType: t.sysType,
          tabName: t.tabName,
          canCreate: t.canCreate,
          readOnly: !t.canCreate,
        })),
      }),
    });

    const vaultMap = loadStoredVaultMap();
    vaultMap[workspace.memberMid] = {
      ...vaultMap[workspace.memberMid],
      provisionMode: 'LIVE_GAS_DRIVE',
      lastSyncedAt: new Date().toISOString(),
    };
    saveStoredVaultMap(vaultMap);
    const updated = ensureMemberCloudWorkspace(memberMid);
    notifyCloudVaultUpdated(memberMid);

    return {
      success: true,
      workspace: updated,
      message: `已透過 GAS DriveApp / SpreadsheetApp 建置「${updated.folderName}」專屬雲端資料夾與試算表！`,
    };
  } catch {
    return {
      success: false,
      workspace,
      message: `GAS 連線暫時異常，已保留「${workspace.spreadsheetName}」本機雲端映射索引。`,
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
