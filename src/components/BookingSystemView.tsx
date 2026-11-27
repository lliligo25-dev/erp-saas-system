/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { erpEngine } from '../services/erpEngine';
import { HorizontalScrollStrip } from './HorizontalScrollStrip';
import { notifyNodesUpdated } from '../services/softwareNodeSync';
import {
  CLOUD_VAULT_UPDATED_EVENT,
  ensureMemberCloudWorkspace,
  notifyCloudVaultUpdated,
} from '../services/memberCloudVaultService';
import {
  BookingAppointment,
  BookingProfile,
  BookingServiceItem,
  SettlementBreakdown
} from '../types/erp';
import {
  CalendarClock,
  Clock,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Trash2,
  Video,
  MapPin,
  Phone,
  Search,
  UserCheck,
  CreditCard,
  Copy,
  Check,
  Calendar,
  Settings,
  Globe,
  RefreshCw,
  AlertTriangle,
  GitFork,
  Lock,
} from 'lucide-react';

interface BookingSystemViewProps {
  ownerMid: string;
  isHqAdminView?: boolean;
  onNavigateToRegisterWithClient?: (client: { name: string; phone: string; line?: string; sponsorMid: string }) => void;
  onRenewalCompleted?: () => void;
}

const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

export const BookingSystemView: React.FC<BookingSystemViewProps> = ({
  ownerMid,
  isHqAdminView = false,
  onNavigateToRegisterWithClient,
  onRenewalCompleted,
}) => {
  const [selectedMid, setSelectedMid] = useState<string>(ownerMid);
  const effectiveMid = isHqAdminView ? selectedMid : ownerMid;

  const [, setRefreshTick] = useState(0);
  const forceRefresh = () => setRefreshTick((t) => t + 1);

  const [subTab, setSubTab] = useState<'appointments' | 'public_preview' | 'settings' | 'billing'>('appointments');
  const [statusFilter, setStatusFilter] = useState<'ALL' | BookingAppointment['status']>('ALL');
  const [aptSearch, setAptSearch] = useState('');
  const [copiedBookingLink, setCopiedBookingLink] = useState(false);

  // Renewal receipt modal state
  const [renewalBreakdown, setRenewalBreakdown] = useState<SettlementBreakdown | null>(null);
  const [renewalBinaryNodeId, setRenewalBinaryNodeId] = useState<string | null>(null);
  const [renewalIsNewNode, setRenewalIsNewNode] = useState<boolean>(false);

  // Public preview & quick booking form state
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date(Date.now() + 86400000);
    return d.toISOString().split('T')[0];
  });
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientTel, setClientTel] = useState('');
  const [clientLine, setClientLine] = useState('');
  const [clientReason, setClientReason] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [clientDetail, setClientDetail] = useState('');
  const [createdTicket, setCreatedTicket] = useState<BookingAppointment | null>(null);
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [quickTimeInput, setQuickTimeInput] = useState('14:00');
  const [inlineMsg, setInlineMsg] = useState<string | null>(null);

  // New service form state
  const [newSrvTitle, setNewSrvTitle] = useState('');
  const [newSrvDuration, setNewSrvDuration] = useState(45);
  const [newSrvPrice, setNewSrvPrice] = useState(0);
  const [newSrvLocation, setNewSrvLocation] = useState<BookingServiceItem['locationType']>('ONLINE_MEET');
  const [newSrvDesc, setNewSrvDesc] = useState('');

  const profile: BookingProfile | null = erpEngine.getBookingProfile(effectiveMid);
  const appointments: BookingAppointment[] = profile ? erpEngine.getAppointmentsByOwner(effectiveMid) : [];
  const hqSummary = isHqAdminView ? erpEngine.getAllBookingsSummary() : null;

  // Profile edit local state (synced lazily when editing)
  const [editTitle, setEditTitle] = useState(profile?.displayTitle || '');
  const [editBio, setEditBio] = useState(profile?.bio || '');

  // Helper: remaining trial/paid days
  const getDaysRemaining = (expiresAt?: string): { days: number; isExpired: boolean; label: string } => {
    if (!expiresAt) return { days: 0, isExpired: true, label: '尚未開通' };
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (24 * 3600 * 1000));
    if (days <= 0) return { days: 0, isExpired: true, label: '已到期 (觸發 50% 熔斷)' };
    return { days, isExpired: false, label: `剩餘 ${days} 天` };
  };

  const daysInfo = getDaysRemaining(profile?.expiresAt);
  const isBookingExpiredReadOnly = Boolean(
    profile && (profile.status === 'EXPIRED_FROZEN' || daysInfo.isExpired)
  );

  useEffect(() => {
    const onCloudUpdated = () => forceRefresh();
    window.addEventListener(CLOUD_VAULT_UPDATED_EVENT, onCloudUpdated);
    return () => window.removeEventListener(CLOUD_VAULT_UPDATED_EVENT, onCloudUpdated);
  }, []);

  // Helper: generate upcoming 7 valid working dates
  const getUpcomingDates = (workingDays: number[]): string[] => {
    const result: string[] = [];
    const cursor = new Date();
    cursor.setDate(cursor.getDate() + 1);
    let guard = 0;
    while (result.length < 7 && guard < 30) {
      if (workingDays.includes(cursor.getDay())) {
        result.push(cursor.toISOString().split('T')[0]);
      }
      cursor.setDate(cursor.getDate() + 1);
      guard += 1;
    }
    return result;
  };

  // Helper: generate time slots for a date
  const getTimeSlotsForDate = (prof: BookingProfile, dateStr: string): Array<{ time: string; booked: boolean }> => {
    const slots: Array<{ time: string; booked: boolean }> = [];
    const interval = prof.slotIntervalMinutes || 60;
    const bookedTimes = new Set(
      appointments
        .filter((a) => a.date === dateStr && a.status !== 'CANCELLED')
        .map((a) => a.timeSlot)
    );
    let minutes = prof.startHour * 60;
    const endMinutes = prof.endHour * 60;
    while (minutes < endMinutes) {
      const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
      const mm = String(minutes % 60).padStart(2, '0');
      const timeStr = `${hh}:${mm}`;
      slots.push({ time: timeStr, booked: bookedTimes.has(timeStr) });
      minutes += interval;
    }
    return slots;
  };

  const handleActivateTrial = () => {
    const activated = erpEngine.activateBookingTrial(effectiveMid, { allocateBinaryNode: true });
    setEditTitle(activated.displayTitle);
    setEditBio(activated.bio);
    setInlineMsg(
      activated.binaryNodeId
        ? `已開通第 3 種 AI 個人預約系統 (30 天免費體驗)，並加入雙軌節點 ${activated.binaryNodeId}！`
        : '已開通第 3 種 AI 個人預約系統 (30 天免費體驗)！'
    );
    ensureMemberCloudWorkspace(effectiveMid);
    notifyCloudVaultUpdated(effectiveMid);
    forceRefresh();
    notifyNodesUpdated(effectiveMid);
    if (onRenewalCompleted) onRenewalCompleted();
  };

  const handleBindBinaryNode = () => {
    const updated = erpEngine.activateBookingTrial(effectiveMid, { allocateBinaryNode: true });
    if (updated.binaryNodeId) {
      setInlineMsg(`已將個人預約系統 (${updated.licenseId}) 加入雙軌二元樹新節點：${updated.binaryNodeId}！`);
    }
    ensureMemberCloudWorkspace(effectiveMid);
    notifyCloudVaultUpdated(effectiveMid);
    forceRefresh();
    notifyNodesUpdated(effectiveMid);
    if (onRenewalCompleted) onRenewalCompleted();
  };

  const handleRenew100Ntd = () => {
    const res = erpEngine.renewBookingMonthlyFee(effectiveMid);
    setRenewalBreakdown(res.settlement);
    setRenewalBinaryNodeId(res.binaryNode.nodeId);
    setRenewalIsNewNode(res.isNewBinaryNode);
    ensureMemberCloudWorkspace(effectiveMid);
    notifyCloudVaultUpdated(effectiveMid);
    forceRefresh();
    notifyNodesUpdated(effectiveMid);
    if (onRenewalCompleted) onRenewalCompleted();
  };

  const handleCopyPublicUrl = () => {
    if (!profile) return;
    const shareText = `【${profile.displayTitle}】\n預約專屬授權碼：${profile.licenseId}\n推薦人 MID：${profile.ownerMid}\n歡迎線上預約一對一諮詢與體驗 AI 軟體 1+1！`;
    navigator.clipboard.writeText(shareText);
    setCopiedBookingLink(true);
    setTimeout(() => setCopiedBookingLink(false), 2000);
  };

  const handleBookAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (isBookingExpiredReadOnly) {
      setInlineMsg('第 3 種 AI 個人預約系統尚未續約（已轉為唯讀模式）：僅能查看舊有預約紀錄，不能新增預約單！請先續約 NT$ 100。');
      return;
    }
    const activeServices = profile.services.filter((s) => s.isActive);
    const srvId = selectedServiceId || activeServices[0]?.id;
    if (!srvId || !selectedDate || !selectedTimeSlot || !clientName.trim() || !clientPhone.trim()) {
      setInlineMsg('請選擇服務項目、預約日期與時段，並填寫客戶姓名與手機！');
      return;
    }

    const apt = erpEngine.createAppointment({
      ownerMid: effectiveMid,
      serviceId: srvId,
      date: selectedDate,
      timeSlot: selectedTimeSlot,
      clientName,
      clientPhone,
      clientTel,
      clientLine,
      reason: clientReason,
      notes: clientNotes,
      detail: clientDetail,
    });

    setCreatedTicket(apt);
    setClientName('');
    setClientPhone('');
    setClientTel('');
    setClientLine('');
    setClientReason('');
    setClientNotes('');
    setClientDetail('');
    setSelectedTimeSlot('');
    setInlineMsg(null);
    forceRefresh();
  };

  const handleQuickFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isBookingExpiredReadOnly) {
      setShowQuickForm(false);
      setInlineMsg('第 3 種 AI 個人預約系統尚未續約（已轉為唯讀模式）：僅能查看歷史舊資料，不可新增預約！請點擊「月租 100 元續約」。');
      return;
    }
    if (!clientName.trim()) {
      setInlineMsg('請填寫姓名！');
      return;
    }
    const apt = erpEngine.createAppointment({
      ownerMid: effectiveMid,
      date: selectedDate || new Date().toISOString().split('T')[0],
      timeSlot: quickTimeInput || '10:00',
      clientName,
      clientPhone: clientPhone.trim() || clientTel.trim() || '未填寫',
      clientTel,
      clientLine,
      reason: clientReason,
      notes: clientNotes,
      detail: clientDetail,
    });
    setCreatedTicket(apt);
    setClientName('');
    setClientPhone('');
    setClientTel('');
    setClientLine('');
    setClientReason('');
    setClientNotes('');
    setClientDetail('');
    setShowQuickForm(false);
    setInlineMsg(`已成功新增預約單 ${apt.appointmentId} (${apt.clientName})！`);
    forceRefresh();
  };

  const handleUpdateAptStatus = (aptId: string, status: BookingAppointment['status']) => {
    erpEngine.updateAppointmentStatus(aptId, status);
    forceRefresh();
  };

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (isBookingExpiredReadOnly) {
      setInlineMsg('第 3 種 AI 個人預約系統未續約，僅能瀏覽既有服務項目，不能新增服務！請先續約 NT$ 100。');
      return;
    }
    if (!newSrvTitle.trim()) return;
    erpEngine.addBookingService(effectiveMid, {
      title: newSrvTitle.trim(),
      durationMinutes: Number(newSrvDuration) || 45,
      priceNtd: Number(newSrvPrice) || 0,
      locationType: newSrvLocation,
      description: newSrvDesc.trim() || '專屬一對一預約諮詢服務',
      isActive: true,
    });
    setNewSrvTitle('');
    setNewSrvDesc('');
    forceRefresh();
  };

  const handleToggleWorkingDay = (dayIdx: number) => {
    if (!profile) return;
    const exists = profile.workingDays.includes(dayIdx);
    const updatedDays = exists
      ? profile.workingDays.filter((d) => d !== dayIdx)
      : [...profile.workingDays, dayIdx].sort((a, b) => a - b);
    erpEngine.updateBookingProfile(effectiveMid, { workingDays: updatedDays });
    forceRefresh();
  };

  const handleSaveProfileSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    erpEngine.updateBookingProfile(effectiveMid, {
      displayTitle: editTitle.trim() || profile.displayTitle,
      bio: editBio.trim() || profile.bio,
    });
    forceRefresh();
    setInlineMsg('預約系統簡介與展示名稱已更新儲存！');
  };

  const filteredAppointments = appointments.filter((a) => {
    const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
    const q = aptSearch.trim().toLowerCase();
    const matchSearch =
      !q ||
      a.clientName.toLowerCase().includes(q) ||
      a.clientPhone.includes(q) ||
      a.appointmentId.toLowerCase().includes(q) ||
      a.serviceTitle.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const renderStatusLabel = (status: BookingAppointment['status']) => {
    switch (status) {
      case 'PENDING':
        return <span className="text-amber-400 font-semibold">待確認</span>;
      case 'CONFIRMED':
        return <span className="text-sky-400 font-semibold">已確認</span>;
      case 'COMPLETED':
        return <span className="text-emerald-400 font-semibold">已完成</span>;
      case 'CANCELLED':
        return <span className="text-slate-500 line-through">已取消</span>;
    }
  };

  const renderLocationText = (loc: BookingServiceItem['locationType']) => {
    switch (loc) {
      case 'ONLINE_MEET':
        return '線上視訊會議';
      case 'IN_PERSON':
        return '實體面談 / 門店';
      case 'PHONE':
        return '電話一對一諮詢';
    }
  };

  return (
    <div className="space-y-6">
      {/* HQ Admin Global Summary Strip (ONLY visible to HQ Staff) */}
      {isHqAdminView && hqSummary && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                總部管理視角：第 3 種 AI 個人預約系統全網開通統計
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                總部可檢視全網預約系統授權數，並切換檢視特定會員之個人預約台。
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">切換檢視會員：</span>
              <select
                value={selectedMid}
                onChange={(e) => {
                  setSelectedMid(e.target.value);
                  const nextProf = erpEngine.getBookingProfile(e.target.value);
                  setEditTitle(nextProf?.displayTitle || '');
                  setEditBio(nextProf?.bio || '');
                  setCreatedTicket(null);
                }}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-sky-300 focus:outline-none cursor-pointer"
              >
                {erpEngine.getAllMembers().map((m) => (
                  <option key={m.mid} value={m.mid}>
                    {m.mid} · {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
              <div className="text-slate-400">全網已授權數</div>
              <div className="text-lg font-bold font-mono text-slate-100 tabular-nums mt-0.5">
                {hqSummary.totalActivatedProfiles} 套
              </div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
              <div className="text-slate-400">30天免費體驗中</div>
              <div className="text-lg font-bold font-mono text-teal-400 tabular-nums mt-0.5">
                {hqSummary.activeTrials} 套
              </div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
              <div className="text-slate-400">月租 100 元正式續約</div>
              <div className="text-lg font-bold font-mono text-emerald-400 tabular-nums mt-0.5">
                {hqSummary.activePaid} 套
              </div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
              <div className="text-slate-400">全網客戶預約總筆數</div>
              <div className="text-lg font-bold font-mono text-sky-400 tabular-nums mt-0.5">
                {hqSummary.totalAppointments} 筆
              </div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
              <div className="text-slate-400">待確認預約</div>
              <div className="text-lg font-bold font-mono text-amber-400 tabular-nums mt-0.5">
                {hqSummary.pendingAppointments} 筆
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unactivated State */}
      {!profile ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-sky-950 border border-sky-800/80 flex items-center justify-center text-sky-400 mx-auto">
            <CalendarClock className="w-7 h-7" />
          </div>
          <div className="max-w-xl mx-auto space-y-2">
            <div className="text-xs text-sky-400 font-medium">
              第 3 種 AI 系統 · 專屬個人預約平台
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
              AI 個人預約系統（30 天免費體驗 · 月租 100 元）
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              提供每位會員獨立的線上預約名片、自訂諮詢與服務項目、自動排班時段計算與客戶訂單追蹤；預約資料同步寫入 CRM 聯繫日誌，月租 100 元納入 100% 閉環分潤矩陣。
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleActivateTrial}
              className="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <CalendarClock className="w-4 h-4" />
              <span>立即開通第 3 種 AI 個人預約系統 (贈送 30 天免費體驗)</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* License Header Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="text-sky-400 font-semibold">第 3 種 AI 系統 · 個人預約系統</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-slate-300">授權碼: {profile.licenseId}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-slate-300">持有會員: {profile.ownerName} ({profile.ownerMid})</span>
                  <span aria-hidden="true">·</span>
                  {profile.binaryNodeId ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700/70 text-indigo-300 font-mono text-[11px]">
                      <GitFork className="w-3 h-3" />
                      雙軌節點: {profile.binaryNodeId}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleBindBinaryNode}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium cursor-pointer"
                    >
                      <GitFork className="w-3 h-3" />
                      加入雙軌節點
                    </button>
                  )}
                </div>
                <h2 className="text-xl font-bold text-slate-100">{profile.displayTitle}</h2>
                <p className="text-xs text-slate-400 max-w-2xl">{profile.bio}</p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <div className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-xs space-y-0.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-400">授權狀態：</span>
                    <span className={`font-semibold font-mono ${daysInfo.isExpired ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {profile.status === 'ACTIVE_RENEWED' ? '正式月租啟用中' : profile.status === 'TRIAL_ACTIVE' ? '30天免費體驗中' : '已逾期'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-[11px] text-slate-400">
                    <span>效期：{profile.expiresAt ? new Date(profile.expiresAt).toLocaleDateString() : '-'}</span>
                    <span className={`font-mono font-bold ${daysInfo.isExpired ? 'text-rose-400' : 'text-sky-300'}`}>
                      {daysInfo.label}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyPublicUrl}
                    className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    {copiedBookingLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedBookingLink ? '已複製邀請' : '複製預約名片'}</span>
                  </button>

                  <button
                    onClick={handleRenew100Ntd}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>月租 100 元續約 (+30天)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800 text-xs">
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                <div className="text-slate-400">月租規格 (第 3 套 AI)</div>
                <div className="text-base font-bold font-mono text-slate-100 tabular-nums mt-0.5">
                  $100 元 / 月 <span className="text-xs font-normal text-emerald-400">(首月 30 天免費)</span>
                </div>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                <div className="text-slate-400">已發布預約服務</div>
                <div className="text-base font-bold font-mono text-sky-300 tabular-nums mt-0.5">
                  {profile.services.filter((s) => s.isActive).length} 項進行中
                </div>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                <div className="text-slate-400">累計客戶預約單</div>
                <div className="text-base font-bold font-mono text-indigo-300 tabular-nums mt-0.5">
                  {appointments.length} 筆
                </div>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                <div className="text-slate-400">閉環月租續約次數</div>
                <div className="text-base font-bold font-mono text-emerald-300 tabular-nums mt-0.5">
                  {profile.totalRenewalsCount} 期 ({profile.totalRenewalsCount * 100} 點)
                </div>
              </div>
            </div>
          </div>

          {/* Read-Only Expired Banner */}
          {isBookingExpiredReadOnly && (
            <div className="bg-rose-950/50 border border-rose-700/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-rose-200">
                <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-rose-100">
                    第 3 種 AI 個人預約系統未續約 — 唯讀歸檔模式（只能查看舊資料，不能新增資料）
                  </div>
                  <div className="text-rose-200/80">
                    您名下既有的 {appointments.length} 筆預約紀錄與 {profile.services.length} 項服務清單仍可完整查閱與檢索；若需新增預約或服務項目，請完成月租 100 元續約立即解鎖。
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRenew100Ntd}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>月租 100 元續約解鎖 (+30天)</span>
              </button>
            </div>
          )}

          {/* Sub-navigation Tabs (Horizontally Scrollable) */}
          <HorizontalScrollStrip
            theme="dark"
            ariaLabel="AI 個人預約功能分頁"
            className="gap-1 border-b border-slate-800 text-xs font-medium"
          >
            <button
              onClick={() => setSubTab('appointments')}
              className={`shrink-0 py-2.5 px-4 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                subTab === 'appointments'
                  ? 'border-sky-500 text-sky-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>預約訂單管理 ({appointments.length})</span>
            </button>

            <button
              onClick={() => {
                if (!selectedServiceId && profile.services.length > 0) {
                  setSelectedServiceId(profile.services[0].id);
                }
                const upcoming = getUpcomingDates(profile.workingDays);
                if (upcoming.length > 0 && !upcoming.includes(selectedDate)) {
                  setSelectedDate(upcoming[0]);
                }
                setSubTab('public_preview');
              }}
              className={`shrink-0 py-2.5 px-4 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                subTab === 'public_preview'
                  ? 'border-sky-500 text-sky-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>客戶線上預約前台</span>
            </button>

            <button
              onClick={() => {
                setEditTitle(profile.displayTitle);
                setEditBio(profile.bio);
                setSubTab('settings');
              }}
              className={`shrink-0 py-2.5 px-4 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                subTab === 'settings'
                  ? 'border-sky-500 text-sky-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>服務項目與時段排班設定</span>
            </button>

            <button
              onClick={() => setSubTab('billing')}
              className={`shrink-0 py-2.5 px-4 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                subTab === 'billing'
                  ? 'border-sky-500 text-sky-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>3 大 AI 軟體計費與 100 元閉環分潤</span>
            </button>
          </HorizontalScrollStrip>

          {/* Inline Feedback Message */}
          {inlineMsg && (
            <div className="bg-sky-950/60 border border-sky-700/60 text-sky-200 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between">
              <span>{inlineMsg}</span>
              <button
                type="button"
                onClick={() => setInlineMsg(null)}
                className="text-sky-300 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* SUBTAB 1: APPOINTMENTS CONSOLE */}
          {subTab === 'appointments' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                    {(['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setStatusFilter(st)}
                        className={`px-2.5 py-1 rounded transition-colors cursor-pointer whitespace-nowrap ${
                          statusFilter === st ? 'bg-slate-800 text-sky-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {st === 'ALL' ? '全部' : st === 'PENDING' ? '待確認' : st === 'CONFIRMED' ? '已確認' : st === 'COMPLETED' ? '已完成' : '已取消'}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={isBookingExpiredReadOnly}
                    onClick={() => {
                      if (isBookingExpiredReadOnly) {
                        setInlineMsg('個人預約系統未續約，僅能查看舊資料，不可新增預約！');
                        return;
                      }
                      setShowQuickForm((v) => !v);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                      isBookingExpiredReadOnly
                        ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        : 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer'
                    }`}
                  >
                    {isBookingExpiredReadOnly ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <PlusCircle className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isBookingExpiredReadOnly
                        ? '未續約唯讀 (禁新增)'
                        : showQuickForm
                        ? '收合新增表單'
                        : '新增預約'}
                    </span>
                  </button>
                </div>

                <div className="relative max-w-xs w-full">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={aptSearch}
                    onChange={(e) => setAptSearch(e.target.value)}
                    placeholder="搜尋客戶姓名、手機或 APT- 單號..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {showQuickForm && !isBookingExpiredReadOnly && (
                <form
                  onSubmit={handleQuickFormSubmit}
                  className="p-4 bg-slate-950/70 border-b border-slate-800 grid grid-cols-12 gap-3 text-xs"
                >
                  <div className="col-span-12">
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="姓名 *"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="col-span-6">
                    <input
                      type="text"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="手機"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="col-span-6">
                    <input
                      type="text"
                      value={clientTel}
                      onChange={(e) => setClientTel(e.target.value)}
                      placeholder="電話"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="col-span-6">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="col-span-6">
                    <input
                      type="time"
                      value={quickTimeInput}
                      onChange={(e) => setQuickTimeInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="col-span-6">
                    <input
                      type="text"
                      value={clientReason}
                      onChange={(e) => setClientReason(e.target.value)}
                      placeholder="事由"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="col-span-6">
                    <input
                      type="text"
                      value={clientNotes}
                      onChange={(e) => setClientNotes(e.target.value)}
                      placeholder="備註"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="col-span-12">
                    <input
                      type="text"
                      value={clientDetail}
                      onChange={(e) => setClientDetail(e.target.value)}
                      placeholder="詳細情況"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="col-span-12">
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg cursor-pointer"
                    >
                      新增預約
                    </button>
                  </div>
                </form>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">預約單號</th>
                      <th className="py-2.5 px-3">狀態</th>
                      <th className="py-2.5 px-3">預約日期與時段</th>
                      <th className="py-2.5 px-3">客戶姓名與手機/電話</th>
                      <th className="py-2.5 px-3">事由 / 服務項目</th>
                      <th className="py-2.5 px-3">備註 / 詳細情況</th>
                      <th className="py-2.5 px-3 text-right">操作管理</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredAppointments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-500">
                          目前沒有符合條件的預約訂單。您可以點擊上方「新增預約」或切換至「客戶線上預約前台」建立預約。
                        </td>
                      </tr>
                    ) : (
                      filteredAppointments.map((apt) => (
                        <tr key={apt.appointmentId} className="hover:bg-slate-800/30">
                          <td className="py-3 px-3 font-mono font-bold text-sky-300">
                            {apt.appointmentId}
                          </td>
                          <td className="py-3 px-3">
                            {renderStatusLabel(apt.status)}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-200 whitespace-nowrap">
                            {apt.date} <span className="text-sky-300 font-bold">{apt.timeSlot}</span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-100">{apt.clientName}</div>
                            <div className="text-[11px] font-mono text-slate-400">
                              {apt.clientPhone}
                              {apt.clientTel ? ` · 市話:${apt.clientTel}` : ''}
                              {apt.clientLine ? ` · Line:${apt.clientLine}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-300 max-w-xs">
                            {apt.reason || apt.serviceTitle}
                          </td>
                          <td className="py-3 px-3 text-slate-400 max-w-xs">
                            <div className="truncate">{apt.notes || '-'}</div>
                            {apt.detail && (
                              <div className="text-[11px] text-slate-500 truncate">{apt.detail}</div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap space-x-2">
                            {apt.status === 'PENDING' && (
                              <button
                                onClick={() => handleUpdateAptStatus(apt.appointmentId, 'CONFIRMED')}
                                className="px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[11px] font-medium cursor-pointer"
                              >
                                確認預約
                              </button>
                            )}
                            {(apt.status === 'PENDING' || apt.status === 'CONFIRMED') && (
                              <>
                                <button
                                  onClick={() => handleUpdateAptStatus(apt.appointmentId, 'COMPLETED')}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-medium cursor-pointer"
                                >
                                  完成服務
                                </button>
                                <button
                                  onClick={() => handleUpdateAptStatus(apt.appointmentId, 'CANCELLED')}
                                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] cursor-pointer"
                                >
                                  取消
                                </button>
                              </>
                            )}
                            {onNavigateToRegisterWithClient && (
                              <button
                                onClick={() =>
                                  onNavigateToRegisterWithClient({
                                    name: apt.clientName,
                                    phone: apt.clientPhone,
                                    line: apt.clientLine,
                                    sponsorMid: effectiveMid,
                                  })
                                }
                                className="px-2 py-1 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700 text-indigo-300 rounded text-[11px] font-medium cursor-pointer"
                              >
                                轉入 1+1 開通
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUBTAB 2: PUBLIC BOOKING PAGE PREVIEW */}
          {subTab === 'public_preview' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Public Profile & Service Selection */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                <div className="pb-4 border-b border-slate-800 space-y-1">
                  <div className="text-[11px] text-sky-400 font-mono">
                    對外開放預約前台 · {profile.licenseId}
                  </div>
                  <h3 className="text-lg font-bold text-slate-100">{profile.displayTitle}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{profile.bio}</p>
                </div>

                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-slate-300">
                    1. 選擇預約服務項目
                  </div>
                  {profile.services.filter((s) => s.isActive).length === 0 ? (
                    <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-500">
                      目前尚無開放中的服務項目，請至「服務項目與時段排班設定」新增服務。
                    </div>
                  ) : (
                    profile.services
                      .filter((s) => s.isActive)
                      .map((srv) => {
                        const isPicked = (selectedServiceId || profile.services.find((x) => x.isActive)?.id) === srv.id;
                        return (
                          <button
                            key={srv.id}
                            type="button"
                            onClick={() => setSelectedServiceId(srv.id)}
                            className={`w-full text-left p-3.5 rounded-lg border transition-colors cursor-pointer space-y-1.5 ${
                              isPicked
                                ? 'bg-slate-950 border-sky-500'
                                : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-100">{srv.title}</span>
                              <span className="text-xs font-mono text-emerald-400">
                                {srv.priceNtd === 0 ? '免費預約' : `$${srv.priceNtd} 元`}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2">
                              <span>{srv.durationMinutes} 分鐘</span>
                              <span aria-hidden="true">·</span>
                              <span>{renderLocationText(srv.locationType)}</span>
                            </div>
                            <p className="text-[11px] text-slate-500">{srv.description}</p>
                          </button>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Right: Date, Time Slot & Client Submission Form */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                {createdTicket && (
                  <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-700/60 space-y-1.5 text-xs">
                    <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>預約成功！預約單號：{createdTicket.appointmentId}</span>
                    </div>
                    <div className="text-slate-300">
                      已為客戶 <span className="font-bold">{createdTicket.clientName}</span> 保留 {createdTicket.date} {createdTicket.timeSlot} 時段，並同步寫入 CRM 聯繫追蹤日誌 (CONTACT_T)。
                    </div>
                  </div>
                )}

                <form onSubmit={handleBookAppointment} className="space-y-5">
                  {/* Step 2: Date Picker */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-300">
                      2. 選擇預約日期（依會員開放工作日自動生成）
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                      {getUpcomingDates(profile.workingDays).map((dateStr) => {
                        const d = new Date(dateStr + 'T00:00:00');
                        const isPicked = selectedDate === dateStr;
                        return (
                          <button
                            key={dateStr}
                            type="button"
                            onClick={() => {
                              setSelectedDate(dateStr);
                              setSelectedTimeSlot('');
                            }}
                            className={`p-2 rounded-lg border text-center transition-colors cursor-pointer ${
                              isPicked
                                ? 'bg-sky-600 border-sky-500 text-white font-bold'
                                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="text-[10px] opacity-80">{WEEKDAY_LABELS[d.getDay()]}</div>
                            <div className="text-xs font-mono mt-0.5">{dateStr.slice(5)}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 3: Time Slots */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-300">
                      3. 選擇可預約時段 ({selectedDate})
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {getTimeSlotsForDate(profile, selectedDate).map((slot) => {
                        const isPicked = selectedTimeSlot === slot.time;
                        return (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={slot.booked}
                            onClick={() => setSelectedTimeSlot(slot.time)}
                            className={`py-2 px-2 rounded-lg border text-xs font-mono transition-colors ${
                              slot.booked
                                ? 'bg-slate-950/30 border-slate-800/50 text-slate-600 line-through cursor-not-allowed'
                                : isPicked
                                ? 'bg-sky-600 border-sky-500 text-white font-bold cursor-pointer'
                                : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-sky-600 cursor-pointer'
                            }`}
                          >
                            {slot.time}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 4: Client Info */}
                  <div className="space-y-3 pt-3 border-t border-slate-800">
                    <div className="text-xs font-semibold text-slate-300">
                      4. 填寫預約人聯絡資訊
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <input
                        type="text"
                        required
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="姓名 *"
                        className="sm:col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                      />
                      <input
                        type="text"
                        required
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="手機 *"
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-sky-500"
                      />
                      <input
                        type="text"
                        value={clientTel}
                        onChange={(e) => setClientTel(e.target.value)}
                        placeholder="電話 (選填)"
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-sky-500"
                      />
                      <input
                        type="text"
                        value={clientReason}
                        onChange={(e) => setClientReason(e.target.value)}
                        placeholder="事由"
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                      />
                      <input
                        type="text"
                        value={clientNotes}
                        onChange={(e) => setClientNotes(e.target.value)}
                        placeholder="備註"
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <input
                      type="text"
                      value={clientDetail}
                      onChange={(e) => setClientDetail(e.target.value)}
                      placeholder="詳細情況..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isBookingExpiredReadOnly}
                    className={`w-full py-2.5 px-4 text-xs font-semibold rounded-lg transition-colors shadow-sm ${
                      isBookingExpiredReadOnly
                        ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        : 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer'
                    }`}
                  >
                    {isBookingExpiredReadOnly
                      ? '未續約唯讀中（僅查舊資料 · 續約 100 元解鎖新增）'
                      : '確認送出預約（自動登記至個人預約系統與 CONTACT_T）'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* SUBTAB 3: SERVICES & AVAILABILITY SETTINGS */}
          {subTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Profile & Working Hours */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                <form onSubmit={handleSaveProfileSettings} className="space-y-3 text-xs">
                  <h3 className="text-sm font-bold text-slate-100 pb-2 border-b border-slate-800">
                    個人預約頁面與開放時段設定
                  </h3>
                  <div>
                    <label className="block text-slate-400 mb-1">預約頁面標題</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">個人諮詢簡介</label>
                    <textarea
                      rows={3}
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg cursor-pointer transition-colors"
                  >
                    儲存頁首介紹
                  </button>
                </form>

                <div className="pt-4 border-t border-slate-800 space-y-3 text-xs">
                  <div className="font-semibold text-slate-200">每週開放預約星期：</div>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAY_LABELS.map((label, idx) => {
                      const active = profile.workingDays.includes(idx);
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => handleToggleWorkingDay(idx)}
                          className={`px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                            active
                              ? 'bg-sky-600 border-sky-500 text-white font-semibold'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div>
                      <label className="block text-slate-400 mb-1">開始時間</label>
                      <select
                        value={profile.startHour}
                        onChange={(e) => {
                          erpEngine.updateBookingProfile(effectiveMid, { startHour: Number(e.target.value) });
                          forceRefresh();
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 font-mono text-slate-200"
                      >
                        {[7, 8, 9, 10, 11, 12, 13, 14].map((h) => (
                          <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">結束時間</label>
                      <select
                        value={profile.endHour}
                        onChange={(e) => {
                          erpEngine.updateBookingProfile(effectiveMid, { endHour: Number(e.target.value) });
                          forceRefresh();
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 font-mono text-slate-200"
                      >
                        {[16, 17, 18, 19, 20, 21, 22].map((h) => (
                          <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">場次間隔</label>
                      <select
                        value={profile.slotIntervalMinutes}
                        onChange={(e) => {
                          erpEngine.updateBookingProfile(effectiveMid, { slotIntervalMinutes: Number(e.target.value) });
                          forceRefresh();
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 font-mono text-slate-200"
                      >
                        <option value={30}>30 分鐘</option>
                        <option value={60}>60 分鐘</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Services Manager */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                <h3 className="text-sm font-bold text-slate-100 pb-2 border-b border-slate-800">
                  管理個人預約服務項目 ({profile.services.length} 項)
                </h3>

                <div className="space-y-2.5">
                  {profile.services.map((srv) => (
                    <div
                      key={srv.id}
                      className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${srv.isActive ? 'text-slate-100' : 'text-slate-500 line-through'}`}>
                            {srv.title}
                          </span>
                          <span className="text-[11px] font-mono text-sky-400">
                            {srv.durationMinutes}分 · {srv.priceNtd === 0 ? '免費' : `$${srv.priceNtd}`}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {renderLocationText(srv.locationType)} · {srv.description}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            erpEngine.toggleBookingService(effectiveMid, srv.id);
                            forceRefresh();
                          }}
                          className={`px-2.5 py-1 rounded border cursor-pointer ${
                            srv.isActive
                              ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
                              : 'bg-slate-900 border-slate-700 text-slate-400'
                          }`}
                        >
                          {srv.isActive ? '開放中' : '已暫停'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            erpEngine.deleteBookingService(effectiveMid, srv.id);
                            forceRefresh();
                          }}
                          title="刪除服務"
                          className="p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add new service form */}
                <form onSubmit={handleAddService} className="pt-4 border-t border-slate-800 space-y-3 text-xs">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <PlusCircle className="w-4 h-4 text-sky-400" />
                    <span>新增預約服務項目</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      value={newSrvTitle}
                      onChange={(e) => setNewSrvTitle(e.target.value)}
                      placeholder="服務名稱 (如：AI 軟體實戰導入健檢)"
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                    <select
                      value={newSrvLocation}
                      onChange={(e) => setNewSrvLocation(e.target.value as BookingServiceItem['locationType'])}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                    >
                      <option value="ONLINE_MEET">線上視訊會議</option>
                      <option value="IN_PERSON">實體面談 / 門店</option>
                      <option value="PHONE">電話一對一諮詢</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">時長 (分鐘)</label>
                      <input
                        type="number"
                        min={15}
                        max={180}
                        value={newSrvDuration}
                        onChange={(e) => setNewSrvDuration(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">費用 (NTD，免費填 0)</label>
                      <input
                        type="number"
                        min={0}
                        value={newSrvPrice}
                        onChange={(e) => setNewSrvPrice(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-100"
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    value={newSrvDesc}
                    onChange={(e) => setNewSrvDesc(e.target.value)}
                    placeholder="服務內容簡述..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="submit"
                    disabled={isBookingExpiredReadOnly}
                    className={`px-4 py-2 font-semibold rounded-lg transition-colors ${
                      isBookingExpiredReadOnly
                        ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        : 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer'
                    }`}
                  >
                    {isBookingExpiredReadOnly ? '未續約唯讀 (禁新增服務)' : '新增至個人預約清單'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* SUBTAB 4: 3 AI SYSTEMS & 100 NTD CLOSED LOOP BILLING */}
          {subTab === 'billing' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  產銷合一三大 AI 系統規格與 100 元月租 100% 閉環平帳說明
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  新會員入會享有「1+1 AI 軟體」（第 1 套：通訊錄 CRM ＋ 第 2 套：活動行銷），另可獨立開通或連動體驗「第 3 種 AI 系統：個人預約系統」，同樣享有 30 天免費體驗與 100 元/月閉環清算。
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">系統分類</th>
                      <th className="py-3 px-4">核心功能定位</th>
                      <th className="py-3 px-4">體驗期規格</th>
                      <th className="py-3 px-4">續約月租費用</th>
                      <th className="py-3 px-4">閉環分潤撥發矩陣</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    <tr>
                      <td className="py-3 px-4 font-bold text-teal-400">第 1 種 AI 系統 · 通訊錄 CRM</td>
                      <td className="py-3 px-4 text-slate-300">通訊主檔 CM- 與聯繫追蹤 CT-（綁定單軌節點 C-00001 起）</td>
                      <td className="py-3 px-4 font-mono text-emerald-400">30 天免費體驗</td>
                      <td className="py-3 px-4 font-mono text-slate-100">100 元/月 (=100 點)</td>
                      <td className="py-3 px-4 font-mono text-slate-400">15+15+6+6+30+28 = 100 點</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold text-blue-400">第 2 種 AI 系統 · 活動行銷</td>
                      <td className="py-3 px-4 text-slate-300">活動企劃 EM- 與活動花絮 ET-（綁定雙軌節點 C-25000001 起）</td>
                      <td className="py-3 px-4 font-mono text-emerald-400">30 天免費體驗</td>
                      <td className="py-3 px-4 font-mono text-slate-100">100 元/月 (=100 點)</td>
                      <td className="py-3 px-4 font-mono text-slate-400">15+15+6+6+30+28 = 100 點</td>
                    </tr>
                    <tr className="bg-sky-950/20">
                      <td className="py-3 px-4 font-bold text-sky-400">第 3 種 AI 系統 · 個人預約系統</td>
                      <td className="py-3 px-4 text-slate-100 font-medium">個人線上預約網、時段排班、訂單管理 & CONTACT_T 連動</td>
                      <td className="py-3 px-4 font-mono text-emerald-400 font-bold">30 天免費體驗</td>
                      <td className="py-3 px-4 font-mono text-slate-100 font-bold">100 元/月 (=100 點)</td>
                      <td className="py-3 px-4 font-mono text-emerald-300">15+15+6+6+30+28 = 100 點</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div className="text-xs text-slate-400">
                  註：若第 3 種 AI 預約系統 30 天體驗期滿未續約，同樣適用 50% 熔斷安全機制。
                </div>
                <button
                  onClick={handleRenew100Ntd}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                >
                  立即繳付 100 元月租續約 (展延 30 天並觸發 100 點平帳)
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal: 100 NTD Closed Loop Renewal Receipt */}
      {renewalBreakdown && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/60 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    個人預約系統月租 100 元續約完成
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    授權已展延 30 天 · 100% 閉環平帳交易 {renewalBreakdown.transactionId}
                    {renewalBinaryNodeId ? ` · 雙軌節點 ${renewalBinaryNodeId}${renewalIsNewNode ? ' (新排入)' : ''}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRenewalBreakdown(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>15 代直推推薦分紅：</span>
                <span className="font-mono text-indigo-300">{renewalBreakdown.totalSponsorPoints.toFixed(1)} 點</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>15 代雙軌安置排線分紅：</span>
                <span className="font-mono text-blue-300">{renewalBreakdown.totalPlacementPoints.toFixed(1)} 點</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>6 代經營店輔導補貼：</span>
                <span className="font-mono text-teal-300">{renewalBreakdown.totalStorePoints.toFixed(1)} 點</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>6 代教育中心培訓補貼：</span>
                <span className="font-mono text-cyan-300">{renewalBreakdown.totalCenterPoints.toFixed(1)} 點</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>艾邦妮科技池 (30%) + 總公司營運池 (28%)：</span>
                <span className="font-mono text-purple-300">58.0 點</span>
              </div>
              {renewalBreakdown.publicSafetyPoolPoints > 0 && (
                <div className="flex justify-between text-amber-300">
                  <span>公共安全熔斷歸集池：</span>
                  <span className="font-mono">{renewalBreakdown.publicSafetyPoolPoints.toFixed(1)} 點</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-slate-100">
                <span>合計平帳撥發驗證：</span>
                <span className="font-mono text-emerald-400">{renewalBreakdown.totalDistributed} 點</span>
              </div>
            </div>

            <button
              onClick={() => setRenewalBreakdown(null)}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
            >
              完成確認
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
