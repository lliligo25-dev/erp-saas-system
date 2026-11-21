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
  { baseKey: 'CONTACT', title: '通訊錄 CRM', desc: '通訊主檔 + 聯繫追蹤日誌' },
  { baseKey: 'EVENT', title: '活動行銷', desc: '活動企劃檔 + 現場花絮' },
  { baseKey: 'BOOKING', title: '個人預約系統', desc: '預約服務主檔 + 個人預約明細表單' },
  { baseKey: 'TODO', title: '代辦事項系統', desc: '代辦專案分類檔 + 待辦執行追蹤明細' },
  { baseKey: 'ATOMY', title: '經銷組織會員', desc: '會員主檔 + 銷售與跟進' },
  { baseKey: 'PRODUCT', title: '產銷商品訂單', desc: '產品主檔 + 訂單出貨紀錄' },
  { baseKey: 'NAIL', title: '美甲沙龍預約', desc: '美甲會員檔 + 預約流水線' },
  { baseKey: 'TCM', title: '推拿養生調理', desc: '推拿會員總表 + 推拿流水線' },
  { baseKey: 'ELDER', title: '銀髮關懷照護', desc: '長者主檔 + 訪視紀錄' },
  { baseKey: 'FRUIT', title: '生鮮蔬果產銷', desc: '水果品項檔 + 進銷存流水' },
  { baseKey: 'GROCERY', title: '居家生鮮庫存', desc: '食材主檔 + 進出庫效期' },
  { baseKey: 'ASSOC', title: '公會聯誼管理', desc: '聯誼會員檔 + 繳費與活動' },
];

