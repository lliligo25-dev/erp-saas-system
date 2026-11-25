/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';

const SERVER_DATA_DIR = path.resolve(process.cwd(), '.erp-server-data');
const BRIDGE_STATE_FILE = path.join(SERVER_DATA_DIR, 'gas-bridge.json');

const LEGACY_DEPRECATED_GAS_EXEC_URL =
  'https://script.google.com/macros/s/AKfycbxMB3G4rw8h1SqJnlyoCgE7xuGn6Fpc2QSJa1m3xVzyVXosb10fXrWoHkf87_V0nxJb/exec';

export const DEFAULT_SERVER_GAS_EXEC_URL =
  process.env.GAS_WEB_APP_URL ||
  'https://script.google.com/macros/s/AKfycbytTIOhZeHybwk1bMUyAn6N7qHUwdBGm2oZTX19XznuoqkJucP74dPNbq-yyhm-hMwB/exec';

export interface GasBridgeSyncStatus {
  ok: boolean;
  action: string;
  message: string;
  timestamp: string;
  remoteStats?: Record<string, any> | null;
}

export interface GasHydrationStatus {
  ok: boolean;
  message: string;
  timestamp: string;
  spreadsheetName?: string;
  importedMembers: number;
  importedMonoline: number;
  importedBinary: number;
  importedContacts: number;
  importedTrackings: number;
}

export interface GasBridgeServerState {
  gasWebAppUrl: string;
  autoSyncEnabled: boolean;
  lastSyncStatus: GasBridgeSyncStatus | null;
  lastHydrationStatus?: GasHydrationStatus | null;
}

export function validateGasExecUrl(rawUrl: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { valid: false, normalized: '', error: '請輸入 GAS Web App /exec 網址' };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return { valid: false, normalized: trimmed, error: 'GAS 串接網址必須使用 https://' };
    }
    const host = parsed.hostname.toLowerCase();
    // Allow script.google.com and script.googleusercontent.com; block private/metadata IPs
    const allowedHosts = ['script.google.com', 'script.googleusercontent.com'];
    if (!allowedHosts.includes(host)) {
      return {
        valid: false,
        normalized: trimmed,
        error: '僅允許官方 Google Apps Script 網域 (script.google.com)',
      };
    }
    return { valid: true, normalized: trimmed.replace(/\/+$/, '') };
  } catch {
    return { valid: false, normalized: trimmed, error: 'GAS /exec 網址格式無效' };
  }
}

function loadState(): GasBridgeServerState {
  try {
    if (fs.existsSync(BRIDGE_STATE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(BRIDGE_STATE_FILE, 'utf8'));
      const rawUrl =
        raw.gasWebAppUrl === LEGACY_DEPRECATED_GAS_EXEC_URL
          ? DEFAULT_SERVER_GAS_EXEC_URL
          : raw.gasWebAppUrl || DEFAULT_SERVER_GAS_EXEC_URL;
      const check = validateGasExecUrl(rawUrl);
      return {
        gasWebAppUrl: check.valid ? check.normalized : DEFAULT_SERVER_GAS_EXEC_URL,
        autoSyncEnabled: typeof raw.autoSyncEnabled === 'boolean' ? raw.autoSyncEnabled : true,
        lastSyncStatus: raw.lastSyncStatus || null,
        lastHydrationStatus: raw.lastHydrationStatus || null,
      };
    }
  } catch {
    // ignore corrupted config and fall back to default
  }
  return {
    gasWebAppUrl: DEFAULT_SERVER_GAS_EXEC_URL,
    autoSyncEnabled: true,
    lastSyncStatus: null,
    lastHydrationStatus: null,
  };
}

let bridgeState: GasBridgeServerState = loadState();

