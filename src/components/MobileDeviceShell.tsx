/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Monitor, Smartphone } from 'lucide-react';

export type MobilePhonePreset = 'compact' | 'standard' | 'large';

export interface MobilePhonePresetSpec {
  id: MobilePhonePreset;
  label: string;
  width: number;
  height: number;
  widthClass: string;
  heightClass: string;
}

export const MOBILE_PHONE_PRESETS: Record<MobilePhonePreset, MobilePhonePresetSpec> = {
  compact: {
    id: 'compact',
    label: '小螢幕',
    width: 375,
    height: 667,
    widthClass: 'md:w-[375px]',
    heightClass: 'md:h-[667px]',
  },
  standard: {
    id: 'standard',
    label: '標準手機',
    width: 390,
    height: 844,
    widthClass: 'md:w-[390px]',
    heightClass: 'md:h-[844px]',
  },
  large: {
    id: 'large',
    label: '大螢幕',
    width: 430,
    height: 932,
    widthClass: 'md:w-[430px]',
    heightClass: 'md:h-[932px]',
  },
};

const PRESET_LIST: MobilePhonePresetSpec[] = [
  MOBILE_PHONE_PRESETS.compact,
  MOBILE_PHONE_PRESETS.standard,
  MOBILE_PHONE_PRESETS.large,
];

interface MobileDeviceShellProps {
  preset: MobilePhonePreset;
  onChangePreset: (preset: MobilePhonePreset) => void;
  onExitMobileMode: () => void;
  scrollContent: React.ReactNode;
  overlayContent?: React.ReactNode;
}

/**
 * 電腦端實機手機尺寸模擬外框：
 * - 電腦螢幕 (>= 768px)：以真實手機 1:1 CSS 像素尺寸（375×667 / 390×844 / 430×932）與獨立捲動視窗呈現，並附上方尺寸切換列。
 * - 真實手機 (< 768px)：完全隱藏模擬外框與控制列，自動以原生滿版方式流暢瀏覽。
 */
export const MobileDeviceShell: React.FC<MobileDeviceShellProps> = ({
  preset,
  onChangePreset,
  onExitMobileMode,
  scrollContent,
  overlayContent,
}) => {
  const activePreset = MOBILE_PHONE_PRESETS[preset] || MOBILE_PHONE_PRESETS.standard;

  return (
    <div className="flex-1 bg-slate-950 flex flex-col md:items-center md:justify-start md:py-3 md:px-4">
      {/* Desktop-Only Simulator Control Bar (Hidden on real phones < 768px) */}
      <div className="hidden md:flex items-center justify-between gap-3 w-full max-w-[760px] mb-3 px-3.5 py-2 rounded-xl bg-slate-900/95 border border-slate-800 shadow-lg text-xs">
        <div className="flex items-center gap-2 text-slate-300 shrink-0">
          <Smartphone className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="font-semibold text-slate-100 whitespace-nowrap">實機手機比例模擬</span>
          <span className="font-mono tabular-nums text-[11px] px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-indigo-300">
            {activePreset.width} × {activePreset.height} px
          </span>
        </div>

        <div
          role="group"
          aria-label="選擇手機螢幕尺寸"
          className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800"
        >
          {PRESET_LIST.map((item) => {
            const isActive = item.id === activePreset.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangePreset(item.id)}
                aria-pressed={isActive}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <span>{item.label}</span>
                <span className="ml-1 font-mono tabular-nums text-[10px] opacity-80">
                  {item.width}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onExitMobileMode}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Monitor className="w-3.5 h-3.5 text-slate-300" />
          <span>返回桌機板</span>
        </button>
      </div>

      {/* Desktop-Only Smartphone Bezel (Native full-bleed on real phones < 768px) */}
      <div className="w-full md:w-auto flex-1 md:flex-none flex flex-col md:rounded-[44px] md:p-[10px] md:bg-slate-800 md:border md:border-slate-700/80 md:shadow-[0_24px_70px_rgba(0,0,0,0.75)]">
        <div
          className={`w-full flex-1 md:flex-none ${activePreset.widthClass} ${activePreset.heightClass} md:max-h-[calc(100vh-5.75rem)] md:rounded-[34px] md:overflow-hidden flex flex-col bg-slate-950 relative`}
        >
          {/* Desktop-Only Simulated Phone Status Bar */}
          <div
            aria-hidden="true"
            className="hidden md:flex items-center justify-between px-6 h-8 bg-slate-900/95 border-b border-slate-800/50 shrink-0 select-none text-[11px] font-mono tabular-nums text-slate-300"
          >
            <span className="font-semibold tracking-tight">9:41</span>
            <div className="w-20 h-4 rounded-full bg-slate-950 border border-slate-800/80" />
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="text-[10px] font-sans font-semibold">5G</span>
              <div className="w-5 h-2.5 rounded-[3px] border border-slate-400 p-[1.5px] flex items-center">
                <div className="w-full h-full rounded-[1px] bg-emerald-400" />
              </div>
            </div>
          </div>

          {/* Mobile Viewport Frame: isolates fixed drawers/modals strictly to this screen on md+ */}
          <div
            data-viewport="mobile"
            className="ais-viewport-frame ais-mobile-device-viewport relative flex-1 min-h-0 flex flex-col bg-slate-950 md:overflow-hidden"
          >
            <div className="ais-mobile-scroll-area flex-1 min-h-0 md:overflow-y-auto md:overflow-x-hidden flex flex-col">
              {scrollContent}
            </div>
            {overlayContent}
          </div>

          {/* Desktop-Only Simulated Home Indicator */}
          <div
            aria-hidden="true"
            className="hidden md:flex items-center justify-center h-5 bg-slate-950 border-t border-slate-900 shrink-0 select-none"
          >
            <div className="w-28 h-1 rounded-full bg-slate-600/80" />
          </div>
        </div>
      </div>
    </div>
  );
};
