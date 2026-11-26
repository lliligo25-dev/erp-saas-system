/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SettlementBreakdown } from '../types/erp.ts';

export type FieldType =
  | 'select'
  | 'text'
  | 'tel'
  | 'email'
  | 'date'
  | 'time'
  | 'datetime-local'
  | 'number'
  | 'textarea';

export interface SysFieldDef {
  id: string;
  label: string;
  type: FieldType;
  icon?: string;
  options?: string[];
  required?: boolean;
  half?: boolean;
}

export interface SysModuleConfig {
  key: string;
  baseKey: string;
  name: string;
  iconColor: string;
  searchMsg: string;
  catField: string;
  defaultCat: string;
  nameField: string;
  cats: string[];
  cardLine1: { label: string; key: string };
  cardLine2: { label: string; key: string };
  fields: SysFieldDef[];
}

export interface IndustryPackMeta {
  baseKey: string;
  title: string;
  desc: string;
}

export const INDUSTRY_PACKS: IndustryPackMeta[] = [
  { baseKey: 'CONTACT', title: '通訊錄系統', desc: '通訊錄系統 (親朋好友/公司/廠商/社團/宮廟) + 聯繫追蹤' },
  { baseKey: 'EVENT', title: '活動花絮系統', desc: '活動花絮系統 (會議/展覽/聚餐/旅遊/其他)' },
  { baseKey: 'BOOKING', title: '個人預約系統', desc: '預約服務主檔 + 個人預約明細表單' },
  { baseKey: 'TODO', title: '代辦事項系統', desc: '代辦專案分類檔 + 待辦執行追蹤明細' },
  { baseKey: 'ATOMY', title: '艾多美會員', desc: '艾多美會員主檔 (推薦人/安置人/左右線別) + 銷售跟進' },
  { baseKey: 'ELDER', title: '長者關懷紀錄', desc: '長者關懷紀錄 (班別/班長/緊急電話/家屬) + 訪視紀錄' },
  { baseKey: 'PRODUCT', title: '購物車產品', desc: '購物車產品主檔 (類別/價格/單位) + 訂單出貨紀錄' },
  { baseKey: 'TCM', title: '推拿預約管理', desc: '推拿預約管理 (推拿師/部位症狀/處置) + 推拿流水線' },
  { baseKey: 'FRUIT', title: '水果店管理', desc: '水果店管理 (單價/庫存/產地/供應商) + 進銷存流水' },
  { baseKey: 'GROCERY', title: '家庭食材庫存 (FIFO)', desc: '家庭食材庫存 FIFO (存放位置/效期) + 進出庫紀錄' },
  { baseKey: 'NAIL', title: '美甲醫美預約', desc: '美甲醫美預約 (美甲師/施作項目/預估金額) + 流水線' },
  { baseKey: 'ASSOC', title: '大甲區中醫藥聯誼會', desc: '大甲區中醫藥聯誼會 (診所單位/職務/會費) + 繳費活動' },
];

