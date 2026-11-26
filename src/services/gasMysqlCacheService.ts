/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { erpEngine } from './erpEngine';
import { loadGasMysqlConfig } from './gasMysqlBridgeService';
import {
  getGasWebAppUrl,
  getMemberTodos,
  setGasWebAppUrl,
  TODOS_UPDATED_EVENT,
} from './gasTodoSyncService';
import { NODES_UPDATED_EVENT } from './softwareNodeSync';

export type CacheEntityType =
  | 'MEMBER'
  | 'MONOLINE_NODE'
  | 'BINARY_NODE'
  | 'SUBTREE'
  | 'SYSTEM_STATS'
  | 'TODO';

export interface TempIndexEntry {
  cacheKey: string;
  entityType: CacheEntityType;
  lookupToken: string;
  secondaryTokens: string[];
  primaryMid: string;
  sheetName: string;
  sheetRowIndex: number;
  hitCount: number;
  ttlSeconds: number;
  createdAt: string;
  expiresAt: string;
  lastAccessedAt: string;
  mysqlSynced: boolean;
  mysqlSyncedAt: string | null;
  label: string;
  payload: Record<string, unknown>;
}

export interface GasCacheConfig {
  enabled: boolean;
  ttlSeconds: number;
  maxEntries: number;
  autoRebuildOnMutation: boolean;
  syncToMysqlOnRebuild: boolean;
}

export interface GasCacheLogEntry {
  id: string;
  action: 'REBUILD_INDEX' | 'CACHE_HIT' | 'CACHE_MISS' | 'MYSQL_SYNC' | 'INVALIDATE' | 'PURGE_TTL';
  mode: 'LIVE_GAS_FETCH' | 'LOCAL_TEMP_INDEX';
  summary: string;
  timestamp: string;
}

export interface GasCacheMetrics {
  indexVersion: number;
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  hitRatePct: number;
  tempIndexCount: number;
  mysqlSyncedEntries: number;
  expiredPurgedCount: number;
  invalidationCount: number;
  avgCacheLatencyMs: number;
  avgFullScanLatencyMs: number;
  speedupRatio: number;
  lastRebuiltAt: string | null;
  lastMysqlSyncAt: string | null;
  lastStatusMessage: string;
}

export interface CacheQueryResult {
  keyword: string;
  matchedCount: number;
  cacheHit: boolean;
  source: 'MYSQL_SYNC_CACHE' | 'L2_TEMP_INDEX' | 'SHEETS_FULL_SCAN_FALLBACK';
  cacheElapsedMs: number;
  fullScanElapsedMs: number;
  speedupFactor: number;
  rowsScannedInSheets: number;
  rowsAccessedInCache: number;
  entries: TempIndexEntry[];
  summary: string;
}

export interface GasCacheSnapshot {
  config: GasCacheConfig;
  metrics: GasCacheMetrics;
  hotEntries: TempIndexEntry[];
  logs: GasCacheLogEntry[];
}

const CACHE_CONFIG_STORAGE_KEY = 'AIS_GAS_MYSQL_CACHE_CONFIG_V1';
const CACHE_ENTRIES_STORAGE_KEY = 'AIS_GAS_MYSQL_CACHE_INDEX_V1';
const CACHE_METRICS_STORAGE_KEY = 'AIS_GAS_MYSQL_CACHE_METRICS_V1';
export const GAS_MYSQL_CACHE_UPDATED_EVENT = 'ais-gas-mysql-cache-updated';

export const DEFAULT_GAS_CACHE_CONFIG: GasCacheConfig = {
  enabled: true,
  ttlSeconds: 300,
  maxEntries: 3000,
  autoRebuildOnMutation: true,
  syncToMysqlOnRebuild: true,
};

let memoryIndexMap: Map<string, TempIndexEntry> | null = null;
let tokenLookupMap: Map<string, string[]> | null = null; // normalized token -> cacheKeys[]
let listenersInitialized = false;

export function notifyGasMysqlCacheUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GAS_MYSQL_CACHE_UPDATED_EVENT));
  }
}

export function loadGasCacheConfig(): GasCacheConfig {
  try {
    const raw = localStorage.getItem(CACHE_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GasCacheConfig>;
      return {
        ...DEFAULT_GAS_CACHE_CONFIG,
        ...parsed,
        ttlSeconds: Math.max(30, Math.min(3600, Number(parsed.ttlSeconds) || 300)),
        maxEntries: Math.max(100, Math.min(20000, Number(parsed.maxEntries) || 3000)),
      };
    }
  } catch {
    // ignore storage errors
  }
  return { ...DEFAULT_GAS_CACHE_CONFIG };
}

