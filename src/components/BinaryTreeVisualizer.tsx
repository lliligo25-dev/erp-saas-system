/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { erpEngine, GLOBAL_BOUNDARIES } from '../services/erpEngine';
import { NodeRecord } from '../types/erp';
import { 
  GitFork, 
  Search, 
  Home, 
  ChevronRight, 
  Lock, 
  Clock, 
  DollarSign, 
  ArrowDownLeft, 
  ArrowDownRight,
  Sparkles,
  Info
} from 'lucide-react';

interface BinaryTreeVisualizerProps {
  initialFocusId?: string;
  onSelectForSettlement: (nodeId: string) => void;
}

export const BinaryTreeVisualizer: React.FC<BinaryTreeVisualizerProps> = ({
  initialFocusId,
  onSelectForSettlement,
}) => {
  const [currentRootId, setCurrentRootId] = useState<string>(
    initialFocusId || GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<NodeRecord | null>(null);
  const [maxDepth, setMaxDepth] = useState<number>(3); // 呈現層數 (0~3 層 = 4 層節點)
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (initialFocusId) {
      setCurrentRootId(initialFocusId);
      const found = erpEngine.getBinaryNodeById(initialFocusId);
      if (found) setSelectedNode(found);
    }
  }, [initialFocusId]);

  // 取得當前樹結構
  const treeData = erpEngine.getBinarySubtree(currentRootId, maxDepth);

  // 搜尋處理
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const res = erpEngine.findMemberByMidOrNode(searchQuery.trim());
    if (res.binaryNode) {
      setSearchError(null);
      setCurrentRootId(res.binaryNode.nodeId);
      setSelectedNode(res.binaryNode);
    } else {
      setSearchError(`未找到節點或會員：${searchQuery}`);
    }
  };

  // 取得從定海神針到 currentRootId 的路徑麵包屑
  const getBreadcrumbs = (): string[] => {
    const crumbs: string[] = [];
    let cur: string | undefined = currentRootId;
    const biNodes = erpEngine.getAllBinaryNodes();
    const biMap = new Map(biNodes.map((n) => [n.nodeId, n]));

    while (cur && cur !== 'SYSTEM_ROOT' && cur !== 'HQ_ROOT') {
      crumbs.unshift(cur);
      const node = biMap.get(cur);
      cur = node ? node.parentId : undefined;
      if (crumbs.length > 20) break; // 防環保護
    }
    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  // 遞迴渲染節點元件
  const renderTreeNode = (node: any, level: number = 0) => {
    if (!node) return null;

    const isCurrentFocus = node.nodeId === currentRootId;
    const isSelected = selectedNode?.nodeId === node.nodeId;
    const isRootAnchor = node.nodeId === GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID;
    const isHQPool = node.type === 'BINARY_HQ_POOL';

    return (
      <div key={node.nodeId} className="flex flex-col items-center">
        {/* Node Box */}
        <div
          onClick={() => setSelectedNode(node)}
          className={`relative cursor-pointer transition-all duration-150 rounded-lg p-3 w-56 text-left border ${
            isSelected
              ? 'bg-indigo-950/80 border-indigo-400 ring-2 ring-indigo-500/50 shadow-lg'
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
              {isHQPool && <Lock className="w-3 h-3 text-amber-400" />}
              {isRootAnchor && <Sparkles className="w-3 h-3 text-amber-300" />}
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

          {/* Quick Drilldown Button */}
          {!isCurrentFocus && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentRootId(node.nodeId);
              }}
              className="mt-2 w-full py-1 text-[10px] text-center text-slate-400 hover:text-indigo-300 bg-slate-950/70 rounded border border-slate-800 cursor-pointer"
            >
              設為視角頂點 ↓
            </button>
          )}
        </div>

        {/* Children Connection Lines & Subtrees */}
        {node.children && node.children.length > 0 && (
          <div className="mt-4 flex flex-col items-center">
            {/* Vertical stem down */}
            <div className="w-px h-4 bg-slate-700"></div>

            {/* Subtree row */}
            <div className="flex items-start justify-center gap-8 relative pt-2">
              {node.children.map((child: any) => (
                <div key={child.nodeId} className="relative">
                  {renderTreeNode(child, level + 1)}
                </div>
              ))}

              {/* If one child is missing, show open slot indicator */}
              {node.children.length === 1 && (
                <div className="flex flex-col items-center">
                  <div className="w-56 p-3 rounded-lg border border-dashed border-slate-700 bg-slate-950/40 text-center text-slate-500 text-xs">
                    <div className="text-[11px] font-mono text-emerald-400">
                      BFS 下一優先空位
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {node.leftChildId ? 'R 右區待補' : 'L 左區待補'}
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

  return (
    <div className="space-y-6">
      {/* Title & Control Strip */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <GitFork className="w-5 h-5 text-indigo-400" />
              <span>雙軌二元樹安置視覺化 (Binary Tree Explorer)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              以 <code className="text-amber-300 font-mono">C-25000001</code> 為定海神針頂點，公司自營 63 席（C-25000001 ~ C-25000063）永久鎖定不得轉讓，對外自 A-00064（C-25000064）起經由 BFS 智慧滑落排入二元樹。
            </p>
          </div>

          {/* Search box & Depth Selector */}
          <div className="flex items-center gap-3">
            <form onSubmit={handleSearch} className="relative flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="搜尋節點 C-碼 或 A-碼..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (searchError) setSearchError(null);
                  }}
                  className="w-56 bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              </div>
              {searchError && (
                <span className="text-[11px] text-rose-400">{searchError}</span>
              )}
            </form>

            <select
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value={2}>顯示 2 層</option>
              <option value={3}>顯示 3 層</option>
              <option value={4}>顯示 4 層</option>
            </select>

            <button
              onClick={() => {
                setCurrentRootId(GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID);
                setSelectedNode(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>回到定海神針</span>
            </button>
          </div>
        </div>

        {/* Breadcrumb path */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-xs overflow-x-auto text-slate-400 font-mono">
          <span className="text-slate-500 font-sans">視角路徑：</span>
          {breadcrumbs.map((cid, idx) => (
            <React.Fragment key={cid}>
              {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
              <button
                onClick={() => setCurrentRootId(cid)}
                className={`hover:text-indigo-300 cursor-pointer whitespace-nowrap ${
                  cid === currentRootId ? 'text-indigo-400 font-bold' : ''
                }`}
              >
                {cid}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Main Visual Canvas & Details Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tree Canvas */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-xl p-8 overflow-x-auto min-h-[520px] flex justify-center items-start">
          {treeData ? (
            renderTreeNode(treeData, 0)
          ) : (
            <div className="text-slate-500 text-sm mt-20">查無此節點資料</div>
          )}
        </div>

        {/* Right: Selected Node Property Inspector */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-400" />
              <span>節點屬性檢查器</span>
            </h3>
            {selectedNode && (
              <span className="text-xs font-mono text-indigo-300">
                {selectedNode.nodeId}
              </span>
            )}
          </div>

          {selectedNode ? (
            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">節點代號 (C-碼)：</span>
                  <span className="font-mono text-indigo-300 font-bold">
                    {selectedNode.nodeId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">持有會員 MID (A-碼)：</span>
                  <span className="font-mono text-slate-200">
                    {selectedNode.mid}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">名稱：</span>
                  <span className="text-slate-200 font-medium">
                    {selectedNode.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">綁定 AI 軟體：</span>
                  <span className="text-indigo-300 font-semibold">
                    {selectedNode.softwareTitle || (selectedNode.hqPermanentLocked ? '總部自營基準系統' : '雙軌節點')}
                    {selectedNode.softwareKey ? ` (${selectedNode.softwareKey})` : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">產權屬性：</span>
                  <span
                    className={`font-semibold ${
                      selectedNode.hqPermanentLocked
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {selectedNode.hqPermanentLocked
                      ? '總公司自營 (永久鎖定)'
                      : '會員雙軌分身'}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">安置父節點：</span>
                  <span className="text-slate-300">{selectedNode.parentId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">安置區域：</span>
                  <span className="text-blue-300">
                    {selectedNode.placementPosition === 'L'
                      ? '左區 (Left)'
                      : selectedNode.placementPosition === 'R'
                      ? '右區 (Right)'
                      : '定海神針 ROOT'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">左子節點 (Left Child)：</span>
                  <span className="text-slate-300">
                    {selectedNode.leftChildId || '（尚為空缺）'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">右子節點 (Right Child)：</span>
                  <span className="text-slate-300">
                    {selectedNode.rightChildId || '（尚為空缺）'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">雙軌樹深 (Depth)：</span>
                  <span className="text-slate-200">{selectedNode.depth}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">直推推薦人：</span>
                  <span className="text-indigo-300">{selectedNode.sponsorMid}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">累計收益點數：</span>
                  <span className="text-emerald-400 font-bold">
                    {selectedNode.totalEarnings.toFixed(1)} 點
                  </span>
                </div>
              </div>

              {/* Action: Settle 100 NTD on this node */}
              <button
                onClick={() => onSelectForSettlement(selectedNode.nodeId)}
                className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
              >
                <DollarSign className="w-4 h-4" />
                <span>對此節點執行 100 元月租閉環清算</span>
              </button>
            </div>
          ) : (
            <div className="text-slate-500 text-xs py-12 text-center">
              請點擊樹狀圖中的任一節點，檢視其詳細安置關係、推薦鏈與收益資訊。
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
