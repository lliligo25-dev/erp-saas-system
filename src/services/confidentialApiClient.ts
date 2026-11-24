/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AuthSession, UserRole } from '../types/erp';

export interface ScopedBootstrapPayload {
  role: UserRole;
  stats: any;
  snapshot: any;
}

export interface AuthSessionResponse {
  authenticated: boolean;
  session: AuthSession | null;
  bootstrap: ScopedBootstrapPayload | null;
}

export interface LoginResponse {
  success: boolean;
  session?: AuthSession;
  ephemeralToken?: string;
  bootstrap?: ScopedBootstrapPayload;
  error?: string;
}

export interface SheetSchemaColumnDoc {
  name: string;
  type: string;
  key: boolean;
}

export interface SheetSchemaDoc {
  sheetName: string;
  color: string;
  description: string;
  columns: SheetSchemaColumnDoc[];
}

// 僅保存在 JS 模組閉包記憶體中（絕不寫入 localStorage/sessionStorage），解決 Google 協作平台等跨網域 iframe 封鎖第三方 Cookie 問題
let memorySessionToken: string | null = null;

function buildAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) };
  if (memorySessionToken) {
    headers['Authorization'] = `Bearer ${memorySessionToken}`;
  }
  return headers;
}

export async function apiLogin(
  role: UserRole,
  identifier: string,
  passcode: string
): Promise<LoginResponse> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role, identifier, passcode }),
    });
    const data = (await res.json()) as LoginResponse;
    if (data.success && data.ephemeralToken) {
      memorySessionToken = data.ephemeralToken;
    }
    return data;
  } catch {
    return { success: false, error: '無法連線至安全驗證伺服器，請稍後再試' };
  }
}

export async function apiIssueQrPassToken(): Promise<{
  ok: boolean;
  qrToken?: string;
  role?: UserRole;
  userId?: string;
  expiresInDays?: number;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/qr-pass', {
      method: 'GET',
      headers: buildAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data?.error || '無法簽發快速登入 QR 憑證' };
    }
    return data;
  } catch {
    return { ok: false, error: '無法連線至安全憑證伺服器' };
  }
}

export async function apiQrLogin(
  qrToken: string,
  expectedRole?: UserRole | null
): Promise<LoginResponse> {
  try {
    const res = await fetch('/api/auth/qr-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ qrToken, expectedRole: expectedRole || null }),
    });
    const data = (await res.json()) as LoginResponse;
    if (data.success && data.ephemeralToken) {
      memorySessionToken = data.ephemeralToken;
    }
    return data;
  } catch {
    return { success: false, error: '無法連線至安全驗證伺服器，請稍後再試' };
  }
}

export async function apiGetSession(portalRole?: UserRole | null): Promise<AuthSessionResponse> {
  try {
    const query = portalRole ? `?portalRole=${encodeURIComponent(portalRole)}` : '';
    const res = await fetch(`/api/auth/session${query}`, {
      method: 'GET',
      headers: buildAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      return { authenticated: false, session: null, bootstrap: null };
    }
    return (await res.json()) as AuthSessionResponse;
  } catch {
    return { authenticated: false, session: null, bootstrap: null };
  }
}

export async function apiLogout(): Promise<void> {
  memorySessionToken = null;
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // ignore network error
  }
}

export async function apiFetchHqGasCode(): Promise<{
  code: string;
  schemaDocs: SheetSchemaDoc[];
}> {
  const res = await fetch('/api/hq/gas-code', {
    method: 'GET',
    headers: buildAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('未授權或僅總部人員可存取此程式碼機密介面');
  }
  return (await res.json()) as { code: string; schemaDocs: SheetSchemaDoc[] };
}

export async function apiSyncErpAction(
  action: string,
  payload: Record<string, any> = {}
): Promise<{ ok: boolean; result?: any; bootstrap?: ScopedBootstrapPayload; error?: string }> {
  try {
    const res = await fetch('/api/erp/sync-action', {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ action, payload }),
    });
    return (await res.json()) as {
      ok: boolean;
      result?: any;
      bootstrap?: ScopedBootstrapPayload;
      error?: string;
    };
  } catch {
    return { ok: false, error: '後端同步連線異常' };
  }
}

