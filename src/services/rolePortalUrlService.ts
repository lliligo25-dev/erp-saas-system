/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole } from '../types/erp';

export type PortalSlug = 'hq' | 'member' | 'store' | 'center';

export interface RolePortalMeta {
  role: UserRole;
  slug: PortalSlug;
  label: string;
  portalName: string;
  shortDesc: string;
  idParamHint: string;
  defaultDemoId: string;
  accentText: string;
  accentBadgeBg: string;
  accentBorder: string;
  buttonBg: string;
}

export const PORTAL_SLUG_BY_ROLE: Record<UserRole, PortalSlug> = {
  HQ_STAFF: 'hq',
  MEMBER: 'member',
  STORE: 'store',
  CENTER: 'center',
};

export const ROLE_BY_PORTAL_SLUG: Record<PortalSlug, UserRole> = {
  hq: 'HQ_STAFF',
  member: 'MEMBER',
  store: 'STORE',
  center: 'CENTER',
};

export const ROLE_PORTAL_META: RolePortalMeta[] = [
  {
    role: 'HQ_STAFF',
    slug: 'hq',
    label: '總部工作人員',
    portalName: '總部管理員專屬安全入口',
    shortDesc: '僅供授權營運總部人員進行內部系統核帳、權限管控與維運稽核',
    idParamHint: '授權人員帳號',
    defaultDemoId: '',
    accentText: 'text-indigo-300',
    accentBadgeBg: 'bg-indigo-950/80 border-indigo-700/70 text-indigo-300',
    accentBorder: 'border-indigo-500/40',
    buttonBg: 'bg-indigo-600 hover:bg-indigo-500',
  },
  {
    role: 'MEMBER',
    slug: 'member',
    label: '一般會員',
    portalName: '一般會員專屬工作台',
    shortDesc: '個人雲端工作區（通訊錄 + 活動行銷）、個人預約排程、資料夾與權益管理',
    idParamHint: '會員編號 / 手機號碼',
    defaultDemoId: '',
    accentText: 'text-sky-300',
    accentBadgeBg: 'bg-sky-950/80 border-sky-700/70 text-sky-300',
    accentBorder: 'border-sky-500/40',
    buttonBg: 'bg-sky-600 hover:bg-sky-500',
  },
  {
    role: 'STORE',
    slug: 'store',
    label: '一般營業店',
    portalName: '營業店管理工作台',
    shortDesc: '門市店長專屬：輔導組織鏈、本店轄下會員名冊與門市補貼明細',
    idParamHint: '營業店編號 / 店長識別碼',
    defaultDemoId: '',
    accentText: 'text-emerald-300',
    accentBadgeBg: 'bg-emerald-950/80 border-emerald-700/70 text-emerald-300',
    accentBorder: 'border-emerald-500/40',
    buttonBg: 'bg-emerald-600 hover:bg-emerald-500',
  },
  {
    role: 'CENTER',
    slug: 'center',
    label: '一般教育中心',
    portalName: '教育中心管理工作台',
    shortDesc: '培訓總監專屬：培訓中心網絡、綁定學員管理、中心活動與補貼統計',
    idParamHint: '教育中心編號 / 總監識別碼',
    defaultDemoId: '',
    accentText: 'text-cyan-300',
    accentBadgeBg: 'bg-cyan-950/80 border-cyan-700/70 text-cyan-300',
    accentBorder: 'border-cyan-500/40',
    buttonBg: 'bg-cyan-600 hover:bg-cyan-500',
  },
];

export function getPortalMetaForRole(role: UserRole): RolePortalMeta {
  return ROLE_PORTAL_META.find((m) => m.role === role) || ROLE_PORTAL_META[0];
}

export interface ParsedPortalUrl {
  lockedRole: UserRole | null;
  targetId: string | null;
  deviceMode: 'mobile' | 'desktop' | null;
  qrToken: string | null;
  isPublicJoin: boolean;
  sponsorMid: string | null;
  isBreakfastPortal: boolean;
  breakfastShop: string | null;
  breakfastTable: string | null;
  breakfastTab: string | null;
}

function resolveSlugToRole(rawSlug: string | null | undefined): UserRole | null {
  if (!rawSlug) return null;
  const normalized = rawSlug.trim().toLowerCase();
  if (normalized === 'hq' || normalized === 'hq_staff') return 'HQ_STAFF';
  if (normalized === 'member') return 'MEMBER';
  if (normalized === 'store') return 'STORE';
  if (normalized === 'center') return 'CENTER';
  return null;
}