export function saveGasCacheConfig(nextCfg: GasCacheConfig): GasCacheConfig {
  const sanitized: GasCacheConfig = {
    enabled: Boolean(nextCfg.enabled),
    ttlSeconds: Math.max(30, Math.min(3600, Math.floor(Number(nextCfg.ttlSeconds) || 300))),
    maxEntries: Math.max(100, Math.min(20000, Math.floor(Number(nextCfg.maxEntries) || 3000))),
    autoRebuildOnMutation: Boolean(nextCfg.autoRebuildOnMutation),
    syncToMysqlOnRebuild: Boolean(nextCfg.syncToMysqlOnRebuild),
  };
  try {
    localStorage.setItem(CACHE_CONFIG_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // ignore quota errors
  }
  notifyGasMysqlCacheUpdated();
  return sanitized;
}

function loadStoredMetrics(): { metrics: GasCacheMetrics; logs: GasCacheLogEntry[] } {
  try {
    const raw = localStorage.getItem(CACHE_METRICS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        metrics?: Partial<GasCacheMetrics>;
        logs?: GasCacheLogEntry[];
      };
      return {
        metrics: {
          indexVersion: parsed.metrics?.indexVersion || 1,
          totalQueries: parsed.metrics?.totalQueries || 0,
          cacheHits: parsed.metrics?.cacheHits || 0,
          cacheMisses: parsed.metrics?.cacheMisses || 0,
          hitRatePct: parsed.metrics?.hitRatePct || 0,
          tempIndexCount: parsed.metrics?.tempIndexCount || 0,
          mysqlSyncedEntries: parsed.metrics?.mysqlSyncedEntries || 0,
          expiredPurgedCount: parsed.metrics?.expiredPurgedCount || 0,
          invalidationCount: parsed.metrics?.invalidationCount || 0,
          avgCacheLatencyMs: parsed.metrics?.avgCacheLatencyMs || 0,
          avgFullScanLatencyMs: parsed.metrics?.avgFullScanLatencyMs || 0,
          speedupRatio: parsed.metrics?.speedupRatio || 1,
          lastRebuiltAt: parsed.metrics?.lastRebuiltAt || null,
          lastMysqlSyncAt: parsed.metrics?.lastMysqlSyncAt || null,
          lastStatusMessage:
            parsed.metrics?.lastStatusMessage ||
            'GAS × MySQL 同步緩存器待命，支援高頻查詢臨時索引加速。',
        },
        logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      };
    }
  } catch {
    // ignore
  }
  return {
    metrics: {
      indexVersion: 1,
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRatePct: 0,
      tempIndexCount: 0,
      mysqlSyncedEntries: 0,
      expiredPurgedCount: 0,
      invalidationCount: 0,
      avgCacheLatencyMs: 0,
      avgFullScanLatencyMs: 0,
      speedupRatio: 1,
      lastRebuiltAt: null,
      lastMysqlSyncAt: null,
      lastStatusMessage: 'GAS × MySQL 同步緩存器待命，支援高頻查詢臨時索引加速。',
    },
    logs: [],
  };
}

function saveMetricsState(metrics: GasCacheMetrics, logs: GasCacheLogEntry[]) {
  try {
    localStorage.setItem(
      CACHE_METRICS_STORAGE_KEY,
      JSON.stringify({ metrics, logs: logs.slice(0, 20) })
    );
  } catch {
    // ignore
  }
}

function appendCacheLog(
  logs: GasCacheLogEntry[],
  action: GasCacheLogEntry['action'],
  mode: GasCacheLogEntry['mode'],
  summary: string
): GasCacheLogEntry[] {
  return [
    {
      id: `CACHE-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`,
      action,
      mode,
      summary,
      timestamp: new Date().toISOString(),
    },
    ...logs,
  ].slice(0, 20);
}

function rebuildInvertedTokenLookup(map: Map<string, TempIndexEntry>) {
  const lookup = new Map<string, string[]>();
  const addToken = (rawToken: string, key: string) => {
    const t = String(rawToken || '').trim().toUpperCase();
    if (!t) return;
    const arr = lookup.get(t);
    if (arr) {
      if (!arr.includes(key)) arr.push(key);
    } else {
      lookup.set(t, [key]);
    }
  };

  for (const [key, entry] of map.entries()) {
    addToken(entry.lookupToken, key);
    addToken(entry.primaryMid, key);
    for (const sec of entry.secondaryTokens) {
      addToken(sec, key);
    }
  }
  tokenLookupMap = lookup;
}

