/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Calculator,
  Check,
  ChefHat,
  Copy,
  Download,
  Minus,
  Plus,
  Printer,
  QrCode,
  Receipt,
  ShoppingBag,
  Trash2,
  Truck,
  UtensilsCrossed,
} from 'lucide-react';
import {
  OFFICIAL_SHARED_APP_URL,
  buildBreakfastPortalUrl,
} from '../services/rolePortalUrlService';

export type BreakfastTabKey = 'plans' | 'onboarding' | 'order' | 'kitchen';
export type CommercialPlanKey = 'SELF_TYPE' | 'COMPANY_SETUP' | 'ANNUAL_ALL_IN';
export type BillingCycle = 'annual' | 'monthly';
export type OnboardingStage =
  | 'PENDING_PAYMENT'
  | 'MENU_TYPING'
  | 'MENU_READY'
  | 'QR_SHIPPING'
  | 'LIVE';

export interface BreakfastMerchantOrder {
  id: string;
  createdAt: string;
  merchantName: string;
  ownerName: string;
  phone: string;
  shippingAddress: string;
  tableCount: number;
  menuItemEstimate: string;
  sponsorMid: string;
  storeId: string;
  planKey: CommercialPlanKey;
  planName: string;
  billingCycle: BillingCycle;
  setupFeeNtd: number;
  subscriptionFeeNtd: number;
  qrKitFeeNtd: number;
  upfrontTotalNtd: number;
  waivedSetupFeeNtd: number;
  stage: OnboardingStage;
  note: string;
}

export interface BreakfastMenuItem {
  id: string;
  category: '蛋餅' | '吐司' | '漢堡' | '鐵板麵' | '飲品';
  name: string;
  price: number;
  available: boolean;
}

export interface KitchenOrderLine {
  itemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  modifiers: string[];
  extraPrice: number;
}

export interface KitchenTicket {
  id: string;
  createdAt: string;
  shopName: string;
  tableLabel: string;
  paymentMethod: '現金' | 'LINE Pay';
  lines: KitchenOrderLine[];
  totalAmount: number;
  status: 'PENDING' | 'COOKING' | 'DONE';
  note: string;
}

interface BreakfastShopSystemViewProps {
  initialShopName?: string | null;
  initialTableLabel?: string | null;
  initialTab?: string | null;
  onExitToMain: () => void;
  exitLabel?: string;
}

// =========================================================================
// 500 元月租閉環分紅常數（與原本 100 元制度完全相同比例，每代 1 × 5 = 5 點）
// 平帳驗證：75 + 75 + 30 + 30 + 150 + 140 = 500 點 (100%)
// =========================================================================
export const BREAKFAST_DIVIDEND_CONFIG = {
  MONTHLY_RENT_NTD: 500,
  MULTIPLIER: 5,
  SPONSOR_GENERATIONS: 15,
  SPONSOR_PER_GEN: 5, // 1 * 5 = 5 點/代
  SPONSOR_TOTAL: 75, // 15%
  PLACEMENT_GENERATIONS: 15,
  PLACEMENT_PER_GEN: 5, // 1 * 5 = 5 點/代
  PLACEMENT_TOTAL: 75, // 15%
  STORE_GENERATIONS: 6,
  STORE_PER_GEN: 5, // 1 * 5 = 5 點/代
  STORE_TOTAL: 30, // 6%
  CENTER_GENERATIONS: 6,
  CENTER_PER_GEN: 5, // 1 * 5 = 5 點/代
  CENTER_TOTAL: 30, // 6%
  ABANY_TECH_POOL: 150, // 30%
  HQ_OPS_POOL: 140, // 28%
} as const;

const SETUP_FEE_TIERS = [
  { amount: 1500, label: 'NT$ 1,500', desc: '50 項以內標準早餐菜單' },
  { amount: 2000, label: 'NT$ 2,000', desc: '51–120 項含加料客製標籤' },
  { amount: 2500, label: 'NT$ 2,500', desc: '120 項以上多規格門市' },
] as const;

const ANNUAL_ALL_IN_TIERS = [
  {
    key: 'STANDARD' as const,
    label: '標準年繳全包（12 期 × $500）',
    annualPrice: 6000,
    monthlyEquiv: 500,
    defaultTables: 10,
    summary:
      '含 12 個月完整 500 元閉環分紅（每代 1×5）＋ 專人代打全套菜單 ＋ 設計寄送櫃檯壓克力立牌 1 組與防水桌貼 10 張',
  },
  {
    key: 'PRO' as const,
    label: '旗艦多桌年繳全包（含雙立牌）',
    annualPrice: 7500,
    monthlyEquiv: 625,
    defaultTables: 16,
    summary:
      '含標準年繳全部（12 期 × $500 閉環分紅）＋ 食材進耗存毛利報表 ＋ 櫃檯立牌 2 組、防水桌貼 16 張與外帶預約立牌',
  },
] as const;

const DEFAULT_BREAKFAST_MENU: BreakfastMenuItem[] = [
  { id: 'M-01', category: '蛋餅', name: '原味手工蛋餅', price: 35, available: true },
  { id: 'M-02', category: '蛋餅', name: '雙倍起司蛋餅', price: 50, available: true },
  { id: 'M-03', category: '蛋餅', name: '培根玉米蛋餅', price: 55, available: true },
  { id: 'M-04', category: '蛋餅', name: '鮪魚洋蔥蛋餅', price: 55, available: true },
  { id: 'M-05', category: '吐司', name: '招牌火腿蛋吐司', price: 45, available: true },
  { id: 'M-06', category: '吐司', name: '嫩煎豬排蛋吐司', price: 65, available: true },
  { id: 'M-07', category: '吐司', name: '花生厚片吐司', price: 35, available: true },
  { id: 'M-08', category: '漢堡', name: '香煎卡啦雞腿堡', price: 75, available: true },
  { id: 'M-09', category: '漢堡', name: '厚牛起司蛋漢堡', price: 85, available: true },
  { id: 'M-10', category: '鐵板麵', name: '蘑菇鐵板麵加蛋', price: 65, available: true },
  { id: 'M-11', category: '鐵板麵', name: '黑胡椒鐵板麵加豬排蛋', price: 95, available: true },
  { id: 'M-12', category: '飲品', name: '招牌大冰奶', price: 30, available: true },
  { id: 'M-13', category: '飲品', name: '非基改豆漿紅茶', price: 30, available: true },
  { id: 'M-14', category: '飲品', name: '現磨美式黑咖啡', price: 50, available: true },
];

const QUICK_MODIFIERS = [
  { label: '半熟蛋', extra: 0 },
  { label: '全熟蛋', extra: 0 },
  { label: '不加蔥', extra: 0 },
  { label: '吐司去邊', extra: 0 },
  { label: '加起司 +10', extra: 10 },
  { label: '加蛋 +15', extra: 15 },
  { label: '微糖去冰', extra: 0 },
] as const;

const MENU_CATEGORIES: BreakfastMenuItem['category'][] = ['蛋餅', '吐司', '漢堡', '鐵板麵', '飲品'];

const STAGE_META: Record<OnboardingStage, { label: string; textClass: string }> = {
  PENDING_PAYMENT: { label: '待收款確認', textClass: 'text-amber-400' },
  MENU_TYPING: { label: '已收款 · 代打菜單中', textClass: 'text-sky-400' },
  MENU_READY: { label: '菜單完成 · 待印製立牌', textClass: 'text-indigo-300' },
  QR_SHIPPING: { label: '桌貼 QR 立牌寄送中', textClass: 'text-violet-300' },
  LIVE: { label: '已上線正式營業', textClass: 'text-emerald-400' },
};

const STAGE_ORDER: OnboardingStage[] = [
  'PENDING_PAYMENT',
  'MENU_TYPING',
  'MENU_READY',
  'QR_SHIPPING',
  'LIVE',
];

const ORDERS_STORAGE_KEY = 'breakfast_system_merchant_orders_v1';
const MENU_STORAGE_KEY = 'breakfast_system_menu_items_v1';
const KITCHEN_STORAGE_KEY = 'breakfast_system_kitchen_tickets_v1';

function readJsonStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota errors
  }
}

function normalizeInitialTab(tab?: string | null): BreakfastTabKey {
  if (tab === 'onboarding' || tab === 'order' || tab === 'kitchen' || tab === 'plans') {
    return tab;
  }
  return 'plans';
}

