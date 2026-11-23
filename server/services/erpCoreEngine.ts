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
  MONOLINE_MID_RANGE: 'A-00000001 ~ A-25000000',
  BINARY_START_MID: 'A-25000001',
  MONOLINE_NODE_RANGE: 'C-00000001 ~ C-25000000',
  BINARY_ROOT_NODE_ID: 'C-25000001',
  BINARY_START_POOL_RANGE: 'C-25000002 ~ C-25000514', // 513 席自營節點 (包含定海神針共514)
  BINARY_START_POOL_COUNT: 514,
  FLAGSHIP_SPONSOR_MID: 'A-00001113', // 第 6 代旗艦領袖
  TRIAL_SOFTWARE_QTY: 2,
  TRIAL_DAYS: 30,
};

const STORAGE_KEY = 'SAAS_ERP_STATE_V1';

export class ERPEngine {
  private members: Map<string, Member> = new Map();
  private monolineNodes: Map<string, NodeRecord> = new Map();
  private binaryNodes: Map<string, NodeRecord> = new Map();
  private stores: Map<string, StoreRecord> = new Map();
  private centers: Map<string, EducationCenterRecord> = new Map();
  private settlements: SettlementBreakdown[] = [];
  
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

  private currentMonolineCounter: number = 0; // 新會員入會從 A-00001 建檔 (0 -> 首位為 1)
  private currentBinaryCounter: number = 25000514; // 開局池至 25000514
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
   * 初始化系統：建立雙軌定海神針與 513 席雙軌開局池，新會員入會統一從 A-00001 起始建檔
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
          if (parsed.contacts && parsed.contacts.length > 0) {
            this.contacts = new Map(parsed.contacts);
          } else {
            this.initSampleContactsAndEvents();
          }
          if (parsed.contactTrackings && parsed.contactTrackings.length > 0) {
            this.contactTrackings = new Map(parsed.contactTrackings);
          }
          if (parsed.events && parsed.events.length > 0) {
            this.events = new Map(parsed.events);
          }
          if (parsed.eventTrackings && parsed.eventTrackings.length > 0) {
            this.eventTrackings = new Map(parsed.eventTrackings);
          }
          this.initHqStaffs();
          if (parsed.bookingProfiles && parsed.bookingProfiles.length > 0) {
            this.bookingProfiles = new Map(parsed.bookingProfiles);
          } else {
            this.initSampleBookings();
          }
          if (parsed.bookingAppointments && parsed.bookingAppointments.length > 0) {
            this.bookingAppointments = new Map(parsed.bookingAppointments);
          }

          this.settlements = parsed.settlements || [];
          this.currentMonolineCounter = (parsed.currentMonolineCounter >= 1113) ? 0 : (parsed.currentMonolineCounter || 0);
          this.currentBinaryCounter = parsed.currentBinaryCounter || 25000514;
          this.currentContactCounter = parsed.currentContactCounter || this.contacts.size;
          this.currentTrackingCounter = parsed.currentTrackingCounter || this.contactTrackings.size;
          this.currentEventCounter = parsed.currentEventCounter || this.events.size;
          this.currentEventTrackingCounter = parsed.currentEventTrackingCounter || this.eventTrackings.size;
          this.currentBookingLicenseCounter = parsed.currentBookingLicenseCounter || this.bookingProfiles.size;
          this.currentAppointmentCounter = parsed.currentAppointmentCounter || this.bookingAppointments.size;
          this.publicSafetyAccumulated = parsed.publicSafetyAccumulated || 0;
          this.abanyTechAccumulated = parsed.abanyTechAccumulated || 0;
          this.hqOpsAccumulated = parsed.hqOpsAccumulated || 0;