/**
 * 解析當前網址列中的專屬角色入口、免登入公開入會頁與手機版參數：
 * 支援 `?portal=hq|member|store|center|join`、`?sponsor=A-00001`、`?device=mobile` / `?mobile=1`
 * 並同時擷取選填指定帳號參數 (`id`, `mid`, `storeId`, `centerId`, `staffId`) 與 `qrToken`
 */
export function parsePortalFromUrl(): ParsedPortalUrl {
  if (typeof window === 'undefined') {
    return {
      lockedRole: null,
      targetId: null,
      deviceMode: null,
      qrToken: null,
      isPublicJoin: false,
      sponsorMid: null,
      isBreakfastPortal: false,
      breakfastShop: null,
      breakfastTable: null,
      breakfastTab: null,
    };
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const rawPortal = (params.get('portal') || '').trim().toLowerCase();
    const isPublicJoin =
      rawPortal === 'join' ||
      rawPortal === 'register' ||
      params.get('join') === '1';

    const hashCleaned = (window.location.hash || '').replace(/^#\/?/, '').toLowerCase();
    const isBreakfastPortal =
      rawPortal === 'breakfast' ||
      rawPortal === 'brunch' ||
      params.get('breakfast') === '1' ||
      hashCleaned === 'breakfast' ||
      hashCleaned.startsWith('portal=breakfast');

    let lockedRole = isBreakfastPortal ? null : resolveSlugToRole(rawPortal);

    // Also tolerate hash-style portal indicator like #/member or #portal=member
    if (!lockedRole && !isPublicJoin && !isBreakfastPortal && window.location.hash) {
      const cleanedHash = window.location.hash.replace(/^#\/?/, '');
      if (cleanedHash.startsWith('portal=')) {
        lockedRole = resolveSlugToRole(cleanedHash.slice('portal='.length).split('&')[0]);
      } else {
        lockedRole = resolveSlugToRole(cleanedHash.split('?')[0].split('/')[0]);
      }
    }

    const targetIdRaw =
      params.get('id') ||
      params.get('mid') ||
      params.get('storeId') ||
      params.get('centerId') ||
      params.get('staffId');

    const targetId = targetIdRaw && targetIdRaw.trim() ? targetIdRaw.trim() : null;

    const sponsorRaw = params.get('sponsor') || params.get('ref');
    const sponsorMid =
      sponsorRaw && sponsorRaw.trim() ? sponsorRaw.trim().toUpperCase() : null;

    const deviceParam = (params.get('device') || params.get('view') || '').trim().toLowerCase();
    const mobileFlag = params.get('mobile');
    let deviceMode: 'mobile' | 'desktop' | null = null;
    if (deviceParam === 'mobile' || mobileFlag === '1' || mobileFlag === 'true') {
      deviceMode = 'mobile';
    } else if (deviceParam === 'desktop') {
      deviceMode = 'desktop';
    }

    const qrTokenRaw = params.get('qrToken');
    const qrToken = qrTokenRaw && qrTokenRaw.trim() ? qrTokenRaw.trim() : null;

    const breakfastShopRaw = params.get('shop');
    const breakfastShop =
      breakfastShopRaw && breakfastShopRaw.trim() ? breakfastShopRaw.trim() : null;
    const breakfastTableRaw = params.get('table');
    const breakfastTable =
      breakfastTableRaw && breakfastTableRaw.trim() ? breakfastTableRaw.trim() : null;
    const breakfastTabRaw = params.get('tab');
    const breakfastTab =
      breakfastTabRaw && breakfastTabRaw.trim() ? breakfastTabRaw.trim().toLowerCase() : null;

    return {
      lockedRole,
      targetId,
      deviceMode,
      qrToken,
      isPublicJoin,
      sponsorMid,
      isBreakfastPortal,
      breakfastShop,
      breakfastTable,
      breakfastTab,
    };
  } catch {
    return {
      lockedRole: null,
      targetId: null,
      deviceMode: null,
      qrToken: null,
      isPublicJoin: false,
      sponsorMid: null,
      isBreakfastPortal: false,
      breakfastShop: null,
      breakfastTable: null,
      breakfastTab: null,
    };
  }
}

/**
 * 偵測是否透過 LINE 內建瀏覽器（LINE 攝影 / LINE 掃一掃 / 聊天室連結）開啟
 */
export function detectLineInAppBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('inapp') === 'line') return true;
  } catch {
    // ignore URL parse error
  }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  return /\bLine\//i.test(ua) || /\bLIFF\b/i.test(ua);
}

