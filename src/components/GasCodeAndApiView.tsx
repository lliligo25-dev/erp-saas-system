/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { apiFetchHqGasCode, SheetSchemaDoc } from '../services/confidentialApiClient';
import { erpEngine } from '../services/erpEngine';
import { getGasWebAppUrl, getMemberTodos, setGasWebAppUrl } from '../services/gasTodoSyncService';
import {
  collectErpMigrationSnapshot,
  disconnectGasMysql,
  evaluateThresholdStatus,
  GasMysqlBridgeConfig,
  GasMysqlMode,
  generateGasScriptPropertiesSnippet,
  generateMysqlSchemaSql,
  loadGasMysqlConfig,
  MigrationProgress,
  oneClickConnectAndMigrateGasMysql,
  saveGasMysqlConfig,
  testGasMysqlBridge,
} from '../services/gasMysqlBridgeService';
import {
  ensureMemberCloudWorkspace,
  getModuleWritePermission,
} from '../services/memberCloudVaultService';
import {
  CacheQueryResult,
  GAS_MYSQL_CACHE_UPDATED_EVENT,
  GasCacheSnapshot,
  getGasCacheSnapshot,
  invalidateCacheForMemberOrNode,
  purgeExpiredCacheEntries,
  queryWithMysqlSyncCache,
  rebuildGasTempIndexes,
  saveGasCacheConfig,
  syncTempCacheWithMysql,
} from '../services/gasMysqlCacheService';
import {
  checkAndRunMidnightAutoBackupIfDue,
  configureMidnightBackupSchedule,
  downloadBackupSnapshotJson,
  executeCoreLedgerBackup,
  GAS_BACKUP_UPDATED_EVENT,
  GasBackupState,
  getGasBackupState,
  getNextMidnightTimestamp,
  importAndRestoreBackupJsonText,
  restoreFromBackupSnapshot,
} from '../services/gasBackupService';
import {
  FileCode2,
  Copy,
  Check,
  Download,
  Database,
  Send,
  Terminal,
  Server,
  Zap,
  ShieldCheck,
  RefreshCw,
  PlugZap,
  Unplug,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Save,
  Layers,
  Search,
  Trash2,
  Gauge,
  History,
  RotateCcw,
  Upload,
  FolderLock,
  ExternalLink,
} from 'lucide-react';

