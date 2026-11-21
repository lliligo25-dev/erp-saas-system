/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Monitor,
  Tablet,
  Laptop,
  Smartphone,
  Maximize2,
  Minimize2,
  Type,
  ALargeSmall,
  Share2,
  Rocket,
} from 'lucide-react';
import {
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  FontFamilyKey,
  FontPreferences,
} from '../services/fontPreferences';

export type ViewportMode = 'desktop' | 'tablet' | 'laptop' | 'mobile' | 'fullscreen';

interface ViewportToolbarProps {
  mode: ViewportMode;
  isNativeFullscreen: boolean;
  onSelectMode: (mode: ViewportMode) => void;
  fontPrefs: FontPreferences;
  onChangeFontPrefs: (next: FontPreferences) => void;
  onOpenShareModal?: () => void;
  onOpenDeployModal?: () => void;
}

const VIEWPORT_OPTIONS: Array<{
  id: ViewportMode;
  label: string;
  sizeHint: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'desktop', label: '桌機板', sizeHint: '1280px+', Icon: Monitor },
  { id: 'tablet', label: '平板', sizeHint: '768px', Icon: Tablet },
  { id: 'laptop', label: '手提版', sizeHint: '1024px', Icon: Laptop },
  { id: 'mobile', label: '手機板', sizeHint: '390px', Icon: Smartphone },
  { id: 'fullscreen', label: '全螢幕', sizeHint: '100%', Icon: Maximize2 },
];

export const ViewportToolbar: React.FC<ViewportToolbarProps> = ({
  mode,
  isNativeFullscreen,
  onSelectMode,
  fontPrefs,
  onChangeFontPrefs,
  onOpenShareModal,
  onOpenDeployModal,
}) => {
  const activeMeta = VIEWPORT_OPTIONS.find((o) => o.id === mode) || VIEWPORT_OPTIONS[0];

  return (
    <div
      role="region"
      aria-label="顯示裝置、全螢幕、字體與分享部署切換列"
      className="bg-slate-950 border-b border-slate-800/90 px-3 sm:px-6 py-1.5 z-50"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        {/* Left: Active mode badge + Font Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <div className="hidden lg:flex items-center gap-2 mr-1">
            <span className="font-medium text-slate-300">版面預覽</span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="font-mono text-indigo-300">
              {activeMeta.label} ({activeMeta.sizeHint})
            </span>
          </div>

          {/* Font Family Dropdown */}
          <label className="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-md px-2 py-1 text-xs text-slate-200">
            <Type className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="text-[11px] text-slate-400 hidden sm:inline">字體</span>
            <select
              aria-label="選擇系統字體"
              value={fontPrefs.family}
              onChange={(e) =>
                onChangeFontPrefs({
                  ...fontPrefs,
                  family: e.target.value as FontFamilyKey,
                })
              }
              className="bg-transparent text-xs font-medium text-slate-100 focus:outline-none cursor-pointer pr-1"
            >
              {FONT_FAMILY_OPTIONS.map((opt) => (
                <option
                  key={opt.key}
                  value={opt.key}
                  style={{ fontFamily: opt.cssFamily }}
                  className="bg-slate-900 text-slate-100"
                >
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {/* Font Size Dropdown */}
          <label className="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-md px-2 py-1 text-xs text-slate-200">
            <ALargeSmall className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[11px] text-slate-400 hidden sm:inline">字級</span>
            <select
              aria-label="選擇字體大小"
              value={String(fontPrefs.sizePx)}
              onChange={(e) =>
                onChangeFontPrefs({
                  ...fontPrefs,
                  sizePx: Number(e.target.value) || 16,
                })
              }
              className="bg-transparent text-xs font-medium text-slate-100 focus:outline-none cursor-pointer pr-1"
            >
              {FONT_SIZE_OPTIONS.map((opt) => (
                <option
                  key={opt.px}
                  value={String(opt.px)}
                  className="bg-slate-900 text-slate-100"
                >
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Right: Viewport Device Buttons + Share & Deploy Quick Actions */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          {VIEWPORT_OPTIONS.map((opt) => {
            const isActive = mode === opt.id;
            const IconComp =
              opt.id === 'fullscreen' && (isActive || isNativeFullscreen) ? Minimize2 : opt.Icon;
            const buttonLabel =
              opt.id === 'fullscreen' && isActive ? '退出全螢幕' : opt.label;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelectMode(opt.id)}
                aria-pressed={isActive}
                title={`切換為${opt.label}（${opt.sizeHint}）`}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? opt.id === 'fullscreen'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                <IconComp className="w-3.5 h-3.5 shrink-0" />
                <span>{buttonLabel}</span>
              </button>
            );
          })}

          {(onOpenShareModal || onOpenDeployModal) && (
            <span className="h-4 w-px bg-slate-800 mx-0.5 shrink-0" aria-hidden="true" />
          )}

          {onOpenShareModal && (
            <button
              type="button"
              onClick={onOpenShareModal}
              title="分享對外公開連結與 QR Code（任何人皆可檢視）"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer bg-sky-600/20 hover:bg-sky-600/35 text-sky-300 border border-sky-500/50"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0" />
              <span>分享連結</span>
            </button>
          )}

          {onOpenDeployModal && (
            <button
              type="button"
              onClick={onOpenDeployModal}
              title="發布部署與 .run.app / GAS 協作平台 HTML 檢測"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/50"
            >
              <Rocket className="w-3.5 h-3.5 shrink-0" />
              <span>部署發布</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