export interface GasHydrationStatusRemote {
  ok: boolean;
  source: 'startup' | 'manual';
  message: string;
  timestamp: string;
  importedMembers: number;
  importedMonolineNodes: number;
  importedBinaryNodes: number;
  importedContacts: number;
}

export interface GasBridgeRemoteState {
  gasWebAppUrl: string;
  autoSyncEnabled: boolean;
  lastSyncStatus: {
    ok: boolean;
    action: string;
    message: string;
    timestamp: string;
    remoteStats?: Record<string, any> | null;
  } | null;
  lastHydrationStatus?: GasHydrationStatusRemote | null;
}

export interface PublicSponsorInfoResponse {
  ok: boolean;
  valid: boolean;
  sponsorMid: string;
  sponsorName: string;
}

export interface PublicRegisterPayload {
  name: string;
  phone: string;
  tel?: string;
  line?: string;
  email?: string;
  address?: string;
  idNumberMasked?: string;
  sponsorMid?: string;
  activateBookingSystem?: boolean;
}

export interface PublicRegisterResponse {
  ok: boolean;
  registration?: {
    mid: string;
    name: string;
    phone: string;
    sponsorMid: string;
    monolineNodeId: string;
    binaryNodeId: string;
    trialExpiresAt: string;
    bookingLicenseId: string | null;
  };
  message?: string;
  error?: string;
}

export async function apiGetPublicSponsorInfo(
  sponsorMid?: string | null
): Promise<PublicSponsorInfoResponse> {
  try {
    const query = sponsorMid ? `?sponsor=${encodeURIComponent(sponsorMid.trim())}` : '';
    const res = await fetch(`/api/public/sponsor-info${query}`, {
      method: 'GET',
      credentials: 'omit',
    });
    if (!res.ok) {
      return { ok: false, valid: false, sponsorMid: '', sponsorName: '' };
    }
    return (await res.json()) as PublicSponsorInfoResponse;
  } catch {
    return { ok: false, valid: false, sponsorMid: '', sponsorName: '' };
  }
}

