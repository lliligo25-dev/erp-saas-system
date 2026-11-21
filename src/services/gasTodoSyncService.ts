/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DynamicRecord,
  getCurrentDateTimeStr,
  getMemberUnlockedPacks,
  getOffsetDateStr,
  loadMemberDynamicRecords,
  saveMemberDynamicRecords,
  saveMemberUnlockedPacks,
} from './memberFiveStarConfig';

export type TodoKanbanStatus = '待處理' | '處理中' | '已完成';

export type TodoPriority = '緊急重要' | '高' | '中' | '低';

export interface GasSyncLogEntry {
  id: string;
  action: 'upsertTodo' | 'deleteTodo' | 'syncTodos' | 'getTodos';
  targetId?: string;
  mode: 'LIVE_GAS_FETCH' | 'SIMULATOR_LEDGER';
  status: 'SYNCED' | 'FALLBACK_QUEUED';
  summary: string;
  timestamp: string;
}

export interface GasTodoSyncState {
  gasWebAppUrl: string;
  lastSyncedAt: string | null;
  lastSyncStatus: 'IDLE' | 'SYNCING' | 'SYNCED' | 'OFFLINE_QUEUED';
  lastSyncMode: 'LIVE_GAS_FETCH' | 'SIMULATOR_LEDGER';
  pendingOpsCount: number;
  lastMessage: string;
  logs: GasSyncLogEntry[];
}

const GAS_URL_KEY = 'AIS_GAS_WEBAPP_URL';
const GAS_SYNC_PREFIX = 'AIS_GAS_TODO_SYNC_';
export const TODOS_UPDATED_EVENT = 'ais-todos-updated';

export function notifyTodosUpdated(memberMid?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TODOS_UPDATED_EVENT, { detail: { memberMid } }));
  }
}

export function normalizeTodoStatus(rawStatus?: string): TodoKanbanStatus {
  if (!rawStatus) return '待處理';
  if (rawStatus === '已完成') return '已完成';
  if (rawStatus === '處理中' || rawStatus === '進行中') return '處理中';
  return '待處理';
}

export function isTodoCompleted(rec: DynamicRecord): boolean {
  return rec['狀態'] === '已完成';
}

export function normalizeTodoDate(rawDate?: string): string {
  const s = (rawDate || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const slashMatch = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[3].padStart(2, '0')}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }
  return '';
}

export function normalizeTodoTime(rawTime?: string): string {
  const s = (rawTime || '').trim();
  if (!s) return '';
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  const hhmm = s.match(/(\d{1,2}):(\d{2})/);
  if (hhmm) {
    return `${hhmm[1].padStart(2, '0')}:${hhmm[2]}`;
  }
  return '';
}

export function getTodoDeadlineDateTime(rec: DynamicRecord): Date | null {
  const dateStr = normalizeTodoDate(rec['截止日期']);
  if (!dateStr) return null;
  const timeStr = normalizeTodoTime(rec['提醒時間']);
  const hhmm = timeStr || '23:59';
  const dt = new Date(`${dateStr}T${hhmm}:00`);
  if (isNaN(dt.getTime())) return null;
  return dt;
}

export function isTodoOverdue(rec: DynamicRecord, now: Date = new Date()): boolean {
  if (isTodoCompleted(rec)) return false;
  const deadline = getTodoDeadlineDateTime(rec);
  if (!deadline) return false;
  return deadline.getTime() < now.getTime();
}

export function isTodoDueToday(rec: DynamicRecord, now: Date = new Date()): boolean {
  if (isTodoCompleted(rec)) return false;
  const dateStr = normalizeTodoDate(rec['截止日期']);
  if (!dateStr) return false;
  const todayStr = getOffsetDateStr(0);
  if (dateStr !== todayStr) return false;
  return !isTodoOverdue(rec, now);
}

