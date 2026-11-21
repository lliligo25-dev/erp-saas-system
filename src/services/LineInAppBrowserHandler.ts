/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { UserRole } from '../types/erp';
import {
  buildExternalBrowserUrl,
  detectLineInAppBrowser,
} from './rolePortalUrlService';

export type LineQrSourceType =
  | 'SYSTEM_SIGNED_PASS'
  | 'SYSTEM_PORTAL_URL'
  | 'LINE_JSON_CARD'
  | 'LINE_PROFILE_URL'
  | 'DIRECT_IDENTIFIER'
  | 'UNRECOGNIZED';

export interface LineQrParseOptions {
  lockedRole?: UserRole | null;
  allowHqQr?: boolean;
}

export interface LineQrParseResult {
  valid: boolean;
  sourceType: LineQrSourceType;
  role: UserRole;
  identifier: string;
  qrToken?: string;
  canInstantLogin: boolean;
  displayLabel: string;
  summaryText: string;
  rawPreview: string;
  error?: string;
}

function normalizeRoleSlug(raw?: string | null): UserRole | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (s === 'member') return 'MEMBER';
  if (s === 'store') return 'STORE';
  if (s === 'center') return 'CENTER';
  if (s === 'hq' || s === 'hq_staff') return 'HQ_STAFF';
  return null;
}

function inferRoleFromIdentifier(identifier: string, fallback: UserRole): UserRole {
  const upper = identifier.trim().toUpperCase();
  if (upper.startsWith('S-')) return 'STORE';
  if (upper.startsWith('EDU-')) return 'CENTER';
  if (upper.startsWith('A-') || upper.startsWith('C-') || /^09\d{8}$/.test(upper)) {
    return 'MEMBER';
  }
  return fallback;
}

function roleLabelZh(role: UserRole): string {
  switch (role) {
    case 'MEMBER':
      return '一般會員';
    case 'STORE':
      return '一般營業店';
    case 'CENTER':
      return '一般教育中心';
    case 'HQ_STAFF':
      return '總部人員';
  }
}

/**
 * 專用 LINE 掃碼 / LINE In-App Browser 解析處理器
 * 負責解析攝影鏡頭拍攝到的 LINE 會員 QR Code、專屬圖卡 URL 與簽章快速登入憑證，
 * 並強制執行入口身分隔離與環境偵測。
 */
export class LineInAppBrowserHandler {
  public static isInLineBrowser(): boolean {
    return detectLineInAppBrowser();
  }

  public static buildExternalBrowserHandoffUrl(rawUrl?: string): string {
    return buildExternalBrowserUrl(rawUrl);
  }