export const BreakfastShopSystemView: React.FC<BreakfastShopSystemViewProps> = ({
  initialShopName,
  initialTableLabel,
  initialTab,
  onExitToMain,
  exitLabel = '返回統一登入中心',
}) => {
  const [activeTab, setActiveTab] = useState<BreakfastTabKey>(() =>
    normalizeInitialTab(initialTab)
  );

  // Plans & 500 NTD (1x5) Dividend Calculator State
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [selectedPlan, setSelectedPlan] = useState<CommercialPlanKey>('ANNUAL_ALL_IN');
  const [setupFeeTier, setSetupFeeTier] = useState<number>(2000);
  const [annualTierKey, setAnnualTierKey] = useState<'STANDARD' | 'PRO'>('STANDARD');
  const [includeExtraQrKit, setIncludeExtraQrKit] = useState<boolean>(false);
  const [simShopCount, setSimShopCount] = useState<number>(10);
  const [simCycle, setSimCycle] = useState<'monthly' | 'annual'>('monthly');

  // Merchant Sign-up & Dispatch State
  const [merchantOrders, setMerchantOrders] = useState<BreakfastMerchantOrder[]>(() =>
    readJsonStorage<BreakfastMerchantOrder[]>(ORDERS_STORAGE_KEY, [])
  );
  const [merchantName, setMerchantName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [tableCount, setTableCount] = useState<number>(10);
  const [menuItemEstimate, setMenuItemEstimate] = useState('約 65 項（蛋餅、吐司、漢堡、鐵板麵、飲料）');
  const [sponsorMid, setSponsorMid] = useState('A-00064');
  const [boundStoreId, setBoundStoreId] = useState('S-HQ-01');
  const [orderNote, setOrderNote] = useState('');

  // QR Stand Preview State
  const [previewShopName, setPreviewShopName] = useState(
    initialShopName?.trim() || '晨光手作早餐店'
  );
  const [previewTableLabel, setPreviewTableLabel] = useState(
    initialTableLabel?.trim() || '1 號桌 · 掃碼免排隊'
  );
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Breakfast Menu & Customer Order State (Self-Typing + Scan-to-Order)
  const [menuItems, setMenuItems] = useState<BreakfastMenuItem[]>(() =>
    readJsonStorage<BreakfastMenuItem[]>(MENU_STORAGE_KEY, DEFAULT_BREAKFAST_MENU)
  );
  const [activeMenuCategory, setActiveMenuCategory] = useState<'全部' | BreakfastMenuItem['category']>('全部');
  const [newDishCategory, setNewDishCategory] = useState<BreakfastMenuItem['category']>('蛋餅');
  const [newDishName, setNewDishName] = useState('');
  const [newDishPrice, setNewDishPrice] = useState<string>('45');
  const [orderTableChoice, setOrderTableChoice] = useState<string>(
    initialTableLabel?.trim() || '1 號桌'
  );
  const [orderPayment, setOrderPayment] = useState<'現金' | 'LINE Pay'>('現金');
  const [orderCustomerNote, setOrderCustomerNote] = useState('');
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);
  const [cartLines, setCartLines] = useState<KitchenOrderLine[]>([]);

  // Kitchen KDS & Daily Settlement State
  const [kitchenTickets, setKitchenTickets] = useState<KitchenTicket[]>(() =>
    readJsonStorage<KitchenTicket[]>(KITCHEN_STORAGE_KEY, [])
  );

  // Toast / Feedback State
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [copiedQuote, setCopiedQuote] = useState(false);

  const showFeedback = (ok: boolean, text: string) => {
    setFeedback({ ok, text });
    setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const selectedAnnualTier = useMemo(
    () => ANNUAL_ALL_IN_TIERS.find((t) => t.key === annualTierKey) || ANNUAL_ALL_IN_TIERS[0],
    [annualTierKey]
  );

  const currentQuote = useMemo(() => {
    const extraQrFee = includeExtraQrKit ? 600 : 0;

    if (selectedPlan === 'SELF_TYPE') {
      const subFee = billingCycle === 'annual' ? 6000 : 500;
      return {
        planName: '方案 1 · 客戶自己打字（自助開業版）',
        setupFeeNtd: 0,
        subscriptionFeeNtd: subFee,
        qrKitFeeNtd: extraQrFee,
        upfrontTotalNtd: subFee + extraQrFee,
        waivedSetupFeeNtd: 0,
        cashflowNote:
          billingCycle === 'annual'
            ? '年繳 NT$ 6,000（12 期 × NT$ 500 閉環分紅），免建置代辦費'
            : '月租 NT$ 500/月（含 30 天免費試用 · 每代 1×5 分紅），免建置代辦費',
      };
    }

    if (selectedPlan === 'COMPANY_SETUP') {
      const subFee = billingCycle === 'annual' ? 6000 : 500;
      return {
        planName: `方案 2 · 公司代辦建置（一次性建置費 NT$ ${setupFeeTier.toLocaleString()}）`,
        setupFeeNtd: setupFeeTier,
        subscriptionFeeNtd: subFee,
        qrKitFeeNtd: extraQrFee,
        upfrontTotalNtd: setupFeeTier + subFee + extraQrFee,
        waivedSetupFeeNtd: 0,
        cashflowNote:
          billingCycle === 'annual'
            ? `建置費 NT$ ${setupFeeTier.toLocaleString()} ＋ 年繳 NT$ 6,000`
            : `首期入袋 NT$ ${(setupFeeTier + 500).toLocaleString()}（含建置代辦費 NT$ ${setupFeeTier.toLocaleString()} ＋ 首月 NT$ 500）`,
      };
    }

    const subFee = selectedAnnualTier.annualPrice;
    return {
      planName: `方案 3 · ${selectedAnnualTier.label}（代打菜單 ＋ 桌貼 QR 立牌寄送）`,
      setupFeeNtd: 0,
      subscriptionFeeNtd: subFee,
      qrKitFeeNtd: extraQrFee,
      upfrontTotalNtd: subFee + extraQrFee,
      waivedSetupFeeNtd: 2500,
      cashflowNote: `一次入袋 NT$ ${(subFee + extraQrFee).toLocaleString()} 年繳現金流（免 NT$ 2,500 建置費 ＋ 含立牌桌貼設計寄送）`,
    };
  }, [selectedPlan, billingCycle, setupFeeTier, selectedAnnualTier, includeExtraQrKit]);

  // 500 NTD Closed-Loop Dividend Simulation (Every Gen = 1 * 5 = 5 pts)
  const dividendSim = useMemo(() => {
    const shops = Math.max(1, Math.min(500, Number(simShopCount) || 1));
    const periods = simCycle === 'annual' ? 12 : 1;
    const totalRent = BREAKFAST_DIVIDEND_CONFIG.MONTHLY_RENT_NTD * shops * periods;
    return {
      shops,
      periods,
      totalRent,
      sponsorPerGen: BREAKFAST_DIVIDEND_CONFIG.SPONSOR_PER_GEN * shops * periods,
      sponsorTotal: BREAKFAST_DIVIDEND_CONFIG.SPONSOR_TOTAL * shops * periods,
      placementPerGen: BREAKFAST_DIVIDEND_CONFIG.PLACEMENT_PER_GEN * shops * periods,
      placementTotal: BREAKFAST_DIVIDEND_CONFIG.PLACEMENT_TOTAL * shops * periods,
      storePerGen: BREAKFAST_DIVIDEND_CONFIG.STORE_PER_GEN * shops * periods,
      storeTotal: BREAKFAST_DIVIDEND_CONFIG.STORE_TOTAL * shops * periods,
      centerPerGen: BREAKFAST_DIVIDEND_CONFIG.CENTER_PER_GEN * shops * periods,
      centerTotal: BREAKFAST_DIVIDEND_CONFIG.CENTER_TOTAL * shops * periods,
      abanyTechTotal: BREAKFAST_DIVIDEND_CONFIG.ABANY_TECH_POOL * shops * periods,
      hqOpsTotal: BREAKFAST_DIVIDEND_CONFIG.HQ_OPS_POOL * shops * periods,
    };
  }, [simShopCount, simCycle]);

  const effectiveShopName = merchantName.trim() || previewShopName;

  const qrStandOrderUrl = useMemo(() => {
    return buildBreakfastPortalUrl(OFFICIAL_SHARED_APP_URL, {
      device: 'mobile',
      tab: 'order',
      shop: effectiveShopName,
      table: previewTableLabel,
    });
  }, [effectiveShopName, previewTableLabel]);

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(qrStandOrderUrl, {
      width: 340,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (mounted) setQrDataUrl(url);
      })
      .catch(() => {
        if (mounted) setQrDataUrl('');
      });
    return () => {
      mounted = false;
    };
  }, [qrStandOrderUrl]);

  // Metrics for Merchant Sign-ups
  const collectedCashflow = useMemo(
    () =>
      merchantOrders
        .filter((o) => o.stage !== 'PENDING_PAYMENT')
        .reduce((sum, o) => sum + o.upfrontTotalNtd, 0),
    [merchantOrders]
  );

  const annualRatio = useMemo(() => {
    if (merchantOrders.length === 0) return 0;
    const count = merchantOrders.filter(
      (o) => o.planKey === 'ANNUAL_ALL_IN' || o.billingCycle === 'annual'
    ).length;
    return Math.round((count / merchantOrders.length) * 100);
  }, [merchantOrders]);

  // Daily Kitchen Settlement Metrics
  const dailySummary = useMemo(() => {
    const totalRevenue = kitchenTickets.reduce((s, t) => s + t.totalAmount, 0);
    const totalOrders = kitchenTickets.length;
    const avgTicket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const pendingCount = kitchenTickets.filter((t) => t.status !== 'DONE').length;
    const cashRevenue = kitchenTickets
      .filter((t) => t.paymentMethod === '現金')
      .reduce((s, t) => s + t.totalAmount, 0);
    const linePayRevenue = totalRevenue - cashRevenue;

    const dishStats = new Map<string, { name: string; qty: number; revenue: number }>();
    kitchenTickets.forEach((t) => {
      t.lines.forEach((l) => {
        const cur = dishStats.get(l.name) || { name: l.name, qty: 0, revenue: 0 };
        cur.qty += l.qty;
        cur.revenue += (l.unitPrice + l.extraPrice) * l.qty;
        dishStats.set(l.name, cur);
      });
    });

    const topDishes = Array.from(dishStats.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    return {
      totalRevenue,
      totalOrders,
      avgTicket,
      pendingCount,
      cashRevenue,
      linePayRevenue,
      topDishes,
    };
  }, [kitchenTickets]);

  const handleSelectPlan = (plan: CommercialPlanKey) => {
    setSelectedPlan(plan);
    if (plan === 'ANNUAL_ALL_IN') {
      setBillingCycle('annual');
      setTableCount(selectedAnnualTier.defaultTables);
    }
  };

  const handleCopyLineQuote = async () => {
    const shop = merchantName.trim() || '貴早餐店';
    const text = [
      `【專屬早餐店智慧點餐系統 · 多方案報價單】`,
      `適用門市：${shop}`,
      `專屬系統網址：${buildBreakfastPortalUrl(OFFICIAL_SHARED_APP_URL, { device: 'mobile' })}`,
      `────────────────────`,
      `一、方案 1｜客戶自己打字（自助開業版）`,
      `・一次性建置代辦費：NT$ 0（附早餐店標準菜單範本，老闆自行打字調整）`,
      `・月租費用：NT$ 500 / 月（含 30 天免費試用，或年繳 NT$ 6,000 / 年）`,
      ``,
      `二、方案 2｜公司代辦建置（專人幫打菜單上架）`,
      `・一次性建置代辦費：NT$ ${setupFeeTier.toLocaleString()}（NT$ 1,500～2,500 依品項數）`,
      `・月租費用：NT$ 500 / 月（或年繳 NT$ 6,000 / 年）`,
      `・公司專人把紙本菜單打好、設定加料標籤並完成獨立雲端試算表串接`,
      ``,
      `三、方案 3｜年繳全包尊榮版（最推薦 · 免建置費送桌貼立牌）`,
      `・標準年繳全包：NT$ 6,000 / 年（12 個月 × NT$ 500）`,
      `・旗艦多桌年繳全包：NT$ 7,500 / 年（含雙立牌＋16 桌貼＋毛利分析）`,
      `・年繳直接免費贈送：專人代打菜單 ＋ 設計並實體寄送櫃檯壓克力立牌與防水桌貼 QR Code（現省 NT$ 2,500+）`,
      `────────────────────`,
      `★ 同享總部閉環月租分紅（月租 500 元 · 每代 1×5 = 5 點）：`,
      `  15 代直推推薦 75 點 ＋ 15 代雙軌安置 75 點 ＋ 6 代經營店 30 點 ＋ 6 代教育中心 30 點 ＋ 科技池 150 點 ＋ 營運池 140 點 ＝ 500 點平帳`,
      `────────────────────`,
      `目前選定方案：${currentQuote.planName}`,
      `首期總計：NT$ ${currentQuote.upfrontTotalNtd.toLocaleString()}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopiedQuote(true);
      setTimeout(() => setCopiedQuote(false), 2500);
      showFeedback(true, '已複製 LINE 專屬報價單文字（含三方案與 500 元 1×5 分紅說明）。');
    } catch {
      showFeedback(false, '剪貼簿權限受限，無法自動複製。');
    }
  };

  const handleCreateMerchantOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const shop = merchantName.trim();
    const owner = ownerName.trim();
    const tel = phone.trim();
    if (!shop || !owner || !tel) {
      showFeedback(false, '請完整填寫早餐店名稱、老闆姓名與聯絡電話。');
      return;
    }
    if (selectedPlan === 'ANNUAL_ALL_IN' && !shippingAddress.trim()) {
      showFeedback(false, '方案 3 含桌貼 QR 立牌實體寄送，請填寫門市收件地址。');
      return;
    }

    const newOrder: BreakfastMerchantOrder = {
      id: `BF-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      merchantName: shop,
      ownerName: owner,
      phone: tel,
      shippingAddress: shippingAddress.trim() || '線上電子檔交付（免寄送）',
      tableCount: Math.max(1, Math.min(80, Number(tableCount) || 1)),
      menuItemEstimate: menuItemEstimate.trim() || '標準早餐菜單',
      sponsorMid: sponsorMid.trim().toUpperCase() || 'A-00064',
      storeId: boundStoreId.trim().toUpperCase() || 'S-HQ-01',
      planKey: selectedPlan,
      planName: currentQuote.planName,
      billingCycle: selectedPlan === 'ANNUAL_ALL_IN' ? 'annual' : billingCycle,
      setupFeeNtd: currentQuote.setupFeeNtd,
      subscriptionFeeNtd: currentQuote.subscriptionFeeNtd,
      qrKitFeeNtd: currentQuote.qrKitFeeNtd,
      upfrontTotalNtd: currentQuote.upfrontTotalNtd,
      waivedSetupFeeNtd: currentQuote.waivedSetupFeeNtd,
      stage: 'PENDING_PAYMENT',
      note: orderNote.trim(),
    };

    const next = [newOrder, ...merchantOrders];
    setMerchantOrders(next);
    writeJsonStorage(ORDERS_STORAGE_KEY, next);
    setPreviewShopName(shop);
    setMerchantName('');
    setOwnerName('');
    setPhone('');
    setShippingAddress('');
    setOrderNote('');
    showFeedback(
      true,
      `已建立簽約派工單 ${newOrder.id}（${shop}），首期應收 NT$ ${newOrder.upfrontTotalNtd.toLocaleString()}（適用 500 元 / 每代 1×5 分紅）。`
    );
  };

  const handleAdvanceOrderStage = (orderId: string) => {
    const next = merchantOrders.map((o) => {
      if (o.id !== orderId) return o;
      const idx = STAGE_ORDER.indexOf(o.stage);
      return { ...o, stage: STAGE_ORDER[(idx + 1) % STAGE_ORDER.length] };
    });
    setMerchantOrders(next);
    writeJsonStorage(ORDERS_STORAGE_KEY, next);
  };

  const handleDeleteMerchantOrder = (orderId: string) => {
    const next = merchantOrders.filter((o) => o.id !== orderId);
    setMerchantOrders(next);
    writeJsonStorage(ORDERS_STORAGE_KEY, next);
    showFeedback(true, `已移除簽約派工單 ${orderId}。`);
  };

  const handleDownloadQrStandPng = (shopTitle?: string, tableText?: string) => {
    if (!qrDataUrl) return;
    const title = (shopTitle || effectiveShopName).trim() || '專屬早餐店';
    const tableLabel = (tableText || previewTableLabel).trim() || '1 號桌 · 掃碼點餐';

    const canvas = document.createElement('canvas');
    canvas.width = 760;
    canvas.height = 1040;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 44px "Noto Sans TC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, 122);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 28px "Noto Sans TC", sans-serif';
    ctx.fillText(tableLabel, canvas.width / 2, 178);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '22px "Noto Sans TC", sans-serif';
    ctx.fillText('手機相機掃描即可點餐 · 免下載 App · 訂單直達煎台', canvas.width / 2, 228);

    const qrSize = 440;
    const qrX = (canvas.width - qrSize) / 2;
    const qrY = 278;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qrX - 24, qrY - 24, qrSize + 48, qrSize + 48);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 25px "Noto Sans TC", sans-serif';
      ctx.fillText('1. 掃描 QR Code   ·   2. 選餐點與客製   ·   3. 送單免排隊', canvas.width / 2, 825);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '20px "Noto Sans TC", sans-serif';
      ctx.fillText('支援內用桌號點餐與上班前外帶預約自取', canvas.width / 2, 886);

      ctx.fillStyle = '#64748b';
      ctx.font = '15px monospace';
      ctx.fillText(`${OFFICIAL_SHARED_APP_URL}/?portal=breakfast`, canvas.width / 2, 956);

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `早餐店桌貼立牌_${title}_${tableLabel.replace(/\s+/g, '')}.png`;
      link.click();
      showFeedback(true, `已匯出印刷級桌貼 QR 立牌 PNG（${title} - ${tableLabel}）。`);
    };
    img.src = qrDataUrl;
  };

  // Menu Self-Typing Handlers
  const handleAddMenuItem = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newDishName.trim();
    const parsedPrice = Math.max(1, Math.round(Number(newDishPrice) || 0));
    if (!cleanName || parsedPrice <= 0) {
      showFeedback(false, '請輸入餐點名稱與正確售價。');
      return;
    }
    const created: BreakfastMenuItem = {
      id: `M-${Date.now().toString().slice(-4)}`,
      category: newDishCategory,
      name: cleanName,
      price: parsedPrice,
      available: true,
    };
    const next = [created, ...menuItems];
    setMenuItems(next);
    writeJsonStorage(MENU_STORAGE_KEY, next);
    setNewDishName('');
    showFeedback(true, `已新增品項「${cleanName}」NT$ ${parsedPrice} 至早餐菜單。`);
  };

  const handleToggleMenuItem = (id: string) => {
    const next = menuItems.map((m) => (m.id === id ? { ...m, available: !m.available } : m));
    setMenuItems(next);
    writeJsonStorage(MENU_STORAGE_KEY, next);
  };

  const handleDeleteMenuItem = (id: string) => {
    const next = menuItems.filter((m) => m.id !== id);
    setMenuItems(next);
    writeJsonStorage(MENU_STORAGE_KEY, next);
  };

  const handleToggleModifier = (label: string) => {
    setSelectedModifiers((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    );
  };

  const handleAddToCart = (dish: BreakfastMenuItem) => {
    const mods = [...selectedModifiers];
    const extraPrice = mods.reduce((sum, label) => {
      const found = QUICK_MODIFIERS.find((m) => m.label === label);
      return sum + (found ? found.extra : 0);
    }, 0);
    const modKey = mods.slice().sort().join('|');

    setCartLines((prev) => {
      const idx = prev.findIndex(
        (line) => line.itemId === dish.id && line.modifiers.slice().sort().join('|') === modKey
      );
      if (idx >= 0) {
        return prev.map((line, i) => (i === idx ? { ...line, qty: line.qty + 1 } : line));
      }
      return [
        ...prev,
        {
          itemId: dish.id,
          name: dish.name,
          unitPrice: dish.price,
          qty: 1,
          modifiers: mods,
          extraPrice,
        },
      ];
    });
    setSelectedModifiers([]);
  };

  const handleAdjustCartQty = (index: number, delta: number) => {
    setCartLines((prev) =>
      prev
        .map((line, i) => (i === index ? { ...line, qty: line.qty + delta } : line))
        .filter((line) => line.qty > 0)
    );
  };

  const cartTotal = useMemo(
    () => cartLines.reduce((sum, l) => sum + (l.unitPrice + l.extraPrice) * l.qty, 0),
    [cartLines]
  );

  const handleSubmitKitchenOrder = () => {
    if (cartLines.length === 0) {
      showFeedback(false, '購物車尚未選取任何早餐品項。');
      return;
    }
    const ticket: KitchenTicket = {
      id: `K-${Date.now().toString().slice(-4)}`,
      createdAt: new Date().toISOString(),
      shopName: previewShopName,
      tableLabel: orderTableChoice,
      paymentMethod: orderPayment,
      lines: cartLines,
      totalAmount: cartTotal,
      status: 'PENDING',
      note: orderCustomerNote.trim(),
    };
    const next = [ticket, ...kitchenTickets];
    setKitchenTickets(next);
    writeJsonStorage(KITCHEN_STORAGE_KEY, next);
    setCartLines([]);
    setOrderCustomerNote('');
    showFeedback(true, `已送出點餐單 ${ticket.id}（${ticket.tableLabel} · NT$ ${ticket.totalAmount}），已同步至廚房出餐看板。`);
  };

  const handleAdvanceTicketStatus = (ticketId: string) => {
    const next = kitchenTickets.map((t) => {
      if (t.id !== ticketId) return t;
      const nextStatus: KitchenTicket['status'] =
        t.status === 'PENDING' ? 'COOKING' : t.status === 'COOKING' ? 'DONE' : 'DONE';
      return { ...t, status: nextStatus };
    });
    setKitchenTickets(next);
    writeJsonStorage(KITCHEN_STORAGE_KEY, next);
  };

  const handleExportDailyCsv = () => {
    const rows = [
      ['單號', '時間', '桌號/外帶', '付款方式', '品項明細', '總金額(NTD)', '狀態', '備註'],
      ...kitchenTickets.map((t) => [
        t.id,
        new Date(t.createdAt).toLocaleString(),
        t.tableLabel,
        t.paymentMethod,
        t.lines
          .map(
            (l) =>
              `${l.name}x${l.qty}${l.modifiers.length ? `(${l.modifiers.join('/')})` : ''}`
          )
          .join(' ; '),
        String(t.totalAmount),
        t.status === 'DONE' ? '已完成' : t.status === 'COOKING' ? '製作中' : '待製作',
        t.note || '',
      ]),
    ];
    const csv =
      '\uFEFF' +
      rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `早餐店日結報表_${previewShopName}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showFeedback(true, '已匯出當日營業日結 CSV，可直接匯入貴店獨立 Google 試算表。');
  };

  const filteredMenu = useMemo(
    () =>
      activeMenuCategory === '全部'
        ? menuItems
        : menuItems.filter((item) => item.category === activeMenuCategory),
    [menuItems, activeMenuCategory]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('plans')}
            className="text-base sm:text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            專屬早餐店智慧系統
          </button>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
            <button
              type="button"
              onClick={() => setActiveTab('plans')}
              className={`whitespace-nowrap shrink-0 pb-1 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'plans'
                  ? 'text-emerald-400 border-emerald-400 font-semibold'
                  : 'border-transparent hover:text-slate-100'
              }`}
            >
              多方案與 500 元分紅
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('onboarding')}
              className={`whitespace-nowrap shrink-0 pb-1 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'onboarding'
                  ? 'text-emerald-400 border-emerald-400 font-semibold'
                  : 'border-transparent hover:text-slate-100'
              }`}
            >
              簽約派工與 QR 立牌
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('order')}
              className={`whitespace-nowrap shrink-0 pb-1 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'order'
                  ? 'text-emerald-400 border-emerald-400 font-semibold'
                  : 'border-transparent hover:text-slate-100'
              }`}
            >
              菜單自建與掃碼點餐
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('kitchen')}
              className={`whitespace-nowrap shrink-0 pb-1 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'kitchen'
                  ? 'text-emerald-400 border-emerald-400 font-semibold'
                  : 'border-transparent hover:text-slate-100'
              }`}
            >
              廚房看板與日結 ({dailySummary.pendingCount})
            </button>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onExitToMain}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{exitLabel}</span>
            </button>
          </div>
        </div>

        {/* Mobile Secondary Tab Bar */}
        <div className="md:hidden border-t border-slate-800/80 px-3 py-2 flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              { id: 'plans', label: '多方案與 500 元分紅' },
              { id: 'onboarding', label: '簽約派工與立牌' },
              { id: 'order', label: '菜單與點餐' },
              { id: 'kitchen', label: `廚房看板 (${dailySummary.pendingCount})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === item.id
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'bg-slate-900 text-slate-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {feedback && (
          <div
            className={`px-4 py-3 rounded-lg border text-xs font-medium ${
              feedback.ok
                ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200'
                : 'bg-amber-950/60 border-amber-700 text-amber-200'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* ==================== TAB 1: MULTI-PLAN & 500 NTD (1x5) DIVIDEND ==================== */}
        {activeTab === 'plans' && (
          <div className="space-y-8">
            {/* Hero Summary & Billing Cadence */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div className="space-y-2 max-w-3xl">
                  <div className="text-xs text-slate-400">
                    <span>獨立專屬早餐店系統</span>
                    <span className="mx-2 text-slate-600">·</span>
                    <span>同主機獨立入口 (?portal=breakfast)</span>
                    <span className="mx-2 text-slate-600">·</span>
                    <span className="text-emerald-400 font-medium">月租 500 元 · 每代 1×5 = 5 點閉環分紅</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-100">
                    早餐店三階收費方案 ＆ 500 元月租閉環分紅系統
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    本系統與一般 AI 軟體 100 元月租入口完全獨立，共用同一套閉環分紅規則並等比例放大 5 倍（月租 NT$ 500、每代 1×5＝5 點）。同時提供「客戶自己打字」、「公司代辦建置費 NT$ 1,500～2,500」與「年繳全包送菜單建置＋桌貼 QR 立牌」三種合作方案。
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setBillingCycle('annual')}
                      className={`px-3.5 py-2 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        billingCycle === 'annual'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      年繳現金流優先
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle('monthly')}
                      className={`px-3.5 py-2 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        billingCycle === 'monthly'
                          ? 'bg-slate-800 text-slate-100'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      月租 500 元檢視
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyLineQuote}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                  >
                    {copiedQuote ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedQuote ? '已複製報價單' : '複製 LINE 報價單'}</span>
                  </button>
                </div>
              </div>

              {/* 4 Key Financials Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-800">
                <div>
                  <div className="text-xs text-slate-400">標準月租閉環基數</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
                    NT$ 500 <span className="text-xs font-normal text-slate-500">/ 月</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">各代分紅倍率（相對 100 元制）</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1">
                    1 × 5 <span className="text-xs font-normal text-slate-500">= 5 點 / 代</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">已簽約入袋現金流</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-amber-300 mt-1">
                    NT$ {collectedCashflow.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">簽約門市 / 年繳佔比</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1">
                    {merchantOrders.length} 家{' '}
                    <span className="text-xs font-normal text-slate-400">({annualRatio}%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Commercial Plans */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
              {/* Plan 1 */}
              <div
                className={`bg-slate-900 rounded-xl p-6 flex flex-col justify-between border transition-colors ${
                  selectedPlan === 'SELF_TYPE'
                    ? 'border-sky-500'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <div className="text-xs text-slate-400">
                      <span>方案 01</span>
                      <span className="mx-1.5 text-slate-600">/</span>
                      <span>老闆自建菜單 · 免建置費</span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-100">客戶自己打字（自助開業版）</h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      附贈台灣早餐店標準菜單範本，由老闆自行打字增改品項與售價，享 30 天免費試用；正式啟用月租 500 元，每期完整進入 1×5 閉環分紅。
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-800 space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold font-mono tabular-nums text-slate-100">
                        NT$ {billingCycle === 'annual' ? '6,000' : '500'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {billingCycle === 'annual' ? '/ 年（12 期 × $500）' : '/ 月（每代 5 點分紅）'}
                      </span>
                    </div>
                    <div className="text-xs font-mono tabular-nums text-slate-400">
                      一次性建置代辦費：NT$ 0（客戶自行打字）
                    </div>
                  </div>

                  <ul className="space-y-2.5 text-xs text-slate-300">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      <span>提供 30 天免費試用，到期唯讀保留店家獨立試算表資料</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      <span>內建蛋餅、吐司、漢堡、鐵板麵、飲品範本自行打字微調</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      <span>完整掃碼點餐、廚房出餐看板與每日營業額日結匯出</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      <span className="text-slate-400">提供電子版桌貼 QR 圖檔（由老闆自行列印）</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectPlan('SELF_TYPE');
                      setActiveTab('onboarding');
                    }}
                    className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      selectedPlan === 'SELF_TYPE'
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    選用方案 1 並前往建單
                  </button>
                </div>
              </div>

              {/* Plan 2 */}
              <div
                className={`bg-slate-900 rounded-xl p-6 flex flex-col justify-between border transition-colors ${
                  selectedPlan === 'COMPANY_SETUP'
                    ? 'border-amber-500'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <div className="text-xs text-amber-400">
                      <span>方案 02</span>
                      <span className="mx-1.5 text-slate-600">/</span>
                      <span>篩掉白嫖客 · 先收回服務成本</span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-100">公司代辦建置（收一次性建置費）</h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      針對沒空打字的早餐店老闆，加收一次性建置代辦費 NT$ 1,500～2,500，由公司專人代打全套菜單與加料選項並測試上線。
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold font-mono tabular-nums text-amber-300">
                          NT$ {setupFeeTier.toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-400">一次性建置代辦費</span>
                      </div>
                      <div className="text-xs font-mono tabular-nums text-slate-300">
                        ＋ 月租：NT$ {billingCycle === 'annual' ? '6,000 / 年' : '500 / 月（1×5 閉環分紅）'}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] text-slate-400">依菜單品項規模選擇一次性建置代辦費：</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {SETUP_FEE_TIERS.map((tier) => (
                          <button
                            key={tier.amount}
                            type="button"
                            onClick={() => {
                              setSetupFeeTier(tier.amount);
                              setSelectedPlan('COMPANY_SETUP');
                            }}
                            className={`py-1.5 px-2 rounded-md text-xs font-mono tabular-nums whitespace-nowrap transition-colors cursor-pointer border ${
                              setupFeeTier === tier.amount
                                ? 'bg-amber-600/20 border-amber-500 text-amber-200 font-semibold'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            ${tier.amount.toLocaleString()}
                          </button>
                        ))}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {SETUP_FEE_TIERS.find((t) => t.amount === setupFeeTier)?.desc}
                      </div>
                    </div>
                  </div>

                  <ul className="space-y-2.5 text-xs text-slate-300">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>老闆拍紙本菜單傳 LINE，公司專人代打全套分類與價格</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>預先設好早餐客製加料標籤（半熟蛋、不加蔥、加起司、冰甜）</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>首日即收回 NT$ 1,500～2,500 建置費，有效過濾白嫖客</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>每月 500 元續約穩定觸發 15 代推薦＋安置與 6 代店/中心分紅</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectPlan('COMPANY_SETUP');
                      setActiveTab('onboarding');
                    }}
                    className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      selectedPlan === 'COMPANY_SETUP'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    選用方案 2 並前往建單
                  </button>
                </div>
              </div>

              {/* Plan 3 */}
              <div
                className={`bg-slate-900 rounded-xl p-6 flex flex-col justify-between border transition-colors ${
                  selectedPlan === 'ANNUAL_ALL_IN'
                    ? 'border-emerald-500'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <div className="text-xs text-emerald-400 font-semibold">
                      <span>方案 03 · 主力推薦</span>
                      <span className="mx-1.5 text-slate-600">/</span>
                      <span>一次入袋 NT$ 6,000～7,500 現金流</span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-100">
                      年繳全包（代打菜單 ＋ 桌貼 QR 立牌寄送）
                    </h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      年繳直接免收 NT$ 2,500 建置代辦費，公司一條龍幫老闆把菜單打好、設計專屬桌貼 QR Code 與壓克力立牌並寄送到店，大幅拉高年繳率。
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold font-mono tabular-nums text-emerald-400">
                          NT$ {selectedAnnualTier.annualPrice.toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-400">
                          / 年（12 期完整 1×5 分紅）
                        </span>
                      </div>
                      <div className="text-xs font-mono tabular-nums text-emerald-300">
                        建置代辦費 NT$ 0（現省 NT$ 2,500 ＋ 免費設計寄送立牌）
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {ANNUAL_ALL_IN_TIERS.map((tier) => (
                        <button
                          key={tier.key}
                          type="button"
                          onClick={() => {
                            setAnnualTierKey(tier.key);
                            setSelectedPlan('ANNUAL_ALL_IN');
                            setBillingCycle('annual');
                            setTableCount(tier.defaultTables);
                          }}
                          className={`py-2 px-2.5 rounded-md text-left transition-colors cursor-pointer border ${
                            annualTierKey === tier.key
                              ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="text-[11px] font-semibold truncate">{tier.label}</div>
                          <div className="text-xs font-mono tabular-nums mt-0.5">
                            NT$ {tier.annualPrice.toLocaleString()}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="text-[11px] text-slate-400 leading-relaxed">
                      {selectedAnnualTier.summary}
                    </div>
                  </div>

                  <ul className="space-y-2.5 text-xs text-slate-300">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>公司專人打好全套菜單並測試完成（免 NT$ 2,500 代辦費）</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>客製設計品牌桌貼 QR Code 與櫃檯壓克力點餐立牌宅配到店</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>每簽 1 家立刻入袋 NT$ 6,000～7,500，資金流與年繳率翻倍</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>12 個月完整觸發 500 元閉環分紅（全年每代 60 點 × 15/6 代）</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectPlan('ANNUAL_ALL_IN');
                      setActiveTab('onboarding');
                    }}
                    className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      selectedPlan === 'ANNUAL_ALL_IN'
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    選用方案 3（年繳全包）並前往建單
                  </button>
                </div>
              </div>
            </div>

            {/* 500 NTD Closed-Loop Dividend Calculator (1 x 5 = 5 pts per gen) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-emerald-400" />
                    <span>500 元月租閉環分紅試算（同原制度 · 每代 1 × 5 = 5 點）</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    完全沿用總部 100 元月租閉環演算法（15% + 15% + 6% + 6% + 30% + 28% = 100%），所有代數獎金等比例放大 5 倍，100% 精準平帳零溢撥。
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <label className="flex items-center gap-2 text-slate-300">
                    <span>簽約早餐店數</span>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={simShopCount}
                      onChange={(e) => setSimShopCount(Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-right font-mono tabular-nums text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-slate-400">家</span>
                  </label>

                  <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setSimCycle('monthly')}
                      className={`px-3 py-1 rounded-md font-medium whitespace-nowrap cursor-pointer ${
                        simCycle === 'monthly'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      單月 (500元/店)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimCycle('annual')}
                      className={`px-3 py-1 rounded-md font-medium whitespace-nowrap cursor-pointer ${
                        simCycle === 'annual'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      年繳 12 期 (6,000元/店)
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold">閉環分紅項目</th>
                      <th className="py-3 px-4 font-semibold">原 100 元制</th>
                      <th className="py-3 px-4 font-semibold text-emerald-300">早餐店 500 元制（1×5）</th>
                      <th className="py-3 px-4 font-semibold text-right">佔比</th>
                      <th className="py-3 px-4 font-semibold text-right">
                        試算單代實領（{dividendSim.shops} 家 · {dividendSim.periods} 期）
                      </th>
                      <th className="py-3 px-4 font-semibold text-right">
                        試算池合計（NTD / 點）
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300 font-mono tabular-nums">
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-sans font-medium text-slate-100">
                        15 代直推推薦分紅
                      </td>
                      <td className="py-3 px-4 text-slate-400">15 代 × 1 點 = 15</td>
                      <td className="py-3 px-4 text-emerald-300 font-semibold">15 代 × 5 點 = 75</td>
                      <td className="py-3 px-4 text-right">15%</td>
                      <td className="py-3 px-4 text-right text-sky-300">
                        {dividendSim.sponsorPerGen.toLocaleString()} 點/代
                      </td>
                      <td className="py-3 px-4 text-right text-slate-100 font-semibold">
                        {dividendSim.sponsorTotal.toLocaleString()}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-sans font-medium text-slate-100">
                        15 代雙軌安置排線分紅
                      </td>
                      <td className="py-3 px-4 text-slate-400">15 代 × 1 點 = 15</td>
                      <td className="py-3 px-4 text-emerald-300 font-semibold">15 代 × 5 點 = 75</td>
                      <td className="py-3 px-4 text-right">15%</td>
                      <td className="py-3 px-4 text-right text-sky-300">
                        {dividendSim.placementPerGen.toLocaleString()} 點/代
                      </td>
                      <td className="py-3 px-4 text-right text-slate-100 font-semibold">
                        {dividendSim.placementTotal.toLocaleString()}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-sans font-medium text-slate-100">
                        6 代經營店輔導補貼
                      </td>
                      <td className="py-3 px-4 text-slate-400">6 代 × 1 點 = 6</td>
                      <td className="py-3 px-4 text-emerald-300 font-semibold">6 代 × 5 點 = 30</td>
                      <td className="py-3 px-4 text-right">6%</td>
                      <td className="py-3 px-4 text-right text-emerald-300">
                        {dividendSim.storePerGen.toLocaleString()} 點/代
                      </td>
                      <td className="py-3 px-4 text-right text-slate-100 font-semibold">
                        {dividendSim.storeTotal.toLocaleString()}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-sans font-medium text-slate-100">
                        6 代教育中心培訓補貼
                      </td>
                      <td className="py-3 px-4 text-slate-400">6 代 × 1 點 = 6</td>
                      <td className="py-3 px-4 text-emerald-300 font-semibold">6 代 × 5 點 = 30</td>
                      <td className="py-3 px-4 text-right">6%</td>
                      <td className="py-3 px-4 text-right text-cyan-300">
                        {dividendSim.centerPerGen.toLocaleString()} 點/代
                      </td>
                      <td className="py-3 px-4 text-right text-slate-100 font-semibold">
                        {dividendSim.centerTotal.toLocaleString()}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-sans font-medium text-slate-100">
                        艾邦妮科技系統研發池
                      </td>
                      <td className="py-3 px-4 text-slate-400">固定 30 點</td>
                      <td className="py-3 px-4 text-slate-200">固定 150 點</td>
                      <td className="py-3 px-4 text-right">30%</td>
                      <td className="py-3 px-4 text-right text-slate-500">—</td>
                      <td className="py-3 px-4 text-right text-slate-100 font-semibold">
                        {dividendSim.abanyTechTotal.toLocaleString()}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-sans font-medium text-slate-100">
                        總公司營運行政管理池
                      </td>
                      <td className="py-3 px-4 text-slate-400">固定 28 點</td>
                      <td className="py-3 px-4 text-slate-200">固定 140 點</td>
                      <td className="py-3 px-4 text-right">28%</td>
                      <td className="py-3 px-4 text-right text-slate-500">—</td>
                      <td className="py-3 px-4 text-right text-slate-100 font-semibold">
                        {dividendSim.hqOpsTotal.toLocaleString()}
                      </td>
                    </tr>
                    <tr className="bg-slate-950/70 font-bold text-emerald-400">
                      <td className="py-3.5 px-4 font-sans">100% 閉環平帳總計</td>
                      <td className="py-3.5 px-4 text-slate-400">100 點</td>
                      <td className="py-3.5 px-4">500 點 / 店 / 月</td>
                      <td className="py-3.5 px-4 text-right">100%</td>
                      <td className="py-3.5 px-4 text-right text-slate-400">零溢撥</td>
                      <td className="py-3.5 px-4 text-right text-base">
                        NT$ {dividendSim.totalRent.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: ONBOARDING DISPATCH & PRINTABLE QR STAND ==================== */}
        {activeTab === 'onboarding' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left: Sign-up & Setup Dispatch Form */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-400" />
                    <span>建立早餐店簽約建置派工單（綁定 500 元分紅鏈）</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    切換下方方案後填寫早餐店資料與推薦人／輔導店代號，自動計算首期應收金額並排入建置與寄送流程。
                  </p>
                </div>

                {/* Quick Plan Selector Inside Form */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {(
                    [
                      { key: 'SELF_TYPE', label: '方案 1 · 自己打字' },
                      { key: 'COMPANY_SETUP', label: '方案 2 · 收建置費' },
                      { key: 'ANNUAL_ALL_IN', label: '方案 3 · 年繳全包' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleSelectPlan(item.key)}
                      className={`py-2 px-2.5 rounded-lg border font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        selectedPlan === item.key
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleCreateMerchantOrder} className="space-y-4 text-xs">
                  <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-100">{currentQuote.planName}</span>
                      <span className="font-mono tabular-nums text-base font-bold text-emerald-400">
                        首期應收 NT$ {currentQuote.upfrontTotalNtd.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">{currentQuote.cashflowNote}</div>
                    <label className="flex items-center gap-2 pt-1 text-[11px] text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={includeExtraQrKit}
                        onChange={(e) => setIncludeExtraQrKit(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 accent-emerald-500"
                      />
                      <span>加購「防水桌貼 QR Code 擴充 10 張 ＋ 備用壓克力立牌 1 組」（+NT$ 600）</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">早餐店店名</label>
                      <input
                        type="text"
                        value={merchantName}
                        onChange={(e) => setMerchantName(e.target.value)}
                        placeholder="例：永吉晨光手作早餐店"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">老闆 / 聯絡人</label>
                      <input
                        type="text"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        placeholder="例：林老闆"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">聯絡手機 / 電話</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0912-345-678"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">推薦人 MID（15 代 1×5）</label>
                      <input
                        type="text"
                        value={sponsorMid}
                        onChange={(e) => setSponsorMid(e.target.value)}
                        placeholder="A-00064"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">輔導店代號（6 代 1×5）</label>
                      <input
                        type="text"
                        value={boundStoreId}
                        onChange={(e) => setBoundStoreId(e.target.value)}
                        placeholder="S-HQ-01"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-slate-400 mb-1 font-medium">
                        桌貼 QR 立牌寄送地址{selectedPlan === 'ANNUAL_ALL_IN' ? '（方案 3 必填）' : '（選填）'}
                      </label>
                      <input
                        type="text"
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                        placeholder="寄送壓克力立牌與防水桌貼之門市地址"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">內用桌數</label>
                      <input
                        type="number"
                        min={1}
                        max={80}
                        value={tableCount}
                        onChange={(e) => setTableCount(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">預估菜單品項規模</label>
                      <input
                        type="text"
                        value={menuItemEstimate}
                        onChange={(e) => setMenuItemEstimate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">備註（收款方式 / 急件需求）</label>
                      <input
                        type="text"
                        value={orderNote}
                        onChange={(e) => setOrderNote(e.target.value)}
                        placeholder="例：年繳轉帳已完成，需先打菜單"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCopyLineQuote}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold whitespace-nowrap cursor-pointer"
                    >
                      複製報價給老闆
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold whitespace-nowrap cursor-pointer"
                    >
                      確認建立簽約建置單
                    </button>
                  </div>
                </form>
              </div>

              {/* Right: Printable QR Desk Stand Designer */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-emerald-400" />
                    <span>桌貼 QR Code 立牌預覽與印刷匯出</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    客人掃描立牌 QR Code 會直接進入本系統的「早餐店掃碼點餐頁」並自動帶入店名與桌號。
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">立牌顯示店名</label>
                    <input
                      type="text"
                      value={merchantName || previewShopName}
                      onChange={(e) => {
                        if (merchantName) setMerchantName(e.target.value);
                        else setPreviewShopName(e.target.value);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">桌號 / 外帶標語</label>
                    <input
                      type="text"
                      value={previewTableLabel}
                      onChange={(e) => setPreviewTableLabel(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col items-center text-center space-y-3">
                  <div>
                    <div className="text-base font-bold text-slate-100">{effectiveShopName}</div>
                    <div className="text-xs font-semibold text-emerald-400 mt-0.5">{previewTableLabel}</div>
                  </div>
                  {qrDataUrl ? (
                    <div className="p-2.5 bg-white rounded-lg">
                      <img
                        src={qrDataUrl}
                        alt={`${effectiveShopName} 點餐 QR Code`}
                        className="w-40 h-40 block"
                      />
                    </div>
                  ) : (
                    <div className="w-44 h-44 bg-slate-900 rounded-lg flex items-center justify-center text-xs text-slate-500">
                      產生 QR Code 中...
                    </div>
                  )}
                  <div className="text-[11px] text-slate-400">
                    掃描直接進入專屬早餐店點餐頁 · 訂單直達廚房看板
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownloadQrStandPng()}
                  disabled={!qrDataUrl}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>下載印刷級桌貼 QR 立牌 (PNG)</span>
                </button>
              </div>
            </div>

            {/* Dispatch Tracking Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-400" />
                    <span>已簽約早餐店建置與立牌寄送進度表</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    點擊進度狀態即可依序推進交付流程（待收款 → 代打菜單 → 立牌寄送 → 上線營業）。
                  </p>
                </div>
                <div className="text-xs font-mono tabular-nums text-slate-400">
                  共 {merchantOrders.length} 家簽約門市
                </div>
              </div>

              {merchantOrders.length === 0 ? (
                <div className="py-10 px-4 text-center border border-dashed border-slate-800 rounded-lg space-y-2">
                  <UtensilsCrossed className="w-7 h-7 text-slate-600 mx-auto" />
                  <div className="text-sm font-medium text-slate-300">尚未建立早餐店簽約派工單</div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    請於上方填寫簽約早餐店資訊並選擇合作方案，即可開始追蹤建置、立牌寄送與 500 元閉環分紅。
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4 font-semibold">單號 / 日期</th>
                        <th className="py-3 px-4 font-semibold">早餐店 / 老闆</th>
                        <th className="py-3 px-4 font-semibold">推薦 / 輔導鏈</th>
                        <th className="py-3 px-4 font-semibold">選定方案</th>
                        <th className="py-3 px-4 font-semibold text-right">首期應收</th>
                        <th className="py-3 px-4 font-semibold">建置寄送進度</th>
                        <th className="py-3 px-4 font-semibold text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-slate-300">
                      {merchantOrders.map((order) => {
                        const stageInfo = STAGE_META[order.stage];
                        return (
                          <tr key={order.id} className="hover:bg-slate-800/30">
                            <td className="py-3 px-4 font-mono tabular-nums">
                              <div className="text-slate-200 font-semibold">{order.id}</div>
                              <div className="text-[11px] text-slate-500">
                                {new Date(order.createdAt).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-100">{order.merchantName}</div>
                              <div className="text-[11px] text-slate-400">
                                {order.ownerName} · <span className="font-mono">{order.phone}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                                {order.shippingAddress}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px]">
                              <div className="text-sky-300">推：{order.sponsorMid}</div>
                              <div className="text-emerald-300">店：{order.storeId}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-slate-200 font-medium">{order.planName}</div>
                              <div className="text-[11px] text-slate-400">
                                桌貼 {order.tableCount} 桌 · 月租 500 元 (1×5)
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">
                              <div className="font-bold text-emerald-400">
                                NT$ {order.upfrontTotalNtd.toLocaleString()}
                              </div>
                              {order.waivedSetupFeeNtd > 0 && (
                                <div className="text-[11px] text-slate-500">
                                  年繳免建置 -${order.waivedSetupFeeNtd.toLocaleString()}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => handleAdvanceOrderStage(order.id)}
                                className={`text-xs font-semibold hover:underline cursor-pointer text-left ${stageInfo.textClass}`}
                              >
                                {stageInfo.label}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDownloadQrStandPng(
                                      order.merchantName,
                                      `1～${order.tableCount} 號桌 · 掃碼點餐`
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-[11px] font-medium cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>輸出立牌</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMerchantOrder(order.id)}
                                  className="p-1.5 text-slate-500 hover:text-rose-400 rounded-md cursor-pointer"
                                  title="刪除此派工單"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 3: SELF-TYPING MENU EDITOR & CUSTOMER SCAN-TO-ORDER ==================== */}
        {activeTab === 'order' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Menu Catalog & Owner Self-Typing Bar */}
            <div className="lg:col-span-8 space-y-5">
              {/* Self-Typing Quick Add Dish Bar */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-100">
                      {previewShopName} · 早餐店菜單管理（支援老闆自己打字新增／改價）
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      方案 1 客戶可在此直接自行鍵入餐點與售價；方案 2／3 則由公司專人代打上架完成。
                    </p>
                  </div>
                </div>

                <form onSubmit={handleAddMenuItem} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
                  <select
                    value={newDishCategory}
                    onChange={(e) =>
                      setNewDishCategory(e.target.value as BreakfastMenuItem['category'])
                    }
                    className="sm:col-span-3 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {MENU_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newDishName}
                    onChange={(e) => setNewDishName(e.target.value)}
                    placeholder="輸入餐點名稱（例：薯餅起司蛋餅）"
                    className="sm:col-span-5 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="number"
                    min={1}
                    value={newDishPrice}
                    onChange={(e) => setNewDishPrice(e.target.value)}
                    placeholder="售價"
                    className="sm:col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    className="sm:col-span-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    新增品項
                  </button>
                </form>
              </div>

              {/* Category Filter & Modifiers */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['全部', ...MENU_CATEGORIES] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setActiveMenuCategory(cat)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                          activeMenuCategory === cat
                            ? 'bg-emerald-600 text-white font-semibold'
                            : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-400">
                    共 {filteredMenu.length} 項餐點
                  </div>
                </div>

                {/* Quick Breakfast Customization Toggles */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <div className="text-[11px] text-slate-400">
                    點餐前可先勾選常用客製標籤（加入購物車後自動套用）：
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_MODIFIERS.map((mod) => {
                      const active = selectedModifiers.includes(mod.label);
                      return (
                        <button
                          key={mod.label}
                          type="button"
                          onClick={() => handleToggleModifier(mod.label)}
                          className={`px-2.5 py-1.5 rounded-md text-xs border whitespace-nowrap cursor-pointer transition-colors ${
                            active
                              ? 'bg-amber-600/20 border-amber-500 text-amber-200 font-semibold'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {mod.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Menu Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {filteredMenu.map((dish) => (
                    <div
                      key={dish.id}
                      className={`p-3.5 rounded-lg border flex items-center justify-between gap-3 ${
                        dish.available
                          ? 'bg-slate-950 border-slate-800'
                          : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-500">{dish.category}</div>
                        <div className="text-sm font-semibold text-slate-100 truncate">
                          {dish.name}
                        </div>
                        <div className="text-sm font-mono tabular-nums font-bold text-emerald-400 mt-0.5">
                          NT$ {dish.price}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleMenuItem(dish.id)}
                          className="px-2 py-1.5 text-[11px] bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-md cursor-pointer"
                        >
                          {dish.available ? '售完' : '上架'}
                        </button>
                        <button
                          type="button"
                          disabled={!dish.available}
                          onClick={() => handleAddToCart(dish)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>點餐</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMenuItem(dish.id)}
                          className="p-1.5 text-slate-600 hover:text-rose-400 cursor-pointer"
                          title="刪除品項"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Customer Scan-to-Order Cart */}
            <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 lg:sticky lg:top-20">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  <span>掃碼點餐清單</span>
                </h3>
                <span className="text-xs font-mono tabular-nums text-slate-400">
                  {cartLines.reduce((s, l) => s + l.qty, 0)} 份
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">內用桌號 / 外帶</label>
                  <select
                    value={orderTableChoice}
                    onChange={(e) => setOrderTableChoice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="外帶自取">外帶自取</option>
                    <option value="預約外帶 07:30">預約外帶 07:30</option>
                    <option value="預約外帶 08:00">預約外帶 08:00</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <option key={n} value={`${n} 號桌`}>
                        {n} 號桌
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">付款方式</label>
                  <select
                    value={orderPayment}
                    onChange={(e) => setOrderPayment(e.target.value as '現金' | 'LINE Pay')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="現金">現金結帳</option>
                    <option value="LINE Pay">LINE Pay</option>
                  </select>
                </div>
              </div>

              {cartLines.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  請從左側點選餐點加入購物車
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {cartLines.map((line, idx) => (
                    <div
                      key={`${line.itemId}-${idx}`}
                      className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-100 truncate">{line.name}</div>
                        {line.modifiers.length > 0 && (
                          <div className="text-[11px] text-amber-300 mt-0.5">
                            {line.modifiers.join(' · ')}
                          </div>
                        )}
                        <div className="font-mono tabular-nums text-emerald-400 mt-0.5">
                          NT$ {(line.unitPrice + line.extraPrice) * line.qty}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAdjustCartQty(idx, -1)}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center font-mono tabular-nums font-bold">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAdjustCartQty(idx, 1)}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={orderCustomerNote}
                onChange={(e) => setOrderCustomerNote(e.target.value)}
                placeholder="訂單備註（例：醬油膏分開包、不要胡椒）"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
              />

              <div className="pt-3 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">應付總金額</span>
                  <span className="text-xl font-bold font-mono tabular-nums text-emerald-400">
                    NT$ {cartTotal.toLocaleString()}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSubmitKitchenOrder}
                  disabled={cartLines.length === 0}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold text-xs rounded-lg whitespace-nowrap cursor-pointer"
                >
                  送出訂單直達廚房出餐看板
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 4: KITCHEN KDS & DAILY SETTLEMENT ==================== */}
        {activeTab === 'kitchen' && (
          <div className="space-y-6">
            {/* Daily Settlement KPI Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <ChefHat className="w-4 h-4 text-emerald-400" />
                    <span>廚房即時出餐看板（KDS）＆ 每日營收日結</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    煎台與飲料吧即時點按推單，打烊一鍵匯出當日明細 CSV 同步至老闆獨立 Google 試算表。
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportDailyCsv}
                  disabled={kitchenTickets.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>匯出當日營業日結 CSV</span>
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-800">
                <div>
                  <div className="text-xs text-slate-400">今日累計營業額</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
                    NT$ {dailySummary.totalRevenue.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                    現金 ${dailySummary.cashRevenue} · LINE Pay ${dailySummary.linePayRevenue}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">今日總訂單數</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1">
                    {dailySummary.totalOrders} <span className="text-xs font-normal text-slate-500">筆</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">平均客單價</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1">
                    NT$ {dailySummary.avgTicket}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">待製作 / 製作中</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-amber-300 mt-1">
                    {dailySummary.pendingCount} <span className="text-xs font-normal text-slate-500">單</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3-Column KDS Queue */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {(
                [
                  { status: 'PENDING', title: '待製作新單', actionLabel: '開始製作', accent: 'text-amber-400' },
                  { status: 'COOKING', title: '煎台製作中', actionLabel: '完成出餐', accent: 'text-sky-400' },
                  { status: 'DONE', title: '已出餐 / 已結帳', actionLabel: '', accent: 'text-emerald-400' },
                ] as const
              ).map((col) => {
                const list = kitchenTickets.filter((t) => t.status === col.status);
                return (
                  <div
                    key={col.status}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <h3 className={`text-sm font-bold ${col.accent}`}>{col.title}</h3>
                      <span className="text-xs font-mono tabular-nums text-slate-400">
                        {list.length} 單
                      </span>
                    </div>

                    {list.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500">目前無此狀態訂單</div>
                    ) : (
                      <div className="space-y-3">
                        {list.map((ticket) => (
                          <div
                            key={ticket.id}
                            className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-100">
                                {ticket.tableLabel} · <span className="font-mono">{ticket.id}</span>
                              </span>
                              <span className="font-mono tabular-nums text-emerald-400 font-bold">
                                NT$ {ticket.totalAmount}
                              </span>
                            </div>

                            <div className="space-y-1 text-slate-300">
                              {ticket.lines.map((l, i) => (
                                <div key={i} className="flex items-start justify-between gap-2">
                                  <span>
                                    {l.name} × {l.qty}
                                    {l.modifiers.length > 0 && (
                                      <span className="text-amber-300 ml-1">
                                        ({l.modifiers.join(' / ')})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {ticket.note && (
                              <div className="text-[11px] text-amber-300">備註：{ticket.note}</div>
                            )}

                            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                              <span>
                                {ticket.paymentMethod} ·{' '}
                                {new Date(ticket.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {col.actionLabel && (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceTicketStatus(ticket.id)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-md cursor-pointer"
                                >
                                  {col.actionLabel}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Top Selling Dishes Table */}
            {dailySummary.topDishes.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-100">當日熱銷品項統計</h3>
                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">品項名稱</th>
                        <th className="py-2.5 px-4 font-semibold text-right">售出份數</th>
                        <th className="py-2.5 px-4 font-semibold text-right">銷售金額 (NTD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-slate-300 font-mono tabular-nums">
                      {dailySummary.topDishes.map((d) => (
                        <tr key={d.name}>
                          <td className="py-2.5 px-4 font-sans text-slate-100">{d.name}</td>
                          <td className="py-2.5 px-4 text-right">{d.qty} 份</td>
                          <td className="py-2.5 px-4 text-right text-emerald-400 font-semibold">
                            NT$ {d.revenue.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