export function formatOverdueDuration(rec: DynamicRecord, now: Date = new Date()): string {
  const deadline = getTodoDeadlineDateTime(rec);
  if (!deadline) return '';
  const diffMs = now.getTime() - deadline.getTime();
  if (diffMs <= 0) return '';
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `已逾期 ${diffMins} 分鐘`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `已逾期 ${diffHours} 小時`;
  const diffDays = Math.floor(diffHours / 24);
  return `已逾期 ${diffDays} 天`;
}

export function ensureTodoPackUnlocked(memberMid: string) {
  const packs = getMemberUnlockedPacks(memberMid);
  if (!packs.includes('TODO')) {
    saveMemberUnlockedPacks(memberMid, [...packs, 'TODO']);
  }
}

export function getMemberTodos(memberMid: string): DynamicRecord[] {
  const raw = loadMemberDynamicRecords(memberMid, 'TODO_T');
  return raw.map((rec) => {
    if (rec['狀態'] === '進行中') {
      return { ...rec, 狀態: '處理中' };
    }
    return rec;
  });
}

export function getOverdueCount(memberMid: string): number {
  const now = new Date();
  return getMemberTodos(memberMid).filter((r) => isTodoOverdue(r, now)).length;
}

export function getDueTodayCount(memberMid: string): number {
  const now = new Date();
  return getMemberTodos(memberMid).filter((r) => isTodoDueToday(r, now)).length;
}

export const DEFAULT_GAS_WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbxMB3G4rw8h1SqJnlyoCgE7xuGn6Fpc2QSJa1m3xVzyVXosb10fXrWoHkf87_V0nxJb/exec';

export function getGasWebAppUrl(): string {
  try {
    const stored = localStorage.getItem(GAS_URL_KEY);
    return stored !== null ? stored : DEFAULT_GAS_WEB_APP_URL;
  } catch {
    return DEFAULT_GAS_WEB_APP_URL;
  }
}

export function setGasWebAppUrl(url: string) {
  const trimmed = url.trim();
  try {
    localStorage.setItem(GAS_URL_KEY, trimmed);
  } catch {
    // ignore
  }
}