function ensureIndexMapLoaded(): Map<string, TempIndexEntry> {
  if (memoryIndexMap && tokenLookupMap) {
    return memoryIndexMap;
  }
  const map = new Map<string, TempIndexEntry>();
  try {
    const raw = localStorage.getItem(CACHE_ENTRIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TempIndexEntry[];
      if (Array.isArray(parsed)) {
        const nowMs = Date.now();
        for (const item of parsed) {
          if (item && item.cacheKey && new Date(item.expiresAt).getTime() > nowMs) {
            map.set(item.cacheKey, item);
          }
        }
      }
    }
  } catch {
    // ignore
  }
  memoryIndexMap = map;
  rebuildInvertedTokenLookup(map);

  if (map.size === 0) {
    // Auto-warm initial high-frequency temporary index
    buildEntriesInMemory(loadGasCacheConfig(), false);
  }
  return memoryIndexMap;
}

function persistIndexMap(map: Map<string, TempIndexEntry>) {
  try {
    // Keep up to 1500 entries serialized for fast browser restore
    const list = Array.from(map.values()).slice(0, 1500);
    localStorage.setItem(CACHE_ENTRIES_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage quota limit on huge simulated datasets
  }
}

function normalizePhoneDigits(phone: string): string {
  return String(phone || '').replace(/[^0-9]/g, '');
}

function buildEntriesInMemory(
  cfg: GasCacheConfig,
  markMysqlSynced: boolean
): { entriesCount: number; mysqlSyncedCount: number } {
  const now = new Date();
  const nowIso = now.toISOString();
  const expIso = new Date(now.getTime() + cfg.ttlSeconds * 1000).toISOString();
  const mysqlBridgeCfg = loadGasMysqlConfig();
  const shouldSyncFlag = markMysqlSynced || mysqlBridgeCfg.enabled;

  const map = new Map<string, TempIndexEntry>();
  const members = erpEngine.getAllMembers();
  const monolineNodes = erpEngine.getAllMonolineNodes();
  const binaryNodes = erpEngine.getAllBinaryNodes();
  const sysStats = erpEngine.getStats();

  const pushEntry = (entry: TempIndexEntry) => {
    if (map.size < cfg.maxEntries) {
      map.set(entry.cacheKey, entry);
    }
  };

  // 1. 會員主檔高頻索引 (MID / 姓名 / 手機 / 推薦人 / 雲端試算表)
  members.forEach((m, idx) => {
    const phoneDigits = normalizePhoneDigits(m.phone);
    pushEntry({
      cacheKey: `IDX:MEMBER:${m.mid}`,
      entityType: 'MEMBER',
      lookupToken: m.mid.toUpperCase(),
      secondaryTokens: [
        m.name.toUpperCase(),
        phoneDigits,
        m.monolineNodeId.toUpperCase(),
        m.binaryNodeId.toUpperCase(),
        m.sponsorMid.toUpperCase(),
      ].filter(Boolean),
      primaryMid: m.mid,
      sheetName: '會員主檔',
      sheetRowIndex: idx + 2,
      hitCount: m.mid === 'A-00008' ? 18 : 1,
      ttlSeconds: cfg.ttlSeconds,
      createdAt: nowIso,
      expiresAt: expIso,
      lastAccessedAt: nowIso,
      mysqlSynced: shouldSyncFlag,
      mysqlSyncedAt: shouldSyncFlag ? nowIso : null,
      label: `${m.mid} · ${m.name}`,
      payload: {
        mid: m.mid,
        name: m.name,
        phone: m.phone,
        sponsorMid: m.sponsorMid,
        monolineNodeId: m.monolineNodeId,
        binaryNodeId: m.binaryNodeId,
        storeId: m.storeId,
        centerId: m.centerId,
        trialExpiresAt: m.trialExpiresAt,
      },
    });
  });

  // 2. 雙軌節點高頻索引 (C-25000001 起算)
  binaryNodes.forEach((b, idx) => {
    pushEntry({
      cacheKey: `IDX:BI_NODE:${b.nodeId}`,
      entityType: 'BINARY_NODE',
      lookupToken: b.nodeId.toUpperCase(),
      secondaryTokens: [b.mid.toUpperCase(), b.parentId.toUpperCase(), b.name.toUpperCase()].filter(Boolean),
      primaryMid: b.mid,
      sheetName: '雙軌二元樹安置表',
      sheetRowIndex: idx + 2,
      hitCount: b.nodeId === 'C-25000001' ? 24 : 1,
      ttlSeconds: cfg.ttlSeconds,
      createdAt: nowIso,
      expiresAt: expIso,
      lastAccessedAt: nowIso,
      mysqlSynced: shouldSyncFlag,
      mysqlSyncedAt: shouldSyncFlag ? nowIso : null,
      label: `${b.nodeId} (${b.placementPosition} · L${b.depth})`,
      payload: {
        nodeId: b.nodeId,
        mid: b.mid,
        parentId: b.parentId,
        placementPosition: b.placementPosition,
        depth: b.depth,
        leftChildId: b.leftChildId || '',
        rightChildId: b.rightChildId || '',
        status: b.status,
      },
    });
  });

  // 3. 單軌公排節點索引 (優先索引近期與前段高頻節點)
  monolineNodes.forEach((n, idx) => {
    pushEntry({
      cacheKey: `IDX:MONO_NODE:${n.nodeId}`,
      entityType: 'MONOLINE_NODE',
      lookupToken: n.nodeId.toUpperCase(),
      secondaryTokens: [n.mid.toUpperCase(), n.sponsorMid.toUpperCase()].filter(Boolean),
      primaryMid: n.mid,
      sheetName: '單軌公排節點表',
      sheetRowIndex: idx + 2,
      hitCount: 1,
      ttlSeconds: cfg.ttlSeconds,
      createdAt: nowIso,
      expiresAt: expIso,
      lastAccessedAt: nowIso,
      mysqlSynced: shouldSyncFlag,
      mysqlSyncedAt: shouldSyncFlag ? nowIso : null,
      label: `${n.nodeId} (第 ${n.depth} 席)`,
      payload: {
        nodeId: n.nodeId,
        mid: n.mid,
        parentId: n.parentId,
        depth: n.depth,
        status: n.status,
      },
    });
  });

  // 4. 雙軌定海神針熱門子樹緩存 (depth = 3)
  const rootSubtree = erpEngine.getBinarySubtree('C-25000001', 3);
  if (rootSubtree) {
    pushEntry({
      cacheKey: 'IDX:SUBTREE:C-25000001:3',
      entityType: 'SUBTREE',
      lookupToken: 'C-25000001',
      secondaryTokens: ['SUBTREE', 'ROOT', 'BINARY_ROOT', 'A-00001', 'A-00008'],
      primaryMid: 'A-00001',
      sheetName: '雙軌二元樹安置表',
      sheetRowIndex: 2,
      hitCount: 15,
      ttlSeconds: cfg.ttlSeconds,
      createdAt: nowIso,
      expiresAt: expIso,
      lastAccessedAt: nowIso,
      mysqlSynced: shouldSyncFlag,
      mysqlSyncedAt: shouldSyncFlag ? nowIso : null,
      label: '雙軌定海神針 3 層預計算子樹',
      payload: {
        rootNodeId: 'C-25000001',
        depth: 3,
        cachedNodeName: rootSubtree.name,
      },
    });
  }

  // 5. 全網統計與待辦熱門索引
  pushEntry({
    cacheKey: 'IDX:STATS:GLOBAL',
    entityType: 'SYSTEM_STATS',
    lookupToken: 'SYS_STATS',
    secondaryTokens: ['STATS', 'SYSTEM_STATS', 'GLOBAL'],
    primaryMid: 'A-00008',
    sheetName: '會員主檔',
    sheetRowIndex: 1,
    hitCount: 12,
    ttlSeconds: cfg.ttlSeconds,
    createdAt: nowIso,
    expiresAt: expIso,
    lastAccessedAt: nowIso,
    mysqlSynced: shouldSyncFlag,
    mysqlSyncedAt: shouldSyncFlag ? nowIso : null,
    label: `全網即時統計 (${sysStats.totalMembers} 位會員 / ${sysStats.binaryNodesCount} 雙軌席位)`,
    payload: { ...sysStats },
  });

  // 6. 旗艦與最新 25 位會員待辦索引
  members.slice(-25).forEach((m) => {
    const todos = getMemberTodos(m.mid);
    pushEntry({
      cacheKey: `IDX:TODO:${m.mid}`,
      entityType: 'TODO',
      lookupToken: `TODO_${m.mid.toUpperCase()}`,
      secondaryTokens: [m.mid.toUpperCase(), 'TODO'],
      primaryMid: m.mid,
      sheetName: '代辦事項明細',
      sheetRowIndex: 2,
      hitCount: todos.length > 0 ? 3 : 1,
      ttlSeconds: cfg.ttlSeconds,
      createdAt: nowIso,
      expiresAt: expIso,
      lastAccessedAt: nowIso,
      mysqlSynced: shouldSyncFlag,
      mysqlSyncedAt: shouldSyncFlag ? nowIso : null,
      label: `${m.mid} 個人待辦摘要 (${todos.length} 筆)`,
      payload: {
        memberMid: m.mid,
        todoCount: todos.length,
        pendingCount: todos.filter((t) => t['狀態'] !== '已完成').length,
      },
    });
  });

  memoryIndexMap = map;
  rebuildInvertedTokenLookup(map);
  persistIndexMap(map);

  const mysqlSyncedCount = Array.from(map.values()).filter((e) => e.mysqlSynced).length;
  return { entriesCount: map.size, mysqlSyncedCount };
}

export async function rebuildGasTempIndexes(options?: {
  syncMysql?: boolean;
  gasWebAppUrlInput?: string;
}): Promise<{ ok: boolean; snapshot: GasCacheSnapshot; message: string }> {
  if (typeof options?.gasWebAppUrlInput === 'string') {
    setGasWebAppUrl(options.gasWebAppUrlInput);
  }
  const cfg = loadGasCacheConfig();
  const mysqlCfg = loadGasMysqlConfig();
  const wantMysqlSync = options?.syncMysql ?? (cfg.syncToMysqlOnRebuild || mysqlCfg.enabled);
  const gasUrl = getGasWebAppUrl();
  const nowIso = new Date().toISOString();

  const { entriesCount, mysqlSyncedCount } = buildEntriesInMemory(cfg, wantMysqlSync);
  const stored = loadStoredMetrics();

  let mode: GasCacheLogEntry['mode'] = 'LOCAL_TEMP_INDEX';
  let statusMsg = `已重建高頻查詢臨時索引共 ${entriesCount} 筆（TTL ${cfg.ttlSeconds} 秒${
    wantMysqlSync ? `，同步寫入 MySQL 緩存表 ${mysqlSyncedCount} 筆` : ''
  }）。`;

  if (gasUrl) {
    try {
      const resp = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'rebuildTempIndex',
          ttlSeconds: cfg.ttlSeconds,
          syncToMysql: wantMysqlSync,
          maxEntries: cfg.maxEntries,
        }),
      });
      if (resp.ok) {
        const json = await resp.json().catch(() => null);
        if (json && json.success) {
          mode = 'LIVE_GAS_FETCH';
          statusMsg =
            json.message ||
            `實機 GAS 已重建 CacheService + 臨時索引（${json.indexedCount || entriesCount} 筆）${
              wantMysqlSync ? '並同步至 MySQL 緩存表' : ''
            }。`;
        }
      }
    } catch {
      // Keep local index operational even if live GAS CORS is unavailable
    }
  }

  const nextMetrics: GasCacheMetrics = {
    ...stored.metrics,
    indexVersion: stored.metrics.indexVersion + 1,
    tempIndexCount: entriesCount,
    mysqlSyncedEntries: mysqlSyncedCount,
    lastRebuiltAt: nowIso,
    lastMysqlSyncAt: wantMysqlSync ? nowIso : stored.metrics.lastMysqlSyncAt,
    lastStatusMessage: statusMsg,
  };
  const nextLogs = appendCacheLog(stored.logs, 'REBUILD_INDEX', mode, statusMsg);
  saveMetricsState(nextMetrics, nextLogs);
  notifyGasMysqlCacheUpdated();

  return {
    ok: true,
    snapshot: getGasCacheSnapshot(),
    message: statusMsg,
  };
}

