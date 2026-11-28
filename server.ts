/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { serverErpEngine } from './server/services/erpCoreEngine.ts';
import {
  GOOGLE_APPS_SCRIPT_CODE,
  GOOGLE_SHEETS_SCHEMA_DOCS,
} from './server/services/gasCodeGenerator.ts';
import {
  clearSessionCookie,
  getRequestSession,
  setSessionCookie,
  signSessionToken,
  verifyRolePasscode,
  signQrLoginToken,
  verifyQrLoginToken,
} from './server/authSecurity.ts';
import {
  fetchGasHydrationState,
  forwardErpEventToGas,
  getGasBridgeState,
  pingGasBridge,
  provisionMemberCloudWorkspaceViaGas,
  sendHqDbMutationToGas,
  setGasHydrationStatus,
  updateGasBridgeConfig,
  type GasHydrationStatus,
} from './server/services/gasBridgeForwarder.ts';
import { buildProjectSourceZip } from './server/services/projectZipExporter.ts';
import type { AuthSession, UserRole } from './src/types/erp.ts';

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

// Simple in-memory login rate limiter (brute-force protection)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
// Dedicated public registration rate limiter (spam protection: max 10 / 10 mins per IP)
const publicRegisterAttempts = new Map<string, { count: number; resetAt: number }>();

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 25) {
    return false;
  }
  entry.count += 1;
  return true;
}

function checkPublicRegisterRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = publicRegisterAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    publicRegisterAttempts.set(ip, { count: 1, resetAt: now + 600_000 });
    return true;
  }
  if (entry.count >= 10) {
    return false;
  }
  entry.count += 1;
  return true;
}

function sanitizePublicText(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

const ALLOWED_WORKSPACE_PACKS = new Set([
  'CONTACT',
  'EVENT',
  'BOOKING',
  'TODO',
  'ATOMY',
  'ELDER',
  'PRODUCT',
  'FRUIT',
  'GROCERY',
  'NAIL',
  'ASSOC',
  'TCM',
]);

const ALLOWED_PROFESSION_KEYS = new Set([
  'TCM_THERAPIST',
  'BREAKFAST_OWNER',
  'NAIL_BEAUTY',
  'FRUIT_SHOP',
  'ECOMMERCE_SELLER',
  'ATOMY_LEADER',
  'ASSOC_OFFICER',
  'ELDER_CARE',
]);

const ALLOWED_SUB_STATUS = new Set([
  'NOT_ORDERED',
  'TRIAL_ACTIVE',
  'ACTIVE_RENEWED',
  'EXPIRED_FROZEN',
]);

function sanitizeWorkspaceSubscriptions(raw: unknown): Record<string, Record<string, any>> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, Record<string, any>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!k || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    const modKey = k.trim().toUpperCase();
    if (!ALLOWED_WORKSPACE_PACKS.has(modKey)) continue;
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const obj = v as Record<string, unknown>;
    const statusRaw = typeof obj.status === 'string' ? obj.status.trim().toUpperCase() : 'NOT_ORDERED';
    const status = ALLOWED_SUB_STATUS.has(statusRaw) ? statusRaw : 'NOT_ORDERED';
    const cleanSub: Record<string, any> = {
      moduleKey: modKey,
      licenseCode: sanitizePublicText(obj.licenseCode, 60) || `SW-${modKey}`,
      status,
      monthlyRentNtd: Math.max(0, Math.min(100000, Number(obj.monthlyRentNtd ?? 100) || 100)),
      totalRenewalsCount: Math.max(0, Math.min(9999, Number(obj.totalRenewalsCount ?? 0) || 0)),
    };
    if (typeof obj.activatedAt === 'string' && obj.activatedAt.trim()) {
      cleanSub.activatedAt = sanitizePublicText(obj.activatedAt, 40);
    }
    if (typeof obj.expiresAt === 'string' && obj.expiresAt.trim()) {
      cleanSub.expiresAt = sanitizePublicText(obj.expiresAt, 40);
    }
    if (typeof obj.lastSettlementTxnId === 'string' && obj.lastSettlementTxnId.trim()) {
      cleanSub.lastSettlementTxnId = sanitizePublicText(obj.lastSettlementTxnId, 60);
    }
    if (typeof obj.binaryNodeId === 'string' && obj.binaryNodeId.trim()) {
      cleanSub.binaryNodeId = sanitizePublicText(obj.binaryNodeId, 32).toUpperCase();
    }
    if (typeof obj.binaryParentId === 'string' && obj.binaryParentId.trim()) {
      cleanSub.binaryParentId = sanitizePublicText(obj.binaryParentId, 32).toUpperCase();
    }
    if (obj.binaryPosition === 'L' || obj.binaryPosition === 'R' || obj.binaryPosition === 'ROOT') {
      cleanSub.binaryPosition = obj.binaryPosition;
    }
    if (typeof obj.binaryDepth === 'number' && Number.isFinite(obj.binaryDepth)) {
      cleanSub.binaryDepth = Math.max(0, Math.min(100, Math.floor(obj.binaryDepth)));
    }
    if (Array.isArray(obj.extraBinaryNodeIds)) {
      const extras = obj.extraBinaryNodeIds
        .slice(0, 20)
        .map((id) => sanitizePublicText(id, 32).toUpperCase())
        .filter(Boolean);
      if (extras.length > 0) cleanSub.extraBinaryNodeIds = extras;
    }
    out[modKey] = cleanSub;
  }
  return out;
}

function sanitizeWorkspaceCustomModules(raw: unknown): Array<Record<string, any>> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Array<Record<string, any>> = [];
  const seen = new Set<string>();
  for (const item of raw.slice(0, 30)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const obj = item as Record<string, unknown>;
    const baseKey = sanitizePublicText(obj.baseKey, 32).toUpperCase();
    if (!/^[A-Z0-9_]{3,32}$/.test(baseKey) || seen.has(baseKey)) continue;
    const title = sanitizePublicText(obj.title, 40);
    if (!title) continue;
    seen.add(baseKey);
    const cats = Array.isArray(obj.cats)
      ? obj.cats
          .slice(0, 15)
          .map((c) => sanitizePublicText(c, 24))
          .filter(Boolean)
      : ['進行中', '待追蹤', '已完成'];
    const iconColor = sanitizePublicText(obj.iconColor, 32);
    const safeColor = /^text-[a-z]+-\d{3}$/.test(iconColor) ? iconColor : 'text-indigo-600';
    out.push({
      baseKey,
      title,
      cats: cats.length > 0 ? cats : ['進行中', '待追蹤', '已完成'],
      nameFieldLabel: sanitizePublicText(obj.nameFieldLabel, 24) || '項目名稱',
      iconColor: safeColor,
      createdAt: sanitizePublicText(obj.createdAt, 40) || new Date().toISOString(),
    });
  }
  return out;
}

