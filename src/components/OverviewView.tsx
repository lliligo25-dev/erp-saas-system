/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { SystemStats } from '../types/erp';
import { erpEngine, GLOBAL_BOUNDARIES } from '../services/erpEngine';
import {
  evaluateThresholdStatus,
  GAS_MYSQL_UPDATED_EVENT,
  loadGasMysqlConfig,
} from '../services/gasMysqlBridgeService';
import {
  ROLE_PORTAL_META,
  buildRolePortalUrl,
  buildPublicMobileCenterUrl,
  OFFICIAL_GAS_EXEC_URL,
  OFFICIAL_SHARED_APP_URL,
  getSavedExternalBaseUrl,
  saveExternalBaseUrl,
  validateExternalBaseUrl,
} from '../services/rolePortalUrlService';
import { 
  Users, 
  GitFork, 
  Layers, 
  CheckCircle2, 
  ShieldCheck, 
  Cpu, 
  Building2, 
  ArrowRight,
  Sparkles,
  TrendingUp,
  CalendarClock,
  FileCode2,
  Link2,
  Copy,
  Check,
  ExternalLink,
  Smartphone,
  QrCode,
  Database
} from 'lucide-react';
import {
  HqQrCodeStudioModal,
  QrTargetPreset,
  roleToQrPreset,
} from './HqQrCodeStudioModal';