export const SYS_CONFIG: Record<string, SysModuleConfig> = {
  CONTACT_M: {
    key: 'CONTACT_M',
    baseKey: 'CONTACT',
    name: '1. 通訊錄系統',
    iconColor: 'text-rose-600',
    searchMsg: '🔍 搜尋姓名、手機、地址...',
    catField: '類別',
    defaultCat: '親朋好友',
    nameField: '姓名',
    cats: ['親朋好友', '公司', '廠商', '社團', '宮廟'],
    cardLine1: { label: '手機', key: '手機' },
    cardLine2: { label: '地址', key: '地址' },
    fields: [
      { id: '類別', label: '關係分類 👈*', type: 'select', icon: 'fa-sitemap text-info', options: ['親朋好友', '公司', '廠商', '社團', '宮廟'], required: true },
      { id: '姓名', label: '👤 姓名 👈*', type: 'text', required: true },
      { id: '手機', label: '📱 手機', type: 'tel' },
      { id: '電話', label: '☎️ 電話', type: 'tel' },
      { id: 'Line', label: '💬 Line ID', type: 'text' },
      { id: 'Email', label: '✉️ Email', type: 'email' },
      { id: '地址', label: '📍 地址', type: 'textarea' },
    ],
  },
  CONTACT_T: {
    key: 'CONTACT_T',
    baseKey: 'CONTACT',
    name: '2. 聯繫紀錄',
    iconColor: 'text-emerald-600',
    searchMsg: '🔍 搜尋姓名、內容...',
    catField: '狀態',
    defaultCat: '跟進中',
    nameField: '姓名',
    cats: ['跟進中', '開通體驗', '已洽談', '已結案', '待確認預約', '無效'],
    cardLine1: { label: '聯繫日期', key: '聯繫日期' },
    cardLine2: { label: '聯繫方式', key: '聯繫方式' },
    fields: [
      { id: '狀態', label: '目前狀態 👈*', type: 'select', options: ['跟進中', '開通體驗', '已洽談', '已結案', '待確認預約', '無效'], required: true },
      { id: '姓名', label: '👤 姓名 👈*', type: 'text', required: true },
      { id: '聯繫日期', label: '📅 聯繫日期', type: 'date', half: true },
      { id: '聯繫方式', label: '💬 聯繫方式', type: 'select', options: ['電話', 'Line', '面訪', 'Email', '線上開通', 'AI個人預約系統'], half: true },
      { id: '洽談內容', label: '📝 洽談內容', type: 'textarea' },
      { id: '下一步計畫', label: '📌 下一步計畫', type: 'textarea' },
    ],
  },

  EVENT_M: {
    key: 'EVENT_M',
    baseKey: 'EVENT',
    name: '1. 活動花絮系統',
    iconColor: 'text-emerald-600',
    searchMsg: '🔍 搜尋主題、標題、地點...',
    catField: '活動分類',
    defaultCat: '會議',
    nameField: '活動主題',
    cats: ['會議', '展覽', '聚餐', '旅遊', '其他'],
    cardLine1: { label: '照片標題', key: '照片標題' },
    cardLine2: { label: '拍攝地點', key: '拍攝地點' },
    fields: [
      { id: '活動分類', label: '活動分類 👈*', type: 'select', icon: 'fa-sitemap text-info', options: ['會議', '展覽', '聚餐', '旅遊', '其他'], required: true },
      { id: '活動主題', label: '📌 活動主題 👈*', type: 'text', required: true },
      { id: '照片標題', label: '📷 照片標題', type: 'text' },
      { id: '拍攝地點', label: '📍 拍攝地點', type: 'text' },
      { id: '備註', label: '📝 備註', type: 'textarea' },
    ],
  },
  EVENT_T: {
    key: 'EVENT_T',
    baseKey: 'EVENT',
    name: '2. 活動花絮明細',
    iconColor: 'text-emerald-600',
    searchMsg: '🔍 搜尋主題、標題、地點...',
    catField: '活動分類',
    defaultCat: '會議',
    nameField: '活動主題',
    cats: ['會議', '展覽', '聚餐', '旅遊', '其他'],
    cardLine1: { label: '照片標題', key: '照片標題' },
    cardLine2: { label: '拍攝地點', key: '拍攝地點' },
    fields: [
      { id: '活動分類', label: '活動分類 👈*', type: 'select', icon: 'fa-sitemap text-info', options: ['會議', '展覽', '聚餐', '旅遊', '其他'], required: true },
      { id: '活動主題', label: '📌 活動主題 👈*', type: 'text', required: true },
      { id: '照片標題', label: '📷 照片標題', type: 'text' },
      { id: '拍攝地點', label: '📍 拍攝地點', type: 'text' },
      { id: '備註', label: '📝 備註', type: 'textarea' },
    ],
  },

  BOOKING_M: {
    key: 'BOOKING_M',
    baseKey: 'BOOKING',
    name: '1. 預約服務主檔',
    iconColor: 'text-blue-600',
    searchMsg: '🔍 搜尋預約服務項目...',
    catField: '狀態',
    defaultCat: '開放預約',
    nameField: '服務名稱',
    cats: ['開放預約', '暫停受理'],
    cardLine1: { label: '會面方式', key: '會面方式' },
    cardLine2: { label: '服務時長', key: '服務時長' },
    fields: [
      { id: '狀態', label: '狀態 *', type: 'select', options: ['開放預約', '暫停受理'], required: true },
      { id: '服務名稱', label: '服務名稱 *', type: 'text', required: true },
      { id: '服務時長', label: '服務時長 (分鐘)', type: 'number', half: true },
      { id: '費用', label: '預約費用 (NTD)', type: 'number', half: true },
      { id: '會面方式', label: '會面方式', type: 'select', options: ['線上視訊會議', '實體面談 / 門店', '電話一對一諮詢'] },
      { id: '簡介', label: '服務說明與簡介', type: 'textarea' },
    ],
  },
  BOOKING_T: {
    key: 'BOOKING_T',
    baseKey: 'BOOKING',
    name: '2. 個人預約明細',
    iconColor: 'text-emerald-600',
    searchMsg: '🔍 搜尋預約姓名、手機或事由...',
    catField: '狀態',
    defaultCat: '待確認預約',
    nameField: '姓名',
    cats: ['待確認預約', '已確認時段', '已完成服務', '已取消'],
    cardLine1: { label: '日期', key: '日期' },
    cardLine2: { label: '事由', key: '事由' },
    fields: [
      { id: '狀態', label: '狀態 *', type: 'select', options: ['待確認預約', '已確認時段', '已完成服務', '已取消'], required: true },
      { id: '姓名', label: '姓名 *', type: 'text', required: true },
      { id: '手機', label: '手機', type: 'tel', half: true },
      { id: '電話', label: '電話', type: 'tel', half: true },
      { id: '日期', label: '日期', type: 'date', half: true },
      { id: '時間', label: '時間', type: 'time', half: true },
      { id: '事由', label: '事由', type: 'text', half: true },
      { id: '備註', label: '備註', type: 'text', half: true },
      { id: '詳細情況', label: '詳細情況', type: 'textarea' },
    ],
  },

  TODO_M: {
    key: 'TODO_M',
    baseKey: 'TODO',
    name: '1. 代辦專案主檔',
    iconColor: 'text-blue-600',
    searchMsg: '🔍 搜尋專案名稱、類別或負責人...',
    catField: '狀態',
    defaultCat: '進行中',
    nameField: '專案名稱',
    cats: ['進行中', '長期規劃', '已封存'],
    cardLine1: { label: '類別', key: '類別' },
    cardLine2: { label: '負責人', key: '負責人' },
    fields: [
      { id: '狀態', label: '狀態 *', type: 'select', options: ['進行中', '長期規劃', '已封存'], required: true },
      { id: '專案名稱', label: '專案名稱 *', type: 'text', required: true },
      { id: '類別', label: '任務類別', type: 'select', options: ['團隊運作', '客戶跟進', '門店營運', '個人行程', '財務帳務'], half: true },
      { id: '優先級', label: '優先級', type: 'select', options: ['高優先', '中優先', '低優先'], half: true },
      { id: '負責人', label: '負責人', type: 'text', half: true },
      { id: '目標日期', label: '目標日期', type: 'date', half: true },
      { id: '說明與備註', label: '說明與備註', type: 'textarea' },
    ],
  },
  TODO_T: {
    key: 'TODO_T',
    baseKey: 'TODO',
    name: '2. 代辦事項明細',
    iconColor: 'text-emerald-600',
    searchMsg: '🔍 搜尋待辦標題、承辦人或詳情...',
    catField: '狀態',
    defaultCat: '待處理',
    nameField: '事項標題',
    cats: ['待處理', '處理中', '已完成', '延後'],
    cardLine1: { label: '截止日期', key: '截止日期' },
    cardLine2: { label: '優先級', key: '優先級' },
    fields: [
      { id: '狀態', label: '狀態 *', type: 'select', options: ['待處理', '處理中', '已完成', '延後'], required: true },
      { id: '事項標題', label: '事項標題 *', type: 'text', required: true },
      { id: '專案名稱', label: '所屬專案', type: 'text', half: true },
      { id: '優先級', label: '優先級', type: 'select', options: ['緊急重要', '高', '中', '低'], half: true },
      { id: '截止日期', label: '截止日期', type: 'date', half: true },
      { id: '提醒時間', label: '提醒時間', type: 'time', half: true },
      { id: '承辦人', label: '承辦人', type: 'text', half: true },
      { id: '結束時間', label: '完成時間', type: 'datetime-local', half: true },
      { id: '詳細說明', label: '詳細說明', type: 'textarea' },
    ],
  },

  ATOMY_M: {
    key: 'ATOMY_M',
    baseKey: 'ATOMY',
    name: '1. 艾多美會員',
    iconColor: 'text-blue-600',
    searchMsg: '🔍 搜尋姓名、編號、推薦人...',
    catField: '經營狀態',
    defaultCat: '愛用者',
    nameField: '姓名',
    cats: ['經營者', '愛用者', '潛在對象', '停止活動'],
    cardLine1: { label: '會員編號', key: '會員編號' },
    cardLine2: { label: '線別', key: '線別' },
    fields: [
      { id: '經營狀態', label: '經營狀態 👈*', type: 'select', icon: 'fa-project-diagram text-info', options: ['經營者', '愛用者', '潛在對象', '停止活動'], required: true },
      { id: '姓名', label: '👤 姓名 👈*', type: 'text', required: true },
      { id: '會員編號', label: '🔑 會員編號', type: 'text', half: true },
      { id: '手機', label: '📱 手機', type: 'tel', half: true },
      { id: 'Line', label: '💬 Line ID', type: 'text' },
      { id: '推薦人', label: '🤝 推薦人', type: 'text', half: true },
      { id: '安置人', label: '⬇️ 安置人', type: 'text', half: true },
      { id: '線別', label: '🌿 線別(左/右)', type: 'text' },
      { id: '備註與需求', label: '📝 備註與需求', type: 'textarea' },
    ],
  },
  ATOMY_T: {
    key: 'ATOMY_T',
    baseKey: 'ATOMY',
    name: '2. 銷售與跟進',
    iconColor: 'text-emerald-600',
    searchMsg: '🔍 搜尋姓名、消費項目...',
    catField: '狀態',
    defaultCat: '跟進中',
    nameField: '姓名',
    cats: ['跟進中', '已成交', '無效'],
    cardLine1: { label: '消費項目', key: '消費項目' },
    cardLine2: { label: '消費金額', key: '消費金額' },
    fields: [
      { id: '狀態', label: '狀態 👈*', type: 'select', options: ['跟進中', '已成交', '無效'], required: true },
      { id: '姓名', label: '👤 姓名 👈*', type: 'text', required: true },
      { id: '跟進日期', label: '📅 跟進日期', type: 'date', half: true },
      { id: '消費項目', label: '🛒 消費項目', type: 'text', half: true },
      { id: '消費金額', label: '💲 消費金額', type: 'number', half: true },
      { id: '需求備註', label: '📝 需求備註', type: 'textarea' },
    ],
  },

  ELDER_M: {
    key: 'ELDER_M',
    baseKey: 'ELDER',
    name: '1. 長者關懷紀錄',
    iconColor: 'text-amber-600',
    searchMsg: '🔍 搜尋長者姓名、班別...',
    catField: '所屬班別',
    defaultCat: '一班',
    nameField: '姓名',
    cats: ['一班', '二班', '三班', '關懷中', '結案'],
    cardLine1: { label: '長者手機', key: '長者手機' },
    cardLine2: { label: '關懷進度', key: '關懷進度' },
    fields: [
      { id: '所屬班別', label: '所屬班別 👈*', type: 'select', icon: 'fa-users text-info', options: ['一班', '二班', '三班', '關懷中', '結案'], required: true },
      { id: '姓名', label: '👤 長者姓名 👈*', type: 'text', required: true },
      { id: '長者編號', label: '🔑 長者編號', type: 'text', half: true },
      { id: '長者手機', label: '📱 長者手機', type: 'tel', half: true },
      { id: '班長', label: '⭐ 班長', type: 'text', half: true },
      { id: '緊急電話', label: '☎️ 緊急電話', type: 'tel', half: true },
      { id: '家屬聯絡人', label: '👨‍👩‍👧‍👦 家屬聯絡人', type: 'text' },
      { id: '關懷進度', label: '📈 關懷進度', type: 'text' },
      { id: '健康與備註', label: '❤️ 健康與備註', type: 'textarea' },
    ],
  },
  ELDER_T: {
    key: 'ELDER_T',
    baseKey: 'ELDER',
    name: '2. 訪視紀錄',
    iconColor: 'text-emerald-600',
    searchMsg: '🔍 搜尋姓名、關懷內容...',
    catField: '狀態',
    defaultCat: '待訪視',
    nameField: '姓名',
    cats: ['待訪視', '已訪視', '異常追蹤'],
    cardLine1: { label: '訪視日期', key: '訪視日期' },
    cardLine2: { label: '健康數據', key: '健康數據' },
    fields: [
      { id: '狀態', label: '狀態 👈*', type: 'select', options: ['待訪視', '已訪視', '異常追蹤'], required: true },
      { id: '姓名', label: '👤 長者姓名 👈*', type: 'text', required: true },
      { id: '訪視日期', label: '📅 訪視日期', type: 'date', half: true },
      { id: '健康數據', label: '❤️ 健康數據(血壓等)', type: 'text', half: true },
      { id: '關懷內容', label: '📝 關懷內容', type: 'textarea' },
      { id: '後續追蹤', label: '📈 後續追蹤', type: 'textarea' },
    ],
  },

  PRODUCT_M: {
    key: 'PRODUCT_M',
    baseKey: 'PRODUCT',
    name: '1. 購物車產品',
    iconColor: 'text-sky-600',
    searchMsg: '🔍 搜尋品名、類別...',
    catField: '類別',
    defaultCat: '保健食品',
    nameField: '品名',
    cats: ['保健食品', '美容保養', '生活用品', '食品', '其他'],
    cardLine1: { label: '價格', key: '價格' },
    cardLine2: { label: '單位', key: '單位' },
    fields: [
      { id: '類別', label: '產品類別 👈*', type: 'select', icon: 'fa-tags text-info', options: ['保健食品', '美容保養', '生活用品', '食品', '其他'], required: true },
      { id: '品名', label: '🛒 品名 👈*', type: 'text', required: true },
      { id: '價格', label: '💲 價格', type: 'number', half: true },
      { id: '單位', label: '📦 單位', type: 'text', half: true },
      { id: '備註', label: '📝 產品備註', type: 'textarea' },
    ],
  },
  PRODUCT_T: {
    key: 'PRODUCT_T',
    baseKey: 'PRODUCT',
    name: '2. 訂單紀錄',
    iconColor: 'text-emerald-600',
    searchMsg: '🔍 搜尋客戶訂單...',
    catField: '狀態',
    defaultCat: '待處理',
    nameField: '姓名',
    cats: ['待處理', '已出貨', '已完成', '已結案', '取消'],
    cardLine1: { label: '品名', key: '品名' },
    cardLine2: { label: '總金額', key: '總金額' },
    fields: [
      { id: '狀態', label: '狀態 👈*', type: 'select', options: ['待處理', '已出貨', '已完成', '已結案', '取消'], required: true },
      { id: '姓名', label: '👤 客戶姓名 👈*', type: 'text', required: true },
      { id: '品名', label: '🛒 品名', type: 'text', half: true },
      { id: '數量', label: '🧮 數量', type: 'number', half: true },
      { id: '總金額', label: '💲 總金額', type: 'number', half: true },
      { id: '寄送地址', label: '📍 寄送地址', type: 'text' },
      { id: '備註', label: '📝 備註', type: 'textarea' },
    ],
  },

  FRUIT_M: {
    key: 'FRUIT_M',
    baseKey: 'FRUIT',
    name: '1. 水果店管理',
    iconColor: 'text-rose-600',
    searchMsg: '🔍 搜尋品名、產地、供應商...',
    catField: '類別',
    defaultCat: '當季水果',
    nameField: '品名',
    cats: ['當季水果', '進口水果', '禮盒包裝', '促銷特賣', '已斷貨'],
    cardLine1: { label: '單價', key: '單價' },
    cardLine2: { label: '產地', key: '產地' },
    fields: [
      { id: '類別', label: '目前分類 👈*', type: 'select', icon: 'fa-tags text-info', options: ['當季水果', '進口水果', '禮盒包裝', '促銷特賣', '已斷貨'], required: true },
      { id: '品名', label: '🍎 品名 👈*', type: 'text', required: true },
      { id: '單價', label: '💲 單價', type: 'number', half: true },
      { id: '單位', label: '📦 單位', type: 'text', half: true },
      { id: '庫存量', label: '🧮 庫存量', type: 'number', half: true },
      { id: '產地', label: '🌍 產地', type: 'text', half: true },
      { id: '供應商', label: '🚚 供應商', type: 'text' },
      { id: '備註', label: '📝 備註 (成熟度等)', type: 'textarea' },
    ],
  },
  FRUIT_T: {
    key: 'FRUIT_T',
    baseKey: 'FRUIT',
    name: '2. 進銷存流水',
    iconColor: 'text-emerald-600',
    searchMsg: '🔍 搜尋進銷存...',
    catField: '狀態',
    defaultCat: '賣出',
    nameField: '品名',
    cats: ['進貨', '賣出', '報廢'],
    cardLine1: { label: '數量', key: '數量' },
    cardLine2: { label: '總金額', key: '總金額' },
    fields: [
      { id: '狀態', label: '交易類別 👈*', type: 'select', options: ['進貨', '賣出', '報廢'], required: true },
      { id: '品名', label: '🍎 品名 👈*', type: 'text', required: true },
      { id: '日期', label: '📅 日期', type: 'date', half: true },
      { id: '數量', label: '🧮 數量', type: 'number', half: true },
      { id: '總金額', label: '💲 總金額', type: 'number', half: true },
      { id: '經手人', label: '👤 經手人', type: 'text', half: true },
      { id: '備註', label: '📝 備註', type: 'textarea' },
    ],
  },

  GROCERY_M: {
    key: 'GROCERY_M',
    baseKey: 'GROCERY',
    name: '1. 家庭食材庫存 (FIFO)',
    iconColor: 'text-emerald-600',
    searchMsg: '🔍 搜尋品名、存放位置、類別...',
    catField: '狀態',
    defaultCat: '庫存中',
    nameField: '品名',
    cats: ['庫存中', '快過期', '已吃完', '過期丟棄'],
    cardLine1: { label: '存放位置', key: '存放位置' },
    cardLine2: { label: '有效期限', key: '有效期限' },
    fields: [
      { id: '狀態', label: '目前狀態 👈*', type: 'select', icon: 'fa-clipboard-check text-info', options: ['庫存中', '快過期', '已吃完', '過期丟棄'], required: true },
      { id: '品名', label: '🛒 物品名稱 👈*', type: 'text', required: true },
      { id: '物品類別', label: '🏷️ 物品類別', type: 'select', options: ['生鮮肉品', '蔬菜水果', '冷凍食品', '乾貨零食', '飲料乳品', '生活日用'], half: true },
      { id: '存放位置', label: '📍 存放位置', type: 'select', options: ['冷藏', '冷凍', '常溫層', '零食櫃', '儲藏室'], half: true },
      { id: '數量', label: '🧮 數量', type: 'number', half: true },
      { id: '單位', label: '📦 單位 (包/盒/瓶)', type: 'text', half: true },
      { id: '購買日期', label: '📥 入庫(購買)日期', type: 'date', half: true },
      { id: '有效期限', label: '⏳ 有效期限 (FIFO)', type: 'date', half: true },
      { id: '備註', label: '📝 備註 (料理方式等)', type: 'textarea' },
    ],
  },
  GROCERY_T: {
    key: 'GROCERY_T',
    baseKey: 'GROCERY',
    name: '2. 進出庫紀錄',
    iconColor: 'text-emerald-600',
    searchMsg: '🔍 搜尋食材紀錄...',
    catField: '狀態',
    defaultCat: '入庫',
    nameField: '品名',
    cats: ['入庫', '出庫/吃完', '過期丟棄'],
    cardLine1: { label: '有效期限', key: '有效期限' },
    cardLine2: { label: '數量', key: '數量' },
    fields: [
      { id: '狀態', label: '動向 👈*', type: 'select', options: ['入庫', '出庫/吃完', '過期丟棄'], required: true },
      { id: '品名', label: '🛒 物品名稱 👈*', type: 'text', required: true },
      { id: '購買日期', label: '📥 購買日期', type: 'date', half: true },
      { id: '有效期限', label: '⏳ 有效期限', type: 'date', half: true },
      { id: '數量', label: '🧮 數量', type: 'number', half: true },
      { id: '處理方式', label: '🍳 處理方式', type: 'text', half: true },
      { id: '備註', label: '📝 備註', type: 'textarea' },
    ],
  },

  NAIL_M: {
    key: 'NAIL_M',
    baseKey: 'NAIL',
    name: '1. 美甲醫美預約',
    iconColor: 'text-rose-600',
    searchMsg: '🔍 搜尋姓名、手機、美甲師...',
    catField: '狀態',
    defaultCat: '預約中',
    nameField: '客戶姓名',
    cats: ['預約中', '已報到', '施作中', '已完成', '取消'],
    cardLine1: { label: '預約日期', key: '預約日期' },
    cardLine2: { label: '施作項目', key: '施作項目' },
    fields: [
      { id: '狀態', label: '目前狀態 👈*', type: 'select', icon: 'fa-calendar-check text-info', options: ['預約中', '已報到', '施作中', '已完成', '取消'], required: true },
      { id: '客戶姓名', label: '👤 客戶姓名 👈*', type: 'text', required: true },
      { id: '手機', label: '📱 手機', type: 'tel', half: true },
      { id: '指定美甲師', label: '💅 指定美甲師', type: 'text', half: true },
      { id: '預約日期', label: '📅 預約日期', type: 'date', half: true },
      { id: '預約時段', label: '⏰ 時間', type: 'time', half: true },
      { id: '施作項目', label: '✨ 施作項目', type: 'select', options: ['手部單色', '足部單色', '造型設計', '卸甲重作', '深層保養', '其他'], half: true },
      { id: '預估金額', label: '💲 預估金額', type: 'number', half: true },
      { id: '備註與需求', label: '📝 備註 (想做的款式/特殊需求)', type: 'textarea' },
    ],
  },
  NAIL_T: {
    key: 'NAIL_T',
    baseKey: 'NAIL',
    name: '2. 預約流水線',
    iconColor: 'text-emerald-600',
    searchMsg: '🔍 搜尋美甲預約...',
    catField: '狀態',
    defaultCat: '預約中',
    nameField: '客戶姓名',
    cats: ['預約中', '已報到', '施作中', '已完成', '取消'],
    cardLine1: { label: '預約日期', key: '預約日期' },
    cardLine2: { label: '指定美甲師', key: '指定美甲師' },
    fields: [
      { id: '狀態', label: '目前狀態 👈*', type: 'select', options: ['預約中', '已報到', '施作中', '已完成', '取消'], required: true },
      { id: '客戶姓名', label: '👤 客戶姓名 👈*', type: 'text', required: true },
      { id: '預約日期', label: '📅 預約日期', type: 'date', half: true },
      { id: '預約時段', label: '⏰ 時間', type: 'time', half: true },
      { id: '指定美甲師', label: '💅 指定美甲師', type: 'text', half: true },
      { id: '施作項目', label: '✨ 施作項目', type: 'select', options: ['手部單色', '足部單色', '造型設計', '卸甲重作', '深層保養', '其他'], half: true },
      { id: '開始時間', label: '▶️ 開始時間', type: 'datetime-local', half: true },
      { id: '結束時間', label: '⏹️ 結束時間', type: 'datetime-local', half: true },
      { id: '消費金額', label: '💲 消費金額', type: 'number', half: true },
    ],
  },

  ASSOC_M: {
    key: 'ASSOC_M',
    baseKey: 'ASSOC',
    name: '1. 大甲區中醫藥聯誼會',
    iconColor: 'text-blue-600',
    searchMsg: '🔍 搜尋診所、負責人、職務...',
    catField: '會籍狀態',
    defaultCat: '正常會員',
    nameField: '診所與單位',
    cats: ['正常會員', '理監事', '榮譽會員', '停權/退會'],
    cardLine1: { label: '負責人姓名', key: '負責人姓名' },
    cardLine2: { label: '繳費狀態', key: '繳費狀態' },
    fields: [
      { id: '會籍狀態', label: '會籍狀態 👈*', type: 'select', icon: 'fa-id-card text-info', options: ['正常會員', '理監事', '榮譽會員', '停權/退會'], required: true },
      { id: '診所與單位', label: '🏥 診所/單位名稱 👈*', type: 'text', required: true },
      { id: '負責人姓名', label: '👤 負責人/代表姓名', type: 'text', half: true },
      { id: '手機', label: '📱 聯絡手機', type: 'tel', half: true },
      { id: '擔任職務', label: '🎖️ 擔任職務', type: 'select', options: ['一般會員', '會長', '副會長', '理事長', '常務理事', '理事', '常務監事', '監事', '總幹事', '財務'], half: true },
      { id: '繳費狀態', label: '💰 會費繳納狀態', type: 'select', options: ['本年度已繳', '未繳費', '免繳'], half: true },
      { id: '入會年份', label: '📅 入會年份(西元)', type: 'number', half: true },
      { id: '單位地址', label: '📍 單位地址', type: 'text', half: false },
      { id: '備註', label: '📝 備註 (專長/備用電話等)', type: 'textarea' },
    ],
  },
  ASSOC_T: {
    key: 'ASSOC_T',
    baseKey: 'ASSOC',
    name: '2. 繳費與活動',
    iconColor: 'text-emerald-600',
    searchMsg: '🔍 搜尋繳費紀錄...',
    catField: '狀態',
    defaultCat: '未繳',
    nameField: '診所與單位',
    cats: ['未繳', '已繳', '已完成', '已參加'],
    cardLine1: { label: '年度', key: '年度' },
    cardLine2: { label: '金額', key: '金額' },
    fields: [
      { id: '狀態', label: '狀態 👈*', type: 'select', options: ['未繳', '已繳', '已完成', '已參加'], required: true },
      { id: '診所與單位', label: '🏥 診所/單位名稱 👈*', type: 'text', required: true },
      { id: '年度', label: '📅 年度', type: 'text', half: true },
      { id: '繳費項目', label: '💰 項目(會費/聚餐)', type: 'text', half: true },
      { id: '金額', label: '💲 金額', type: 'number', half: true },
      { id: '備註', label: '📝 備註', type: 'textarea' },
    ],
  },

  TCM_M: {
    key: 'TCM_M',
    baseKey: 'TCM',
    name: '1. 推拿預約管理',
    iconColor: 'text-emerald-600',
    searchMsg: '🔍 搜尋姓名、手機、推拿師...',
    catField: '狀態',
    defaultCat: '預約中',
    nameField: '客戶姓名',
    cats: ['預約中', '初診', '複診', '已完成', '取消'],
    cardLine1: { label: '預約日期', key: '預約日期' },
    cardLine2: { label: '負責推拿師', key: '負責推拿師' },
    fields: [
      { id: '狀態', label: '目前狀態 👈*', type: 'select', icon: 'fa-calendar-check text-info', options: ['預約中', '初診', '複診', '已完成', '取消'], required: true },
      { id: '客戶姓名', label: '👤 客戶姓名 👈*', type: 'text', required: true },
      { id: '手機', label: '📱 手機', type: 'tel', half: true },
      { id: '性別', label: '⚥ 性別', type: 'select', options: ['男', '女', '其他'], half: true },
      { id: '預約日期', label: '📅 預約日期', type: 'date', half: true },
      { id: '預約時段', label: '⏰ 時間', type: 'time', half: true },
      { id: '負責推拿師', label: '👨‍⚕️ 負責推拿師', type: 'text' },
      { id: '部位與症狀', label: '🤕 部位與症狀', type: 'textarea' },
      { id: '處置與備註', label: '📝 處置與備註', type: 'textarea' },
    ],
  },
  TCM_T: {
    key: 'TCM_T',
    baseKey: 'TCM',
    name: '2. 推拿流水線',
    iconColor: 'text-emerald-600',
    searchMsg: '🔍 搜尋姓名、推拿師...',
    catField: '狀態',
    defaultCat: '預約中',
    nameField: '客戶姓名',
    cats: ['預約中', '執行中', '已完成', '取消'],
    cardLine1: { label: '預約日期', key: '預約日期' },
    cardLine2: { label: '負責推拿師', key: '負責推拿師' },
    fields: [
      { id: '狀態', label: '狀態 👈*', type: 'select', options: ['預約中', '執行中', '已完成', '取消'], required: true },
      { id: '客戶姓名', label: '👤 客戶姓名 👈*', type: 'text', required: true },
      { id: '預約日期', label: '📅 預約日期', type: 'date', half: true },
      { id: '預約時段', label: '⏰ 時間', type: 'time', half: true },
      { id: '負責推拿師', label: '👨‍⚕️ 負責推拿師', type: 'select', options: ['李永吉', '李佳馨'], half: true },
      { id: '施作項目', label: '💆 施作項目', type: 'select', options: ['全身推拿', '半身', '腳底', '拔罐', '其他'], half: true },
      { id: '服務節數', label: '⏱️ 服務節數', type: 'select', options: ['0.5', '1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'], half: true },
      { id: '開始時間', label: '▶️ 開始時間', type: 'datetime-local', half: true },
      { id: '結束時間', label: '⏹️ 結束時間', type: 'datetime-local', half: true },
      { id: '消費金額', label: '💲 消費金額', type: 'number', half: true },
      { id: '處置與備註', label: '📝 處置與備註', type: 'textarea' },
    ],
  },
};