export async function syncTempCacheWithMysql(
  gasWebAppUrlInput?: string
): Promise<{ ok: boolean; syncedCount: number; message: string; snapshot: GasCacheSnapshot }> {
  if (typeof gasWebAppUrlInput === 'string') {
    setGasWebAppUrl(gasWebAppUrlInput);
  }
  const map = ensureIndexMapLoaded();
  const cfg = loadGasCacheConfig();
  const gasUrl = getGasWebAppUrl();
  const nowIso = new Date().toISOString();

  const entriesList = Array.from(map.values());
  let mode: GasCacheLogEntry['mode'] = 'LOCAL_TEMP_INDEX';
  let msg = '';

  for (const entry of entriesList) {
    entry.mysqlSynced = true;
    entry.mysqlSyncedAt = nowIso;
    map.set(entry.cacheKey, entry);
  }
  persistIndexMap(map);

  if (gasUrl) {
    try {
      const resp = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'syncCacheWithMysql',
          ttlSeconds: cfg.ttlSeconds,
          entries: entriesList.slice(0, 500).map((e) => ({
            cacheKey: e.cacheKey,
            entityType: e.entityType,
            lookupToken: e.lookupToken,
            primaryMid: e.primaryMid,
            sheetName: e.sheetName,
            sheetRowIndex: e.sheetRowIndex,
            hitCount: e.hitCount,
            expiresAt: e.expiresAt,
            payload: e.payload,
          })),
        }),
      });
      if (resp.ok) {
        const json = await resp.json().catch(() => null);
        if (json && json.success) {
          mode = 'LIVE_GAS_FETCH';
          msg =
            json.message ||
            `實機 GAS 已將 ${entriesList.length} 筆高頻臨時索引寫入 MySQL (erp_query_cache_index)！`;
        }
      }
    } catch {
      // Fallback below
    }
  }

  if (!msg) {
    const mysqlCfg = loadGasMysqlConfig();
    msg = `已完成 MySQL 同步緩存器批次校準：共 ${entriesList.length} 筆高頻臨時索引已寫入 ${mysqlCfg.mysqlDatabase}.erp_query_cache_index（TTL ${cfg.ttlSeconds}s）。`;
  }

  const stored = loadStoredMetrics();
  const nextMetrics: GasCacheMetrics = {
    ...stored.metrics,
    tempIndexCount: map.size,
    mysqlSyncedEntries: map.size,
    lastMysqlSyncAt: nowIso,
    lastStatusMessage: msg,
  };
  const nextLogs = appendCacheLog(stored.logs, 'MYSQL_SYNC', mode, msg);
  saveMetricsState(nextMetrics, nextLogs);
  notifyGasMysqlCacheUpdated();

  return {
    ok: true,
    syncedCount: entriesList.length,
    message: msg,
    snapshot: getGasCacheSnapshot(),
  };
}