  public static hasMediaDevicesCameraSupport(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function')
    );
  }

  /**
   * 解析鏡頭拍攝到的 QR Code 原始文字資料
   */
  public static parseMemberQrData(
    rawInput: string,
    options: LineQrParseOptions = {}
  ): LineQrParseResult {
    const trimmed = (rawInput || '').trim();
    const rawPreview = trimmed.length > 72 ? `${trimmed.slice(0, 69)}...` : trimmed;
    const defaultRole: UserRole =
      options.lockedRole && options.lockedRole !== 'HQ_STAFF'
        ? options.lockedRole
        : options.lockedRole || 'MEMBER';

    if (!trimmed) {
      return {
        valid: false,
        sourceType: 'UNRECOGNIZED',
        role: defaultRole,
        identifier: '',
        canInstantLogin: false,
        displayLabel: '未偵測到內容',
        summaryText: '拍攝到的 QR Code 內容為空',
        rawPreview: '',
        error: 'QR Code 內容空白，請重新對準條碼拍攝。',
      };
    }

    const validateRolePolicy = (targetRole: UserRole): string | null => {
      if (targetRole === 'HQ_STAFF' && !options.allowHqQr) {
        return '對外公開登入入口不接受總部管理憑證掃碼，請使用總部安全驗證閘道。';
      }
      if (options.lockedRole && targetRole !== options.lockedRole) {
        return `目前鎖定為「${roleLabelZh(options.lockedRole)}」專屬入口，無法混用「${roleLabelZh(targetRole)}」的 QR Code。`;
      }
      return null;
    };

    // 1. 專屬緊湊協定格式：AIS_LINE_LOGIN::<ROLE>::<ID>::<QR_TOKEN>
    if (trimmed.startsWith('AIS_LINE_LOGIN::')) {
      const parts = trimmed.split('::');
      const role = normalizeRoleSlug(parts[1]) || defaultRole;
      const identifier = (parts[2] || '').trim();
      const qrToken = (parts[3] || '').trim();
      const policyError = validateRolePolicy(role);
      if (policyError) {
        return {
          valid: false,
          sourceType: 'SYSTEM_SIGNED_PASS',
          role,
          identifier,
          canInstantLogin: false,
          displayLabel: `${roleLabelZh(role)}憑證`,
          summaryText: policyError,
          rawPreview,
          error: policyError,
        };
      }
      if (qrToken && identifier) {
        return {
          valid: true,
          sourceType: 'SYSTEM_SIGNED_PASS',
          role,
          identifier,
          qrToken,
          canInstantLogin: true,
          displayLabel: `${roleLabelZh(role)}影像快速登入憑證`,
          summaryText: `識別到加密授權憑證 (${identifier})，正進行伺服器驗簽快速登入...`,
          rawPreview,
        };
      }
    }

    // 2. JSON 格式 LINE 會員卡 QR：{"mid":"A-00001","lineId":"...","role":"member","qrToken":"..."}
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        const rawRole = typeof parsed.role === 'string' ? parsed.role : null;
        const candidateId = [
          parsed.mid,
          parsed.id,
          parsed.memberId,
          parsed.userId,
          parsed.lineId,
          parsed.line,
          parsed.phone,
          parsed.storeId,
          parsed.centerId,
        ].find((v) => typeof v === 'string' && v.trim().length > 0) as string | undefined;

        const identifier = candidateId ? candidateId.trim() : '';
        const role =
          normalizeRoleSlug(rawRole) ||
          (identifier ? inferRoleFromIdentifier(identifier, defaultRole) : defaultRole);
        const qrToken =
          typeof parsed.qrToken === 'string' && parsed.qrToken.trim()
            ? parsed.qrToken.trim()
            : undefined;

        const policyError = validateRolePolicy(role);
        if (policyError) {
          return {
            valid: false,
            sourceType: 'LINE_JSON_CARD',
            role,
            identifier,
            canInstantLogin: false,
            displayLabel: `${roleLabelZh(role)}資料卡`,
            summaryText: policyError,
            rawPreview,
            error: policyError,
          };
        }

        if (identifier || qrToken) {
          return {
            valid: true,
            sourceType: qrToken ? 'SYSTEM_SIGNED_PASS' : 'LINE_JSON_CARD',
            role,
            identifier,
            qrToken,
            canInstantLogin: Boolean(qrToken),
            displayLabel: `LINE 會員卡資料 (${roleLabelZh(role)})`,
            summaryText: qrToken
              ? `已解析 LINE 會員卡 (${identifier || roleLabelZh(role)}) 加密憑證，啟動影像快速登入。`
              : `已識別 LINE 會員帳號「${identifier}」，請輸入驗證密碼完成登入。`,
            rawPreview,
          };
        }
      } catch {
        // Not valid JSON, continue checking URL / text patterns
      }
    }

    // 3. URL 格式：包含本系統掃碼網址 (?portal=...&id=...&qrToken=...) 或 LINE 官方 URL (line.me / liff.line.me / line://)
    if (
      /^https?:\/\//i.test(trimmed) ||
      /^line:\/\//i.test(trimmed)
    ) {
      try {
        const normalizedUrl = trimmed.replace(/^line:\/\//i, 'https://line.me/');
        const url = new URL(normalizedUrl);
        const hostname = url.hostname.toLowerCase();

        // 3a. 本系統專屬入口 URL 或含 qrToken 簽章 URL
        const portalParam = url.searchParams.get('portal');
        const qrTokenParam = url.searchParams.get('qrToken') || url.searchParams.get('token');
        const idParam =
          url.searchParams.get('id') ||
          url.searchParams.get('mid') ||
          url.searchParams.get('lineId') ||
          url.searchParams.get('line') ||
          url.searchParams.get('storeId') ||
          url.searchParams.get('centerId') ||
          url.searchParams.get('phone');

        if (portalParam || qrTokenParam || idParam) {
          const parsedRole =
            normalizeRoleSlug(portalParam) ||
            (idParam ? inferRoleFromIdentifier(idParam, defaultRole) : defaultRole);
          const identifier = idParam ? idParam.trim() : '';
          const qrToken = qrTokenParam && qrTokenParam.trim() ? qrTokenParam.trim() : undefined;
          const policyError = validateRolePolicy(parsedRole);
          if (policyError) {
            return {
              valid: false,
              sourceType: qrToken ? 'SYSTEM_SIGNED_PASS' : 'SYSTEM_PORTAL_URL',
              role: parsedRole,
              identifier,
              canInstantLogin: false,
              displayLabel: `${roleLabelZh(parsedRole)}掃碼網址`,
              summaryText: policyError,
              rawPreview,
              error: policyError,
            };
          }

          if (qrToken || identifier) {
            return {
              valid: true,
              sourceType: qrToken ? 'SYSTEM_SIGNED_PASS' : 'SYSTEM_PORTAL_URL',
              role: parsedRole,
              identifier,
              qrToken,
              canInstantLogin: Boolean(qrToken),
              displayLabel: qrToken
                ? `${roleLabelZh(parsedRole)}快速登入憑證 QR`
                : `${roleLabelZh(parsedRole)}專屬掃碼網址`,
              summaryText: qrToken
                ? `已識別加密快速登入憑證（${identifier || roleLabelZh(parsedRole)}），正在直接登入...`
                : `已識別專屬帳號「${identifier}」，請輸入安全驗證密碼進入。`,
              rawPreview,
            };
          }
        }

        // 3b. LINE 官方條碼網址：line.me/ti/p/~line_id 或 line.me/R/ti/p/@line_id
        if (hostname === 'line.me' || hostname.endsWith('.line.me')) {
          const pathMatch = url.pathname.match(/\/(?:R\/)?ti\/p\/([^/?#]+)/i);
          if (pathMatch && pathMatch[1]) {
            const segment = decodeURIComponent(pathMatch[1]).trim();
            if (segment.startsWith('~') || segment.startsWith('@')) {
              const extractedId = segment.startsWith('~') ? segment.slice(1) : segment;
              const role = options.lockedRole || 'MEMBER';
              return {
                valid: true,
                sourceType: 'LINE_PROFILE_URL',
                role,
                identifier: extractedId,
                canInstantLogin: false,
                displayLabel: 'LINE 個人 / 官方 ID 掃碼',
                summaryText: `已從 LINE QR Code 解析識別 ID「${extractedId}」，請輸入密碼完成驗證。`,
                rawPreview,
              };
            }
            // LINE 官方匿名雜湊加好友碼 (例如 /ti/p/9xK3mP...) 並未揭露明文 LINE ID
            return {
              valid: false,
              sourceType: 'LINE_PROFILE_URL',
              role: defaultRole,
              identifier: '',
              canInstantLogin: false,
              displayLabel: 'LINE 加密加好友條碼',
              summaryText:
                '此為 LINE 加密加好友短網址，未包含系統會員 MID 或加密憑證；請改掃描會員工作台產製的「專屬 QR Code 圖卡」。',
              rawPreview,
              error:
                '此 QR Code 為 LINE 一般加好友短碼（不含會員帳號資訊），請掃描會員個人專屬 QR Code 圖卡或直接輸入 MID。',
            };
          }
        }
      } catch {
        // Fallback to text parsers below
      }
    }

    // 4. Key-value 或前綴文字格式：LINE:xxx / MID:A-00001 / @lineId / A-00001 / 09xxxxxxxx
    const prefixMatch = trimmed.match(/^(?:LINE|LINEID|MID|ID)\s*[:=]\s*(.+)$/i);
    const directCandidate = (prefixMatch ? prefixMatch[1] : trimmed).trim();

    if (
      /^[AS]-?[A-Z0-9-]+$/i.test(directCandidate) ||
      /^EDU-[A-Z0-9-]+$/i.test(directCandidate) ||
      /^09\d{8}$/.test(directCandidate) ||
      /^@[a-zA-Z0-9._-]{2,}$/.test(directCandidate) ||
      /^[a-zA-Z0-9._-]{3,40}$/.test(directCandidate)
    ) {
      const inferredRole = options.lockedRole
        ? options.lockedRole
        : inferRoleFromIdentifier(directCandidate, 'MEMBER');
      const policyError = validateRolePolicy(inferredRole);
      if (policyError) {
        return {
          valid: false,
          sourceType: 'DIRECT_IDENTIFIER',
          role: inferredRole,
          identifier: directCandidate,
          canInstantLogin: false,
          displayLabel: '編號識別結果',
          summaryText: policyError,
          rawPreview,
          error: policyError,
        };
      }
      return {
        valid: true,
        sourceType: 'DIRECT_IDENTIFIER',
        role: inferredRole,
        identifier: directCandidate,
        canInstantLogin: false,
        displayLabel: '直接識別帳號 / LINE ID',
        summaryText: `已識別帳號「${directCandidate}」，請輸入安全驗證密碼完成登入。`,
        rawPreview,
      };
    }

    return {
      valid: false,
      sourceType: 'UNRECOGNIZED',
      role: defaultRole,
      identifier: '',
      canInstantLogin: false,
      displayLabel: '無法識別的 QR Code 格式',
      summaryText: `掃描內容（${rawPreview}）非本系統會員 QR Code 或 LINE ID。`,
      rawPreview,
      error: '掃描到的條碼格式與會員帳號或快速登入憑證不相符，請改掃描會員專屬 QR Code。',
    };
  }
}
