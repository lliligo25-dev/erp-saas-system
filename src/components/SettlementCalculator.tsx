/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { erpEngine } from '../services/erpEngine';
import { SettlementBreakdown } from '../types/erp';
import { 
  TrendingUp, 
  CheckCircle2, 
  DollarSign, 
  ShieldCheck, 
  Cpu, 
  Building2, 
  Users, 
  GitFork, 
  Sparkles,
  History,
  Play,
  Calendar,
  Layers,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  GraduationCap
} from 'lucide-react';

interface SettlementCalculatorProps {
  initialNodeId?: string;
  onSettlementExecuted: () => void;
}

export const SettlementCalculator: React.FC<SettlementCalculatorProps> = ({
  initialNodeId,
  onSettlementExecuted,
}) => {
  const binaryNodes = erpEngine.getAllBinaryNodes();
  const defaultNode = initialNodeId || (binaryNodes.length > 0 ? binaryNodes[0].nodeId : 'C-25000001');

  // Mode switcher: 'single' | 'batch'
  const [mode, setMode] = useState<'single' | 'batch'>('single');

  // Single settlement state
  const [selectedNodeId, setSelectedNodeId] = useState(defaultNode);
  const [rentAmount, setRentAmount] = useState<number>(100);
  const [simulateExpired, setSimulateExpired] = useState(false);
  const [currentBreakdown, setCurrentBreakdown] = useState<SettlementBreakdown | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Batch settlement filter state
  const [batchScope, setBatchScope] = useState<'ALL_BINARY' | 'ALL_MONOLINE' | 'EXPIRING' | 'CUSTOM_RANGE' | 'BY_MEMBER'>('ALL_BINARY');
  const [customStartNode, setCustomStartNode] = useState('C-25000001');
  const [customEndNode, setCustomEndNode] = useState('C-25000020');
  const [filterMemberMid, setFilterMemberMid] = useState('A-00001');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [batchRentAmount, setBatchRentAmount] = useState<number>(100);
  const [batchSimulateExpired, setBatchSimulateExpired] = useState(false);

  // Batch execution execution status
  const [isBatchExecuting, setIsBatchExecuting] = useState(false);
  const [batchExecutedMessage, setBatchExecutedMessage] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<{
    successCount: number;
    totalAmountCollected: number;
    totalPointsDistributed: number;
    breakdowns: SettlementBreakdown[];
  } | null>(null);
  const [expandedBreakdownTxn, setExpandedBreakdownTxn] = useState<string | null>(null);

  // Single execution handler
  const handleExecuteSingle = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const node = erpEngine.getAllBinaryNodes().find((b) => b.nodeId === selectedNodeId) ||
                   erpEngine.getAllMonolineNodes().find((m) => m.nodeId === selectedNodeId);
      if (node && simulateExpired) {
        node.trialExpiresAt = new Date(Date.now() - 3600000).toISOString();
      }

      const res = erpEngine.execute100PointsClosedLoopSettlement(selectedNodeId, rentAmount);
      setCurrentBreakdown(res);
      setMessage(`單筆清算成功！流水號：${res.transactionId}，實徵金額：$${res.paidAmount}，平帳驗證：${res.totalDistributed} 點。`);
      onSettlementExecuted();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Compute matching nodes for batch preview
  const matchingBatchNodes = useMemo(() => {
    let candidateNodes: {
      nodeId: string;
      mid: string;
      name: string;
      createdAt: string;
      type: 'MONOLINE' | 'BINARY';
      trialExpiresAt: string;
    }[] = [];

    const allBinary = erpEngine.getAllBinaryNodes().map((b) => {
      const member = erpEngine.getMember(b.mid);
      return {
        nodeId: b.nodeId,
        mid: b.mid,
        name: b.name,
        createdAt: member?.registeredAt || b.lastRenewalAt || b.trialExpiresAt,
        type: 'BINARY' as const,
        trialExpiresAt: b.trialExpiresAt,
      };
    });

    const allMonoline = erpEngine.getAllMonolineNodes().map((m) => {
      const member = erpEngine.getMember(m.mid);
      return {
        nodeId: m.nodeId,
        mid: m.mid,
        name: m.name,
        createdAt: member?.registeredAt || m.lastRenewalAt || m.trialExpiresAt,
        type: 'MONOLINE' as const,
        trialExpiresAt: m.trialExpiresAt,
      };
    });

    if (batchScope === 'ALL_BINARY') {
      candidateNodes = allBinary;
    } else if (batchScope === 'ALL_MONOLINE') {
      candidateNodes = allMonoline;
    } else if (batchScope === 'EXPIRING') {
      const now = Date.now();
      candidateNodes = [...allBinary, ...allMonoline].filter((n) => {
        const exp = new Date(n.trialExpiresAt).getTime();
        return exp <= now + 7 * 86400000;
      });
    } else if (batchScope === 'BY_MEMBER') {
      const qMid = filterMemberMid.trim().toUpperCase();
      candidateNodes = [...allBinary, ...allMonoline].filter(
        (n) => n.mid.toUpperCase() === qMid
      );
    } else if (batchScope === 'CUSTOM_RANGE') {
      const start = customStartNode.trim().toUpperCase();
      const end = customEndNode.trim().toUpperCase();
      const all = [...allBinary, ...allMonoline];
      candidateNodes = all.filter((n) => {
        if (start && end) {
          return n.nodeId >= start && n.nodeId <= end;
        } else if (start) {
          return n.nodeId >= start;
        }
        return true;
      });
    }

    // Date range filter
    if (dateFilter !== 'ALL') {
      const now = Date.now();
      candidateNodes = candidateNodes.filter((n) => {
        const created = new Date(n.createdAt).getTime();
        if (dateFilter === 'LAST_7_DAYS') {
          return now - created <= 7 * 86400000;
        }
        if (dateFilter === 'LAST_30_DAYS') {
          return now - created <= 30 * 86400000;
        }
        if (dateFilter === 'CUSTOM') {
          if (customStartDate && new Date(n.createdAt) < new Date(customStartDate)) return false;
          if (customEndDate && new Date(n.createdAt) > new Date(customEndDate + 'T23:59:59')) return false;
          return true;
        }
        return true;
      });
    }

    // Deduplicate
    const seen = new Set<string>();
    return candidateNodes.filter((n) => {
      if (seen.has(n.nodeId)) return false;
      seen.add(n.nodeId);
      return true;
    });
  }, [
    batchScope,
    customStartNode,
    customEndNode,
    filterMemberMid,
    dateFilter,
    customStartDate,
    customEndDate,
  ]);

  // Batch execution handler
  const handleExecuteBatch = () => {
    if (matchingBatchNodes.length === 0) {
      alert('在目前設定的篩選區間或日期範圍內，未找到任何符合條件的節點！');
      return;
    }

    setIsBatchExecuting(true);
    try {
      const nodeIds = matchingBatchNodes.map((m) => m.nodeId);
      const res = erpEngine.executeBatchSettlement({
        nodeIds,
        rentAmountPerNode: batchRentAmount,
        simulateExpired: batchSimulateExpired,
      });

      setBatchResult(res);
      setBatchExecutedMessage(
        `批次清算成功！共完成 ${res.successCount} 筆節點續約，實收月租金額：$${res.totalAmountCollected.toLocaleString()} 元，100% 閉環平帳撥發：${res.totalPointsDistributed.toLocaleString()} 點。多個帳戶的 15代直推、15代雙軌、6代門市及 6代教育中心分潤已即時計算並同步更新！`
      );
      onSettlementExecuted();
    } catch (err: any) {
      alert(`批次清算失敗：${err.message}`);
    } finally {
      setIsBatchExecuting(false);
    }
  };

  const history = erpEngine.getSettlements();

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <span>100 元月租 100% 全額閉環結算與批次清算中心</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              貨幣與點數 1:1 兌換（1 元 = 1 點）。每滿 100 元立即觸發 1 期全額閉環清算，完美平帳 100.0 點，零資金沉澱！支援『單筆即時清算』與全新『模擬自動批次清算』，一鍵計算並更新多個帳戶的獎勵分潤。
            </p>
          </div>
          <div className="px-3.5 py-1.5 bg-emerald-950/60 border border-emerald-800/80 rounded-lg text-emerald-300 text-xs font-mono font-bold whitespace-nowrap self-start lg:self-auto">
            15 + 15 + 6 + 6 + 30 + 28 = 100.0 點 (100% 閉環)
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center gap-2">
          <button
            onClick={() => setMode('single')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-2 ${
              mode === 'single'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>單筆節點即時清算</span>
          </button>

          <button
            onClick={() => setMode('batch')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-2 ${
              mode === 'batch'
                ? 'bg-gradient-to-r from-emerald-600 to-indigo-600 text-white shadow-sm ring-1 ring-emerald-400/50'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-300" />
            <span>模擬自動批次清算 (區間/日期範圍多帳戶分潤)</span>
          </button>
        </div>
      </div>

      {/* ================= MODE 1: SINGLE SETTLEMENT ================= */}
      {mode === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Input Form */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>發起單筆月租繳費與清算</span>
              </h3>

              <form onSubmit={handleExecuteSingle} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    繳費節點代號 (C-碼)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={selectedNodeId}
                      onChange={(e) => setSelectedNodeId(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500"
                      placeholder="例：C-25000001, C-25000064"
                      required
                    />
                    <select
                      onChange={(e) => setSelectedNodeId(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 text-xs text-slate-300 focus:outline-none cursor-pointer"
                    >
                      <option value="">快速選擇</option>
                      {binaryNodes.slice(0, 10).map((b) => (
                        <option key={b.nodeId} value={b.nodeId}>
                          {b.nodeId} ({b.name.substring(0, 8)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    繳費金額 (NTD / 點數)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setRentAmount(50)}
                      className={`py-2 text-xs font-mono rounded border cursor-pointer ${
                        rentAmount === 50
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      50 元 (存入零錢池)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRentAmount(100)}
                      className={`py-2 text-xs font-mono rounded border cursor-pointer ${
                        rentAmount === 100
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      100 元 (標準備撥)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRentAmount(200)}
                      className={`py-2 text-xs font-mono rounded border cursor-pointer ${
                        rentAmount === 200
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      200 元 (2期連續)
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    若金額未滿 100 元，將先累加至零錢池；累計達 100 元自動觸發平帳結算。
                  </p>
                </div>

                {/* Circuit breaker simulation toggle */}
                <div className="pt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simulateExpired}
                      onChange={(e) => setSimulateExpired(e.target.checked)}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span>模擬該節點未續約 (觸發 50% 熔斷保護，獎金折半其餘進公共安全池)</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>立即執行 100% 閉環全額清算</span>
                </button>
              </form>

              {message && (
                <div className="mt-3 p-2.5 bg-emerald-950/60 border border-emerald-800/80 rounded text-emerald-300 text-xs">
                  {message}
                </div>
              )}
            </div>

            {/* Allocation Ratio Breakdown Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                撥發矩陣權重指標 (Distribution Weights)
              </h3>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400 font-sans">15 代直推分紅</span>
                  <span className="text-slate-200">15.0 點 (15%)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400 font-sans">15 代雙軌安置排線</span>
                  <span className="text-slate-200">15.0 點 (15%)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400 font-sans">6 代經營店輔導補貼</span>
                  <span className="text-slate-200">6.0 點 (6%)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400 font-sans">6 代教育中心培訓補貼</span>
                  <span className="text-cyan-300">6.0 點 (6%)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400 font-sans">艾邦妮科技有限公司科技池</span>
                  <span className="text-purple-300">30.0 點 (30%)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400 font-sans">總公司營運行政管理池</span>
                  <span className="text-amber-300">28.0 點 (28%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Live Settlement Breakdown & Waterflow */}
          <div className="lg:col-span-7 space-y-6">
            {currentBreakdown ? (
              <div className="bg-slate-900 border border-emerald-500/40 rounded-xl p-6 space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>清算流水帳單 (TXN 成功)</span>
                    </div>
                    <div className="text-xs font-mono text-slate-400 mt-1">
                      {currentBreakdown.transactionId} · {currentBreakdown.nodeId}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-bold font-mono text-emerald-300">
                      {currentBreakdown.totalDistributed.toFixed(1)} / 100.0 點
                    </div>
                    <div className="text-[11px] text-emerald-400 font-medium">
                      完美平帳 · 0 資金沉澱
                    </div>
                  </div>
                </div>

                {/* Waterflow visualization */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-300">
                    各分潤水流明細撥發：
                  </div>

                  {/* 15 Gen Sponsor */}
                  <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-indigo-400 flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        15 代直推推薦分紅 (向上 15 代)
                      </span>
                      <span className="font-mono text-indigo-300 font-bold">
                        {currentBreakdown.totalSponsorPoints.toFixed(1)} 點
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5 text-[10px] font-mono text-center">
                      {currentBreakdown.sponsorBonuses.slice(0, 10).map((b) => (
                        <div
                          key={b.generation}
                          className={`p-1 rounded ${
                            b.status === 'CIRCUIT_BREAKER_HALF'
                              ? 'bg-rose-950 text-rose-300'
                              : 'bg-slate-900 text-slate-300'
                          }`}
                        >
                          G{b.generation}: +{b.points}點
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 15 Gen Placement */}
                  <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-blue-400 flex items-center gap-1.5">
                        <GitFork className="w-4 h-4" />
                        15 代雙軌安置排線分紅 (向上二元樹父節點)
                      </span>
                      <span className="font-mono text-blue-300 font-bold">
                        {currentBreakdown.totalPlacementPoints.toFixed(1)} 點
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5 text-[10px] font-mono text-center">
                      {currentBreakdown.placementBonuses.slice(0, 10).map((b) => (
                        <div
                          key={b.generation}
                          className={`p-1 rounded ${
                            b.status === 'CIRCUIT_BREAKER_HALF'
                              ? 'bg-rose-950 text-rose-300'
                              : 'bg-slate-900 text-slate-300'
                          }`}
                        >
                          P{b.generation}: +{b.points}點
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stores & Centers */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <div className="text-[11px] text-slate-400">6 代經營店輔導補貼</div>
                      <div className="text-sm font-bold font-mono text-teal-300 mt-1">
                        {currentBreakdown.totalStorePoints.toFixed(1)} 點
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <div className="text-[11px] text-slate-400">6 代教育中心培訓補貼</div>
                      <div className="text-sm font-bold font-mono text-cyan-300 mt-1">
                        {currentBreakdown.totalCenterPoints.toFixed(1)} 點
                      </div>
                    </div>
                  </div>

                  {/* Corporate & Safety Pools */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <div className="text-[11px] text-purple-400 flex items-center gap-1">
                        <Cpu className="w-3 h-3" /> 艾邦妮科技 (30%)
                      </div>
                      <div className="text-sm font-bold font-mono text-purple-300 mt-1">
                        {currentBreakdown.abanyTechPoolPoints.toFixed(1)} 點
                      </div>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <div className="text-[11px] text-amber-400 flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> 總公司營運 (28%)
                      </div>
                      <div className="text-sm font-bold font-mono text-amber-300 mt-1">
                        {currentBreakdown.hqOperationsPoolPoints.toFixed(1)} 點
                      </div>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <div className="text-[11px] text-rose-400 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> 公共安全池 (熔斷)
                      </div>
                      <div className="text-sm font-bold font-mono text-rose-300 mt-1">
                        {currentBreakdown.publicSafetyPoolPoints.toFixed(1)} 點
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs">
                點擊左側「立即執行 100% 閉環全額清算」，即時觀測 15代直推 + 15代雙軌安置 + 6代門市 + 6代中心 + 艾邦妮科技 + 總公司營運池之完美平帳撥發流向。
              </div>
            )}

            {/* Historical Settlements Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-400" />
                  <span>最近月租清算歷史 (平帳稽核日誌)</span>
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  共 {history.length} 筆清算記錄
                </span>
              </div>

              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950/70 text-slate-400 uppercase border-b border-slate-800 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">交易流水號</th>
                      <th className="py-2.5 px-3 font-semibold">繳費節點</th>
                      <th className="py-2.5 px-3 font-semibold">實收金額</th>
                      <th className="py-2.5 px-3 font-semibold">直推分紅</th>
                      <th className="py-2.5 px-3 font-semibold">雙軌安置</th>
                      <th className="py-2.5 px-3 font-semibold">平帳驗證</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {history.map((h) => (
                      <tr
                        key={h.transactionId}
                        onClick={() => setCurrentBreakdown(h)}
                        className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                      >
                        <td className="py-2 px-4 text-slate-300">
                          {h.transactionId}
                        </td>
                        <td className="py-2 px-3 text-indigo-400 font-bold">
                          {h.nodeId}
                        </td>
                        <td className="py-2 px-3 text-slate-200">
                          ${h.paidAmount}
                        </td>
                        <td className="py-2 px-3 text-indigo-300">
                          {h.totalSponsorPoints.toFixed(1)} 點
                        </td>
                        <td className="py-2 px-3 text-blue-300">
                          {h.totalPlacementPoints.toFixed(1)} 點
                        </td>
                        <td className="py-2 px-3 text-emerald-400 font-bold">
                          {h.totalDistributed.toFixed(1)} 點 (平帳)
                        </td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500 font-sans">
                          尚未有清算記錄，請點擊上方按鈕發起第一筆清算
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODE 2: SIMULATE AUTOMATED BATCH SETTLEMENT ================= */}
      {mode === 'batch' && (
        <div className="space-y-6">
          {/* Filter Configuration Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  <span>批次清算條件篩選 (節點區間與日期範圍配置)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  設定要進行月租清算的節點範圍與日期條件，系統將一次性計算並更新多個帳戶的獎勵分潤。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">符合目標節點數：</span>
                <span className="text-base font-bold font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-800">
                  {matchingBatchNodes.length} 席
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Node Scope */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  1. 選擇節點篩選策略 (Node Scope)
                </label>
                <select
                  value={batchScope}
                  onChange={(e) => setBatchScope(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="ALL_BINARY">全網雙軌二元樹節點 (C-25000001 起)</option>
                  <option value="ALL_MONOLINE">全網單軌公排節點 (C-00001 起)</option>
                  <option value="EXPIRING">即將到期/已逾期 30 天節點</option>
                  <option value="CUSTOM_RANGE">自訂節點代號 C-碼區間</option>
                  <option value="BY_MEMBER">指定特定會員 MID 的所有節點</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  {batchScope === 'ALL_BINARY' && '自動選取全網所有雙軌樹節點進行批次月租續約。'}
                  {batchScope === 'ALL_MONOLINE' && '自動選取全網單軌公排長鏈上之節點。'}
                  {batchScope === 'EXPIRING' && '選取 7 天內即將到期或已逾期之體驗期節點。'}
                  {batchScope === 'CUSTOM_RANGE' && '輸入起訖 C-碼區間，自訂特定批次。'}
                  {batchScope === 'BY_MEMBER' && '輸入會員 MID，一次性批次結算該會員所有持股節點。'}
                </p>
              </div>

              {/* 2. Date Range Filter */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  2. 建立日期範圍篩選 (Date Range)
                </label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="ALL">全部日期 (不限建立時間)</option>
                  <option value="LAST_7_DAYS">最近 7 天內入會節點</option>
                  <option value="LAST_30_DAYS">最近 30 天內入會節點</option>
                  <option value="CUSTOM">自訂日期區間 (Start ~ End)</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  結合時間維度精確過濾符合月租續約排程之節點。
                </p>
              </div>

              {/* 3. Rent Amount Per Node */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  3. 單節點續約金額 (NTD / 點數)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBatchRentAmount(100)}
                    className={`py-2 text-xs font-mono rounded border cursor-pointer ${
                      batchRentAmount === 100
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    100 元 (1期標準備撥)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchRentAmount(200)}
                    className={`py-2 text-xs font-mono rounded border cursor-pointer ${
                      batchRentAmount === 200
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    200 元 (2期連續)
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  依 100 元 = 100 點封閉閉環公式平帳發放。
                </p>
              </div>

              {/* 4. Circuit Breaker Simulation */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  4. 逾期熔斷機制模擬
                </label>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={batchSimulateExpired}
                      onChange={(e) => setBatchSimulateExpired(e.target.checked)}
                      className="rounded border-slate-700 text-rose-500 focus:ring-0"
                    />
                    <span className="text-[11px]">模擬整批節點未續約 (50% 熔斷減半)</span>
                  </label>
                </div>
                <p className="text-[11px] text-slate-500">
                  若勾選，所有分紅減半發放，其餘 50% 撥入公共安全基金池。
                </p>
              </div>
            </div>

            {/* Conditional input fields for CUSTOM_RANGE or BY_MEMBER or CUSTOM_DATE */}
            {(batchScope === 'CUSTOM_RANGE' || batchScope === 'BY_MEMBER' || dateFilter === 'CUSTOM') && (
              <div className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {batchScope === 'CUSTOM_RANGE' && (
                  <>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">起始節點代號 (Start C-Code)</label>
                      <input
                        type="text"
                        value={customStartNode}
                        onChange={(e) => setCustomStartNode(e.target.value)}
                        placeholder="例如：C-25000001"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">結束節點代號 (End C-Code)</label>
                      <input
                        type="text"
                        value={customEndNode}
                        onChange={(e) => setCustomEndNode(e.target.value)}
                        placeholder="例如：C-25000020"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </>
                )}

                {batchScope === 'BY_MEMBER' && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">目標會員 MID (A-碼)</label>
                    <input
                      type="text"
                      value={filterMemberMid}
                      onChange={(e) => setFilterMemberMid(e.target.value)}
                      placeholder="例如：A-00001"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                {dateFilter === 'CUSTOM' && (
                  <>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">起始日期</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">結束日期</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Batch Pre-Calculation Financial Forecast Preview */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-900/60 rounded-xl p-6 shadow-md space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>批次清算即時試算預覽 (Batch Pre-Calculation Financial Preview)</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  依當前篩選之 <span className="font-mono text-emerald-300 font-bold">{matchingBatchNodes.length}</span> 個節點，每節點實繳 ${batchRentAmount} 元，預估之 100% 閉環分潤與入帳指標：
                </p>
              </div>

              {/* Execution Action Button */}
              <button
                type="button"
                onClick={handleExecuteBatch}
                disabled={isBatchExecuting || matchingBatchNodes.length === 0}
                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                {isBatchExecuting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>批次演算法清算中...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>⚡ 一鍵啟動自動批次清算 (更新多個帳戶分潤)</span>
                  </>
                )}
              </button>
            </div>

            {/* 6 Metric Breakdown Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
              <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                <div className="text-[11px] text-slate-400 font-sans">預計實收月租</div>
                <div className="text-lg font-bold text-emerald-300 mt-1 tabular-nums">
                  ${(matchingBatchNodes.length * batchRentAmount).toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                  共 {matchingBatchNodes.length} 筆續約
                </div>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                <div className="text-[11px] text-indigo-400 font-sans flex items-center gap-1">
                  <Users className="w-3 h-3" /> 15代直推推薦
                </div>
                <div className="text-lg font-bold text-indigo-300 mt-1 tabular-nums">
                  {(matchingBatchNodes.length * (batchRentAmount * 0.15)).toLocaleString()} 點
                </div>
                <div className="text-[10px] text-slate-500 font-sans mt-0.5">每代 1.0 點 (15%)</div>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                <div className="text-[11px] text-blue-400 font-sans flex items-center gap-1">
                  <GitFork className="w-3 h-3" /> 15代雙軌安置
                </div>
                <div className="text-lg font-bold text-blue-300 mt-1 tabular-nums">
                  {(matchingBatchNodes.length * (batchRentAmount * 0.15)).toLocaleString()} 點
                </div>
                <div className="text-[10px] text-slate-500 font-sans mt-0.5">每代 1.0 點 (15%)</div>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                <div className="text-[11px] text-teal-400 font-sans flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> 6代經營店輔導
                </div>
                <div className="text-lg font-bold text-teal-300 mt-1 tabular-nums">
                  {(matchingBatchNodes.length * (batchRentAmount * 0.06)).toLocaleString()} 點
                </div>
                <div className="text-[10px] text-slate-500 font-sans mt-0.5">每代 1.0 點 (6%)</div>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                <div className="text-[11px] text-cyan-400 font-sans flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" /> 6代教育中心
                </div>
                <div className="text-lg font-bold text-cyan-300 mt-1 tabular-nums">
                  {(matchingBatchNodes.length * (batchRentAmount * 0.06)).toLocaleString()} 點
                </div>
                <div className="text-[10px] text-slate-500 font-sans mt-0.5">每代 1.0 點 (6%)</div>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                <div className="text-[11px] text-purple-400 font-sans flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> 科技+營運池
                </div>
                <div className="text-lg font-bold text-purple-300 mt-1 tabular-nums">
                  {(matchingBatchNodes.length * (batchRentAmount * 0.58)).toLocaleString()} 點
                </div>
                <div className="text-[10px] text-slate-500 font-sans mt-0.5">30% 研發 + 28% 行政</div>
              </div>
            </div>

            {/* Validation banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  平帳檢驗：(15% + 15% + 6% + 6% + 30% + 28%) = 100% · 無沉澱零資金沈澱！
                </span>
              </div>
              <div className="font-mono text-emerald-400 font-bold text-right">
                預計撥發總點數 = ${(matchingBatchNodes.length * batchRentAmount).toLocaleString()} 點
              </div>
            </div>
          </div>

          {/* Batch Execution Success Notification Banner */}
          {batchExecutedMessage && (
            <div className="p-4 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-xs text-emerald-200 flex items-start gap-3 shadow-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-sm text-emerald-100">批次清算任務執行完畢！</div>
                <p className="leading-relaxed">{batchExecutedMessage}</p>
              </div>
            </div>
          )}

          {/* Detailed Batch Execution Results Report */}
          {batchResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-400" />
                    <span>本次自動批次清算執行流水帳單 (共 {batchResult.successCount} 筆)</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    點擊任一清算節點，可即時展開該筆交易向上追溯之 15代直推、15代雙軌、6代門市與 6代教育中心之分潤流向。
                  </p>
                </div>
                <div className="font-mono text-xs text-emerald-400 font-bold">
                  實收: ${batchResult.totalAmountCollected.toLocaleString()} · 撥發: {batchResult.totalPointsDistributed.toLocaleString()} 點
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">交易代號</th>
                      <th className="py-2.5 px-3">清算節點 (C-碼)</th>
                      <th className="py-2.5 px-3">實繳金額</th>
                      <th className="py-2.5 px-3">15代直推</th>
                      <th className="py-2.5 px-3">15代雙軌</th>
                      <th className="py-2.5 px-3">6代門市</th>
                      <th className="py-2.5 px-3">6代中心</th>
                      <th className="py-2.5 px-3">科技+營運</th>
                      <th className="py-2.5 px-3 text-right">平帳驗證</th>
                      <th className="py-2.5 px-3 text-center">明細</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {batchResult.breakdowns.map((b, idx) => {
                      const isExpanded = expandedBreakdownTxn === b.transactionId;
                      return (
                        <React.Fragment key={b.transactionId}>
                          <tr
                            onClick={() =>
                              setExpandedBreakdownTxn(isExpanded ? null : b.transactionId)
                            }
                            className={`cursor-pointer transition-colors ${
                              isExpanded ? 'bg-slate-800/80' : 'hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="py-2 px-3 text-slate-500">{idx + 1}</td>
                            <td className="py-2 px-3 text-slate-400">
                              {b.transactionId.substring(0, 10)}...
                            </td>
                            <td className="py-2 px-3 font-bold text-indigo-300">{b.nodeId}</td>
                            <td className="py-2 px-3 text-slate-200">${b.paidAmount}</td>
                            <td className="py-2 px-3 text-indigo-400">
                              +{b.totalSponsorPoints.toFixed(1)}
                            </td>
                            <td className="py-2 px-3 text-blue-400">
                              +{b.totalPlacementPoints.toFixed(1)}
                            </td>
                            <td className="py-2 px-3 text-teal-400">
                              +{b.totalStorePoints.toFixed(1)}
                            </td>
                            <td className="py-2 px-3 text-cyan-400">
                              +{b.totalCenterPoints.toFixed(1)}
                            </td>
                            <td className="py-2 px-3 text-purple-300">
                              +{(b.abanyTechPoolPoints + b.hqOperationsPoolPoints).toFixed(1)}
                            </td>
                            <td className="py-2 px-3 text-right text-emerald-400 font-bold">
                              {b.totalDistributed.toFixed(1)} 點
                            </td>
                            <td className="py-2 px-3 text-center text-slate-400">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 inline text-emerald-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 inline" />
                              )}
                            </td>
                          </tr>

                          {/* Expanded detail row */}
                          {isExpanded && (
                            <tr className="bg-slate-950">
                              <td colSpan={11} className="p-4 space-y-3 font-sans">
                                <div className="text-xs font-bold text-slate-200 flex items-center justify-between border-b border-slate-800 pb-2">
                                  <span>
                                    節點 <strong className="font-mono text-indigo-300">{b.nodeId}</strong> 月租續約完整 100% 閉環水流
                                  </span>
                                  <span className="font-mono text-emerald-400">
                                    交易號: {b.transactionId}
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
                                  {/* 15 gen sponsor preview */}
                                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800 space-y-1">
                                    <div className="font-sans text-[11px] text-indigo-400 font-semibold">
                                      15 代直推分紅 (共 {b.totalSponsorPoints.toFixed(1)} 點)
                                    </div>
                                    <div className="text-[10px] text-slate-400 line-clamp-3">
                                      {b.sponsorBonuses.map(s => `G${s.generation}:${s.targetMid}(+${s.points})`).join(', ')}
                                    </div>
                                  </div>

                                  {/* 15 gen placement preview */}
                                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800 space-y-1">
                                    <div className="font-sans text-[11px] text-blue-400 font-semibold">
                                      15 代雙軌安置 (共 {b.totalPlacementPoints.toFixed(1)} 點)
                                    </div>
                                    <div className="text-[10px] text-slate-400 line-clamp-3">
                                      {b.placementBonuses.map(p => `P${p.generation}:${p.targetNodeId}(+${p.points})`).join(', ')}
                                    </div>
                                  </div>

                                  {/* 6 gen store & center preview */}
                                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800 space-y-1">
                                    <div className="font-sans text-[11px] text-teal-400 font-semibold">
                                      6 代輔導店 & 6 代教育中心
                                    </div>
                                    <div className="text-[10px] text-slate-300">
                                      門市補貼: +{b.totalStorePoints.toFixed(1)} 點 · 中心補貼: +{b.totalCenterPoints.toFixed(1)} 點
                                    </div>
                                  </div>

                                  {/* Pools */}
                                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800 space-y-1">
                                    <div className="font-sans text-[11px] text-purple-400 font-semibold">
                                      科技 (30%) + 營運 (28%)
                                    </div>
                                    <div className="text-[10px] text-slate-300">
                                      艾邦妮: +{b.abanyTechPoolPoints.toFixed(1)} 點 · 總公司: +{b.hqOperationsPoolPoints.toFixed(1)} 點
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* List of nodes currently matching the filter */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>符合目前篩選條件之節點清單 (Matching Nodes List, 共 {matchingBatchNodes.length} 席)</span>
              </h4>
              <span className="text-xs text-slate-400 font-mono">
                策略: {batchScope} · 日期: {dateFilter}
              </span>
            </div>

            {matchingBatchNodes.length > 0 ? (
              <div className="overflow-x-auto max-h-60 border border-slate-800 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">節點代號 (C-碼)</th>
                      <th className="py-2 px-3">所屬會員 MID</th>
                      <th className="py-2 px-3">姓名</th>
                      <th className="py-2 px-3">節點類型</th>
                      <th className="py-2 px-3">入會時間</th>
                      <th className="py-2 px-3">體驗期到期日</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {matchingBatchNodes.slice(0, 30).map((n) => (
                      <tr key={n.nodeId} className="hover:bg-slate-800/40">
                        <td className="py-1.5 px-3 font-bold text-indigo-300">{n.nodeId}</td>
                        <td className="py-1.5 px-3 text-slate-300">{n.mid}</td>
                        <td className="py-1.5 px-3 font-sans text-slate-400">{n.name}</td>
                        <td className="py-1.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              n.type === 'BINARY'
                                ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                : 'bg-teal-950 text-teal-300 border border-teal-800'
                            }`}
                          >
                            {n.type === 'BINARY' ? '雙軌樹' : '單軌公排'}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-slate-400 text-[11px]">
                          {new Date(n.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-1.5 px-3 text-amber-400 text-[11px]">
                          {new Date(n.trialExpiresAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-500 font-sans">
                無符合此篩選條件之節點。請調整左上方篩選策略或日期範圍。
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
