/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
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
} from '../types/erp';
import { initNewMemberDefaultPacks } from './memberFiveStarConfig';
import {
  apiSyncErpAction,
  ScopedBootstrapPayload,
} from './confidentialApiClient';

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
  FLAGSHIP_SPONSOR_MID: 'A-00008', // 永吉家族直推起點 (公司自營 #08)
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
  // 3. 第 3 種 AI 系統：個人預約系統
  private bookingProfiles: Map<string, BookingProfile> = new Map();
  private bookingAppointments: Map<string, BookingAppointment> = new Map();
  private isHydratingFromServer: boolean = false;
  private skipNestedSync: boolean = false;

  private currentMonolineCounter: number = 68; // A-00001~A-00063 公司自營不得轉讓；A-00064~A-00068 永吉家族已建檔
  private currentBinaryCounter: number = 25000068; // C-25000001~C-25000063 公司自營；C-25000064 起對外開放
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
    // 方案 B 保密原則：未登入前瀏覽器記憶體維持完全空白，禁止預載任何總部/會員資料或密碼。
  }

  /**
   * 清除前端所有記憶體投影資料（登出時呼叫）
   */
  public clearProjection() {
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
    this.currentMonolineCounter = 63;
    this.currentBinaryCounter = 25000063;
    this.currentContactCounter = 0;
    this.currentTrackingCounter = 0;
    this.currentEventCounter = 0;
    this.currentEventTrackingCounter = 0;
    this.currentBookingLicenseCounter = 0;
    this.currentAppointmentCounter = 0;
    this.publicSafetyAccumulated = 0;
    this.abanyTechAccumulated = 0;
    this.hqOpsAccumulated = 0;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  /**
   * 僅接收經由後端伺服器依登入身分嚴格過濾後的授權資料切片
   */
  public hydrateFromServer(bootstrap: ScopedBootstrapPayload | null | undefined) {
    if (!bootstrap || !bootstrap.snapshot) return;
    this.isHydratingFromServer = true;
    try {
      const snap = bootstrap.snapshot;
      this.members = new Map(snap.members || []);
      this.monolineNodes = new Map(snap.monolineNodes || []);
      this.binaryNodes = new Map(snap.binaryNodes || []);
      this.stores = new Map(snap.stores || []);
      this.centers = new Map(snap.centers || []);
      this.contacts = new Map(snap.contacts || []);
      this.contactTrackings = new Map(snap.contactTrackings || []);
      this.events = new Map(snap.events || []);
      this.eventTrackings = new Map(snap.eventTrackings || []);
      this.bookingProfiles = new Map(snap.bookingProfiles || []);
      this.bookingAppointments = new Map(snap.bookingAppointments || []);
      this.settlements = Array.isArray(snap.settlements) ? [...snap.settlements] : [];

      if (snap.counters) {
        this.currentMonolineCounter = Math.max(63, Number(snap.counters.currentMonolineCounter ?? 63));
        this.currentBinaryCounter = Math.max(25000063, Number(snap.counters.currentBinaryCounter ?? 25000063));
        this.currentContactCounter = Number(snap.counters.currentContactCounter ?? this.contacts.size);
        this.currentTrackingCounter = Number(snap.counters.currentTrackingCounter ?? this.contactTrackings.size);
        this.currentEventCounter = Number(snap.counters.currentEventCounter ?? this.events.size);
        this.currentEventTrackingCounter = Number(snap.counters.currentEventTrackingCounter ?? this.eventTrackings.size);
        this.currentBookingLicenseCounter = Number(snap.counters.currentBookingLicenseCounter ?? this.bookingProfiles.size);
        this.currentAppointmentCounter = Number(snap.counters.currentAppointmentCounter ?? this.bookingAppointments.size);
      }

      if (snap.pools) {
        this.publicSafetyAccumulated = Number(snap.pools.publicSafetyAccumulated ?? 0);
        this.abanyTechAccumulated = Number(snap.pools.abanyTechAccumulated ?? 0);
        this.hqOpsAccumulated = Number(snap.pools.hqOpsAccumulated ?? 0);
      }
    } finally {
      this.isHydratingFromServer = false;
    }
  }

  private syncServer(action: string, payload: Record<string, any> = {}) {
    if (this.isHydratingFromServer || this.skipNestedSync) return;
    void apiSyncErpAction(action, payload);
  }

  /**
   * 僅總部授權後透過伺服器端執行系統重設
   */
  public initializeSystem(forceReset: boolean = false) {
    if (forceReset) {
      void apiSyncErpAction('initializeSystem', { forceReset: true }).then((res) => {
        if (res.ok && res.bootstrap) {
          this.hydrateFromServer(res.bootstrap);
        }
      });
    }
  }

  private saveState() {
    // 方案 B：資料不再明文落地瀏覽器 localStorage，全面由後端伺服器持久化管理。
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
    const userPhoto = (params.photoUrl || '').trim();
    const userIdNumberMasked = (params.idNumberMasked || '').trim();

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
      idNumberMasked: userIdNumberMasked,
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
      nextStepPlan: params.nextStepPlan || '引導登入全能五星系統使用通訊錄 CRM 與活動行銷',
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
      const prevSkip = this.skipNestedSync;
      this.skipNestedSync = true;
      try {
        bookingProfile = this.activateBookingTrial(monolineMid);
      } finally {
        this.skipNestedSync = prevSkip;
      }
    }

    this.saveState();
    this.syncServer('registerNewMember', params as Record<string, any>);

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
          const prevSkip = this.skipNestedSync;
          this.skipNestedSync = true;
          try {
            settlement = this.execute100PointsClosedLoopSettlement(existingNode.nodeId, 100);
          } finally {
            this.skipNestedSync = prevSkip;
          }
        } else {
          if (params.status) existingNode.status = params.status;
          if (params.expiresAt) existingNode.trialExpiresAt = params.expiresAt;
          this.saveState();
        }
        this.syncServer('allocateBinaryNodeForSoftware', params as Record<string, any>);
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
      const prevSkip = this.skipNestedSync;
      this.skipNestedSync = true;
      try {
        settlement = this.execute100PointsClosedLoopSettlement(binaryNodeId, 100);
      } finally {
        this.skipNestedSync = prevSkip;
      }
    } else {
      this.saveState();
    }

    this.syncServer('allocateBinaryNodeForSoftware', params as Record<string, any>);
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
    this.syncServer('execute100PointsClosedLoopSettlement', { nodeId: targetNodeId, paidAmount: amount });
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
    let result: SettlementBreakdown;
    const prevSkip = this.skipNestedSync;
    this.skipNestedSync = true;
    try {
      result = this.execute100PointsClosedLoopSettlement(targetNodeId, 100);
    } finally {
      this.skipNestedSync = prevSkip;
    }

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
    this.syncServer('renewMemberMonthlyFee', { mid });
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
    this.syncServer('updateMemberProfile', { mid, updates });
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

    const prevSkip = this.skipNestedSync;
    this.skipNestedSync = true;
    try {
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
    } finally {
      this.skipNestedSync = prevSkip;
    }

    this.syncServer('seedMultiGenReferralChain', { rootMid, targetDepth });
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
    this.syncServer('registerNewStore', params as Record<string, any>);
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
    this.syncServer('registerNewCenter', params as Record<string, any>);
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

    const prevSkip = this.skipNestedSync;
    this.skipNestedSync = true;
    try {
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
    } finally {
      this.skipNestedSync = prevSkip;
    }

    this.saveState();
    this.syncServer('executeBatchSettlement', params as Record<string, any>);

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
    this.syncServer('addContact', record as Record<string, any>);
    return newContact;
  }

  public updateContact(id: string, updates: Partial<ContactMasterRecord>): ContactMasterRecord | null {
    const existing = this.contacts.get(id);
    if (!existing) return null;
    Object.assign(existing, updates, { updatedAt: new Date().toISOString() });
    this.saveState();
    this.syncServer('updateContact', { contactId: id, updates });
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
    this.syncServer('addContactTracking', record as Record<string, any>);
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
    this.syncServer('updateContactTracking', { trackingId: id, updates });
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
    this.syncServer('addEvent', record as Record<string, any>);
    return newEvent;
  }

  public updateEvent(id: string, updates: Partial<EventMasterRecord>): EventMasterRecord | null {
    const existing = this.events.get(id);
    if (!existing) return null;
    Object.assign(existing, updates, { updatedAt: new Date().toISOString() });
    this.saveState();
    this.syncServer('updateEvent', { eventId: id, updates });
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
    this.syncServer('addEventTracking', record as Record<string, any>);
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
    this.syncServer('updateEventTracking', { trackingId: id, updates });
    return existing;
  }

  // ================= 3. 四大系統角色登入與身分驗證 API (全面移至後端伺服器) =================

  public getHqStaffAccounts(): HqStaffAccount[] {
    return [];
  }

  public authenticateRole(
    _role: UserRole,
    _identifier: string,
    _passcode?: string
  ): { success: boolean; session?: AuthSession; error?: string } {
    return {
      success: false,
      error: '安全性限制：所有身分驗證必須透過伺服器安全驗證閘道完成。',
    };
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
        const prevSkip = this.skipNestedSync;
        this.skipNestedSync = true;
        try {
          const allocated = this.allocateBinaryNodeForSoftware({
            memberMid: key,
            softwareKey: 'BOOKING',
            softwareTitle: '個人預約系統',
            status: existing.status === 'ACTIVE_RENEWED' ? 'ACTIVE_RENEWED' : 'TRIAL_ACTIVE',
            expiresAt: existing.expiresAt || trialExp,
            executeSettlement: false,
          });
          existing.binaryNodeId = allocated.binaryNode.nodeId;
        } finally {
          this.skipNestedSync = prevSkip;
        }
        changed = true;
      }
      if (changed) this.saveState();
      this.syncServer('activateBookingTrial', { ownerMid, options });
      return existing;
    }

    const member = this.getMember(key);
    const ownerName = member ? member.name : key;
    this.currentBookingLicenseCounter += 1;
    const licenseId = `BK-${String(this.currentBookingLicenseCounter).padStart(5, '0')}`;

    let boundBinaryNodeId: string | undefined;
    if (options?.allocateBinaryNode) {
      const prevSkip = this.skipNestedSync;
      this.skipNestedSync = true;
      try {
        const allocated = this.allocateBinaryNodeForSoftware({
          memberMid: key,
          softwareKey: 'BOOKING',
          softwareTitle: '個人預約系統',
          status: 'TRIAL_ACTIVE',
          expiresAt: trialExp,
          executeSettlement: false,
        });
        boundBinaryNodeId = allocated.binaryNode.nodeId;
      } finally {
        this.skipNestedSync = prevSkip;
      }
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
    this.syncServer('activateBookingTrial', { ownerMid, options });
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
    const prevSkip = this.skipNestedSync;
    this.skipNestedSync = true;
    let allocated: ReturnType<ERPEngine['allocateBinaryNodeForSoftware']>;
    try {
      if (!profile) {
        profile = this.activateBookingTrial(key, { allocateBinaryNode: true });
      }

      allocated = this.allocateBinaryNodeForSoftware({
        memberMid: key,
        softwareKey: 'BOOKING',
        softwareTitle: '個人預約系統',
        existingBinaryNodeId: options?.forceNewSlot ? undefined : profile.binaryNodeId,
        forceNewSlot: Boolean(options?.forceNewSlot),
        expiresAt: profile.expiresAt,
        executeSettlement: true,
      });
    } finally {
      this.skipNestedSync = prevSkip;
    }

    if (!profile.binaryNodeId) {
      profile.binaryNodeId = allocated.binaryNode.nodeId;
    }

    profile.expiresAt = allocated.binaryNode.trialExpiresAt;
    profile.status = 'ACTIVE_RENEWED';
    profile.totalRenewalsCount += 1;

    this.saveState();
    this.syncServer('renewBookingMonthlyFee', { ownerMid, options });
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
    this.syncServer('updateBookingProfile', { ownerMid, updates });
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
    this.syncServer('addBookingService', { ownerMid, service });
    return newSrv;
  }

  public toggleBookingService(ownerMid: string, serviceId: string): boolean {
    const profile = this.bookingProfiles.get(ownerMid.trim().toUpperCase());
    if (!profile) return false;
    const srv = profile.services.find((s) => s.id === serviceId);
    if (!srv) return false;
    srv.isActive = !srv.isActive;
    this.saveState();
    this.syncServer('toggleBookingService', { ownerMid, serviceId });
    return true;
  }

  public deleteBookingService(ownerMid: string, serviceId: string): boolean {
    const profile = this.bookingProfiles.get(ownerMid.trim().toUpperCase());
    if (!profile) return false;
    const before = profile.services.length;
    profile.services = profile.services.filter((s) => s.id !== serviceId);
    if (profile.services.length !== before) {
      this.saveState();
      this.syncServer('deleteBookingService', { ownerMid, serviceId });
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
    const prevSkip = this.skipNestedSync;
    this.skipNestedSync = true;
    let apt: BookingAppointment;
    try {
      const profile = this.bookingProfiles.get(key) || this.activateBookingTrial(key);
      const srv = params.serviceId
        ? profile.services.find((s) => s.id === params.serviceId)
        : profile.services.find((s) => s.isActive) || profile.services[0];

      this.currentAppointmentCounter += 1;
      const appointmentId = `APT-${String(this.currentAppointmentCounter).padStart(5, '0')}`;

      const reasonText = params.reason?.trim() || '';
      const detailText = params.detail?.trim() || '';
      const notesText = params.notes?.trim() || '';

      apt = {
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
    } finally {
      this.skipNestedSync = prevSkip;
    }

    this.saveState();
    this.syncServer('createAppointment', params as Record<string, any>);
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
    this.syncServer('updateAppointmentStatus', { appointmentId, status, convertedMid });
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
    this.syncServer('restoreCoreLedgerSnapshot', { snapshot });
    return {
      members: this.members.size,
      monolineNodes: this.monolineNodes.size,
      binaryNodes: this.binaryNodes.size,
      settlements: this.settlements.length,
    };
  }
}

export const erpEngine = new ERPEngine();
