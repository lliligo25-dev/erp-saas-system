/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NodeStatus = 'HQ_LOCKED' | 'TRIAL_ACTIVE' | 'ACTIVE_RENEWED' | 'EXPIRED_FROZEN';

export type NodeType = 'MONOLINE' | 'BINARY_ROOT' | 'BINARY_HQ_POOL' | 'BINARY_MEMBER_SLOT';

export interface Member {
  mid: string; // e.g. A-00000001 ~ A-25000000, A-25000001+
  name: string;
  phone: string;
  idNumberMasked: string;
  sponsorMid: string; // 直推推薦人 MID (例如 A-00001113)
  storeId: string;    // 所屬經營店 ID (預設 S-001)
  centerId: string;   // 所屬教育中心 ID (預設 C-001)
  registeredAt: string;
  trialExpiresAt: string;
  accumulatedRentAmount: number; // 零錢池 (未滿100元暫存)
  monolineNodeId: string; // 第 1 組 AI 軟體節點 (C-00000001 ~ C-25000000)
  binaryNodeId: string;   // 第 2 組 AI 軟體節點 (C-25000001 起)
  tel?: string;           // 電話
  line?: string;          // Line ID
  email?: string;         // Email
  address?: string;       // 通訊地址
  photoUrl?: string;      // 照片連結
  contactId?: string;     // 通訊主檔編號 (CM-xxxxx)
  cloudFolderId?: string;        // 會員專屬雲端資料夾 ID
  cloudFolderName?: string;      // 會員專屬雲端資料夾名稱
  cloudFolderUrl?: string;       // Google Drive 專屬資料夾連結
  cloudSpreadsheetId?: string;   // 會員專屬 Google 試算表 ID
  cloudSpreadsheetName?: string; // 會員專屬 Google 試算表名稱
  cloudSpreadsheetUrl?: string;  // Google 試算表專屬連結
}

export interface NodeRecord {
  nodeId: string; // C-碼
  mid: string;    // 對應會員 MID (A-碼)
  name: string;
  type: NodeType;
  track: 'MONOLINE' | 'BINARY';
  status: NodeStatus;
  parentId: string; // 安置父節點 ID
  placementPosition?: 'L' | 'R' | 'MONOLINE_QUEUE' | 'ROOT';
  leftChildId?: string;
  rightChildId?: string;
  depth: number;
  sponsorMid: string;
  hqPermanentLocked: boolean;
  trialExpiresAt: string;
  totalEarnings: number;
  lastRenewalAt?: string;
  softwareKey?: string;   // 綁定之 AI 軟體模組代碼 (e.g. BOOKING, TODO, ATOMY, PRODUCT...)
  softwareTitle?: string; // 綁定之 AI 軟體顯示名稱
}

export interface SettlementBreakdown {
  transactionId: string;
  nodeId: string;
  mid: string;
  paidAmount: number; // 100 元
  isCircuitBreaker: boolean; // 是否觸發未續約 50% 熔斷
  timestamp: string;
  
  // 15 代推薦分紅 (15.0 點)
  sponsorBonuses: Array<{
    generation: number;
    targetMid: string;
    points: number;
    status: 'PAID' | 'CIRCUIT_BREAKER_HALF';
  }>;
  totalSponsorPoints: number;

  // 15 代雙軌安置排線分紅 (15.0 點)
  placementBonuses: Array<{
    generation: number;
    targetNodeId: string;
    targetMid: string;
    points: number;
    status: 'PAID' | 'CIRCUIT_BREAKER_HALF';
  }>;
  totalPlacementPoints: number;

  // 6 代經營店輔導補貼 (6.0 點)
  storeSubsidies: Array<{
    generation: number;
    targetStoreId: string;
    points: number;
  }>;
  totalStorePoints: number;

  // 6 代教育中心培訓補貼 (6.0 點)
  centerSubsidies: Array<{
    generation: number;
    targetCenterId: string;
    points: number;
  }>;
  totalCenterPoints: number;

  // 科技與營運池 (固定 30% + 28%)
  abanyTechPoolPoints: number; // 30.0 點
  hqOperationsPoolPoints: number; // 28.0 點

  // 公共安全基金池 (若發生熔斷折半，其餘點數歸此)
  publicSafetyPoolPoints: number;

  // 驗證總和
  totalDistributed: number; // 必須嚴格等於 100.0
}

