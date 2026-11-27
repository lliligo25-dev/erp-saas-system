/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { erpEngine, GLOBAL_BOUNDARIES } from '../services/erpEngine';
import { 
  Member, 
  NodeRecord, 
  MemberFullNodeReport, 
  ContactMasterRecord, 
  ContactTrackingRecord,
  SettlementBreakdown
} from '../types/erp';
import {
  User,
  Users,
  Sparkles,
  Layers,
  GitFork,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Search,
  LogIn,
  LogOut,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Building2,
  GraduationCap,
  Store,
  Share2,
  Copy,
  Check,
  ChevronRight,
  Edit3,
  FileText,
  Activity,
  PlusCircle,
  HelpCircle,
  CalendarClock,
  Award,
  ListTodo,
  RefreshCw,
  ShoppingBag,
  FolderOpen,
  Table,
  Lock,
  Unlock,
  CreditCard,
  Eye,
} from 'lucide-react';
import { PersonalTodoBoard } from './PersonalTodoBoard';
import { ScopedQrCodeCard } from './ScopedQrCodeCard';
import { MemberCloudSheetViewer } from './MemberCloudSheetViewer';
import {
  getMemberTodos,
  getOverdueCount,
  getDueTodayCount,
  TODOS_UPDATED_EVENT,
} from '../services/gasTodoSyncService';
import {
  syncMemberPurchasedProductsToNodes,
  getPurchasedProductNodeEntries,
  PurchasedProductNodeEntry,
  NODES_UPDATED_EVENT,
} from '../services/softwareNodeSync';
import {
  getMemberModuleSubscriptions,
  saveMemberModuleSubscriptions,
} from '../services/memberFiveStarConfig';
import {
  CLOUD_VAULT_UPDATED_EVENT,
  ensureMemberCloudWorkspace,
  getModuleWritePermission,
  isRealGoogleFolderId,
  isRealGoogleSheetId,
  isSafeGoogleCloudUrl,
  MemberCloudWorkspace,
  notifyCloudVaultUpdated,
  renewMemberModuleNow,
  syncMemberCloudWorkspaceWithGas,
} from '../services/memberCloudVaultService';

interface MemberPortalViewProps {
  initialMid?: string;
  scopedMode?: boolean;
  onNavigateToTree?: (nodeId?: string) => void;
  onNavigateToMonoline?: () => void;
  onNavigateToRegisterWithSponsor?: (sponsorMid: string) => void;
  onNavigateToStorePortal?: (storeId: string) => void;
  onNavigateToCenterPortal?: (centerId: string) => void;
  onNavigateToSettlement?: (nodeId: string) => void;
  onNavigateToCrmEvents?: () => void;
  onNavigateToBooking?: () => void;
}

