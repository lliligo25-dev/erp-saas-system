/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  Check,
  AlertTriangle,
  Shield,
  FileCode2,
} from 'lucide-react';
import type { Member, NodeRecord, NodeStatus } from '../types/erp';
import { erpEngine, GLOBAL_BOUNDARIES } from '../services/erpEngine';
import {
  apiHqDbDeleteMember,
  apiHqDbDeleteNode,
  apiHqDbGetOverview,
  apiHqDbUpdateMember,
  apiHqDbUpdateNode,
  apiSaveAndTestHqGasBridge,
  type HqDbAuditEntry,
  type HqDbOverviewData,
} from '../services/confidentialApiClient';

interface HqDatabaseAdminViewProps {
  onDatabaseChanged: () => void;
  onNavigateToGasCode: () => void;
}

type DbTab = 'members' | 'monoline' | 'binary' | 'audit';

const NODE_STATUS_LABELS: Record<NodeStatus, { label: string; colorClass: string }> = {
  TRIAL_ACTIVE: { label: '體驗啟用中', colorClass: 'text-emerald-400' },
  ACTIVE_RENEWED: { label: '續約正式啟用', colorClass: 'text-sky-400' },
  HQ_LOCKED: { label: '總部永久鎖定', colorClass: 'text-amber-400' },
  EXPIRED_FROZEN: { label: '逾期凍結', colorClass: 'text-rose-400' },
};

function formatTwDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

function isoToTwDateInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function addDaysToDateInput(currentDateStr: string, days: number): string {
  const base = currentDateStr && /^\d{4}-\d{2}-\d{2}$/.test(currentDateStr)
    ? new Date(`${currentDateStr}T12:00:00+08:00`)
    : new Date();
  const next = new Date(base.getTime() + days * 86_400_000);
  return isoToTwDateInput(next.toISOString());
}