function saveState() {
  try {
    if (!fs.existsSync(SERVER_DATA_DIR)) {
      fs.mkdirSync(SERVER_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(BRIDGE_STATE_FILE, JSON.stringify(bridgeState, null, 2), 'utf8');
  } catch {
    // ignore disk write failure
  }
}

export function getGasBridgeState(): GasBridgeServerState {
  return bridgeState;
}

export function setGasHydrationStatus(status: GasHydrationStatus): void {
  bridgeState.lastHydrationStatus = status;
  saveState();
}

export function updateGasBridgeConfig(updates: {
  gasWebAppUrl?: string;
  autoSyncEnabled?: boolean;
}): { ok: boolean; error?: string; state: GasBridgeServerState } {
  if (typeof updates.gasWebAppUrl === 'string') {
    const check = validateGasExecUrl(updates.gasWebAppUrl);
    if (!check.valid) {
      return { ok: false, error: check.error, state: bridgeState };
    }
    bridgeState.gasWebAppUrl = check.normalized;
  }
  if (typeof updates.autoSyncEnabled === 'boolean') {
    bridgeState.autoSyncEnabled = updates.autoSyncEnabled;
  }
  saveState();
  return { ok: true, state: bridgeState };
}

export async function pingGasBridge(): Promise<GasBridgeSyncStatus> {
  const url = bridgeState.gasWebAppUrl;
  const target = `${url}${url.includes('?') ? '&' : '?'}action=getSystemStats`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(target, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    const text = await res.text();
    clearTimeout(timer);

    if (!res.ok) {
      const status: GasBridgeSyncStatus = {
        ok: false,
        action: 'ping:getSystemStats',
        message: `GAS 端點回應 HTTP ${res.status}（請確認已部署為網頁應用程式且權限設為「所有人」）`,
        timestamp: new Date().toISOString(),
      };
      bridgeState.lastSyncStatus = status;
      saveState();
      return status;
    }

    try {
      const json = JSON.parse(text);
      const status: GasBridgeSyncStatus = {
        ok: Boolean(json?.success !== false),
        action: 'ping:getSystemStats',
        message:
          json?.success !== false
            ? '✅ 伺服器已成功連通您的 GAS /exec 與 Google Sheets 引擎！'
            : json?.error || 'GAS 回傳異常訊息',
        timestamp: new Date().toISOString(),
        remoteStats: json?.data || json,
      };
      bridgeState.lastSyncStatus = status;
      saveState();
      return status;
    } catch {
      const isHtml = /<!doctype|<html/i.test(text);
      const isGoogleLogin = /accounts\.google\.com|ServiceLogin/i.test(res.url + text);
      const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim().slice(0, 60) : '';

      let detailMsg = 'GAS /exec 回應內容非有效 JSON 格式';
      if (isGoogleLogin) {
        detailMsg =
          'GAS /exec 被 Google 登入頁擋住（請至 Apps Script「管理部署作業」將「誰可以存取」改為《所有人》）';
      } else if (isHtml) {
        detailMsg = pageTitle
          ? `此 /exec 仍停留在舊版部署（目前回傳網頁標題：「${pageTitle}」）。若您剛按過「新增部署作業」，請將新產生的 /exec 網址貼入上方欄位；若沿用舊網址，請至 Apps Script「管理部署作業 → 鉛筆編輯 → 版本務必選《建立新版本》→ 部署」。`
          : 'GAS /exec 回傳了 HTML 網頁而非 JSON（代表該 /exec 仍為舊版本，或您貼的不是最新部署產生的 /exec 網址）';
      }

      const status: GasBridgeSyncStatus = {
        ok: false,
        action: 'ping:getSystemStats',
        message: detailMsg,
        timestamp: new Date().toISOString(),
      };
      bridgeState.lastSyncStatus = status;
      saveState();
      return status;
    }
  } catch (err: any) {
    clearTimeout(timer);
    const status: GasBridgeSyncStatus = {
      ok: false,
      action: 'ping:getSystemStats',
      message: `連線 GAS /exec 逾時或失敗：${err?.message || '網路異常'}`,
      timestamp: new Date().toISOString(),
    };
    bridgeState.lastSyncStatus = status;
    saveState();
    return status;
  }
}

export async function fetchGasHydrationState(): Promise<{
  ok: boolean;
  data?: {
    spreadsheetName?: string;
    exportedAt?: string;
    members?: any[];
    monolineNodes?: any[];
    binaryNodes?: any[];
    contacts?: any[];
    contactTrackings?: any[];
    events?: any[];
    eventTrackings?: any[];
    workspaceRecords?: any[];
    cloudVaults?: any[];
  };
  error?: string;
}> {
  const url = bridgeState.gasWebAppUrl;
  const check = validateGasExecUrl(url);
  if (!check.valid) {
    return { ok: false, error: check.error || 'GAS /exec 網址未設定' };
  }

  const target = `${check.normalized}${check.normalized.includes('?') ? '&' : '?'}action=exportHydrationState`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(target, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    const text = await res.text();
    clearTimeout(timer);

    if (!res.ok) {
      return { ok: false, error: `GAS 回讀回應 HTTP ${res.status}` };
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        ok: false,
        error: 'GAS 端點回傳非 JSON（請更新最新版 Code.gs 並建立新版本部署以支援開機回讀）',
      };
    }

    if (!parsed || parsed.success === false || !parsed.data || !Array.isArray(parsed.data.members)) {
      return {
        ok: false,
        error:
          parsed?.error ||
          'GAS 尚未支援 exportHydrationState（請貼上最新版 Code.gs 並建立新版本部署）',
      };
    }

    return { ok: true, data: parsed.data };
  } catch (err: any) {
    clearTimeout(timer);
    return { ok: false, error: `開機回讀 GAS 逾時或失敗：${err?.message || '網路異常'}` };
  }
}

export async function forwardErpEventToGas(
  gasAction: string,
  data: Record<string, any>
): Promise<void> {
  if (!bridgeState.autoSyncEnabled || !bridgeState.gasWebAppUrl) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(bridgeState.gasWebAppUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: gasAction, data }),
      signal: controller.signal,
    });
    const text = await res.text();
    clearTimeout(timer);

    let ok = res.ok;
    let msg = `已同步 ${gasAction} 至 GAS Google Sheets`;
    try {
      const parsed = JSON.parse(text);
      if (parsed && parsed.success === false) {
        ok = false;
        msg = parsed.error || `GAS 拒絕動作 ${gasAction}`;
      }
    } catch {
      if (/<!doctype|<html/i.test(text)) {
        ok = false;
        msg = `GAS 尚未支援 doPost(${gasAction})，請更新 Code.gs 後建立新版本部署`;
      }
    }

    bridgeState.lastSyncStatus = {
      ok,
      action: gasAction,
      message: msg,
      timestamp: new Date().toISOString(),
    };
    saveState();
  } catch (err: any) {
    clearTimeout(timer);
    bridgeState.lastSyncStatus = {
      ok: false,
      action: gasAction,
      message: `非同步寫入 GAS 失敗：${err?.message || '逾時'}`,
      timestamp: new Date().toISOString(),
    };
    saveState();
  }
}