export const SYS_CONFIG: Record<string, SysModuleConfig> = {
  CONTACT_M: {
    key: 'CONTACT_M',
    baseKey: 'CONTACT',
    name: '1. 通訊錄主檔',
    iconColor: 'text-blue-600',
    searchMsg: '🔍 搜尋姓名、手機...',
    catField: '狀態',
    defaultCat: '活躍',
    nameField: '姓名',
    cats: ['活躍', '開通AI軟體1+1', '不常聯絡', '黑名單'],
    cardLine1: { label: '手機', key: '手機' },
    cardLine2: { label: '地址', key: '地址' },
    fields: [
      { id: '狀態', label: '狀態 *', type: 'select', options: ['活躍', '開通AI軟體1+1', '不常聯絡', '黑名單'], required: true },
      { id: '姓名', label: '姓名 *', type: 'text', required: true },
      { id: '手機', label: '手機', type: 'tel', half: true },
      { id: '電話', label: '電話', type: 'tel', half: true },
      { id: 'Line', label: 'Line ID', type: 'text', half: true },
      { id: 'Email', label: 'Email', type: 'email', half: true },
      { id: '地址', label: '地址', type: 'textarea' },
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
      { id: '狀態', label: '目前狀態 *', type: 'select', options: ['跟進中', '開通體驗', '已洽談', '已結案', '待確認預約', '無效'], required: true },
      { id: '姓名', label: '姓名 *', type: 'text', required: true },
      { id: '聯繫日期', label: '聯繫日期', type: 'date', half: true },
      { id: '聯繫方式', label: '聯繫方式', type: 'select', options: ['電話', 'Line', '面訪', 'Email', '線上開通', 'AI個人預約系統'], half: true },
      { id: '洽談內容', label: '洽談內容', type: 'textarea' },
      { id: '下一步計畫', label: '下一步計畫', type: 'textarea' },
    ],
  },

  EVENT_M: {
    key: 'EVENT_M',
    baseKey: 'EVENT',
    name: '1. 活動企劃檔',
    iconColor: 'text-blue-600',
    searchMsg: '🔍 搜尋活動主題...',
    catField: '狀態',
    defaultCat: '報名中',
    nameField: '活動主題',
    cats: ['籌備中', '報名中', '進行中', '已結束'],
    cardLine1: { label: '日期', key: '日期' },
    cardLine2: { label: '地點', key: '地點' },
    fields: [
      { id: '狀態', label: '狀態 *', type: 'select', options: ['籌備中', '報名中', '進行中', '已結束'], required: true },
      { id: '活動主題', label: '活動主題 *', type: 'text', required: true },
      { id: '日期', label: '日期', type: 'date', half: true },
      { id: '負責人', label: '負責人', type: 'text', half: true },
      { id: '預算', label: '預算', type: 'number', half: true },
      { id: '地點', label: '地點', type: 'text', half: true },
      { id: '備註', label: '備註', type: 'textarea' },
    ],
  },
  EVENT_T: {
    key: 'EVENT_T',
    baseKey: 'EVENT',
    name: '2. 活動花絮',
    iconColor: 'text-emerald-600',
    searchMsg: '🔍 搜尋照片標題...',
    catField: '狀態',
    defaultCat: '公開發布',
    nameField: '活動主題',
    cats: ['審核中', '公開發布', '已發布'],
    cardLine1: { label: '照片標題', key: '照片標題' },
    cardLine2: { label: '拍攝地點', key: '拍攝地點' },
    fields: [
      { id: '狀態', label: '狀態 *', type: 'select', options: ['審核中', '公開發布', '已發布'], required: true },
      { id: '活動主題', label: '活動主題 *', type: 'text', required: true },
      { id: '照片標題', label: '照片標題', type: 'text', half: true },
      { id: '拍攝地點', label: '拍攝地點', type: 'text', half: true },
      { id: '內容備註', label: '內容備註', type: 'textarea' },
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
    name: '1. 會員主檔',
    iconColor: 'text-blue-600',
    searchMsg: '🔍 搜尋姓名、會員編號...',
    catField: '狀態',
    defaultCat: '愛用者',
    nameField: '姓名',
    cats: ['經營者', '愛用者', '潛在對象', '停止活動'],
    cardLine1: { label: '會員編號', key: '會員編號' },
    cardLine2: { label: '線別', key: '線別' },
    fields: [
      { id: '狀態', label: '狀態 *', type: 'select', options: ['經營者', '愛用者', '潛在對象', '停止活動'], required: true },
      { id: '姓名', label: '姓名 *', type: 'text', required: true },
      { id: '會員編號', label: '會員編號', type: 'text', half: true },
      { id: '手機', label: '手機', type: 'tel', half: true },
      { id: 'Line', label: 'Line ID', type: 'text', half: true },
      { id: '推薦人', label: '推薦人', type: 'text', half: true },
      { id: '線別', label: '線別(左/右)', type: 'text' },
      { id: '備註', label: '備註', type: 'textarea' },
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
      { id: '狀態', label: '狀態 *', type: 'select', options: ['跟進中', '已成交', '無效'], required: true },
      { id: '姓名', label: '姓名 *', type: 'text', required: true },
      { id: '跟進日期', label: '跟進日期', type: 'date', half: true },
      { id: '消費項目', label: '消費項目', type: 'text', half: true },
      { id: '消費金額', label: '消費金額', type: 'number', half: true },
      { id: '需求備註', label: '需求備註', type: 'textarea' },
    ],
  },

  ELDER_M: {
    key: 'ELDER_M',
    baseKey: 'ELDER',
    name: '1. 長者主檔',
    iconColor: 'text-blue-600',
    searchMsg: '🔍 搜尋姓名、班別...',
    catField: '狀態',
    defaultCat: '關懷中',
    nameField: '姓名',
    cats: ['關懷中', '結案'],
    cardLine1: { label: '手機', key: '手機' },
    cardLine2: { label: '班別', key: '班別' },
    fields: [
      { id: '狀態', label: '狀態 *', type: 'select', options: ['關懷中', '結案'], required: true },
      { id: '姓名', label: '姓名 *', type: 'text', required: true },
      { id: '編號', label: '編號', type: 'text', half: true },
      { id: '手機', label: '手機', type: 'tel', half: true },
      { id: '班別', label: '班別', type: 'text', half: true },
      { id: '緊急電話', label: '緊急電話', type: 'tel', half: true },
      { id: '家屬', label: '家屬聯絡', type: 'text' },
      { id: '地址', label: '地址', type: 'text' },
      { id: '健康備註', label: '健康備註', type: 'textarea' },
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
      { id: '狀態', label: '狀態 *', type: 'select', options: ['待訪視', '已訪視', '異常追蹤'], required: true },
      { id: '姓名', label: '姓名 *', type: 'text', required: true },
      { id: '訪視日期', label: '訪視日期', type: 'date', half: true },
      { id: '健康數據', label: '健康數據(血壓等)', type: 'text', half: true },
      { id: '關懷內容', label: '關懷內容', type: 'textarea' },
      { id: '後續追蹤', label: '後續追蹤', type: 'textarea' },
    ],
  },

  PRODUCT_M: {
    key: 'PRODUCT_M',
    baseKey: 'PRODUCT',
    name: '1. 產品主檔',
    iconColor: 'text-blue-600',
    searchMsg: '🔍 搜尋品名...',
    catField: '狀態',
    defaultCat: '上架中',
    nameField: '品名',
    cats: ['上架中', '已下架'],
    cardLine1: { label: '價格', key: '價格' },
    cardLine2: { label: '庫存', key: '庫存' },
    fields: [
      { id: '狀態', label: '狀態 *', type: 'select', options: ['上架中', '已下架'], required: true },
      { id: '品名', label: '品名 *', type: 'text', required: true },
      { id: '類別', label: '類別', type: 'text', half: true },
      { id: '價格', label: '價格', type: 'number', half: true },
      { id: '單位', label: '單位', type: 'text', half: true },
      { id: '庫存', label: '庫存', type: 'number', half: true },
      { id: '備註', label: '備註', type: 'textarea' },
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
      { id: '狀態', label: '狀態 *', type: 'select', options: ['待處理', '已出貨', '已完成', '已結案', '取消'], required: true },
      { id: '姓名', label: '客戶姓名 *', type: 'text', required: true },
      { id: '品名', label: '品名', type: 'text', half: true },
      { id: '數量', label: '數量', type: 'number', half: true },
      { id: '總金額', label: '總金額', type: 'number', half: true },
      { id: '寄送地址', label: '寄送地址', type: 'text' },
      { id: '備註', label: '備註', type: 'textarea' },
    ],
  },

  FRUIT_M: {
    key: 'FRUIT_M',
    baseKey: 'FRUIT',
    name: '1. 水果品項檔',
    iconColor: 'text-blue-600',
    searchMsg: '🔍 搜尋水果品名...',
    catField: '狀態',
    defaultCat: '販售中',
    nameField: '品名',
    cats: ['販售中', '已斷貨'],
    cardLine1: { label: '單價', key: '單價' },
    cardLine2: { label: '產地', key: '產地' },
    fields: [
      { id: '狀態', label: '狀態 *', type: 'select', options: ['販售中', '已斷貨'], required: true },
      { id: '品名', label: '品名 *', type: 'text', required: true },
      { id: '類別', label: '類別', type: 'text', half: true },
      { id: '單價', label: '單價', type: 'number', half: true },
      { id: '單位', label: '單位', type: 'text', half: true },
      { id: '庫存量', label: '庫存量', type: 'number', half: true },
      { id: '產地', label: '產地', type: 'text', half: true },
      { id: '供應商', label: '供應商', type: 'text' },
      { id: '備註', label: '備註(成熟度等)', type: 'textarea' },
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
      { id: '狀態', label: '交易類別 *', type: 'select', options: ['進貨', '賣出', '報廢'], required: true },
      { id: '品名', label: '品名 *', type: 'text', required: true },
      { id: '日期', label: '日期', type: 'date', half: true },
      { id: '數量', label: '數量', type: 'number', half: true },
      { id: '總金額', label: '總金額', type: 'number', half: true },
      { id: '經手人', label: '經手人', type: 'text', half: true },
      { id: '備註', label: '備註', type: 'textarea' },
    ],
  },

  GROCERY_M: {
    key: 'GROCERY_M',
    baseKey: 'GROCERY',
    name: '1. 食材主檔',
    iconColor: 'text-blue-600',
    searchMsg: '🔍 搜尋食材品名...',
    catField: '狀態',
    defaultCat: '常備品',
    nameField: '品名',
    cats: ['常備品', '偶爾買'],
    cardLine1: { label: '預設位置', key: '預設位置' },
    cardLine2: { label: '單位', key: '單位' },
    fields: [
      { id: '狀態', label: '狀態 *', type: 'select', options: ['常備品', '偶爾買'], required: true },
      { id: '品名', label: '品名 *', type: 'text', required: true },
      { id: '類別', label: '類別', type: 'select', options: ['生鮮肉品', '蔬菜水果', '冷凍食品', '乾貨零食', '飲料乳品', '生活日用'], half: true },
      { id: '預設位置', label: '預設位置', type: 'select', options: ['冷藏', '冷凍', '常溫層', '零食櫃', '儲藏室'], half: true },
      { id: '單位', label: '單位', type: 'text', half: true },
      { id: '備註', label: '備註', type: 'textarea' },
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
      { id: '狀態', label: '動向 *', type: 'select', options: ['入庫', '出庫/吃完', '過期丟棄'], required: true },
      { id: '品名', label: '品名 *', type: 'text', required: true },
      { id: '購買日期', label: '購買日期', type: 'date', half: true },
      { id: '有效期限', label: '有效期限', type: 'date', half: true },
      { id: '數量', label: '數量', type: 'number', half: true },
      { id: '處理方式', label: '處理方式', type: 'text', half: true },
      { id: '備註', label: '備註', type: 'textarea' },
    ],
  },

  NAIL_M: {
    key: 'NAIL_M',
    baseKey: 'NAIL',
    name: '1. 美甲會員檔',
    iconColor: 'text-blue-600',
    searchMsg: '🔍 搜尋美甲會員姓名...',
    catField: '狀態',
    defaultCat: '活躍會員',
    nameField: '姓名',
    cats: ['活躍會員', '久未回店'],
    cardLine1: { label: '手機', key: '手機' },
    cardLine2: { label: '偏好款式', key: '偏好款式' },
    fields: [
      { id: '狀態', label: '狀態 *', type: 'select', options: ['活躍會員', '久未回店'], required: true },
      { id: '姓名', label: '姓名 *', type: 'text', required: true },
      { id: '手機', label: '手機', type: 'tel', half: true },
      { id: '性別', label: '性別', type: 'select', options: ['女', '男'], half: true },
      { id: '生日', label: '生日', type: 'date', half: true },
      { id: '偏好款式', label: '偏好款式', type: 'text', half: true },
      { id: '備註', label: '備註(過敏史等)', type: 'textarea' },
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
    nameField: '姓名',
    cats: ['預約中', '施作中', '已完成', '取消'],
    cardLine1: { label: '預約日期', key: '預約日期' },
    cardLine2: { label: '指定美甲師', key: '指定美甲師' },
    fields: [
      { id: '狀態', label: '狀態 *', type: 'select', options: ['預約中', '施作中', '已完成', '取消'], required: true },
      { id: '姓名', label: '客戶姓名 *', type: 'text', required: true },
      { id: '預約日期', label: '預約日期', type: 'date', half: true },
      { id: '預約時段', label: '預約時段', type: 'time', half: true },
      { id: '指定美甲師', label: '指定美甲師', type: 'text', half: true },
      { id: '施作項目', label: '施作項目', type: 'select', options: ['手部單色', '足部單色', '造型設計', '卸甲保養'], half: true },
      { id: '開始時間', label: '開始時間', type: 'datetime-local', half: true },
      { id: '結束時間', label: '結束時間', type: 'datetime-local', half: true },
      { id: '消費金額', label: '消費金額', type: 'number', half: true },
    ],
  },

  ASSOC_M: {
    key: 'ASSOC_M',
    baseKey: 'ASSOC',
    name: '1. 聯誼會員檔',
    iconColor: 'text-blue-600',
    searchMsg: '🔍 搜尋診所/單位...',
    catField: '狀態',
    defaultCat: '正常會員',
    nameField: '單位名稱',
    cats: ['正常會員', '理監事', '停權/退會'],
    cardLine1: { label: '負責人', key: '負責人' },
    cardLine2: { label: '職務', key: '職務' },
    fields: [
      { id: '狀態', label: '狀態 *', type: 'select', options: ['正常會員', '理監事', '停權/退會'], required: true },
      { id: '單位名稱', label: '診所/單位 *', type: 'text', required: true },
      { id: '負責人', label: '負責人', type: 'text', half: true },
      { id: '手機', label: '手機', type: 'tel', half: true },
      { id: '職務', label: '職務', type: 'text', half: true },
      { id: '入會年', label: '入會年(西元)', type: 'number', half: true },
      { id: '地址', label: '地址', type: 'textarea' },
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
    nameField: '單位名稱',
    cats: ['未繳', '已繳', '已完成', '已參加'],
    cardLine1: { label: '年度', key: '年度' },
    cardLine2: { label: '金額', key: '金額' },
    fields: [
      { id: '狀態', label: '狀態 *', type: 'select', options: ['未繳', '已繳', '已完成', '已參加'], required: true },
      { id: '單位名稱', label: '診所/單位 *', type: 'text', required: true },
      { id: '年度', label: '年度', type: 'text', half: true },
      { id: '繳費項目', label: '項目(會費/聚餐)', type: 'text', half: true },
      { id: '金額', label: '金額', type: 'number', half: true },
      { id: '備註', label: '備註', type: 'textarea' },
    ],
  },

  TCM_M: {
    key: 'TCM_M',
    baseKey: 'TCM',
    name: '1. 推拿會員總表',
    iconColor: 'text-blue-600',
    searchMsg: '🔍 搜尋推拿會員姓名、手機...',
    catField: '狀態',
    defaultCat: '活躍會員',
    nameField: '姓名',
    cats: ['活躍會員', '久未回診', '黑名單'],
    cardLine1: { label: '手機', key: '手機' },
    cardLine2: { label: '生日', key: '生日' },
    fields: [
      { id: '狀態', label: '會員狀態 *', type: 'select', options: ['活躍會員', '久未回診', '黑名單'], required: true },
      { id: '姓名', label: '姓名 *', type: 'text', required: true },
      { id: '手機', label: '手機', type: 'tel', half: true },
      { id: '性別', label: '性別', type: 'select', options: ['男', '女', '其他'], half: true },
      { id: '生日', label: '生日', type: 'date', half: true },
      { id: '病史與備註', label: '病史與身體狀況', type: 'textarea' },
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
    nameField: '姓名',
    cats: ['預約中', '執行中', '已完成', '取消'],
    cardLine1: { label: '預約日期', key: '預約日期' },
    cardLine2: { label: '負責推拿師', key: '負責推拿師' },
    fields: [
      { id: '狀態', label: '狀態 *', type: 'select', options: ['預約中', '執行中', '已完成', '取消'], required: true },
      { id: '姓名', label: '客戶姓名 *', type: 'text', required: true },
      { id: '預約日期', label: '預約日期', type: 'date', half: true },
      { id: '預約時段', label: '預約時段', type: 'time', half: true },
      { id: '負責推拿師', label: '負責推拿師', type: 'select', options: ['李永吉', '李佳馨'], half: true },
      { id: '施作項目', label: '施作項目', type: 'select', options: ['全身推拿', '半身', '腳底', '拔罐', '其他'], half: true },
      { id: '服務節數', label: '服務節數', type: 'select', options: ['0.5', '1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'], half: true },
      { id: '開始時間', label: '開始時間', type: 'datetime-local', half: true },
      { id: '結束時間', label: '結束時間', type: 'datetime-local', half: true },
      { id: '消費金額', label: '消費金額', type: 'number', half: true },
      { id: '處置與備註', label: '處置與備註', type: 'textarea' },
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
        { ID: 'ATM-001', 狀態: '經營者', 姓名: '林佳穎', 會員編號: 'AT-88201', 手機: '0911-223-344', Line: 'jiaying_lin', 推薦人: memberMid, 線別: '左線 A 區', 備註: '每月固定回購蜂蜜飲與益生菌', 更新時間: nowStr },
        { ID: 'ATM-002', 狀態: '愛用者', 姓名: '陳志強', 會員編號: 'AT-88202', 手機: '0928-445-566', Line: 'chiang_chen', 推薦人: memberMid, 線別: '右線 B 區', 備註: '偏好生活日用品與口腔護理組', 更新時間: nowStr },
      ];
    case 'ATOMY_T':
      return [
        { ID: 'ATT-001', 狀態: '跟進中', 姓名: '林佳穎', 跟進日期: tomorrow, 消費項目: '煥力飲 4 盒禮盒組', 消費金額: '12800', 需求備註: '協助了解自用轉經營回饋制度', 更新時間: nowStr },
        { ID: 'ATT-002', 狀態: '已成交', 姓名: '陳志強', 跟進日期: today, 消費項目: '凝萃煥膚六部曲', 消費金額: '6680', 需求備註: '已完成配送與使用教學', 更新時間: nowStr },
      ];
    case 'PRODUCT_M':
      return [
        { ID: 'PRM-001', 狀態: '上架中', 品名: 'AI 產銷合一智聯健康飲禮盒', 類別: '保健食品', 價格: '1980', 單位: '盒', 庫存: '45', 備註: '會員體驗組熱銷第一名', 更新時間: nowStr },
        { ID: 'PRM-002', 狀態: '上架中', 品名: '頂級冷壓初榨植萃油', 類別: '居家生鮮', 價格: '960', 單位: '瓶', 庫存: '30', 備註: '產地直送溯源認證', 更新時間: nowStr },
      ];
    case 'PRODUCT_T':
      return [
        { ID: 'PRT-001', 狀態: '待處理', 姓名: '黃冠傑', 品名: 'AI 產銷合一智聯健康飲禮盒', 數量: '2', 總金額: '3960', 寄送地址: '台北市中山區南京東路三段', 備註: '請附體驗券 2 張', 更新時間: today },
        { ID: 'PRT-002', 狀態: '已出貨', 姓名: '張雅婷', 品名: '頂級冷壓初榨植萃油', 數量: '3', 總金額: '2880', 寄送地址: '新北市板橋區民生路二段', 備註: '物流單號 #TW88291', 更新時間: today },
      ];
    case 'TCM_M':
      return [
        { ID: 'TCM-001', 狀態: '活躍會員', 姓名: '吳明宏', 手機: '0932-112-889', 性別: '男', 生日: '1978-05-14', 病史與備註: '長期久坐肩頸痠痛，偏好深層指壓', 更新時間: nowStr },
      ];
    case 'TCM_T':
      return [
        { ID: 'TCT-001', 狀態: '預約中', 姓名: '吳明宏', 預約日期: today, 預約時段: '15:00', 負責推拿師: '李永吉', 施作項目: '全身推拿', 服務節數: '2.0', 開始時間: '', 結束時間: '', 消費金額: '1600', 處置與備註: '肩頸加強鬆筋', 更新時間: today },
        { ID: 'TCT-002', 狀態: '執行中', 姓名: '周美玲', 預約日期: today, 預約時段: '13:30', 負責推拿師: '李佳馨', 施作項目: '腳底', 服務節數: '1.0', 開始時間: `${today}T13:32`, 結束時間: '', 消費金額: '900', 處置與備註: '足底反射區調理中', 更新時間: today },
      ];
    case 'NAIL_M':
      return [
        { ID: 'NLM-001', 狀態: '活躍會員', 姓名: '劉欣怡', 手機: '0988-331-209', 性別: '女', 生日: '1994-09-22', 偏好款式: '極簡法式貓眼', 備註: '甲面較薄需做建構加厚', 更新時間: nowStr },
      ];
    case 'NAIL_T':
      return [
        { ID: 'NLT-001', 狀態: '預約中', 姓名: '劉欣怡', 預約日期: tomorrow, 預約時段: '14:30', 指定美甲師: 'Mia', 施作項目: '造型設計', 開始時間: '', 結束時間: '', 消費金額: '1580', 更新時間: today },
      ];
    case 'ELDER_M':
      return [
        { ID: 'ELM-001', 狀態: '關懷中', 姓名: '林福氣伯伯', 編號: 'ELD-101', 手機: '0910-554-321', 班別: '大安健康活力班', 緊急電話: '02-2700-1122', 家屬: '林先生 (長子)', 地址: '台北市大安區和平東路二段', 健康備註: '血壓穩定，每週參與體適能課', 更新時間: nowStr },
      ];
    case 'ELDER_T':
      return [
        { ID: 'ELT-001', 狀態: '待訪視', 姓名: '林福氣伯伯', 訪視日期: today, 健康數據: '血壓 126/78 · 心率 72', 關懷內容: '電話關懷用藥狀況與營養餐配送', 後續追蹤: '預約下週社區量測追蹤', 更新時間: today },
      ];
    case 'FRUIT_M':
      return [
        { ID: 'FRM-001', 狀態: '販售中', 品名: '玉井頂級愛文芒果禮盒', 類別: '當季鮮果', 單價: '880', 單位: '5斤箱', 庫存量: '60', 產地: '台南玉井', 供應商: '玉井果農產銷班', 備註: '在欉紅自然熟成', 更新時間: nowStr },
      ];
    case 'FRUIT_T':
      return [
        { ID: 'FRT-001', 狀態: '賣出', 品名: '玉井頂級愛文芒果禮盒', 日期: today, 數量: '4', 總金額: '3520', 經手人: memberMid, 備註: '社區團購面交取貨', 更新時間: today },
      ];
    case 'GROCERY_M':
      return [
        { ID: 'GRM-001', 狀態: '常備品', 品名: '有機履歷舒康雞胸肉', 類別: '生鮮肉品', 預設位置: '冷藏', 單位: '包', 備註: '每日高蛋白補貨基準 5 包', 更新時間: nowStr },
      ];
    case 'GROCERY_T':
      return [
        { ID: 'GRT-001', 狀態: '入庫', 品名: '有機履歷舒康雞胸肉', 購買日期: today, 有效期限: getOffsetDateStr(5), 數量: '6', 處理方式: '分裝冷藏保存', 備註: '產銷直送批號 #SC09', 更新時間: today },
      ];
    case 'ASSOC_M':
      return [
        { ID: 'ASM-001', 狀態: '理監事', 單位名稱: '仁愛康健整合診所', 負責人: '陳建國院長', 手機: '0933-888-100', 職務: '常務理事', 入會年: '2023', 地址: '台北市仁愛路四段', 更新時間: nowStr },
      ];
    case 'ASSOC_T':
      return [
        { ID: 'AST-001', 狀態: '未繳', 單位名稱: '仁愛康健整合診所', 年度: '2026', 繳費項目: '2026 年度常年會費暨聯誼晚宴', 金額: '3600', 備註: '待財務確認入帳核銷', 更新時間: today },
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
    title: '經銷組織會員',
    codeLabel: 'ATOMY_M/T',
    masterDesc: '會員主檔 (推薦人/左右線別/會員編號)',
    transDesc: '銷售與跟進流水 (業績累計與成交金額)',
    monthlyRentNtd: 100,
    trialDays: 30,
  },
  {
    key: 'ELDER',
    title: '銀髮關懷照護',
    codeLabel: 'ELDER_M/T',
    masterDesc: '長者主檔 (班別/家屬/緊急電話/健康備註)',
    transDesc: '訪視紀錄 (血壓數據/關懷內容/異常追蹤)',
    monthlyRentNtd: 100,
    trialDays: 30,
  },
  {
    key: 'PRODUCT',
    title: '產銷商品訂單',
    codeLabel: 'PRODUCT_M/T',
    masterDesc: '產品主檔 (品名/價格/單位/即時庫存)',
    transDesc: '訂單紀錄 (下單數量/總金額/出貨結案營利)',
    monthlyRentNtd: 100,
    trialDays: 30,
  },
  {
    key: 'FRUIT',
    title: '生鮮蔬果產銷',
    codeLabel: 'FRUIT_M/T',
    masterDesc: '水果品項檔 (產地/供應商/單價/熟成度)',
    transDesc: '進銷存流水 (進貨/賣出/報廢損益結算)',
    monthlyRentNtd: 100,
    trialDays: 30,
  },
  {
    key: 'GROCERY',
    title: '居家生鮮庫存',
    codeLabel: 'GROCERY_M/T',
    masterDesc: '食材主檔 (冷藏/冷凍/常溫預設儲存位置)',
    transDesc: '進出庫紀錄 (購買日期/有效期限預警追蹤)',
    monthlyRentNtd: 100,
    trialDays: 30,
  },
  {
    key: 'NAIL',
    title: '美甲沙龍預約',
    codeLabel: 'NAIL_M/T',
    masterDesc: '美甲會員檔 (偏好款式/生日/過敏備註)',
    transDesc: '預約流水線 (美甲師打卡開始與結帳營利)',
    monthlyRentNtd: 100,
    trialDays: 30,
  },
  {
    key: 'ASSOC',
    title: '公會聯誼管理',
    codeLabel: 'ASSOC_M/T',
    masterDesc: '聯誼會員檔 (診所單位/負責人/理監事職務)',
    transDesc: '繳費與活動 (常年會費催繳與活動核銷金額)',
    monthlyRentNtd: 100,
    trialDays: 30,
  },
  {
    key: 'TCM',
    title: '推拿養生調理',
    codeLabel: 'TCM_M/T',
    masterDesc: '推拿會員總表 (性別/生日/病史與身體狀況)',
    transDesc: '推拿流水線 (動態表單/師傅節數打卡結帳)',
    monthlyRentNtd: 100,
    trialDays: 30,
  },
  {
    key: 'CONTACT',
    title: '通訊錄 CRM',
    codeLabel: 'CONTACT_M/T',
    masterDesc: '通訊主檔 (開發名單/Line/地址/會員綁定)',
    transDesc: '聯繫追蹤紀錄 (洽談內容/下一步推進日誌)',
    monthlyRentNtd: 100,
    trialDays: 30,
    isCore1Plus1: true,
  },
  {
    key: 'EVENT',
    title: '活動行銷',
    codeLabel: 'EVENT_M/T',
    masterDesc: '活動企劃主檔 (日期/地點/預算/負責人)',
    transDesc: '活動花絮圖庫 (現場照片標題與實況發布)',
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