function sanitizeWorkspaceOrderReceipts(raw: unknown): Array<Record<string, any>> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Array<Record<string, any>> = [];
  const seen = new Set<string>();
  for (const item of raw.slice(0, 35)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const obj = item as Record<string, unknown>;
    const orderId = sanitizePublicText(obj.orderId, 40);
    if (!orderId || seen.has(orderId)) continue;
    seen.add(orderId);
    const items = Array.isArray(obj.items)
      ? obj.items.slice(0, 15).map((it: any) => ({
          moduleKey: sanitizePublicText(it?.moduleKey, 24).toUpperCase(),
          title: sanitizePublicText(it?.title, 48),
          codeLabel: sanitizePublicText(it?.codeLabel, 48),
          action:
            it?.action === 'PAID_RENEWAL' || it?.action === 'NEW_BINARY_SEAT'
              ? it.action
              : 'TRIAL_ACTIVATE',
          amountNtd: Math.max(0, Math.min(1000000, Number(it?.amountNtd || 0) || 0)),
          newExpiresAt: sanitizePublicText(it?.newExpiresAt, 40),
          settlementTxnId: sanitizePublicText(it?.settlementTxnId, 48) || undefined,
          binaryNodeId: sanitizePublicText(it?.binaryNodeId, 32).toUpperCase() || undefined,
          binaryParentId: sanitizePublicText(it?.binaryParentId, 32).toUpperCase() || undefined,
          binaryPosition:
            it?.binaryPosition === 'L' || it?.binaryPosition === 'R' || it?.binaryPosition === 'ROOT'
              ? it.binaryPosition
              : undefined,
          binaryDepth:
            typeof it?.binaryDepth === 'number' && Number.isFinite(it.binaryDepth)
              ? Math.max(0, Math.min(100, Math.floor(it.binaryDepth)))
              : undefined,
          isNewBinaryNode: Boolean(it?.isNewBinaryNode),
        }))
      : [];
    out.push({
      orderId,
      memberMid: sanitizePublicText(obj.memberMid, 24).toUpperCase(),
      items,
      totalAmountNtd: Math.max(0, Math.min(10000000, Number(obj.totalAmountNtd || 0) || 0)),
      settlementBreakdowns: [],
      createdAt: sanitizePublicText(obj.createdAt, 40) || new Date().toISOString(),
    });
  }
  return out;
}

function sanitizePhotoUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.length > 250_000) return '';
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(trimmed)) {
    return trimmed.replace(/\s+/g, '');
  }
  if (trimmed.length <= 2048) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return trimmed;
      }
    } catch {
      return '';
    }
  }
  return '';
}

function sanitizeWorkspaceRecord(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > 40) return null;
  for (const [k, v] of entries) {
    if (!k || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    const key = k.slice(0, 64);
    if (key === '照片連結' || key === 'photoUrl') {
      out[key] = sanitizePhotoUrl(v);
      continue;
    }
    if (typeof v === 'string') {
      out[key] = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, 4000);
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      out[key] = String(v);
    }
  }
  return out;
}

function canAccessMemberWorkspace(session: AuthSession, targetMid: string): boolean {
  const normTarget = targetMid.trim().toUpperCase();
  if (!normTarget) return false;
  if (session.role === 'HQ_STAFF') return true;
  if (session.role === 'MEMBER') {
    return session.userId.trim().toUpperCase() === normTarget;
  }
  return false;
}

let activeHydrationPromise: Promise<GasHydrationStatus> | null = null;
let lastHydrationSuccessAt = 0;
let lastHydrationAttemptAt = 0;

async function hydrateEngineFromGas(trigger: 'startup' | 'manual'): Promise<GasHydrationStatus> {
  lastHydrationAttemptAt = Date.now();
  const fetched = await fetchGasHydrationState();
  const nowIso = new Date().toISOString();
  if (!fetched.ok || !fetched.data) {
    const failed: GasHydrationStatus = {
      ok: false,
      message: fetched.error || '無法從 GAS 試算表回讀資料',
      timestamp: nowIso,
      importedMembers: 0,
      importedMonoline: 0,
      importedBinary: 0,
      importedContacts: 0,
      importedTrackings: 0,
    };
    setGasHydrationStatus(failed);
    if (trigger === 'startup') {
      console.log(`[GAS Cold-Start Hydration] Skipped/Waiting: ${failed.message}`);
    }
    return failed;
  }

  const counts = serverErpEngine.hydrateFromGasExport(fetched.data);
  lastHydrationSuccessAt = Date.now();
  const status: GasHydrationStatus = {
    ok: true,
    spreadsheetName: fetched.data.spreadsheetName,
    message: `✅ 已從試算表「${fetched.data.spreadsheetName || 'Google Sheets'}」回讀 ${counts.importedMembers} 位會員、${counts.importedMonoline} 個單軌節點、${counts.importedBinary} 個雙軌節點`,
    timestamp: nowIso,
    ...counts,
  };
  setGasHydrationStatus(status);
  console.log(`[GAS Hydration (${trigger})] ${status.message}`);
  return status;
}

function triggerSharedHydration(trigger: 'startup' | 'manual'): Promise<GasHydrationStatus> {
  if (!activeHydrationPromise) {
    activeHydrationPromise = hydrateEngineFromGas(trigger).finally(() => {
      activeHydrationPromise = null;
    });
  }
  return activeHydrationPromise;
}

/**
 * 防止 Render 免費主機休眠喚醒（開機）瞬間，尚未從 Google Sheets 回讀完畢就回傳空白已開通清單
 */
async function ensureHydratedBeforeRead(maxWaitMs = 5500): Promise<void> {
  if (lastHydrationSuccessAt > 0) return;
  let promise = activeHydrationPromise;
  if (!promise && Date.now() - lastHydrationAttemptAt > 20_000) {
    promise = triggerSharedHydration('startup');
  }
  if (!promise) return;
  await Promise.race([
    promise,
    new Promise<void>((resolve) => setTimeout(resolve, maxWaitMs)),
  ]);
}

interface AuthedRequest extends Request {
  erpSession?: AuthSession;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const session = getRequestSession(req);
  if (!session) {
    res.status(401).json({ error: '未授權：請先完成身分驗證登入' });
    return;
  }
  req.erpSession = session;
  next();
}

function requireHqRole(req: AuthedRequest, res: Response, next: NextFunction) {
  const session = getRequestSession(req);
  if (!session) {
    res.status(401).json({ error: '未授權：請先登入總部系統' });
    return;
  }
  if (session.role !== 'HQ_STAFF') {
    res.status(403).json({ error: '權限不足：僅總部授權人員可存取此機密介面' });
    return;
  }
  req.erpSession = session;
  next();
}