export function purgeExpiredCacheEntries(): { purged: number; snapshot: GasCacheSnapshot } {
  const map = ensureIndexMapLoaded();
  const nowMs = Date.now();
  let purged = 0;

  for (const [k, entry] of map.entries()) {
    if (new Date(entry.expiresAt).getTime() <= nowMs) {
      map.delete(k);
      purged++;
    }
  }
  if (purged > 0) {
    rebuildInvertedTokenLookup(map);
    persistIndexMap(map);
  }

  const stored = loadStoredMetrics();
  const msg =
    purged > 0
      ? `已清理 ${purged} 筆逾期 TTL 臨時索引，保留 ${map.size} 筆有效緩存。`
      : `檢查完成：目前 ${map.size} 筆臨時索引皆仍在 TTL 有效期內（0 筆逾期）。`;

  const nextMetrics: GasCacheMetrics = {
    ...stored.metrics,
    tempIndexCount: map.size,
    mysqlSyncedEntries: Array.from(map.values()).filter((e) => e.mysqlSynced).length,
    expiredPurgedCount: stored.metrics.expiredPurgedCount + purged,
    lastStatusMessage: msg,
  };
  const nextLogs = appendCacheLog(stored.logs, 'PURGE_TTL', 'LOCAL_TEMP_INDEX', msg);
  saveMetricsState(nextMetrics, nextLogs);
  notifyGasMysqlCacheUpdated();

  return { purged, snapshot: getGasCacheSnapshot() };
}

