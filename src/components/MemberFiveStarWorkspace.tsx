/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { erpEngine } from '../services/erpEngine';
import { HorizontalScrollStrip } from './HorizontalScrollStrip';
import {
  SYS_CONFIG,
  INDUSTRY_PACKS,
  DynamicRecord,
  SysModuleConfig,
  getOffsetDateStr,
  getCurrentDateTimeStr,
  getMemberUnlockedPacks,
  saveMemberUnlockedPacks,
  getMemberModuleSubscriptions,
  saveMemberModuleSubscriptions,
  loadMemberDynamicRecords,
  saveMemberDynamicRecords,
  ORDERABLE_SOFTWARE_CATALOG,
} from '../services/memberFiveStarConfig';
import {
  syncMemberPurchasedProductsToNodes,
  notifyNodesUpdated,
} from '../services/softwareNodeSync';
import {
  CLOUD_VAULT_UPDATED_EVENT,
  ensureMemberCloudWorkspace,
  getModuleWritePermission,
  renewMemberModuleNow,
  setModuleExpiryStateForTest,
  syncMemberCloudWorkspaceWithGas,
} from '../services/memberCloudVaultService';
import {
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  FONT_UPDATED_EVENT,
  FontFamilyKey,
  FontPreferences,
  loadFontPreferences,
  saveFontPreferences,
} from '../services/fontPreferences';
import {
  ContactMasterRecord,
  ContactTrackingRecord,
  EventMasterRecord,
  EventTrackingRecord,
  BookingAppointment,
  Member,
  NodeRecord,
} from '../types/erp';
import {
  Menu,
  Search,
  Share2,
  Plus,
  Home,
  Contact,
  FileText,
  Calendar,
  Image as ImageIcon,
  CalendarClock,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  Edit3,
  Camera,
  FolderOpen,
  Send,
  Zap,
  X,
  Check,
  Maximize2,
  UserPlus,
  Layers,
  Sparkles,
  CheckCircle2,
  Network,
  Sliders,
  TrendingUp,
  Play,
  DollarSign,
  ArrowUpLeft,
  ArrowRight,
  GitBranch,
  Package,
  Scissors,
  HeartPulse,
  Apple,
  ShoppingBasket,
  Building2,
  Activity,
  ShoppingBag,
  ListTodo,
  AlertTriangle,
  Lock,
  Unlock,
  Table,
  CreditCard,
  RefreshCw,
  Copy,
} from 'lucide-react';
import { SoftwareOrderSystemView } from './SoftwareOrderSystemView';
import { PersonalTodoBoard } from './PersonalTodoBoard';
import {
  getOverdueCount,
  syncMemberTodosToGas,
  TODOS_UPDATED_EVENT,
  notifyTodosUpdated,
} from '../services/gasTodoSyncService';

type ActiveSysKey = 'ALL' | 'ORG_TREE' | 'BOOKING' | 'ORDER_STORE' | 'TODO_BOARD' | keyof typeof SYS_CONFIG;
type AspectMode = '16/9' | '3/4' | '4/3' | '1/1' | 'detail';
type DateFilterMode = 'ALL' | 'TODAY' | 'TOMORROW' | 'DAY_AFTER' | 'WEEK';

interface UnifiedCardItem {
  id: string;
  sysType: string;
  sysLabel: string;
  baseKey: string;
  isMaster: boolean;
  title: string;
  channel: string;
  subtitle: string;
  status: string;
  photoUrl: string;
  updatedAt: string;
  avatarChar: string;
  avatarBg: string;
  dateValues: string[];
  rawFields: DynamicRecord;
  fieldsDisplay: Array<{ label: string; value: string }>;
  bookingApt?: BookingAppointment;
  contactMaster?: ContactMasterRecord;
}

interface MemberFiveStarWorkspaceProps {
  memberMid: string;
  initialOrgNodeId?: string;
  onNavigateToPortal?: () => void;
  onNavigateToBooking?: () => void;
  onNodesChanged?: () => void;
  onNavigateToRegisterWithClient?: (client: {
    name: string;
    phone: string;
    line?: string;
    sponsorMid: string;
  }) => void;
}

const BASE_GRADIENTS: Record<string, { badge: string; bg: string; gradient: string }> = {
  CONTACT: { badge: '通訊 CRM', bg: '#065fd4', gradient: 'from-blue-600 via-sky-500 to-cyan-400' },
  EVENT: { badge: '活動行銷', bg: '#d97706', gradient: 'from-amber-500 via-orange-500 to-rose-500' },
  ATOMY: { badge: '經銷組織', bg: '#4f46e5', gradient: 'from-indigo-600 via-blue-500 to-cyan-500' },
  ELDER: { badge: '銀髮關懷', bg: '#0d9488', gradient: 'from-teal-600 via-emerald-500 to-green-400' },
  PRODUCT: { badge: '產銷訂單', bg: '#ea580c', gradient: 'from-orange-600 via-amber-500 to-yellow-500' },
  FRUIT: { badge: '生鮮蔬果', bg: '#16a34a', gradient: 'from-green-600 via-lime-500 to-emerald-400' },
  GROCERY: { badge: '居家庫存', bg: '#0284c7', gradient: 'from-sky-600 via-cyan-500 to-teal-400' },
  NAIL: { badge: '美甲預約', bg: '#db2777', gradient: 'from-pink-600 via-rose-500 to-fuchsia-400' },
  ASSOC: { badge: '公會聯誼', bg: '#7c3aed', gradient: 'from-violet-600 via-purple-500 to-indigo-400' },
  TCM: { badge: '推拿養生', bg: '#b45309', gradient: 'from-amber-700 via-orange-600 to-yellow-500' },
  BOOKING: { badge: '第3種 AI', bg: '#059669', gradient: 'from-emerald-600 via-teal-500 to-cyan-500' },
  TODO: { badge: '代辦事項', bg: '#2563eb', gradient: 'from-blue-600 via-indigo-500 to-violet-500' },
};

const SETTLED_STATUSES = ['已完成', '已成交', '已出貨', '已結案', '賣出', '已繳'];
const STARTABLE_STATUSES = ['預約中', '待處理', '入庫', '跟進中', '未繳'];
const EXECUTABLE_STATUSES = ['執行中', '進行中', '處理中', '施作中'];

function getPackIcon(baseKey: string) {
  switch (baseKey) {
    case 'CONTACT':
      return Contact;
    case 'EVENT':
      return Calendar;
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
    default:
      return FileText;
  }
}

function findAmountFieldId(conf?: SysModuleConfig): string | null {
  if (!conf) return null;
  const f = conf.fields.find((fld) =>
    ['消費金額', '總金額', '金額'].includes(fld.id)
  );
  return f ? f.id : null;
}