export interface SystemStats {
  totalMembers: number;
  monolineNodesCount: number;
  binaryNodesCount: number;
  totalSettlementsCount: number;
  totalRentCollected: number;
  totalPointsDistributed: number;
  abanyTechAccumulated: number;
  hqOpsAccumulated: number;
  publicSafetyAccumulated: number;
}

export interface MemberFullNodeReport {
  member: Member;
  // 名下所有持有節點 (含第1組單軌、第2組雙軌、自營池等)
  ownedMonolineNodes: NodeRecord[];
  ownedBinaryNodes: NodeRecord[];
  totalOwnedNodesCount: number;

  // 雙軌傘下安置組織 (以主雙軌節點為根)
  binaryDownline: {
    rootNodeId: string;
    leftLegNodes: NodeRecord[];
    rightLegNodes: NodeRecord[];
    totalDownlineCount: number;
    maxDepthUnder: number;
  };

  // 單軌向上 15 代互助上線 & 向下 15 代互助下線
  monolineAid: {
    nodeId: string;
    upstream15Nodes: NodeRecord[];
    downstream15Nodes: NodeRecord[];
  };

  // 直推體系
  referrals: {
    directReferralMembers: Member[]; // 直推第1代下線
    upstreamSponsors: string[];       // 向上直推鏈
  };

  // 向下直推 15 代各代人數與 15 代總人數詳細矩陣
  downstream15Gen: Downstream15GenSummary;

  // 財務與收益總結
  financialSummary: {
    accumulatedRentAmount: number;
    totalEarningsFromAllNodes: number;
    monolineEarnings: number;
    binaryEarnings: number;
  };
}

export interface GenerationReferralDetail {
  generation: number; // 第 1 代 ~ 第 15 代
  count: number;      // 該代人數
  members: Member[];  // 該代會員實體名單
  potentialMonthlyBonus: number; // 預估每月直推分紅 (1.0 點/人)
}

export interface Downstream15GenSummary {
  targetMid: string;
  generations: GenerationReferralDetail[]; // 1 到 15 代明細
  total15GenCount: number;                // 15 代直推總人數
  totalPotentialMonthlyBonus: number;     // 15 代每月推薦分紅總潛力
  maxActiveGeneration: number;            // 最深組織代數深度
}

export interface StoreRecord {
  storeId: string;             // 店號，例如 S-HQ-01, S-TAIPEI-01
  name: string;                // 店鋪名稱
  managerMid: string;          // 負責店長 MID
  managerName: string;         // 店長姓名
  phone: string;               // 營業電話
  address: string;             // 營業門市地址
  parentStoreId?: string;      // 輔導母店 ID (向上第 1 代輔導店)
  establishedAt: string;       // 簽約成立日期
  status: 'ACTIVE' | 'PROBATION' | 'FROZEN';
  totalSubsidyPoints: number;  // 累積獲得之 6 代經營店輔導補貼點數
  balance: number;             // 可提領餘額點數
}

export interface StoreMentoringGeneration {
  generation: number;          // 第 1 代 ~ 第 6 代輔導店
  count: number;               // 該代輔導經營店數
  stores: StoreRecord[];       // 該代輔導店名冊
  totalMembersInGen: number;   // 該代輔導店下轄會員總數
  subsidyPointsEarned: number; // 累計貢獻之輔導補貼點數 (每期 1.0 點/人)
}

export interface StoreDetailReport {
  store: StoreRecord;
  // 向上 6 代輔導母店追溯鏈 (Upstream Mentoring Store Chain)
  upstreamStores: StoreRecord[];
  // 向下 6 代輔導子店矩陣 (Downstream 6-Gen Mentoring Stores)
  downstreamGenerations: StoreMentoringGeneration[];
  totalMentoredStoresCount: number; // 6 代輔導店總數
  totalDownlineMembersCount: number;// 6 代輔導店下轄會員總數
  estimatedMonthlySubsidy: number;  // 預計月輔導收益 (1.0 點 × 活躍會員數)
  // 本店直接綁定之會員名單
  boundMembers: Member[];
  // 近期 6 代輔導補貼進帳紀錄
  recentSubsidyRecords: Array<{
    transactionId: string;
    fromMemberMid: string;
    fromMemberName: string;
    fromStoreId: string;
    generation: number;
    points: number;
    timestamp: string;
  }>;
}