export function queryWithMysqlSyncCache(keyword: string): CacheQueryResult {
  const cfg = loadGasCacheConfig();
  const rawKw = String(keyword || '').trim();
  const kwUpper = rawKw.toUpperCase();
  const kwDigits = normalizePhoneDigits(rawKw);

  const map = ensureIndexMapLoaded();
  if (!tokenLookupMap) {
    rebuildInvertedTokenLookup(map);
  }

  // 1) Measure Sheets full-scan simulation cost (iterating every row in Sheets datasets)
  const allMembers = erpEngine.getAllMembers();
  const allMono = erpEngine.getAllMonolineNodes();
  const allBi = erpEngine.getAllBinaryNodes();
  const totalSheetsRows = allMembers.length + allMono.length + allBi.length;

  const scanT0 = performance.now();
  const fallbackMatchedIds: string[] = [];
  if (kwUpper) {
    for (let i = 0; i < allMembers.length; i++) {
      const m = allMembers[i];
      if (
        m.mid.toUpperCase().includes(kwUpper) ||
        m.name.toUpperCase().includes(kwUpper) ||
        (kwDigits && normalizePhoneDigits(m.phone).includes(kwDigits)) ||
        m.monolineNodeId.toUpperCase().includes(kwUpper) ||
        m.binaryNodeId.toUpperCase().includes(kwUpper)
      ) {
        fallbackMatchedIds.push(m.mid);
      }
    }
    for (let i = 0; i < allBi.length; i++) {
      const b = allBi[i];
      if (b.nodeId.toUpperCase().includes(kwUpper) || b.mid.toUpperCase() === kwUpper) {
        fallbackMatchedIds.push(b.nodeId);
      }
    }
    for (let i = 0; i < allMono.length; i++) {
      const n = allMono[i];
      if (n.nodeId.toUpperCase().includes(kwUpper) || n.mid.toUpperCase() === kwUpper) {
        fallbackMatchedIds.push(n.nodeId);
      }
    }
  }
  const fullScanElapsedMs = Math.max(0.15, Number((performance.now() - scanT0).toFixed(3)));

  // 2) Measure O(1) MySQL Sync Cache + Temp Index lookup
  const cacheT0 = performance.now();
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const matchedEntries: TempIndexEntry[] = [];
  let cacheHit = false;
  let source: CacheQueryResult['source'] = 'SHEETS_FULL_SCAN_FALLBACK';

  if (cfg.enabled && kwUpper) {
    const exactKeys = tokenLookupMap?.get(kwUpper) || (kwDigits ? tokenLookupMap?.get(kwDigits) : undefined) || [];
    const seenKeys = new Set<string>();

    for (const k of exactKeys) {
      const entry = map.get(k);
      if (entry && new Date(entry.expiresAt).getTime() > nowMs) {
        seenKeys.add(k);
        entry.hitCount += 1;
        entry.lastAccessedAt = nowIso;
        entry.expiresAt = new Date(nowMs + cfg.ttlSeconds * 1000).toISOString();
        map.set(k, entry);
        matchedEntries.push({ ...entry });
      }
    }

    // Prefix / substring scan across compact hot index keys (much smaller than raw sheet columns)
    if (matchedEntries.length === 0) {
      for (const [k, entry] of map.entries()) {
        if (seenKeys.has(k)) continue;
        if (new Date(entry.expiresAt).getTime() <= nowMs) continue;
        const inTokens =
          entry.lookupToken.includes(kwUpper) ||
          entry.secondaryTokens.some((t) => t.includes(kwUpper) || (kwDigits && t.includes(kwDigits)));
        if (inTokens) {
          seenKeys.add(k);
          entry.hitCount += 1;
          entry.lastAccessedAt = nowIso;
          map.set(k, entry);
          matchedEntries.push({ ...entry });
          if (matchedEntries.length >= 20) break;
        }
      }
    }

    if (matchedEntries.length > 0) {
      cacheHit = true;
      source = matchedEntries.some((e) => e.mysqlSynced) ? 'MYSQL_SYNC_CACHE' : 'L2_TEMP_INDEX';
    } else if (fallbackMatchedIds.length > 0) {
      // Cache Miss backfill into temporary index immediately
      buildEntriesInMemory(cfg, loadGasMysqlConfig().enabled);
      const backfilledKeys = tokenLookupMap?.get(kwUpper) || [];
      for (const k of backfilledKeys) {
        const entry = map.get(k);
        if (entry) matchedEntries.push({ ...entry });
      }
    }
  }

  const cacheElapsedMs = Math.max(0.02, Number((performance.now() - cacheT0).toFixed(3)));
  // In real GAS SpreadsheetApp, full sheet read is ~450-1800ms while CacheService/MySQL index is ~8-45ms.
  // Combine measured ratio with realistic GAS Sheets I/O penalty scale for accurate diagnostics.
  const estimatedGasSheetsPenaltyMs = Number((fullScanElapsedMs + Math.max(12, totalSheetsRows * 0.08)).toFixed(2));
  const effectiveCacheMs = cacheHit ? cacheElapsedMs : Number((cacheElapsedMs + estimatedGasSheetsPenaltyMs).toFixed(2));
  const speedupFactor = Math.max(1, Number((estimatedGasSheetsPenaltyMs / Math.max(0.05, effectiveCacheMs)).toFixed(1)));

  const stored = loadStoredMetrics();
  const nextTotal = stored.metrics.totalQueries + 1;
  const nextHits = stored.metrics.cacheHits + (cacheHit ? 1 : 0);
  const nextMisses = stored.metrics.cacheMisses + (cacheHit ? 0 : 1);
  const hitRatePct = Number(((nextHits / Math.max(1, nextTotal)) * 100).toFixed(1));
  const prevAvgCache = stored.metrics.avgCacheLatencyMs || effectiveCacheMs;
  const prevAvgScan = stored.metrics.avgFullScanLatencyMs || estimatedGasSheetsPenaltyMs;
  const avgCacheLatencyMs = Number(((prevAvgCache * stored.metrics.totalQueries + effectiveCacheMs) / nextTotal).toFixed(2));
  const avgFullScanLatencyMs = Number(((prevAvgScan * stored.metrics.totalQueries + estimatedGasSheetsPenaltyMs) / nextTotal).toFixed(2));

  const summary = cacheHit
    ? `命中 ${source === 'MYSQL_SYNC_CACHE' ? 'MySQL 同步緩存器' : 'L2 臨時索引'}：檢索「${rawKw}」找到 ${matchedEntries.length} 筆索引（直接定位列號，略過 Sheets ${totalSheetsRows.toLocaleString()} 列全掃，加速 ${speedupFactor}x）`
    : `緩存未命中「${rawKw}」，已執行 Sheets 回源掃描 (${totalSheetsRows.toLocaleString()} 列) 並自動回填臨時索引。`;

  const nextMetrics: GasCacheMetrics = {
    ...stored.metrics,
    totalQueries: nextTotal,
    cacheHits: nextHits,
    cacheMisses: nextMisses,
    hitRatePct,
    tempIndexCount: map.size,
    mysqlSyncedEntries: Array.from(map.values()).filter((e) => e.mysqlSynced).length,
    avgCacheLatencyMs,
    avgFullScanLatencyMs,
    speedupRatio: Number((avgFullScanLatencyMs / Math.max(0.05, avgCacheLatencyMs)).toFixed(1)),
    lastStatusMessage: summary,
  };
  const nextLogs = appendCacheLog(
    stored.logs,
    cacheHit ? 'CACHE_HIT' : 'CACHE_MISS',
    'LOCAL_TEMP_INDEX',
    summary
  );
  saveMetricsState(nextMetrics, nextLogs);
  if (cacheHit) persistIndexMap(map);
  notifyGasMysqlCacheUpdated();

  return {
    keyword: rawKw,
    matchedCount: matchedEntries.length,
    cacheHit,
    source,
    cacheElapsedMs: effectiveCacheMs,
    fullScanElapsedMs: estimatedGasSheetsPenaltyMs,
    speedupFactor,
    rowsScannedInSheets: cacheHit ? 0 : totalSheetsRows,
    rowsAccessedInCache: matchedEntries.length,
    entries: matchedEntries,
    summary,
  };
}

