/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  apiLogin,
  apiQrLogin,
  ScopedBootstrapPayload,
} from '../services/confidentialApiClient';
import {
  LineInAppBrowserHandler,
  LineQrParseResult,
} from '../services/LineInAppBrowserHandler';
import { CameraQrScannerModal } from './CameraQrScannerModal';
import { DesktopShortcutGuideCard } from './DesktopShortcutGuideCard';
import { AuthSession, UserRole } from '../types/erp';
import {
  ShieldCheck,
  User,
  Store,
  GraduationCap,
  LogIn,
  Lock,
  ArrowRight,
  CheckCircle2,
  EyeOff,
  CalendarClock,
  Layers,
  ShieldAlert,
  Camera,
  QrCode,
  Sparkles,
} from 'lucide-react';

interface RoleLoginPortalProps {
  onLoginSuccess: (session: AuthSession, bootstrap?: ScopedBootstrapPayload | null) => void;
  lockedRole?: UserRole | null;
  initialIdentifier?: string | null;
}

interface RoleConfig {
  role: UserRole;
  title: string;
  subtitle: string;
  placeholder: string;
  passcodeLabel: string;
  scopeSummary: string;
  hiddenSummary: string;
  accentText: string;
  accentBg: string;
  accentBorder: string;
}

const PUBLIC_ROLE_CONFIGS: RoleConfig[] = [
  {
    role: 'MEMBER',
    title: '會員專屬工作台',
    subtitle: '智能通訊錄 CRM · 活動行銷管理 · AI 個人預約系統',
    placeholder: '輸入您的會員編號或註冊手機號碼',
    passcodeLabel: '會員安全驗證密碼',
    scopeSummary: '登入後僅顯示您的個人專屬智能軟體、預約行程管理、專屬推廣統計與個人帳務明細。',
    hiddenSummary: '系統採用嚴格權限隔離架構，其他用戶資料與營運管理模組皆完全隔離保護。',
    accentText: 'text-sky-400',
    accentBg: 'bg-sky-600 hover:bg-sky-500',
    accentBorder: 'border-sky-500/40',
  },
  {
    role: 'STORE',
    title: '營業店管理入口',
    subtitle: '門市營運管理 · 轄下會員服務 · 店務績效追蹤',
    placeholder: '輸入營業店代號或店長專屬編號',
    passcodeLabel: '營業店授權驗證密碼',
    scopeSummary: '登入後僅顯示貴門市所轄服務名冊、輔導店務體系與門市專屬績效報表。',
    hiddenSummary: '跨門市資料、個人私密紀錄與公司總部後台均已完全隔離隱藏。',
    accentText: 'text-emerald-400',
    accentBg: 'bg-emerald-600 hover:bg-emerald-500',
    accentBorder: 'border-emerald-500/40',
  },
  {
    role: 'CENTER',
    title: '教育中心管理入口',
    subtitle: '中心培訓體系 · 學員輔導服務 · 活動與花絮管理',
    placeholder: '輸入教育中心代號或主任專屬編號',
    passcodeLabel: '教育中心授權驗證密碼',
    scopeSummary: '登入後僅顯示貴教育中心培訓學員名冊、中心課程活動規劃與中心專屬績效明細。',
    hiddenSummary: '非本中心管轄資料、營業店帳務與總部管理模組皆已嚴格隔離隱藏。',
    accentText: 'text-cyan-400',
    accentBg: 'bg-cyan-600 hover:bg-cyan-500',
    accentBorder: 'border-cyan-500/40',
  },
];

const HQ_ROLE_CONFIG: RoleConfig = {
  role: 'HQ_STAFF',
  title: '營運總部安全驗證閘道',
  subtitle: '授權管理團隊專用 · 全程伺服器簽章驗證與操作稽核',
  placeholder: '輸入總部授權人員代號',
  passcodeLabel: '總部安全驗證密碼',
  scopeSummary: '授權通過後由後端伺服器動態解密載入總部管控儀表板與核心稽核工具。',
  hiddenSummary: '未經伺服器簽章認證前，瀏覽器端不留存任何敏感演算法與內部帳務資料。',
  accentText: 'text-indigo-400',
  accentBg: 'bg-indigo-600 hover:bg-indigo-500',
  accentBorder: 'border-indigo-500/40',
};