export const GasCodeAndApiView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'mysql' | 'backup' | 'code' | 'schema' | 'api'>('mysql');
  const [copied, setCopied] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedProps, setCopiedProps] = useState(false);
  const [gasCode, setGasCode] = useState<string>('');
  const [schemaDocs, setSchemaDocs] = useState<SheetSchemaDoc[]>([]);
  const [gasCodeLoading, setGasCodeLoading] = useState<boolean>(false);
  const [gasCodeError, setGasCodeError] = useState<string | null>(null);

  // GAS + MySQL Bridge State
  const [mysqlConfig, setMysqlConfig] = useState<GasMysqlBridgeConfig>(() => loadGasMysqlConfig());
  const [gasUrlInput, setGasUrlInput] = useState<string>(() => getGasWebAppUrl());
  const [bridgeLoading, setBridgeLoading] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [bridgeBanner, setBridgeBanner] = useState<{
    type: 'success' | 'info' | 'warning';
    text: string;
  } | null>(null);
  const [sqlViewMode, setSqlViewMode] = useState<'sql' | 'props'>('sql');

  // GAS MySQL Sync Cache & Temporary Indexer State
  const [cacheSnapshot, setCacheSnapshot] = useState<GasCacheSnapshot>(() => getGasCacheSnapshot());
  const [cacheQueryKeyword, setCacheQueryKeyword] = useState<string>('A-00001113');
  const [cacheQueryResult, setCacheQueryResult] = useState<CacheQueryResult | null>(null);
  const [cacheBusy, setCacheBusy] = useState<boolean>(false);

  // GAS Automated Midnight Backup & Point-in-Time Restore State
  const [backupState, setBackupState] = useState<GasBackupState>(() => getGasBackupState());
  const [backupBusy, setBackupBusy] = useState<boolean>(false);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [backupBanner, setBackupBanner] = useState<{
    type: 'success' | 'info' | 'warning';
    text: string;
  } | null>(null);
  const backupFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // API Tester States
  const [selectedAction, setSelectedAction] = useState<string>('register');
  const [requestBody, setRequestBody] = useState<string>(
    JSON.stringify(
      {
        action: 'register',
        data: {
          name: '林志豪',
          phone: '0988-123-456',
          idNumberMasked: 'B120***345',
          sponsorMid: 'A-00001113',
          storeId: 'S-TAIPEI-01',
          centerId: 'EDU-GLOBAL-01',
        },
      },
      null,
      2
    )
  );
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [apiLoading, setApiLoading] = useState(false);

  const stats = erpEngine.getStats();
  const thresholdEval = useMemo(
    () => evaluateThresholdStatus(stats.totalMembers, mysqlConfig.memberThreshold, mysqlConfig.enabled),
    [stats.totalMembers, mysqlConfig.memberThreshold, mysqlConfig.enabled]
  );

  const liveSnapshotPreview = useMemo(
    () => collectErpMigrationSnapshot(mysqlConfig).stats,
    [mysqlConfig]
  );

  const mysqlSchemaSql = useMemo(
    () => generateMysqlSchemaSql(mysqlConfig.mysqlDatabase),
    [mysqlConfig.mysqlDatabase]
  );

  const gasPropsSnippet = useMemo(
    () => generateGasScriptPropertiesSnippet(mysqlConfig),
    [mysqlConfig]
  );

  useEffect(() => {
    setGasUrlInput(getGasWebAppUrl());
  }, [activeSubTab]);

  useEffect(() => {
    const refreshCache = () => setCacheSnapshot(getGasCacheSnapshot());
    const refreshBackup = () => setBackupState(getGasBackupState());
    window.addEventListener(GAS_MYSQL_CACHE_UPDATED_EVENT, refreshCache);
    window.addEventListener(GAS_BACKUP_UPDATED_EVENT, refreshBackup);
    checkAndRunMidnightAutoBackupIfDue().then((ran) => {
      if (ran) setBackupState(getGasBackupState());
    });
    let cancelled = false;
    setGasCodeLoading(true);
    apiFetchHqGasCode()
      .then((res) => {
        if (!cancelled) {
          setGasCode(res.code);
          setSchemaDocs(res.schemaDocs);
          setGasCodeError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setGasCodeError(err?.message || '無法載入總部機密程式碼');
        }
      })
      .finally(() => {
        if (!cancelled) setGasCodeLoading(false);
      });

    return () => {
      cancelled = true;
      window.removeEventListener(GAS_MYSQL_CACHE_UPDATED_EVENT, refreshCache);
      window.removeEventListener(GAS_BACKUP_UPDATED_EVENT, refreshBackup);
    };
  }, []);

  const handleCopyCode = () => {
    if (!gasCode) return;
    navigator.clipboard.writeText(gasCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCode = () => {
    if (!gasCode) return;
    const blob = new Blob([gasCode], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Code.gs';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(mysqlSchemaSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleDownloadSql = () => {
    const blob = new Blob([mysqlSchemaSql], { type: 'application/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mysql_schema.sql';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyPropsSnippet = () => {
    navigator.clipboard.writeText(gasPropsSnippet);
    setCopiedProps(true);
    setTimeout(() => setCopiedProps(false), 2000);
  };

  const handleSavePreConfig = () => {
    setGasWebAppUrl(gasUrlInput);
    const saved = saveGasMysqlConfig(
      {
        ...mysqlConfig,
        lastStatusMessage: `已儲存 GAS + MySQL 預置參數（觸發門檻：${mysqlConfig.memberThreshold.toLocaleString()} 位會員，目標資料庫：${mysqlConfig.mysqlDatabase}）。`,
      },
      `已儲存預先擴容配置：門檻 ${mysqlConfig.memberThreshold.toLocaleString()} 人 · MySQL ${mysqlConfig.mysqlHost}:${mysqlConfig.mysqlPort}/${mysqlConfig.mysqlDatabase}`,
      'SAVE_CONFIG'
    );
    setMysqlConfig(saved);
    setBridgeBanner({
      type: 'success',
      text: `已儲存 GAS + MySQL 預先設定！目前以 Google Sheets 運行，當總會員數達 ${saved.memberThreshold.toLocaleString()} 位時即可隨時一鍵連接。`,
    });
  };

  const handleTestMysqlConnection = async () => {
    setBridgeLoading(true);
    setBridgeBanner(null);
    const result = await testGasMysqlBridge(mysqlConfig, gasUrlInput);
    setMysqlConfig(result.config);
    setBridgeBanner({
      type: result.ok ? 'info' : 'warning',
      text: result.message,
    });
    setBridgeLoading(false);
  };

  const handleOneClickConnect = async () => {
    setBridgeLoading(true);
    setBridgeBanner(null);
    setMigrationProgress({
      currentBatch: 0,
      totalBatches: 1,
      entityLabel: '準備分批遷移快照...',
      pct: 0,
    });
    const result = await oneClickConnectAndMigrateGasMysql(
      mysqlConfig,
      gasUrlInput,
      (progress) => setMigrationProgress(progress)
    );
    if (result.ok) {
      const cacheRes = await rebuildGasTempIndexes({
        syncMysql: true,
        gasWebAppUrlInput: gasUrlInput,
      });
      setCacheSnapshot(cacheRes.snapshot);
    }
    setMysqlConfig(result.config);
    setMigrationProgress(null);
    setBridgeBanner({
      type: result.ok ? 'success' : 'warning',
      text: result.message,
    });
    setBridgeLoading(false);
  };

  const handleDisconnectMysql = () => {
    const next = disconnectGasMysql(mysqlConfig);
    setMysqlConfig(next);
    setBridgeBanner({
      type: 'info',
      text: '已切換回「純 Google Sheets 待命模式」，您的 MySQL 主機與門檻配置仍安全保留。',
    });
  };

  const handleRebuildTempIndex = async () => {
    setCacheBusy(true);
    const res = await rebuildGasTempIndexes({
      syncMysql: cacheSnapshot.config.syncToMysqlOnRebuild || mysqlConfig.enabled,
      gasWebAppUrlInput: gasUrlInput,
    });
    setCacheSnapshot(res.snapshot);
    setBridgeBanner({ type: 'success', text: res.message });
    setCacheBusy(false);
  };

  const handleSyncCacheToMysql = async () => {
    setCacheBusy(true);
    const res = await syncTempCacheWithMysql(gasUrlInput);
    setCacheSnapshot(res.snapshot);
    setBridgeBanner({ type: 'info', text: res.message });
    setCacheBusy(false);
  };

  const handlePurgeExpiredCache = () => {
    const res = purgeExpiredCacheEntries();
    setCacheSnapshot(res.snapshot);
    setBridgeBanner({
      type: 'info',
      text: res.snapshot.metrics.lastStatusMessage,
    });
  };

  const handleRunCacheBenchmarkQuery = () => {
    const kw = cacheQueryKeyword.trim();
    if (!kw) return;
    const res = queryWithMysqlSyncCache(kw);
    setCacheQueryResult(res);
    setCacheSnapshot(getGasCacheSnapshot());
  };

  const handleRunBackupNow = async (triggerType: 'MANUAL' | 'MIDNIGHT_AUTO') => {
    setBackupBusy(true);
    setBackupBanner(null);
    const res = await executeCoreLedgerBackup({
      triggerType,
      note:
        triggerType === 'MIDNIGHT_AUTO'
          ? '模擬每日午夜 00:00 自動核心帳務 JSON 備份'
          : '管理員手動即時執行核心帳務 JSON 備份',
      gasWebAppUrlInput: gasUrlInput,
    });
    setBackupState(res.state);
    setBackupBanner({ type: 'success', text: res.message });
    setBackupBusy(false);
  };

  const handleSaveBackupSchedule = async (enabledVal: boolean, retentionVal: number) => {
    setBackupBusy(true);
    const res = await configureMidnightBackupSchedule({
      enabled: enabledVal,
      retentionDays: retentionVal,
      gasWebAppUrlInput: gasUrlInput,
    });
    setBackupState(res.state);
    setBackupBanner({ type: enabledVal ? 'success' : 'info', text: res.message });
    setBackupBusy(false);
  };

  const handleConfirmPointInTimeRestore = async (backupId: string) => {
    setBackupBusy(true);
    setConfirmRestoreId(null);
    const res = await restoreFromBackupSnapshot(backupId, gasUrlInput);
    setBackupState(res.state);
    setCacheSnapshot(getGasCacheSnapshot());
    setBackupBanner({ type: res.ok ? 'success' : 'warning', text: res.message });
    setBackupBusy(false);
  };

  const handleImportBackupJsonFile = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    setBackupBusy(true);
    const text = await file.text();
    const res = await importAndRestoreBackupJsonText(text, gasUrlInput);
    setBackupState(res.state);
    setCacheSnapshot(getGasCacheSnapshot());
    setBackupBanner({ type: res.ok ? 'success' : 'warning', text: res.message });
    ev.target.value = '';
    setBackupBusy(false);
  };

  const handleActionChange = (action: string) => {
    setSelectedAction(action);
    switch (action) {
      case 'register':
        setRequestBody(
          JSON.stringify(
            {
              action: 'register',
              data: {
                name: '林志豪',
                phone: '0988-123-456',
                idNumberMasked: 'B120***345',
                sponsorMid: 'A-00001113',
                storeId: 'S-TAIPEI-01',
                centerId: 'EDU-GLOBAL-01',
              },
            },
            null,
            2
          )
        );
        break;
      case 'settle':
        setRequestBody(
          JSON.stringify(
            {
              action: 'settle',
              data: {
                nodeId: 'C-25000001',
                amount: 100,
              },
            },
            null,
            2
          )
        );
        break;
      case 'queryMember':
        setRequestBody(
          JSON.stringify(
            {
              action: 'queryMember',
              data: {
                keyword: 'A-00001113',
              },
            },
            null,
            2
          )
        );
        break;
      case 'getBinarySubtree':
        setRequestBody(
          JSON.stringify(
            {
              action: 'getBinarySubtree',
              data: {
                nodeId: 'C-25000001',
                depth: 3,
              },
            },
            null,
            2
          )
        );
        break;
      case 'getSystemStats':
        setRequestBody(
          JSON.stringify(
            {
              action: 'getSystemStats',
            },
            null,
            2
          )
        );
        break;
      case 'addContact':
        setRequestBody(
          JSON.stringify(
            {
              action: 'addContact',
              data: {
                name: '張翠萍',
                phone: '0977-654-321',
                tel: '02-8765-4321',
                line: 'ping_zhang',
                email: 'ping@example.com',
                address: '新北市板橋區縣民大道二段 66 號',
                photoUrl:
                  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
              },
            },
            null,
            2
          )
        );
        break;
      case 'getContacts':
        setRequestBody(
          JSON.stringify(
            {
              action: 'getContacts',
            },
            null,
            2
          )
        );
        break;
      case 'getTodos':
        setRequestBody(
          JSON.stringify(
            {
              action: 'getTodos',
              memberMid: 'A-00001113',
            },
            null,
            2
          )
        );
        break;
      case 'upsertTodo':
        setRequestBody(
          JSON.stringify(
            {
              action: 'upsertTodo',
              memberMid: 'A-00001113',
              data: {
                ID: 'TDT-901',
                狀態: '處理中',
                事項標題: '確認 30 天體驗會員關懷清單',
                專案名稱: '個人代辦任務',
                優先級: '高',
                截止日期: new Date().toISOString().slice(0, 10),
                提醒時間: '17:30',
                詳細說明: '由 REST API 測試寫入 TODO_T',
              },
            },
            null,
            2
          )
        );
        break;
      case 'testMysqlConnection':
        setRequestBody(
          JSON.stringify(
            {
              action: 'testMysqlConnection',
              host: mysqlConfig.mysqlHost,
              port: mysqlConfig.mysqlPort,
              database: mysqlConfig.mysqlDatabase,
              user: mysqlConfig.mysqlUser,
              useSsl: mysqlConfig.useSsl,
            },
            null,
            2
          )
        );
        break;
      case 'initMysqlTables':
        setRequestBody(
          JSON.stringify(
            {
              action: 'initMysqlTables',
            },
            null,
            2
          )
        );
        break;
      case 'migrateAllToMysql':
        setRequestBody(
          JSON.stringify(
            {
              action: 'migrateAllToMysql',
              mode: 'DUAL_WRITE_MYSQL',
              config: {
                host: mysqlConfig.mysqlHost,
                port: mysqlConfig.mysqlPort,
                database: mysqlConfig.mysqlDatabase,
                user: mysqlConfig.mysqlUser,
                memberThreshold: mysqlConfig.memberThreshold,
              },
            },
            null,
            2
          )
        );
        break;
      case 'migrateBatchToMysql':
        setRequestBody(
          JSON.stringify(
            {
              action: 'migrateBatchToMysql',
              mode: 'DUAL_WRITE_MYSQL',
              batchIndex: 0,
              totalBatches: 1,
              isFinalBatch: true,
              entityType: 'members',
              rows: erpEngine.getAllMembers().slice(0, 5),
              config: {
                host: mysqlConfig.mysqlHost,
                port: mysqlConfig.mysqlPort,
                database: mysqlConfig.mysqlDatabase,
                user: mysqlConfig.mysqlUser,
              },
            },
            null,
            2
          )
        );
        break;
      case 'provisionMemberCloudWorkspace':
        setRequestBody(
          JSON.stringify(
            {
              action: 'provisionMemberCloudWorkspace',
              memberMid: 'A-00001113',
              memberName: '總公司直營旗艦示範戶',
            },
            null,
            2
          )
        );
        break;
      case 'getMemberCloudWorkspace':
        setRequestBody(
          JSON.stringify(
            {
              action: 'getMemberCloudWorkspace',
              memberMid: 'A-00001113',
            },
            null,
            2
          )
        );
        break;
      case 'rebuildTempIndex':
        setRequestBody(
          JSON.stringify(
            {
              action: 'rebuildTempIndex',
              ttlSeconds: cacheSnapshot.config.ttlSeconds,
              syncToMysql: true,
            },
            null,
            2
          )
        );
        break;
      case 'syncCacheWithMysql':
        setRequestBody(
          JSON.stringify(
            {
              action: 'syncCacheWithMysql',
              ttlSeconds: cacheSnapshot.config.ttlSeconds,
            },
            null,
            2
          )
        );
        break;
      case 'getCacheStats':
        setRequestBody(
          JSON.stringify(
            {
              action: 'getCacheStats',
            },
            null,
            2
          )
        );
        break;
      case 'invalidateHotCache':
        setRequestBody(
          JSON.stringify(
            {
              action: 'invalidateHotCache',
              keys: ['SYS_STATS', 'Q_MEM:A-00001113'],
              memberMid: 'A-00001113',
            },
            null,
            2
          )
        );
        break;
      case 'runScheduledBackup':
        setRequestBody(
          JSON.stringify(
            {
              action: 'runScheduledBackup',
              triggerType: 'MIDNIGHT_AUTO',
              retentionDays: backupState.config.retentionDays,
            },
            null,
            2
          )
        );
        break;
      case 'installMidnightBackupTrigger':
        setRequestBody(
          JSON.stringify(
            {
              action: 'installMidnightBackupTrigger',
              retentionDays: backupState.config.retentionDays,
            },
            null,
            2
          )
        );
        break;
      case 'listBackupSnapshots':
        setRequestBody(
          JSON.stringify(
            {
              action: 'listBackupSnapshots',
            },
            null,
            2
          )
        );
        break;
      case 'restoreBackupSnapshot':
        setRequestBody(
          JSON.stringify(
            {
              action: 'restoreBackupSnapshot',
              backupId: backupState.snapshots[0]?.backupId || 'BKP-000001',
              driveFileId: backupState.snapshots[0]?.driveFileId || 'GFILE-000001',
            },
            null,
            2
          )
        );
        break;
    }
  };

  const handleSendApiTest = () => {
    setApiLoading(true);
    setTimeout(() => {
      try {
        const parsed = JSON.parse(requestBody);
        let resp: Record<string, unknown> = {};
        if (parsed.action === 'register') {
          const res = erpEngine.registerNewMember(parsed.data || {});
          resp = {
            success: true,
            data: {
              mid: res.member.mid,
              monolineNodeId: res.monolineNode.nodeId,
              binaryNodeId: res.binaryNode.nodeId,
              placedParentId: res.binaryNode.parentId,
              placedPosition: res.binaryNode.placementPosition,
              trialExpiresAt: res.member.trialExpiresAt,
            },
            message: res.message,
          };
        } else if (parsed.action === 'settle') {
          const s = erpEngine.execute100PointsClosedLoopSettlement(
            parsed.data.nodeId,
            parsed.data.amount || 100
          );
          resp = {
            success: true,
            txnId: s.transactionId,
            totalCheck: s.totalDistributed,
            breakdown: {
              sponsor: s.totalSponsorPoints,
              placement: s.totalPlacementPoints,
              store: s.totalStorePoints,
              center: s.totalCenterPoints,
              abanyTech: s.abanyTechPoolPoints,
              hqOps: s.hqOperationsPoolPoints,
              publicSafety: s.publicSafetyPoolPoints,
            },
            message: `100 點全額閉環清算完成！驗證總和：${s.totalDistributed} 點 (完美平帳，0 資金沉澱)。`,
          };
        } else if (parsed.action === 'queryMember') {
          const cacheRes = queryWithMysqlSyncCache(String(parsed.data?.keyword || 'A-00001113'));
          const found = erpEngine.findMemberByMidOrNode(parsed.data.keyword);
          resp = {
            success: true,
            cacheHit: cacheRes.cacheHit,
            source: cacheRes.source,
            cacheElapsedMs: cacheRes.cacheElapsedMs,
            sheetsFullScanEstimateMs: cacheRes.fullScanElapsedMs,
            speedupFactor: `${cacheRes.speedupFactor}x`,
            tempIndexMatches: cacheRes.entries.map((e) => ({
              cacheKey: e.cacheKey,
              sheetName: e.sheetName,
              sheetRowIndex: e.sheetRowIndex,
            })),
            data: found,
          };
        } else if (parsed.action === 'getBinarySubtree') {
          const tree = erpEngine.getBinarySubtree(parsed.data.nodeId, parsed.data.depth || 3);
          resp = { success: true, data: tree };
        } else if (parsed.action === 'getSystemStats') {
          const currentStats = erpEngine.getStats();
          resp = { success: true, data: currentStats };
        } else if (parsed.action === 'addContact') {
          const newC = erpEngine.addContact(parsed.data || {});
          resp = { success: true, data: newC, message: `成功新增通訊主檔 (CONTACT_M): ${newC.id}` };
        } else if (parsed.action === 'getContacts') {
          const allC = erpEngine.getAllContacts();
          resp = { success: true, count: allC.length, data: allC };
        } else if (parsed.action === 'getTodos') {
          const mid = parsed.memberMid || 'A-00001113';
          const todos = getMemberTodos(mid);
          resp = { success: true, memberMid: mid, count: todos.length, todos };
        } else if (parsed.action === 'upsertTodo') {
          const mid = parsed.memberMid || 'A-00001113';
          resp = {
            success: true,
            action: 'upsertTodo',
            memberMid: mid,
            todoId: parsed.data?.ID || 'TDT-901',
            syncedAt: new Date().toISOString(),
            message: `已模擬寫入 Google Sheets 代辦事項明細 (TODO_T): ${parsed.data?.ID || 'TDT-901'}`,
          };
        } else if (parsed.action === 'testMysqlConnection') {
          resp = {
            success: true,
            action: 'testMysqlConnection',
            jdbcUrl: `jdbc:mysql://${parsed.host || mysqlConfig.mysqlHost}:${parsed.port || mysqlConfig.mysqlPort}/${parsed.database || mysqlConfig.mysqlDatabase}?useUnicode=true&characterEncoding=utf8mb4`,
            mysqlVersion: '8.0.36-InnoDB (GAS Jdbc Bridge Simulated)',
            message: 'GAS Jdbc.getConnection 連線測試架構檢查通過',
          };
        } else if (parsed.action === 'initMysqlTables') {
          resp = {
            success: true,
            action: 'initMysqlTables',
            tablesCreated: 8,
            tables: [
              'erp_members',
              'erp_monoline_nodes',
              'erp_binary_nodes',
              'erp_settlements',
              'erp_contacts_m',
              'erp_todos_t',
              'erp_gas_sync_meta',
              'erp_query_cache_index',
            ],
            message: '已完成 MySQL 八大核心與同步緩存索引資料表 DDL 檢查',
          };
        } else if (parsed.action === 'migrateAllToMysql') {
          const snap = collectErpMigrationSnapshot(mysqlConfig);
          resp = {
            success: true,
            action: 'migrateAllToMysql',
            mode: parsed.mode || 'DUAL_WRITE_MYSQL',
            migrated: snap.stats,
            message: `模擬一鍵遷移成功：會員 ${snap.stats.members} 筆、節點 ${snap.stats.monolineNodes + snap.stats.binaryNodes} 筆、清算 ${snap.stats.settlements} 筆、待辦 ${snap.stats.todos} 筆`,
          };
        } else if (parsed.action === 'migrateBatchToMysql') {
          const rowsCount = Array.isArray(parsed.rows) ? parsed.rows.length : 0;
          resp = {
            success: true,
            action: 'migrateBatchToMysql',
            entityType: parsed.entityType || 'members',
            batchIndex: parsed.batchIndex || 0,
            totalBatches: parsed.totalBatches || 1,
            processed: rowsCount,
            isFinalBatch: Boolean(parsed.isFinalBatch),
            message: `批次 ${(parsed.batchIndex || 0) + 1}/${parsed.totalBatches || 1} (${parsed.entityType || 'members'}) 已完成 JDBC Batch 寫入 ${rowsCount} 筆`,
          };
        } else if (parsed.action === 'provisionMemberCloudWorkspace') {
          const mid = parsed.memberMid || 'A-00001113';
          const ws = ensureMemberCloudWorkspace(mid);
          resp = {
            success: true,
            action: 'provisionMemberCloudWorkspace',
            memberMid: ws.memberMid,
            folderId: ws.folderId,
            folderName: ws.folderName,
            folderUrl: ws.folderUrl,
            spreadsheetId: ws.spreadsheetId,
            spreadsheetName: ws.spreadsheetName,
            spreadsheetUrl: ws.spreadsheetUrl,
            sheetTabsCount: ws.sheetTabs.length,
            readOnlyTabs: ws.sheetTabs.filter((t) => !t.canCreate).map((t) => t.sysType),
            message: `已為會員 ${ws.memberMid} 建立獨立 Google 雲端資料夾與試算表（含未續約工作表 protect() 唯讀保護檢查）`,
          };
        } else if (parsed.action === 'getMemberCloudWorkspace') {
          const mid = parsed.memberMid || 'A-00001113';
          const ws = ensureMemberCloudWorkspace(mid);
          const contactPerm = getModuleWritePermission(mid, 'CONTACT');
          resp = {
            success: true,
            action: 'getMemberCloudWorkspace',
            workspace: ws,
            contactWritePermission: contactPerm,
          };
        } else if (parsed.action === 'rebuildTempIndex') {
          const snapBefore = getGasCacheSnapshot();
          resp = {
            success: true,
            action: 'rebuildTempIndex',
            indexedCount: snapBefore.metrics.tempIndexCount,
            ttlSeconds: parsed.ttlSeconds || snapBefore.config.ttlSeconds,
            message: `已重建 L1 ScriptCache + L2 _SYS_熱點查詢臨時索引 (${snapBefore.metrics.tempIndexCount} 筆)`,
          };
        } else if (parsed.action === 'syncCacheWithMysql') {
          const snap = getGasCacheSnapshot();
          resp = {
            success: true,
            action: 'syncCacheWithMysql',
            syncedCount: snap.metrics.tempIndexCount,
            targetTable: 'erp_query_cache_index',
            message: `已將 ${snap.metrics.tempIndexCount} 筆高頻查詢臨時索引同步寫入 MySQL (erp_query_cache_index)`,
          };
        } else if (parsed.action === 'getCacheStats') {
          const snap = getGasCacheSnapshot();
          resp = {
            success: true,
            action: 'getCacheStats',
            metrics: snap.metrics,
            config: snap.config,
          };
        } else if (parsed.action === 'invalidateHotCache') {
          invalidateCacheForMemberOrNode(parsed.memberMid || 'A-00001113');
          resp = {
            success: true,
            action: 'invalidateHotCache',
            invalidatedKeys: parsed.keys || ['SYS_STATS'],
            message: '已執行 Write-Through 緩存鍵值失效並增量刷新臨時索引',
          };
        } else if (parsed.action === 'runScheduledBackup') {
          const bkpState = getGasBackupState();
          const latest = bkpState.snapshots[0];
          resp = {
            success: true,
            action: 'runScheduledBackup',
            backupFolder: bkpState.config.driveFolderName,
            latestSnapshot: latest
              ? {
                  backupId: latest.backupId,
                  fileName: latest.fileName,
                  driveFileId: latest.driveFileId,
                  checksum: latest.checksum,
                  sizeBytes: latest.sizeBytes,
                  counts: latest.counts,
                }
              : null,
            message: '已將核心帳務以 JSON 格式彙整並歸檔至 Google Drive 專屬備份資料夾',
          };
        } else if (parsed.action === 'installMidnightBackupTrigger') {
          resp = {
            success: true,
            action: 'installMidnightBackupTrigger',
            schedule: '每日 00:00 ~ 00:05 (Asia/Taipei)',
            retentionDays: parsed.retentionDays || 30,
            message: '已安裝每日午夜核心帳務自動 JSON 備份觸發器 (ScriptApp.newTrigger)',
          };
        } else if (parsed.action === 'listBackupSnapshots') {
          const bkpState = getGasBackupState();
          resp = {
            success: true,
            action: 'listBackupSnapshots',
            count: bkpState.snapshots.length,
            backups: bkpState.snapshots.map((s) => ({
              backupId: s.backupId,
              fileName: s.fileName,
              driveFileId: s.driveFileId,
              triggerType: s.triggerType,
              checksum: s.checksum,
              createdAt: s.createdAt,
              counts: s.counts,
            })),
          };
        } else if (parsed.action === 'restoreBackupSnapshot') {
          const bkpState = getGasBackupState();
          const found = bkpState.snapshots.find(
            (s) => s.backupId === parsed.backupId || s.driveFileId === parsed.driveFileId
          );
          resp = found
            ? {
                success: true,
                action: 'restoreBackupSnapshot',
                targetBackupId: found.backupId,
                targetFileName: found.fileName,
                checksumVerified: true,
                counts: found.counts,
                message: `點對點還原預檢通過：目標快照 ${found.fileName} 校驗碼 ${found.checksum} 完整無誤`,
              }
            : { success: false, error: '找不到指定的備份檔或 Drive File ID' };
        } else {
          resp = { success: false, error: '未知的 action' };
        }
        setApiResponse(JSON.stringify(resp, null, 2));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'JSON 解析失敗';
        setApiResponse(JSON.stringify({ success: false, error: msg }, null, 2));
      }
      setApiLoading(false);
    }, 120);
  };

  return (
    <div className="space-y-6">
      {/* Header and Sub-tab switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <FileCode2 className="w-5 h-5 text-indigo-400" />
              <span>GAS (Code.gs) 後端、MySQL 擴容預置與 REST API 整合中心</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              初期以 Google Sheets 無伺服器穩定運行，並預先配置好 GAS Jdbc + MySQL 擴容橋接；待會員數量達門檻即可一鍵無痛連接與全量遷移。
            </p>
          </div>

          {/* Sub tabs */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 w-fit">
            <button
              onClick={() => setActiveSubTab('mysql')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                activeSubTab === 'mysql'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>GAS + MySQL 擴容 & 一鍵連接</span>
            </button>
            <button
              onClick={() => setActiveSubTab('backup')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                activeSubTab === 'backup'
                  ? 'bg-teal-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>每日午夜備份 & 還原 ({backupState.snapshots.length})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('code')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                activeSubTab === 'code'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Code.gs 原始碼
            </button>
            <button
              onClick={() => setActiveSubTab('schema')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                activeSubTab === 'schema'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Google Sheets 資料庫 Schema
            </button>
            <button
              onClick={() => setActiveSubTab('api')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                activeSubTab === 'api'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              REST Web API 測試器
            </button>
          </div>
        </div>

        {/* Live Threshold Status Strip */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {thresholdEval.badgeState === 'CONNECTED' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                已連接 GAS + MySQL ({mysqlConfig.mode})
              </span>
            ) : thresholdEval.badgeState === 'READY_TO_CONNECT' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/80 text-amber-300 border border-amber-700/80 font-semibold animate-pulse">
                <Zap className="w-3.5 h-3.5" />
                已達會員擴容門檻 · 可一鍵連接 MySQL
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-700/80 font-semibold">
                <Clock className="w-3.5 h-3.5" />
                預先配置待命 · Google Sheets 運行中
              </span>
            )}

            <span className="text-slate-300 font-mono">
              目前會員：<strong className="text-white">{thresholdEval.currentMembers.toLocaleString()}</strong> / 門檻{' '}
              <strong className="text-indigo-300">{thresholdEval.threshold.toLocaleString()}</strong> 席 ({thresholdEval.progressPct}%)
            </span>
          </div>

          <div className="flex items-center gap-3 w-full md:w-72">
            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  thresholdEval.badgeState === 'CONNECTED'
                    ? 'bg-emerald-500'
                    : thresholdEval.isReached
                    ? 'bg-amber-400'
                    : 'bg-indigo-500'
                }`}
                style={{ width: `${Math.max(4, thresholdEval.progressPct)}%` }}
              />
            </div>
            {activeSubTab !== 'mysql' && (
              <button
                onClick={() => setActiveSubTab('mysql')}
                className="text-[11px] px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold cursor-pointer whitespace-nowrap"
              >
                管理擴容設定
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Subtab 0: GAS + MySQL Bridge Pre-Config & One-Click Connect */}
      {activeSubTab === 'mysql' && (
        <div className="space-y-6">
          {bridgeBanner && (
            <div
              className={`rounded-xl p-4 border text-xs flex items-start gap-3 ${
                bridgeBanner.type === 'success'
                  ? 'bg-emerald-950/50 border-emerald-700/70 text-emerald-200'
                  : bridgeBanner.type === 'warning'
                  ? 'bg-amber-950/50 border-amber-700/70 text-amber-200'
                  : 'bg-indigo-950/50 border-indigo-700/70 text-indigo-200'
              }`}
            >
              {bridgeBanner.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              )}
              <div className="flex-1 leading-relaxed">{bridgeBanner.text}</div>
            </div>
          )}

          {/* Top Grid: Threshold Gauge & One-Click Action */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-400" />
                    <span>會員達標自動擴容觸發器</span>
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    {thresholdEval.isReached ? 'THRESHOLD REACHED' : 'AUTO MONITORING'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                    <div className="text-[11px] text-slate-400">現有註冊會員</div>
                    <div className="text-lg font-bold font-mono text-white mt-0.5">
                      {thresholdEval.currentMembers.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                    <div className="text-[11px] text-slate-400">擴容觸發門檻</div>
                    <div className="text-lg font-bold font-mono text-indigo-300 mt-0.5">
                      {thresholdEval.threshold.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                    <div className="text-[11px] text-slate-400">
                      {thresholdEval.isReached ? '已超越門檻' : '尚餘觸發人數'}
                    </div>
                    <div
                      className={`text-lg font-bold font-mono mt-0.5 ${
                        thresholdEval.isReached ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                    >
                      {thresholdEval.isReached
                        ? `+${(thresholdEval.currentMembers - thresholdEval.threshold).toLocaleString()}`
                        : thresholdEval.remaining.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Preset & custom threshold */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    設定一鍵轉進 MySQL 會員門檻（人/席）：
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[10, 100, 600, 1000, 5000, 10000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          setMysqlConfig((prev) => ({ ...prev, memberThreshold: preset }))
                        }
                        className={`px-2.5 py-1 text-xs font-mono rounded border cursor-pointer transition-colors ${
                          mysqlConfig.memberThreshold === preset
                            ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {preset.toLocaleString()} 席
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      min={1}
                      max={25000000}
                      value={mysqlConfig.memberThreshold}
                      onChange={(e) =>
                        setMysqlConfig((prev) => ({
                          ...prev,
                          memberThreshold: Math.max(1, parseInt(e.target.value || '1', 10)),
                        }))
                      }
                      className="w-36 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-[11px] text-slate-400">
                      自訂門檻（例如設 10 席可立即測試達標狀態）
                    </span>
                  </div>
                </div>

                {/* Sheets optimization + batch size */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-2 text-[11px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-emerald-300">
                      萬人級純 Sheets 加速 + 分批防逾時遷移已啟用
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">每批上限：</span>
                      <select
                        value={mysqlConfig.batchSize || 500}
                        onChange={(e) =>
                          setMysqlConfig((prev) => ({
                            ...prev,
                            batchSize: Number(e.target.value) || 500,
                          }))
                        }
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 font-mono text-indigo-300 focus:outline-none cursor-pointer"
                      >
                        <option value={200}>200 筆/批</option>
                        <option value={500}>500 筆/批 (推薦)</option>
                        <option value={1000}>1,000 筆/批</option>
                      </select>
                    </div>
                  </div>
                  <div className="text-slate-400 leading-relaxed">
                    Code.gs 已優化為「結算 30 筆分紅單次 <code className="text-indigo-300">setValues</code> 批次寫入」＋「雙軌安置 <code className="text-indigo-300">O(1)</code> 父列直寫」，並採斷點分批寫入 MySQL。
                  </div>
                </div>

                {/* Snapshot ready count */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-1.5 text-[11px]">
                  <div className="font-semibold text-slate-300">待一鍵分批遷移之目前系統資料快照：</div>
                  <div className="grid grid-cols-3 gap-x-3 gap-y-1 font-mono text-slate-400">
                    <span>會員：{liveSnapshotPreview.members}</span>
                    <span>單軌：{liveSnapshotPreview.monolineNodes}</span>
                    <span>雙軌：{liveSnapshotPreview.binaryNodes}</span>
                    <span>清算：{liveSnapshotPreview.settlements}</span>
                    <span>通訊：{liveSnapshotPreview.contacts}</span>
                    <span>待辦：{liveSnapshotPreview.todos}</span>
                  </div>
                </div>

                {migrationProgress && (
                  <div className="bg-indigo-950/50 border border-indigo-700/70 rounded-lg p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-indigo-200 font-mono text-[11px]">
                      <span>
                        分批遷移中：{migrationProgress.entityLabel}
                      </span>
                      <span>
                        {migrationProgress.currentBatch} / {migrationProgress.totalBatches} ({migrationProgress.pct}%)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-150"
                        style={{ width: `${Math.max(5, migrationProgress.pct)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* One-Click Connect Action Buttons */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleOneClickConnect}
                  disabled={bridgeLoading}
                  className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md disabled:opacity-50 ${
                    thresholdEval.isReached
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {bridgeLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <PlugZap className="w-4 h-4" />
                  )}
                  <span>
                    {mysqlConfig.enabled
                      ? '重新分批同步並覆寫更新 GAS + MySQL 全量資料'
                      : thresholdEval.isReached
                      ? '已達擴容門檻！一鍵分批連接 GAS + MySQL (建表並遷移)'
                      : '一鍵分批連接 GAS + MySQL（預先完成 · 可隨時提前啟用遷移）'}
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleTestMysqlConnection}
                    disabled={bridgeLoading}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <Database className="w-3.5 h-3.5 text-sky-400" />
                    <span>測試 JDBC 連線</span>
                  </button>

                  {mysqlConfig.enabled ? (
                    <button
                      type="button"
                      onClick={handleDisconnectMysql}
                      disabled={bridgeLoading}
                      className="py-2 px-3 bg-rose-950/70 hover:bg-rose-900/70 border border-rose-800/70 text-rose-200 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Unplug className="w-3.5 h-3.5" />
                      <span>切回純 Sheets 待命</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSavePreConfig}
                      disabled={bridgeLoading}
                      className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>儲存預先配置</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Pre-Configured MySQL & GAS Bridge Form */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-400" />
                  <span>GAS + MySQL 連線規格與寫入模式預設定</span>
                </h3>
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  密碼由 GAS ScriptProperties 安全託管
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div className="sm:col-span-2">
                  <label className="text-slate-300 font-medium block mb-1">
                    GAS Web App 部署網址 (/exec，與個人待辦看板共用)
                  </label>
                  <input
                    type="text"
                    value={gasUrlInput}
                    onChange={(e) => setGasUrlInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec （留空則先用內建模擬帳本預置）"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-medium block mb-1">資料庫運作模式</label>
                  <select
                    value={mysqlConfig.mode}
                    onChange={(e) =>
                      setMysqlConfig((prev) => ({
                        ...prev,
                        mode: e.target.value as GasMysqlMode,
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="STANDBY_SHEETS_ONLY">
                      STANDBY_SHEETS_ONLY (預先設定待命 · 純 Google Sheets)
                    </option>
                    <option value="DUAL_WRITE_MYSQL">
                      DUAL_WRITE_MYSQL (推薦：Sheets + MySQL 即時雙寫)
                    </option>
                    <option value="MYSQL_PRIMARY">
                      MYSQL_PRIMARY (MySQL 為主庫 + Sheets 報表備份)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-medium block mb-1">MySQL 資料庫名稱</label>
                  <input
                    type="text"
                    value={mysqlConfig.mysqlDatabase}
                    onChange={(e) =>
                      setMysqlConfig((prev) => ({ ...prev, mysqlDatabase: e.target.value }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-medium block mb-1">MySQL 主機 (Host / IP)</label>
                  <input
                    type="text"
                    value={mysqlConfig.mysqlHost}
                    onChange={(e) =>
                      setMysqlConfig((prev) => ({ ...prev, mysqlHost: e.target.value }))
                    }
                    placeholder="db.your-domain.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">連接埠 (Port)</label>
                    <input
                      type="text"
                      value={mysqlConfig.mysqlPort}
                      onChange={(e) =>
                        setMysqlConfig((prev) => ({ ...prev, mysqlPort: e.target.value }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">MySQL 帳號</label>
                    <input
                      type="text"
                      value={mysqlConfig.mysqlUser}
                      onChange={(e) =>
                        setMysqlConfig((prev) => ({ ...prev, mysqlUser: e.target.value }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Scope Checkboxes */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-semibold text-slate-300">一鍵連接時同步遷移寫入模組：</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {(
                    [
                      { key: 'members', label: '會員主檔 (erp_members)' },
                      { key: 'nodes', label: '單/雙軌節點樹' },
                      { key: 'settlements', label: '100% 閉環清算帳本' },
                      { key: 'crmEvents', label: 'CRM 通訊錄與活動' },
                      { key: 'todos', label: '個人待辦任務 (TODO_T)' },
                    ] as const
                  ).map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 cursor-pointer hover:border-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={mysqlConfig.syncScopes[item.key]}
                        onChange={(e) =>
                          setMysqlConfig((prev) => ({
                            ...prev,
                            syncScopes: {
                              ...prev.syncScopes,
                              [item.key]: e.target.checked,
                            },
                          }))
                        }
                        className="accent-emerald-500"
                      />
                      <span className="text-slate-300 text-[11px]">{item.label}</span>
                    </label>
                  ))}

                  <label className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={mysqlConfig.useSsl}
                      onChange={(e) =>
                        setMysqlConfig((prev) => ({ ...prev, useSsl: e.target.checked }))
                      }
                      className="accent-indigo-500"
                    />
                    <span className="text-slate-300 text-[11px]">強制 SSL 傳輸加密</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                <div>
                  {mysqlConfig.connectedAt
                    ? `最近連接時間：${new Date(mysqlConfig.connectedAt).toLocaleString('zh-TW')}`
                    : '尚未連接實機 MySQL，所有預置規格已備妥'}
                </div>
                <button
                  type="button"
                  onClick={handleSavePreConfig}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>儲存預先設定</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Grid: SQL DDL / ScriptProperties + Migration Stats & Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: MySQL DDL & GAS ScriptProperties */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setSqlViewMode('sql')}
                    className={`px-3 py-1 rounded cursor-pointer font-medium ${
                      sqlViewMode === 'sql'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    MySQL 8.0 建表 DDL (schema.sql)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSqlViewMode('props')}
                    className={`px-3 py-1 rounded cursor-pointer font-medium ${
                      sqlViewMode === 'props'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    GAS 密碼安全設定腳本 (ScriptProperties)
                  </button>
                </div>

                {sqlViewMode === 'sql' ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedSql ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedSql ? '已複製 SQL' : '複製 SQL'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadSql}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>下載 mysql_schema.sql</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleCopyPropsSnippet}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedProps ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedProps ? '已複製設定函式' : '複製 setupMysqlProperties()'}</span>
                  </button>
                )}
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden font-mono text-[11px]">
                <pre className="p-4 overflow-x-auto text-slate-300 max-h-[340px] leading-relaxed select-all">
                  {sqlViewMode === 'sql' ? mysqlSchemaSql : gasPropsSnippet}
                </pre>
              </div>
            </div>

            {/* Right: Recent Migration Snapshot & Audit Logs */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-100 flex items-center justify-between">
                <span>擴容狀態與連線遷移紀錄</span>
                <span className="text-[11px] font-mono text-slate-400">
                  {mysqlConfig.logs.length} 筆紀錄
                </span>
              </h3>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 leading-relaxed">
                <span className="text-slate-500 block text-[11px] mb-0.5">目前系統提示：</span>
                {mysqlConfig.lastStatusMessage}
              </div>

              {mysqlConfig.lastMigratedStats && (
                <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-lg p-3 space-y-1.5 text-[11px]">
                  <div className="font-semibold text-emerald-300">
                    最近一次 MySQL 遷移統計（
                    {mysqlConfig.lastSyncAt
                      ? new Date(mysqlConfig.lastSyncAt).toLocaleString('zh-TW')
                      : '-'}
                    ）：
                  </div>
                  <div className="grid grid-cols-3 gap-2 font-mono text-emerald-200/90">
                    <span>會員：{mysqlConfig.lastMigratedStats.members}</span>
                    <span>單軌：{mysqlConfig.lastMigratedStats.monolineNodes}</span>
                    <span>雙軌：{mysqlConfig.lastMigratedStats.binaryNodes}</span>
                    <span>清算：{mysqlConfig.lastMigratedStats.settlements}</span>
                    <span>通訊：{mysqlConfig.lastMigratedStats.contacts}</span>
                    <span>待辦：{mysqlConfig.lastMigratedStats.todos}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2 max-h-[210px] overflow-y-auto pr-1">
                {mysqlConfig.logs.length === 0 ? (
                  <div className="text-xs text-slate-500 py-8 text-center border border-dashed border-slate-800 rounded-lg">
                    尚未觸發測試或一鍵連接。您可先調整左側「會員觸發門檻」並儲存預先配置，或直接按「一鍵連接」測試全量遷移。
                  </div>
                ) : (
                  mysqlConfig.logs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-slate-950 border border-slate-800/90 rounded-lg p-2.5 text-[11px] space-y-1"
                    >
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span
                          className={
                            log.status === 'ERROR'
                              ? 'text-rose-400'
                              : log.status === 'FALLBACK_SIMULATED'
                              ? 'text-amber-300'
                              : 'text-emerald-400'
                          }
                        >
                          [{log.action}] · {log.mode}
                        </span>
                        <span className="text-slate-500">
                          {new Date(log.timestamp).toLocaleTimeString('zh-TW')}
                        </span>
                      </div>
                      <div className="text-slate-300 leading-snug">{log.summary}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* GAS × MySQL Sync Cache & High-Frequency Temporary Indexer Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>GAS MySQL 同步緩存器與高頻臨時索引引擎 (L1 ScriptCache + L2 O(1) 列定位)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  為高頻檢索（MID、節點 C-碼、手機、雙軌子樹、全網統計）建立帶 TTL 的臨時倒排索引並同步至{' '}
                  <code className="text-sky-300 font-mono">erp_query_cache_index</code>，直接定位 Sheets 精準列號而無需全表掃描。
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cacheSnapshot.config.enabled}
                    onChange={(e) => {
                      saveGasCacheConfig({ ...cacheSnapshot.config, enabled: e.target.checked });
                      setCacheSnapshot(getGasCacheSnapshot());
                    }}
                    className="accent-sky-500"
                  />
                  <span>啟用同步緩存</span>
                </label>

                <select
                  value={cacheSnapshot.config.ttlSeconds}
                  onChange={(e) => {
                    saveGasCacheConfig({
                      ...cacheSnapshot.config,
                      ttlSeconds: Number(e.target.value) || 300,
                    });
                    setCacheSnapshot(getGasCacheSnapshot());
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-sky-300 focus:outline-none cursor-pointer"
                >
                  <option value={60}>TTL 60 秒</option>
                  <option value={180}>TTL 180 秒</option>
                  <option value={300}>TTL 300 秒 (推薦)</option>
                  <option value={600}>TTL 600 秒</option>
                  <option value={1800}>TTL 1800 秒</option>
                </select>

                <button
                  type="button"
                  onClick={handleRebuildTempIndex}
                  disabled={cacheBusy}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${cacheBusy ? 'animate-spin' : ''}`} />
                  <span>重建臨時索引</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncCacheToMysql}
                  disabled={cacheBusy}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>同步寫入 MySQL 緩存表</span>
                </button>

                <button
                  type="button"
                  onClick={handlePurgeExpiredCache}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>清理過期 TTL</span>
                </button>
              </div>
            </div>

            {/* Telemetry Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                <div className="text-[11px] text-slate-400">臨時索引總鍵數</div>
                <div className="text-lg font-bold font-mono text-sky-300 mt-0.5">
                  {cacheSnapshot.metrics.tempIndexCount.toLocaleString()}
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  Index v{cacheSnapshot.metrics.indexVersion}
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                <div className="text-[11px] text-slate-400">MySQL 已同步索引</div>
                <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                  {cacheSnapshot.metrics.mysqlSyncedEntries.toLocaleString()}
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  erp_query_cache_index
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                <div className="text-[11px] text-slate-400">緩存命中率 (Hit Rate)</div>
                <div className="text-lg font-bold font-mono text-amber-300 mt-0.5">
                  {cacheSnapshot.metrics.hitRatePct}%
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  命中 {cacheSnapshot.metrics.cacheHits} / 總查 {cacheSnapshot.metrics.totalQueries}
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                <div className="text-[11px] text-slate-400">預估檢索加速比</div>
                <div className="text-lg font-bold font-mono text-indigo-300 mt-0.5 flex items-center justify-center gap-1">
                  <Gauge className="w-4 h-4 text-indigo-400" />
                  <span>{cacheSnapshot.metrics.speedupRatio}x</span>
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  失效穿透：{cacheSnapshot.metrics.invalidationCount} 次
                </div>
              </div>
            </div>

            {/* Interactive High-Frequency Query Benchmark + Hot Index Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-sky-400" />
                  <span>高頻查詢檢索實測（O(1) 臨時索引 vs 全表掃描）</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={cacheQueryKeyword}
                    onChange={(e) => setCacheQueryKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRunCacheBenchmarkQuery()}
                    placeholder="輸入 MID / C-節點 / 手機 / 姓名"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="button"
                    onClick={handleRunCacheBenchmarkQuery}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    緩存檢索測試
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                  {['A-00001113', 'C-25000001', 'C-25000002', 'SYS_STATS'].map((presetKw) => (
                    <button
                      key={presetKw}
                      type="button"
                      onClick={() => {
                        setCacheQueryKeyword(presetKw);
                        const res = queryWithMysqlSyncCache(presetKw);
                        setCacheQueryResult(res);
                        setCacheSnapshot(getGasCacheSnapshot());
                      }}
                      className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sky-300 rounded cursor-pointer"
                    >
                      {presetKw}
                    </button>
                  ))}
                </div>

                {cacheQueryResult ? (
                  <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between font-mono">
                      <span
                        className={`px-2 py-0.5 rounded font-semibold ${
                          cacheQueryResult.cacheHit
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                            : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {cacheQueryResult.cacheHit ? 'CACHE HIT' : 'CACHE MISS'} · {cacheQueryResult.source}
                      </span>
                      <span className="text-sky-300 font-bold">
                        加速 {cacheQueryResult.speedupFactor}x
                      </span>
                    </div>
                    <div className="text-slate-300 leading-relaxed">{cacheQueryResult.summary}</div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                      <span>緩存耗時：{cacheQueryResult.cacheElapsedMs} ms</span>
                      <span>Sheets 全掃預估：{cacheQueryResult.fullScanElapsedMs} ms</span>
                      <span>Sheets 掃描列：{cacheQueryResult.rowsScannedInSheets} 列</span>
                      <span>索引直讀：{cacheQueryResult.rowsAccessedInCache} 筆</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 py-5 text-center border border-dashed border-slate-800 rounded-lg">
                    點選上方熱點標籤或輸入關鍵字執行檢索，即時驗證臨時索引命中與精準列定位效率。
                  </div>
                )}
              </div>

              <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">
                    高頻熱點臨時索引快照（依命中頻率排序）
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    顯示前 {cacheSnapshot.hotEntries.length} 筆
                  </span>
                </div>
                <div className="overflow-x-auto max-h-[210px]">
                  <table className="w-full text-[11px] text-left">
                    <thead className="text-slate-500 border-b border-slate-800 font-mono text-[10px]">
                      <tr>
                        <th className="py-1.5 px-2">索引鍵 (Cache Key)</th>
                        <th className="py-1.5 px-2">類型</th>
                        <th className="py-1.5 px-2">Sheets 定位</th>
                        <th className="py-1.5 px-2 text-right">命中</th>
                        <th className="py-1.5 px-2 text-right">MySQL 同步</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {cacheSnapshot.hotEntries.map((entry) => (
                        <tr key={entry.cacheKey} className="hover:bg-slate-900/60">
                          <td className="py-1.5 px-2 text-sky-300 truncate max-w-[190px]" title={entry.cacheKey}>
                            {entry.cacheKey}
                          </td>
                          <td className="py-1.5 px-2 text-slate-300">{entry.entityType}</td>
                          <td className="py-1.5 px-2 text-slate-400 font-sans">
                            {entry.sheetName} #{entry.sheetRowIndex}
                          </td>
                          <td className="py-1.5 px-2 text-right text-amber-300">{entry.hitCount}</td>
                          <td className="py-1.5 px-2 text-right">
                            {entry.mysqlSynced ? (
                              <span className="text-emerald-400">已同步</span>
                            ) : (
                              <span className="text-slate-500">本地索引</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subtab: Automated Midnight Backup & Point-in-Time Restore */}
      {activeSubTab === 'backup' && (
        <div className="space-y-6">
          {backupBanner && (
            <div
              className={`rounded-xl p-4 border text-xs flex items-start gap-3 ${
                backupBanner.type === 'success'
                  ? 'bg-emerald-950/50 border-emerald-700/70 text-emerald-200'
                  : backupBanner.type === 'warning'
                  ? 'bg-amber-950/50 border-amber-700/70 text-amber-200'
                  : 'bg-sky-950/50 border-sky-700/70 text-sky-200'
              }`}
            >
              {backupBanner.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              )}
              <div className="flex-1 leading-relaxed">{backupBanner.text}</div>
            </div>
          )}

          {/* Top Grid: Schedule Control + Drive Vault Location */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-400" />
                  <span>每日午夜 00:00 自動備份排程</span>
                </h3>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    backupState.config.enabled
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/70'
                      : 'bg-slate-950 text-slate-400 border-slate-700'
                  }`}
                >
                  {backupState.config.enabled ? 'MIDNIGHT ACTIVE (00:00)' : 'PAUSED'}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">備份專屬雲端資料夾：</span>
                  <a
                    href={backupState.config.driveFolderUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-teal-300 hover:text-teal-200 font-mono text-[11px]"
                  >
                    <FolderLock className="w-3.5 h-3.5" />
                    <span>{backupState.config.driveFolderName}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">最近一次成功備份：</span>
                  <span className="font-mono text-slate-200 text-[11px]">
                    {backupState.config.lastBackupAt
                      ? new Date(backupState.config.lastBackupAt).toLocaleString('zh-TW')
                      : '尚未執行'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">下次自動觸發時間：</span>
                  <span className="font-mono text-amber-300 text-[11px]">
                    {backupState.config.enabled
                      ? new Date(getNextMidnightTimestamp()).toLocaleString('zh-TW')
                      : '排程已暫停'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">最近點對點還原：</span>
                  <span className="font-mono text-slate-300 text-[11px]">
                    {backupState.config.lastRestoreAt
                      ? new Date(backupState.config.lastRestoreAt).toLocaleString('zh-TW')
                      : '尚無還原紀錄'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                  <input
                    type="checkbox"
                    checked={backupState.config.enabled}
                    onChange={(e) =>
                      handleSaveBackupSchedule(e.target.checked, backupState.config.retentionDays)
                    }
                    disabled={backupBusy}
                    className="accent-teal-500"
                  />
                  <span>啟用 GAS 每日午夜 00:00 自動備份觸發器</span>
                </label>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">保留天數：</span>
                  <select
                    value={backupState.config.retentionDays}
                    onChange={(e) =>
                      handleSaveBackupSchedule(
                        backupState.config.enabled,
                        Number(e.target.value) || 30
                      )
                    }
                    disabled={backupBusy}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-teal-300 focus:outline-none cursor-pointer"
                  >
                    <option value={7}>7 天</option>
                    <option value={14}>14 天</option>
                    <option value={30}>30 天 (推薦)</option>
                    <option value={90}>90 天</option>
                    <option value={180}>180 天</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleRunBackupNow('MANUAL')}
                  disabled={backupBusy}
                  className="py-2 px-3 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${backupBusy ? 'animate-spin' : ''}`} />
                  <span>立即執行 JSON 備份</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRunBackupNow('MIDNIGHT_AUTO')}
                  disabled={backupBusy}
                  className="py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>模擬午夜 00:00 排程</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">
                  若需從本機下載的備份檔案災難恢復：
                </span>
                <input
                  ref={backupFileInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportBackupJsonFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => backupFileInputRef.current?.click()}
                  disabled={backupBusy}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>匯入 JSON 檔點對點還原</span>
                </button>
              </div>
            </div>

            {/* Right: Point-in-Time Snapshot Vault List */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-400" />
                    <span>核心帳務 JSON 備份檔案庫 & 點對點還原 (PITR)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    每次執行還原前，系統均強制建立一筆「還原前安全保護快照 (PRE_RESTORE_SAFETY)」並驗證校驗碼，確保帳務零風險。
                  </p>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  共 {backupState.snapshots.length} 個可還原時間點
                </span>
              </div>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {backupState.snapshots.map((snap, idx) => (
                  <div
                    key={snap.backupId}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                            snap.triggerType === 'MIDNIGHT_AUTO'
                              ? 'bg-teal-950/80 text-teal-300 border-teal-700/70'
                              : snap.triggerType === 'PRE_RESTORE_SAFETY'
                              ? 'bg-amber-950/80 text-amber-300 border-amber-700/70'
                              : snap.triggerType === 'EXTERNAL_IMPORT'
                              ? 'bg-purple-950/80 text-purple-300 border-purple-700/70'
                              : 'bg-sky-950/80 text-sky-300 border-sky-700/70'
                          }`}
                        >
                          {snap.triggerType === 'MIDNIGHT_AUTO'
                            ? '午夜自動備份'
                            : snap.triggerType === 'PRE_RESTORE_SAFETY'
                            ? '還原前安全快照'
                            : snap.triggerType === 'EXTERNAL_IMPORT'
                            ? '外部匯入'
                            : '手動即時備份'}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-100">
                          {snap.fileName}
                        </span>
                        {idx === 0 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                            最新點
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {new Date(snap.createdAt).toLocaleString('zh-TW')}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
                      <div className="flex flex-wrap items-center gap-3">
                        <span>會員 {snap.counts.members}</span>
                        <span>單軌 {snap.counts.monolineNodes}</span>
                        <span>雙軌 {snap.counts.binaryNodes}</span>
                        <span>清算 {snap.counts.settlements}</span>
                        <span className="text-slate-500">
                          {(snap.sizeBytes / 1024).toFixed(1)} KB · {snap.checksum}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 font-sans">
                        <button
                          type="button"
                          onClick={() => downloadBackupSnapshotJson(snap.backupId)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>下載 JSON</span>
                        </button>

                        {confirmRestoreId === snap.backupId ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleConfirmPointInTimeRestore(snap.backupId)}
                              disabled={backupBusy}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-semibold cursor-pointer"
                            >
                              確認點對點還原
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRestoreId(null)}
                              className="px-2 py-1 bg-slate-800 text-slate-300 rounded text-[11px] cursor-pointer"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRestoreId(snap.backupId)}
                            disabled={backupBusy}
                            className="px-2.5 py-1 bg-amber-600/90 hover:bg-amber-500 text-white rounded text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>點對點還原到此時間點</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {snap.note && (
                      <div className="text-[11px] text-slate-500">{snap.note}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Audit Logs for Backup & PITR */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200">備份排程與點對點還原稽核日誌</span>
              <span className="font-mono text-slate-400">{backupState.logs.length} 筆紀錄</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[200px] overflow-y-auto pr-1">
              {backupState.logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-[11px] space-y-1"
                >
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className="text-teal-400">
                      [{log.action}] · {log.mode}
                    </span>
                    <span className="text-slate-500">
                      {new Date(log.timestamp).toLocaleString('zh-TW')}
                    </span>
                  </div>
                  <div className="text-slate-300 leading-snug">{log.summary}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Subtab 1: Code.gs */}
      {activeSubTab === 'code' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400">
              檔案位置：<code className="text-indigo-300 font-mono">Google Apps Script / Code.gs</code>{' '}
              （已內含 MySQL JDBC 預置橋接與自動雙寫掛勾）
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '已複製代碼' : '複製完整代碼'}</span>
              </button>
              <button
                onClick={handleDownloadCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>下載 Code.gs 檔案</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
            <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-slate-400 text-[11px]">
              <span>JavaScript (Google Apps Script Engine - V8 Runtime + Jdbc Service · 伺服器授權動態載入)</span>
              <span>
                {gasCodeLoading
                  ? '安全載入中...'
                  : `行數：約 ${gasCode.split('\n').length} 行`}
              </span>
            </div>
            {gasCodeError ? (
              <div className="p-6 text-rose-400 text-xs">{gasCodeError}</div>
            ) : (
              <pre className="p-4 overflow-x-auto text-slate-300 max-h-[600px] leading-relaxed select-all">
                {gasCodeLoading ? '// 正在向後端總部安全閘道請求授權載入 Code.gs...' : gasCode}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Subtab 2: Google Sheets Schema */}
      {activeSubTab === 'schema' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" />
              <span>Google Sheets {schemaDocs.length} 大工作表資料結構 (Database Schema)</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              透過執行 <code className="text-indigo-300 font-mono">setupDatabaseSheets()</code> 函式，系統自動在 Google 試算表中建立具備標題格式、顏色背景與資料檢核之完整架構；日後擴容亦可對應匯入 MySQL 同結構資料表。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {schemaDocs.map((sheet) => (
              <div
                key={sheet.sheetName}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: sheet.color }}
                    ></span>
                    <span>{sheet.sheetName}</span>
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    {sheet.columns.length} 欄位
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {sheet.description}
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead className="text-slate-500 uppercase border-b border-slate-800">
                      <tr>
                        <th className="py-1.5 px-2 font-semibold">欄位名稱</th>
                        <th className="py-1.5 px-2 font-semibold">資料型別 / 規格</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {sheet.columns.map((c) => (
                        <tr key={c.name} className="hover:bg-slate-950/40">
                          <td className="py-1.5 px-2 text-slate-200 font-sans flex items-center gap-1">
                            {c.name}
                            {c.key && (
                              <span className="text-[9px] px-1 bg-indigo-950 text-indigo-300 rounded border border-indigo-800">
                                PK
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-slate-400">
                            {c.type}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subtab 3: REST Web API Simulator */}
      {activeSubTab === 'api' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Google Apps Script Web App REST API 調試器</span>
            </h3>
            <p className="text-xs text-slate-400">
              前端 SPA 透過 HTTP POST 發送 JSON 格式指令與 Google Apps Script 進行跨域 (CORS) 資料同步、即時分流與 MySQL JDBC 擴容觸發。
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Request Payload */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-300 uppercase shrink-0">
                    選擇 API 動作 (Action)
                  </label>
                  <select
                    value={selectedAction}
                    onChange={(e) => handleActionChange(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-indigo-300 focus:outline-none cursor-pointer max-w-full"
                  >
                    <option value="register">register (1+1 自動雙發入會)</option>
                    <option value="settle">settle (100% 閉環清算)</option>
                    <option value="queryMember">queryMember (查詢會員與節點)</option>
                    <option value="getBinarySubtree">getBinarySubtree (取得雙軌子樹)</option>
                    <option value="getSystemStats">getSystemStats (取得全網統計)</option>
                    <option value="addContact">addContact (新增通訊主檔 CONTACT_M)</option>
                    <option value="getContacts">getContacts (取得所有通訊主檔)</option>
                    <option value="getTodos">getTodos (讀取個人待辦 TODO_T)</option>
                    <option value="upsertTodo">upsertTodo (新增/更新待辦 TODO_T)</option>
                    <option value="provisionMemberCloudWorkspace">provisionMemberCloudWorkspace (建置會員獨立雲端資料夾與試算表)</option>
                    <option value="getMemberCloudWorkspace">getMemberCloudWorkspace (查詢會員雲端資產與唯讀狀態)</option>
                    <option value="rebuildTempIndex">rebuildTempIndex (重建 ScriptCache + 臨時索引表)</option>
                    <option value="syncCacheWithMysql">syncCacheWithMysql (同步臨時索引至 MySQL 緩存表)</option>
                    <option value="getCacheStats">getCacheStats (檢視緩存命中率與臨時索引數)</option>
                    <option value="invalidateHotCache">invalidateHotCache (執行 Write-Through 緩存鍵失效)</option>
                    <option value="runScheduledBackup">runScheduledBackup (執行核心帳務 JSON 備份至 Drive)</option>
                    <option value="installMidnightBackupTrigger">installMidnightBackupTrigger (安裝每日午夜備份觸發器)</option>
                    <option value="listBackupSnapshots">listBackupSnapshots (列出 Drive 備份快照清單)</option>
                    <option value="restoreBackupSnapshot">restoreBackupSnapshot (點對點還原核心帳務)</option>
                    <option value="testMysqlConnection">testMysqlConnection (測試 GAS JDBC 連線)</option>
                    <option value="initMysqlTables">initMysqlTables (建立 MySQL 擴容資料表)</option>
                    <option value="migrateAllToMysql">migrateAllToMysql (一鍵遷移並開啟雙寫)</option>
                    <option value="migrateBatchToMysql">migrateBatchToMysql (分批防逾時遷移)</option>
                  </select>
                </div>

                <div>
                  <div className="text-[11px] text-slate-400 mb-1 flex justify-between">
                    <span>HTTP POST Payload (JSON):</span>
                    <span className="font-mono text-emerald-400">Content-Type: application/json</span>
                  </div>
                  <textarea
                    rows={12}
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed"
                  />
                </div>

                <button
                  onClick={handleSendApiTest}
                  disabled={apiLoading}
                  className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{apiLoading ? '調用 Google Apps Script API 中...' : '發送測試請求 (Simulate doPost)'}</span>
                </button>
              </div>
            </div>

            {/* Right: Response Output */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase">
                    API 回應結果 (Response)
                  </span>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                    200 OK
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 min-h-[320px] font-mono text-xs overflow-x-auto text-emerald-300">
                  {apiResponse ? (
                    <pre className="whitespace-pre-wrap">{apiResponse}</pre>
                  ) : (
                    <div className="text-slate-500 py-24 text-center font-sans">
                      尚未發送請求，點擊左側「發送測試請求」即可即時獲得 GAS 後端處理之 JSON 回應。
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
