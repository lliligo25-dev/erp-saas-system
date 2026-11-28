/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Apple,
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  CalendarClock,
  Check,
  Contact,
  FolderOpen,
  HeartPulse,
  ListTodo,
  Network,
  Package,
  Scissors,
  ShoppingBag,
  ShoppingBasket,
  SlidersHorizontal,
  User,
  UtensilsCrossed,
} from 'lucide-react';
import {
  MEMBER_WORKSPACE_META_UPDATED_EVENT,
  setMemberProfessionRaw,
} from '../services/memberFiveStarConfig';

export type ProfessionKey =
  | 'TCM_THERAPIST'
  | 'BREAKFAST_OWNER'
  | 'NAIL_BEAUTY'
  | 'FRUIT_SHOP'
  | 'ECOMMERCE_SELLER'
  | 'ATOMY_LEADER'
  | 'ASSOC_OFFICER'
  | 'ELDER_CARE';

export interface ProfessionModuleShortcut {
  label: string;
  desc: string;
  targetSys: string;
  baseKey: string;
  isBreakfastApp?: boolean;
}

export interface ProfessionDefinition {
  key: ProfessionKey;
  title: string;
  shortName: string;
  industryTag: string;
  summary: string;
  primaryBaseKey: string;
  primaryTargetSys: string;
  isBreakfastApp?: boolean;
  shortcuts: ProfessionModuleShortcut[];
}

