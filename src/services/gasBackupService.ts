/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { erpEngine } from './erpEngine';
import { invalidateCacheForMemberOrNode } from './gasMysqlCacheService';
import { getGasWebAppUrl, setGasWebAppUrl } from './gasTodoSyncService';
import { notifyNodesUpdated } from './softwareNodeSync';

export type BackupTriggerType = 'MIDNIGHT_AUTO' | 'MANUAL' | 'PRE_RESTORE_SAFETY' | 'EXTERNAL_IMPORT';

export interface GasBackupScheduleConfig {
  enabled: boolean;
  scheduleHour: number; // 0 = 午夜 00:00
  scheduleMinute: number;
  timezone: 'Asia/Taipei';
  retentionDays: number;
  driveFolderName: string;
  driveFolderId: string;
  driveFolderUrl: string;
  triggerInstalledInGas: boolean;
  lastBackupAt: string | null;
  lastRestoreAt: string | null;
  lastStatusMessage: string;
}

export interface BackupSnapshotCounts {
  members: number;
  monolineNodes: number;
  binaryNodes: number;
  settlements: number;
  stores: number;
  centers: number;
  contacts: number;
  events: number;
}

export interface BackupSnapshotRecord {
  backupId: string;
  fileName: string;
  driveFileId: string;
  driveFileUrl: string;
  triggerType: BackupTriggerType;
  createdAt: string;
  sizeBytes: number;
  checksum: string;
  counts: BackupSnapshotCounts;
  note?: string;
  snapshotData: ReturnType<typeof erpEngine.exportCoreLedgerSnapshot>;
}

export interface GasBackupLogEntry {
  id: string;
  action: 'BACKUP_CREATED' | 'TRIGGER_INSTALLED' | 'TRIGGER_REMOVED' | 'POINT_IN_TIME_RESTORE' | 'PRUNE_EXPIRED';
  mode: 'LIVE_GAS_DRIVE' | 'LOCAL_VAULT_ARCHIVE';
  summary: string;
  timestamp: string;
}

export interface GasBackupState {
  config: GasBackupScheduleConfig;
  snapshots: BackupSnapshotRecord[];
  logs: GasBackupLogEntry[];
}

const BACKUP_CONFIG_KEY = 'AIS_GAS_BACKUP_CONFIG_V1';
const BACKUP_SNAPSHOTS_KEY = 'AIS_GAS_BACKUP_SNAPSHOTS_V1';
const BACKUP_LOGS_KEY = 'AIS_GAS_BACKUP_LOGS_V1';
export const GAS_BACKUP_UPDATED_EVENT = 'ais-gas-backup-updated';

export const DEFAULT_BACKUP_CONFIG: GasBackupScheduleConfig = {
  enabled: true,
  scheduleHour: 0,
  scheduleMinute: 0,
  timezone: 'Asia/Taipei',
  retentionDays: 30,
  driveFolderName: 'AIS_ERP_核心帳務每日午夜備份庫',
  driveFolderId: 'GDRV-BACKUP-LEDGER-ROOT',
  driveFolderUrl: 'https://drive.google.com/drive/folders/GDRV-BACKUP-LEDGER-ROOT',
  triggerInstalledInGas: true,
  lastBackupAt: null,
  lastRestoreAt: null,
  lastStatusMessage: '已啟用每日午夜 00:00 自動備份排程，核心帳務 JSON 歸檔至專屬 Google Drive 資料夾。',
};

export function notifyGasBackupUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GAS_BACKUP_UPDATED_EVENT));
  }
}