export async function apiPublicRegisterMember(
  payload: PublicRegisterPayload
): Promise<PublicRegisterResponse> {
  try {
    const res = await fetch('/api/public/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as PublicRegisterResponse;
    return data;
  } catch {
    return { ok: false, error: '無法連線至註冊伺服器，請檢查網路後再試' };
  }
}

export async function apiGetHqGasBridge(): Promise<{
  ok: boolean;
  state?: GasBridgeRemoteState;
  error?: string;
}> {
  try {
    const res = await fetch('/api/hq/gas-bridge', {
      method: 'GET',
      headers: buildAuthHeaders(),
      credentials: 'include',
    });
    return await res.json();
  } catch {
    return { ok: false, error: '無法讀取 GAS 伺服器串接狀態' };
  }
}

export async function apiSaveAndTestHqGasBridge(params: {
  gasWebAppUrl?: string;
  autoSyncEnabled?: boolean;
  testPing?: boolean;
  hydrateNow?: boolean;
}): Promise<{
  ok: boolean;
  state?: GasBridgeRemoteState;
  pingResult?: GasBridgeRemoteState['lastSyncStatus'];
  hydrationResult?: GasHydrationStatusRemote | null;
  bootstrap?: ScopedBootstrapPayload;
  error?: string;
}> {
  try {
    const res = await fetch('/api/hq/gas-bridge', {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch {
    return { ok: false, error: '無法測試 GAS /exec 連線' };
  }
}

export async function apiDownloadHqProjectZip(): Promise<{
  ok: boolean;
  fileCount?: number;
  error?: string;
}> {
  try {
    const res = await fetch('/api/hq/download-project-zip', {
      method: 'GET',
      headers: buildAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      let msg = '僅限總部授權人員下載整包專案原始碼';
      try {
        const data = await res.json();
        if (data?.error) msg = data.error;
      } catch {
        // ignore json parse failure
      }
      return { ok: false, error: msg };
    }
    const fileCountHeader = res.headers.get('X-Exported-File-Count');
    const fileCount = fileCountHeader ? Number(fileCountHeader) : undefined;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'erp-saas-system.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return { ok: true, fileCount };
  } catch {
    return { ok: false, error: '下載專案壓縮檔失敗，請稍後再試' };
  }
}

export interface HqDbAuditEntry {
  id: string;
  timestamp: string;
  operatorId: string;
  operatorName: string;
  action: 'UPDATE_MEMBER' | 'DELETE_MEMBER' | 'UPDATE_NODE' | 'DELETE_NODE';
  targetType: 'MEMBER' | 'MONOLINE_NODE' | 'BINARY_NODE';
  targetId: string;
  summary: string;
  gasSyncOk?: boolean;
  gasSyncMessage?: string;
}

export interface HqDbOverviewData {
  members: any[];
  monolineNodes: any[];
  binaryNodes: any[];
  stores: Array<{ storeId: string; name: string }>;
  centers: Array<{ centerId: string; name: string }>;
  auditLogs: HqDbAuditEntry[];
  gasBridge?: GasBridgeRemoteState;
}

export interface HqDbMutationResponse {
  ok: boolean;
  error?: string;
  gasSync?: {
    ok: boolean;
    message: string;
    needsGasUpgrade?: boolean;
  };
  overview?: HqDbOverviewData;
  bootstrap?: ScopedBootstrapPayload;
}

export async function apiHqDbGetOverview(): Promise<{
  ok: boolean;
  data?: HqDbOverviewData;
  error?: string;
}> {
  try {
    const res = await fetch('/api/hq/db/overview', {
      method: 'GET',
      headers: buildAuthHeaders({ 'X-Requested-With': 'XMLHttpRequest' }),
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      return { ok: false, error: json?.error || '無法讀取總部資料庫清單' };
    }
    return { ok: true, data: json as HqDbOverviewData };
  } catch {
    return { ok: false, error: '連線總部資料庫失敗，請稍後再試' };
  }
}

export async function apiHqDbUpdateMember(
  mid: string,
  updates: Record<string, unknown>
): Promise<HqDbMutationResponse> {
  try {
    const res = await fetch(`/api/hq/db/member/${encodeURIComponent(mid)}`, {
      method: 'PATCH',
      headers: buildAuthHeaders({
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      }),
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    return (await res.json()) as HqDbMutationResponse;
  } catch {
    return { ok: false, error: '修改會員資料連線異常' };
  }
}

export async function apiHqDbDeleteMember(
  mid: string,
  deleteLinkedNodes: boolean
): Promise<HqDbMutationResponse> {
  try {
    const res = await fetch(
      `/api/hq/db/member/${encodeURIComponent(mid)}?deleteLinkedNodes=${deleteLinkedNodes ? 'true' : 'false'}`,
      {
        method: 'DELETE',
        headers: buildAuthHeaders({
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        }),
        credentials: 'include',
        body: JSON.stringify({ deleteLinkedNodes }),
      }
    );
    return (await res.json()) as HqDbMutationResponse;
  } catch {
    return { ok: false, error: '刪除會員資料連線異常' };
  }
}

export async function apiHqDbUpdateNode(
  track: 'MONOLINE' | 'BINARY',
  nodeId: string,
  updates: Record<string, unknown>
): Promise<HqDbMutationResponse> {
  try {
    const res = await fetch(
      `/api/hq/db/node/${encodeURIComponent(track)}/${encodeURIComponent(nodeId)}`,
      {
        method: 'PATCH',
        headers: buildAuthHeaders({
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        }),
        credentials: 'include',
        body: JSON.stringify(updates),
      }
    );
    return (await res.json()) as HqDbMutationResponse;
  } catch {
    return { ok: false, error: '修改節點資料連線異常' };
  }
}

export async function apiHqDbDeleteNode(
  track: 'MONOLINE' | 'BINARY',
  nodeId: string
): Promise<HqDbMutationResponse> {
  try {
    const res = await fetch(
      `/api/hq/db/node/${encodeURIComponent(track)}/${encodeURIComponent(nodeId)}`,
      {
        method: 'DELETE',
        headers: buildAuthHeaders({
          'X-Requested-With': 'XMLHttpRequest',
        }),
        credentials: 'include',
      }
    );
    return (await res.json()) as HqDbMutationResponse;
  } catch {
    return { ok: false, error: '刪除節點資料連線異常' };
  }
}