export type DynamicRecord = Record<string, string>;

export function getOffsetDateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getCurrentDateTimeStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

const STORAGE_PREFIX = 'AIS_FIVESTAR_MODULES_V1_';

function createDefaultSeedForModule(sysType: string, memberMid: string): DynamicRecord[] {
  const today = getOffsetDateStr(0);
  const tomorrow = getOffsetDateStr(1);
  const nowStr = new Date().toLocaleDateString();

  switch (sysType) {
    case 'ATOMY_M':
      return [
        { ID: 'ATM-001', 經營狀態: '經營者', 姓名: '林佳穎', 會員編號: 'AT-88201', 手機: '0911-223-344', Line: 'jiaying_lin', 推薦人: memberMid, 安置人: memberMid, 線別: '左線 A 區', 備註與需求: '每月固定回購蜂蜜飲與益生菌', 更新時間: nowStr },
        { ID: 'ATM-002', 經營狀態: '愛用者', 姓名: '陳志強', 會員編號: 'AT-88202', 手機: '0928-445-566', Line: 'chiang_chen', 推薦人: memberMid, 安置人: memberMid, 線別: '右線 B 區', 備註與需求: '偏好生活日用品與口腔護理組', 更新時間: nowStr },
      ];
    case 'ATOMY_T':
      return [
        { ID: 'ATT-001', 狀態: '跟進中', 姓名: '林佳穎', 跟進日期: tomorrow, 消費項目: '煥力飲 4 盒禮盒組', 消費金額: '12800', 需求備註: '協助了解自用轉經營回饋制度', 更新時間: nowStr },
        { ID: 'ATT-002', 狀態: '已成交', 姓名: '陳志強', 跟進日期: today, 消費項目: '凝萃煥膚六部曲', 消費金額: '6680', 需求備註: '已完成配送與使用教學', 更新時間: nowStr },
      ];
    case 'PRODUCT_M':
      return [
        { ID: 'PRM-001', 類別: '保健食品', 品名: 'AI 產銷合一智聯健康飲禮盒', 價格: '1980', 單位: '盒', 備註: '會員體驗組熱銷第一名', 更新時間: nowStr },
        { ID: 'PRM-002', 類別: '食品', 品名: '頂級冷壓初榨植萃油', 價格: '960', 單位: '瓶', 備註: '產地直送溯源認證', 更新時間: nowStr },
      ];
    case 'PRODUCT_T':
      return [
        { ID: 'PRT-001', 狀態: '待處理', 姓名: '黃冠傑', 品名: 'AI 產銷合一智聯健康飲禮盒', 數量: '2', 總金額: '3960', 寄送地址: '台北市中山區南京東路三段', 備註: '請附體驗券 2 張', 更新時間: today },
        { ID: 'PRT-002', 狀態: '已出貨', 姓名: '張雅婷', 品名: '頂級冷壓初榨植萃油', 數量: '3', 總金額: '2880', 寄送地址: '新北市板橋區民生路二段', 備註: '物流單號 #TW88291', 更新時間: today },
      ];
    case 'TCM_M':
      return [
        { ID: 'TCM-001', 狀態: '預約中', 客戶姓名: '吳明宏', 手機: '0932-112-889', 性別: '男', 預約日期: today, 預約時段: '15:00', 負責推拿師: '李永吉', 部位與症狀: '長期久坐肩頸痠痛', 處置與備註: '偏好深層指壓與肩頸鬆筋', 更新時間: nowStr },
      ];
    case 'TCM_T':
      return [
        { ID: 'TCT-001', 狀態: '預約中', 客戶姓名: '吳明宏', 預約日期: today, 預約時段: '15:00', 負責推拿師: '李永吉', 施作項目: '全身推拿', 服務節數: '2.0', 開始時間: '', 結束時間: '', 消費金額: '1600', 處置與備註: '肩頸加強鬆筋', 更新時間: today },
        { ID: 'TCT-002', 狀態: '執行中', 客戶姓名: '周美玲', 預約日期: today, 預約時段: '13:30', 負責推拿師: '李佳馨', 施作項目: '腳底', 服務節數: '1.0', 開始時間: `${today}T13:32`, 結束時間: '', 消費金額: '900', 處置與備註: '足底反射區調理中', 更新時間: today },
      ];
    case 'NAIL_M':
      return [
        { ID: 'NLM-001', 狀態: '預約中', 客戶姓名: '劉欣怡', 手機: '0988-331-209', 指定美甲師: 'Mia', 預約日期: tomorrow, 預約時段: '14:30', 施作項目: '造型設計', 預估金額: '1580', 備註與需求: '極簡法式貓眼，甲面較薄需做建構加厚', 更新時間: nowStr },
      ];
    case 'NAIL_T':
      return [
        { ID: 'NLT-001', 狀態: '預約中', 客戶姓名: '劉欣怡', 預約日期: tomorrow, 預約時段: '14:30', 指定美甲師: 'Mia', 施作項目: '造型設計', 開始時間: '', 結束時間: '', 消費金額: '1580', 更新時間: today },
      ];
    case 'ELDER_M':
      return [
        { ID: 'ELM-001', 所屬班別: '一班', 姓名: '林福氣伯伯', 長者編號: 'ELD-101', 長者手機: '0910-554-321', 班長: '陳班長', 緊急電話: '02-2700-1122', 家屬聯絡人: '林先生 (長子)', 關懷進度: '每週定期電訪關懷', 健康與備註: '血壓穩定，每週參與體適能課', 更新時間: nowStr },
      ];
    case 'ELDER_T':
      return [
        { ID: 'ELT-001', 狀態: '待訪視', 姓名: '林福氣伯伯', 訪視日期: today, 健康數據: '血壓 126/78 · 心率 72', 關懷內容: '電話關懷用藥狀況與營養餐配送', 後續追蹤: '預約下週社區量測追蹤', 更新時間: today },
      ];
    case 'FRUIT_M':
      return [
        { ID: 'FRM-001', 類別: '當季水果', 品名: '玉井頂級愛文芒果禮盒', 單價: '880', 單位: '5斤箱', 庫存量: '60', 產地: '台南玉井', 供應商: '玉井果農產銷班', 備註: '在欉紅自然熟成', 更新時間: nowStr },
      ];
    case 'FRUIT_T':
      return [
        { ID: 'FRT-001', 狀態: '賣出', 品名: '玉井頂級愛文芒果禮盒', 日期: today, 數量: '4', 總金額: '3520', 經手人: memberMid, 備註: '社區團購面交取貨', 更新時間: today },
      ];
    case 'GROCERY_M':
      return [
        { ID: 'GRM-001', 狀態: '庫存中', 品名: '有機履歷舒康雞胸肉', 物品類別: '生鮮肉品', 存放位置: '冷藏', 數量: '6', 單位: '包', 購買日期: today, 有效期限: getOffsetDateStr(5), 備註: '每日高蛋白補貨基準 5 包', 更新時間: nowStr },
      ];
    case 'GROCERY_T':
      return [
        { ID: 'GRT-001', 狀態: '入庫', 品名: '有機履歷舒康雞胸肉', 購買日期: today, 有效期限: getOffsetDateStr(5), 數量: '6', 處理方式: '分裝冷藏保存', 備註: '產銷直送批號 #SC09', 更新時間: today },
      ];
    case 'ASSOC_M':
      return [
        { ID: 'ASM-001', 會籍狀態: '理監事', 診所與單位: '仁愛康健整合診所', 負責人姓名: '陳建國院長', 手機: '0933-888-100', 擔任職務: '常務理事', 繳費狀態: '本年度已繳', 入會年份: '2023', 單位地址: '台中市大甲區仁愛路四段', 備註: '中醫藥整合照護專長', 更新時間: nowStr },
      ];
    case 'ASSOC_T':
      return [
        { ID: 'AST-001', 狀態: '未繳', 診所與單位: '仁愛康健整合診所', 年度: '2026', 繳費項目: '2026 年度常年會費暨聯誼晚宴', 金額: '3600', 備註: '待財務確認入帳核銷', 更新時間: today },
      ];
    case 'BOOKING_M':
      return [
        { ID: 'BKM-001', 狀態: '開放預約', 服務名稱: 'AI 軟體 1+1 一對一深度體驗導覽', 服務時長: '45', 費用: '0', 會面方式: '線上視訊會議', 簡介: '專人示範通訊錄 CRM、活動行銷與雙軌模組設定，含 30 天免費體驗開通輔導', 更新時間: nowStr },
        { ID: 'BKM-002', 狀態: '開放預約', 服務名稱: '產銷門市合作與系統導入諮詢', 服務時長: '60', 費用: '0', 會面方式: '實體面談 / 門店', 簡介: '針對個人接案、美甲、推拿或生鮮團購主提供雙軌帳務管理規劃', 更新時間: nowStr },
      ];
    case 'TODO_M':
      return [
        { ID: 'TDM-001', 狀態: '進行中', 專案名稱: '新會員 AI 1+1 開通輔導計畫', 類別: '客戶跟進', 優先級: '高優先', 負責人: memberMid, 目標日期: tomorrow, 說明與備註: '協助新推薦夥伴完成通訊錄 CRM 與活動行銷啟用及預約排班設定', 更新時間: nowStr },
        { ID: 'TDM-002', 狀態: '長期規劃', 專案名稱: '週期續約與產銷訂單月度檢視', 類別: '財務帳務', 優先級: '中優先', 負責人: memberMid, 目標日期: getOffsetDateStr(7), 說明與備註: '定期檢查名下雙軌節點續約效期與 100 點閉環獎金明細', 更新時間: nowStr },
      ];
    case 'TODO_T':
      return [
        { ID: 'TDT-001', 狀態: '待處理', 事項標題: '聯繫今日預約體驗客戶確認上線時段', 專案名稱: '新會員 AI 1+1 開通輔導計畫', 優先級: '緊急重要', 截止日期: today, 提醒時間: '10:30', 承辦人: memberMid, 結束時間: '', 詳細說明: '提前傳送線上會議連結與體驗手冊，完成打卡紀錄', 更新時間: today },
        { ID: 'TDT-002', 狀態: '進行中', 事項標題: '整理本週門店教育講座活動花絮發布', 專案名稱: '新會員 AI 1+1 開通輔導計畫', 優先級: '高', 截止日期: tomorrow, 提醒時間: '15:00', 承辦人: memberMid, 結束時間: '', 詳細說明: '上傳現場照片至 EVENT_T 並通知直推夥伴報名下場次', 更新時間: today },
        { ID: 'TDT-003', 狀態: '待處理', 事項標題: '確認未續約體驗名單與關懷通知', 專案名稱: '週期續約與產銷訂單月度檢視', 優先級: '緊急重要', 截止日期: getOffsetDateStr(-1), 提醒時間: '18:00', 承辦人: memberMid, 結束時間: '', 詳細說明: '提醒 30 天體驗即將屆滿會員完成 100 元月租續約以避免觸發熔斷', 更新時間: today },
      ];
    default:
      return [];
  }
}

