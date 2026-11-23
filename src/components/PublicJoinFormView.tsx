/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  apiGetPublicSponsorInfo,
  apiPublicRegisterMember,
  PublicRegisterResponse,
} from '../services/confidentialApiClient';
import {
  Sparkles,
  CheckCircle2,
  UserPlus,
  Phone,
  ShieldCheck,
  CalendarClock,
  ArrowLeft,
  Copy,
  Check,
  LogIn,
  AlertTriangle,
  Layers,
  GitFork,
} from 'lucide-react';

interface PublicJoinFormViewProps {
  initialSponsorMid?: string | null;
  onGoToLogin: (prefillMemberId?: string) => void;
}

export const PublicJoinFormView: React.FC<PublicJoinFormViewProps> = ({
  initialSponsorMid = null,
  onGoToLogin,
}) => {
  const [sponsorMid, setSponsorMid] = useState<string>(
    initialSponsorMid ? initialSponsorMid.trim().toUpperCase() : ''
  );
  const [sponsorDisplay, setSponsorDisplay] = useState<{
    loaded: boolean;
    valid: boolean;
    sponsorMid: string;
    sponsorName: string;
  }>({
    loaded: false,
    valid: false,
    sponsorMid: initialSponsorMid ? initialSponsorMid.trim().toUpperCase() : '',
    sponsorName: '',
  });

  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [idNumberMasked, setIdNumberMasked] = useState<string>('');
  const [line, setLine] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [tel, setTel] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [activateBookingSystem, setActivateBookingSystem] = useState<boolean>(true);
  const [showOptionalFields, setShowOptionalFields] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<PublicRegisterResponse['registration'] | null>(
    null
  );
  const [copiedMid, setCopiedMid] = useState<boolean>(false);

  const sponsorLockedByLink = Boolean(initialSponsorMid && initialSponsorMid.trim());

  useEffect(() => {
    let cancelled = false;
    const queryMid = sponsorMid.trim();
    const timer = setTimeout(() => {
      apiGetPublicSponsorInfo(queryMid).then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setSponsorDisplay({
            loaded: true,
            valid: res.valid,
            sponsorMid: res.sponsorMid,
            sponsorName: res.sponsorName,
          });
          if (!queryMid && res.sponsorMid) {
            setSponsorMid(res.sponsorMid);
          }
        }
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sponsorMid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) {
      setErrorMsg('請填寫您的真實姓名');
      return;
    }
    const phoneDigits = trimmedPhone.replace(/[\s\-+()]/g, '');
    if (!phoneDigits || !/^\d{8,15}$/.test(phoneDigits)) {
      setErrorMsg('請輸入正確的手機號碼（例如 0912345678）');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiPublicRegisterMember({
        name: trimmedName,
        phone: trimmedPhone,
        idNumberMasked: idNumberMasked.trim() || undefined,
        line: line.trim() || undefined,
        email: email.trim() || undefined,
        tel: tel.trim() || undefined,
        address: address.trim() || undefined,
        sponsorMid: sponsorMid.trim() || undefined,
        activateBookingSystem,
      });

      if (!res.ok || !res.registration) {
        setErrorMsg(res.error || '開通失敗，請確認欄位資料後重試');
        return;
      }

      setSuccessData(res.registration);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyMid = async () => {
    if (!successData?.mid) return;
    try {
      await navigator.clipboard.writeText(successData.mid);
      setCopiedMid(true);
      setTimeout(() => setCopiedMid(false), 2000);
    } catch {
      // ignore
    }
  };

  const formatExpiryDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso.slice(0, 10);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        {/* Top Navigation Back to Login */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onGoToLogin()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-sky-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>已有會員帳號？返回安全登入頁</span>
          </button>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>免登入免費開通</span>
          </span>
        </div>

        {/* Header Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-xs text-sky-300 font-semibold">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>AI 智能雲端軟體 1+1 · 30 天免費體驗自助開通</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            新夥伴掃碼免費開通申請表
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            填寫姓名與手機即可立即領取專屬會員編號，自動開通<strong className="text-teal-300">智能通訊錄 CRM</strong>與<strong className="text-blue-300">活動行銷管理</strong>兩大雲端工具，並同步綁定您的專屬推薦人服務窗口。
          </p>

          {/* Verified Sponsor Banner */}
          {sponsorDisplay.loaded && sponsorDisplay.sponsorMid && (
            <div className="p-3 rounded-xl bg-indigo-950/50 border border-indigo-700/60 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-indigo-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  推薦人已鎖定：
                  <strong className="text-white ml-1">{sponsorDisplay.sponsorName}</strong>
                </span>
              </div>
              <span className="font-mono font-bold text-indigo-300 bg-slate-950/80 px-2.5 py-0.5 rounded border border-indigo-800/80">
                {sponsorDisplay.sponsorMid}
              </span>
            </div>
          )}
        </div>

        {/* Success Onboarding Receipt Card */}
        {successData ? (
          <div className="bg-gradient-to-b from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/60 rounded-2xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center gap-3 pb-4 border-b border-emerald-900/60">
              <div className="w-11 h-11 rounded-full bg-emerald-600/20 border border-emerald-500 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">
                  恭喜 {successData.name}，已成功開通！
                </h2>
                <p className="text-xs text-emerald-300 mt-0.5">
                  您的專屬雲端帳號與 30 天體驗資格已立即生效並同步建檔
                </p>
              </div>
            </div>

            {/* Highlighted Member ID Box */}
            <div className="p-4 rounded-xl bg-slate-950 border border-sky-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-[11px] text-slate-400">您的專屬會員編號（請截圖或複製保存）</div>
                <div className="text-2xl font-black font-mono text-sky-300 tracking-wide mt-0.5">
                  {successData.mid}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyMid}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-100 cursor-pointer transition-colors"
              >
                {copiedMid ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-sky-400" />
                )}
                <span>{copiedMid ? '已複製會員編號' : '複製會員編號'}</span>
              </button>
            </div>

            {/* Activated 1+1 Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-teal-800/60 space-y-1">
                <div className="font-bold text-teal-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>第 1 套 · 智能通訊錄 CRM</span>
                </div>
                <div className="font-mono text-slate-200 font-semibold">
                  排位序號：{successData.monolineNodeId}
                </div>
                <div className="text-[11px] text-slate-400">
                  體驗到期日：{formatExpiryDate(successData.trialExpiresAt)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-blue-800/60 space-y-1">
                <div className="font-bold text-blue-400 flex items-center gap-1.5">
                  <GitFork className="w-3.5 h-3.5" />
                  <span>第 2 套 · 活動行銷管理</span>
                </div>
                <div className="font-mono text-slate-200 font-semibold">
                  卡位節點：{successData.binaryNodeId}
                </div>
                <div className="text-[11px] text-slate-400">
                  推薦人編號：{successData.sponsorMid}
                </div>
              </div>
            </div>

            {successData.bookingLicenseId && (
              <div className="p-3 rounded-xl bg-slate-950 border border-sky-800/60 flex items-center justify-between gap-2 text-xs">
                <span className="text-sky-300 font-semibold flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>第 3 套 AI 個人預約系統已同步開通</span>
                </span>
                <span className="font-mono text-emerald-400 font-bold">
                  {successData.bookingLicenseId}
                </span>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 leading-relaxed">
              登入方式：請點擊下方按鈕前往會員入口，輸入您的會員編號（<span className="font-mono text-sky-300 font-semibold">{successData.mid}</span>）或手機號碼（<span className="font-mono text-sky-300 font-semibold">{successData.phone}</span>），並向推薦人索取安全驗證密碼即可登入使用。
            </div>

            <button
              type="button"
              onClick={() => onGoToLogin(successData.mid)}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span>立即前往會員登入入口（自動帶入 {successData.mid}）</span>
            </button>
          </div>
        ) : (
          /* Clean Blank Public Registration Form */
          <form
            onSubmit={handleSubmit}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5"
          >
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-sm font-bold text-slate-100">
              <UserPlus className="w-4 h-4 text-sky-400" />
              <span>填寫基本資料（標記 * 為必填）</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  真實姓名 *
                </label>
                <input
                  type="text"
                  required
                  maxLength={50}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="請輸入您的中文姓名"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  手機號碼 *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    maxLength={20}
                    autoComplete="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="例如 0912345678"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  推薦人編號 (MID)
                </label>
                <input
                  type="text"
                  maxLength={24}
                  value={sponsorMid}
                  disabled={sponsorLockedByLink}
                  onChange={(e) => setSponsorMid(e.target.value.toUpperCase())}
                  placeholder="留空則由總部指派服務窗口"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-indigo-300 focus:outline-none focus:border-indigo-500 disabled:opacity-75"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Line ID（選填，方便推薦人聯繫）
                </label>
                <input
                  type="text"
                  maxLength={50}
                  value={line}
                  onChange={(e) => setLine(e.target.value)}
                  placeholder="輸入您的 Line ID"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-emerald-300 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* Optional Extra Fields Accordion */}
            <div className="border-t border-slate-800/80 pt-3">
              <button
                type="button"
                onClick={() => setShowOptionalFields((prev) => !prev)}
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
              >
                {showOptionalFields
                  ? '▾ 收合選填聯絡資訊（身分證去識別 / Email / 地址 / 市話）'
                  : '▸ 展開補充選填資料（身分證去識別 / Email / 通訊地址 / 市話）'}
              </button>

              {showOptionalFields && (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        身分證號（去識別格式，選填）
                      </label>
                      <input
                        type="text"
                        maxLength={20}
                        value={idNumberMasked}
                        onChange={(e) => setIdNumberMasked(e.target.value)}
                        placeholder="例如 A123***789"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        市話 / 公司電話（選填）
                      </label>
                      <input
                        type="tel"
                        maxLength={25}
                        value={tel}
                        onChange={(e) => setTel(e.target.value)}
                        placeholder="例如 02-2771-9900"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Email 信箱（選填）
                    </label>
                    <input
                      type="email"
                      maxLength={100}
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      通訊地址（選填）
                    </label>
                    <input
                      type="text"
                      maxLength={150}
                      autoComplete="street-address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="縣市、鄉鎮市區及街道門牌"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3rd AI Booking System Toggle */}
            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950 border border-sky-900/60 cursor-pointer">
              <input
                type="checkbox"
                checked={activateBookingSystem}
                onChange={(e) => setActivateBookingSystem(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0"
              />
              <div className="text-xs">
                <div className="font-bold text-sky-300 flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4 shrink-0" />
                  <span>同步免費加開第 3 套 AI 個人預約系統</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  享 30 天完整免費體驗，建立個人專屬線上預約頁面
                </div>
              </div>
            </label>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/80 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 via-sky-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <Sparkles className="w-4 h-4" />
              <span>{submitting ? '正在核發專屬編號與開通中...' : '立即免費開通 AI 軟體 1+1（30 天體驗）'}</span>
            </button>
          </form>
        )}
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 text-center text-[11px] text-slate-500">
        企業智能雲端營運平台 · 全程加密傳輸與個資隔離保護
      </footer>
    </div>
  );
};