export const MemberPortalView: React.FC<MemberPortalViewProps> = ({
  initialMid,
  scopedMode = false,
  onNavigateToTree,
  onNavigateToMonoline,
  onNavigateToRegisterWithSponsor,
  onNavigateToStorePortal,
  onNavigateToCenterPortal,
  onNavigateToSettlement,
  onNavigateToCrmEvents,
  onNavigateToBooking,
}) => {
  // Current logged in member MID
  const [currentMid, setCurrentMid] = useState<string>(() => {
    if (initialMid) return initialMid;
    const saved = localStorage.getItem('ais_member_login_mid');
    return saved || GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID;
  });

  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    if (initialMid && initialMid !== currentMid) {
      setCurrentMid(initialMid);
      setAvatarError(false);
    }
  }, [initialMid]);

  const [loginInput, setLoginInput] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'todos' | 'team' | 'wallet' | 'crm_logs' | 'relations' | 'share'>('dashboard');
  const [todoRefreshTick, setTodoRefreshTick] = useState(0);
  const [nodesRefreshTick, setNodesRefreshTick] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isAddLogModalOpen, setIsAddLogModalOpen] = useState(false);

  // Profile edit fields
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editTel, setEditTel] = useState('');
  const [editLine, setEditLine] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');

  // Quick Tracking Log fields
  const [newLogMethod, setNewLogMethod] = useState('線上諮詢');
  const [newLogDiscussion, setNewLogDiscussion] = useState('');
  const [newLogNextPlan, setNewLogNextPlan] = useState('');

  // Renew notice state
  const [renewResult, setRenewResult] = useState<SettlementBreakdown | null>(null);

  // Per-member Cloud Drive & Spreadsheet Vault states + Inline Notice
  const [cloudTick, setCloudTick] = useState(0);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [copiedVaultField, setCopiedVaultField] = useState<string | null>(null);
  const [inlineNotice, setInlineNotice] = useState<{
    type: 'success' | 'warning' | 'info';
    text: string;
  } | null>(null);

  const showNotice = (type: 'success' | 'warning' | 'info', text: string) => {
    setInlineNotice({ type, text });
    window.setTimeout(() => {
      setInlineNotice((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };
  const [previewSheetTab, setPreviewSheetTab] = useState<string | null>(null);

  useEffect(() => {
    if (currentMid) {
      syncMemberPurchasedProductsToNodes(currentMid);
      ensureMemberCloudWorkspace(currentMid);
      setNodesRefreshTick((t) => t + 1);
      setCloudTick((t) => t + 1);
    }
  }, [currentMid]);

  useEffect(() => {
    const handleNodesUpdated = (ev: Event) => {
      const customEv = ev as CustomEvent<{ memberMid?: string }>;
      if (!customEv.detail?.memberMid || customEv.detail.memberMid === currentMid) {
        syncMemberPurchasedProductsToNodes(currentMid);
        ensureMemberCloudWorkspace(currentMid);
        setNodesRefreshTick((t) => t + 1);
        setCloudTick((t) => t + 1);
      }
    };
    window.addEventListener(NODES_UPDATED_EVENT, handleNodesUpdated);
    return () => window.removeEventListener(NODES_UPDATED_EVENT, handleNodesUpdated);
  }, [currentMid]);

  useEffect(() => {
    const handleCloudUpdated = (ev: Event) => {
      const customEv = ev as CustomEvent<{ memberMid?: string }>;
      if (!customEv.detail?.memberMid || customEv.detail.memberMid === currentMid) {
        setCloudTick((t) => t + 1);
      }
    };
    window.addEventListener(CLOUD_VAULT_UPDATED_EVENT, handleCloudUpdated);
    return () => window.removeEventListener(CLOUD_VAULT_UPDATED_EVENT, handleCloudUpdated);
  }, [currentMid]);

  useEffect(() => {
    const handleTodosUpdated = (ev: Event) => {
      const customEv = ev as CustomEvent<{ memberMid?: string }>;
      if (!customEv.detail?.memberMid || customEv.detail.memberMid === currentMid) {
        setTodoRefreshTick((t) => t + 1);
        setCloudTick((t) => t + 1);
      }
    };
    window.addEventListener(TODOS_UPDATED_EVENT, handleTodosUpdated);
    return () => window.removeEventListener(TODOS_UPDATED_EVENT, handleTodosUpdated);
  }, [currentMid]);

  const purchasedProductMap = React.useMemo(() => {
    const entries = getPurchasedProductNodeEntries(currentMid);
    const map = new Map<string, PurchasedProductNodeEntry>();
    entries.forEach((e) => map.set(e.nodeId, e));
    return map;
  }, [currentMid, nodesRefreshTick]);

  // Load report for current MID
  const report: MemberFullNodeReport | null = React.useMemo(
    () => erpEngine.getMemberFullNodeReport(currentMid),
    [currentMid, nodesRefreshTick, isRenewModalOpen]
  );
  const currentMember: Member | undefined = report?.member || erpEngine.getMemberById(currentMid);

  // All members for fast switcher
  const allMembers = erpEngine.getAllMembers();

  // 若目前選取的編號不存在（例如純淨正式環境尚未開通 A-00001），自動對齊首位真實會員或旗艦錨點
  useEffect(() => {
    if (!currentMember && allMembers.length > 0) {
      const firstReal = allMembers.find((m) => m.mid !== GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID) || allMembers[0];
      if (firstReal && firstReal.mid !== currentMid) {
        setCurrentMid(firstReal.mid);
      }
    }
  }, [currentMember, allMembers, currentMid]);


  // Save logged in MID to localStorage
  useEffect(() => {
    if (currentMid) {
      localStorage.setItem('ais_member_login_mid', currentMid);
    }
  }, [currentMid]);

  // Handle Login submission
  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = loginInput.trim();
    if (!q) return;

    const found = erpEngine.findMemberByMidOrNode(q);
    if (found && found.member) {
      setCurrentMid(found.member.mid);
      setLoginInput('');
    } else {
      // Try search by phone or name
      const byPhoneOrName = allMembers.find(
        (m) =>
          m.phone.includes(q) ||
          m.name.includes(q) ||
          (m.line && m.line.toLowerCase() === q.toLowerCase()) ||
          m.mid.toLowerCase().includes(q.toLowerCase())
      );
      if (byPhoneOrName) {
        setCurrentMid(byPhoneOrName.mid);
        setLoginInput('');
      } else {
        showNotice('warning', '查無此會員資料！請確認輸入的 MID (如 A-00001)、手機、姓名或節點代號。');
      }
    }
  };

  // Switch to specific MID
  const handleSwitchMember = (mid: string) => {
    const mem = erpEngine.getMemberById(mid);
    if (mem) {
      setCurrentMid(mid);
    } else {
      const found = erpEngine.findMemberByMidOrNode(mid);
      if (found && found.member) {
        setCurrentMid(found.member.mid);
      }
    }
  };

  // Open profile modal
  const handleOpenEditProfile = () => {
    if (!currentMember) return;
    setEditName(currentMember.name);
    setEditPhone(currentMember.phone || '');
    setEditTel(currentMember.tel || '');
    setEditLine(currentMember.line || '');
    setEditEmail(currentMember.email || '');
    setEditAddress(currentMember.address || '');
    setEditPhotoUrl(currentMember.photoUrl || '');
    setIsEditProfileModalOpen(true);
  };

  // Save profile updates
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMember) return;

    erpEngine.updateMemberProfile(currentMember.mid, {
      name: editName.trim(),
      phone: editPhone.trim(),
      tel: editTel.trim(),
      line: editLine.trim(),
      email: editEmail.trim(),
      address: editAddress.trim(),
      photoUrl: editPhotoUrl.trim(),
    });

    setIsEditProfileModalOpen(false);
    showNotice('success', '個人通訊資料更新成功，已同步至 Google Sheets 通訊主檔 (CONTACT_M)！');
  };

  // Execute 30-Day Renewal (100 NTD 100% Closed Loop)
  const handleExecuteRenewal = () => {
    if (!currentMember) return;
    const res = erpEngine.renewMemberMonthlyFee(currentMember.mid);
    if (res) {
      const refreshedMem = erpEngine.getMemberById(currentMember.mid);
      const nextExp = refreshedMem?.trialExpiresAt || new Date(Date.now() + 30 * 86400000).toISOString();
      const subs = getMemberModuleSubscriptions(currentMember.mid, nextExp);
      ['CONTACT', 'EVENT'].forEach((k) => {
        if (subs[k]) {
          subs[k] = {
            ...subs[k],
            status: 'ACTIVE_RENEWED',
            expiresAt: nextExp,
            totalRenewalsCount: (subs[k].totalRenewalsCount || 0) + (k === 'CONTACT' ? 1 : 0),
            lastSettlementTxnId: res.transactionId,
          };
        }
      });
      saveMemberModuleSubscriptions(currentMember.mid, subs);
      ensureMemberCloudWorkspace(currentMember.mid);
      notifyCloudVaultUpdated(currentMember.mid);
      setRenewResult(res);
      setIsRenewModalOpen(true);
      setNodesRefreshTick((t) => t + 1);
      setCloudTick((t) => t + 1);
      showNotice('success', '已完成 100 元自主續約 (+30 天)，已解除 1+1 AI 軟體唯讀限制！');
    } else {
      showNotice('warning', '續約失敗，請確認節點狀態。');
    }
  };

  // Add CRM Tracking Log
  const handleSaveTrackingLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMember) return;
    const perm = getModuleWritePermission(currentMember.mid, 'CONTACT');
    if (!perm.canCreate) {
      setIsAddLogModalOpen(false);
      showNotice('warning', perm.readOnlyReason || '通訊錄 CRM 尚未續約，僅能查看歷史日誌，不能新增聯繫紀錄。');
      return;
    }

    erpEngine.addContactTracking({
      status: '已聯繫',
      name: currentMember.name,
      contactDate: new Date().toISOString().split('T')[0],
      contactMethod: newLogMethod,
      discussionContent: newLogDiscussion || '會員自主於會員登入中心回報諮詢內容。',
      nextStepPlan: newLogNextPlan || '持續輔導並引導參與近期線上/實體活動。',
      contactId: currentMember.contactId,
      memberMid: currentMember.mid,
      photoUrl: currentMember.photoUrl,
    });

    setIsAddLogModalOpen(false);
    setNewLogDiscussion('');
    setNewLogNextPlan('');
    ensureMemberCloudWorkspace(currentMember.mid);
    setCloudTick((t) => t + 1);
    showNotice('success', '聯繫紀錄已成功寫入 Google Sheets 聯繫紀錄檔 (CONTACT_T)！');
  };

  // Copy referral invitation
  const handleCopyInvitation = () => {
    if (!currentMember) return;
    const text = `【產銷合一 SaaS ERP 邀請開通】\n我是 ${currentMember.name}（推薦人 MID：${currentMember.mid}），誠摯邀請您開通 AI 軟體 1+1 雙重體驗！\n同時享有：\n1. 第 1 套 AI 軟體：通訊錄 CRM（通訊主檔與聯繫紀錄，綁定單軌 15 代公排）\n2. 第 2 套 AI 軟體：活動行銷（活動企劃與花絮行銷，綁定雙軌二元樹）\n3. 免費贈送 30 天 2 套 1+1 AI 軟體完整體驗！\n請於入會開通時填寫直推推薦人 MID: ${currentMember.mid}`;
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Calculate Trial Days remaining
  const calculateDaysRemaining = (expireIso?: string): { days: number; isExpired: boolean; label: string } => {
    if (!expireIso) return { days: 0, isExpired: true, label: '已過期' };
    const now = new Date().getTime();
    const exp = new Date(expireIso).getTime();
    const diff = exp - now;
    const days = Math.ceil(diff / (24 * 3600 * 1000));
    if (days <= 0) {
      return { days: 0, isExpired: true, label: '已過期 (觸發 50% 熔斷)' };
    }
    return { days, isExpired: false, label: `剩餘 ${days} 天` };
  };

  const trialStatus = calculateDaysRemaining(currentMember?.trialExpiresAt);

  // CRM Contacts & Trackings for this member
  const memberTrackings = currentMember
    ? erpEngine.getAllContactTrackings().filter((t) => t.memberMid === currentMember.mid || t.name === currentMember.name)
    : [];

  // Associated Store & Center info
  const memberStore = currentMember ? erpEngine.getStoreById(currentMember.storeId) : undefined;
  const memberCenter = currentMember ? erpEngine.getCenterById(currentMember.centerId) : undefined;
  const sponsorMember = currentMember && currentMember.sponsorMid !== 'HQ_ROOT' 
    ? erpEngine.getMemberById(currentMember.sponsorMid) 
    : undefined;

  // Booking profile (3rd AI System) for this member
  const bookingProfile = erpEngine.getBookingProfile(currentMid);
  const bookingAppointmentsCount = bookingProfile
    ? erpEngine.getAppointmentsByOwner(currentMid).length
    : 0;

  // Personal TODO stats for this member (synchronized with TODO_T & GAS)
  const memberTodosCount = React.useMemo(
    () => getMemberTodos(currentMid).length,
    [currentMid, todoRefreshTick, activeTab]
  );
  const overdueTodosCount = React.useMemo(
    () => getOverdueCount(currentMid),
    [currentMid, todoRefreshTick, activeTab]
  );
  const dueTodayTodosCount = React.useMemo(
    () => getDueTodayCount(currentMid),
    [currentMid, todoRefreshTick, activeTab]
  );

  // 開機浮貼逾期提醒：登入/啟動時若有逾期個人待辦，浮貼顯示 10 秒後自動消失
  const [overdueToastSecondsLeft, setOverdueToastSecondsLeft] = useState<number>(0);
  const overdueToastShownMidRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (overdueTodosCount <= 0) {
      setOverdueToastSecondsLeft(0);
      return;
    }
    if (overdueToastShownMidRef.current === currentMid) return;
    overdueToastShownMidRef.current = currentMid;
    setOverdueToastSecondsLeft(10);
  }, [currentMid, overdueTodosCount]);

  const showOverdueStartupToast =
    overdueToastSecondsLeft > 0 && overdueTodosCount > 0 && activeTab !== 'todos';

  useEffect(() => {
    if (!showOverdueStartupToast) return;
    const timer = window.setInterval(() => {
      setOverdueToastSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [showOverdueStartupToast]);

  const cloudVault: MemberCloudWorkspace = React.useMemo(
    () => ensureMemberCloudWorkspace(currentMid),
    [currentMid, cloudTick, nodesRefreshTick, todoRefreshTick, isRenewModalOpen]
  );
  const contactWritePerm = React.useMemo(
    () => getModuleWritePermission(currentMid, 'CONTACT'),
    [currentMid, cloudTick, isRenewModalOpen]
  );
  const expiredCloudModulesCount = React.useMemo(() => {
    const keys = new Set<string>();
    cloudVault.sheetTabs.forEach((t) => {
      if (!t.canCreate && t.isExpired) keys.add(t.moduleKey);
    });
    return keys.size;
  }, [cloudVault]);

  const handleCopyVaultValue = (key: string, val: string, label: string) => {
    navigator.clipboard.writeText(val);
    setCopiedVaultField(key);
    showNotice('info', `已複製「${label}」：${val}`);
    setTimeout(() => setCopiedVaultField((prev) => (prev === key ? null : prev)), 2000);
  };

  const handleSyncCloudVaultToGas = async () => {
    setCloudSyncing(true);
    const res = await syncMemberCloudWorkspaceWithGas(currentMid);
    setCloudTick((t) => t + 1);
    setCloudSyncing(false);
    showNotice(res.success ? 'success' : 'warning', res.message);
  };


  const handleOneClickRenewModule = (moduleKey: string) => {
    const res = renewMemberModuleNow(currentMid, moduleKey);
    setCloudTick((t) => t + 1);
    setNodesRefreshTick((t) => t + 1);
    showNotice('success', res.message);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Scoped Header or HQ Fast Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="text-indigo-300 font-semibold">會員個人專屬戰情室</span>
                <span aria-hidden="true">·</span>
                <span>{scopedMode ? '僅顯示本人專屬權限資料' : '總部檢視與身分切換'}</span>
              </div>
              <h1 className="text-xl font-bold text-slate-100 mt-0.5">
                {currentMember ? `${currentMember.name} (${currentMember.mid})` : '會員登入系統'}
              </h1>
            </div>
          </div>

          {/* Quick Login Input form (Hidden in scopedMode so member cannot switch to other members) */}
          {!scopedMode ? (
            <form onSubmit={handleLogin} className="flex items-center gap-2 max-w-md w-full">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  placeholder="輸入 MID (如 A-00001)、手機、姓名或節點代號"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>切換登入</span>
              </button>
            </form>
          ) : (
            onNavigateToBooking && (
              <button
                onClick={onNavigateToBooking}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <CalendarClock className="w-4 h-4" />
                <span>開啟第 3 種 AI 個人預約系統</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Inline Feedback Notice Banner */}
      {inlineNotice && (
        <div
          className={`rounded-xl px-4 py-3 border text-xs flex items-center justify-between gap-3 ${
            inlineNotice.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-700/70 text-emerald-200'
              : inlineNotice.type === 'warning'
              ? 'bg-amber-950/50 border-amber-700/70 text-amber-200'
              : 'bg-indigo-950/50 border-indigo-700/70 text-indigo-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {inlineNotice.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{inlineNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setInlineNotice(null)}
            className="opacity-70 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Startup Floating Overdue Todo Toast (Auto-Dismiss in 10s) */}
      {showOverdueStartupToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] w-[calc(100%-1.5rem)] max-w-xl pointer-events-auto"
        >
          <div className="bg-rose-950/95 backdrop-blur-md border border-rose-600/80 shadow-2xl rounded-2xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs text-rose-100 min-w-0">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-rose-100">個人待辦逾期提醒</span>
                  <span className="text-[11px] font-mono font-bold text-rose-200 bg-rose-900/80 border border-rose-700 px-1.5 py-0.5 rounded-md">
                    {overdueToastSecondsLeft} 秒後自動關閉
                  </span>
                </div>
                <p className="leading-relaxed text-rose-200">
                  您目前有 <span className="font-bold text-rose-100">{overdueTodosCount} 項</span>待辦任務已超過截止時間
                  {dueTodayTodosCount > 0 ? `（另有 ${dueTodayTodosCount} 項今日到期）` : ''}，可前往個人待辦任務面板調整進度並同步 GAS 後端。
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={() => {
                  setOverdueToastSecondsLeft(0);
                  setActiveTab('todos');
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shrink-0 cursor-pointer transition-colors"
              >
                開啟個人待辦任務面板 →
              </button>
              <button
                type="button"
                aria-label="關閉提醒"
                onClick={() => setOverdueToastSecondsLeft(0)}
                className="px-2 py-1 rounded-lg text-rose-300 hover:text-white hover:bg-rose-900/80 cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Member Profile & Identity Header Card */}
      {currentMember && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-xl p-6 shadow-md relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left: Avatar & Profile Info */}
            <div className="flex items-start sm:items-center gap-4">
              <div className="relative">
                {currentMember.photoUrl && !avatarError ? (
                  <img
                    src={currentMember.photoUrl}
                    alt={currentMember.name}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-indigo-500/60 shadow-lg"
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-indigo-950 border-2 border-indigo-500/60 flex items-center justify-center text-2xl font-bold text-indigo-300 shadow-lg">
                    {currentMember.name.slice(0, 1)}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-indigo-600 text-[10px] font-bold text-white rounded-md border border-slate-900">
                  {currentMember.contactId || 'CM'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-100">{currentMember.name}</h2>
                  <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 text-xs font-mono font-bold border border-indigo-800">
                    {currentMember.mid}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono">
                    {currentMember.idNumberMasked}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                  <div className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-mono text-slate-300">{currentMember.phone}</span>
                  </div>
                  {currentMember.line && (
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-bold text-emerald-400">Line:</span>
                      <span className="font-mono text-emerald-300">{currentMember.line}</span>
                    </div>
                  )}
                  {currentMember.email && (
                    <div className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-300">{currentMember.email}</span>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 flex items-center gap-1 pt-0.5">
                  <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="line-clamp-1">{currentMember.address || '台灣生活圈 (已開通AI軟體1+1體驗)'}</span>
                </div>
              </div>
            </div>

            {/* Right: 30-Day AI Software Trial Status & 100 NTD Renewal Action */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-3 shrink-0">
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 text-right space-y-1 w-full sm:w-auto">
                <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    AI 軟體 30 天體驗狀態：
                  </span>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                    trialStatus.isExpired
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}>
                    {trialStatus.label}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  有效期限至：<span className="font-mono text-slate-400">{new Date(currentMember.trialExpiresAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleOpenEditProfile}
                  className="flex-1 sm:flex-none px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700/80"
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>編輯個人通訊檔</span>
                </button>

                <button
                  onClick={handleExecuteRenewal}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>自主續約 100 元 (展延30天)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs navigation */}
      <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto scrollbar-none pb-px text-xs font-medium">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`py-2.5 px-4 rounded-t-lg transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-slate-900 text-indigo-400 border-t-2 border-indigo-500 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>個人總覽 & 1+1 節點</span>
        </button>

        <button
          onClick={() => setActiveTab('todos')}
          className={`py-2.5 px-4 rounded-t-lg transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'todos'
              ? 'bg-slate-900 text-indigo-400 border-t-2 border-indigo-500 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <ListTodo className="w-3.5 h-3.5 text-amber-400" />
          <span>個人待辦任務面板 ({memberTodosCount})</span>
          {overdueTodosCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold">
              {overdueTodosCount} 逾期
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('team')}
          className={`py-2.5 px-4 rounded-t-lg transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'team'
              ? 'bg-slate-900 text-indigo-400 border-t-2 border-indigo-500 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>直推下線與組織團隊 ({report?.referrals.directReferralMembers.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('wallet')}
          className={`py-2.5 px-4 rounded-t-lg transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'wallet'
              ? 'bg-slate-900 text-indigo-400 border-t-2 border-indigo-500 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>分潤收益錢包 (${report?.financialSummary.totalEarningsFromAllNodes.toFixed(1) || '0.0'})</span>
        </button>

        <button
          onClick={() => setActiveTab('crm_logs')}
          className={`py-2.5 px-4 rounded-t-lg transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'crm_logs'
              ? 'bg-slate-900 text-indigo-400 border-t-2 border-indigo-500 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>CRM 聯繫日誌 ({memberTrackings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('relations')}
          className={`py-2.5 px-4 rounded-t-lg transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'relations'
              ? 'bg-slate-900 text-indigo-400 border-t-2 border-indigo-500 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>推薦人·經營店·教育中心</span>
        </button>

        <button
          onClick={() => setActiveTab('share')}
          className={`py-2.5 px-4 rounded-t-lg transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'share'
              ? 'bg-slate-900 text-indigo-400 border-t-2 border-indigo-500 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <Share2 className="w-3.5 h-3.5 text-sky-400" />
          <span>推廣專屬名片 & 邀請開通</span>
        </button>
      </div>

      {/* TAB 1: DASHBOARD & 1+1 NODES */}
      {activeTab === 'dashboard' && report && (
        <div className="space-y-6">
          {/* 1+1 Core Twin AI Software Nodes Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Node 1: Monoline Public Placement */}
            <div className="bg-slate-900 border border-teal-900/50 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-teal-900/40">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-950 border border-teal-700/60 flex items-center justify-center text-teal-400">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">第 1 套 AI 軟體 · 通訊錄 CRM (單軌節點)</h3>
                      <p className="text-[11px] text-teal-400 font-mono">通訊主檔 CM + 聯繫紀錄 CT · 綁定公排</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-teal-300 bg-teal-950/80 px-2.5 py-1 rounded border border-teal-800">
                    {report.monolineAid.nodeId}
                  </span>
                </div>

                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400">安置前席 (Parent Node)：</span>
                    <span className="font-mono text-teal-300 font-bold">
                      {report.ownedMonolineNodes[0]?.parentId || 'HQ_ROOT'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400">單軌隊列順位 (Depth)：</span>
                    <span className="font-mono text-slate-200">
                      第 {report.ownedMonolineNodes[0]?.depth || 1} 席
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400">累計互助分紅收益：</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      ${report.financialSummary.monolineEarnings.toFixed(1)} 點
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-teal-950/30 border border-teal-900/40 text-[11px] text-teal-300 leading-relaxed">
                    ★ 享有向上 15 代公排互助權益。當後續時間序列新夥伴註冊入會並續約時，將自動向上撥發公排分潤。
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  向上互助節點：{report.monolineAid.upstream15Nodes.length} 代
                </span>
                {!scopedMode && onNavigateToMonoline && (
                  <button
                    onClick={onNavigateToMonoline}
                    className="text-xs text-teal-400 hover:text-teal-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>在單軌公排隊列中查看</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Node 2: Binary BFS Placement */}
            <div className="bg-slate-900 border border-blue-900/50 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-blue-900/40">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-700/60 flex items-center justify-center text-blue-400">
                      <GitFork className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">第 2 套 AI 軟體 · 活動行銷 (雙軌節點)</h3>
                      <p className="text-[11px] text-blue-400 font-mono">活動企劃 EM + 活動花絮 ET · 綁定二元樹</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-300 bg-blue-950/80 px-2.5 py-1 rounded border border-blue-800">
                    {report.binaryDownline.rootNodeId}
                  </span>
                </div>

                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400">BFS 安置父節點 (Parent ID)：</span>
                    <span className="font-mono text-blue-300 font-bold">
                      {report.ownedBinaryNodes[0]?.parentId || GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400">滑落區域與樹層級 (Depth)：</span>
                    <span className="font-mono text-amber-300 font-bold">
                      {report.ownedBinaryNodes[0]?.placementPosition === 'L' ? '左區 (Left)' : '右區 (Right)'}
                      <span className="text-slate-400 font-normal ml-1">· Depth {report.ownedBinaryNodes[0]?.depth || 1}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400">二元樹傘下組織規模：</span>
                    <span className="font-mono text-slate-200">
                      左區 {report.binaryDownline.leftLegNodes.length} 席 · 右區 {report.binaryDownline.rightLegNodes.length} 席 (共 {report.binaryDownline.totalDownlineCount} 席)
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-blue-950/30 border border-blue-900/40 text-[11px] text-blue-300 leading-relaxed">
                    ★ 以定海神針 <span className="font-mono text-indigo-300">C-25000001</span> 為根，享有 15 代二元樹安置滑落分紅（每代 1.0 點）。
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  傘下最大縱深：{report.binaryDownline.maxDepthUnder} 層
                </span>
                {!scopedMode && onNavigateToTree && (
                  <button
                    onClick={() => onNavigateToTree(report.binaryDownline.rootNodeId)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>在雙軌二元樹圖中定位</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3rd AI System: Personal Booking System Card */}
          <div className="bg-slate-900 border border-sky-900/50 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-950 border border-sky-700/60 flex items-center justify-center text-sky-400 shrink-0">
                <CalendarClock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <h3 className="text-sm font-bold text-slate-100">
                    第 3 種 AI 系統 · 個人預約系統
                  </h3>
                  <span className="text-slate-500">·</span>
                  <span className="font-mono text-sky-300 font-semibold">
                    {bookingProfile ? bookingProfile.licenseId : '尚未開通'}
                  </span>
                  {bookingProfile?.binaryNodeId && (
                    <>
                      <span className="text-slate-500">·</span>
                      {!scopedMode && onNavigateToTree ? (
                        <button
                          type="button"
                          onClick={() => onNavigateToTree(bookingProfile.binaryNodeId)}
                          className="font-mono text-[11px] px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700/70 text-indigo-300 hover:text-indigo-200 cursor-pointer"
                        >
                          雙軌節點 {bookingProfile.binaryNodeId} →
                        </button>
                      ) : (
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700/70 text-indigo-300">
                          雙軌節點 {bookingProfile.binaryNodeId}
                        </span>
                      )}
                    </>
                  )}
                  <span className="text-slate-500">·</span>
                  <span className="text-emerald-400 font-medium">30 天免費體驗 · 月租 100 元</span>
                </div>
                <p className="text-xs text-slate-400">
                  {bookingProfile
                    ? `服務頁：${bookingProfile.displayTitle} · 已建立 ${bookingProfile.services.filter((s) => s.isActive).length} 項服務 · 累計預約 ${bookingAppointmentsCount} 筆`
                    : '提供個人對外線上預約時段排班、服務價目與客戶訂單同步入庫 CONTACT_T，立即開通贈送 30 天免費體驗。'}
                </p>
              </div>
            </div>
            {onNavigateToBooking && (
              <button
                onClick={onNavigateToBooking}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>{bookingProfile ? '進入個人預約工作台 →' : '立即免費開通 30 天體驗 →'}</span>
              </button>
            )}
          </div>

          {/* Personal Todo Panel Quick Reminder Banner */}
          <div
            className={`border rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              overdueTodosCount > 0
                ? 'bg-rose-950/30 border-rose-800/70'
                : 'bg-slate-900 border-amber-900/40'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${
                  overdueTodosCount > 0
                    ? 'bg-rose-950 border-rose-700/70 text-rose-400'
                    : 'bg-amber-950 border-amber-700/60 text-amber-400'
                }`}
              >
                <ListTodo className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <h3 className="text-sm font-bold text-slate-100">
                    個人待辦任務面板 (TODO_T · GAS 同步)
                  </h3>
                  <span className="font-mono text-indigo-300 font-semibold">
                    共 {memberTodosCount} 項任務
                  </span>
                  {overdueTodosCount > 0 && (
                    <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold">
                      {overdueTodosCount} 項已逾期提醒
                    </span>
                  )}
                  {dueTodayTodosCount > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-600 text-white text-[10px] font-bold">
                      {dueTodayTodosCount} 項今日到期
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  支援任務新增、「待處理 / 處理中 / 已完成」拖曳切換狀態、逾期預警與 Google Apps Script 後端即時同步。
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('todos')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>開啟個人待辦任務面板 →</span>
            </button>
          </div>

          {/* Member Independent Google Drive Cloud Folder & Google Spreadsheet Card */}
          {(() => {
            const hasRealSheet =
              isRealGoogleSheetId(cloudVault.spreadsheetId) &&
              isSafeGoogleCloudUrl(cloudVault.spreadsheetUrl);
            const hasRealFolder =
              isRealGoogleFolderId(cloudVault.folderId) &&
              isSafeGoogleCloudUrl(cloudVault.folderUrl);
            const defaultPreviewSys =
              cloudVault.sheetTabs.find((t) => t.recordCount > 0)?.sysType ||
              cloudVault.sheetTabs[0]?.sysType ||
              'CONTACT_M';

            return (
          <div className="bg-slate-900 border border-indigo-800/60 rounded-xl p-5 space-y-4 shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-950 border border-indigo-700/70 flex items-center justify-center text-indigo-400 shrink-0">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-100">
                      會員專屬 Google 雲端資料夾 & 獨立試算表（一戶一庫自動生成）
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        hasRealSheet
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                          : 'bg-amber-950 text-amber-300 border-amber-700'
                      }`}
                    >
                      {hasRealSheet
                        ? '已連結真實 Google 試算表'
                        : '點擊試算表 ID 即可於系統內預覽'}
                    </span>
                    {expiredCloudModulesCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>{expiredCloudModulesCount} 套未續約（唯讀舊檔 · 禁新增）</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    會員專屬 Google 試算表全程鎖定為<strong className="text-rose-300">「僅供檢視（不可直接修改）」</strong>，點擊下方<strong className="text-emerald-300">試算表 ID</strong> 或任一分頁即可即時查閱；所有新增與維護統一於系統畫面操作，未續約模組亦禁止系統新增。
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={cloudSyncing}
                onClick={handleSyncCloudVaultToGas}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cloudSyncing ? 'animate-spin' : ''}`} />
                <span>
                  {cloudSyncing
                    ? '建立並同步 Google 試算表中...'
                    : hasRealSheet
                    ? '同步最新資料至 Google 試算表'
                    : '一鍵建立真實 Google 試算表並同步'}
                </span>
              </button>
            </div>

            {/* Folder & Spreadsheet Metadata Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4" />
                    <span>專屬雲端資料夾 (Google Drive Folder)</span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-400 truncate max-w-[140px]">
                    {cloudVault.folderId}
                  </span>
                </div>
                <div className="font-semibold text-slate-100 truncate">{cloudVault.folderName}</div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  {hasRealFolder ? (
                    <a
                      href={cloudVault.folderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>開啟 Google 雲端資料夾</span>
                    </a>
                  ) : (
                    <span className="text-[11px] text-amber-300/90">
                      本機索引代碼（按右上按鈕可建立真實 Drive 資料夾）
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyVaultValue(
                        'folderUrl',
                        hasRealFolder ? cloudVault.folderUrl : cloudVault.folderId,
                        hasRealFolder ? '專屬資料夾連結' : '專屬資料夾索引代碼'
                      )
                    }
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedVaultField === 'folderUrl' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>複製</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-950/80 border border-emerald-800/60 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <Table className="w-4 h-4" />
                    <span>獨立 Google 試算表 (Spreadsheet)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewSheetTab((prev) => (prev ? null : defaultPreviewSys))
                    }
                    className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                    title="點擊立即開啟試算表內容預覽"
                  >
                    <Eye className="w-3 h-3" />
                    <span className="truncate max-w-[140px]">{cloudVault.spreadsheetId}</span>
                  </button>
                </div>
                <div className="font-semibold text-slate-100 truncate">{cloudVault.spreadsheetName}</div>
                <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewSheetTab((prev) => (prev ? null : defaultPreviewSys))
                      }
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>{previewSheetTab ? '收合試算表內容' : '查看試算表內容'}</span>
                    </button>
                    {hasRealSheet && (
                      <a
                        href={cloudVault.spreadsheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-emerald-700 text-emerald-300 text-[11px] font-bold inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>開啟 Google 試算表 (僅供檢視)</span>
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyVaultValue(
                        'sheetUrl',
                        hasRealSheet ? cloudVault.spreadsheetUrl : cloudVault.spreadsheetId,
                        hasRealSheet ? '獨立 Google 試算表連結' : '試算表索引 ID'
                      )
                    }
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedVaultField === 'sheetUrl' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>複製</span>
                  </button>
                </div>
              </div>
            </div>

            {previewSheetTab && (
              <MemberCloudSheetViewer
                memberMid={currentMid}
                cloudVault={cloudVault}
                initialSysType={previewSheetTab}
                theme="dark"
                syncing={cloudSyncing}
                onSyncGoogleSheet={handleSyncCloudVaultToGas}
                onClose={() => setPreviewSheetTab(null)}
              />
            )}

            {/* Worksheet Tabs Read/Write Permission Status Table (Mobile 2D Scrollable) */}
            <div className="overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch] border border-slate-800 rounded-xl">
              <table className="w-full min-w-[600px] text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3 whitespace-nowrap">試算表工作表分頁 (點擊查看內容)</th>
                    <th className="py-2 px-3 whitespace-nowrap">既有舊資料</th>
                    <th className="py-2 px-3 whitespace-nowrap">寫入權限管控 (GAS Protect)</th>
                    <th className="py-2 px-3 whitespace-nowrap">到期日</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">檢視 / 續約</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {cloudVault.sheetTabs.map((tab) => (
                    <tr key={tab.sysType} className="hover:bg-slate-800/30">
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() => setPreviewSheetTab(tab.sysType)}
                          className="text-left group cursor-pointer"
                        >
                          <div className="font-semibold text-slate-200 group-hover:text-emerald-300 group-hover:underline">
                            {tab.title}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500">{tab.tabName}</div>
                        </button>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-300">
                        {tab.recordCount} 筆 (可查看)
                      </td>
                      <td className="py-2 px-3">
                        {tab.canCreate ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[11px] font-semibold">
                            <Unlock className="w-3 h-3" />
                            <span>{tab.statusLabel}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[11px] font-semibold">
                            <Lock className="w-3 h-3" />
                            <span>{tab.statusLabel}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                        {tab.expiresAt ? new Date(tab.expiresAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => setPreviewSheetTab(tab.sysType)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>查看內容</span>
                          </button>
                          {!tab.canCreate && (
                            <button
                              type="button"
                              onClick={() => handleOneClickRenewModule(tab.moduleKey)}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>續約解鎖</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
            );
          })()}

          {/* All Owned Nodes Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 flex-wrap">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>名下所有持有節點彙整表 ({report.totalOwnedNodesCount} 席)</span>
                  {purchasedProductMap.size > 0 && (
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono inline-flex items-center gap-1">
                      <ShoppingBag className="w-3 h-3" />
                      <span>已同步新購產品 {purchasedProductMap.size} 席</span>
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  包含 1+1 自動雙發節點、所有新購買產品／AI 軟體模組及加購擴充之二元樹自營席位。
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    syncMemberPurchasedProductsToNodes(currentMid);
                    setNodesRefreshTick((t) => t + 1);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-3 h-3 text-emerald-400" />
                  <span>同步新購產品</span>
                </button>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded border border-emerald-800 font-bold">
                  總收益：${report.financialSummary.totalEarningsFromAllNodes.toFixed(1)} 點
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">節點代號 (C-碼)</th>
                    <th className="py-2.5 px-3">軌道與產品來源</th>
                    <th className="py-2.5 px-3">安置父節點</th>
                    <th className="py-2.5 px-3">位置/深度</th>
                    <th className="py-2.5 px-3">續約效期</th>
                    <th className="py-2.5 px-3 text-right">累計收益</th>
                    <th className="py-2.5 px-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {report.ownedMonolineNodes.map((n) => (
                    <tr key={n.nodeId} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-bold text-teal-300">{n.nodeId}</td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800 text-[10px]">
                          單軌公排 (第1組 · 通訊錄 CRM)
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{n.parentId}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-300">公排 #{n.depth}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-sans">
                        {new Date(n.trialExpiresAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                        ${n.totalEarnings.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans">
                        {!scopedMode && onNavigateToMonoline ? (
                          <button
                            onClick={onNavigateToMonoline}
                            className="text-teal-400 hover:text-teal-300 text-xs font-semibold cursor-pointer"
                          >
                            隊列 →
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-400">有效</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {report.ownedBinaryNodes.map((n) => {
                    const provenance = purchasedProductMap.get(n.nodeId);
                    return (
                      <tr key={n.nodeId} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-bold text-blue-300">{n.nodeId}</td>
                        <td className="py-2.5 px-3 font-sans">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[10px]">
                              {provenance
                                ? `新購 · ${provenance.productTitle}`
                                : n.softwareTitle
                                ? `AI 雙軌 · ${n.softwareTitle}`
                                : '雙軌二元樹 (第2組)'}
                            </span>
                            {provenance?.orderId && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono text-[10px]">
                                {provenance.orderId}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">{n.parentId}</td>
                        <td className="py-2.5 px-3 font-sans text-amber-300">
                          {n.placementPosition === 'L' ? '左區' : '右區'} (Depth {n.depth})
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 font-sans">
                          {new Date(n.trialExpiresAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                          ${n.totalEarnings.toFixed(1)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-sans">
                          {!scopedMode && onNavigateToTree ? (
                            <button
                              onClick={() => onNavigateToTree(n.nodeId)}
                              className="text-blue-400 hover:text-blue-300 text-xs font-semibold cursor-pointer"
                            >
                              樹狀圖 →
                            </button>
                          ) : (
                            <span className="text-[11px] text-emerald-400">有效</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: PERSONAL TODO KANBAN BOARD */}
      {activeTab === 'todos' && (
        <PersonalTodoBoard
          memberMid={currentMid}
          theme="dark"
          onTodosChanged={() => setTodoRefreshTick((t) => t + 1)}
        />
      )}

      {/* TAB 2: TEAM & REFERRALS */}
      {activeTab === 'team' && report && (
        <div className="space-y-6">
          {/* Team KPI stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400 mb-1">親推推薦人數</div>
              <div className="text-2xl font-bold font-mono text-indigo-300">
                {report.referrals.directReferralMembers.length} 人
              </div>
              <div className="text-[11px] text-slate-500 mt-1">享第 1 代 1.0 點推薦分紅</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400 mb-1">15 代直推體系總人數</div>
              <div className="text-2xl font-bold font-mono text-purple-300">
                {report.downstream15Gen.total15GenCount} 人
              </div>
              <div className="text-[11px] text-slate-500 mt-1">全享 15 代 15% 閉環分潤</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400 mb-1">雙軌左區 (Left Leg)</div>
              <div className="text-2xl font-bold font-mono text-blue-300">
                {report.binaryDownline.leftLegNodes.length} 席
              </div>
              <div className="text-[11px] text-slate-500 mt-1">二元樹左翼團隊</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400 mb-1">雙軌右區 (Right Leg)</div>
              <div className="text-2xl font-bold font-mono text-cyan-300">
                {report.binaryDownline.rightLegNodes.length} 席
              </div>
              <div className="text-[11px] text-slate-500 mt-1">二元樹右翼團隊</div>
            </div>
          </div>

          {/* Direct Referrals List */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>親推直屬下線名單 ({report.referrals.directReferralMembers.length} 人)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  所有親推夥伴均以您的 MID (<span className="font-mono text-indigo-300">{currentMember?.mid}</span>) 為推薦人開通。
                </p>
              </div>

              {onNavigateToRegisterWithSponsor && currentMember && (
                <button
                  onClick={() => onNavigateToRegisterWithSponsor(currentMember.mid)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>直接為新夥伴開通 1+1</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">會員 MID (A-碼)</th>
                    <th className="py-2.5 px-3">姓名</th>
                    <th className="py-2.5 px-3">手機</th>
                    <th className="py-2.5 px-3">第1組單軌 (C-碼)</th>
                    <th className="py-2.5 px-3">第2組雙軌 (C-碼)</th>
                    <th className="py-2.5 px-3">開通時間</th>
                    <th className="py-2.5 px-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {report.referrals.directReferralMembers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                        尚未有親推下線會員。可使用「推廣專屬名片」分享邀請新夥伴開通 AI 軟體 1+1！
                      </td>
                    </tr>
                  ) : (
                    report.referrals.directReferralMembers.map((m) => (
                      <tr key={m.mid} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-bold text-indigo-300">{m.mid}</td>
                        <td className="py-2.5 px-3 font-sans font-medium text-slate-200">{m.name}</td>
                        <td className="py-2.5 px-3 text-slate-400">{m.phone}</td>
                        <td className="py-2.5 px-3 text-teal-400">{m.monolineNodeId}</td>
                        <td className="py-2.5 px-3 text-blue-400">{m.binaryNodeId}</td>
                        <td className="py-2.5 px-3 text-slate-400 font-sans">
                          {new Date(m.registeredAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-sans">
                          {!scopedMode ? (
                            <button
                              onClick={() => handleSwitchMember(m.mid)}
                              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                            >
                              檢視此會員 →
                            </button>
                          ) : (
                            <span className="text-[11px] text-emerald-400">直推第 1 代</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 15 Generations Breakdown Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-purple-400" />
              <span>向下 15 代直推分紅層級矩陣 (每代享 1.0 點分潤)</span>
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-15 gap-2 text-center text-xs">
              {report.downstream15Gen.generations.map((g) => (
                <div
                  key={g.generation}
                  className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex flex-col justify-between"
                >
                  <div className="text-[10px] text-slate-500 uppercase">第 {g.generation} 代</div>
                  <div className="text-sm font-bold font-mono text-purple-300 my-1">{g.count} 人</div>
                  <div className="text-[9px] text-slate-500">1.0 點/人</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: WALLET & EARNINGS */}
      {activeTab === 'wallet' && report && (
        <div className="space-y-6">
          {/* Financial summary overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-emerald-900/40 rounded-xl p-5">
              <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
                <span>累計全軌道分潤總額</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-bold font-mono text-emerald-300 tabular-nums">
                ${report.financialSummary.totalEarningsFromAllNodes.toFixed(1)} 點
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                100% 閉環零沉澱平帳系統撥發之收益
              </p>
            </div>

            <div className="bg-slate-900 border border-teal-900/40 rounded-xl p-5">
              <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
                <span>單軌公排累計分紅</span>
                <Layers className="w-4 h-4 text-teal-400" />
              </div>
              <div className="text-3xl font-bold font-mono text-teal-300 tabular-nums">
                ${report.financialSummary.monolineEarnings.toFixed(1)} 點
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                15 代時間序列全民公排互助收益
              </p>
            </div>

            <div className="bg-slate-900 border border-blue-900/40 rounded-xl p-5">
              <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
                <span>雙軌二元樹累計分紅</span>
                <GitFork className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-3xl font-bold font-mono text-blue-300 tabular-nums">
                ${report.financialSummary.binaryEarnings.toFixed(1)} 點
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                15 代 BFS 智慧滑落排線分紅收益
              </p>
            </div>
          </div>

          {/* 100 NTD Formula verification reminder */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>100 元月租 100% 閉環撥發清算公式標準</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              每一筆 100 元月租（100 點）經由智能合約級算力演算法，進行零資金沉澱完美平帳：
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-400 block text-[11px]">15 代直推推薦</span>
                <span className="font-mono text-indigo-300 font-bold text-sm">15.0 點 (15%)</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-400 block text-[11px]">15 代雙軌安置</span>
                <span className="font-mono text-blue-300 font-bold text-sm">15.0 點 (15%)</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-400 block text-[11px]">6 代經營店輔導</span>
                <span className="font-mono text-teal-300 font-bold text-sm">6.0 點 (6%)</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-400 block text-[11px]">6 代教育中心培訓</span>
                <span className="font-mono text-cyan-300 font-bold text-sm">6.0 點 (6%)</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-400 block text-[11px]">艾邦妮科技池</span>
                <span className="font-mono text-purple-300 font-bold text-sm">30.0 點 (30%)</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-400 block text-[11px]">總公司營運池</span>
                <span className="font-mono text-amber-300 font-bold text-sm">28.0 點 (28%)</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                合計平帳驗證：<span className="font-mono text-emerald-400 font-bold">15 + 15 + 6 + 6 + 30 + 28 = 100.0 點</span>
              </span>
              <button
                onClick={handleExecuteRenewal}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                立即執行 100 點閉環自主續約
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CRM LOGS */}
      {activeTab === 'crm_logs' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-400" />
                  <span>我的 CRM 聯繫紀錄日誌 (Google Sheets CONTACT_T / CT-)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  記錄所有開通、諮詢輔導、活動邀約與下一步追蹤日誌。
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={!contactWritePerm.canCreate}
                  onClick={() => {
                    if (!contactWritePerm.canCreate) {
                      showNotice(
                        'warning',
                        contactWritePerm.readOnlyReason ||
                          '通訊錄 CRM 尚未續約，僅能查看歷史日誌，不能新增聯繫紀錄。'
                      );
                      return;
                    }
                    setIsAddLogModalOpen(true);
                  }}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm ${
                    contactWritePerm.canCreate
                      ? 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  }`}
                >
                  {contactWritePerm.canCreate ? (
                    <PlusCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {contactWritePerm.canCreate ? '新增聯繫追蹤日誌' : '未續約唯讀 (禁新增)'}
                  </span>
                </button>
                {!scopedMode && onNavigateToCrmEvents && (
                  <button
                    onClick={onNavigateToCrmEvents}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    前往活動中心 →
                  </button>
                )}
              </div>
            </div>
          </div>

          {!contactWritePerm.canCreate && (
            <div className="bg-rose-950/40 border border-rose-700/70 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5 text-rose-200">
                <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-rose-100">
                    通訊錄 CRM 尚未續約 — 唯讀歸檔模式（只能查看舊資料，不能新增日誌）
                  </div>
                  <div className="text-rose-200/80 mt-0.5">
                    {contactWritePerm.readOnlyReason} 下方既有的 {memberTrackings.length} 筆聯繫日誌仍可完整查閱。
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOneClickRenewModule('CONTACT')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>月租 100 元續約解鎖 (+30天)</span>
              </button>
            </div>
          )}

          {/* Logs timeline/table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">紀錄編號 (CT-)</th>
                    <th className="py-2.5 px-3">狀態</th>
                    <th className="py-2.5 px-3">聯繫日期</th>
                    <th className="py-2.5 px-3">方式</th>
                    <th className="py-2.5 px-3">洽談內容</th>
                    <th className="py-2.5 px-3">下一步計畫</th>
                    <th className="py-2.5 px-3">更新時間</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {memberTrackings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                        目前尚無聯繫日誌，點擊上方按鈕立即建立第一筆紀錄。
                      </td>
                    </tr>
                  ) : (
                    memberTrackings.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-bold text-sky-300">{log.id}</td>
                        <td className="py-2.5 px-3 font-sans">
                          <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 text-[10px]">
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-sans">{log.contactDate}</td>
                        <td className="py-2.5 px-3 text-slate-400 font-sans">{log.contactMethod}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-200 max-w-xs truncate">
                          {log.discussionContent}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-amber-300/90 max-w-xs truncate">
                          {log.nextStepPlan}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {new Date(log.updatedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: RELATIONS & AFFILIATIONS */}
      {activeTab === 'relations' && currentMember && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sponsor card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">直推推薦人 (Sponsor)</h3>
                    <p className="text-[11px] text-slate-400 font-mono">15 代親推推薦體系</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                  {currentMember.sponsorMid}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-xs">
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">推薦人姓名：</span>
                  <span className="text-slate-200 font-semibold text-sm">
                    {sponsorMember ? sponsorMember.name : currentMember.sponsorMid === 'HQ_ROOT' ? '總公司旗艦 (HQ_ROOT)' : '資深領導人'}
                  </span>
                </div>
                {sponsorMember && (
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">聯絡手機：</span>
                    <span className="font-mono text-slate-300">{sponsorMember.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {!scopedMode && sponsorMember && (
              <div className="mt-4 pt-3 border-t border-slate-800">
                <button
                  onClick={() => handleSwitchMember(sponsorMember.mid)}
                  className="w-full py-1.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                >
                  切換登入推薦人視角 →
                </button>
              </div>
            )}
          </div>

          {/* Store card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">輔導經營店 (Store)</h3>
                    <p className="text-[11px] text-slate-400 font-mono">6 代經營店輔導體系</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                  {currentMember.storeId}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-xs">
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">經營店名稱：</span>
                  <span className="text-slate-200 font-semibold text-sm">
                    {memberStore?.name || '台北旗艦示範店'}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">店長：</span>
                  <span className="text-slate-300">
                    {memberStore?.managerName || '總部指派店長'} ({memberStore?.managerMid || GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID})
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                  <span className="block">店址：{memberStore?.address || '台北市大安區忠孝東路四段 128 號'}</span>
                </div>
              </div>
            </div>

            {!scopedMode && onNavigateToStorePortal && (
              <div className="mt-4 pt-3 border-t border-slate-800">
                <button
                  onClick={() => onNavigateToStorePortal(currentMember.storeId)}
                  className="w-full py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                >
                  進入經營店專屬門戶 →
                </button>
              </div>
            )}
          </div>

          {/* Education center card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-700/60 flex items-center justify-center text-cyan-400">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">教育中心 (Center)</h3>
                    <p className="text-[11px] text-slate-400 font-mono">6 代教育培訓輔導體系</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                  {currentMember.centerId}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-xs">
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">中心名稱：</span>
                  <span className="text-slate-200 font-semibold text-sm">
                    {memberCenter?.name || '全球總部教育培訓中心'}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">中心主任：</span>
                  <span className="text-slate-300">
                    {memberCenter?.directorName || '總部培訓主任'} ({memberCenter?.directorMid || GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID})
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                  <span className="block">中心地址：{memberCenter?.address || '台北市信義區松高路 1 號 28 樓'}</span>
                </div>
              </div>
            </div>

            {!scopedMode && onNavigateToCenterPortal && (
              <div className="mt-4 pt-3 border-t border-slate-800">
                <button
                  onClick={() => onNavigateToCenterPortal(currentMember.centerId)}
                  className="w-full py-1.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                >
                  進入教育中心專屬門戶 →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: SHARE & REFERRAL CARD */}
      {activeTab === 'share' && currentMember && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-gradient-to-br from-indigo-900/60 via-slate-900 to-slate-900 border border-indigo-700/60 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-indigo-800/60">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                產銷合一 SaaS ERP 專屬推廣名片
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                AI 軟體 1+1 雙發
              </span>
            </div>

            <div className="text-center py-4 space-y-2">
              {currentMember.photoUrl && !avatarError ? (
                <img
                  src={currentMember.photoUrl}
                  alt={currentMember.name}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="w-20 h-20 rounded-full object-cover mx-auto border-4 border-indigo-500/80 shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-indigo-950 mx-auto border-4 border-indigo-500/80 flex items-center justify-center text-2xl font-bold text-indigo-200 shadow-lg">
                  {currentMember.name.slice(0, 1)}
                </div>
              )}
              <div className="text-xl font-bold text-white">{currentMember.name}</div>
              <div className="text-xs font-mono text-indigo-300 font-bold bg-indigo-950 inline-block px-3 py-1 rounded-full border border-indigo-800">
                直推推薦碼: {currentMember.mid}
              </div>
            </div>

            <div className="bg-slate-950/80 p-3.5 rounded-lg border border-slate-800 text-xs space-y-1.5 text-slate-300">
              <div>
                <span>聯絡手機：</span>
                <span className="font-mono text-slate-200">{currentMember.phone}</span>
              </div>
              {currentMember.line && (
                <div>
                  <span>Line ID：</span>
                  <span className="font-mono text-emerald-400">{currentMember.line}</span>
                </div>
              )}
              <div>
                <span>專屬第 1 組公排節點：</span>
                <span className="font-mono text-teal-400">{currentMember.monolineNodeId}</span>
              </div>
              <div>
                <span>專屬第 2 組雙軌節點：</span>
                <span className="font-mono text-blue-400">{currentMember.binaryNodeId}</span>
              </div>
            </div>

            <button
              onClick={handleCopyInvitation}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? '推廣邀請文案已複製！' : '一鍵複製專屬推廣開通邀請文案'}</span>
            </button>
          </div>

          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-sky-400" />
              <span>推廣文案預覽與快速開通新夥伴</span>
            </h3>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans space-y-2 whitespace-pre-line">
              {`【產銷合一 SaaS ERP 邀請開通】
我是 ${currentMember.name}（推薦人 MID：${currentMember.mid}），誠摯邀請您開通 AI 軟體 1+1 雙重體驗！

同時享有：
1. 第 1 套 AI 軟體：通訊錄 CRM（通訊主檔與聯繫紀錄，綁定單軌 15 代公排互助）
2. 第 2 套 AI 軟體：活動行銷（活動企劃與花絮行銷，綁定雙軌二元樹卡位）
3. 贈送 2 套 1+1 AI 軟體 30 天完整免費體驗！
4. 100 元月租 100% 零資金沉澱閉環分潤機制。`}
            </div>

            {onNavigateToRegisterWithSponsor && (
              <div className="pt-2">
                <button
                  onClick={() => onNavigateToRegisterWithSponsor(currentMember.mid)}
                  className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>立即以我的推薦碼 ({currentMember.mid}) 開通新夥伴 1+1</span>
                </button>
              </div>
            )}
          </div>

          <div className="lg:col-span-12">
            <ScopedQrCodeCard memberMid={currentMember.mid} memberName={currentMember.name} />
          </div>
        </div>
      )}

      {/* MODAL: Edit Profile */}
      {isEditProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                <span>編輯會員個人通訊資料 (CONTACT_M 同步)</span>
              </h3>
              <button
                onClick={() => setIsEditProfileModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">姓名 *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">手機號碼 *</label>
                  <input
                    type="text"
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">市話 / 公司電話</label>
                  <input
                    type="text"
                    value={editTel}
                    onChange={(e) => setEditTel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Line ID</label>
                  <input
                    type="text"
                    value={editLine}
                    onChange={(e) => setEditLine(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-emerald-400 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">通訊地址</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">個人大頭貼照片 URL (imgIdx: 8)</label>
                <input
                  type="url"
                  value={editPhotoUrl}
                  onChange={(e) => setEditPhotoUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditProfileModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500 cursor-pointer"
                >
                  儲存並同步 CONTACT_M
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Renewal Certificate */}
      {isRenewModalOpen && renewResult && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/60 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-900/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-600/30 border border-emerald-500 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">100 元月租閉環自主續約成功</h3>
                  <p className="text-[11px] text-slate-400 font-mono">100% 零資金沉澱分潤平帳完成</p>
                </div>
              </div>
              <button
                onClick={() => setIsRenewModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">交易編號 (TXN)：</span>
                  <span className="font-mono text-emerald-400 font-bold">{renewResult.transactionId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">展延節點：</span>
                  <span className="font-mono text-blue-300">{renewResult.nodeId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">繳付月租金額：</span>
                  <span className="font-mono text-slate-100 font-bold">100 元 = 100 點</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">展延效期：</span>
                  <span className="font-mono text-emerald-300 font-bold">+30 天效期 (享有完整分紅權益)</span>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1 text-[11px]">
                <div className="text-slate-300 font-semibold mb-1">即時閉環撥發流水摘要：</div>
                <div className="flex justify-between text-slate-400">
                  <span>15 代直推推薦分紅撥出：</span>
                  <span className="font-mono text-indigo-300">{renewResult.totalSponsorPoints.toFixed(1)} 點</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>15 代雙軌安置排線分紅撥出：</span>
                  <span className="font-mono text-blue-300">{renewResult.totalPlacementPoints.toFixed(1)} 點</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>6 代經營店輔導補貼撥出：</span>
                  <span className="font-mono text-teal-300">{renewResult.totalStorePoints.toFixed(1)} 點</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>6 代教育中心培訓補貼撥出：</span>
                  <span className="font-mono text-cyan-300">{renewResult.totalCenterPoints.toFixed(1)} 點</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>科技研發 (30%) + 總公司營運 (28%)：</span>
                  <span className="font-mono text-purple-300">58.0 點</span>
                </div>
                <div className="pt-1.5 border-t border-slate-800 flex justify-between text-slate-200 font-bold">
                  <span>合計平帳驗證：</span>
                  <span className="font-mono text-emerald-400">{renewResult.totalDistributed} 點 (完美平帳)</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsRenewModalOpen(false)}
                className="w-full py-2 bg-emerald-600 text-white font-semibold text-xs rounded-lg hover:bg-emerald-500 cursor-pointer"
              >
                確認並關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add CRM Tracking Log */}
      {isAddLogModalOpen && currentMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-400" />
                <span>新增聯繫日誌 (寫入 CONTACT_T / CT-)</span>
              </h3>
              <button
                onClick={() => setIsAddLogModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTrackingLog} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">會員姓名</label>
                  <input
                    type="text"
                    disabled
                    value={currentMember.name}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-400 font-sans"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">聯繫方式</label>
                  <select
                    value={newLogMethod}
                    onChange={(e) => setNewLogMethod(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="線上諮詢">線上諮詢</option>
                    <option value="Line">Line</option>
                    <option value="電話訪問">電話訪問</option>
                    <option value="門店面談">門店面談</option>
                    <option value="教育中心培訓">教育中心培訓</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">洽談內容 *</label>
                <textarea
                  rows={3}
                  required
                  value={newLogDiscussion}
                  onChange={(e) => setNewLogDiscussion(e.target.value)}
                  placeholder="請記錄會員諮詢內容、系統操作體驗回饋或輔導要點..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">下一步追蹤計畫 *</label>
                <input
                  type="text"
                  required
                  value={newLogNextPlan}
                  onChange={(e) => setNewLogNextPlan(e.target.value)}
                  placeholder="例如：邀約參加週三實體啟航說明會、協助完成月租續約..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500 font-sans"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddLogModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-500 cursor-pointer"
                >
                  寫入 CONTACT_T
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
