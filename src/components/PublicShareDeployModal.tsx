/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Share2,
  Rocket,
  Link2,
  Copy,
  Check,
  X,
  ExternalLink,
  Smartphone,
  Globe,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Code2,
  QrCode,
  CheckCircle2,
  ArrowRightLeft,
  Server,
  Activity,
  Download,
  Package,
} from 'lucide-react';
import { UserRole } from '../types/erp';
import {
  OFFICIAL_GAS_EXEC_URL,
  OFFICIAL_SHARED_APP_URL,
  buildRolePortalUrl,
  buildPublicJoinUrl,
  buildPublicMobileCenterUrl,
  getSavedExternalBaseUrl,
  validateExternalBaseUrl,
} from '../services/rolePortalUrlService';
import {
  GasBridgeRemoteState,
  GasHydrationStatusRemote,
  apiDownloadHqProjectZip,
  apiGetHqGasBridge,
  apiSaveAndTestHqGasBridge,
} from '../services/confidentialApiClient';
import { erpEngine } from '../services/erpEngine';

export type ShareDeployModalTab = 'share' | 'deploy';

interface PublicShareDeployModalProps {
  isOpen: boolean;
  initialTab: ShareDeployModalTab;
  onClose: () => void;
  sessionRole?: UserRole | null;
  sessionUserId?: string | null;
  lockedPortalRole?: UserRole | null;
  onNavigateHqGas?: () => void;
  onHydrated?: () => void;
}

type PublicTargetChoice = 'PUBLIC_JOIN' | 'PUBLIC_CENTER' | 'MEMBER' | 'STORE' | 'CENTER' | 'HQ_STAFF';

const CORRECTED_EMBED_HTML = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-title" content="專屬服務中心" />
  <title>專屬雲端服務登入中心</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; height: 100dvh; overflow: hidden; background: #020617; }
    iframe { display: block; width: 100%; height: 100%; border: 0; }
  </style>
</head>
<body>
  <iframe
    id="erpFrame"
    title="專屬雲端服務登入中心"
    allow="camera *; microphone *; clipboard-read *; clipboard-write *; fullscreen *"
    allowfullscreen="true"
    scrolling="auto">
  </iframe>
  <script>
    (function () {
      var BASE = "${OFFICIAL_SHARED_APP_URL}";
      var ua = navigator.userAgent || "";
      var isLine = /\\bLine\\//i.test(ua) || /\\bLIFF\\b/i.test(ua);
      var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|\\bLine\\//i.test(ua) || (window.innerWidth > 0 && window.innerWidth <= 820);
      function mount(p) {
        var keys = ["portal", "id", "sponsor", "ref", "qrToken", "device", "inapp", "openExternalBrowser"];
        var qs = [], hasDev = false;
        for (var i = 0; i < keys.length; i++) {
          var v = p && p[keys[i]];
          if (v !== undefined && v !== null && String(v).trim() !== "") {
            if (keys[i] === "device") hasDev = true;
            qs.push(encodeURIComponent(keys[i]) + "=" + encodeURIComponent(String(v).trim()));
          }
        }
        if (!hasDev && isMobile) qs.push("device=mobile");
        if (isLine && (!p || !p.inapp)) qs.push("inapp=line");
        document.getElementById("erpFrame").src = BASE + (qs.length ? "?" + qs.join("&") : "");
      }
      if (window.google && google.script && google.script.url && typeof google.script.url.getLocation === "function") {
        google.script.url.getLocation(function (loc) { mount((loc && loc.parameter) || {}); });
      } else {
        var sp = new URLSearchParams(window.location.search || ""), obj = {};
        sp.forEach(function (v, k) { obj[k] = v; });
        mount(obj);
      }
    })();
  </script>
