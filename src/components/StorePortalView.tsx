/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { erpEngine } from '../services/erpEngine';
import { StoreRecord, StoreDetailReport, Member } from '../types/erp';
import {
  Store,
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  MapPin,
  Phone,
  Calendar,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  PlusCircle,
  Search,
  ShieldCheck,
  ArrowRight,
  Layers,
  Sparkles
} from 'lucide-react';

interface StorePortalViewProps {
  initialStoreId?: string;
  scopedMode?: boolean;
  onNavigateToMemberNodes?: (mid: string) => void;
  onNavigateToMemberPortal?: (mid: string) => void;
}

export const StorePortalView: React.FC<StorePortalViewProps> = ({
  initialStoreId = 'S-TAIPEI-01',
  scopedMode = false,
  onNavigateToMemberNodes,
  onNavigateToMemberPortal,
}) => {
  const [currentStoreId, setCurrentStoreId] = useState<string>(initialStoreId);
  const [report, setReport] = useState<StoreDetailReport | null>(
    erpEngine.getStoreDetailReport(initialStoreId) || erpEngine.getStoreDetailReport('S-HQ-01')
  );

  useEffect(() => {
    if (initialStoreId && initialStoreId !== currentStoreId) {
      const updated = erpEngine.getStoreDetailReport(initialStoreId);
      if (updated) {
        setCurrentStoreId(initialStoreId);
        setReport(updated);
      }
    }
  }, [initialStoreId]);

  const [activeTab, setActiveTab] = useState<'downstream' | 'upstream' | 'members' | 'ledger'>('downstream');
  const [loginInput, setLoginInput] = useState('');
  const [isNewStoreModalOpen, setIsNewStoreModalOpen] = useState(false);

  // New store form state
  const [newStoreId, setNewStoreId] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [newManagerMid, setNewManagerMid] = useState('');
  const [newManagerName, setNewManagerName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');

  const allStores = erpEngine.getAllStores();

  const handleSwitchStore = (storeId: string) => {
    const updated = erpEngine.getStoreDetailReport(storeId);
    if (updated) {
      setCurrentStoreId(storeId);
      setReport(updated);
    } else {
      alert(`找不到店號為「${storeId}」之經營店！`);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = loginInput.trim().toUpperCase();
    if (!q) return;

    // Direct store ID lookup or search by manager MID
    let store = erpEngine.getStoreById(q);
    if (!store) {
      store = erpEngine.findStoreByManagerMid(q);
    }
    if (!store) {
      // Case-insensitive search by store name
      store = allStores.find(s => s.name.toLowerCase().includes(loginInput.trim().toLowerCase()));
    }

    if (store) {
      handleSwitchStore(store.storeId);
      setLoginInput('');
    } else {
      alert(`查無此經營店代號、店長 MID 或店名：「${loginInput}」`);
    }
  };

  const handleCreateStore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreId || !newStoreName || !newManagerMid) return;

    try {
      const created = erpEngine.registerNewStore({
        storeId: newStoreId,
        name: newStoreName,
        managerMid: newManagerMid,
        managerName: newManagerName || '加盟店長',
        phone: newPhone || '02-8888-9999',
        address: newAddress || '台灣加盟指定門市',
        parentStoreId: currentStoreId, // 自動以當前登入店為輔導母店！
      });

      alert(`成功輔導加盟成立新經營店：${created.name} (${created.storeId})！\n輔導母店已自動設定為：${report?.store.name} (${currentStoreId})。`);
      setIsNewStoreModalOpen(false);
      handleSwitchStore(currentStoreId); // Refresh current view
    } catch (err: any) {
      alert(`成立經營店失敗：${err.message}`);
    }
  };

  if (!report) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
        載入經營店資料中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Fast Store Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Store className="w-5 h-5 text-emerald-400" />
              <span>經營店登入管理與 6 代輔導店詳細全景</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              依據 100 元月租閉環演算法，每一次會員續約時沿綁定經營店向上追溯 6 代，每代提撥 1.0 點 (6%) 輔導補貼。在此登入掌握該店詳細資料、直轄綁定會員與 6 代輔導子店網絡。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsNewStoreModalOpen(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-sans text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>加盟成立新輔導店</span>
            </button>
          </div>
        </div>

        {/* Quick Store Switcher Chips & Login Search (Hidden in scopedMode) */}
        {!scopedMode && (
          <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400 text-[11px]">快速登入切換：</span>
              {allStores.map((s) => (
                <button
                  key={s.storeId}
                  onClick={() => handleSwitchStore(s.storeId)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-xs cursor-pointer transition-colors ${
                    s.storeId === currentStoreId
                      ? 'bg-emerald-600 text-white font-bold shadow-sm'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                  title={`${s.name} (店長: ${s.managerName})`}
                >
                  {s.storeId}
                </button>
              ))}
            </div>

            {/* Login Form */}
            <form onSubmit={handleLoginSubmit} className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="輸入店號 (如 S-TAIPEI-01) 或店長 MID..."
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-3 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 w-64 font-mono"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg font-medium cursor-pointer transition-colors"
              >
                登入切換
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Store Detailed Profile Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 border border-emerald-900/50 rounded-xl p-6 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono text-xs font-bold border border-emerald-800">
                {report.store.storeId}
              </span>
              <h3 className="text-xl font-bold text-slate-100">{report.store.name}</h3>
              <span className="text-[11px] font-sans px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/60">
                營運中 (ACTIVE)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span>負責店長：</span>
                <strong className="text-slate-200 font-medium">{report.store.managerName}</strong>
                {!scopedMode && onNavigateToMemberNodes ? (
                  <button
                    onClick={() => onNavigateToMemberNodes(report.store.managerMid)}
                    className="font-mono text-indigo-300 hover:text-indigo-200 underline ml-1 cursor-pointer"
                    title="點擊查閱店長個人節點報告"
                  >
                    ({report.store.managerMid})
                  </button>
                ) : (
                  <span className="font-mono text-slate-400 ml-1">({report.store.managerMid})</span>
                )}
              </span>

              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-400" />
                <span>營業電話：</span>
                <span className="font-mono text-slate-200">{report.store.phone}</span>
              </span>

              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>加盟成立：</span>
                <span className="font-mono text-slate-200">
                  {new Date(report.store.establishedAt).toLocaleDateString()}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-1">
              <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>門市地址：</span>
              <span className="text-slate-300">{report.store.address}</span>
            </div>
          </div>

          {/* Upstream Mentor Store Tag */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 lg:w-72 shrink-0">
            <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
              <span>直屬輔導母店 (Parent Store)</span>
              <span className="text-[10px] text-emerald-400">向上第 1 代</span>
            </div>
            <div className="mt-1.5">
              {report.upstreamStores.length > 0 ? (
                <div>
                  <div className="font-mono text-sm font-bold text-slate-200">
                    {report.upstreamStores[0].storeId}
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    {report.upstreamStores[0].name}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    店長: {report.upstreamStores[0].managerName} ({report.upstreamStores[0].managerMid})
                  </div>
                </div>
              ) : (
                <div className="text-xs text-amber-400 font-medium py-1">
                  總部示範創始旗艦店 (無上層輔導店)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4 Core Financial & Mentoring KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-950/80 p-4 rounded-xl border border-emerald-900/40">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>累積 6 代輔導補貼點數</span>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400 mt-1 tabular-nums">
              {report.store.totalSubsidyPoints.toLocaleString()} <span className="text-xs font-normal text-slate-400">點 (NTD)</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              可提領餘額: ${report.store.balance.toLocaleString()} 點
            </div>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-xl border border-indigo-900/40">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>下轄 6 代輔導經營店數</span>
            </div>
            <div className="text-2xl font-black font-mono text-indigo-300 mt-1 tabular-nums">
              {report.totalMentoredStoresCount} <span className="text-xs font-normal text-slate-400">間門市</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              第 1 代直屬輔導 {report.downstreamGenerations[0]?.count || 0} 間
            </div>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-xl border border-blue-900/40">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>6 代輔導總會員數</span>
            </div>
            <div className="text-2xl font-black font-mono text-blue-300 mt-1 tabular-nums">
              {report.totalDownlineMembersCount.toLocaleString()} <span className="text-xs font-normal text-slate-400">人</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              本店直屬綁定 {report.boundMembers.length} 人
            </div>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-xl border border-amber-900/40">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              <span>預估每月輔導被動收益</span>
            </div>
            <div className="text-2xl font-black font-mono text-amber-300 mt-1 tabular-nums">
              +{report.estimatedMonthlySubsidy.toFixed(1)} <span className="text-xs font-normal text-slate-400">點/月</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              依 1.0 點/人/期 (6% 閉環全額撥發)
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('downstream')}
          className={`px-4 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'downstream'
              ? 'bg-emerald-600 text-white font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>向下 6 代輔導經營店矩陣 ({report.totalMentoredStoresCount} 間)</span>
        </button>

        <button
          onClick={() => setActiveTab('upstream')}
          className={`px-4 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'upstream'
              ? 'bg-indigo-600 text-white font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>向上 6 代輔導母店追溯鏈 ({report.upstreamStores.length} 代)</span>
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'members'
              ? 'bg-blue-600 text-white font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>本店直屬綁定會員名冊 ({report.boundMembers.length} 人)</span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`px-4 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'ledger'
              ? 'bg-purple-600 text-white font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>6 代輔導補貼進帳明細</span>
        </button>
      </div>

      {/* TAB 1: DOWNSTREAM 6-GENERATION MENTORING MATRIX */}
      {activeTab === 'downstream' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>向下 6 代輔導經營店矩陣清單 (Downstream 6-Gen Mentoring Network)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                展示由門市 <span className="font-mono text-emerald-300 font-bold">{report.store.name} ({report.store.storeId})</span> 所培育輔導之 1~6 代各代門市、轄下會員與補貼收益。
              </p>
            </div>
            <div className="text-xs font-mono text-emerald-300 bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-800">
              輔導門市總數: {report.totalMentoredStoresCount} 間
            </div>
          </div>

          {/* 6-Gen Table */}
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">輔導代數</th>
                  <th className="py-3 px-4 font-semibold">該代輔導店數</th>
                  <th className="py-3 px-4 font-semibold">該代轄下會員數</th>
                  <th className="py-3 px-4 font-semibold">輔導補貼標準</th>
                  <th className="py-3 px-4 font-semibold">每期輔導收益小計</th>
                  <th className="py-3 px-4 font-semibold">該代輔導經營店名單</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {report.downstreamGenerations.map((gen) => {
                  const hasStores = gen.count > 0;
                  return (
                    <tr
                      key={gen.generation}
                      className={hasStores ? 'bg-slate-900/40 hover:bg-slate-800/40 transition-colors' : 'opacity-60 bg-slate-950/20'}
                    >
                      <td className="py-3 px-4 font-bold text-slate-200 flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                            hasStores ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {gen.generation}
                        </span>
                        <span>
                          第 {gen.generation} 代 {gen.generation === 1 ? '(直屬輔導店)' : ''}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            hasStores
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                              : 'text-slate-600'
                          }`}
                        >
                          {gen.count} 間
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-300">
                        {gen.totalMembersInGen} 人
                      </td>

                      <td className="py-3 px-4 text-slate-400 font-sans text-[11px]">
                        1.0 點 / 人 / 期 (6% 閉環補貼)
                      </td>

                      <td className="py-3 px-4 font-bold text-emerald-400">
                        +{(gen.totalMembersInGen * 1.0).toFixed(1)} 點
                      </td>

                      <td className="py-3 px-4 font-sans text-xs">
                        {hasStores ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {gen.stores.map((s) =>
                              !scopedMode ? (
                                <button
                                  key={s.storeId}
                                  onClick={() => handleSwitchStore(s.storeId)}
                                  className="px-2 py-1 bg-slate-800 hover:bg-emerald-800 hover:text-white text-slate-200 rounded font-mono text-[11px] cursor-pointer transition-colors border border-slate-700"
                                  title={`點擊切換登入至：${s.name} (店長: ${s.managerName})`}
                                >
                                  {s.name} ({s.storeId})
                                </button>
                              ) : (
                                <span
                                  key={s.storeId}
                                  className="px-2 py-1 bg-slate-950 text-slate-300 rounded font-mono text-[11px] border border-slate-800"
                                >
                                  {s.name} ({s.storeId})
                                </span>
                              )
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[11px]">尚無輔導子店</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-950 font-mono text-xs border-t-2 border-emerald-500/40 font-bold">
                <tr>
                  <td className="py-3 px-4 text-emerald-300">6 代總計 (Total 6 Generations)</td>
                  <td className="py-3 px-4 text-emerald-300 text-sm">{report.totalMentoredStoresCount} 間</td>
                  <td className="py-3 px-4 text-slate-200">{report.totalDownlineMembersCount} 人</td>
                  <td className="py-3 px-4 text-slate-400 font-sans text-[11px]">每代 1.0 點 (共6.0點/6%)</td>
                  <td className="py-3 px-4 text-emerald-400 text-sm">+{report.estimatedMonthlySubsidy.toFixed(1)} 點/月</td>
                  <td className="py-3 px-4 text-right font-sans text-slate-400 text-[11px]">
                    嚴格閉環 100% 平帳
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Quick Mentoring Tip */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-start gap-3 text-xs text-slate-400">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-200 font-semibold">6 代經營店輔導補貼運作機制：</span>
              <p className="mt-0.5 leading-relaxed">
                只要在您 6 代輔導經營店轄下的任何會員進行每月 100 元月租續約，系統自動依閉環清算撥發 1.0 點至您的經營店帳戶。透過持續培育優質門市店長，可創造穩定的連鎖被動輔導收益。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: UPSTREAM MENTORING CHAIN */}
      {activeTab === 'upstream' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="pb-4 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <span>向上 6 代輔導母店追溯鏈 (Upstream Mentoring Store Chain)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              當本店轄下會員進行 100 元月租續約時，系統沿此輔導母店鏈向上追溯 6 代，每代母店固定撥發 1.0 點輔導補貼。
            </p>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {report.upstreamStores.map((store, idx) => (
              <div
                key={store.storeId}
                className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center justify-center font-bold text-xs">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-100 font-bold text-sm">{store.name}</span>
                      <span className="text-emerald-400 font-mono text-xs">({store.storeId})</span>
                    </div>
                    <div className="text-slate-400 font-sans text-xs mt-0.5">
                      店長: {store.managerName} · 門市地址: {store.address}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-emerald-400 font-bold">+1.0 點 / 期</div>
                    <div className="text-[10px] text-slate-500 font-sans">向上第 {idx + 1} 代輔導補貼</div>
                  </div>
                  {!scopedMode && (
                    <button
                      onClick={() => handleSwitchStore(store.storeId)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-sans cursor-pointer transition-colors"
                    >
                      切換登入 →
                    </button>
                  )}
                </div>
              </div>
            ))}

            {report.upstreamStores.length === 0 && (
              <div className="text-slate-500 text-xs py-8 text-center bg-slate-950/40 rounded-lg border border-slate-800 font-sans">
                此經營店為總公司旗艦示範店，無上層輔導母店。
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DIRECT BOUND MEMBERS */}
      {activeTab === 'members' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span>本店直轄綁定會員名冊 (Direct Bound Members)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                登錄在經營店 <span className="font-mono text-emerald-300 font-bold">{report.store.storeId}</span> 名下的所有會員（入會時核發 1+1 雙發節點）。
              </p>
            </div>
            <div className="text-xs font-mono text-blue-300 bg-blue-950/60 px-3 py-1.5 rounded-lg border border-blue-800">
              直轄綁定會員: {report.boundMembers.length} 人
            </div>
          </div>

          {report.boundMembers.length > 0 ? (
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">會員 MID</th>
                    <th className="py-2.5 px-3 font-semibold">會員姓名</th>
                    <th className="py-2.5 px-3 font-semibold">電話號碼</th>
                    <th className="py-2.5 px-3 font-semibold">第1組單軌 (C-碼)</th>
                    <th className="py-2.5 px-3 font-semibold">第2組雙軌 (C-碼)</th>
                    <th className="py-2.5 px-3 font-semibold">直屬推薦人</th>
                    <th className="py-2.5 px-3 font-semibold">入會時間</th>
                    <th className="py-2.5 px-3 font-semibold text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {report.boundMembers.map((m) => (
                    <tr key={m.mid} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3 font-bold text-slate-200">{m.mid}</td>
                      <td className="py-2 px-3 font-sans text-slate-300">{m.name}</td>
                      <td className="py-2 px-3 text-slate-400">{m.phone}</td>
                      <td className="py-2 px-3 text-teal-400">{m.monolineNodeId}</td>
                      <td className="py-2 px-3 text-blue-400">{m.binaryNodeId}</td>
                      <td className="py-2 px-3 text-purple-300">{m.sponsorMid}</td>
                      <td className="py-2 px-3 text-slate-400 text-[11px]">
                        {new Date(m.registeredAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3 text-right space-x-2">
                        {!scopedMode ? (
                          <>
                            {onNavigateToMemberPortal && (
                              <button
                                onClick={() => onNavigateToMemberPortal(m.mid)}
                                className="text-xs text-sky-400 hover:text-sky-300 font-sans font-medium cursor-pointer"
                              >
                                會員戰情室
                              </button>
                            )}
                            <button
                              onClick={() => onNavigateToMemberNodes && onNavigateToMemberNodes(m.mid)}
                              className="text-xs text-indigo-400 hover:text-indigo-300 font-sans font-medium cursor-pointer"
                            >
                              節點 →
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-emerald-400 font-sans">本店直轄</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-slate-500 text-xs py-8 text-center bg-slate-950/40 rounded-lg border border-slate-800 font-sans">
              目前尚無會員綁定於此經營店。可在新會員註冊時將「經營店 ID」填入「{report.store.storeId}」即可綁定。
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SUBSIDY LEDGER */}
      {activeTab === 'ledger' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="pb-4 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-purple-400" />
              <span>6 代經營店輔導補貼進帳明細 (Subsidy Inflow Ledger)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              每次 100 元月租閉環清算時，若會員屬於此店或其 6 代輔導子店網絡，即刻撥發 1.0 點輔導補貼至此店帳戶。
            </p>
          </div>

          {report.recentSubsidyRecords.length > 0 ? (
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">交易代碼</th>
                    <th className="py-2.5 px-3 font-semibold">付費會員 MID</th>
                    <th className="py-2.5 px-3 font-semibold">付費會員姓名</th>
                    <th className="py-2.5 px-3 font-semibold">所屬門市</th>
                    <th className="py-2.5 px-3 font-semibold">輔導代數</th>
                    <th className="py-2.5 px-3 font-semibold">撥發點數</th>
                    <th className="py-2.5 px-3 font-semibold text-right">結算時間</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {report.recentSubsidyRecords.map((r, idx) => (
                    <tr key={`${r.transactionId}-${idx}`} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3 text-slate-400">{r.transactionId.substring(0, 10)}...</td>
                      <td className="py-2 px-3 font-bold text-indigo-300">{r.fromMemberMid}</td>
                      <td className="py-2 px-3 font-sans text-slate-300">{r.fromMemberName}</td>
                      <td className="py-2 px-3 text-slate-400">{r.fromStoreId}</td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 text-[11px]">
                          第 {r.generation} 代
                        </span>
                      </td>
                      <td className="py-2 px-3 font-bold text-emerald-400">+{r.points.toFixed(1)} 點</td>
                      <td className="py-2 px-3 text-right text-slate-500 text-[11px]">
                        {new Date(r.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-slate-500 text-xs py-8 text-center bg-slate-950/40 rounded-lg border border-slate-800 font-sans">
              尚無清算進帳紀錄。可前往「100% 閉環清算」為此店轄下會員執行月租續約清算以觸發撥發。
            </div>
          )}
        </div>
      )}

      {/* Modal: Register / Mentor New Store */}
      {isNewStoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-slate-100">
                  加盟成立新輔導經營店
                </h3>
              </div>
              <button
                onClick={() => setIsNewStoreModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800">
              輔導母店將自動綁定為：
              <span className="font-mono text-emerald-300 font-bold ml-1">
                {report.store.name} ({currentStoreId})
              </span>
              ，成立後自動納入您的第 1 代直轄輔導店！
            </div>

            <form onSubmit={handleCreateStore} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  經營店代號 (Store ID, 例如 S-TAICHUNG-02)
                </label>
                <input
                  type="text"
                  placeholder="S-XXXX"
                  value={newStoreId}
                  onChange={(e) => setNewStoreId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  門市全名 (Store Name)
                </label>
                <input
                  type="text"
                  placeholder="例如：台中逢甲文華旗艦經營店"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">
                    店長會員 MID
                  </label>
                  <input
                    type="text"
                    placeholder="例如：A-00008"
                    value={newManagerMid}
                    onChange={(e) => setNewManagerMid(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">
                    店長姓名
                  </label>
                  <input
                    type="text"
                    placeholder="例如：張美麗"
                    value={newManagerName}
                    onChange={(e) => setNewManagerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">
                    營業電話
                  </label>
                  <input
                    type="text"
                    placeholder="例如：04-2451-2233"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">
                    營業門市地址
                  </label>
                  <input
                    type="text"
                    placeholder="例如：台中市西屯區文華路 100 號"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewStoreModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-lg cursor-pointer transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm cursor-pointer transition-colors"
                >
                  確認簽約成立經營店
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
