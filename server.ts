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
  forwardErpEventToGas,
  getGasBridgeState,
  pingGasBridge,
  updateGasBridgeConfig,
} from './server/services/gasBridgeForwarder.ts';
import { buildProjectSourceZip } from './server/services/projectZipExporter.ts';
import type { AuthSession, UserRole } from './src/types/erp.ts';

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

// Simple in-memory login rate limiter (brute-force protection)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

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

  // 1. Server-side Confidential Authentication
  app.post('/api/auth/login', (req, res) => {
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
  app.get('/api/auth/session', (req, res) => {
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

  // 4a. HQ-Only Full Project Source ZIP Export (Excludes secrets, node_modules, dist, runtime state)
  app.get('/api/hq/download-project-zip', requireHqRole, (_req, res) => {
    try {
      const { buffer, fileCount } = buildProjectSourceZip(process.cwd());
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="erp-saas-system.zip"');
      res.setHeader('X-Exported-File-Count', String(fileCount));
      res.setHeader('Content-Length', String(buffer.length));
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || '產生專案壓縮檔失敗' });
    }
  });

  // 4b. HQ-Only Server-to-GAS /exec Bidirectional Bridge Config & Live Ping
  app.get('/api/hq/gas-bridge', requireHqRole, (_req, res) => {
    res.json({ ok: true, state: getGasBridgeState() });
  });

  app.post('/api/hq/gas-bridge', requireHqRole, async (req, res) => {
    const { gasWebAppUrl, autoSyncEnabled, testPing } = (req.body || {}) as {
      gasWebAppUrl?: string;
      autoSyncEnabled?: boolean;
      testPing?: boolean;
    };
    const updated = updateGasBridgeConfig({ gasWebAppUrl, autoSyncEnabled });
    if (!updated.ok) {
      res.status(400).json({ ok: false, error: updated.error, state: updated.state });
      return;
    }
    const pingResult = testPing ? await pingGasBridge() : null;
    res.json({
      ok: true,
      state: getGasBridgeState(),
      pingResult,
    });
  });

  // 5. Server-Authoritative ERP Action Sync (Strict RBAC enforced)
  app.post('/api/erp/sync-action', requireAuth, (req: AuthedRequest, res) => {
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
          result = serverErpEngine.addContact({
            ...data,
            ownerMid: session.role === 'MEMBER' ? session.userId : data.ownerMid,
          } as any);
          break;
        }
        case 'updateContact': {
          result = serverErpEngine.updateContact(data.contactId, data.updates || {});
          break;
        }
        case 'addContactTracking': {
          result = serverErpEngine.addContactTracking({
            ...data,
            memberMid: session.role === 'MEMBER' ? session.userId : data.memberMid,
          } as any);
          break;
        }
        case 'updateContactTracking': {
          result = serverErpEngine.updateContactTracking(data.trackingId, data.updates || {});
          break;
        }
        case 'addEvent': {
          result = serverErpEngine.addEvent(data as any);
          break;
        }
        case 'updateEvent': {
          result = serverErpEngine.updateEvent(data.eventId, data.updates || {});
          break;
        }
        case 'addEventTracking': {
          result = serverErpEngine.addEventTracking(data as any);
          break;
        }
        case 'updateEventTracking': {
          result = serverErpEngine.updateEventTracking(data.trackingId, data.updates || {});
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
          name: result.member.name,
          phone: result.member.phone,
          sponsorMid: result.member.sponsorMid,
          storeId: result.member.storeId,
          centerId: result.member.centerId,
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
        void forwardErpEventToGas('allocateSoftwareBinaryNode', {
          memberMid: result.binaryNode.mid,
          softwareTitle: data.softwareTitle || 'AI 雙軌模組',
          executeSettlement: Boolean(data.executeSettlement),
        });
      }

      const bootstrap = serverErpEngine.getScopedBootstrap(session);
      res.json({ ok: true, result, bootstrap });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err?.message || '操作執行失敗' });
    }
  });

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
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