export const HqDatabaseAdminView: React.FC<HqDatabaseAdminViewProps> = ({
  onDatabaseChanged,
  onNavigateToGasCode,
}) => {
  const [activeTab, setActiveTab] = useState<DbTab>('members');
  const [loading, setLoading] = useState(true);
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [overview, setOverview] = useState<HqDbOverviewData | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'warn' | 'err';
    title: string;
    detail?: string;
    needsGasUpgrade?: boolean;
  } | null>(null);

  // Edit Member Modal State
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [memberForm, setMemberForm] = useState({
    name: '',
    phone: '',
    idNumberMasked: '',
    sponsorMid: '',
    storeId: '',
    centerId: '',
    trialExpiresDate: '',
    accumulatedRentAmount: '0',
    tel: '',
    line: '',
    email: '',
    address: '',
  });

  // Edit Node Modal State
  const [editingNode, setEditingNode] = useState<{
    track: 'MONOLINE' | 'BINARY';
    node: NodeRecord;
  } | null>(null);
  const [nodeForm, setNodeForm] = useState({
    name: '',
    status: 'TRIAL_ACTIVE' as NodeStatus,
    sponsorMid: '',
    trialExpiresDate: '',
    totalEarnings: '0',
    softwareTitle: '',
  });

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'MEMBER'; member: Member }
    | { kind: 'NODE'; track: 'MONOLINE' | 'BINARY'; node: NodeRecord }
    | null
  >(null);
  const [deleteLinkedNodes, setDeleteLinkedNodes] = useState(true);

  const loadOverview = async () => {
    setLoading(true);
    const res = await apiHqDbGetOverview();
    if (res.ok && res.data) {
      setOverview(res.data);
    } else {
      setFeedback({
        type: 'err',
        title: res.error || '無法載入總部資料庫資料',
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  const handleForceHydrateFromSheet = async () => {
    setSyncingSheet(true);
    setFeedback(null);
    const res = await apiSaveAndTestHqGasBridge({ hydrateNow: true });
    if (res.ok && res.hydrationResult?.ok) {
      if (res.bootstrap) {
        erpEngine.hydrateFromServer(res.bootstrap);
        onDatabaseChanged();
      }
      await loadOverview();
      setFeedback({
        type: 'ok',
        title: '已從 Google 試算表完成最新回讀',
        detail: res.hydrationResult.message,
      });
    } else {
      setFeedback({
        type: 'err',
        title: '試算表回讀失敗',
        detail: res.hydrationResult?.message || res.error || '請確認 GAS /exec 連線狀態',
      });
    }
    setSyncingSheet(false);
  };

  const openEditMember = (m: Member) => {
    setEditingMember(m);
    setMemberForm({
      name: m.name || '',
      phone: m.phone || '',
      idNumberMasked: m.idNumberMasked || '',
      sponsorMid: m.sponsorMid || '',
      storeId: m.storeId || 'S-TAIPEI-01',
      centerId: m.centerId || 'EDU-GLOBAL-01',
      trialExpiresDate: isoToTwDateInput(m.trialExpiresAt),
      accumulatedRentAmount: String(m.accumulatedRentAmount ?? 0),
      tel: m.tel || '',
      line: m.line || '',
      email: m.email || '',
      address: m.address || '',
    });
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setSaving(true);
    setFeedback(null);
    const res = await apiHqDbUpdateMember(editingMember.mid, {
      name: memberForm.name,
      phone: memberForm.phone,
      idNumberMasked: memberForm.idNumberMasked,
      sponsorMid: memberForm.sponsorMid,
      storeId: memberForm.storeId,
      centerId: memberForm.centerId,
      trialExpiresAt: memberForm.trialExpiresDate ? `${memberForm.trialExpiresDate} 23:59:59` : undefined,
      accumulatedRentAmount: Number(memberForm.accumulatedRentAmount || 0),
      tel: memberForm.tel,
      line: memberForm.line,
      email: memberForm.email,
      address: memberForm.address,
    });
    setSaving(false);

    if (!res.ok) {
      setFeedback({ type: 'err', title: res.error || '儲存會員資料失敗' });
      return;
    }

    if (res.bootstrap) {
      erpEngine.hydrateFromServer(res.bootstrap);
      onDatabaseChanged();
    }
    if (res.overview) {
      setOverview(res.overview);
    }
    setEditingMember(null);
    setFeedback({
      type: res.gasSync?.ok ? 'ok' : 'warn',
      title: `已更新會員 ${editingMember.mid} (${memberForm.name})`,
      detail: res.gasSync?.message,
      needsGasUpgrade: res.gasSync?.needsGasUpgrade,
    });
  };

  const openEditNode = (track: 'MONOLINE' | 'BINARY', node: NodeRecord) => {
    setEditingNode({ track, node });
    setNodeForm({
      name: node.name || '',
      status: node.status,
      sponsorMid: node.sponsorMid || '',
      trialExpiresDate: isoToTwDateInput(node.trialExpiresAt),
      totalEarnings: String(node.totalEarnings ?? 0),
      softwareTitle: node.softwareTitle || '',
    });
  };

  const handleSaveNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNode) return;
    setSaving(true);
    setFeedback(null);
    const res = await apiHqDbUpdateNode(editingNode.track, editingNode.node.nodeId, {
      name: nodeForm.name,
      status: nodeForm.status,
      sponsorMid: nodeForm.sponsorMid,
      trialExpiresAt: nodeForm.trialExpiresDate ? `${nodeForm.trialExpiresDate} 23:59:59` : undefined,
      totalEarnings: Number(nodeForm.totalEarnings || 0),
      softwareTitle: nodeForm.softwareTitle,
    });
    setSaving(false);

    if (!res.ok) {
      setFeedback({ type: 'err', title: res.error || '儲存節點資料失敗' });
      return;
    }

    if (res.bootstrap) {
      erpEngine.hydrateFromServer(res.bootstrap);
      onDatabaseChanged();
    }
    if (res.overview) {
      setOverview(res.overview);
    }
    setEditingNode(null);
    setFeedback({
      type: res.gasSync?.ok ? 'ok' : 'warn',
      title: `已更新節點 ${editingNode.node.nodeId}`,
      detail: res.gasSync?.message,
      needsGasUpgrade: res.gasSync?.needsGasUpgrade,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setFeedback(null);

    let res;
    let label = '';
    if (deleteTarget.kind === 'MEMBER') {
      label = `會員 ${deleteTarget.member.mid} (${deleteTarget.member.name})`;
      res = await apiHqDbDeleteMember(deleteTarget.member.mid, deleteLinkedNodes);
    } else {
      label = `${deleteTarget.track === 'MONOLINE' ? '單軌' : '雙軌'}節點 ${deleteTarget.node.nodeId}`;
      res = await apiHqDbDeleteNode(deleteTarget.track, deleteTarget.node.nodeId);
    }
    setSaving(false);

    if (!res.ok) {
      setFeedback({ type: 'err', title: `無法刪除 ${label}`, detail: res.error });
      setDeleteTarget(null);
      return;
    }

    if (res.bootstrap) {
      erpEngine.hydrateFromServer(res.bootstrap);
      onDatabaseChanged();
    }
    if (res.overview) {
      setOverview(res.overview);
    }
    setDeleteTarget(null);
    setFeedback({
      type: res.gasSync?.ok ? 'ok' : 'warn',
      title: `已安全刪除 ${label}`,
      detail: res.gasSync?.message,
      needsGasUpgrade: res.gasSync?.needsGasUpgrade,
    });
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredMembers = useMemo(() => {
    const list: Member[] = overview?.members || [];
    if (!normalizedQuery) return list;
    return list.filter((m) =>
      [m.mid, m.name, m.phone, m.sponsorMid, m.monolineNodeId, m.binaryNodeId, m.idNumberMasked]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(normalizedQuery))
    );
  }, [overview, normalizedQuery]);

  const filteredMonoline = useMemo(() => {
    const list: NodeRecord[] = overview?.monolineNodes || [];
    if (!normalizedQuery) return list;
    return list.filter((n) =>
      [n.nodeId, n.mid, n.name, n.sponsorMid, n.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(normalizedQuery))
    );
  }, [overview, normalizedQuery]);

  const filteredBinary = useMemo(() => {
    const list: NodeRecord[] = overview?.binaryNodes || [];
    if (!normalizedQuery) return list;
    return list.filter((n) =>
      [n.nodeId, n.mid, n.name, n.sponsorMid, n.parentId, n.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(normalizedQuery))
    );
  }, [overview, normalizedQuery]);

  const auditLogs: HqDbAuditEntry[] = overview?.auditLogs || [];

  return (
    <div className="space-y-6">
      {/* Header Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>總部最高權限專屬</span>
            <span aria-hidden="true">·</span>
            <span>即時伺服器更新與 Google 試算表雙向同步</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            總部資料庫直接維護中心
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onNavigateToGasCode}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileCode2 className="w-3.5 h-3.5 text-slate-400" />
            <span>取得新版 Code.gs</span>
          </button>
          <button
            type="button"
            onClick={handleForceHydrateFromSheet}
            disabled={syncingSheet}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingSheet ? 'animate-spin' : ''}`} />
            <span>{syncingSheet ? '同步試算表中...' : '從試算表重新載入'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-lg border text-xs ${
            feedback.type === 'ok'
              ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
              : feedback.type === 'warn'
                ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                : 'bg-rose-950/40 border-rose-800/80 text-rose-200'
          }`}
        >
          <div className="space-y-0.5">
            <div className="font-semibold flex items-center gap-1.5">
              {feedback.type === 'ok' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.title}</span>
            </div>
            {feedback.detail && <p className="text-slate-300 leading-relaxed">{feedback.detail}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {feedback.needsGasUpgrade && (
              <button
                type="button"
                onClick={onNavigateToGasCode}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-semibold rounded-md whitespace-nowrap cursor-pointer"
              >
                前往複製最新版 Code.gs
              </button>
            )}
            <button
              type="button"
              onClick={() => setFeedback(null)}
              aria-label="關閉訊息"
              className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Compact Summary Strip (Flat 1px dividers, tabular-nums) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-slate-800 rounded-lg bg-slate-900/60 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
        <div className="p-4">
          <div className="text-xs text-slate-400">會員主檔筆數</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-100">
            {(overview?.members.length ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-400">單軌公排節點</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-100">
            {(overview?.monolineNodes.length ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-400">雙軌二元樹節點</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-100">
            {(overview?.binaryNodes.length ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-400">異動稽核紀錄</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-100">
            {auditLogs.length.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Controls Bar: Table Switcher + Live Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg w-fit text-xs">
          {(
            [
              { id: 'members', label: '會員主檔 (A-碼)' },
              { id: 'monoline', label: '單軌節點表 (C-00001+)' },
              { id: 'binary', label: '雙軌節點表 (C-25000001+)' },
              { id: 'audit', label: '修改稽核紀錄' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab !== 'audit' && (
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋編號、姓名、手機或推薦人..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg text-slate-100 placeholder:text-slate-500"
            />
          </div>
        )}
      </div>

      {/* Data Table Container */}
      <div className="border border-slate-800 rounded-lg bg-slate-900/50 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 rounded bg-slate-800/60 animate-pulse" />
            ))}
          </div>
        ) : activeTab === 'members' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900 text-slate-400">
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">會員編號</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">姓名</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">手機</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">推薦人</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">單軌 / 雙軌節點</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">到期日 (台灣時間)</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">零錢池</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">總部操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      查無符合條件的會員紀錄
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => {
                    const isProtected = m.mid === GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID;
                    return (
                      <tr key={m.mid} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono tabular-nums font-semibold text-indigo-300 whitespace-nowrap">
                          {m.mid}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-100 whitespace-nowrap">
                          {m.name}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-300 whitespace-nowrap">
                          {m.phone || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                          {m.sponsorMid}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-300 whitespace-nowrap">
                          <span>{m.monolineNodeId}</span>
                          <span className="text-slate-600 mx-1.5">/</span>
                          <span>{m.binaryNodeId}</span>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-300 whitespace-nowrap">
                          {formatTwDate(m.trialExpiresAt)}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-right text-slate-200 whitespace-nowrap">
                          {Number(m.accumulatedRentAmount || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditMember(m)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 border border-indigo-500/30 rounded-md transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>修改</span>
                            </button>
                            {isProtected ? (
                              <span className="text-[11px] text-slate-500 px-1.5">核心保護</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteLinkedNodes(true);
                                  setDeleteTarget({ kind: 'MEMBER', member: m });
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 rounded-md transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>刪除</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'monoline' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900 text-slate-400">
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">單軌節點</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">會員 MID</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">顯示名稱</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">順位 / 父節點</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">狀態</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">到期日</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">累計收益</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">總部操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredMonoline.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      尚無單軌公排節點資料
                    </td>
                  </tr>
                ) : (
                  filteredMonoline.map((n) => {
                    const st = NODE_STATUS_LABELS[n.status] || {
                      label: n.status,
                      colorClass: 'text-slate-300',
                    };
                    return (
                      <tr key={n.nodeId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono tabular-nums font-semibold text-teal-300 whitespace-nowrap">
                          {n.nodeId}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-300 whitespace-nowrap">
                          {n.mid}
                        </td>
                        <td className="py-3 px-4 text-slate-100 whitespace-nowrap">{n.name}</td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                          #{n.depth} · {n.parentId}
                        </td>
                        <td className={`py-3 px-4 font-medium whitespace-nowrap ${st.colorClass}`}>
                          {st.label}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-300 whitespace-nowrap">
                          {formatTwDate(n.trialExpiresAt)}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-right text-slate-200 whitespace-nowrap">
                          {Number(n.totalEarnings || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditNode('MONOLINE', n)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 border border-indigo-500/30 rounded-md transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>修改</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ kind: 'NODE', track: 'MONOLINE', node: n })}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 rounded-md transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>刪除</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'binary' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900 text-slate-400">
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">雙軌節點</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">會員 MID</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">節點名稱</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">安置位置</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">左 / 右子節點</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">狀態</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">到期日</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">總部操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredBinary.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      尚無雙軌二元樹節點資料
                    </td>
                  </tr>
                ) : (
                  filteredBinary.map((n) => {
                    const isRoot = n.nodeId === GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID;
                    const hasChildren = Boolean(n.leftChildId || n.rightChildId);
                    const st = NODE_STATUS_LABELS[n.status] || {
                      label: n.status,
                      colorClass: 'text-slate-300',
                    };
                    return (
                      <tr key={n.nodeId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono tabular-nums font-semibold text-indigo-300 whitespace-nowrap">
                          {n.nodeId}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-300 whitespace-nowrap">
                          {n.mid}
                        </td>
                        <td className="py-3 px-4 text-slate-100 whitespace-nowrap">{n.name}</td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                          {n.parentId} · {n.placementPosition || 'ROOT'} (L{n.depth})
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-300 whitespace-nowrap">
                          <span>{n.leftChildId || '空'}</span>
                          <span className="text-slate-600 mx-1.5">/</span>
                          <span>{n.rightChildId || '空'}</span>
                        </td>
                        <td className={`py-3 px-4 font-medium whitespace-nowrap ${st.colorClass}`}>
                          {st.label}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-300 whitespace-nowrap">
                          {formatTwDate(n.trialExpiresAt)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditNode('BINARY', n)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 border border-indigo-500/30 rounded-md transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>修改</span>
                            </button>
                            {isRoot ? (
                              <span className="text-[11px] text-slate-500 px-1.5">定海神針</span>
                            ) : hasChildren ? (
                              <span
                                title="此節點下方已有子節點，請先移除底層葉節點"
                                className="text-[11px] text-slate-500 px-1.5"
                              >
                                有下線保護
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget({ kind: 'NODE', track: 'BINARY', node: n })}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 rounded-md transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>刪除</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900 text-slate-400">
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">異動時間</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">操作人員</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">目標編號</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">異動明細</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">試算表同步結果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">
                      尚無總部資料庫修改紀錄
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                        {formatTwDate(log.timestamp)}
                      </td>
                      <td className="py-3 px-4 text-slate-200 whitespace-nowrap">
                        {log.operatorName} <span className="font-mono text-slate-500">({log.operatorId})</span>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums font-semibold text-indigo-300 whitespace-nowrap">
                        {log.targetId}
                      </td>
                      <td className="py-3 px-4 text-slate-200">{log.summary}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.gasSyncOk === true ? (
                          <span className="text-emerald-400 font-medium">試算表已同步</span>
                        ) : log.gasSyncOk === false ? (
                          <span className="text-amber-400 font-medium" title={log.gasSyncMessage}>
                            僅網站更新（待升級 Code.gs）
                          </span>
                        ) : (
                          <span className="text-slate-500">處理中</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= EDIT MEMBER MODAL ================= */}
      {editingMember && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="修改會員資料庫紀錄"
        >
          <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <div>
                <div className="text-xs text-slate-400 font-mono">{editingMember.mid}</div>
                <h2 className="text-base font-bold text-slate-100">修改會員主檔資料</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="p-1.5 text-slate-400 hover:text-slate-100 cursor-pointer"
                aria-label="關閉視窗"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">會員姓名 *</label>
                  <input
                    type="text"
                    required
                    value={memberForm.name}
                    onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">手機號碼（自動保留開頭 0）</label>
                  <input
                    type="text"
                    value={memberForm.phone}
                    onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                    placeholder="0912345678"
                    className="w-full px-3 py-2 font-mono tabular-nums bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">身分證號 / 統一編號</label>
                  <input
                    type="text"
                    value={memberForm.idNumberMasked}
                    onChange={(e) => setMemberForm({ ...memberForm, idNumberMasked: e.target.value })}
                    className="w-full px-3 py-2 font-mono uppercase bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">直推推薦人 MID</label>
                  <input
                    type="text"
                    value={memberForm.sponsorMid}
                    onChange={(e) => setMemberForm({ ...memberForm, sponsorMid: e.target.value })}
                    className="w-full px-3 py-2 font-mono uppercase bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">所屬經營店 ID</label>
                  <input
                    type="text"
                    value={memberForm.storeId}
                    onChange={(e) => setMemberForm({ ...memberForm, storeId: e.target.value })}
                    className="w-full px-3 py-2 font-mono bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">所屬教育中心 ID</label>
                  <input
                    type="text"
                    value={memberForm.centerId}
                    onChange={(e) => setMemberForm({ ...memberForm, centerId: e.target.value })}
                    className="w-full px-3 py-2 font-mono bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">體驗 / 授權到期日</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={memberForm.trialExpiresDate}
                      onChange={(e) => setMemberForm({ ...memberForm, trialExpiresDate: e.target.value })}
                      className="flex-1 px-3 py-2 font-mono bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none rounded-lg text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setMemberForm((prev) => ({
                          ...prev,
                          trialExpiresDate: addDaysToDateInput(prev.trialExpiresDate, 30),
                        }))
                      }
                      className="px-2 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 whitespace-nowrap cursor-pointer"
                    >
                      +30天
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">零錢池餘額 (NTD)</label>
                  <input
                    type="number"
                    min={0}
                    value={memberForm.accumulatedRentAmount}
                    onChange={(e) => setMemberForm({ ...memberForm, accumulatedRentAmount: e.target.value })}
                    className="w-full px-3 py-2 font-mono tabular-nums bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none rounded-lg text-slate-100"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">LINE ID</label>
                  <input
                    type="text"
                    value={memberForm.line}
                    onChange={(e) => setMemberForm({ ...memberForm, line: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={memberForm.email}
                    onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none rounded-lg text-slate-100"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1">通訊地址</label>
                  <input
                    type="text"
                    value={memberForm.address}
                    onChange={(e) => setMemberForm({ ...memberForm, address: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none rounded-lg text-slate-100"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg font-semibold cursor-pointer"
                >
                  {saving ? '儲存並同步試算表中...' : '儲存修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT NODE MODAL ================= */}
      {editingNode && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="修改節點資料庫紀錄"
        >
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <div>
                <div className="text-xs text-slate-400 font-mono">
                  {editingNode.track === 'MONOLINE' ? '單軌節點' : '雙軌節點'} · {editingNode.node.nodeId}
                </div>
                <h2 className="text-base font-bold text-slate-100">修改節點授權與狀態</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingNode(null)}
                className="p-1.5 text-slate-400 hover:text-slate-100 cursor-pointer"
                aria-label="關閉視窗"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNode} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">節點顯示名稱 *</label>
                <input
                  type="text"
                  required
                  value={nodeForm.name}
                  onChange={(e) => setNodeForm({ ...nodeForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none rounded-lg text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">節點授權狀態</label>
                  <select
                    value={nodeForm.status}
                    disabled={editingNode.node.nodeId === GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID}
                    onChange={(e) => setNodeForm({ ...nodeForm, status: e.target.value as NodeStatus })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none rounded-lg text-slate-100 disabled:opacity-60"
                  >
                    <option value="TRIAL_ACTIVE">體驗啟用中 (TRIAL_ACTIVE)</option>
                    <option value="ACTIVE_RENEWED">續約正式啟用 (ACTIVE_RENEWED)</option>
                    <option value="EXPIRED_FROZEN">逾期凍結 (EXPIRED_FROZEN)</option>
                    <option value="HQ_LOCKED">總部永久鎖定 (HQ_LOCKED)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">推薦人 MID</label>
                  <input
                    type="text"
                    value={nodeForm.sponsorMid}
                    onChange={(e) => setNodeForm({ ...nodeForm, sponsorMid: e.target.value })}
                    className="w-full px-3 py-2 font-mono uppercase bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">節點到期日</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={nodeForm.trialExpiresDate}
                      onChange={(e) => setNodeForm({ ...nodeForm, trialExpiresDate: e.target.value })}
                      className="flex-1 px-3 py-2 font-mono bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none rounded-lg text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setNodeForm((prev) => ({
                          ...prev,
                          trialExpiresDate: addDaysToDateInput(prev.trialExpiresDate, 30),
                        }))
                      }
                      className="px-2 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 whitespace-nowrap cursor-pointer"
                    >
                      +30天
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">累計收益 (點/NTD)</label>
                  <input
                    type="number"
                    min={0}
                    value={nodeForm.totalEarnings}
                    onChange={(e) => setNodeForm({ ...nodeForm, totalEarnings: e.target.value })}
                    className="w-full px-3 py-2 font-mono tabular-nums bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none rounded-lg text-slate-100"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingNode(null)}
                  className="px-4 py-2 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg font-semibold cursor-pointer"
                >
                  {saving ? '儲存並同步試算表中...' : '儲存修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= DELETE CONFIRMATION MODAL ================= */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="確認刪除資料庫紀錄"
        >
          <div className="w-full max-w-md bg-slate-900 border border-rose-800/80 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>總部高權限刪除確認</span>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-100 cursor-pointer"
                aria-label="關閉視窗"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-300">
              {deleteTarget.kind === 'MEMBER' ? (
                <>
                  <p className="leading-relaxed">
                    您即將刪除會員{' '}
                    <span className="font-mono font-bold text-white">{deleteTarget.member.mid}</span>（
                    <span className="font-semibold text-white">{deleteTarget.member.name}</span>
                    ）。此動作會立即生效並寫入稽核紀錄。
                  </p>
                  <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deleteLinkedNodes}
                      onChange={(e) => setDeleteLinkedNodes(e.target.checked)}
                      className="mt-0.5 rounded border-slate-600"
                    />
                    <span className="text-slate-300 leading-relaxed">
                      一併移除此會員名下的單軌／雙軌葉節點（若雙軌節點下方已有下線，系統將自動攔截以保護組織結構完整）
                    </span>
                  </label>
                </>
              ) : (
                <p className="leading-relaxed">
                  您即將移除{deleteTarget.track === 'MONOLINE' ? '單軌' : '雙軌'}節點{' '}
                  <span className="font-mono font-bold text-white">{deleteTarget.node.nodeId}</span>（
                  {deleteTarget.node.name}）。系統將自動釋放上層父節點的安置空位並重算流水號。
                </p>
              )}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={saving}
                  className="px-4 py-2 text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 rounded-lg font-semibold cursor-pointer"
                >
                  {saving ? '刪除並同步中...' : '確認刪除'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
