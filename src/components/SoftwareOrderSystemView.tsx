/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { erpEngine, GLOBAL_BOUNDARIES } from '../services/erpEngine';
import {
  DynamicRecord,
  ORDERABLE_SOFTWARE_CATALOG,
  OrderableModuleCatalogItem,
  SoftwareModuleSubscription,
  SoftwareOrderReceipt,
  SoftwareOrderReceiptItem,
  getMemberUnlockedPacks,
  saveMemberUnlockedPacks,
  getMemberModuleSubscriptions,
  saveMemberModuleSubscriptions,
  getMemberOrderReceipts,
  appendMemberOrderReceipt,
  loadMemberDynamicRecords,
  saveMemberDynamicRecords,
} from '../services/memberFiveStarConfig';
import { notifyNodesUpdated } from '../services/softwareNodeSync';
import { syncMemberTodosToGas, notifyTodosUpdated } from '../services/gasTodoSyncService';
import {
  CLOUD_VAULT_UPDATED_EVENT,
  ensureMemberCloudWorkspace,
  getModuleWritePermission,
  notifyCloudVaultUpdated,
  renewMemberModuleNow,
} from '../services/memberCloudVaultService';
import { BookingAppointment, Member, SettlementBreakdown } from '../types/erp';
import {
  ShoppingBag,
  Sparkles,
  CheckCircle2,
  Clock,
  CreditCard,
  Layers,
  CalendarClock,
  Network,
  HeartPulse,
  Package,
  Apple,
  ShoppingBasket,
  Scissors,
  Building2,
  Activity,
  Contact,
  Calendar,
  ArrowRight,
  Receipt,
  Check,
  X,
  ShieldCheck,
  PlusCircle,
  ListTodo,
  GitFork,
  Lock,
  AlertTriangle,
} from 'lucide-react';

interface SoftwareOrderSystemViewProps {
  memberMid: string;
  isHqAdminView?: boolean;
  theme?: 'dark' | 'light';
  onOpenModule?: (moduleKey: string) => void;
  onOrderCompleted?: () => void;
  onInspectBinaryNode?: (nodeId: string) => void;
}

function getModuleIcon(key: string) {
  switch (key) {
    case 'BOOKING':
      return CalendarClock;
    case 'TODO':
      return ListTodo;
    case 'ATOMY':
      return Network;
    case 'ELDER':
      return HeartPulse;
    case 'PRODUCT':
      return Package;
    case 'FRUIT':
      return Apple;
    case 'GROCERY':
      return ShoppingBasket;
    case 'NAIL':
      return Scissors;
    case 'ASSOC':
      return Building2;
    case 'TCM':
      return Activity;
    case 'CONTACT':
      return Contact;
    case 'EVENT':
      return Calendar;
    default:
      return Layers;
  }
}

function getDaysInfo(expiresAt?: string, status?: string): { days: number; label: string } {
  if (!status || status === 'NOT_ORDERED') {
    return { days: 0, label: '尚未訂購開通' };
  }
  if (!expiresAt) return { days: 30, label: '體驗生效中' };
  const diff = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(diff / (24 * 3600 * 1000));
  if (days <= 0) return { days: 0, label: '已到期（續約即刻恢復）' };
  return { days, label: `剩餘 ${days} 天` };
}

