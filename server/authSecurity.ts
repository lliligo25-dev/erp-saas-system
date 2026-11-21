/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import type { AuthSession, UserRole } from '../src/types/erp.ts';

const SESSION_COOKIE_NAME = 'ais_erp_sid';
const SERVER_DATA_DIR = path.resolve(process.cwd(), '.erp-server-data');
const SECRET_FILE = path.join(SERVER_DATA_DIR, '.session-secret');
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function loadOrGenerateSessionSecret(): string {
  if (process.env.ERP_SESSION_SECRET && process.env.ERP_SESSION_SECRET.trim().length >= 16) {
    return process.env.ERP_SESSION_SECRET.trim();
  }
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const existing = fs.readFileSync(SECRET_FILE, 'utf8').trim();
      if (existing.length >= 32) return existing;
    }
    if (!fs.existsSync(SERVER_DATA_DIR)) {
      fs.mkdirSync(SERVER_DATA_DIR, { recursive: true });
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
    return generated;
  } catch {
    return crypto.randomBytes(32).toString('hex');
  }
}

const SESSION_SECRET = loadOrGenerateSessionSecret();

// Server-side scrypt password hashing (zero plaintext credentials sent to browser)
const SERVER_SCRYPT_SALT = crypto.createHash('sha256').update(`salt:${SESSION_SECRET}`).digest('hex').slice(0, 16);

export function hashPasscode(plain: string): Buffer {
  return crypto.scryptSync(plain, SERVER_SCRYPT_SALT, 32);
}

export function verifyPasscode(plain: string, expectedHash: Buffer): boolean {
  if (!plain || !plain.trim()) return false;
  const candidate = hashPasscode(plain.trim());
  if (candidate.length !== expectedHash.length) return false;
  return crypto.timingSafeEqual(candidate, expectedHash);
}

const HQ_MASTER_HASH = hashPasscode(process.env.HQ_STAFF_PASSCODE || '1234');
const PORTAL_DEFAULT_HASH = hashPasscode(process.env.PORTAL_ACCESS_PASSCODE || '1234');

export function verifyRolePasscode(role: UserRole, providedPasscode: string, specificPasscode?: string): boolean {
  if (!providedPasscode || !providedPasscode.trim()) {
    return false;
  }
  if (role === 'HQ_STAFF') {
    if (specificPasscode && verifyPasscode(providedPasscode, hashPasscode(specificPasscode))) {
      return true;
    }
    return verifyPasscode(providedPasscode, HQ_MASTER_HASH);
  }
  if (specificPasscode && verifyPasscode(providedPasscode, hashPasscode(specificPasscode))) {
    return true;
  }
  return verifyPasscode(providedPasscode, PORTAL_DEFAULT_HASH);
}

interface SignedSessionPayload extends AuthSession {
  exp: number;
}

export function signSessionToken(session: AuthSession): string {
  const payload: SignedSessionPayload = {
    ...session,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined): AuthSession | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  try {
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SignedSessionPayload;
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    if (!parsed.role || !parsed.userId) {
      return null;
    }
    const { exp: _exp, ...session } = parsed;
    return session;
  } catch {
    return null;
  }
}

interface SignedQrLoginPayload {
  kind: 'LINE_QR_PASS';
  role: UserRole;
  userId: string;
  exp: number;
}

const DEFAULT_QR_PASS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function signQrLoginToken(session: AuthSession, ttlMs = DEFAULT_QR_PASS_TTL_MS): string {
  const payload: SignedQrLoginPayload = {
    kind: 'LINE_QR_PASS',
    role: session.role,
    userId: session.userId,
    exp: Date.now() + ttlMs,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`qr:${encoded}`)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyQrLoginToken(
  token: string | undefined
): { role: UserRole; userId: string } | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.trim().split('.');
  if (!encoded || !sig) return null;

  try {
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(`qr:${encoded}`)
      .digest('base64url');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SignedQrLoginPayload;
    if (
      !parsed ||
      parsed.kind !== 'LINE_QR_PASS' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < Date.now() ||
      !parsed.role ||
      !parsed.userId
    ) {
      return null;
    }
    return { role: parsed.role, userId: parsed.userId };
  } catch {
    return null;
  }
}

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  const out: Record<string, string> = {};
  if (!header) return out;
  const parts = header.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

export function getRequestSession(req: Request): AuthSession | null {
  const cookies = parseCookies(req);
  const fromCookie = verifySessionToken(cookies[SESSION_COOKIE_NAME]);
  if (fromCookie) return fromCookie;

  // Ephemeral memory-only Bearer fallback for strict 3rd-party cookie blocking iframes (e.g., Google Sites / Incognito)
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    return verifySessionToken(bearer);
  }
  return null;
}

function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string' && proto.toLowerCase().includes('https')) {
    return true;
  }
  return false;
}

export function setSessionCookie(req: Request, res: Response, session: AuthSession): void {
  const token = signSessionToken(session);
  const isHttps = isHttpsRequest(req);

  // Over HTTPS (Cloud Run, AI Studio iframe, Google Sites embed), use SameSite=None; Secure; Partitioned
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isHttps) {
    attributes.push('Secure', 'Partitioned');
  }
  res.setHeader('Set-Cookie', attributes.join('; '));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const isHttps = isHttpsRequest(req);
  const attributes = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isHttps) {
    attributes.push('Secure', 'Partitioned');
  }
  res.setHeader('Set-Cookie', attributes.join('; '));
}
