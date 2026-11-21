/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthSession } from '../types/erp';
import { Network, LogOut } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  matchTabs?: string[];
}

interface HeaderProps {
  session: AuthSession;
  navItems: NavItem[];
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onLogout: () => void;
  fullWidth?: boolean;
  lockedPortalRole?: AuthSession['role'] | null;
}

const ROLE_TITLES: Record<AuthSession['role'], string> = {
  HQ_STAFF: '總部工作人員系統',
  MEMBER: '一般會員系統',
  STORE: '營業店系統',
  CENTER: '教育中心系統',
};

export const Header: React.FC<HeaderProps> = ({
  session,
  navItems,
  currentTab,
  onSelectTab,
  onLogout,
  fullWidth = false,
  lockedPortalRole = null,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
      <div className={`${fullWidth ? 'max-w-none' : 'max-w-7xl'} mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4`}>
        {/* Zone 1: Brand wordmark + Role Portal Scope */}
        <div className="flex items-center gap-3 shrink-0 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
            <Network className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 text-sm whitespace-nowrap">
            <span className="font-bold text-slate-100 tracking-tight">
              {session.role === 'HQ_STAFF' ? '產銷合一 SaaS ERP' : '企業智能雲端平台'}
            </span>
            <span className="text-slate-600 hidden sm:inline" aria-hidden="true">·</span>
            <span className="text-xs font-medium text-indigo-300 hidden sm:inline">
              {ROLE_TITLES[session.role]}
            </span>
            {lockedPortalRole && (
              <span className="hidden lg:inline-block text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                專屬入口
              </span>
            )}
          </div>
        </div>

        {/* Zone 2: Scoped Role Navigation Links (single-line horizontal) */}
        <nav className="ais-desktop-nav hidden md:flex items-center gap-5 text-xs lg:text-sm font-medium overflow-x-auto scrollbar-none py-1">
          {navItems.map((item) => {
            const isActive =
              currentTab === item.id ||
              (item.matchTabs ? item.matchTabs.includes(currentTab) : false);
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
                  isActive
                    ? 'text-indigo-400 font-semibold border-b-2 border-indigo-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Identity label + 1 Primary Logout / Switch Role Button */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="ais-header-identity hidden sm:flex items-center gap-1.5 text-xs text-slate-300 whitespace-nowrap">
            <span className="font-semibold">{session.displayName}</span>
            <span className="font-mono text-slate-400">({session.userId})</span>
          </div>
          <button
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400" />
            <span>{lockedPortalRole ? '切換帳號 / 登出' : '切換身分 / 登出'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Scoped Nav Strip */}
      {navItems.length > 1 && (
        <nav className="ais-mobile-nav md:hidden border-t border-slate-800/80 px-4 py-1.5 flex items-center gap-4 overflow-x-auto scrollbar-none text-xs font-medium">
          {navItems.map((item) => {
            const isActive =
              currentTab === item.id ||
              (item.matchTabs ? item.matchTabs.includes(currentTab) : false);
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`whitespace-nowrap shrink-0 py-1 cursor-pointer ${
                  isActive
                    ? 'text-indigo-400 font-semibold border-b-2 border-indigo-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
};