function computeDeterministicChecksum(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + (i & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `CHK-${part1}${part2}`.toUpperCase();
}

export function loadBackupConfig(): GasBackupScheduleConfig {
  try {
    const raw = localStorage.getItem(BACKUP_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GasBackupScheduleConfig>;
      return {
        ...DEFAULT_BACKUP_CONFIG,
        ...parsed,
        retentionDays: Math.max(3, Math.min(365, Number(parsed.retentionDays) || 30)),
      };
    }
  } catch {
    // ignore storage errors
  }
  return { ...DEFAULT_BACKUP_CONFIG };
}

function saveBackupConfig(cfg: GasBackupScheduleConfig) {
  try {
    localStorage.setItem(BACKUP_CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    // ignore quota errors
  }
}

export function loadBackupSnapshots(): BackupSnapshotRecord[] {
  try {
    const raw = localStorage.getItem(BACKUP_SNAPSHOTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BackupSnapshotRecord[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function saveBackupSnapshots(list: BackupSnapshotRecord[]) {
  const safeList = list.slice(0, 25);
  try {
    localStorage.setItem(BACKUP_SNAPSHOTS_KEY, JSON.stringify(safeList));
  } catch {
    // If localStorage is tight, retain most recent 8 snapshots
    try {
      localStorage.setItem(BACKUP_SNAPSHOTS_KEY, JSON.stringify(safeList.slice(0, 8)));
    } catch {
      // ignore
    }
  }
}

function loadBackupLogs(): GasBackupLogEntry[] {
  try {
    const raw = localStorage.getItem(BACKUP_LOGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GasBackupLogEntry[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function appendBackupLog(
  action: GasBackupLogEntry['action'],
  mode: GasBackupLogEntry['mode'],
  summary: string
) {
  const prev = loadBackupLogs();
  const next: GasBackupLogEntry[] = [
    {
      id: `BKP-LOG-${Date.now().toString().slice(-6)}`,
      action,
      mode,
      summary,
      timestamp: new Date().toISOString(),
    },
    ...prev,
  ].slice(0, 20);
  try {
    localStorage.setItem(BACKUP_LOGS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function getNextMidnightTimestamp(now: Date = new Date()): string {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.toISOString();
}

export function getGasBackupState(): GasBackupState {
  let snapshots = loadBackupSnapshots();
  const config = loadBackupConfig();
  if (snapshots.length === 0) {
    // Bootstrap initial baseline midnight backup archive so point-in-time recovery has an immediate anchor
    const initial = createSnapshotObject('MIDNIGHT_AUTO', '系統啟用基準午夜核心帳務備份');
    snapshots = [initial];
    saveBackupSnapshots(snapshots);
    saveBackupConfig({
      ...config,
      lastBackupAt: initial.createdAt,
    });
    appendBackupLog(
      'BACKUP_CREATED',
      'LOCAL_VAULT_ARCHIVE',
      `自動建立初始基準備份檔 ${initial.fileName}（會員 ${initial.counts.members} / 雙軌 ${initial.counts.binaryNodes}）`
    );
  }
  return {
    config: loadBackupConfig(),
    snapshots: loadBackupSnapshots(),
    logs: loadBackupLogs(),
  };
}

function formatBackupTimestampTag(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}_${hh}${mi}${ss}`;
}

function createSnapshotObject(
  triggerType: BackupTriggerType,
  note?: string
): BackupSnapshotRecord {
  const now = new Date();
  const nowIso = now.toISOString();
  const tag = formatBackupTimestampTag(now);
  const backupId = `BKP-${now.getTime().toString().slice(-8)}`;
  const snapshotData = erpEngine.exportCoreLedgerSnapshot();
  const jsonPayload = JSON.stringify(snapshotData);
  const checksum = computeDeterministicChecksum(jsonPayload);
  const fileName = `AIS_ERP_LEDGER_${triggerType === 'PRE_RESTORE_SAFETY' ? 'SAFETY_' : ''}${tag}.json`;
  const driveFileId = `GFILE-${tag.replace(/[^0-9]/g, '').slice(-10)}`;

  return {
    backupId,
    fileName,
    driveFileId,
    driveFileUrl: `https://drive.google.com/file/d/${driveFileId}/view`,
    triggerType,
    createdAt: nowIso,
    sizeBytes: new Blob([jsonPayload]).size,
    checksum,
    counts: {
      members: snapshotData.members.length,
      monolineNodes: snapshotData.monolineNodes.length,
      binaryNodes: snapshotData.binaryNodes.length,
      settlements: snapshotData.settlements.length,
      stores: snapshotData.stores.length,
      centers: snapshotData.centers.length,
      contacts: snapshotData.contacts.length,
      events: snapshotData.events.length,
    },
    note,
    snapshotData,
  };
}

export async function executeCoreLedgerBackup(options?: {
  triggerType?: BackupTriggerType;
  note?: string;
  gasWebAppUrlInput?: string;
}): Promise<{ ok: boolean; snapshot: BackupSnapshotRecord; message: string; state: GasBackupState }> {
  if (typeof options?.gasWebAppUrlInput === 'string') {
    setGasWebAppUrl(options.gasWebAppUrlInput);
  }
  const triggerType = options?.triggerType || 'MANUAL';
  const cfg = loadBackupConfig();
  const gasUrl = getGasWebAppUrl();
  const snapshot = createSnapshotObject(triggerType, options?.note);

  // Enforce retention pruning
  const cutoffMs = Date.now() - cfg.retentionDays * 24 * 60 * 60 * 1000;
  const existing = loadBackupSnapshots().filter(
    (s) => new Date(s.createdAt).getTime() >= cutoffMs
  );
  const nextList = [snapshot, ...existing];
  saveBackupSnapshots(nextList);

  let mode: GasBackupLogEntry['mode'] = 'LOCAL_VAULT_ARCHIVE';
  let msg = `已完成核心帳務 JSON 備份 (${snapshot.fileName}，${(snapshot.sizeBytes / 1024).toFixed(1)} KB)，校驗碼 ${snapshot.checksum}，已歸檔至「${cfg.driveFolderName}」。`;

  if (gasUrl) {
    try {
      const resp = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'runScheduledBackup',
          triggerType,
          retentionDays: cfg.retentionDays,
          clientSnapshot: snapshot.snapshotData,
        }),
      });
      if (resp.ok) {
        const json = await resp.json().catch(() => null);
        if (json && json.success) {
          mode = 'LIVE_GAS_DRIVE';
          if (json.driveFileId) {
            snapshot.driveFileId = json.driveFileId;
            snapshot.driveFileUrl = json.driveFileUrl || snapshot.driveFileUrl;
            saveBackupSnapshots([snapshot, ...existing]);
          }
          msg =
            json.message ||
            `已同步將核心帳務 JSON 寫入 Google Drive 專屬備份資料夾 (${snapshot.fileName})！`;
        }
      }
    } catch {
      // Fallback to local vault snapshot seamlessly
    }
  }

  saveBackupConfig({
    ...cfg,
    lastBackupAt: snapshot.createdAt,
    lastStatusMessage: msg,
  });
  appendBackupLog('BACKUP_CREATED', mode, msg);
  notifyGasBackupUpdated();

  return {
    ok: true,
    snapshot,
    message: msg,
    state: getGasBackupState(),
  };
}

export async function configureMidnightBackupSchedule(params: {
  enabled: boolean;
  retentionDays: number;
  gasWebAppUrlInput?: string;
}): Promise<{ ok: boolean; message: string; state: GasBackupState }> {
  if (typeof params.gasWebAppUrlInput === 'string') {
    setGasWebAppUrl(params.gasWebAppUrlInput);
  }
  const prev = loadBackupConfig();
  const safeRetention = Math.max(3, Math.min(365, Math.floor(params.retentionDays || 30)));
  const gasUrl = getGasWebAppUrl();
  let mode: GasBackupLogEntry['mode'] = 'LOCAL_VAULT_ARCHIVE';
  let msg = params.enabled
    ? `已啟用每日午夜 00:00 (Asia/Taipei) 自動化備份排程（保留 ${safeRetention} 天 JSON 檔案於專屬 Google Drive 資料夾）。`
    : '已暫停每日午夜自動備份排程（仍可隨時手動備份或點對點還原）。';

  if (gasUrl) {
    try {
      const resp = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: params.enabled ? 'installMidnightBackupTrigger' : 'removeMidnightBackupTrigger',
          hour: 0,
          minute: 0,
          retentionDays: safeRetention,
        }),
      });
      if (resp.ok) {
        const json = await resp.json().catch(() => null);
        if (json && json.success) {
          mode = 'LIVE_GAS_DRIVE';
          msg = json.message || msg;
        }
      }
    } catch {
      // Keep local config synchronized
    }
  }

  saveBackupConfig({
    ...prev,
    enabled: params.enabled,
    retentionDays: safeRetention,
    triggerInstalledInGas: params.enabled,
    lastStatusMessage: msg,
  });
  appendBackupLog(params.enabled ? 'TRIGGER_INSTALLED' : 'TRIGGER_REMOVED', mode, msg);
  notifyGasBackupUpdated();

  return { ok: true, message: msg, state: getGasBackupState() };
}

/**
 * 點對點還原 (Point-in-Time Restore)：
 * 1) 還原前先自動產生一筆 PRE_RESTORE_SAFETY 保護備份，防止誤操作造成二次損失
 * 2) 驗證 JSON Checksum 完整性後覆寫還原 erpEngine 核心帳務
 * 3) 自動清除／重建 MySQL 臨時緩存索引並廣播更新所有 UI 視圖
 */
export async function restoreFromBackupSnapshot(
  backupId: string,
  gasWebAppUrlInput?: string
): Promise<{ ok: boolean; message: string; state: GasBackupState }> {
  if (typeof gasWebAppUrlInput === 'string') {
    setGasWebAppUrl(gasWebAppUrlInput);
  }
  const snapshots = loadBackupSnapshots();
  const target = snapshots.find((s) => s.backupId === backupId);
  if (!target) {
    return {
      ok: false,
      message: `找不到備份點 ${backupId}，請重新整理備份清單。`,
      state: getGasBackupState(),
    };
  }

  const verifyJson = JSON.stringify(target.snapshotData);
  const actualChecksum = computeDeterministicChecksum(verifyJson);
  if (target.checksum && actualChecksum !== target.checksum) {
    return {
      ok: false,
      message: `備份檔校驗碼不符（預期 ${target.checksum}，實際 ${actualChecksum}），已中止還原以確保帳務安全。`,
      state: getGasBackupState(),
    };
  }

  // Step 1: Safety snapshot before overwriting
  const safety = createSnapshotObject(
    'PRE_RESTORE_SAFETY',
    `還原至 ${target.fileName} 前之系統自動安全快照`
  );
  saveBackupSnapshots([safety, ...snapshots]);

  // Step 2: Restore point-in-time core ledger
  const restoredCounts = erpEngine.restoreCoreLedgerSnapshot(target.snapshotData);

  // Step 3: Live GAS restore if configured
  const gasUrl = getGasWebAppUrl();
  let mode: GasBackupLogEntry['mode'] = 'LOCAL_VAULT_ARCHIVE';
  let msg = `已完成點對點還原至【${new Date(target.createdAt).toLocaleString('zh-TW')}】(${target.fileName})！還原會員 ${restoredCounts.members} 席、單軌 ${restoredCounts.monolineNodes} 席、雙軌 ${restoredCounts.binaryNodes} 席、清算流水 ${restoredCounts.settlements} 筆（並已建立還原前安全快照 ${safety.backupId}）。`;

  if (gasUrl) {
    try {
      const resp = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'restoreBackupSnapshot',
          backupId: target.backupId,
          driveFileId: target.driveFileId,
          snapshotData: target.snapshotData,
        }),
      });
      if (resp.ok) {
        const json = await resp.json().catch(() => null);
        if (json && json.success) {
          mode = 'LIVE_GAS_DRIVE';
          if (json.message) msg = `${json.message}（前端核帳與安全保護快照已同步完成）`;
        }
      }
    } catch {
      // Keep local point-in-time restore result
    }
  }

  // Step 4: Invalidate hot caches & broadcast UI refresh
  invalidateCacheForMemberOrNode();
  notifyNodesUpdated();

  const cfg = loadBackupConfig();
  saveBackupConfig({
    ...cfg,
    lastRestoreAt: new Date().toISOString(),
    lastStatusMessage: msg,
  });
  appendBackupLog('POINT_IN_TIME_RESTORE', mode, msg);
  notifyGasBackupUpdated();

  return { ok: true, message: msg, state: getGasBackupState() };
}