export function getGasTodoSyncState(memberMid: string): GasTodoSyncState {
  const gasWebAppUrl = getGasWebAppUrl();
  try {
    const raw = localStorage.getItem(`${GAS_SYNC_PREFIX}${memberMid}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GasTodoSyncState>;
      return {
        gasWebAppUrl,
        lastSyncedAt: parsed.lastSyncedAt || null,
        lastSyncStatus: parsed.lastSyncStatus || 'IDLE',
        lastSyncMode: parsed.lastSyncMode || (gasWebAppUrl ? 'LIVE_GAS_FETCH' : 'SIMULATOR_LEDGER'),
        pendingOpsCount: parsed.pendingOpsCount || 0,
        lastMessage: parsed.lastMessage || '尚未執行 GAS 同步',
        logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      };
    }
  } catch {
    // ignore
  }
  return {
    gasWebAppUrl,
    lastSyncedAt: null,
    lastSyncStatus: 'IDLE',
    lastSyncMode: gasWebAppUrl ? 'LIVE_GAS_FETCH' : 'SIMULATOR_LEDGER',
    pendingOpsCount: 0,
    lastMessage: gasWebAppUrl
      ? '已設定 GAS Web App URL，待同步變更'
      : '使用內建 GAS Code.gs 離線帳本同步模式（可填入實機部署 /exec URL）',
    logs: [],
  };
}

function saveGasTodoSyncState(memberMid: string, state: GasTodoSyncState) {
  try {
    localStorage.setItem(`${GAS_SYNC_PREFIX}${memberMid}`, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export async function syncMemberTodosToGas(
  memberMid: string,
  action: 'upsertTodo' | 'deleteTodo' | 'syncTodos' = 'syncTodos',
  payload?: { todo?: DynamicRecord; todoId?: string }
): Promise<GasTodoSyncState> {
  const gasUrl = getGasWebAppUrl();
  const prevState = getGasTodoSyncState(memberMid);
  const allTodos = getMemberTodos(memberMid);
  const nowIso = new Date().toISOString();

  // 若先前有離線佇列待同步項目，於連線時自動改以全量 syncTodos 確保 GAS 狀態一致
  const effectiveAction =
    gasUrl && prevState.pendingOpsCount > 0 ? 'syncTodos' : action;

  const requestPayload =
    effectiveAction === 'upsertTodo'
      ? { action: 'upsertTodo', memberMid, data: payload?.todo }
      : effectiveAction === 'deleteTodo'
      ? { action: 'deleteTodo', memberMid, todoId: payload?.todoId }
      : { action: 'syncTodos', memberMid, todos: allTodos };

  let mode: 'LIVE_GAS_FETCH' | 'SIMULATOR_LEDGER' = gasUrl ? 'LIVE_GAS_FETCH' : 'SIMULATOR_LEDGER';
  let status: 'SYNCED' | 'OFFLINE_QUEUED' = 'SYNCED';
  let summary = '';

  if (gasUrl) {
    try {
      const resp = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(requestPayload),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const json = await resp.json().catch(() => null);
      if (json && json.success === false) {
        throw new Error(json.error || 'GAS 回傳失敗');
      }
      summary =
        effectiveAction === 'syncTodos'
          ? `實機 GAS 同步成功（共 ${allTodos.length} 筆寫入 TODO_T）`
          : effectiveAction === 'upsertTodo'
          ? `實機 GAS 已寫入 ${payload?.todo?.ID || '待辦任務'}`
          : `實機 GAS 已移除 ${payload?.todoId || '待辦任務'}`;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '網路/CORS 連線異常';
      status = 'OFFLINE_QUEUED';
      summary = `GAS 實機連線受限（${msg}），已暫存至待同步佇列並保留本地紀錄`;
    }
  } else {
    mode = 'SIMULATOR_LEDGER';
    status = 'SYNCED';
    summary =
      effectiveAction === 'syncTodos'
        ? `GAS Code.gs 全量同步完成（TODO_T 共 ${allTodos.length} 筆）`
        : effectiveAction === 'upsertTodo'
        ? `GAS Code.gs upsertTodo 已寫入 ${payload?.todo?.ID || '待辦任務'}`
        : `GAS Code.gs deleteTodo 已刪除 ${payload?.todoId || '待辦任務'}`;
  }

  const logEntry: GasSyncLogEntry = {
    id: `SYNC-${Date.now().toString().slice(-6)}`,
    action: effectiveAction,
    targetId: payload?.todo?.ID || payload?.todoId,
    mode,
    status: status === 'SYNCED' ? 'SYNCED' : 'FALLBACK_QUEUED',
    summary,
    timestamp: nowIso,
  };

  const nextState: GasTodoSyncState = {
    gasWebAppUrl: gasUrl,
    lastSyncedAt: status === 'SYNCED' ? nowIso : prevState.lastSyncedAt,
    lastSyncStatus: status,
    lastSyncMode: mode,
    pendingOpsCount: status === 'SYNCED' ? 0 : prevState.pendingOpsCount + 1,
    lastMessage: summary,
    logs: [logEntry, ...prevState.logs].slice(0, 12),
  };

  saveGasTodoSyncState(memberMid, nextState);
  return nextState;
}

export async function pullMemberTodosFromGas(
  memberMid: string
): Promise<{ todos: DynamicRecord[]; syncState: GasTodoSyncState }> {
  const gasUrl = getGasWebAppUrl();
  const prevState = getGasTodoSyncState(memberMid);
  const currentLocal = getMemberTodos(memberMid);
  const nowIso = new Date().toISOString();

  if (!gasUrl) {
    const logEntry: GasSyncLogEntry = {
      id: `PULL-${Date.now().toString().slice(-6)}`,
      action: 'getTodos',
      mode: 'SIMULATOR_LEDGER',
      status: 'SYNCED',
      summary: `已從本地 GAS 模擬帳本載入 ${currentLocal.length} 筆待辦任務`,
      timestamp: nowIso,
    };
    const nextState: GasTodoSyncState = {
      ...prevState,
      lastSyncedAt: nowIso,
      lastSyncStatus: 'SYNCED',
      lastSyncMode: 'SIMULATOR_LEDGER',
      lastMessage: logEntry.summary,
      logs: [logEntry, ...prevState.logs].slice(0, 12),
    };
    saveGasTodoSyncState(memberMid, nextState);
    return { todos: currentLocal, syncState: nextState };
  }

  try {
    const resp = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'getTodos', memberMid }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (!json || json.success === false || !Array.isArray(json.todos)) {
      throw new Error(json?.error || 'GAS 未回傳有效待辦陣列');
    }

    const normalized = (json.todos as DynamicRecord[]).map((t) => ({
      ...t,
      狀態: normalizeTodoStatus(t['狀態']),
      截止日期: normalizeTodoDate(t['截止日期']),
      提醒時間: normalizeTodoTime(t['提醒時間']),
    }));
    saveMemberDynamicRecords(memberMid, 'TODO_T', normalized);

    const logEntry: GasSyncLogEntry = {
      id: `PULL-${Date.now().toString().slice(-6)}`,
      action: 'getTodos',
      mode: 'LIVE_GAS_FETCH',
      status: 'SYNCED',
      summary: `已從實機 GAS 拉取並更新 ${normalized.length} 筆待辦任務`,
      timestamp: nowIso,
    };
    const nextState: GasTodoSyncState = {
      gasWebAppUrl: gasUrl,
      lastSyncedAt: nowIso,
      lastSyncStatus: 'SYNCED',
      lastSyncMode: 'LIVE_GAS_FETCH',
      pendingOpsCount: 0,
      lastMessage: logEntry.summary,
      logs: [logEntry, ...prevState.logs].slice(0, 12),
    };
    saveGasTodoSyncState(memberMid, nextState);
    notifyTodosUpdated(memberMid);
    return { todos: normalized, syncState: nextState };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '拉取失敗';
    const logEntry: GasSyncLogEntry = {
      id: `PULL-${Date.now().toString().slice(-6)}`,
      action: 'getTodos',
      mode: 'LIVE_GAS_FETCH',
      status: 'FALLBACK_QUEUED',
      summary: `無法從 GAS 拉取（${msg}），保留本地 ${currentLocal.length} 筆任務`,
      timestamp: nowIso,
    };
    const nextState: GasTodoSyncState = {
      ...prevState,
      lastSyncStatus: 'OFFLINE_QUEUED',
      lastMessage: logEntry.summary,
      logs: [logEntry, ...prevState.logs].slice(0, 12),
    };
    saveGasTodoSyncState(memberMid, nextState);
    return { todos: currentLocal, syncState: nextState };
  }
}

export async function createMemberTodo(
  memberMid: string,
  input: {
    title: string;
    dueDate: string;
    reminderTime?: string;
    priority?: TodoPriority;
    projectName?: string;
    assignee?: string;
    detail?: string;
    status?: TodoKanbanStatus;
  }
): Promise<{ todos: DynamicRecord[]; created: DynamicRecord; syncState: GasTodoSyncState }> {
  ensureTodoPackUnlocked(memberMid);
  const existing = getMemberTodos(memberMid);
  const nextSeq =
    existing.reduce((max, r) => {
      const m = (r.ID || '').match(/(\d+)$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0) + 1;
  const newId = `TDT-${String(nextSeq).padStart(3, '0')}`;
  const status = input.status || '待處理';
  const nowStr = new Date().toLocaleDateString();

  const created: DynamicRecord = {
    ID: newId,
    狀態: status,
    事項標題: input.title.trim(),
    專案名稱: (input.projectName || '個人代辦任務').trim(),
    優先級: input.priority || '中',
    截止日期: input.dueDate || getOffsetDateStr(0),
    提醒時間: input.reminderTime || '18:00',
    承辦人: (input.assignee || memberMid).trim(),
    結束時間: status === '已完成' ? getCurrentDateTimeStr() : '',
    詳細說明: (input.detail || '').trim(),
    更新時間: nowStr,
  };

  const nextList = [created, ...existing];
  saveMemberDynamicRecords(memberMid, 'TODO_T', nextList);
  const syncState = await syncMemberTodosToGas(memberMid, 'upsertTodo', { todo: created });
  notifyTodosUpdated(memberMid);
  return { todos: nextList, created, syncState };
}

export async function updateMemberTodoStatus(
  memberMid: string,
  todoId: string,
  nextStatus: TodoKanbanStatus
): Promise<{ todos: DynamicRecord[]; updated?: DynamicRecord; syncState: GasTodoSyncState }> {
  const existing = getMemberTodos(memberMid);
  const nowDate = new Date().toLocaleDateString();
  let updatedRec: DynamicRecord | undefined;

  const nextList = existing.map((rec) => {
    if (rec.ID !== todoId) return rec;
    updatedRec = {
      ...rec,
      狀態: nextStatus,
      結束時間: nextStatus === '已完成' ? rec['結束時間'] || getCurrentDateTimeStr() : '',
      更新時間: nowDate,
    };
    return updatedRec;
  });

  saveMemberDynamicRecords(memberMid, 'TODO_T', nextList);
  const syncState = await syncMemberTodosToGas(memberMid, 'upsertTodo', { todo: updatedRec });
  notifyTodosUpdated(memberMid);
  return { todos: nextList, updated: updatedRec, syncState };
}

export async function updateMemberTodo(
  memberMid: string,
  todoId: string,
  patch: {
    title?: string;
    dueDate?: string;
    reminderTime?: string;
    priority?: TodoPriority;
    projectName?: string;
    detail?: string;
    status?: TodoKanbanStatus;
  }
): Promise<{ todos: DynamicRecord[]; updated?: DynamicRecord; syncState: GasTodoSyncState }> {
  const existing = getMemberTodos(memberMid);
  const nowDate = new Date().toLocaleDateString();
  let updatedRec: DynamicRecord | undefined;

  const nextList = existing.map((rec) => {
    if (rec.ID !== todoId) return rec;
    const nextStatus = patch.status ? normalizeTodoStatus(patch.status) : normalizeTodoStatus(rec['狀態']);
    updatedRec = {
      ...rec,
      狀態: nextStatus,
      事項標題: patch.title !== undefined ? patch.title.trim() : rec['事項標題'],
      截止日期: patch.dueDate !== undefined ? patch.dueDate : rec['截止日期'],
      提醒時間: patch.reminderTime !== undefined ? patch.reminderTime : rec['提醒時間'],
      優先級: patch.priority !== undefined ? patch.priority : rec['優先級'],
      專案名稱: patch.projectName !== undefined ? patch.projectName.trim() : rec['專案名稱'],
      詳細說明: patch.detail !== undefined ? patch.detail.trim() : rec['詳細說明'],
      結束時間: nextStatus === '已完成' ? rec['結束時間'] || getCurrentDateTimeStr() : '',
      更新時間: nowDate,
    };
    return updatedRec;
  });

  saveMemberDynamicRecords(memberMid, 'TODO_T', nextList);
  const syncState = await syncMemberTodosToGas(memberMid, 'upsertTodo', { todo: updatedRec });
  notifyTodosUpdated(memberMid);
  return { todos: nextList, updated: updatedRec, syncState };
}

export async function deleteMemberTodo(
  memberMid: string,
  todoId: string
): Promise<{ todos: DynamicRecord[]; syncState: GasTodoSyncState }> {
  const existing = getMemberTodos(memberMid);
  const nextList = existing.filter((rec) => rec.ID !== todoId);
  saveMemberDynamicRecords(memberMid, 'TODO_T', nextList);
  const syncState = await syncMemberTodosToGas(memberMid, 'deleteTodo', { todoId });
  notifyTodosUpdated(memberMid);
  return { todos: nextList, syncState };
}
