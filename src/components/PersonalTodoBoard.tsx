/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { DynamicRecord, getOffsetDateStr } from '../services/memberFiveStarConfig';
import {
  TodoKanbanStatus,
  TodoPriority,
  GasTodoSyncState,
  getMemberTodos,
  createMemberTodo,
  updateMemberTodo,
  updateMemberTodoStatus,
  deleteMemberTodo,
  normalizeTodoStatus,
  isTodoOverdue,
  isTodoDueToday,
  formatOverdueDuration,
  getGasTodoSyncState,
  setGasWebAppUrl,
  syncMemberTodosToGas,
  pullMemberTodosFromGas,
  TODOS_UPDATED_EVENT,
} from '../services/gasTodoSyncService';
import {
  ListTodo,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  GripVertical,
  Trash2,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Cloud,
  CloudOff,
  Link2,
  Calendar,
  Bell,
  Filter,
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  Check,
  X,
  Lock,
  CreditCard,
  Sparkles,
} from 'lucide-react';
import {
  CLOUD_VAULT_UPDATED_EVENT,
  ensureMemberCloudWorkspace,
  getModuleWritePermission,
  notifyCloudVaultUpdated,
  renewMemberModuleNow,
} from '../services/memberCloudVaultService';
import {
  getMemberModuleSubscriptions,
  getMemberUnlockedPacks,
  saveMemberModuleSubscriptions,
  saveMemberUnlockedPacks,
} from '../services/memberFiveStarConfig';
import { erpEngine } from '../services/erpEngine';

interface PersonalTodoBoardProps {
  memberMid: string;
  theme?: 'dark' | 'light';
  onTodosChanged?: () => void;
  onOpenModuleDetails?: () => void;
}

const COLUMNS: Array<{
  key: TodoKanbanStatus;
  title: string;
  subtitle: string;
  accentDot: string;
}> = [
  { key: '待處理', title: '待處理', subtitle: '尚未啟動之待辦任務', accentDot: 'bg-amber-500' },
  { key: '處理中', title: '處理中', subtitle: '執行追蹤與推進項目', accentDot: 'bg-sky-500' },
  { key: '已完成', title: '已完成', subtitle: '已結案並寫入完成戳記', accentDot: 'bg-emerald-500' },
];