interface OverviewViewProps {
  stats: SystemStats;
  onNavigate: (tab: string) => void;
  onOpenRegister: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  stats,
  onNavigate,
  onOpenRegister,
}) => {
  const bookingSummary = erpEngine.getAllBookingsSummary();
  const [mysqlConfig, setMysqlConfig] = useState(() => loadGasMysqlConfig());
  const [copiedPortalKey, setCopiedPortalKey] = useState<string | null>(null);
  const [customPortalIds, setCustomPortalIds] = useState<Record<string, string>>({
    HQ_STAFF: '',
    MEMBER: '',
    STORE: '',
    CENTER: '',
  });
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrInitialPreset, setQrInitialPreset] = useState<QrTargetPreset>('PUBLIC_MOBILE_CENTER');
  const [qrInitialId, setQrInitialId] = useState('');
  const [portalBaseUrl, setPortalBaseUrl] = useState<string>(() => getSavedExternalBaseUrl());
  const [baseUrlSaveMsg, setBaseUrlSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleApplyAndSaveBaseUrl = (candidate: string) => {
    const res = saveExternalBaseUrl(candidate);
    if (res.valid) {
      setPortalBaseUrl(res.savedUrl);
      setBaseUrlSaveMsg({ type: 'ok', text: '已儲存為系統預設對外網址（已同步至立牌設計中心與會員 QR 圖卡）' });
      setTimeout(() => setBaseUrlSaveMsg(null), 3500);
    } else {
      setBaseUrlSaveMsg({ type: 'err', text: res.error || '網址格式不正確' });
    }
  };

  const handleOpenQrStudio = (preset: QrTargetPreset, customId = '') => {
    setQrInitialPreset(preset);
    setQrInitialId(customId);
    setQrModalOpen(true);
  };

  const handleCopyPortalUrl = async (key: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPortalKey(key);
      setTimeout(() => setCopiedPortalKey((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      // clipboard fallback ignored
    }
  };

  useEffect(() => {
    const onUpdated = () => setMysqlConfig(loadGasMysqlConfig());
    window.addEventListener(GAS_MYSQL_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(GAS_MYSQL_UPDATED_EVENT, onUpdated);
  }, []);

  const thresholdEval = evaluateThresholdStatus(
    stats.totalMembers,
    mysqlConfig.memberThreshold,
    mysqlConfig.enabled
  );
  return (
    <div className="space-y-8">
      {/* Hero Banner / Strategic System Definition */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 lg:p-8 relative overflow-hidden">
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold tracking-wider uppercase">
            <span>{GLOBAL_BOUNDARIES.SYSTEM_TARGET_MARKET}</span>
            <span aria-hidden="true">·</span>
            <span>AI 專用修訂版 2.0</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight leading-tight">
            產銷合一物流直銷單軌轉雙軌 SaaS ERP 系統
          </h1>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            核心整合「新會員 1+1 自動雙發路由」機制，新註冊者同時核發單軌公排節點（先來後到全民互助）與雙軌卡位分身（BFS 自動滑落二元樹），搭配 100 元月租 100% 零資金沉澱閉環結算演算法。
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <div>
              <span className="text-slate-500">月租規格：</span>
              <span className="font-mono text-slate-200 ml-1">100 元/月/單位 = 100 點</span>
            </div>
            <span aria-hidden="true">·</span>
            <div>
              <span className="text-slate-500">免費體驗：</span>
              <span className="text-emerald-400 ml-1 font-medium">贈送 2 組 AI 軟體 30 天</span>
            </div>
            <span aria-hidden="true">·</span>
            <div>
              <span className="text-slate-500">雙軌錨點：</span>
              <span className="font-mono text-indigo-300 ml-1">{GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID} (定海神針)</span>
            </div>
          </div>

          <div className="pt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('hq_db_admin')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>總部資料庫維護（修改 / 刪除）</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3.5">
          <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
            <span>註冊會員</span>
            <Users className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono tabular-nums">
            {stats.totalMembers.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">A-碼累計席次</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3.5">
          <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
            <span>單軌公排節點</span>
            <Layers className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <div className="text-xl font-bold text-teal-300 font-mono tabular-nums">
            {stats.monolineNodesCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">時間序列連續排線</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3.5">
          <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
            <span>雙軌樹節點</span>
            <GitFork className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-blue-300 font-mono tabular-nums">
            {stats.binaryNodesCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">BFS 智慧滑落二元樹</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3.5">
          <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
            <span>閉環清算總額</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-300 font-mono tabular-nums">
            ${stats.totalRentCollected.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">100% 全額平帳撥發</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3.5">
          <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
            <span>艾邦妮科技池</span>
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-purple-300 font-mono tabular-nums">
            {stats.abanyTechAccumulated.toFixed(1)} 點
          </div>
          <div className="text-[11px] text-slate-500 mt-1">固定 30% 系統研發</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3.5">
          <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
            <span>總公司營運池</span>
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-300 font-mono tabular-nums">
            {stats.hqOpsAccumulated.toFixed(1)} 點
          </div>
          <div className="text-[11px] text-slate-500 mt-1">固定 28% 行政管理</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3.5">
          <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
            <span>公共安全池</span>
            <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold text-rose-300 font-mono tabular-nums">
            {stats.publicSafetyAccumulated.toFixed(1)} 點
          </div>
          <div className="text-[11px] text-slate-500 mt-1">未續約 50% 熔斷歸集</div>
        </div>
      </div>

      {/* 1+1 Dual Allocation Architecture Diagram */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>新會員「1+1 自動雙發」路由與節點生成架構</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              單筆入會事務內自動並行核發 2 組 30 天 AI 軟體體驗節點，分流進入單軌與雙軌二元樹。
            </p>
          </div>
          <button
            onClick={onOpenRegister}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <span>立即體驗 1+1 註冊</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Channel 1: Monoline Public Aid */}
          <div className="bg-slate-950/70 border border-teal-900/40 rounded-lg p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">
                  通道一 · 第一組 AI 軟體節點
                </span>
                <span className="text-xs text-slate-400 font-mono">C-00000001 ~ C-25000000</span>
              </div>
              <h3 className="text-base font-bold text-slate-100 mb-2">
                單軌公排互助隊列 (Monoline Public Placement)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                依入會時間序列嚴格連續排隊。新進節點之安置父節點為 <code className="text-teal-300 font-mono">C-(current_id - 1)</code>。所有新進夥伴均在同一條長鏈上，享有時間序列 15 代基礎公排互助。
              </p>
              <div className="space-y-2 text-xs text-slate-300 bg-slate-900/60 p-3 rounded border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">指派 MID (A-碼)：</span>
                  <span className="font-mono text-slate-200">A-00000001 ~ A-25000000</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">安置父節點：</span>
                  <span className="font-mono text-teal-300">C-(current_id - 1)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">體驗期益：</span>
                  <span className="text-emerald-400">30 天免費體驗 · 15 代公排互助</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-end">
              <button
                onClick={() => onNavigate('monoline')}
                className="text-xs text-teal-400 hover:text-teal-300 font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <span>檢視單軌公排隊列</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Channel 2: Binary BFS Placement */}
          <div className="bg-slate-950/70 border border-blue-900/40 rounded-lg p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                  通道二 · 第二組 AI 軟體節點
                </span>
                <span className="text-xs text-slate-400 font-mono">C-25000001 起算</span>
              </div>
              <h3 className="text-base font-bold text-slate-100 mb-2">
                雙軌二元樹卡位分身 (Binary BFS Auto-Placement)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                跳過單軌公排，直接以雙軌定海神針 <code className="text-indigo-300 font-mono">{GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID}</code> 為根執行 BFS 廣度優先搜尋，自動滑落至全網第一個開放空缺（L 或 R），提前卡位二元樹爆發動能。
              </p>
              <div className="space-y-2 text-xs text-slate-300 bg-slate-900/60 p-3 rounded border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">定海神針頂點：</span>
                  <span className="font-mono text-indigo-300">C-25000001 (Depth = 0)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">公司自營不得轉讓 (63 席)：</span>
                  <span className="font-mono text-slate-300">C-25000001 ~ C-25000063 (永久鎖定)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">滑落演算法：</span>
                  <span className="text-blue-300">BFS 自動尋找第一個左/右空位</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-end">
              <button
                onClick={() => onNavigate('binary_tree')}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <span>探索雙軌二元樹視覺化</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Channel 3: 3rd AI Personal Booking System */}
        <div className="mt-6 bg-slate-950/70 border border-sky-900/40 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4" />
                通道三 · 第 3 種 AI 軟體系統
              </span>
              <span className="text-slate-500">·</span>
              <span className="font-mono text-slate-300">授權碼前綴 BK- · 訂單前綴 APT-</span>
              <span className="text-slate-500">·</span>
              <span className="text-emerald-400 font-semibold">30 天免費體驗 · 月租 100 元</span>
            </div>
            <h3 className="text-base font-bold text-slate-100">
              AI 個人預約系統 (Personal Booking & Consultation Scheduler)
            </h3>
            <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
              每位會員專屬個人預約前台、服務項目價目管理與每週工時排班；客戶預約自動寫入 <code className="text-sky-300 font-mono">CONTACT_T</code> 並可一鍵轉入 1+1 開通，月租 100 元全額納入 100% 閉環分潤。目前全網已開通 <span className="font-mono text-sky-300 font-semibold">{bookingSummary.totalActivatedProfiles}</span> 套 · 累積 <span className="font-mono text-slate-200 font-semibold">{bookingSummary.totalAppointments}</span> 筆預約單。
            </p>
          </div>
          <button
            onClick={() => onNavigate('booking_system')}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <span>管理第 3 種 AI 個人預約系統</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Global Boundary & Financial Settlement Rules Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Boundaries Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>核心編號與邊界定義 (Global Boundaries)</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">單軌編號 (MID / 節點)</span>
              <span className="font-mono text-teal-300">A-00001 ~ A-25000000 / C-00001 ~ C-25000000</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">雙軌編號 (MID / 節點)</span>
              <span className="font-mono text-indigo-300 font-bold">A-25000001 起 / C-25000001 起</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">公司自營不得轉讓 (63 席)</span>
              <span className="font-mono text-amber-300 font-bold">A-00001 ~ A-00063 (單/雙軌起點永久鎖定)</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">公司自營直推鏈結構</span>
              <span className="font-mono text-slate-300">A-00001→…→A-00007 直推 A-00008~A-00063</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-400">對外開放建檔起點 (永吉家族)</span>
              <span className="font-mono text-emerald-400 font-bold">A-00064 起 (A-00008 直推 A-00064~A-00068)</span>
            </div>
          </div>
        </div>

        {/* 100 NTD 100% Closed Loop Formula Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>100 元月租 100% 閉環撥發清算矩陣</span>
            </h3>
            <span className="text-[11px] font-mono text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded">
              0 資金沉澱 · 完美平帳
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                <span className="text-slate-300">15 代直推推薦分紅</span>
              </div>
              <span className="font-mono text-slate-200">15.0 點 (每代 1.0 點 · 15%)</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-slate-300">15 代雙軌安置排線分紅</span>
              </div>
              <span className="font-mono text-slate-200">15.0 點 (每代 1.0 點 · 15%)</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                <span className="text-slate-300">6 代經營店輔導補貼</span>
              </div>
              <span className="font-mono text-slate-200">6.0 點 (每代 1.0 點 · 6%)</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                <span className="text-slate-300">6 代教育中心培訓補貼</span>
              </div>
              <span className="font-mono text-slate-200">6.0 點 (每代 1.0 點 · 6%)</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <span className="text-slate-300">艾邦妮科技有限公司科技系統池</span>
              </div>
              <span className="font-mono text-purple-300 font-semibold">30.0 點 (固定 30%)</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-slate-300">總公司營運行政管理池</span>
              </div>
              <span className="font-mono text-amber-300 font-semibold">28.0 點 (固定 28%)</span>
            </div>

            <div className="flex items-center justify-between pt-2 text-slate-100 font-bold border-t border-slate-700">
              <span>合計平帳驗證公式</span>
              <span className="font-mono text-emerald-400">15 + 15 + 6 + 6 + 30 + 28 = 100.0 點</span>
            </div>

            <div className="text-[11px] text-slate-400 mt-2 bg-slate-950/50 p-2.5 rounded border border-slate-800">
              <span className="text-rose-400 font-semibold">★ 未續約 50% 熔斷機制：</span>
              <span> 若節點 30 天期滿未續約，其分紅減半 (0.5x)，其餘 50% 自動撥入公共安全基金池。</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action quick links */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/50 border border-slate-800 rounded-lg text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-2">
          <FileCode2 className="w-4 h-4 text-indigo-400" />
          <span>Google Apps Script (Code.gs) 與 1+1 雙通道節點架構已全面整合</span>
          <span className="text-slate-600">·</span>
          <span
            className={`font-mono px-2 py-0.5 rounded border text-[11px] ${
              thresholdEval.badgeState === 'CONNECTED'
                ? 'bg-emerald-950/70 border-emerald-700/70 text-emerald-300'
                : thresholdEval.badgeState === 'READY_TO_CONNECT'
                ? 'bg-amber-950/70 border-amber-700/70 text-amber-300'
                : 'bg-slate-950 border-slate-700 text-slate-300'
            }`}
          >
            {thresholdEval.badgeState === 'CONNECTED'
              ? `GAS + MySQL 已連接 (${mysqlConfig.mode})`
              : thresholdEval.badgeState === 'READY_TO_CONNECT'
              ? `MySQL 擴容已達門檻 (${thresholdEval.currentMembers}/${thresholdEval.threshold})`
              : `GAS + MySQL 待命 (${thresholdEval.currentMembers}/${thresholdEval.threshold} 席)`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('member_portal')}
            className="px-3 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-950/80 border border-indigo-700/80 hover:bg-indigo-900 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>會員登入系統 (個人戰情室) →</span>
          </button>
          <button
            onClick={() => onNavigate('crm_events')}
            className="px-3 py-1.5 text-xs font-semibold text-sky-300 bg-sky-950/80 border border-sky-700/80 hover:bg-sky-900 rounded-lg transition-colors cursor-pointer"
          >
            通訊錄·活動 (CM/CT/EM/ET) →
          </button>
          <button
            onClick={() => onNavigate('store_portal')}
            className="px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-700/80 hover:bg-emerald-900 rounded-lg transition-colors cursor-pointer"
          >
            經營店登入與輔導詳細 →
          </button>
          <button
            onClick={() => onNavigate('center_portal')}
            className="px-3 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-950/80 border border-cyan-700/80 hover:bg-cyan-900 rounded-lg transition-colors cursor-pointer"
          >
            教育中心登入與切換 →
          </button>
          <button
            onClick={() => onNavigate('member_nodes')}
            className="px-3 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-950/80 border border-indigo-700/80 hover:bg-indigo-900 rounded-lg transition-colors cursor-pointer"
          >
            查詢會員所有結點全貌 →
          </button>
          <button
            onClick={() => onNavigate('gas_api')}
            className="px-3 py-1.5 text-xs font-semibold text-emerald-200 bg-emerald-900/60 border border-emerald-700/70 hover:bg-emerald-800/80 rounded-lg transition-colors cursor-pointer"
          >
            GAS + MySQL 一鍵擴容 & API
          </button>
        </div>
      </div>

      {/* 4 Dedicated Role Portal URLs Distribution Center */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-indigo-400" />
              <span>四大身分專屬網址與 Google 協作平台分發中心（總部 / 會員 / 營業店 / 教育中心）</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              四種身分各有獨立入口網址。對外開放的 <code className="text-sky-300 font-mono">?portal=member / store / center</code> 可安全內嵌至 Google 協作平台；總部入口 <code className="text-rose-300 font-mono">?portal=hq</code> 請僅內部私密使用、勿公開嵌入。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleApplyAndSaveBaseUrl(OFFICIAL_GAS_EXEC_URL)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                portalBaseUrl === OFFICIAL_GAS_EXEC_URL
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              GAS /exec 網址
            </button>
            {typeof window !== 'undefined' && (
              <button
                type="button"
                onClick={() => handleApplyAndSaveBaseUrl(window.location.origin)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                  portalBaseUrl === window.location.origin
                    ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                目前網站網址
              </button>
            )}
            <button
              type="button"
              onClick={() => handleApplyAndSaveBaseUrl(OFFICIAL_SHARED_APP_URL)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                portalBaseUrl === OFFICIAL_SHARED_APP_URL
                  ? 'bg-sky-950/80 border-sky-500 text-sky-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              AI Studio 分享網址
            </button>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-1.5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 shrink-0">目前分發基底網址：</span>
            <input
              type="url"
              value={portalBaseUrl}
              onChange={(e) => {
                setPortalBaseUrl(e.target.value);
                if (baseUrlSaveMsg) setBaseUrlSaveMsg(null);
              }}
              placeholder="https://script.google.com/macros/s/您的腳本ID/exec 或 https://your-domain.com"
              className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-[11px] font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => handleApplyAndSaveBaseUrl(portalBaseUrl)}
              className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-[11px] font-bold text-white shrink-0 cursor-pointer transition-colors"
            >
              儲存為預設對外網址
            </button>
          </div>
          {baseUrlSaveMsg ? (
            <div
              className={`text-[11px] ${
                baseUrlSaveMsg.type === 'ok' ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {baseUrlSaveMsg.text}
            </div>
          ) : (
            !validateExternalBaseUrl(portalBaseUrl).valid && (
              <div className="text-[11px] text-amber-300">
                {validateExternalBaseUrl(portalBaseUrl).error}
              </div>
            )
          )}
        </div>

        {/* Simple One-Click Bare /exec URL Helper for Google Sites + LINE Mobile */}
        <div className="bg-emerald-950/30 border border-emerald-600/40 rounded-lg p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#06C755]" />
              <span>極簡通用方案：只貼純 /exec 網址即可同時用於「Google 協作平台」與「LINE 自動轉手機版」</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              只要更新一次新版 <code className="text-emerald-300 font-mono">Code.gs</code> 並部署後，直接複製下方純 <code className="text-emerald-300 font-mono">/exec</code> 網址貼入 Google 協作平台（自動框架顯示）或貼到 LINE 聊天室（自動偵測並轉為手機專用版面，且不顯示總部）。
            </p>
            <div className="text-[11px] font-mono text-emerald-200 break-all bg-slate-950/80 border border-slate-800 rounded px-2.5 py-1.5">
              {portalBaseUrl}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleCopyPortalUrl('bare-exec-only', portalBaseUrl)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#06C755] hover:bg-[#05b34c] text-xs font-bold text-slate-950 cursor-pointer transition-colors"
            >
              {copiedPortalKey === 'bare-exec-only' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>已複製純 /exec 網址</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>複製純 /exec 網址</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('gas_api')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-emerald-300 cursor-pointer transition-colors"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>前往複製最新 Code.gs</span>
            </button>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-sky-500/30 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>對外統一手機專用登入網址（直開即顯示手機最佳化版面，完全隱藏總部）</span>
            </div>
            <div className="text-[11px] font-mono text-slate-300 break-all">
              {buildPublicMobileCenterUrl(portalBaseUrl)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenQrStudio('PUBLIC_MOBILE_CENTER', '')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shrink-0 cursor-pointer transition-colors shadow-sm"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>設計 LINE / 手機掃碼立牌</span>
            </button>
            <button
              type="button"
              onClick={() =>
                handleCopyPortalUrl(
                  'public-line-mobile-center',
                  buildPublicMobileCenterUrl(portalBaseUrl, { openExternalBrowser: true })
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#06C755] hover:bg-[#05b34c] text-xs font-bold text-slate-950 shrink-0 cursor-pointer transition-colors"
            >
              {copiedPortalKey === 'public-line-mobile-center' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>已複製 LINE 專用網址</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>複製 LINE 掃碼專用網址</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                handleCopyPortalUrl('public-mobile-center', buildPublicMobileCenterUrl(portalBaseUrl))
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white shrink-0 cursor-pointer transition-colors"
            >
              {copiedPortalKey === 'public-mobile-center' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>已複製手機中心網址</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>複製手機登入中心網址</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ROLE_PORTAL_META.map((meta) => {
            const customId = customPortalIds[meta.role] || '';
            const fullUrl = buildRolePortalUrl(meta.role, customId, portalBaseUrl);
            const mobileUrl = buildRolePortalUrl(meta.role, customId, portalBaseUrl, { device: 'mobile' });
            const copyKey = `hq-card-${meta.slug}`;
            const mobileCopyKey = `hq-mobile-${meta.slug}`;
            const embedCopyKey = `hq-embed-${meta.slug}`;
            const googleSitesIframeHtml = `<iframe src="${fullUrl}" style="width:100%;height:880px;border:0;border-radius:12px;" allow="clipboard-read; clipboard-write" allowfullscreen></iframe>`;

            return (
              <div
                key={meta.slug}
                className={`bg-slate-950/70 border ${meta.accentBorder} rounded-lg p-4 flex flex-col justify-between gap-3`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-bold ${meta.accentText}`}>
                      {meta.portalName}
                    </span>
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${meta.accentBadgeBg}`}>
                      ?portal={meta.slug}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {meta.shortDesc}
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <label className="text-[11px] text-slate-400 shrink-0">
                      指定代號（選填）：
                    </label>
                    <input
                      type="text"
                      value={customId}
                      onChange={(e) =>
                        setCustomPortalIds((prev) => ({
                          ...prev,
                          [meta.role]: e.target.value,
                        }))
                      }
                      placeholder={meta.idParamHint}
                      className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-[11px] font-mono text-slate-300 break-all">
                    {fullUrl}
                  </div>
                  <div className="bg-slate-900/70 border border-slate-800/80 rounded px-3 py-1.5 text-[11px] font-mono text-sky-300/90 break-all flex items-start gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 shrink-0 mt-0.5 text-sky-400" />
                    <span>{mobileUrl}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpenQrStudio(roleToQrPreset(meta.role), customId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900/80 border border-indigo-700/70 text-xs font-semibold text-indigo-200 cursor-pointer transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5 text-indigo-300" />
                    <span>QR Code 圖卡</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyPortalUrl(mobileCopyKey, mobileUrl)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-950/70 hover:bg-sky-900/70 border border-sky-700/70 text-xs font-semibold text-sky-300 cursor-pointer transition-colors"
                  >
                    {copiedPortalKey === mobileCopyKey ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">已複製手機網址</span>
                      </>
                    ) : (
                      <>
                        <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                        <span>複製手機專用網址</span>
                      </>
                    )}
                  </button>
                  {meta.role !== 'HQ_STAFF' && (
                    <button
                      type="button"
                      onClick={() => handleCopyPortalUrl(embedCopyKey, googleSitesIframeHtml)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-amber-300 cursor-pointer transition-colors"
                    >
                      {copiedPortalKey === embedCopyKey ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">已複製協作平台嵌入碼</span>
                        </>
                      ) : (
                        <>
                          <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
                          <span>複製 Google 協作平台內嵌碼</span>
                        </>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCopyPortalUrl(copyKey, fullUrl)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer transition-colors"
                  >
                    {copiedPortalKey === copyKey ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">已複製網址</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>複製專屬網址</span>
                      </>
                    )}
                  </button>
                  <a
                    href={fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors ${meta.buttonBg}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>新分頁開啟</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <HqQrCodeStudioModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        initialPreset={qrInitialPreset}
        initialCustomId={qrInitialId}
        initialBaseUrl={portalBaseUrl}
      />
    </div>
  );
};
