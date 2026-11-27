/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import type { 
  Member, 
  NodeRecord, 
  NodeStatus,
  SettlementBreakdown, 
  SystemStats, 
  MemberFullNodeReport,
  Downstream15GenSummary,
  GenerationReferralDetail,
  StoreRecord,
  StoreMentoringGeneration,
  StoreDetailReport,
  EducationCenterRecord,
  CenterTrainingGeneration,
  CenterDetailReport,
  ContactMasterRecord,
  ContactTrackingRecord,
  EventMasterRecord,
  EventTrackingRecord,
  UserRole,
  AuthSession,
  HqStaffAccount,
  BookingProfile,
  BookingServiceItem,
  BookingAppointment
} from '../../src/types/erp.ts';
import { initNewMemberDefaultPacks } from '../../src/services/memberFiveStarConfig.ts';

const SERVER_DATA_DIR = path.resolve(process.cwd(), '.erp-server-data');
const SERVER_STATE_FILE = path.join(SERVER_DATA_DIR, 'erp-state.json');

export const GLOBAL_BOUNDARIES = {
  SYSTEM_NAME: '產銷合一物流直銷單軌轉雙軌 SaaS ERP 系統',
  SYSTEM_TARGET_MARKET: '台灣全齡人口 0~100 歲全民互助生態',
  CURRENCY_UNIT: '新台幣 (NTD)',
  RENTAL_FEE: 100, // 100 元/月/單位 = 100 點
  MONOLINE_MID_RANGE: 'A-00001 ~ A-25000000',
  BINARY_START_MID: 'A-25000001',
  MONOLINE_NODE_RANGE: 'C-00001 ~ C-25000000',
  BINARY_ROOT_NODE_ID: 'C-25000001',
  BINARY_START_POOL_RANGE: 'C-25000001 ~ C-25000063', // 63 席公司自營系統不得轉讓 (單雙軌起點)
  BINARY_START_POOL_COUNT: 63,
  HQ_LOCKED_MAX_SEQ: 63, // A-00001 ~ A-00063 公司自營系統不得轉讓
  PUBLIC_OPEN_START_SEQ: 64, // A-00064 起對外開放
  FLAGSHIP_SPONSOR_MID: 'A-00008', // 永吉家族直推起點 (公司自營 #08，由 A-00007 直推)
  TRIAL_SOFTWARE_QTY: 2,
  TRIAL_DAYS: 30,
};

const CURRENT_SCHEMA_VERSION = 'HQ63_YONGJI_PROD_V3';
const STORAGE_KEY = 'SAAS_ERP_STATE_V1';
export const DEFAULT_SHEET_PHOTO_URL =
  'https://drive.google.com/thumbnail?sz=w800&id=1hhnvavFgkxXJuC6ECYWiPV9Ir1NWO4NJ';

export function isHqNonTransferableMid(rawMid: string): boolean {
  const m = String(rawMid || '').trim().toUpperCase();
  if (!/^A-\d+$/.test(m)) return false;
  const n = parseInt(m.slice(2), 10);
  return !isNaN(n) && n >= 1 && n <= GLOBAL_BOUNDARIES.HQ_LOCKED_MAX_SEQ;
}

export function isHqNonTransferableNodeId(rawNodeId: string): boolean {
  const nid = String(rawNodeId || '').trim().toUpperCase();
  if (!/^C-\d+$/.test(nid)) return false;
  const n = parseInt(nid.slice(2), 10);
  if (isNaN(n)) return false;
  return (
    (n >= 1 && n <= GLOBAL_BOUNDARIES.HQ_LOCKED_MAX_SEQ) ||
    (n >= 25000001 && n <= 25000000 + GLOBAL_BOUNDARIES.HQ_LOCKED_MAX_SEQ)
  );
}

function getHqDirectSponsorMid(seq: number): string {
  if (seq <= 1) return 'HQ_ROOT';
  if (seq <= 7) return `A-${String(seq - 1).padStart(5, '0')}`;
  return 'A-00007'; // A-00007 直推 A-00008 ~ A-00063
}

const YONGJI_FAMILY_SEED: Array<{ seq: number; name: string; sponsorMid: string }> = [
  { seq: 64, name: '李永吉', sponsorMid: 'A-00008' },
  { seq: 65, name: '李佳馨', sponsorMid: 'A-00008' },
  { seq: 66, name: '林美珍', sponsorMid: 'A-00008' },
  { seq: 67, name: '李皇穎', sponsorMid: 'A-00008' },
  { seq: 68, name: '李孟馨', sponsorMid: 'A-00008' },
];

export class ERPEngine {
  private members: Map<string, Member> = new Map();
  private monolineNodes: Map<string, NodeRecord> = new Map();
  private binaryNodes: Map<string, NodeRecord> = new Map();
  private stores: Map<string, StoreRecord> = new Map();
  private centers: Map<string, EducationCenterRecord> = new Map();
  private settlements: SettlementBreakdown[] = [];
  private hqDbAuditLogs: Array<{
    id: string;
    timestamp: string;
    operatorId: string;
    operatorName: string;
    action: 'UPDATE_MEMBER' | 'DELETE_MEMBER' | 'UPDATE_NODE' | 'DELETE_NODE';
    targetType: 'MEMBER' | 'MONOLINE_NODE' | 'BINARY_NODE';
    targetId: string;
    summary: string;
    gasSyncOk?: boolean;
    gasSyncMessage?: string;
  }> = [];
  
  // 1. 通訊錄 CRM (CONTACT_M, CONTACT_T)
  private contacts: Map<string, ContactMasterRecord> = new Map();
  private contactTrackings: Map<string, ContactTrackingRecord> = new Map();
  // 2. 活動行銷 (EVENT_M, EVENT_T)
  private events: Map<string, EventMasterRecord> = new Map();
  private eventTrackings: Map<string, EventTrackingRecord> = new Map();
  // 3. 總部工作人員帳號
  private hqStaffs: Map<string, HqStaffAccount> = new Map();
  // 4. 第 3 種 AI 系統：個人預約系統
  private bookingProfiles: Map<string, BookingProfile> = new Map();
  private bookingAppointments: Map<string, BookingAppointment> = new Map();
  // 5. 會員全能五星工作區跨裝置雲端同步資料（解鎖模組 + 各模組建檔紀錄與照片）
  private memberWorkspacePacks: Map<string, string[]> = new Map();
  private memberWorkspaceRecords: Map<string, Record<string, Array<Record<string, any>>>> = new Map();

  private currentMonolineCounter: number = 68; // A-00001~A-00063 公司自營不得轉讓；A-00064~A-00068 永吉家族已建檔
  private currentBinaryCounter: number = 25000068; // C-25000001~C-25000063 公司自營；C-25000064~C-25000068 永吉家族
  private currentContactCounter: number = 0;
  private currentTrackingCounter: number = 0;
  private currentEventCounter: number = 0;
  private currentEventTrackingCounter: number = 0;
  private currentBookingLicenseCounter: number = 0;
  private currentAppointmentCounter: number = 0;
  
  // 統計總量
  private publicSafetyAccumulated: number = 0;
  private abanyTechAccumulated: number = 0;
  private hqOpsAccumulated: number = 0;

  constructor() {
    this.initializeSystem();
  }