function getRecordDateValues(conf: SysModuleConfig | undefined, rec: DynamicRecord): string[] {
  if (!conf) return [];
  const vals: string[] = [];
  conf.fields.forEach((f) => {
    if (f.type === 'date' && rec[f.id]) {
      vals.push(rec[f.id].slice(0, 10));
    }
  });
  return vals;
}

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('讀取圖片失敗'));
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl !== 'string') {
        reject(new Error('圖片格式無效'));
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        const maxWidth = 1000;
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.65));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export const MemberFiveStarWorkspace: React.FC<MemberFiveStarWorkspaceProps> = ({
  memberMid,
  initialOrgNodeId,
  onNavigateToPortal,
  onNavigateToBooking,
  onNodesChanged,
  onNavigateToRegisterWithClient,
}) => {
  const [refreshTick, setRefreshTick] = useState(0);
  const triggerRefresh = () => setRefreshTick((t) => t + 1);

  // Unlocked Industry Packs per member
  const [unlockedPacks, setUnlockedPacks] = useState<string[]>(() =>
    getMemberUnlockedPacks(memberMid)
  );
  const [packModalOpen, setPackModalOpen] = useState(false);

  // Navigation & View States
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [activeSys, setActiveSys] = useState<ActiveSysKey>(() => (initialOrgNodeId ? 'ORG_TREE' : 'ALL'));
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilterMode>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [fontScalePx, setFontScalePx] = useState<number>(() => loadFontPreferences().sizePx);
  const [fontFamilyKey, setFontFamilyKey] = useState<FontFamilyKey>(() => loadFontPreferences().family);

  useEffect(() => {
    const onFontUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent<FontPreferences>).detail;
      if (detail) {
        setFontScalePx(detail.sizePx);
        setFontFamilyKey(detail.family);
      }
    };
    window.addEventListener(FONT_UPDATED_EVENT, onFontUpdated);
    return () => window.removeEventListener(FONT_UPDATED_EVENT, onFontUpdated);
  }, []);

  useEffect(() => {
    const onTodosUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent<{ memberMid?: string }>).detail;
      if (!detail?.memberMid || detail.memberMid === memberMid) {
        setRefreshTick((t) => t + 1);
      }
    };
    const onCloudUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent<{ memberMid?: string }>).detail;
      if (!detail?.memberMid || detail.memberMid === memberMid) {
        setRefreshTick((t) => t + 1);
      }
    };
    window.addEventListener(TODOS_UPDATED_EVENT, onTodosUpdated);
    window.addEventListener(CLOUD_VAULT_UPDATED_EVENT, onCloudUpdated);
    return () => {
      window.removeEventListener(TODOS_UPDATED_EVENT, onTodosUpdated);
      window.removeEventListener(CLOUD_VAULT_UPDATED_EVENT, onCloudUpdated);
    };
  }, [memberMid]);

  const updateWorkspaceFont = (next: Partial<FontPreferences>) => {
    const merged: FontPreferences = {
      family: next.family ?? fontFamilyKey,
      sizePx: next.sizePx ?? fontScalePx,
    };
    setFontFamilyKey(merged.family);
    setFontScalePx(merged.sizePx);
    saveFontPreferences(merged);
  };
  const [aspectMode, setAspectMode] = useState<AspectMode>('16/9');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Player preview banner state
  const [playerItem, setPlayerItem] = useState<UnifiedCardItem | null>(null);

  // Multi-select LINE Share Mode state
  const [shareMode, setShareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [shareGroupName, setShareGroupName] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Lightbox state
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxZoomed, setLightboxZoomed] = useState(false);

  // Right Slide-Over Drawer state (View / Edit / Create)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create'>('view');
  const [drawerItem, setDrawerItem] = useState<UnifiedCardItem | null>(null);
  const [formDrawerExpanded, setFormDrawerExpanded] = useState(true);

  // Dynamic Form State
  const [formTargetSys, setFormTargetSys] = useState<string>('CONTACT_M');
  const [formValues, setFormValues] = useState<DynamicRecord>({});
  const [formPhotoUrl, setFormPhotoUrl] = useState<string>('');

  // Inline Checkout Modal (Zero window.prompt)
  const [checkoutModalItem, setCheckoutModalItem] = useState<UnifiedCardItem | null>(null);
  const [checkoutAmountInput, setCheckoutAmountInput] = useState<string>('0');

  // Scoped ORG_TREE Explorer State
  const [orgInspectNodeId, setOrgInspectNodeId] = useState<string>(() => initialOrgNodeId || '');
  const [orgSearchQuery, setOrgSearchQuery] = useState<string>('');

  // Cloud Folder & Spreadsheet Vault Modal State
  const [cloudModalOpen, setCloudModalOpen] = useState(false);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [vaultTestModuleKey, setVaultTestModuleKey] = useState<string>('CONTACT');

  useEffect(() => {
    if (initialOrgNodeId) {
      setOrgInspectNodeId(initialOrgNodeId);
      setActiveSys('ORG_TREE');
    }
  }, [initialOrgNodeId]);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3400);
  };

  // Load strictly scoped data for logged-in member
  const member: Member | undefined = erpEngine.getMemberById(memberMid);
  const report = erpEngine.getMemberFullNodeReport(memberMid);
  const bookingProfile = erpEngine.getBookingProfile(memberMid);

  const directReferralMids = useMemo(() => {
    const set = new Set<string>([memberMid]);
    report?.referrals.directReferralMembers.forEach((m) => set.add(m.mid));
    return set;
  }, [memberMid, report]);

  // Build unified items across all unlocked modules + BOOKING
  const allModuleItems = useMemo(() => {
    const list: UnifiedCardItem[] = [];

    // Helper to push a DynamicRecord based on SYS_CONFIG
    const pushConfigRecord = (
      sysType: string,
      rec: DynamicRecord,
      extra?: {
        subtitleOverride?: string;
        channelOverride?: string;
        contactMaster?: ContactMasterRecord;
      }
    ) => {
      const conf = SYS_CONFIG[sysType];
      if (!conf) return;
      const gMeta = BASE_GRADIENTS[conf.baseKey] || BASE_GRADIENTS.CONTACT;
      const nameVal = rec[conf.nameField] || rec['姓名'] || rec['品名'] || rec['活動主題'] || rec.ID || '未命名';
      const statusVal = rec[conf.catField] || conf.defaultCat;
      const line1Val = rec[conf.cardLine1.key] || '-';
      const line2Val = rec[conf.cardLine2.key] || '-';

      const fieldsDisplay: Array<{ label: string; value: string }> = [
        { label: 'ID 編號', value: rec.ID || '-' },
      ];
      conf.fields.forEach((f) => {
        fieldsDisplay.push({
          label: f.label.replace(' *', ''),
          value: rec[f.id] || '-',
        });
      });
      if (rec['更新時間']) {
        fieldsDisplay.push({ label: '更新時間', value: rec['更新時間'] });
      }

      list.push({
        id: rec.ID,
        sysType,
        sysLabel: conf.name,
        baseKey: conf.baseKey,
        isMaster: sysType.endsWith('_M'),
        title: nameVal,
        channel: extra?.channelOverride || `${gMeta.badge} · ${conf.name}`,
        subtitle:
          extra?.subtitleOverride ||
          `${conf.cardLine1.label}: ${line1Val} · ${conf.cardLine2.label}: ${line2Val}`,
        status: statusVal,
        photoUrl: rec['照片連結'] || '',
        updatedAt: rec['更新時間'] || new Date().toISOString(),
        avatarChar: nameVal.slice(0, 1) || '資',
        avatarBg: gMeta.bg,
        dateValues: getRecordDateValues(conf, rec),
        rawFields: rec,
        fieldsDisplay,
        contactMaster: extra?.contactMaster,
      });
    };

    // 1. CONTACT_M & CONTACT_T (from erpEngine, strictly scoped to memberMid + direct referrals)
    if (unlockedPacks.includes('CONTACT')) {
      erpEngine.getAllContacts().forEach((c: ContactMasterRecord) => {
        const isOwned =
          c.ownerMid === memberMid ||
          (c.memberMid && directReferralMids.has(c.memberMid));
        if (!isOwned) return;
        pushConfigRecord(
          'CONTACT_M',
          {
            ID: c.id,
            狀態: c.status,
            姓名: c.name,
            手機: c.phone,
            電話: c.tel || '',
            Line: c.line || '',
            Email: c.email || '',
            地址: c.address || '',
            照片連結: c.photoUrl || '',
            更新時間: new Date(c.updatedAt).toLocaleString(),
          },
          {
            channelOverride: `通訊主檔 · ${c.memberMid || '個人開發名單'}`,
            subtitleOverride: `${c.phone} · Line: ${c.line || '未填'}`,
            contactMaster: c,
          }
        );
      });

      erpEngine.getAllContactTrackings().forEach((t: ContactTrackingRecord) => {
        const isOwned =
          t.ownerMid === memberMid ||
          (t.memberMid && directReferralMids.has(t.memberMid));
        if (!isOwned) return;
        pushConfigRecord(
          'CONTACT_T',
          {
            ID: t.id,
            狀態: t.status,
            姓名: t.name,
            聯繫日期: t.contactDate,
            聯繫方式: t.contactMethod,
            洽談內容: t.discussionContent,
            下一步計畫: t.nextStepPlan || '',
            照片連結: t.photoUrl || '',
            更新時間: new Date(t.updatedAt).toLocaleString(),
          },
          {
            channelOverride: `聯繫紀錄 · ${t.contactDate}`,
            subtitleOverride: `${t.contactMethod} · ${t.discussionContent}`,
          }
        );
      });
    }

    // 2. EVENT_M & EVENT_T (from erpEngine)
    if (unlockedPacks.includes('EVENT')) {
      erpEngine.getAllEvents().forEach((ev: EventMasterRecord) => {
        pushConfigRecord(
          'EVENT_M',
          {
            ID: ev.id,
            狀態: ev.status,
            活動主題: ev.eventTheme,
            日期: ev.date,
            負責人: ev.leader,
            預算: String(ev.budget ?? ''),
            地點: ev.location,
            備註: ev.notes || '',
            照片連結: ev.photoUrl || '',
            更新時間: new Date(ev.updatedAt).toLocaleString(),
          },
          {
            channelOverride: `活動公告 · ${ev.date}`,
            subtitleOverride: `${ev.location} · 負責人 ${ev.leader}`,
          }
        );
      });

      erpEngine.getAllEventTrackings().forEach((et: EventTrackingRecord) => {
        pushConfigRecord(
          'EVENT_T',
          {
            ID: et.id,
            狀態: et.status,
            活動主題: et.eventTheme,
            照片標題: et.photoTitle,
            拍攝地點: et.shootLocation,
            內容備註: et.contentNotes,
            照片連結: et.photoUrl || '',
            更新時間: new Date(et.updatedAt).toLocaleString(),
          },
          {
            channelOverride: `活動花絮 · ${et.eventTheme}`,
            subtitleOverride: `${et.shootLocation} · ${et.contentNotes}`,
          }
        );
      });
    }

    // 3. Dual-Track Modules (BOOKING_M + 8 Industry Packs scoped to memberMid)
    unlockedPacks.forEach((baseKey) => {
      if (baseKey === 'CONTACT' || baseKey === 'EVENT') return;
      const mKey = `${baseKey}_M`;
      const tKey = `${baseKey}_T`;
      if (SYS_CONFIG[mKey]) {
        const recs = loadMemberDynamicRecords(memberMid, mKey);
        recs.forEach((r) => pushConfigRecord(mKey, r));
      }
      if (baseKey !== 'BOOKING' && SYS_CONFIG[tKey]) {
        const recs = loadMemberDynamicRecords(memberMid, tKey);
        recs.forEach((r) => pushConfigRecord(tKey, r));
      }
    });

    // 4. Scoped 個人預約系統 (BOOKING_T) Appointments
    erpEngine.getAppointmentsByOwner(memberMid).forEach((apt) => {
      const statusLabel =
        apt.status === 'PENDING'
          ? '待確認預約'
          : apt.status === 'CONFIRMED'
          ? '已確認時段'
          : apt.status === 'COMPLETED'
          ? '已完成服務'
          : '已取消';
      list.push({
        id: apt.appointmentId,
        sysType: 'BOOKING_T',
        sysLabel: '2. 個人預約明細',
        baseKey: 'BOOKING',
        isMaster: false,
        title: `${apt.clientName} · ${apt.serviceTitle}`,
        channel: `第 3 種 AI 預約 (${apt.licenseId})`,
        subtitle: `${apt.date} ${apt.timeSlot} · ${apt.clientPhone}`,
        status: statusLabel,
        photoUrl: '',
        updatedAt: apt.createdAt,
        avatarChar: apt.clientName.slice(0, 1) || '預',
        avatarBg: '#059669',
        dateValues: [apt.date],
        rawFields: {
          ID: apt.appointmentId,
          狀態: statusLabel,
          姓名: apt.clientName,
          手機: apt.clientPhone,
          電話: apt.clientTel || '',
          預約日期: apt.date,
          預約時段: apt.timeSlot,
          事由: apt.reason || apt.serviceTitle,
          備註: apt.notes || '',
          詳細情況: apt.detail || '',
        },
        fieldsDisplay: [
          { label: '預約單號', value: apt.appointmentId },
          { label: '預約授權碼', value: `${apt.licenseId} (30天免費體驗·月租100元)` },
          { label: '狀態', value: statusLabel },
          { label: '預約人姓名', value: apt.clientName },
          { label: '手機號碼', value: apt.clientPhone },
          { label: '市話 / 電話', value: apt.clientTel || '-' },
          { label: 'Line ID', value: apt.clientLine || '-' },
          { label: '事由 / 預約項目', value: apt.reason || apt.serviceTitle },
          { label: '預約日期與時間', value: `${apt.date} ${apt.timeSlot}` },
          { label: '備註', value: apt.notes || '-' },
          { label: '詳細情況', value: apt.detail || '-' },
        ],
        bookingApt: apt,
      });
    });

    return list;
  }, [memberMid, directReferralMids, unlockedPacks, refreshTick]);

  // Active SYS_CONFIG when viewing a specific dual-track module
  const activeConf: SysModuleConfig | undefined =
    activeSys !== 'ALL' &&
    activeSys !== 'ORG_TREE' &&
    activeSys !== 'BOOKING' &&
    activeSys !== 'ORDER_STORE' &&
    activeSys !== 'TODO_BOARD'
      ? SYS_CONFIG[activeSys]
      : undefined;

  const cloudVault = useMemo(
    () => ensureMemberCloudWorkspace(memberMid),
    [memberMid, refreshTick]
  );

  const activeModulePerm = useMemo(() => {
    if (activeConf) {
      return getModuleWritePermission(memberMid, activeConf.baseKey);
    }
    if (activeSys === 'BOOKING') {
      return getModuleWritePermission(memberMid, 'BOOKING');
    }
    return null;
  }, [memberMid, activeConf, activeSys, refreshTick]);

  const hasDateFieldInActive = useMemo(() => {
    if (activeSys === 'BOOKING') return true;
    if (!activeConf) return false;
    return activeConf.fields.some((f) => f.type === 'date');
  }, [activeSys, activeConf]);

  // Counts per sysType
  const sysCounts = useMemo(() => {
    const map: Record<string, number> = { ALL: allModuleItems.length, BOOKING_T: 0 };
    allModuleItems.forEach((item) => {
      map[item.sysType] = (map[item.sysType] || 0) + 1;
    });
    map.BOOKING = map.BOOKING_T || 0;
    return map;
  }, [allModuleItems]);

  const overdueTodoCount = useMemo(
    () => getOverdueCount(memberMid),
    [memberMid, refreshTick]
  );

  // Items currently belonging to selected activeSys
  const sysScopedItems = useMemo(() => {
    if (activeSys === 'ALL') return allModuleItems;
    if (activeSys === 'ORG_TREE' || activeSys === 'ORDER_STORE' || activeSys === 'TODO_BOARD') return [];
    if (activeSys === 'BOOKING') {
      return allModuleItems.filter((item) => item.sysType === 'BOOKING_T' || item.sysType === 'BOOKING');
    }
    return allModuleItems.filter((item) => item.sysType === activeSys);
  }, [allModuleItems, activeSys]);

  // Category chip counts within current activeSys
  const catChipCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: sysScopedItems.length };
    sysScopedItems.forEach((item) => {
      counts[item.status] = (counts[item.status] || 0) + 1;
    });
    return counts;
  }, [sysScopedItems]);

  // Revenue KPI Calculation for _T modules with an amount field
  const revenueKpi = useMemo(() => {
    if (!activeConf || !activeConf.key.endsWith('_T')) return null;
    const amountKey = findAmountFieldId(activeConf);
    if (!amountKey) return null;

    const todayStr = getOffsetDateStr(0);
    const monthPrefix = todayStr.slice(0, 7);
    let todayTotal = 0;
    let monthTotal = 0;
    let settledCount = 0;

    sysScopedItems.forEach((item) => {
      if (!SETTLED_STATUSES.includes(item.status)) return;
      const amt = Number(item.rawFields[amountKey] || 0);
      if (isNaN(amt)) return;
      settledCount += 1;

      const endDt = item.rawFields['結束時間'] || '';
      const dateStr =
        endDt.slice(0, 10) ||
        item.dateValues[0] ||
        (item.rawFields['更新時間'] ? todayStr : '');

      if (dateStr === todayStr) {
        todayTotal += amt;
      }
      if (!dateStr || dateStr.startsWith(monthPrefix)) {
        monthTotal += amt;
      }
    });

    return {
      amountLabel: amountKey,
      todayTotal,
      monthTotal,
      settledCount,
    };
  }, [activeConf, sysScopedItems]);

  // Final filtered card items
  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const today = getOffsetDateStr(0);
    const tomorrow = getOffsetDateStr(1);
    const dayAfter = getOffsetDateStr(2);
    const weekEnd = getOffsetDateStr(6);

    return sysScopedItems.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;

      if (dateFilter !== 'ALL' && hasDateFieldInActive) {
        const dv = item.dateValues;
        if (dv.length === 0) return false;
        if (dateFilter === 'TODAY' && !dv.some((d) => d === today)) return false;
        if (dateFilter === 'TOMORROW' && !dv.some((d) => d === tomorrow)) return false;
        if (dateFilter === 'DAY_AFTER' && !dv.some((d) => d === dayAfter)) return false;
        if (dateFilter === 'WEEK' && !dv.some((d) => d >= today && d <= weekEnd)) return false;
      }

      if (!q) return true;
      return (
        item.id.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.channel.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q)
      );
    });
  }, [sysScopedItems, statusFilter, dateFilter, hasDateFieldInActive, searchTerm]);

  // Unlocked module options for "Create" select dropdown
  const unlockedModuleKeys = useMemo(() => {
    const keys: string[] = [];
    unlockedPacks.forEach((base) => {
      if (SYS_CONFIG[`${base}_M`]) keys.push(`${base}_M`);
      if (SYS_CONFIG[`${base}_T`]) keys.push(`${base}_T`);
    });
    return keys;
  }, [unlockedPacks]);

  // Scoped ORG_TREE permitted node IDs (strictly rooted at memberMid's own subtree!)
  const scopedOrgData = useMemo(() => {
    if (!report) return null;
    const rootBiId = report.member.binaryNodeId;
    const allowedBiSet = new Set<string>([rootBiId]);
    report.binaryDownline.leftLegNodes.forEach((n) => allowedBiSet.add(n.nodeId));
    report.binaryDownline.rightLegNodes.forEach((n) => allowedBiSet.add(n.nodeId));
    report.ownedBinaryNodes.forEach((n) => allowedBiSet.add(n.nodeId));

    const currentNodeId =
      orgInspectNodeId && allowedBiSet.has(orgInspectNodeId) ? orgInspectNodeId : rootBiId;
    const subtree = erpEngine.getBinarySubtree(currentNodeId, 3);
    const canGoUp = currentNodeId !== rootBiId && Boolean(subtree?.parentId && allowedBiSet.has(subtree.parentId));

    const allAccessibleNodes: NodeRecord[] = [
      ...report.ownedBinaryNodes,
      ...report.binaryDownline.leftLegNodes,
      ...report.binaryDownline.rightLegNodes,
    ];
    // Deduplicate
    const uniqueMap = new Map<string, NodeRecord>();
    allAccessibleNodes.forEach((n) => uniqueMap.set(n.nodeId, n));

    return {
      rootBiId,
      allowedBiSet,
      currentNodeId,
      subtree,
      canGoUp,
      downlineNodesList: Array.from(uniqueMap.values()),
    };
  }, [report, orgInspectNodeId, refreshTick]);

  // Switch system handler
  const handleSwitchSys = (sysKey: ActiveSysKey) => {
    setActiveSys(sysKey);
    setStatusFilter('ALL');
    setDateFilter('ALL');
    setPlayerItem(null);
    setMobileSidebarOpen(false);
    if (sysKey === 'ORG_TREE' && report?.member.binaryNodeId) {
      setOrgInspectNodeId(report.member.binaryNodeId);
    }
  };

  // Toggle industry pack (allocates a Binary Tree node when newly unlocked)
  const handleTogglePack = (baseKey: string) => {
    if (baseKey === 'CONTACT' || baseKey === 'EVENT') {
      showToast('「通訊錄 CRM」與「活動行銷」為新會員 1+1 AI 軟體標配，不可停用');
      return;
    }
    const exists = unlockedPacks.includes(baseKey);
    const next = exists
      ? unlockedPacks.filter((k) => k !== baseKey)
      : [...unlockedPacks, baseKey];
    setUnlockedPacks(next);
    saveMemberUnlockedPacks(memberMid, next);

    if (!exists) {
      const packMeta = INDUSTRY_PACKS.find((p) => p.baseKey === baseKey);
      const packTitle = packMeta?.title || baseKey;
      const now = new Date();
      const expIso = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();

      if (baseKey === 'BOOKING') {
        const bk = erpEngine.activateBookingTrial(memberMid, { allocateBinaryNode: true });
        showToast(`已開通「${packTitle}」並同步排入雙軌節點 ${bk.binaryNodeId || ''}`);
      } else {
        const subs = getMemberModuleSubscriptions(memberMid, member?.trialExpiresAt);
        const cur = subs[baseKey];
        const allocated = erpEngine.allocateBinaryNodeForSoftware({
          memberMid,
          softwareKey: baseKey,
          softwareTitle: packTitle,
          existingBinaryNodeId: cur?.binaryNodeId,
          status: 'TRIAL_ACTIVE',
          expiresAt: cur?.expiresAt || expIso,
          executeSettlement: false,
        });
        subs[baseKey] = {
          moduleKey: baseKey,
          licenseCode: cur?.licenseCode || `SW-${baseKey}-${memberMid.replace(/[^A-Z0-9]/gi, '')}`,
          status: cur && cur.status !== 'NOT_ORDERED' ? cur.status : 'TRIAL_ACTIVE',
          activatedAt: cur?.activatedAt || now.toISOString(),
          expiresAt: cur?.expiresAt || expIso,
          monthlyRentNtd: 100,
          totalRenewalsCount: cur?.totalRenewalsCount || 0,
          binaryNodeId: allocated.binaryNode.nodeId,
          binaryParentId: allocated.binaryNode.parentId,
          binaryPosition:
            allocated.binaryNode.placementPosition === 'L' || allocated.binaryNode.placementPosition === 'R'
              ? allocated.binaryNode.placementPosition
              : undefined,
          binaryDepth: allocated.binaryNode.depth,
        };
        saveMemberModuleSubscriptions(memberMid, subs);
        if (allocated.isNewlyAllocated) {
          showToast(`已開通「${packTitle}」並加入雙軌節點 ${allocated.binaryNode.nodeId}！`);
        }
      }
      syncMemberPurchasedProductsToNodes(memberMid);
      notifyNodesUpdated(memberMid);
      onNodesChanged?.();
    } else if (typeof activeSys === 'string' && activeSys.startsWith(`${baseKey}_`)) {
      setActiveSys('ALL');
    }
    triggerRefresh();
  };

  // Share mode handlers
  const handleToggleShareMode = () => {
    const next = !shareMode;
    setShareMode(next);
    if (!next) setSelectedIds([]);
  };

  const handleToggleSelectCard = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleExecuteShare = () => {
    if (selectedIds.length === 0) {
      showToast('請先點選至少 1 張要分享的資料卡片');
      return;
    }
    const targetGroup = shareGroupName.trim() || '未指定群組 (已複製精選卡片摘要)';
    const chosen = allModuleItems.filter((i) => selectedIds.includes(i.id));
    const lines = chosen.map(
      (c, idx) => `${idx + 1}. [${c.id}] ${c.title} (${c.status}) - ${c.subtitle}`
    );
    const shareText = `【藍海 AI SaaS 全能五星系統 · 會員分享】\n發送人：${member?.name || memberMid} (${memberMid})\n目標 LINE 群組：${targetGroup}\n---\n${lines.join('\n')}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareText).catch(() => {});
    }
    showToast(`已將 ${chosen.length} 筆精選資料彙整發送至「${targetGroup}」（同步複製剪貼簿）`);
    setShareMode(false);
    setSelectedIds([]);
    setShareGroupName('');
  };

  // Helper to build default values for a SYS_CONFIG form
  const buildDefaultFormValues = (sysKey: string, overrides?: DynamicRecord): DynamicRecord => {
    const conf = SYS_CONFIG[sysKey] || SYS_CONFIG.CONTACT_M;
    const vals: DynamicRecord = {};
    const today = getOffsetDateStr(0);

    conf.fields.forEach((f) => {
      if (f.id === conf.catField) {
        vals[f.id] =
          statusFilter !== 'ALL' && conf.cats.includes(statusFilter)
            ? statusFilter
            : conf.defaultCat;
      } else if (f.type === 'date') {
        vals[f.id] = f.id === '生日' ? '' : today;
      } else if (f.type === 'select' && f.options && f.options.length > 0) {
        vals[f.id] = f.options[0];
      } else {
        vals[f.id] = '';
      }
    });

    if (sysKey === 'EVENT_M' && !overrides?.['負責人']) {
      vals['負責人'] = `${member?.name || memberMid} (${memberMid})`;
    }
    if (sysKey === 'ATOMY_M' && !overrides?.['推薦人']) {
      vals['推薦人'] = memberMid;
    }
    if (sysKey === 'FRUIT_T' && !overrides?.['經手人']) {
      vals['經手人'] = member?.name || memberMid;
    }

    return { ...vals, ...(overrides || {}) };
  };

  const openDrawerView = (item: UnifiedCardItem) => {
    setDrawerItem(item);
    setDrawerMode('view');
    setDrawerOpen(true);
  };

  const openDrawerCreate = (
    targetSysOverride?: string,
    prefillValues?: DynamicRecord,
    inheritedPhoto?: string
  ) => {
    const fallbackSys =
      activeSys !== 'ALL' &&
      activeSys !== 'ORG_TREE' &&
      activeSys !== 'BOOKING' &&
      activeSys !== 'ORDER_STORE' &&
      activeSys !== 'TODO_BOARD'
        ? activeSys
        : unlockedModuleKeys[0] || 'CONTACT_M';
    const targetSys = targetSysOverride || fallbackSys;

    const perm = getModuleWritePermission(memberMid, targetSys);
    if (!perm.canCreate) {
      showToast(
        perm.readOnlyReason ||
          `「${perm.softwareTitle}」尚未續約，目前僅能查看舊資料，不能新增資料！`
      );
      return;
    }

    setDrawerItem(null);
    setFormTargetSys(targetSys);
    setFormValues(buildDefaultFormValues(targetSys, prefillValues));
    setFormPhotoUrl(inheritedPhoto || '');
    setFormDrawerExpanded(true);
    setDrawerMode('create');
    setDrawerOpen(true);
  };

  const handleEnterEdit = () => {
    if (!drawerItem) return;
    if (drawerItem.sysType === 'BOOKING' || drawerItem.sysType === 'BOOKING_T') {
      setDrawerOpen(false);
      onNavigateToBooking?.();
      return;
    }
    setFormTargetSys(drawerItem.sysType);
    setFormValues({ ...drawerItem.rawFields });
    setFormPhotoUrl(drawerItem.photoUrl || '');
    setFormDrawerExpanded(true);
    setDrawerMode('edit');
  };

  // Master -> Transaction Jump ("建立新紀錄 (自動跳轉)")
  const handleJumpMasterToTrack = (masterItem: UnifiedCardItem) => {
    const conf = SYS_CONFIG[masterItem.sysType];
    if (!conf) return;
    const perm = getModuleWritePermission(memberMid, conf.baseKey);
    if (!perm.canCreate) {
      showToast(
        perm.readOnlyReason ||
          `「${perm.softwareTitle}」尚未續約，僅可查看主檔與歷史紀錄，不能新增追蹤資料！`
      );
      return;
    }
    const tKey = `${conf.baseKey}_T`;
    const tConf = SYS_CONFIG[tKey];
    if (!tConf) return;

    const inheritedName =
      masterItem.rawFields[conf.nameField] || masterItem.title || '';
    const prefill: DynamicRecord = {
      [tConf.nameField]: inheritedName,
    };
    if (masterItem.rawFields['手機']) {
      prefill['手機'] = masterItem.rawFields['手機'];
    }
    if (conf.baseKey === 'PRODUCT' && masterItem.rawFields['價格']) {
      prefill['總金額'] = masterItem.rawFields['價格'];
      prefill['數量'] = '1';
    }

    // Ensure pack is unlocked & switch to _T view
    if (!unlockedPacks.includes(conf.baseKey)) {
      const next = [...unlockedPacks, conf.baseKey];
      setUnlockedPacks(next);
      saveMemberUnlockedPacks(memberMid, next);
    }

    setActiveSys(tKey as ActiveSysKey);
    setStatusFilter('ALL');
    setDateFilter('ALL');
    openDrawerCreate(tKey, prefill, masterItem.photoUrl);
    showToast(`已從 ${masterItem.id} 帶入「${inheritedName}」建立新追蹤紀錄！`);
  };

  // Persist save (Create or Edit) to erpEngine or scoped localStorage
  const persistModuleRecord = (
    sysType: string,
    mode: 'create' | 'edit',
    existingId: string | undefined,
    values: DynamicRecord,
    photoUrl: string
  ): DynamicRecord => {
    const conf = SYS_CONFIG[sysType];
    const nowStr = new Date().toLocaleDateString();

    if (sysType === 'BOOKING_T' && mode === 'create') {
      const apt = erpEngine.createAppointment({
        ownerMid: memberMid,
        date: values['日期'] || getOffsetDateStr(0),
        timeSlot: values['時間'] || '14:00',
        clientName: values['姓名'],
        clientPhone: values['手機'] || values['電話'] || '未填寫',
        clientTel: values['電話'],
        reason: values['事由'],
        notes: values['備註'],
        detail: values['詳細情況'],
      });
      return { ...values, ID: apt.appointmentId, 更新時間: nowStr };
    }

    if (sysType === 'CONTACT_M') {
      if (mode === 'edit' && existingId) {
        erpEngine.updateContact(existingId, {
          status: values['狀態'],
          name: values['姓名'],
          phone: values['手機'],
          tel: values['電話'],
          line: values['Line'],
          email: values['Email'],
          address: values['地址'],
          photoUrl,
        });
        return { ...values, ID: existingId, 照片連結: photoUrl, 更新時間: nowStr };
      } else {
        const rec = erpEngine.addContact({
          status: values['狀態'] || conf.defaultCat,
          name: values['姓名'],
          phone: values['手機'] || '0900-000-000',
          tel: values['電話'],
          line: values['Line'],
          email: values['Email'],
          address: values['地址'],
          photoUrl,
          ownerMid: memberMid,
        });
        return { ...values, ID: rec.id, 照片連結: photoUrl, 更新時間: nowStr };
      }
    }

    if (sysType === 'CONTACT_T') {
      if (mode === 'edit' && existingId) {
        erpEngine.updateContactTracking(existingId, {
          status: values['狀態'],
          name: values['姓名'],
          contactDate: values['聯繫日期'],
          contactMethod: values['聯繫方式'],
          discussionContent: values['洽談內容'],
          nextStepPlan: values['下一步計畫'],
          photoUrl,
        });
        return { ...values, ID: existingId, 照片連結: photoUrl, 更新時間: nowStr };
      } else {
        const rec = erpEngine.addContactTracking({
          status: values['狀態'] || conf.defaultCat,
          name: values['姓名'],
          contactDate: values['聯繫日期'] || getOffsetDateStr(0),
          contactMethod: values['聯繫方式'] || 'Line',
          discussionContent: values['洽談內容'] || '完成初步接洽紀錄',
          nextStepPlan: values['下一步計畫'] || '追蹤後續體驗需求',
          photoUrl,
          ownerMid: memberMid,
          memberMid,
        });
        return { ...values, ID: rec.id, 照片連結: photoUrl, 更新時間: nowStr };
      }
    }

    if (sysType === 'EVENT_M') {
      if (mode === 'edit' && existingId) {
        erpEngine.updateEvent(existingId, {
          status: values['狀態'],
          eventTheme: values['活動主題'],
          date: values['日期'],
          location: values['地點'],
          budget: values['預算'],
          leader: values['負責人'],
          notes: values['備註'],
          photoUrl,
        });
        return { ...values, ID: existingId, 照片連結: photoUrl, 更新時間: nowStr };
      } else {
        const rec = erpEngine.addEvent({
          status: values['狀態'] || conf.defaultCat,
          eventTheme: values['活動主題'],
          date: values['日期'] || getOffsetDateStr(0),
          location: values['地點'] || '地區教育中心',
          budget: Number(values['預算']) || 10000,
          leader: values['負責人'] || member?.name || memberMid,
          notes: values['備註'],
          photoUrl,
        });
        return { ...values, ID: rec.id, 照片連結: photoUrl, 更新時間: nowStr };
      }
    }

    if (sysType === 'EVENT_T') {
      if (mode === 'edit' && existingId) {
        erpEngine.updateEventTracking(existingId, {
          status: values['狀態'],
          eventTheme: values['活動主題'],
          photoTitle: values['照片標題'],
          shootLocation: values['拍攝地點'],
          contentNotes: values['內容備註'],
          photoUrl,
        });
        return { ...values, ID: existingId, 照片連結: photoUrl, 更新時間: nowStr };
      } else {
        const rec = erpEngine.addEventTracking({
          status: values['狀態'] || conf.defaultCat,
          eventTheme: values['活動主題'],
          photoTitle: values['照片標題'] || values['活動主題'],
          shootLocation: values['拍攝地點'] || '活動會場',
          contentNotes: values['內容備註'] || '活動花絮紀錄',
          photoUrl,
        });
        return { ...values, ID: rec.id, 照片連結: photoUrl, 更新時間: nowStr };
      }
    }

    // Dynamic LocalStorage Modules scoped per memberMid
    const list = loadMemberDynamicRecords(memberMid, sysType);
    if (mode === 'edit' && existingId) {
      const savedRec = { ...values, ID: existingId, 照片連結: photoUrl, 更新時間: nowStr };
      const updated = list.map((r) => (r.ID === existingId ? { ...r, ...savedRec } : r));
      saveMemberDynamicRecords(memberMid, sysType, updated);
      if (sysType === 'TODO_T') {
        void syncMemberTodosToGas(memberMid, 'upsertTodo', { todo: savedRec });
        notifyTodosUpdated(memberMid);
      }
      return savedRec;
    } else {
      const prefix = sysType.slice(0, 2) + (sysType.endsWith('_M') ? 'M' : 'T');
      const newId = `${prefix}-${String(Date.now()).slice(-5)}`;
      const newRec: DynamicRecord = {
        ...values,
        ID: newId,
        照片連結: photoUrl,
        更新時間: nowStr,
      };
      saveMemberDynamicRecords(memberMid, sysType, [newRec, ...list]);
      if (sysType === 'TODO_T') {
        void syncMemberTodosToGas(memberMid, 'upsertTodo', { todo: newRec });
        notifyTodosUpdated(memberMid);
      }
      return newRec;
    }
  };

  const handleImageFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setFormPhotoUrl(compressed);
      showToast('已完成圖片壓縮並載入預覽！');
    } catch {
      showToast('載入圖片時發生異常，請重試');
    }
    e.target.value = '';
  };

  const handleSaveDrawer = (continueCreating: boolean) => {
    const conf = SYS_CONFIG[formTargetSys];
    if (!conf) return;

    if (drawerMode === 'create') {
      const perm = getModuleWritePermission(memberMid, formTargetSys);
      if (!perm.canCreate) {
        showToast(
          perm.readOnlyReason ||
            `「${perm.softwareTitle}」未續約，僅能查看舊資料，不可新增紀錄！`
        );
        return;
      }
    }

    // Required field check
    for (const f of conf.fields) {
      if (f.required && !String(formValues[f.id] || '').trim()) {
        showToast(`請填寫必填欄位：${f.label.replace(' *', '')}`);
        return;
      }
    }

    const saved = persistModuleRecord(
      formTargetSys,
      drawerMode === 'edit' ? 'edit' : 'create',
      drawerItem?.id,
      formValues,
      formPhotoUrl
    );

    showToast(
      drawerMode === 'edit'
        ? `已成功更新 ${saved.ID}！`
        : `已成功新增 ${conf.name} (${saved.ID})！`
    );
    triggerRefresh();

    if (continueCreating) {
      const keepStatus = formValues[conf.catField] || conf.defaultCat;
      setDrawerMode('create');
      setDrawerItem(null);
      setFormPhotoUrl('');
      setFormValues(
        buildDefaultFormValues(formTargetSys, { [conf.catField]: keepStatus })
      );
    } else {
      setDrawerOpen(false);
    }
  };

  // Workflow Progression Step 1: 開始推進狀態 (自動打卡)
  const handleStartWorkflow = (item: UnifiedCardItem) => {
    const conf = SYS_CONFIG[item.sysType];
    if (!conf) return;

    let nextStatus = '進行中';
    if (item.status === '預約中') {
      nextStatus = conf.cats.includes('執行中')
        ? '執行中'
        : conf.cats.includes('施作中')
        ? '施作中'
        : '進行中';
    } else if (item.status === '待處理') {
      nextStatus = conf.cats.includes('已出貨')
        ? '已出貨'
        : conf.cats.includes('處理中')
        ? '處理中'
        : '進行中';
    } else if (item.status === '入庫') {
      nextStatus = conf.cats.includes('出庫/吃完') ? '出庫/吃完' : '已完成';
    } else if (item.status === '跟進中') {
      nextStatus = conf.cats.includes('已成交') ? '已成交' : '已結案';
    } else if (item.status === '未繳') {
      nextStatus = conf.cats.includes('已繳') ? '已繳' : '已完成';
    }

    const nowDt = getCurrentDateTimeStr();
    const updatedValues: DynamicRecord = {
      ...item.rawFields,
      [conf.catField]: nextStatus,
    };
    if (conf.fields.some((f) => f.id === '開始時間')) {
      updatedValues['開始時間'] = nowDt;
    }

    persistModuleRecord(item.sysType, 'edit', item.id, updatedValues, item.photoUrl);
    triggerRefresh();
    setDrawerOpen(false);
    showToast(`${item.id} 已推進至「${nextStatus}」（打卡：${nowDt.replace('T', ' ')}）`);
  };

  // Workflow Progression Step 2: Open inline React Checkout Modal
  const handleOpenCheckoutModal = (item: UnifiedCardItem) => {
    const conf = SYS_CONFIG[item.sysType];
    const amtKey = findAmountFieldId(conf);
    const defaultAmt = amtKey ? item.rawFields[amtKey] || '1000' : '0';
    setCheckoutAmountInput(defaultAmt);
    setCheckoutModalItem(item);
  };

  const handleConfirmCheckout = () => {
    if (!checkoutModalItem) return;
    const conf = SYS_CONFIG[checkoutModalItem.sysType];
    if (!conf) return;

    const amtKey = findAmountFieldId(conf);
    const finalStatus = conf.cats.includes('已完成')
      ? '已完成'
      : conf.cats.includes('已成交')
      ? '已成交'
      : conf.cats.includes('已訪視')
      ? '已訪視'
      : conf.cats[conf.cats.length - 1] || '已完成';

    const nowDt = getCurrentDateTimeStr();
    const updatedValues: DynamicRecord = {
      ...checkoutModalItem.rawFields,
      [conf.catField]: finalStatus,
    };
    if (conf.fields.some((f) => f.id === '結束時間')) {
      updatedValues['結束時間'] = nowDt;
    }
    if (amtKey) {
      updatedValues[amtKey] = String(Number(checkoutAmountInput) || 0);
    }

    persistModuleRecord(
      checkoutModalItem.sysType,
      'edit',
      checkoutModalItem.id,
      updatedValues,
      checkoutModalItem.photoUrl
    );
    triggerRefresh();
    setCheckoutModalItem(null);
    setDrawerOpen(false);
    showToast(
      amtKey
        ? `結帳完成！${checkoutModalItem.id} 已轉入「${finalStatus}」並計入營收 NT$ ${Number(checkoutAmountInput || 0).toLocaleString()}`
        : `${checkoutModalItem.id} 已確認完成「${finalStatus}」！`
    );
  };

  const resetAllFilters = () => {
    setActiveSys('ALL');
    setStatusFilter('ALL');
    setDateFilter('ALL');
    setSearchTerm('');
    setPlayerItem(null);
    setMobileSidebarOpen(false);
  };

  // Dynamic font helper
  const fontScaleRatio = fontScalePx / 16;

  // Compute grid classes from selected aspect ratio
  const getGridClassName = () => {
    if (aspectMode === 'detail') {
      return 'grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3 p-4';
    }
    if (aspectMode === '3/4') {
      return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 p-5';
    }
    if (aspectMode === '1/1') {
      return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5 p-5';
    }
    return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 p-5';
  };

  const getThumbnailAspectStyle = (): React.CSSProperties => {
    if (aspectMode === 'detail') return { aspectRatio: '16 / 9' };
    return { aspectRatio: aspectMode };
  };

  const renderThumbnailGraphic = (item: UnifiedCardItem, compact = false) => {
    const gMeta = BASE_GRADIENTS[item.baseKey] || BASE_GRADIENTS.CONTACT;
    const hasValidImg = Boolean(item.photoUrl) && !brokenImages[item.id];

    if (hasValidImg) {
      return (
        <>
          <div
            className="absolute -inset-3 bg-cover bg-center blur-lg opacity-35 scale-110 pointer-events-none"
            style={{ backgroundImage: `url(${item.photoUrl})` }}
          />
          <img
            src={item.photoUrl}
            alt={item.title}
            referrerPolicy="no-referrer"
            onError={() => setBrokenImages((prev) => ({ ...prev, [item.id]: true }))}
            className="w-full h-full object-cover relative z-10 transition-transform duration-500 group-hover:scale-105"
          />
        </>
      );
    }

    return (
      <div
        className={`w-full h-full bg-gradient-to-br ${gMeta.gradient} relative z-10 flex flex-col justify-between p-3.5 text-white select-none`}
      >
        <div className="flex items-center justify-between text-[11px] font-semibold opacity-90">
          <span className="bg-black/25 backdrop-blur-sm px-2 py-0.5 rounded-full font-mono">
            {gMeta.badge}
          </span>
          <span className="font-mono opacity-80">{member?.mid}</span>
        </div>
        {!compact && (
          <div className="my-auto">
            <div className="text-base font-bold leading-snug line-clamp-2 drop-shadow-sm">
              {item.title}
            </div>
            <div className="text-xs opacity-90 mt-1 line-clamp-1">{item.subtitle}</div>
          </div>
        )}
        <div className="flex items-center justify-between text-[11px] opacity-85">
          <span>藍海 AI SaaS 全能五星</span>
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      </div>
    );
  };

  // Recursive renderer for scoped ORG_TREE nodes
  const renderOrgBinaryNode = (treeNode: any, depthLeft: number): React.ReactNode => {
    if (!treeNode) return null;
    const isRootOfView = treeNode.nodeId === scopedOrgData?.currentNodeId;
    const isMine = treeNode.mid === memberMid;
    const leftChild = treeNode.children?.find((c: any) => c.placementPosition === 'L');
    const rightChild = treeNode.children?.find((c: any) => c.placementPosition === 'R');

    return (
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => setOrgInspectNodeId(treeNode.nodeId)}
          className={`w-48 sm:w-52 rounded-xl border p-2.5 text-left transition-all cursor-pointer shadow-xs ${
            isRootOfView
              ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-blue-400'
              : isMine
              ? 'bg-blue-50 border-blue-300 text-slate-900 hover:border-blue-500'
              : 'bg-white border-slate-200 text-slate-800 hover:border-blue-400'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className={isRootOfView ? 'text-sky-300 font-bold' : 'text-[#065fd4] font-bold'}>
              {treeNode.nodeId}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded font-semibold ${
                isRootOfView
                  ? 'bg-white/15 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {treeNode.placementPosition === 'ROOT' ? 'ROOT' : treeNode.placementPosition === 'L' ? '左線 L' : '右線 R'} · Lv.{treeNode.depth}
            </span>
          </div>
          <div className="font-bold text-xs mt-1 truncate">
            {treeNode.memberName} ({treeNode.mid})
          </div>
          {treeNode.softwareTitle && (
            <div
              className={`mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold truncate max-w-full ${
                isRootOfView
                  ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40'
                  : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
              }`}
            >
              {treeNode.softwareTitle}
            </div>
          )}
          <div className={`text-[10px] mt-0.5 flex items-center justify-between ${isRootOfView ? 'text-slate-300' : 'text-slate-500'}`}>
            <span>推薦: {treeNode.sponsorMid}</span>
            <span className="font-mono font-semibold">收益 {treeNode.totalEarnings} 點</span>
          </div>
        </button>

        {depthLeft > 0 && (leftChild || rightChild) && (
          <div className="mt-4 pt-4 border-t border-dashed border-slate-300 grid grid-cols-2 gap-3 sm:gap-6 relative w-full max-w-3xl">
            <div className="flex flex-col items-center">
              {leftChild ? (
                renderOrgBinaryNode(leftChild, depthLeft - 1)
              ) : (
                <div className="w-40 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-2.5 text-center text-[11px] text-slate-400">
                  左線空缺 (待滑落)
                </div>
              )}
            </div>
            <div className="flex flex-col items-center">
              {rightChild ? (
                renderOrgBinaryNode(rightChild, depthLeft - 1)
              ) : (
                <div className="w-40 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-2.5 text-center text-[11px] text-slate-400">
                  右線空缺 (待滑落)
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Determine whether View Drawer offers _M-> _T or _T workflow actions
  const drawerConf = drawerItem ? SYS_CONFIG[drawerItem.sysType] : undefined;
  const drawerAmountKey = findAmountFieldId(drawerConf);
  const canStartWorkflow =
    drawerItem &&
    drawerConf &&
    drawerConf.key.endsWith('_T') &&
    STARTABLE_STATUSES.includes(drawerItem.status);
  const canCheckoutComplete =
    drawerItem &&
    drawerConf &&
    drawerConf.key.endsWith('_T') &&
    (EXECUTABLE_STATUSES.includes(drawerItem.status) ||
      (!SETTLED_STATUSES.includes(drawerItem.status) &&
        drawerItem.status !== '取消' &&
        (Boolean(drawerAmountKey) || drawerItem.sysType === 'ELDER_T')));

  return (
    <div
      className="bg-[#f8fafc] text-[#0f172a] rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col relative min-h-[800px]"
      style={{ fontSize: `${fontScalePx}px` }}
    >
      {/* Inline Notification Toast (Zero window.alert) */}
      {toastMsg && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ================= SUB-HEADER (YouTube-Style Top Bar) ================= */}
      <header className="h-[60px] bg-white border-b border-slate-200 px-3 sm:px-4 flex items-center justify-between gap-2 shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={(e) => {
              const isSimulatedMobile = Boolean(
                e.currentTarget.closest('[data-viewport="mobile"]')
              );
              if (window.innerWidth < 768 || isSimulatedMobile) {
                setMobileSidebarOpen((v) => !v);
              } else {
                setSidebarCollapsed((v) => !v);
              }
            }}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-800 transition-colors cursor-pointer shrink-0"
            title="展開 / 收合側邊欄"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={resetAllFilters}
            className="flex items-center gap-2 text-left cursor-pointer min-w-0"
          >
            <div className="w-8 h-8 rounded-lg bg-[#cc0000] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Contact className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-900 text-sm sm:text-base truncate">
              藍海 AI SaaS 全能五星系統
            </span>
            <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-mono font-semibold shrink-0">
              {member?.mid || memberMid} · 會員資料隔離鎖定
            </span>
          </button>
        </div>

        {/* Center: Pill Search Box */}
        <div className="ais-fivestar-search-desktop hidden md:flex flex-1 max-w-md mx-3">
          <div className="w-full h-10 bg-white border border-slate-300 rounded-full px-4 flex items-center gap-2 shadow-inner focus-within:border-[#065fd4]">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                activeConf
                  ? activeConf.searchMsg.replace('🔍 ', '')
                  : '搜尋姓名、商品、活動、預約單或 ID...'
              }
              className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Multi-select Share + Mobile Search + Red Plus Add */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleToggleShareMode}
            title="多選分享至 LINE 群組"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs ${
              shareMode
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                : 'bg-slate-100 hover:bg-slate-200 text-emerald-700'
            }`}
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setMobileSearchOpen((v) => !v)}
            title="搜尋"
            className="ais-fivestar-mobile-toggle md:hidden w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-800 cursor-pointer"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            type="button"
            disabled={Boolean(activeModulePerm && !activeModulePerm.canCreate)}
            onClick={() => openDrawerCreate()}
            title={
              activeModulePerm && !activeModulePerm.canCreate
                ? '此 AI 軟體未續約：僅能查看舊資料，不能新增資料'
                : '新增目前模組專屬資料'
            }
            className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-transform ${
              activeModulePerm && !activeModulePerm.canCreate
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-[#cc0000] hover:bg-[#b00000] text-white cursor-pointer active:scale-95'
            }`}
          >
            {activeModulePerm && !activeModulePerm.canCreate ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Collapsible Search Bar */}
      {mobileSearchOpen && (
        <div className="ais-fivestar-search-mobile md:hidden bg-white border-b border-slate-200 px-4 py-2.5">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={activeConf ? activeConf.searchMsg : '🔍 搜尋資料...'}
            className="w-full rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-800 focus:outline-none"
          />
        </div>
      )}

      {/* ================= MAIN WRAPPER (Sidebar + Content) ================= */}
      <div className="flex flex-1 relative">
        <div
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden={!mobileSidebarOpen}
          className={`ais-fivestar-sidebar-backdrop fixed inset-0 bg-slate-950/50 backdrop-blur-[1px] z-30 md:hidden transition-opacity duration-200 ${
            mobileSidebarOpen
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* LEFT SIDEBAR (Desktop Collapsible 258px <-> 76px · Mobile Slide-Out Drawer) */}
        <aside
          className={`ais-fivestar-sidebar bg-white border-r border-slate-200 flex flex-col shrink-0 transition-transform md:transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] fixed md:static inset-y-0 left-0 z-40 w-[272px] max-w-[84vw] shadow-2xl md:shadow-none ${
            mobileSidebarOpen
              ? 'ais-sidebar-open translate-x-0 pointer-events-auto'
              : '-translate-x-full pointer-events-none md:translate-x-0 md:pointer-events-auto'
          } ${sidebarCollapsed ? 'md:w-[76px]' : 'md:w-[258px]'}`}
        >
          {/* Mobile Drawer Top Bar with Close Button */}
          <div className="ais-fivestar-mobile-toggle flex md:hidden items-center justify-between px-3.5 h-13 border-b border-slate-200 shrink-0">
            <span className="text-sm font-bold text-slate-900">AI 軟體模組抽屜</span>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="收合模組抽屜"
              className="min-w-[40px] min-h-[40px] rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Sidebar Header: Home + Scoped Org Tree */}
          <div className="pt-2 px-2 shrink-0 space-y-1">
            <button
              type="button"
              onClick={resetAllFilters}
              className={`w-full flex items-center rounded-xl transition-colors cursor-pointer ${
                sidebarCollapsed
                  ? 'flex-col py-2.5 justify-center gap-1'
                  : 'px-3 h-10 gap-3'
              } ${
                activeSys === 'ALL'
                  ? 'bg-slate-200/80 font-bold text-slate-900 border-l-4 border-[#065fd4]'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <Home className="w-5 h-5 text-slate-600 shrink-0" />
              <span className={sidebarCollapsed ? 'text-[10px] truncate' : 'text-sm'}>
                全部模組總覽
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchSys('ORG_TREE')}
              className={`w-full flex items-center rounded-xl transition-colors cursor-pointer ${
                sidebarCollapsed
                  ? 'flex-col py-2.5 justify-center gap-1'
                  : 'px-3 h-10 gap-3'
              } ${
                activeSys === 'ORG_TREE'
                  ? 'bg-slate-200/80 font-bold text-slate-900 border-l-4 border-indigo-600'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <Network className="w-5 h-5 text-indigo-600 shrink-0" />
              <span className={sidebarCollapsed ? 'text-[10px] truncate' : 'text-sm'}>
                組織網矩陣 ({memberMid})
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchSys('BOOKING')}
              className={`w-full flex items-center rounded-xl transition-colors cursor-pointer ${
                sidebarCollapsed
                  ? 'flex-col py-2.5 justify-center gap-1'
                  : 'px-3 h-10 justify-between'
              } ${
                activeSys === 'BOOKING'
                  ? 'bg-slate-200/80 font-bold text-slate-900 border-l-4 border-emerald-600'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className={`flex items-center ${sidebarCollapsed ? 'flex-col gap-1' : 'gap-3'}`}>
                <CalendarClock className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className={sidebarCollapsed ? 'text-[10px] truncate' : 'text-sm'}>
                  AI 個人預約
                </span>
              </div>
              {!sidebarCollapsed && (
                <span className="text-[11px] font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">
                  {sysCounts.BOOKING || 0}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!unlockedPacks.includes('TODO')) {
                  const next = [...unlockedPacks, 'TODO'];
                  setUnlockedPacks(next);
                  saveMemberUnlockedPacks(memberMid, next);
                  syncMemberPurchasedProductsToNodes(memberMid);
                  notifyNodesUpdated(memberMid);
                  onNodesChanged?.();
                  showToast('已免費開通「代辦事項系統 (TODO_M/T)」30 天體驗並同步加入名下節點清冊！');
                }
                handleSwitchSys('TODO_BOARD');
              }}
              className={`w-full flex items-center rounded-xl transition-colors cursor-pointer ${
                sidebarCollapsed
                  ? 'flex-col py-2.5 justify-center gap-1'
                  : 'px-3 h-10 justify-between'
              } ${
                activeSys === 'TODO_BOARD' || activeSys === 'TODO_M' || activeSys === 'TODO_T'
                  ? 'bg-slate-200/80 font-bold text-slate-900 border-l-4 border-blue-600'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className={`flex items-center ${sidebarCollapsed ? 'flex-col gap-1' : 'gap-3'}`}>
                <ListTodo className="w-5 h-5 text-blue-600 shrink-0" />
                <span className={sidebarCollapsed ? 'text-[10px] truncate' : 'text-sm'}>
                  個人待辦任務面板
                </span>
              </div>
              {!sidebarCollapsed && (
                <div className="flex items-center gap-1 shrink-0">
                  {overdueTodoCount > 0 && (
                    <span className="text-[10px] font-bold bg-rose-600 text-white px-1.5 py-0.5 rounded-full">
                      {overdueTodoCount} 逾期
                    </span>
                  )}
                  <span className="text-[11px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
                    {sysCounts.TODO_T || 0}
                  </span>
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSwitchSys('ORDER_STORE')}
              className={`w-full flex items-center rounded-xl transition-colors cursor-pointer ${
                sidebarCollapsed
                  ? 'flex-col py-2.5 justify-center gap-1'
                  : 'px-3 h-10 justify-between'
              } ${
                activeSys === 'ORDER_STORE'
                  ? 'bg-amber-50 font-bold text-amber-950 border-l-4 border-amber-500'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className={`flex items-center ${sidebarCollapsed ? 'flex-col gap-1' : 'gap-3'}`}>
                <ShoppingBag className="w-5 h-5 text-amber-600 shrink-0" />
                <span className={sidebarCollapsed ? 'text-[10px] truncate' : 'text-sm'}>
                  AI 軟體訂購系統
                </span>
              </div>
              {!sidebarCollapsed && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                  30天免費
                </span>
              )}
            </button>

            <hr className="my-2 border-slate-200" />
          </div>

          {/* Sidebar Scroll Body: Unlocked Dual-Track Modules (M + T) + Controls */}
          <div className="flex-1 overflow-y-auto px-2 pb-6 space-y-3">
            {!sidebarCollapsed && (
              <div className="px-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">
                  已開通雙軌模組 ({unlockedPacks.length}/{INDUSTRY_PACKS.length})
                </span>
                <button
                  type="button"
                  onClick={() => setPackModalOpen(true)}
                  className="text-[11px] font-semibold text-[#065fd4] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sliders className="w-3 h-3" />
                  <span>開通設定</span>
                </button>
              </div>
            )}

            <div className="space-y-2.5">
              {INDUSTRY_PACKS.filter((p) => unlockedPacks.includes(p.baseKey)).map((pack) => {
                const IconComp = getPackIcon(pack.baseKey);
                const mKey = `${pack.baseKey}_M`;
                const tKey = `${pack.baseKey}_T`;
                const mConf = SYS_CONFIG[mKey];
                const tConf = SYS_CONFIG[tKey];

                return (
                  <div key={pack.baseKey} className="space-y-0.5">
                    {!sidebarCollapsed && (
                      <div className="px-2.5 py-0.5 text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                        <IconComp className="w-3.5 h-3.5 text-slate-500" />
                        <span>{pack.title}</span>
                      </div>
                    )}

                    {[mConf, tConf].filter(Boolean).map((conf) => {
                      const isActive = activeSys === conf.key;
                      return (
                        <button
                          key={conf.key}
                          type="button"
                          onClick={() => handleSwitchSys(conf.key)}
                          className={`w-full flex items-center rounded-xl transition-colors cursor-pointer ${
                            sidebarCollapsed
                              ? 'flex-col py-2.5 justify-center gap-1'
                              : 'px-3 h-9 justify-between'
                          } ${
                            isActive
                              ? 'bg-slate-200/85 font-bold text-slate-900 border-l-4 border-[#065fd4]'
                              : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <div className={`flex items-center min-w-0 ${sidebarCollapsed ? 'flex-col gap-0.5' : 'gap-2.5'}`}>
                            <IconComp className={`w-4 h-4 shrink-0 ${conf.iconColor}`} />
                            <span
                              className={
                                sidebarCollapsed
                                  ? 'text-[10px] truncate max-w-[64px]'
                                  : 'text-xs truncate'
                              }
                            >
                              {sidebarCollapsed ? conf.name.replace(/^\d+\.\s*/, '').slice(0, 4) : conf.name}
                            </span>
                          </div>
                          {!sidebarCollapsed && (
                            <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
                              {sysCounts[conf.key] || 0}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {sidebarCollapsed ? (
              <button
                type="button"
                onClick={() => setPackModalOpen(true)}
                title="開通 / 管理 10 大產業模組"
                className="w-full py-2.5 rounded-xl bg-blue-50 text-[#065fd4] flex flex-col items-center justify-center gap-1 cursor-pointer"
              >
                <Sliders className="w-4 h-4" />
                <span className="text-[10px] font-bold">模組</span>
              </button>
            ) : (
              <>
                <hr className="border-slate-200" />

                {/* 字體調節面板 */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">字體與字級設定</span>
                    <span className="px-2 py-0.5 rounded bg-[#065fd4] text-white text-[11px] font-mono font-bold">
                      {fontScalePx}px
                    </span>
                  </div>

                  {/* 字型下拉選單 */}
                  <select
                    aria-label="側欄選擇字體"
                    value={fontFamilyKey}
                    onChange={(e) =>
                      updateWorkspaceFont({ family: e.target.value as FontFamilyKey })
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#065fd4] cursor-pointer"
                  >
                    {FONT_FAMILY_OPTIONS.map((opt) => (
                      <option
                        key={opt.key}
                        value={opt.key}
                        style={{ fontFamily: opt.cssFamily }}
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {/* 字級下拉選單 */}
                  <select
                    aria-label="側欄選擇字體大小"
                    value={String(fontScalePx)}
                    onChange={(e) =>
                      updateWorkspaceFont({ sizePx: Number(e.target.value) || 16 })
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#065fd4] cursor-pointer"
                  >
                    {FONT_SIZE_OPTIONS.map((opt) => (
                      <option key={opt.px} value={String(opt.px)}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        updateWorkspaceFont({
                          sizePx: Math.max(13, Number((fontScalePx - 1).toFixed(0))),
                        })
                      }
                      className="py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
                    >
                      A- 縮小
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateWorkspaceFont({
                          sizePx: Math.min(22, Number((fontScalePx + 1).toFixed(0))),
                        })
                      }
                      className="py-1.5 px-2 bg-[#065fd4] hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      A+ 放大
                    </button>
                  </div>
                </div>

                {/* 圖片格式面板 */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="text-xs font-bold text-slate-800">圖片格式</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: '16/9' as AspectMode, label: 'YouTube 16:9' },
                      { id: '3/4' as AspectMode, label: '海報 3:4' },
                      { id: '4/3' as AspectMode, label: '簡報 4:3' },
                      { id: '1/1' as AspectMode, label: '方形 1:1' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAspectMode(opt.id)}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                          aspectMode === opt.id
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAspectMode('detail')}
                      className={`col-span-2 py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                        aspectMode === 'detail'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-purple-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      照片明細 (可滾動)
                    </button>
                  </div>
                </div>

                {/* Scoped Quick Shortcuts */}
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 space-y-1.5">
                  <div className="text-[11px] font-bold text-blue-900 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-[#065fd4]" />
                    <span>專屬會員整合服務</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCloudModalOpen(true)}
                    className="w-full text-left text-xs text-indigo-700 hover:underline font-semibold py-0.5 cursor-pointer flex items-center gap-1"
                  >
                    <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                    <span>專屬雲端資料夾 & 試算表 ({cloudVault.sheetTabs.length}頁)</span>
                  </button>
                  {onNavigateToPortal && (
                    <button
                      type="button"
                      onClick={onNavigateToPortal}
                      className="w-full text-left text-xs text-[#065fd4] hover:underline font-semibold py-0.5 cursor-pointer"
                    >
                      → 切換至個人戰情室 (1+1 節點)
                    </button>
                  )}
                  {onNavigateToBooking && (
                    <button
                      type="button"
                      onClick={onNavigateToBooking}
                      className="w-full text-left text-xs text-emerald-700 hover:underline font-semibold py-0.5 cursor-pointer"
                    >
                      → AI 個人預約 ({bookingProfile ? bookingProfile.licenseId : '免費30天'})
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>

        {/* ================= MAIN CONTENT AREA ================= */}
        <main className="flex-1 min-w-0 flex flex-col bg-[#f8fafc]">
          {/* Sticky Top Section: Expandable Preview Player + Dynamic Filter Chips */}
          {activeSys !== 'ORG_TREE' && activeSys !== 'ORDER_STORE' && activeSys !== 'TODO_BOARD' && (
            <div className="sticky top-[60px] z-20 bg-[#f8fafc]/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
              {/* Inline Player Preview Wrapper */}
              {playerItem && (
                <div className="bg-white border-b border-slate-200">
                  <div className="p-4 pb-0 relative max-w-4xl mx-auto">
                    <div
                      className="relative rounded-xl overflow-hidden shadow-md bg-slate-900 cursor-zoom-in"
                      style={{ aspectRatio: '16 / 9' }}
                      onClick={() => {
                        if (playerItem.photoUrl && !brokenImages[playerItem.id]) {
                          setLightboxZoomed(false);
                          setLightboxSrc(playerItem.photoUrl);
                        }
                      }}
                    >
                      {renderThumbnailGraphic(playerItem)}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlayerItem(null);
                        }}
                        title="收合預覽"
                        className="absolute top-3 left-3 z-20 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-md cursor-pointer"
                      >
                        <ChevronDown className="w-5 h-5" />
                      </button>
                      {playerItem.photoUrl && !brokenImages[playerItem.id] && (
                        <div className="absolute bottom-3 right-3 z-20 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs flex items-center gap-1 backdrop-blur-md">
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>點擊全螢幕縮放</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{playerItem.title}</h3>
                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2 mt-1">
                        <span className="font-mono font-bold text-[#065fd4]">{playerItem.id}</span>
                        <span>·</span>
                        <span>{playerItem.channel}</span>
                        <span>·</span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-medium">
                          {playerItem.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openDrawerView(playerItem)}
                        className="px-3.5 py-2 bg-[#065fd4] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                      >
                        開啟詳細明細 / 編輯
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Filter Chips Row 1: Category / Module Chips (Horizontally Scrollable) */}
              <div className="px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 min-w-0">
                <HorizontalScrollStrip
                  theme="light"
                  ariaLabel="狀態與模組快篩"
                  wrapperClassName="flex-1 min-w-0"
                  className="gap-2 py-0.5"
                >
                  {activeConf ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('ALL')}
                        className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                          statusFilter === 'ALL'
                            ? 'bg-[#0f172a] text-white'
                            : 'bg-slate-200/80 hover:bg-slate-300 text-slate-800'
                        }`}
                      >
                        全部 ({catChipCounts.ALL || 0})
                      </button>
                      {activeConf.cats.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setStatusFilter(cat)}
                          className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                            statusFilter === cat
                              ? 'bg-[#0f172a] text-white'
                              : 'bg-slate-200/80 hover:bg-slate-300 text-slate-800'
                          }`}
                        >
                          {cat} ({catChipCounts[cat] || 0})
                        </button>
                      ))}
                    </>
                  ) : activeSys === 'BOOKING' ? (
                    <>
                      {['ALL', '待確認預約', '已確認時段', '已完成服務', '已取消'].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setStatusFilter(st)}
                          className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                            statusFilter === st
                              ? 'bg-[#0f172a] text-white'
                              : 'bg-slate-200/80 hover:bg-slate-300 text-slate-800'
                          }`}
                        >
                          {st === 'ALL' ? `全部預約 (${catChipCounts.ALL || 0})` : `${st} (${catChipCounts[st] || 0})`}
                        </button>
                      ))}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSwitchSys('ALL')}
                        className="shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap bg-[#0f172a] text-white cursor-pointer"
                      >
                        全部已開通 ({sysCounts.ALL || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!unlockedPacks.includes('TODO')) {
                            const next = [...unlockedPacks, 'TODO'];
                            setUnlockedPacks(next);
                            saveMemberUnlockedPacks(memberMid, next);
                          }
                          handleSwitchSys('TODO_BOARD');
                        }}
                        className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 cursor-pointer border transition-colors ${
                          overdueTodoCount > 0
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
                        }`}
                      >
                        <ListTodo className="w-3.5 h-3.5" />
                        <span>個人待辦任務面板 ({sysCounts.TODO_T || 0})</span>
                        {overdueTodoCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                            {overdueTodoCount} 逾期
                          </span>
                        )}
                      </button>
                      {unlockedPacks.map((base) => {
                        const mKey = `${base}_M`;
                        const tKey = `${base}_T`;
                        return (
                          <React.Fragment key={base}>
                            {SYS_CONFIG[mKey] && (
                              <button
                                type="button"
                                onClick={() => handleSwitchSys(mKey)}
                                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap bg-slate-200/80 hover:bg-slate-300 text-slate-800 cursor-pointer"
                              >
                                {SYS_CONFIG[mKey].name} ({sysCounts[mKey] || 0})
                              </button>
                            )}
                            {SYS_CONFIG[tKey] && (
                              <button
                                type="button"
                                onClick={() => handleSwitchSys(tKey)}
                                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap bg-slate-200/80 hover:bg-slate-300 text-slate-800 cursor-pointer"
                              >
                                {SYS_CONFIG[tKey].name} ({sysCounts[tKey] || 0})
                              </button>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </>
                  )}
                </HorizontalScrollStrip>

                <button
                  type="button"
                  onClick={() => setPackModalOpen(true)}
                  className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#065fd4] text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer border border-blue-200"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>開通雙軌模組 ({unlockedPacks.length}/{INDUSTRY_PACKS.length})</span>
                </button>
              </div>

              {/* Dynamic Date Filter Chips Row (Horizontally Scrollable) */}
              {hasDateFieldInActive && (
                <div className="px-3 sm:px-6 pb-2.5 min-w-0">
                  <HorizontalScrollStrip
                    theme="light"
                    ariaLabel="日期快篩"
                    className="gap-2 py-0.5"
                  >
                    <span className="shrink-0 text-[11px] font-bold text-slate-500 whitespace-nowrap flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#065fd4]" />
                      <span>日期快篩：</span>
                    </span>
                    {[
                      { id: 'ALL' as DateFilterMode, label: '全部日期' },
                      { id: 'TODAY' as DateFilterMode, label: `今日 (${getOffsetDateStr(0).slice(5)})` },
                      { id: 'TOMORROW' as DateFilterMode, label: `明天 (${getOffsetDateStr(1).slice(5)})` },
                      { id: 'DAY_AFTER' as DateFilterMode, label: `後天 (${getOffsetDateStr(2).slice(5)})` },
                      { id: 'WEEK' as DateFilterMode, label: '今起一週內' },
                    ].map((df) => (
                      <button
                        key={df.id}
                        type="button"
                        onClick={() => setDateFilter(df.id)}
                        className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap border transition-colors cursor-pointer ${
                          dateFilter === df.id
                            ? 'bg-[#065fd4] text-white border-[#065fd4]'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {df.label}
                      </button>
                    ))}
                  </HorizontalScrollStrip>
                </div>
              )}
            </div>
          )}

          {/* ================= SCOPED ORG_TREE MATRIX VIEW ================= */}
          {activeSys === 'ORG_TREE' && (
            <div className="p-5 sm:p-6 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                        會員專屬組織視角 · 嚴格隔離鎖定
                      </span>
                      <span className="font-mono text-xs text-slate-500">
                        ROOT: {scopedOrgData?.rootBiId}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 mt-1">
                      {member?.name} ({memberMid}) 雙軌 1+1 組織網與直推矩陣
                    </h2>
                    <p className="text-xs text-slate-500">
                      僅顯示您本人節點 ({member?.binaryNodeId} / {member?.monolineNodeId}) 傘下延伸組織與直推體系，無法越權檢視上層或無關組織。
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!scopedOrgData?.canGoUp}
                      onClick={() => {
                        const parentId = scopedOrgData?.subtree?.parentId;
                        if (parentId && scopedOrgData?.allowedBiSet.has(parentId)) {
                          setOrgInspectNodeId(parentId);
                        }
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
                        scopedOrgData?.canGoUp
                          ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 cursor-pointer'
                          : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      <ArrowUpLeft className="w-3.5 h-3.5" />
                      <span>返回上層</span>
                    </button>
                    {scopedOrgData && scopedOrgData.currentNodeId !== scopedOrgData.rootBiId && (
                      <button
                        type="button"
                        onClick={() => setOrgInspectNodeId(scopedOrgData.rootBiId)}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-[#065fd4] text-white hover:bg-blue-700 cursor-pointer"
                      >
                        回到我的根節點
                      </button>
                    )}
                  </div>
                </div>

                {/* Scoped Org Stats Strip */}
                {report && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="text-[11px] text-slate-500 font-medium">第 1 組單軌公排節點</div>
                        <div className="text-base font-bold font-mono text-[#065fd4] mt-0.5">
                          {report.member.monolineNodeId}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          累積單軌分紅 {report.financialSummary.monolineEarnings} 點
                        </div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="text-[11px] text-slate-500 font-medium">雙軌卡位總席數</div>
                        <div className="text-base font-bold font-mono text-indigo-700 mt-0.5">
                          {report.ownedBinaryNodes.length} 席 ({report.member.binaryNodeId} 起)
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          主節點傘下：左 {report.binaryDownline.leftLegNodes.length} / 右 {report.binaryDownline.rightLegNodes.length} 席
                        </div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="text-[11px] text-slate-500 font-medium">直推 15 代總人數</div>
                        <div className="text-base font-bold font-mono text-emerald-700 mt-0.5">
                          {report.downstream15Gen.total15GenCount} 人
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          第一代親推 {report.referrals.directReferralMembers.length} 人
                        </div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="text-[11px] text-slate-500 font-medium">名下全節點總收益</div>
                        <div className="text-base font-bold font-mono text-amber-700 mt-0.5">
                          {report.financialSummary.totalEarningsFromAllNodes} 點
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          持有 {report.totalOwnedNodesCount} 個節點單位
                        </div>
                      </div>
                    </div>

                    {/* Owned AI Software Binary Nodes Quick Selector */}
                    {report.ownedBinaryNodes.length > 0 && (
                      <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-indigo-950">
                            我名下已加入雙軌二元樹之 AI 系統節點 ({report.ownedBinaryNodes.length} 席) — 點擊切換視角：
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSwitchSys('ORDER_STORE')}
                            className="text-[11px] font-bold text-[#065fd4] hover:underline cursor-pointer"
                          >
                            + 前往 AI 軟體訂購中心加購新雙軌節點 →
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {report.ownedBinaryNodes.map((bn) => {
                            const isFocused = scopedOrgData?.currentNodeId === bn.nodeId;
                            return (
                              <button
                                key={bn.nodeId}
                                type="button"
                                onClick={() => setOrgInspectNodeId(bn.nodeId)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer flex items-center gap-1.5 ${
                                  isFocused
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                    : 'bg-white hover:bg-indigo-100/80 text-slate-800 border-indigo-200'
                                }`}
                              >
                                <span className="font-bold">{bn.nodeId}</span>
                                <span className={`font-sans text-[11px] ${isFocused ? 'text-sky-300' : 'text-indigo-700 font-semibold'}`}>
                                  {bn.softwareTitle || '第2組雙軌分身'}
                                </span>
                                <span className={`text-[10px] ${isFocused ? 'text-slate-300' : 'text-slate-500'}`}>
                                  ({bn.placementPosition === 'L' ? 'L' : bn.placementPosition === 'R' ? 'R' : 'ROOT'} · D{bn.depth})
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Downline Quick Locator (Scoped ONLY to own subtree) */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-100">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={orgSearchQuery}
                      onChange={(e) => setOrgSearchQuery(e.target.value)}
                      placeholder="搜尋傘下節點 ID 或姓名 (例: C-25000516)"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-[#065fd4]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const q = orgSearchQuery.trim().toUpperCase();
                      if (!q || !scopedOrgData) return;
                      const match = scopedOrgData.downlineNodesList.find(
                        (n) =>
                          n.nodeId.toUpperCase() === q ||
                          n.mid.toUpperCase() === q ||
                          n.name.includes(orgSearchQuery.trim())
                      );
                      if (match && scopedOrgData.allowedBiSet.has(match.nodeId)) {
                        setOrgInspectNodeId(match.nodeId);
                        showToast(`已定位至傘下節點 ${match.nodeId}`);
                      } else {
                        showToast('您的傘下組織中找不到此節點（非本人體系資料已隔離）');
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                  >
                    定位傘下節點
                  </button>
                </div>

                {/* Binary Tree Visual Canvas */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 overflow-x-auto">
                  {scopedOrgData?.subtree ? (
                    renderOrgBinaryNode(scopedOrgData.subtree, 2)
                  ) : (
                    <div className="text-center py-8 text-xs text-slate-500">
                      尚無雙軌樹狀節點資料
                    </div>
                  )}
                </div>
              </div>

              {/* Direct Referrals Quick CRM Table */}
              {report && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 mb-3">
                    <GitBranch className="w-4 h-4 text-[#065fd4]" />
                    <span>我的第一代直推會員名單 ({report.referrals.directReferralMembers.length})</span>
                  </h3>
                  {report.referrals.directReferralMembers.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4">
                      目前尚無直推下線會員，可點擊「通訊主檔」將開發名單推薦開通 1+1！
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {report.referrals.directReferralMembers.map((dm) => (
                        <div
                          key={dm.mid}
                          className="border border-slate-200 rounded-xl p-3 bg-slate-50/60 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-900 truncate">
                              {dm.name} <span className="font-mono text-xs text-[#065fd4]">({dm.mid})</span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">
                              {dm.phone} · 雙軌 {dm.binaryNodeId}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSys('CONTACT_T');
                              openDrawerCreate('CONTACT_T', { 姓名: dm.name });
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-blue-50 text-[#065fd4] text-[11px] font-bold shrink-0 cursor-pointer"
                          >
                            寫入跟進
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= AI SOFTWARE FULL DUAL-TRACK ORDERING SYSTEM ================= */}
          {activeSys === 'ORDER_STORE' && (
            <div className="p-5 sm:p-6">
              <SoftwareOrderSystemView
                memberMid={memberMid}
                theme="light"
                onOpenModule={(key) => {
                  if (key === 'BOOKING') {
                    handleSwitchSys('BOOKING');
                  } else if (SYS_CONFIG[`${key}_M`]) {
                    handleSwitchSys(`${key}_M`);
                  }
                }}
                onOrderCompleted={() => {
                  setUnlockedPacks(getMemberUnlockedPacks(memberMid));
                  syncMemberPurchasedProductsToNodes(memberMid);
                  notifyNodesUpdated(memberMid);
                  triggerRefresh();
                  onNodesChanged?.();
                }}
                onInspectBinaryNode={(nodeId) => {
                  setOrgInspectNodeId(nodeId);
                  setActiveSys('ORG_TREE');
                }}
              />
            </div>
          )}

          {/* ================= PERSONAL TODO KANBAN BOARD VIEW ================= */}
          {activeSys === 'TODO_BOARD' && (
            <div className="p-5 sm:p-6">
              <PersonalTodoBoard
                memberMid={memberMid}
                theme="light"
                onTodosChanged={triggerRefresh}
                onOpenModuleDetails={() => handleSwitchSys('TODO_T')}
              />
            </div>
          )}

          {/* ================= REVENUE KPI DASHBOARD (for _T modules with Amount) ================= */}
          {activeSys !== 'ORG_TREE' && activeSys !== 'ORDER_STORE' && activeSys !== 'TODO_BOARD' && revenueKpi && (
            <div className="px-5 pt-4">
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 text-white rounded-2xl p-4 sm:p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-300 font-medium">
                      {activeConf?.name} · 即時營收結算看板 (僅統計已結案/已完成/已成交)
                    </div>
                    <div className="text-sm font-bold text-white mt-0.5">
                      累積成交筆數：{revenueKpi.settledCount} 筆（欄位：{revenueKpi.amountLabel}）
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-5">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/15">
                    <div className="text-[11px] text-emerald-300 font-semibold">今日業績</div>
                    <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-white">
                      NT$ {revenueKpi.todayTotal.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/15">
                    <div className="text-[11px] text-sky-300 font-semibold">本月累計業績</div>
                    <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-white">
                      NT$ {revenueKpi.monthTotal.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= MEDIA CARDS GRID ================= */}
          {activeSys !== 'ORG_TREE' && activeSys !== 'ORDER_STORE' && activeSys !== 'TODO_BOARD' && (
            <div className="flex-1 pb-24">
              {activeModulePerm && !activeModulePerm.canCreate && (
                <div className="px-5 pt-4">
                  <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-amber-950 flex items-start gap-2.5">
                      <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-rose-800">
                          「{activeModulePerm.softwareTitle}」未續約唯讀歸檔模式（只能查看舊資料，不能新增資料）
                        </div>
                        <div className="mt-0.5 text-amber-900/90">
                          {activeModulePerm.readOnlyReason} 您仍可正常搜尋與瀏覽下方所有既有歷史資料卡片，以及打開右側專屬試算表查閱紀錄。
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const res = renewMemberModuleNow(memberMid, activeModulePerm.baseKey);
                        triggerRefresh();
                        onNodesChanged?.();
                        showToast(res.message);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shrink-0 inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>續約 NT$ 100 (+30天) 解鎖新增</span>
                    </button>
                  </div>
                </div>
              )}

              {overdueTodoCount > 0 && activeSys !== 'TODO_T' && activeSys !== 'TODO_M' && (
                <div className="px-5 pt-4">
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-rose-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        <span className="font-bold">個人待辦逾期提醒：</span>
                        您目前有 <span className="font-bold">{overdueTodoCount} 項</span>個人待辦任務已超過截止時間，可於拖曳看板調整進度或延後時程（即時同步 GAS 後端）。
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwitchSys('TODO_BOARD')}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer"
                    >
                      開啟個人待辦任務面板 →
                    </button>
                  </div>
                </div>
              )}
              {(activeSys === 'TODO_T' || activeSys === 'TODO_M') && (
                <div className="px-5 pt-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-blue-900">
                      <span className="font-bold">提示：</span>
                      <span>可切換至「個人待辦任務面板」進行拖曳切換狀態（待處理／處理中／已完成）、檢視逾期提醒與即時同步 GAS 後端。</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwitchSys('TODO_BOARD')}
                      className="px-3.5 py-2 bg-[#065fd4] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer"
                    >
                      切換拖曳看板視圖 →
                    </button>
                  </div>
                </div>
              )}
              {filteredItems.length === 0 ? (
                <div className="py-20 text-center text-slate-500 space-y-2.5 px-4">
                  <p className="font-bold text-base text-slate-700">
                    目前沒有符合篩選條件的資料卡片
                  </p>
                  <p className="text-xs">
                    {activeModulePerm && !activeModulePerm.canCreate
                      ? '此模組目前處於「未續約唯讀模式」：僅供瀏覽既有舊資料，續約後即可新增資料。'
                      : '您可切換日期/分類標籤，或點擊右上角紅色「+」快速建立該模組資料。'}
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter('ALL');
                        setDateFilter('ALL');
                        setSearchTerm('');
                      }}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      清除篩選條件
                    </button>
                    {activeConf && (
                      <button
                        type="button"
                        disabled={Boolean(activeModulePerm && !activeModulePerm.canCreate)}
                        onClick={() => openDrawerCreate(activeConf.key)}
                        className={`px-4 py-2 text-xs font-semibold rounded-lg ${
                          activeModulePerm && !activeModulePerm.canCreate
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            : 'bg-[#cc0000] hover:bg-[#b00000] text-white cursor-pointer'
                        }`}
                      >
                        {activeModulePerm && !activeModulePerm.canCreate
                          ? '未續約唯讀 (禁新增)'
                          : `+ 新增${activeConf.name.replace(/^\d+\.\s*/, '')}`}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className={getGridClassName()}>
                  {filteredItems.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    const isDetailLayout = aspectMode === 'detail';

                    return (
                      <div
                        key={`${item.sysType}-${item.id}`}
                        onClick={() => {
                          if (shareMode) handleToggleSelectCard(item.id);
                        }}
                        className={`group flex ${
                          isDetailLayout
                            ? 'flex-row bg-white border border-slate-200 rounded-2xl p-3 gap-3.5 items-center overflow-x-auto shadow-xs'
                            : 'flex-col'
                        } ${shareMode ? 'cursor-pointer' : ''} relative`}
                      >
                        {/* Thumbnail Container */}
                        <div
                          onClick={(e) => {
                            if (shareMode) return;
                            e.stopPropagation();
                            setPlayerItem(item);
                          }}
                          style={
                            isDetailLayout
                              ? { width: 132, minWidth: 132, height: 84, aspectRatio: '16 / 9' }
                              : getThumbnailAspectStyle()
                          }
                          className={`relative rounded-xl overflow-hidden bg-slate-200 cursor-pointer shrink-0 ${
                            isDetailLayout ? '' : 'mb-3 shadow-xs'
                          }`}
                        >
                          {renderThumbnailGraphic(item, isDetailLayout)}

                          {/* Frosted Bottom-Right ID Badge */}
                          <span className="absolute bottom-2 right-2 z-20 bg-black/65 backdrop-blur-md text-white px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold border border-white/20">
                            {item.id}
                          </span>

                          {/* Share Mode Overlay */}
                          {shareMode && (
                            <div
                              className={`absolute inset-0 z-20 flex items-center justify-center transition-opacity ${
                                isSelected
                                  ? 'bg-emerald-500/55 opacity-100'
                                  : 'bg-black/10 opacity-0 group-hover:opacity-100'
                              }`}
                            >
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-white/80 text-slate-600'
                                }`}
                              >
                                <Check className="w-5 h-5" />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Details Row */}
                        <div
                          className={`flex items-start pr-1 w-full ${
                            isDetailLayout ? 'min-w-max flex-1 items-center' : ''
                          }`}
                        >
                          <div
                            className="w-9 h-9 min-w-[36px] rounded-full text-white flex items-center justify-center font-bold mr-3 text-sm shrink-0 shadow-xs"
                            style={{ backgroundColor: item.avatarBg }}
                          >
                            {item.avatarChar}
                          </div>

                          <div
                            onClick={(e) => {
                              if (shareMode) return;
                              e.stopPropagation();
                              openDrawerView(item);
                            }}
                            className="flex-1 min-w-0 flex flex-col cursor-pointer"
                          >
                            <div
                              className="font-semibold text-slate-900 leading-snug truncate"
                              style={{ fontSize: `${1 * fontScaleRatio}rem` }}
                            >
                              {item.title}
                            </div>
                            <div
                              className="font-semibold text-[#1d4ed8] mt-0.5 truncate"
                              style={{ fontSize: `${0.82 * fontScaleRatio}rem` }}
                            >
                              {item.channel}
                            </div>
                            <div
                              className="text-slate-500 truncate mt-0.5 tabular-nums"
                              style={{ fontSize: `${0.78 * fontScaleRatio}rem` }}
                            >
                              {item.status} · {item.subtitle}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDrawerView(item);
                            }}
                            title="查看 / 編輯明細"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 ml-1 shrink-0 cursor-pointer"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ================= BOTTOM FLOATING SHARE BAR ================= */}
      {shareMode && (
        <div className="sticky bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-2xl px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <div className="flex flex-col min-w-[68px]">
              <span className="text-emerald-700 font-bold text-xs">已選取</span>
              <span className="font-bold text-2xl leading-none font-mono tabular-nums text-slate-900">
                {selectedIds.length}
              </span>
            </div>
            <input
              type="text"
              value={shareGroupName}
              onChange={(e) => setShareGroupName(e.target.value)}
              placeholder="LINE 目標群組名稱（例如：台北分店團隊群）"
              className="flex-1 h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
            />
            <button
              type="button"
              onClick={handleExecuteShare}
              className="h-11 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-sm"
            >
              <Send className="w-4 h-4" />
              <span>寄送</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= RIGHT SLIDE-OVER DRAWER (View / Edit / Create) ================= */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 bg-black/45 backdrop-blur-[1px]"
          />
          <div className="relative z-10 w-full max-w-[440px] bg-white h-full shadow-2xl flex flex-col rounded-l-2xl overflow-hidden text-slate-900">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <h5 className="font-bold text-base text-slate-900 truncate">
                {drawerMode === 'create'
                  ? `新增：${SYS_CONFIG[formTargetSys]?.name || '專屬資料'}`
                  : drawerMode === 'edit'
                  ? `編輯明細 (${drawerItem?.id})`
                  : `${drawerItem?.sysLabel} (${drawerItem?.id})`}
              </h5>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col">
              {/* VIEW MODE */}
              {drawerMode === 'view' && drawerItem && (
                <div className="space-y-4">
                  <div
                    className="rounded-xl overflow-hidden shadow-md bg-slate-100 cursor-pointer"
                    style={{ aspectRatio: '16 / 9' }}
                    onClick={() => {
                      if (drawerItem.photoUrl && !brokenImages[drawerItem.id]) {
                        setLightboxZoomed(false);
                        setLightboxSrc(drawerItem.photoUrl);
                      }
                    }}
                  >
                    {renderThumbnailGraphic(drawerItem)}
                  </div>

                  {/* Master -> Transaction Quick Jump Button */}
                  {drawerItem.isMaster && (
                    <button
                      type="button"
                      onClick={() => handleJumpMasterToTrack(drawerItem)}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>建立新紀錄 (自動跳轉帶入姓名與照片)</span>
                    </button>
                  )}

                  {/* Transaction Workflow Buttons (_T) */}
                  {canStartWorkflow && (
                    <button
                      type="button"
                      onClick={() => handleStartWorkflow(drawerItem)}
                      className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <Play className="w-4 h-4" />
                      <span>開始推進狀態 (自動打卡開始時間)</span>
                    </button>
                  )}

                  {canCheckoutComplete && (
                    <button
                      type="button"
                      onClick={() => handleOpenCheckoutModal(drawerItem)}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>
                        {drawerAmountKey ? '結帳完成 (算入今日與本月營收)' : '確認完成此項追蹤紀錄'}
                      </span>
                    </button>
                  )}

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/70">
                    {drawerItem.fieldsDisplay.map((f) => (
                      <div key={f.label} className="px-3.5 py-2.5 flex flex-col gap-0.5">
                        <span className="text-[11px] font-semibold text-slate-500">{f.label}</span>
                        <span className="text-sm text-slate-900 break-words">{f.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Quick Convert to 1+1 Action for Contact Prospect or Booking Appointment */}
                  {onNavigateToRegisterWithClient &&
                    (drawerItem.bookingApt ||
                      (drawerItem.contactMaster && !drawerItem.contactMaster.memberMid)) && (
                      <button
                        type="button"
                        onClick={() => {
                          setDrawerOpen(false);
                          if (drawerItem.bookingApt) {
                            const apt = drawerItem.bookingApt;
                            onNavigateToRegisterWithClient({
                              name: apt.clientName,
                              phone: apt.clientPhone,
                              line: apt.clientLine,
                              sponsorMid: memberMid,
                            });
                          } else if (drawerItem.contactMaster) {
                            const c = drawerItem.contactMaster;
                            onNavigateToRegisterWithClient({
                              name: c.name,
                              phone: c.phone,
                              line: c.line,
                              sponsorMid: memberMid,
                            });
                          }
                        }}
                        className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>一鍵帶入推薦新會員開通 AI 軟體 1+1</span>
                      </button>
                    )}

                  <button
                    type="button"
                    onClick={handleEnterEdit}
                    className="w-full py-3 px-4 bg-[#065fd4] hover:bg-blue-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>
                      {drawerItem.sysType === 'BOOKING' || drawerItem.sysType === 'BOOKING_T'
                        ? '前往 AI 個人預約工作台管理'
                        : '進入編輯狀態'}
                    </span>
                  </button>
                </div>
              )}

              {/* EDIT / CREATE MODE (100% Dynamic Form Driven by SYS_CONFIG) */}
              {(drawerMode === 'edit' || drawerMode === 'create') && (
                <div className="flex-1 flex flex-col space-y-3">
                  {formPhotoUrl && (
                    <div className="rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm">
                      <img
                        src={formPhotoUrl}
                        alt="預覽圖片"
                        className="w-full object-cover"
                        style={{ aspectRatio: '4 / 3' }}
                      />
                    </div>
                  )}

                  {drawerMode === 'create' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        資料類型模組
                      </label>
                      <select
                        value={formTargetSys}
                        onChange={(e) => {
                          const next = e.target.value;
                          setFormTargetSys(next);
                          setFormValues(buildDefaultFormValues(next));
                        }}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#065fd4]"
                      >
                        {unlockedModuleKeys.map((k) => {
                          const c = SYS_CONFIG[k];
                          const pack = INDUSTRY_PACKS.find((p) => p.baseKey === c.baseKey);
                          return (
                            <option key={k} value={k}>
                              [{pack?.title}] {c.name}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {/* Collapsible Form Accordion */}
                  <button
                    type="button"
                    onClick={() => setFormDrawerExpanded((v) => !v)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-sm font-bold text-slate-700 cursor-pointer"
                  >
                    <span>動態模組表單欄位</span>
                    {formDrawerExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </button>

                  {formDrawerExpanded && SYS_CONFIG[formTargetSys] && (
                    <div className="grid grid-cols-12 gap-3 pb-4">
                      {SYS_CONFIG[formTargetSys].fields.map((field) => {
                        // TCM_T Dynamic UI Rules
                        if (formTargetSys === 'TCM_T') {
                          const curSt = formValues['狀態'];
                          if (
                            curSt === '預約中' &&
                            ['開始時間', '結束時間', '消費金額'].includes(field.id)
                          ) {
                            return null;
                          }
                          if (
                            curSt === '執行中' &&
                            ['預約日期', '預約時段'].includes(field.id)
                          ) {
                            return null;
                          }
                        }

                        const colSpanClass = field.half ? 'col-span-6' : 'col-span-12';
                        const val = formValues[field.id] ?? '';

                        return (
                          <div key={field.id} className={colSpanClass}>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                              {field.label}
                            </label>
                            {field.type === 'select' ? (
                              <select
                                value={val}
                                onChange={(e) =>
                                  setFormValues((prev) => ({
                                    ...prev,
                                    [field.id]: e.target.value,
                                  }))
                                }
                                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#065fd4]"
                              >
                                {(field.options || []).map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : field.type === 'textarea' ? (
                              <textarea
                                rows={2}
                                value={val}
                                onChange={(e) =>
                                  setFormValues((prev) => ({
                                    ...prev,
                                    [field.id]: e.target.value,
                                  }))
                                }
                                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#065fd4]"
                              />
                            ) : (
                              <input
                                type={field.type}
                                value={val}
                                onChange={(e) =>
                                  setFormValues((prev) => ({
                                    ...prev,
                                    [field.id]: e.target.value,
                                  }))
                                }
                                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#065fd4]"
                              />
                            )}
                          </div>
                        );
                      })}

                      <div className="col-span-12">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          照片連結 URL（或使用下方相機／相簿自動壓縮上傳）
                        </label>
                        <input
                          type="url"
                          value={formPhotoUrl}
                          onChange={(e) => setFormPhotoUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#065fd4]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Sticky Drawer Bottom Action Toolbar */}
                  <div className="sticky bottom-0 mt-auto pt-3 pb-1 bg-white border-t border-slate-200 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="py-2.5 rounded-xl bg-[#e91e63] hover:bg-pink-700 text-white text-xs font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Camera className="w-5 h-5" />
                        <span>開啟相機</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-xs font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer shadow-xs"
                      >
                        <FolderOpen className="w-5 h-5 text-slate-600" />
                        <span>相簿上傳</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveDrawer(false)}
                        className="py-3 rounded-xl bg-[#065fd4] hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Send className="w-4 h-4" />
                        <span>一般儲存</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveDrawer(true)}
                        className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Zap className="w-4 h-4" />
                        <span>存檔並續增</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= INLINE CHECKOUT CONFIRMATION MODAL (Zero window.prompt) ================= */}
      {checkoutModalItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <span>結帳完成打卡 ({checkoutModalItem.id})</span>
              </h4>
              <button
                type="button"
                onClick={() => setCheckoutModalItem(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-1">
              <div>
                對象／品項：<span className="font-bold text-slate-900">{checkoutModalItem.title}</span>
              </div>
              <div>
                完成時間打卡：<span className="font-mono text-[#065fd4]">{getCurrentDateTimeStr().replace('T', ' ')}</span>
              </div>
            </div>

            {findAmountFieldId(SYS_CONFIG[checkoutModalItem.sysType]) && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  請確認實收金額 (NTD) — 將立即算入今日與本月營收
                </label>
                <input
                  type="number"
                  value={checkoutAmountInput}
                  onChange={(e) => setCheckoutAmountInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-lg font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCheckoutModalItem(null)}
                className="py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmCheckout}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer shadow-sm"
              >
                確認結帳完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= INDUSTRY PACKS UNLOCK SETTINGS MODAL ================= */}
      {packModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-base text-slate-900">
                  AI 軟體完整雙軌模組架構開通設定 ({memberMid})
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  新會員預設標配「1+1 AI 軟體」（通訊錄 CRM + 活動行銷），並可依需求開啟「個人預約系統 (BOOKING_M/T)」、「代辦事項系統 (TODO_M/T)」與 8 大產業主檔 (_M) ／流水追蹤 (_T)。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPackModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INDUSTRY_PACKS.map((pack) => {
                const isOn = unlockedPacks.includes(pack.baseKey);
                const IconComp = getPackIcon(pack.baseKey);
                return (
                  <button
                    key={pack.baseKey}
                    type="button"
                    onClick={() => handleTogglePack(pack.baseKey)}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start justify-between gap-3 cursor-pointer ${
                      isOn
                        ? 'bg-blue-50/70 border-[#065fd4] shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isOn ? 'bg-[#065fd4] text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5 flex-wrap">
                          <span>{pack.title}</span>
                          {(pack.baseKey === 'CONTACT' || pack.baseKey === 'EVENT') && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                              1+1 標配
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{pack.desc}</div>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                        isOn
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isOn ? '已開通' : '未開通'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const allKeys = INDUSTRY_PACKS.map((p) => p.baseKey);
                    setUnlockedPacks(allKeys);
                    saveMemberUnlockedPacks(memberMid, allKeys);
                    triggerRefresh();
                    showToast('已全部開通 10 大產業雙軌模組（共 20 個子系統）！');
                  }}
                  className="text-xs font-bold text-[#065fd4] hover:underline cursor-pointer"
                >
                  一鍵開通全部 {INDUSTRY_PACKS.length} 套雙軌架構 ({INDUSTRY_PACKS.length * 2} 模組)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPackModalOpen(false);
                    handleSwitchSys('ORDER_STORE');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold cursor-pointer"
                >
                  前往軟體訂購系統 (30天免費 · 月租100)
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPackModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                完成設定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MEMBER CLOUD FOLDER & GOOGLE SPREADSHEET VAULT MODAL ================= */}
      {cloudModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-slate-900">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-[#065fd4]" />
                  <span>會員專屬雲端資料夾 & 獨立 Google 試算表 ({memberMid})</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  未續約之 AI 軟體自動開啟試算表工作表唯讀鎖定：只能查看舊資料，不能新增資料；續約 NT$ 100 即刻恢復新增。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCloudModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-indigo-700 font-bold">
                    <span className="flex items-center gap-1">
                      <FolderOpen className="w-4 h-4" />
                      <span>Google Drive 雲端資料夾</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">{cloudVault.folderId}</span>
                  </div>
                  <div className="font-semibold text-slate-900 truncate">{cloudVault.folderName}</div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="font-mono text-[11px] text-slate-500 truncate">{cloudVault.folderUrl}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(cloudVault.folderUrl);
                        showToast('已複製會員專屬 Google Drive 資料夾連結！');
                      }}
                      className="px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>複製</span>
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-emerald-700 font-bold">
                    <span className="flex items-center gap-1">
                      <Table className="w-4 h-4" />
                      <span>獨立 Google 試算表</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">{cloudVault.spreadsheetId}</span>
                  </div>
                  <div className="font-semibold text-slate-900 truncate">{cloudVault.spreadsheetName}</div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="font-mono text-[11px] text-slate-500 truncate">{cloudVault.spreadsheetUrl}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(cloudVault.spreadsheetUrl);
                        showToast('已複製會員專屬 Google 試算表連結！');
                      }}
                      className="px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>複製</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Expiry Simulation Controls */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-amber-950">測試未續約唯讀鎖定：</span>
                  <select
                    value={vaultTestModuleKey}
                    onChange={(e) => setVaultTestModuleKey(e.target.value)}
                    className="bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 cursor-pointer"
                  >
                    {ORDERABLE_SOFTWARE_CATALOG.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const perm = setModuleExpiryStateForTest(memberMid, vaultTestModuleKey, true);
                      triggerRefresh();
                      onNodesChanged?.();
                      showToast(`已模擬「${perm.softwareTitle}」未續約到期：僅能查看舊資料，禁止新增！`);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Lock className="w-3 h-3" />
                    <span>模擬到期(唯讀)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const perm = setModuleExpiryStateForTest(memberMid, vaultTestModuleKey, false);
                      triggerRefresh();
                      onNodesChanged?.();
                      showToast(`已恢復「${perm.softwareTitle}」有效授權，解除唯讀！`);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Unlock className="w-3 h-3" />
                    <span>恢復讀寫</span>
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">工作表分頁 (Tab)</th>
                      <th className="py-2 px-3">舊資料筆數</th>
                      <th className="py-2 px-3">狀態</th>
                      <th className="py-2 px-3 text-right">續約解鎖</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cloudVault.sheetTabs.map((tab) => (
                      <tr key={tab.sysType}>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-900">{tab.title}</div>
                          <div className="font-mono text-[10px] text-slate-400">{tab.tabName}</div>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-700">{tab.recordCount} 筆</td>
                        <td className="py-2 px-3">
                          {tab.canCreate ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                              <Unlock className="w-3 h-3" />
                              <span>{tab.statusLabel}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[11px] font-bold">
                              <Lock className="w-3 h-3" />
                              <span>{tab.statusLabel}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {!tab.canCreate ? (
                            <button
                              type="button"
                              onClick={() => {
                                const res = renewMemberModuleNow(memberMid, tab.moduleKey);
                                triggerRefresh();
                                onNodesChanged?.();
                                showToast(res.message);
                              }}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>續約 100 元解鎖</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-emerald-700 font-semibold">可讀寫</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={cloudSyncing}
                onClick={async () => {
                  setCloudSyncing(true);
                  const res = await syncMemberCloudWorkspaceWithGas(memberMid);
                  triggerRefresh();
                  setCloudSyncing(false);
                  showToast(res.message);
                }}
                className="px-3.5 py-2 rounded-xl bg-[#065fd4] hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cloudSyncing ? 'animate-spin' : ''}`} />
                <span>{cloudSyncing ? 'GAS 同步建檔中...' : '立即同步至 GAS Google Drive'}</span>
              </button>
              <button
                type="button"
                onClick={() => setCloudModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                關閉視窗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Inputs for Camera & Album Upload */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageFileSelected}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageFileSelected}
        className="hidden"
      />

      {/* ================= FULLSCREEN LIGHTBOX ================= */}
      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          className="fixed inset-0 z-50 bg-black/92 flex items-center justify-center p-4 overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 z-50 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxSrc}
            alt="放大預覽"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxZoomed((v) => !v);
            }}
            className={`max-w-full max-h-full object-contain transition-transform duration-300 ${
              lightboxZoomed ? 'scale-150 cursor-zoom-out' : 'scale-100 cursor-zoom-in'
            }`}
          />
        </div>
      )}
    </div>
  );
};