export const MEMBER_PROFESSION_CATALOG: ProfessionDefinition[] = [
  {
    key: 'TCM_THERAPIST',
    title: '傳統理療師系統',
    shortName: '傳統理療師系統',
    industryTag: '推拿整復 · 經絡調理',
    summary: '專為傳統理療師與推拿調理師設計：建立顧客體質與部位症狀主檔、紀錄每次調理處置與療程收費，並銜接預約排班與同業公會。',
    primaryBaseKey: 'TCM',
    primaryTargetSys: 'TCM_M',
    shortcuts: [
      {
        label: '傳統理療顧客主檔',
        desc: '記錄顧客姓名、聯絡方式、主要不適部位與調理備註',
        targetSys: 'TCM_M',
        baseKey: 'TCM',
      },
      {
        label: '理療處置與營收流水',
        desc: '記錄每次推拿調理部位、處置內容、療程收費與業績統計',
        targetSys: 'TCM_T',
        baseKey: 'TCM',
      },
      {
        label: '理療時段預約排程',
        desc: '管理顧客預約看診／調理時段，避免尖峰撞單',
        targetSys: 'BOOKING',
        baseKey: 'BOOKING',
      },
      {
        label: '中醫藥聯誼會 / 同業交流',
        desc: '選配診所單位、同業職務與會費活動紀錄',
        targetSys: 'ASSOC_M',
        baseKey: 'ASSOC',
      },
    ],
  },
  {
    key: 'BREAKFAST_OWNER',
    title: '專屬早餐店 / 餐飲門市系統',
    shortName: '專屬早餐店系統',
    industryTag: '餐飲門市 · 月租 500 元 (1×5 分紅)',
    summary: '獨立早餐店智慧系統：桌邊掃碼點餐、老闆自己打字改菜單、廚房即時出餐看板（KDS）、每日日結 CSV 與三階多方案桌貼立牌。',
    primaryBaseKey: 'BREAKFAST',
    primaryTargetSys: 'BREAKFAST_APP',
    isBreakfastApp: true,
    shortcuts: [
      {
        label: '開啟獨立專屬早餐店系統',
        desc: '掃碼點餐前台、老闆自建菜單、廚房出餐看板與每日日結',
        targetSys: 'BREAKFAST_APP',
        baseKey: 'BREAKFAST',
        isBreakfastApp: true,
      },
      {
        label: '食材與門市聯絡人',
        desc: '管理蛋商、吐司供應商與熟客電話',
        targetSys: 'CONTACT_M',
        baseKey: 'CONTACT',
      },
    ],
  },
  {
    key: 'NAIL_BEAUTY',
    title: '美甲 / 美容 / 醫美設計師系統',
    shortName: '美甲醫美系統',
    industryTag: '美業沙龍 · 預約施作',
    summary: '管理熟客款式偏好、設計師排班、施作項目與預估收費流水，並自動累計今日與本月業績。',
    primaryBaseKey: 'NAIL',
    primaryTargetSys: 'NAIL_M',
    shortcuts: [
      {
        label: '美甲醫美顧客主檔',
        desc: '記錄設計師、常做款式與顧客肌膚／甲況備註',
        targetSys: 'NAIL_M',
        baseKey: 'NAIL',
      },
      {
        label: '施作預約與業績流水',
        desc: '追蹤每次施作項目、作品照片與實收金額',
        targetSys: 'NAIL_T',
        baseKey: 'NAIL',
      },
      {
        label: '線上預約排程管理',
        desc: '整合個人預約表單承接新舊客預約時段',
        targetSys: 'BOOKING',
        baseKey: 'BOOKING',
      },
    ],
  },
  {
    key: 'FRUIT_SHOP',
    title: '水果店 / 生鮮零售系統',
    shortName: '水果店管理系統',
    industryTag: '生鮮門市 · 進銷存管理',
    summary: '記錄果品單價、產地、供應商與安全庫存，即時登記進貨與批發零售流水。',
    primaryBaseKey: 'FRUIT',
    primaryTargetSys: 'FRUIT_M',
    shortcuts: [
      {
        label: '水果品項與產地主檔',
        desc: '單價、目前庫存、產地與配合果農供應商',
        targetSys: 'FRUIT_M',
        baseKey: 'FRUIT',
      },
      {
        label: '每日進銷存流水',
        desc: '進出貨數量、金額與每日營收結算',
        targetSys: 'FRUIT_T',
        baseKey: 'FRUIT',
      },
    ],
  },
  {
    key: 'ECOMMERCE_SELLER',
    title: '團購 / 產銷電商賣家系統',
    shortName: '產銷團購系統',
    industryTag: '商品型錄 · 訂單出貨',
    summary: '建立商品目錄、售價單位與高清實拍圖，追蹤團購下單、收款與出貨紀錄。',
    primaryBaseKey: 'PRODUCT',
    primaryTargetSys: 'PRODUCT_M',
    shortcuts: [
      {
        label: '購物車產品主檔',
        desc: '管理商品分類、單價、規格單位與商品實拍',
        targetSys: 'PRODUCT_M',
        baseKey: 'PRODUCT',
      },
      {
        label: '訂單與出貨紀錄',
        desc: '追蹤買家訂購明細、收款與寄送進度',
        targetSys: 'PRODUCT_T',
        baseKey: 'PRODUCT',
      },
    ],
  },
  {
    key: 'ATOMY_LEADER',
    title: '艾多美 / 直銷組織經營系統',
    shortName: '組織經營系統',
    industryTag: '團隊推薦 · 左右線跟進',
    summary: '系統化管理經營者與愛用者名單、推薦／安置關係與左右線別，並追蹤商品體驗與成交紀錄。',
    primaryBaseKey: 'ATOMY',
    primaryTargetSys: 'ATOMY_M',
    shortcuts: [
      {
        label: '艾多美會員主檔',
        desc: '記錄會員編號、推薦人、安置人與左右線別',
        targetSys: 'ATOMY_M',
        baseKey: 'ATOMY',
      },
      {
        label: '銷售與跟進紀錄',
        desc: '追蹤體驗回饋、消費項目與回購金額',
        targetSys: 'ATOMY_T',
        baseKey: 'ATOMY',
      },
    ],
  },
  {
    key: 'ASSOC_OFFICER',
    title: '公會 / 協會 / 社團幹部系統',
    shortName: '公會聯誼系統',
    industryTag: '理監事會務 · 會費活動',
    summary: '管理會員診所與公司單位、理監事職務、常年會費繳交狀態與聯誼活動花絮。',
    primaryBaseKey: 'ASSOC',
    primaryTargetSys: 'ASSOC_M',
    shortcuts: [
      {
        label: '公會會員名冊主檔',
        desc: '診所單位、職務別、聯絡方式與年度會籍',
        targetSys: 'ASSOC_M',
        baseKey: 'ASSOC',
      },
      {
        label: '會費繳納與活動紀錄',
        desc: '記錄繳費進度、例會簽到與餐敘活動',
        targetSys: 'ASSOC_T',
        baseKey: 'ASSOC',
      },
    ],
  },
  {
    key: 'ELDER_CARE',
    title: '銀髮照護 / 社區關懷師系統',
    shortName: '長者關懷系統',
    industryTag: '社區照護 · 訪視追蹤',
    summary: '建立長輩班別、緊急聯絡人與家屬資料，定期紀錄訪視關懷與健康狀態追蹤。',
    primaryBaseKey: 'ELDER',
    primaryTargetSys: 'ELDER_M',
    shortcuts: [
      {
        label: '長者基本與家屬主檔',
        desc: '班別、班長、緊急電話與家屬聯絡方式',
        targetSys: 'ELDER_M',
        baseKey: 'ELDER',
      },
      {
        label: '訪視與關懷紀錄',
        desc: '每次電話問候、家訪照片與照護備忘',
        targetSys: 'ELDER_T',
        baseKey: 'ELDER',
      },
    ],
  },
];