export const SoftwareOrderSystemView: React.FC<SoftwareOrderSystemViewProps> = ({
  memberMid,
  isHqAdminView = false,
  theme = 'dark',
  onOpenModule,
  onOrderCompleted,
  onInspectBinaryNode,
}) => {
  const [selectedHqMid, setSelectedHqMid] = useState<string>(memberMid);
  const effectiveMid = isHqAdminView ? selectedHqMid : memberMid;

  const [refreshTick, setRefreshTick] = useState(0);
  const forceRefresh = () => setRefreshTick((t) => t + 1);

  useEffect(() => {
    const onCloudUpdated = () => forceRefresh();
    window.addEventListener(CLOUD_VAULT_UPDATED_EVENT, onCloudUpdated);
    return () => window.removeEventListener(CLOUD_VAULT_UPDATED_EVENT, onCloudUpdated);
  }, []);

  const [cartKeys, setCartKeys] = useState<string[]>([]);
  const [activeReceiptModal, setActiveReceiptModal] = useState<SoftwareOrderReceipt | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Quick Booking Form state (姓名、手機、電話、日期、時間、事由、備註、詳細情況)
  const [bkName, setBkName] = useState('');
  const [bkMobile, setBkMobile] = useState('');
  const [bkPhone, setBkPhone] = useState('');
  const [bkDate, setBkDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bkTime, setBkTime] = useState('14:00');
  const [bkReason, setBkReason] = useState('');
  const [bkNote, setBkNote] = useState('');
  const [bkDetail, setBkDetail] = useState('');
  const [lastCreatedApt, setLastCreatedApt] = useState<BookingAppointment | null>(null);

  // Quick Todo Form state (TODO_M/T)
  const [todoTitle, setTodoTitle] = useState('');
  const [todoPriority, setTodoPriority] = useState('高');
  const [todoDate, setTodoDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [todoTime, setTodoTime] = useState('16:00');
  const [todoProject, setTodoProject] = useState('');
  const [todoDetail, setTodoDetail] = useState('');

  const isLight = theme === 'light';

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3400);
  };

  const member: Member | undefined = erpEngine.getMemberById(effectiveMid);
  const allMembers = useMemo(() => (isHqAdminView ? erpEngine.getAllMembers() : []), [isHqAdminView, refreshTick]);
  const memberAppointments: BookingAppointment[] = useMemo(
    () => erpEngine.getAppointmentsByOwner(effectiveMid),
    [effectiveMid, refreshTick]
  );
  const memberTodos: DynamicRecord[] = useMemo(
    () => loadMemberDynamicRecords(effectiveMid, 'TODO_T'),
    [effectiveMid, refreshTick]
  );

  // Combine BookingProfile + Dual-Track Module Subscriptions + Live Binary Node Info
  const subscriptionsMap = useMemo(() => {
    const subs = getMemberModuleSubscriptions(effectiveMid, member?.trialExpiresAt);
    const bk = erpEngine.getBookingProfile(effectiveMid);

    // Core 1+1 EVENT maps to member's initial binaryNodeId by default
    if (subs.EVENT && !subs.EVENT.binaryNodeId && member?.binaryNodeId) {
      subs.EVENT.binaryNodeId = member.binaryNodeId;
    }

    // Enrich all non-BOOKING subscriptions with live binary node placement
    Object.values(subs).forEach((s) => {
      if (s.binaryNodeId) {
        const bNode = erpEngine.getBinaryNodeById(s.binaryNodeId);
        if (bNode) {
          s.binaryParentId = bNode.parentId;
          s.binaryPosition =
            bNode.placementPosition === 'L' || bNode.placementPosition === 'R' || bNode.placementPosition === 'ROOT'
              ? bNode.placementPosition
              : undefined;
          s.binaryDepth = bNode.depth;
        }
      }
    });

    if (bk) {
      const bkNode = bk.binaryNodeId ? erpEngine.getBinaryNodeById(bk.binaryNodeId) : undefined;
      subs.BOOKING = {
        moduleKey: 'BOOKING',
        licenseCode: bk.licenseId,
        status:
          bk.status === 'NOT_ACTIVATED'
            ? 'NOT_ORDERED'
            : bk.status === 'ACTIVE_RENEWED'
            ? 'ACTIVE_RENEWED'
            : bk.status === 'EXPIRED_FROZEN'
            ? 'EXPIRED_FROZEN'
            : 'TRIAL_ACTIVE',
        activatedAt: bk.activatedAt,
        expiresAt: bk.expiresAt,
        monthlyRentNtd: 100,
        totalRenewalsCount: bk.totalRenewalsCount,
        binaryNodeId: bk.binaryNodeId,
        binaryParentId: bkNode?.parentId,
        binaryPosition:
          bkNode?.placementPosition === 'L' || bkNode?.placementPosition === 'R' || bkNode?.placementPosition === 'ROOT'
            ? bkNode.placementPosition
            : undefined,
        binaryDepth: bkNode?.depth,
        extraBinaryNodeIds: subs.BOOKING?.extraBinaryNodeIds,
      };
    } else {
      subs.BOOKING = {
        moduleKey: 'BOOKING',
        licenseCode: `BK-待核發`,
        status: 'NOT_ORDERED',
        monthlyRentNtd: 100,
        totalRenewalsCount: 0,
      };
    }

    return subs;
  }, [effectiveMid, member?.trialExpiresAt, member?.binaryNodeId, refreshTick]);

  const memberBinaryNodes = useMemo(
    () =>
      erpEngine
        .getAllBinaryNodes()
        .filter((n) => n.mid === effectiveMid),
    [effectiveMid, refreshTick]
  );

  const receipts: SoftwareOrderReceipt[] = useMemo(
    () => getMemberOrderReceipts(effectiveMid),
    [effectiveMid, refreshTick]
  );

  const bookingPerm = useMemo(
    () => getModuleWritePermission(effectiveMid, 'BOOKING'),
    [effectiveMid, refreshTick]
  );
  const todoPerm = useMemo(
    () => getModuleWritePermission(effectiveMid, 'TODO'),
    [effectiveMid, refreshTick]
  );

  // Statistics
  const stats = useMemo(() => {
    let activeCount = 0;
    let trialCount = 0;
    let renewedCount = 0;

    ORDERABLE_SOFTWARE_CATALOG.forEach((item) => {
      const sub = subscriptionsMap[item.key];
      if (!sub || sub.status === 'NOT_ORDERED') return;
      activeCount += 1;
      if (sub.status === 'TRIAL_ACTIVE') trialCount += 1;
      if (sub.status === 'ACTIVE_RENEWED') renewedCount += 1;
    });

    return {
      totalCatalog: ORDERABLE_SOFTWARE_CATALOG.length,
      activeCount,
      trialCount,
      renewedCount,
      ordersCount: receipts.length,
      binarySeatsCount: memberBinaryNodes.length,
    };
  }, [subscriptionsMap, receipts, memberBinaryNodes.length]);

  const toggleCartKey = (key: string) => {
    setCartKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleQuickCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (bookingPerm.isExpired) {
      showToast('個人預約系統未續約（已到期），僅能查看歷史預約舊資料，不能新增預約！請先續約 NT$ 100。');
      return;
    }
    if (!bkName.trim()) {
      showToast('請輸入預約人姓名');
      return;
    }

    const existingBk = erpEngine.getBookingProfile(effectiveMid);
    if (!existingBk || !existingBk.binaryNodeId) {
      erpEngine.activateBookingTrial(effectiveMid, { allocateBinaryNode: true });
    }

    const apt = erpEngine.createAppointment({
      ownerMid: effectiveMid,
      date: bkDate || new Date().toISOString().split('T')[0],
      timeSlot: bkTime || '10:00',
      clientName: bkName.trim(),
      clientPhone: bkMobile.trim() || bkPhone.trim() || '未留號碼',
      clientTel: bkPhone.trim(),
      reason: bkReason.trim(),
      notes: bkNote.trim(),
      detail: bkDetail.trim(),
    });

    setLastCreatedApt(apt);
    setBkName('');
    setBkMobile('');
    setBkPhone('');
    setBkReason('');
    setBkNote('');
    setBkDetail('');
    showToast(`已新增預約「${apt.clientName}」（單號 ${apt.appointmentId}）並同步寫入通訊錄追蹤與雙軌節點！`);
    forceRefresh();
    notifyNodesUpdated(effectiveMid);
    onOrderCompleted?.();
  };

  const handleQuickAptStatus = (aptId: string, status: BookingAppointment['status']) => {
    erpEngine.updateAppointmentStatus(aptId, status);
    forceRefresh();
    onOrderCompleted?.();
  };

  const handleQuickCreateTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (todoPerm.isExpired) {
      showToast('代辦事項系統未續約（已到期），僅能查看歷史待辦舊資料，不能新增事項！請先續約 NT$ 100。');
      return;
    }
    if (!todoTitle.trim()) {
      showToast('請輸入代辦事項標題');
      return;
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Ensure TODO 30-day free trial + Binary Node is activated & unlocked in Five-Star Workspace
    const subs = getMemberModuleSubscriptions(effectiveMid, member?.trialExpiresAt);
    const todoExp = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
    if (!subs.TODO || subs.TODO.status === 'NOT_ORDERED' || !subs.TODO.binaryNodeId) {
      const allocated = erpEngine.allocateBinaryNodeForSoftware({
        memberMid: effectiveMid,
        softwareKey: 'TODO',
        softwareTitle: '代辦事項系統',
        existingBinaryNodeId: subs.TODO?.binaryNodeId,
        status: subs.TODO?.status === 'ACTIVE_RENEWED' ? 'ACTIVE_RENEWED' : 'TRIAL_ACTIVE',
        expiresAt: subs.TODO?.expiresAt || todoExp,
        executeSettlement: false,
      });
      subs.TODO = {
        moduleKey: 'TODO',
        licenseCode: subs.TODO?.licenseCode || `SW-TODO-${effectiveMid.replace(/[^A-Z0-9]/gi, '')}`,
        status: subs.TODO && subs.TODO.status !== 'NOT_ORDERED' ? subs.TODO.status : 'TRIAL_ACTIVE',
        activatedAt: subs.TODO?.activatedAt || now.toISOString(),
        expiresAt: subs.TODO?.expiresAt || todoExp,
        monthlyRentNtd: 100,
        totalRenewalsCount: subs.TODO?.totalRenewalsCount || 0,
        binaryNodeId: allocated.binaryNode.nodeId,
        binaryParentId: allocated.binaryNode.parentId,
        binaryPosition:
          allocated.binaryNode.placementPosition === 'L' || allocated.binaryNode.placementPosition === 'R'
            ? allocated.binaryNode.placementPosition
            : undefined,
        binaryDepth: allocated.binaryNode.depth,
      };
      saveMemberModuleSubscriptions(effectiveMid, subs);
    }
    const unlocked = getMemberUnlockedPacks(effectiveMid);
    if (!unlocked.includes('TODO')) {
      saveMemberUnlockedPacks(effectiveMid, [...unlocked, 'TODO']);
    }

    const currentList = loadMemberDynamicRecords(effectiveMid, 'TODO_T');
    const newId = `TDT-${String(Date.now()).slice(-4)}`;
    const newRec: DynamicRecord = {
      ID: newId,
      狀態: '待處理',
      事項標題: todoTitle.trim(),
      專案名稱: todoProject.trim() || '日常代辦專案',
      優先級: todoPriority,
      截止日期: todoDate || todayStr,
      提醒時間: todoTime || '16:00',
      承辦人: effectiveMid,
      結束時間: '',
      詳細說明: todoDetail.trim(),
      更新時間: todayStr,
    };
    saveMemberDynamicRecords(effectiveMid, 'TODO_T', [newRec, ...currentList]);
    void syncMemberTodosToGas(effectiveMid, 'upsertTodo', { todo: newRec });
    notifyTodosUpdated(effectiveMid);

    setTodoTitle('');
    setTodoProject('');
    setTodoDetail('');
    showToast(`已新增代辦事項「${newRec.事項標題}」（${newId}）並同步至全能五星 TODO_T 與 GAS！`);
    forceRefresh();
    notifyNodesUpdated(effectiveMid);
    onOrderCompleted?.();
  };

  const handleQuickTodoStatus = (todoId: string, nextStatus: string) => {
    const currentList = loadMemberDynamicRecords(effectiveMid, 'TODO_T');
    const nowDt = new Date().toISOString().slice(0, 16);
    let updatedRec: DynamicRecord | undefined;
    const updated = currentList.map((r) => {
      if (r.ID !== todoId) return r;
      updatedRec = {
        ...r,
        狀態: nextStatus,
        結束時間: nextStatus === '已完成' ? nowDt : r.結束時間 || '',
        更新時間: new Date().toLocaleDateString(),
      };
      return updatedRec;
    });
    saveMemberDynamicRecords(effectiveMid, 'TODO_T', updated);
    void syncMemberTodosToGas(effectiveMid, 'upsertTodo', { todo: updatedRec });
    notifyTodosUpdated(effectiveMid);
    forceRefresh();
    onOrderCompleted?.();
  };

  // Action 1: Activate 30-Day Free Trial (NT$ 0) & Join Binary Tree Node
  const handleActivateTrial = (item: OrderableModuleCatalogItem) => {
    const now = new Date();
    const expIso = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();

    if (item.isBooking) {
      const bk = erpEngine.activateBookingTrial(effectiveMid, { allocateBinaryNode: true });
      const bNode = bk.binaryNodeId ? erpEngine.getBinaryNodeById(bk.binaryNodeId) : undefined;
      const unlocked = getMemberUnlockedPacks(effectiveMid);
      if (!unlocked.includes('BOOKING')) {
        saveMemberUnlockedPacks(effectiveMid, [...unlocked, 'BOOKING']);
      }
      const receipt: SoftwareOrderReceipt = {
        orderId: `ORD-${Date.now().toString().slice(-6)}`,
        memberMid: effectiveMid,
        items: [
          {
            moduleKey: 'BOOKING',
            title: item.title,
            codeLabel: `${bk.licenseId} · ${item.codeLabel}`,
            action: 'TRIAL_ACTIVATE',
            amountNtd: 0,
            newExpiresAt: bk.expiresAt || expIso,
            binaryNodeId: bNode?.nodeId || bk.binaryNodeId,
            binaryParentId: bNode?.parentId,
            binaryPosition:
              bNode?.placementPosition === 'L' || bNode?.placementPosition === 'R' || bNode?.placementPosition === 'ROOT'
                ? bNode.placementPosition
                : undefined,
            binaryDepth: bNode?.depth,
            isNewBinaryNode: Boolean(bNode),
          },
        ],
        totalAmountNtd: 0,
        settlementBreakdowns: [],
        createdAt: now.toISOString(),
      };
      appendMemberOrderReceipt(effectiveMid, receipt);
      setActiveReceiptModal(receipt);
      showToast(
        `已免費開通「${item.title} (${bk.licenseId})」，並排入雙軌節點 ${bNode?.nodeId || ''}（父節點 ${bNode?.parentId || '-'} · ${bNode?.placementPosition || ''}區）！`
      );
    } else {
      const subs = getMemberModuleSubscriptions(effectiveMid, member?.trialExpiresAt);
      const cur = subs[item.key] || {
        moduleKey: item.key,
        licenseCode: `SW-${item.key}-${effectiveMid.replace(/[^A-Z0-9]/gi, '')}`,
        status: 'NOT_ORDERED',
        monthlyRentNtd: 100,
        totalRenewalsCount: 0,
      };

      const preferredExistingId =
        cur.binaryNodeId || (item.key === 'EVENT' ? member?.binaryNodeId : undefined);
      const allocated = erpEngine.allocateBinaryNodeForSoftware({
        memberMid: effectiveMid,
        softwareKey: item.key,
        softwareTitle: item.title,
        existingBinaryNodeId: preferredExistingId,
        status: 'TRIAL_ACTIVE',
        expiresAt: expIso,
        executeSettlement: false,
      });

      const bPos =
        allocated.binaryNode.placementPosition === 'L' ||
        allocated.binaryNode.placementPosition === 'R' ||
        allocated.binaryNode.placementPosition === 'ROOT'
          ? allocated.binaryNode.placementPosition
          : undefined;

      subs[item.key] = {
        ...cur,
        status: 'TRIAL_ACTIVE',
        activatedAt: cur.activatedAt || now.toISOString(),
        expiresAt: cur.status !== 'NOT_ORDERED' && cur.expiresAt ? cur.expiresAt : expIso,
        binaryNodeId: allocated.binaryNode.nodeId,
        binaryParentId: allocated.binaryNode.parentId,
        binaryPosition: bPos,
        binaryDepth: allocated.binaryNode.depth,
      };
      saveMemberModuleSubscriptions(effectiveMid, subs);

      const unlocked = getMemberUnlockedPacks(effectiveMid);
      if (!unlocked.includes(item.key)) {
        saveMemberUnlockedPacks(effectiveMid, [...unlocked, item.key]);
      }

      const receipt: SoftwareOrderReceipt = {
        orderId: `ORD-${Date.now().toString().slice(-6)}`,
        memberMid: effectiveMid,
        items: [
          {
            moduleKey: item.key,
            title: item.title,
            codeLabel: item.codeLabel,
            action: 'TRIAL_ACTIVATE',
            amountNtd: 0,
            newExpiresAt: subs[item.key].expiresAt || expIso,
            binaryNodeId: allocated.binaryNode.nodeId,
            binaryParentId: allocated.binaryNode.parentId,
            binaryPosition: bPos,
            binaryDepth: allocated.binaryNode.depth,
            isNewBinaryNode: allocated.isNewlyAllocated,
          },
        ],
        totalAmountNtd: 0,
        settlementBreakdowns: [],
        createdAt: now.toISOString(),
      };
      appendMemberOrderReceipt(effectiveMid, receipt);
      setActiveReceiptModal(receipt);
      showToast(
        `已${allocated.isNewlyAllocated ? '開通並加入雙軌節點' : '綁定雙軌節點'}「${item.title}」→ ${allocated.binaryNode.nodeId}（父節點 ${allocated.binaryNode.parentId} · ${allocated.binaryNode.placementPosition}區）！`
      );
    }

    ensureMemberCloudWorkspace(effectiveMid);
    notifyCloudVaultUpdated(effectiveMid);
    forceRefresh();
    notifyNodesUpdated(effectiveMid);
    onOrderCompleted?.();
  };

  // Action 2: Paid Order / Renewal / Purchase Extra Binary Seat (NT$ 100 per module with 100-Point Closed-Loop Settlement)
  const handlePaidOrderKeys = (targetKeys: string[], options?: { forceNewSlot?: boolean }) => {
    if (targetKeys.length === 0) {
      showToast('請先勾選或選擇要訂購續約的 AI 軟體模組');
      return;
    }

    const now = new Date();
    const forceNewSlot = Boolean(options?.forceNewSlot);

    const subs = getMemberModuleSubscriptions(effectiveMid, member?.trialExpiresAt);
    const unlocked = getMemberUnlockedPacks(effectiveMid);
    const nextUnlocked = [...unlocked];
    const receiptItems: SoftwareOrderReceiptItem[] = [];
    const breakdowns: SettlementBreakdown[] = [];

    targetKeys.forEach((key) => {
      const cat = ORDERABLE_SOFTWARE_CATALOG.find((c) => c.key === key);
      if (!cat) return;

      if (cat.isBooking) {
        const res = erpEngine.renewBookingMonthlyFee(effectiveMid, { forceNewSlot });
        if (!nextUnlocked.includes('BOOKING')) {
          nextUnlocked.push('BOOKING');
        }
        const curSub = subs.BOOKING;
        const extraList = [...(curSub?.extraBinaryNodeIds || [])];
        if (forceNewSlot && !extraList.includes(res.binaryNode.nodeId)) {
          extraList.push(res.binaryNode.nodeId);
        }
        subs.BOOKING = {
          moduleKey: 'BOOKING',
          licenseCode: res.profile.licenseId,
          status: 'ACTIVE_RENEWED',
          activatedAt: res.profile.activatedAt || now.toISOString(),
          expiresAt: res.profile.expiresAt,
          monthlyRentNtd: 100,
          totalRenewalsCount: res.profile.totalRenewalsCount,
          lastSettlementTxnId: res.settlement.transactionId,
          binaryNodeId: res.profile.binaryNodeId || res.binaryNode.nodeId,
          binaryParentId: res.binaryNode.parentId,
          binaryPosition:
            res.binaryNode.placementPosition === 'L' || res.binaryNode.placementPosition === 'R' || res.binaryNode.placementPosition === 'ROOT'
              ? res.binaryNode.placementPosition
              : undefined,
          binaryDepth: res.binaryNode.depth,
          extraBinaryNodeIds: extraList.length > 0 ? extraList : undefined,
        };

        breakdowns.push(res.settlement);
        receiptItems.push({
          moduleKey: 'BOOKING',
          title: cat.title,
          codeLabel: `${res.profile.licenseId} · ${cat.codeLabel}`,
          action: forceNewSlot ? 'NEW_BINARY_SEAT' : 'PAID_RENEWAL',
          amountNtd: 100,
          newExpiresAt: res.profile.expiresAt || new Date(now.getTime() + 30 * 86400000).toISOString(),
          settlementTxnId: res.settlement.transactionId,
          binaryNodeId: res.binaryNode.nodeId,
          binaryParentId: res.binaryNode.parentId,
          binaryPosition:
            res.binaryNode.placementPosition === 'L' || res.binaryNode.placementPosition === 'R' || res.binaryNode.placementPosition === 'ROOT'
              ? res.binaryNode.placementPosition
              : undefined,
          binaryDepth: res.binaryNode.depth,
          isNewBinaryNode: res.isNewBinaryNode,
        });
      } else {
        const cur = subs[cat.key] || {
          moduleKey: cat.key,
          licenseCode: `SW-${cat.key}-${effectiveMid.replace(/[^A-Z0-9]/gi, '')}`,
          status: 'NOT_ORDERED',
          monthlyRentNtd: 100,
          totalRenewalsCount: 0,
        };

        const existingSlotId = forceNewSlot
          ? undefined
          : cur.binaryNodeId || (cat.key === 'EVENT' ? member?.binaryNodeId : undefined);

        const allocated = erpEngine.allocateBinaryNodeForSoftware({
          memberMid: effectiveMid,
          softwareKey: cat.key,
          softwareTitle: cat.title,
          existingBinaryNodeId: existingSlotId,
          forceNewSlot,
          status: 'ACTIVE_RENEWED',
          expiresAt: cur.expiresAt,
          executeSettlement: true,
        });

        const settlement = allocated.settlement!;
        breakdowns.push(settlement);

        const newExpIso = allocated.binaryNode.trialExpiresAt;
        const bPos =
          allocated.binaryNode.placementPosition === 'L' ||
          allocated.binaryNode.placementPosition === 'R' ||
          allocated.binaryNode.placementPosition === 'ROOT'
            ? allocated.binaryNode.placementPosition
            : undefined;

        const extraList = [...(cur.extraBinaryNodeIds || [])];
        if (forceNewSlot && cur.binaryNodeId && allocated.binaryNode.nodeId !== cur.binaryNodeId) {
          if (!extraList.includes(allocated.binaryNode.nodeId)) {
            extraList.push(allocated.binaryNode.nodeId);
          }
        }

        subs[cat.key] = {
          ...cur,
          status: 'ACTIVE_RENEWED',
          activatedAt: cur.activatedAt || now.toISOString(),
          expiresAt: forceNewSlot && cur.expiresAt ? cur.expiresAt : newExpIso,
          monthlyRentNtd: 100,
          totalRenewalsCount: (cur.totalRenewalsCount || 0) + 1,
          lastSettlementTxnId: settlement.transactionId,
          binaryNodeId: cur.binaryNodeId || allocated.binaryNode.nodeId,
          binaryParentId: cur.binaryParentId || allocated.binaryNode.parentId,
          binaryPosition: cur.binaryPosition || bPos,
          binaryDepth: cur.binaryDepth ?? allocated.binaryNode.depth,
          extraBinaryNodeIds: extraList.length > 0 ? extraList : undefined,
        };

        if (!nextUnlocked.includes(cat.key)) {
          nextUnlocked.push(cat.key);
        }

        receiptItems.push({
          moduleKey: cat.key,
          title: cat.title,
          codeLabel: cat.codeLabel,
          action: forceNewSlot ? 'NEW_BINARY_SEAT' : 'PAID_RENEWAL',
          amountNtd: 100,
          newExpiresAt: newExpIso,
          settlementTxnId: settlement.transactionId,
          binaryNodeId: allocated.binaryNode.nodeId,
          binaryParentId: allocated.binaryNode.parentId,
          binaryPosition: bPos,
          binaryDepth: allocated.binaryNode.depth,
          isNewBinaryNode: allocated.isNewlyAllocated,
        });
      }
    });

    saveMemberModuleSubscriptions(effectiveMid, subs);
    saveMemberUnlockedPacks(effectiveMid, nextUnlocked);

    const receipt: SoftwareOrderReceipt = {
      orderId: `ORD-${Date.now().toString().slice(-6)}`,
      memberMid: effectiveMid,
      items: receiptItems,
      totalAmountNtd: receiptItems.length * 100,
      settlementBreakdowns: breakdowns,
      createdAt: now.toISOString(),
    };
    appendMemberOrderReceipt(effectiveMid, receipt);

    setCartKeys([]);
    setActiveReceiptModal(receipt);
    const newlyAddedNodes = receiptItems.filter((i) => i.isNewBinaryNode && i.binaryNodeId).map((i) => i.binaryNodeId);
    showToast(
      newlyAddedNodes.length > 0
        ? `訂購結帳成功！已配置新雙軌節點 ${newlyAddedNodes.join('、')} 並完成 100% 閉環分潤！`
        : `續約結帳成功！共 ${receiptItems.length} 套 AI 軟體（NT$ ${receipt.totalAmountNtd}），已執行 100% 閉環分潤！`
    );
    ensureMemberCloudWorkspace(effectiveMid);
    notifyCloudVaultUpdated(effectiveMid);
    forceRefresh();
    notifyNodesUpdated(effectiveMid);
    onOrderCompleted?.();
  };

  const dualTrackArchItems = ORDERABLE_SOFTWARE_CATALOG.filter((c) => !c.isCore1Plus1);
  const core1Plus1Items = ORDERABLE_SOFTWARE_CATALOG.filter((c) => c.isCore1Plus1);

  // Theme helper classes
  const cardCls = isLight
    ? 'bg-white border border-slate-200 text-slate-900 shadow-xs'
    : 'bg-slate-900 border border-slate-800 text-slate-100';
  const subCardCls = isLight
    ? 'bg-slate-50 border border-slate-200 text-slate-700'
    : 'bg-slate-950/70 border border-slate-800 text-slate-300';
  const mutedTextCls = isLight ? 'text-slate-500' : 'text-slate-400';

  const renderModuleCard = (item: OrderableModuleCatalogItem, highlight = false) => {
    const sub = subscriptionsMap[item.key];
    const daysInfo = getDaysInfo(sub?.expiresAt, sub?.status);
    const isOrdered = Boolean(sub && sub.status !== 'NOT_ORDERED');
    const isInCart = cartKeys.includes(item.key);
    const IconComp = getModuleIcon(item.key);
    const boundNode = sub?.binaryNodeId ? erpEngine.getBinaryNodeById(sub.binaryNodeId) : undefined;
    const extraSeatsCount = sub?.extraBinaryNodeIds?.length || 0;

    return (
      <div
        key={item.key}
        className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 transition-all ${
          highlight
            ? isLight
              ? 'bg-gradient-to-br from-emerald-50 via-white to-sky-50 border-2 border-emerald-400 shadow-md'
              : 'bg-gradient-to-br from-emerald-950/50 via-slate-900 to-sky-950/40 border-2 border-emerald-500/60 shadow-lg'
            : isInCart
            ? isLight
              ? 'bg-blue-50/60 border-2 border-[#065fd4] shadow-sm'
              : 'bg-indigo-950/30 border-2 border-indigo-500 shadow-md'
            : cardCls
        }`}
      >
        <div className="space-y-3">
          {/* Card Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isOrdered
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : isLight
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                <IconComp className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className={`font-bold text-sm sm:text-base ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                    {item.title}
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                      isLight
                        ? 'bg-slate-100 text-slate-700 border border-slate-200'
                        : 'bg-slate-950 text-sky-300 border border-slate-800'
                    }`}
                  >
                    {item.codeLabel}
                  </span>
                </div>
                <div className="text-[11px] mt-1 flex items-center gap-2 flex-wrap">
                  <span className="text-emerald-500 font-bold">30 天免費體驗</span>
                  <span className={mutedTextCls}>·</span>
                  <span className={`font-mono font-bold ${isLight ? 'text-[#065fd4]' : 'text-amber-300'}`}>
                    月租 NT$ {item.monthlyRentNtd}
                  </span>
                </div>
              </div>
            </div>

            {/* Cart Multi-Select Checkbox */}
            <button
              type="button"
              onClick={() => toggleCartKey(item.key)}
              title="加入批次訂購車"
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1 cursor-pointer shrink-0 transition-colors ${
                isInCart
                  ? 'bg-[#065fd4] text-white border-[#065fd4]'
                  : isLight
                  ? 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                  : 'bg-slate-950 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              {isInCart ? <Check className="w-3 h-3" /> : <ShoppingBag className="w-3 h-3" />}
              <span>{isInCart ? '已選購' : '加選購車'}</span>
            </button>
          </div>

          {/* Dual-Track M/T Capabilities */}
          <div className={`${subCardCls} rounded-xl p-3 space-y-1.5 text-xs`}>
            <div className="flex items-start gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-mono font-bold shrink-0">
                M 主檔
              </span>
              <span className="leading-snug">{item.masterDesc}</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-mono font-bold shrink-0">
                T 流水
              </span>
              <span className="leading-snug">{item.transDesc}</span>
            </div>
          </div>

          {/* Binary Tree Node Binding Strip */}
          {boundNode ? (
            <div
              className={`rounded-xl px-3 py-2 border text-[11px] flex flex-wrap items-center justify-between gap-2 ${
                isLight
                  ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
                  : 'bg-indigo-950/35 border-indigo-800/70 text-indigo-100'
              }`}
            >
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <GitFork className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`} />
                <span className="font-bold">雙軌節點：</span>
                <span className={`font-mono font-bold ${isLight ? 'text-[#065fd4]' : 'text-sky-300'}`}>
                  {boundNode.nodeId}
                </span>
                <span className={`font-mono text-[10px] ${mutedTextCls}`}>
                  (P:{boundNode.parentId} ·{' '}
                  {boundNode.placementPosition === 'L'
                    ? '左區L'
                    : boundNode.placementPosition === 'R'
                    ? '右區R'
                    : 'ROOT'}
                  · D:{boundNode.depth})
                </span>
                {extraSeatsCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-mono text-[10px] font-bold">
                    +{extraSeatsCount} 增購席位
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono font-bold text-emerald-500">
                  收益 {boundNode.totalEarnings.toFixed(1)} 點
                </span>
                {onInspectBinaryNode && (
                  <button
                    type="button"
                    onClick={() => onInspectBinaryNode(boundNode.nodeId)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      isLight
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        : 'bg-indigo-600/80 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    看樹狀圖 →
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div
              className={`rounded-xl px-3 py-2 border border-dashed text-[11px] flex items-center justify-between gap-2 ${
                isLight
                  ? 'bg-slate-50 border-slate-300 text-slate-600'
                  : 'bg-slate-950/50 border-slate-700 text-slate-400'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <GitFork className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>
                  {isOrdered
                    ? '尚未綁定專屬雙軌節點，點擊右側免費排入二元樹'
                    : '開通 / 訂購即自動依 BFS 智慧滑落加入新雙軌節點 (C-2500xxxx)'}
                </span>
              </span>
              {isOrdered && (
                <button
                  type="button"
                  onClick={() => handleActivateTrial(item)}
                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shrink-0 cursor-pointer"
                >
                  加入雙軌節點
                </button>
              )}
            </div>
          )}

          {/* Subscription Status Strip */}
          <div className="flex items-center justify-between text-[11px] px-1">
            <div className="flex items-center gap-1.5">
              {daysInfo.days <= 0 && sub && sub.status !== 'NOT_ORDERED' ? (
                <Lock className="w-3.5 h-3.5 text-rose-500" />
              ) : (
                <Clock className={`w-3.5 h-3.5 ${isOrdered ? 'text-emerald-500' : mutedTextCls}`} />
              )}
              <span
                className={`font-semibold ${
                  daysInfo.days <= 0 && sub && sub.status !== 'NOT_ORDERED'
                    ? 'text-rose-500'
                    : sub?.status === 'ACTIVE_RENEWED'
                    ? 'text-emerald-500'
                    : sub?.status === 'TRIAL_ACTIVE'
                    ? isLight
                      ? 'text-[#065fd4]'
                      : 'text-sky-400'
                    : mutedTextCls
                }`}
              >
                {sub && sub.status !== 'NOT_ORDERED' && daysInfo.days <= 0
                  ? '未續約唯讀 (僅查舊資料 · 禁新增)'
                  : sub?.status === 'ACTIVE_RENEWED'
                  ? `正式月租授權中 (${daysInfo.label})`
                  : sub?.status === 'TRIAL_ACTIVE'
                  ? `免費體驗中 (${daysInfo.label})`
                  : '尚未開通（可享 30 天免費體驗）'}
              </span>
            </div>
            {sub && sub.totalRenewalsCount > 0 && (
              <span className={`font-mono ${mutedTextCls}`}>已續約 {sub.totalRenewalsCount} 期</span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-slate-200/20 flex flex-wrap items-center gap-2">
          {!isOrdered ? (
            <button
              type="button"
              onClick={() => handleActivateTrial(item)}
              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>免費開通 30 天 + 加雙軌節點</span>
            </button>
          ) : (
            onOpenModule && (
              <button
                type="button"
                onClick={() => onOpenModule(item.key)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${
                  isLight
                    ? 'bg-slate-900 hover:bg-slate-800 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                }`}
              >
                <span>立即開啟使用</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => handlePaidOrderKeys([item.key])}
            className="flex-1 py-2 px-3 rounded-xl bg-[#065fd4] hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>{isOrdered ? '月租 NT$ 100 續約' : 'NT$ 100 訂購 + 加雙軌節點'}</span>
          </button>

          {isOrdered && (
            <button
              type="button"
              onClick={() => handlePaidOrderKeys([item.key], { forceNewSlot: true })}
              title="為此 AI 系統加購一席全新的雙軌二元樹節點 (NT$ 100 同步閉環清算)"
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer border transition-colors ${
                isLight
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border-amber-700/70'
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>+增購新雙軌節點</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Inline Notification Toast */}
      {toastMsg && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Banner */}
      <div
        className={`rounded-2xl p-6 ${
          isLight
            ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md'
            : 'bg-slate-900 border border-slate-800 text-slate-100'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-sky-300 font-semibold">
              <ShoppingBag className="w-4 h-4" />
              <span>AI 軟體完整雙軌模組架構訂購中心 · {member?.name || effectiveMid} ({effectiveMid})</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              AI 軟體完整雙軌模組架構 訂購系統
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              新會員已內建「1+1 AI 軟體」（通訊錄 CRM + 活動行銷）；可於下方 <strong className="text-emerald-300">AI 軟體完整雙軌模組架構（個人預約系統 BOOKING_M/T ＋ 代辦事項系統 TODO_M/T ＋ 8 大產業雙軌模組）</strong> 自由開通主檔 (`_M`) 與流水 (`_T`)，全品項均享 <strong className="text-amber-300">30 天免費體驗 · 期滿月租 100 元</strong>（100% 進入閉環分潤撥發）。
            </p>
          </div>

          {isHqAdminView && (
            <div className="shrink-0">
              <label className="block text-[11px] text-slate-400 mb-1">總部代為檢視會員帳號：</label>
              <select
                value={selectedHqMid}
                onChange={(e) => {
                  setSelectedHqMid(e.target.value);
                  setCartKeys([]);
                }}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100"
              >
                {allMembers.map((m) => (
                  <option key={m.mid} value={m.mid}>
                    {m.mid} - {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
          <div className="bg-white/10 rounded-xl px-4 py-2.5">
            <div className="text-[11px] text-slate-300">已開通 AI 系統總數</div>
            <div className="text-lg font-bold font-mono text-white">
              {stats.activeCount} / {stats.totalCatalog} 套
            </div>
          </div>
          <div className="bg-white/10 rounded-xl px-4 py-2.5">
            <div className="text-[11px] text-sky-300">30 天免費體驗 / 月租授權</div>
            <div className="text-lg font-bold font-mono text-sky-200">
              {stats.trialCount} 體驗 · {stats.renewedCount} 續約
            </div>
          </div>
          <div className="bg-white/10 rounded-xl px-4 py-2.5">
            <div className="text-[11px] text-emerald-300">名下 AI 雙軌節點總席數</div>
            <div className="text-lg font-bold font-mono text-emerald-200">
              {stats.binarySeatsCount} 席
            </div>
          </div>
          <div className="bg-white/10 rounded-xl px-4 py-2.5">
            <div className="text-[11px] text-amber-300">累積訂購憑證紀錄</div>
            <div className="text-lg font-bold font-mono text-amber-200">{stats.ordersCount} 筆</div>
          </div>
        </div>
      </div>

      {/* Section 1: AI 軟體完整雙軌模組架構 (個人預約系統 BOOKING_M/T + 代辦事項系統 TODO_M/T + 8 大產業雙軌模組) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
            <Layers className="w-4 h-4 text-[#065fd4]" />
            <span>AI 軟體完整雙軌模組架構（個人預約 + 代辦事項 + 8 大產業雙軌模組 · 30 天免費 · 月租 100 元）</span>
          </h3>
          <button
            type="button"
            onClick={() => {
              const allDualTrackKeys = dualTrackArchItems.map((i) => i.key);
              const allSelected = allDualTrackKeys.every((k) => cartKeys.includes(k));
              setCartKeys(allSelected ? [] : allDualTrackKeys);
            }}
            className="text-xs font-bold text-[#065fd4] hover:underline cursor-pointer self-start sm:self-auto"
          >
            一鍵全選雙軌架構全部 {dualTrackArchItems.length} 套模組加入購物車
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dualTrackArchItems.map((item) =>
            renderModuleCard(item, item.key === 'BOOKING' || item.key === 'TODO')
          )}
        </div>

        {/* Quick Booking Form + Scoped Appointments Panel (個人預約系統 BOOKING_M/T 實作) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start pt-2">
          {/* Left 7 cols: Exact 8-field Booking Form */}
          <div className={`lg:col-span-7 ${cardCls} rounded-2xl p-5 space-y-4`}>
            <div className="flex items-center justify-between border-b border-slate-200/20 pb-3">
              <div>
                <h4 className={`font-bold text-sm flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  <PlusCircle className="w-4 h-4 text-emerald-500" />
                  <span>個人預約系統 (BOOKING_M/T) — 快速新增預約表單</span>
                </h4>
                <p className={`text-[11px] mt-0.5 ${mutedTextCls}`}>
                  送出後自動開通 30 天免費預約授權，並即時寫入「預約明細」與「通訊追蹤 (CONTACT_T)」。
                </p>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 text-[11px] font-bold">
                30 天免費 · 月租 100 元
              </span>
            </div>

            {lastCreatedApt && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/40 px-3.5 py-2.5 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-500 font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    預約建立成功：{lastCreatedApt.appointmentId}（{lastCreatedApt.clientName} · {lastCreatedApt.date} {lastCreatedApt.timeSlot}）
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setLastCreatedApt(null)}
                  className="text-emerald-500 hover:opacity-75 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {bookingPerm.isExpired && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/40 px-3.5 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-rose-500 font-semibold">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>個人預約系統未續約（已到期）：僅能查看右側舊資料，禁止新增預約。</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const res = renewMemberModuleNow(effectiveMid, 'BOOKING');
                    showToast(res.message);
                    forceRefresh();
                    onOrderCompleted?.();
                  }}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                >
                  續約 NT$ 100 解鎖
                </button>
              </div>
            )}

            <form id="bookingForm" onSubmit={handleQuickCreateBooking} className="grid grid-cols-12 gap-3">
              <div className="col-span-12">
                <input
                  id="name"
                  type="text"
                  required
                  value={bkName}
                  onChange={(e) => setBkName(e.target.value)}
                  placeholder="姓名 *"
                  className={`w-full rounded-xl px-3.5 py-2.5 text-sm border focus:outline-none focus:border-emerald-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                />
              </div>

              <div className="col-span-12 sm:col-span-6">
                <input
                  id="mobile"
                  type="text"
                  value={bkMobile}
                  onChange={(e) => setBkMobile(e.target.value)}
                  placeholder="手機"
                  className={`w-full rounded-xl px-3.5 py-2.5 text-sm font-mono border focus:outline-none focus:border-emerald-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                />
              </div>

              <div className="col-span-12 sm:col-span-6">
                <input
                  id="phone"
                  type="text"
                  value={bkPhone}
                  onChange={(e) => setBkPhone(e.target.value)}
                  placeholder="電話"
                  className={`w-full rounded-xl px-3.5 py-2.5 text-sm font-mono border focus:outline-none focus:border-emerald-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                />
              </div>

              <div className="col-span-12 sm:col-span-6">
                <input
                  id="date"
                  type="date"
                  value={bkDate}
                  onChange={(e) => setBkDate(e.target.value)}
                  className={`w-full rounded-xl px-3.5 py-2.5 text-sm font-mono border focus:outline-none focus:border-emerald-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                />
              </div>

              <div className="col-span-12 sm:col-span-6">
                <input
                  id="time"
                  type="time"
                  value={bkTime}
                  onChange={(e) => setBkTime(e.target.value)}
                  className={`w-full rounded-xl px-3.5 py-2.5 text-sm font-mono border focus:outline-none focus:border-emerald-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                />
              </div>

              <div className="col-span-12 sm:col-span-6">
                <input
                  id="reason"
                  type="text"
                  value={bkReason}
                  onChange={(e) => setBkReason(e.target.value)}
                  placeholder="事由"
                  className={`w-full rounded-xl px-3.5 py-2.5 text-sm border focus:outline-none focus:border-emerald-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                />
              </div>

              <div className="col-span-12 sm:col-span-6">
                <input
                  id="note"
                  type="text"
                  value={bkNote}
                  onChange={(e) => setBkNote(e.target.value)}
                  placeholder="備註"
                  className={`w-full rounded-xl px-3.5 py-2.5 text-sm border focus:outline-none focus:border-emerald-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                />
              </div>

              <div className="col-span-12">
                <input
                  id="detail"
                  type="text"
                  value={bkDetail}
                  onChange={(e) => setBkDetail(e.target.value)}
                  placeholder="詳細情況"
                  className={`w-full rounded-xl px-3.5 py-2.5 text-sm border focus:outline-none focus:border-emerald-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                />
              </div>

              <div className="col-span-12 pt-1">
                <button
                  type="submit"
                  disabled={bookingPerm.isExpired}
                  className={`w-full py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors ${
                    bookingPerm.isExpired
                      ? 'bg-slate-400 text-white cursor-not-allowed opacity-70'
                      : 'bg-[#065fd4] hover:bg-blue-600 text-white cursor-pointer'
                  }`}
                >
                  {bookingPerm.isExpired ? <Lock className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                  <span>{bookingPerm.isExpired ? '未續約唯讀中（僅查舊資料 · 禁新增）' : '新增預約'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right 5 cols: Scoped Appointments Feed */}
          <div className={`lg:col-span-5 ${cardCls} rounded-2xl p-5 space-y-3`}>
            <div className="flex items-center justify-between border-b border-slate-200/20 pb-3">
              <h4 className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                本人預約紀錄清單 ({memberAppointments.length})
              </h4>
              {onOpenModule && (
                <button
                  type="button"
                  onClick={() => onOpenModule('BOOKING')}
                  className="text-xs font-bold text-[#065fd4] hover:underline cursor-pointer"
                >
                  完整工作台 →
                </button>
              )}
            </div>

            {memberAppointments.length === 0 ? (
              <div className={`py-8 text-center text-xs ${mutedTextCls}`}>
                目前尚無預約資料，請於左側表單快速新增第一筆預約！
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {memberAppointments.slice(0, 8).map((apt) => (
                  <div
                    key={apt.appointmentId}
                    className={`${subCardCls} rounded-xl p-3 text-xs space-y-1.5`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold flex items-center gap-1.5">
                        <span className="font-mono text-[#065fd4]">{apt.appointmentId}</span>
                        <span className={isLight ? 'text-slate-900' : 'text-slate-100'}>
                          {apt.clientName}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          apt.status === 'COMPLETED'
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : apt.status === 'CONFIRMED'
                            ? 'bg-sky-500/15 text-sky-500'
                            : apt.status === 'CANCELLED'
                            ? 'bg-slate-500/20 text-slate-400'
                            : 'bg-amber-500/15 text-amber-500'
                        }`}
                      >
                        {apt.status === 'PENDING'
                          ? '待確認'
                          : apt.status === 'CONFIRMED'
                          ? '已確認'
                          : apt.status === 'COMPLETED'
                          ? '已完成'
                          : '已取消'}
                      </span>
                    </div>

                    <div className={`font-mono text-[11px] ${mutedTextCls}`}>
                      {apt.date} {apt.timeSlot} · 手機：{apt.clientPhone}
                      {apt.clientTel ? ` · 電話：${apt.clientTel}` : ''}
                    </div>

                    <div className="text-[11px]">
                      <span className="font-semibold">事由：</span>
                      {apt.reason || apt.serviceTitle}
                      {apt.notes ? ` · 備註：${apt.notes}` : ''}
                    </div>

                    {apt.detail && (
                      <div className={`text-[11px] ${mutedTextCls} line-clamp-2`}>
                        詳細：{apt.detail}
                      </div>
                    )}

                    {(apt.status === 'PENDING' || apt.status === 'CONFIRMED') && (
                      <div className="pt-1 flex items-center gap-1.5">
                        {apt.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => handleQuickAptStatus(apt.appointmentId, 'CONFIRMED')}
                            className="px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold cursor-pointer"
                          >
                            確認
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleQuickAptStatus(apt.appointmentId, 'COMPLETED')}
                          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer"
                        >
                          完成
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAptStatus(apt.appointmentId, 'CANCELLED')}
                          className="px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-white text-[10px] cursor-pointer"
                        >
                          取消
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Todo Form + Scoped Todos Panel (代辦事項系統 TODO_M/T 實作) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start pt-2">
          {/* Left 7 cols: Quick Todo Form */}
          <div className={`lg:col-span-7 ${cardCls} rounded-2xl p-5 space-y-4`}>
            <div className="flex items-center justify-between border-b border-slate-200/20 pb-3">
              <div>
                <h4 className={`font-bold text-sm flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  <ListTodo className="w-4 h-4 text-blue-500" />
                  <span>代辦事項系統 (TODO_M/T) — 快速新增代辦任務</span>
                </h4>
                <p className={`text-[11px] mt-0.5 ${mutedTextCls}`}>
                  送出後自動開通 30 天免費代辦授權，並同步寫入全能五星會員系統「代辦事項明細 (TODO_T)」。
                </p>
              </div>
              <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-500 text-[11px] font-bold">
                30 天免費 · 月租 100 元
              </span>
            </div>

            {todoPerm.isExpired && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/40 px-3.5 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-rose-500 font-semibold">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>代辦事項系統未續約（已到期）：僅能查看右側歷史待辦，禁止新增事項。</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const res = renewMemberModuleNow(effectiveMid, 'TODO');
                    showToast(res.message);
                    forceRefresh();
                    onOrderCompleted?.();
                  }}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                >
                  續約 NT$ 100 解鎖
                </button>
              </div>
            )}

            <form onSubmit={handleQuickCreateTodo} className="grid grid-cols-12 gap-3">
              <div className="col-span-12">
                <input
                  type="text"
                  required
                  value={todoTitle}
                  onChange={(e) => setTodoTitle(e.target.value)}
                  placeholder="事項標題 *（例：追蹤預約顧客、核對本月出貨明細）"
                  className={`w-full rounded-xl px-3.5 py-2.5 text-sm border focus:outline-none focus:border-blue-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                />
              </div>

              <div className="col-span-12 sm:col-span-6">
                <input
                  type="text"
                  value={todoProject}
                  onChange={(e) => setTodoProject(e.target.value)}
                  placeholder="所屬專案（選填）"
                  className={`w-full rounded-xl px-3.5 py-2.5 text-sm border focus:outline-none focus:border-blue-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                />
              </div>

              <div className="col-span-12 sm:col-span-6">
                <select
                  value={todoPriority}
                  onChange={(e) => setTodoPriority(e.target.value)}
                  className={`w-full rounded-xl px-3.5 py-2.5 text-sm border focus:outline-none focus:border-blue-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                >
                  <option value="緊急重要">優先級：緊急重要</option>
                  <option value="高">優先級：高</option>
                  <option value="中">優先級：中</option>
                  <option value="低">優先級：低</option>
                </select>
              </div>

              <div className="col-span-12 sm:col-span-6">
                <input
                  type="date"
                  value={todoDate}
                  onChange={(e) => setTodoDate(e.target.value)}
                  className={`w-full rounded-xl px-3.5 py-2.5 text-sm font-mono border focus:outline-none focus:border-blue-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                />
              </div>

              <div className="col-span-12 sm:col-span-6">
                <input
                  type="time"
                  value={todoTime}
                  onChange={(e) => setTodoTime(e.target.value)}
                  className={`w-full rounded-xl px-3.5 py-2.5 text-sm font-mono border focus:outline-none focus:border-blue-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                />
              </div>

              <div className="col-span-12">
                <input
                  type="text"
                  value={todoDetail}
                  onChange={(e) => setTodoDetail(e.target.value)}
                  placeholder="詳細說明與備註..."
                  className={`w-full rounded-xl px-3.5 py-2.5 text-sm border focus:outline-none focus:border-blue-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                />
              </div>

              <div className="col-span-12 pt-1">
                <button
                  type="submit"
                  disabled={todoPerm.isExpired}
                  className={`w-full py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors ${
                    todoPerm.isExpired
                      ? 'bg-slate-400 text-white cursor-not-allowed opacity-70'
                      : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                  }`}
                >
                  {todoPerm.isExpired ? <Lock className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                  <span>{todoPerm.isExpired ? '未續約唯讀中（僅查舊資料 · 禁新增）' : '新增代辦事項'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right 5 cols: Scoped Todos Feed */}
          <div className={`lg:col-span-5 ${cardCls} rounded-2xl p-5 space-y-3`}>
            <div className="flex items-center justify-between border-b border-slate-200/20 pb-3">
              <h4 className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                本人代辦事項清單 ({memberTodos.length})
              </h4>
              {onOpenModule && (
                <button
                  type="button"
                  onClick={() => onOpenModule('TODO')}
                  className="text-xs font-bold text-[#065fd4] hover:underline cursor-pointer"
                >
                  開啟 TODO_M/T →
                </button>
              )}
            </div>

            {memberTodos.length === 0 ? (
              <div className={`py-8 text-center text-xs ${mutedTextCls}`}>
                目前尚無代辦任務，請於左側快速新增第一筆代辦事項！
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {memberTodos.slice(0, 8).map((td) => (
                  <div
                    key={td.ID}
                    className={`${subCardCls} rounded-xl p-3 text-xs space-y-1.5`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-[#065fd4] shrink-0">{td.ID}</span>
                        <span className={`truncate ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                          {td.事項標題}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          td.狀態 === '已完成'
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : td.狀態 === '進行中'
                            ? 'bg-sky-500/15 text-sky-500'
                            : td.狀態 === '延後'
                            ? 'bg-slate-500/20 text-slate-400'
                            : 'bg-amber-500/15 text-amber-500'
                        }`}
                      >
                        {td.狀態}
                      </span>
                    </div>

                    <div className={`font-mono text-[11px] ${mutedTextCls}`}>
                      截止：{td.截止日期 || '-'} {td.提醒時間 || ''} · 優先級：{td.優先級 || '中'}
                    </div>

                    {td.專案名稱 && (
                      <div className="text-[11px]">
                        <span className="font-semibold">專案：</span>
                        {td.專案名稱}
                      </div>
                    )}

                    {td.詳細說明 && (
                      <div className={`text-[11px] ${mutedTextCls} line-clamp-2`}>
                        {td.詳細說明}
                      </div>
                    )}

                    {td.狀態 !== '已完成' && td.狀態 !== '延後' && (
                      <div className="pt-1 flex items-center gap-1.5">
                        {td.狀態 === '待處理' && (
                          <button
                            type="button"
                            onClick={() => handleQuickTodoStatus(td.ID, '進行中')}
                            className="px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold cursor-pointer"
                          >
                            開始執行
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleQuickTodoStatus(td.ID, '已完成')}
                          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer"
                        >
                          完成結案
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 2: 新會員預設 1+1 AI 軟體 (通訊錄 CRM + 活動行銷) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            <span>新會員 1+1 AI 軟體標配（通訊錄 CRM + 活動行銷 · 30 天免費 · 月租 100 元）</span>
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {core1Plus1Items.map((item) => renderModuleCard(item))}
        </div>
      </section>

      {/* Section 4: Recent Software Order Receipts */}
      {receipts.length > 0 && (
        <section className={`${cardCls} rounded-2xl p-5 space-y-3`}>
          <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
            <Receipt className="w-4 h-4 text-amber-500" />
            <span>我的 AI 軟體訂購與閉環續約紀錄 ({receipts.length})</span>
          </h3>
          <div className="divide-y divide-slate-200/20">
            {receipts.slice(0, 8).map((r) => (
              <div
                key={r.orderId}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#065fd4]">{r.orderId}</span>
                    <span className={mutedTextCls}>{new Date(r.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 font-medium">
                    {r.items.map((it) => `${it.title} (${it.codeLabel})`).join('、')}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono font-bold text-emerald-500">
                    {r.totalAmountNtd === 0 ? '30 天免費開通 (NT$ 0)' : `實付 NT$ ${r.totalAmountNtd} (100% 閉環)`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveReceiptModal(r)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                        : 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200'
                    }`}
                  >
                    檢視憑證
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Floating Cart Checkout Bar */}
      {cartKeys.length > 0 && (
        <div className="sticky bottom-3 z-30 bg-slate-900 text-white border border-indigo-500/60 rounded-2xl shadow-2xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-xs text-slate-300">
                已勾選 <strong className="text-white font-mono">{cartKeys.length}</strong> 套 AI 軟體模組
              </div>
              <div className="text-sm font-bold font-mono text-emerald-400">
                月租合計：NT$ {(cartKeys.length * 100).toLocaleString()} 元（100% 閉環撥發 {cartKeys.length * 100} 點）
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCartKeys([])}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
            >
              清空勾選
            </button>
            <button
              type="button"
              onClick={() => handlePaidOrderKeys(cartKeys)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <CreditCard className="w-4 h-4" />
              <span>立即批次訂購結帳 (NT$ {cartKeys.length * 100})</span>
            </button>
          </div>
        </div>
      )}

      {/* Receipt / Settlement Breakdown Modal */}
      {activeReceiptModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-slate-900 text-slate-100 border border-emerald-500/60 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <h4 className="font-bold text-base text-white">AI 軟體訂購授權成功憑證</h4>
                  <div className="text-[11px] font-mono text-slate-400">
                    單號：{activeReceiptModal.orderId} · 會員：{activeReceiptModal.memberMid}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveReceiptModal(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activeReceiptModal.items.map((it, idx) => (
                <div
                  key={`${it.moduleKey}-${it.binaryNodeId || idx}`}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-start justify-between gap-2 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="font-bold text-slate-100">
                      {it.title} <span className="font-mono text-sky-400">({it.codeLabel})</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      效期至：{new Date(it.newExpiresAt).toLocaleDateString()} ·{' '}
                      {it.action === 'TRIAL_ACTIVATE'
                        ? '30 天免費體驗開通'
                        : it.action === 'NEW_BINARY_SEAT'
                        ? '增購新 AI 雙軌節點'
                        : '30 天月租續約授權'}
                    </div>
                    {it.binaryNodeId && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-700 text-indigo-300 font-bold">
                          {it.isNewBinaryNode ? '新配置雙軌節點：' : '綁定雙軌節點：'}
                          {it.binaryNodeId}
                        </span>
                        {it.binaryParentId && (
                          <span className="text-slate-400">
                            P:{it.binaryParentId} ·{' '}
                            {it.binaryPosition === 'L'
                              ? '左區L'
                              : it.binaryPosition === 'R'
                              ? '右區R'
                              : 'ROOT'}
                            {typeof it.binaryDepth === 'number' ? ` · D:${it.binaryDepth}` : ''}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right font-mono font-bold text-emerald-400 shrink-0">
                    {it.amountNtd === 0 ? 'NT$ 0 (免費體驗)' : `NT$ ${it.amountNtd}`}
                  </div>
                </div>
              ))}
            </div>

            {activeReceiptModal.settlementBreakdowns.length > 0 && (
              <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-xl p-3.5 text-xs space-y-1.5">
                <div className="font-bold text-emerald-300">
                  100% 閉環零沉澱清算已入帳（共 {activeReceiptModal.totalAmountNtd} 點全額撥發）
                </div>
                <div className="text-[11px] text-slate-300">
                  每套 NT$100 均依新購買/續約節點向上依公式平帳撥發：15% 推薦獎金 ＋ 15% 安置分紅 ＋ 6% 經營店補貼 ＋ 6% 教育中心培訓 ＋ 30% 艾邦妮科技池 ＋ 28% 總公司營運池 = 100 點。
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              {onInspectBinaryNode && activeReceiptModal.items.find((it) => it.binaryNodeId)?.binaryNodeId && (
                <button
                  type="button"
                  onClick={() => {
                    const targetNode = activeReceiptModal.items.find((it) => it.binaryNodeId)?.binaryNodeId;
                    setActiveReceiptModal(null);
                    if (targetNode) onInspectBinaryNode(targetNode);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <GitFork className="w-4 h-4" />
                  <span>在雙軌樹狀圖查看新節點</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveReceiptModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer"
              >
                確認並開始使用已開通模組
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