export function getMemberUnlockedPacks(memberMid: string): string[] {
  const key = `${STORAGE_PREFIX}UNLOCKED_V2_${memberMid}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  // 新會員 1+1 AI 軟體預設標配：通訊錄 CRM (CONTACT) + 活動行銷 (EVENT)
  return ['CONTACT', 'EVENT'];
}

export function saveMemberUnlockedPacks(memberMid: string, packs: string[]) {
  const key = `${STORAGE_PREFIX}UNLOCKED_V2_${memberMid}`;
  try {
    localStorage.setItem(key, JSON.stringify(packs));
  } catch {
    // ignore
  }
}

export function initNewMemberDefaultPacks(memberMid: string) {
  saveMemberUnlockedPacks(memberMid, ['CONTACT', 'EVENT']);
}

export function loadMemberDynamicRecords(memberMid: string, sysType: string): DynamicRecord[] {
  const key = `${STORAGE_PREFIX}${memberMid}_${sysType}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw) as DynamicRecord[];
    }
  } catch {
    // ignore
  }
  const seeded = createDefaultSeedForModule(sysType, memberMid);
  saveMemberDynamicRecords(memberMid, sysType, seeded);
  return seeded;
}

export function saveMemberDynamicRecords(memberMid: string, sysType: string, list: DynamicRecord[]) {
  const key = `${STORAGE_PREFIX}${memberMid}_${sysType}`;
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // ignore
  }
}