export const RoleLoginPortal: React.FC<RoleLoginPortalProps> = ({
  onLoginSuccess,
  lockedRole = null,
  initialIdentifier = null,
}) => {
  const initialRole: UserRole = lockedRole || 'MEMBER';
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRole);
  const [identifier, setIdentifier] = useState<string>(initialIdentifier || '');
  const [passcode, setPasscode] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState<boolean>(false);
  const [scannedQrNotice, setScannedQrNotice] = useState<LineQrParseResult | null>(null);
  const identifierInputRef = useRef<HTMLInputElement | null>(null);
  const passcodeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (lockedRole) {
      setSelectedRole(lockedRole);
      setErrorMsg(null);
      setIdentifier(initialIdentifier || '');
      setPasscode('');
    }
  }, [lockedRole, initialIdentifier]);

  const activeConfig =
    selectedRole === 'HQ_STAFF'
      ? HQ_ROLE_CONFIG
      : PUBLIC_ROLE_CONFIGS.find((c) => c.role === selectedRole) || PUBLIC_ROLE_CONFIGS[0];

  const handleSelectRole = (role: UserRole) => {
    if (lockedRole) return;
    setSelectedRole(role);
    setErrorMsg(null);
    setPasscode('');
    if (role === 'HQ_STAFF' && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        identifierInputRef.current?.focus();
      }, 120);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identifier.trim()) {
      setErrorMsg('請輸入帳號或專屬編號');
      return;
    }
    if (!passcode.trim()) {
      setErrorMsg('請輸入安全驗證密碼');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiLogin(selectedRole, identifier.trim(), passcode.trim());
      if (res.success && res.session) {
        onLoginSuccess(res.session, res.bootstrap || null);
      } else {
        setErrorMsg(res.error || '登入驗證失敗，請確認帳號與密碼是否正確。');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleQrDecoded = async (rawQrText: string) => {
    setIsQrScannerOpen(false);
    setErrorMsg(null);
    setScannedQrNotice(null);

    const parsed = LineInAppBrowserHandler.parseMemberQrData(rawQrText, {
      lockedRole,
      allowHqQr: lockedRole === 'HQ_STAFF',
    });

    if (!parsed.valid) {
      setScannedQrNotice(parsed);
      setErrorMsg(parsed.error || parsed.summaryText);
      return;
    }

    if (!lockedRole) {
      setSelectedRole(parsed.role);
    }
    if (parsed.identifier) {
      setIdentifier(parsed.identifier);
    }
    setScannedQrNotice(parsed);

    // 1. 含後端簽章之加密快速登入憑證 (LINE_QR_PASS)：立即呼叫伺服器驗簽登入
    if (parsed.canInstantLogin && parsed.qrToken) {
      setSubmitting(true);
      try {
        const res = await apiQrLogin(parsed.qrToken, lockedRole);
        if (res.success && res.session) {
          onLoginSuccess(res.session, res.bootstrap || null);
          return;
        }
        setErrorMsg(res.error || '影像快速登入憑證驗證失敗，請改輸入密碼登入。');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // 2. LINE 會員 ID / 專屬入口 QR（無加密簽章）：自動帶入帳號並若已填密碼則直接送出
    if (parsed.identifier && passcode.trim()) {
      setSubmitting(true);
      try {
        const targetRole = lockedRole || parsed.role;
        const res = await apiLogin(targetRole, parsed.identifier, passcode.trim());
        if (res.success && res.session) {
          onLoginSuccess(res.session, res.bootstrap || null);
          return;
        }
        setErrorMsg(res.error || '安全驗證密碼不正確，請重新確認密碼。');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setTimeout(() => {
      passcodeInputRef.current?.focus();
    }, 80);
  };

  const renderRoleIcon = (role: UserRole, className = 'w-5 h-5') => {
    switch (role) {
      case 'HQ_STAFF':
        return <ShieldCheck className={className} />;
      case 'MEMBER':
        return <User className={className} />;
      case 'STORE':
        return <Store className={className} />;
      case 'CENTER':
        return <GraduationCap className={className} />;
    }
  };

  const isHqPortal = lockedRole === 'HQ_STAFF' || selectedRole === 'HQ_STAFF';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16 space-y-8">
        {/* Top Portal Identity (Zero internal trade-secret terminology) */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="space-y-2 max-w-2xl">
            <div className="text-xs font-medium text-slate-400 flex flex-wrap items-center gap-2">
              <span>企業智能雲端營運平台</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>伺服器端加密驗證與權限隔離</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
              {lockedRole ? activeConfig.title : '專屬雲端服務登入中心'}
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              {lockedRole
                ? `您目前正使用「${activeConfig.title}」獨立安全入口，請輸入您的授權帳號與驗證密碼登入專屬工作區。`
                : '請選擇您的服務身分進行安全驗證登入。系統採取嚴格資料隔離機制，確保您的個人與團隊資訊安全無虞。'}
            </p>
          </div>
          {!isHqPortal && (
            <div className="text-xs text-slate-400 flex items-center gap-2 shrink-0">
              <CalendarClock className="w-4 h-4 text-sky-400" />
              <span>AI 智能 CRM · 活動行銷 · 個人預約雲端服務</span>
            </div>
          )}
        </div>

        {/* Public Portal Role Selector Cards (HQ_STAFF is completely hidden on public gateway) */}
        {!lockedRole && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PUBLIC_ROLE_CONFIGS.map((cfg) => {
              const isActive = selectedRole === cfg.role;
              return (
                <button
                  key={cfg.role}
                  type="button"
                  onClick={() => handleSelectRole(cfg.role)}
                  className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    isActive
                      ? `bg-slate-900 ${cfg.accentBorder} ring-1 ring-inset ring-slate-700`
                      : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={cfg.accentText}>{renderRoleIcon(cfg.role)}</span>
                    {isActive && (
                      <span className={`text-[11px] font-semibold ${cfg.accentText}`}>
                        已選擇
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-100">{cfg.title}</div>
                    <div className="text-xs text-slate-400 mt-1 line-clamp-2">{cfg.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Main Active Login Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: Credential Login Form (Zero hardcoded passwords or demo quick-login leaks) */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center ${activeConfig.accentText}`}
                  >
                    {renderRoleIcon(activeConfig.role, 'w-5 h-5')}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">{activeConfig.title}</h2>
                    <p className="text-xs text-slate-400">{activeConfig.subtitle}</p>
                  </div>
                </div>

                {!isHqPortal && (
                  <button
                    type="button"
                    onClick={() => setIsQrScannerOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#06C755]/15 hover:bg-[#06C755]/25 border border-[#06C755]/50 text-xs font-bold text-[#4ADE80] transition-colors cursor-pointer shrink-0"
                  >
                    <Camera className="w-4 h-4" />
                    <span>鏡頭掃碼快速登入</span>
                  </button>
                )}
              </div>

              {scannedQrNotice && scannedQrNotice.valid && (
                <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-600/60 text-xs text-emerald-200 flex items-start gap-2.5">
                  <QrCode className="w-4 h-4 text-[#4ADE80] shrink-0 mt-0.5" />
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-bold flex items-center gap-1.5">
                      <span>{scannedQrNotice.displayLabel}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-900/80 text-emerald-200">
                        LineInAppBrowserHandler
                      </span>
                    </div>
                    <p className="text-emerald-100/90 leading-relaxed">
                      {scannedQrNotice.summaryText}
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    登入帳號 / 專屬編號
                  </label>
                  <input
                    ref={identifierInputRef}
                    type="text"
                    required
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={activeConfig.placeholder}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {activeConfig.passcodeLabel}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      ref={passcodeInputRef}
                      type="password"
                      required
                      autoComplete="current-password"
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="請輸入授權驗證密碼"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-3.5 py-2.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/80 text-xs text-rose-300 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="space-y-2.5">
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`w-full py-3 px-4 ${activeConfig.accentBg} disabled:opacity-60 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm`}
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{submitting ? '伺服器安全驗證中...' : `安全驗證並進入「${activeConfig.title}」`}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {!isHqPortal && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setIsQrScannerOpen(true)}
                      className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-800/80 border border-[#06C755]/40 text-emerald-300 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-[#06C755]" />
                      <span>拍攝 LINE 會員 QR Code · 影像識別快速登入</span>
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between gap-2">
              <span>所有登入憑證均經由後端加密驗簽，未授權帳號將無法存取任何系統資料。</span>
            </div>
          </div>

          {/* Right: Confidentiality & Security Policy Summary */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${activeConfig.accentText}`} />
                  <span>授權存取範圍保護</span>
                </h3>
                <div className="mt-3 p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                  {activeConfig.scopeSummary}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>隱私與機密防洩機制</span>
                </h4>
                <div className="mt-2 p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 leading-relaxed">
                  {activeConfig.hiddenSummary}
                </div>
              </div>
            </div>

            {!isHqPortal && (
              <div className="pt-5 border-t border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>個人專屬 AI 雲端數位軟體套組</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-300">智能通訊錄 CRM 管理</span>
                    <span className="font-mono text-teal-400">專屬雲端空間</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-300">活動行銷企劃與花絮</span>
                    <span className="font-mono text-blue-400">專屬雲端空間</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-100 font-semibold">AI 個人線上預約系統</span>
                    <span className="font-mono text-sky-400 font-semibold">30 天免費體驗</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop / Home-Screen Shortcut Guide for LINE In-App Browser & Mobile Users */}
        {!isHqPortal && <DesktopShortcutGuideCard />}
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-5 text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>企業智能雲端營運平台 · 商業機密安全防護架構</span>
          <div className="flex flex-wrap items-center gap-3">
            <span>HttpOnly 加密憑證 · 角色權限嚴格隔離</span>
            {!lockedRole && (
              <>
                <span aria-hidden="true" className="text-slate-700">|</span>
                {selectedRole === 'HQ_STAFF' ? (
                  <button
                    type="button"
                    onClick={() => handleSelectRole('MEMBER')}
                    className="text-sky-400 hover:text-sky-300 font-medium underline-offset-4 hover:underline cursor-pointer"
                  >
                    返回一般服務登入
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSelectRole('HQ_STAFF')}
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>總部工作人員入口</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </footer>

      <CameraQrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onScanSuccess={handleQrDecoded}
      />
    </div>
  );
};
