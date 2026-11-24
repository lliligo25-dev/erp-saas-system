/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import {
  X,
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
  LogOut,
  ChevronRight,
  Network,
} from 'lucide-react';
import type { AuthSession } from '../types/erp';
import type { NavItem } from './Header';
import type { ViewportMode } from './ViewportToolbar';
import {
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  FontFamilyKey,
  FontPreferences,
} from '../services/fontPreferences';

interface SubNavItem {
  id: string;
  label: string;
}

interface MobileSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  session: AuthSession | null;
  lockedPortalRole?: AuthSession['role'] | null;
  navItems?: NavItem[];
  subNavItems?: SubNavItem[];
  currentTab?: string;
  onSelectTab?: (tabId: string) => void;
  onLogout?: () => void;
  viewportMode: ViewportMode;
  isNativeFullscreen: boolean;
  onSelectViewportMode: (mode: ViewportMode) => void;
  fontPrefs: FontPreferences;
  onChangeFontPrefs: (next: FontPreferences) => void;
  onOpenShareModal?: () => void;
  onOpenDeployModal?: () => void;
}

const ROLE_TITLES: Record<AuthSession['role'], string> = {
  HQ_STAFF: '總部工作人員系統',
  MEMBER: '一般會員系統',
  STORE: '營業店系統',
  CENTER: '教育中心系統',
};

const VIEWPORT_OPTIONS: Array<{
  id: ViewportMode;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'desktop', label: '桌機板', Icon: Monitor },
  { id: 'tablet', label: '平板', Icon: Tablet },
  { id: 'laptop', label: '手提版', Icon: Laptop },
  { id: 'mobile', label: '手機板', Icon: Smartphone },
  { id: 'fullscreen', label: '全螢幕', Icon: Maximize2 },
];