// ================= AI 軟體完整雙軌模組架構訂購與訂閱授權系統 =================

export type ModuleSubscriptionStatus =
  | 'NOT_ORDERED'
  | 'TRIAL_ACTIVE'
  | 'ACTIVE_RENEWED'
  | 'EXPIRED_FROZEN';

export interface SoftwareModuleSubscription {
  moduleKey: string; // 'CONTACT' | 'EVENT' | 'ATOMY' | 'ELDER' | 'PRODUCT' | 'FRUIT' | 'GROCERY' | 'NAIL' | 'ASSOC' | 'TCM' | 'BOOKING' | 'TODO'
  licenseCode: string;
  status: ModuleSubscriptionStatus;
  activatedAt?: string;
  expiresAt?: string;
  monthlyRentNtd: number;
  totalRenewalsCount: number;
  lastSettlementTxnId?: string;
  binaryNodeId?: string;
  binaryParentId?: string;
  binaryPosition?: 'L' | 'R' | 'ROOT';
  binaryDepth?: number;
  extraBinaryNodeIds?: string[];
}

export interface SoftwareOrderReceiptItem {
  moduleKey: string;
  title: string;
  codeLabel: string;
  action: 'TRIAL_ACTIVATE' | 'PAID_RENEWAL' | 'NEW_BINARY_SEAT';
  amountNtd: number;
  newExpiresAt: string;
  settlementTxnId?: string;
  binaryNodeId?: string;
  binaryParentId?: string;
  binaryPosition?: 'L' | 'R' | 'ROOT';
  binaryDepth?: number;
  isNewBinaryNode?: boolean;
}

