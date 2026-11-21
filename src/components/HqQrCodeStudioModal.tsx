/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Download,
  Copy,
  Check,
  X,
  Smartphone,
  ShieldAlert,
  Globe,
  FileImage,
  FileCode2,
  Camera,
} from 'lucide-react';
import {
  detectLineInAppBrowser,
  getSavedExternalBaseUrl,
  normalizeBaseUrlForQuery,
  OFFICIAL_GAS_EXEC_URL,
  OFFICIAL_SHARED_APP_URL,
  saveExternalBaseUrl,
  validateExternalBaseUrl,
} from '../services/rolePortalUrlService';
import type { UserRole } from '../types/erp';

export type QrTargetPreset =
  | 'PUBLIC_MOBILE_CENTER'
  | 'PUBLIC_DESKTOP_CENTER'
  | 'MEMBER_MOBILE'
  | 'STORE_MOBILE'
  | 'CENTER_MOBILE'
  | 'HQ_MOBILE';

interface HqQrCodeStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPreset?: QrTargetPreset;
  initialCustomId?: string;
  initialBaseUrl?: string;
}

const DEFAULT_OFFICIAL_SHARED_BASE = OFFICIAL_GAS_EXEC_URL;

const PRESET_META: Array<{
  key: QrTargetPreset;
  label: string;
  role?: UserRole;
  cardTitle: string;
  cardSubtitle: string;
  badgeText: string;
  accentHex: string;
  isConfidentialHq?: boolean;
}> = [
  {
    key: 'PUBLIC_MOBILE_CENTER',
    label: '對外登入中心（手機專用）',
    cardTitle: '企業智能雲端服務中心',
    cardSubtitle: '請使用手機相機掃碼登入 · 會員 / 營業店 / 教育中心',
    badgeText: '對外公開印刷推薦',
    accentHex: '#0284C7',
  },
  {
    key: 'PUBLIC_DESKTOP_CENTER',
    label: '對外登入中心（通用版）',
    cardTitle: '專屬雲端服務登入中心',
    cardSubtitle: '電腦與手機皆適用 · 角色權限嚴格隔離',
    badgeText: '對外官方首頁',
    accentHex: '#4F46E5',
  },
  {
    key: 'MEMBER_MOBILE',
    label: '一般會員專屬（手機版）',
    role: 'MEMBER',
    cardTitle: '一般會員專屬工作台',
    cardSubtitle: '掃碼立即開啟個人雲端服務、CRM 與預約排程',
    badgeText: '會員招募 / 推廣立牌',
    accentHex: '#0EA5E9',
  },
  {
    key: 'STORE_MOBILE',
    label: '一般營業店專屬（手機版）',
    role: 'STORE',
    cardTitle: '營業店管理服務入口',
    cardSubtitle: '門市店長掃碼登入 · 輔導組織與門市補貼明細',
    badgeText: '門市現場專用',
    accentHex: '#10B981',
  },
  {
    key: 'CENTER_MOBILE',
    label: '一般教育中心專屬（手機版）',
    role: 'CENTER',
    cardTitle: '教育中心管理服務入口',
    cardSubtitle: '中心培訓總監掃碼登入 · 學員輔導與中心活動',
    badgeText: '教育中心現場專用',
    accentHex: '#06B6D4',
  },
  {
    key: 'HQ_MOBILE',
    label: '總部人員專用（機密勿外流）',
    role: 'HQ_STAFF',
    cardTitle: '營運總部安全驗證閘道',
    cardSubtitle: '僅限總部授權營運團隊內部使用 · 嚴禁對外張貼',
    badgeText: '機密內部專用',
    accentHex: '#E11D48',
    isConfidentialHq: true,
  },
];

export function roleToQrPreset(role: UserRole): QrTargetPreset {
  switch (role) {
    case 'HQ_STAFF':
      return 'HQ_MOBILE';
    case 'MEMBER':
      return 'MEMBER_MOBILE';
    case 'STORE':
      return 'STORE_MOBILE';
    case 'CENTER':
      return 'CENTER_MOBILE';
  }
}