export const MobileSettingsDrawer: React.FC<MobileSettingsDrawerProps> = ({
  isOpen,
  onClose,
  session,
  lockedPortalRole = null,
  navItems = [],
  subNavItems = [],
  currentTab,
  onSelectTab,
  onLogout,
  viewportMode,
  isNativeFullscreen,
  onSelectViewportMode,
  fontPrefs,
  onChangeFontPrefs,
  onOpenShareModal,
  onOpenDeployModal,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const handleNavClick = (tabId: string) => {
    onSelectTab?.(tabId);
    onClose();
  };

  const handleViewportClick = (nextMode: ViewportMode) => {
    onSelectViewportMode(nextMode);
    if (nextMode !== 'mobile') {
      onClose();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      aria-hidden={!isOpen}
    >
      {/* Backdrop Scrim */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs"
      />

      {/* Left Slide-Out Drawer Panel */}
      <aside
        role="dialog"
        aria-modal={isOpen}
        aria-label="手機功能與設定抽屜選單"
        className={`absolute inset-y-0 left-0 w-[296px] max-w-[86%] bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col transform transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="px-4 h-14 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
              <Network className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-100 truncate">
                {session?.role === 'HQ_STAFF' ? '產銷合一 SaaS ERP' : '企業智能雲端平台'}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {session ? ROLE_TITLES[session.role] : '功能與顯示設定'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="關閉側邊抽屜"
            className="min-w-[40px] min-h-[40px] rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Section 1: Identity & Primary Navigation (when logged in) */}
          {session && (
            <div className="space-y-3">
              <div className="px-3 py-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-100 truncate">
                    {session.displayName}
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-400">
                    {session.userId}
                  </div>
                </div>
                {lockedPortalRole && (
                  <span className="text-[11px] text-indigo-300 font-medium shrink-0">專屬入口</span>
                )}
              </div>

              {navItems.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-400 px-1 pb-1">
                    主功能導覽
                  </div>
                  {navItems.map((item) => {
                    const isActive =
                      currentTab === item.id ||
                      (item.matchTabs ? item.matchTabs.includes(currentTab || '') : false);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavClick(item.id)}
                        className={`w-full min-h-[44px] px-3 py-2 rounded-lg text-left text-sm font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-indigo-600 text-white font-semibold'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-indigo-200' : 'text-slate-500'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {subNavItems.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] font-semibold text-slate-400 px-1 pb-1">
                    目前分區細項
                  </div>
                  {subNavItems.map((st) => {
                    const isActive = currentTab === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleNavClick(st.id)}
                        className={`w-full min-h-[40px] px-3 py-1.5 rounded-lg text-left text-xs font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-slate-800 text-indigo-300 font-semibold border border-indigo-500/40'
                            : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                        }`}
                      >
                        <span className="truncate">{st.label}</span>
                        <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Section 2: Display Device / Viewport Switcher */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
            <div className="text-[11px] font-semibold text-slate-400 px-1">
              版面與顯示裝置切換
            </div>
            <div className="grid grid-cols-2 gap-2">
              {VIEWPORT_OPTIONS.map((opt) => {
                const isActive = viewportMode === opt.id;
                const IconComp =
                  opt.id === 'fullscreen' && (isActive || isNativeFullscreen)
                    ? Minimize2
                    : opt.Icon;
                const buttonLabel =
                  opt.id === 'fullscreen' && isActive ? '退出全螢幕' : opt.label;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleViewportClick(opt.id)}
                    aria-pressed={isActive}
                    className={`min-h-[42px] px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      isActive
                        ? opt.id === 'fullscreen'
                          ? 'bg-emerald-600 text-white font-semibold'
                          : 'bg-indigo-600 text-white font-semibold'
                        : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    <IconComp className="w-3.5 h-3.5 shrink-0" />
                    <span className="whitespace-nowrap">{buttonLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Font Family & Font Size */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="text-[11px] font-semibold text-slate-400 px-1">
              字體與字級設定
            </div>

            <label className="block space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs text-slate-300">
                <Type className="w-3.5 h-3.5 text-indigo-400" />
                <span>系統字體</span>
              </span>
              <select
                aria-label="選擇系統字體"
                value={fontPrefs.family}
                onChange={(e) =>
                  onChangeFontPrefs({
                    ...fontPrefs,
                    family: e.target.value as FontFamilyKey,
                  })
                }
                className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-medium text-slate-100 focus:border-indigo-500 focus:outline-none cursor-pointer"
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

            <label className="block space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs text-slate-300">
                <ALargeSmall className="w-3.5 h-3.5 text-emerald-400" />
                <span>字體大小</span>
              </span>
              <select
                aria-label="選擇字體大小"
                value={String(fontPrefs.sizePx)}
                onChange={(e) =>
                  onChangeFontPrefs({
                    ...fontPrefs,
                    sizePx: Number(e.target.value) || 16,
                  })
                }
                className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-medium text-slate-100 focus:border-indigo-500 focus:outline-none cursor-pointer"
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

          {/* Section 4: Share & Deploy Quick Actions */}
          {(onOpenShareModal || onOpenDeployModal) && (
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <div className="text-[11px] font-semibold text-slate-400 px-1">
                對外分享與部署工具
              </div>
              {onOpenShareModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenShareModal();
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2.5 bg-sky-600/15 hover:bg-sky-600/25 text-sky-300 border border-sky-500/40 transition-colors cursor-pointer"
                >
                  <Share2 className="w-4 h-4 shrink-0" />
                  <span>分享連結與 QR Code</span>
                </button>
              )}
              {onOpenDeployModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenDeployModal();
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2.5 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border border-emerald-500/40 transition-colors cursor-pointer"
                >
                  <Rocket className="w-4 h-4 shrink-0" />
                  <span>部署發布與試算表同步</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer: Logout (when logged in) */}
        {session && onLogout && (
          <div className="p-4 border-t border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-slate-400" />
              <span>{lockedPortalRole ? '切換帳號 / 登出' : '切換身分 / 登出'}</span>
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};