function verifyHqMutationOrigin(req: Request, res: Response, next: NextFunction) {
  // Accept explicit custom header or same-origin Origin header to block cross-site cookie mutations
  const hasCustomHeader = req.headers['x-requested-with'] === 'XMLHttpRequest' || Boolean(req.headers.authorization);
  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
  let originMatchesHost = false;
  if (typeof origin === 'string' && origin && host) {
    try {
      originMatchesHost = new URL(origin).host === host;
    } catch {
      originMatchesHost = false;
    }
  }
  if (!hasCustomHeader && !originMatchesHost) {
    res.status(403).json({ ok: false, error: '來源驗證失敗，已拒絕未經授權的跨站寫入請求' });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10mb' }));

  // Basic security headers (compatible with AI Studio preview iframe)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ ok: true, securityMode: 'SERVER_CONFIDENTIAL_SEPARATION' });
  });

  // 0. Public Unauthenticated Onboarding Routes (Strict Input Validation + Rate Limit, Zero PII Leakage)
  app.get('/api/public/sponsor-info', (req, res) => {
    const rawSponsor = typeof req.query.sponsor === 'string' ? req.query.sponsor : '';
    const info = serverErpEngine.getPublicSponsorInfo(sanitizePublicText(rawSponsor, 24));
    res.json({ ok: true, ...info });
  });

  app.post('/api/public/register', (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (!checkPublicRegisterRateLimit(clientIp)) {
      res.status(429).json({
        ok: false,
        error: '短時間內送出次數過多，請稍候 10 分鐘再試或聯繫您的推薦人協助。',
      });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const name = sanitizePublicText(body.name, 50);
    const phone = sanitizePublicText(body.phone, 20);
    const tel = sanitizePublicText(body.tel, 25);
    const line = sanitizePublicText(body.line, 50);
    const email = sanitizePublicText(body.email, 100);
    const address = sanitizePublicText(body.address, 150);
    const idNumberMasked = sanitizePublicText(body.idNumberMasked, 20);
    const rawSponsor = sanitizePublicText(body.sponsorMid, 24).toUpperCase();
    const storeId = sanitizePublicText(body.storeId, 30) || 'S-TAIPEI-01';
    const centerId = sanitizePublicText(body.centerId, 30) || 'EDU-GLOBAL-01';
    const activateBookingSystem = body.activateBookingSystem !== false;

    if (!name || name.length < 1) {
      res.status(400).json({ ok: false, error: '請填寫您的真實姓名' });
      return;
    }
    const phoneDigits = phone.replace(/[\s\-+()]/g, '');
    if (!phoneDigits || !/^\d{8,15}$/.test(phoneDigits)) {
      res.status(400).json({ ok: false, error: '請輸入正確的手機號碼（例如 0912345678）' });
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ ok: false, error: 'Email 格式不正確，請重新確認或留空' });
      return;
    }

    const sponsorInfo = serverErpEngine.getPublicSponsorInfo(rawSponsor);

    try {
      const result = serverErpEngine.registerNewMember({
        name,
        phone,
        tel,
        line,
        email,
        address,
        idNumberMasked,
        sponsorMid: sponsorInfo.sponsorMid,
        storeId,
        centerId,
        discussionContent: `公開掃碼自助入會開通 AI 軟體 1+1（推薦人：${sponsorInfo.sponsorMid}）`,
        nextStepPlan: '使用核發的會員編號登入個人工作台，開始 30 天免費體驗',
        activateBookingSystem,
      });

      void forwardErpEventToGas('register', {
        mid: result.member.mid,
        name: result.member.name,
        phone: result.member.phone,
        tel: result.member.tel,
        line: result.member.line,
        email: result.member.email,
        address: result.member.address,
        photoUrl: result.member.photoUrl,
        idNumberMasked: result.member.idNumberMasked,
        sponsorMid: result.member.sponsorMid,
        storeId: result.member.storeId,
        centerId: result.member.centerId,
        registeredAt: result.member.registeredAt,
        trialExpiresAt: result.member.trialExpiresAt,
        monolineNodeId: result.monolineNode?.nodeId || result.member.monolineNodeId,
        monolineParentId: result.monolineNode?.parentId,
        monolineDepth: result.monolineNode?.depth,
        binaryNodeId: result.binaryNode?.nodeId || result.member.binaryNodeId,
        binaryParentId: result.binaryNode?.parentId,
        binaryPosition: result.binaryNode?.placementPosition,
        binaryDepth: result.binaryNode?.depth,
        contactId: result.contact?.id || result.member.contactId,
        trackingId: result.contactTracking?.id,
        discussionContent: result.contactTracking?.discussionContent,
        nextStepPlan: result.contactTracking?.nextStepPlan,
      });

      res.json({
        ok: true,
        registration: {
          mid: result.member.mid,
          name: result.member.name,
          phone: result.member.phone,
          sponsorMid: result.member.sponsorMid,
          monolineNodeId: result.monolineNode.nodeId,
          binaryNodeId: result.binaryNode.nodeId,
          trialExpiresAt: result.member.trialExpiresAt,
          bookingLicenseId: result.bookingProfile?.licenseId || null,
        },
        message: '恭喜您完成開通！系統已核發您的專屬會員編號與 1+1 AI 軟體 30 天體驗資格。',
      });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err?.message || '入會開通處理失敗，請稍後再試' });
    }
  });

  // 1. Server-side Confidential Authentication
  app.post('/api/auth/login', async (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (!checkLoginRateLimit(clientIp)) {
      res.status(429).json({ success: false, error: '嘗試登入次數過多，請稍後再試' });
      return;
    }

    const { role, identifier, passcode } = (req.body || {}) as {
      role?: UserRole;
      identifier?: string;
      passcode?: string;
    };

    if (!role || !['HQ_STAFF', 'MEMBER', 'STORE', 'CENTER'].includes(role)) {
      res.status(400).json({ success: false, error: '無效的身分角色' });
      return;
    }
    if (!identifier || !identifier.trim()) {
      res.status(400).json({ success: false, error: '請輸入帳號 / 專屬編號' });
      return;
    }
    if (!passcode || !passcode.trim()) {
      res.status(401).json({ success: false, error: '請輸入安全驗證密碼' });
      return;
    }

    // Enforce strict server-side scrypt passcode verification for ALL roles first
    if (!verifyRolePasscode(role, passcode.trim())) {
      res.status(401).json({
        success: false,
        error: '帳號或安全驗證密碼不正確',
      });
      return;
    }

    await ensureHydratedBeforeRead();

    const authResult = serverErpEngine.authenticateRole(role, identifier.trim(), passcode.trim());
    if (!authResult.success || !authResult.session) {
      res.status(401).json({
        success: false,
        error: authResult.error || '帳號或安全密碼驗證失敗',
      });
      return;
    }

    setSessionCookie(req, res, authResult.session);
    const ephemeralToken = signSessionToken(authResult.session);
    const bootstrap = serverErpEngine.getScopedBootstrap(authResult.session);
    res.json({
      success: true,
      session: authResult.session,
      ephemeralToken,
      bootstrap,
    });
  });

  // 2. Restore Authenticated Session + Role-Scoped Data
  app.get('/api/auth/session', async (req, res) => {
    const session = getRequestSession(req);
    if (!session) {
      res.json({ authenticated: false, session: null, bootstrap: null });
      return;
    }

    const requestedPortalRole =
      typeof req.query.portalRole === 'string' ? req.query.portalRole : null;
    if (requestedPortalRole && requestedPortalRole !== session.role) {
      // Strict role isolation across dedicated portal URLs
      res.json({ authenticated: false, session: null, bootstrap: null });
      return;
    }

    await ensureHydratedBeforeRead();

    const bootstrap = serverErpEngine.getScopedBootstrap(session);
    res.json({
      authenticated: true,
      session,
      bootstrap,
    });
  });

  // 3. Logout
  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ success: true });
  });

  // 3b. Issue Scoped Signed QR Quick-Login Token for Authenticated Member/Store/Center/HQ
  app.get('/api/auth/qr-pass', requireAuth, (req: AuthedRequest, res) => {
    const session = req.erpSession!;
    const qrToken = signQrLoginToken(session);
    res.json({
      ok: true,
      qrToken,
      role: session.role,
      userId: session.userId,
      expiresInDays: 30,
    });
  });

  // 3c. Verify Scanned QR Quick-Login Token and Establish Authenticated Session
  app.post('/api/auth/qr-login', (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (!checkLoginRateLimit(clientIp)) {
      res.status(429).json({ success: false, error: '嘗試驗證次數過多，請稍後再試' });
      return;
    }

    const { qrToken, expectedRole } = (req.body || {}) as {
      qrToken?: string;
      expectedRole?: UserRole | null;
    };

    const verified = verifyQrLoginToken(qrToken);
    if (!verified) {
      res.status(401).json({
        success: false,
        error: 'QR Code 快速登入憑證無效或已過期，請重新產製專屬憑證或改用密碼登入',
      });
      return;
    }

    if (expectedRole && expectedRole !== verified.role) {
      res.status(403).json({
        success: false,
        error: '身分隔離限制：此 QR Code 所屬身分與目前登入入口不符',
      });
      return;
    }

    const authResult = serverErpEngine.authenticateRole(verified.role, verified.userId);
    if (!authResult.success || !authResult.session) {
      res.status(401).json({
        success: false,
        error: authResult.error || '無法識別對應的會員或服務帳號',
      });
      return;
    }

    setSessionCookie(req, res, authResult.session);
    const ephemeralToken = signSessionToken(authResult.session);
    const bootstrap = serverErpEngine.getScopedBootstrap(authResult.session);
    res.json({
      success: true,
      session: authResult.session,
      ephemeralToken,
      bootstrap,
    });
  });

  // 4. HQ-Only Trade Secret Endpoint: Apps Script Source Code & Schema Docs
  app.get('/api/hq/gas-code', requireHqRole, (_req, res) => {
    res.json({
      code: GOOGLE_APPS_SCRIPT_CODE,
      schemaDocs: GOOGLE_SHEETS_SCHEMA_DOCS,
    });
  });

  // 4a. HQ-Only Full Project Source ZIP Export (Includes latest ready-to-paste Code.gs; excludes secrets, node_modules, dist, runtime state)
  app.get('/api/hq/download-project-zip', requireHqRole, (_req, res) => {
    try {
      const { buffer, fileCount } = buildProjectSourceZip(process.cwd(), [
        { relPath: 'Code.gs', content: GOOGLE_APPS_SCRIPT_CODE },
      ]);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="erp-saas-system.zip"');
      res.setHeader('X-Exported-File-Count', String(fileCount));
      res.setHeader('Content-Length', String(buffer.length));
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || '產生專案壓縮檔失敗' });
    }
  });

  // 4a-2. HQ-Only Direct Download of Latest Code.gs (.gs)
  app.get('/api/hq/download-gas-code', requireHqRole, (_req, res) => {
    try {
      const buf = Buffer.from(GOOGLE_APPS_SCRIPT_CODE, 'utf8');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="Code.gs"');
      res.setHeader('Content-Length', String(buf.length));
      res.send(buf);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || '產生最新 Code.gs 失敗' });
    }
  });

  // 4b. HQ-Only Server-to-GAS /exec Bidirectional Bridge Config & Live Ping
  app.get('/api/hq/gas-bridge', requireHqRole, (_req, res) => {
    res.json({ ok: true, state: getGasBridgeState() });
  });

  app.post('/api/hq/gas-bridge', requireHqRole, async (req: AuthedRequest, res) => {
    const { gasWebAppUrl, autoSyncEnabled, testPing, hydrateNow } = (req.body || {}) as {
      gasWebAppUrl?: string;
      autoSyncEnabled?: boolean;
      testPing?: boolean;
      hydrateNow?: boolean;
    };
    const updated = updateGasBridgeConfig({ gasWebAppUrl, autoSyncEnabled });
    if (!updated.ok) {
      res.status(400).json({ ok: false, error: updated.error, state: updated.state });
      return;
    }
    const pingResult = testPing ? await pingGasBridge() : null;
    const hydrationResult = hydrateNow ? await hydrateEngineFromGas('manual') : null;
    const bootstrap =
      hydrateNow && req.erpSession
        ? serverErpEngine.getScopedBootstrap(req.erpSession)
        : undefined;
    res.json({
      ok: true,
      state: getGasBridgeState(),
      pingResult,
      hydrationResult,
      bootstrap,
    });
  });

  // 4c. HQ Super Admin Database Direct Editor Routes (Strict HQ RBAC + Origin Guard + Audit Trail + GAS Writeback)
  app.get('/api/hq/db/overview', requireHqRole, (_req, res) => {
    const overview = serverErpEngine.getHqDbOverview();
    res.json({
      ok: true,
      ...overview,
      gasBridge: getGasBridgeState(),
    });
  });

  app.patch('/api/hq/db/member/:mid', requireHqRole, verifyHqMutationOrigin, async (req: AuthedRequest, res) => {
    const session = req.erpSession!;
    const targetMid = String(req.params.mid || '').trim().toUpperCase();
    try {
      const { member, auditEntry } = serverErpEngine.hqUpdateMember(
        targetMid,
        (req.body || {}) as Record<string, unknown>,
        { userId: session.userId, displayName: session.displayName }
      );
      const gasSync = await sendHqDbMutationToGas('hqUpdateMember', {
        mid: member.mid,
        name: member.name,
        phone: member.phone,
        idNumberMasked: member.idNumberMasked,
        sponsorMid: member.sponsorMid,
        storeId: member.storeId,
        centerId: member.centerId,
        trialExpiresAt: member.trialExpiresAt,
        accumulatedRentAmount: member.accumulatedRentAmount,
        tel: member.tel,
        line: member.line,
        email: member.email,
        address: member.address,
      });
      serverErpEngine.updateAuditLogGasSync(auditEntry.id, gasSync.ok, gasSync.message);
      const overview = serverErpEngine.getHqDbOverview();
      const bootstrap = serverErpEngine.getScopedBootstrap(session);
      res.json({
        ok: true,
        member,
        gasSync,
        overview,
        bootstrap,
      });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err?.message || '修改會員資料失敗' });
    }
  });

  app.delete('/api/hq/db/member/:mid', requireHqRole, verifyHqMutationOrigin, async (req: AuthedRequest, res) => {
    const session = req.erpSession!;
    const targetMid = String(req.params.mid || '').trim().toUpperCase();
    const deleteLinkedNodes =
      req.query.deleteLinkedNodes === 'true' || Boolean((req.body || {}).deleteLinkedNodes);
    try {
      const deleted = serverErpEngine.hqDeleteMember(
        targetMid,
        { deleteLinkedNodes },
        { userId: session.userId, displayName: session.displayName }
      );
      const gasSync = await sendHqDbMutationToGas('hqDeleteMember', {
        mid: deleted.deletedMid,
        deleteLinkedNodes,
        deletedMonolineIds: deleted.deletedMonolineIds,
        deletedBinaryIds: deleted.deletedBinaryIds,
      });
      serverErpEngine.updateAuditLogGasSync(deleted.auditEntry.id, gasSync.ok, gasSync.message);
      const overview = serverErpEngine.getHqDbOverview();
      const bootstrap = serverErpEngine.getScopedBootstrap(session);
      res.json({
        ok: true,
        deleted,
        gasSync,
        overview,
        bootstrap,
      });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err?.message || '刪除會員資料失敗' });
    }
  });

  app.patch('/api/hq/db/node/:track/:nodeId', requireHqRole, verifyHqMutationOrigin, async (req: AuthedRequest, res) => {
    const session = req.erpSession!;
    const rawTrack = String(req.params.track || '').trim().toUpperCase();
    if (rawTrack !== 'MONOLINE' && rawTrack !== 'BINARY') {
      res.status(400).json({ ok: false, error: '無效的軌道類型（僅支援 MONOLINE 或 BINARY）' });
      return;
    }
    const targetNodeId = String(req.params.nodeId || '').trim().toUpperCase();
    try {
      const { node, auditEntry } = serverErpEngine.hqUpdateNode(
        rawTrack,
        targetNodeId,
        (req.body || {}) as Record<string, unknown>,
        { userId: session.userId, displayName: session.displayName }
      );
      const gasSync = await sendHqDbMutationToGas('hqUpdateNode', {
        track: rawTrack,
        nodeId: node.nodeId,
        name: node.name,
        status: node.status,
        sponsorMid: node.sponsorMid,
        trialExpiresAt: node.trialExpiresAt,
        totalEarnings: node.totalEarnings,
        hqPermanentLocked: node.hqPermanentLocked,
      });
      serverErpEngine.updateAuditLogGasSync(auditEntry.id, gasSync.ok, gasSync.message);
      const overview = serverErpEngine.getHqDbOverview();
      const bootstrap = serverErpEngine.getScopedBootstrap(session);
      res.json({
        ok: true,
        node,
        gasSync,
        overview,
        bootstrap,
      });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err?.message || '修改節點資料失敗' });
    }
  });

  app.delete('/api/hq/db/node/:track/:nodeId', requireHqRole, verifyHqMutationOrigin, async (req: AuthedRequest, res) => {
    const session = req.erpSession!;
    const rawTrack = String(req.params.track || '').trim().toUpperCase();
    if (rawTrack !== 'MONOLINE' && rawTrack !== 'BINARY') {
      res.status(400).json({ ok: false, error: '無效的軌道類型（僅支援 MONOLINE 或 BINARY）' });
      return;
    }
    const targetNodeId = String(req.params.nodeId || '').trim().toUpperCase();
    try {
      const deleted = serverErpEngine.hqDeleteNode(
        rawTrack,
        targetNodeId,
        { userId: session.userId, displayName: session.displayName }
      );
      const gasSync = await sendHqDbMutationToGas('hqDeleteNode', {
        track: rawTrack,
        nodeId: deleted.deletedNodeId,
        parentId: deleted.parentId,
      });
      serverErpEngine.updateAuditLogGasSync(deleted.auditEntry.id, gasSync.ok, gasSync.message);
      const overview = serverErpEngine.getHqDbOverview();
      const bootstrap = serverErpEngine.getScopedBootstrap(session);
      res.json({
        ok: true,
        deleted,
        gasSync,
        overview,
        bootstrap,
      });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err?.message || '刪除節點資料失敗' });
    }
  });

  // 5. Server-Authoritative ERP Action Sync (Strict RBAC + Origin/Header CSRF Guard enforced)
  app.post('/api/erp/sync-action', requireAuth, verifyHqMutationOrigin, (req: AuthedRequest, res) => {
    const session = req.erpSession!;
    const { action, payload } = (req.body || {}) as {
      action?: string;
      payload?: Record<string, any>;
    };

    if (!action) {
      res.status(400).json({ ok: false, error: 'Missing action' });
      return;
    }

    try {
      const data = payload || {};
      let result: any = null;

      // HQ-Only Privileged Actions
      const hqOnlyActions = new Set([
        'execute100PointsClosedLoopSettlement',
        'executeBatchSettlement',
        'seedMultiGenReferralChain',
        'restoreCoreLedgerSnapshot',
        'initializeSystem',
        'exportCoreLedgerSnapshot',
      ]);

      if (hqOnlyActions.has(action) && session.role !== 'HQ_STAFF') {
        res.status(403).json({ ok: false, error: '權限不足：僅總部人員可執行此操作' });
        return;
      }

      switch (action) {
        case 'registerNewMember': {
          const safeSponsorMid =
            session.role === 'MEMBER' ? session.userId : data.sponsorMid;
          result = serverErpEngine.registerNewMember({
            name: data.name,
            phone: data.phone,
            tel: data.tel,
            line: data.line,
            email: data.email,
            address: data.address,
            photoUrl: data.photoUrl,
            idNumberMasked: data.idNumberMasked,
            sponsorMid: safeSponsorMid,
            storeId: data.storeId,
            centerId: data.centerId,
            discussionContent: data.discussionContent,
            nextStepPlan: data.nextStepPlan,
            activateBookingSystem: data.activateBookingSystem,
          });
          break;
        }
        case 'updateMemberProfile': {
          const targetMid = session.role === 'MEMBER' ? session.userId : data.mid;
          result = serverErpEngine.updateMemberProfile(targetMid, data.updates || {});
          break;
        }
        case 'renewMemberMonthlyFee': {
          const targetMid = session.role === 'MEMBER' ? session.userId : data.mid;
          result = serverErpEngine.renewMemberMonthlyFee(targetMid);
          break;
        }
        case 'activateBookingTrial': {
          const targetMid = session.role === 'MEMBER' ? session.userId : data.ownerMid;
          result = serverErpEngine.activateBookingTrial(targetMid, data.options);
          break;
        }
        case 'renewBookingMonthlyFee': {
          const targetMid = session.role === 'MEMBER' ? session.userId : data.ownerMid;
          result = serverErpEngine.renewBookingMonthlyFee(targetMid, data.options);
          break;
        }
        case 'createAppointment': {
          const targetMid = session.role === 'MEMBER' ? session.userId : data.ownerMid;
          result = serverErpEngine.createAppointment({
            ...data,
            ownerMid: targetMid,
          } as any);
          break;
        }
        case 'updateAppointmentStatus': {
          result = serverErpEngine.updateAppointmentStatus(
            data.appointmentId,
            data.status,
            data.convertedMid
          );
          break;
        }
        case 'addBookingService': {
          const targetMid = session.role === 'MEMBER' ? session.userId : data.ownerMid;
          result = serverErpEngine.addBookingService(targetMid, data.service);
          break;
        }
        case 'toggleBookingService': {
          const targetMid = session.role === 'MEMBER' ? session.userId : data.ownerMid;
          result = serverErpEngine.toggleBookingService(targetMid, data.serviceId);
          break;
        }
        case 'deleteBookingService': {
          const targetMid = session.role === 'MEMBER' ? session.userId : data.ownerMid;
          result = serverErpEngine.deleteBookingService(targetMid, data.serviceId);
          break;
        }
        case 'updateBookingProfile': {
          const targetMid = session.role === 'MEMBER' ? session.userId : data.ownerMid;
          result = serverErpEngine.updateBookingProfile(targetMid, data.updates || {});
          break;
        }
        case 'allocateBinaryNodeForSoftware': {
          const targetMid =
            session.role === 'MEMBER' ? session.userId : (data.memberMid || data.mid);
          result = serverErpEngine.allocateBinaryNodeForSoftware({
            ...data,
            memberMid: targetMid,
          } as any);
          break;
        }
        case 'addContact': {
          const safePhoto = sanitizePhotoUrl(data.photoUrl);
          result = serverErpEngine.addContact({
            ...data,
            photoUrl: safePhoto,
            ownerMid: session.role === 'MEMBER' ? session.userId : data.ownerMid,
          } as any);
          break;
        }
        case 'updateContact': {
          const contactId = String(data.contactId || '').trim().toUpperCase();
          const existingContact = serverErpEngine.getContactById(contactId);
          if (
            session.role === 'MEMBER' &&
            existingContact &&
            existingContact.ownerMid &&
            existingContact.ownerMid !== session.userId &&
            existingContact.memberMid !== session.userId
          ) {
            res.status(403).json({ ok: false, error: '無權修改其他會員的通訊錄資料' });
            return;
          }
          const safeUpdates = { ...(data.updates || {}) };
          if ('photoUrl' in safeUpdates) {
            safeUpdates.photoUrl = sanitizePhotoUrl(safeUpdates.photoUrl);
          }
          result = serverErpEngine.updateContact(contactId, safeUpdates);
          break;
        }
        case 'addContactTracking': {
          const safePhoto = sanitizePhotoUrl(data.photoUrl);
          result = serverErpEngine.addContactTracking({
            ...data,
            photoUrl: safePhoto,
            ownerMid: session.role === 'MEMBER' ? session.userId : (data.ownerMid || data.memberMid),
            memberMid: session.role === 'MEMBER' ? session.userId : data.memberMid,
          } as any);
          break;
        }
        case 'updateContactTracking': {
          const trackingId = String(data.trackingId || '').trim().toUpperCase();
          const existingTracking = serverErpEngine.getContactTrackingById(trackingId);
          if (
            session.role === 'MEMBER' &&
            existingTracking &&
            existingTracking.ownerMid &&
            existingTracking.ownerMid !== session.userId &&
            existingTracking.memberMid !== session.userId
          ) {
            res.status(403).json({ ok: false, error: '無權修改其他會員的聯繫紀錄' });
            return;
          }
          const safeUpdates = { ...(data.updates || {}) };
          if ('photoUrl' in safeUpdates) {
            safeUpdates.photoUrl = sanitizePhotoUrl(safeUpdates.photoUrl);
          }
          result = serverErpEngine.updateContactTracking(trackingId, safeUpdates);
          break;
        }
        case 'addEvent': {
          const safePhoto = sanitizePhotoUrl(data.photoUrl);
          result = serverErpEngine.addEvent({ ...data, photoUrl: safePhoto } as any);
          break;
        }
        case 'updateEvent': {
          const safeUpdates = { ...(data.updates || {}) };
          if ('photoUrl' in safeUpdates) {
            safeUpdates.photoUrl = sanitizePhotoUrl(safeUpdates.photoUrl);
          }
          result = serverErpEngine.updateEvent(data.eventId, safeUpdates);
          break;
        }
        case 'addEventTracking': {
          const safePhoto = sanitizePhotoUrl(data.photoUrl);
          result = serverErpEngine.addEventTracking({ ...data, photoUrl: safePhoto } as any);
          break;
        }
        case 'updateEventTracking': {
          const safeUpdates = { ...(data.updates || {}) };
          if ('photoUrl' in safeUpdates) {
            safeUpdates.photoUrl = sanitizePhotoUrl(safeUpdates.photoUrl);
          }
          result = serverErpEngine.updateEventTracking(data.trackingId, safeUpdates);
          break;
        }
        case 'registerNewStore': {
          if (session.role !== 'HQ_STAFF' && session.role !== 'STORE') {
            res.status(403).json({ ok: false, error: '無權新增營業店' });
            return;
          }
          result = serverErpEngine.registerNewStore(data as any);
          break;
        }
        case 'registerNewCenter': {
          if (session.role !== 'HQ_STAFF' && session.role !== 'CENTER') {
            res.status(403).json({ ok: false, error: '無權新增教育中心' });
            return;
          }
          result = serverErpEngine.registerNewCenter(data as any);
          break;
        }
        case 'execute100PointsClosedLoopSettlement': {
          result = serverErpEngine.execute100PointsClosedLoopSettlement(
            data.nodeId,
            data.paidAmount || 100
          );
          break;
        }
        case 'executeBatchSettlement': {
          result = serverErpEngine.executeBatchSettlement(data as any);
          break;
        }
        case 'seedMultiGenReferralChain': {
          result = serverErpEngine.seedMultiGenReferralChain(
            data.rootMid || data.rootSponsorMid,
            data.targetDepth ?? data.generations ?? 5
          );
          break;
        }
        case 'restoreCoreLedgerSnapshot': {
          result = serverErpEngine.restoreCoreLedgerSnapshot(data.snapshot);
          break;
        }
        case 'initializeSystem': {
          serverErpEngine.initializeSystem(Boolean(data.forceReset));
          result = { reset: true };
          break;
        }
        case 'exportCoreLedgerSnapshot': {
          result = serverErpEngine.exportCoreLedgerSnapshot();
          break;
        }
        default: {
          res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
          return;
        }
      }

      // Non-blocking real-time dual-write forward to configured GAS /exec Web App
      if (action === 'registerNewMember' && result?.member) {
        void forwardErpEventToGas('register', {
          mid: result.member.mid,
          name: result.member.name,
          phone: result.member.phone,
          tel: result.member.tel,
          line: result.member.line,
          email: result.member.email,
          address: result.member.address,
          photoUrl: result.member.photoUrl,
          idNumberMasked: result.member.idNumberMasked,
          sponsorMid: result.member.sponsorMid,
          storeId: result.member.storeId,
          centerId: result.member.centerId,
          registeredAt: result.member.registeredAt,
          trialExpiresAt: result.member.trialExpiresAt,
          monolineNodeId: result.monolineNode?.nodeId || result.member.monolineNodeId,
          monolineParentId: result.monolineNode?.parentId,
          monolineDepth: result.monolineNode?.depth,
          binaryNodeId: result.binaryNode?.nodeId || result.member.binaryNodeId,
          binaryParentId: result.binaryNode?.parentId,
          binaryPosition: result.binaryNode?.placementPosition,
          binaryDepth: result.binaryNode?.depth,
          contactId: result.contact?.id || result.member.contactId,
          trackingId: result.contactTracking?.id,
          discussionContent: result.contactTracking?.discussionContent || data.discussionContent,
          nextStepPlan: result.contactTracking?.nextStepPlan || data.nextStepPlan,
        });
      } else if (action === 'execute100PointsClosedLoopSettlement' && result) {
        void forwardErpEventToGas('settle', {
          nodeId: result.nodeId || data.nodeId,
          amount: result.paidAmount || data.paidAmount || 100,
        });
      } else if (action === 'renewMemberMonthlyFee' && result) {
        void forwardErpEventToGas('settle', {
          nodeId: result.nodeId,
          amount: result.paidAmount || 100,
        });
      } else if (action === 'allocateBinaryNodeForSoftware' && result?.binaryNode) {
        const swKey = sanitizePublicText(data.softwareKey || result.binaryNode.softwareKey, 24).toUpperCase();
        if (ALLOWED_WORKSPACE_PACKS.has(swKey)) {
          const curWs = serverErpEngine.getMemberWorkspaceData(result.binaryNode.mid);
          const nextPacks = Array.from(new Set([...(curWs.unlockedPacks || ['CONTACT', 'EVENT']), swKey]));
          serverErpEngine.saveMemberWorkspacePacks(result.binaryNode.mid, nextPacks);
          void forwardErpEventToGas('saveMemberPacks', {
            memberMid: result.binaryNode.mid,
            packs: nextPacks,
          });
        }
        void forwardErpEventToGas('allocateSoftwareBinaryNode', {
          memberMid: result.binaryNode.mid,
          binaryNodeId: result.binaryNode.nodeId,
          parentId: result.binaryNode.parentId,
          position: result.binaryNode.placementPosition,
          depth: result.binaryNode.depth,
          sponsorMid: result.binaryNode.sponsorMid,
          status: result.binaryNode.status,
          expiresAt: result.binaryNode.trialExpiresAt,
          softwareTitle: data.softwareTitle || result.binaryNode.softwareTitle || 'AI 雙軌模組',
          executeSettlement: Boolean(data.executeSettlement),
        });
      } else if (
        (action === 'activateBookingTrial' ||
          action === 'renewBookingMonthlyFee' ||
          action === 'updateBookingProfile' ||
          action === 'addBookingService' ||
          action === 'toggleBookingService' ||
          action === 'deleteBookingService') &&
        result
      ) {
        const bkProfile = action === 'renewBookingMonthlyFee' ? result.profile : result;
        const bkOwnerMid = sanitizePublicText(
          bkProfile?.ownerMid || (session.role === 'MEMBER' ? session.userId : data.ownerMid),
          24
        ).toUpperCase();
        if (bkOwnerMid && bkProfile?.licenseId) {
          const curWs = serverErpEngine.getMemberWorkspaceData(bkOwnerMid);
          const nextPacks = Array.from(new Set([...(curWs.unlockedPacks || ['CONTACT', 'EVENT']), 'BOOKING']));
          serverErpEngine.saveMemberWorkspacePacks(bkOwnerMid, nextPacks);
          void forwardErpEventToGas('saveMemberPacks', {
            memberMid: bkOwnerMid,
            packs: nextPacks,
          });
          void forwardErpEventToGas('upsertWorkspaceRecord', {
            memberMid: bkOwnerMid,
            sysType: '_BOOKING_PROFILE',
            record: { ID: 'PROFILE', ...bkProfile },
          });
        }
        if (action === 'renewBookingMonthlyFee' && result?.binaryNode) {
          void forwardErpEventToGas('allocateSoftwareBinaryNode', {
            memberMid: result.binaryNode.mid,
            binaryNodeId: result.binaryNode.nodeId,
            parentId: result.binaryNode.parentId,
            position: result.binaryNode.placementPosition,
            depth: result.binaryNode.depth,
            sponsorMid: result.binaryNode.sponsorMid,
            status: result.binaryNode.status,
            expiresAt: result.binaryNode.trialExpiresAt,
            softwareTitle: '個人預約系統',
            executeSettlement: true,
          });
        }
      } else if ((action === 'addContact' || action === 'updateContact') && result) {
        void forwardErpEventToGas('upsertCrmRecord', {
          sysType: 'CONTACT_M',
          record: result,
        });
      } else if ((action === 'addContactTracking' || action === 'updateContactTracking') && result) {
        void forwardErpEventToGas('upsertCrmRecord', {
          sysType: 'CONTACT_T',
          record: result,
        });
      } else if ((action === 'addEvent' || action === 'updateEvent') && result) {
        void forwardErpEventToGas('upsertCrmRecord', {
          sysType: 'EVENT_M',
          record: result,
        });
      } else if ((action === 'addEventTracking' || action === 'updateEventTracking') && result) {
        void forwardErpEventToGas('upsertCrmRecord', {
          sysType: 'EVENT_T',
          record: result,
        });
      }

      const bootstrap = serverErpEngine.getScopedBootstrap(session);
      res.json({ ok: true, result, bootstrap });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err?.message || '操作執行失敗' });
    }
  });

  // 8. Member Five-Star Workspace Cross-Device Cloud Sync Routes (Phone <-> Server <-> Desktop + Google Sheets)
  app.get('/api/member/workspace/:mid', requireAuth, async (req: AuthedRequest, res) => {
    const session = req.erpSession!;
    const targetMid = sanitizePublicText(req.params.mid, 24).toUpperCase();
    if (!canAccessMemberWorkspace(session, targetMid)) {
      res.status(403).json({ ok: false, error: '權限不足：僅能讀取本人專屬工作區資料' });
      return;
    }
    await ensureHydratedBeforeRead();
    const workspace = serverErpEngine.getMemberWorkspaceData(targetMid);
    const bootstrap = serverErpEngine.getScopedBootstrap(session);
    res.json({
      ok: true,
      mid: targetMid,
      unlockedPacks: workspace.unlockedPacks,
      recordsBySys: workspace.recordsBySys,
      subscriptions: workspace.subscriptions,
      profession: workspace.profession,
      customModules: workspace.customModules,
      orderReceipts: workspace.orderReceipts,
      metaUpdatedAt: workspace.metaUpdatedAt,
      bootstrap,
      syncedAt: new Date().toISOString(),
    });
  });

  app.post('/api/member/workspace/:mid/record', requireAuth, verifyHqMutationOrigin, (req: AuthedRequest, res) => {
    const session = req.erpSession!;
    const targetMid = sanitizePublicText(req.params.mid, 24).toUpperCase();
    if (!canAccessMemberWorkspace(session, targetMid)) {
      res.status(403).json({ ok: false, error: '權限不足：僅能寫入本人專屬工作區資料' });
      return;
    }
    const body = (req.body || {}) as Record<string, unknown>;
    const sysType = sanitizePublicText(body.sysType, 24).toUpperCase();
    if (!/^[A-Z0-9_]{2,24}$/.test(sysType)) {
      res.status(400).json({ ok: false, error: '無效的模組代碼 (sysType)' });
      return;
    }
    const safeRecord = sanitizeWorkspaceRecord(body.record);
    if (!safeRecord || !safeRecord.ID) {
      res.status(400).json({ ok: false, error: '資料格式錯誤或缺少必要欄位 ID' });
      return;
    }
    try {
      const saved = serverErpEngine.upsertMemberWorkspaceRecord(targetMid, sysType, safeRecord);
      void forwardErpEventToGas('upsertWorkspaceRecord', {
        memberMid: targetMid,
        sysType,
        record: saved,
      });
      res.json({ ok: true, sysType, record: saved, syncedAt: new Date().toISOString() });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err?.message || '儲存工作區資料失敗' });
    }
  });

  app.post('/api/member/workspace/:mid/packs', requireAuth, verifyHqMutationOrigin, async (req: AuthedRequest, res) => {
    const session = req.erpSession!;
    const targetMid = sanitizePublicText(req.params.mid, 24).toUpperCase();
    if (!canAccessMemberWorkspace(session, targetMid)) {
      res.status(403).json({ ok: false, error: '權限不足：僅能更新本人已開通模組清單' });
      return;
    }
    const body = (req.body || {}) as Record<string, unknown>;
    if (!Array.isArray(body.packs)) {
      res.status(400).json({ ok: false, error: 'packs 必須為陣列格式' });
      return;
    }
    const validPacks = body.packs
      .map((p) => String(p || '').trim().toUpperCase())
      .filter((p) => ALLOWED_WORKSPACE_PACKS.has(p));
    const savedMeta = serverErpEngine.saveMemberWorkspaceMeta(targetMid, {
      unlockedPacks: validPacks,
    });
    const gasSyncPromise = Promise.all([
      forwardErpEventToGas('saveMemberPacks', {
        memberMid: targetMid,
        packs: savedMeta.unlockedPacks,
      }),
      forwardErpEventToGas('upsertWorkspaceRecord', {
        memberMid: targetMid,
        sysType: '_WORKSPACE_META',
        record: {
          ID: 'META',
          unlockedPacks: savedMeta.unlockedPacks,
          subscriptions: savedMeta.subscriptions,
          profession: savedMeta.profession,
          customModules: savedMeta.customModules,
          orderReceipts: savedMeta.orderReceipts,
          updatedAt: savedMeta.updatedAt,
        },
      }),
    ]);
    await Promise.race([
      gasSyncPromise,
      new Promise<void>((resolve) => setTimeout(resolve, 3000)),
    ]);
    res.json({
      ok: true,
      unlockedPacks: savedMeta.unlockedPacks,
      metaUpdatedAt: savedMeta.updatedAt,
      syncedAt: new Date().toISOString(),
    });
  });

  app.post('/api/member/workspace/:mid/meta', requireAuth, verifyHqMutationOrigin, async (req: AuthedRequest, res) => {
    const session = req.erpSession!;
    const targetMid = sanitizePublicText(req.params.mid, 24).toUpperCase();
    if (!canAccessMemberWorkspace(session, targetMid)) {
      res.status(403).json({ ok: false, error: '權限不足：僅能更新本人已開通系統與個人設定' });
      return;
    }
    const body = (req.body || {}) as Record<string, unknown>;

    const validPacks = Array.isArray(body.unlockedPacks)
      ? body.unlockedPacks
          .map((p) => String(p || '').trim().toUpperCase())
          .filter((p) => ALLOWED_WORKSPACE_PACKS.has(p))
      : undefined;

    let profession: string | null | undefined = undefined;
    if (body.profession === null) {
      profession = null;
    } else if (typeof body.profession === 'string') {
      const cleanProf = body.profession.trim().toUpperCase();
      if (ALLOWED_PROFESSION_KEYS.has(cleanProf)) {
        profession = cleanProf;
      }
    }

    const subscriptions = sanitizeWorkspaceSubscriptions(body.subscriptions);
    const customModules = sanitizeWorkspaceCustomModules(body.customModules);
    const orderReceipts = sanitizeWorkspaceOrderReceipts(body.orderReceipts);

    const savedMeta = serverErpEngine.saveMemberWorkspaceMeta(targetMid, {
      unlockedPacks: validPacks,
      subscriptions,
      profession,
      customModules,
      orderReceipts,
    });

    const gasSyncPromise = Promise.all([
      forwardErpEventToGas('saveMemberPacks', {
        memberMid: targetMid,
        packs: savedMeta.unlockedPacks,
      }),
      forwardErpEventToGas('upsertWorkspaceRecord', {
        memberMid: targetMid,
        sysType: '_WORKSPACE_META',
        record: {
          ID: 'META',
          unlockedPacks: savedMeta.unlockedPacks,
          subscriptions: savedMeta.subscriptions,
          profession: savedMeta.profession,
          customModules: savedMeta.customModules,
          orderReceipts: savedMeta.orderReceipts,
          updatedAt: savedMeta.updatedAt,
        },
      }),
    ]);

    let gasSynced = false;
    await Promise.race([
      gasSyncPromise.then(() => {
        gasSynced = true;
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 3500)),
    ]);

    res.json({
      ok: true,
      mid: targetMid,
      unlockedPacks: savedMeta.unlockedPacks,
      subscriptions: savedMeta.subscriptions,
      profession: savedMeta.profession,
      customModules: savedMeta.customModules,
      orderReceipts: savedMeta.orderReceipts,
      metaUpdatedAt: savedMeta.updatedAt,
      gasSynced,
      syncedAt: new Date().toISOString(),
    });
  });

  app.post(
    '/api/member/workspace/:mid/provision-cloud',
    requireAuth,
    verifyHqMutationOrigin,
    async (req: AuthedRequest, res) => {
      const session = req.erpSession!;
      const targetMid = sanitizePublicText(req.params.mid, 24).toUpperCase();
      if (!canAccessMemberWorkspace(session, targetMid)) {
        res.status(403).json({ ok: false, error: '權限不足：僅能建立或同步本人專屬 Google 試算表' });
        return;
      }

      const member = serverErpEngine.getMemberById(targetMid);
      if (!member) {
        res.status(404).json({ ok: false, error: `查無會員資料 (${targetMid})` });
        return;
      }

      const body = (req.body || {}) as Record<string, unknown>;
      const rawTabs = Array.isArray(body.tabs) ? body.tabs.slice(0, 40) : [];
      const safeTabs = rawTabs
        .map((t: any) => ({
          sysType: sanitizePublicText(t?.sysType, 24).toUpperCase(),
          tabName: sanitizePublicText(t?.tabName, 90),
          canCreate: Boolean(t?.canCreate),
          readOnly: Boolean(t?.readOnly),
        }))
        .filter((t) => t.sysType && t.tabName);

      const safeRowsBySys: Record<
        string,
        { tabName: string; columns: string[]; rows: Array<Record<string, string>> }
      > = {};
      if (body.rowsBySys && typeof body.rowsBySys === 'object' && !Array.isArray(body.rowsBySys)) {
        const entries = Object.entries(body.rowsBySys as Record<string, any>).slice(0, 40);
        for (const [sysKey, tabObj] of entries) {
          const cleanSys = sanitizePublicText(sysKey, 24).toUpperCase();
          if (!cleanSys || !tabObj || typeof tabObj !== 'object') continue;
          const tabName = sanitizePublicText(tabObj.tabName, 90);
          const columns = Array.isArray(tabObj.columns)
            ? tabObj.columns
                .slice(0, 25)
                .map((c: unknown) => sanitizePublicText(c, 60))
                .filter(Boolean)
            : [];
          if (!tabName || columns.length === 0) continue;
          const rawRows = Array.isArray(tabObj.rows) ? tabObj.rows.slice(0, 200) : [];
          const rows = rawRows.map((rowObj: any) => {
            const out: Record<string, string> = {};
            for (const col of columns) {
              const rawVal = rowObj && typeof rowObj === 'object' ? rowObj[col] : '';
              const str = rawVal === undefined || rawVal === null ? '' : String(rawVal);
              out[col] = str.startsWith('data:image/')
                ? '[系統相簿照片]'
                : str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, 1500);
            }
            return out;
          });
          safeRowsBySys[cleanSys] = { tabName, columns, rows };
        }
      }

      try {
        const result = await provisionMemberCloudWorkspaceViaGas({
          memberMid: targetMid,
          memberName: member.name || targetMid,
          tabs: safeTabs,
          rowsBySys: Object.keys(safeRowsBySys).length > 0 ? safeRowsBySys : undefined,
        });

        if (!result.ok || !result.spreadsheetId || !result.spreadsheetUrl) {
          res.json({
            ok: false,
            needsGasUpgrade: Boolean(result.needsGasUpgrade),
            message: result.message || '尚未能建立外部 Google 試算表，您仍可先於系統內即時預覽與匯出 CSV。',
          });
          return;
        }

        serverErpEngine.updateMemberCloudVault(targetMid, {
          folderId: result.folderId,
          folderName: result.folderName,
          folderUrl: result.folderUrl,
          spreadsheetId: result.spreadsheetId,
          spreadsheetName: result.spreadsheetName,
          spreadsheetUrl: result.spreadsheetUrl,
        });

        const bootstrap = serverErpEngine.getScopedBootstrap(session);
        res.json({
          ok: true,
          vault: {
            folderId: result.folderId || '',
            folderName: result.folderName || '',
            folderUrl: result.folderUrl || '',
            spreadsheetId: result.spreadsheetId,
            spreadsheetName: result.spreadsheetName || '',
            spreadsheetUrl: result.spreadsheetUrl,
          },
          bootstrap,
          message: result.message,
          syncedAt: new Date().toISOString(),
        });
      } catch (err: any) {
        res.status(500).json({
          ok: false,
          message: err?.message || '建立專屬 Google 試算表時發生例外錯誤',
        });
      }
    }
  );

  // Mount static dist/ in production when built, otherwise mount Vite middleware (prevents 404 if dist/ is missing)
  const distDir = path.resolve(process.cwd(), 'dist');
  const hasBuiltDist = fs.existsSync(path.join(distDir, 'index.html'));

  if (!IS_PROD || !hasBuiltDist) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Confidential ERP Server] Listening on http://0.0.0.0:${PORT} (mode=${IS_PROD ? 'production' : 'development'})`);
    // Shared cold-start hydration promise (awaited by login/session/workspace reads so Render sleep never resets activated systems)
    void triggerSharedHydration('startup');
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
