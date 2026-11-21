/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { erpEngine } from '../services/erpEngine';
import { EducationCenterRecord, CenterDetailReport } from '../types/erp';
import {
  GraduationCap,
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  MapPin,
  Phone,
  Calendar,
  CheckCircle2,
  PlusCircle,
  Search,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface CenterPortalViewProps {
  initialCenterId?: string;
  scopedMode?: boolean;
  onNavigateToMemberNodes?: (mid: string) => void;
  onNavigateToMemberPortal?: (mid: string) => void;
}

export const CenterPortalView: React.FC<CenterPortalViewProps> = ({
  initialCenterId = 'EDU-TAIPEI-01',
  scopedMode = false,
  onNavigateToMemberNodes,
  onNavigateToMemberPortal,
}) => {
  const [currentCenterId, setCurrentCenterId] = useState<string>(initialCenterId);
  const [report, setReport] = useState<CenterDetailReport | null>(
    erpEngine.getCenterDetailReport(initialCenterId) || erpEngine.getCenterDetailReport('EDU-HQ-01')
  );

  useEffect(() => {
    if (initialCenterId && initialCenterId !== currentCenterId) {
      const updated = erpEngine.getCenterDetailReport(initialCenterId);
      if (updated) {
        setCurrentCenterId(initialCenterId);
        setReport(updated);
      }
    }
  }, [initialCenterId]);

  const [activeTab, setActiveTab] = useState<'downstream' | 'upstream' | 'members' | 'ledger'>('downstream');
  const [loginInput, setLoginInput] = useState('');
  const [isNewCenterModalOpen, setIsNewCenterModalOpen] = useState(false);

  // New center form state
  const [newCenterId, setNewCenterId] = useState('');
  const [newCenterName, setNewCenterName] = useState('');
  const [newDirectorMid, setNewDirectorMid] = useState('');
  const [newDirectorName, setNewDirectorName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');

  const allCenters = erpEngine.getAllCenters();

  const handleSwitchCenter = (centerId: string) => {
    const updated = erpEngine.getCenterDetailReport(centerId);
    if (updated) {
      setCurrentCenterId(centerId);
      setReport(updated);
    } else {
      alert(`找不到代號為「${centerId}」之教育中心！`);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = loginInput.trim().toUpperCase();
    if (!q) return;

    let center = erpEngine.getCenterById(q);
    if (!center) {
      center = erpEngine.findCenterByDirectorMid(q);
    }
    if (!center) {
      center = allCenters.find(c => c.name.toLowerCase().includes(loginInput.trim().toLowerCase()));
    }

    if (center) {
      handleSwitchCenter(center.centerId);
      setLoginInput('');
    } else {
      alert(`查無此教育中心代號、負責總監 MID 或中心名稱：「${loginInput}」`);
    }
  };

  const handleCreateCenter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCenterId || !newCenterName || !newDirectorMid) return;

    try {
      const created = erpEngine.registerNewCenter({
        centerId: newCenterId,
        name: newCenterName,
        directorMid: newDirectorMid,
        directorName: newDirectorName || '培訓總監',
        phone: newPhone || '02-8888-7777',
        address: newAddress || '台灣培訓教室示範中心',
        parentCenterId: currentCenterId, // 自動以當前中心為培育母中心！
      });

      alert(`成功拓點成立新教育培訓中心：${created.name} (${created.centerId})！\n直屬培育母中心已自動設定為：${report?.center.name} (${currentCenterId})。`);
      setIsNewCenterModalOpen(false);
      handleSwitchCenter(currentCenterId);
    } catch (err: any) {
      alert(`拓點成立教育中心失敗：${err.message}`);
    }
  };

  if (!report) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
        載入教育中心資料中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Fast Center Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-cyan-400" />
              <span>教育中心登入與身分切換中心 (Education Center Portal)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              依據 100 元月租閉環結算演算法，每次會員續約時沿綁定教育中心向上追溯 6 代，每代提撥 1.0 點 (6%) 培訓補貼。在此登入掌握教育中心詳細檔案、直轄學員名冊與 6 代培訓培育體系。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsNewCenterModalOpen(true)}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white font-sans text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>拓點成立新教育中心</span>
            </button>
          </div>
        </div>

        {/* Quick Center Switcher Chips & Login Search (Hidden in scopedMode) */}
        {!scopedMode && (
          <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400 text-[11px]">快速身分切換：</span>
              {allCenters.map((c) => (
                <button
                  key={c.centerId}
                  onClick={() => handleSwitchCenter(c.centerId)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-xs cursor-pointer transition-colors ${
                    c.centerId === currentCenterId
                      ? 'bg-cyan-600 text-white font-bold shadow-sm'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                  title={`${c.name} (負責總監: ${c.directorName})`}
                >
                  {c.centerId}
                </button>
              ))}
            </div>

            {/* Login Form */}
            <form onSubmit={handleLoginSubmit} className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="輸入中心代號 (如 EDU-TAIPEI-01) 或總監 MID..."
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-3 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 w-64 font-mono"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg font-medium cursor-pointer transition-colors"
              >
                身分登入
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Center Detailed Profile Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/30 border border-cyan-900/50 rounded-xl p-6 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono text-xs font-bold border border-cyan-800">
                {report.center.centerId}
              </span>
              <h3 className="text-xl font-bold text-slate-100">{report.center.name}</h3>
              <span className="text-[11px] font-sans px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-700/60">
                營運中 (ACTIVE)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span>中心總監：</span>
                <strong className="text-slate-200 font-medium">{report.center.directorName}</strong>
                {!scopedMode && onNavigateToMemberNodes ? (
                  <button
                    onClick={() => onNavigateToMemberNodes(report.center.directorMid)}
                    className="font-mono text-indigo-300 hover:text-indigo-200 underline ml-1 cursor-pointer"
                    title="點擊查閱中心總監個人節點報告"
                  >
                    ({report.center.directorMid})
                  </button>
                ) : (
                  <span className="font-mono text-slate-400 ml-1">({report.center.directorMid})</span>
                )}
              </span>

              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-400" />
                <span>聯絡電話：</span>
                <span className="font-mono text-slate-200">{report.center.phone}</span>
              </span>

              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>成立時間：</span>
                <span className="font-mono text-slate-200">
                  {new Date(report.center.establishedAt).toLocaleDateString()}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-1">
              <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>教室地址：</span>
              <span className="text-slate-300">{report.center.address}</span>
            </div>
          </div>

          {/* Upstream Mentor Center Tag */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 lg:w-72 shrink-0">
            <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
              <span>直屬培育母中心 (Parent Center)</span>
              <span className="text-[10px] text-cyan-400">向上第 1 代</span>
            </div>
            <div className="mt-1.5">
              {report.upstreamCenters.length > 0 ? (
                <div>
                  <div className="font-mono text-sm font-bold text-slate-200">
                    {report.upstreamCenters[0].centerId}
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    {report.upstreamCenters[0].name}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    總監: {report.upstreamCenters[0].directorName} ({report.upstreamCenters[0].directorMid})
                  </div>
                </div>
              ) : (
                <div className="text-xs text-amber-400 font-medium py-1">
                  總公司全球教育訓練總部 (無上層母中心)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4 Core Financial & Training KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-950/80 p-4 rounded-xl border border-cyan-900/40">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
              <span>累積 6 代培訓補貼點數</span>
            </div>
            <div className="text-2xl font-black font-mono text-cyan-400 mt-1 tabular-nums">
              {report.center.totalSubsidyPoints.toLocaleString()} <span className="text-xs font-normal text-slate-400">點 (NTD)</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              可提領餘額: ${report.center.balance.toLocaleString()} 點
            </div>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-xl border border-indigo-900/40">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>下轄 6 代培訓中心總數</span>
            </div>
            <div className="text-2xl font-black font-mono text-indigo-300 mt-1 tabular-nums">
              {report.totalMentoredCentersCount} <span className="text-xs font-normal text-slate-400">間中心</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              第 1 代直轄培育 {report.downstreamGenerations[0]?.count || 0} 間
            </div>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-xl border border-blue-900/40">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>6 代中心轄下會員/學員</span>
            </div>
            <div className="text-2xl font-black font-mono text-blue-300 mt-1 tabular-nums">
              {report.totalDownlineMembersCount.toLocaleString()} <span className="text-xs font-normal text-slate-400">人</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              本中心直轄綁定 {report.boundMembers.length} 人
            </div>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-xl border border-amber-900/40">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              <span>預估每月培訓被動收益</span>
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
              ? 'bg-cyan-600 text-white font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>向下 6 代培育教育中心矩陣 ({report.totalMentoredCentersCount} 間)</span>
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
          <span>向上 6 代培育母中心追溯鏈 ({report.upstreamCenters.length} 代)</span>
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
          <span>本中心直轄綁定會員名冊 ({report.boundMembers.length} 人)</span>
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
          <span>6 代教育培訓補貼進帳明細</span>
        </button>
      </div>

      {/* TAB 1: DOWNSTREAM 6-GENERATION CENTERS MATRIX */}
      {activeTab === 'downstream' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-cyan-400" />
                <span>向下 6 代培育教育中心矩陣清單 (Downstream 6-Gen Centers Network)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                展示由教育中心 <span className="font-mono text-cyan-300 font-bold">{report.center.name} ({report.center.centerId})</span> 所培育之 1~6 代各代教育中心、轄下學員與培訓分紅。
              </p>
            </div>
            <div className="text-xs font-mono text-cyan-300 bg-cyan-950/60 px-3 py-1.5 rounded-lg border border-cyan-800">
              培育中心總數: {report.totalMentoredCentersCount} 間
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">培育代數</th>
                  <th className="py-3 px-4 font-semibold">該代中心數</th>
                  <th className="py-3 px-4 font-semibold">轄下學員/會員數</th>
                  <th className="py-3 px-4 font-semibold">培訓補貼標準</th>
                  <th className="py-3 px-4 font-semibold">每期培訓收益小計</th>
                  <th className="py-3 px-4 font-semibold">該代教育中心代表名單</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {report.downstreamGenerations.map((gen) => {
                  const hasCenters = gen.count > 0;
                  return (
                    <tr
                      key={gen.generation}
                      className={hasCenters ? 'bg-slate-900/40 hover:bg-slate-800/40 transition-colors' : 'opacity-60 bg-slate-950/20'}
                    >
                      <td className="py-3 px-4 font-bold text-slate-200 flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                            hasCenters ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {gen.generation}
                        </span>
                        <span>
                          第 {gen.generation} 代 {gen.generation === 1 ? '(直屬培育中心)' : ''}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            hasCenters
                              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800'
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

                      <td className="py-3 px-4 font-bold text-cyan-400">
                        +{(gen.totalMembersInGen * 1.0).toFixed(1)} 點
                      </td>

                      <td className="py-3 px-4 font-sans text-xs">
                        {hasCenters ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {gen.centers.map((c) =>
                              !scopedMode ? (
                                <button
                                  key={c.centerId}
                                  onClick={() => handleSwitchCenter(c.centerId)}
                                  className="px-2 py-1 bg-slate-800 hover:bg-cyan-800 hover:text-white text-slate-200 rounded font-mono text-[11px] cursor-pointer transition-colors border border-slate-700"
                                  title={`點擊切換登入至：${c.name} (總監: ${c.directorName})`}
                                >
                                  {c.name} ({c.centerId})
                                </button>
                              ) : (
                                <span
                                  key={c.centerId}
                                  className="px-2 py-1 bg-slate-950 text-slate-300 rounded font-mono text-[11px] border border-slate-800"
                                >
                                  {c.name} ({c.centerId})
                                </span>
                              )
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[11px]">尚無培育子中心</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-950 font-mono text-xs border-t-2 border-cyan-500/40 font-bold">
                <tr>
                  <td className="py-3 px-4 text-cyan-300">6 代總計 (Total 6 Generations)</td>
                  <td className="py-3 px-4 text-cyan-300 text-sm">{report.totalMentoredCentersCount} 間</td>
                  <td className="py-3 px-4 text-slate-200">{report.totalDownlineMembersCount} 人</td>
                  <td className="py-3 px-4 text-slate-400 font-sans text-[11px]">每代 1.0 點 (共6.0點/6%)</td>
                  <td className="py-3 px-4 text-cyan-400 text-sm">+{report.estimatedMonthlySubsidy.toFixed(1)} 點/月</td>
                  <td className="py-3 px-4 text-right font-sans text-slate-400 text-[11px]">
                    嚴格閉環 100% 平帳
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-start gap-3 text-xs text-slate-400">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-200 font-semibold">6 代教育中心培訓補貼機制：</span>
              <p className="mt-0.5 leading-relaxed">
                每次會員繳納 100 元月租續約時，系統自動沿會員綁定之教育中心向上追溯 6 代母中心，每代固定發放 1.0 點培訓補貼。教育中心負責人透過擴展培育連鎖培訓陣容，可享有穩健的教育培訓分紅！
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
              <span>向上 6 代培訓母中心追溯鏈 (Upstream Mentoring Center Chain)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              當本中心學員進行 100 元月租續約時，系統沿此母中心鏈向上追溯 6 代，每代母中心固定撥發 1.0 點培訓補貼。
            </p>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {report.upstreamCenters.map((center, idx) => (
              <div
                key={center.centerId}
                className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-cyan-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center justify-center font-bold text-xs">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-100 font-bold text-sm">{center.name}</span>
                      <span className="text-cyan-400 font-mono text-xs">({center.centerId})</span>
                    </div>
                    <div className="text-slate-400 font-sans text-xs mt-0.5">
                      總監: {center.directorName} · 教室地址: {center.address}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-cyan-400 font-bold">+1.0 點 / 期</div>
                    <div className="text-[10px] text-slate-500 font-sans">向上第 {idx + 1} 代培訓補貼</div>
                  </div>
                  {!scopedMode && (
                    <button
                      onClick={() => handleSwitchCenter(center.centerId)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-sans cursor-pointer transition-colors"
                    >
                      身分切換 →
                    </button>
                  )}
                </div>
              </div>
            ))}

            {report.upstreamCenters.length === 0 && (
              <div className="text-slate-500 text-xs py-8 text-center bg-slate-950/40 rounded-lg border border-slate-800 font-sans">
                此中心為總公司全球教育訓練總部，無上層培育母中心。
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
                <span>本中心直轄綁定學員/會員名冊 (Direct Bound Members)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                登錄在教育中心 <span className="font-mono text-cyan-300 font-bold">{report.center.centerId}</span> 名下的所有會員（入會時核發 1+1 雙發節點）。
              </p>
            </div>
            <div className="text-xs font-mono text-blue-300 bg-blue-950/60 px-3 py-1.5 rounded-lg border border-blue-800">
              直轄學員總數: {report.boundMembers.length} 人
            </div>
          </div>

          {report.boundMembers.length > 0 ? (
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">會員 MID</th>
                    <th className="py-2.5 px-3 font-semibold">學員姓名</th>
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
                              className="text-xs text-cyan-400 hover:text-cyan-300 font-sans font-medium cursor-pointer"
                            >
                              節點 →
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-cyan-400 font-sans">本中心直轄</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-slate-500 text-xs py-8 text-center bg-slate-950/40 rounded-lg border border-slate-800 font-sans">
              目前尚無會員綁定於此教育中心。可在新會員註冊時將「教育中心 ID」填入「{report.center.centerId}」即可綁定。
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
              <span>6 代教育培訓補貼進帳明細 (Training Subsidy Inflow Ledger)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              每次 100 元月租閉環清算時，若會員屬於此中心或其 6 代培育子中心網絡，即刻撥發 1.0 點培訓補貼至此中心帳戶。
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
                    <th className="py-2.5 px-3 font-semibold">所屬中心</th>
                    <th className="py-2.5 px-3 font-semibold">培育代數</th>
                    <th className="py-2.5 px-3 font-semibold">撥發點數</th>
                    <th className="py-2.5 px-3 font-semibold text-right">結算時間</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {report.recentSubsidyRecords.map((r, idx) => (
                    <tr key={`${r.transactionId}-${idx}`} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3 text-slate-400">{r.transactionId.substring(0, 10)}...</td>
                      <td className="py-2 px-3 font-bold text-cyan-300">{r.fromMemberMid}</td>
                      <td className="py-2 px-3 font-sans text-slate-300">{r.fromMemberName}</td>
                      <td className="py-2 px-3 text-slate-400">{r.fromCenterId}</td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800 text-[11px]">
                          第 {r.generation} 代
                        </span>
                      </td>
                      <td className="py-2 px-3 font-bold text-cyan-400">+{r.points.toFixed(1)} 點</td>
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
              尚無清算進帳紀錄。可前往「100% 閉環清算」為此中心轄下學員執行月租續約清算以觸發撥發。
            </div>
          )}
        </div>
      )}

      {/* Modal: Register New Education Center */}
      {isNewCenterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-slate-100">
                  拓點成立新教育培訓中心
                </h3>
              </div>
              <button
                onClick={() => setIsNewCenterModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800">
              直屬培育母中心將自動綁定為：
              <span className="font-mono text-cyan-300 font-bold ml-1">
                {report.center.name} ({currentCenterId})
              </span>
              ，成立後自動納入您的第 1 代直轄教育中心！
            </div>

            <form onSubmit={handleCreateCenter} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  中心代號 (Center ID, 例如 EDU-TAICHUNG-02)
                </label>
                <input
                  type="text"
                  placeholder="EDU-XXXX"
                  value={newCenterId}
                  onChange={(e) => setNewCenterId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  中心名稱 (Center Name)
                </label>
                <input
                  type="text"
                  placeholder="例如：台中西屯創新領袖培訓中心"
                  value={newCenterName}
                  onChange={(e) => setNewCenterName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">
                    負責總監會員 MID
                  </label>
                  <input
                    type="text"
                    placeholder="例如：A-00008"
                    value={newDirectorMid}
                    onChange={(e) => setNewDirectorMid(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">
                    總監姓名
                  </label>
                  <input
                    type="text"
                    placeholder="例如：陳金龍"
                    value={newDirectorName}
                    onChange={(e) => setNewDirectorName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">
                    聯絡電話
                  </label>
                  <input
                    type="text"
                    placeholder="例如：04-2358-1122"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">
                    培訓教室地址
                  </label>
                  <input
                    type="text"
                    placeholder="例如：台中市西屯區台灣大道三段 301 號 8 樓"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewCenterModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-lg cursor-pointer transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-sm cursor-pointer transition-colors"
                >
                  確認拓點成立教育中心
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