export const HqQrCodeStudioModal: React.FC<HqQrCodeStudioModalProps> = ({
  isOpen,
  onClose,
  initialPreset = 'PUBLIC_MOBILE_CENTER',
  initialCustomId = '',
  initialBaseUrl,
}) => {
  const [preset, setPreset] = useState<QrTargetPreset>(initialPreset);
  const [baseUrlInput, setBaseUrlInput] = useState<string>(
    () => initialBaseUrl || getSavedExternalBaseUrl()
  );
  const [baseUrlFeedback, setBaseUrlFeedback] = useState<string | null>(null);
  const [customId, setCustomId] = useState<string>(initialCustomId);
  const [cardTitle, setCardTitle] = useState<string>('企業智能雲端服務中心');
  const [cardSubtitle, setCardSubtitle] = useState<string>(
    '請使用手機相機掃碼登入 · 會員 / 營業店 / 教育中心'
  );
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrSvg, setQrSvg] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [lineExternalBrowser, setLineExternalBrowser] = useState<boolean>(true);
  const [showLineCameraBadge, setShowLineCameraBadge] = useState<boolean>(true);
  const [longPressPosterUrl, setLongPressPosterUrl] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setPreset(initialPreset);
      setCustomId(initialCustomId);
      if (initialBaseUrl) {
        setBaseUrlInput(initialBaseUrl);
      }
      const found = PRESET_META.find((m) => m.key === initialPreset) || PRESET_META[0];
      setCardTitle(found.cardTitle);
      setCardSubtitle(found.cardSubtitle);
    }
  }, [isOpen, initialPreset, initialCustomId, initialBaseUrl]);

  const activeMeta = PRESET_META.find((m) => m.key === preset) || PRESET_META[0];

  const handleSelectPreset = (nextKey: QrTargetPreset) => {
    setPreset(nextKey);
    const found = PRESET_META.find((m) => m.key === nextKey);
    if (found) {
      setCardTitle(found.cardTitle);
      setCardSubtitle(found.cardSubtitle);
    }
  };

  const buildTargetUrl = (): string => {
    const cleanBase = normalizeBaseUrlForQuery(
      baseUrlInput.trim() || DEFAULT_OFFICIAL_SHARED_BASE
    );
    const params = new URLSearchParams();
    if (preset === 'PUBLIC_MOBILE_CENTER') {
      params.set('device', 'mobile');
    } else if (preset === 'MEMBER_MOBILE') {
      params.set('portal', 'member');
      if (customId.trim()) params.set('id', customId.trim());
      params.set('device', 'mobile');
    } else if (preset === 'STORE_MOBILE') {
      params.set('portal', 'store');
      if (customId.trim()) params.set('id', customId.trim());
      params.set('device', 'mobile');
    } else if (preset === 'CENTER_MOBILE') {
      params.set('portal', 'center');
      if (customId.trim()) params.set('id', customId.trim());
      params.set('device', 'mobile');
    } else if (preset === 'HQ_MOBILE') {
      params.set('portal', 'hq');
      if (customId.trim()) params.set('id', customId.trim());
      params.set('device', 'mobile');
    }
    if (lineExternalBrowser) {
      params.set('openExternalBrowser', '1');
    }
    const qs = params.toString();
    return qs ? `${cleanBase}?${qs}` : cleanBase;
  };

  const targetUrl = buildTargetUrl();

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    Promise.all([
      QRCode.toDataURL(targetUrl, {
        width: 560,
        margin: 3,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#0F172A',
          light: '#FFFFFF',
        },
      }),
      QRCode.toString(targetUrl, {
        type: 'svg',
        margin: 3,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#0F172A',
          light: '#FFFFFF',
        },
      }),
    ])
      .then(([pngUrl, svgStr]) => {
        if (!cancelled) {
          setQrDataUrl(pngUrl);
          setQrSvg(svgStr);
        }
      })
      .catch(() => {
        // ignore QR generation failure
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, targetUrl]);

  if (!isOpen) return null;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // ignore clipboard restriction
    }
  };

  const handleDownloadRawQrPng = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_${preset.toLowerCase()}.png`;
    a.click();
  };

  const handleDownloadSvg = () => {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR_${preset.toLowerCase()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadStandeePosterPng = async () => {
    if (!qrDataUrl) return;
    const canvas = document.createElement('canvas');
    canvas.width = 840;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dark slate background card
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Top accent bar
    ctx.fillStyle = activeMeta.accentHex;
    ctx.fillRect(0, 0, canvas.width, 18);

    // Badge
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.roundRect(240, 62, 360, 44, 22);
    ctx.fill();

    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 20px "Noto Sans TC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(activeMeta.badgeText, canvas.width / 2, 92);

    // Title
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 42px "Noto Sans TC", sans-serif';
    ctx.fillText(cardTitle.trim() || activeMeta.cardTitle, canvas.width / 2, 168);

    // Subtitle
    ctx.fillStyle = '#94A3B8';
    ctx.font = '22px "Noto Sans TC", sans-serif';
    ctx.fillText((cardSubtitle.trim() || activeMeta.cardSubtitle).slice(0, 34), canvas.width / 2, 212);

    // White QR container
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(140, 260, 560, 560, 28);
    ctx.fill();

    const img = new Image();
    img.src = qrDataUrl;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
    ctx.drawImage(img, 168, 288, 504, 504);

    // Footer instruction
    if (showLineCameraBadge) {
      ctx.fillStyle = '#064E3B';
      ctx.beginPath();
      ctx.roundRect(175, 848, 490, 44, 22);
      ctx.fill();

      ctx.fillStyle = '#4ADE80';
      ctx.font = 'bold 21px "Noto Sans TC", sans-serif';
      ctx.fillText('支援 LINE 掃一掃 / 手機相機直接拍攝進入', canvas.width / 2, 878);
    } else {
      ctx.fillStyle = '#E2E8F0';
      ctx.font = 'bold 26px "Noto Sans TC", sans-serif';
      ctx.fillText('手機相機掃描 QR Code 立即開啟', canvas.width / 2, 886);
    }

    ctx.fillStyle = '#64748B';
    ctx.font = '18px monospace';
    const shortUrl = targetUrl.length > 62 ? targetUrl.slice(0, 59) + '...' : targetUrl;
    ctx.fillText(shortUrl, canvas.width / 2, 938);

    ctx.fillStyle = '#475569';
    ctx.font = '18px "Noto Sans TC", sans-serif';
    ctx.fillText(
      lineExternalBrowser
        ? 'LINE 掃碼自動啟動 Safari / Chrome · 角色權限嚴格隔離'
        : '安全加密驗證 · 依授權身分嚴格資料隔離',
      canvas.width / 2,
      1005
    );

    const posterDataUrl = canvas.toDataURL('image/png');
    if (detectLineInAppBrowser()) {
      setLongPressPosterUrl(posterDataUrl);
      return;
    }

    const a = document.createElement('a');
    a.href = posterDataUrl;
    a.download = `Poster_QR_${preset.toLowerCase()}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                網站對外正式 QR Code 立牌與海報設計中心
              </h3>
              <p className="text-xs text-slate-400">
                一鍵產生高清晰手機專用掃碼圖卡（PNG 立牌 / 純 QR 圖檔 / SVG 印刷向量檔）
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉視窗"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Controls */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                1. 選擇要製作 QR Code 的對外入口類型
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESET_META.map((item) => {
                  const active = preset === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleSelectPreset(item.key)}
                      className={`text-left px-3 py-2.5 rounded-lg border text-xs transition-all cursor-pointer ${
                        active
                          ? item.isConfidentialHq
                            ? 'bg-rose-950/60 border-rose-500 text-rose-200'
                            : 'bg-sky-950/60 border-sky-500 text-sky-100'
                          : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-semibold flex items-center justify-between gap-1">
                        <span>{item.label}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{item.badgeText}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeMeta.isConfidentialHq && (
              <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-700/70 text-xs text-rose-200 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>
                  警告：總部入口包含商業機密核心與資料庫工具，僅供總部人員私下手機登入使用，切勿印製於對外海報或公開網頁！
                </span>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-sky-400" />
                  <span>2. 正式對外網域（Base URL）</span>
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBaseUrlInput(OFFICIAL_GAS_EXEC_URL)}
                    className="text-[11px] px-2 py-0.5 rounded bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/70 cursor-pointer"
                  >
                    套用 GAS /exec 網址
                  </button>
                  {typeof window !== 'undefined' && (
                    <button
                      type="button"
                      onClick={() => setBaseUrlInput(window.location.origin)}
                      className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                    >
                      套用目前網址
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setBaseUrlInput(OFFICIAL_SHARED_APP_URL)}
                    className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 cursor-pointer"
                  >
                    套用正式分享網址
                  </button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={baseUrlInput}
                  onChange={(e) => {
                    setBaseUrlInput(e.target.value);
                    setBaseUrlFeedback(null);
                  }}
                  placeholder="https://script.google.com/macros/s/您的腳本ID/exec 或 https://your-domain.com"
                  className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const saved = saveExternalBaseUrl(baseUrlInput);
                    if (saved.valid) {
                      setBaseUrlInput(saved.savedUrl);
                      setBaseUrlFeedback('已儲存為預設對外網址');
                    } else {
                      setBaseUrlFeedback(saved.error || '網址格式不正確');
                    }
                  }}
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shrink-0 cursor-pointer"
                >
                  設為預設網址
                </button>
              </div>
              {baseUrlFeedback ? (
                <div
                  className={`text-[11px] ${
                    validateExternalBaseUrl(baseUrlInput).valid ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {baseUrlFeedback}
                </div>
              ) : (
                !validateExternalBaseUrl(baseUrlInput).valid && (
                  <div className="text-[11px] text-amber-300">
                    {validateExternalBaseUrl(baseUrlInput).error}
                  </div>
                )
              )}
            </div>

            {preset !== 'PUBLIC_MOBILE_CENTER' && preset !== 'PUBLIC_DESKTOP_CENTER' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  3. 指定預填代號（選填，例如會員 MID / 門市代號 / 中心代號）
                </label>
                <input
                  type="text"
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value)}
                  placeholder="留空則由掃碼者自行輸入帳號"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  立牌主標題
                </label>
                <input
                  type="text"
                  value={cardTitle}
                  onChange={(e) => setCardTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  立牌副標題說明
                </label>
                <input
                  type="text"
                  value={cardSubtitle}
                  onChange={(e) => setCardSubtitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* LINE Camera Scan Mode Controls */}
            <div className="bg-emerald-950/25 border border-emerald-700/40 rounded-lg p-3.5 space-y-2.5">
              <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-[#06C755]" />
                <span>LINE 攝影（LINE 掃一掃）拍攝進入設定</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setLineExternalBrowser(true)}
                  className={`text-left px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                    lineExternalBrowser
                      ? 'bg-[#06C755]/15 border-[#06C755] text-emerald-100'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold">自動跳預設瀏覽器（推薦）</div>
                  <div className="text-[11px] opacity-80 mt-0.5">
                    附加 openExternalBrowser=1，LINE 拍攝後直開 Safari / Chrome
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setLineExternalBrowser(false)}
                  className={`text-left px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                    !lineExternalBrowser
                      ? 'bg-sky-950/60 border-sky-500 text-sky-100'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold">留在 LINE 內建視窗開啟</div>
                  <div className="text-[11px] opacity-80 mt-0.5">
                    不切換 App，直接於 LINE 視窗顯示行動版頁面
                  </div>
                </button>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none pt-0.5">
                <input
                  type="checkbox"
                  checked={showLineCameraBadge}
                  onChange={(e) => setShowLineCameraBadge(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-[#06C755] focus:ring-[#06C755]"
                />
                <span>立牌海報底部印製「支援 LINE 掃一掃 / 手機相機拍攝進入」識別條</span>
              </label>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                  <span>QR Code 對應完整網址</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200 cursor-pointer font-semibold"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? '已複製網址' : '複製網址'}</span>
                </button>
              </div>
              <div className="text-[11px] font-mono text-slate-200 break-all">{targetUrl}</div>
            </div>
          </div>

          {/* Right: Live Standee Card Preview + Downloads */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center space-y-4 relative overflow-hidden">
              <div
                className="absolute top-0 inset-x-0 h-1.5"
                style={{ backgroundColor: activeMeta.accentHex }}
              />
              <div className="inline-block px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-[11px] font-semibold text-slate-300">
                {activeMeta.badgeText}
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">{cardTitle}</h4>
                <p className="text-xs text-slate-400 mt-1">{cardSubtitle}</p>
              </div>

              <div className="bg-white p-3.5 rounded-2xl inline-block shadow-lg mx-auto">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="網站對外正式 QR Code"
                    className="w-52 h-52 object-contain"
                  />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center text-xs text-slate-500">
                    產生中...
                  </div>
                )}
              </div>

              {showLineCameraBadge ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#06C755]/15 border border-[#06C755]/40 text-[11px] font-bold text-[#4ADE80]">
                  <Camera className="w-3.5 h-3.5" />
                  <span>支援 LINE 掃一掃 / 手機相機直接拍攝進入</span>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400">
                  手機相機掃碼即可開啟 · 含高容錯 (Level H) 保護
                </div>
              )}
            </div>

            {longPressPosterUrl && (
              <div className="p-3 bg-slate-950 border border-[#06C755]/50 rounded-xl space-y-2 text-center">
                <div className="flex items-center justify-between text-xs text-emerald-300 font-semibold">
                  <span>請長按下方海報圖檔儲存至手機相簿</span>
                  <button
                    type="button"
                    onClick={() => setLongPressPosterUrl('')}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    收合
                  </button>
                </div>
                <img
                  src={longPressPosterUrl}
                  alt="長按儲存立牌海報圖檔"
                  className="w-48 mx-auto rounded-lg border border-slate-800"
                />
              </div>
            )}

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleDownloadStandeePosterPng}
                className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>下載「LINE 掃碼立牌 / 海報圖卡 PNG」</span>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadRawQrPng}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FileImage className="w-3.5 h-3.5 text-emerald-400" />
                  <span>純 QR 圖檔 PNG</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>向量印刷 SVG</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