export interface EducationCenterRecord {
  centerId: string;            // 中心代號，例如 EDU-HQ-01, EDU-TAIPEI-01
  name: string;                // 教育中心名稱
  directorMid: string;         // 中心負責人/總監 MID
  directorName: string;        // 總監姓名
  phone: string;               // 營業電話
  address: string;             // 培訓教室地址
  parentCenterId?: string;     // 輔導母中心 ID (向上第 1 代母中心)
  establishedAt: string;       // 成立日期
  status: 'ACTIVE' | 'PROBATION' | 'FROZEN';
  totalSubsidyPoints: number;  // 累積獲得之 6 代教育中心培訓補貼點數
  balance: number;             // 可提領餘額點數
}

export interface CenterTrainingGeneration {
  generation: number;          // 第 1 代 ~ 第 6 代培訓中心
  count: number;               // 該代教育中心數
  centers: EducationCenterRecord[]; // 該代中心名冊
  totalMembersInGen: number;   // 該代中心下轄學員/會員總數
  subsidyPointsEarned: number; // 累計貢獻之培訓補貼點數 (每期 1.0 點/人)
}

export interface CenterDetailReport {
  center: EducationCenterRecord;
  // 向上 6 代培訓母中心追溯鏈 (Upstream Mentoring Center Chain)
  upstreamCenters: EducationCenterRecord[];
  // 向下 6 代培育子中心矩陣 (Downstream 6-Gen Training Centers)
  downstreamGenerations: CenterTrainingGeneration[];
  totalMentoredCentersCount: number; // 6 代培育中心總數
  totalDownlineMembersCount: number; // 6 代轄下學員/會員總數
  estimatedMonthlySubsidy: number;   // 預估月培訓補貼收益 (1.0 點 × 活躍會員數)
  // 本中心直接綁定之會員/學員名單
  boundMembers: Member[];
  // 近期 6 代培訓補貼進帳紀錄
  recentSubsidyRecords: Array<{
    transactionId: string;
    fromMemberMid: string;
    fromMemberName: string;
    fromCenterId: string;
    generation: number;
    points: number;
    timestamp: string;
  }>;
}

// ================= 1. 通訊錄 CRM 資料結構 =================

/**
 * 通訊主檔 (CONTACT_M / CM-)
 * headers: ["ID", "狀態", "姓名", "手機", "電話", "Line", "Email", "地址", "照片連結", "更新時間"]
 * imgIdx: 8 (照片連結)
 */
export interface ContactMasterRecord {
  id: string;               // ID (prefix: CM-)
  status: string;           // 狀態 (例如: 開通AI軟體1+1, 30天體驗中, 正式會員)
  name: string;             // 姓名
  phone: string;            // 手機
  tel: string;              // 電話
  line: string;             // Line
  email: string;            // Email
  address: string;          // 地址
  photoUrl: string;         // 照片連結 (imgIdx: 8)
  updatedAt: string;        // 更新時間
  memberMid?: string;       // 對應會員 MID (A-碼)
  ownerMid?: string;        // 所屬管理會員 MID (用於會員資料隔離)
  monolineNodeId?: string;  // 第 1 組 AI 軟體節點 (C-碼)
  binaryNodeId?: string;    // 第 2 組 AI 軟體節點 (C-碼)
}

/**
 * 聯繫紀錄 (CONTACT_T / CT-)
 * headers: ["ID", "狀態", "姓名", "聯繫日期", "聯繫方式", "洽談內容", "下一步計畫", "照片連結", "更新時間"]
 * imgIdx: 7 (照片連結)
 */
export interface ContactTrackingRecord {
  id: string;               // ID (prefix: CT-)
  status: string;           // 狀態 (例如: 開通體驗, 已洽談, 待跟進, 預約實體活動)
  name: string;             // 姓名
  contactDate: string;      // 聯繫日期 (YYYY-MM-DD)
  contactMethod: string;    // 聯繫方式 (線上開通, Line, 電話, 面談, Zoom視訊)
  discussionContent: string;// 洽談內容
  nextStepPlan: string;     // 下一步計畫
  photoUrl: string;         // 照片連結 (imgIdx: 7)
  updatedAt: string;        // 更新時間
  contactId?: string;       // 關聯通訊主檔 CM- 編號
  memberMid?: string;       // 關聯會員 MID
  ownerMid?: string;        // 所屬管理會員 MID (用於會員資料隔離)
}

