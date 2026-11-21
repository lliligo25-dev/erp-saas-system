/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Smartphone,
  ExternalLink,
  Share,
  PlusSquare,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Download,
  Compass,
} from 'lucide-react';
import { LineInAppBrowserHandler } from '../services/LineInAppBrowserHandler';

type ShortcutPlatformTab = 'ios' | 'android';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function detectInitialPlatform(): ShortcutPlatformTab {
  if (typeof navigator === 'undefined') return 'android';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  return 'android';
}

export const DesktopShortcutGuideCard: React.FC = () => {
  const [isLineIab] = useState<boolean>(() => LineInAppBrowserHandler.isInLineBrowser());
  const [isExpanded, setIsExpanded] = useState<boolean>(() =>
    LineInAppBrowserHandler.isInLineBrowser()
  );
  const [activePlatform, setActivePlatform] = useState<ShortcutPlatformTab>(() =>
    detectInitialPlatform()
  );
  const [copiedCurrentUrl, setCopiedCurrentUrl] = useState<boolean>(false);
  const [installPromptEvent, setInstallPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstallPrompt = (ev: Event) => {
      ev.preventDefault();
      setInstallPromptEvent(ev as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  const externalBrowserHref = LineInAppBrowserHandler.buildExternalBrowserHandoffUrl();
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '/';

  const handleCopyCurrentUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopiedCurrentUrl(true);
      setTimeout(() => setCopiedCurrentUrl(false), 2000);
    } catch {
      // ignore clipboard fallback
    }
  };

  const handleNativeInstall = async () => {
    if (!installPromptEvent) return;
    try {
      await installPromptEvent.prompt();
      await installPromptEvent.userChoice;
      setInstallPromptEvent(null);
    } catch {
      // ignore prompt cancellation
    }
  };

  return (
    <div
      role="region"
      aria-label="安裝為手機桌面捷徑教學引導"
      className={`rounded-xl border transition-colors ${
        isLineIab
          ? 'bg-emerald-950/35 border-[#06C755]/60'
          : 'bg-slate-900/90 border-slate-800'
      }`}
    >
      {/* Card Header / Toggle Bar */}
      <div className="px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              isLineIab
                ? 'bg-[#06C755]/20 border-[#06C755]/50 text-[#4ADE80]'
                : 'bg-sky-500/15 border-sky-500/35 text-sky-400'
            }`}
          >
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100">
                安裝為手機桌面捷徑（像 App 一樣一點即開）
              </h3>
              {isLineIab && (
                <span className="px-2 py-0.5 rounded bg-[#06C755] text-slate-950 font-extrabold text-[10px] tracking-wide">
                  LINE 瀏覽器專用引導
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isLineIab
                ? '偵測到您正使用 LINE 開啟，請先切換至 Safari / Chrome 再加到手機桌面主畫面。'
                : '支援從 LINE 掃碼轉跳 Google Chrome / Safari 後存到手機桌面，長輩免背網址快速開啟。'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 ml-auto">
          {installPromptEvent && (
            <button
              type="button"
              onClick={handleNativeInstall}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>一鍵加入桌面</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer transition-colors"
          >
            <span>{isExpanded ? '收合操作教學' : '查看存到桌面步驟'}</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable Step-by-Step Guide Body */}
      {isExpanded && (
        <div className="px-4 sm:px-6 pb-5 pt-1 space-y-4 border-t border-slate-800/80">
          {/* Step 0: LINE In-App Browser Handoff Callout */}
          <div className="mt-3 p-3.5 rounded-xl bg-slate-950/90 border border-[#06C755]/45 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-bold text-[#4ADE80] flex items-center gap-1.5">
                <Compass className="w-4 h-4 shrink-0" />
                <span>第 1 步（若目前在 LINE 視窗內）：請先切換至手機預設瀏覽器</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                LINE 內建視窗沒有「加入主畫面」功能。請點擊右側綠色按鈕，或按 LINE 畫面右下角 / 右上角
                <span className="font-mono text-emerald-300 mx-1">⋮ / 分享</span>
                選擇「以預設瀏覽器開啟（Safari / Chrome）」。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href={externalBrowserHref}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#06C755] hover:bg-[#05b34c] text-xs font-extrabold text-slate-950 transition-colors"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>用 Safari / Chrome 開啟</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={handleCopyCurrentUrl}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer transition-colors"
              >
                {copiedCurrentUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">已複製網址</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>複製目前網址</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Platform Tab Switcher (iPhone vs Android) */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-300">
              第 2 步：依您的手機選擇「加入主畫面」操作路徑
            </span>
            <div className="inline-flex p-1 rounded-lg bg-slate-950 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setActivePlatform('ios')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  activePlatform === 'ios'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                iPhone（Safari）
              </button>
              <button
                type="button"
                onClick={() => setActivePlatform('android')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  activePlatform === 'android'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Android（Google Chrome）
              </button>
            </div>
          </div>

          {/* Visual 3-Step Path Grid */}
          {activePlatform === 'ios' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-950/75 border border-slate-800 space-y-1.5">
                <div className="font-bold text-sky-300 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/40 inline-flex items-center justify-center text-[11px]">
                    1
                  </span>
                  <span>點下方「分享」圖示</span>
                </div>
                <p className="text-slate-300 leading-relaxed flex items-start gap-1.5">
                  <Share className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>切換到 Safari 後，點畫面最下方正中間的「方框＋向上箭頭」分享按鈕。</span>
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/75 border border-slate-800 space-y-1.5">
                <div className="font-bold text-sky-300 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/40 inline-flex items-center justify-center text-[11px]">
                    2
                  </span>
                  <span>選擇「加入主畫面」</span>
                </div>
                <p className="text-slate-300 leading-relaxed flex items-start gap-1.5">
                  <PlusSquare className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>在彈出的選單中往下滑，找到帶有「＋」方框的「加入主畫面」。</span>
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/75 border border-slate-800 space-y-1.5">
                <div className="font-bold text-sky-300 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/40 inline-flex items-center justify-center text-[11px]">
                    3
                  </span>
                  <span>按右上角「新增」完成</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  名稱自動顯示「企業雲端服務」，按右上角新增後，以後直接點桌面圖示就能全螢幕打開。
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-950/75 border border-slate-800 space-y-1.5">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 inline-flex items-center justify-center text-[11px]">
                    1
                  </span>
                  <span>點 Chrome 右上角「⋮」</span>
                </div>
                <p className="text-slate-300 leading-relaxed flex items-start gap-1.5">
                  <MoreVertical className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>在 Google Chrome 瀏覽器開啟後，點擊畫面右上角三個點的選單按鈕。</span>
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/75 border border-slate-800 space-y-1.5">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 inline-flex items-center justify-center text-[11px]">
                    2
                  </span>
                  <span>點選「加到主畫面」</span>
                </div>
                <p className="text-slate-300 leading-relaxed flex items-start gap-1.5">
                  <PlusSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>於選單中找到「加到主畫面」（或「安裝應用程式」），點選建立桌面捷徑。</span>
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/75 border border-slate-800 space-y-1.5">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 inline-flex items-center justify-center text-[11px]">
                    3
                  </span>
                  <span>點「新增」放到桌面</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  確認後桌面立即產生專屬捷徑圖示，以後不用再開 LINE 找連結，點桌面圖示直接登入。
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
