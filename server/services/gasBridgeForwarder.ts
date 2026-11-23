/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';

const SERVER_DATA_DIR = path.resolve(process.cwd(), '.erp-server-data');
const BRIDGE_STATE_FILE = path.join(SERVER_DATA_DIR, 'gas-bridge.json');

export const DEFAULT_SERVER_GAS_EXEC_URL =
  process.env.GAS_WEB_APP_URL ||
  'https://script.google.com/macros/s/AKfycbxMB3G4rw8h1SqJnlyoCgE7xuGn6Fpc2QSJa1m3xVzyVXosb10fXrWoHkf87_V0nxJb/exec';

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
      const check = validateGasExecUrl(raw.gasWebAppUrl || DEFAULT_SERVER_GAS_EXEC_URL);
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
  const timer = setTimeout(() => controller.abort(), 8000);

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