  /**
   * 初始化系統：建立公司自營 63 席永久鎖定體系 (A-00001~A-00063 / C-00001~C-00063 / C-25000001~C-25000063) 與永吉家族 (A-00064~A-00068)
   */
  public initializeSystem(forceReset: boolean = false) {
    if (!forceReset) {
      const saved = fs.existsSync(SERVER_STATE_FILE)
        ? fs.readFileSync(SERVER_STATE_FILE, 'utf8')
        : null;
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          this.members = new Map(parsed.members);
          this.monolineNodes = new Map(parsed.monolineNodes);
          this.binaryNodes = new Map(parsed.binaryNodes);
          if (parsed.stores && parsed.stores.length > 0) {
            this.stores = new Map(parsed.stores);
          } else {
            this.initSampleStores();
          }
          if (parsed.centers && parsed.centers.length > 0) {
            this.centers = new Map(parsed.centers);
          } else {
            this.initSampleCenters();
          }
          if (parsed.contacts && Array.isArray(parsed.contacts)) {
            this.contacts = new Map(parsed.contacts);
          }
          if (parsed.contactTrackings && Array.isArray(parsed.contactTrackings)) {
            this.contactTrackings = new Map(parsed.contactTrackings);
          }
          if (parsed.events && parsed.events.length > 0) {
            this.events = new Map(parsed.events);
          } else {
            this.initDefaultPublicEvents();
          }
          if (parsed.eventTrackings && parsed.eventTrackings.length > 0) {
            this.eventTrackings = new Map(parsed.eventTrackings);
          }
          this.initHqStaffs();
          if (parsed.bookingProfiles && Array.isArray(parsed.bookingProfiles)) {
            this.bookingProfiles = new Map(parsed.bookingProfiles);
          }
          if (parsed.bookingAppointments && Array.isArray(parsed.bookingAppointments)) {
            this.bookingAppointments = new Map(parsed.bookingAppointments);
          }

          this.settlements = parsed.settlements || [];
          this.currentMonolineCounter = Math.max(
            GLOBAL_BOUNDARIES.HQ_LOCKED_MAX_SEQ,
            Number(parsed.currentMonolineCounter || 0)
          );
          this.currentBinaryCounter = Math.max(
            25000000 + GLOBAL_BOUNDARIES.HQ_LOCKED_MAX_SEQ,
            Number(parsed.currentBinaryCounter || 25000063)
          );
          this.currentContactCounter = parsed.currentContactCounter || this.contacts.size;
          this.currentTrackingCounter = parsed.currentTrackingCounter || this.contactTrackings.size;
          this.currentEventCounter = parsed.currentEventCounter || this.events.size;
          this.currentEventTrackingCounter = parsed.currentEventTrackingCounter || this.eventTrackings.size;
          this.currentBookingLicenseCounter = parsed.currentBookingLicenseCounter || this.bookingProfiles.size;
          this.currentAppointmentCounter = parsed.currentAppointmentCounter || this.bookingAppointments.size;
          this.publicSafetyAccumulated = parsed.publicSafetyAccumulated || 0;
          this.abanyTechAccumulated = parsed.abanyTechAccumulated || 0;
          this.hqOpsAccumulated = parsed.hqOpsAccumulated || 0;
          this.hqDbAuditLogs = Array.isArray(parsed.hqDbAuditLogs) ? parsed.hqDbAuditLogs.slice(0, 200) : [];
          if (parsed.memberWorkspacePacks && Array.isArray(parsed.memberWorkspacePacks)) {
            this.memberWorkspacePacks = new Map(parsed.memberWorkspacePacks);
          }
          if (parsed.memberWorkspaceRecords && Array.isArray(parsed.memberWorkspaceRecords)) {
            this.memberWorkspaceRecords = new Map(parsed.memberWorkspaceRecords);
          }

          let mutated = this.purgeLegacyVirtualDemoData();
          if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) {
            this.ensureHq63AndYongjiSeed(true);
            mutated = true;
          } else {
            this.ensureHq63AndYongjiSeed(false);
          }
          if (mutated) {
            this.saveState();
          }
          return;
        } catch {
          // ignore error and re-init
        }
      }
    }

    this.members.clear();
    this.monolineNodes.clear();
    this.binaryNodes.clear();
    this.stores.clear();
    this.centers.clear();
    this.contacts.clear();
    this.contactTrackings.clear();
    this.events.clear();
    this.eventTrackings.clear();
    this.bookingProfiles.clear();
    this.bookingAppointments.clear();
    this.settlements = [];
    this.initHqStaffs();
    this.initSampleStores();
    this.initSampleCenters();
    this.initDefaultPublicEvents();
    this.currentMonolineCounter = GLOBAL_BOUNDARIES.HQ_LOCKED_MAX_SEQ;
    this.currentBinaryCounter = 25000000 + GLOBAL_BOUNDARIES.HQ_LOCKED_MAX_SEQ;
    this.currentContactCounter = 0;
    this.currentTrackingCounter = 0;
    this.currentEventCounter = this.events.size;
    this.currentEventTrackingCounter = this.eventTrackings.size;
    this.currentBookingLicenseCounter = 0;
    this.currentAppointmentCounter = 0;
    this.publicSafetyAccumulated = 0;
    this.abanyTechAccumulated = 0;
    this.hqOpsAccumulated = 0;

    // 建立公司自營系統 63 席 (A-00001 ~ A-00063 不得轉讓) + 對外開放永吉家族 (A-00064 ~ A-00068)
    this.ensureHq63AndYongjiSeed(true);
    this.saveState();
  }

  /**
   * 確保 63 席公司自營系統席位（A-00001~A-00063 不得轉讓，直推鏈 1→2→3→4→5→6→7→8~63）
   * 與永吉家族起始建檔資料（A-00064~A-00068，皆由 A-00008 直推）完整就位
   */
  private ensureHq63AndYongjiSeed(forceRebuildHqAndYongji: boolean = false) {
    const now = new Date();
    const permanentExpiry = '2099-12-31T15:59:59.000Z';
    const trialExpiry = new Date(now.getTime() + GLOBAL_BOUNDARIES.TRIAL_DAYS * 24 * 3600 * 1000).toISOString();

    // 1. 移除舊版 514 席佔位池與 A-00001113 舊錨點
    if (this.members.has('A-00001113')) {
      this.members.delete('A-00001113');
    }
    for (const [nid, node] of Array.from(this.binaryNodes.entries())) {
      const bNum = parseInt(nid.replace(/^C-/, ''), 10);
      if (
        node.mid === 'A-00001113' ||
        (node.type === 'BINARY_HQ_POOL' && !isNaN(bNum) && bNum > 25000063)
      ) {
        const parent = this.binaryNodes.get(node.parentId);
        if (parent) {
          if (parent.leftChildId === nid) parent.leftChildId = undefined;
          if (parent.rightChildId === nid) parent.rightChildId = undefined;
        }
        this.binaryNodes.delete(nid);
      }
    }

    // 若強制重建，清除舊有 A-00001~A-00063 舊測試紀錄以免與公司自營 63 席衝突
    if (forceRebuildHqAndYongji) {
      for (const [nid, node] of Array.from(this.binaryNodes.entries())) {
        const bNum = parseInt(nid.replace(/^C-/, ''), 10);
        if (!isNaN(bNum) && bNum >= 25000001 && bNum <= 25000063) {
          this.binaryNodes.delete(nid);
        }
      }
    }

    // 2. 建立／鎖定公司自營系統 63 席：A-00001 ~ A-00063（單軌 C-00001~C-00063、雙軌 C-25000001~C-25000063）
    for (let i = 1; i <= GLOBAL_BOUNDARIES.HQ_LOCKED_MAX_SEQ; i++) {
      const mid = `A-${String(i).padStart(5, '0')}`;
      const monoId = `C-${String(i).padStart(5, '0')}`;
      const biId = `C-${String(25000000 + i).padStart(8, '0')}`;
      const sponsorMid = getHqDirectSponsorMid(i);
      const cleanMid = mid.replace(/[^A-Z0-9]/gi, '');
      const labelNum = String(i).padStart(2, '0');
      const hqName =
        i === 1
          ? '公司自營 #01 (單雙軌定海神針 · 不得轉讓)'
          : i === 7
          ? '公司自營 #07 (直推 A-00008~A-00063 · 不得轉讓)'
          : i === 8
          ? '公司自營 #08 (永吉家族直推起點 · 不得轉讓)'
          : `公司自營 #${labelNum} (公司自營系統 · 不得轉讓)`;

      const existingMember = this.members.get(mid);
      this.members.set(mid, {
        ...(existingMember || {}),
        mid,
        name: forceRebuildHqAndYongji || !existingMember?.name ? hqName : existingMember.name,
        phone: existingMember?.phone || `0900-000-${String(i).padStart(3, '0')}`,
        idNumberMasked: existingMember?.idNumberMasked || `HQ***${String(i).padStart(3, '0')}`,
        sponsorMid,
        storeId: existingMember?.storeId || 'S-HQ-01',
        centerId: existingMember?.centerId || 'EDU-HQ-01',
        registeredAt: existingMember?.registeredAt || now.toISOString(),
        trialExpiresAt: permanentExpiry,
        accumulatedRentAmount: existingMember?.accumulatedRentAmount ?? 0,
        monolineNodeId: monoId,
        binaryNodeId: biId,
        cloudFolderId: existingMember?.cloudFolderId || `GDRV-${cleanMid}`,
        cloudFolderName: existingMember?.cloudFolderName || `【AIS-ERP 會員雲端】${mid} ${hqName}`,
        cloudFolderUrl: existingMember?.cloudFolderUrl || `https://drive.google.com/drive/folders/GDRV-${cleanMid}`,
        cloudSpreadsheetId: existingMember?.cloudSpreadsheetId || `GSHEET-${cleanMid}`,
        cloudSpreadsheetName: existingMember?.cloudSpreadsheetName || `${mid}_${hqName}_AI軟體專屬試算表`,
        cloudSpreadsheetUrl:
          existingMember?.cloudSpreadsheetUrl || `https://docs.google.com/spreadsheets/d/GSHEET-${cleanMid}`,
      });

      const prevMonoId = i === 1 ? 'HQ_ROOT' : `C-${String(i - 1).padStart(5, '0')}`;
      const existingMono = this.monolineNodes.get(monoId);
      this.monolineNodes.set(monoId, {
        ...(existingMono || {}),
        nodeId: monoId,
        mid,
        name: `${hqName} (單軌起點)`,
        type: 'MONOLINE',
        track: 'MONOLINE',
        status: 'HQ_LOCKED',
        parentId: prevMonoId,
        placementPosition: 'MONOLINE_QUEUE',
        depth: i,
        sponsorMid,
        hqPermanentLocked: true,
        trialExpiresAt: permanentExpiry,
        totalEarnings: existingMono?.totalEarnings ?? 0,
        softwareKey: 'CONTACT',
        softwareTitle: '公司自營單軌起點 (不得轉讓)',
      });

      const parentIndex = Math.floor(i / 2);
      const parentBiId = i === 1 ? 'SYSTEM_ROOT' : `C-${String(25000000 + parentIndex).padStart(8, '0')}`;
      const isLeft = i % 2 === 0;
      const depth = i === 1 ? 0 : Math.floor(Math.log2(i));
      const existingBi = this.binaryNodes.get(biId);
      this.binaryNodes.set(biId, {
        ...(existingBi || {}),
        nodeId: biId,
        mid,
        name: i === 1 ? '雙軌定海神針 C-25000001 (A-00001 · 不得轉讓)' : `${hqName} (雙軌起點)`,
        type: i === 1 ? 'BINARY_ROOT' : 'BINARY_HQ_POOL',
        track: 'BINARY',
        status: 'HQ_LOCKED',
        parentId: parentBiId,
        placementPosition: i === 1 ? 'ROOT' : isLeft ? 'L' : 'R',
        depth,
        leftChildId: existingBi?.leftChildId,
        rightChildId: existingBi?.rightChildId,
        sponsorMid,
        hqPermanentLocked: true,
        trialExpiresAt: permanentExpiry,
        totalEarnings: existingBi?.totalEarnings ?? 0,
        softwareKey: 'EVENT',
        softwareTitle: '公司自營雙軌起點 (不得轉讓)',
      });

      if (i > 1) {
        const parentNode = this.binaryNodes.get(parentBiId);
        if (parentNode) {
          if (isLeft) parentNode.leftChildId = biId;
          else parentNode.rightChildId = biId;
        }
      }
    }

    // 3. 建立對外開放起點 A-00064 起之已建檔資料：永吉家族 (皆由 A-00008 直推)
    for (const entry of YONGJI_FAMILY_SEED) {
      const mid = `A-${String(entry.seq).padStart(5, '0')}`;
      const monoId = `C-${String(entry.seq).padStart(5, '0')}`;
      const biId = `C-${String(25000000 + entry.seq).padStart(8, '0')}`;
      const contactIdx = entry.seq - 63; // 1..5
      const contactId = `CM-${String(contactIdx).padStart(5, '0')}`;
      const trackingId = `CT-${String(contactIdx).padStart(5, '0')}`;
      const cleanMid = mid.replace(/[^A-Z0-9]/gi, '');

      const existingMem = this.members.get(mid);
      if (!existingMem || forceRebuildHqAndYongji) {
        this.members.set(mid, {
          ...(existingMem || {}),
          mid,
          name: existingMem?.name && !forceRebuildHqAndYongji ? existingMem.name : entry.name,
          phone: existingMem?.phone || '',
          tel: existingMem?.tel || '',
          line: existingMem?.line || '',
          email: existingMem?.email || '',
          address: existingMem?.address || '永吉家族',
          photoUrl:
            existingMem?.photoUrl && !existingMem.photoUrl.includes('images.unsplash.com')
              ? existingMem.photoUrl
              : DEFAULT_SHEET_PHOTO_URL,
          idNumberMasked: existingMem?.idNumberMasked || '',
          sponsorMid: entry.sponsorMid,
          storeId: existingMem?.storeId || 'S-TAIPEI-01',
          centerId: existingMem?.centerId || 'EDU-GLOBAL-01',
          registeredAt: existingMem?.registeredAt || now.toISOString(),
          trialExpiresAt: existingMem?.trialExpiresAt || trialExpiry,
          accumulatedRentAmount: existingMem?.accumulatedRentAmount ?? 0,
          monolineNodeId: monoId,
          binaryNodeId: biId,
          contactId: existingMem?.contactId || contactId,
          cloudFolderId: existingMem?.cloudFolderId || `GDRV-${cleanMid}`,
          cloudFolderName: existingMem?.cloudFolderName || `【AIS-ERP 會員雲端】${mid} ${entry.name}`,
          cloudFolderUrl: existingMem?.cloudFolderUrl || `https://drive.google.com/drive/folders/GDRV-${cleanMid}`,
          cloudSpreadsheetId: existingMem?.cloudSpreadsheetId || `GSHEET-${cleanMid}`,
          cloudSpreadsheetName: existingMem?.cloudSpreadsheetName || `${mid}_${entry.name}_AI軟體專屬試算表`,
          cloudSpreadsheetUrl:
            existingMem?.cloudSpreadsheetUrl || `https://docs.google.com/spreadsheets/d/GSHEET-${cleanMid}`,
        });
        initNewMemberDefaultPacks(mid);
      }

      if (!this.monolineNodes.has(monoId) || forceRebuildHqAndYongji) {
        const prevMonoId = `C-${String(entry.seq - 1).padStart(5, '0')}`;
        this.monolineNodes.set(monoId, {
          nodeId: monoId,
          mid,
          name: `${entry.name} (永吉家族 · 單軌)`,
          type: 'MONOLINE',
          track: 'MONOLINE',
          status: 'TRIAL_ACTIVE',
          parentId: prevMonoId,
          placementPosition: 'MONOLINE_QUEUE',
          depth: entry.seq,
          sponsorMid: entry.sponsorMid,
          hqPermanentLocked: false,
          trialExpiresAt: trialExpiry,
          totalEarnings: 0,
          softwareKey: 'CONTACT',
          softwareTitle: '通訊錄 CRM (1+1單軌)',
        });
      }

      if (!this.binaryNodes.has(biId) || forceRebuildHqAndYongji) {
        const parentIndex = Math.floor(entry.seq / 2);
        const parentBiId = `C-${String(25000000 + parentIndex).padStart(8, '0')}`;
        const isLeft = entry.seq % 2 === 0;
        const depth = Math.floor(Math.log2(entry.seq));
        this.binaryNodes.set(biId, {
          nodeId: biId,
          mid,
          name: `${entry.name} (永吉家族 · 雙軌)`,
          type: 'BINARY_MEMBER_SLOT',
          track: 'BINARY',
          status: 'TRIAL_ACTIVE',
          parentId: parentBiId,
          placementPosition: isLeft ? 'L' : 'R',
          depth,
          sponsorMid: entry.sponsorMid,
          hqPermanentLocked: false,
          trialExpiresAt: trialExpiry,
          totalEarnings: 0,
          softwareKey: 'EVENT',
          softwareTitle: '活動行銷 (1+1雙軌)',
        });
        const parentBi = this.binaryNodes.get(parentBiId);
        if (parentBi) {
          if (isLeft) parentBi.leftChildId = biId;
          else parentBi.rightChildId = biId;
        }
      }

      if (!this.contacts.has(contactId)) {
        this.contacts.set(contactId, {
          id: contactId,
          status: '開通AI軟體1+1',
          name: entry.name,
          phone: '',
          tel: '',
          line: '',
          email: '',
          address: '永吉家族',
          photoUrl: DEFAULT_SHEET_PHOTO_URL,
          updatedAt: now.toISOString(),
          ownerMid: entry.sponsorMid,
          memberMid: mid,
          monolineNodeId: monoId,
          binaryNodeId: biId,
        });
      } else {
        const existingContact = this.contacts.get(contactId)!;
        if (!existingContact.photoUrl || existingContact.photoUrl.includes('images.unsplash.com')) {
          existingContact.photoUrl = DEFAULT_SHEET_PHOTO_URL;
        }
      }

      if (!this.contactTrackings.has(trackingId)) {
        this.contactTrackings.set(trackingId, {
          id: trackingId,
          status: '開通體驗',
          name: entry.name,
          contactDate: now.toISOString().split('T')[0],
          contactMethod: '永吉家族起始建檔',
          discussionContent: `永吉家族正式對外開放首發建檔（推薦人 ${entry.sponsorMid} → ${mid} ${entry.name}，單軌 ${monoId} / 雙軌 ${biId}）`,
          nextStepPlan: '使用個人專屬 AI 工作區與即時試算表檢視功能',
          photoUrl: DEFAULT_SHEET_PHOTO_URL,
          updatedAt: now.toISOString(),
          contactId,
          ownerMid: entry.sponsorMid,
          memberMid: mid,
        });
      } else {
        const existingTracking = this.contactTrackings.get(trackingId)!;
        if (!existingTracking.photoUrl || existingTracking.photoUrl.includes('images.unsplash.com')) {
          existingTracking.photoUrl = DEFAULT_SHEET_PHOTO_URL;
        }
      }
    }

    // 同步將既有的空白或舊預設圖庫照片統一更新為新版試算表預設圖片
    for (const c of this.contacts.values()) {
      if (!c.photoUrl || c.photoUrl.includes('images.unsplash.com')) {
        c.photoUrl = DEFAULT_SHEET_PHOTO_URL;
      }
    }
    for (const t of this.contactTrackings.values()) {
      if (!t.photoUrl || t.photoUrl.includes('images.unsplash.com')) {
        t.photoUrl = DEFAULT_SHEET_PHOTO_URL;
      }
    }
    for (const e of this.events.values()) {
      if (!e.photoUrl || e.photoUrl.includes('images.unsplash.com')) {
        e.photoUrl = DEFAULT_SHEET_PHOTO_URL;
      }
    }
    for (const et of this.eventTrackings.values()) {
      if (!et.photoUrl || et.photoUrl.includes('images.unsplash.com')) {
        et.photoUrl = DEFAULT_SHEET_PHOTO_URL;
      }
    }

    this.recomputeCounters();
    if (this.currentContactCounter < YONGJI_FAMILY_SEED.length) {
      this.currentContactCounter = YONGJI_FAMILY_SEED.length;
    }
    if (this.currentTrackingCounter < YONGJI_FAMILY_SEED.length) {
      this.currentTrackingCounter = YONGJI_FAMILY_SEED.length;
    }
  }

  /**
   * 清除舊版測試殘留的模擬會員、假活動、假預約與模組虛擬示範資料（正式上線潔淨機制）
   */
  private purgeLegacyVirtualDemoData(): boolean {
    const legacyDemoSignatures = new Set([
      '王大明|0912-345-678',
      '李美華|0922-666-888',
      '張志豪|0933-555-777',
      '陳冠宇|0955-123-987',
    ]);
    const legacyDemoEventThemes = new Set([
      '【全台首發】新會員開通 AI 軟體 1+1 實體啟航說明會',
      '產銷合一物流直銷單軌轉雙軌全省領袖戰略研討會',
      '新會員開通 AI 軟體 1+1 實體啟航說明會',
    ]);
    const legacyDemoClients = new Set(['林詩涵', '吳建華', '黃小芬']);
    const legacyDemoWorkspaceSigs = new Set([
      'ATM-001|林佳穎',
      'ATM-002|陳志強',
      'ATT-001|林佳穎',
      'ATT-002|陳志強',
      'PRM-001|AI 產銷合一智聯健康飲禮盒',
      'PRM-002|頂級冷壓初榨植萃油',
      'PRT-001|黃冠傑',
      'PRT-002|張雅婷',
      'TCM-001|吳明宏',
      'TCT-001|吳明宏',
      'TCT-002|周美玲',
      'NLM-001|劉欣怡',
      'NLT-001|劉欣怡',
      'ELM-001|林福氣伯伯',
      'ELT-001|林福氣伯伯',
      'FRM-001|玉井頂級愛文芒果禮盒',
      'FRT-001|玉井頂級愛文芒果禮盒',
      'GRM-001|有機履歷舒康雞胸肉',
      'GRT-001|有機履歷舒康雞胸肉',
      'ASM-001|仁愛康健整合診所',
      'AST-001|仁愛康健整合診所',
      'BKM-001|AI 軟體 1+1 一對一深度體驗導覽',
      'BKM-002|產銷門市合作與系統導入諮詢',
      'TDM-001|新會員 AI 1+1 開通輔導計畫',
      'TDM-002|週期續約與產銷訂單月度檢視',
      'TDT-001|聯繫今日預約體驗客戶確認上線時段',
      'TDT-002|整理本週門店教育講座活動花絮發布',
      'TDT-003|確認未續約體驗名單與關懷通知',
    ]);

    let changed = false;
    const removedMids = new Set<string>();

    for (const [mid, m] of Array.from(this.members.entries())) {
      if (isHqNonTransferableMid(mid)) continue;
      const isLegacyMockMember =
        legacyDemoSignatures.has(`${m.name}|${m.phone}`) ||
        Boolean(m.email && m.email.toLowerCase().endsWith('@example.com')) ||
        Boolean(m.line && m.line.toLowerCase().startsWith('demo_')) ||
        /^.+_\d{3}$/.test(String(m.name || '').trim()) ||
        (String(m.name || '').includes('(第') &&
          (String(m.name || '').includes('代模擬') || String(m.name || '').includes('代直推')));
      if (isLegacyMockMember) {
        this.members.delete(mid);
        removedMids.add(mid);
        changed = true;
      }
    }

    if (removedMids.size > 0) {
      for (const [nid, n] of Array.from(this.monolineNodes.entries())) {
        if (removedMids.has(n.mid)) {
          this.monolineNodes.delete(nid);
        }
      }
      for (const [nid, n] of Array.from(this.binaryNodes.entries())) {
        if (removedMids.has(n.mid) && n.type !== 'BINARY_ROOT' && n.type !== 'BINARY_HQ_POOL') {
          const parent = this.binaryNodes.get(n.parentId);
          if (parent) {
            if (parent.leftChildId === nid) parent.leftChildId = undefined;
            if (parent.rightChildId === nid) parent.rightChildId = undefined;
          }
          this.binaryNodes.delete(nid);
        }
      }
      for (const [cid, c] of Array.from(this.contacts.entries())) {
        if (legacyDemoSignatures.has(`${c.name}|${c.phone}`) || (c.memberMid && removedMids.has(c.memberMid))) {
          this.contacts.delete(cid);
        }
      }
      for (const [tid, t] of Array.from(this.contactTrackings.entries())) {
        if (t.memberMid && removedMids.has(t.memberMid)) {
          this.contactTrackings.delete(tid);
        }
      }
      for (const [mid, bp] of Array.from(this.bookingProfiles.entries())) {
        if (removedMids.has(mid) || bp.ownerName === '王大明' || bp.ownerName === '李美華') {
          this.bookingProfiles.delete(mid);
        }
      }
      for (const [aid, ap] of Array.from(this.bookingAppointments.entries())) {
        if (removedMids.has(ap.ownerMid)) {
          this.bookingAppointments.delete(aid);
        }
      }
      this.recomputeCounters();
    }

    // 清除舊版虛擬預設活動與活動花絮
    for (const [eid, ev] of Array.from(this.events.entries())) {
      if (legacyDemoEventThemes.has(ev.eventTheme)) {
        this.events.delete(eid);
        changed = true;
      }
    }
    for (const [etid, et] of Array.from(this.eventTrackings.entries())) {
      if (legacyDemoEventThemes.has(et.eventTheme)) {
        this.eventTrackings.delete(etid);
        changed = true;
      }
    }

    // 清除舊版虛擬測試預約明細
    for (const [aid, ap] of Array.from(this.bookingAppointments.entries())) {
      if (legacyDemoClients.has(ap.clientName)) {
        this.bookingAppointments.delete(aid);
        changed = true;
      }
    }

    // 清除舊版工作區雲端殘留的模組虛擬範例資料
    for (const [mid, sysMap] of Array.from(this.memberWorkspaceRecords.entries())) {
      for (const [sysKey, recs] of Object.entries(sysMap)) {
        if (!Array.isArray(recs)) continue;
        const cleaned = recs.filter((rec) => {
          const id = String(rec?.ID || '').trim();
          const title = String(
            rec?.['姓名'] ||
              rec?.['客戶姓名'] ||
              rec?.['品名'] ||
              rec?.['診所與單位'] ||
              rec?.['服務名稱'] ||
              rec?.['專案名稱'] ||
              rec?.['事項標題'] ||
              ''
          ).trim();
          return !legacyDemoWorkspaceSigs.has(`${id}|${title}`);
        });
        if (cleaned.length !== recs.length) {
          sysMap[sysKey] = cleaned;
          changed = true;
        }
      }
      this.memberWorkspaceRecords.set(mid, sysMap);
    }

    return changed;
  }

  private recomputeCounters() {
    let maxMono = GLOBAL_BOUNDARIES.HQ_LOCKED_MAX_SEQ;
    for (const m of this.members.values()) {
      const mNum = parseInt(m.mid.replace(/^A-/, ''), 10);
      if (!isNaN(mNum) && mNum !== 1113 && mNum <= 25000000 && mNum > maxMono) {
        maxMono = mNum;
      }
    }
    for (const n of this.monolineNodes.values()) {
      const cNum = parseInt(n.nodeId.replace(/^C-/, ''), 10);
      if (!isNaN(cNum) && cNum !== 1113 && cNum <= 25000000 && cNum > maxMono) {
        maxMono = cNum;
      }
    }
    this.currentMonolineCounter = maxMono;

    let maxBi = 25000000 + GLOBAL_BOUNDARIES.HQ_LOCKED_MAX_SEQ;
    for (const n of this.binaryNodes.values()) {
      const bNum = parseInt(n.nodeId.replace(/^C-/, ''), 10);
      if (!isNaN(bNum) && bNum >= 25000001 && bNum > maxBi) {
        maxBi = bNum;
      }
    }
    this.currentBinaryCounter = maxBi;
  }

  private initHqStaffs() {
    this.hqStaffs.clear();
    const staffs: HqStaffAccount[] = [
      {
        staffId: 'HQ-001',
        name: '林執行總監',
        title: '總部營運總監',
        department: '總部營運管理中心',
        passcode: '1234',
        permissions: ['ALL_TREE', 'BATCH_SETTLEMENT', 'CRM_EVENTS', 'STORE_ADMIN', 'CENTER_ADMIN', 'GAS_API'],
      },
      {
        staffId: 'HQ-002',
        name: '陳財務長',
        title: '閉環清算稽核主管',
        department: '財務清算稽核部',
        passcode: '1234',
        permissions: ['SETTLEMENT_AUDIT', 'POOL_LEDGER', 'OVERVIEW'],
      },
      {
        staffId: 'HQ-003',
        name: '張工程師',
        title: 'GAS & AI 系統架構師',
        department: '艾邦妮科技研發部',
        passcode: '1234',
        permissions: ['GAS_API', 'BOOKING_ADMIN', 'ALL_TREE'],
      },
    ];
    for (const s of staffs) {
      this.hqStaffs.set(s.staffId, s);
    }
  }

  private initSampleBookings() {
    // 正式上線模式：不預載任何虛擬預約與假客戶資料
    this.bookingProfiles.clear();
    this.bookingAppointments.clear();
    this.currentBookingLicenseCounter = 0;
    this.currentAppointmentCounter = 0;
  }

  private initSampleStores() {
    this.stores.clear();
    const now = new Date();
    const sampleStores: StoreRecord[] = [
      {
        storeId: 'S-HQ-01',
        name: '總公司旗艦示範營運店',
        managerMid: GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID,
        managerName: '第 6 代旗艦領袖',
        phone: '02-8765-4321',
        address: '台北市信義區信義路五段 7 號 88 樓 (總部)',
        parentStoreId: undefined, // 總部母店
        establishedAt: new Date(now.getTime() - 180 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 1250,
        balance: 1250,
      },
      {
        storeId: 'S-TAIPEI-01',
        name: '台北大安忠孝旗艦經營店',
        managerMid: GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID,
        managerName: '台北區指派店長',
        phone: '02-2771-8899',
        address: '台北市大安區忠孝東路四段 120 號',
        parentStoreId: 'S-HQ-01', // 第 1 代直屬輔導店
        establishedAt: new Date(now.getTime() - 90 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 0,
        balance: 0,
      },
      {
        storeId: 'S-BANQIAO-01',
        name: '新北板橋文化經營店',
        managerMid: GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID,
        managerName: '新北區指派店長',
        phone: '02-8951-6677',
        address: '新北市板橋區文化路一段 188 號',
        parentStoreId: 'S-TAIPEI-01', // 第 2 代輔導店
        establishedAt: new Date(now.getTime() - 60 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 0,
        balance: 0,
      },
      {
        storeId: 'S-TAOYUAN-01',
        name: '桃園藝文特區中正經營店',
        managerMid: GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID,
        managerName: '桃園區指派店長',
        phone: '03-316-5588',
        address: '桃園市桃園區中正路 1188 號',
        parentStoreId: 'S-BANQIAO-01', // 第 3 代輔導店
        establishedAt: new Date(now.getTime() - 45 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 0,
        balance: 0,
      },
      {
        storeId: 'S-TAICHUNG-01',
        name: '台中西屯七期市政經營店',
        managerMid: GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID,
        managerName: '台中區指派店長',
        phone: '04-2258-9911',
        address: '台中市西屯區市政北二路 238 號',
        parentStoreId: 'S-TAOYUAN-01', // 第 4 代輔導店
        establishedAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 0,
        balance: 0,
      },
      {
        storeId: 'S-TAINAN-01',
        name: '台南東區南紡平實經營店',
        managerMid: 'A-00005',
        managerName: '林雅婷',
        phone: '06-236-7788',
        address: '台南市東區中華東路一段 366 號',
        parentStoreId: 'S-TAICHUNG-01', // 第 5 代輔導店
        establishedAt: new Date(now.getTime() - 20 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 80,
        balance: 80,
      },
      {
        storeId: 'S-KAOHSIUNG-01',
        name: '高雄左營巨蛋博愛經營店',
        managerMid: 'A-00006',
        managerName: '黃柏翰',
        phone: '07-556-3322',
        address: '高雄市左營區博愛二路 777 號',
        parentStoreId: 'S-TAINAN-01', // 第 6 代輔導店
        establishedAt: new Date(now.getTime() - 10 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 30,
        balance: 30,
      },
      {
        storeId: 'S-HSINCHU-01',
        name: '新竹東區科學園區經營店',
        managerMid: 'A-00007',
        managerName: '吳俊賢',
        phone: '03-577-6655',
        address: '新竹市東區光復路一段 576 號',
        parentStoreId: 'S-TAIPEI-01', // 第 2 代輔導店 (另一支線)
        establishedAt: new Date(now.getTime() - 50 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 310,
        balance: 310,
      },
    ];

    for (const s of sampleStores) {
      this.stores.set(s.storeId, s);
    }
  }

  private initSampleCenters() {
    this.centers.clear();
    const now = new Date();
    const sampleCenters: EducationCenterRecord[] = [
      {
        centerId: 'EDU-HQ-01',
        name: '總公司全球領袖教育訓練總部',
        directorMid: GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID,
        directorName: '第 6 代旗艦領袖',
        phone: '02-8765-8888',
        address: '台北市信義區信義路五段 7 號 89 樓 (教育講堂)',
        parentCenterId: undefined, // 總部母中心
        establishedAt: new Date(now.getTime() - 200 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 1380,
        balance: 1380,
      },
      {
        centerId: 'EDU-TAIPEI-01',
        name: '台北忠孝國際教育訓練中心',
        directorMid: GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID,
        directorName: '台北區培訓主任',
        phone: '02-2771-9900',
        address: '台北市大安區忠孝東路四段 128 號 12 樓',
        parentCenterId: 'EDU-HQ-01', // 第 1 代直屬培訓中心
        establishedAt: new Date(now.getTime() - 100 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 0,
        balance: 0,
      },
      {
        centerId: 'EDU-BANQIAO-01',
        name: '新北板橋卓越系統教育中心',
        directorMid: GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID,
        directorName: '新北區培訓主任',
        phone: '02-8951-8822',
        address: '新北市板橋區文化路一段 190 號 6 樓',
        parentCenterId: 'EDU-TAIPEI-01', // 第 2 代培訓中心
        establishedAt: new Date(now.getTime() - 70 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 0,
        balance: 0,
      },
      {
        centerId: 'EDU-TAOYUAN-01',
        name: '桃園藝文領袖培育研習中心',
        directorMid: GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID,
        directorName: '桃園區培訓主任',
        phone: '03-316-6699',
        address: '桃園市桃園區中正路 1190 號 8 樓',
        parentCenterId: 'EDU-BANQIAO-01', // 第 3 代培訓中心
        establishedAt: new Date(now.getTime() - 50 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 0,
        balance: 0,
      },
      {
        centerId: 'EDU-TAICHUNG-01',
        name: '台中市政智慧創新教育中心',
        directorMid: GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID,
        directorName: '台中區培訓主任',
        phone: '04-2258-7733',
        address: '台中市西屯區市政北二路 240 號 15 樓',
        parentCenterId: 'EDU-TAOYUAN-01', // 第 4 代培訓中心
        establishedAt: new Date(now.getTime() - 35 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 0,
        balance: 0,
      },
      {
        centerId: 'EDU-TAINAN-01',
        name: '台南平實創業實踐教育中心',
        directorMid: 'A-00005',
        directorName: '林雅婷',
        phone: '06-236-8811',
        address: '台南市東區中華東路一段 368 號 5 樓',
        parentCenterId: 'EDU-TAICHUNG-01', // 第 5 代培訓中心
        establishedAt: new Date(now.getTime() - 25 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 95,
        balance: 95,
      },
      {
        centerId: 'EDU-KAOHSIUNG-01',
        name: '高雄巨蛋國際創富教育中心',
        directorMid: 'A-00006',
        directorName: '黃柏翰',
        phone: '07-556-8800',
        address: '高雄市左營區博愛二路 780 號 10 樓',
        parentCenterId: 'EDU-TAINAN-01', // 第 6 代培訓中心
        establishedAt: new Date(now.getTime() - 15 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 40,
        balance: 40,
      },
      {
        centerId: 'EDU-GLOBAL-01',
        name: '亞太菁英領袖國際培育中心',
        directorMid: 'A-00007',
        directorName: '吳俊賢',
        phone: '03-577-8899',
        address: '新竹市東區光復路一段 580 號 7 樓',
        parentCenterId: 'EDU-TAIPEI-01', // 第 2 代培訓中心 (分支)
        establishedAt: new Date(now.getTime() - 60 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 360,
        balance: 360,
      },
    ];

    for (const c of sampleCenters) {
      this.centers.set(c.centerId, c);
    }
  }

  private initDefaultPublicEvents() {
    // 正式上線模式：活動主檔與活動花絮皆由真實使用者自行建檔，不預載任何虛擬示範活動
    this.events.clear();
    this.eventTrackings.clear();
    this.currentEventCounter = 0;
    this.currentEventTrackingCounter = 0;
  }

  private saveState() {
    try {
      const payload = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        members: Array.from(this.members.entries()),
        monolineNodes: Array.from(this.monolineNodes.entries()),
        binaryNodes: Array.from(this.binaryNodes.entries()),
        stores: Array.from(this.stores.entries()),
        centers: Array.from(this.centers.entries()),
        contacts: Array.from(this.contacts.entries()),
        contactTrackings: Array.from(this.contactTrackings.entries()),
        events: Array.from(this.events.entries()),
        eventTrackings: Array.from(this.eventTrackings.entries()),
        bookingProfiles: Array.from(this.bookingProfiles.entries()),
        bookingAppointments: Array.from(this.bookingAppointments.entries()),
        settlements: this.settlements.slice(-100), // 保留最近100筆
        currentMonolineCounter: this.currentMonolineCounter,
        currentBinaryCounter: this.currentBinaryCounter,
        currentContactCounter: this.currentContactCounter,
        currentTrackingCounter: this.currentTrackingCounter,
        currentEventCounter: this.currentEventCounter,
        currentEventTrackingCounter: this.currentEventTrackingCounter,
        currentBookingLicenseCounter: this.currentBookingLicenseCounter,
        currentAppointmentCounter: this.currentAppointmentCounter,
        publicSafetyAccumulated: this.publicSafetyAccumulated,
        abanyTechAccumulated: this.abanyTechAccumulated,
        hqOpsAccumulated: this.hqOpsAccumulated,
        hqDbAuditLogs: this.hqDbAuditLogs.slice(0, 200),
        memberWorkspacePacks: Array.from(this.memberWorkspacePacks.entries()),
        memberWorkspaceRecords: Array.from(this.memberWorkspaceRecords.entries()),
      };
      if (!fs.existsSync(SERVER_DATA_DIR)) {
        fs.mkdirSync(SERVER_DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(SERVER_STATE_FILE, JSON.stringify(payload), 'utf8');
    } catch {
      // ignore disk write error
    }
  }

  /**
   * 雙軌二元樹廣度優先搜尋 (BFS) 尋找第一個有空缺 (左或右) 的節點
   */
  public findNextAvailableBinaryPlacement(rootId: string = GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID): {
    parentId: string;
    position: 'L' | 'R';
    depth: number;
  } {
    const queue: string[] = [rootId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const node = this.binaryNodes.get(currentId);
      if (!node) continue;

      // 依序檢查左、右是否有空缺
      if (!node.leftChildId) {
        return {
          parentId: currentId,
          position: 'L',
          depth: node.depth + 1,
        };
      } else {
        queue.push(node.leftChildId);
      }

      if (!node.rightChildId) {
        return {
          parentId: currentId,
          position: 'R',
          depth: node.depth + 1,
        };
      } else {
        queue.push(node.rightChildId);
      }
    }

    // 理論上不會執行到這裡，若滿則退回至 root
    return {
      parentId: rootId,
      position: 'L',
      depth: 1,
    };
  }

  /**
   * 新會員開通 AI 軟體 1+1 (單軌公排 + 雙軌卡位，同步建立通訊錄 CM/CT 紀錄)
   */
  public registerNewMember(params: {
    name: string;
    phone?: string;
    tel?: string;
    line?: string;
    email?: string;
    address?: string;
    photoUrl?: string;
    idNumberMasked?: string;
    sponsorMid?: string;
    storeId?: string;
    centerId?: string;
    discussionContent?: string;
    nextStepPlan?: string;
    activateBookingSystem?: boolean;
  }): {
    success: boolean;
    member: Member;
    monolineNode: NodeRecord;
    binaryNode: NodeRecord;
    contact: ContactMasterRecord;
    contactTracking: ContactTrackingRecord;
    bookingProfile?: BookingProfile;
    message: string;
  } {
    const now = new Date();
    const trialExpireDate = new Date(now.getTime() + GLOBAL_BOUNDARIES.TRIAL_DAYS * 24 * 3600 * 1000);

    // 1. 分配會員代號 (A-碼) 與單軌節點編號 (C-碼) - A-00001~A-00063 為公司自營不得轉讓，A-00064 起對外開放
    if (this.currentMonolineCounter < GLOBAL_BOUNDARIES.HQ_LOCKED_MAX_SEQ) {
      this.currentMonolineCounter = GLOBAL_BOUNDARIES.HQ_LOCKED_MAX_SEQ;
    }
    this.currentMonolineCounter += 1;
    const monolineMid = `A-${String(this.currentMonolineCounter).padStart(5, '0')}`;
    const monolineNodeId = `C-${String(this.currentMonolineCounter).padStart(5, '0')}`;
    const previousMonolineNodeId = this.currentMonolineCounter === 1
      ? 'HQ_ROOT'
      : `C-${String(this.currentMonolineCounter - 1).padStart(5, '0')}`;

    // 推薦人預設為 A-00008 (公司自營 #08 · 永吉家族直推起點)
    const sponsorMid = params.sponsorMid || GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID;

    // 2. 建立【第一組 AI 軟體節點 (單軌公排)】
    const monolineNode: NodeRecord = {
      nodeId: monolineNodeId,
      mid: monolineMid,
      name: `${params.name} (第1組-單軌體驗)`,
      type: 'MONOLINE',
      track: 'MONOLINE',
      status: 'TRIAL_ACTIVE',
      parentId: previousMonolineNodeId,
      placementPosition: 'MONOLINE_QUEUE',
      depth: this.currentMonolineCounter,
      sponsorMid,
      hqPermanentLocked: false,
      trialExpiresAt: trialExpireDate.toISOString(),
      totalEarnings: 0,
      softwareKey: 'CONTACT',
      softwareTitle: '通訊錄 CRM (1+1單軌)',
    };
    this.monolineNodes.set(monolineNodeId, monolineNode);

    // 3. 建立【第二組 AI 軟體節點 (雙軌卡位分身，C-25000001 起，C-25000064 起對外開放)】
    if (this.currentBinaryCounter < 25000000 + GLOBAL_BOUNDARIES.HQ_LOCKED_MAX_SEQ) {
      this.currentBinaryCounter = 25000000 + GLOBAL_BOUNDARIES.HQ_LOCKED_MAX_SEQ;
    }
    this.currentBinaryCounter += 1;
    const binaryNodeId = `C-${String(this.currentBinaryCounter).padStart(8, '0')}`;

    // BFS 尋找第一個左/右空缺
    const placement = this.findNextAvailableBinaryPlacement(GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID);
    const parentBinaryNode = this.binaryNodes.get(placement.parentId);

    const binaryNode: NodeRecord = {
      nodeId: binaryNodeId,
      mid: monolineMid, // 同一會員享有雙分身
      name: `${params.name} (第2組-雙軌分身)`,
      type: 'BINARY_MEMBER_SLOT',
      track: 'BINARY',
      status: 'TRIAL_ACTIVE',
      parentId: placement.parentId,
      placementPosition: placement.position,
      depth: placement.depth,
      sponsorMid,
      hqPermanentLocked: false,
      trialExpiresAt: trialExpireDate.toISOString(),
      totalEarnings: 0,
      softwareKey: 'EVENT',
      softwareTitle: '活動行銷 (1+1雙軌)',
    };

    // 鏈結父節點
    if (parentBinaryNode) {
      if (placement.position === 'L') {
        parentBinaryNode.leftChildId = binaryNodeId;
      } else {
        parentBinaryNode.rightChildId = binaryNodeId;
      }
    }
    this.binaryNodes.set(binaryNodeId, binaryNode);

    // 4. 自動生成通訊主檔編號 (CONTACT_M / CM-)
    this.currentContactCounter += 1;
    const contactId = `CM-${String(this.currentContactCounter).padStart(5, '0')}`;
    const userPhone = (params.phone || '').trim();
    const userTel = (params.tel || '').trim();
    const userLine = (params.line || '').trim();
    const userEmail = (params.email || '').trim();
    const userAddress = (params.address || '').trim();
    const userPhoto = (params.photoUrl || '').trim() || DEFAULT_SHEET_PHOTO_URL;

    const cleanMid = monolineMid.replace(/[^A-Z0-9]/gi, '');
    const cloudFolderId = `GDRV-${cleanMid}`;
    const cloudFolderName = `【AIS-ERP 會員雲端】${monolineMid} ${params.name}`;
    const cloudSpreadsheetId = `GSHEET-${cleanMid}`;
    const cloudSpreadsheetName = `${monolineMid}_${params.name}_AI軟體專屬試算表`;

    // 5. 建立會員實體主檔 (自動配發獨立雲端資料夾與專屬 Google 試算表)
    const member: Member = {
      mid: monolineMid,
      name: params.name,
      phone: userPhone,
      tel: userTel,
      line: userLine,
      email: userEmail,
      address: userAddress,
      photoUrl: userPhoto,
      idNumberMasked: (params.idNumberMasked || '').trim(),
      sponsorMid,
      storeId: params.storeId || 'S-TAIPEI-01',
      centerId: params.centerId || 'EDU-GLOBAL-01',
      registeredAt: now.toISOString(),
      trialExpiresAt: trialExpireDate.toISOString(),
      accumulatedRentAmount: 0,
      monolineNodeId,
      binaryNodeId,
      contactId,
      cloudFolderId,
      cloudFolderName,
      cloudFolderUrl: `https://drive.google.com/drive/folders/${cloudFolderId}`,
      cloudSpreadsheetId,
      cloudSpreadsheetName,
      cloudSpreadsheetUrl: `https://docs.google.com/spreadsheets/d/${cloudSpreadsheetId}`,
    };
    this.members.set(monolineMid, member);

    // 6. 寫入通訊主檔 (CONTACT_M: ["ID", "狀態", "姓名", "手機", "電話", "Line", "Email", "地址", "照片連結", "更新時間"])
    const contact: ContactMasterRecord = {
      id: contactId,
      status: '開通AI軟體1+1',
      name: params.name,
      phone: userPhone,
      tel: userTel,
      line: userLine,
      email: userEmail,
      address: userAddress,
      photoUrl: userPhoto,
      updatedAt: now.toISOString(),
      memberMid: monolineMid,
      monolineNodeId,
      binaryNodeId,
    };
    this.contacts.set(contactId, contact);

    // 7. 寫入首筆聯繫紀錄 (CONTACT_T: ["ID", "狀態", "姓名", "聯繫日期", "聯繫方式", "洽談內容", "下一步計畫", "照片連結", "更新時間"])
    this.currentTrackingCounter += 1;
    const trackingId = `CT-${String(this.currentTrackingCounter).padStart(5, '0')}`;
    const contactTracking: ContactTrackingRecord = {
      id: trackingId,
      status: '開通體驗',
      name: params.name,
      contactDate: now.toISOString().split('T')[0],
      contactMethod: '線上開通',
      discussionContent: params.discussionContent || `新會員開通 AI 軟體 1+1：通訊錄 CRM + 活動行銷（同步綁定單軌 ${monolineNodeId} 與雙軌 ${binaryNodeId}，贈送 30 天體驗）`,
      nextStepPlan: params.nextStepPlan || '引導登入全能五星系統使用通訊錄 CRM 與活動行銷，並邀約參加說明會 (EM-00001)',
      photoUrl: userPhoto,
      updatedAt: now.toISOString(),
      contactId,
      memberMid: monolineMid,
    };
    this.contactTrackings.set(trackingId, contactTracking);

    // 初始化新會員 1+1 AI 軟體標配模組 (通訊錄 CRM + 活動行銷)
    initNewMemberDefaultPacks(monolineMid);

    // 8. 若勾選開通第 3 種 AI 系統：個人預約系統 (30天免費體驗 · 月租100元)
    let bookingProfile: BookingProfile | undefined = undefined;
    if (params.activateBookingSystem !== false) {
      bookingProfile = this.activateBookingTrial(monolineMid);
    }

    this.saveState();

    return {
      success: true,
      member,
      monolineNode,
      binaryNode,
      contact,
      contactTracking,
      bookingProfile,
      message: `恭喜【${params.name}】成功開通 AI 軟體 1+1（通訊錄 CRM + 活動行銷 30 天免費體驗）！已同步綁定單軌節點 (${monolineNodeId}) 與雙軌節點 (${binaryNodeId})${bookingProfile ? `，並啟動第3種 AI 個人預約系統 (${bookingProfile.licenseId})` : ''}，建立通訊主檔 (${contactId}) 與聯繫紀錄 (${trackingId})。`,
    };
  }

  public getBinaryNodeById(nodeId: string): NodeRecord | undefined {
    return this.binaryNodes.get(nodeId.trim().toUpperCase());
  }

  /**
   * 新買 / 新開通 AI 軟體系統時，自動為會員於雙軌二元樹 BFS 安置一個專屬新節點 (C-2500xxxx)
   * 若 executeSettlement 為 true，並以該新節點觸發 100 元全額閉環結算 (15+15+6+6+30+28 = 100 點)
   */
  public allocateBinaryNodeForSoftware(params: {
    memberMid: string;
    softwareKey: string;
    softwareTitle: string;
    existingBinaryNodeId?: string;
    forceNewSlot?: boolean;
    status?: NodeStatus;
    expiresAt?: string;
    executeSettlement?: boolean;
  }): {
    binaryNode: NodeRecord;
    isNewlyAllocated: boolean;
    settlement?: SettlementBreakdown;
  } {
    const keyMid = params.memberMid.trim().toUpperCase();
    const member = this.members.get(keyMid);
    const now = new Date();
    const defaultExp = new Date(now.getTime() + GLOBAL_BOUNDARIES.TRIAL_DAYS * 24 * 3600 * 1000).toISOString();

    if (params.existingBinaryNodeId && !params.forceNewSlot) {
      const existingNode = this.binaryNodes.get(params.existingBinaryNodeId);
      if (existingNode) {
        if (!existingNode.softwareKey) {
          existingNode.softwareKey = params.softwareKey;
          existingNode.softwareTitle = params.softwareTitle;
        }
        let settlement: SettlementBreakdown | undefined;
        if (params.executeSettlement) {
          settlement = this.execute100PointsClosedLoopSettlement(existingNode.nodeId, 100);
        } else {
          if (params.status) existingNode.status = params.status;
          if (params.expiresAt) existingNode.trialExpiresAt = params.expiresAt;
          this.saveState();
        }
        return { binaryNode: existingNode, isNewlyAllocated: false, settlement };
      }
    }

    this.currentBinaryCounter += 1;
    const binaryNodeId = `C-${String(this.currentBinaryCounter).padStart(8, '0')}`;
    const placement = this.findNextAvailableBinaryPlacement(GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID);
    const parentBinaryNode = this.binaryNodes.get(placement.parentId);

    const sponsorMid = member ? member.sponsorMid : GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID;
    const memberName = member ? member.name : keyMid;

    const initialExp = params.executeSettlement
      ? (params.expiresAt && new Date(params.expiresAt).getTime() > now.getTime() ? params.expiresAt : now.toISOString())
      : (params.expiresAt || defaultExp);

    const binaryNode: NodeRecord = {
      nodeId: binaryNodeId,
      mid: keyMid,
      name: `${memberName} (${params.softwareTitle})`,
      type: 'BINARY_MEMBER_SLOT',
      track: 'BINARY',
      status: params.status || (params.executeSettlement ? 'ACTIVE_RENEWED' : 'TRIAL_ACTIVE'),
      parentId: placement.parentId,
      placementPosition: placement.position,
      depth: placement.depth,
      sponsorMid,
      hqPermanentLocked: false,
      trialExpiresAt: initialExp,
      totalEarnings: 0,
      softwareKey: params.softwareKey,
      softwareTitle: params.softwareTitle,
    };

    if (parentBinaryNode) {
      if (placement.position === 'L') {
        parentBinaryNode.leftChildId = binaryNodeId;
      } else {
        parentBinaryNode.rightChildId = binaryNodeId;
      }
    }
    this.binaryNodes.set(binaryNodeId, binaryNode);

    let settlement: SettlementBreakdown | undefined;
    if (params.executeSettlement) {
      settlement = this.execute100PointsClosedLoopSettlement(binaryNodeId, 100);
    } else {
      this.saveState();
    }

    return { binaryNode, isNewlyAllocated: true, settlement };
  }

  /**
   * 100 元月租 100% 全額閉環結算演算法
   * @param targetNodeId 繳費用節點代號
   * @param amount 繳費金額 (預設 100 元)
   */
  public execute100PointsClosedLoopSettlement(
    targetNodeId: string,
    amount: number = 100
  ): SettlementBreakdown {
    const node = this.binaryNodes.get(targetNodeId) || this.monolineNodes.get(targetNodeId);
    if (!node) {
      throw new Error(`找不到繳費節點：${targetNodeId}`);
    }

    const member = this.members.get(node.mid);
    const now = new Date();
    const transactionId = 'TXN-' + now.getTime() + '-' + Math.floor(Math.random() * 1000);

    // 零錢池累加邏輯
    let effectiveAmount = amount;
    if (member) {
      member.accumulatedRentAmount += amount;
      if (member.accumulatedRentAmount >= 100) {
        effectiveAmount = 100;
        member.accumulatedRentAmount -= 100;
        // 展延 30 天效期
        const curExp = new Date(node.trialExpiresAt);
        const baseTime = curExp.getTime() > now.getTime() ? curExp.getTime() : now.getTime();
        node.trialExpiresAt = new Date(baseTime + 30 * 24 * 3600 * 1000).toISOString();
        node.status = 'ACTIVE_RENEWED';
        node.lastRenewalAt = now.toISOString();
      }
    }

    // 檢查是否觸發「未續約 50% 熔斷機制」
    // 若該節點尚未續約或已逾期，分紅減半 (0.5x)，其餘 50 點撥入 PUBLIC_SAFETY_POOL
    const isCircuitBreaker = new Date(node.trialExpiresAt).getTime() < now.getTime();

    const sponsorBonuses: SettlementBreakdown['sponsorBonuses'] = [];
    let totalSponsorPoints = 0;

    const placementBonuses: SettlementBreakdown['placementBonuses'] = [];
    let totalPlacementPoints = 0;

    let publicSafetyPoints = 0;

    // 1. 【15 代推薦分紅】：沿直推推薦鏈向上追溯 15 代，每代 1.0 點 = 15.0 點
    let currentSponsorMid = node.sponsorMid;
    for (let gen = 1; gen <= 15; gen++) {
      if (!currentSponsorMid || currentSponsorMid === 'HQ_ROOT') {
        // 若推薦鏈頂點無人，撥入公共安全池
        publicSafetyPoints += 1.0;
        continue;
      }

      const sponsorMember = this.members.get(currentSponsorMid);
      const isSponsorExpired = sponsorMember
        ? new Date(sponsorMember.trialExpiresAt).getTime() < now.getTime()
        : false;

      let awarded = 1.0;
      let status: 'PAID' | 'CIRCUIT_BREAKER_HALF' = 'PAID';

      if (isSponsorExpired) {
        awarded = 0.5; // 50% 熔斷減半
        publicSafetyPoints += 0.5;
        status = 'CIRCUIT_BREAKER_HALF';
      }

      sponsorBonuses.push({
        generation: gen,
        targetMid: currentSponsorMid,
        points: awarded,
        status,
      });
      totalSponsorPoints += awarded;

      // 累計節點收益
      if (sponsorMember) {
        const sponsorNode = this.monolineNodes.get(sponsorMember.monolineNodeId);
        if (sponsorNode) {
          sponsorNode.totalEarnings += awarded;
        }
      }

      // 向上溯源
      currentSponsorMid = sponsorMember ? sponsorMember.sponsorMid : 'HQ_ROOT';
    }

    // 2. 【15 代雙軌安置排線分紅】：沿雙軌安置樹向上追溯 15 代，每代 1.0 點 = 15.0 點
    let currentParentId = node.parentId;
    for (let gen = 1; gen <= 15; gen++) {
      if (!currentParentId || currentParentId === 'SYSTEM_ROOT' || currentParentId === 'HQ_ROOT') {
        publicSafetyPoints += 1.0;
        continue;
      }

      const parentNode = this.binaryNodes.get(currentParentId);
      if (!parentNode) {
        publicSafetyPoints += 1.0;
        continue;
      }

      const isParentExpired = !parentNode.hqPermanentLocked && new Date(parentNode.trialExpiresAt).getTime() < now.getTime();
      let awarded = 1.0;
      let status: 'PAID' | 'CIRCUIT_BREAKER_HALF' = 'PAID';

      if (isParentExpired) {
        awarded = 0.5; // 50% 熔斷
        publicSafetyPoints += 0.5;
        status = 'CIRCUIT_BREAKER_HALF';
      }

      parentNode.totalEarnings += awarded;
      placementBonuses.push({
        generation: gen,
        targetNodeId: parentNode.nodeId,
        targetMid: parentNode.mid,
        points: awarded,
        status,
      });
      totalPlacementPoints += awarded;

      currentParentId = parentNode.parentId;
    }

    // 3. 【6 代經營店輔導補貼】：沿綁定店鋪鏈向上追溯 6 代，每代 1.0 點 = 6.0 點
    const storeSubsidies: SettlementBreakdown['storeSubsidies'] = [];
    let totalStorePoints = 0;
    
    // 從付費會員所綁定之經營店出發
    const memberStoreId = member?.storeId || 'S-TAIPEI-01';
    let curStoreId: string | undefined = memberStoreId;
    const visitedStores = new Set<string>();

    for (let gen = 1; gen <= 6; gen++) {
      let targetStore: StoreRecord | undefined = curStoreId ? this.stores.get(curStoreId) : undefined;
      // 若當前店鋪已到達頂層或不存在，則預設由總公司示範店 (S-HQ-01) 承接
      if (!targetStore || visitedStores.has(targetStore.storeId)) {
        targetStore = this.stores.get('S-HQ-01');
      }

      const assignedStoreId = targetStore ? targetStore.storeId : `S-HQ-01`;
      if (targetStore) {
        visitedStores.add(targetStore.storeId);
        targetStore.totalSubsidyPoints += 1.0;
        targetStore.balance += 1.0;
      }

      storeSubsidies.push({
        generation: gen,
        targetStoreId: assignedStoreId,
        points: 1.0,
      });
      totalStorePoints += 1.0;

      // 沿輔導母店向上追溯下一代
      curStoreId = targetStore?.parentStoreId;
    }

    // 4. 【6 代教育中心培訓補貼】：沿綁定中心鏈向上追溯 6 代，每代 1.0 點 = 6.0 點
    const centerSubsidies: SettlementBreakdown['centerSubsidies'] = [];
    let totalCenterPoints = 0;

    const memberCenterId = member?.centerId || 'EDU-TAIPEI-01';
    let curCenterId: string | undefined = memberCenterId;
    const visitedCenters = new Set<string>();

    for (let gen = 1; gen <= 6; gen++) {
      let targetCenter: EducationCenterRecord | undefined = curCenterId ? this.centers.get(curCenterId) : undefined;
      // 若當前中心已到達頂層或不存在，則預設由總公司全球總部 (EDU-HQ-01) 承接
      if (!targetCenter || visitedCenters.has(targetCenter.centerId)) {
        targetCenter = this.centers.get('EDU-HQ-01');
      }

      const assignedCenterId = targetCenter ? targetCenter.centerId : 'EDU-HQ-01';
      if (targetCenter) {
        visitedCenters.add(targetCenter.centerId);
        targetCenter.totalSubsidyPoints += 1.0;
        targetCenter.balance += 1.0;
      }

      centerSubsidies.push({
        generation: gen,
        targetCenterId: assignedCenterId,
        points: 1.0,
      });
      totalCenterPoints += 1.0;

      // 沿培育母中心向上追溯下一代
      curCenterId = targetCenter?.parentCenterId;
    }

    // 5. 【艾邦妮科技有限公司科技系統池】：固定 30.0 點 (30%)
    const abanyTechPoolPoints = 30.0;
    this.abanyTechAccumulated += abanyTechPoolPoints;

    // 6. 【總公司營運行政管理池】：固定 28.0 點 (28%)
    const hqOperationsPoolPoints = 28.0;
    this.hqOpsAccumulated += hqOperationsPoolPoints;

    // 累計公共安全池
    this.publicSafetyAccumulated += publicSafetyPoints;

    // 平帳公式驗證：15.0 + 15.0 + 6.0 + 6.0 + 30.0 + 28.0 = 100.0 點
    const totalDistributed = Number(
      (
        totalSponsorPoints +
        totalPlacementPoints +
        totalStorePoints +
        totalCenterPoints +
        abanyTechPoolPoints +
        hqOperationsPoolPoints +
        publicSafetyPoints
      ).toFixed(2)
    );

    const breakdown: SettlementBreakdown = {
      transactionId,
      nodeId: targetNodeId,
      mid: node.mid,
      paidAmount: effectiveAmount,
      isCircuitBreaker,
      timestamp: now.toISOString(),
      sponsorBonuses,
      totalSponsorPoints,
      placementBonuses,
      totalPlacementPoints,
      storeSubsidies,
      totalStorePoints,
      centerSubsidies,
      totalCenterPoints,
      abanyTechPoolPoints,
      hqOperationsPoolPoints,
      publicSafetyPoolPoints: publicSafetyPoints,
      totalDistributed,
    };

    this.settlements.unshift(breakdown);
    this.saveState();
    return breakdown;
  }

  /**
   * 會員自主續約月租 (延長 1+1 節點 30 天效期並執行 100% 閉環清算分潤)
   */
  public renewMemberMonthlyFee(mid: string): SettlementBreakdown | null {
    const member = this.members.get(mid);
    if (!member) return null;
    const now = new Date();
    // 優先以其雙軌卡位節點作為清算觸發點，若無則以單軌節點
    const targetNodeId = member.binaryNodeId || member.monolineNodeId;
    const result = this.execute100PointsClosedLoopSettlement(targetNodeId, 100);

    // 同步展延名下單軌節點
    const monoNode = this.monolineNodes.get(member.monolineNodeId);
    if (monoNode) {
      const curExp = new Date(monoNode.trialExpiresAt);
      const baseTime = curExp.getTime() > now.getTime() ? curExp.getTime() : now.getTime();
      monoNode.trialExpiresAt = new Date(baseTime + 30 * 24 * 3600 * 1000).toISOString();
      monoNode.status = 'ACTIVE_RENEWED';
      monoNode.lastRenewalAt = now.toISOString();
    }
    // 同步更新會員本身的 trialExpiresAt
    const curMemExp = new Date(member.trialExpiresAt);
    const baseMemTime = curMemExp.getTime() > now.getTime() ? curMemExp.getTime() : now.getTime();
    member.trialExpiresAt = new Date(baseMemTime + 30 * 24 * 3600 * 1000).toISOString();

    this.saveState();
    return result;
  }

  /**
   * 更新會員個人通訊資料 (同步更新 CONTACT_M)
   */
  public updateMemberProfile(mid: string, updates: Partial<Member>): boolean {
    const member = this.members.get(mid);
    if (!member) return false;
    Object.assign(member, updates);

    // 若有對應 CONTACT_M，同步更新
    if (member.contactId) {
      const contact = this.contacts.get(member.contactId);
      if (contact) {
        if (updates.name) contact.name = updates.name;
        if (updates.phone) contact.phone = updates.phone;
        if (updates.tel) contact.tel = updates.tel;
        if (updates.line) contact.line = updates.line;
        if (updates.email) contact.email = updates.email;
        if (updates.address) contact.address = updates.address;
        if (updates.photoUrl) contact.photoUrl = updates.photoUrl;
        contact.updatedAt = new Date().toISOString();
      }
    }
    this.saveState();
    return true;
  }

  /**
   * 持久化儲存會員真實的 Google Drive 資料夾與 Google 試算表 ID / 連結（跨手機與桌機同步）
   */
  public updateMemberCloudVault(
    mid: string,
    vault: {
      folderId?: string;
      folderName?: string;
      folderUrl?: string;
      spreadsheetId?: string;
      spreadsheetName?: string;
      spreadsheetUrl?: string;
    }
  ): boolean {
    const normalizedMid = String(mid || '').trim().toUpperCase();
    const member = this.members.get(normalizedMid);
    if (!member) return false;
    if (vault.folderId) member.cloudFolderId = vault.folderId;
    if (vault.folderName) member.cloudFolderName = vault.folderName;
    if (vault.folderUrl) member.cloudFolderUrl = vault.folderUrl;
    if (vault.spreadsheetId) member.cloudSpreadsheetId = vault.spreadsheetId;
    if (vault.spreadsheetName) member.cloudSpreadsheetName = vault.spreadsheetName;
    if (vault.spreadsheetUrl) member.cloudSpreadsheetUrl = vault.spreadsheetUrl;
    this.saveState();
    return true;
  }

  /**
   * 取得雙軌以某節點為根的子樹結構（供視覺化使用，支援指定層深度）
   */
  public getBinarySubtree(nodeId: string = GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID, maxDepth: number = 4) {
    const root = this.binaryNodes.get(nodeId);
    if (!root) return null;

    const buildTree = (currentId: string, currentDepth: number): any => {
      const node = this.binaryNodes.get(currentId);
      if (!node) return null;

      const member = this.members.get(node.mid);
      const res: any = {
        ...node,
        memberName: member ? member.name : node.name,
        children: [] as any[],
      };

      if (currentDepth < maxDepth) {
        if (node.leftChildId) {
          const left = buildTree(node.leftChildId, currentDepth + 1);
          if (left) res.children.push(left);
        }
        if (node.rightChildId) {
          const right = buildTree(node.rightChildId, currentDepth + 1);
          if (right) res.children.push(right);
        }
      }
      return res;
    };

    return buildTree(nodeId, 0);
  }

  public getStats(): SystemStats {
    let totalCollected = 0;
    this.settlements.forEach((s) => {
      totalCollected += s.paidAmount;
    });

    return {
      totalMembers: this.members.size,
      monolineNodesCount: this.monolineNodes.size,
      binaryNodesCount: this.binaryNodes.size,
      totalSettlementsCount: this.settlements.length,
      totalRentCollected: totalCollected,
      totalPointsDistributed: totalCollected, // 100% 全額撥發
      abanyTechAccumulated: this.abanyTechAccumulated,
      hqOpsAccumulated: this.hqOpsAccumulated,
      publicSafetyAccumulated: this.publicSafetyAccumulated,
    };
  }

  public getAllMembers(): Member[] {
    return Array.from(this.members.values()).reverse();
  }

  public getMember(mid: string): Member | undefined {
    return this.members.get(mid.trim().toUpperCase());
  }

  public getMemberById(mid: string): Member | undefined {
    return this.getMember(mid);
  }

  public getAllMonolineNodes(): NodeRecord[] {
    return Array.from(this.monolineNodes.values()).reverse();
  }

  public getAllBinaryNodes(): NodeRecord[] {
    return Array.from(this.binaryNodes.values()).reverse();
  }

  public getSettlements(): SettlementBreakdown[] {
    return this.settlements;
  }

  public getNextMonolineMid(): string {
    return `A-${String(this.currentMonolineCounter + 1).padStart(5, '0')}`;
  }

  public getNextMonolineNodeId(): string {
    return `C-${String(this.currentMonolineCounter + 1).padStart(5, '0')}`;
  }

  public setMonolineCounter(val: number) {
    this.currentMonolineCounter = Math.max(0, val);
    this.saveState();
  }

  public findMemberByMidOrNode(query: string): {
    member?: Member;
    monolineNode?: NodeRecord;
    binaryNode?: NodeRecord;
  } {
    const rawQ = query.trim().toUpperCase();
    
    // 支援 A-00001 與 A-00000001 的互通智慧比對
    const normalize = (id: string) => {
      const match = id.match(/^([A-Z])-0*(\d+)$/);
      return match ? `${match[1]}-${match[2]}` : id;
    };

    const targetNorm = normalize(rawQ);

    for (const m of this.members.values()) {
      if (
        m.mid.toUpperCase() === rawQ ||
        m.monolineNodeId.toUpperCase() === rawQ ||
        m.binaryNodeId.toUpperCase() === rawQ ||
        normalize(m.mid.toUpperCase()) === targetNorm ||
        normalize(m.monolineNodeId.toUpperCase()) === targetNorm
      ) {
        return {
          member: m,
          monolineNode: this.monolineNodes.get(m.monolineNodeId),
          binaryNode: this.binaryNodes.get(m.binaryNodeId),
        };
      }
    }
    const mono = this.monolineNodes.get(rawQ);
    const bi = this.binaryNodes.get(rawQ);
    const mid = mono ? mono.mid : bi ? bi.mid : '';
    const mem = this.members.get(mid);
    return {
      member: mem,
      monolineNode: mono,
      binaryNode: bi,
    };
  }

  /**
   * 查詢會員所有節點全景報告：包含名下所有持有節點 (1+1及自營)、雙軌傘下組織分析、單軌15代互助隊列、直推體系
   */
  public getMemberFullNodeReport(query: string): MemberFullNodeReport | null {
    const found = this.findMemberByMidOrNode(query);
    if (!found || !found.member) return null;
    const member = found.member;

    // 1. 名下所有持有節點 (包含所有單軌與雙軌節點)
    const ownedMonolineNodes = Array.from(this.monolineNodes.values()).filter(
      (n) => n.mid === member.mid
    );
    const ownedBinaryNodes = Array.from(this.binaryNodes.values()).filter(
      (n) => n.mid === member.mid
    );

    // 2. 雙軌傘下二元組織分析 (以該會員主雙軌節點為根)
    const leftLegNodes: NodeRecord[] = [];
    const rightLegNodes: NodeRecord[] = [];
    let maxDepthUnder = 0;

    const mainBinary = this.binaryNodes.get(member.binaryNodeId);
    if (mainBinary) {
      const traverseSubtree = (startNodeId: string, legArray: NodeRecord[]) => {
        const queue = [startNodeId];
        const visited = new Set<string>();
        while (queue.length > 0) {
          const currId = queue.shift()!;
          if (visited.has(currId)) continue;
          visited.add(currId);
          const node = this.binaryNodes.get(currId);
          if (!node) continue;
          legArray.push(node);
          const relativeDepth = node.depth - mainBinary.depth;
          if (relativeDepth > maxDepthUnder) maxDepthUnder = relativeDepth;
          if (node.leftChildId) queue.push(node.leftChildId);
          if (node.rightChildId) queue.push(node.rightChildId);
        }
      };

      if (mainBinary.leftChildId) traverseSubtree(mainBinary.leftChildId, leftLegNodes);
      if (mainBinary.rightChildId) traverseSubtree(mainBinary.rightChildId, rightLegNodes);
    }

    // 3. 單軌公排互助鏈 (向上 15 代前席 & 向下 15 代後續席)
    const upstream15Nodes: NodeRecord[] = [];
    const downstream15Nodes: NodeRecord[] = [];
    const mainMono = this.monolineNodes.get(member.monolineNodeId);

    if (mainMono) {
      // 向上 15 代前席
      let currParent = mainMono.parentId;
      while (currParent && currParent !== 'HQ_ROOT' && upstream15Nodes.length < 15) {
        const p = this.monolineNodes.get(currParent);
        if (p) {
          upstream15Nodes.push(p);
          currParent = p.parentId;
        } else {
          break;
        }
      }

      // 向下 15 代排線互助席次 (按時間序列排在該節點後面的節點)
      const allMonoList = Array.from(this.monolineNodes.values());
      const myIndex = allMonoList.findIndex((n) => n.nodeId === mainMono.nodeId);
      if (myIndex !== -1) {
        // monolineNodes is stored in chronological order or we can sort by depth
        const sortedMono = allMonoList.slice().sort((a, b) => a.depth - b.depth);
        const sortedIdx = sortedMono.findIndex((n) => n.nodeId === mainMono.nodeId);
        if (sortedIdx !== -1) {
          const subsequent = sortedMono.slice(sortedIdx + 1, sortedIdx + 16);
          downstream15Nodes.push(...subsequent);
        }
      }
    }

    // 4. 直推體系
    const directReferralMembers = Array.from(this.members.values()).filter(
      (m) => m.sponsorMid === member.mid && m.mid !== member.mid
    );
    const upstreamSponsors: string[] = [];
    let curSponsor = member.sponsorMid;
    const visitedSponsors = new Set<string>();
    while (curSponsor && curSponsor !== 'HQ_ROOT' && upstreamSponsors.length < 15) {
      if (visitedSponsors.has(curSponsor)) break;
      visitedSponsors.add(curSponsor);
      upstreamSponsors.push(curSponsor);
      const spMember = this.members.get(curSponsor);
      curSponsor = spMember ? spMember.sponsorMid : 'HQ_ROOT';
    }

    // 5. 向下直推 15 代各代人數與 15 代總人數詳細矩陣
    const downstream15Gen = this.getMemberDownstream15GenReferrals(member.mid);

    // 6. 財務收益彙整
    let monoEarnings = 0;
    ownedMonolineNodes.forEach((n) => (monoEarnings += n.totalEarnings));
    let biEarnings = 0;
    ownedBinaryNodes.forEach((n) => (biEarnings += n.totalEarnings));

    return {
      member,
      ownedMonolineNodes,
      ownedBinaryNodes,
      totalOwnedNodesCount: ownedMonolineNodes.length + ownedBinaryNodes.length,
      binaryDownline: {
        rootNodeId: member.binaryNodeId,
        leftLegNodes,
        rightLegNodes,
        totalDownlineCount: leftLegNodes.length + rightLegNodes.length,
        maxDepthUnder,
      },
      monolineAid: {
        nodeId: member.monolineNodeId,
        upstream15Nodes,
        downstream15Nodes,
      },
      referrals: {
        directReferralMembers,
        upstreamSponsors,
      },
      downstream15Gen,
      financialSummary: {
        accumulatedRentAmount: member.accumulatedRentAmount,
        totalEarningsFromAllNodes: monoEarnings + biEarnings,
        monolineEarnings: monoEarnings,
        binaryEarnings: biEarnings,
      },
    };
  }

  /**
   * 查詢會員向下直推 15 代各代人數與 15 代總人數
   * BFS 階層遍歷：
   * 第 1 代：sponsorMid 為 targetMid 的會員
   * 第 2 代：sponsorMid 屬於第 1 代會員的會員
   * ...
   * 第 15 代：sponsorMid 屬於第 14 代會員的會員
   */
  public getMemberDownstream15GenReferrals(targetMid: string): Downstream15GenSummary {
    const generations: GenerationReferralDetail[] = [];
    const visitedMids = new Set<string>([targetMid]);
    
    // BFS 遍歷 1~15 代
    let currentLevelMids = [targetMid];
    let total15GenCount = 0;
    let maxActiveGeneration = 0;

    for (let gen = 1; gen <= 15; gen++) {
      const nextLevelMembers: Member[] = [];
      const parentMidsSet = new Set(currentLevelMids);

      if (currentLevelMids.length > 0) {
        // 在所有會員中尋找 sponsorMid 屬於當前層的直屬下線
        for (const m of this.members.values()) {
          if (m.mid === targetMid || visitedMids.has(m.mid)) continue;
          if (parentMidsSet.has(m.sponsorMid)) {
            visitedMids.add(m.mid);
            nextLevelMembers.push(m);
          }
        }
      }

      const count = nextLevelMembers.length;
      total15GenCount += count;
      if (count > 0) {
        maxActiveGeneration = gen;
      }

      generations.push({
        generation: gen,
        count,
        members: nextLevelMembers,
        potentialMonthlyBonus: count * 1.0, // 每人每月 100 元續約時回饋 1.0 點 (15% 推薦分紅)
      });

      // 下一代的母集合
      currentLevelMids = nextLevelMembers.map((m) => m.mid);
    }

    return {
      targetMid,
      generations,
      total15GenCount,
      totalPotentialMonthlyBonus: total15GenCount * 1.0,
      maxActiveGeneration,
    };
  }

  /**
   * 一鍵為目標會員模擬建立多代直推推薦組織測試鏈 (Gen 1 ~ Gen N)
   */
  public seedMultiGenReferralChain(rootMid: string, targetDepth: number = 5): Member[] {
    const createdMembers: Member[] = [];
    const sampleNames = [
      '陳志遠', '林詩涵', '張俊傑', '李雅雯', '王冠廷',
      '黃柏翰', '劉佩蓉', '蔡宗翰', '鄭又寧', '謝銘峰'
    ];
    let currentSponsor = rootMid;

    for (let d = 1; d <= targetDepth; d++) {
      const name = sampleNames[(d - 1) % sampleNames.length] + ` (第${d}代直推)`;
      const res = this.registerNewMember({
        name,
        phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
        idNumberMasked: `C${d}${Math.floor(10000000 + Math.random() * 90000000).toString().substring(0, 3)}***`,
        sponsorMid: currentSponsor,
        storeId: 'S-TAIPEI-01',
        centerId: 'EDU-GLOBAL-01',
      });
      createdMembers.push(res.member);
      // 下一代由這位新會員親推，形成深層鏈
      currentSponsor = res.member.mid;
    }

    return createdMembers;
  }

  // ================= 經營店與 6 代輔導店管理 API =================

  public getAllStores(): StoreRecord[] {
    return Array.from(this.stores.values());
  }

  public getStoreById(storeId: string): StoreRecord | undefined {
    return this.stores.get(storeId.trim().toUpperCase());
  }

  public findStoreByManagerMid(mid: string): StoreRecord | undefined {
    const raw = mid.trim().toUpperCase();
    for (const s of this.stores.values()) {
      if (s.managerMid.toUpperCase() === raw) {
        return s;
      }
    }
    return undefined;
  }

  /**
   * 查詢經營店登入詳細資料與向上/向下 6 代輔導經營店全景報告
   */
  public getStoreDetailReport(storeId: string): StoreDetailReport | null {
    const store = this.getStoreById(storeId);
    if (!store) return null;

    // 1. 向上 6 代輔導母店追溯鏈 (Upstream Mentoring Store Chain)
    const upstreamStores: StoreRecord[] = [];
    let curParentId = store.parentStoreId;
    const visitedUpstream = new Set<string>([store.storeId]);

    while (curParentId && curParentId !== 'HQ_ROOT' && upstreamStores.length < 6) {
      if (visitedUpstream.has(curParentId)) break;
      visitedUpstream.add(curParentId);
      const parent = this.stores.get(curParentId);
      if (parent) {
        upstreamStores.push(parent);
        curParentId = parent.parentStoreId;
      } else {
        break;
      }
    }

    // 2. 向下 6 代輔導子店矩陣 (BFS Downstream 6 Generations)
    const downstreamGenerations: StoreMentoringGeneration[] = [];
    let currentLevelStoreIds = [store.storeId];
    const visitedDownstream = new Set<string>([store.storeId]);
    let totalMentoredStoresCount = 0;
    let totalDownlineMembersCount = 0;

    for (let gen = 1; gen <= 6; gen++) {
      const nextLevelStores: StoreRecord[] = [];
      const parentSet = new Set(currentLevelStoreIds);

      if (currentLevelStoreIds.length > 0) {
        for (const s of this.stores.values()) {
          if (s.parentStoreId && parentSet.has(s.parentStoreId) && !visitedDownstream.has(s.storeId)) {
            visitedDownstream.add(s.storeId);
            nextLevelStores.push(s);
          }
        }
      }

      // 計算該代輔導店轄下綁定的會員總數
      let genMembersCount = 0;
      const nextStoreIdsSet = new Set(nextLevelStores.map((s) => s.storeId));
      for (const m of this.members.values()) {
        if (nextStoreIdsSet.has(m.storeId)) {
          genMembersCount++;
        }
      }

      totalMentoredStoresCount += nextLevelStores.length;
      totalDownlineMembersCount += genMembersCount;

      downstreamGenerations.push({
        generation: gen,
        count: nextLevelStores.length,
        stores: nextLevelStores,
        totalMembersInGen: genMembersCount,
        subsidyPointsEarned: nextLevelStores.reduce((acc, s) => acc + s.totalSubsidyPoints, 0),
      });

      currentLevelStoreIds = nextLevelStores.map((s) => s.storeId);
    }

    // 3. 本店直接綁定之會員名冊 (Direct Bound Members)
    const boundMembers = Array.from(this.members.values()).filter(
      (m) => m.storeId === store.storeId
    );

    // 4. 近期 6 代輔導補貼進帳紀錄 (從 settlements 取得)
    const recentSubsidyRecords: StoreDetailReport['recentSubsidyRecords'] = [];
    for (const s of this.settlements) {
      for (const sub of s.storeSubsidies) {
        if (sub.targetStoreId === store.storeId) {
          const payer = this.members.get(s.mid);
          recentSubsidyRecords.push({
            transactionId: s.transactionId,
            fromMemberMid: s.mid,
            fromMemberName: payer ? payer.name : '會員',
            fromStoreId: payer ? payer.storeId : '未知店鋪',
            generation: sub.generation,
            points: sub.points,
            timestamp: s.timestamp,
          });
          if (recentSubsidyRecords.length >= 20) break;
        }
      }
      if (recentSubsidyRecords.length >= 20) break;
    }

    return {
      store,
      upstreamStores,
      downstreamGenerations,
      totalMentoredStoresCount,
      totalDownlineMembersCount,
      estimatedMonthlySubsidy: totalDownlineMembersCount * 1.0,
      boundMembers,
      recentSubsidyRecords,
    };
  }

  /**
   * 加盟成立新的輔導經營店
   */
  public registerNewStore(params: {
    storeId: string;
    name: string;
    managerMid: string;
    managerName: string;
    phone: string;
    address: string;
    parentStoreId?: string;
  }): StoreRecord {
    const rawId = params.storeId.trim().toUpperCase();
    const finalId = rawId.startsWith('S-') ? rawId : `S-${rawId}`;

    const newStore: StoreRecord = {
      storeId: finalId,
      name: params.name.trim(),
      managerMid: params.managerMid.trim().toUpperCase(),
      managerName: params.managerName.trim(),
      phone: params.phone.trim(),
      address: params.address.trim(),
      parentStoreId: params.parentStoreId || 'S-HQ-01',
      establishedAt: new Date().toISOString(),
      status: 'ACTIVE',
      totalSubsidyPoints: 0,
      balance: 0,
    };

    this.stores.set(finalId, newStore);
    this.saveState();
    return newStore;
  }

  // ================= 教育中心與 6 代培訓中心管理 API =================

  public getAllCenters(): EducationCenterRecord[] {
    return Array.from(this.centers.values());
  }

  public getCenterById(centerId: string): EducationCenterRecord | undefined {
    return this.centers.get(centerId.trim().toUpperCase());
  }

  public findCenterByDirectorMid(mid: string): EducationCenterRecord | undefined {
    const raw = mid.trim().toUpperCase();
    for (const c of this.centers.values()) {
      if (c.directorMid.toUpperCase() === raw) {
        return c;
      }
    }
    return undefined;
  }

  /**
   * 查詢教育中心登入詳細資料與向上/向下 6 代培育中心全景報告
   */
  public getCenterDetailReport(centerId: string): CenterDetailReport | null {
    const center = this.getCenterById(centerId);
    if (!center) return null;

    // 1. 向上 6 代培育母中心追溯鏈 (Upstream Mentoring Center Chain)
    const upstreamCenters: EducationCenterRecord[] = [];
    let curParentId = center.parentCenterId;
    const visitedUpstream = new Set<string>([center.centerId]);

    while (curParentId && curParentId !== 'HQ_ROOT' && upstreamCenters.length < 6) {
      if (visitedUpstream.has(curParentId)) break;
      visitedUpstream.add(curParentId);
      const parent = this.centers.get(curParentId);
      if (parent) {
        upstreamCenters.push(parent);
        curParentId = parent.parentCenterId;
      } else {
        break;
      }
    }

    // 2. 向下 6 代培育子中心矩陣 (BFS Downstream 6 Generations)
    const downstreamGenerations: CenterTrainingGeneration[] = [];
    let currentLevelCenterIds = [center.centerId];
    const visitedDownstream = new Set<string>([center.centerId]);
    let totalMentoredCentersCount = 0;
    let totalDownlineMembersCount = 0;

    for (let gen = 1; gen <= 6; gen++) {
      const nextLevelCenters: EducationCenterRecord[] = [];
      const parentSet = new Set(currentLevelCenterIds);

      if (currentLevelCenterIds.length > 0) {
        for (const c of this.centers.values()) {
          if (c.parentCenterId && parentSet.has(c.parentCenterId) && !visitedDownstream.has(c.centerId)) {
            visitedDownstream.add(c.centerId);
            nextLevelCenters.push(c);
          }
        }
      }

      // 計算該代中心轄下學員/會員總數
      let genMembersCount = 0;
      const nextCenterIdsSet = new Set(nextLevelCenters.map((c) => c.centerId));
      for (const m of this.members.values()) {
        if (nextCenterIdsSet.has(m.centerId)) {
          genMembersCount++;
        }
      }

      totalMentoredCentersCount += nextLevelCenters.length;
      totalDownlineMembersCount += genMembersCount;

      downstreamGenerations.push({
        generation: gen,
        count: nextLevelCenters.length,
        centers: nextLevelCenters,
        totalMembersInGen: genMembersCount,
        subsidyPointsEarned: nextLevelCenters.reduce((acc, c) => acc + c.totalSubsidyPoints, 0),
      });

      currentLevelCenterIds = nextLevelCenters.map((c) => c.centerId);
    }

    // 3. 本中心直轄綁定學員/會員名冊 (Direct Bound Members)
    const boundMembers = Array.from(this.members.values()).filter(
      (m) => m.centerId === center.centerId
    );

    // 4. 近期 6 代培訓補貼進帳紀錄 (從 settlements 取得)
    const recentSubsidyRecords: CenterDetailReport['recentSubsidyRecords'] = [];
    for (const s of this.settlements) {
      for (const sub of s.centerSubsidies) {
        if (sub.targetCenterId === center.centerId) {
          const payer = this.members.get(s.mid);
          recentSubsidyRecords.push({
            transactionId: s.transactionId,
            fromMemberMid: s.mid,
            fromMemberName: payer ? payer.name : '學員',
            fromCenterId: payer ? payer.centerId : '未知中心',
            generation: sub.generation,
            points: sub.points,
            timestamp: s.timestamp,
          });
          if (recentSubsidyRecords.length >= 20) break;
        }
      }
      if (recentSubsidyRecords.length >= 20) break;
    }

    return {
      center,
      upstreamCenters,
      downstreamGenerations,
      totalMentoredCentersCount,
      totalDownlineMembersCount,
      estimatedMonthlySubsidy: totalDownlineMembersCount * 1.0,
      boundMembers,
      recentSubsidyRecords,
    };
  }

  /**
   * 拓點成立新的教育培訓中心
   */
  public registerNewCenter(params: {
    centerId: string;
    name: string;
    directorMid: string;
    directorName: string;
    phone: string;
    address: string;
    parentCenterId?: string;
  }): EducationCenterRecord {
    const rawId = params.centerId.trim().toUpperCase();
    const finalId = rawId.startsWith('EDU-') ? rawId : `EDU-${rawId}`;

    const newCenter: EducationCenterRecord = {
      centerId: finalId,
      name: params.name.trim(),
      directorMid: params.directorMid.trim().toUpperCase(),
      directorName: params.directorName.trim(),
      phone: params.phone.trim(),
      address: params.address.trim(),
      parentCenterId: params.parentCenterId || 'EDU-HQ-01',
      establishedAt: new Date().toISOString(),
      status: 'ACTIVE',
      totalSubsidyPoints: 0,
      balance: 0,
    };

    this.centers.set(finalId, newCenter);
    this.saveState();
    return newCenter;
  }

  // ================= 模擬自動批次清算 API =================

  /**
   * 模擬自動批次清算：允許選擇特定節點區間或條件，一次性計算並更新多個帳戶的獎勵分潤
   */
  public executeBatchSettlement(params: {
    nodeIds: string[];
    rentAmountPerNode?: number;
    simulateExpired?: boolean;
  }): {
    successCount: number;
    totalAmountCollected: number;
    totalPointsDistributed: number;
    breakdowns: SettlementBreakdown[];
  } {
    const rentAmount = params.rentAmountPerNode || 100;
    const breakdowns: SettlementBreakdown[] = [];
    let totalCollected = 0;
    let totalDistributed = 0;

    for (const nodeId of params.nodeIds) {
      try {
        if (params.simulateExpired) {
          const node = this.binaryNodes.get(nodeId) || this.monolineNodes.get(nodeId);
          if (node) {
            node.trialExpiresAt = new Date(Date.now() - 3600000).toISOString();
          }
        }
        const b = this.execute100PointsClosedLoopSettlement(nodeId, rentAmount);
        breakdowns.push(b);
        totalCollected += b.paidAmount;
        totalDistributed += b.totalDistributed;
      } catch {
        // Skip invalid nodes in batch
      }
    }

    this.saveState();

    return {
      successCount: breakdowns.length,
      totalAmountCollected: totalCollected,
      totalPointsDistributed: totalDistributed,
      breakdowns,
    };
  }

  // ================= 1. 通訊錄 CRM 管理 API =================

  /**
   * 取得所有通訊主檔 (CONTACT_M / CM-)
   */
  public getAllContacts(): ContactMasterRecord[] {
    return Array.from(this.contacts.values()).reverse();
  }

  public getContactById(id: string): ContactMasterRecord | undefined {
    return this.contacts.get(id.trim().toUpperCase());
  }

  public addContact(record: {
    name: string;
    phone: string;
    tel?: string;
    line?: string;
    email?: string;
    address?: string;
    photoUrl?: string;
    status?: string;
    memberMid?: string;
    ownerMid?: string;
    monolineNodeId?: string;
    binaryNodeId?: string;
  }): ContactMasterRecord {
    this.currentContactCounter += 1;
    const id = `CM-${String(this.currentContactCounter).padStart(5, '0')}`;
    const newContact: ContactMasterRecord = {
      id,
      status: record.status || '開通AI軟體1+1',
      name: record.name.trim(),
      phone: record.phone.trim(),
      tel: record.tel?.trim() || '02-8888-7777',
      line: record.line?.trim() || record.name.trim() + '_line',
      email: record.email?.trim() || `${id.toLowerCase()}@ai-saas.tw`,
      address: record.address?.trim() || '台灣生活圈',
      photoUrl: record.photoUrl?.trim() || DEFAULT_SHEET_PHOTO_URL,
      updatedAt: new Date().toISOString(),
      memberMid: record.memberMid,
      ownerMid: record.ownerMid || record.memberMid,
      monolineNodeId: record.monolineNodeId,
      binaryNodeId: record.binaryNodeId,
    };

    this.contacts.set(id, newContact);
    this.saveState();
    return newContact;
  }

  public updateContact(id: string, updates: Partial<ContactMasterRecord>): ContactMasterRecord | null {
    const existing = this.contacts.get(id);
    if (!existing) return null;
    Object.assign(existing, updates, { updatedAt: new Date().toISOString() });
    this.saveState();
    return existing;
  }

  /**
   * 取得所有聯繫紀錄 (CONTACT_T / CT-)
   */
  public getAllContactTrackings(): ContactTrackingRecord[] {
    return Array.from(this.contactTrackings.values()).reverse();
  }

  public getContactTrackingById(id: string): ContactTrackingRecord | undefined {
    return this.contactTrackings.get(id.trim().toUpperCase());
  }

  public addContactTracking(record: {
    name: string;
    contactDate?: string;
    contactMethod?: string;
    discussionContent: string;
    nextStepPlan: string;
    photoUrl?: string;
    status?: string;
    contactId?: string;
    memberMid?: string;
    ownerMid?: string;
  }): ContactTrackingRecord {
    this.currentTrackingCounter += 1;
    const id = `CT-${String(this.currentTrackingCounter).padStart(5, '0')}`;
    const newTracking: ContactTrackingRecord = {
      id,
      status: record.status || '已完成',
      name: record.name.trim(),
      contactDate: record.contactDate || new Date().toISOString().split('T')[0],
      contactMethod: record.contactMethod || '線上開通',
      discussionContent: record.discussionContent.trim(),
      nextStepPlan: record.nextStepPlan.trim(),
      photoUrl: record.photoUrl?.trim() || DEFAULT_SHEET_PHOTO_URL,
      updatedAt: new Date().toISOString(),
      contactId: record.contactId,
      memberMid: record.memberMid,
      ownerMid: record.ownerMid || record.memberMid,
    };

    this.contactTrackings.set(id, newTracking);
    this.saveState();
    return newTracking;
  }

  public updateContactTracking(
    id: string,
    updates: Partial<ContactTrackingRecord>
  ): ContactTrackingRecord | null {
    const existing = this.contactTrackings.get(id);
    if (!existing) return null;
    Object.assign(existing, updates, { updatedAt: new Date().toISOString() });
    this.saveState();
    return existing;
  }

  // ================= 2. 活動行銷管理 API =================

  /**
   * 取得所有活動主檔 (EVENT_M / EM-)
   */
  public getAllEvents(): EventMasterRecord[] {
    return Array.from(this.events.values()).reverse();
  }

  public addEvent(record: {
    eventTheme: string;
    date: string;
    location: string;
    budget: number | string;
    leader: string;
    notes?: string;
    photoUrl?: string;
    status?: string;
  }): EventMasterRecord {
    this.currentEventCounter += 1;
    const id = `EM-${String(this.currentEventCounter).padStart(5, '0')}`;
    const newEvent: EventMasterRecord = {
      id,
      status: record.status || '報名中',
      eventTheme: record.eventTheme.trim(),
      date: record.date.trim(),
      location: record.location.trim(),
      budget: record.budget,
      leader: record.leader.trim(),
      notes: record.notes?.trim() || '',
      photoUrl: record.photoUrl?.trim() || DEFAULT_SHEET_PHOTO_URL,
      updatedAt: new Date().toISOString(),
      participantsCount: 0,
    };

    this.events.set(id, newEvent);
    this.saveState();
    return newEvent;
  }

  public updateEvent(id: string, updates: Partial<EventMasterRecord>): EventMasterRecord | null {
    const existing = this.events.get(id);
    if (!existing) return null;
    Object.assign(existing, updates, { updatedAt: new Date().toISOString() });
    this.saveState();
    return existing;
  }

  /**
   * 取得所有活動花絮 (EVENT_T / ET-)
   */
  public getAllEventTrackings(): EventTrackingRecord[] {
    return Array.from(this.eventTrackings.values()).reverse();
  }

  public addEventTracking(record: {
    eventTheme: string;
    photoTitle: string;
    shootLocation: string;
    contentNotes: string;
    photoUrl: string;
    status?: string;
    eventId?: string;
  }): EventTrackingRecord {
    this.currentEventTrackingCounter += 1;
    const id = `ET-${String(this.currentEventTrackingCounter).padStart(5, '0')}`;
    const newHighlight: EventTrackingRecord = {
      id,
      status: record.status || '公開發布',
      eventTheme: record.eventTheme.trim(),
      photoTitle: record.photoTitle.trim(),
      shootLocation: record.shootLocation.trim(),
      contentNotes: record.contentNotes.trim(),
      photoUrl: record.photoUrl.trim() || DEFAULT_SHEET_PHOTO_URL,
      updatedAt: new Date().toISOString(),
      eventId: record.eventId,
    };

    this.eventTrackings.set(id, newHighlight);
    this.saveState();
    return newHighlight;
  }

  public updateEventTracking(
    id: string,
    updates: Partial<EventTrackingRecord>
  ): EventTrackingRecord | null {
    const existing = this.eventTrackings.get(id);
    if (!existing) return null;
    Object.assign(existing, updates, { updatedAt: new Date().toISOString() });
    this.saveState();
    return existing;
  }

  // ================= 3. 四大系統角色登入與身分驗證 API =================

  public getHqStaffAccounts(): HqStaffAccount[] {
    return Array.from(this.hqStaffs.values());
  }

  public authenticateRole(
    role: UserRole,
    identifier: string,
    _passcode?: string
  ): { success: boolean; session?: AuthSession; error?: string } {
    const q = identifier.trim();
    if (!q) {
      return { success: false, error: '請輸入帳號 / 專屬編號' };
    }
    const nowIso = new Date().toISOString();

    if (role === 'HQ_STAFF') {
      const staff =
        this.hqStaffs.get(q.toUpperCase()) ||
        Array.from(this.hqStaffs.values()).find((s) => s.name === q);
      if (!staff) {
        return { success: false, error: '帳號或安全驗證密碼不正確' };
      }
      return {
        success: true,
        session: {
          role: 'HQ_STAFF',
          userId: staff.staffId,
          displayName: staff.name,
          title: `${staff.department} · ${staff.title}`,
          scopeLabel: '總部全網營運管控與稽核權限',
          loginAt: nowIso,
        },
      };
    }

    if (role === 'MEMBER') {
      let member = this.findMemberByMidOrNode(q).member;
      if (!member) {
        member = Array.from(this.members.values()).find(
          (m) => m.phone === q || m.name === q || (m.line && m.line.toLowerCase() === q.toLowerCase())
        );
      }
      if (!member) {
        return { success: false, error: '帳號或安全驗證密碼不正確' };
      }
      return {
        success: true,
        session: {
          role: 'MEMBER',
          userId: member.mid,
          displayName: member.name,
          title: `一般會員 (${member.mid})`,
          scopeLabel: '僅顯示個人專屬授權模組、個人預約系統與個人紀錄',
          loginAt: nowIso,
        },
      };
    }

    if (role === 'STORE') {
      let store = this.getStoreById(q);
      if (!store) store = this.findStoreByManagerMid(q);
      if (!store) {
        store = Array.from(this.stores.values()).find((s) => s.name.includes(q));
      }
      if (!store) {
        return { success: false, error: '帳號或安全驗證密碼不正確' };
      }
      return {
        success: true,
        session: {
          role: 'STORE',
          userId: store.storeId,
          displayName: store.name,
          title: `店長: ${store.managerName} (${store.storeId})`,
          scopeLabel: `僅顯示 ${store.storeId} 本店專屬管理視圖與輔導補貼明細`,
          loginAt: nowIso,
        },
      };
    }

    if (role === 'CENTER') {
      let center = this.getCenterById(q);
      if (!center) center = this.findCenterByDirectorMid(q);
      if (!center) {
        center = Array.from(this.centers.values()).find((c) => c.name.includes(q));
      }
      if (!center) {
        return { success: false, error: '帳號或安全驗證密碼不正確' };
      }
      return {
        success: true,
        session: {
          role: 'CENTER',
          userId: center.centerId,
          displayName: center.name,
          title: `中心主任: ${center.directorName} (${center.centerId})`,
          scopeLabel: `僅顯示 ${center.centerId} 培訓中心學員、活動規劃與中心補貼明細`,
          loginAt: nowIso,
        },
      };
    }

    return { success: false, error: '不支援的登入系統類型' };
  }

  // ================= 4. 第 3 種 AI 系統：個人預約系統 (30天免費體驗 · 月租100元) =================

  public getBookingProfile(ownerMid: string): BookingProfile | null {
    const key = ownerMid.trim().toUpperCase();
    const profile = this.bookingProfiles.get(key);
    if (!profile) return null;

    // 檢查是否過期
    if (profile.expiresAt && new Date(profile.expiresAt).getTime() < Date.now() && profile.status !== 'EXPIRED_FROZEN') {
      profile.status = 'EXPIRED_FROZEN';
    }
    return profile;
  }

  public activateBookingTrial(
    ownerMid: string,
    options?: { allocateBinaryNode?: boolean }
  ): BookingProfile {
    const key = ownerMid.trim().toUpperCase();
    const existing = this.bookingProfiles.get(key);
    const now = new Date();
    const trialExp = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();

    if (existing) {
      let changed = false;
      if (existing.status === 'NOT_ACTIVATED') {
        existing.status = 'TRIAL_ACTIVE';
        existing.activatedAt = now.toISOString();
        existing.expiresAt = trialExp;
        changed = true;
      }
      if (options?.allocateBinaryNode && !existing.binaryNodeId) {
        const allocated = this.allocateBinaryNodeForSoftware({
          memberMid: key,
          softwareKey: 'BOOKING',
          softwareTitle: '個人預約系統',
          status: existing.status === 'ACTIVE_RENEWED' ? 'ACTIVE_RENEWED' : 'TRIAL_ACTIVE',
          expiresAt: existing.expiresAt || trialExp,
          executeSettlement: false,
        });
        existing.binaryNodeId = allocated.binaryNode.nodeId;
        changed = true;
      }
      if (changed) this.saveState();
      return existing;
    }

    const member = this.getMember(key);
    const ownerName = member ? member.name : key;
    this.currentBookingLicenseCounter += 1;
    const licenseId = `BK-${String(this.currentBookingLicenseCounter).padStart(5, '0')}`;

    let boundBinaryNodeId: string | undefined;
    if (options?.allocateBinaryNode) {
      const allocated = this.allocateBinaryNodeForSoftware({
        memberMid: key,
        softwareKey: 'BOOKING',
        softwareTitle: '個人預約系統',
        status: 'TRIAL_ACTIVE',
        expiresAt: trialExp,
        executeSettlement: false,
      });
      boundBinaryNodeId = allocated.binaryNode.nodeId;
    }

    const created: BookingProfile = {
      licenseId,
      ownerMid: key,
      ownerName,
      displayTitle: `${ownerName} 的 AI 個人專屬預約中心`,
      bio: `歡迎預約【${ownerName}】專屬線上與實體諮詢時段！本系統為第 3 種 AI 系統（30 天免費體驗 · 月租 100 元閉環授權）。`,
      status: 'TRIAL_ACTIVE',
      activatedAt: now.toISOString(),
      expiresAt: trialExp,
      monthlyRentNtd: 100,
      totalRenewalsCount: 0,
      workingDays: [1, 2, 3, 4, 5],
      startHour: 9,
      endHour: 19,
      slotIntervalMinutes: 60,
      binaryNodeId: boundBinaryNodeId,
      services: [
        {
          id: `SRV-${Date.now().toString().slice(-4)}1`,
          title: 'AI 軟體 1+1 與個人預約系統導覽 (30天體驗)',
          durationMinutes: 45,
          priceNtd: 0,
          description: '說明產銷合一 3 大 AI 軟體系統運作與 30 天免費開通體驗。',
          isActive: true,
          locationType: 'ONLINE_MEET',
        },
        {
          id: `SRV-${Date.now().toString().slice(-4)}2`,
          title: '合作夥伴一對一專案對接',
          durationMinutes: 60,
          priceNtd: 0,
          description: '客製化產品導入或組織營運輔導洽談。',
          isActive: true,
          locationType: 'IN_PERSON',
        },
      ],
    };

    this.bookingProfiles.set(key, created);
    this.saveState();
    return created;
  }

  public renewBookingMonthlyFee(
    ownerMid: string,
    options?: { forceNewSlot?: boolean }
  ): {
    profile: BookingProfile;
    settlement: SettlementBreakdown;
    binaryNode: NodeRecord;
    isNewBinaryNode: boolean;
  } {
    const key = ownerMid.trim().toUpperCase();
    let profile = this.bookingProfiles.get(key);
    if (!profile) {
      profile = this.activateBookingTrial(key, { allocateBinaryNode: true });
    }

    const allocated = this.allocateBinaryNodeForSoftware({
      memberMid: key,
      softwareKey: 'BOOKING',
      softwareTitle: '個人預約系統',
      existingBinaryNodeId: options?.forceNewSlot ? undefined : profile.binaryNodeId,
      forceNewSlot: Boolean(options?.forceNewSlot),
      expiresAt: profile.expiresAt,
      executeSettlement: true,
    });

    if (!profile.binaryNodeId) {
      profile.binaryNodeId = allocated.binaryNode.nodeId;
    }

    profile.expiresAt = allocated.binaryNode.trialExpiresAt;
    profile.status = 'ACTIVE_RENEWED';
    profile.totalRenewalsCount += 1;

    this.saveState();
    return {
      profile,
      settlement: allocated.settlement!,
      binaryNode: allocated.binaryNode,
      isNewBinaryNode: allocated.isNewlyAllocated,
    };
  }

  public updateBookingProfile(ownerMid: string, updates: Partial<BookingProfile>): BookingProfile | null {
    const profile = this.bookingProfiles.get(ownerMid.trim().toUpperCase());
    if (!profile) return null;
    Object.assign(profile, updates);
    this.saveState();
    return profile;
  }

  public addBookingService(ownerMid: string, service: Omit<BookingServiceItem, 'id'>): BookingServiceItem | null {
    const profile = this.bookingProfiles.get(ownerMid.trim().toUpperCase());
    if (!profile) return null;
    const newSrv: BookingServiceItem = {
      ...service,
      id: `SRV-${Date.now().toString().slice(-5)}`,
    };
    profile.services.push(newSrv);
    this.saveState();
    return newSrv;
  }

  public toggleBookingService(ownerMid: string, serviceId: string): boolean {
    const profile = this.bookingProfiles.get(ownerMid.trim().toUpperCase());
    if (!profile) return false;
    const srv = profile.services.find((s) => s.id === serviceId);
    if (!srv) return false;
    srv.isActive = !srv.isActive;
    this.saveState();
    return true;
  }

  public deleteBookingService(ownerMid: string, serviceId: string): boolean {
    const profile = this.bookingProfiles.get(ownerMid.trim().toUpperCase());
    if (!profile) return false;
    const before = profile.services.length;
    profile.services = profile.services.filter((s) => s.id !== serviceId);
    if (profile.services.length !== before) {
      this.saveState();
      return true;
    }
    return false;
  }

  public getAppointmentsByOwner(ownerMid: string): BookingAppointment[] {
    const key = ownerMid.trim().toUpperCase();
    return Array.from(this.bookingAppointments.values())
      .filter((a) => a.ownerMid === key)
      .reverse();
  }

  public getAllAppointments(): BookingAppointment[] {
    return Array.from(this.bookingAppointments.values()).reverse();
  }

  public createAppointment(params: {
    ownerMid: string;
    serviceId?: string;
    date: string;
    timeSlot: string;
    clientName: string;
    clientPhone: string;
    clientTel?: string;
    clientLine?: string;
    reason?: string;
    notes?: string;
    detail?: string;
  }): BookingAppointment {
    const key = params.ownerMid.trim().toUpperCase();
    const profile = this.bookingProfiles.get(key) || this.activateBookingTrial(key);
    const srv = params.serviceId
      ? profile.services.find((s) => s.id === params.serviceId)
      : profile.services.find((s) => s.isActive) || profile.services[0];

    this.currentAppointmentCounter += 1;
    const appointmentId = `APT-${String(this.currentAppointmentCounter).padStart(5, '0')}`;

    const reasonText = params.reason?.trim() || '';
    const detailText = params.detail?.trim() || '';
    const notesText = params.notes?.trim() || '';

    const apt: BookingAppointment = {
      appointmentId,
      ownerMid: key,
      licenseId: profile.licenseId,
      serviceId: srv ? srv.id : params.serviceId || 'CUSTOM',
      serviceTitle: reasonText || (srv ? srv.title : '專屬諮詢預約'),
      date: params.date,
      timeSlot: params.timeSlot,
      clientName: params.clientName.trim(),
      clientPhone: params.clientPhone.trim(),
      clientTel: params.clientTel?.trim() || undefined,
      clientLine: params.clientLine?.trim() || undefined,
      reason: reasonText || undefined,
      notes: notesText || undefined,
      detail: detailText || undefined,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    this.bookingAppointments.set(appointmentId, apt);

    // 同步寫入聯繫紀錄 CONTACT_T (CRM 連動)
    const summaryParts = [
      reasonText ? `事由：${reasonText}` : '',
      notesText ? `備註：${notesText}` : '',
      detailText ? `詳細情況：${detailText}` : '',
    ].filter(Boolean);

    this.addContactTracking({
      name: apt.clientName,
      contactDate: apt.date,
      contactMethod: 'AI個人預約系統',
      status: '待確認預約',
      discussionContent: `透過 ${profile.ownerName} (${profile.licenseId}) 個人預約系統預約【${apt.serviceTitle}】時段 ${apt.date} ${apt.timeSlot}。${summaryParts.length > 0 ? summaryParts.join(' · ') : '無額外備註'}`,
      nextStepPlan: `確認客戶 (${apt.clientPhone || apt.clientTel || '未留電話'}) 預約時段並進行一對一服務／體驗導覽`,
      memberMid: key,
    });

    this.saveState();
    return apt;
  }

  public updateAppointmentStatus(
    appointmentId: string,
    status: BookingAppointment['status'],
    convertedMid?: string
  ): boolean {
    const apt = this.bookingAppointments.get(appointmentId);
    if (!apt) return false;
    apt.status = status;
    if (convertedMid) apt.convertedToMemberMid = convertedMid;
    this.saveState();
    return true;
  }

  public getAllBookingsSummary() {
    const profiles = Array.from(this.bookingProfiles.values());
    const appointments = Array.from(this.bookingAppointments.values());
    return {
      totalActivatedProfiles: profiles.length,
      activeTrials: profiles.filter((p) => p.status === 'TRIAL_ACTIVE').length,
      activePaid: profiles.filter((p) => p.status === 'ACTIVE_RENEWED').length,
      expiredCount: profiles.filter((p) => p.status === 'EXPIRED_FROZEN').length,
      totalAppointments: appointments.length,
      pendingAppointments: appointments.filter((a) => a.status === 'PENDING').length,
      profiles,
    };
  }

  /**
   * 匯出核心帳務與組織快照（供每日午夜 JSON 備份與點對點還原使用）
   */
  public exportCoreLedgerSnapshot() {
    return {
      schemaVersion: '2.0',
      exportedAt: new Date().toISOString(),
      members: Array.from(this.members.entries()),
      monolineNodes: Array.from(this.monolineNodes.entries()),
      binaryNodes: Array.from(this.binaryNodes.entries()),
      stores: Array.from(this.stores.entries()),
      centers: Array.from(this.centers.entries()),
      contacts: Array.from(this.contacts.entries()),
      contactTrackings: Array.from(this.contactTrackings.entries()),
      events: Array.from(this.events.entries()),
      eventTrackings: Array.from(this.eventTrackings.entries()),
      bookingProfiles: Array.from(this.bookingProfiles.entries()),
      bookingAppointments: Array.from(this.bookingAppointments.entries()),
      settlements: [...this.settlements],
      counters: {
        currentMonolineCounter: this.currentMonolineCounter,
        currentBinaryCounter: this.currentBinaryCounter,
        currentContactCounter: this.currentContactCounter,
        currentTrackingCounter: this.currentTrackingCounter,
        currentEventCounter: this.currentEventCounter,
        currentEventTrackingCounter: this.currentEventTrackingCounter,
        currentBookingLicenseCounter: this.currentBookingLicenseCounter,
        currentAppointmentCounter: this.currentAppointmentCounter,
      },
      pools: {
        publicSafetyAccumulated: this.publicSafetyAccumulated,
        abanyTechAccumulated: this.abanyTechAccumulated,
        hqOpsAccumulated: this.hqOpsAccumulated,
      },
    };
  }

  /**
   * 點對點還原 (Point-in-Time Restore)：從 JSON 備份快照完整恢復核心帳務、節點與池帳餘額
   */
  public restoreCoreLedgerSnapshot(snapshot: {
    members?: Array<[string, Member]>;
    monolineNodes?: Array<[string, NodeRecord]>;
    binaryNodes?: Array<[string, NodeRecord]>;
    stores?: Array<[string, StoreRecord]>;
    centers?: Array<[string, EducationCenterRecord]>;
    contacts?: Array<[string, ContactMasterRecord]>;
    contactTrackings?: Array<[string, ContactTrackingRecord]>;
    events?: Array<[string, EventMasterRecord]>;
    eventTrackings?: Array<[string, EventTrackingRecord]>;
    bookingProfiles?: Array<[string, BookingProfile]>;
    bookingAppointments?: Array<[string, BookingAppointment]>;
    settlements?: SettlementBreakdown[];
    counters?: Record<string, number>;
    pools?: {
      publicSafetyAccumulated?: number;
      abanyTechAccumulated?: number;
      hqOpsAccumulated?: number;
    };
  }): {
    members: number;
    monolineNodes: number;
    binaryNodes: number;
    settlements: number;
  } {
    if (!snapshot || !Array.isArray(snapshot.members) || !Array.isArray(snapshot.binaryNodes)) {
      throw new Error('備份 JSON 結構無效：缺少 members 或 binaryNodes 核心帳務欄位');
    }

    this.members = new Map(snapshot.members);
    this.monolineNodes = new Map(snapshot.monolineNodes || []);
    this.binaryNodes = new Map(snapshot.binaryNodes);
    if (Array.isArray(snapshot.stores)) this.stores = new Map(snapshot.stores);
    if (Array.isArray(snapshot.centers)) this.centers = new Map(snapshot.centers);
    if (Array.isArray(snapshot.contacts)) this.contacts = new Map(snapshot.contacts);
    if (Array.isArray(snapshot.contactTrackings)) this.contactTrackings = new Map(snapshot.contactTrackings);
    if (Array.isArray(snapshot.events)) this.events = new Map(snapshot.events);
    if (Array.isArray(snapshot.eventTrackings)) this.eventTrackings = new Map(snapshot.eventTrackings);
    if (Array.isArray(snapshot.bookingProfiles)) this.bookingProfiles = new Map(snapshot.bookingProfiles);
    if (Array.isArray(snapshot.bookingAppointments)) this.bookingAppointments = new Map(snapshot.bookingAppointments);
    this.settlements = Array.isArray(snapshot.settlements) ? [...snapshot.settlements] : [];

    if (snapshot.counters) {
      this.currentMonolineCounter = Math.max(
        GLOBAL_BOUNDARIES.HQ_LOCKED_MAX_SEQ,
        Number(snapshot.counters.currentMonolineCounter ?? this.members.size)
      );
      this.currentBinaryCounter = Math.max(
        25000000 + GLOBAL_BOUNDARIES.HQ_LOCKED_MAX_SEQ,
        Number(snapshot.counters.currentBinaryCounter ?? 25000063)
      );
      this.currentContactCounter = Number(snapshot.counters.currentContactCounter ?? this.contacts.size);
      this.currentTrackingCounter = Number(snapshot.counters.currentTrackingCounter ?? this.contactTrackings.size);
      this.currentEventCounter = Number(snapshot.counters.currentEventCounter ?? this.events.size);
      this.currentEventTrackingCounter = Number(snapshot.counters.currentEventTrackingCounter ?? this.eventTrackings.size);
      this.currentBookingLicenseCounter = Number(snapshot.counters.currentBookingLicenseCounter ?? this.bookingProfiles.size);
      this.currentAppointmentCounter = Number(snapshot.counters.currentAppointmentCounter ?? this.bookingAppointments.size);
    }

    if (snapshot.pools) {
      this.publicSafetyAccumulated = Number(snapshot.pools.publicSafetyAccumulated ?? 0);
      this.abanyTechAccumulated = Number(snapshot.pools.abanyTechAccumulated ?? 0);
      this.hqOpsAccumulated = Number(snapshot.pools.hqOpsAccumulated ?? 0);
    }

    this.saveState();
    return {
      members: this.members.size,
      monolineNodes: this.monolineNodes.size,
      binaryNodes: this.binaryNodes.size,
      settlements: this.settlements.length,
    };
  }

  /**
   * 嚴格角色權限過濾快照：
   * 只回傳當前登入身分有權存取的資料，總部機密數據、其他會員私人資料與獎金池絕對不回傳給非總部角色。
   */
  public getScopedBootstrap(session: AuthSession) {
    if (session.role === 'HQ_STAFF') {
      return {
        role: session.role,
        stats: this.getStats(),
        snapshot: this.exportCoreLedgerSnapshot(),
      };
    }

    if (session.role === 'MEMBER') {
      const selfMid = session.userId.toUpperCase();
      const selfMember = this.members.get(selfMid);
      const allowedMids = new Set<string>([selfMid]);
      if (selfMember?.sponsorMid) allowedMids.add(selfMember.sponsorMid);

      // Include direct & 15-gen downline members that appear in this member's organization report
      const report = this.getMemberFullNodeReport(selfMid);
      if (report) {
        report.referrals.directReferralMembers.forEach((d) => allowedMids.add(d.mid));
        report.downstream15Gen.generations.forEach((g) => {
          g.members.forEach((gm) => allowedMids.add(gm.mid));
        });
      }

      const scopedMembers: Array<[string, Member]> = [];
      allowedMids.forEach((mid) => {
        const m = this.members.get(mid);
        if (m) {
          // Redact third-party sensitive info when not self
          if (mid === selfMid) {
            scopedMembers.push([mid, m]);
          } else {
            scopedMembers.push([
              mid,
              {
                ...m,
                phone: m.phone ? `${m.phone.slice(0, 4)}***${m.phone.slice(-2)}` : '',
                idNumberMasked: '***REDACTED***',
                email: undefined,
                address: undefined,
                cloudFolderUrl: undefined,
                cloudSpreadsheetUrl: undefined,
              },
            ]);
          }
        }
      });

      const allowedNodeIds = new Set<string>();
      scopedMembers.forEach(([, m]) => {
        if (m.monolineNodeId) allowedNodeIds.add(m.monolineNodeId);
        if (m.binaryNodeId) allowedNodeIds.add(m.binaryNodeId);
      });
      report?.ownedBinaryNodes.forEach((n) => allowedNodeIds.add(n.nodeId));
      report?.ownedMonolineNodes.forEach((n) => allowedNodeIds.add(n.nodeId));

      const scopedMonoNodes: Array<[string, NodeRecord]> = [];
      const scopedBiNodes: Array<[string, NodeRecord]> = [];
      allowedNodeIds.forEach((nid) => {
        const mn = this.monolineNodes.get(nid);
        if (mn) scopedMonoNodes.push([nid, mn]);
        const bn = this.binaryNodes.get(nid);
        if (bn) scopedBiNodes.push([nid, bn]);
      });

      const scopedStores: Array<[string, StoreRecord]> = [];
      if (selfMember?.storeId && this.stores.has(selfMember.storeId)) {
        scopedStores.push([selfMember.storeId, this.stores.get(selfMember.storeId)!]);
      }
      const scopedCenters: Array<[string, EducationCenterRecord]> = [];
      if (selfMember?.centerId && this.centers.has(selfMember.centerId)) {
        scopedCenters.push([selfMember.centerId, this.centers.get(selfMember.centerId)!]);
      }

      const ownProfile = this.bookingProfiles.get(selfMid);
      const ownAppointments = Array.from(this.bookingAppointments.entries()).filter(
        ([, a]) => a.ownerMid === selfMid
      );

      const ownContacts = Array.from(this.contacts.entries()).filter(
        ([, c]) => !c.ownerMid || c.ownerMid === selfMid || c.memberMid === selfMid
      );
      const ownTrackings = Array.from(this.contactTrackings.entries()).filter(
        ([, t]) =>
          !t.ownerMid && !t.memberMid
            ? true
            : t.ownerMid === selfMid || t.memberMid === selfMid || t.name === selfMember?.name
      );

      return {
        role: session.role,
        stats: {
          totalMembers: scopedMembers.length,
          monolineNodesCount: scopedMonoNodes.length,
          binaryNodesCount: scopedBiNodes.length,
          totalSettlementsCount: 0,
          totalRentCollected: 0,
          totalPointsDistributed: 0,
          abanyTechAccumulated: 0,
          hqOpsAccumulated: 0,
          publicSafetyAccumulated: 0,
        },
        snapshot: {
          schemaVersion: '2.0-scoped',
          exportedAt: new Date().toISOString(),
          members: scopedMembers,
          monolineNodes: scopedMonoNodes,
          binaryNodes: scopedBiNodes,
          stores: scopedStores,
          centers: scopedCenters,
          contacts: ownContacts,
          contactTrackings: ownTrackings,
          events: Array.from(this.events.entries()),
          eventTrackings: Array.from(this.eventTrackings.entries()),
          bookingProfiles: ownProfile ? [[selfMid, ownProfile]] : [],
          bookingAppointments: ownAppointments,
          settlements: [],
          counters: {
            currentMonolineCounter: this.currentMonolineCounter,
            currentBinaryCounter: this.currentBinaryCounter,
            currentContactCounter: this.currentContactCounter,
            currentTrackingCounter: this.currentTrackingCounter,
            currentEventCounter: this.currentEventCounter,
            currentEventTrackingCounter: this.currentEventTrackingCounter,
            currentBookingLicenseCounter: this.currentBookingLicenseCounter,
            currentAppointmentCounter: this.currentAppointmentCounter,
          },
          pools: {
            publicSafetyAccumulated: 0,
            abanyTechAccumulated: 0,
            hqOpsAccumulated: 0,
          },
        },
      };
    }

    if (session.role === 'STORE') {
      const storeReport = this.getStoreDetailReport(session.userId);
      const allowedStoreIds = new Set<string>([session.userId]);
      storeReport?.upstreamStores.forEach((u) => allowedStoreIds.add(u.storeId));
      storeReport?.downstreamGenerations.forEach((g) => {
        g.stores.forEach((s) => allowedStoreIds.add(s.storeId));
      });

      const scopedStores = Array.from(allowedStoreIds)
        .map((id) => [id, this.stores.get(id)] as [string, StoreRecord | undefined])
        .filter((pair): pair is [string, StoreRecord] => Boolean(pair[1]));

      const scopedMembers = Array.from(this.members.entries()).filter(
        ([, m]) => m.storeId === session.userId
      );

      return {
        role: session.role,
        stats: {
          totalMembers: scopedMembers.length,
          monolineNodesCount: scopedMembers.length,
          binaryNodesCount: scopedMembers.length,
          totalSettlementsCount: 0,
          totalRentCollected: 0,
          totalPointsDistributed: 0,
          abanyTechAccumulated: 0,
          hqOpsAccumulated: 0,
          publicSafetyAccumulated: 0,
        },
        snapshot: {
          schemaVersion: '2.0-scoped',
          exportedAt: new Date().toISOString(),
          members: scopedMembers,
          monolineNodes: [],
          binaryNodes: [],
          stores: scopedStores,
          centers: [],
          contacts: [],
          contactTrackings: [],
          events: [],
          eventTrackings: [],
          bookingProfiles: [],
          bookingAppointments: [],
          settlements: [],
          counters: {
            currentMonolineCounter: this.currentMonolineCounter,
            currentBinaryCounter: this.currentBinaryCounter,
          },
          pools: { publicSafetyAccumulated: 0, abanyTechAccumulated: 0, hqOpsAccumulated: 0 },
        },
      };
    }

    // CENTER
    const centerReport = this.getCenterDetailReport(session.userId);
    const allowedCenterIds = new Set<string>([session.userId]);
    centerReport?.upstreamCenters.forEach((u) => allowedCenterIds.add(u.centerId));
    centerReport?.downstreamGenerations.forEach((g) => {
      g.centers.forEach((c) => allowedCenterIds.add(c.centerId));
    });

    const scopedCenters = Array.from(allowedCenterIds)
      .map((id) => [id, this.centers.get(id)] as [string, EducationCenterRecord | undefined])
      .filter((pair): pair is [string, EducationCenterRecord] => Boolean(pair[1]));

    const scopedMembers = Array.from(this.members.entries()).filter(
      ([, m]) => m.centerId === session.userId
    );

    return {
      role: session.role,
      stats: {
        totalMembers: scopedMembers.length,
        monolineNodesCount: scopedMembers.length,
        binaryNodesCount: scopedMembers.length,
        totalSettlementsCount: 0,
        totalRentCollected: 0,
        totalPointsDistributed: 0,
        abanyTechAccumulated: 0,
        hqOpsAccumulated: 0,
        publicSafetyAccumulated: 0,
      },
      snapshot: {
        schemaVersion: '2.0-scoped',
        exportedAt: new Date().toISOString(),
        members: scopedMembers,
        monolineNodes: [],
        binaryNodes: [],
        stores: [],
        centers: scopedCenters,
        contacts: [],
        contactTrackings: [],
        events: Array.from(this.events.entries()),
        eventTrackings: Array.from(this.eventTrackings.entries()),
        bookingProfiles: [],
        bookingAppointments: [],
        settlements: [],
        counters: {
          currentMonolineCounter: this.currentMonolineCounter,
          currentBinaryCounter: this.currentBinaryCounter,
        },
        pools: { publicSafetyAccumulated: 0, abanyTechAccumulated: 0, hqOpsAccumulated: 0 },
      },
    };
  }

  /**
   * 僅回傳公開免登入入會頁所需的推薦人基本識別（絕不洩漏手機/信箱/地址等個資）
   */
  public getPublicSponsorInfo(rawSponsorMid?: string | null): {
    valid: boolean;
    sponsorMid: string;
    sponsorName: string;
  } {
    const cleaned = (rawSponsorMid || '').trim().toUpperCase();
    if (cleaned) {
      const found = this.members.get(cleaned);
      if (found) {
        return {
          valid: true,
          sponsorMid: found.mid,
          sponsorName: found.name,
        };
      }
      // 即使試算表尚未同步該推薦碼，仍保留符合格式之推薦碼供入會綁定
      if (/^A-\d{4,8}$/.test(cleaned)) {
        return {
          valid: true,
          sponsorMid: cleaned,
          sponsorName: `專屬推薦夥伴 (${cleaned})`,
        };
      }
    }
    const flagship = this.members.get(GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID);
    return {
      valid: true,
      sponsorMid: GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID,
      sponsorName: flagship?.name || '總部直屬旗艦領袖',
    };
  }

  /**
   * 從 Google 試算表 GAS exportHydrationState 回讀真實會員、節點與通訊錄（解決免費主機休眠重置問題）
   */
  public hydrateFromGasExport(payload: {
    members?: any[];
    monolineNodes?: any[];
    binaryNodes?: any[];
    contacts?: any[];
    contactTrackings?: any[];
    events?: any[];
    eventTrackings?: any[];
    workspaceRecords?: any[];
    cloudVaults?: any[];
  }): {
    importedMembers: number;
    importedMonoline: number;
    importedBinary: number;
    importedContacts: number;
    importedTrackings: number;
  } {
    const parseIso = (raw: any, fallbackMsOffset = 0): string => {
      if (!raw) return new Date(Date.now() + fallbackMsOffset).toISOString();
      const s = String(raw).trim();
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
        const d = new Date(s.replace(' ', 'T') + '+08:00');
        if (!isNaN(d.getTime())) return d.toISOString();
      }
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.toISOString();
      return new Date(Date.now() + fallbackMsOffset).toISOString();
    };

    const normalizePhone = (raw: any): string => {
      const s = String(raw ?? '').trim();
      return /^9\d{8}$/.test(s) ? `0${s}` : s;
    };

    const VALID_NODE_STATUSES = new Set<NodeStatus>([
      'HQ_LOCKED',
      'TRIAL_ACTIVE',
      'ACTIVE_RENEWED',
      'EXPIRED_FROZEN',
    ]);
    const parseNodeStatus = (raw: any): NodeStatus | null => {
      const s = String(raw ?? '').trim().toUpperCase() as NodeStatus;
      return VALID_NODE_STATUSES.has(s) ? s : null;
    };

    let importedMembers = 0;
    let importedMonoline = 0;
    let importedBinary = 0;
    let importedContacts = 0;
    let importedTrackings = 0;

    // 以試算表為來源同步真實對外會員（保留 A-00001~A-00063 公司自營不得轉讓 63 席與永吉家族起始資料）
    if (Array.isArray(payload.members)) {
      for (const mid of Array.from(this.members.keys())) {
        if (!isHqNonTransferableMid(mid)) {
          this.members.delete(mid);
        }
      }
      for (const [nid] of Array.from(this.monolineNodes.entries())) {
        if (!isHqNonTransferableNodeId(nid)) {
          this.monolineNodes.delete(nid);
        }
      }
      for (const [nid, node] of Array.from(this.binaryNodes.entries())) {
        if (!isHqNonTransferableNodeId(nid)) {
          const parent = this.binaryNodes.get(node.parentId);
          if (parent) {
            if (parent.leftChildId === nid) parent.leftChildId = undefined;
            if (parent.rightChildId === nid) parent.rightChildId = undefined;
          }
          this.binaryNodes.delete(nid);
        }
      }
      this.contacts.clear();
      this.contactTrackings.clear();
      this.currentMonolineCounter = GLOBAL_BOUNDARIES.HQ_LOCKED_MAX_SEQ;
      this.currentBinaryCounter = 25000000 + GLOBAL_BOUNDARIES.HQ_LOCKED_MAX_SEQ;
      this.currentContactCounter = 0;
      this.currentTrackingCounter = 0;

      for (const row of payload.members) {
        const mid = String(row?.mid || '').trim().toUpperCase();
        if (!mid || mid === 'A-00001113') continue;
        const existing = this.members.get(mid);
        const name = String(row?.name || existing?.name || mid).trim();
        const monolineNodeId = String(row?.monolineNodeId || existing?.monolineNodeId || '').trim().toUpperCase();
        const binaryNodeId = String(row?.binaryNodeId || existing?.binaryNodeId || '').trim().toUpperCase();
        const cleanMid = mid.replace(/[^A-Z0-9]/gi, '');
        const member: Member = {
          mid,
          name,
          phone: normalizePhone(row?.phone) || existing?.phone || '',
          tel: String(row?.tel ?? existing?.tel ?? '').trim(),
          line: String(row?.line ?? existing?.line ?? '').trim(),
          email: String(row?.email ?? existing?.email ?? '').trim(),
          address: String(row?.address ?? existing?.address ?? '').trim(),
          photoUrl:
            String(row?.photoUrl || existing?.photoUrl || '').trim() || DEFAULT_SHEET_PHOTO_URL,
          idNumberMasked: String(row?.idNumberMasked ?? existing?.idNumberMasked ?? '').trim(),
          sponsorMid:
            String(row?.sponsorMid || existing?.sponsorMid || GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID)
              .trim()
              .toUpperCase(),
          storeId: String(row?.storeId || existing?.storeId || 'S-TAIPEI-01').trim(),
          centerId: String(row?.centerId || existing?.centerId || 'EDU-GLOBAL-01').trim(),
          registeredAt: parseIso(row?.registeredAt),
          trialExpiresAt: parseIso(row?.trialExpiresAt, GLOBAL_BOUNDARIES.TRIAL_DAYS * 86400000),
          accumulatedRentAmount: Number(row?.accumulatedRentAmount ?? existing?.accumulatedRentAmount ?? 0),
          monolineNodeId: monolineNodeId || existing?.monolineNodeId || `C-${mid.replace(/^A-/, '')}`,
          binaryNodeId: binaryNodeId || existing?.binaryNodeId || GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID,
          contactId: existing?.contactId,
          cloudFolderId: existing?.cloudFolderId || `GDRV-${cleanMid}`,
          cloudFolderName: existing?.cloudFolderName || `【AIS-ERP 會員雲端】${mid} ${name}`,
          cloudFolderUrl: existing?.cloudFolderUrl || `https://drive.google.com/drive/folders/GDRV-${cleanMid}`,
          cloudSpreadsheetId: existing?.cloudSpreadsheetId || `GSHEET-${cleanMid}`,
          cloudSpreadsheetName: existing?.cloudSpreadsheetName || `${mid}_${name}_AI軟體專屬試算表`,
          cloudSpreadsheetUrl: existing?.cloudSpreadsheetUrl || `https://docs.google.com/spreadsheets/d/GSHEET-${cleanMid}`,
        };
        this.members.set(mid, member);
        initNewMemberDefaultPacks(mid);
        importedMembers++;

        const mNum = parseInt(mid.replace(/^A-/, ''), 10);
        if (!isNaN(mNum) && mNum !== 1113 && mNum < 25000000 && mNum > this.currentMonolineCounter) {
          this.currentMonolineCounter = mNum;
        }
      }
    }

    if (Array.isArray(payload.monolineNodes)) {
      for (const row of payload.monolineNodes) {
        const nodeId = String(row?.nodeId || '').trim().toUpperCase();
        if (!nodeId) continue;
        const existing = this.monolineNodes.get(nodeId);
        const mid = String(row?.mid || existing?.mid || '').trim().toUpperCase();
        const member = this.members.get(mid);

        // 相容既有 7 欄精簡試算表格式（C欄=層級、D欄=狀態、E欄=到期日、F欄=對應雙軌節點、G欄=累計收益）
        const isCompact7ColMonoline =
          (/^\d+$/.test(String(row?.name ?? '').trim()) && !(Number(row?.depth) > 0)) ||
          parseNodeStatus(row?.parentId) !== null;

        let monoDepth: number;
        let monoStatus: NodeStatus;
        let monoParentId: string;
        let monoName: string;
        let monoSponsorMid: string;
        let monoTrialExpiresAt: string;
        let monoEarnings: number;

        if (isCompact7ColMonoline) {
          monoDepth = Number(row?.name) > 0 ? Number(row.name) : importedMonoline + 1;
          monoStatus = parseNodeStatus(row?.parentId) || existing?.status || 'TRIAL_ACTIVE';
          const numStr = nodeId.replace(/^C-/, '');
          const cNum = parseInt(numStr, 10);
          const padLen = Math.max(5, numStr.length);
          monoParentId =
            !isNaN(cNum) && cNum > 1
              ? `C-${String(cNum - 1).padStart(padLen, '0')}`
              : 'HQ_ROOT';
          monoName = member ? `${member.name} (第1組-單軌體驗)` : existing?.name || nodeId;
          monoSponsorMid = member?.sponsorMid || existing?.sponsorMid || GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID;
          monoTrialExpiresAt =
            member?.trialExpiresAt ||
            parseIso(row?.trialExpiresAt, GLOBAL_BOUNDARIES.TRIAL_DAYS * 86400000);
          const maybeEarnings = Number(row?.status);
          monoEarnings =
            !isNaN(maybeEarnings) && String(row?.status ?? '').trim() !== ''
              ? maybeEarnings
              : Number(row?.totalEarnings ?? existing?.totalEarnings ?? 0);
        } else {
          monoDepth = Number(row?.depth) > 0 ? Number(row.depth) : existing?.depth ?? 1;
          monoStatus = parseNodeStatus(row?.status) || existing?.status || 'TRIAL_ACTIVE';
          monoParentId = String(row?.parentId || existing?.parentId || 'HQ_ROOT').trim();
          monoName = String(
            row?.name || (member ? `${member.name} (第1組-單軌體驗)` : '') || existing?.name || nodeId
          ).trim();
          const rawSponsor = String(row?.sponsorMid || '').trim().toUpperCase();
          monoSponsorMid = /^A-\d+$/i.test(rawSponsor)
            ? rawSponsor
            : member?.sponsorMid || existing?.sponsorMid || GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID;
          monoTrialExpiresAt = row?.trialExpiresAt
            ? parseIso(row.trialExpiresAt, GLOBAL_BOUNDARIES.TRIAL_DAYS * 86400000)
            : member?.trialExpiresAt || parseIso(undefined, GLOBAL_BOUNDARIES.TRIAL_DAYS * 86400000);
          monoEarnings = Number(row?.totalEarnings ?? existing?.totalEarnings ?? 0);
        }

        const node: NodeRecord = {
          nodeId,
          mid,
          name: monoName,
          type: 'MONOLINE',
          track: 'MONOLINE',
          status: monoStatus,
          parentId: monoParentId,
          placementPosition: 'MONOLINE_QUEUE',
          depth: monoDepth,
          sponsorMid: monoSponsorMid,
          hqPermanentLocked: Boolean(row?.hqPermanentLocked ?? existing?.hqPermanentLocked ?? (monoStatus === 'HQ_LOCKED')),
          trialExpiresAt: monoTrialExpiresAt,
          totalEarnings: monoEarnings,
          softwareKey: existing?.softwareKey || 'CONTACT',
          softwareTitle: existing?.softwareTitle || '通訊錄 CRM (1+1單軌)',
        };
        this.monolineNodes.set(nodeId, node);
        importedMonoline++;

        const cNum = parseInt(nodeId.replace(/^C-/, ''), 10);
        if (!isNaN(cNum) && cNum !== 1113 && cNum < 25000000 && cNum > this.currentMonolineCounter) {
          this.currentMonolineCounter = cNum;
        }
      }
    }

    if (Array.isArray(payload.binaryNodes)) {
      for (const row of payload.binaryNodes) {
        const nodeId = String(row?.nodeId || '').trim().toUpperCase();
        if (!nodeId) continue;
        const existing = this.binaryNodes.get(nodeId);
        const mid = String(row?.mid || existing?.mid || GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID)
          .trim()
          .toUpperCase();
        const member = this.members.get(mid);
        const posRaw = String(row?.placementPosition || existing?.placementPosition || 'L').trim().toUpperCase();
        const placementPosition: NodeRecord['placementPosition'] =
          posRaw === 'ROOT' || posRaw === 'L' || posRaw === 'R' ? posRaw : 'L';

        // 相容既有 11 欄精簡試算表格式（C欄=推薦人MID、I欄=狀態、J欄=到期日、K欄=累計收益）
        const isCompact11ColBinary =
          parseNodeStatus(row?.sponsorMid) !== null && parseNodeStatus(row?.status) === null;

        let binStatus: NodeStatus;
        let binSponsorMid: string;
        let binName: string;
        let binTrialExpiresAt: string;
        let binHqLocked: boolean;
        let binEarnings: number;

        if (isCompact11ColBinary) {
          binStatus = parseNodeStatus(row?.sponsorMid) || existing?.status || 'TRIAL_ACTIVE';
          const maybeSponsor = String(row?.name || '').trim().toUpperCase();
          binSponsorMid = /^A-\d+$/i.test(maybeSponsor)
            ? maybeSponsor
            : member?.sponsorMid || existing?.sponsorMid || GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID;
          binName =
            nodeId === GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID
              ? '雙軌定海神針 (Binary Root Node)'
              : member
                ? `${member.name} (第2組-雙軌分身)`
                : existing?.name || nodeId;
          binTrialExpiresAt = row?.status
            ? parseIso(row.status, GLOBAL_BOUNDARIES.TRIAL_DAYS * 86400000)
            : member?.trialExpiresAt || parseIso(undefined, GLOBAL_BOUNDARIES.TRIAL_DAYS * 86400000);
          binHqLocked = binStatus === 'HQ_LOCKED' || nodeId === GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID;
          binEarnings = Number(row?.totalEarnings ?? existing?.totalEarnings ?? 0);
        } else {
          binStatus = parseNodeStatus(row?.status) || existing?.status || 'TRIAL_ACTIVE';
          const rawSponsor = String(row?.sponsorMid || '').trim().toUpperCase();
          binSponsorMid = /^A-\d+$/i.test(rawSponsor)
            ? rawSponsor
            : member?.sponsorMid || existing?.sponsorMid || GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID;
          binName = String(
            row?.name ||
              (nodeId === GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID
                ? '雙軌定海神針 (Binary Root Node)'
                : member
                  ? `${member.name} (第2組-雙軌分身)`
                  : '') ||
              existing?.name ||
              nodeId
          ).trim();
          binTrialExpiresAt = row?.trialExpiresAt
            ? parseIso(row.trialExpiresAt, GLOBAL_BOUNDARIES.TRIAL_DAYS * 86400000)
            : member?.trialExpiresAt || parseIso(undefined, GLOBAL_BOUNDARIES.TRIAL_DAYS * 86400000);
          binHqLocked = Boolean(
            row?.hqPermanentLocked ??
              existing?.hqPermanentLocked ??
              (binStatus === 'HQ_LOCKED' || nodeId === GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID)
          );
          binEarnings = Number(row?.totalEarnings ?? existing?.totalEarnings ?? 0);
        }

        const parentRaw = String(
          row?.parentId || existing?.parentId || GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID
        ).trim();
        const parentId =
          nodeId === GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID || parentRaw.toUpperCase() === 'ROOT'
            ? 'SYSTEM_ROOT'
            : parentRaw.toUpperCase();

        const nodeType: NodeRecord['type'] =
          nodeId === GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID
            ? 'BINARY_ROOT'
            : (isHqNonTransferableMid(mid) || isHqNonTransferableNodeId(nodeId)) && (binStatus === 'HQ_LOCKED' || binHqLocked)
              ? 'BINARY_HQ_POOL'
              : 'BINARY_MEMBER_SLOT';

        const leftChildId =
          row?.leftChildId !== undefined
            ? String(row.leftChildId || '').trim().toUpperCase() || undefined
            : existing?.leftChildId;
        const rightChildId =
          row?.rightChildId !== undefined
            ? String(row.rightChildId || '').trim().toUpperCase() || undefined
            : existing?.rightChildId;

        const node: NodeRecord = {
          nodeId,
          mid,
          name: binName,
          type: nodeType,
          track: 'BINARY',
          status: binStatus,
          parentId,
          placementPosition,
          depth: Number(row?.depth ?? existing?.depth ?? (nodeId === GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID ? 0 : 1)),
          leftChildId,
          rightChildId,
          sponsorMid: binSponsorMid,
          hqPermanentLocked: binHqLocked,
          trialExpiresAt: binTrialExpiresAt,
          totalEarnings: binEarnings,
          softwareKey: existing?.softwareKey || 'EVENT',
          softwareTitle: existing?.softwareTitle || '活動行銷 (1+1雙軌)',
        };
        this.binaryNodes.set(nodeId, node);
        importedBinary++;

        const bNum = parseInt(nodeId.replace(/^C-/, ''), 10);
        if (!isNaN(bNum) && bNum >= 25000001 && bNum > this.currentBinaryCounter) {
          this.currentBinaryCounter = bNum;
        }
      }

      // Ensure parent left/right child pointers stay linked
      for (const node of this.binaryNodes.values()) {
        if (!node.parentId || node.parentId === 'SYSTEM_ROOT') continue;
        const parent = this.binaryNodes.get(node.parentId);
        if (!parent) continue;
        if (node.placementPosition === 'L' && !parent.leftChildId) {
          parent.leftChildId = node.nodeId;
        } else if (node.placementPosition === 'R' && !parent.rightChildId) {
          parent.rightChildId = node.nodeId;
        }
      }
    }

    if (Array.isArray(payload.contacts)) {
      for (const row of payload.contacts) {
        const cid = String(row?.id || '').trim().toUpperCase();
        if (!cid) continue;
        const existing = this.contacts.get(cid);
        const contact: ContactMasterRecord = {
          id: cid,
          status: String(row?.status || existing?.status || '開通AI軟體1+1').trim(),
          name: String(row?.name || existing?.name || '').trim(),
          phone: normalizePhone(row?.phone) || existing?.phone || '',
          tel: String(row?.tel ?? existing?.tel ?? '').trim(),
          line: String(row?.line ?? existing?.line ?? '').trim(),
          email: String(row?.email ?? existing?.email ?? '').trim(),
          address: String(row?.address ?? existing?.address ?? '').trim(),
          photoUrl:
            String(row?.photoUrl || existing?.photoUrl || '').trim() || DEFAULT_SHEET_PHOTO_URL,
          updatedAt: parseIso(row?.updatedAt),
          memberMid: String(row?.memberMid || '').trim().toUpperCase() || existing?.memberMid,
          ownerMid: String(row?.ownerMid || '').trim().toUpperCase() || existing?.ownerMid,
          monolineNodeId: existing?.monolineNodeId,
          binaryNodeId: existing?.binaryNodeId,
        };
        this.contacts.set(cid, contact);
        importedContacts++;

        // Enrich matching member's tel/line/email/address if matched by phone or name
        for (const m of this.members.values()) {
          if ((contact.phone && m.phone === contact.phone) || (contact.name && m.name === contact.name && !m.contactId)) {
            if (!m.tel && contact.tel) m.tel = contact.tel;
            if (!m.line && contact.line) m.line = contact.line;
            if (!m.email && contact.email) m.email = contact.email;
            if (!m.address && contact.address) m.address = contact.address;
            if (!m.contactId) m.contactId = cid;
            if (!contact.memberMid) contact.memberMid = m.mid;
            break;
          }
        }

        const cmNum = parseInt(cid.replace(/^CM-/, ''), 10);
        if (!isNaN(cmNum) && cmNum > this.currentContactCounter) {
          this.currentContactCounter = cmNum;
        }
      }
    }

    if (Array.isArray(payload.contactTrackings)) {
      for (const row of payload.contactTrackings) {
        const tid = String(row?.id || '').trim().toUpperCase();
        if (!tid) continue;
        const existing = this.contactTrackings.get(tid);
        const rec: ContactTrackingRecord = {
          id: tid,
          status: String(row?.status || existing?.status || '開通體驗').trim(),
          name: String(row?.name || existing?.name || '').trim(),
          contactDate: String(row?.contactDate || existing?.contactDate || new Date().toISOString().split('T')[0]).trim(),
          contactMethod: String(row?.contactMethod || existing?.contactMethod || '線上開通').trim(),
          discussionContent: String(row?.discussionContent || existing?.discussionContent || '').trim(),
          nextStepPlan: String(row?.nextStepPlan || existing?.nextStepPlan || '').trim(),
          photoUrl:
            String(row?.photoUrl || existing?.photoUrl || '').trim() || DEFAULT_SHEET_PHOTO_URL,
          updatedAt: parseIso(row?.updatedAt),
          contactId: existing?.contactId,
          memberMid: String(row?.memberMid || '').trim().toUpperCase() || existing?.memberMid,
          ownerMid: String(row?.ownerMid || '').trim().toUpperCase() || existing?.ownerMid,
        };
        this.contactTrackings.set(tid, rec);
        importedTrackings++;

        const ctNum = parseInt(tid.replace(/^CT-/, ''), 10);
        if (!isNaN(ctNum) && ctNum > this.currentTrackingCounter) {
          this.currentTrackingCounter = ctNum;
        }
      }
    }

    if (Array.isArray(payload.events)) {
      for (const row of payload.events) {
        const eid = String(row?.id || '').trim().toUpperCase();
        if (!eid) continue;
        const existing = this.events.get(eid);
        const ev: EventMasterRecord = {
          id: eid,
          status: String(row?.status || existing?.status || '報名中').trim(),
          eventTheme: String(row?.eventTheme || existing?.eventTheme || eid).trim(),
          date: String(row?.date || existing?.date || new Date().toISOString().split('T')[0]).trim(),
          location: String(row?.location || existing?.location || '地區教育中心').trim(),
          budget: row?.budget !== undefined && row?.budget !== '' ? row.budget : (existing?.budget ?? 0),
          leader: String(row?.leader || existing?.leader || '').trim(),
          notes: String(row?.notes ?? existing?.notes ?? '').trim(),
          photoUrl: String(row?.photoUrl || existing?.photoUrl || '').trim() || DEFAULT_SHEET_PHOTO_URL,
          updatedAt: parseIso(row?.updatedAt),
          participantsCount: existing?.participantsCount ?? 0,
        };
        this.events.set(eid, ev);
        const emNum = parseInt(eid.replace(/^EM-/, ''), 10);
        if (!isNaN(emNum) && emNum > this.currentEventCounter) {
          this.currentEventCounter = emNum;
        }
      }
    }

    if (Array.isArray(payload.eventTrackings)) {
      for (const row of payload.eventTrackings) {
        const etid = String(row?.id || '').trim().toUpperCase();
        if (!etid) continue;
        const existing = this.eventTrackings.get(etid);
        const et: EventTrackingRecord = {
          id: etid,
          status: String(row?.status || existing?.status || '公開發布').trim(),
          eventTheme: String(row?.eventTheme || existing?.eventTheme || '').trim(),
          photoTitle: String(row?.photoTitle || existing?.photoTitle || etid).trim(),
          shootLocation: String(row?.shootLocation || existing?.shootLocation || '').trim(),
          contentNotes: String(row?.contentNotes || existing?.contentNotes || '').trim(),
          photoUrl: String(row?.photoUrl || existing?.photoUrl || '').trim() || DEFAULT_SHEET_PHOTO_URL,
          updatedAt: parseIso(row?.updatedAt),
          eventId: existing?.eventId,
        };
        this.eventTrackings.set(etid, et);
        const etNum = parseInt(etid.replace(/^ET-/, ''), 10);
        if (!isNaN(etNum) && etNum > this.currentEventTrackingCounter) {
          this.currentEventTrackingCounter = etNum;
        }
      }
    }

    if (Array.isArray(payload.workspaceRecords)) {
      for (const entry of payload.workspaceRecords) {
        const mid = String(entry?.memberMid || '').trim().toUpperCase();
        const sysType = String(entry?.sysType || '').trim().toUpperCase();
        if (!mid || !sysType) continue;
        if (sysType === '_PACKS' && Array.isArray(entry?.packs)) {
          const cleanPacks = entry.packs
            .map((p: any) => String(p || '').trim().toUpperCase())
            .filter(Boolean);
          if (cleanPacks.length > 0) {
            this.memberWorkspacePacks.set(mid, Array.from(new Set(cleanPacks)));
          }
          continue;
        }
        if (entry?.record && typeof entry.record === 'object' && entry.record.ID) {
          const bySys = this.memberWorkspaceRecords.get(mid) || {};
          const list = Array.isArray(bySys[sysType]) ? [...bySys[sysType]] : [];
          const recId = String(entry.record.ID).trim();
          const idx = list.findIndex((r) => String(r?.ID || '').trim() === recId);
          if (idx >= 0) {
            list[idx] = { ...list[idx], ...entry.record };
          } else {
            list.unshift(entry.record);
          }
          bySys[sysType] = list.slice(0, 500);
          this.memberWorkspaceRecords.set(mid, bySys);
        }
      }
    }

    if (Array.isArray(payload.cloudVaults)) {
      for (const v of payload.cloudVaults) {
        const vMid = String(v?.memberMid || '').trim().toUpperCase();
        const vSsId = String(v?.spreadsheetId || '').trim();
        if (!vMid || !vSsId || vSsId.startsWith('GSHEET-')) continue;
        const member = this.members.get(vMid);
        if (!member) continue;
        const vFolderId = String(v?.folderId || '').trim();
        if (vFolderId && !vFolderId.startsWith('GDRV-')) {
          member.cloudFolderId = vFolderId;
        }
        if (v?.folderName) member.cloudFolderName = String(v.folderName).trim();
        if (v?.folderUrl && /^https:\/\/(drive|docs)\.google\.com\//i.test(String(v.folderUrl).trim())) {
          member.cloudFolderUrl = String(v.folderUrl).trim();
        }
        member.cloudSpreadsheetId = vSsId;
        if (v?.spreadsheetName) member.cloudSpreadsheetName = String(v.spreadsheetName).trim();
        if (v?.spreadsheetUrl && /^https:\/\/docs\.google\.com\//i.test(String(v.spreadsheetUrl).trim())) {
          member.cloudSpreadsheetUrl = String(v.spreadsheetUrl).trim();
        }
      }
    }

    this.ensureHq63AndYongjiSeed(false);
    this.saveState();
    return {
      importedMembers,
      importedMonoline,
      importedBinary,
      importedContacts,
      importedTrackings,
    };
  }

  // ============================================================================
  // 總部最高權限資料庫直接維護介面 (HQ Super Admin DB Management & Audit Trail)
  // ============================================================================

  private recordHqAudit(entry: {
    operatorId: string;
    operatorName: string;
    action: 'UPDATE_MEMBER' | 'DELETE_MEMBER' | 'UPDATE_NODE' | 'DELETE_NODE';
    targetType: 'MEMBER' | 'MONOLINE_NODE' | 'BINARY_NODE';
    targetId: string;
    summary: string;
  }) {
    const record = {
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.hqDbAuditLogs.unshift(record);
    if (this.hqDbAuditLogs.length > 200) {
      this.hqDbAuditLogs = this.hqDbAuditLogs.slice(0, 200);
    }
    return record;
  }

  public updateAuditLogGasSync(auditId: string, gasSyncOk: boolean, gasSyncMessage: string): void {
    const found = this.hqDbAuditLogs.find((item) => item.id === auditId);
    if (found) {
      found.gasSyncOk = gasSyncOk;
      found.gasSyncMessage = gasSyncMessage;
      this.saveState();
    }
  }

  public getHqDbOverview() {
    const members = Array.from(this.members.values()).sort((a, b) => a.mid.localeCompare(b.mid));
    const monolineNodes = Array.from(this.monolineNodes.values()).sort((a, b) => a.depth - b.depth || a.nodeId.localeCompare(b.nodeId));
    const binaryNodes = Array.from(this.binaryNodes.values()).sort((a, b) => a.depth - b.depth || a.nodeId.localeCompare(b.nodeId));
    const stores = Array.from(this.stores.values()).map((s) => ({ storeId: s.storeId, name: s.name }));
    const centers = Array.from(this.centers.values()).map((c) => ({ centerId: c.centerId, name: c.name }));
    return {
      members,
      monolineNodes,
      binaryNodes,
      stores,
      centers,
      auditLogs: this.hqDbAuditLogs.slice(0, 100),
    };
  }

  public hqUpdateMember(
    rawMid: string,
    rawUpdates: Record<string, unknown>,
    operator: { userId: string; displayName: string }
  ) {
    const mid = String(rawMid || '').trim().toUpperCase();
    const existing = this.members.get(mid);
    if (!existing) {
      throw new Error(`找不到會員編號 ${mid}`);
    }

    const cleanStr = (v: unknown, maxLen: number): string =>
      typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLen) : '';

    const changes: string[] = [];
    const next: Member = { ...existing };

    if (rawUpdates.name !== undefined) {
      const name = cleanStr(rawUpdates.name, 60);
      if (!name) throw new Error('會員姓名不可為空白');
      if (name !== existing.name) {
        changes.push(`姓名: ${existing.name} → ${name}`);
        next.name = name;
      }
    }

    if (rawUpdates.phone !== undefined) {
      let phone = cleanStr(rawUpdates.phone, 25);
      if (/^9\d{8}$/.test(phone)) phone = `0${phone}`;
      if (phone !== existing.phone) {
        changes.push(`手機: ${existing.phone || '空'} → ${phone || '空'}`);
        next.phone = phone;
      }
    }

    if (rawUpdates.idNumberMasked !== undefined) {
      const idVal = cleanStr(rawUpdates.idNumberMasked, 25).toUpperCase();
      if (idVal !== existing.idNumberMasked) {
        changes.push(`身分證/證號已更新`);
        next.idNumberMasked = idVal;
      }
    }

    if (rawUpdates.sponsorMid !== undefined) {
      const sponsorMid = cleanStr(rawUpdates.sponsorMid, 24).toUpperCase();
      if (sponsorMid && sponsorMid !== existing.sponsorMid) {
        changes.push(`推薦人: ${existing.sponsorMid} → ${sponsorMid}`);
        next.sponsorMid = sponsorMid;
      }
    }

    if (rawUpdates.storeId !== undefined) {
      const storeId = cleanStr(rawUpdates.storeId, 30);
      if (storeId && storeId !== existing.storeId) {
        changes.push(`經營店: ${existing.storeId} → ${storeId}`);
        next.storeId = storeId;
      }
    }

    if (rawUpdates.centerId !== undefined) {
      const centerId = cleanStr(rawUpdates.centerId, 30);
      if (centerId && centerId !== existing.centerId) {
        changes.push(`教育中心: ${existing.centerId} → ${centerId}`);
        next.centerId = centerId;
      }
    }

    if (rawUpdates.trialExpiresAt !== undefined) {
      const rawDate = cleanStr(rawUpdates.trialExpiresAt, 40);
      if (rawDate) {
        const parsed = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(rawDate)
          ? new Date(rawDate.replace(' ', 'T') + '+08:00')
          : /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
            ? new Date(`${rawDate}T23:59:59+08:00`)
            : new Date(rawDate);
        if (isNaN(parsed.getTime())) {
          throw new Error('到期日時間格式無效');
        }
        const iso = parsed.toISOString();
        if (iso !== existing.trialExpiresAt) {
          changes.push(`到期日已調整`);
          next.trialExpiresAt = iso;
        }
      }
    }

    if (rawUpdates.accumulatedRentAmount !== undefined) {
      const num = Number(rawUpdates.accumulatedRentAmount);
      if (!Number.isFinite(num) || num < 0 || num > 10_000_000) {
        throw new Error('零錢池金額必須為 0 以上之有效數字');
      }
      if (num !== existing.accumulatedRentAmount) {
        changes.push(`零錢池: ${existing.accumulatedRentAmount} → ${num}`);
        next.accumulatedRentAmount = num;
      }
    }

    if (rawUpdates.tel !== undefined) next.tel = cleanStr(rawUpdates.tel, 25);
    if (rawUpdates.line !== undefined) next.line = cleanStr(rawUpdates.line, 50);
    if (rawUpdates.email !== undefined) {
      const email = cleanStr(rawUpdates.email, 100);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Email 格式不正確');
      }
      next.email = email;
    }
    if (rawUpdates.address !== undefined) next.address = cleanStr(rawUpdates.address, 150);

    this.members.set(mid, next);

    // 同步更新通訊主檔對應姓名與手機（若存在）
    if (next.contactId && this.contacts.has(next.contactId)) {
      const c = this.contacts.get(next.contactId)!;
      c.name = next.name;
      c.phone = next.phone;
      c.tel = next.tel || c.tel;
      c.line = next.line || c.line;
      c.email = next.email || c.email;
      c.address = next.address || c.address;
      c.updatedAt = new Date().toISOString();
    }

    const auditEntry = this.recordHqAudit({
      operatorId: operator.userId,
      operatorName: operator.displayName,
      action: 'UPDATE_MEMBER',
      targetType: 'MEMBER',
      targetId: mid,
      summary: changes.length > 0 ? changes.join('；') : '更新聯絡欄位',
    });

    this.saveState();
    return { member: next, auditEntry };
  }

  public hqDeleteMember(
    rawMid: string,
    options: { deleteLinkedNodes?: boolean },
    operator: { userId: string; displayName: string }
  ) {
    const mid = String(rawMid || '').trim().toUpperCase();
    if (isHqNonTransferableMid(mid)) {
      throw new Error(`公司自營系統席位 ${mid} (A-00001~A-00063) 永久鎖定且不得轉讓，禁止刪除`);
    }
    const existing = this.members.get(mid);
    if (!existing) {
      throw new Error(`找不到會員編號 ${mid}`);
    }

    const deleteLinkedNodes = Boolean(options.deleteLinkedNodes);
    const deletedMonolineIds: string[] = [];
    const deletedBinaryIds: string[] = [];

    if (deleteLinkedNodes) {
      // 先檢查該會員名下所有雙軌節點是否帶有下線，若有則禁止連帶刪除以免破壞組織樹結構
      const ownedBinaryNodes = Array.from(this.binaryNodes.values()).filter(
        (n) => n.mid === mid && n.nodeId !== GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID
      );
      for (const bn of ownedBinaryNodes) {
        if (bn.leftChildId || bn.rightChildId) {
          throw new Error(
            `無法連帶刪除雙軌節點 ${bn.nodeId}：該節點下方已有安置子節點（${[bn.leftChildId, bn.rightChildId].filter(Boolean).join(' / ')}），請先移除下線葉節點或取消勾選「連帶刪除節點」`
          );
        }
      }

      for (const bn of ownedBinaryNodes) {
        const parent = this.binaryNodes.get(bn.parentId);
        if (parent) {
          if (parent.leftChildId === bn.nodeId) parent.leftChildId = undefined;
          if (parent.rightChildId === bn.nodeId) parent.rightChildId = undefined;
        }
        this.binaryNodes.delete(bn.nodeId);
        deletedBinaryIds.push(bn.nodeId);
      }

      const ownedMonoNodes = Array.from(this.monolineNodes.values()).filter((n) => n.mid === mid);
      for (const mn of ownedMonoNodes) {
        for (const other of this.monolineNodes.values()) {
          if (other.parentId === mn.nodeId) {
            other.parentId = mn.parentId;
          }
        }
        this.monolineNodes.delete(mn.nodeId);
        deletedMonolineIds.push(mn.nodeId);
      }
      if (deletedMonolineIds.length > 0) {
        const sortedMono = Array.from(this.monolineNodes.values()).sort((a, b) => a.depth - b.depth);
        sortedMono.forEach((n, idx) => {
          n.depth = idx + 1;
        });
      }
    }

    this.members.delete(mid);
    this.bookingProfiles.delete(mid);
    this.recomputeCounters();

    const auditEntry = this.recordHqAudit({
      operatorId: operator.userId,
      operatorName: operator.displayName,
      action: 'DELETE_MEMBER',
      targetType: 'MEMBER',
      targetId: mid,
      summary: `刪除會員 ${existing.name}${
        deletedMonolineIds.length || deletedBinaryIds.length
          ? `（連帶移除節點：${[...deletedMonolineIds, ...deletedBinaryIds].join(', ')}）`
          : '（保留原組織節點）'
      }`,
    });

    this.saveState();
    return {
      deletedMid: mid,
      deletedName: existing.name,
      deletedMonolineIds,
      deletedBinaryIds,
      auditEntry,
    };
  }

  public hqUpdateNode(
    track: 'MONOLINE' | 'BINARY',
    rawNodeId: string,
    rawUpdates: Record<string, unknown>,
    operator: { userId: string; displayName: string }
  ) {
    const nodeId = String(rawNodeId || '').trim().toUpperCase();
    const map = track === 'MONOLINE' ? this.monolineNodes : this.binaryNodes;
    const existing = map.get(nodeId);
    if (!existing) {
      throw new Error(`找不到${track === 'MONOLINE' ? '單軌' : '雙軌'}節點 ${nodeId}`);
    }

    const VALID_STATUSES = new Set<NodeStatus>([
      'HQ_LOCKED',
      'TRIAL_ACTIVE',
      'ACTIVE_RENEWED',
      'EXPIRED_FROZEN',
    ]);
    const cleanStr = (v: unknown, maxLen: number): string =>
      typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLen) : '';

    const changes: string[] = [];
    const next: NodeRecord = { ...existing };

    if (rawUpdates.name !== undefined) {
      const name = cleanStr(rawUpdates.name, 80);
      if (!name) throw new Error('節點顯示名稱不可為空白');
      if (name !== existing.name) {
        changes.push(`名稱: ${existing.name} → ${name}`);
        next.name = name;
      }
    }

    if (rawUpdates.status !== undefined) {
      const status = cleanStr(rawUpdates.status, 30).toUpperCase() as NodeStatus;
      if (!VALID_STATUSES.has(status)) {
        throw new Error(`無效的節點狀態：${status}`);
      }
      if (isHqNonTransferableNodeId(nodeId) && status !== 'HQ_LOCKED') {
        throw new Error(`公司自營系統節點 ${nodeId} (A-00001~A-00063) 不得轉讓，必須維持 HQ_LOCKED 永久鎖定狀態`);
      }
      if (status !== existing.status) {
        changes.push(`狀態: ${existing.status} → ${status}`);
        next.status = status;
        next.hqPermanentLocked = status === 'HQ_LOCKED';
      }
    }

    if (rawUpdates.sponsorMid !== undefined) {
      const sponsorMid = cleanStr(rawUpdates.sponsorMid, 24).toUpperCase();
      if (sponsorMid && sponsorMid !== existing.sponsorMid) {
        changes.push(`推薦人: ${existing.sponsorMid} → ${sponsorMid}`);
        next.sponsorMid = sponsorMid;
      }
    }

    if (rawUpdates.trialExpiresAt !== undefined) {
      const rawDate = cleanStr(rawUpdates.trialExpiresAt, 40);
      if (rawDate) {
        const parsed = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(rawDate)
          ? new Date(rawDate.replace(' ', 'T') + '+08:00')
          : /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
            ? new Date(`${rawDate}T23:59:59+08:00`)
            : new Date(rawDate);
        if (isNaN(parsed.getTime())) {
          throw new Error('到期日時間格式無效');
        }
        const iso = parsed.toISOString();
        if (iso !== existing.trialExpiresAt) {
          changes.push(`到期日已調整`);
          next.trialExpiresAt = iso;
        }
      }
    }

    if (rawUpdates.totalEarnings !== undefined) {
      const earnings = Number(rawUpdates.totalEarnings);
      if (!Number.isFinite(earnings) || earnings < 0 || earnings > 100_000_000) {
        throw new Error('累計收益必須為 0 以上之有效數字');
      }
      if (earnings !== existing.totalEarnings) {
        changes.push(`累計收益: ${existing.totalEarnings} → ${earnings}`);
        next.totalEarnings = earnings;
      }
    }

    if (rawUpdates.softwareTitle !== undefined) {
      const swTitle = cleanStr(rawUpdates.softwareTitle, 60);
      if (swTitle && swTitle !== existing.softwareTitle) {
        changes.push(`軟體模組: ${swTitle}`);
        next.softwareTitle = swTitle;
      }
    }

    map.set(nodeId, next);

    const auditEntry = this.recordHqAudit({
      operatorId: operator.userId,
      operatorName: operator.displayName,
      action: 'UPDATE_NODE',
      targetType: track === 'MONOLINE' ? 'MONOLINE_NODE' : 'BINARY_NODE',
      targetId: nodeId,
      summary: changes.length > 0 ? changes.join('；') : '儲存節點設定',
    });

    this.saveState();
    return { node: next, auditEntry };
  }

  public hqDeleteNode(
    track: 'MONOLINE' | 'BINARY',
    rawNodeId: string,
    operator: { userId: string; displayName: string }
  ) {
    const nodeId = String(rawNodeId || '').trim().toUpperCase();
    if (isHqNonTransferableNodeId(nodeId)) {
      throw new Error(`公司自營系統節點 ${nodeId} (A-00001~A-00063) 永久鎖定且不得轉讓，禁止刪除`);
    }
    if (track === 'BINARY') {
      const existing = this.binaryNodes.get(nodeId);
      if (!existing) throw new Error(`找不到雙軌節點 ${nodeId}`);
      if (existing.leftChildId || existing.rightChildId) {
        throw new Error(
          `無法刪除 ${nodeId}：此節點下方仍有子節點（${[existing.leftChildId, existing.rightChildId].filter(Boolean).join(' / ')}），請先由最底層葉節點開始移除`
        );
      }
      const parent = this.binaryNodes.get(existing.parentId);
      if (parent) {
        if (parent.leftChildId === nodeId) parent.leftChildId = undefined;
        if (parent.rightChildId === nodeId) parent.rightChildId = undefined;
      }
      this.binaryNodes.delete(nodeId);
      this.recomputeCounters();

      const auditEntry = this.recordHqAudit({
        operatorId: operator.userId,
        operatorName: operator.displayName,
        action: 'DELETE_NODE',
        targetType: 'BINARY_NODE',
        targetId: nodeId,
        summary: `刪除雙軌葉節點 ${nodeId} (${existing.name})，並釋放父節點 ${existing.parentId} ${existing.placementPosition} 位置`,
      });
      this.saveState();
      return {
        deletedNodeId: nodeId,
        track,
        parentId: existing.parentId,
        position: existing.placementPosition,
        auditEntry,
      };
    }

    const existing = this.monolineNodes.get(nodeId);
    if (!existing) throw new Error(`找不到單軌節點 ${nodeId}`);
    for (const other of this.monolineNodes.values()) {
      if (other.parentId === nodeId) {
        other.parentId = existing.parentId;
      }
    }
    this.monolineNodes.delete(nodeId);
    const sortedMono = Array.from(this.monolineNodes.values()).sort((a, b) => a.depth - b.depth);
    sortedMono.forEach((n, idx) => {
      n.depth = idx + 1;
    });
    this.recomputeCounters();

    const auditEntry = this.recordHqAudit({
      operatorId: operator.userId,
      operatorName: operator.displayName,
      action: 'DELETE_NODE',
      targetType: 'MONOLINE_NODE',
      targetId: nodeId,
      summary: `刪除單軌節點 ${nodeId} (${existing.name}) 並重新串接公排順位`,
    });
    this.saveState();
    return {
      deletedNodeId: nodeId,
      track,
      parentId: existing.parentId,
      auditEntry,
    };
  }

  // ============================================================================
  // 會員全能五星工作區跨裝置雲端同步儲存 (手機 <-> 伺服器 <-> 桌機 + GAS)
  // ============================================================================

  public getMemberWorkspaceData(mid: string): {
    unlockedPacks: string[] | null;
    recordsBySys: Record<string, Array<Record<string, any>>>;
  } {
    const keyMid = String(mid || '').trim().toUpperCase();
    const packs = this.memberWorkspacePacks.get(keyMid) || null;
    const recordsBySys = this.memberWorkspaceRecords.get(keyMid) || {};
    return {
      unlockedPacks: packs ? [...packs] : null,
      recordsBySys,
    };
  }

  public saveMemberWorkspacePacks(mid: string, packs: string[]): string[] {
    const keyMid = String(mid || '').trim().toUpperCase();
    const clean = Array.from(
      new Set(
        packs
          .map((p) => String(p || '').trim().toUpperCase())
          .filter(Boolean)
      )
    );
    if (!clean.includes('CONTACT')) clean.unshift('CONTACT');
    if (!clean.includes('EVENT')) clean.push('EVENT');
    this.memberWorkspacePacks.set(keyMid, clean);
    this.saveState();
    return clean;
  }

  public upsertMemberWorkspaceRecord(
    mid: string,
    sysType: string,
    record: Record<string, any>
  ): Record<string, any> {
    const keyMid = String(mid || '').trim().toUpperCase();
    const keySys = String(sysType || '').trim().toUpperCase();
    const recId = String(record.ID || '').trim();
    if (!keyMid || !keySys || !recId) {
      throw new Error('缺少必要識別欄位 (memberMid / sysType / ID)');
    }
    const bySys = this.memberWorkspaceRecords.get(keyMid) || {};
    const list = Array.isArray(bySys[keySys]) ? [...bySys[keySys]] : [];
    const idx = list.findIndex((r) => String(r?.ID || '').trim() === recId);
    const saved = { ...record, ID: recId };
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...saved };
    } else {
      list.unshift(saved);
    }
    bySys[keySys] = list.slice(0, 500);
    this.memberWorkspaceRecords.set(keyMid, bySys);
    this.saveState();
    return saved;
  }

  public deleteMemberWorkspaceRecord(mid: string, sysType: string, recordId: string): boolean {
    const keyMid = String(mid || '').trim().toUpperCase();
    const keySys = String(sysType || '').trim().toUpperCase();
    const bySys = this.memberWorkspaceRecords.get(keyMid);
    if (!bySys || !Array.isArray(bySys[keySys])) return false;
    const before = bySys[keySys].length;
    bySys[keySys] = bySys[keySys].filter((r) => String(r?.ID || '').trim() !== recordId.trim());
    if (bySys[keySys].length !== before) {
      this.memberWorkspaceRecords.set(keyMid, bySys);
      this.saveState();
      return true;
    }
    return false;
  }
}

export const serverErpEngine = new ERPEngine();