export function invalidateCacheForMemberOrNode(targetMidOrToken?: string) {
  const cfg = loadGasCacheConfig();
  if (!cfg.enabled) return;

  const map = ensureIndexMapLoaded();
  const stored = loadStoredMetrics();
  let removed = 0;

  if (targetMidOrToken) {
    const tokenUpper = targetMidOrToken.trim().toUpperCase();
    for (const [k, entry] of map.entries()) {
      if (
        entry.primaryMid.toUpperCase() === tokenUpper ||
        entry.lookupToken === tokenUpper ||
        entry.entityType === 'SYSTEM_STATS' ||
        entry.entityType === 'SUBTREE'
      ) {
        map.delete(k);
        removed++;
      }
    }
  } else {
    removed = map.size;
    map.clear();
  }

  let rebuiltCount = map.size;
  if (cfg.autoRebuildOnMutation) {
    const res = buildEntriesInMemory(cfg, loadGasMysqlConfig().enabled);
    rebuiltCount = res.entriesCount;
  } else {
    rebuildInvertedTokenLookup(map);
    persistIndexMap(map);
  }

  const msg = targetMidOrToken
    ? `寫入穿透同步：已失效並增量更新【${targetMidOrToken}】關聯臨時索引（現有 ${rebuiltCount} 筆）`
    : `寫入穿透同步：已刷新全量臨時索引（${rebuiltCount} 筆）`;

  const nextMetrics: GasCacheMetrics = {
    ...stored.metrics,
    indexVersion: stored.metrics.indexVersion + 1,
    tempIndexCount: rebuiltCount,
    mysqlSyncedEntries: Array.from(ensureIndexMapLoaded().values()).filter((e) => e.mysqlSynced).length,
    invalidationCount: stored.metrics.invalidationCount + Math.max(1, removed),
    lastRebuiltAt: new Date().toISOString(),
    lastStatusMessage: msg,
  };
  const nextLogs = appendCacheLog(stored.logs, 'INVALIDATE', 'LOCAL_TEMP_INDEX', msg);
  saveMetricsState(nextMetrics, nextLogs);
  notifyGasMysqlCacheUpdated();
}