/**
 * 偵測是否為行動裝置 User-Agent
 */
export function detectMobileUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|\bLine\//i.test(ua);
}

/**
 * 產生附加 LINE 官方跳轉外部預設瀏覽器參數 (?openExternalBrowser=1) 的網址
 */
export function buildExternalBrowserUrl(rawUrl?: string): string {
  const source =
    rawUrl || (typeof window !== 'undefined' ? window.location.href : '/');
  try {
    const parsed = new URL(
      source,
      typeof window !== 'undefined' ? window.location.origin : 'https://localhost'
    );
    parsed.searchParams.set('device', 'mobile');
    parsed.searchParams.set('openExternalBrowser', '1');
    return parsed.toString();
  } catch {
    const sep = source.includes('?') ? '&' : '?';
    return `${source}${sep}device=mobile&openExternalBrowser=1`;
  }
}

export const OFFICIAL_GAS_EXEC_URL =
  'https://script.google.com/macros/s/AKfycbytTIOhZeHybwk1bMUyAn6N7qHUwdBGm2oZTX19XznuoqkJucP74dPNbq-yyhm-hMwB/exec';

export const OFFICIAL_SHARED_APP_URL =
  'https://erp-saas-system.onrender.com';

const SAVED_EXTERNAL_BASE_URL_KEY = 'ais_custom_external_base_url';
export const EXTERNAL_BASE_URL_UPDATED_EVENT = 'ais-external-base-url-updated';

export function validateExternalBaseUrl(rawUrl: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { valid: false, normalized: '', error: '請輸入完整的 https:// 對外網址' };
  }
  if (/\s/.test(trimmed)) {
    return {
      valid: false,
      normalized: trimmed,
      error: '網址中不可包含空白字元（請確認網域或 /exec 前方未留空）',
    };
  }
  if (/[^\x21-\x7E]/.test(trimmed)) {
    return {
      valid: false,
      normalized: trimmed,
      error: '網址不可包含中文或全形符號，請只輸入純英文網址（例如 https://.../exec）',
    };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, normalized: trimmed, error: '請以 https:// 開頭' };
    }
    if (!parsed.hostname || parsed.hostname.length < 3 || !parsed.hostname.includes('.')) {
      if (parsed.hostname !== 'localhost') {
        return { valid: false, normalized: trimmed, error: '網域名稱格式不完整' };
      }
    }
    return { valid: true, normalized: trimmed.replace(/\/+$/, '') };
  } catch {
    return {
      valid: false,
      normalized: trimmed,
      error: '網址格式無效，範例：https://script.google.com/macros/s/.../exec',
    };
  }
}

const LEGACY_DEPRECATED_GAS_EXEC_URL =
  'https://script.google.com/macros/s/AKfycbxMB3G4rw8h1SqJnlyoCgE7xuGn6Fpc2QSJa1m3xVzyVXosb10fXrWoHkf87_V0nxJb/exec';

export function getSavedExternalBaseUrl(): string {
  if (typeof window === 'undefined') return OFFICIAL_GAS_EXEC_URL;
  try {
    const saved = localStorage.getItem(SAVED_EXTERNAL_BASE_URL_KEY);
    if (saved && saved.trim() && saved.trim() !== LEGACY_DEPRECATED_GAS_EXEC_URL) {
      const check = validateExternalBaseUrl(saved);
      if (check.valid) return saved.trim();
    }
  } catch {
    // ignore storage error
  }
  return OFFICIAL_GAS_EXEC_URL;
}

export function saveExternalBaseUrl(rawUrl: string): {
  valid: boolean;
  savedUrl: string;
  error?: string;
} {
  const check = validateExternalBaseUrl(rawUrl);
  if (!check.valid) {
    return { valid: false, savedUrl: '', error: check.error };
  }
  try {
    localStorage.setItem(SAVED_EXTERNAL_BASE_URL_KEY, check.normalized);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(EXTERNAL_BASE_URL_UPDATED_EVENT, { detail: check.normalized })
      );
    }
  } catch {
    // ignore storage error
  }
  return { valid: true, savedUrl: check.normalized };
}