export const PersonalTodoBoard: React.FC<PersonalTodoBoardProps> = ({
  memberMid,
  theme = 'dark',
  onTodosChanged,
  onOpenModuleDetails,
}) => {
  const isDark = theme === 'dark';

  const [todos, setTodos] = useState<DynamicRecord[]>(() => getMemberTodos(memberMid));
  const [syncState, setSyncState] = useState<GasTodoSyncState>(() => getGasTodoSyncState(memberMid));
  const [isSyncing, setIsSyncing] = useState(false);

  // Add Task Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState(() => getOffsetDateStr(0));
  const [newReminderTime, setNewReminderTime] = useState('18:00');
  const [newPriority, setNewPriority] = useState<TodoPriority>('高');
  const [newProject, setNewProject] = useState('個人代辦任務');
  const [newDetail, setNewDetail] = useState('');

  // Filters & Dragging State
  const [onlyUrgentFilter, setOnlyUrgentFilter] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TodoKanbanStatus | null>(null);

  // Inline Edit Task State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editReminderTime, setEditReminderTime] = useState('');
  const [editPriority, setEditPriority] = useState<TodoPriority>('中');
  const [editDetail, setEditDetail] = useState('');

  // GAS Config Panel & Inline Notice
  const [showGasConfig, setShowGasConfig] = useState(false);
  const [gasUrlInput, setGasUrlInput] = useState(() => getGasTodoSyncState(memberMid).gasWebAppUrl);
  const [boardNotice, setBoardNotice] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [vaultTick, setVaultTick] = useState(0);

  const todoPerm = useMemo(
    () => getModuleWritePermission(memberMid, 'TODO'),
    [memberMid, todos.length, vaultTick]
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30000);
    const onTodosUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent<{ memberMid?: string }>).detail;
      if (!detail?.memberMid || detail.memberMid === memberMid) {
        setTodos(getMemberTodos(memberMid));
        setSyncState(getGasTodoSyncState(memberMid));
        setVaultTick((t) => t + 1);
      }
    };
    const onCloudUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent<{ memberMid?: string }>).detail;
      if (!detail?.memberMid || detail.memberMid === memberMid) {
        setVaultTick((t) => t + 1);
      }
    };
    window.addEventListener(TODOS_UPDATED_EVENT, onTodosUpdated);
    window.addEventListener(CLOUD_VAULT_UPDATED_EVENT, onCloudUpdated);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(TODOS_UPDATED_EVENT, onTodosUpdated);
      window.removeEventListener(CLOUD_VAULT_UPDATED_EVENT, onCloudUpdated);
    };
  }, [memberMid]);

  useEffect(() => {
    setTodos(getMemberTodos(memberMid));
    const st = getGasTodoSyncState(memberMid);
    setSyncState(st);
    setGasUrlInput(st.gasWebAppUrl);
    setEditingId(null);

    if (st.gasWebAppUrl) {
      let cancelled = false;
      (async () => {
        setIsSyncing(true);
        if (st.pendingOpsCount > 0) {
          const flushed = await syncMemberTodosToGas(memberMid, 'syncTodos');
          if (!cancelled) setSyncState(flushed);
        } else {
          const pulled = await pullMemberTodosFromGas(memberMid);
          if (!cancelled) {
            setTodos(pulled.todos);
            setSyncState(pulled.syncState);
            onTodosChanged?.();
          }
        }
        if (!cancelled) setIsSyncing(false);
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [memberMid]);

  const showNotice = (msg: string) => {
    setBoardNotice(msg);
    setTimeout(() => {
      setBoardNotice((prev) => (prev === msg ? null : prev));
    }, 3600);
  };

  const now = useMemo(() => new Date(nowTick), [nowTick]);

  const overdueTodos = useMemo(
    () => todos.filter((t) => isTodoOverdue(t, now)),
    [todos, now]
  );

  const dueTodayTodos = useMemo(
    () => todos.filter((t) => isTodoDueToday(t, now)),
    [todos, now]
  );

  const visibleTodos = useMemo(() => {
    if (!onlyUrgentFilter) return todos;
    return todos.filter((t) => isTodoOverdue(t, now) || isTodoDueToday(t, now));
  }, [todos, onlyUrgentFilter, now]);

  const groupedByStatus = useMemo(() => {
    const map: Record<TodoKanbanStatus, DynamicRecord[]> = {
      待處理: [],
      處理中: [],
      已完成: [],
    };
    visibleTodos.forEach((rec) => {
      const col = normalizeTodoStatus(rec['狀態']);
      map[col].push(rec);
    });
    return map;
  }, [visibleTodos]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!todoPerm.canCreate) {
      setShowAddForm(false);
      showNotice(
        todoPerm.readOnlyReason ||
          '代辦事項系統尚未續約或開通，僅能查看舊資料，不能新增待辦任務！'
      );
      return;
    }
    if (!newTitle.trim()) return;
    setIsSyncing(true);
    const res = await createMemberTodo(memberMid, {
      title: newTitle,
      dueDate: newDueDate,
      reminderTime: newReminderTime,
      priority: newPriority,
      projectName: newProject,
      detail: newDetail,
      status: '待處理',
    });
    setTodos(res.todos);
    setSyncState(res.syncState);
    setIsSyncing(false);
    setNewTitle('');
    setNewDetail('');
    setShowAddForm(false);
    onTodosChanged?.();
    showNotice(`已新增待辦「${res.created['事項標題']}」並同步至 GAS TODO_T`);
  };

  const handleActivateTodoTrialOrRenew = () => {
    if (todoPerm.isNotOrdered) {
      const member = erpEngine.getMemberById(memberMid);
      const now = new Date();
      const expIso = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
      const subs = getMemberModuleSubscriptions(memberMid, member?.trialExpiresAt);
      const allocated = erpEngine.allocateBinaryNodeForSoftware({
        memberMid,
        softwareKey: 'TODO',
        softwareTitle: '代辦事項系統',
        existingBinaryNodeId: subs.TODO?.binaryNodeId,
        status: 'TRIAL_ACTIVE',
        expiresAt: expIso,
        executeSettlement: false,
      });
      subs.TODO = {
        moduleKey: 'TODO',
        licenseCode: subs.TODO?.licenseCode || `SW-TODO-${memberMid.replace(/[^A-Z0-9]/gi, '')}`,
        status: 'TRIAL_ACTIVE',
        activatedAt: now.toISOString(),
        expiresAt: expIso,
        monthlyRentNtd: 100,
        totalRenewalsCount: 0,
        binaryNodeId: allocated.binaryNode.nodeId,
        binaryParentId: allocated.binaryNode.parentId,
        binaryDepth: allocated.binaryNode.depth,
      };
      saveMemberModuleSubscriptions(memberMid, subs);
      const unlocked = getMemberUnlockedPacks(memberMid);
      if (!unlocked.includes('TODO')) {
        saveMemberUnlockedPacks(memberMid, [...unlocked, 'TODO']);
      }
      ensureMemberCloudWorkspace(memberMid);
      notifyCloudVaultUpdated(memberMid);
      setVaultTick((t) => t + 1);
      onTodosChanged?.();
      showNotice('已免費開通「代辦事項系統 (TODO_M/T)」30 天體驗並恢復新增任務權限！');
      return;
    }

    const res = renewMemberModuleNow(memberMid, 'TODO');
    setVaultTick((t) => t + 1);
    onTodosChanged?.();
    showNotice(res.message);
  };

  const handleMoveStatus = async (todoId: string, nextStatus: TodoKanbanStatus) => {
    const target = todos.find((t) => t.ID === todoId);
    if (!target) return;
    const currentStatus = normalizeTodoStatus(target['狀態']);
    if (currentStatus === nextStatus) return;

    setIsSyncing(true);
    const res = await updateMemberTodoStatus(memberMid, todoId, nextStatus);
    setTodos(res.todos);
    setSyncState(res.syncState);
    setIsSyncing(false);
    onTodosChanged?.();
    showNotice(`已將「${target['事項標題']}」移至【${nextStatus}】並同步 GAS`);
  };

  const handleStartEdit = (rec: DynamicRecord) => {
    setEditingId(rec.ID);
    setEditTitle(rec['事項標題'] || '');
    setEditDueDate(rec['截止日期'] || getOffsetDateStr(0));
    setEditReminderTime(rec['提醒時間'] || '18:00');
    setEditPriority((rec['優先級'] as TodoPriority) || '中');
    setEditDetail(rec['詳細說明'] || '');
  };

  const handleSaveEdit = async (e: React.FormEvent, todoId: string) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    setIsSyncing(true);
    const res = await updateMemberTodo(memberMid, todoId, {
      title: editTitle,
      dueDate: editDueDate,
      reminderTime: editReminderTime,
      priority: editPriority,
      detail: editDetail,
    });
    setTodos(res.todos);
    setSyncState(res.syncState);
    setEditingId(null);
    setIsSyncing(false);
    onTodosChanged?.();
    showNotice(`已更新待辦「${editTitle.trim()}」並同步至 GAS`);
  };

  const handlePostponeTomorrow = async (rec: DynamicRecord) => {
    const tomorrowStr = getOffsetDateStr(1);
    setIsSyncing(true);
    const res = await updateMemberTodo(memberMid, rec.ID, {
      dueDate: tomorrowStr,
    });
    setTodos(res.todos);
    setSyncState(res.syncState);
    setIsSyncing(false);
    onTodosChanged?.();
    showNotice(`已將「${rec['事項標題']}」延後至明日 (${tomorrowStr}) 並同步 GAS`);
  };

  const handleDeleteTask = async (todoId: string, title: string) => {
    setIsSyncing(true);
    const res = await deleteMemberTodo(memberMid, todoId);
    setTodos(res.todos);
    setSyncState(res.syncState);
    setIsSyncing(false);
    onTodosChanged?.();
    showNotice(`已移除待辦「${title}」並通知 GAS deleteTodo`);
  };

  const handleManualSyncToGas = async () => {
    setIsSyncing(true);
    const nextState = await syncMemberTodosToGas(memberMid, 'syncTodos');
    setSyncState(nextState);
    setIsSyncing(false);
    showNotice(nextState.lastMessage);
  };

  const handlePullFromGas = async () => {
    setIsSyncing(true);
    const res = await pullMemberTodosFromGas(memberMid);
    setTodos(res.todos);
    setSyncState(res.syncState);
    setIsSyncing(false);
    onTodosChanged?.();
    showNotice(res.syncState.lastMessage);
  };

  const handleSaveGasUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setGasWebAppUrl(gasUrlInput);
    const updated = getGasTodoSyncState(memberMid);
    setSyncState(updated);
    showNotice(
      gasUrlInput.trim()
        ? '已儲存 GAS Web App URL，後續變更將即時呼叫實機 doPost！'
        : '已清除 GAS URL，切換回內建 Code.gs 離線帳本同步模式'
    );
  };

  // Theme tokens
  const cardSurface = isDark
    ? 'bg-slate-900 border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900 shadow-xs';
  const subSurface = isDark
    ? 'bg-slate-950/80 border-slate-800 text-slate-300'
    : 'bg-slate-50 border-slate-200 text-slate-700';
  const inputCls = isDark
    ? 'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500'
    : 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#065fd4]';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-500';

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case '緊急重要':
        return isDark
          ? 'bg-rose-950 text-rose-300 border-rose-800'
          : 'bg-rose-50 text-rose-700 border-rose-200';
      case '高':
        return isDark
          ? 'bg-amber-950 text-amber-300 border-amber-800'
          : 'bg-amber-50 text-amber-700 border-amber-200';
      case '低':
        return isDark
          ? 'bg-slate-800 text-slate-400 border-slate-700'
          : 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return isDark
          ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
          : 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Inline Toast / Feedback Banner */}
      {boardNotice && (
        <div
          className={`px-4 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
            isDark
              ? 'bg-emerald-950/70 border-emerald-700 text-emerald-200'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{boardNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setBoardNotice(null)}
            className="opacity-70 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header + GAS Sync Status & Actions */}
      <div className={`rounded-2xl border p-5 space-y-4 ${cardSurface}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                isDark
                  ? 'bg-indigo-950/80 border-indigo-700/60 text-indigo-400'
                  : 'bg-blue-50 border-blue-200 text-[#065fd4]'
              }`}
            >
              <ListTodo className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">
                  個人待辦任務面板 ({memberMid})
                </h2>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${
                    isDark
                      ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                >
                  TODO_T 看板雙向同步
                </span>
                {overdueTodos.length > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 border ${
                      isDark
                        ? 'bg-rose-950 text-rose-300 border-rose-800'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>{overdueTodos.length} 項已逾期</span>
                  </span>
                )}
              </div>
              <p className={`text-xs mt-1 ${mutedText}`}>
                支援「待處理 / 處理中 / 已完成」拖曳切換狀態、截止日期與提醒時間逾期警示，並即時同步 Google Apps Script (Code.gs) 後端工作表。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyUrgentFilter((v) => !v)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                onlyUrgentFilter
                  ? 'bg-rose-600 text-white border-rose-600'
                  : isDark
                  ? 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>
                {onlyUrgentFilter
                  ? `顯示全部 (${todos.length})`
                  : `逾期與今日到期 (${overdueTodos.length + dueTodayTodos.length})`}
              </span>
            </button>

            <button
              type="button"
              disabled={!todoPerm.canCreate}
              onClick={() => {
                if (!todoPerm.canCreate) {
                  showNotice(
                    todoPerm.readOnlyReason ||
                      '此 AI 軟體尚未續約，目前僅能查看舊資料，不能新增任務！'
                  );
                  return;
                }
                setShowAddForm((v) => !v);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors ${
                !todoPerm.canCreate
                  ? isDark
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed'
                  : isDark
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                  : 'bg-[#065fd4] hover:bg-blue-700 text-white cursor-pointer'
              }`}
            >
              {todoPerm.canCreate ? <Plus className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
              <span>
                {!todoPerm.canCreate
                  ? '未續約唯讀 (禁新增)'
                  : showAddForm
                  ? '收合新增表單'
                  : '新增待辦任務'}
              </span>
            </button>

            {onOpenModuleDetails && (
              <button
                type="button"
                onClick={onOpenModuleDetails}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                }`}
              >
                檢視 TODO_T 卡片明細
              </button>
            )}
          </div>
        </div>

        {/* Read-Only Guard Banner when TODO module is unrenewed / not ordered */}
        {!todoPerm.canCreate && (
          <div
            className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isDark
                ? 'bg-amber-950/40 border-amber-700/80 text-amber-200'
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}
          >
            <div className="flex items-start gap-2.5 text-xs">
              <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div className="space-y-0.5">
                <div className="font-bold">
                  {todoPerm.isExpired
                    ? '代辦事項系統未續約 — 唯讀歸檔模式（只能查看舊資料，不能新增資料）'
                    : '代辦事項系統尚未開通 — 唯讀模式（只能查看既有資料，不能新增資料）'}
                </div>
                <div className="opacity-90">
                  {todoPerm.readOnlyReason ||
                    '下方既有待辦紀錄與 Google 試算表 TODO_T 舊檔可完整瀏覽查詢，若需新增任務請先完成開通或月租 100 元續約。'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleActivateTodoTrialOrRenew}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
            >
              {todoPerm.isNotOrdered ? (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>免費開通 30 天體驗解鎖</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>續約 NT$ 100 (+30天) 恢復新增</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Overdue & Due-Today Reminder Banner */}
        {(overdueTodos.length > 0 || dueTodayTodos.length > 0) && (
          <div
            className={`rounded-xl border p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
              overdueTodos.length > 0
                ? isDark
                  ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
                : isDark
                ? 'bg-amber-950/30 border-amber-800/70 text-amber-200'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-start gap-2.5 text-xs">
              <Bell
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  overdueTodos.length > 0
                    ? isDark
                      ? 'text-rose-400'
                      : 'text-rose-600'
                    : isDark
                    ? 'text-amber-400'
                    : 'text-amber-600'
                }`}
              />
              <div className="space-y-1">
                <div className="font-bold">
                  {overdueTodos.length > 0
                    ? `逾期提醒：您有 ${overdueTodos.length} 項任務已超過截止期限${
                        dueTodayTodos.length > 0 ? `，另有 ${dueTodayTodos.length} 項將於今日到期` : ''
                      }`
                    : `今日到期提醒：您有 ${dueTodayTodos.length} 項待辦任務將於今天到期`}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {overdueTodos.slice(0, 3).map((ot) => (
                    <span
                      key={ot.ID}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                        isDark
                          ? 'bg-rose-900/60 border-rose-700 text-rose-100'
                          : 'bg-white border-rose-200 text-rose-800'
                      }`}
                    >
                      {ot['事項標題']}（{formatOverdueDuration(ot, now) || ot['截止日期']}）
                    </span>
                  ))}
                  {dueTodayTodos.slice(0, 2).map((dt) => (
                    <span
                      key={dt.ID}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                        isDark
                          ? 'bg-amber-900/40 border-amber-700 text-amber-100'
                          : 'bg-white border-amber-200 text-amber-800'
                      }`}
                    >
                      今日 {dt['提醒時間'] || '23:59'} · {dt['事項標題']}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {!onlyUrgentFilter && (
              <button
                type="button"
                onClick={() => setOnlyUrgentFilter(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 cursor-pointer border ${
                  isDark
                    ? 'bg-rose-900/80 hover:bg-rose-800 text-white border-rose-700'
                    : 'bg-white hover:bg-rose-100 text-rose-700 border-rose-300'
                }`}
              >
                篩選警示任務
              </button>
            )}
          </div>
        )}

        {/* GAS Backend Synchronization Strip */}
        <div className={`rounded-xl border p-3.5 space-y-3 ${subSurface}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {syncState.lastSyncStatus === 'OFFLINE_QUEUED' ? (
                <CloudOff className="w-4 h-4 text-amber-500 shrink-0" />
              ) : (
                <Cloud className="w-4 h-4 text-emerald-500 shrink-0" />
              )}
              <span className="font-bold">GAS 後端同步狀態：</span>
              <span
                className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold border ${
                  syncState.lastSyncStatus === 'OFFLINE_QUEUED'
                    ? isDark
                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                    : isDark
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {syncState.gasWebAppUrl
                  ? syncState.lastSyncStatus === 'OFFLINE_QUEUED'
                    ? `待重試佇列 (${syncState.pendingOpsCount})`
                    : '實機 GAS Web App 已連線'
                  : 'GAS Code.gs 雙向帳本模式'}
              </span>
              <span className={`text-[11px] ${mutedText}`}>
                {syncState.lastSyncedAt
                  ? `上次同步：${new Date(syncState.lastSyncedAt).toLocaleTimeString()}`
                  : syncState.lastMessage}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isSyncing}
                onClick={handleManualSyncToGas}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border cursor-pointer disabled:opacity-50 ${
                  isDark
                    ? 'bg-slate-900 hover:bg-slate-800 text-indigo-300 border-slate-700'
                    : 'bg-white hover:bg-slate-100 text-[#065fd4] border-slate-300'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>立即同步至 GAS</span>
              </button>

              {syncState.gasWebAppUrl && (
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={handlePullFromGas}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border cursor-pointer disabled:opacity-50 ${
                    isDark
                      ? 'bg-slate-900 hover:bg-slate-800 text-emerald-300 border-slate-700'
                      : 'bg-white hover:bg-slate-100 text-emerald-700 border-slate-300'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>從 GAS 拉取最新</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowGasConfig((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border cursor-pointer ${
                  isDark
                    ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>GAS 端點設定</span>
                {showGasConfig ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {showGasConfig && (
            <div className={`pt-3 border-t space-y-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <form onSubmit={handleSaveGasUrl} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={gasUrlInput}
                  onChange={(e) => setGasUrlInput(e.target.value)}
                  placeholder="選填已部署的 Google Apps Script Web App URL (例: https://script.google.com/macros/s/.../exec)"
                  className={`${inputCls} flex-1 font-mono`}
                />
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-lg text-xs font-bold text-white shrink-0 cursor-pointer ${
                    isDark ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-[#065fd4] hover:bg-blue-700'
                  }`}
                >
                  儲存端點設定
                </button>
              </form>

              {syncState.logs.length > 0 && (
                <div className="space-y-1">
                  <div className={`text-[11px] font-bold ${mutedText}`}>最近 GAS 同步紀錄 (TODO_T)：</div>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {syncState.logs.slice(0, 4).map((log) => (
                      <div
                        key={log.id}
                        className={`text-[11px] font-mono flex items-center justify-between gap-2 px-2.5 py-1 rounded border ${
                          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                        }`}
                      >
                        <span className="truncate font-sans">
                          <span className="font-mono font-bold mr-1.5">[{log.action}]</span>
                          {log.summary}
                        </span>
                        <span className={`shrink-0 ${mutedText}`}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Inline Task Creation Form */}
        {showAddForm && todoPerm.canCreate && (
          <form
            onSubmit={handleCreateTask}
            className={`rounded-xl border p-4 space-y-3 ${subSurface}`}
          >
            <div className="text-xs font-bold flex items-center justify-between">
              <span>快速建立個人待辦任務（預設加入「待處理」欄位並同步 GAS）</span>
              <span className={`font-mono ${mutedText}`}>承辦：{memberMid}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-5">
                <label className={`block text-[11px] font-semibold mb-1 ${mutedText}`}>
                  任務標題 *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="例如：聯繫張小姐確認 30 天免費體驗與預約時段"
                  className={inputCls}
                />
              </div>

              <div className="md:col-span-2">
                <label className={`block text-[11px] font-semibold mb-1 ${mutedText}`}>
                  截止日期
                </label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="md:col-span-2">
                <label className={`block text-[11px] font-semibold mb-1 ${mutedText}`}>
                  提醒時間
                </label>
                <input
                  type="time"
                  value={newReminderTime}
                  onChange={(e) => setNewReminderTime(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="md:col-span-3">
                <label className={`block text-[11px] font-semibold mb-1 ${mutedText}`}>
                  優先級
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as TodoPriority)}
                  className={inputCls}
                >
                  <option value="緊急重要">緊急重要</option>
                  <option value="高">高</option>
                  <option value="中">中</option>
                  <option value="低">低</option>
                </select>
              </div>

              <div className="md:col-span-4">
                <label className={`block text-[11px] font-semibold mb-1 ${mutedText}`}>
                  所屬專案 / 分類
                </label>
                <input
                  type="text"
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                  placeholder="個人代辦任務"
                  className={inputCls}
                />
              </div>

              <div className="md:col-span-8">
                <label className={`block text-[11px] font-semibold mb-1 ${mutedText}`}>
                  詳細說明
                </label>
                <input
                  type="text"
                  value={newDetail}
                  onChange={(e) => setNewDetail(e.target.value)}
                  placeholder="補充執行要點、聯絡人備註或追蹤網址..."
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSyncing}
                className={`px-4 py-2 rounded-lg text-xs font-bold text-white cursor-pointer disabled:opacity-50 ${
                  isDark ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-[#065fd4] hover:bg-blue-700'
                }`}
              >
                新增並同步至 GAS
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 3-Column Drag-and-Drop Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {COLUMNS.map((col, colIndex) => {
          const items = groupedByStatus[col.key];
          const isDropTarget = dragOverCol === col.key;

          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverCol !== col.key) setDragOverCol(col.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node) && dragOverCol === col.key) {
                  setDragOverCol(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const droppedId = e.dataTransfer.getData('text/plain') || draggingId;
                setDragOverCol(null);
                setDraggingId(null);
                if (droppedId) {
                  handleMoveStatus(droppedId, col.key);
                }
              }}
              className={`rounded-2xl border p-4 flex flex-col min-h-[360px] transition-all ${cardSurface} ${
                isDropTarget
                  ? isDark
                    ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-950/20'
                    : 'ring-2 ring-[#065fd4] border-[#065fd4] bg-blue-50/40'
                  : ''
              }`}
            >
              {/* Column Header */}
              <div
                className={`flex items-center justify-between pb-3 mb-3 border-b ${
                  isDark ? 'border-slate-800' : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.accentDot}`} />
                    <h3 className="text-sm font-bold">{col.title}</h3>
                    <span
                      className={`text-xs font-mono px-2 py-0.5 rounded-full font-bold ${
                        isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {items.length}
                    </span>
                  </div>
                  <p className={`text-[11px] mt-0.5 ${mutedText}`}>{col.subtitle}</p>
                </div>
                <span className={`text-[10px] font-mono ${mutedText}`}>可拖曳至此</span>
              </div>

              {/* Tasks Stack */}
              <div className="space-y-3 flex-1">
                {items.length === 0 ? (
                  <div
                    className={`border border-dashed rounded-xl py-10 px-4 text-center text-xs ${
                      isDark ? 'border-slate-800 text-slate-500' : 'border-slate-300 text-slate-400'
                    }`}
                  >
                    拖曳任務卡片至此欄位，或點擊其他卡片狀態按鈕移轉
                  </div>
                ) : (
                  items.map((rec) => {
                    const overdue = isTodoOverdue(rec, now);
                    const dueToday = isTodoDueToday(rec, now);
                    const prevCol = colIndex > 0 ? COLUMNS[colIndex - 1].key : null;
                    const nextCol = colIndex < COLUMNS.length - 1 ? COLUMNS[colIndex + 1].key : null;

                    return (
                      <div
                        key={rec.ID}
                        draggable
                        onDragStart={(e) => {
                          setDraggingId(rec.ID);
                          e.dataTransfer.setData('text/plain', rec.ID);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverCol(null);
                        }}
                        className={`rounded-xl border p-3.5 space-y-2.5 transition-all cursor-grab active:cursor-grabbing ${
                          draggingId === rec.ID ? 'opacity-50 scale-[0.98]' : ''
                        } ${
                          overdue
                            ? isDark
                              ? 'bg-rose-950/30 border-rose-700/80 hover:border-rose-500'
                              : 'bg-rose-50/70 border-rose-300 hover:border-rose-400'
                            : isDark
                            ? 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                            : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Top metadata row */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <GripVertical className={`w-3.5 h-3.5 shrink-0 ${mutedText}`} />
                            <span className={`text-[11px] font-mono font-bold ${mutedText}`}>
                              {rec.ID}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${getPriorityBadgeClass(
                                rec['優先級'] || '中'
                              )}`}
                            >
                              {rec['優先級'] || '中'}
                            </span>
                            {overdue && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-600 text-white font-bold flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span>{formatOverdueDuration(rec, now) || '已逾期'}</span>
                              </span>
                            )}
                            {!overdue && dueToday && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-bold">
                                今日到期
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              title="編輯任務內容與到期時間"
                              onClick={() => (editingId === rec.ID ? setEditingId(null) : handleStartEdit(rec))}
                              className={`p-1 rounded hover:text-indigo-500 cursor-pointer ${mutedText}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="刪除此任務"
                              onClick={() => handleDeleteTask(rec.ID, rec['事項標題'] || rec.ID)}
                              className={`p-1 rounded hover:text-rose-500 cursor-pointer ${mutedText}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {editingId === rec.ID ? (
                          <form onSubmit={(e) => handleSaveEdit(e, rec.ID)} className="space-y-2 pt-1">
                            <input
                              type="text"
                              required
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className={inputCls}
                              placeholder="任務標題"
                            />
                            <div className="grid grid-cols-3 gap-1.5">
                              <input
                                type="date"
                                value={editDueDate}
                                onChange={(e) => setEditDueDate(e.target.value)}
                                className={inputCls}
                              />
                              <input
                                type="time"
                                value={editReminderTime}
                                onChange={(e) => setEditReminderTime(e.target.value)}
                                className={inputCls}
                              />
                              <select
                                value={editPriority}
                                onChange={(e) => setEditPriority(e.target.value as TodoPriority)}
                                className={inputCls}
                              >
                                <option value="緊急重要">緊急重要</option>
                                <option value="高">高</option>
                                <option value="中">中</option>
                                <option value="低">低</option>
                              </select>
                            </div>
                            <input
                              type="text"
                              value={editDetail}
                              onChange={(e) => setEditDetail(e.target.value)}
                              className={inputCls}
                              placeholder="詳細說明..."
                            />
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-0.5 cursor-pointer ${
                                  isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                <X className="w-3 h-3" />
                                <span>取消</span>
                              </button>
                              <button
                                type="submit"
                                className="px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-0.5 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                <span>儲存同步</span>
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            {/* Title & Project */}
                            <div>
                              <div className="text-sm font-bold leading-snug">
                                {rec['事項標題'] || '未命名任務'}
                              </div>
                              {rec['專案名稱'] && (
                                <div
                                  className={`text-[11px] mt-0.5 font-medium ${
                                    isDark ? 'text-indigo-300' : 'text-[#065fd4]'
                                  }`}
                                >
                                  專案：{rec['專案名稱']}
                                </div>
                              )}
                              {rec['詳細說明'] && (
                                <p className={`text-xs mt-1 line-clamp-2 ${mutedText}`}>
                                  {rec['詳細說明']}
                                </p>
                              )}
                            </div>

                            {/* Date + Reminder + Actions */}
                            <div
                              className={`pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-[11px] ${
                                isDark ? 'border-slate-800/80' : 'border-slate-200/80'
                              }`}
                            >
                              <div className={`flex items-center gap-2 font-mono ${mutedText}`}>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>{rec['截止日期'] || '未設定'}</span>
                                </span>
                                {rec['提醒時間'] && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    <span>{rec['提醒時間']}</span>
                                  </span>
                                )}
                              </div>

                              {/* Accessible Status Transition & Postpone Buttons */}
                              <div className="flex items-center gap-1 shrink-0">
                                {overdue && (
                                  <button
                                    type="button"
                                    onClick={() => handlePostponeTomorrow(rec)}
                                    className={`px-2 py-1 rounded-md border text-[10px] font-semibold cursor-pointer ${
                                      isDark
                                        ? 'bg-rose-950/70 hover:bg-rose-900 text-rose-200 border-rose-700'
                                        : 'bg-white hover:bg-rose-50 text-rose-700 border-rose-300'
                                    }`}
                                  >
                                    延後至明日
                                  </button>
                                )}
                                {prevCol && (
                                  <button
                                    type="button"
                                    onClick={() => handleMoveStatus(rec.ID, prevCol)}
                                    className={`px-2 py-1 rounded-md border text-[10px] font-semibold flex items-center gap-0.5 cursor-pointer ${
                                      isDark
                                        ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                                    }`}
                                  >
                                    <ArrowLeft className="w-3 h-3" />
                                    <span>{prevCol}</span>
                                  </button>
                                )}
                                {nextCol && (
                                  <button
                                    type="button"
                                    onClick={() => handleMoveStatus(rec.ID, nextCol)}
                                    className={`px-2 py-1 rounded-md text-[10px] font-semibold text-white flex items-center gap-0.5 cursor-pointer ${
                                      nextCol === '已完成'
                                        ? 'bg-emerald-600 hover:bg-emerald-500'
                                        : isDark
                                        ? 'bg-indigo-600 hover:bg-indigo-500'
                                        : 'bg-[#065fd4] hover:bg-blue-700'
                                    }`}
                                  >
                                    <span>{nextCol}</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