export interface SoftwareOrderReceipt {
  orderId: string;
  memberMid: string;
  items: SoftwareOrderReceiptItem[];
  totalAmountNtd: number;
  settlementBreakdowns: SettlementBreakdown[];
  createdAt: string;
}

export interface OrderableModuleCatalogItem {
  key: string;
  title: string;
  codeLabel: string;
  masterDesc: string;
  transDesc: string;
  monthlyRentNtd: number;
  trialDays: number;
  isCore1Plus1?: boolean;
  isBooking?: boolean;
}

export const ORDERABLE_SOFTWARE_CATALOG: OrderableModuleCatalogItem[] = [
  {
    key: 'BOOKING',
    title: '個人預約系統',
    codeLabel: 'BOOKING_M/T',
    masterDesc: '預約服務主檔 (服務項目/時長/會面方式排班)',
    transDesc: '個人預約明細 (姓名/手機/電話/日期/時間/事由/備註/詳細情況)',
    monthlyRentNtd: 100,
    trialDays: 30,
    isBooking: true,
  },
  {
    key: 'TODO',
    title: '代辦事項系統',
    codeLabel: 'TODO_M/T',
    masterDesc: '代辦專案主檔 (專案類別/優先級/目標日期/負責人)',
    transDesc: '代辦事項明細 (截止日期/提醒時間/完成打卡追蹤流水)',
    monthlyRentNtd: 100,
    trialDays: 30,
  },
  {
    key: 'ATOMY',
    title: '艾多美會員',
    codeLabel: 'ATOMY_M/T',
    masterDesc: '艾多美會員 (經營狀態/會員編號/推薦人/安置人/線別)',
    transDesc: '銷售與跟進流水 (業績累計與成交金額)',
    monthlyRentNtd: 100,
    trialDays: 30,
  },
  {
    key: 'ELDER',
    title: '長者關懷紀錄',
    codeLabel: 'ELDER_M/T',
    masterDesc: '長者關懷紀錄 (所屬班別/長者編號/班長/緊急電話/家屬)',
    transDesc: '訪視紀錄 (血壓數據/關懷內容/異常追蹤)',
    monthlyRentNtd: 100,
    trialDays: 30,
  },
  {
    key: 'PRODUCT',
    title: '購物車產品',
    codeLabel: 'PRODUCT_M/T',
    masterDesc: '購物車產品 (類別/品名/價格/單位/產品備註)',
    transDesc: '訂單紀錄 (下單數量/總金額/出貨結案營利)',
    monthlyRentNtd: 100,
    trialDays: 30,
  },
  {
    key: 'FRUIT',
    title: '水果店管理',
    codeLabel: 'FRUIT_M/T',
    masterDesc: '水果店管理 (分類/單價/單位/庫存量/產地/供應商)',
    transDesc: '進銷存流水 (進貨/賣出/報廢損益結算)',
    monthlyRentNtd: 100,
    trialDays: 30,
  },
  {
    key: 'GROCERY',
    title: '家庭食材庫存 (FIFO)',
    codeLabel: 'GROCERY_M/T',
    masterDesc: '家庭食材庫存 FIFO (物品類別/存放位置/數量/有效期限)',
    transDesc: '進出庫紀錄 (購買日期/有效期限預警追蹤)',
    monthlyRentNtd: 100,
    trialDays: 30,
  },
  {
    key: 'NAIL',
    title: '美甲醫美預約',
    codeLabel: 'NAIL_M/T',
    masterDesc: '美甲醫美預約 (美甲師/預約時段/施作項目/預估金額)',
    transDesc: '預約流水線 (美甲師打卡開始與結帳營利)',
    monthlyRentNtd: 100,
    trialDays: 30,
  },
  {
    key: 'ASSOC',
    title: '大甲區中醫藥聯誼會',
    codeLabel: 'ASSOC_M/T',
    masterDesc: '大甲區中醫藥聯誼會 (會籍/診所單位/負責人/職務/會費)',
    transDesc: '繳費與活動 (常年會費催繳與活動核銷金額)',
    monthlyRentNtd: 100,
    trialDays: 30,
  },
  {
    key: 'TCM',
    title: '推拿預約管理',
    codeLabel: 'TCM_M/T',
    masterDesc: '推拿預約管理 (預約時段/推拿師/部位與症狀/處置備註)',
    transDesc: '推拿流水線 (動態表單/師傅節數打卡結帳)',
    monthlyRentNtd: 100,
    trialDays: 30,
  },
  {
    key: 'CONTACT',
    title: '通訊錄系統',
    codeLabel: 'CONTACT_M/T',
    masterDesc: '通訊錄系統 (關係分類/姓名/手機/電話/Line/Email/地址)',
    transDesc: '聯繫追蹤紀錄 (洽談內容/下一步推進日誌)',
    monthlyRentNtd: 100,
    trialDays: 30,
    isCore1Plus1: true,
  },
  {
    key: 'EVENT',
    title: '活動花絮系統',
    codeLabel: 'EVENT_M/T',
    masterDesc: '活動花絮系統 (活動分類/活動主題/照片標題/拍攝地點/備註)',
    transDesc: '活動花絮明細 (現場照片標題與實況發布)',
    monthlyRentNtd: 100,
    trialDays: 30,
    isCore1Plus1: true,
  },
];