          if (!this.members.has('A-00001')) {
            this.seedInitialDemoMembers();
            if (this.bookingProfiles.size === 0) {
              this.initSampleBookings();
            }
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
    this.initSampleContactsAndEvents();
    this.currentMonolineCounter = 0; // 新會員入會從 A-00001 建檔
    this.currentBinaryCounter = 25000514;
    this.currentContactCounter = this.contacts.size;
    this.currentTrackingCounter = this.contactTrackings.size;
    this.currentEventCounter = this.events.size;
    this.currentEventTrackingCounter = this.eventTrackings.size;
    this.currentBookingLicenseCounter = 0;
    this.currentAppointmentCounter = 0;
    this.publicSafetyAccumulated = 0;
    this.abanyTechAccumulated = 0;
    this.hqOpsAccumulated = 0;

    const now = new Date();
    const expiry = new Date(now.getTime() + 365 * 24 * 3600 * 1000).toISOString();

    // 旗艦領袖 A-00001113 (總直推推薦錨點)
    const flagshipMid = GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID;
    this.members.set(flagshipMid, {
      mid: flagshipMid,
      name: '第 6 代旗艦領袖 (總直推錨點)',
      phone: '0988-001-113',
      idNumberMasked: 'A123***113',
      sponsorMid: 'HQ_ROOT',
      storeId: 'S-HQ-01',
      centerId: 'EDU-HQ-01',
      registeredAt: now.toISOString(),
      trialExpiresAt: expiry,
      accumulatedRentAmount: 0,
      monolineNodeId: 'C-00000',
      binaryNodeId: 'C-25000001',
      cloudFolderId: `GDRV-${flagshipMid.replace(/[^A-Z0-9]/gi, '')}`,
      cloudFolderName: `【AIS-ERP 會員雲端】${flagshipMid} 第 6 代旗艦領袖`,
      cloudFolderUrl: `https://drive.google.com/drive/folders/GDRV-${flagshipMid.replace(/[^A-Z0-9]/gi, '')}`,
      cloudSpreadsheetId: `GSHEET-${flagshipMid.replace(/[^A-Z0-9]/gi, '')}`,
      cloudSpreadsheetName: `${flagshipMid}_第 6 代旗艦領袖_AI軟體專屬試算表`,
      cloudSpreadsheetUrl: `https://docs.google.com/spreadsheets/d/GSHEET-${flagshipMid.replace(/[^A-Z0-9]/gi, '')}`,
    });

    // 2. 初始化雙軌定海神針與開局自營節點池 (C-25000001 ~ C-25000514 共 514 個節點)
    // C-25000001 為根節點 (Depth = 0)
    const rootNodeId = GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID;
    this.binaryNodes.set(rootNodeId, {
      nodeId: rootNodeId,
      mid: flagshipMid,
      name: '雙軌定海神針 (Binary Root Node)',
      type: 'BINARY_ROOT',
      track: 'BINARY',
      status: 'HQ_LOCKED',
      parentId: 'SYSTEM_ROOT',
      placementPosition: 'ROOT',
      depth: 0,
      sponsorMid: flagshipMid,
      hqPermanentLocked: true,
      trialExpiresAt: expiry,
      totalEarnings: 0,
    });

    // 依滿二元樹數學公式依序滑落安置 (以 1-based index: root = 1, 左子 = 2k, 右子 = 2k+1)
    // 節點 C-25000001 (index 1)
    // 節點 C-25000002 ~ C-25000514 (index 2 ~ 514)
    for (let i = 2; i <= 514; i++) {
      const nodeId = `C-2500${String(i).padStart(4, '0')}`;
      const parentIndex = Math.floor(i / 2);
      const parentNodeId = `C-2500${String(parentIndex).padStart(4, '0')}`;
      const isLeft = i % 2 === 0;
      const depth = Math.floor(Math.log2(i));

      // 建立節點
      const nodeRecord: NodeRecord = {
        nodeId,
        mid: flagshipMid,
        name: `雙軌開局自營節點 #${i} (HQ Pool)`,
        type: 'BINARY_HQ_POOL',
        track: 'BINARY',
        status: 'HQ_LOCKED',
        parentId: parentNodeId,
        placementPosition: isLeft ? 'L' : 'R',
        depth,
        sponsorMid: flagshipMid, // 100% 由旗艦領袖 A-00001113 親推
        hqPermanentLocked: true,
        trialExpiresAt: expiry,
        totalEarnings: 0,
      };
      this.binaryNodes.set(nodeId, nodeRecord);

      // 連結父節點之 leftChildId / rightChildId
      const parent = this.binaryNodes.get(parentNodeId);
      if (parent) {
        if (isLeft) {
          parent.leftChildId = nodeId;
        } else {
          parent.rightChildId = nodeId;
        }
      }
    }

    // 3. 建立 4 位創始範例會員 (A-00001 ~ A-00004) 讓會員/店長/主任/CRM 登入直接互通
    this.seedInitialDemoMembers();
    // 4. 初始化第 3 種 AI 系統：個人預約系統範例資料
    this.initSampleBookings();

    this.saveState();
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

  private seedInitialDemoMembers() {
    const now = new Date();
    const trialExp = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
    const demos = [
      { mid: 'A-00001', mono: 'C-00001', bi: 'C-25000515', name: '王大明', phone: '0912-345-678', tel: '02-2771-9900', line: 'wang_daming', email: 'daming.wang@example.com', address: '台北市大安區忠孝東路四段 128 號 12 樓', sponsor: GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID, store: 'S-TAIPEI-01', center: 'EDU-TAIPEI-01', cm: 'CM-00001' },
      { mid: 'A-00002', mono: 'C-00002', bi: 'C-25000516', name: '李美華', phone: '0922-666-888', tel: '02-8951-8822', line: 'meihua_lee', email: 'meihua.lee@example.com', address: '新北市板橋區文化路一段 190 號 6 樓', sponsor: 'A-00001', store: 'S-BANQIAO-01', center: 'EDU-BANQIAO-01', cm: 'CM-00002' },
      { mid: 'A-00003', mono: 'C-00003', bi: 'C-25000517', name: '張志豪', phone: '0933-555-777', tel: '03-316-6699', line: 'chihhao_chang', email: 'chihhao@example.com', address: '桃園市桃園區中正路 1190 號 8 樓', sponsor: 'A-00002', store: 'S-TAOYUAN-01', center: 'EDU-TAOYUAN-01', cm: 'CM-00003' },
      { mid: 'A-00004', mono: 'C-00004', bi: 'C-25000518', name: '陳冠宇', phone: '0955-123-987', tel: '04-2258-7733', line: 'kuanyu_chen', email: 'kuanyu@example.com', address: '台中市西屯區市政北二路 240 號 15 樓', sponsor: 'A-00003', store: 'S-TAICHUNG-01', center: 'EDU-TAICHUNG-01', cm: 'CM-00004' },
    ];

    demos.forEach((d, idx) => {
      const seq = idx + 1;
      const prevMono = seq === 1 ? 'HQ_ROOT' : `C-${String(seq - 1).padStart(5, '0')}`;
      this.monolineNodes.set(d.mono, {
        nodeId: d.mono,
        mid: d.mid,
        name: `${d.name} (第1組-單軌體驗)`,
        type: 'MONOLINE',
        track: 'MONOLINE',
        status: 'TRIAL_ACTIVE',
        parentId: prevMono,
        placementPosition: 'MONOLINE_QUEUE',
        depth: seq,
        sponsorMid: d.sponsor,
        hqPermanentLocked: false,
        trialExpiresAt: trialExp,
        totalEarnings: seq === 1 ? 18 : 6,
        softwareKey: 'CONTACT',
        softwareTitle: '通訊錄 CRM (1+1單軌)',
      });

      const placement = this.findNextAvailableBinaryPlacement(GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID);
      const parentBi = this.binaryNodes.get(placement.parentId);
      this.binaryNodes.set(d.bi, {
        nodeId: d.bi,
        mid: d.mid,
        name: `${d.name} (第2組-雙軌分身)`,
        type: 'BINARY_MEMBER_SLOT',
        track: 'BINARY',
        status: 'TRIAL_ACTIVE',
        parentId: placement.parentId,
        placementPosition: placement.position,
        depth: placement.depth,
        sponsorMid: d.sponsor,
        hqPermanentLocked: false,
        trialExpiresAt: trialExp,
        totalEarnings: seq === 1 ? 12 : 4,
        softwareKey: 'EVENT',
        softwareTitle: '活動行銷 (1+1雙軌)',
      });
      if (parentBi) {
        if (placement.position === 'L') parentBi.leftChildId = d.bi;
        else parentBi.rightChildId = d.bi;
      }

      this.members.set(d.mid, {
        mid: d.mid,
        name: d.name,
        phone: d.phone,
        tel: d.tel,
        line: d.line,
        email: d.email,
        address: d.address,
        idNumberMasked: `A123***00${seq}`,
        sponsorMid: d.sponsor,
        storeId: d.store,
        centerId: d.center,
        registeredAt: new Date(now.getTime() - (20 - seq * 3) * 86400000).toISOString(),
        trialExpiresAt: trialExp,
        accumulatedRentAmount: 0,
        monolineNodeId: d.mono,
        binaryNodeId: d.bi,
        contactId: d.cm,
      });
    });

    this.currentMonolineCounter = 4;
    this.currentBinaryCounter = 25000518;
  }

  private initSampleBookings() {
    this.bookingProfiles.clear();
    this.bookingAppointments.clear();
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
    const dayAfter = new Date(now.getTime() + 2 * 86400000).toISOString().split('T')[0];

    const profiles: BookingProfile[] = [
      {
        licenseId: 'BK-00001',
        ownerMid: 'A-00001',
        ownerName: '王大明',
        displayTitle: '王大明 AI 產銷合一導入諮詢預約網',
        bio: '專精單軌公排與雙軌二元樹 1+1 自動路由設計，提供一對一新會員開通教學與商業診斷。',
        status: 'TRIAL_ACTIVE',
        activatedAt: new Date(now.getTime() - 5 * 86400000).toISOString(),
        expiresAt: new Date(now.getTime() + 25 * 86400000).toISOString(),
        monthlyRentNtd: 100,
        totalRenewalsCount: 0,
        workingDays: [1, 2, 3, 4, 5, 6],
        startHour: 9,
        endHour: 20,
        slotIntervalMinutes: 60,
        services: [
          {
            id: 'SRV-101',
            title: 'AI 軟體 1+1 新會員開通一對一導覽',
            durationMinutes: 45,
            priceNtd: 0,
            description: '手把手協助開通 1+1 AI 軟體（通訊錄 CRM + 活動行銷）與第 3 種 AI 個人預約系統 30 天免費體驗。',
            isActive: true,
            locationType: 'ONLINE_MEET',
          },
          {
            id: 'SRV-102',
            title: '實體門店與教育中心聯盟簡報',
            durationMinutes: 60,
            priceNtd: 0,
            description: '深度解析 6 代經營店輔導補貼與 6 代教育中心培訓補貼收益結構。',
            isActive: true,
            locationType: 'IN_PERSON',
          },
        ],
      },
      {
        licenseId: 'BK-00002',
        ownerMid: 'A-00002',
        ownerName: '李美華',
        displayTitle: '板橋營業店 李美華店長預約工作室',
        bio: '提供新北板橋區會員產銷物流自取、AI 軟體操作輔導與團隊增員諮詢。',
        status: 'ACTIVE_RENEWED',
        activatedAt: new Date(now.getTime() - 40 * 86400000).toISOString(),
        expiresAt: new Date(now.getTime() + 20 * 86400000).toISOString(),
        monthlyRentNtd: 100,
        totalRenewalsCount: 1,
        workingDays: [1, 2, 3, 4, 5],
        startHour: 10,
        endHour: 18,
        slotIntervalMinutes: 60,
        services: [
          {
            id: 'SRV-201',
            title: '新人 100 元閉環分潤財務說明',
            durationMinutes: 60,
            priceNtd: 0,
            description: '詳細剖析 15+15+6+6+30+28=100 點零資金沉澱閉環機制。',
            isActive: true,
            locationType: 'IN_PERSON',
          },
        ],
      },
      {
        licenseId: 'BK-00003',
        ownerMid: GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID,
        ownerName: '第 6 代旗艦領袖',
        displayTitle: '旗艦領袖總部戰略預約中心',
        bio: '全國經銷團隊領袖、區域營運總監與教育中心合作提案專屬預約時段。',
        status: 'ACTIVE_RENEWED',
        activatedAt: new Date(now.getTime() - 60 * 86400000).toISOString(),
        expiresAt: new Date(now.getTime() + 300 * 86400000).toISOString(),
        monthlyRentNtd: 100,
        totalRenewalsCount: 2,
        workingDays: [1, 2, 3, 4, 5],
        startHour: 10,
        endHour: 17,
        slotIntervalMinutes: 60,
        services: [
          {
            id: 'SRV-301',
            title: '區域經營店／教育中心成立簽約面談',
            durationMinutes: 60,
            priceNtd: 0,
            description: '審核加盟經營店與教育中心資格與區域佈局規劃。',
            isActive: true,
            locationType: 'ONLINE_MEET',
          },
        ],
      },
    ];

    for (const p of profiles) {
      this.bookingProfiles.set(p.ownerMid, p);
    }
    this.currentBookingLicenseCounter = profiles.length;

    const sampleAppointments: BookingAppointment[] = [
      {
        appointmentId: 'APT-00001',
        ownerMid: 'A-00001',
        licenseId: 'BK-00001',
        serviceId: 'SRV-101',
        serviceTitle: 'AI 軟體 1+1 新會員開通一對一導覽',
        date: tomorrow,
        timeSlot: '14:00',
        clientName: '林詩涵',
        clientPhone: '0918-223-456',
        clientLine: 'shihan_lin',
        notes: '想了解 AI 軟體 30 天免費體驗與單軌雙軌如何運作',
        status: 'CONFIRMED',
        createdAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
      },
      {
        appointmentId: 'APT-00002',
        ownerMid: 'A-00001',
        licenseId: 'BK-00001',
        serviceId: 'SRV-102',
        serviceTitle: '實體門店與教育中心聯盟簡報',
        date: dayAfter,
        timeSlot: '16:00',
        clientName: '吳建華',
        clientPhone: '0939-778-901',
        clientLine: 'jianhua_wu',
        notes: '目前在桃園經營社區物流點，評估加入輔導店',
        status: 'PENDING',
        createdAt: new Date(now.getTime() - 3600000).toISOString(),
      },
      {
        appointmentId: 'APT-00003',
        ownerMid: 'A-00002',
        licenseId: 'BK-00002',
        serviceId: 'SRV-201',
        serviceTitle: '新人 100 元閉環分潤財務說明',
        date: tomorrow,
        timeSlot: '11:00',
        clientName: '黃小芬',
        clientPhone: '0966-112-334',
        clientLine: 'fen_huang',
        status: 'PENDING',
        createdAt: new Date(now.getTime() - 5 * 3600000).toISOString(),
      },
    ];

    for (const apt of sampleAppointments) {
      this.bookingAppointments.set(apt.appointmentId, apt);
    }
    this.currentAppointmentCounter = sampleAppointments.length;
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
        managerMid: 'A-00001',
        managerName: '王大明',
        phone: '02-2771-8899',
        address: '台北市大安區忠孝東路四段 120 號',
        parentStoreId: 'S-HQ-01', // 第 1 代直屬輔導店
        establishedAt: new Date(now.getTime() - 90 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 860,
        balance: 860,
      },
      {
        storeId: 'S-BANQIAO-01',
        name: '新北板橋文化經營店',
        managerMid: 'A-00002',
        managerName: '李美華',
        phone: '02-8951-6677',
        address: '新北市板橋區文化路一段 188 號',
        parentStoreId: 'S-TAIPEI-01', // 第 2 代輔導店
        establishedAt: new Date(now.getTime() - 60 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 420,
        balance: 420,
      },
      {
        storeId: 'S-TAOYUAN-01',
        name: '桃園藝文特區中正經營店',
        managerMid: 'A-00003',
        managerName: '張志豪',
        phone: '03-316-5588',
        address: '桃園市桃園區中正路 1188 號',
        parentStoreId: 'S-BANQIAO-01', // 第 3 代輔導店
        establishedAt: new Date(now.getTime() - 45 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 260,
        balance: 260,
      },
      {
        storeId: 'S-TAICHUNG-01',
        name: '台中西屯七期市政經營店',
        managerMid: 'A-00004',
        managerName: '陳冠宇',
        phone: '04-2258-9911',
        address: '台中市西屯區市政北二路 238 號',
        parentStoreId: 'S-TAOYUAN-01', // 第 4 代輔導店
        establishedAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 150,
        balance: 150,
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
        directorMid: 'A-00001',
        directorName: '王大明',
        phone: '02-2771-9900',
        address: '台北市大安區忠孝東路四段 128 號 12 樓',
        parentCenterId: 'EDU-HQ-01', // 第 1 代直屬培訓中心
        establishedAt: new Date(now.getTime() - 100 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 920,
        balance: 920,
      },
      {
        centerId: 'EDU-BANQIAO-01',
        name: '新北板橋卓越系統教育中心',
        directorMid: 'A-00002',
        directorName: '李美華',
        phone: '02-8951-8822',
        address: '新北市板橋區文化路一段 190 號 6 樓',
        parentCenterId: 'EDU-TAIPEI-01', // 第 2 代培訓中心
        establishedAt: new Date(now.getTime() - 70 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 480,
        balance: 480,
      },
      {
        centerId: 'EDU-TAOYUAN-01',
        name: '桃園藝文領袖培育研習中心',
        directorMid: 'A-00003',
        directorName: '張志豪',
        phone: '03-316-6699',
        address: '桃園市桃園區中正路 1190 號 8 樓',
        parentCenterId: 'EDU-BANQIAO-01', // 第 3 代培訓中心
        establishedAt: new Date(now.getTime() - 50 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 310,
        balance: 310,
      },
      {
        centerId: 'EDU-TAICHUNG-01',
        name: '台中市政智慧創新教育中心',
        directorMid: 'A-00004',
        directorName: '陳冠宇',
        phone: '04-2258-7733',
        address: '台中市西屯區市政北二路 240 號 15 樓',
        parentCenterId: 'EDU-TAOYUAN-01', // 第 4 代培訓中心
        establishedAt: new Date(now.getTime() - 35 * 86400000).toISOString(),
        status: 'ACTIVE',
        totalSubsidyPoints: 190,
        balance: 190,
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

  private initSampleContactsAndEvents() {
    this.contacts.clear();
    this.contactTrackings.clear();
    this.events.clear();
    this.eventTrackings.clear();
    const now = new Date();

    // 1. 通訊主檔 (CONTACT_M / CM-)
    // headers: ["ID", "狀態", "姓名", "手機", "電話", "Line", "Email", "地址", "照片連結", "更新時間"]
    const sampleContacts: ContactMasterRecord[] = [
      {
        id: 'CM-00001',
        status: '開通AI軟體1+1',
        name: '王大明',
        phone: '0912-345-678',
        tel: '02-2771-9900',
        line: 'wang_daming',
        email: 'daming.wang@example.com',
        address: '台北市大安區忠孝東路四段 128 號 12 樓',
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
        updatedAt: new Date(now.getTime() - 15 * 86400000).toISOString(),
        memberMid: 'A-00001',
        monolineNodeId: 'C-00001',
        binaryNodeId: 'C-25000515',
      },
      {
        id: 'CM-00002',
        status: '開通AI軟體1+1',
        name: '李美華',
        phone: '0922-666-888',
        tel: '02-8951-8822',
        line: 'meihua_lee',
        email: 'meihua.lee@example.com',
        address: '新北市板橋區文化路一段 190 號 6 樓',
        photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
        updatedAt: new Date(now.getTime() - 10 * 86400000).toISOString(),
        memberMid: 'A-00002',
        monolineNodeId: 'C-00002',
        binaryNodeId: 'C-25000516',
      },
      {
        id: 'CM-00003',
        status: '開通AI軟體1+1',
        name: '張志豪',
        phone: '0933-555-777',
        tel: '03-316-6699',
        line: 'chihhao_chang',
        email: 'chihhao@example.com',
        address: '桃園市桃園區中正路 1190 號 8 樓',
        photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
        updatedAt: new Date(now.getTime() - 6 * 86400000).toISOString(),
        memberMid: 'A-00003',
        monolineNodeId: 'C-00003',
        binaryNodeId: 'C-25000517',
      },
      {
        id: 'CM-00004',
        status: '開通AI軟體1+1',
        name: '陳冠宇',
        phone: '0955-123-987',
        tel: '04-2258-7733',
        line: 'kuanyu_chen',
        email: 'kuanyu@example.com',
        address: '台中市西屯區市政北二路 240 號 15 樓',
        photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
        updatedAt: new Date(now.getTime() - 3 * 86400000).toISOString(),
        memberMid: 'A-00004',
        monolineNodeId: 'C-00004',
        binaryNodeId: 'C-25000518',
      },
    ];
    for (const c of sampleContacts) {
      this.contacts.set(c.id, c);
    }
    this.currentContactCounter = 4;

    // 2. 聯繫紀錄 (CONTACT_T / CT-)
    // headers: ["ID", "狀態", "姓名", "聯繫日期", "聯繫方式", "洽談內容", "下一步計畫", "照片連結", "更新時間"]
    const sampleTrackings: ContactTrackingRecord[] = [
      {
        id: 'CT-00001',
        status: '開通體驗',
        name: '王大明',
        contactDate: new Date(now.getTime() - 15 * 86400000).toISOString().split('T')[0],
        contactMethod: '線上開通',
        discussionContent: '新會員開通 AI 軟體 1+1 (第 1 組單軌體驗 C-00001 + 第 2 組雙軌卡位 C-25000515)，已啟動 30 天雙發免費體驗。',
        nextStepPlan: '引導登入 AI 軟體系統體驗 15 代公排互助與雙軌滑落，邀約參加 EM-00001 實體說明會。',
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
        updatedAt: new Date(now.getTime() - 15 * 86400000).toISOString(),
        contactId: 'CM-00001',
        memberMid: 'A-00001',
      },
      {
        id: 'CT-00002',
        status: '已洽談',
        name: '李美華',
        contactDate: new Date(now.getTime() - 8 * 86400000).toISOString().split('T')[0],
        contactMethod: 'Line',
        discussionContent: '會員反饋 AI 軟體操作流暢，深入了解 100 元月租閉環平帳算力池機制，有意開展新北板橋地區團隊。',
        nextStepPlan: '安排前往板橋教育中心 (EDU-BANQIAO-01) 進行經營店長進階培訓。',
        photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
        updatedAt: new Date(now.getTime() - 8 * 86400000).toISOString(),
        contactId: 'CM-00002',
        memberMid: 'A-00002',
      },
      {
        id: 'CT-00003',
        status: '待跟進',
        name: '張志豪',
        contactDate: new Date(now.getTime() - 3 * 86400000).toISOString().split('T')[0],
        contactMethod: '電話訪問',
        discussionContent: '協助指導雙軌安置樹狀圖閱讀方式，說明 BFS 智慧滑落至全網第一個開放空缺之價值。',
        nextStepPlan: '於下週一回訪續約情況，協助規劃月租 100% 閉環分潤池。',
        photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
        updatedAt: new Date(now.getTime() - 3 * 86400000).toISOString(),
        contactId: 'CM-00003',
        memberMid: 'A-00003',
      },
    ];
    for (const t of sampleTrackings) {
      this.contactTrackings.set(t.id, t);
    }
    this.currentTrackingCounter = 3;

    // 3. 活動主檔 (EVENT_M / EM-)
    // headers: ["ID", "狀態", "活動主題", "日期", "地點", "預算", "負責人", "備註", "照片連結", "更新時間"]
    const sampleEvents: EventMasterRecord[] = [
      {
        id: 'EM-00001',
        status: '報名中',
        eventTheme: '【全台首發】新會員開通 AI 軟體 1+1 實體啟航說明會',
        date: '2026-11-20',
        location: '台北市大安區忠孝東路四段 128 號 12 樓 (台北教育中心)',
        budget: 35000,
        leader: '王大明 (A-00001)',
        notes: '現場安排 AI 軟體 1+1 雙發開通教學、100% 閉環撥發平帳公式解析與精緻茶點。',
        photoUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=80',
        updatedAt: new Date(now.getTime() - 5 * 86400000).toISOString(),
        participantsCount: 86,
      },
      {
        id: 'EM-00002',
        status: '籌備中',
        eventTheme: '產銷合一物流直銷單軌轉雙軌全省領袖戰略研討會',
        date: '2026-11-28',
        location: '台中市西屯區市政北二路 240 號 15 樓 (台中教育中心)',
        budget: 60000,
        leader: '陳冠宇 (A-00004)',
        notes: '全國 6 代輔導經營店店長與 6 代教育訓練總監聯席會議，研擬連鎖擴店戰略。',
        photoUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&auto=format&fit=crop&q=80',
        updatedAt: new Date(now.getTime() - 2 * 86400000).toISOString(),
        participantsCount: 42,
      },
    ];
    for (const e of sampleEvents) {
      this.events.set(e.id, e);
    }
    this.currentEventCounter = 2;

    // 4. 活動花絮 (EVENT_T / ET-)
    // headers: ["ID", "狀態", "活動主題", "照片標題", "拍攝地點", "內容備註", "照片連結", "更新時間"]
    const sampleEventTrackings: EventTrackingRecord[] = [
      {
        id: 'ET-00001',
        status: '公開發布',
        eventTheme: '新會員開通 AI 軟體 1+1 實體啟航說明會',
        photoTitle: '百位新會員現場實機開通 AI 軟體 1+1 雙通道',
        shootLocation: '台北國際教育培訓中心 演講大廳',
        contentNotes: '學員現場體驗單軌公排與雙軌二元樹卡位，氣氛熱烈，全員達成當日開通體驗指標！',
        photoUrl: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800&auto=format&fit=crop&q=80',
        updatedAt: new Date(now.getTime() - 4 * 86400000).toISOString(),
        eventId: 'EM-00001',
      },
      {
        id: 'ET-00002',
        status: '公開發布',
        eventTheme: '產銷合一物流直銷單軌轉雙軌全省領袖戰略研討會',
        photoTitle: '總公司與全國經營店長宣誓 100% 閉環零沉澱平帳',
        shootLocation: '台中市政教育中心 會議廳',
        contentNotes: '各區總監共同簽署加盟公約，齊心落實全齡人口 0~100 歲互助產銷生態。',
        photoUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&auto=format&fit=crop&q=80',
        updatedAt: new Date(now.getTime() - 1 * 86400000).toISOString(),
        eventId: 'EM-00002',
      },
    ];
    for (const et of sampleEventTrackings) {
      this.eventTrackings.set(et.id, et);
    }
    this.currentEventTrackingCounter = 2;
  }

  private saveState() {
    try {
      const payload = {
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

    // 1. 分配會員代號 (A-碼) 與單軌節點編號 (C-碼) - 從 A-00001 建檔起編
    this.currentMonolineCounter += 1;
    const monolineMid = `A-${String(this.currentMonolineCounter).padStart(5, '0')}`;
    const monolineNodeId = `C-${String(this.currentMonolineCounter).padStart(5, '0')}`;
    const previousMonolineNodeId = this.currentMonolineCounter === 1
      ? 'HQ_ROOT'
      : `C-${String(this.currentMonolineCounter - 1).padStart(5, '0')}`;

    // 推薦人預設為旗艦領袖 A-00001113
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

    // 3. 建立【第二組 AI 軟體節點 (雙軌卡位分身)】
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
    const userPhoto =
      (params.photoUrl || '').trim() ||
      `https://images.unsplash.com/photo-${1534528741775 + (this.currentContactCounter % 10)}?w=200&auto=format&fit=crop&q=80`;

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
      photoUrl: record.photoUrl?.trim() || '',
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
      photoUrl: record.photoUrl?.trim() || '',
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
      photoUrl: record.photoUrl?.trim() || '',
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
      photoUrl: record.photoUrl.trim(),
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
      this.currentMonolineCounter = Number(snapshot.counters.currentMonolineCounter ?? this.members.size);
      this.currentBinaryCounter = Number(snapshot.counters.currentBinaryCounter ?? 25000514);
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
        ([, c]) => !c.ownerMid || c.ownerMid === selfMid
      );
      const ownTrackings = Array.from(this.contactTrackings.entries()).filter(
        ([, t]) => !t.memberMid || t.memberMid === selfMid || t.name === selfMember?.name
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

    let importedMembers = 0;
    let importedMonoline = 0;
    let importedBinary = 0;
    let importedContacts = 0;
    let importedTrackings = 0;

    if (Array.isArray(payload.members)) {
      for (const row of payload.members) {
        const mid = String(row?.mid || '').trim().toUpperCase();
        if (!mid) continue;
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
            String(row?.photoUrl || existing?.photoUrl || '').trim() ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
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
        const node: NodeRecord = {
          nodeId,
          mid,
          name: String(row?.name || existing?.name || nodeId).trim(),
          type: 'MONOLINE',
          track: 'MONOLINE',
          status: (row?.status as NodeStatus) || existing?.status || 'TRIAL_ACTIVE',
          parentId: String(row?.parentId || existing?.parentId || 'HQ_ROOT').trim(),
          placementPosition: 'MONOLINE_QUEUE',
          depth: Number(row?.depth ?? existing?.depth ?? 1),
          sponsorMid: String(row?.sponsorMid || existing?.sponsorMid || GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID)
            .trim()
            .toUpperCase(),
          hqPermanentLocked: Boolean(row?.hqPermanentLocked ?? existing?.hqPermanentLocked ?? false),
          trialExpiresAt: parseIso(row?.trialExpiresAt, GLOBAL_BOUNDARIES.TRIAL_DAYS * 86400000),
          totalEarnings: Number(row?.totalEarnings ?? existing?.totalEarnings ?? 0),
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
        const posRaw = String(row?.placementPosition || existing?.placementPosition || 'L').trim().toUpperCase();
        const placementPosition: NodeRecord['placementPosition'] =
          posRaw === 'ROOT' || posRaw === 'L' || posRaw === 'R' ? posRaw : 'L';
        const node: NodeRecord = {
          nodeId,
          mid: String(row?.mid || existing?.mid || GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID).trim().toUpperCase(),
          name: String(row?.name || existing?.name || nodeId).trim(),
          type:
            nodeId === GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID
              ? 'BINARY_ROOT'
              : existing?.type || 'BINARY_MEMBER_SLOT',
          track: 'BINARY',
          status: (row?.status as NodeStatus) || existing?.status || 'TRIAL_ACTIVE',
          parentId: String(row?.parentId || existing?.parentId || GLOBAL_BOUNDARIES.BINARY_ROOT_NODE_ID).trim(),
          placementPosition,
          depth: Number(row?.depth ?? existing?.depth ?? 1),
          leftChildId: String(row?.leftChildId || existing?.leftChildId || '').trim().toUpperCase() || undefined,
          rightChildId: String(row?.rightChildId || existing?.rightChildId || '').trim().toUpperCase() || undefined,
          sponsorMid: String(row?.sponsorMid || existing?.sponsorMid || GLOBAL_BOUNDARIES.FLAGSHIP_SPONSOR_MID)
            .trim()
            .toUpperCase(),
          hqPermanentLocked: Boolean(row?.hqPermanentLocked ?? existing?.hqPermanentLocked ?? false),
          trialExpiresAt: parseIso(row?.trialExpiresAt, GLOBAL_BOUNDARIES.TRIAL_DAYS * 86400000),
          totalEarnings: Number(row?.totalEarnings ?? existing?.totalEarnings ?? 0),
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
            String(row?.photoUrl || existing?.photoUrl || '').trim() ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
          updatedAt: parseIso(row?.updatedAt),
          memberMid: existing?.memberMid,
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
            contact.memberMid = m.mid;
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
            String(row?.photoUrl || existing?.photoUrl || '').trim() ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
          updatedAt: parseIso(row?.updatedAt),
          contactId: existing?.contactId,
          memberMid: existing?.memberMid,
        };
        this.contactTrackings.set(tid, rec);
        importedTrackings++;

        const ctNum = parseInt(tid.replace(/^CT-/, ''), 10);
        if (!isNaN(ctNum) && ctNum > this.currentTrackingCounter) {
          this.currentTrackingCounter = ctNum;
        }
      }
    }

    this.saveState();
    return {
      importedMembers,
      importedMonoline,
      importedBinary,
      importedContacts,
      importedTrackings,
    };
  }
}

export const serverErpEngine = new ERPEngine();

