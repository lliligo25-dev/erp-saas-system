/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { erpEngine, GLOBAL_BOUNDARIES } from '../services/erpEngine';
import { NodeRecord } from '../types/erp';
import { 
  Layers, 
  Search, 
  Lock, 
  Clock, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';

interface MonolineQueueViewProps {
  onSelectNode: (nodeId: string) => void;
  onNavigateToTree?: () => void;
}

export const MonolineQueueView: React.FC<MonolineQueueViewProps> = ({
  onSelectNode,
  onNavigateToTree,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'HQ' | 'MEMBER'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [inspectedNode, setInspectedNode] = useState<NodeRecord | null>(null);

  const allMonoline = erpEngine.getAllMonolineNodes();

  const filteredNodes = allMonoline.filter((n) => {
    if (filter === 'HQ' && !n.hqPermanentLocked) return false;
    if (filter === 'MEMBER' && n.hqPermanentLocked) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toUpperCase();
      return (
        n.nodeId.toUpperCase().includes(q) ||
        n.mid.toUpperCase().includes(q) ||
        n.name.toUpperCase().includes(q)
      );
    }
    return true;
  });

  // 15 代公排互助追溯 (向上 15 代)
  const getUpstream15Generations = (node: NodeRecord): string[] => {
    const upstream: string[] = [];
    let curParent = node.parentId;
    while (curParent && curParent !== 'HQ_ROOT' && upstream.length < 15) {
      upstream.push(curParent);
      const parentNode = erpEngine.getAllMonolineNodes().find((m) => m.nodeId === curParent);
      curParent = parentNode ? parentNode.parentId : 'HQ_ROOT';
    }
    return upstream;
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-teal-400" />
              <span>單軌公排隊列 (Monoline Public Placement Queue)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              單軌編號範圍：<code className="text-teal-300 font-mono">{GLOBAL_BOUNDARIES.MONOLINE_NODE_RANGE}</code>。依入會時間序列嚴格連續排線，安置父節點指標為 <code className="text-teal-300 font-mono">C-(current_id - 1)</code>。
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="搜尋單軌 C-碼 / A-碼..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-56 bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
              <button
                onClick={() => setFilter('ALL')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                  filter === 'ALL'
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                全部 ({allMonoline.length})
              </button>
              <button
                onClick={() => setFilter('HQ')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                  filter === 'HQ'
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                自營鎖定
              </button>
              <button
                onClick={() => setFilter('MEMBER')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                  filter === 'MEMBER'
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                新會員體驗
              </button>
            </div>

            {onNavigateToTree && (
              <button
                onClick={onNavigateToTree}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-300 bg-teal-950/80 border border-teal-700/80 hover:bg-teal-900 rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>切換為單軌樹狀公排圖</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Monoline Table */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950/70 text-slate-400 uppercase border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="py-3 px-4 font-semibold">公排節點 ID (C-碼)</th>
                  <th className="py-3 px-3 font-semibold">持有會員 MID</th>
                  <th className="py-3 px-3 font-semibold">節點名稱</th>
                  <th className="py-3 px-3 font-semibold">前席父節點</th>
                  <th className="py-3 px-3 font-semibold">產權狀態</th>
                  <th className="py-3 px-3 font-semibold">累積收益</th>
                  <th className="py-3 px-3 font-semibold text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredNodes.slice(0, 50).map((n) => (
                  <tr
                    key={n.nodeId}
                    onClick={() => setInspectedNode(n)}
                    className={`hover:bg-slate-800/50 cursor-pointer transition-colors ${
                      inspectedNode?.nodeId === n.nodeId ? 'bg-teal-950/40' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-teal-300">
                      {n.nodeId}
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {n.mid}
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-200">
                      {n.name}
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {n.parentId}
                    </td>
                    <td className="py-3 px-3 font-sans">
                      {n.hqPermanentLocked ? (
                        <span className="text-amber-400 text-[11px] flex items-center gap-1 font-medium">
                          <Lock className="w-3 h-3" /> 自營永久鎖定
                        </span>
                      ) : (
                        <span className="text-emerald-400 text-[11px] flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3" /> 30天體驗公排
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-emerald-400 font-semibold tabular-nums">
                      {n.totalEarnings.toFixed(1)} 點
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectNode(n.nodeId);
                        }}
                        className="text-[11px] text-teal-400 hover:text-teal-300 font-sans font-medium"
                      >
                        清算 →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Inspector: 15-Generation Monoline Mutual Aid Inspector */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-teal-400" />
              <span>單軌 15 代公排互助鏈追溯</span>
            </h3>
          </div>

          {inspectedNode ? (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">當前檢查節點：</span>
                  <span className="font-mono text-teal-300 font-bold">{inspectedNode.nodeId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">持有人：</span>
                  <span className="text-slate-200">{inspectedNode.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">公排序位：</span>
                  <span className="font-mono text-slate-200">第 {inspectedNode.depth} 席</span>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-300 mb-2">
                  向上溯源 15 代前席互助鏈：
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {getUpstream15Generations(inspectedNode).map((pid, idx) => (
                    <div
                      key={pid}
                      className="bg-slate-950/70 border border-slate-800/80 p-2 rounded flex items-center justify-between font-mono text-[11px]"
                    >
                      <span className="text-slate-500 font-sans">前 {idx + 1} 代前席</span>
                      <span className="text-teal-300 font-bold">{pid}</span>
                      <span className="text-emerald-400 font-sans">互助可領 1.0 點</span>
                    </div>
                  ))}
                  {getUpstream15Generations(inspectedNode).length === 0 && (
                    <div className="text-slate-500 text-xs text-center py-4">
                      此為頂層創始節點，無上層前席
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-teal-950/30 border border-teal-900/50 rounded-lg p-3 text-[11px] text-teal-200 leading-relaxed">
                <span className="font-semibold">互助原理：</span> 單軌公排依序排線，每當後方任何會員進行 100 元續約時，將沿前席向上推算 15 代，每代享有 1.0 點時間序列公排互助！
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-xs py-12 text-center">
              請點擊左側任一單軌公排節點，檢視其向上追溯的 15 代前席互助鏈。
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