// ================= 2. 活動行銷管理 資料結構 =================

/**
 * 活動主檔 (EVENT_M / EM-)
 * headers: ["ID", "狀態", "活動主題", "日期", "地點", "預算", "負責人", "備註", "照片連結", "更新時間"]
 * imgIdx: 8 (照片連結)
 */
export interface EventMasterRecord {
  id: string;               // ID (prefix: EM-)
  status: string;           // 狀態 (例如: 報名中, 進行中, 圓滿落幕, 籌備中)
  eventTheme: string;       // 活動主題 (例如: 新會員 AI 軟體 1+1 實體啟航說明會)
  date: string;             // 日期
  location: string;         // 地點
  budget: number | string;  // 預算
  leader: string;           // 負責人
  notes: string;            // 備註
  photoUrl: string;         // 照片連結 (imgIdx: 8)
  updatedAt: string;        // 更新時間
  participantsCount?: number;
}

/**
 * 活動花絮 (EVENT_T / ET-)
 * headers: ["ID", "狀態", "活動主題", "照片標題", "拍攝地點", "內容備註", "照片連結", "更新時間"]
 * imgIdx: 6 (照片連結)
 */
export interface EventTrackingRecord {
  id: string;               // ID (prefix: ET-)
  status: string;           // 狀態 (例如: 公開發布, 精選特輯, 存檔)
  eventTheme: string;       // 活動主題
  photoTitle: string;       // 照片標題
  shootLocation: string;    // 拍攝地點
  contentNotes: string;     // 內容備註
  photoUrl: string;         // 照片連結 (imgIdx: 6)
  updatedAt: string;        // 更新時間
  eventId?: string;         // 關聯活動主檔 EM- 編號
}

// ================= 3. 四大系統角色登入與權限隔離架構 =================

export type UserRole = 'HQ_STAFF' | 'MEMBER' | 'STORE' | 'CENTER';

export interface AuthSession {
  role: UserRole;
  userId: string;           // HQ-001, A-00001, S-TAIPEI-01, EDU-TAIPEI-01
  displayName: string;
  title: string;            // 職務 / 身份描述
  scopeLabel: string;       // 資料隔離範圍標記
  loginAt: string;
}

export interface HqStaffAccount {
  staffId: string;
  name: string;
  title: string;
  department: string;
  passcode: string;
  permissions: string[];
}

// ================= 4. 第 3 種 AI 系統：個人預約系統 (30天免費體驗 · 月租100元) =================

export type BookingLicenseStatus = 'NOT_ACTIVATED' | 'TRIAL_ACTIVE' | 'ACTIVE_RENEWED' | 'EXPIRED_FROZEN';

export interface BookingServiceItem {
  id: string;
  title: string;
  durationMinutes: number;
  priceNtd: number;
  description: string;
  isActive: boolean;
  locationType: 'ONLINE_MEET' | 'IN_PERSON' | 'PHONE';
}

export interface BookingProfile {
  licenseId: string;        // BK-00001
  ownerMid: string;         // 所屬會員 MID (A-碼)
  ownerName: string;
  displayTitle: string;     // 預約頁面標題
  bio: string;              // 服務簡介
  status: BookingLicenseStatus;
  activatedAt?: string;
  expiresAt?: string;       // 30天免費體驗 / 月租到期日
  monthlyRentNtd: number;   // 100 元/月 (= 100 點)
  totalRenewalsCount: number;
  workingDays: number[];    // 0 (日) ~ 6 (六)
  startHour: number;        // 例如 9
  endHour: number;          // 例如 20
  slotIntervalMinutes: number; // 30 或 60
  services: BookingServiceItem[];
  binaryNodeId?: string;    // 專屬加入之雙軌二元樹節點 ID (C-2500xxxx)
}

export interface BookingAppointment {
  appointmentId: string;    // APT-00001
  ownerMid: string;         // 受預約會員 MID
  licenseId: string;
  serviceId: string;
  serviceTitle: string;
  date: string;             // YYYY-MM-DD
  timeSlot: string;         // HH:mm
  clientName: string;
  clientPhone: string;      // 手機
  clientTel?: string;       // 電話
  clientLine?: string;
  reason?: string;          // 事由
  notes?: string;           // 備註
  detail?: string;          // 詳細情況
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  convertedToMemberMid?: string;
}



