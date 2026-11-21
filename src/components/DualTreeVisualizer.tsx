/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { erpEngine, GLOBAL_BOUNDARIES } from '../services/erpEngine';
import { NodeRecord, Member } from '../types/erp';
import { 
  GitFork, 
  Layers, 
  Search, 
  Home, 
  ChevronRight, 
  Lock, 
  Clock, 
  DollarSign, 
  Sparkles,
  Info,
  ArrowRight,
  Columns,
  Maximize2,
  Minimize2,
  Users,
  Link2,
  ChevronDown
} from 'lucide-react';

export type TreeMode = 'binary' | 'monoline' | 'dual_split';

interface DualTreeVisualizerProps {
  initialFocusId?: string;
  initialMode?: TreeMode;
  onSelectForSettlement: (nodeId: string) => void;
  onNavigateToMemberNodes?: (mid: string) => void;
  onNavigateToMemberPortal?: (mid: string) => void;
}

export const DualTreeVisualizer: React.FC<DualTreeVisualizerProps> = ({
  initialFocusId,
  initialMode = 'binary',
  onSelectForSettlement,
  onNavigateToMemberNodes,
  onNavigateToMemberPortal,
}) => {
  const [treeMode, setTreeMode] = useState<TreeMode>(initialMode);
  const [currentBinaryRootId, setCurrentBinaryRootId] = useState<string>(
    initialFocusId && initialFocusId.startsWith('C-25') ? initialFocusId : GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID
  );
  const [selectedBinaryNode, setSelectedBinaryNode] = useState<NodeRecord | null>(null);
  const [selectedMonolineNode, setSelectedMonolineNode] = useState<NodeRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [maxBinaryDepth, setMaxBinaryDepth] = useState<number>(3); // 雙軌深度
  const [monolineViewLimit, setMonolineViewLimit] = useState<number>(25); // 單軌顯示數量
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (initialFocusId && initialFocusId.startsWith('C-25')) {
      setCurrentBinaryRootId(initialFocusId);
      const found = erpEngine.getBinaryNodeById(initialFocusId);
      if (found) setSelectedBinaryNode(found);
      setTreeMode('binary');
    }
  }, [initialFocusId]);

  // 取得雙軌樹結構
  const binaryTreeData = erpEngine.getBinarySubtree(currentBinaryRootId, maxBinaryDepth);
  const allMonolineNodes = erpEngine.getAllMonolineNodes().slice().reverse(); // 從第 1 席正向排序 (C-00001, C-00002...)
  const allMembers = erpEngine.getAllMembers();

  // 搜尋處理
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const res = erpEngine.findMemberByMidOrNode(searchQuery.trim());
    if (res.binaryNode) {
      setSearchError(null);
      setCurrentBinaryRootId(res.binaryNode.nodeId);
      setSelectedBinaryNode(res.binaryNode);
      if (res.monolineNode) {
        setSelectedMonolineNode(res.monolineNode);
      }
      setTreeMode('binary');
    } else if (res.monolineNode) {
      setSearchError(null);
      setSelectedMonolineNode(res.monolineNode);
      if (res.binaryNode) {
        setSelectedBinaryNode(res.binaryNode);
      }
      setTreeMode('monoline');
    } else {
      setSearchError(`未找到節點或會員：${searchQuery}`);
    }
  };

  // 取得雙軌從定海神針到當前頂點的麵包屑
  const getBinaryBreadcrumbs = (): string[] => {
    const crumbs: string[] = [];
    let cur: string | undefined = currentBinaryRootId;
    const biNodes = erpEngine.getAllBinaryNodes();
    const biMap = new Map(biNodes.map((n) => [n.nodeId, n]));

    while (cur && cur !== 'SYSTEM_ROOT' && cur !== 'HQ_ROOT') {
      crumbs.unshift(cur);
      const node = biMap.get(cur);
      cur = node ? node.parentId : undefined;
      if (crumbs.length > 20) break;
    }
    return crumbs;
  };

  const breadcrumbs = getBinaryBreadcrumbs();

  // 計算選中單軌節點的向上 15 代前席互助鏈
  const getMonolineUpstream15 = (node: NodeRecord | null): string[] => {
    if (!node) return [];
    const upstream: string[] = [];
    let curParent = node.parentId;
    const monoMap = new Map(erpEngine.getAllMonolineNodes().map((n) => [n.nodeId, n]));

    while (curParent && curParent !== 'HQ_ROOT' && upstream.length < 15) {
      upstream.push(curParent);
      const p = monoMap.get(curParent);
      curParent = p ? p.parentId : 'HQ_ROOT';
    }
    return upstream;
  };

  const monolineUpstreamIds = new Set(getMonolineUpstream15(selectedMonolineNode));

  // 點擊節點時，同步選中另一邊的 1+1 節點
  const handleSelectBinaryNode = (node: NodeRecord) => {
    setSelectedBinaryNode(node);
    const member = allMembers.find((m) => m.mid === node.mid);
    if (member) {
      const counterpart = erpEngine.getAllMonolineNodes().find((n) => n.nodeId === member.monolineNodeId);
      if (counterpart) setSelectedMonolineNode(counterpart);
    }
  };

  const handleSelectMonolineNode = (node: NodeRecord) => {
    setSelectedMonolineNode(node);
    const member = allMembers.find((m) => m.mid === node.mid);
    if (member) {
      const counterpart = erpEngine.getAllBinaryNodes().find((n) => n.nodeId === member.binaryNodeId);
      if (counterpart) setSelectedBinaryNode(counterpart);
    }
  };

  // 遞迴渲染雙軌二元樹節點
  const renderBinaryTreeNode = (node: any, level: number = 0) => {
    if (!node) return null;

    const isCurrentFocus = node.nodeId === currentBinaryRootId;
    const isSelected = selectedBinaryNode?.nodeId === node.nodeId;
    const isRootAnchor = node.nodeId === GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID;
    const isHQPool = node.type === 'BINARY_HQ_POOL';

    // 取得該節點的會員與 1+1 單軌節點
    const member = allMembers.find((m) => m.mid === node.mid);

    return (
      <div key={node.nodeId} className="flex flex-col items-center">
        {/* Node Box */}
        <div
          onClick={() => handleSelectBinaryNode(node)}
          className={`relative cursor-pointer transition-all duration-150 rounded-lg p-3 w-56 text-left border ${
            isSelected
              ? 'bg-indigo-950/90 border-indigo-400 ring-2 ring-indigo-500/50 shadow-lg'
              : isRootAnchor
              ? 'bg-amber-950/40 border-amber-600/80 text-amber-100 hover:border-amber-400'
              : isHQPool
              ? 'bg-slate-900 border-slate-700 hover:border-slate-500 text-slate-200'
              : 'bg-slate-900 border-blue-600/50 hover:border-blue-400 text-blue-100'
          }`}
        >
          {/* Header row */}
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="font-mono font-bold text-xs flex items-center gap-1">
              {node.nodeId}
              {isHQPool && (
                <span title="自營鎖定">
                  <Lock className="w-3 h-3 text-amber-400" />
                </span>
              )}
              {isRootAnchor && (
                <span title="定海神針">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                </span>
              )}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                node.placementPosition === 'L'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : node.placementPosition === 'R'
                  ? 'bg-blue-950 text-blue-300 border border-blue-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}
            >
              {node.placementPosition === 'L'
                ? 'L 左區'
                : node.placementPosition === 'R'
                ? 'R 右區'
                : '定海神針 ROOT'}
            </span>
          </div>

          {/* Member Name */}
          <div className="text-xs font-semibold text-slate-100 truncate">
            {node.memberName || node.name}
          </div>

          {node.softwareTitle && (
            <div className="mt-1">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-950/90 border border-indigo-700/70 text-[10px] font-medium text-indigo-300 truncate max-w-full">
                AI 系統：{node.softwareTitle}
              </span>
            </div>
          )}

          {/* MID / Depth */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 font-mono">
            <span>{node.mid}</span>
            <span>D:{node.depth}</span>
          </div>

          {/* 1+1 Counterpart Badge */}
          {member && member.monolineNodeId && (
            <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-teal-400">
              <span className="flex items-center gap-1">
                <Link2 className="w-2.5 h-2.5" />
                1+1 單軌
              </span>
              <span className="font-mono text-teal-300">{member.monolineNodeId}</span>
            </div>
          )}

          {/* Quick Drilldown Button */}
          {!isCurrentFocus && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentBinaryRootId(node.nodeId);
              }}
              className="mt-2 w-full py-1 text-[10px] text-center text-slate-400 hover:text-indigo-300 bg-slate-950/70 rounded border border-slate-800 cursor-pointer"
            >
              設為二元樹頂點 ↓
            </button>
          )}
        </div>

        {/* Children Connection Lines & Subtrees */}
        {node.children && node.children.length > 0 && (
          <div className="mt-4 flex flex-col items-center">
            {/* Vertical stem down */}
            <div className="w-px h-4 bg-slate-700"></div>

            {/* Subtree row */}
            <div className="flex items-start justify-center gap-6 relative pt-2">
              {node.children.map((child: any) => (
                <div key={child.nodeId} className="relative">
                  {renderBinaryTreeNode(child, level + 1)}
                </div>
              ))}

              {/* If one child is missing, show open slot indicator */}
              {node.children.length === 1 && (
                <div className="flex flex-col items-center">
                  <div className="w-56 p-3 rounded-lg border border-dashed border-emerald-500/50 bg-emerald-950/20 text-center text-emerald-400 text-xs animate-pulse">
                    <div className="text-[11px] font-mono font-bold">
                      BFS 下一優先滑落空位
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {node.leftChildId ? 'R 右區待補 (自動安置)' : 'L 左區待補 (自動安置)'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 渲染單軌時間序列公排樹狀圖 (Monoline Waterfall Tree)
  const renderMonolineWaterfallTree = () => {
    return (
      <div className="flex flex-col items-center space-y-3 py-4 w-full">
        {/* Monoline System Origin Node */}
        <div className="w-72 p-3 bg-slate-900/90 border border-teal-600/80 rounded-lg text-center shadow-md">
          <div className="text-[11px] font-bold text-teal-400 uppercase tracking-wider flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>單軌時間序列公排起點 (HQ_ROOT)</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
            全齡互助公排總源頭 · 先來後到連續排線
          </div>
        </div>

        {/* Sequential nodes */}
        {allMonolineNodes.slice(0, monolineViewLimit).map((node, index) => {
          const isSelected = selectedMonolineNode?.nodeId === node.nodeId;
          const isUpstreamBeneficiary = monolineUpstreamIds.has(node.nodeId);
          const member = allMembers.find((m) => m.mid === node.mid);

          return (
            <React.Fragment key={node.nodeId}>
              {/* Connector stem */}
              <div className="flex flex-col items-center -my-1">
                <div className={`w-0.5 h-5 ${isUpstreamBeneficiary ? 'bg-emerald-400' : 'bg-slate-700'}`}></div>
                <ChevronDown className={`w-3.5 h-3.5 -mt-1.5 ${isUpstreamBeneficiary ? 'text-emerald-400' : 'text-slate-600'}`} />
              </div>

              {/* Monoline Node Box */}
              <div
                onClick={() => handleSelectMonolineNode(node)}
                className={`w-80 p-3.5 rounded-lg border cursor-pointer transition-all text-left relative ${
                  isSelected
                    ? 'bg-teal-950/90 border-teal-400 ring-2 ring-teal-500/50 shadow-lg'
                    : isUpstreamBeneficiary
                    ? 'bg-emerald-950/40 border-emerald-500/80 ring-1 ring-emerald-500/40'
                    : node.hqPermanentLocked
                    ? 'bg-slate-900 border-slate-700 hover:border-slate-500'
                    : 'bg-slate-900 border-slate-800 hover:border-teal-500/60'
                }`}
              >
                {/* Upstream mutual aid badge */}
                {isUpstreamBeneficiary && (
                  <span className="absolute -top-2.5 right-3 px-1.5 py-0.5 text-[9px] font-bold bg-emerald-600 text-white rounded shadow-sm">
                    上層互助受惠席
                  </span>
                )}

                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-teal-300">
                      {node.nodeId}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      (席次 #{index + 1})
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    {node.mid}
                  </span>
                </div>

                <div className="text-xs font-semibold text-slate-200">
                  {node.name}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 font-mono">
                  <span>父節點: {node.parentId}</span>
                  <span className="text-emerald-400">
                    收益: {node.totalEarnings.toFixed(1)} 點
                  </span>
                </div>

                {/* 1+1 Counterpart in Binary Tree */}
                {member && member.binaryNodeId && (
                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Link2 className="w-2.5 h-2.5 text-blue-400" />
                      1+1 雙軌分身
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const bNode = erpEngine.getAllBinaryNodes().find((b) => b.nodeId === member.binaryNodeId);
                        if (bNode) {
                          handleSelectBinaryNode(bNode);
                          setCurrentBinaryRootId(bNode.nodeId);
                          setTreeMode('binary');
                        }
                      }}
                      className="text-blue-300 hover:text-blue-200 font-mono font-medium underline cursor-pointer"
                    >
                      {member.binaryNodeId} →
                    </button>
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}

        {allMonolineNodes.length === 0 && (
          <div className="text-slate-500 text-xs py-8 text-center">
            尚無新會員單軌節點，請前往「1+1 雙發分流」進行首位會員登記！
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Visualizer Top Bar & Multi-Mode Toggle */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <GitFork className="w-5 h-5 text-indigo-400" />
                <span>單軌·雙軌樹狀圖全景視覺化 (Monoline & Binary Tree Visualizer)</span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              單軌公排連續時間序列（先來後到全民互助）與雙軌二元樹（BFS 智慧滑落卡位）之完整樹狀結構拓撲圖。
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
            <button
              onClick={() => setTreeMode('binary')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                treeMode === 'binary'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>雙軌二元樹狀圖</span>
            </button>

            <button
              onClick={() => setTreeMode('monoline')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                treeMode === 'monoline'
                  ? 'bg-teal-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>單軌公排樹狀圖</span>
            </button>

            <button
              onClick={() => setTreeMode('dual_split')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                treeMode === 'dual_split'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>1+1 雙通道對照圖</span>
            </button>
          </div>
        </div>

        {/* Search, Zoom and Filters Toolbar */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search box */}
          <form onSubmit={handleSearch} className="relative flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="搜尋節點 C-碼 或 會員 MID (A-碼)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (searchError) setSearchError(null);
                }}
                className="w-64 bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>
            {searchError && (
              <span className="text-[11px] text-rose-400">{searchError}</span>
            )}
          </form>

          {/* Controls specific to modes */}
          <div className="flex items-center gap-3">
            {treeMode === 'binary' && (
              <>
                <select
                  value={maxBinaryDepth}
                  onChange={(e) => setMaxBinaryDepth(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value={2}>展開 2 層</option>
                  <option value={3}>展開 3 層 (標準)</option>
                  <option value={4}>展開 4 層</option>
                  <option value={5}>展開 5 層</option>
                </select>

                <button
                  onClick={() => {
                    setCurrentBinaryRootId(GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID);
                    setSelectedBinaryNode(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>回到雙軌根 (C-25000001)</span>
                </button>
              </>
            )}

            {treeMode === 'monoline' && (
              <select
                value={monolineViewLimit}
                onChange={(e) => setMonolineViewLimit(Number(e.target.value))}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value={15}>顯示前 15 席</option>
                <option value={25}>顯示前 25 席</option>
                <option value={50}>顯示前 50 席</option>
              </select>
            )}
          </div>
        </div>

        {/* Breadcrumb path for binary tree mode */}
        {treeMode === 'binary' && (
          <div className="mt-3 flex items-center gap-1.5 text-xs overflow-x-auto text-slate-400 font-mono">
            <span className="text-slate-500 font-sans">視角路徑：</span>
            {breadcrumbs.map((cid, idx) => (
              <React.Fragment key={cid}>
                {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
                <button
                  onClick={() => setCurrentBinaryRootId(cid)}
                  className={`hover:text-indigo-300 cursor-pointer whitespace-nowrap ${
                    cid === currentBinaryRootId ? 'text-indigo-400 font-bold' : ''
                  }`}
                >
                  {cid}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Main Canvas Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Tree Container */}
        <div className={`bg-slate-950 border border-slate-800 rounded-xl overflow-hidden min-h-[580px] p-6 flex justify-center items-start ${
          treeMode === 'dual_split' ? 'lg:col-span-8 overflow-x-auto' : 'lg:col-span-8 overflow-x-auto'
        }`}>
          {/* Mode 1: Binary Tree */}
          {treeMode === 'binary' && (
            <div className="w-full flex justify-center py-4">
              {binaryTreeData ? (
                renderBinaryTreeNode(binaryTreeData, 0)
              ) : (
                <div className="text-slate-500 text-sm mt-20">查無此雙軌節點資料</div>
              )}
            </div>
          )}

          {/* Mode 2: Monoline Waterfall Tree */}
          {treeMode === 'monoline' && (
            <div className="w-full flex justify-center">
              {renderMonolineWaterfallTree()}
            </div>
          )}

          {/* Mode 3: Side-by-Side Dual Tree */}
          {treeMode === 'dual_split' && (
            <div className="w-full grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Left Column: Monoline Waterfall */}
              <div className="bg-slate-900/60 border border-teal-900/40 rounded-xl p-4 flex flex-col items-center">
                <div className="w-full pb-2 mb-3 border-b border-teal-900/40 flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />
                    單軌公排樹 (Node 1 - 公排互助)
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    C-00001 起編
                  </span>
                </div>
                <div className="w-full max-h-[520px] overflow-y-auto pr-1">
                  {renderMonolineWaterfallTree()}
                </div>
              </div>

              {/* Right Column: Binary Branching Tree */}
              <div className="bg-slate-900/60 border border-blue-900/40 rounded-xl p-4 flex flex-col items-center">
                <div className="w-full pb-2 mb-3 border-b border-blue-900/40 flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                    <GitFork className="w-4 h-4" />
                    雙軌二元樹 (Node 2 - 卡位分身)
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    根節點: C-25000001
                  </span>
                </div>
                <div className="w-full max-h-[520px] overflow-auto flex justify-center py-2">
                  {binaryTreeData ? renderBinaryTreeNode(binaryTreeData, 0) : null}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Inspector Panel */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-400" />
              <span>樹狀圖節點檢查器</span>
            </h3>
            {(selectedBinaryNode || selectedMonolineNode) && (
              <span className="text-xs font-mono text-indigo-300">
                {(selectedBinaryNode || selectedMonolineNode)?.nodeId}
              </span>
            )}
          </div>

          {selectedBinaryNode || selectedMonolineNode ? (
            <div className="space-y-4 text-xs">
              {/* Active Inspected Node Card */}
              {selectedBinaryNode && (
                <div className="bg-slate-950 p-4 rounded-xl border border-blue-900/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-400 flex items-center gap-1.5">
                      <GitFork className="w-3.5 h-3.5" />
                      雙軌二元樹節點
                    </span>
                    <span className="font-mono text-xs text-indigo-300 font-bold">
                      {selectedBinaryNode.nodeId}
                    </span>
                  </div>

                  <div className="space-y-1 font-mono text-[11px] text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">會員 MID：</span>
                      <span>{selectedBinaryNode.mid}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">姓名：</span>
                      <span className="font-sans font-semibold text-slate-100">
                        {selectedBinaryNode.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">綁定 AI 軟體：</span>
                      <span className="font-sans font-semibold text-indigo-300">
                        {selectedBinaryNode.softwareTitle || (selectedBinaryNode.hqPermanentLocked ? '總部自營基準系統' : '雙軌節點')}
                        {selectedBinaryNode.softwareKey ? ` (${selectedBinaryNode.softwareKey})` : ''}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">雙軌父節點：</span>
                      <span className="text-blue-300">{selectedBinaryNode.parentId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">安置區域：</span>
                      <span className="text-amber-300 font-bold">
                        {selectedBinaryNode.placementPosition === 'L' ? '左區 (Left)' : selectedBinaryNode.placementPosition === 'R' ? '右區 (Right)' : 'ROOT 根節點'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">樹深 (Depth)：</span>
                      <span>第 {selectedBinaryNode.depth} 層</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">累計收益：</span>
                      <span className="text-emerald-400 font-bold">
                        {selectedBinaryNode.totalEarnings.toFixed(1)} 點
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectForSettlement(selectedBinaryNode.nodeId)}
                    className="w-full mt-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded text-xs transition-colors cursor-pointer"
                  >
                    對此雙軌節點執行清算
                  </button>
                </div>
              )}

              {/* Monoline Node Card */}
              {selectedMonolineNode && (
                <div className="bg-slate-950 p-4 rounded-xl border border-teal-900/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-teal-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      單軌公排節點
                    </span>
                    <span className="font-mono text-xs text-teal-300 font-bold">
                      {selectedMonolineNode.nodeId}
                    </span>
                  </div>

                  <div className="space-y-1 font-mono text-[11px] text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">公排序號：</span>
                      <span>第 {selectedMonolineNode.depth} 席</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">前席安置父節點：</span>
                      <span className="text-teal-300">{selectedMonolineNode.parentId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">體驗權益：</span>
                      <span className="text-emerald-400">30天體驗 · 15代公排互助</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">累計收益：</span>
                      <span className="text-emerald-400 font-bold">
                        {selectedMonolineNode.totalEarnings.toFixed(1)} 點
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectForSettlement(selectedMonolineNode.nodeId)}
                    className="w-full mt-2 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded text-xs transition-colors cursor-pointer"
                  >
                    對此單軌節點執行清算
                  </button>
                </div>
              )}

              {/* View all nodes of this member button */}
              {(selectedBinaryNode || selectedMonolineNode) && (
                <div className="space-y-1.5">
                  {onNavigateToMemberNodes && (
                    <button
                      onClick={() => onNavigateToMemberNodes!((selectedBinaryNode || selectedMonolineNode)!.mid)}
                      className="w-full py-2 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/80 text-indigo-200 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                    >
                      <Search className="w-3.5 h-3.5 text-indigo-400" />
                      <span>查詢此會員所有持有節點與傘下二元組織全貌 →</span>
                    </button>
                  )}

                  {onNavigateToMemberPortal && (
                    <button
                      onClick={() => onNavigateToMemberPortal!((selectedBinaryNode || selectedMonolineNode)!.mid)}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                    >
                      <span>進入此會員個人登入戰情室 →</span>
                    </button>
                  )}
                </div>
              )}

              {/* 1+1 Synergy Explanation */}
              <div className="bg-indigo-950/30 border border-indigo-900/50 p-3 rounded-lg text-[11px] text-indigo-200 leading-relaxed">
                <span className="font-semibold text-indigo-300">1+1 雙發互助原理：</span> 
                新會員註冊時自動同步核發 2 組 AI 軟體，第一組進入單軌公排享受時間序列 15 代互助；第二組分身跳入雙軌二元樹，搶先卡位享二元樹無限倍增與 15 代安置排線收益！
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-xs py-16 text-center">
              請點擊樹狀圖中的任一節點，即可即時在此檢視其安置父席、1+1 雙軌分身、推薦鏈與收益資訊。
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