export function normalizeBaseUrlForQuery(baseUrl?: string): string {
  if (baseUrl && baseUrl.trim()) {
    const trimmed = baseUrl.trim().replace(/\/+$/, '');
    // Google Apps Script (/exec or /dev) and explicit HTML files must NOT get a trailing slash before '?'
    if (/\/(?:exec|dev)$/i.test(trimmed) || /\.html?$/i.test(trimmed)) {
      return trimmed;
    }
    return `${trimmed}/`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${window.location.pathname}`;
  }
  return '/';
}

/**
 * 產生指定身分的專屬網址（使用 ?portal=... Query Parameter，可選加 &device=mobile 與 &openExternalBrowser=1）
 */
export function buildRolePortalUrl(
  role: UserRole,
  customId?: string,
  baseUrl?: string,
  options?: { device?: 'mobile' | 'desktop'; openExternalBrowser?: boolean }
): string {
  const slug = PORTAL_SLUG_BY_ROLE[role];
  const originAndPath = normalizeBaseUrlForQuery(baseUrl);

  const params = new URLSearchParams();
  params.set('portal', slug);
  if (customId && customId.trim()) {
    params.set('id', customId.trim());
  }
  if (options?.device === 'mobile') {
    params.set('device', 'mobile');
  }
  if (options?.openExternalBrowser) {
    params.set('openExternalBrowser', '1');
  }

  return `${originAndPath}?${params.toString()}`;
}

/**
 * 產生「對外統一登入中心 — 手機專用網址」
 */
export function buildPublicMobileCenterUrl(
  baseUrl?: string,
  options?: { openExternalBrowser?: boolean }
): string {
  const originAndPath = normalizeBaseUrlForQuery(baseUrl);
  const params = new URLSearchParams();
  params.set('device', 'mobile');
  if (options?.openExternalBrowser) {
    params.set('openExternalBrowser', '1');
  }
  return `${originAndPath}?${params.toString()}`;
}

/**
 * 產生「免登入公開掃碼入會表單」專屬網址（自動帶入直推推薦人 MID）
 */
export function buildPublicJoinUrl(
  sponsorMid?: string,
  baseUrl?: string,
  options?: { device?: 'mobile' | 'desktop'; openExternalBrowser?: boolean }
): string {
  const originAndPath = normalizeBaseUrlForQuery(baseUrl || OFFICIAL_SHARED_APP_URL);
  const params = new URLSearchParams();
  params.set('portal', 'join');
  if (sponsorMid && sponsorMid.trim()) {
    params.set('sponsor', sponsorMid.trim().toUpperCase());
  }
  if (options?.device !== 'desktop') {
    params.set('device', 'mobile');
  }
  if (options?.openExternalBrowser) {
    params.set('openExternalBrowser', '1');
  }
  return `${originAndPath}?${params.toString()}`;
}

/**
 * 產生「獨立專屬早餐店智慧系統（月租 500 元 · 每代 1×5 分紅）」公開網址
 */
export function buildBreakfastPortalUrl(
  baseUrl?: string,
  options?: {
    device?: 'mobile' | 'desktop';
    openExternalBrowser?: boolean;
    shop?: string;
    table?: string;
    tab?: string;
  }
): string {
  const originAndPath = normalizeBaseUrlForQuery(baseUrl || OFFICIAL_SHARED_APP_URL);
  const params = new URLSearchParams();
  params.set('portal', 'breakfast');
  if (options?.tab && options.tab.trim()) {
    params.set('tab', options.tab.trim());
  }
  if (options?.shop && options.shop.trim()) {
    params.set('shop', options.shop.trim());
  }
  if (options?.table && options.table.trim()) {
    params.set('table', options.table.trim());
  }
  if (options?.device === 'mobile') {
    params.set('device', 'mobile');
  }
  if (options?.openExternalBrowser) {
    params.set('openExternalBrowser', '1');
  }
  return `${originAndPath}?${params.toString()}`;
}

/**
 * 使用 history.replaceState 同步瀏覽器網址列的專屬角色參數（不重新整理頁面）
 */
export function updateBrowserPortalUrl(role: UserRole | null, customId?: string): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  try {
    const url = new URL(window.location.href);
    if (role) {
      url.searchParams.set('portal', PORTAL_SLUG_BY_ROLE[role]);
      if (customId && customId.trim()) {
        url.searchParams.set('id', customId.trim());
      } else {
        url.searchParams.delete('id');
      }
    } else {
      url.searchParams.delete('portal');
      url.searchParams.delete('id');
      url.searchParams.delete('mid');
      url.searchParams.delete('storeId');
      url.searchParams.delete('centerId');
      url.searchParams.delete('staffId');
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // ignore history error in restricted environments
  }
}