const PERSONAL_OPTIONAL_PACKS = [
  {
    baseKey: 'BOOKING',
    targetSys: 'BOOKING',
    title: '個人預約系統',
    desc: '個人會面與行程預約排程',
  },
  {
    baseKey: 'TODO',
    targetSys: 'TODO_BOARD',
    title: '個人待辦任務面板',
    desc: '每日待辦拖曳看板與到期提醒',
  },
  {
    baseKey: 'GROCERY',
    targetSys: 'GROCERY_M',
    title: '家庭食材庫存 (FIFO)',
    desc: '冰箱與居家日用品效期管理',
  },
  {
    baseKey: 'ELDER',
    targetSys: 'ELDER_M',
    title: '長輩家人關懷紀錄',
    desc: '記錄家中長輩健康與重要聯絡',
  },
] as const;

function professionStorageKey(memberMid: string): string {
  return `ais_member_profession_v1_${memberMid.trim().toUpperCase()}`;
}

function getDefaultProfessionForMember(memberMid: string, memberName: string): ProfessionKey | null {
  const normalizedMid = memberMid.trim().toUpperCase();
  if (normalizedMid === 'A-00064' || memberName.includes('李永吉')) {
    return 'TCM_THERAPIST';
  }
  return null;
}

export function loadMemberProfession(memberMid: string, memberName: string): ProfessionKey | null {
  if (typeof window === 'undefined') {
    return getDefaultProfessionForMember(memberMid, memberName);
  }
  try {
    const saved = window.localStorage.getItem(professionStorageKey(memberMid));
    if (saved && MEMBER_PROFESSION_CATALOG.some((p) => p.key === saved)) {
      return saved as ProfessionKey;
    }
  } catch {
    // ignore storage errors
  }
  return getDefaultProfessionForMember(memberMid, memberName);
}

export function saveMemberProfession(memberMid: string, key: ProfessionKey): void {
  setMemberProfessionRaw(memberMid, key);
}

function getProfessionIcon(key: ProfessionKey) {
  switch (key) {
    case 'TCM_THERAPIST':
      return Activity;
    case 'BREAKFAST_OWNER':
      return UtensilsCrossed;
    case 'NAIL_BEAUTY':
      return Scissors;
    case 'FRUIT_SHOP':
      return Apple;
    case 'ECOMMERCE_SELLER':
      return Package;
    case 'ATOMY_LEADER':
      return Network;
    case 'ASSOC_OFFICER':
      return Building2;
    case 'ELDER_CARE':
      return HeartPulse;
  }
}

interface MemberPersonalProHomeProps {
  memberMid: string;
  memberName: string;
  unlockedPacks: string[];
  sysCounts: Record<string, number>;
  overdueTodoCount: number;
  cloudTabCount: number;
  onEnterModule: (sysKey: string, ensureBaseKey?: string) => void;
  onTogglePersonalPack: (baseKey: string) => void;
  onEnsurePackUnlocked: (baseKey: string) => void;
  onOpenAllFeed: () => void;
  onOpenOrgTree: () => void;
  onOpenOrderStore: () => void;
  onOpenCloudSheet: () => void;
  onOpenBreakfastSystem?: () => void;
}