</body>
</html>`;

export const PublicShareDeployModal: React.FC<PublicShareDeployModalProps> = ({
  isOpen,
  initialTab,
  onClose,
  sessionRole = null,
  sessionUserId = null,
  lockedPortalRole = null,
  onNavigateHqGas,
  onHydrated,
}) => {
  const isHqStaff = sessionRole === 'HQ_STAFF';
  const [activeTab, setActiveTab] = useState<ShareDeployModalTab>(initialTab);
  const [baseKind, setBaseKind] = useState<'cloudrun' | 'gas' | 'custom'>('cloudrun');
  const [customBaseUrl, setCustomBaseUrl] = useState<string>(() => {
    if (typeof window !== 'undefined' && !/ais-dev-/.test(window.location.origin)) {
      return window.location.origin;
    }
    return OFFICIAL_SHARED_APP_URL;
  });
  const [targetChoice, setTargetChoice] = useState<PublicTargetChoice>(() => {
    if (lockedPortalRole && lockedPortalRole !== 'HQ_STAFF') return lockedPortalRole;
    if (sessionRole && sessionRole !== 'HQ_STAFF') return sessionRole;
    return 'PUBLIC_JOIN';
  });
  const [mobileMode, setMobileMode] = useState<boolean>(true);
  const [lineExternalMode, setLineExternalMode] = useState<boolean>(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [healthState, setHealthState] = useState<{
    status: 'idle' | 'checking' | 'ok' | 'unreachable';
    detail: string;
  }>({ status: 'idle', detail: '' });

  // HQ-Only Server <-> GAS /exec Bidirectional Bridge State
  const [bridgeState, setBridgeState] = useState<GasBridgeRemoteState | null>(null);
  const [bridgeUrlInput, setBridgeUrlInput] = useState<string>(OFFICIAL_GAS_EXEC_URL);
  const [bridgeAutoSync, setBridgeAutoSync] = useState<boolean>(true);
  const [bridgeBusy, setBridgeBusy] = useState<boolean>(false);
  const [bridgeFeedback, setBridgeFeedback] = useState<{
    ok: boolean;
    message: string;
    timestamp?: string;
    remoteStats?: Record<string, any> | null;
  } | null>(null);
  const [hydrationFeedback, setHydrationFeedback] = useState<GasHydrationStatusRemote | null>(null);
  const [zipDownloading, setZipDownloading] = useState<boolean>(false);
  const [zipFeedback, setZipFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      if (lockedPortalRole && lockedPortalRole !== 'HQ_STAFF') {
        setTargetChoice(lockedPortalRole);
      } else if (sessionRole && sessionRole !== 'HQ_STAFF') {
        setTargetChoice(sessionRole);
      }
    }
  }, [isOpen, initialTab, lockedPortalRole, sessionRole]);

  useEffect(() => {
    if (!isOpen || !isHqStaff || activeTab !== 'deploy') return;
    let cancelled = false;
    apiGetHqGasBridge().then((res) => {
      if (cancelled || !res.ok || !res.state) return;
      setBridgeState(res.state);
      setBridgeUrlInput(res.state.gasWebAppUrl || OFFICIAL_GAS_EXEC_URL);
      setBridgeAutoSync(res.state.autoSyncEnabled);
      if (res.state.lastSyncStatus) {
        setBridgeFeedback({
          ok: res.state.lastSyncStatus.ok,
          message: res.state.lastSyncStatus.message,
          timestamp: res.state.lastSyncStatus.timestamp,
          remoteStats: res.state.lastSyncStatus.remoteStats || null,
        });
      }
      if (res.state.lastHydrationStatus) {
        setHydrationFeedback(res.state.lastHydrationStatus);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, isHqStaff, activeTab]);

  const savedBase = getSavedExternalBaseUrl();
  const customCheck = useMemo(() => validateExternalBaseUrl(customBaseUrl), [customBaseUrl]);
  const activeBaseUrl =
    baseKind === 'gas'
      ? savedBase || OFFICIAL_GAS_EXEC_URL
      : baseKind === 'custom'
        ? customCheck.valid
          ? customCheck.normalized
          : OFFICIAL_SHARED_APP_URL
        : OFFICIAL_SHARED_APP_URL;

  const generatedUrl = useMemo(() => {
    const customId =
      sessionRole && sessionRole !== 'HQ_STAFF' && sessionUserId ? sessionUserId : undefined;
    if (targetChoice === 'PUBLIC_JOIN') {
      return buildPublicJoinUrl(customId, activeBaseUrl, {
        device: mobileMode ? 'mobile' : 'desktop',
        openExternalBrowser: lineExternalMode,
      });
    }
    if (targetChoice === 'PUBLIC_CENTER') {
      return buildPublicMobileCenterUrl(activeBaseUrl, {
        openExternalBrowser: lineExternalMode,
      });
    }
    const safeRole: UserRole =
      targetChoice === 'HQ_STAFF' && !isHqStaff ? 'MEMBER' : targetChoice;
    return buildRolePortalUrl(safeRole, customId, activeBaseUrl, {
      device: mobileMode ? 'mobile' : undefined,
      openExternalBrowser: lineExternalMode,
    });
  }, [activeBaseUrl, targetChoice, mobileMode, lineExternalMode, sessionRole, sessionUserId, isHqStaff]);

  useEffect(() => {
    if (!isOpen || !generatedUrl) return;
    let cancelled = false;
    QRCode.toDataURL(generatedUrl, {
      width: 480,
      margin: 3,
      errorCorrectionLevel: 'H',
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, generatedUrl]);

  const checkCloudRunHealth = async () => {
    setHealthState({ status: 'checking', detail: `正在檢測正式公開主機 (${OFFICIAL_SHARED_APP_URL}) 連線狀態...` });
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${OFFICIAL_SHARED_APP_URL}/api/health`, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        setHealthState({
          status: 'ok',
          detail: '正式公開主機 (Render) 回應 HTTP 200 正常，外部手機、LINE 掃碼與 Google 協作平台皆可直接開啟！',
        });
      } else {
        setHealthState({
          status: 'unreachable',
          detail: `正式主機目前回應 HTTP ${res.status}（免費方案若休眠中請等待約 20~40 秒喚醒後重測）。`,
        });
      }
    } catch {
      setHealthState({
        status: 'unreachable',
        detail:
          '目前無法從外部連通正式主機（免費方案可能正在喚醒中，請稍候再點「重新檢測」或先改用 GAS /exec 網址）。',
      });
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'deploy' && healthState.status === 'idle') {
      checkCloudRunHealth();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      // ignore clipboard fallback
    }
  };

  const handleDownloadQrPng = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `Mobile_QR_${targetChoice.toLowerCase()}.png`;
    a.click();
  };

  const handleDownloadMobilePosterPng = async () => {
    if (!qrDataUrl) return;
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 940;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#0EA5E9';
    ctx.fillRect(0, 0, canvas.width, 16);

    const roleLabel =
      targetChoice === 'PUBLIC_JOIN'
        ? '免登入掃碼入會 · 免費開通 AI 1+1'
        : targetChoice === 'MEMBER'
          ? '一般會員手機專用入口'
          : targetChoice === 'STORE'
            ? '一般營業店手機專用入口'
            : targetChoice === 'CENTER'
              ? '一般教育中心手機專用入口'
              : targetChoice === 'HQ_STAFF'
                ? '總部營運專屬安全入口'
                : '企業智能雲端手機服務中心';

    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.roundRect(170, 56, 380, 40, 20);
    ctx.fill();

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 18px "Noto Sans TC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('手機 / LINE 掃碼專用立牌', canvas.width / 2, 82);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 34px "Noto Sans TC", sans-serif';
    ctx.fillText(roleLabel, canvas.width / 2, 152);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '18px "Noto Sans TC", sans-serif';
    ctx.fillText('手機相機或 LINE 掃一掃，立即進入手機最佳化操作畫面', canvas.width / 2, 192);

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(120, 232, 480, 480, 24);
    ctx.fill();

    const img = new Image();
    img.src = qrDataUrl;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
    ctx.drawImage(img, 144, 256, 432, 432);

    ctx.fillStyle = '#064E3B';
    ctx.beginPath();
    ctx.roundRect(130, 748, 460, 42, 21);
    ctx.fill();

    ctx.fillStyle = '#4ADE80';
    ctx.font = 'bold 19px "Noto Sans TC", sans-serif';
    ctx.fillText('支援直接加入手機桌面捷徑 · App 級全螢幕體驗', canvas.width / 2, 775);

    ctx.fillStyle = '#64748B';
    ctx.font = '14px monospace';
    const previewUrl = generatedUrl.length > 56 ? generatedUrl.slice(0, 53) + '...' : generatedUrl;
    ctx.fillText(previewUrl, canvas.width / 2, 836);

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `Mobile_Poster_${targetChoice.toLowerCase()}.png`;
    a.click();
  };

  const handleDownloadProjectZip = async () => {
    if (!isHqStaff || zipDownloading) return;
    setZipDownloading(true);
    setZipFeedback(null);
    const res = await apiDownloadHqProjectZip();
    setZipDownloading(false);
    if (!res.ok) {
      setZipFeedback({
        ok: false,
        message: res.error || '無法下載專案壓縮檔，請確認已登入總部帳號。',
      });
      return;
    }
    setZipFeedback({
      ok: true,
      message: `已下載整包完整專案 (erp-saas-system.zip${res.fileCount ? `，共 ${res.fileCount} 個原始檔案` : ''})！解壓縮後即可透過 GitHub Desktop 上傳至 Private 倉庫並部署到 Zeabur / Render。`,
    });
  };

  const handleSaveAndPingGasBridge = async (options: { testPing?: boolean; hydrateNow?: boolean }) => {
    if (!isHqStaff || bridgeBusy) return;
    setBridgeBusy(true);
    setBridgeFeedback(null);
    const res = await apiSaveAndTestHqGasBridge({
      gasWebAppUrl: bridgeUrlInput.trim(),
      autoSyncEnabled: bridgeAutoSync,
      testPing: Boolean(options.testPing),
      hydrateNow: Boolean(options.hydrateNow),
    });
    setBridgeBusy(false);
    if (!res.ok) {
      setBridgeFeedback({
        ok: false,
        message: res.error || '更新或測試 GAS 橋接設定失敗',
      });
      return;
    }
    if (res.state) {
      setBridgeState(res.state);
      setBridgeUrlInput(res.state.gasWebAppUrl);
      setBridgeAutoSync(res.state.autoSyncEnabled);
      if (res.state.lastHydrationStatus) {
        setHydrationFeedback(res.state.lastHydrationStatus);
      }
    }
    if (res.hydrationResult) {
      setHydrationFeedback(res.hydrationResult);
    }
    if (res.bootstrap) {
      erpEngine.hydrateFromServer(res.bootstrap);
      onHydrated?.();
    }
    if (res.pingResult) {
      setBridgeFeedback({
        ok: res.pingResult.ok,
        message: res.pingResult.message,
        timestamp: res.pingResult.timestamp,
        remoteStats: res.pingResult.remoteStats || null,
      });
    } else if (res.hydrationResult) {
      setBridgeFeedback({
        ok: res.hydrationResult.ok,
        message: res.hydrationResult.message,
        timestamp: res.hydrationResult.timestamp,
      });
    } else {
      setBridgeFeedback({
        ok: true,
        message: '已儲存伺服器端 GAS /exec 串接設定與自動同步開關。',
        timestamp: new Date().toISOString(),
      });
    }
  };

  const roleChoices: Array<{ id: PublicTargetChoice; label: string }> =
    lockedPortalRole && lockedPortalRole !== 'HQ_STAFF'
      ? [
          { id: 'PUBLIC_JOIN', label: '免登入掃碼入會頁' },
          {
            id: lockedPortalRole,
            label:
              lockedPortalRole === 'MEMBER'
                ? '一般會員入口'
                : lockedPortalRole === 'STORE'
                  ? '一般營業店入口'
                  : '一般教育中心入口',
          },
        ]
      : [
          { id: 'PUBLIC_JOIN', label: '免登入掃碼入會頁' },
          { id: 'MEMBER', label: '一般會員入口' },
          { id: 'STORE', label: '一般營業店入口' },
          { id: 'CENTER', label: '一般教育中心入口' },
          { id: 'PUBLIC_CENTER', label: '統一登入中心' },
          ...(isHqStaff ? [{ id: 'HQ_STAFF' as const, label: '總部管理入口 (機密)' }] : []),
        ];

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="分享對外網址與部署中心"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
              {activeTab === 'share' ? (
                <Share2 className="w-4 h-4" />
              ) : (
                <Rocket className="w-4 h-4" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {activeTab === 'share'
                  ? '公開分享連結與 QR Code（任何人皆可檢視）'
                  : '對外發布部署與 Google 協作平台內嵌檢測'}
              </h2>
              <p className="text-[11px] text-slate-400">
                自動隔離開發測試網域 (ais-dev)，只輸出可對外開啟的 GAS /exec 與正式公開網址
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉視窗"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-Tabs */}
        <div className="px-5 pt-3 border-b border-slate-800 flex items-center gap-2 bg-slate-950/30">
          <button
            type="button"
            onClick={() => setActiveTab('share')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'share'
                ? 'border-sky-400 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>分享與複製對外網址</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('deploy')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'deploy'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>對外發布與協作平台 HTML</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {activeTab === 'share' && (
            <>
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-700/50 flex items-start gap-2.5 text-emerald-200">
                <Globe className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold">公開存取權限：任何人皆可透過連結開啟</div>
                  <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                    已預設綁定您的正式公開主機（<span className="font-mono text-sky-300">{OFFICIAL_SHARED_APP_URL}</span>），可直接複製連結、下載掃碼立牌或貼入 LINE 推廣給新夥伴免登入入會。
                  </p>
                </div>
              </div>

              {/* Base URL Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setBaseKind('cloudrun')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    baseKind === 'cloudrun'
                      ? 'bg-sky-950/40 border-sky-500/70 text-sky-100'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>正式公開主機 (Render)</span>
                    {baseKind === 'cloudrun' && <CheckCircle2 className="w-4 h-4 text-sky-400" />}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-mono truncate">
                    erp-saas-system.onrender.com
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setBaseKind('gas')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    baseKind === 'gas'
                      ? 'bg-emerald-950/40 border-emerald-500/70 text-emerald-100'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>GAS /exec 轉接網址</span>
                    {baseKind === 'gas' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    透過您的試算表 /exec 進入
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setBaseKind('custom')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    baseKind === 'custom'
                      ? 'bg-indigo-950/40 border-indigo-500/70 text-indigo-100'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>自訂公開主機網址</span>
                    {baseKind === 'custom' && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    填入 Zeabur / Render / Railway
                  </div>
                </button>
              </div>

              {baseKind === 'custom' && (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-indigo-300">
                    貼入您部署好的公開網址（將即時更新右側手機專用 QR Code）
                  </label>
                  <input
                    type="url"
                    value={customBaseUrl}
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                    placeholder="https://your-app.zeabur.app 或 https://your-app.onrender.com"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-indigo-500/50 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-indigo-400"
                  />
                  {!customCheck.valid && (
                    <div className="text-[11px] text-amber-400">{customCheck.error}</div>
                  )}
                </div>
              )}

              {/* Role Picker */}
              <div className="space-y-2">
                <div className="font-semibold text-slate-300">選擇要分享的專屬入口身分</div>
                <div className="flex flex-wrap gap-2">
                  {roleChoices.map((rc) => (
                    <button
                      key={rc.id}
                      type="button"
                      onClick={() => setTargetChoice(rc.id)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                        targetChoice === rc.id
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {rc.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={mobileMode}
                    onChange={(e) => setMobileMode(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-sky-500"
                  />
                  <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                  <span>強制開啟手機專用版面 (device=mobile)</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={lineExternalMode}
                    onChange={(e) => setLineExternalMode(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-emerald-500"
                  />
                  <span>LINE 自動跳轉手機瀏覽器 (openExternalBrowser=1)</span>
                </label>
              </div>

              {/* Generated URL + QR */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="md:col-span-8 space-y-3 min-w-0">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    可直接對外貼上使用之安全公開網址
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-sky-300 break-all select-all">
                    {generatedUrl}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy('share_url', generatedUrl)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer transition-colors"
                    >
                      {copiedKey === 'share_url' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'share_url' ? '已複製公開網址！' : '一鍵複製公開網址'}</span>
                    </button>
                    <a
                      href={generatedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>新視窗實測開啟</span>
                    </a>
                  </div>
                </div>

                <div className="md:col-span-4 flex flex-col items-center justify-center p-3 bg-white rounded-xl space-y-2">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="手機專用對外公開入口 QR Code" className="w-36 h-36" />
                  ) : (
                    <div className="w-36 h-36 flex items-center justify-center text-slate-400">
                      <QrCode className="w-10 h-10" />
                    </div>
                  )}
                  <span className="text-[11px] font-bold text-slate-800 text-center">
                    LINE 掃一掃 · 手機專用入口
                  </span>
                  <div className="w-full flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={handleDownloadQrPng}
                      disabled={!qrDataUrl}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>下載純 QR 圖檔 (PNG)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadMobilePosterPng}
                      disabled={!qrDataUrl}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>下載手機掃碼立牌海報</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'deploy' && (
            <>
              {/* Download Full Project ZIP Card (Strictly HQ-Only) */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-sky-950/60 via-slate-950 to-indigo-950/50 border border-sky-500/40 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-bold text-sky-200 flex items-center gap-2 text-sm">
                      <Package className="w-4 h-4 text-sky-400" />
                      <span>Download app / 一鍵打包下載整包專案 (.zip)</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      直接在系統內打包下載完整專案原始碼（已自動排除敏感金鑰與龐大相依套件），解壓後即可推上 GitHub Private 倉庫或部署至 Zeabur / Render / Cloud Run。
                    </p>
                  </div>

                  {isHqStaff ? (
                    <button
                      type="button"
                      onClick={handleDownloadProjectZip}
                      disabled={zipDownloading}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs cursor-pointer transition-colors shadow-lg shrink-0 disabled:opacity-60"
                    >
                      <Download className={`w-4 h-4 ${zipDownloading ? 'animate-bounce' : ''}`} />
                      <span>{zipDownloading ? '正在打包壓縮...' : 'Download app / 下載 (↓ .zip)'}</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-amber-300 font-semibold shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span>請先以總部工作人員登入解鎖下載</span>
                    </span>
                  )}
                </div>

                {zipFeedback && (
                  <div
                    className={`p-2.5 rounded-lg border text-[11px] flex items-start gap-2 ${
                      zipFeedback.ok
                        ? 'bg-emerald-950/50 border-emerald-600/60 text-emerald-200'
                        : 'bg-amber-950/50 border-amber-600/60 text-amber-200'
                    }`}
                  >
                    {zipFeedback.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <span>{zipFeedback.message}</span>
                  </div>
                )}
              </div>

              {/* Live Render reachability checker */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-slate-100 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    <span>正式公開主機 (Render) 即時連通狀態檢測</span>
                  </div>
                  <button
                    type="button"
                    onClick={checkCloudRunHealth}
                    disabled={healthState.status === 'checking'}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${healthState.status === 'checking' ? 'animate-spin' : ''}`}
                    />
                    <span>重新檢測</span>
                  </button>
                </div>

                <div className="font-mono text-[11px] text-slate-400 break-all">
                  目標公開網址：{OFFICIAL_SHARED_APP_URL}
                </div>

                {healthState.status === 'ok' && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-600/60 text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{healthState.detail}</span>
                  </div>
                )}
                {healthState.status === 'unreachable' && (
                  <div className="p-2.5 rounded-lg bg-amber-950/50 border border-amber-600/60 text-amber-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{healthState.detail}</span>
                  </div>
                )}
              </div>

              {/* Bidirectional GAS <-> React+Express Architecture Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-indigo-700/50 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-indigo-200 flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
                    <span>完整版畫面 × GAS /exec 雙向串接架構</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700/70 text-[10px] font-bold text-indigo-300">
                    前後端分離雙寫引擎
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  本系統採用完整 React 介面搭配後端運算權限伺服器，透過以下雙向橋接即可讓您保有完整畫面同時寫入 Google Apps Script（試算表 / 雲端硬碟 / MySQL）：
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <div className="font-bold text-sky-300 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      <span>1. 入口導流（GAS ➔ 本系統完整畫面）</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      若上方的 <code className="text-amber-300">.run.app</code> 顯示尚未部署 404，請將專案部署至公開 Node 主機（Cloud Run / Zeabur / Render / Railway），再將公開網址填入 <code className="text-sky-300">Code.gs</code> 的 <code className="text-sky-300">FRONTEND_APP_URL</code>。
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5" />
                      <span>2. 資料雙寫（後端 ➔ GAS doPost）</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      會員註冊、100 點閉環核帳、月費續費與雙軌排線會由後端伺服器直接透過 <code className="text-emerald-300">POST</code> 轉送至您的 GAS <code className="text-emerald-300">/exec</code>，免除瀏覽器 CORS 阻擋。
                    </p>
                  </div>
                </div>

                {isHqStaff && (
                  <div className="pt-3 mt-1 border-t border-slate-800 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
                        <Activity className="w-3.5 h-3.5" />
                        <span>總部即時實測：伺服器端 Ping GAS /exec 並設定自動雙寫</span>
                      </div>
                      {bridgeState?.lastSyncStatus && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                            bridgeState.lastSyncStatus.ok
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                              : 'bg-amber-950 text-amber-300 border border-amber-700/60'
                          }`}
                        >
                          最近狀態：{bridgeState.lastSyncStatus.action}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[11px] font-semibold text-slate-300">
                        後端轉送目標 GAS Web App (/exec) 網址
                      </label>
                      <input
                        type="url"
                        value={bridgeUrlInput}
                        onChange={(e) => setBridgeUrlInput(e.target.value)}
                        placeholder="https://script.google.com/macros/s/.../exec"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-emerald-500"
                      />
                      <p className="text-[11px] text-amber-300/90 leading-relaxed">
                        💡 永久綁定提醒：Render 免費主機休眠重啟時會重設暫存設定檔，建議同時到 Render 控制台的 <code className="text-sky-300">Environment</code> 新增環境變數 <code className="text-emerald-300">GAS_WEB_APP_URL</code> = 您最新試算表的 <code className="text-emerald-300">/exec</code> 網址，即可保證每次喚醒自動回讀真實會員！
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="inline-flex items-center gap-2 cursor-pointer text-slate-300 text-[11px]">
                        <input
                          type="checkbox"
                          checked={bridgeAutoSync}
                          onChange={(e) => setBridgeAutoSync(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-900 text-emerald-500"
                        />
                        <span>啟用交易自動雙寫至 GAS（註冊 / 100點核帳 / 月費 / 雙軌排線）</span>
                      </label>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveAndPingGasBridge({})}
                          disabled={bridgeBusy}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                        >
                          僅儲存設定
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveAndPingGasBridge({ hydrateNow: true })}
                          disabled={bridgeBusy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${bridgeBusy ? 'animate-spin' : ''}`} />
                          <span>從試算表回讀同步</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveAndPingGasBridge({ testPing: true })}
                          disabled={bridgeBusy}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${bridgeBusy ? 'animate-spin' : ''}`} />
                          <span>{bridgeBusy ? '連線實測中...' : '儲存並實機 Ping 測試 GAS'}</span>
                        </button>
                      </div>
                    </div>

                    {hydrationFeedback && (
                      <div
                        className={`p-2.5 rounded-lg border text-[11px] flex items-start gap-2 ${
                          hydrationFeedback.ok
                            ? 'bg-sky-950/40 border-sky-700/60 text-sky-200'
                            : 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                        }`}
                      >
                        <Server className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <div className="font-bold">
                            開機/手動試算表回讀狀態（{hydrationFeedback.source === 'startup' ? '開機自動回讀' : '總部手動回讀'}）
                          </div>
                          <div>{hydrationFeedback.message}</div>
                        </div>
                      </div>
                    )}

                    {bridgeFeedback && (
                      <div
                        className={`p-3 rounded-lg border text-[11px] space-y-1.5 ${
                          bridgeFeedback.ok
                            ? 'bg-emerald-950/50 border-emerald-600/60 text-emerald-200'
                            : 'bg-amber-950/50 border-amber-600/60 text-amber-200'
                        }`}
                      >
                        <div className="flex items-start gap-2 font-semibold">
                          {bridgeFeedback.ok ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          )}
                          <span>{bridgeFeedback.message}</span>
                        </div>
                        {bridgeFeedback.remoteStats && (
                          <pre className="p-2 rounded bg-slate-950/80 border border-slate-800 font-mono text-[10px] text-emerald-300 overflow-x-auto max-h-28">
                            {JSON.stringify(bridgeFeedback.remoteStats, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Fixed Google Sites / GAS Index.html Embed Code */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-slate-100 flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    <span>Google 協作平台 / GAS Index.html 修正版內嵌程式碼</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy('embed_html', CORRECTED_EMBED_HTML)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer transition-colors"
                  >
                    {copiedKey === 'embed_html' ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {copiedKey === 'embed_html' ? '已複製完整 HTML！' : '一鍵複製修正版 HTML'}
                    </span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  已自動綁定正式公開網址（<code className="text-emerald-400">{OFFICIAL_SHARED_APP_URL}</code>），並補齊攝影機掃碼權限（<code className="text-sky-300">allow=&quot;camera *&quot;</code>）與推薦人／入會網址參數轉傳。
                </p>
                <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300 overflow-x-auto max-h-44 leading-relaxed">
                  {CORRECTED_EMBED_HTML}
                </pre>
              </div>

              {isHqStaff && onNavigateHqGas && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateHqGas();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer transition-colors"
                  >
                    <Rocket className="w-3.5 h-3.5" />
                    <span>前往總部 GAS / MySQL 完整代碼與部署中心</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