export async function sendHqDbMutationToGas(
  gasAction: 'hqUpdateMember' | 'hqDeleteMember' | 'hqUpdateNode' | 'hqDeleteNode',
  data: Record<string, any>
): Promise<{
  ok: boolean;
  message: string;
  needsGasUpgrade?: boolean;
}> {
  if (!bridgeState.autoSyncEnabled || !bridgeState.gasWebAppUrl) {
    return {
      ok: false,
      message: 'GAS 自動同步目前為關閉狀態（僅更新網站伺服器記憶體）',
    };
  }
  const check = validateGasExecUrl(bridgeState.gasWebAppUrl);
  if (!check.valid) {
    return { ok: false, message: check.error || 'GAS 網址無效' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(check.normalized, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: gasAction, data }),
      signal: controller.signal,
    });
    const text = await res.text();
    clearTimeout(timer);

    let ok = false;
    let message = '';
    let needsGasUpgrade = false;

    try {
      const parsed = JSON.parse(text);
      if (parsed && parsed.success === true) {
        ok = true;
        message = parsed.message || '已即時回寫同步至 Google 試算表';
      } else {
        const errStr = String(parsed?.error || 'GAS 回寫失敗');
        needsGasUpgrade = /未知的 API 動作|Unknown action/i.test(errStr);
        message = needsGasUpgrade
          ? '網站已更新，但試算表 Code.gs 尚未支援遠端修改接口（請貼上最新版 Code.gs 並建立新版本部署，即可雙向同步）'
          : errStr;
      }
    } catch {
      needsGasUpgrade = /<!doctype|<html/i.test(text);
      message = needsGasUpgrade
        ? 'GAS 回傳 HTML，請確認 Code.gs 已更新並建立新版本部署'
        : `GAS 回應格式異常 (HTTP ${res.status})`;
    }

    bridgeState.lastSyncStatus = {
      ok,
      action: gasAction,
      message,
      timestamp: new Date().toISOString(),
    };
    saveState();
    return { ok, message, needsGasUpgrade };
  } catch (err: any) {
    clearTimeout(timer);
    const message = `同步寫入 Google 試算表逾時或失敗：${err?.message || '網路異常'}`;
    bridgeState.lastSyncStatus = {
      ok: false,
      action: gasAction,
      message,
      timestamp: new Date().toISOString(),
    };
    saveState();
    return { ok: false, message };
  }
}

function isValidGoogleDriveOrSheetUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'docs.google.com' || host === 'drive.google.com';
  } catch {
    return false;
  }
}

export async function provisionMemberCloudWorkspaceViaGas(payload: {
  memberMid: string;
  memberName: string;
  tabs?: Array<{ sysType: string; tabName: string; canCreate: boolean; readOnly: boolean }>;
  rowsBySys?: Record<string, { tabName: string; columns: string[]; rows: Array<Record<string, string>> }>;
}): Promise<{
  ok: boolean;
  folderId?: string;
  folderName?: string;
  folderUrl?: string;
  spreadsheetId?: string;
  spreadsheetName?: string;
  spreadsheetUrl?: string;
  message: string;
  needsGasUpgrade?: boolean;
}> {
  const url = bridgeState.gasWebAppUrl;
  const check = validateGasExecUrl(url);
  if (!check.valid) {
    return { ok: false, message: check.error || '伺服器尚未設定有效的 GAS /exec 網址' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(check.normalized, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'provisionMemberCloudWorkspace',
        memberMid: payload.memberMid,
        memberName: payload.memberName,
        tabs: payload.tabs || [],
        rowsBySys: payload.rowsBySys || null,
      }),
      signal: controller.signal,
    });
    const text = await res.text();
    clearTimeout(timer);

    if (!res.ok) {
      return {
        ok: false,
        message: `GAS 雲端建檔回應 HTTP ${res.status}，請確認 Apps Script 已部署為「所有人」可存取`,
      };
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        ok: false,
        needsGasUpgrade: /<!doctype|<html/i.test(text),
        message:
          'GAS 尚未回傳 JSON（請至 Apps Script 貼上最新版 Code.gs、授權 Google Drive 權限並建立新版本部署）',
      };
    }

    const data = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
    if (!parsed || parsed.success === false) {
      const errStr = String(parsed?.error || 'GAS 建立會員試算表失敗');
      const needsGasUpgrade = /未知的 API 動作|Unknown action|DriveApp|permission|權限/i.test(errStr);
      return {
        ok: false,
        needsGasUpgrade,
        message: errStr,
      };
    }

    const spreadsheetId = String(data?.spreadsheetId || '').trim();
    const folderId = String(data?.folderId || '').trim();
    const rawSpreadsheetUrl = String(
      data?.spreadsheetUrl || (spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}` : '')
    ).trim();
    const rawFolderUrl = String(
      data?.folderUrl || (folderId ? `https://drive.google.com/drive/folders/${folderId}` : '')
    ).trim();

    if (
      !spreadsheetId ||
      spreadsheetId.startsWith('GSHEET-') ||
      !isValidGoogleDriveOrSheetUrl(rawSpreadsheetUrl)
    ) {
      return {
        ok: false,
        needsGasUpgrade: true,
        message:
          'GAS 尚未回傳有效的 Google 試算表 ID（請確認新版 Code.gs 已部署並完成 DriveApp 權限授權）',
      };
    }

    const safeFolderUrl = isValidGoogleDriveOrSheetUrl(rawFolderUrl) ? rawFolderUrl : '';
    const msg =
      String(data?.message || '').trim() ||
      `已於 Google Drive 建立專屬試算表 (${spreadsheetId})，現在可直接開啟！`;

    bridgeState.lastSyncStatus = {
      ok: true,
      action: 'provisionMemberCloudWorkspace',
      message: msg,
      timestamp: new Date().toISOString(),
    };
    saveState();

    return {
      ok: true,
      folderId,
      folderName: String(data?.folderName || '').trim(),
      folderUrl: safeFolderUrl,
      spreadsheetId,
      spreadsheetName: String(data?.spreadsheetName || '').trim(),
      spreadsheetUrl: rawSpreadsheetUrl,
      message: msg,
    };
  } catch (err: any) {
    clearTimeout(timer);
    return {
      ok: false,
      message: `連線 GAS 建立真實 Google 試算表逾時或失敗：${err?.message || '網路異常'}`,
    };
  }
}


