/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { erpEngine, GLOBAL_BOUNDARIES } from '../services/erpEngine';
import { MemberFullNodeReport, NodeRecord } from '../types/erp';
import { 
  Search, 
  Users, 
  GitFork, 
  Layers, 
  DollarSign, 
  Clock, 
  Lock, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  UserCheck,
  RefreshCw,
  ShoppingBag
} from 'lucide-react';
import {
  syncMemberPurchasedProductsToNodes,
  getPurchasedProductNodeEntries,
  PurchasedProductNodeEntry,
  NODES_UPDATED_EVENT,
} from '../services/softwareNodeSync';
import { queryWithMysqlSyncCache } from '../services/gasMysqlCacheService';

interface MemberNodesViewProps {
  initialQuery?: string;
  scopedMode?: boolean;
  onNavigateToTree: (nodeId?: string) => void;
  onSelectForSettlement: (nodeId: string) => void;
  onNavigateToMemberPortal?: (mid: string) => void;
}

export const MemberNodesView: React.FC<MemberNodesViewProps> = ({
  initialQuery = 'A-00001',
  scopedMode = false,
  onNavigateToTree,
  onSelectForSettlement,
  onNavigateToMemberPortal,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<'owned' | 'binary_downline' | 'monoline_aid' | 'fifteen_gen' | 'referrals'>('fifteen_gen');
  const [report, setReport] = useState<MemberFullNodeReport | null>(() => {
    const initial = erpEngine.getMemberFullNodeReport(initialQuery) || erpEngine.getMemberFullNodeReport('A-00001113');
    if (initial) {
      syncMemberPurchasedProductsToNodes(initial.member.mid);
      return erpEngine.getMemberFullNodeReport(initial.member.mid);
    }
    return null;
  });
  const [purchasedEntries, setPurchasedEntries] = useState<PurchasedProductNodeEntry[]>(() => {
    const targetMid = report?.member.mid || initialQuery;
    return getPurchasedProductNodeEntries(targetMid);
  });

  const [expandedGen, setExpandedGen] = useState<number | null>(null);
  const [ownedFilter, setOwnedFilter] = useState<'ALL' | 'MONOLINE' | 'BINARY' | 'NEW_PRODUCTS'>('ALL');
  const [ownedPage, setOwnedPage] = useState<number>(1);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const PAGE_SIZE = 15;

  const refreshReport = (targetQuery: string, showNotice = false) => {
    const initialRes = erpEngine.getMemberFullNodeReport(targetQuery);
    if (!initialRes) {
      return null;
    }
    const entries = syncMemberPurchasedProductsToNodes(initialRes.member.mid);
    const updatedRes = erpEngine.getMemberFullNodeReport(initialRes.member.mid);
    setReport(updatedRes);
    setPurchasedEntries(entries);
    setSearchError(null);
    if (showNotice) {
      setSyncNotice(`已同步「${initialRes.member.name} (${initialRes.member.mid})」名下 ${entries.length} 筆新購產品節點至持有節點清冊`);
      setTimeout(() => setSyncNotice(null), 3500);
    }
    return updatedRes;
  };

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      const res = refreshReport(initialQuery);
      if (res) {
        setOwnedPage(1);
      }
    }
  }, [initialQuery]);

  useEffect(() => {
    const handleNodesUpdated = (ev: Event) => {
      const customEv = ev as CustomEvent<{ memberMid?: string }>;
      const targetMid = report?.member.mid || initialQuery;
      if (!customEv.detail?.memberMid || customEv.detail.memberMid === targetMid) {
        refreshReport(targetMid);
      }
    };
    window.addEventListener(NODES_UPDATED_EVENT, handleNodesUpdated);
    return () => window.removeEventListener(NODES_UPDATED_EVENT, handleNodesUpdated);
  }, [report?.member.mid, initialQuery]);

  const handleSeedChain = (depth: number = 5) => {
    if (!report) return;
    erpEngine.seedMultiGenReferralChain(report.member.mid, depth);
    const updated = erpEngine.getMemberFullNodeReport(report.member.mid);
    setReport(updated);
    setActiveTab('fifteen_gen');
  };

  const handleSearch = (targetQuery?: string) => {
    const q = (targetQuery !== undefined ? targetQuery : query).trim();
    if (!q) return;
    const cacheLookup = queryWithMysqlSyncCache(q);
    const indexedMid = cacheLookup.entries[0]?.primaryMid;
    const res = refreshReport(indexedMid || q) || refreshReport(q);
    setOwnedPage(1);
    if (!res) {
      setReport(null);
      setPurchasedEntries([]);
      setSearchError(`找不到與「${q}」相符的會員或節點編號，請確認 MID (如 A-00001) 或節點代號 (如 C-25000001)。`);
    }
  };

  const allMembers = erpEngine.getAllMembers();

  return (
    <div className="space-y-6">
      {/* Header Banner (Search hidden in scopedMode) */}
      {!scopedMode ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Search className="w-5 h-5 text-indigo-400" />
                <span>查詢會員所有節點 (Member All Nodes Center)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                即時查詢任一會員名下所擁有的「1+1 雙發節點資產」、雙軌二元樹左右區傘下安置組織、單軌 15 代公排互助隊列與直推推薦網絡。
              </p>
            </div>

            {/* Quick chip selectors */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400">快捷速查：</span>
              <button
                onClick={() => {
                  setQuery('A-00001');
                  handleSearch('A-00001');
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-emerald-300 font-mono text-xs cursor-pointer transition-colors"
              >
                A-00001 (首位新會員)
              </button>
              <button
                onClick={() => {
                  setQuery('A-00001113');
                  handleSearch('A-00001113');
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-indigo-300 font-mono text-xs cursor-pointer transition-colors"
              >
                A-00001113 (旗艦領袖-514席)
              </button>
              <button
                onClick={() => {
                  setQuery('C-25000001');
                  handleSearch('C-25000001');
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-amber-300 font-mono text-xs cursor-pointer transition-colors"
              >
                C-25000001 (雙軌定海神針)
              </button>
            </div>
          </div>

          {/* Search input field */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="mt-4 flex flex-col sm:flex-row gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="請輸入會員 MID (例如 A-00001, A-00001113) 或節點代號 (例如 C-00001, C-25000001)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 font-mono focus:outline-none focus:border-indigo-500"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm rounded-lg transition-colors cursor-pointer shadow-sm whitespace-nowrap"
            >
              查詢該會員所有節點
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <span>我的 1+1 雙發節點與 15 代組織全景</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            僅顯示您本人名下所持有的單軌公排節點、雙軌二元樹傘下配置與 15 代直推推薦組織矩陣。
          </p>
        </div>
      )}

      {searchError && (
        <div className="bg-rose-950/50 border border-rose-700/70 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{searchError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSearchError(null)}
            className="text-rose-300 hover:text-white text-xs underline cursor-pointer"
          >
            關閉
          </button>
        </div>
      )}

      {report ? (
        <div className="space-y-6">
          {/* Member Profile & Asset Summary Strip */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-slate-100">
                    {report.member.name}
                  </span>
                  <span className="font-mono text-xs text-indigo-400 font-bold bg-indigo-950/70 border border-indigo-800/80 px-2 py-0.5 rounded">
                    MID: {report.member.mid}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
                  <span>推薦人：{report.member.sponsorMid}</span>
                  <span aria-hidden="true">·</span>
                  <span>經營店：{report.member.storeId}</span>
                  <span aria-hidden="true">·</span>
                  <span>教育中心：{report.member.centerId}</span>
                  <span aria-hidden="true">·</span>
                  <span>註冊時間：{new Date(report.member.registeredAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Fast Action Buttons (Hidden in scopedMode) */}
              {!scopedMode && (
                <div className="flex flex-wrap items-center gap-2">
                  {onNavigateToMemberPortal && (
                    <button
                      onClick={() => onNavigateToMemberPortal(report.member.mid)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer shadow-sm"
                    >
                      <span>進入會員登入戰情室 →</span>
                    </button>
                  )}
                  <button
                    onClick={() => onNavigateToTree(report.member.binaryNodeId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    <GitFork className="w-3.5 h-3.5" />
                    <span>雙軌樹定位 ({report.member.binaryNodeId})</span>
                  </button>
                  <button
                    onClick={() => onSelectForSettlement(report.member.binaryNodeId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>發起 100 元閉環清算</span>
                  </button>
                </div>
              )}
            </div>

            {/* Financial and Node Counts KPI Bar */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
                <div className="text-[11px] text-slate-400">名下持有總節點</div>
                <div className="text-lg font-bold font-mono text-indigo-300 mt-0.5">
                  {report.totalOwnedNodesCount.toLocaleString()} 席
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  單軌 {report.ownedMonolineNodes.length} · 雙軌 {report.ownedBinaryNodes.length}
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
                <div className="text-[11px] text-slate-400">雙軌傘下總節點</div>
                <div className="text-lg font-bold font-mono text-blue-300 mt-0.5">
                  {report.binaryDownline.totalDownlineCount.toLocaleString()} 席
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  左區 {report.binaryDownline.leftLegNodes.length} · 右區 {report.binaryDownline.rightLegNodes.length}
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
                <div className="text-[11px] text-slate-400">向下直推 15 代總人數</div>
                <div className="text-lg font-bold font-mono text-purple-300 mt-0.5 tabular-nums">
                  {report.downstream15Gen.total15GenCount.toLocaleString()} 人
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  第1代親推 {report.downstream15Gen.generations[0]?.count || 0} 人 · 深度 {report.downstream15Gen.maxActiveGeneration} 代
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
                <div className="text-[11px] text-slate-400">15代直推月分紅潛力</div>
                <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5 tabular-nums">
                  +{report.downstream15Gen.totalPotentialMonthlyBonus.toFixed(1)} 點
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">每人續約 1.0 點/期</div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
                <div className="text-[11px] text-slate-400">累積未滿100零錢池</div>
                <div className="text-lg font-bold font-mono text-amber-400 mt-0.5 tabular-nums">
                  ${report.financialSummary.accumulatedRentAmount} 元
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">滿100元自動清算</div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
                <div className="text-[11px] text-slate-400">單軌公排互助收益</div>
                <div className="text-lg font-bold font-mono text-teal-300 mt-0.5 tabular-nums">
                  {report.financialSummary.monolineEarnings.toFixed(1)} 點
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">15 代先後互助</div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
                <div className="text-[11px] text-slate-400">名下所有節點總收益</div>
                <div className="text-lg font-bold font-mono text-indigo-300 mt-0.5 tabular-nums">
                  {report.financialSummary.totalEarningsFromAllNodes.toFixed(1)} 點
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">100% 全額平帳所得</div>
              </div>
            </div>
          </div>

          {/* Dimension Tabs Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setActiveTab('fifteen_gen')}
              className={`px-4 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'fifteen_gen'
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>向下直推 15 代矩陣與總人數 ({report.downstream15Gen.total15GenCount} 人)</span>
            </button>

            <button
              onClick={() => setActiveTab('owned')}
              className={`px-4 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'owned'
                  ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>名下持有節點清冊 ({report.totalOwnedNodesCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('binary_downline')}
              className={`px-4 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'binary_downline'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>雙軌傘下安置二元組織 ({report.binaryDownline.totalDownlineCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('monoline_aid')}
              className={`px-4 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'monoline_aid'
                  ? 'bg-teal-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>單軌 15 代公排互助隊列</span>
            </button>

            <button
              onClick={() => setActiveTab('referrals')}
              className={`px-4 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'referrals'
                  ? 'bg-purple-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>親推第 1 代名冊 ({report.referrals.directReferralMembers.length})</span>
            </button>
          </div>

          {/* TAB 1: OWNED NODES INVENTORY */}
          {activeTab === 'owned' && (() => {
            const entryByNodeId = new Map<string, PurchasedProductNodeEntry>();
            purchasedEntries.forEach((e) => entryByNodeId.set(e.nodeId, e));

            const purchasedBinaryNodes = report.ownedBinaryNodes.filter(
              (n) => entryByNodeId.has(n.nodeId) || (n.softwareKey && n.nodeId !== report.member.binaryNodeId)
            );

            const list =
              ownedFilter === 'ALL'
                ? [...report.ownedMonolineNodes, ...report.ownedBinaryNodes]
                : ownedFilter === 'MONOLINE'
                ? report.ownedMonolineNodes
                : ownedFilter === 'BINARY'
                ? report.ownedBinaryNodes
                : purchasedBinaryNodes;

            const totalPages = Math.ceil(list.length / PAGE_SIZE) || 1;
            const pagedList = list.slice((ownedPage - 1) * PAGE_SIZE, ownedPage * PAGE_SIZE);

            return (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-400" />
                      <span>該會員名下所有持有節點清單</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/70 text-[11px] font-mono normal-case">
                        含新購產品 {purchasedBinaryNodes.length} 席
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      包含「1+1 自動雙發」之第 1 組單軌公排節點、第 2 組雙軌二元樹節點，以及新購買產品／AI 軟體模組自動同步排入之雙軌節點清冊。
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => refreshReport(report.member.mid, true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>同步新購產品至節點清冊</span>
                    </button>

                    <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                      <button
                        onClick={() => {
                          setOwnedFilter('ALL');
                          setOwnedPage(1);
                        }}
                        className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                          ownedFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                        }`}
                      >
                        全部 ({report.totalOwnedNodesCount})
                      </button>
                      <button
                        onClick={() => {
                          setOwnedFilter('MONOLINE');
                          setOwnedPage(1);
                        }}
                        className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                          ownedFilter === 'MONOLINE' ? 'bg-teal-600 text-white' : 'text-slate-400'
                        }`}
                      >
                        單軌 ({report.ownedMonolineNodes.length})
                      </button>
                      <button
                        onClick={() => {
                          setOwnedFilter('BINARY');
                          setOwnedPage(1);
                        }}
                        className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                          ownedFilter === 'BINARY' ? 'bg-blue-600 text-white' : 'text-slate-400'
                        }`}
                      >
                        雙軌 ({report.ownedBinaryNodes.length})
                      </button>
                      <button
                        onClick={() => {
                          setOwnedFilter('NEW_PRODUCTS');
                          setOwnedPage(1);
                        }}
                        className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                          ownedFilter === 'NEW_PRODUCTS' ? 'bg-emerald-600 text-white font-semibold' : 'text-emerald-400 hover:text-emerald-300'
                        }`}
                      >
                        <ShoppingBag className="w-3 h-3" />
                        <span>新購產品 ({purchasedBinaryNodes.length})</span>
                      </button>
                    </div>
                  </div>
                </div>

                {syncNotice && (
                  <div className="bg-emerald-950/60 border border-emerald-700/70 rounded-lg px-3.5 py-2 text-xs text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{syncNotice}</span>
                  </div>
                )}

                {purchasedEntries.length > 0 && (
                  <div className="bg-slate-950/70 border border-emerald-900/50 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>新購買產品同步節點對照 ({purchasedEntries.length} 項)</span>
                      </span>
                      <span className="text-[11px] text-slate-400">每套新購／擴充產品自動寫入雙軌節點清冊</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {purchasedEntries.map((entry) => (
                        <div
                          key={`${entry.nodeId}-${entry.moduleKey}`}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2 text-[11px]"
                        >
                          <span className="font-mono font-bold text-blue-300">{entry.nodeId}</span>
                          <span className="text-slate-200 font-semibold">{entry.productTitle}</span>
                          {entry.orderId && (
                            <span className="font-mono text-[10px] text-emerald-300 bg-emerald-950/80 border border-emerald-800/70 px-1.5 py-0.2 rounded">
                              {entry.orderId}
                            </span>
                          )}
                          {entry.isExtraSeat && (
                            <span className="text-[10px] text-amber-300 bg-amber-950/70 border border-amber-800/60 px-1.5 py-0.2 rounded">
                              加購席位
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Table of owned nodes */}
                <div className="space-y-4">
                  <div className="overflow-x-auto border border-slate-800 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-950/80 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">節點編號 (C-碼)</th>
                          <th className="py-2.5 px-3 font-semibold">軌道屬性</th>
                          <th className="py-2.5 px-3 font-semibold">購買產品 / 授權來源</th>
                          <th className="py-2.5 px-3 font-semibold">節點名稱</th>
                          <th className="py-2.5 px-3 font-semibold">父節點 / 安置</th>
                          <th className="py-2.5 px-3 font-semibold">產權狀態</th>
                          <th className="py-2.5 px-3 font-semibold">30天體驗/效期</th>
                          <th className="py-2.5 px-3 font-semibold text-right">累計收益</th>
                          <th className="py-2.5 px-3 font-semibold text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {pagedList.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                              {ownedFilter === 'NEW_PRODUCTS'
                                ? '目前尚未有新購買之產品節點，可於「AI 軟體訂購系統」選購產品後自動同步加入此清冊。'
                                : '尚無符合條件之持有節點。'}
                            </td>
                          </tr>
                        ) : (
                          pagedList.map((node) => {
                            const provenance = entryByNodeId.get(node.nodeId);
                            return (
                              <tr key={node.nodeId} className="hover:bg-slate-800/40 transition-colors">
                                <td className="py-2 px-3 font-bold text-slate-100">
                                  {node.nodeId}
                                </td>
                                <td className="py-2 px-3">
                                  {node.track === 'MONOLINE' ? (
                                    <span className="text-teal-400 font-sans text-[11px]">
                                      {node.softwareTitle ? `單軌 · ${node.softwareTitle}` : '單軌公排 (1)'}
                                    </span>
                                  ) : (
                                    <span className="text-blue-400 font-sans text-[11px]">
                                      {node.softwareTitle ? `雙軌 · ${node.softwareTitle}` : '雙軌分身 (2)'}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-sans">
                                  {provenance ? (
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-emerald-300 font-semibold text-[11px]">
                                          {provenance.productTitle}
                                        </span>
                                        {provenance.orderId && (
                                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                                            {provenance.orderId}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        {provenance.licenseCode}
                                        {typeof provenance.amountNtd === 'number'
                                          ? ` · ${provenance.amountNtd === 0 ? '30天免費開通' : `NT$${provenance.amountNtd}`}`
                                          : ''}
                                      </div>
                                    </div>
                                  ) : node.track === 'MONOLINE' ? (
                                    <span className="text-[11px] text-slate-300">1+1 標配 · 通訊錄 CRM</span>
                                  ) : node.hqPermanentLocked ? (
                                    <span className="text-[11px] text-amber-300">總部創始保護席位</span>
                                  ) : (
                                    <span className="text-[11px] text-slate-300">
                                      {node.softwareTitle ? `新購 · ${node.softwareTitle}` : '1+1 標配 · 活動行銷'}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-sans text-slate-300">
                                  {node.name}
                                </td>
                                <td className="py-2 px-3 text-slate-400">
                                  {node.parentId}{' '}
                                  {node.placementPosition && (
                                    <span className="text-amber-400 font-sans text-[10px] ml-1">
                                      [{node.placementPosition}]
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-sans">
                                  {node.hqPermanentLocked ? (
                                    <span className="text-amber-400 text-[10px] flex items-center gap-1 font-medium">
                                      <Lock className="w-3 h-3" /> 自營永久鎖定
                                    </span>
                                  ) : (
                                    <span className="text-emerald-400 text-[10px] flex items-center gap-1 font-medium">
                                      <Clock className="w-3 h-3" /> 30天體驗活躍
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-slate-400 text-[11px]">
                                  {new Date(node.trialExpiresAt).toLocaleDateString()}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-emerald-400">
                                  {node.totalEarnings.toFixed(1)} 點
                                </td>
                                <td className="py-2 px-3 text-right">
                                  {!scopedMode ? (
                                    <>
                                      <button
                                        onClick={() => onSelectForSettlement(node.nodeId)}
                                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-sans font-medium mr-2"
                                      >
                                        清算
                                      </button>
                                      <button
                                        onClick={() => onNavigateToTree(node.nodeId)}
                                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-sans font-medium"
                                      >
                                        樹狀圖定位 →
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-[11px] text-emerald-400 font-sans">生效中</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
                        <div>
                          共 {list.length} 席節點 (第 {ownedPage} / {totalPages} 頁)
                        </div>
                        <div className="flex items-center gap-1 font-mono">
                          <button
                            disabled={ownedPage <= 1}
                            onClick={() => setOwnedPage((p) => Math.max(1, p - 1))}
                            className="px-2.5 py-1 bg-slate-800 disabled:opacity-40 rounded"
                          >
                            上一頁
                          </button>
                          <span className="px-2">
                            {ownedPage} / {totalPages}
                          </span>
                          <button
                            disabled={ownedPage >= totalPages}
                            onClick={() => setOwnedPage((p) => Math.min(totalPages, p + 1))}
                            className="px-2.5 py-1 bg-slate-800 disabled:opacity-40 rounded"
                          >
                            下一頁
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
            );
          })()}

          {/* TAB 2: BINARY DOWNLINE SUBTREE */}
          {activeTab === 'binary_downline' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <GitFork className="w-4 h-4 text-blue-400" />
                    <span>雙軌傘下二元安置組織全貌</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    以該會員之雙軌分身節點 <code className="text-blue-300 font-mono">{report.binaryDownline.rootNodeId}</code> 為頂層根，分析左右二區傘下所有節點。
                  </p>
                </div>
                <div className="text-xs font-mono text-slate-300 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  傘下總席次: <strong className="text-blue-400">{report.binaryDownline.totalDownlineCount}</strong> 席
                </div>
              </div>

              {/* Left vs Right Leg Balance KPI Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Leg Box */}
                <div className="bg-slate-950 p-5 rounded-xl border border-emerald-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      左區安置團隊 (Left Leg)
                    </span>
                    <span className="font-mono text-sm text-emerald-300 font-bold">
                      {report.binaryDownline.leftLegNodes.length} 席
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    左子樹頂點節點：
                    <span className="font-mono text-slate-200 ml-1">
                      {report.binaryDownline.leftLegNodes[0]?.nodeId || '（尚為空缺）'}
                    </span>
                  </p>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
                    {report.binaryDownline.leftLegNodes.map((n) => (
                      <div
                        key={n.nodeId}
                        className="bg-slate-900/80 p-2 rounded flex items-center justify-between text-[11px]"
                      >
                        <span className="text-slate-200 font-bold">{n.nodeId}</span>
                        <span className="font-sans text-slate-400">{n.name.substring(0, 8)}</span>
                        <span className="text-slate-500">D:{n.depth}</span>
                        <span className="text-emerald-400">+{n.totalEarnings.toFixed(1)}點</span>
                      </div>
                    ))}
                    {report.binaryDownline.leftLegNodes.length === 0 && (
                      <div className="text-slate-500 text-xs py-4 text-center font-sans">
                        左區尚無安置節點
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Leg Box */}
                <div className="bg-slate-950 p-5 rounded-xl border border-blue-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                      右區安置團隊 (Right Leg)
                    </span>
                    <span className="font-mono text-sm text-blue-300 font-bold">
                      {report.binaryDownline.rightLegNodes.length} 席
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    右子樹頂點節點：
                    <span className="font-mono text-slate-200 ml-1">
                      {report.binaryDownline.rightLegNodes[0]?.nodeId || '（尚為空缺）'}
                    </span>
                  </p>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
                    {report.binaryDownline.rightLegNodes.map((n) => (
                      <div
                        key={n.nodeId}
                        className="bg-slate-900/80 p-2 rounded flex items-center justify-between text-[11px]"
                      >
                        <span className="text-slate-200 font-bold">{n.nodeId}</span>
                        <span className="font-sans text-slate-400">{n.name.substring(0, 8)}</span>
                        <span className="text-slate-500">D:{n.depth}</span>
                        <span className="text-blue-400">+{n.totalEarnings.toFixed(1)}點</span>
                      </div>
                    ))}
                    {report.binaryDownline.rightLegNodes.length === 0 && (
                      <div className="text-slate-500 text-xs py-4 text-center font-sans">
                        右區尚無安置節點
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MONOLINE AID LINEAGE */}
          {activeTab === 'monoline_aid' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-teal-400" />
                    <span>單軌 15 代公排互助隊列關係</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    當前節點：<code className="text-teal-300 font-mono">{report.monolineAid.nodeId}</code>。展示向上 15 代受惠前席與向下 15 代後續互助席次。
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upstream 15 Nodes */}
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    向上 15 代前席互助鏈 (我繳費時受惠之上線)
                  </h4>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 font-mono text-xs">
                    {report.monolineAid.upstream15Nodes.map((n, idx) => (
                      <div
                        key={n.nodeId}
                        className="bg-slate-900 p-2 rounded flex items-center justify-between text-[11px]"
                      >
                        <span className="text-slate-500 font-sans">前 {idx + 1} 代</span>
                        <span className="text-teal-300 font-bold">{n.nodeId}</span>
                        <span className="font-sans text-slate-300">{n.name.substring(0, 8)}</span>
                        <span className="text-emerald-400">+1.0 點/期</span>
                      </div>
                    ))}
                    {report.monolineAid.upstream15Nodes.length === 0 && (
                      <div className="text-slate-500 text-xs py-6 text-center font-sans">
                        此為單軌創始頂層節點，無上層前席
                      </div>
                    )}
                  </div>
                </div>

                {/* Downstream 15 Nodes */}
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                    向下 15 代公排互助隊列 (續約時回饋我 1.0 點之下席)
                  </h4>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 font-mono text-xs">
                    {report.monolineAid.downstream15Nodes.map((n, idx) => (
                      <div
                        key={n.nodeId}
                        className="bg-slate-900 p-2 rounded flex items-center justify-between text-[11px]"
                      >
                        <span className="text-slate-500 font-sans">後 {idx + 1} 席</span>
                        <span className="text-teal-300 font-bold">{n.nodeId}</span>
                        <span className="font-sans text-slate-300">{n.name.substring(0, 8)}</span>
                        <span className="text-teal-400">回饋 1.0 點</span>
                      </div>
                    ))}
                    {report.monolineAid.downstream15Nodes.length === 0 && (
                      <div className="text-slate-500 text-xs py-6 text-center font-sans">
                        後續尚無新入會之公排節點
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: 15-GENERATION DOWNSTREAM DIRECT REFERRAL MATRIX */}
          {activeTab === 'fifteen_gen' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              {/* Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>向下直推 15 代各代人數與 15 代總人數 (15-Gen Direct Downline Matrix)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    查詢會員 <span className="font-mono text-indigo-300 font-bold">{report.member.mid}</span> 傘下向下延伸直推推薦 1~15 代之各代人數、會員名單及每月 15% (1.0 點/人) 閉環推薦分紅潛力。
                  </p>
                </div>
                
                {/* Fast Simulator Action (Hidden in scopedMode) */}
                {!scopedMode && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSeedChain(5)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-sans text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm"
                      title="為此會員自動依序建立 5 代直推下線測試鏈 (Gen 1 -> Gen 2 -> Gen 3 -> Gen 4 -> Gen 5)"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>一鍵模擬延伸 5 代直推鏈</span>
                    </button>
                    <button
                      onClick={() => handleSeedChain(10)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 font-sans text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 border border-slate-700"
                      title="為此會員自動依序建立 10 代直推下線測試鏈"
                    >
                      <span>延伸 10 代</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 4 KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-indigo-900/40">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>15 代直推總人數</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-indigo-300 mt-1 tabular-nums">
                    {report.downstream15Gen.total15GenCount.toLocaleString()} <span className="text-xs font-normal text-slate-400">人</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    涵蓋第 1 代至第 15 代全員
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-emerald-900/40">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>15 代每月推薦分紅預估</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-400 mt-1 tabular-nums">
                    +{report.downstream15Gen.totalPotentialMonthlyBonus.toFixed(1)} <span className="text-xs font-normal text-slate-400">點/月</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    依 1.0 點/人/期 (100元續約時)
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-purple-900/40">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                    <span>第 1 代親推人數</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-purple-300 mt-1 tabular-nums">
                    {report.downstream15Gen.generations[0]?.count || 0} <span className="text-xs font-normal text-slate-400">人</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    親自直接引薦核心團隊
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-blue-900/40">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                    <span>組織活躍最深代數</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-blue-300 mt-1 tabular-nums">
                    第 {report.downstream15Gen.maxActiveGeneration} 代 <span className="text-xs font-normal text-slate-400">/ 15 代</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    深度裂變穿透層級
                  </div>
                </div>
              </div>

              {/* Visual Distribution Bar */}
              {report.downstream15Gen.total15GenCount > 0 && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">15 代組織世代分佈佔比圖 (Generation Distribution)</span>
                    <span className="font-mono text-slate-300">總計 100% ({report.downstream15Gen.total15GenCount} 人)</span>
                  </div>
                  <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden flex">
                    {report.downstream15Gen.generations.map((g) => {
                      if (g.count === 0) return null;
                      const pct = (g.count / report.downstream15Gen.total15GenCount) * 100;
                      const colors = [
                        'bg-purple-500', 'bg-indigo-500', 'bg-blue-500', 'bg-cyan-500',
                        'bg-teal-500', 'bg-emerald-500', 'bg-green-500', 'bg-lime-500',
                        'bg-amber-500', 'bg-orange-500', 'bg-red-500', 'bg-pink-500',
                        'bg-rose-500', 'bg-fuchsia-500', 'bg-violet-500'
                      ];
                      return (
                        <div
                          key={g.generation}
                          style={{ width: `${pct}%` }}
                          className={`${colors[(g.generation - 1) % colors.length]} h-full transition-all duration-300 hover:opacity-80 cursor-pointer`}
                          title={`第 ${g.generation} 代: ${g.count} 人 (${pct.toFixed(1)}%)`}
                          onClick={() => setExpandedGen(expandedGen === g.generation ? null : g.generation)}
                        />
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 pt-1">
                    {report.downstream15Gen.generations.filter(g => g.count > 0).map(g => (
                      <span key={g.generation} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                        <span>第 {g.generation} 代: <strong className="font-mono text-slate-200">{g.count}人</strong> ({((g.count / report.downstream15Gen.total15GenCount) * 100).toFixed(1)}%)</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 15 Generations Structured Table */}
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold">直推代數 (Generation)</th>
                      <th className="py-3 px-4 font-semibold">該代人數 (Count)</th>
                      <th className="py-3 px-4 font-semibold">組織人數比例</th>
                      <th className="py-3 px-4 font-semibold">直推分紅規則</th>
                      <th className="py-3 px-4 font-semibold">每月分紅小計</th>
                      <th className="py-3 px-4 font-semibold">該代會員代表名單</th>
                      <th className="py-3 px-4 font-semibold text-right">明細</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {report.downstream15Gen.generations.map((gen) => {
                      const isExpanded = expandedGen === gen.generation;
                      const hasMembers = gen.count > 0;
                      const pct = report.downstream15Gen.total15GenCount > 0 
                        ? ((gen.count / report.downstream15Gen.total15GenCount) * 100).toFixed(1)
                        : '0.0';

                      return (
                        <React.Fragment key={gen.generation}>
                          <tr 
                            className={`transition-colors ${
                              hasMembers ? 'hover:bg-slate-800/40 bg-slate-900/30' : 'opacity-60 bg-slate-950/20'
                            }`}
                          >
                            <td className="py-3 px-4 font-bold text-slate-200 flex items-center gap-2">
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                                hasMembers ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'
                              }`}>
                                {gen.generation}
                              </span>
                              <span>第 {gen.generation} 代 {gen.generation === 1 ? '(親推直屬)' : ''}</span>
                            </td>

                            <td className="py-3 px-4 font-bold">
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                hasMembers ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800' : 'text-slate-600'
                              }`}>
                                {gen.count} 人
                              </span>
                            </td>

                            <td className="py-3 px-4 text-slate-400 font-sans">
                              {hasMembers ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }}></div>
                                  </div>
                                  <span className="text-[11px] font-mono text-slate-300">{pct}%</span>
                                </div>
                              ) : (
                                <span className="text-slate-600 font-mono">0.0%</span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-slate-400 font-sans text-[11px]">
                              1.0 點 / 人 / 期 (15% 閉環)
                            </td>

                            <td className="py-3 px-4 font-bold">
                              <span className={hasMembers ? 'text-emerald-400' : 'text-slate-600'}>
                                +{gen.potentialMonthlyBonus.toFixed(1)} 點
                              </span>
                            </td>

                            <td className="py-3 px-4 font-sans text-xs">
                              {hasMembers ? (
                                <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                                  {gen.members.slice(0, 3).map((m) => (
                                    <button
                                      key={m.mid}
                                      onClick={() => {
                                        setQuery(m.mid);
                                        handleSearch(m.mid);
                                      }}
                                      className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-mono text-[11px] cursor-pointer"
                                      title={`點擊查詢 ${m.name} (${m.mid})`}
                                    >
                                      {m.name.substring(0, 4)} ({m.mid})
                                    </button>
                                  ))}
                                  {gen.members.length > 3 && (
                                    <span className="text-slate-500 text-[11px]">+{gen.members.length - 3} 位...</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-600 text-[11px]">尚無成員</span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              {hasMembers ? (
                                <button
                                  onClick={() => setExpandedGen(isExpanded ? null : gen.generation)}
                                  className="text-xs text-indigo-400 hover:text-indigo-300 font-sans font-medium cursor-pointer"
                                >
                                  {isExpanded ? '收合 ▲' : '展開名單 ▼'}
                                </button>
                              ) : (
                                <span className="text-slate-600 text-xs">-</span>
                              )}
                            </td>
                          </tr>

                          {/* Expanded Member Drawer */}
                          {isExpanded && hasMembers && (
                            <tr>
                              <td colSpan={7} className="p-4 bg-slate-950 border-t border-b border-indigo-900/40">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                                      <Users className="w-3.5 h-3.5" />
                                      第 {gen.generation} 代全部成員名冊 ({gen.members.length} 位)
                                    </span>
                                    <span className="text-[11px] text-slate-400 font-sans">
                                      點擊任意會員即可切換查閱其名下所有節點與組織
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {gen.members.map((m) => (
                                      <div
                                        key={m.mid}
                                        className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg flex flex-col justify-between hover:border-indigo-700 transition-colors"
                                      >
                                        <div>
                                          <div className="flex items-center justify-between">
                                            <span className="font-mono font-bold text-slate-100 text-xs">{m.mid}</span>
                                            <span className="text-xs font-sans text-slate-300 font-medium">{m.name}</span>
                                          </div>
                                          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
                                            <span>單軌: <span className="text-teal-400">{m.monolineNodeId}</span></span>
                                            <span>雙軌: <span className="text-blue-400">{m.binaryNodeId}</span></span>
                                          </div>
                                          <div className="text-[10px] text-slate-500 mt-1 font-mono">
                                            直屬推薦人: <span className="text-purple-300">{m.sponsorMid}</span>
                                          </div>
                                        </div>

                                        <button
                                          onClick={() => {
                                            setQuery(m.mid);
                                            handleSearch(m.mid);
                                          }}
                                          className="mt-2.5 w-full py-1 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded text-[11px] font-sans transition-colors cursor-pointer text-center"
                                        >
                                          查閱該會員所有節點 →
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  {/* Table Footer with Total 15-Gen Sum */}
                  <tfoot className="bg-slate-950 font-mono text-xs border-t-2 border-indigo-500/40 font-bold">
                    <tr>
                      <td className="py-3 px-4 text-indigo-300">
                        15 代總計 (Total 15 Generations)
                      </td>
                      <td className="py-3 px-4 text-indigo-300 text-sm">
                        {report.downstream15Gen.total15GenCount} 人
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        100.0%
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-sans text-[11px]">
                        每人 1.0 點 / 期
                      </td>
                      <td className="py-3 px-4 text-emerald-400 text-sm">
                        +{report.downstream15Gen.totalPotentialMonthlyBonus.toFixed(1)} 點/月
                      </td>
                      <td colSpan={2} className="py-3 px-4 text-right font-sans text-slate-400 text-[11px]">
                        15 代推薦分紅閉環佔比 15.0%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Closed-Loop Settlement Verification Note */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>100% 閉環財務結算演算法驗證 (Zero Sunk Funds)</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    每期 100 元月租續約時：15 代直推分紅 15.0 點 + 15 代雙軌安置 15.0 點 + 6 代店鋪 6.0 點 + 6 代中心 6.0 點 + 艾邦妮科技池 30.0 點 + 總公司營運 28.0 點 = 嚴格 100.0 點。
                  </p>
                </div>
                <div className="text-right whitespace-nowrap">
                  <span className="font-mono text-emerald-400 font-bold text-sm">
                    當前 15 代月分紅潛力: {report.downstream15Gen.totalPotentialMonthlyBonus.toFixed(1)} 點
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: DIRECT REFERRALS (GEN 1) */}
          {activeTab === 'referrals' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span>親自直推推薦會員與 1+1 雙節點網絡</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    由會員 <span className="font-mono text-indigo-300 font-bold">{report.member.mid}</span> 親推之所有第一代直屬會員。
                  </p>
                </div>
                <div className="text-xs font-mono text-purple-300 bg-purple-950/60 px-3 py-1.5 rounded-lg border border-purple-800">
                  直推總人數: {report.referrals.directReferralMembers.length} 人
                </div>
              </div>

              {report.referrals.directReferralMembers.length > 0 ? (
                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">直推會員 MID</th>
                        <th className="py-2.5 px-3 font-semibold">會員姓名</th>
                        <th className="py-2.5 px-3 font-semibold">第1組單軌節點 (C-碼)</th>
                        <th className="py-2.5 px-3 font-semibold">第2組雙軌節點 (C-碼)</th>
                        <th className="py-2.5 px-3 font-semibold">入會時間</th>
                        <th className="py-2.5 px-3 font-semibold text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {report.referrals.directReferralMembers.map((m) => (
                        <tr key={m.mid} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2 px-3 font-bold text-slate-200">
                            {m.mid}
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-300">
                            {m.name}
                          </td>
                          <td className="py-2 px-3 text-teal-400">
                            {m.monolineNodeId}
                          </td>
                          <td className="py-2 px-3 text-blue-400">
                            {m.binaryNodeId}
                          </td>
                          <td className="py-2 px-3 text-slate-400 text-[11px]">
                            {new Date(m.registeredAt).toLocaleDateString()}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => {
                                setQuery(m.mid);
                                handleSearch(m.mid);
                              }}
                              className="text-xs text-indigo-400 hover:text-indigo-300 font-sans font-medium"
                            >
                              展開該會員所有結點 →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-slate-500 text-xs py-8 text-center bg-slate-950/40 rounded-lg border border-slate-800">
                  此會員目前尚未親自直推新會員。您可前往「1+1 雙發分流」將此會員 MID（{report.member.mid}）作為推薦人進行新進會員註冊。
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500 text-xs">
          請在上方搜尋列輸入會員 MID (例：A-00001, A-00001113) 或節點代號 (例：C-00001, C-25000001) 進行查詢。
        </div>
      )}
    </div>
  );
};