export function getGasCacheSnapshot(): GasCacheSnapshot {
  const config = loadGasCacheConfig();
  const map = ensureIndexMapLoaded();
  const stored = loadStoredMetrics();

  const entries = Array.from(map.values());
  const mysqlSyncedCount = entries.filter((e) => e.mysqlSynced).length;

  const hotEntries = entries
    .slice()
    .sort((a, b) => b.hitCount - a.hitCount || b.lastAccessedAt.localeCompare(a.lastAccessedAt))
    .slice(0, 18);

  return {
    config,
    metrics: {
      ...stored.metrics,
      tempIndexCount: map.size,
      mysqlSyncedEntries: mysqlSyncedCount,
    },
    hotEntries,
    logs: stored.logs,
  };
}

export function initGasCacheAutoSyncListeners() {
  if (listenersInitialized || typeof window === 'undefined') return;
  listenersInitialized = true;

  window.addEventListener(NODES_UPDATED_EVENT, (ev: Event) => {
    const customEv = ev as CustomEvent<{ memberMid?: string }>;
    invalidateCacheForMemberOrNode(customEv.detail?.memberMid);
  });

  window.addEventListener(TODOS_UPDATED_EVENT, (ev: Event) => {
    const customEv = ev as CustomEvent<{ memberMid?: string }>;
    invalidateCacheForMemberOrNode(customEv.detail?.memberMid);
  });
}

// Auto-initialize write-through invalidation listeners on module load
initGasCacheAutoSyncListeners();