const SUB_PREFIX = 'AIS_SOFTWARE_SUBS_V1_';
const RECEIPT_PREFIX = 'AIS_SOFTWARE_ORDERS_V1_';

export function getMemberModuleSubscriptions(
  memberMid: string,
  memberTrialExpiresAt?: string
): Record<string, SoftwareModuleSubscription> {
  const key = `${SUB_PREFIX}${memberMid}`;
  const unlocked = getMemberUnlockedPacks(memberMid);
  let stored: Record<string, SoftwareModuleSubscription> = {};

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      stored = JSON.parse(raw) as Record<string, SoftwareModuleSubscription>;
    }
  } catch {
    // ignore
  }

  const now = new Date();
  const defaultExpiry =
    memberTrialExpiresAt || new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();

  const result: Record<string, SoftwareModuleSubscription> = {};

  ORDERABLE_SOFTWARE_CATALOG.forEach((cat) => {
    if (cat.isBooking) return; // BOOKING synced from erpEngine.getBookingProfile()
    const existing = stored[cat.key];
    if (existing) {
      // Refresh expiry status
      if (
        existing.expiresAt &&
        new Date(existing.expiresAt).getTime() < Date.now() &&
        existing.status !== 'NOT_ORDERED'
      ) {
        result[cat.key] = { ...existing, status: 'EXPIRED_FROZEN' };
      } else {
        result[cat.key] = existing;
      }
    } else if (cat.isCore1Plus1 || unlocked.includes(cat.key)) {
      result[cat.key] = {
        moduleKey: cat.key,
        licenseCode: `SW-${cat.key}-${memberMid.replace(/[^A-Z0-9]/gi, '')}`,
        status: 'TRIAL_ACTIVE',
        activatedAt: now.toISOString(),
        expiresAt: defaultExpiry,
        monthlyRentNtd: 100,
        totalRenewalsCount: 0,
      };
    } else {
      result[cat.key] = {
        moduleKey: cat.key,
        licenseCode: `SW-${cat.key}-${memberMid.replace(/[^A-Z0-9]/gi, '')}`,
        status: 'NOT_ORDERED',
        monthlyRentNtd: 100,
        totalRenewalsCount: 0,
      };
    }
  });

  return result;
}

export function saveMemberModuleSubscriptions(
  memberMid: string,
  subs: Record<string, SoftwareModuleSubscription>
) {
  const key = `${SUB_PREFIX}${memberMid}`;
  try {
    localStorage.setItem(key, JSON.stringify(subs));
  } catch {
    // ignore
  }
}

