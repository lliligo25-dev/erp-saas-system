/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { erpEngine } from '../services/erpEngine';
import { Member, NodeRecord } from '../types/erp';
import { 
  Search, 
  X, 
  Layers, 
  GitFork, 
  Clock, 
  DollarSign, 
  User, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

interface MemberLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectForSettlement: (nodeId: string) => void;
  onNavigateToTree: (nodeId: string) => void;
  onNavigateToMemberNodes?: (mid: string) => void;
  onNavigateToMemberPortal?: (mid: string) => void;
}

export const MemberLookupModal: React.FC<MemberLookupModalProps> = ({
  isOpen,
  onClose,
  onSelectForSettlement,
  onNavigateToTree,
  onNavigateToMemberNodes,
  onNavigateToMemberPortal,
}) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{
    member?: Member;
    monolineNode?: NodeRecord;
    binaryNode?: NodeRecord;
  } | null>(null);
  const [searched, setSearched] = useState(false);

  if (!isOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const res = erpEngine.findMemberByMidOrNode(query.trim());
    setResult(res);
    setSearched(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-slate-100">
              全網會員與 1+1 雙節點即時速查
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 space-y-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="輸入會員 MID (例：A-00001113) 或節點 C-碼 (例：C-25000001)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
              autoFocus
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              查詢
            </button>
          </form>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>快捷範例：</span>
            <button
              type="button"
              onClick={() => {
                setQuery('A-00001');
                setResult(erpEngine.findMemberByMidOrNode('A-00001'));
                setSearched(true);
              }}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded font-mono text-emerald-300 cursor-pointer"
            >
              A-00001 (首位新會員)
            </button>
            <button
              type="button"
              onClick={() => {
                setQuery('A-00001113');
                setResult(erpEngine.findMemberByMidOrNode('A-00001113'));
                setSearched(true);
              }}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded font-mono text-indigo-300 cursor-pointer"
            >
              A-00001113 (旗艦領袖)
            </button>
            <button
              type="button"
              onClick={() => {
                setQuery('C-25000001');
                setResult(erpEngine.findMemberByMidOrNode('C-25000001'));
                setSearched(true);
              }}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded font-mono text-amber-300 cursor-pointer"
            >
              C-25000001 (雙軌根)
            </button>
          </div>

          {/* Result view */}
          {searched && (
            <div className="space-y-4">
              {result?.member || result?.monolineNode || result?.binaryNode ? (
                <div className="space-y-4">
                  {/* Member Profile */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-indigo-400" />
                        <span className="text-sm font-bold text-slate-100">
                          {result.member?.name || result.monolineNode?.name || result.binaryNode?.name}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-indigo-300 font-bold">
                        {result.member?.mid || result.monolineNode?.mid || result.binaryNode?.mid}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <div className="text-slate-500">推薦人 MID</div>
                        <div className="font-mono text-slate-200 mt-0.5">
                          {result.member?.sponsorMid || result.monolineNode?.sponsorMid || 'HQ_ROOT'}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">所屬經營店</div>
                        <div className="font-mono text-slate-200 mt-0.5">
                          {result.member?.storeId || 'S-TAIPEI-01'}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">所屬教育中心</div>
                        <div className="font-mono text-slate-200 mt-0.5">
                          {result.member?.centerId || 'EDU-GLOBAL-01'}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">零錢池餘額</div>
                        <div className="font-mono text-emerald-400 font-bold mt-0.5">
                          ${result.member?.accumulatedRentAmount || 0} 元
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 mt-3">
                      {result.member && onNavigateToMemberNodes && (
                        <button
                          onClick={() => {
                            onNavigateToMemberNodes(result.member!.mid);
                            onClose();
                          }}
                          className="flex-1 py-2 px-3 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>節點與組織全貌 →</span>
                        </button>
                      )}

                      {result.member && onNavigateToMemberPortal && (
                        <button
                          onClick={() => {
                            onNavigateToMemberPortal(result.member!.mid);
                            onClose();
                          }}
                          className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-700/60 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                        >
                          <User className="w-3.5 h-3.5" />
                          <span>進入會員專屬戰情室 →</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dual Nodes Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Monoline Node */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-teal-900/40 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-teal-400 flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5" />
                          第 1 組 (單軌公排節點)
                        </span>
                        <span className="text-emerald-400 text-[10px]">30天體驗</span>
                      </div>
                      {result.monolineNode ? (
                        <>
                          <div className="text-base font-bold font-mono text-slate-100">
                            {result.monolineNode.nodeId}
                          </div>
                          <div className="text-slate-400 space-y-1 font-mono text-[11px]">
                            <div>安置前席：{result.monolineNode.parentId}</div>
                            <div>排線順位：第 {result.monolineNode.depth} 席</div>
                            <div className="text-emerald-400">
                              累計收益：{result.monolineNode.totalEarnings.toFixed(1)} 點
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              onSelectForSettlement(result.monolineNode!.nodeId);
                              onClose();
                            }}
                            className="w-full mt-2 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded text-xs cursor-pointer transition-colors"
                          >
                            對此單軌節點清算
                          </button>
                        </>
                      ) : (
                        <div className="text-slate-500 py-4">無單軌節點記錄</div>
                      )}
                    </div>

                    {/* Binary Node */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-blue-900/40 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-blue-400 flex items-center gap-1">
                          <GitFork className="w-3.5 h-3.5" />
                          第 2 組 (雙軌卡位分身)
                        </span>
                        <span className="text-emerald-400 text-[10px]">雙軌安置</span>
                      </div>
                      {result.binaryNode ? (
                        <>
                          <div className="text-base font-bold font-mono text-slate-100">
                            {result.binaryNode.nodeId}
                          </div>
                          <div className="text-slate-400 space-y-1 font-mono text-[11px]">
                            <div>父節點：{result.binaryNode.parentId}</div>
                            <div>區域：{result.binaryNode.placementPosition === 'L' ? '左區 (Left)' : '右區 (Right)'}</div>
                            <div>樹深：Depth {result.binaryNode.depth}</div>
                            <div className="text-emerald-400">
                              累計收益：{result.binaryNode.totalEarnings.toFixed(1)} 點
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => {
                                onNavigateToTree(result.binaryNode!.nodeId);
                                onClose();
                              }}
                              className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded text-xs cursor-pointer transition-colors"
                            >
                              樹狀定位
                            </button>
                            <button
                              onClick={() => {
                                onSelectForSettlement(result.binaryNode!.nodeId);
                                onClose();
                              }}
                              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded text-xs cursor-pointer transition-colors"
                            >
                              雙軌清算
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="text-slate-500 py-4">無雙軌節點記錄</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">
                  查無「{query}」對應之會員或節點，請確認編號是否正確。
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
