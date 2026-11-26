/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Lock,
  MoveHorizontal,
  RefreshCw,
  Search,
  Table,
  Unlock,
  X,
} from 'lucide-react';
import { HorizontalScrollStrip } from './HorizontalScrollStrip';
import {
  MemberCloudWorkspace,
  buildMemberSheetTabCsv,
  getMemberCloudSheetTabData,
  isRealGoogleSheetId,
  isSafeGoogleCloudUrl,
} from '../services/memberCloudVaultService';

interface MemberCloudSheetViewerProps {
  memberMid: string;
  cloudVault: MemberCloudWorkspace;
  initialSysType?: string;
  theme?: 'light' | 'dark';
  syncing?: boolean;
  onSyncGoogleSheet: () => void;
  onClose?: () => void;
  onOpenModule?: (sysType: string) => void;
}

function isSafeImagePreviewSrc(raw: string): boolean {
  const s = (raw || '').trim();
  if (!s) return false;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(s)) return true;
  try {
    const parsed = new URL(s);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const MemberCloudSheetViewer: React.FC<MemberCloudSheetViewerProps> = ({
  memberMid,
  cloudVault,
  initialSysType,
  theme = 'light',
  syncing = false,
  onSyncGoogleSheet,
  onClose,
  onOpenModule,
}) => {
  const defaultTab = useMemo(() => {
    if (initialSysType && cloudVault.sheetTabs.some((t) => t.sysType === initialSysType)) {
      return initialSysType;
    }
    const firstNonEmpty = cloudVault.sheetTabs.find((t) => t.recordCount > 0);
    return firstNonEmpty?.sysType || cloudVault.sheetTabs[0]?.sysType || 'CONTACT_M';
  }, [cloudVault.sheetTabs, initialSysType]);

  const [activeSysType, setActiveSysType] = useState<string>(defaultTab);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(false);

  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ dragging: boolean; startX: number; startScrollLeft: number }>({
    dragging: false,
    startX: 0,
    startScrollLeft: 0,
  });

  useEffect(() => {
    if (initialSysType && cloudVault.sheetTabs.some((t) => t.sysType === initialSysType)) {
      setActiveSysType(initialSysType);
    }
  }, [initialSysType, cloudVault.sheetTabs]);

  const activeTabMeta = useMemo(
    () => cloudVault.sheetTabs.find((t) => t.sysType === activeSysType) || cloudVault.sheetTabs[0],
    [cloudVault.sheetTabs, activeSysType]
  );

  const tabData = useMemo(
    () => getMemberCloudSheetTabData(memberMid, activeTabMeta?.sysType || activeSysType),
    [memberMid, activeTabMeta?.sysType, activeSysType, cloudVault.lastSyncedAt]
  );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tabData.rows;
    return tabData.rows.filter((row) =>
      tabData.columns.some((col) => {
        const val = row[col] || '';
        if (val.startsWith('data:image/')) return false;
        return val.toLowerCase().includes(q);
      })
    );
  }, [tabData, searchQuery]);

  const updateScrollEdges = () => {
    const el = tableScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    const el = tableScrollRef.current;
    if (el) {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    }
    const timer = setTimeout(updateScrollEdges, 60);
    window.addEventListener('resize', updateScrollEdges);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateScrollEdges);
    };
  }, [activeSysType, filteredRows.length, tabData.columns.length]);

  const scrollTableBy = (deltaX: number) => {
    const el = tableScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: deltaX, behavior: 'smooth' });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, a, input, select, textarea, img')) return;
    const el = tableScrollRef.current;
    if (!el) return;
    dragStateRef.current = {
      dragging: true,
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.dragging) return;
    const el = tableScrollRef.current;
    if (!el) return;
    const dx = e.clientX - dragStateRef.current.startX;
    el.scrollLeft = dragStateRef.current.startScrollLeft - dx;
  };

  const stopDragging = () => {
    dragStateRef.current.dragging = false;
  };

  const hasRealSheet =
    isRealGoogleSheetId(cloudVault.spreadsheetId) && isSafeGoogleCloudUrl(cloudVault.spreadsheetUrl);

  const handleDownloadCsv = () => {
    const csv = buildMemberSheetTabCsv(tabData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${memberMid}_${tabData.tabName}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        isDark
          ? 'bg-slate-950 border-slate-700 text-slate-100'
          : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* Top Bar */}
      <div
        className={`px-3.5 py-3 border-b flex flex-wrap items-center justify-between gap-2 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-emerald-50/70 border-emerald-200'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0 ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>返回總覽</span>
            </button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Table className={`w-4 h-4 shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`} />
              <span className="font-bold text-xs sm:text-sm truncate">
                {cloudVault.spreadsheetName}
              </span>
              <span
                className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                  hasRealSheet
                    ? isDark
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : isDark
                    ? 'bg-amber-950 text-amber-300 border-amber-700'
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}
              >
                {cloudVault.spreadsheetId}
              </span>
              <span
                className={`font-mono text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${
                  isDark
                    ? 'bg-rose-950/80 text-rose-300 border-rose-700'
                    : 'bg-rose-50 text-rose-700 border-rose-300'
                }`}
              >
                <Lock className="w-2.5 h-2.5" />
                <span>試算表僅供檢視 · 禁止直接修改</span>
              </span>
            </div>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {hasRealSheet
                ? '此試算表已啟用唯讀鎖定，會員僅可查看與下載備份，無法在 Google 試算表內直接修改（所有新增與異動請於系統操作畫面執行）。'
                : '此處為系統即時唯讀滾動資料表（禁止直接修改儲存格）；支援手機左右滑動與上下捲動檢視全部欄位。'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {hasRealSheet ? (
            <a
              href={cloudVault.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>開啟 Google 試算表 (僅供檢視)</span>
            </a>
          ) : (
            <button
              type="button"
              disabled={syncing}
              onClick={onSyncGoogleSheet}
              className="px-3 py-1.5 rounded-lg bg-[#065fd4] hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? '建立中...' : '建立真實 Google 試算表'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleDownloadCsv}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0 ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>匯出 CSV</span>
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Worksheet Tab Bar */}
      <div
        className={`px-3 py-2 border-b ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <HorizontalScrollStrip theme={isDark ? 'dark' : 'light'}>
          {cloudVault.sheetTabs.map((tab) => {
            const selected = tab.sysType === activeTabMeta?.sysType;
            return (
              <button
                key={tab.sysType}
                type="button"
                onClick={() => {
                  setActiveSysType(tab.sysType);
                  setSearchQuery('');
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap inline-flex items-center gap-1.5 border transition-colors cursor-pointer shrink-0 ${
                  selected
                    ? isDark
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-emerald-700 text-white border-emerald-700'
                    : isDark
                    ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                {tab.canCreate ? (
                  <Unlock className="w-3 h-3 opacity-80" />
                ) : (
                  <Lock className="w-3 h-3 text-rose-400" />
                )}
                <span>{tab.tabName}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    selected
                      ? 'bg-black/20 text-white'
                      : isDark
                      ? 'bg-slate-800 text-slate-300'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.recordCount}
                </span>
              </button>
            );
          })}
        </HorizontalScrollStrip>
      </div>

      {/* Search & Meta Toolbar */}
      <div
        className={`px-3.5 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-xs ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="relative flex-1 min-w-[170px] max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`搜尋「${tabData.tabName}」內容...`}
            className={`w-full pl-8 pr-2.5 py-1.5 rounded-lg text-xs border focus:outline-none ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500'
                : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
            }`}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-mono text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            顯示 {filteredRows.length} / {tabData.recordCount} 筆 · {tabData.columns.length} 欄
          </span>
          {onOpenModule && activeTabMeta?.sysType && (
            <button
              type="button"
              onClick={() => onOpenModule(activeTabMeta.sysType)}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold cursor-pointer"
            >
              前往此模組新增／編輯
            </button>
          )}
        </div>
      </div>

      {/* Mobile 2D Scrollable Data Table Control Strip */}
      {filteredRows.length > 0 && (
        <div
          className={`px-3 py-1.5 border-b flex items-center justify-between gap-2 text-[11px] ${
            isDark
              ? 'bg-slate-900/75 border-slate-800 text-slate-300'
              : 'bg-slate-50/90 border-slate-200 text-slate-600'
          }`}
        >
          <div className="inline-flex items-center gap-1.5 min-w-0">
            <MoveHorizontal className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            <span className="truncate font-medium">
              滾動資料表 · 手指可左右滑動瀏覽 {tabData.columns.length} 欄、上下捲動資料列（前兩欄凍結）
            </span>
          </div>
          <div className="inline-flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => scrollTableBy(-220)}
              disabled={!canScrollLeft}
              aria-label="向左捲動欄位"
              className={`px-2 py-1 rounded-md border text-[11px] font-bold inline-flex items-center gap-0.5 transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
              }`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">左移</span>
            </button>
            <button
              type="button"
              onClick={() => scrollTableBy(220)}
              disabled={!canScrollRight}
              aria-label="向右捲動欄位"
              className={`px-2 py-1 rounded-md border text-[11px] font-bold inline-flex items-center gap-0.5 transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
              }`}
            >
              <span className="hidden xs:inline">右移</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2D Scrollable Spreadsheet Data Grid */}
      <div
        ref={tableScrollRef}
        onScroll={updateScrollEdges}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        className="w-full overflow-x-auto overflow-y-auto overscroll-contain max-h-[54vh] touch-pan-x touch-pan-y [-webkit-overflow-scrolling:touch] cursor-grab active:cursor-grabbing"
      >
        {filteredRows.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-2">
            <div className={`text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {tabData.recordCount === 0
                ? `「${tabData.title}」工作表目前尚無建檔資料`
                : '查無符合搜尋關鍵字的資料列'}
            </div>
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              {tabData.recordCount === 0
                ? '請切換上方其他已有筆數的工作表分頁，或前往對應模組新增第一筆資料，系統會立即顯示於此試算表內。'
                : '請清除搜尋關鍵字或切換其他工作表分頁查看。'}
            </p>
          </div>
        ) : (
          <table className="w-max min-w-full text-xs text-left border-separate border-spacing-0">
            <thead>
              <tr>
                <th
                  className={`sticky top-0 left-0 z-30 py-2.5 px-2 font-mono text-[10px] w-10 min-w-[40px] max-w-[40px] text-center border-b border-r ${
                    isDark
                      ? 'bg-slate-900 text-slate-300 border-slate-700'
                      : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  #
                </th>
                {tabData.columns.map((col, colIdx) => {
                  const isPinnedFirst = colIdx === 0;
                  const isPhotoCol = col.includes('照片') || col.toLowerCase().includes('photo');
                  return (
                    <th
                      key={col}
                      className={`sticky top-0 py-2.5 px-3 font-bold whitespace-nowrap border-b border-r last:border-r-0 ${
                        isPinnedFirst
                          ? `left-[40px] z-30 min-w-[104px] max-w-[144px] shadow-[2px_0_6px_-2px_rgba(0,0,0,0.18)] ${
                              isDark
                                ? 'bg-slate-900 text-emerald-300 border-slate-700'
                                : 'bg-slate-100 text-emerald-800 border-slate-300'
                            }`
                          : `z-20 ${isPhotoCol ? 'min-w-[104px]' : 'min-w-[124px]'} ${
                              isDark
                                ? 'bg-slate-900 text-slate-300 border-slate-700'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`
                      }`}
                    >
                      {col}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                const isStripe = idx % 2 === 1;
                const rowBg = isDark
                  ? isStripe
                    ? 'bg-slate-900/55 hover:bg-slate-800/80'
                    : 'bg-slate-950 hover:bg-slate-800/70'
                  : isStripe
                  ? 'bg-slate-50/70 hover:bg-emerald-50/50'
                  : 'bg-white hover:bg-emerald-50/50';
                const pinnedCellBg = isDark
                  ? isStripe
                    ? 'bg-slate-900'
                    : 'bg-slate-950'
                  : isStripe
                  ? 'bg-slate-50'
                  : 'bg-white';

                return (
                  <tr key={`${tabData.sysType}-${idx}`} className={rowBg}>
                    <td
                      className={`sticky left-0 z-10 py-2.5 px-2 font-mono text-[10px] w-10 min-w-[40px] max-w-[40px] text-center border-b border-r ${
                        isDark
                          ? 'text-slate-400 border-slate-800 bg-slate-900'
                          : 'text-slate-500 border-slate-200 bg-slate-100/90'
                      }`}
                    >
                      {idx + 1}
                    </td>
                    {tabData.columns.map((col, colIdx) => {
                      const val = row[col] || '';
                      const isPinnedFirst = colIdx === 0;
                      const isPhotoCol = col.includes('照片') || col.toLowerCase().includes('photo');
                      const canRenderPhoto = isPhotoCol && isSafeImagePreviewSrc(val);
                      return (
                        <td
                          key={col}
                          className={`py-2.5 px-3 align-top border-b border-r last:border-r-0 ${
                            isPinnedFirst
                              ? `sticky left-[40px] z-10 min-w-[104px] max-w-[144px] font-mono font-bold shadow-[2px_0_6px_-2px_rgba(0,0,0,0.14)] ${pinnedCellBg} ${
                                  isDark
                                    ? 'border-slate-800 text-emerald-300'
                                    : 'border-slate-200 text-emerald-800'
                                }`
                              : `${isPhotoCol ? 'min-w-[104px]' : 'min-w-[124px]'} max-w-[240px] ${
                                  isDark
                                    ? 'border-slate-800 text-slate-200'
                                    : 'border-slate-200 text-slate-800'
                                }`
                          }`}
                        >
                          {canRenderPhoto ? (
                            <button
                              type="button"
                              onClick={() => setPreviewPhoto(val)}
                              className="inline-flex items-center gap-1.5 group cursor-pointer"
                              title="點擊放大照片"
                            >
                              <img
                                src={val}
                                alt="附圖"
                                referrerPolicy="no-referrer"
                                className="w-9 h-9 rounded object-cover border border-slate-300 group-hover:scale-105 transition-transform shrink-0"
                              />
                              <span className="text-[11px] text-indigo-500 underline inline-flex items-center gap-0.5 whitespace-nowrap">
                                <ImageIcon className="w-3 h-3" />
                                <span>查看</span>
                              </span>
                            </button>
                          ) : (
                            <div className="break-words line-clamp-3 whitespace-pre-wrap leading-relaxed">
                              {val || <span className="opacity-35">—</span>}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Photo Lightbox */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-w-2xl max-h-[85vh] bg-slate-950 rounded-2xl p-2 border border-slate-700 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={previewPhoto}
              alt="試算表附圖預覽"
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[78vh] rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};