export const MemberPersonalProHome: React.FC<MemberPersonalProHomeProps> = ({
  memberMid,
  memberName,
  unlockedPacks,
  sysCounts,
  overdueTodoCount,
  cloudTabCount,
  onEnterModule,
  onTogglePersonalPack,
  onEnsurePackUnlocked,
  onOpenAllFeed,
  onOpenOrgTree,
  onOpenOrderStore,
  onOpenCloudSheet,
  onOpenBreakfastSystem,
}) => {
  const [selectedProfessionKey, setSelectedProfessionKey] = useState<ProfessionKey | null>(() =>
    loadMemberProfession(memberMid, memberName)
  );
  const [showProfessionPicker, setShowProfessionPicker] = useState<boolean>(false);
  const [showPersonalCustomize, setShowPersonalCustomize] = useState<boolean>(false);

  useEffect(() => {
    const loaded = loadMemberProfession(memberMid, memberName);
    setSelectedProfessionKey(loaded);
  }, [memberMid, memberName]);

  useEffect(() => {
    const normMid = memberMid.trim().toUpperCase();
    const onMetaUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent<{ memberMid?: string }>).detail;
      if (!detail?.memberMid || detail.memberMid.trim().toUpperCase() === normMid) {
        setSelectedProfessionKey(loadMemberProfession(memberMid, memberName));
      }
    };
    window.addEventListener(MEMBER_WORKSPACE_META_UPDATED_EVENT, onMetaUpdated);
    return () => window.removeEventListener(MEMBER_WORKSPACE_META_UPDATED_EVENT, onMetaUpdated);
  }, [memberMid, memberName]);

  // If the member already has a default/selected profession (e.g. 李永吉 -> 傳統理療師系統),
  // make sure its primary industry pack is unlocked silently so records & sheet tabs are ready.
  useEffect(() => {
    if (!selectedProfessionKey) return;
    const def = MEMBER_PROFESSION_CATALOG.find((p) => p.key === selectedProfessionKey);
    if (def && !def.isBreakfastApp && !unlockedPacks.includes(def.primaryBaseKey)) {
      onEnsurePackUnlocked(def.primaryBaseKey);
    }
  }, [selectedProfessionKey, unlockedPacks, onEnsurePackUnlocked]);

  const selectedProfession = useMemo(
    () => MEMBER_PROFESSION_CATALOG.find((p) => p.key === selectedProfessionKey) || null,
    [selectedProfessionKey]
  );

  const personalModules = useMemo(() => {
    const items: Array<{
      label: string;
      desc: string;
      targetSys: string;
      baseKey: string;
      count: number;
      icon: React.ComponentType<{ className?: string }>;
      alertText?: string;
    }> = [
      {
        label: '通訊錄系統',
        desc: '親朋好友、聯絡人主檔與聯繫追蹤',
        targetSys: 'CONTACT_M',
        baseKey: 'CONTACT',
        count: (sysCounts.CONTACT_M || 0) + (sysCounts.CONTACT_T || 0),
        icon: Contact,
      },
      {
        label: '活動花絮系統',
        desc: '聚餐、旅遊、會議相簿與生活花絮',
        targetSys: 'EVENT_M',
        baseKey: 'EVENT',
        count: (sysCounts.EVENT_M || 0) + (sysCounts.EVENT_T || 0),
        icon: Calendar,
      },
      {
        label: '個人預約系統',
        desc: '個人行程預約與時段管理',
        targetSys: 'BOOKING',
        baseKey: 'BOOKING',
        count: sysCounts.BOOKING || 0,
        icon: CalendarClock,
      },
      {
        label: '個人待辦任務面板',
        desc: '每日待辦事項拖曳看板與提醒',
        targetSys: 'TODO_BOARD',
        baseKey: 'TODO',
        count: sysCounts.TODO_T || 0,
        icon: ListTodo,
        alertText: overdueTodoCount > 0 ? `${overdueTodoCount} 項逾期` : undefined,
      },
    ];

    if (unlockedPacks.includes('GROCERY')) {
      items.push({
        label: '家庭食材庫存 (FIFO)',
        desc: '冰箱與居家日用品效期追蹤',
        targetSys: 'GROCERY_M',
        baseKey: 'GROCERY',
        count: (sysCounts.GROCERY_M || 0) + (sysCounts.GROCERY_T || 0),
        icon: ShoppingBasket,
      });
    }

    if (unlockedPacks.includes('ELDER') && selectedProfessionKey !== 'ELDER_CARE') {
      items.push({
        label: '長輩家人關懷紀錄',
        desc: '家中長輩聯絡與訪視照護紀錄',
        targetSys: 'ELDER_M',
        baseKey: 'ELDER',
        count: (sysCounts.ELDER_M || 0) + (sysCounts.ELDER_T || 0),
        icon: HeartPulse,
      });
    }

    return items;
  }, [sysCounts, overdueTodoCount, unlockedPacks, selectedProfessionKey]);

  const handleChooseProfession = (prof: ProfessionDefinition) => {
    setSelectedProfessionKey(prof.key);
    saveMemberProfession(memberMid, prof.key);
    if (!prof.isBreakfastApp) {
      onEnsurePackUnlocked(prof.primaryBaseKey);
    }
    setShowProfessionPicker(false);
  };

  const handleOpenShortcut = (shortcut: ProfessionModuleShortcut) => {
    if (shortcut.isBreakfastApp) {
      onOpenBreakfastSystem?.();
      return;
    }
    onEnterModule(shortcut.targetSys, shortcut.baseKey);
  };

  const handleEnterPrimaryProfession = () => {
    if (!selectedProfession) {
      setShowProfessionPicker(true);
      return;
    }
    if (selectedProfession.isBreakfastApp) {
      onOpenBreakfastSystem?.();
      return;
    }
    onEnterModule(selectedProfession.primaryTargetSys, selectedProfession.primaryBaseKey);
  };

  const ProIcon = selectedProfession ? getProfessionIcon(selectedProfession.key) : Briefcase;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-6">
      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1">
          <div className="text-xs text-slate-500">
            <span>會員專屬首頁</span>
            <span className="mx-2 text-slate-300">·</span>
            <span className="font-mono text-slate-600">{memberMid}</span>
            <span className="mx-2 text-slate-300">·</span>
            <span>私人與專業雙入口分流</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            您好，{memberName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            請直接點選下方「私人」或「專業」卡片進入對應的 AI 軟體工作區，各行業皆可隨時依職業自由挑選。
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAllFeed}
          className="self-start sm:self-auto px-4 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          檢視全部資料總覽
        </button>
      </div>

      {/* TWO PRIMARY FOCAL ENTRY CARDS: 私人 vs 專業 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* ================= CARD 1: 私人 (Personal Life & Daily Needs) ================= */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-6 shadow-xs">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-sky-700 font-semibold">
                    個人日常需求 · {personalModules.length} 項已啟用
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mt-0.5">私人</h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPersonalCustomize((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{showPersonalCustomize ? '完成設定' : '自訂個人需求'}</span>
              </button>
            </div>

            {showPersonalCustomize && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="text-xs font-bold text-slate-800">
                  勾選您日常需要的私人 AI 系統（通訊錄與活動花絮為標配）
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PERSONAL_OPTIONAL_PACKS.map((opt) => {
                    const active = unlockedPacks.includes(opt.baseKey);
                    return (
                      <button
                        key={opt.baseKey}
                        type="button"
                        onClick={() => onTogglePersonalPack(opt.baseKey)}
                        className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer flex items-start gap-2 ${
                          active
                            ? 'bg-sky-50 border-sky-400 text-slate-900'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span
                          className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                            active
                              ? 'bg-sky-600 border-sky-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {active && <Check className="w-3 h-3" />}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{opt.title}</div>
                          <div className="text-[11px] text-slate-500 truncate">{opt.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Personal Module Quick-Enter Rows */}
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {personalModules.map((mod) => {
                const IconComp = mod.icon;
                return (
                  <button
                    key={mod.targetSys}
                    type="button"
                    onClick={() => onEnterModule(mod.targetSys, mod.baseKey)}
                    className="w-full px-4 py-3.5 bg-white hover:bg-sky-50/70 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <IconComp className="w-4 h-4 text-sky-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                          <span className="truncate">{mod.label}</span>
                          {mod.alertText && (
                            <span className="text-[11px] font-semibold text-rose-600 shrink-0">
                              · {mod.alertText}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 truncate">{mod.desc}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono tabular-nums text-slate-500">
                        {mod.count} 筆
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => onEnterModule('CONTACT_M', 'CONTACT')}
              className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-colors cursor-pointer"
            >
              <span>進入私人工作區</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* ================= CARD 2: 專業 (Profession / Industry Dedicated AI System) ================= */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-6 shadow-xs">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
                  <ProIcon className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-amber-700 font-semibold">
                    {selectedProfession
                      ? `${selectedProfession.title} · ${selectedProfession.industryTag}`
                      : '尚未選定職業 · 支援 8 大行業專屬系統'}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mt-0.5">專業</h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowProfessionPicker((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>
                  {showProfessionPicker
                    ? '收合行業選單'
                    : selectedProfession
                      ? '更換職業系統'
                      : '選擇我的職業'}
                </span>
              </button>
            </div>

            {/* Industry Profession Picker Grid */}
            {(showProfessionPicker || !selectedProfession) && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-800">
                  請選擇您的職業／行業專屬 AI 軟體系統（選擇後立即綁定至您的「專業」首頁卡片）：
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MEMBER_PROFESSION_CATALOG.map((prof) => {
                    const PIcon = getProfessionIcon(prof.key);
                    const isSelected = selectedProfessionKey === prof.key;
                    return (
                      <button
                        key={prof.key}
                        type="button"
                        onClick={() => handleChooseProfession(prof)}
                        className={`p-3 rounded-lg border text-left transition-colors cursor-pointer flex items-start gap-2.5 ${
                          isSelected
                            ? 'bg-amber-50 border-amber-500 text-slate-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300'
                        }`}
                      >
                        <PIcon
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            isSelected ? 'text-amber-700' : 'text-slate-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">{prof.title}</div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {prof.industryTag}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active Profession Summary & Direct Entry Shortcuts */}
            {selectedProfession && !showProfessionPicker && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  {selectedProfession.summary}
                </p>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {selectedProfession.shortcuts.map((sc) => {
                    const count = sc.isBreakfastApp
                      ? null
                      : sc.targetSys === 'BOOKING'
                        ? sysCounts.BOOKING || 0
                        : sysCounts[sc.targetSys] || 0;
                    return (
                      <button
                        key={sc.targetSys}
                        type="button"
                        onClick={() => handleOpenShortcut(sc)}
                        className="w-full px-4 py-3.5 bg-white hover:bg-amber-50/70 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {sc.label}
                          </div>
                          <div className="text-xs text-slate-500 truncate">{sc.desc}</div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {count !== null ? (
                            <span className="text-xs font-mono tabular-nums text-slate-500">
                              {count} 筆
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">
                              獨立入口
                            </span>
                          )}
                          <ArrowRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleEnterPrimaryProfession}
              className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-colors cursor-pointer"
            >
              <span>
                {selectedProfession
                  ? `進入${selectedProfession.shortName}`
                  : '立即挑選我的專業系統'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </div>

      {/* Quiet Secondary Account Utilities Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <button
          type="button"
          onClick={onOpenOrgTree}
          className="px-4 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Network className="w-4 h-4 text-indigo-600 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">我的組織網矩陣</div>
              <div className="text-[11px] text-slate-500 truncate">雙軌安置與直推名單</div>
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={onOpenOrderStore}
          className="px-4 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <ShoppingBag className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">AI 軟體訂購中心</div>
              <div className="text-[11px] text-slate-500 truncate">管理續約與加購行業模組</div>
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={onOpenCloudSheet}
          className="px-4 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <FolderOpen className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">
                專屬雲端試算表 ({cloudTabCount} 頁)
              </div>
              <div className="text-[11px] text-slate-500 truncate">個人獨立雲端資料庫</div>
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      </div>
    </div>
  );
};