export function getMemberOrderReceipts(memberMid: string): SoftwareOrderReceipt[] {
  const key = `${RECEIPT_PREFIX}${memberMid}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw) as SoftwareOrderReceipt[];
    }
  } catch {
    // ignore
  }
  return [];
}

export function appendMemberOrderReceipt(memberMid: string, receipt: SoftwareOrderReceipt) {
  const existing = getMemberOrderReceipts(memberMid);
  const next = [receipt, ...existing].slice(0, 50);
  try {
    localStorage.setItem(`${RECEIPT_PREFIX}${memberMid}`, JSON.stringify(next));
  } catch {
    // ignore
  }
}

// ============================================================
// 會員個人化擴充：下拉選單自訂手寫選項 / 自訂左側選單項目 / 拖移排序持久化
// ============================================================

const CUSTOM_SELECT_OPTS_PREFIX = 'AIS_CUSTOM_SELECT_OPTS_V1_';
const CUSTOM_MODULES_PREFIX = 'AIS_CUSTOM_MODULES_V1_';
const SIDEBAR_PACK_ORDER_PREFIX = 'AIS_SIDEBAR_PACK_ORDER_V1_';
const SIDEBAR_TOP_ORDER_PREFIX = 'AIS_SIDEBAR_TOP_ORDER_V1_';

export type SidebarTopNavId = 'ALL' | 'ORG_TREE' | 'BOOKING' | 'TODO_BOARD' | 'ORDER_STORE';

export const DEFAULT_SIDEBAR_TOP_ORDER: SidebarTopNavId[] = [
  'ALL',
  'ORG_TREE',
  'BOOKING',
  'TODO_BOARD',
  'ORDER_STORE',
];

export interface CustomMemberModuleDef {
  baseKey: string;
  title: string;
  cats: string[];
  nameFieldLabel?: string;
  iconColor: string;
  createdAt: string;
}

function loadCustomSelectOptionsMap(memberMid: string): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(`${CUSTOM_SELECT_OPTS_PREFIX}${memberMid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, string[]>;
      }
    }
  } catch {
    // ignore
  }
  return {};
}

function saveCustomSelectOptionsMap(memberMid: string, map: Record<string, string[]>) {
  try {
    localStorage.setItem(`${CUSTOM_SELECT_OPTS_PREFIX}${memberMid}`, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getMemberCustomSelectOptions(
  memberMid: string,
  sysKey: string,
  fieldId: string
): string[] {
  const map = loadCustomSelectOptionsMap(memberMid);
  const list = map[`${sysKey}::${fieldId}`];
  return Array.isArray(list) ? list : [];
}

export function addMemberCustomSelectOption(
  memberMid: string,
  sysKey: string,
  fieldId: string,
  rawValue: string
): string[] {
  const val = rawValue.trim();
  if (!val) return getMemberCustomSelectOptions(memberMid, sysKey, fieldId);
  const map = loadCustomSelectOptionsMap(memberMid);
  const compositeKey = `${sysKey}::${fieldId}`;
  const current = Array.isArray(map[compositeKey]) ? map[compositeKey] : [];
  if (!current.includes(val)) {
    map[compositeKey] = [...current, val];
    saveCustomSelectOptionsMap(memberMid, map);
  }
  return map[compositeKey];
}

export function getMergedSelectOptions(
  memberMid: string,
  sysKey: string,
  fieldId: string,
  baseOptions: string[] = [],
  extraValues: string[] = []
): string[] {
  const custom = getMemberCustomSelectOptions(memberMid, sysKey, fieldId);
  const seen = new Set<string>();
  const merged: string[] = [];
  [...baseOptions, ...custom, ...extraValues].forEach((opt) => {
    const clean = String(opt || '').trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      merged.push(clean);
    }
  });
  return merged;
}

export function getMemberCustomModules(memberMid: string): CustomMemberModuleDef[] {
  try {
    const raw = localStorage.getItem(`${CUSTOM_MODULES_PREFIX}${memberMid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as CustomMemberModuleDef[];
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveMemberCustomModules(memberMid: string, modules: CustomMemberModuleDef[]) {
  try {
    localStorage.setItem(`${CUSTOM_MODULES_PREFIX}${memberMid}`, JSON.stringify(modules));
  } catch {
    // ignore
  }
}

export function addMemberCustomModule(
  memberMid: string,
  input: {
    title: string;
    cats?: string[];
    nameFieldLabel?: string;
    iconColor?: string;
  }
): CustomMemberModuleDef {
  const existing = getMemberCustomModules(memberMid);
  const baseKey = `CUSTOM_${Date.now().toString(36).toUpperCase()}`;
  const cleanCats = (input.cats || [])
    .map((c) => c.trim())
    .filter(Boolean);
  const cats = cleanCats.length > 0 ? Array.from(new Set(cleanCats)) : ['進行中', '待追蹤', '已完成'];
  const created: CustomMemberModuleDef = {
    baseKey,
    title: input.title.trim(),
    cats,
    nameFieldLabel: (input.nameFieldLabel || '項目名稱').trim() || '項目名稱',
    iconColor: input.iconColor || 'text-indigo-600',
    createdAt: new Date().toISOString(),
  };
  saveMemberCustomModules(memberMid, [...existing, created]);
  return created;
}

export function removeMemberCustomModule(memberMid: string, baseKey: string): CustomMemberModuleDef[] {
  const next = getMemberCustomModules(memberMid).filter((m) => m.baseKey !== baseKey);
  saveMemberCustomModules(memberMid, next);
  return next;
}

export function buildCustomSysConfig(def: CustomMemberModuleDef): SysModuleConfig {
  const cats = def.cats.length > 0 ? def.cats : ['進行中', '待追蹤', '已完成'];
  const nameLabel = def.nameFieldLabel || '項目名稱';
  return {
    key: `${def.baseKey}_M`,
    baseKey: def.baseKey,
    name: def.title,
    iconColor: def.iconColor || 'text-indigo-600',
    searchMsg: `🔍 搜尋${nameLabel}、分類、手機、備註...`,
    catField: '分類',
    defaultCat: cats[0],
    nameField: '名稱',
    cats,
    cardLine1: { label: '手機/聯絡', key: '手機' },
    cardLine2: { label: '日期', key: '日期' },
    fields: [
      { id: '分類', label: '分類標籤 👈*', type: 'select', options: cats, required: true },
      { id: '名稱', label: `👤 ${nameLabel} 👈*`, type: 'text', required: true },
      { id: '手機', label: '📱 手機/聯絡', type: 'tel', half: true },
      { id: '日期', label: '📅 日期', type: 'date', half: true },
      { id: '金額', label: '💲 金額/數量', type: 'number', half: true },
      { id: '對象', label: '🏷️ 負責人/對象', type: 'text', half: true },
      { id: '備註', label: '📝 詳細備註', type: 'textarea' },
    ],
  };
}

export function getResolvedSysConfig(
  memberMid: string,
  sysKey: string
): SysModuleConfig | undefined {
  if (SYS_CONFIG[sysKey]) return SYS_CONFIG[sysKey];
  const customs = getMemberCustomModules(memberMid);
  for (const def of customs) {
    if (`${def.baseKey}_M` === sysKey) {
      return buildCustomSysConfig(def);
    }
  }
  return undefined;
}

export function getMemberSidebarPackOrder(memberMid: string): string[] {
  try {
    const raw = localStorage.getItem(`${SIDEBAR_PACK_ORDER_PREFIX}${memberMid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveMemberSidebarPackOrder(memberMid: string, order: string[]) {
  try {
    localStorage.setItem(`${SIDEBAR_PACK_ORDER_PREFIX}${memberMid}`, JSON.stringify(order));
  } catch {
    // ignore
  }
}

export function getMemberSidebarTopOrder(memberMid: string): SidebarTopNavId[] {
  try {
    const raw = localStorage.getItem(`${SIDEBAR_TOP_ORDER_PREFIX}${memberMid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((id): id is SidebarTopNavId =>
          DEFAULT_SIDEBAR_TOP_ORDER.includes(id as SidebarTopNavId)
        );
        const missing = DEFAULT_SIDEBAR_TOP_ORDER.filter((id) => !valid.includes(id));
        return [...valid, ...missing];
      }
    }
  } catch {
    // ignore
  }
  return [...DEFAULT_SIDEBAR_TOP_ORDER];
}

export function saveMemberSidebarTopOrder(memberMid: string, order: SidebarTopNavId[]) {
  try {
    localStorage.setItem(`${SIDEBAR_TOP_ORDER_PREFIX}${memberMid}`, JSON.stringify(order));
  } catch {
    // ignore
  }
}