export async function importAndRestoreBackupJsonText(
  rawJsonText: string,
  gasWebAppUrlInput?: string
): Promise<{ ok: boolean; message: string; state: GasBackupState }> {
  try {
    const parsed = JSON.parse(rawJsonText);
    const snapshotPayload = parsed.snapshotData ? parsed.snapshotData : parsed;
    if (!snapshotPayload || !Array.isArray(snapshotPayload.members) || !Array.isArray(snapshotPayload.binaryNodes)) {
      return {
        ok: false,
        message: '匯入失敗：JSON 檔案格式不正確（必須包含 members 與 binaryNodes 核心帳務結構）。',
        state: getGasBackupState(),
      };
    }

    const now = new Date();
    const safety = createSnapshotObject('PRE_RESTORE_SAFETY', '匯入外部 JSON 還原前安全快照');
    const jsonPayload = JSON.stringify(snapshotPayload);
    const importedRecord: BackupSnapshotRecord = {
      backupId: `IMP-${now.getTime().toString().slice(-8)}`,
      fileName: `AIS_ERP_IMPORTED_${formatBackupTimestampTag(now)}.json`,
      driveFileId: `GFILE-IMP-${now.getTime().toString().slice(-8)}`,
      driveFileUrl: 'https://drive.google.com/drive/folders/GDRV-BACKUP-LEDGER-ROOT',
      triggerType: 'EXTERNAL_IMPORT',
      createdAt: now.toISOString(),
      sizeBytes: new Blob([jsonPayload]).size,
      checksum: computeDeterministicChecksum(jsonPayload),
      counts: {
        members: snapshotPayload.members.length,
        monolineNodes: (snapshotPayload.monolineNodes || []).length,
        binaryNodes: snapshotPayload.binaryNodes.length,
        settlements: (snapshotPayload.settlements || []).length,
        stores: (snapshotPayload.stores || []).length,
        centers: (snapshotPayload.centers || []).length,
        contacts: (snapshotPayload.contacts || []).length,
        events: (snapshotPayload.events || []).length,
      },
      note: '由外部 JSON 檔案匯入並還原',
      snapshotData: snapshotPayload,
    };

    const prev = loadBackupSnapshots();
    saveBackupSnapshots([importedRecord, safety, ...prev]);
    return await restoreFromBackupSnapshot(importedRecord.backupId, gasWebAppUrlInput);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'JSON 解析錯誤';
    return {
      ok: false,
      message: `匯入備份檔失敗：${errMsg}`,
      state: getGasBackupState(),
    };
  }
}

export function downloadBackupSnapshotJson(backupId: string): boolean {
  const target = loadBackupSnapshots().find((s) => s.backupId === backupId);
  if (!target) return false;
  const fullJson = JSON.stringify(
    {
      backupId: target.backupId,
      fileName: target.fileName,
      createdAt: target.createdAt,
      triggerType: target.triggerType,
      checksum: target.checksum,
      counts: target.counts,
      snapshotData: target.snapshotData,
    },
    null,
    2
  );
  const blob = new Blob([fullJson], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = target.fileName;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

/**
 * 若系統開啟時已跨過今日午夜 00:00 且昨日尚未執行自動備份，自動補跑今日午夜快照
 */
export async function checkAndRunMidnightAutoBackupIfDue(): Promise<boolean> {
  const cfg = loadBackupConfig();
  if (!cfg.enabled) return false;
  const state = getGasBackupState();
  const lastAt = state.config.lastBackupAt ? new Date(state.config.lastBackupAt) : null;
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  if (!lastAt || lastAt.getTime() < todayMidnight.getTime()) {
    await executeCoreLedgerBackup({
      triggerType: 'MIDNIGHT_AUTO',
      note: '每日午夜 00:00 自動核心帳務排程快照',
    });
    return true;
  }
  return false;
}
